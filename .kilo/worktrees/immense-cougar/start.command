#!/bin/zsh

set -e

SCRIPT_DIR="${0:A:h}"
PORT=4173

cd "$SCRIPT_DIR"

if command -v python3 >/dev/null 2>&1; then
    (sleep 1; open "http://localhost:${PORT}") &
    echo "Pixel3D is running at http://localhost:${PORT}"
    echo "Keep this window open. Press Control-C to stop."
    exec python3 -m http.server "$PORT"
fi

echo "Python 3 is required to launch Pixel3D locally."
read -k 1 "?Press any key to close."
exit 1
