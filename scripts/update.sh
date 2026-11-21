#!/bin/bash
# Re-export the latest index (new YouTube links, new songs, new situations) and publish.
#   ./scripts/update.sh            -> export + deploy
#   MERGE=1 ./scripts/update.sh    -> also run merge_yt.py first (only when the YouTube matcher is NOT running)
set -euo pipefail
cd "$(dirname "$0")/.."
SRC=${SONG_INDEX:-/workspace/telugu-songs}
[ "${MERGE:-0}" = 1 ] && "$SRC/.venv/bin/python" "$SRC/merge_yt.py"
"$SRC/.venv/bin/python" scripts/export.py
./scripts/deploy.sh
