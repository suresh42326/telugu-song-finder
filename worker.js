// Web worker: loads the multilingual MiniLM model (transformers.js) + int8 song vectors, returns cosine scores.
import { pipeline, env } from 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@4.3.2';
env.allowLocalModels = false;
let ext = null, E = null, meta = null;
const post = (m, t) => self.postMessage(m, t || []);
self.onmessage = async ({ data: msg }) => {
  if (msg.type === 'load') {
    try {
      meta = msg.meta;
      const files = {};
      const embP = fetch(msg.embUrl).then(r => { if (!r.ok) throw new Error('emb ' + r.status); return r.arrayBuffer(); }).then(b => { E = new Int8Array(b); });
      ext = await pipeline('feature-extraction', meta.model, { dtype: 'q8', progress_callback: p => {
        if (p.status === 'progress' && p.total) { files[p.file] = [p.loaded, p.total];
          const v = Object.values(files); post({ type: 'progress', loaded: v.reduce((a, x) => a + x[0], 0), total: v.reduce((a, x) => a + x[1], 0) }); }
      } });
      await embP;
      await ext('warm up', { pooling: 'mean', normalize: true });
      post({ type: 'ready' });
    } catch (e) { post({ type: 'error', error: String(e && e.message || e) }); }
  } else if (msg.type === 'query') {
    const v = (await ext(msg.q, { pooling: 'mean', normalize: true })).data;
    const n = meta.n, d = meta.dim, k = meta.scale / 127, sc = new Float32Array(n);
    for (let i = 0, o = 0; i < n; i++, o += d) { let s = 0; for (let j = 0; j < d; j++) s += v[j] * E[o + j]; sc[i] = s * k; }
    post({ type: 'scores', id: msg.id, scores: sc }, [sc.buffer]);
  }
};
