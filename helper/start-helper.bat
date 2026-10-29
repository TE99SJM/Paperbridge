@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Install a current Node.js LTS release from https://nodejs.org/en/download
  echo Then close and reopen this launcher.
  pause
  exit /b 1
)
node paperbridge-helper.mjs
echo.
echo The helper has stopped.
pause
