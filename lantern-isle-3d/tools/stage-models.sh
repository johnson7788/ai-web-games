#!/bin/bash
# A 机 heavy 互斥换模：stop 要等显存真的释放，start 要等真的 running，都轮询确认，不猜。
A=http://117.50.187.176:8990
running() { curl -s -m 10 $A/v1/health | python3 -c "import sys,json;print(','.join(json.load(sys.stdin).get('running') or []))" 2>/dev/null; }
mem() { curl -s -m 10 $A/v1/health | python3 -c "import sys,json;print(json.load(sys.stdin).get('mem_used_mb',0))" 2>/dev/null; }
case "$1" in
  h3)   STOP=hunyuan3d; START=h3-image ;;
  hy3d) STOP=h3-image;  START=hunyuan3d ;;
  *) echo "usage: stage-models.sh h3|hy3d"; exit 2 ;;
esac
if [ "$(running)" != "$START" ]; then
  echo "[stage] stop $STOP"
  curl -s -m 600 -X POST $A/v1/stop -d "{\"name\":\"$STOP\"}" >/dev/null
  for i in $(seq 1 40); do
    R=$(running); M=$(mem)
    echo "[stage] wait release: running=[$R] mem=${M}MB"
    [ "$R" = "" ] && [ "${M:-99999}" -lt 20000 ] && break
    sleep 15
  done
  echo "[stage] start $START"
  curl -s -m 1500 -X POST $A/v1/start -d "{\"name\":\"$START\"}" >/dev/null
  for i in $(seq 1 60); do
    R=$(running)
    echo "[stage] wait ready: running=[$R]"
    [ "$R" = "$START" ] && break
    sleep 15
  done
fi
echo "[stage] final running=[$(running)]"
