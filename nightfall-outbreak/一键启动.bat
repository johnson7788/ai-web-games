@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
set PORT=8000
netstat -ano | findstr ":%PORT% " >nul && set PORT=8001
echo Starting NIGHTFALL: OUTBREAK local preview on http://localhost:%PORT%/
start "" "http://localhost:%PORT%/"
where python >nul 2>nul
if %errorlevel%==0 ( python tools\serve.py %PORT% ) else ( py tools\serve.py %PORT% )
pause
