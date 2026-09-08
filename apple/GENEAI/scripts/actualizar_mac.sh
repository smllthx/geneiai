#!/bin/bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != "Darwin" ]]; then echo "Ejecuta este archivo en tu Mac." >&2; exit 1; fi
command -v xcodebuild >/dev/null || { echo "Se necesita Xcode para compilar este paquete de código fuente." >&2; exit 1; }
command -v xcodegen >/dev/null || { echo "Falta XcodeGen. Instálalo con: brew install xcodegen" >&2; exit 1; }
if pgrep -f '/GENEAI.app/Contents/MacOS/GENEAI' >/dev/null; then
  echo "Guarda tu trabajo y cierra GENEAI antes de actualizar." >&2; exit 1
fi
./scripts/generate.sh
xcodebuild -project GENAIAApple.xcodeproj -scheme GENAIAApple -configuration Release \
  -destination 'platform=macOS' -derivedDataPath DerivedData CODE_SIGNING_ALLOWED=NO build
built_app="$PWD/DerivedData/Build/Products/Release/GENEAI.app"
app_identifier=$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$built_app/Contents/Info.plist")
[[ "$app_identifier" == "com.genaia.app" ]] || { echo "Identidad de app inesperada. No se instaló." >&2; exit 1; }
codesign --force --deep --sign - "$built_app"
codesign --verify --deep --strict "$built_app"
# Reuse an existing location when present. The caller can pass a specific .app.
target_app="${1:-}"
if [[ -z "$target_app" ]]; then
  for candidate in "$HOME/Applications/GENEAI.app" /Applications/GENEAI.app "$HOME/Applications/GENAIA.app" /Applications/GENAIA.app; do
    if [[ -d "$candidate" ]]; then
      if [[ -n "$target_app" ]]; then echo "Hay varias instalaciones. Pasa la ruta de la app que quieres actualizar como argumento." >&2; exit 1; fi
      target_app="$candidate"
    fi
  done
fi
target_app="${target_app:-$HOME/Applications/GENEAI.app}"
[[ "$target_app" == /*.app ]] || { echo "Se requiere una ruta absoluta terminada en .app." >&2; exit 1; }
if [[ -d "$target_app" ]]; then
  existing_id=$(/usr/libexec/PlistBuddy -c 'Print CFBundleIdentifier' "$target_app/Contents/Info.plist")
  [[ "$existing_id" == "com.genaia.app" ]] || { echo "La app elegida tiene otra identidad. No se reemplazó." >&2; exit 1; }
fi
mkdir -p "$(dirname "$target_app")"
staging_app="${target_app%.app}.actualizando.app"
[[ ! -e "$staging_app" ]] || { echo "Ya existe una actualización preparada: $staging_app" >&2; exit 1; }
ditto "$built_app" "$staging_app"
backup_app="${target_app%.app}.respaldo-$(date +%Y%m%d-%H%M%S).app"
if [[ -d "$target_app" ]]; then mv "$target_app" "$backup_app"; fi
if ! mv "$staging_app" "$target_app"; then
  if [[ -d "$backup_app" && ! -e "$target_app" ]]; then mv "$backup_app" "$target_app"; fi
  echo "No se pudo instalar la actualización." >&2; exit 1
fi
open "$target_app"
echo "GENEAI actualizado en: $target_app"
