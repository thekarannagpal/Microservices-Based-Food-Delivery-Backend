#!/usr/bin/env bash
set -euo pipefail

SPEC="${SPEC:-http://localhost:8000/openapi.json}"
OUT="${OUT:-sdk}"
mkdir -p "$OUT"

echo "Generating Python client from $SPEC"
docker run --rm -v "$PWD/$OUT:/local" openapitools/openapi-generator-cli generate \
  -i "$SPEC" -g python -o /local/python \
  --additional-properties=packageName=nexvia_client,projectName=nexvia-client

echo "Generating TypeScript (axios) client from $SPEC"
docker run --rm -v "$PWD/$OUT:/local" openapitools/openapi-generator-cli generate \
  -i "$SPEC" -g typescript-axios -o /local/typescript

echo "SDKs written to $OUT/python and $OUT/typescript"
