#!/bin/bash
# r3 收尾：天空图 → 门禁 → 打包 → 发布 → 下架旧版
set -u
cd "$(dirname "$0")/.."
N=/opt/homebrew/bin/node
if [ ! -f assets/tex/sky_dusk.webp ]; then
  # C 机被占满起不来 qwen-image → 天空图走 A 机 h3-image（批次跑完后 A 空闲，停 hunyuan3d 换 h3）
  curl -s -m 60 -X POST http://117.50.187.176:8990/v1/stop -d '{"name":"hunyuan3d"}' >/dev/null || true
  curl -s -m 900 -X POST http://117.50.187.176:8990/v1/start -d '{"name":"h3-image"}' >/dev/null || true
  ssh -p 23 -o ConnectTimeout=15 -o StrictHostKeyChecking=no -N -L 18993:localhost:8990 root@117.50.187.176 & TUN=$!
  sleep 5
  python3 - <<'PY' || true
import json,base64,urllib.request
prompt=("photorealistic RAW photograph of a north-atlantic dusk sky over the sea, low warm sun behind heavy storm clouds, "
        "cold blue-grey cloud masses with orange rim light, smooth gradient zenith to horizon, no land, no text, no watermark")
body=json.dumps({"prompt":prompt,"width":2048,"height":1024,"seed":99}).encode()
req=urllib.request.Request('http://127.0.0.1:18993/m/h3-image/txt2img',data=body,headers={'Content-Type':'application/json'})
with urllib.request.urlopen(req,timeout=900) as r: j=json.load(r)
img=j.get('image_base64') or (j.get('images') or [None])[0]
assert img, 'no image'
open('assets/_src3d/sky_dusk.png','wb').write(base64.b64decode(img))
print('sky h3 ok')
PY
  kill $TUN 2>/dev/null || true
  curl -s -m 60 -X POST http://117.50.187.176:8990/v1/stop -d '{"name":"h3-image"}' >/dev/null || true
  if [ -f assets/_src3d/sky_dusk.png ]; then
    /opt/homebrew/bin/ffmpeg -y -hide_banner -loglevel error -i assets/_src3d/sky_dusk.png -vf scale=1024:512 assets/tex/sky_dusk.webp && echo "sky webp ok"
  fi
fi
echo "[gates]"
echo "[gates]"
$N ../../skills/game3d-pipeline/scripts/gate3d.mjs --root . --round 20 2>&1 | tail -9
echo "[package+publish]"
cd ../.. && $N tools/package-all.mjs --games lantern-isle-3d 2>&1 | tail -2
$N skills/upload_games/scripts/upload.mjs --manifest dist/lantern-isle-3d/manifest.json --publish 2>&1 | tail -3
echo "==== post-r3 DONE ===="
