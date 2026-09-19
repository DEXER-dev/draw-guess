@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 goto :no_node

if not exist node_modules (
  echo [1/2] Installing dependencies...
  call npm install
  if errorlevel 1 goto :install_failed
)

echo [2/2] Opening the game launcher...
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0launcher.ps1"
if errorlevel 1 goto :launcher_failed
exit /b 0

:no_node
echo Node.js was not found. Please install Node.js 18 or newer.
pause
exit /b 1

:install_failed
echo Dependency installation failed. Check Node.js and network access.
pause
exit /b 1

:launcher_failed
echo The launcher could not start. Check launcher.ps1 and the log files.
pause
exit /b 1
