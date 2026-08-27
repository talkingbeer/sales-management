#!/usr/bin/env sh
# macOS / Linux 에서 CLOSER 데모를 실행합니다.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js 가 필요합니다. https://nodejs.org 에서 설치한 뒤 다시 실행하세요."
  echo "설치 없이 보려면 index.html 을 브라우저로 직접 열어도 됩니다"
  echo "(다만 file:// 에서는 브라우저에 따라 변경 사항이 저장되지 않습니다)."
  exit 1
fi
exec node serve.js "$@"
