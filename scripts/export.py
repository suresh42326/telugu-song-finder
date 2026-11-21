#!/usr/bin/env python3
"""Export the Telugu song index (/workspace/telugu-songs) into compact static files for the website.
Metadata only — never lyrics. Safe to re-run anytime (e.g. after new YouTube matches are merged).
Outputs: site/data/songs.json (columnar metadata), site/data/emb.i8 (int8 vectors, row order = songs.json), site/data/meta.json
"""
import json, os, sys, hashlib, numpy as np
SRC = os.environ.get("SONG_INDEX", "/workspace/telugu-songs")
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "site", "data")
os.makedirs(OUT, exist_ok=True)
import faiss
ROOT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..")
sys.path.insert(0, os.path.join(ROOT, "enrich")); sys.path.insert(0, SRC)
from curated_situations import S as CURATED_SIT
from build_norm import norm
RULES = json.load(open(os.path.join(ROOT, "enrich", "rules.json")))
songs = {}
for l in open(os.path.join(SRC, "songs.jsonl")):
    s = json.loads(l); songs[s["id"]] = s
ids = np.load(os.path.join(SRC, "ids.npy"))
idx = faiss.read_index(os.path.join(SRC, "songs.faiss"))
X = idx.reconstruct_n(0, idx.ntotal).astype("float32")
assert len(ids) == X.shape[0], "faiss/ids mismatch"
# drop rows whose song no longer exists; keep vector order aligned with metadata order
keep = [i for i, sid in enumerate(ids) if int(sid) in songs]
X = X[keep]; order = [int(ids[i]) for i in keep]

# string tables to keep the JSON small
people, films = {}, {}
def pid(n):
    if n not in people: people[n] = len(people)
    return people[n]
def fid(f):
    if f not in films: films[f] = len(films)
    return films[f]
TAG_RENAME = {"apology/making up": "apology", "item/party": "party", "nature/rain": "rain", "marriage": "wedding", "nature": "rain"}
cur_by_key = {norm(c[0]) + "|" + norm(c[1]): c for c in CURATED_SIT}
curated_tbl, cur_used = [], set()
def situation_for(s, tags):
    c = cur_by_key.get(norm(s["title"]) + "|" + norm(s.get("film") or ""))
    if c: return c, c[2], c[4]
    ts = [t for t in tags if t in RULES["tags"]][:2]
    if not ts: return None, "", []
    causes = sorted({x for t in ts for x in RULES["tags"][t]["causes"]})
    return None, " ".join(RULES["tags"][t]["situation"] for t in ts), causes
enrich_docs = {}   # row index -> doc text to (re)embed
rows = []
yt_counts = {"direct": 0, "candidate": 0, "search": 0}
for sid in order:
    s = songs[sid]
    tags = sorted({TAG_RENAME.get(t, t) for t in s.get("tags", []) if t != "general"})
    conf_yt = s.get("match_confidence")
    vid = s.get("youtube_video_id") or ""
    if vid and conf_yt in ("high", "med"): ytk = 1; yt_counts["direct"] += 1
    elif vid: ytk = 2; yt_counts["candidate"] += 1   # low-confidence: shown as "possible match"
    else: vid = ""; ytk = 0; yt_counts["search"] += 1
    flags = 1 if "instrumental?" in s.get("flags", []) else 0
    cur, sit, causes = situation_for(s, tags)
    enriched = bool(sit) and (cur is not None or s.get("confidence") in ("high", "med") or ytk == 1)
    ci = -1
    if cur is not None:
        ci = len(curated_tbl); cur_used.add(cur[0] + "|" + cur[1]); curated_tbl.append([cur[2], cur[3], cur[4], cur[5], cur[6]])
    if enriched:
        good = "; ".join(RULES["causes"][c] for c in causes if c in RULES["causes"])
        enrich_docs[len(rows)] = (f"{s['title']} {s.get('title_te') or ''} | film: {s.get('film')} | mood: {', '.join(tags)} | "
                                  f"{s['summary']} | situation: {sit} | good for: {good}")
    wiki = next((u for u in s.get("source_urls", []) if "wikipedia.org" in u), "")
    rows.append([
        s["title"], s.get("title_te") or "", fid(s.get("film") or ""), s.get("year") or 0,
        [pid(x) for x in s.get("singers", [])[:5]], [pid(x) for x in s.get("composer", [])[:3]],
        [pid(x) for x in s.get("lyricist", [])[:2]],
        tags, {"high": 2, "med": 1}.get(s.get("confidence"), 0), vid, ytk, flags,
        ci, 1 if enriched else 0,
        wiki.replace("https://en.wikipedia.org/wiki/", "") if wiki.startswith("https://en.wikipedia.org/wiki/") else wiki,
    ])
# --- re-embed enriched rows (title+tags+summary+situation); cached by text hash
cache_p = os.path.join(ROOT, "enrich", "emb_cache.npz")
cache = dict(np.load(cache_p, allow_pickle=True)["c"].item()) if os.path.exists(cache_p) else {}
need = {h: d for d in enrich_docs.values() for h in [hashlib.sha1(d.encode()).hexdigest()] if h not in cache}
if need:
    from sentence_transformers import SentenceTransformer
    m = SentenceTransformer("sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2", device="cpu")
    V = m.encode(list(need.values()), batch_size=64, normalize_embeddings=True, show_progress_bar=False).astype("float32")
    cache.update(zip(need.keys(), V))
    np.savez(cache_p, c=np.array(cache, dtype=object))
for i, d in enrich_docs.items(): X[i] = cache[hashlib.sha1(d.encode()).hexdigest()]
X /= np.linalg.norm(X, axis=1, keepdims=True) + 1e-9
scale = float(np.abs(X).max())
Q = np.clip(np.round(X / scale * 127), -127, 127).astype(np.int8)
import shutil; shutil.copy(os.path.join(ROOT, "enrich", "rules.json"), os.path.join(OUT, "rules.json"))
missing = [c[0] + " / " + c[1] for c in CURATED_SIT if c[0] + "|" + c[1] not in cur_used]
if missing: print("WARN curated situations not matched:", missing)
data = {"fields": ["title", "title_te", "film", "year", "singers", "composer", "lyricist", "tags", "conf", "vid", "ytk", "instr", "cur", "enr", "wiki"],
        "films": list(films), "people": list(people), "curated": curated_tbl, "rows": rows}
js = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
open(os.path.join(OUT, "songs.json"), "w").write(js)
Q.tofile(os.path.join(OUT, "emb.i8"))
ver = hashlib.sha1(js.encode() + Q.tobytes()).hexdigest()[:10]
meta = {"model": "Xenova/paraphrase-multilingual-MiniLM-L12-v2", "n": len(rows), "dim": int(Q.shape[1]), "scale": scale, "version": ver, "youtube": yt_counts, "enriched": len(enrich_docs), "curated": len(curated_tbl)}
json.dump(meta, open(os.path.join(OUT, "meta.json"), "w"))
print(json.dumps(meta), f"songs.json={len(js.encode())/1e6:.2f}MB emb.i8={Q.nbytes/1e6:.2f}MB")
