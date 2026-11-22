@echo off
cd /d "%~dp0"
if not exist "node_modules\sharp\" (call npm ci || exit /b 1)
if not exist "assets\cubes\1.webp" (call npm run assets || exit /b 1)
start "" "http://localhost:8000"
python -m http.server 8000
