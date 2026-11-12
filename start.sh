#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"

PORT="${PORT:-8771}"
HOST="${HOST:-0.0.0.0}"
PID_FILE=".server.pid"
LOG_FILE=".server.log"
CHECK_URL="http://127.0.0.1:${PORT}/index.html"

lan_ip() {
  local i ip
  for i in en0 en1 en2 en3 en4 en5; do
    ip="$(/usr/sbin/ipconfig getifaddr "$i" 2>/dev/null || true)"
    if [ -n "$ip" ]; then printf '%s' "$ip"; return 0; fi
  done
  /sbin/ifconfig 2>/dev/null | awk '/inet / && $2 != "127.0.0.1" {print $2; exit}'
}

local_hostname() {
  local h
  h="$(/usr/sbin/scutil --get LocalHostName 2>/dev/null || true)"
  [ -n "$h" ] || h="$(hostname 2>/dev/null | sed 's/\.local$//' || true)"
  printf '%s' "$h"
}

print_urls() {
  if [ "$HOST" = "0.0.0.0" ]; then
    local ip hn
    echo "本机：  http://127.0.0.1:${PORT}/"
    ip="$(lan_ip)"
    if [ -n "$ip" ]; then
      echo "局域网：http://${ip}:${PORT}/"
    else
      echo "局域网：未检测到 IPv4 地址，检查 Wi-Fi 或网线"
    fi
    hn="$(local_hostname)"
    if [ -n "$hn" ]; then
      echo "mDNS：  http://${hn}.local:${PORT}/"
    fi
  else
    echo "地址：  http://${HOST}:${PORT}/"
  fi
}

LSOF=""
if [ -x /usr/sbin/lsof ]; then
  LSOF=/usr/sbin/lsof
elif command -v lsof >/dev/null 2>&1; then
  LSOF="$(command -v lsof)"
fi

is_our_app() {
  local pid="$1"
  [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null || return 1
  # 正常路径：看命令行里有没有这个端口的 http.server
  if ps -p "$pid" -o command= 2>/dev/null | grep -q "http.server ${PORT}"; then
    return 0
  fi
  # 沙箱里 ps 会被拒（Operation not permitted），退回用 lsof 查同一个 pid 是否在监听该端口
  if [ -n "$LSOF" ]; then
    "$LSOF" -nP -p "$pid" -a -iTCP:"${PORT}" -sTCP:LISTEN -t 2>/dev/null | grep -q . && return 0
  fi
  return 1
}

# 已有进程是否监听在所有网卡上（*:PORT / 0.0.0.0:PORT）。查不到就当是，避免误重启。
listens_on_lan() {
  local pid="$1" names
  [ -n "$LSOF" ] || return 0
  names="$("$LSOF" -nP -p "$pid" -a -iTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null | awk 'NR>1 {print $9}')"
  [ -n "$names" ] || return 0
  case "$names" in
    *"*:${PORT}"*|*"0.0.0.0:${PORT}"*|*"[::]:${PORT}"*) return 0 ;;
  esac
  return 1
}

# 旧进程只绑了 127.0.0.1 时，停掉它，让下面的启动流程按局域网模式重来。
stop_loopback_only() {
  local pid="$1"
  echo "现有服务（PID ${pid}）只监听本机，局域网访问不到，按局域网模式重启。"
  kill "$pid" 2>/dev/null || true
  for _ in {1..25}; do
    kill -0 "$pid" 2>/dev/null || { rm -f "$PID_FILE"; return 0; }
    sleep 0.2
  done
  kill -9 "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  sleep 0.3
}

if [ -f "$PID_FILE" ]; then
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  if is_our_app "$pid"; then
    if [ "$HOST" = "0.0.0.0" ] && ! listens_on_lan "$pid"; then
      stop_loopback_only "$pid"
    else
      echo "服务已在运行（PID ${pid}）："
      print_urls
      exit 0
    fi
  else
    rm -f "$PID_FILE"
  fi
fi

if [ -n "$LSOF" ]; then
  existing_pid="$("$LSOF" -nP -iTCP:"${PORT}" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)"
  if [ -n "$existing_pid" ]; then
    if is_our_app "$existing_pid"; then
      echo "$existing_pid" > "$PID_FILE"
      if [ "$HOST" = "0.0.0.0" ] && ! listens_on_lan "$existing_pid"; then
        stop_loopback_only "$existing_pid"
      else
        echo "服务已在运行（PID ${existing_pid}）："
        print_urls
        exit 0
      fi
    else
      echo "端口 ${PORT} 已被其他进程占用："
      "$LSOF" -nP -iTCP:"${PORT}" -sTCP:LISTEN
      exit 1
    fi
  fi
fi

nohup python3 -m http.server "${PORT}" --bind "${HOST}" >> "$LOG_FILE" 2>&1 &
pid=$!
echo "$pid" > "$PID_FILE"

for _ in {1..30}; do
  if ! kill -0 "$pid" 2>/dev/null; then
    echo "启动失败，日志末尾："
    tail -20 "$LOG_FILE" 2>/dev/null || true
    rm -f "$PID_FILE"
    exit 1
  fi
  if curl -fsS --max-time 1 "${CHECK_URL}" >/dev/null 2>&1; then
    echo "已启动（PID ${pid}）："
    print_urls
    if [ "$HOST" = "0.0.0.0" ]; then
      lan="$(lan_ip)"
      if [ -n "$lan" ]; then
        if curl -fsS --max-time 2 "http://${lan}:${PORT}/index.html" >/dev/null 2>&1; then
          echo "局域网自检通过。手机连同一个 Wi-Fi，直接打开上面的局域网地址。"
        else
          echo "警告：从 ${lan} 访问失败，多半是防火墙或路由器隔离。"
          echo "      macOS：系统设置 → 网络 → 防火墙，允许 python3 接受传入连接。"
        fi
      fi
    fi
    echo "日志：${LOG_FILE}"
    exit 0
  fi
  sleep 0.2
done

echo "启动超时，请检查日志：${LOG_FILE}"
exit 1
