@echo off
setlocal

cd /d "%~dp0"
powershell -NoProfile -ExecutionPolicy Bypass -File ".\scripts\deploy-discord-windows.ps1" -InstallStartupTask -StartNow

echo.
echo Press any key to close this window.
pause >nul
