// Pure search logic (no DOM) — shared by the web app and the node test.
import { extractFacets, hasFacets, facetTags, facetBonus } from './facets.js';
export const CHIPS = [
  { id: 'apology', label: '🙏 Apology', te: 'సారీ', tags: ['apology'], q: 'apology song for angry girlfriend' },
  { id: 'romance', label: '❤️ Romance', te: 'ప్రేమ', tags: ['romance'], q: 'romantic love song' },
  { id: 'breakup', label: '💔 Breakup', te: 'విరహం', tags: ['breakup', 'sad'], q: 'sad breakup song' },
  { id: 'wedding', label: '💍 Wedding', te: 'పెళ్లి', tags: ['wedding'], q: 'wedding pelli song' },
  { id: 'amma', label: '🤱 Amma', te: 'అమ్మ', tags: ['mother'], q: 'song about amma mother' },
  { id: 'devotional', label: '🪔 Devotional', te: 'భక్తి', tags: ['devotional'], q: 'devotional god song' },
  { id: 'friendship', label: '🤝 Friendship', te: 'స్నేహం', tags: ['friendship'], q: 'friendship song' },
  { id: 'mass', label: '🔥 Mass', te: 'మాస్', tags: ['mass'], q: 'mass hero song' },
];
export const INTENT = {
  apology: /apolog|sorry|forgive|angry|upset|make ?up|patch ?up|sulk|kopam|kopama|alig|alaka|bujjag|manninch|convinc|క్షమ|కోప|అలక|అలిగ|సారీ|మన్నించ|బుజ్జగ/i,
  romance: /romant|\blove|girl ?friend|boy ?friend|\bgf\b|\bbf\b|crush|propos|prema|valentine|lover|cheli|priya|wife|husband|ప్రేమ|ప్రియ|చెలి/i,
  sad: /\bsad|cry|tear|pain|heart ?break|lonely|missing|baadha|badha|kanneer|viraha|feel(ing)? song|బాధ|కన్నీ|విరహ/i,
  breakup: /break ?up|heart ?break|dump|separat|vidipo|విడిపో/i,
  wedding: /wedding|marriage|bride|groom|pelli|kalyan|sangeet|haldi|mehendi|పెళ్లి|పెండ్లి|కళ్యాణ|వివాహ/i,
  mother: /mother|\bmom\b|\bmum\b|amma\b|\bmaa\b|అమ్మ|తల్లి/i,
  father: /father|\bdad|nanna|naanna|నాన్న|తండ్రి/i,
  devotional: /devotion|\bgod\b|bhakti|prayer|temple|\blord|venkate|balaji|shiva|\bsiva|\brama\b|krishna|ayyappa|hanuman|ganesh|vinayak|\bsai\b|durga|bhajan|దేవ|భక్తి|స్వామి/i,
  friendship: /friend|dosti|\bdost|sneh|nestham|స్నేహ|నేస్త/i,
  celebration: /celebrat|festival|birthday|sankranti|diwali|holi|pandaga|పండగ|పండుగ/i,
  party: /party|\bitem\b|\bclub|\bdj\b/i,
  mass: /\bmass|\bhero|power|swag|whistle|elevation|\bfight|action|teenmaar|kuthu|మాస్/i,
  lullaby: /lullaby|sleep|\bbaby|jola|laali|జోల|లాలి/i,
  patriotic: /patriot|country|nation|freedom|independence|\bdesh|bharat|దేశ/i,
  inspirational: /motivat|inspir|\bgym|workout|courage|ప్రేరణ/i,
  folk: /\bfolk|village|janapad|palle|జానపద|పల్లె/i,
  comedy: /comedy|funny|comic|హాస్య/i,
  rain: /\brain|monsoon|nature|vaana|varsham|వాన|వర్ష/i,
  family: /family|kutumb|కుటుంబ/i,
  sibling: /sister|brother|sibling|rakhi|raksha|\bchelli|\bakka\b|thammud|అన్నయ్య|చెల్లి|అక్క|తమ్ము/i,
  dance: /\bdance|dancing|\bsteps\b/i,
  philosophical: /philosoph|meaning of life|jeevitham|జీవితం/i,
};
const STOP = new Set('a an the for to of in on and or with song songs telugu movie film my me i her his she he is are was be that this some best good want need play pata paata patalu పాట పాటలు about like when who which very new old hit hits latest because didn didnt did not take took angry upset sad mad with from feel feeling make happy get got today yesterday dont don won wont can cant has have had into our out him she he they them really very much so just'.split(' '));
const CONF_KW = [0.08, 0.25, 0.5], CONF_SEM = [0.04, 0.12, 0.25];
export const norm = s => (s || '').toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^\p{L}\p{N}\p{M}]+/gu, ' ').trim();

export function prepare(data) {
  const F = Object.fromEntries(data.fields.map((f, i) => [f, i]));
  const songs = data.rows.map((r, i) => {
    const s = { i, title: r[F.title], title_te: r[F.title_te], film: data.films[r[F.film]], year: r[F.year],
      singers: r[F.singers].map(p => data.people[p]), composer: r[F.composer].map(p => data.people[p]), lyricist: r[F.lyricist].map(p => data.people[p]),
      tags: r[F.tags], conf: r[F.conf], vid: r[F.vid], ytk: r[F.ytk], instr: !!r[F.instr], cur: r[F.cur], enr: r[F.enr], wiki: r[F.wiki] };
    s._t = norm(s.title + ' ' + s.title_te); s._f = norm(s.film); s._p = norm([...s.singers, ...s.composer, ...s.lyricist].join(' '));
    s._key = norm(s.title.split(/ [–-] |\(|\[/)[0]).replace(/ /g, '').slice(0, 14) + '|' + s._f;
    return s;
  });
  return songs;
}
export function parse(q) {
  const want = new Set(Object.entries(INTENT).filter(([, rx]) => rx.test(q)).map(([t]) => t));
  const toks = norm(q).split(' ').filter(t => t && (t.length >= 3 || /^\d{4}$/.test(t)) && !STOP.has(t));
  const instr = /\bbgm|instrumental|theme music/i.test(q);
  return { want, toks, instr };
}
function tokenScore(s, toks) {
  let sc = 0;
  for (const t of toks) {
    if (/^\d{4}$/.test(t)) { if (String(s.year) === t) sc += 0.6; continue; }
    const rx = new RegExp('(^| )' + t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (rx.test(s._t)) sc += 0.8; else if (rx.test(s._f)) sc += 0.5; else if (rx.test(s._p)) sc += 0.5;
  }
  return sc;
}
/** songs: prepared list; q: query text; chipTags: array of required tags (any-of); sem: Float32Array cosine scores or null */
export function search(songs, q, { chipTags = null, sem = null, limit = 200, data = null } = {}) {
  const { want, toks, instr } = parse(q || '');
  const facets = extractFacets(q || ''), useF = data && hasFacets(facets);
  if (useF) { facetTags(facets).forEach(t => want.add(t)); if (facets.name) { const n = facets.name.toLowerCase(); const k = toks.indexOf(n); if (k >= 0) toks.splice(k, 1); } }
  if (chipTags) chipTags.forEach(t => want.add(t));
  const res = [];
  for (const s of songs) {
    if (s.instr && !instr) continue;
    if (chipTags && !chipTags.some(t => s.tags.includes(t))) continue;
    let hits = 0; for (const t of s.tags) if (want.has(t)) hits++;
    const ts = toks.length ? tokenScore(s, toks) * (useF ? 0.3 : 1) : 0;
    let score;
    if (sem && (q || '').trim()) {
      score = sem[s.i] + 0.12 * hits + (hits ? CONF_SEM[s.conf] : 0) + 0.08 * Math.min(ts, 1.5) + (s.ytk === 1 ? 0.03 : 0);
    } else {
      if (!hits && !ts && !chipTags) continue;
      score = hits * 1.0 + (hits || chipTags ? CONF_KW[s.conf] : 0) + ts + (s.ytk === 1 ? 0.15 : 0) + (s.year ? Math.min(s.year - 1940, 90) / 2000 : 0);
    }
    if (useF) score += (sem && (q || '').trim() ? 1 : 4) * facetBonus(s, facets, data);
    res.push([score, s]);
  }
  res.sort((a, b) => b[0] - a[0]);
  const out = [], seen = new Set();
  for (const [sc, s] of res) {
    if (seen.has(s._key)) continue; seen.add(s._key);
    out.push({ score: sc, song: s }); if (out.length >= limit) break;
  }
  return { results: out, want: [...want], facets, mode: sem && (q || '').trim() ? 'semantic' : 'keyword' };
}
export function picks(songs, n = 20) {
  return songs.filter(s => s.conf === 2 && s.ytk === 1 && !s.instr).sort((a, b) => (b.year || 0) - (a.year || 0)).slice(0, n).map(s => ({ score: 0, song: s }));
}
export const ytSearchUrl = s => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(`${s.title} ${s.film || ''} telugu song`.trim());
export const ytWatchUrl = s => 'https://www.youtube.com/watch?v=' + s.vid;
