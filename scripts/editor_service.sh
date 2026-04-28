#!/usr/bin/env bash
# GAC Menu Editor — Backend Service Manager
# Usage: ./scripts/editor_service.sh start|stop|restart|status

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKEND_DIR="$PROJECT_DIR/backend"
PID_FILE="$PROJECT_DIR/.editor_backend.pid"
LOG_FILE="$PROJECT_DIR/logs/app.log"

HOST="${BACKEND_HOST:-0.0.0.0}"
PORT="${BACKEND_PORT:-8100}"

start() {
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Backend already running (PID $(cat "$PID_FILE"))"
        return 1
    fi
    echo "Starting Menu Editor backend on $HOST:$PORT..."
    cd "$BACKEND_DIR"
    nohup uvicorn main:app --host "$HOST" --port "$PORT" >> "$LOG_FILE" 2>&1 &
    echo $! > "$PID_FILE"
    echo "Started (PID $!)"
}

stop() {
    if [[ ! -f "$PID_FILE" ]]; then
        echo "No PID file found. Backend may not be running."
        return 1
    fi
    local pid
    pid=$(cat "$PID_FILE")
    if kill -0 "$pid" 2>/dev/null; then
        echo "Stopping backend (PID $pid)..."
        kill "$pid"
        rm -f "$PID_FILE"
        echo "Stopped."
    else
        echo "Process $pid not running. Cleaning up PID file."
        rm -f "$PID_FILE"
    fi
}

restart() {
    stop || true
    sleep 1
    start
}

status() {
    if [[ -f "$PID_FILE" ]] && kill -0 "$(cat "$PID_FILE")" 2>/dev/null; then
        echo "Backend running (PID $(cat "$PID_FILE")) on port $PORT"
    else
        echo "Backend not running"
        [[ -f "$PID_FILE" ]] && rm -f "$PID_FILE"
    fi
}

case "${1:-}" in
    start)   start ;;
    stop)    stop ;;
    restart) restart ;;
    status)  status ;;
    *)       echo "Usage: $0 {start|stop|restart|status}"; exit 1 ;;
esac
