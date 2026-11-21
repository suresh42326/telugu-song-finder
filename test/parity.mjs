import { pipeline } from '@huggingface/transformers';
import fs from 'fs';
const meta = JSON.parse(fs.readFileSync('../site/data/meta.json'));
const data = JSON.parse(fs.readFileSync('../site/data/songs.json'));
const E = new Int8Array(fs.readFileSync('../site/data/emb.i8').buffer.slice(0));
const ext = await pipeline('feature-extraction', meta.model, { dtype: 'q8' });
for (const q of ['apology song for angry girlfriend', 'పెళ్లి పాట', 'amma meeda song', 'sad breakup song']) {
  const t = Date.now();
  const v = (await ext(q, { pooling: 'mean', normalize: true })).data;
  const sc = new Float32Array(meta.n);
  for (let i = 0; i < meta.n; i++) { let s = 0; const o = i * 384; for (let d = 0; d < 384; d++) s += v[d] * E[o + d]; sc[i] = s * meta.scale / 127; }
  const top = [...sc.keys()].sort((a, b) => sc[b] - sc[a]).slice(0, 6);
  console.log(q, Date.now() - t, 'ms', top.map(i => data.rows[i][0] + '/' + data.films[data.rows[i][2]] + ' ' + sc[i].toFixed(3)).join(' | '));
}
