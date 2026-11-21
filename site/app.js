import { CHIPS, prepare, search, picks, ytSearchUrl, ytWatchUrl } from './search.js';
import { extractFacets, expandQuery, hasFacets, wantsNote, whyFits, songFacets, makeNote, describeFacets } from './facets.js';
const $ = s => document.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const SITE = location.origin + location.pathname;
const PAGE = 20;
let data, songs, meta, worker, aiState = 'off', reqId = 0, semCache = new Map();
let state = { q: '', chip: null, shown: PAGE, results: [], facets: null, tone: null };

function toast(msg) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.append(t); setTimeout(() => t.remove(), 2200); }
async function copy(text) { try { await navigator.clipboard.writeText(text); toast('Copied ✓'); } catch { prompt('Copy this:', text); } }
async function shareText(title, text, url) {
  if (navigator.share) { try { await navigator.share({ title, text, url }); return; } catch (e) { if (e.name === 'AbortError') return; } }
  copy(text + (url ? '\n' + url : ''));
}
const songLink = s => s.ytk === 1 ? ytWatchUrl(s) : ytSearchUrl(s);

// ---------- AI (in-browser semantic model) ----------
function renderAI(extra) {
  const el = $('#ai');
  if (aiState === 'off') el.innerHTML = `<span>⚡ Quick search on.</span><button id="ai-on">Turn on smart search</button><span>(understands full sentences · one-time ~${Math.round(118 + meta.n * meta.dim / 1e6)} MB download)</span>`;
  else if (aiState === 'loading') el.innerHTML = `<span>🧠 Loading smart search…</span><span class="bar"><i style="width:${extra || 0}%"></i></span><span>${extra ? extra + '%' : ''}</span>`;
  else if (aiState === 'ready') el.innerHTML = `<span>🧠 Smart search on: describe the whole situation in English, తెలుగు or Tenglish.</span>`;
  else el.innerHTML = `<span>Smart search couldn't load (${esc(extra)}). Quick search still works.</span>`;
  const b = $('#ai-on'); if (b) b.onclick = () => { localStorage.setItem('tsf-ai', '1'); loadAI(); };
}
function loadAI() {
  if (worker) return;
  aiState = 'loading'; renderAI(0);
  worker = new Worker('worker.js', { type: 'module' });
  worker.onmessage = ({ data: m }) => {
    if (m.type === 'progress') renderAI(Math.min(99, Math.round(m.loaded / m.total * 100)));
    else if (m.type === 'ready') { aiState = 'ready'; renderAI(); if (state.q) run(); }
    else if (m.type === 'error') { aiState = 'error'; renderAI(m.error); }
    else if (m.type === 'scores') { const p = pending.get(m.id); if (p) { pending.delete(m.id); p(m.scores); } }
  };
  worker.postMessage({ type: 'load', meta, embUrl: `data/emb.i8?v=${meta.version}` });
}
const pending = new Map();
function semScores(text) {
  if (semCache.has(text)) return Promise.resolve(semCache.get(text));
  const id = ++reqId;
  return new Promise(res => { pending.set(id, sc => { semCache.set(text, sc); if (semCache.size > 30) semCache.delete(semCache.keys().next().value); res(sc); }); worker.postMessage({ type: 'query', id, q: text }); });
}

// ---------- rendering ----------
function chipsUI() {
  $('#chips').innerHTML = CHIPS.map(c => `<button class="chip" data-id="${c.id}" aria-pressed="${state.chip === c.id}">${c.label} <span class="te-s">${c.te}</span></button>`).join('');
  $('#chips').querySelectorAll('.chip').forEach(b => b.onclick = () => { state.chip = state.chip === b.dataset.id ? null : b.dataset.id; chipsUI(); run(); });
}
function card(r, n, f) {
  const s = r.song, sf = songFacets(s, data);
  const people = [s.singers.length && `<b>Singers</b> ${esc(s.singers.join(', '))}`, s.composer.length && `<b>Music</b> ${esc(s.composer.join(', '))}`].filter(Boolean).join(' · ');
  const tags = s.tags.map(t => `<span class="tag ${t} ${s.conf === 0 ? 'guess' : ''}" title="${s.conf === 0 ? 'mood guessed from title/film' : 'mood tag'}">${esc(t)}</span>`).join('');
  const why = f && hasFacets(f) && n <= 5 ? `<p class="why">💡 ${esc(whyFits(s, f, data))}</p>` : '';
  const sit = s.enr && sf.situation && !(f && hasFacets(f) && n <= 5) ? `<p class="sit">${esc(sf.situation)}</p>` : '';
  const play = s.ytk === 1
    ? `<button class="btn play" data-act="play">▶ Play</button>`
    : `<a class="btn find" href="${esc(ytSearchUrl(s))}" target="_blank" rel="noopener">🔎 Find on YouTube</a>`;
  const ytNote = s.ytk === 1 ? '✓ Direct YouTube link' : s.ytk === 2 ? `Possible video: <a href="${esc(ytWatchUrl(s))}" target="_blank" rel="noopener">try this one</a> (not verified)` : 'Opens a YouTube search';
  return `<article class="card" data-i="${s.i}">
    <div class="top"><div class="num">${n}</div><div>
      <h3 class="title">${esc(s.title)} ${s.title_te ? `<small>${esc(s.title_te)}</small>` : ''}</h3>
      <p class="film">🎬 ${esc(s.film || 'Album')}${s.year ? ' · ' + s.year : ''}</p></div></div>
    ${why}${people ? `<p class="people">${people}</p>` : ''}
    ${tags ? `<div class="tags">${tags}</div>` : ''}${sit}
    <div class="actions">${play}<button class="btn share" data-act="share" aria-label="Share">📤 Share</button></div>
    <p class="yt">${ytNote}${s.wiki ? ` · <a href="${esc(s.wiki.startsWith('http') ? s.wiki : 'https://en.wikipedia.org/wiki/' + s.wiki)}" target="_blank" rel="noopener">Source</a>` : ''}</p>
  </article>`;
}
function notePanel(f, top) {
  if (!f || !wantsNote(f)) return '';
  const note = makeNote(f, state.tone);
  const who = f.name || ({ mother: 'Amma', father: 'Nanna' }[f.rel]) || 'them';
  const pills = describeFacets(f).map(([k, v]) => `<span class="fp"><b>${k}</b> ${esc(v)}</span>`).join('');
  const tones = [['playful', '😄 Playful'], ['sweet', '💗 Sweet'], ['emotional', '🥺 Emotional']].map(([t, l]) => `<button class="tn" data-tone="${t}" aria-pressed="${note.tone === t}">${l}</button>`).join('');
  return `<section class="note">
    <h2>💌 A note for ${esc(who)}</h2>
    <div class="fps" title="What we understood from your message">${pills}</div>
    <p class="nte" lang="te">${esc(note.te)}</p><p class="nen">${esc(note.en)}</p>
    <div class="tones">${tones}</div>
    <div class="actions"><button class="btn play" data-act="wa">💬 Send on WhatsApp</button><button class="btn share" data-act="copynote">📋 Copy</button></div>
    ${top ? `<p class="yt">Sends the note with <b>${esc(top.title)}</b> (${esc(top.film)}). Pick a different song below with 📤 Share.</p>` : ''}
  </section>`;
}
function noteText(f, s) {
  const n = makeNote(f, state.tone);
  return `${n.te}\n\n${n.en}${s ? `\n\n🎵 ${s.title} (${s.film}${s.year ? ', ' + s.year : ''})\n${songLink(s)}` : ''}`;
}
function render(mode) {
  const { results, facets: f } = state;
  const head = $('#status');
  const label = state.q ? `“${esc(state.q)}”` : state.chip ? CHIPS.find(c => c.id === state.chip).label : '';
  if (!state.q && !state.chip) head.innerHTML = `✨ Popular picks with direct YouTube links. Or tell us the whole situation, e.g. <a href="?q=Kalyani+is+angry+with+me+because+I+didn%27t+take+her+to+a+movie">“Kalyani is angry with me because I didn't take her to a movie”</a>`;
  else if (f && wantsNote(f) && results.length) head.innerHTML = `Best songs for ${esc(f.name ? f.name + "'s" : 'this')} situation, most fitting first <span class="mode">${mode === 'semantic' ? '🧠 smart' : '⚡ quick'} search</span>`;
  else head.innerHTML = results.length ? `${results.length >= 200 ? '200+' : results.length} songs for ${label} <span class="mode">${mode === 'semantic' ? '🧠 smart' : '⚡ quick'} search</span>` : '';
  const top = results[0] && results[0].song;
  const list = results.slice(0, state.shown).map((r, k) => card(r, k + 1, f)).join('');
  $('#results').innerHTML = notePanel(f, top) + (list || `<div class="empty">No songs matched. Try a mood like “love”, “sorry”, “amma”, or describe the situation.${aiState === 'off' ? '<br>Turning on smart search helps with full sentences.' : ''}</div>`);
  $('#more').hidden = results.length <= state.shown;
}
let runSeq = 0;
async function run() {
  const seq = ++runSeq;
  const chip = state.chip ? CHIPS.find(c => c.id === state.chip) : null;
  const q = state.q;
  const u = new URL(location.href); u.search = ''; if (q) u.searchParams.set('q', q); if (state.chip) u.searchParams.set('mood', state.chip); history.replaceState(null, '', u);
  state.shown = PAGE;
  if (!q && !chip) { state.results = picks(songs, 30); state.facets = null; render('keyword'); return; }
  const f = extractFacets(q);
  const kw = search(songs, q, { chipTags: chip && chip.tags, data });
  state.results = kw.results; state.facets = f; render('keyword');
  if (aiState === 'ready' && q.trim()) {
    const sem = await semScores(expandQuery(q, f, data.rules));
    if (seq !== runSeq) return;
    const r = search(songs, q, { chipTags: chip && chip.tags, sem, data });
    state.results = r.results; render('semantic');
  }
}
function onClick(e) {
  const b = e.target.closest('[data-act],[data-tone]'); if (!b) return;
  if (b.dataset.tone) { state.tone = b.dataset.tone; render(aiState === 'ready' ? 'semantic' : 'keyword'); return; }
  const top = state.results[0] && state.results[0].song;
  if (b.dataset.act === 'wa') { window.open('https://wa.me/?text=' + encodeURIComponent(noteText(state.facets, top)), '_blank', 'noopener'); return; }
  if (b.dataset.act === 'copynote') { copy(noteText(state.facets, top)); return; }
  const el = b.closest('.card'); const s = songs[+el.dataset.i];
  if (b.dataset.act === 'play') {
    const ex = el.querySelector('.embed');
    if (ex) { ex.remove(); b.textContent = '▶ Play'; return; }
    document.querySelectorAll('.embed').forEach(x => { x.closest('.card').querySelector('[data-act=play]').textContent = '▶ Play'; x.remove(); });
    el.querySelector('.actions').insertAdjacentHTML('afterend', `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${encodeURIComponent(s.vid)}?autoplay=1&rel=0&playsinline=1" title="${esc(s.title)}" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div><p class="yt"><a href="${esc(ytWatchUrl(s))}" target="_blank" rel="noopener">Open in YouTube app ↗</a></p>`);
    b.textContent = '⏸ Close';
  } else if (b.dataset.act === 'share') {
    const f = state.facets;
    const text = f && wantsNote(f) ? noteText(f, s) : `🎵 ${s.title} (${s.film}${s.year ? ', ' + s.year : ''})\n${songLink(s)}\n\nFind the right Telugu song for any mood:`;
    shareText(s.title, text, SITE + (state.q ? '?q=' + encodeURIComponent(state.q) : ''));
  }
}

async function init() {
  chipsUI();
  const v = Date.now() / 3.6e6 | 0;   // hourly cache-buster for metadata
  meta = await (await fetch(`data/meta.json?h=${v}`)).json();
  const [d, rules] = await Promise.all([fetch(`data/songs.json?v=${meta.version}`).then(r => r.json()), fetch(`data/rules.json?v=${meta.version}`).then(r => r.json())]);
  data = d; data.rules = rules; songs = prepare(data);
  $('#ver').textContent = `${meta.n.toLocaleString('en-IN')} songs · ${meta.youtube.direct.toLocaleString('en-IN')} with direct YouTube links · data ${meta.version}`;
  const p = new URLSearchParams(location.search);
  state.q = p.get('q') || ''; state.chip = CHIPS.some(c => c.id === p.get('mood')) ? p.get('mood') : null;
  $('#q').value = state.q; chipsUI();
  document.addEventListener('click', onClick);
  $('#more').onclick = () => { state.shown += PAGE; render(aiState === 'ready' ? 'semantic' : 'keyword'); };
  $('#f').onsubmit = e => { e.preventDefault(); state.q = $('#q').value.trim(); state.tone = null; $('#q').blur(); run(); };
  let t; $('#q').oninput = () => { clearTimeout(t); t = setTimeout(() => { state.q = $('#q').value.trim(); state.tone = null; run(); }, 450); };
  const conn = navigator.connection || {};
  const auto = localStorage.getItem('tsf-ai') === '1' || (!conn.saveData && matchMedia('(pointer:fine)').matches && conn.type !== 'cellular');
  renderAI();
  if (auto) loadAI();
  run();
}
init().catch(e => { $('#status').textContent = 'Could not load songs: ' + e.message; });
