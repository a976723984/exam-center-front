#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PID_FILE="${PID_FILE:-$ROOT_DIR/run/frontend.pid}"

if [[ ! -f "$PID_FILE" ]]; then
  echo "frontend not running (pid file not found: $PID_FILE)."
  exit 0
fi

PID="$(cat "$PID_FILE")"
if [[ -z "${PID:-}" ]]; then
  rm -f "$PID_FILE"
  echo "frontend pid file was empty; cleaned."
  exit 0
fi

if kill -0 "$PID" >/dev/null 2>&1; then
  echo "Stopping frontend (pid=$PID)..."
  kill "$PID" || true
  for _ in {1..15}; do
    if kill -0 "$PID" >/dev/null 2>&1; then
      sleep 1
    else
      break
    fi
  done
  if kill -0 "$PID" >/dev/null 2>&1; then
    echo "Frontend still running; force killing (pid=$PID)..."
    kill -9 "$PID" || true
  fi
else
  echo "frontend process not found (pid=$PID)."
fi

rm -f "$PID_FILE"
echo "frontend stopped."
