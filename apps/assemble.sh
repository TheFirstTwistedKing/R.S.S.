#!/usr/bin/env bash
# 앱 화면 파일 모으기: apps/<app>/www + apps/shared + 글꼴 → apps/<app>/web (Electron · 안드로이드가 이 폴더를 씀)
#   사용: bash apps/assemble.sh registry | oplink
set -euo pipefail
APP="$1"; ROOT="$(cd "$(dirname "$0")/.." && pwd)"; OUT="$ROOT/apps/$APP/web"
rm -rf "$OUT"; mkdir -p "$OUT/shared/fonts"
cp -r "$ROOT/apps/$APP/www/." "$OUT/"
cp "$ROOT/apps/shared/"*.js "$ROOT/apps/shared/"*.css "$OUT/shared/"
cp -r "$ROOT/apps/shared/fonts/pen" "$OUT/shared/fonts/pen"
cp "$ROOT/src/fonts/PretendardVariable.woff2" "$ROOT/src/fonts/D2Coding.woff2" "$ROOT/src/fonts/OFL-Pretendard.txt" "$OUT/shared/fonts/"
cp "$ROOT/apps/$APP/build/icon.png" "$OUT/icon.png"
echo "assembled $APP → $OUT"
