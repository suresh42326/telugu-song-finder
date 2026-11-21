#!/bin/bash
# Publish site/ to the gh-pages branch (GitHub Pages). Incremental commits, no force-push.
set -euo pipefail
cd "$(dirname "$0")/.."
REPO=${REPO:-suresh42326/telugu-song-finder}
if [ ! -d .deploy/.git ]; then
  rm -rf .deploy
  if git ls-remote --exit-code "https://github.com/$REPO.git" gh-pages >/dev/null 2>&1; then
    git clone --quiet --branch gh-pages --single-branch "https://github.com/$REPO.git" .deploy
  else
    mkdir .deploy && git -C .deploy init -q -b gh-pages && git -C .deploy remote add origin "https://github.com/$REPO.git"
  fi
fi
git -C .deploy pull -q --ff-only origin gh-pages 2>/dev/null || true
rsync -a --delete --exclude .git --exclude .nojekyll site/ .deploy/
touch .deploy/.nojekyll
cd .deploy && git add -A
if git diff --cached --quiet; then echo "nothing to deploy"; exit 0; fi
git -c user.name="Telugu Song Finder bot" -c user.email="suresh42326@users.noreply.github.com" commit -qm "Deploy data $(python3 -c 'import json;print(json.load(open("data/meta.json"))["version"])')"
git push -q origin gh-pages && echo "deployed"
