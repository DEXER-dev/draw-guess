@echo off
setlocal
chcp 65001 >nul
cd /d "%~dp0"

echo Opening the game launcher...
powershell.exe -NoProfile -ExecutionPolicy Bypass -STA -File "%~dp0launcher.ps1"
if errorlevel 1 goto :launcher_failed
exit /b 0

:launcher_failed
echo The launcher could not start. Check launcher.ps1 and the log files.
pause
exit /b 1
