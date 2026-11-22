#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d node_modules/sharp ]; then npm ci || exit; fi
if [ ! -f assets/cubes/1.webp ]; then npm run assets || exit; fi
(sleep 1; open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000) &
python3 -m http.server 8000
