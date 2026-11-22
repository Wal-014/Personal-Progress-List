@echo off
cd /d "%~dp0"
if not exist "node_modules\flag-icons\" (call npm ci || exit /b 1)
call npm run assets || exit /b 1
start "" "http://localhost:8000"
python -m http.server 8000
