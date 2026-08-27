@echo off
REM 실행.cmd 와 같은 일을 합니다. 한글 파일명이 깨지는 환경을 위한 ASCII 이름입니다.
chcp 65001 >nul
title CLOSER
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo Node.js is not installed. You can still open index.html directly,
  echo but some browsers block localStorage on file:// so changes may not persist.
  echo.
  pause
  exit /b 1
)
node serve.js
pause
