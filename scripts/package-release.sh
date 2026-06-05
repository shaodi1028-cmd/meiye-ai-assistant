#!/bin/sh
set -eu

ROOT_DIR="$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)"
PACKAGE_NAME="meiye-ai-assistant"
VERSION="$(node -e "console.log(require('./package.json').version)")"
OUTPUT_DIR="$ROOT_DIR/dist"
OUTPUT_FILE="$OUTPUT_DIR/$PACKAGE_NAME-$VERSION.tar.gz"

cd "$ROOT_DIR"
npm run check

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_FILE"

tar -czf "$OUTPUT_FILE" \
  --exclude=".git" \
  --exclude=".env" \
  --exclude=".env.local" \
  --exclude=".env.production" \
  --exclude="node_modules" \
  --exclude="data/backups" \
  --exclude="dist" \
  -C "$(dirname "$ROOT_DIR")" \
  "$(basename "$ROOT_DIR")"

echo "Release package created: $OUTPUT_FILE"
