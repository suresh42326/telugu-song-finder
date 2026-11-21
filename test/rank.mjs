import { pipeline } from '@huggingface/transformers';
import fs from 'fs';
import { prepare, search } from '../site/search.js';
import { extractFacets, expandQuery, whyFits, makeNote, describeFacets } from '../site/facets.js';
const meta = JSON.parse(fs.readFileSync('../site/data/meta.json'));
const data = JSON.parse(fs.readFileSync('../site/data/songs.json')); data.rules = JSON.parse(fs.readFileSync('../site/data/rules.json'));
const songs = prepare(data);
const E = new Int8Array(fs.readFileSync('../site/data/emb.i8').buffer.slice(0));
const ext = await pipeline('feature-extraction', meta.model, { dtype: 'q8' });
const Q = process.argv.slice(2).length ? process.argv.slice(2) : ['Kalyani is angry with me because I didn\'t take her to a movie', 'apology song for angry girlfriend', 'my wife is upset because I forgot our anniversary',
  'girlfriend is in USA, long distance, missing her', 'amma birthday song', 'Priya and I had a big fight, I said harsh words', 'పెళ్లి పాట', 'friend farewell', 'mass hero entry song', 'devotional venkateswara'];
for (const q of Q) {
  const f = extractFacets(q);
  const eq = expandQuery(q, f, data.rules);
  const v = (await ext(eq, { pooling: 'mean', normalize: true })).data;
  const sem = new Float32Array(meta.n);
  for (let i = 0; i < meta.n; i++) { let s = 0; const o = i * 384; for (let d = 0; d < 384; d++) s += v[d] * E[o + d]; sem[i] = s * meta.scale / 127; }
  const kw = search(songs, q, { data, limit: 5 }), sm = search(songs, q, { data, sem, limit: 5 });
  console.log('\n## ' + q, JSON.stringify(describeFacets(f)));
  console.log(' KW :', kw.results.map(r => r.song.title + '/' + r.song.film + (r.song.ytk === 1 ? '▶' : '')).join(' | '));
  console.log(' SEM:', sm.results.map(r => r.song.title + '/' + r.song.film + (r.song.ytk === 1 ? '▶' : '')).join(' | '));
  sm.results.slice(0, 3).forEach(r => console.log('   - ' + r.song.title + ': ' + whyFits(r.song, f, data)));
  if (f.name || f.causes.length || f.rel) { const n = makeNote(f); console.log('   TE:', n.te, '\n   EN:', n.en); }
}
