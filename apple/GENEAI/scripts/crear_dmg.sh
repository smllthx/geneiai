#!/usr/bin/env bash
# Local macOS packaging only. Does not install, publish, sign with Developer ID,
# notarize, change Gatekeeper, or replace an existing application or DMG.
set -euo pipefail

usage() {
  printf '%s\n' 'Uso: bash apple/GENEAI/scripts/crear_dmg.sh [--check]' \
    '  --check  Valida requisitos y backend; no compila ni crea un DMG.' \
    'Sin opciones: compila para la arquitectura del Mac y verifica el DMG.' \
    'Requiere el repositorio completo, Xcode, XcodeGen y Python 3.'
}
fail() { printf 'ERROR: %s\n' "$1" >&2; exit "${2:-1}"; }

MODE=build
if (( $# > 1 )); then usage >&2; exit 2; fi
case "${1:-}" in
  '') ;;
  --check) MODE=check ;;
  --help|-h) usage; exit 0 ;;
  *) usage >&2; exit 2 ;;
esac

[[ "$(uname -s)" == Darwin ]] || fail 'Se necesita macOS real; no se ha compilado ni creado un DMG.' 3
ROOT="$(CDPATH= cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
for tool in python3 xcodegen xcodebuild hdiutil ditto shasum file; do
  command -v "$tool" >/dev/null 2>&1 || fail "Falta el requisito: $tool. No se instalaran dependencias automaticamente." 3
done
PLIST=/usr/libexec/PlistBuddy
[[ -x "$PLIST" ]] || fail 'No se encontro PlistBuddy.' 3
[[ -x /bin/zsh ]] || fail 'No se encontro zsh.' 3
[[ -f "$ROOT/project.yml" && -f "$ROOT/scripts/generate.sh" && -f "$ROOT/scripts/configure_backend.py" ]] || fail 'Faltan fuentes Apple. Usa el repositorio completo.' 3
xcodebuild -version >/dev/null 2>&1 || fail 'Xcode no esta disponible o necesita completar su configuracion.' 3
ARCH="$(uname -m)"
case "$ARCH" in arm64|x86_64) ;; *) fail "Arquitectura no admitida: $ARCH" 3 ;; esac
python3 "$ROOT/scripts/configure_backend.py" --check
if [[ "$MODE" == check ]]; then
  printf 'Requisitos y backend validados para %s. No se ha compilado una app ni un DMG.\n' "$ARCH"
  exit 0
fi

# Reuse the existing backend validator and generator, without changing identity.
/bin/zsh "$ROOT/scripts/generate.sh"
OUT="$(dirname "$ROOT")/dist"
mkdir -p "$OUT"
WORK="$(mktemp -d "${TMPDIR:-/tmp}/geneai-dmg.XXXXXX")"
MOUNT="$WORK/mounted"
MOUNTED=0
PUBLISH_TMP=
cleanup() {
  if [[ -n "$PUBLISH_TMP" ]]; then rm -f -- "$PUBLISH_TMP"; fi
  if [[ "$MOUNTED" == 1 ]]; then
    if ! hdiutil detach "$MOUNT" >/dev/null 2>&1; then
      printf 'No se pudo desmontar %s; se conserva el temporal %s.\n' "$MOUNT" "$WORK" >&2
      return
    fi
  fi
  rm -rf -- "$WORK"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM
LOG="$(mktemp "$OUT/GENEAI-build.XXXXXX")"
printf 'Registro de compilacion: %s\n' "$LOG"
xcodebuild -project "$ROOT/GENAIAApple.xcodeproj" -scheme GENAIAApple \
  -configuration Release -destination "platform=macOS,arch=$ARCH" \
  -derivedDataPath "$WORK/DerivedData" ARCHS="$ARCH" ONLY_ACTIVE_ARCH=YES \
  CODE_SIGNING_ALLOWED=NO CODE_SIGNING_REQUIRED=NO CODE_SIGN_IDENTITY= \
  build 2>&1 | tee "$LOG"

APP="$WORK/DerivedData/Build/Products/Release/GENEAI.app"
[[ -d "$APP" ]] || fail 'La compilacion no produjo GENEAI.app; no se creara un DMG.'
INFO="$APP/Contents/Info.plist"
BUNDLE="$("$PLIST" -c 'Print :CFBundleIdentifier' "$INFO")"
VERSION="$("$PLIST" -c 'Print :CFBundleShortVersionString' "$INFO")"
BUILD="$("$PLIST" -c 'Print :CFBundleVersion' "$INFO")"
EXECUTABLE="$("$PLIST" -c 'Print :CFBundleExecutable' "$INFO")"
[[ "$BUNDLE" == com.genaia.app ]] || fail "Identidad inesperada: $BUNDLE"
[[ "$VERSION" =~ ^[0-9]+(\.[0-9]+){1,3}$ ]] || fail 'La version del producto no es valida.'
[[ "$EXECUTABLE" == GENEAI && -x "$APP/Contents/MacOS/$EXECUTABLE" ]] || fail 'Falta el ejecutable esperado GENEAI.'
TARGET="$OUT/GENEAI-$VERSION-macOS.dmg"
[[ ! -e "$TARGET" && ! -L "$TARGET" ]] || fail "Ya existe $TARGET. No se sobrescribira."
mkdir -p "$WORK/stage" "$MOUNT"
ditto "$APP" "$WORK/stage/GENEAI.app"
ln -s /Applications "$WORK/stage/Applications"
hdiutil create -volname "GENEAI $VERSION" -srcfolder "$WORK/stage" \
  -format UDZO "$WORK/GENEAI.dmg"
hdiutil verify "$WORK/GENEAI.dmg"
hdiutil attach "$WORK/GENEAI.dmg" -readonly -nobrowse -mountpoint "$MOUNT"
MOUNTED=1
[[ -x "$MOUNT/GENEAI.app/Contents/MacOS/GENEAI" ]] || fail 'El DMG montado no contiene el ejecutable.'
[[ "$("$PLIST" -c 'Print :CFBundleIdentifier' "$MOUNT/GENEAI.app/Contents/Info.plist")" == com.genaia.app ]] || fail 'La identidad del DMG no coincide.'
hdiutil detach "$MOUNT"
MOUNTED=0
# Publish a complete, verified file atomically and without replacing any target.
PUBLISH_TMP="$(mktemp "$OUT/.GENEAI-dmg.XXXXXX")"
cat "$WORK/GENEAI.dmg" > "$PUBLISH_TMP"
hdiutil verify "$PUBLISH_TMP"
python3 - "$PUBLISH_TMP" "$TARGET" <<'PYLINK'
import os
import sys
os.link(sys.argv[1], sys.argv[2])
PYLINK
rm -f -- "$PUBLISH_TMP"
PUBLISH_TMP=
HASH="$(shasum -a 256 "$TARGET" | awk '{print $1}')"
printf '\nDMG creado y verificado: %s\nVersion: %s (%s)\nBundle: %s\nArquitectura de compilacion: %s\nSHA-256: %s\n' \
  "$TARGET" "$VERSION" "$BUILD" "$BUNDLE" "$ARCH" "$HASH"
file "$APP/Contents/MacOS/GENEAI"
printf '%s\n' 'Sin firma de distribucion ni notarizacion. No se ha instalado ni abierto la app.' \
  'Aun deben probarse inicio de sesion, datos, funciones y actualizacion de la instalacion existente.'
