#!/bin/bash
# 机会主义看门狗：A 机被别的租户占着 ~48G（411649/951788/958449… 非本任务进程，按铁律不 kill）。
# 每 60s 看一次 A 机显存；空出 ≥66G（mem<14000MB）就跑完整 r3 链 + 门禁 + 发布 v3 + 下架 v2。
# 寿命上限 3 小时；超时退出并留日志，不无限等。
cd "$(dirname "$0")/.." || exit 1
A=http://117.50.187.176:8990
for i in $(seq 1 180); do
  M=$(curl -s -m 8 $A/v1/health | python3 -c "import sys,json;print(json.load(sys.stdin).get('mem_used_mb',99999))" 2>/dev/null || echo 99999)
  echo "[$(date +%H:%M:%S)] poll#$i A=${M}MB" >> tools/watch-r3.log
  if [ "${M:-99999}" -lt 14000 ]; then
    echo "[$(date +%H:%M:%S)] A 机空出，开始 r3 全链" >> tools/watch-r3.log
    bash tools/run-r3.sh >> tools/watch-r3.log 2>&1
    bash tools/post-r3.sh >> tools/watch-r3.log 2>&1
    echo "[$(date +%H:%M:%S)] r3 全链结束" >> tools/watch-r3.log
    exit 0
  fi
  sleep 60
done
echo "[$(date +%H:%M:%S)] 3 小时内 A 机未空出，退出（v2 仍在线，资产保持 v2 质量）" >> tools/watch-r3.log
