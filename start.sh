#!/usr/bin/env bash
# Starts everything for local development in one terminal: the backend
# (backend/start.sh: the API gateway on 8000, which starts the user, item and AI
# services) and the website (Vite's dev server, http://localhost:5173).
# Ctrl+C stops both, and so does either one stopping on its own.
cd "$(dirname "$0")" || exit 1

[ -d frontend/node_modules ] || (cd frontend && npm install) || exit 1

# Each in its own process group, so stopping one reaches everything it started.
# No terminal input for them: a background group reading it would be paused.
set -m
(cd backend && exec bash start.sh) </dev/null &
backend=$!
(cd frontend && exec npm run dev) </dev/null &
frontend=$!

stop() {
  trap - INT TERM
  echo
  echo "Stopping the backend and the website…"
  kill -TERM -- -"$backend" -"$frontend" 2>/dev/null
  wait
  exit "${1:-0}"
}
trap stop INT TERM

# One exiting (a crash, a port already in use) stops the other
while kill -0 "$backend" 2>/dev/null && kill -0 "$frontend" 2>/dev/null; do
  sleep 1
done
kill -0 "$backend" 2>/dev/null || echo "The backend stopped."
kill -0 "$frontend" 2>/dev/null || echo "The website stopped."
stop 1
