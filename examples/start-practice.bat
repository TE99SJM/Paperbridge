@echo off
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install a current Node.js LTS release from https://nodejs.org/en/download
  pause
  exit /b 1
)
node serve-practice.mjs
pause
