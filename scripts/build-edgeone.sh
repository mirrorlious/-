#!/usr/bin/env bash

set -e

rm -rf dist
mkdir -p dist

cp index.html dist/
cp -R app dist/
cp -R public-resources dist/

find . -maxdepth 1 -type f \( \
  -iname '*.jpg' \
  -o -iname '*.jpeg' \
  -o -iname '*.png' \
  -o -iname '*.webp' \
  -o -iname '*.svg' \
  -o -iname '*.ico' \
\) -exec cp -t dist {} +