#!/bin/bash
set -euo pipefail

# Build and test source only. Does not install, launch, sign, archive or release.
cd "$(dirname "$0")/.."
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "Apple validation requires macOS with Xcode and XcodeGen." >&2
  exit 1
fi
command -v xcodebuild >/dev/null
command -v xcodegen >/dev/null
python3 -m unittest discover -s tests -p 'test_*.py' -v
./scripts/generate.sh
xcodebuild -resolvePackageDependencies -project GENAIAApple.xcodeproj -scheme GENAIAApple
xcodebuild -project GENAIAApple.xcodeproj -scheme GENAIAApple \
  -destination 'platform=macOS' -derivedDataPath DerivedData \
  CODE_SIGNING_ALLOWED=NO build
xcodebuild -project GENAIAApple.xcodeproj -scheme GENAIANativeTests \
  -destination 'platform=macOS' -derivedDataPath DerivedData \
  CODE_SIGNING_ALLOWED=NO test
xcodebuild -project GENAIAApple.xcodeproj -scheme GENAIAApple \
  -destination 'generic/platform=iOS Simulator' -derivedDataPath DerivedData \
  CODE_SIGNING_ALLOWED=NO build

echo "Build/test finished. Record the resolved Supabase version and Xcode version in the review."
