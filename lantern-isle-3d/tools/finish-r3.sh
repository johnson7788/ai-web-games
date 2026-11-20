#!/bin/bash
# r3 写实资产落地：等 gen-hunyuan(r3) 完成 → manifest raw 切 .r3 → decimate → optimize(贴图按台账 texMaxPx) → 角色绑骨 → all.js
set -u
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
N=/opt/homebrew/bin/node
SK=../../skills/game3d-pipeline/scripts
IDS=build_cottage_a,build_cottage_b,build_lighthouse_01,build_boathouse_01,build_shed_01,build_well_01,prop_lantern_post_01,env_tree_pine_01,env_rock_01,env_crate_stack_01
echo "[wait] gen-hunyuan r3 …"
for i in $(seq 1 150); do grep -q "gen-hunyuan DONE" tools/gen-hunyuan-r3.log && break; sleep 20; done
tail -2 tools/gen-hunyuan-r3.log
python3 - <<'PY'
import json,io
m=json.load(io.open('assets/asset-manifest.json',encoding='utf-8'))
ids="""build_cottage_a,build_cottage_b,build_lighthouse_01,build_boathouse_01,build_shed_01,build_well_01,prop_lantern_post_01,env_tree_pine_01,env_rock_01,env_crate_stack_01""".split(',')
import os
for x in m['assets']:
    if x['id'] in ids and os.path.exists('assets/_raw3d/%s.r3.glb'%x['id']):
        x['raw']='assets/_raw3d/%s.r3.glb'%x['id']; x['status']='generated'
json.dump(m,io.open('assets/asset-manifest.json','w',encoding='utf-8'),ensure_ascii=False,indent=2)
print('manifest raw → .r3')
PY
echo "[decimate]"
$B -b -P $SK/blender-decimate.py -- --root . --ids $IDS --budget 9000 --tolerance 0.0008 --suffix _r3 2>&1 | grep -E "^OK|^FAIL|===="
echo "[optimize env]"
$N $SK/optimize-glb.mjs --root . --only $IDS 2>&1 | grep -E "^OK|^FAIL|聚合|DONE"
echo "[rig char]"
if [ -f assets/_raw3d/char_keeper.r3.glb ]; then
  python3 -c "
import json,io
m=json.load(io.open('assets/asset-manifest.json'))
for x in m['assets']:
    if x['id']=='char_keeper': x['raw']='assets/_raw3d/char_keeper.r3.glb'; x['status']='generated'
json.dump(m,io.open('assets/asset-manifest.json','w'),ensure_ascii=False,indent=2)"
  $B -b -P $SK/blender-decimate.py -- --root . --ids char_keeper --budget 10000 --tolerance 0.0006 --suffix _r3 2>&1 | grep -E "^OK|^FAIL"
  RAW=$(python3 -c "import json;print([x['raw'] for x in json.load(open('assets/asset-manifest.json'))['assets'] if x['id']=='char_keeper'][0])")
  $B -b -P $SK/blender-character.py -- --root . --id char_keeper --height 1.75 --mesh "$RAW" 2>&1 | grep -E "bytes=|animations"
  $N $SK/optimize-glb.mjs --root . --only char_keeper 2>&1 | grep -E "^OK|聚合"
else
  echo "[rig] char_keeper.r3.glb 缺失，保留 v2 角色"
fi
echo "==== finish-r3 DONE ===="
