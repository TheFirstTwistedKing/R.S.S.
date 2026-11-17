#!/usr/bin/env bash
# R.S.S. Mobile 안드로이드 프로젝트 준비: mobile/ 웹앱을 Capacitor 안드로이드 앱으로 감싸고
# 아이콘 · 시작 화면 · 세로 고정 · 상단 바 색 · 버전을 맞춤. (android-app 폴더에서 실행)
#   사용: bash prepare.sh <versionCode>
set -euo pipefail
VCODE="${1:-1}"
VNAME="$(node -p "require('./package.json').version")"
rm -rf www android
cp -r ../mobile www
npx cap add android
R=android/app/src/main/res
cp -r res/. "$R/"                                                    # 아이콘 · 시작 화면
sed -i 's#<color name="ic_launcher_background">.*</color>#<color name="ic_launcher_background">\#050607</color>#' "$R/values/ic_launcher_background.xml"
# 상단 · 하단 바를 앱 바탕색(검정)으로
sed -i 's#<item name="android:background">@null</item>#<item name="android:background">@null</item>\n        <item name="android:statusBarColor">\#050607</item>\n        <item name="android:navigationBarColor">\#050607</item>\n        <item name="android:windowBackground">@android:color/black</item>#' "$R/values/styles.xml"
# 세로 화면 고정
sed -i 's#android:name=".MainActivity"#android:name=".MainActivity"\n            android:screenOrientation="portrait"#' android/app/src/main/AndroidManifest.xml
# 서명: 매번 같은 키(android-app/debug.keystore)로 → 새 버전을 덮어 설치할 수 있음
#  (빌드 서버의 기본 디버그 키는 실행마다 달라서 직접 지정)
sed -i "0,/^android {/s##android {\n    signingConfigs {\n        debug {\n            storeFile file('../../debug.keystore')\n            storePassword 'android'\n            keyAlias 'androiddebugkey'\n            keyPassword 'android'\n        }\n    }#" android/app/build.gradle
grep -q "debug.keystore" android/app/build.gradle
# 버전
sed -i "s/versionCode 1$/versionCode ${VCODE}/; s/versionName \"1.0\"/versionName \"${VNAME}\"/" android/app/build.gradle
grep -q "versionCode ${VCODE}" android/app/build.gradle
echo "prepared R.S.S. Mobile ${VNAME} (${VCODE})"
