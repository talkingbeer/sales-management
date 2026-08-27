@echo off
chcp 65001 >nul
title CLOSER 데모
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js 가 설치되어 있지 않습니다.
  echo 서버 없이 보시려면 index.html 을 더블클릭해도 됩니다.
  echo 다만 브라우저에 따라 변경 사항이 저장되지 않을 수 있습니다.
  echo.
  pause
  exit /b 1
)
echo CLOSER 데모 서버를 시작합니다...
node serve.js
pause
