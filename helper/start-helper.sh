#!/usr/bin/env sh
set -eu
cd "$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then
  printf '%s\n' 'Install a current Node.js LTS release from https://nodejs.org/en/download, then run this launcher again.'
  exit 1
fi
exec node paperbridge-helper.mjs
