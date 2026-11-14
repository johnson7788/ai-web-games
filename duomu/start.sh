#!/bin/bash
# 《夺木》一键启动：起一个静态服务并打开浏览器。
# 用法：./start.sh [端口]
set -u
cd "$(dirname "$0")" || exit 1
PORT="${1:-8127}"

# 端口被占就往后找
while lsof -nP -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do
  PORT=$((PORT + 1))
done

URL="http://127.0.0.1:${PORT}/"
echo "夺木 · 通天建木"
echo "→ ${URL}   (Ctrl+C 结束)"
python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER_PID=$!
trap 'kill $SERVER_PID 2>/dev/null' EXIT INT TERM

sleep 0.6
if command -v open >/dev/null 2>&1; then open "$URL"
elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$URL"
fi
wait $SERVER_PID
