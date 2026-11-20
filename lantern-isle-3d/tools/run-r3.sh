#!/bin/bash
set -u
cd "$(dirname "$0")/.."
N=/opt/homebrew/bin/node
B=/Applications/Blender.app/Contents/MacOS/Blender
SK=../../skills/game3d-pipeline/scripts
IDS=build_cottage_a,build_cottage_b,build_lighthouse_01,build_boathouse_01,build_shed_01,build_well_01,prop_lantern_post_01,env_tree_pine_01,env_rock_01,env_crate_stack_01
echo "[wait-vram] 机会主义等显存（A>=66G 走 h3，C>=42G 走 qwen-image；最多 45 分钟）"
HAVE_H3=0
for i in $(seq 1 45); do
  AM=$(curl -s -m 8 http://117.50.187.176:8990/v1/health | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('mem_used_mb',99999))" 2>/dev/null || echo 99999)
  CM=$(curl -s -m 8 http://117.50.89.18:8990/v1/health | python3 -c "import sys,json;d=json.load(sys.stdin);print(d.get('mem_used_mb',99999))" 2>/dev/null || echo 99999)
  echo "[wait-vram] A=${AM}MB C=${CM}MB"
  if [ "${AM:-99999}" -lt 14000 ]; then HAVE_H3=1; break; fi
  if [ "${CM:-99999}" -lt 38000 ]; then break; fi
  sleep 60
done
if [ "$HAVE_H3" = "1" ]; then echo "[stage h3]"; bash tools/stage-models.sh h3; fi
echo "[concepts]" ; $N tools/gen-hunyuan.mjs --force-art --concepts-only 2>&1 | tail -4
echo "[stage hy3d]" ; bash tools/stage-models.sh hy3d
echo "[gens]" ; $N tools/gen-hunyuan.mjs --gens-only 2>&1 | tail -6
python3 - <<'PY'
import json,io,os
m=json.load(io.open('assets/asset-manifest.json',encoding='utf-8'))
ids="""build_cottage_a,build_cottage_b,build_lighthouse_01,build_boathouse_01,build_shed_01,build_well_01,prop_lantern_post_01,env_tree_pine_01,env_rock_01,env_crate_stack_01,char_keeper""".split(',')
for x in m['assets']:
    if x['id'] in ids and os.path.exists('assets/_raw3d/%s.r3.glb'%x['id']):
        x['raw']='assets/_raw3d/%s.r3.glb'%x['id']; x['status']='generated'
json.dump(m,io.open('assets/asset-manifest.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
print('manifest raw → .r3')
PY
echo "[decimate env]" ; $B -b -P $SK/blender-decimate.py -- --root . --ids $IDS --budget 9000 --tolerance 0.0008 --suffix _r3 2>&1 | grep -E "^OK|^FAIL|====" | tail -4
echo "[optimize env]" ; $N $SK/optimize-glb.mjs --root . --only $IDS 2>&1 | grep -E "聚合|DONE"
echo "[rig char]"
if [ -f assets/_raw3d/char_keeper.r3.glb ]; then
  $B -b -P $SK/blender-decimate.py -- --root . --ids char_keeper --budget 10000 --tolerance 0.0006 --suffix _r3 2>&1 | grep -E "^OK|^FAIL" | tail -2
  RAW=$(python3 -c "import json;print([x['raw'] for x in json.load(open('assets/asset-manifest.json'))['assets'] if x['id']=='char_keeper'][0])")
  $B -b -P $SK/blender-character.py -- --root . --id char_keeper --height 1.75 --mesh "$RAW" 2>&1 | grep -E "bytes=|animations" | tail -2
  $N $SK/optimize-glb.mjs --root . --only char_keeper 2>&1 | grep -E "^OK|聚合"
fi
echo "==== run-r3 DONE ===="
