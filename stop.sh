#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PID_FILE=".server.pid"

if [ ! -f "$PID_FILE" ]; then
  echo "未找到 PID 文件，服务可能未运行。"
  exit 0
fi

pid="$(cat "$PID_FILE" 2>/dev/null || true)"
rm -f "$PID_FILE"

if [ -z "$pid" ] || ! kill -0 "$pid" 2>/dev/null; then
  echo "服务未运行。"
  exit 0
fi

kill "$pid" 2>/dev/null || true
for _ in {1..25}; do
  kill -0 "$pid" 2>/dev/null || { echo "已停止（PID ${pid}）。"; exit 0; }
  sleep 0.2
done

kill -9 "$pid" 2>/dev/null || true
echo "已强制停止（PID ${pid}）。"
