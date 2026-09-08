#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Esta compilación requiere un Mac con Xcode y XcodeGen." >&2
  exit 1
fi
command -v xcodebuild >/dev/null || { echo "Instala Xcode antes de compilar." >&2; exit 1; }
command -v xcodegen >/dev/null || { echo "Falta XcodeGen: brew install xcodegen" >&2; exit 1; }
./scripts/generate.sh
xcodebuild -project GENAIAApple.xcodeproj -scheme GENAIAApple -configuration Debug \
  -destination 'platform=macOS' -derivedDataPath DerivedData CODE_SIGNING_ALLOWED=NO build
open DerivedData/Build/Products/Debug/GENEAI.app
