@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Please install Node.js 24 LTS from https://nodejs.org/ first.
  pause
  exit /b 1
)
where git >nul 2>nul
if errorlevel 1 (
  echo Please install Git for Windows from https://git-scm.com/ first.
  pause
  exit /b 1
)
if not exist node_modules\pnpm\bin\pnpm.cjs (
  call npm ci
  if errorlevel 1 goto failed
)
node scripts\setup-windows.mjs
if errorlevel 1 goto failed
node scripts\start-desktop.mjs
if errorlevel 1 goto failed
exit /b 0
:failed
echo Bloop could not start. Review the error above and data\desktop.log.
pause
exit /b 1
