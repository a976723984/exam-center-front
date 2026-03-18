#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"

PORT="${PORT:-8080}"
BIND="${BIND:-0.0.0.0}"
LOG_DIR="${LOG_DIR:-$ROOT_DIR/logs}"
RUN_DIR="${RUN_DIR:-$ROOT_DIR/run}"

mkdir -p "$LOG_DIR" "$RUN_DIR"

PID_FILE="$RUN_DIR/frontend.pid"
LOG_FILE="$LOG_DIR/frontend.out"

if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" >/dev/null 2>&1; then
  echo "frontend already running (pid=$(cat "$PID_FILE"))."
  exit 0
fi

if command -v python3 >/dev/null 2>&1; then
  SERVER_CMD=(python3 -m http.server "$PORT" --bind "$BIND")
elif command -v python >/dev/null 2>&1; then
  SERVER_CMD=(python -m http.server "$PORT" --bind "$BIND")
else
  echo "python3/python not found. Please install Python 3."
  exit 1
fi

echo "Starting frontend static server on http://${BIND}:${PORT} ..."
nohup "${SERVER_CMD[@]}" >>"$LOG_FILE" 2>&1 &
echo $! > "$PID_FILE"
echo "frontend started (pid=$(cat "$PID_FILE")), log=$LOG_FILE"
