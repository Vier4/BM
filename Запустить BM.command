#!/bin/bash
# Двойной клик — и BM откроется в браузере.
cd "$(dirname "$0")"
PORT=8765
(sleep 1 && open "http://localhost:$PORT") &
echo "BM работает на http://localhost:$PORT — закройте это окно, чтобы остановить."
python3 -m http.server $PORT
