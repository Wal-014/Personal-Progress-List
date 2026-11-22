#!/bin/bash
cd "$(dirname "$0")"
if [ ! -d node_modules/flag-icons ]; then npm ci || exit; fi
npm run assets || exit
(sleep 1; open http://localhost:8000 2>/dev/null || xdg-open http://localhost:8000) &
python3 -m http.server 8000
