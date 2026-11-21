# Telugu Song Finder
Live: https://suresh42326.github.io/telugu-song-finder/

Describe the situation ("Kalyani is angry with me because I didn't take her to a movie") in English, Telugu or Tenglish, and get Telugu songs with direct YouTube links, a one-line "why this fits", and a short personal Telugu + English note. Metadata only, **no lyrics**.

## How it works (zero-cost static site, GitHub Pages)
- `site/data/songs.json` (~2.2 MB, ~0.5 MB gzipped): columnar song metadata, 21,796 songs.
- `site/data/emb.i8` (8.4 MB, ~7 MB gzipped): int8-quantized paraphrase-multilingual-MiniLM-L12-v2 vectors. Only fetched when smart search is turned on.
- `site/worker.js`: transformers.js (`Xenova/paraphrase-multilingual-MiniLM-L12-v2`, q8, ~118 MB, cached by the browser) embeds the query in a web worker; the dot product runs over all songs in about 30 ms.
- Quick search (works right away, with no model): intent/tag regexes (EN/TE/Tenglish) plus title/film/singer token match.
- `site/facets.js`: pulls situation facets out of the query (who, why, feeling, tone), expands the query before embedding, re-ranks songs on those facets, and builds a template-based note in Telugu and English.
- Situation enrichment: `enrich/curated_situations.py` holds 40 hand-written situations. `enrich/rules.json` holds tag-based situation templates. About 2,190 songs (medium/high-confidence tags, or a direct YouTube link) are re-embedded as title + tags + summary + situation.

## Updating (new YouTube links, more songs, more situations)
    ./scripts/update.sh          # export from /workspace/telugu-songs -> site/data, then push to gh-pages
    MERGE=1 ./scripts/update.sh  # also run merge_yt.py first (only when the matcher is not running)
`scripts/export.py` reads whatever YouTube columns exist (`youtube_video_id`, `match_confidence`). High/med matches play inline. Low matches show as "possible video". Songs with no match fall back to a YouTube search link.

## Tests
    cd test && npm i && node rank.mjs            # ranking + notes (node, same model)
    URL=http://localhost:8765/ node e2e.mjs      # headless Chrome end-to-end
