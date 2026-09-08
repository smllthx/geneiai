#!/bin/zsh
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v xcodegen >/dev/null 2>&1; then
  echo "XcodeGen no está instalado."
  echo "Instálalo con: brew install xcodegen"
  exit 1
fi

python3 scripts/configure_backend.py

xcodegen generate
echo "Proyecto generado: $ROOT/GENAIAApple.xcodeproj"
