#!/bin/bash
# 等 gen-hunyuan 跑完 → 逐件 decimate+optimize → 角色分段绑骨 → 重发聚合模块 → 汇总
set -u
cd "$(dirname "$0")/.."
B=/Applications/Blender.app/Contents/MacOS/Blender
N=/opt/homebrew/bin/node
SK=../../skills/game3d-pipeline/scripts
echo "[wait] 等 gen-hunyuan 结束…"
for i in $(seq 1 90); do grep -q "gen-hunyuan DONE" tools/gen-hunyuan.nohup.log && break; sleep 20; done
tail -2 tools/gen-hunyuan.nohup.log
BUILDINGS="build_cottage_a build_cottage_b build_lighthouse_01 build_boathouse_01 build_shed_01 build_well_01"
PROPS="prop_lantern_post_01 env_tree_pine_01 env_rock_01 env_crate_stack_01"
echo "[decimate] buildings"
$B -b -P $SK/blender-decimate.py -- --root . --ids $(echo $BUILDINGS | tr ' ' ',') --budget 9000 --tolerance 0.0008 --suffix _h 2>&1 | grep -E "^OK|^FAIL|===="
echo "[decimate] props"
$B -b -P $SK/blender-decimate.py -- --root . --ids $(echo $PROPS | tr ' ' ',') --budget 4000 --tolerance 0.0008 --suffix _h 2>&1 | grep -E "^OK|^FAIL|===="
echo "[optimize] 全部 hunyuan 件"
$N $SK/optimize-glb.mjs --root . --only $(echo $BUILDINGS $PROPS | tr ' ' ',') 2>&1 | grep -E "^OK|^FAIL|聚合"
echo "[rig] 角色分段绑骨"
if [ -f assets/_raw3d/char_keeper.h3d.glb ]; then
  $B -b -P $SK/blender-character.py -- --root . --id char_keeper --height 1.75 --mesh assets/_raw3d/char_keeper.h3d.glb 2>&1 | grep -E "bytes=|parts=|WARN|FATAL"
  python3 - <<'PY'
import json,io
m=json.load(io.open('assets/asset-manifest.json'))
for a in m['assets']:
    if a['id']=='char_keeper':
        a['raw']='assets/_raw3d/char_keeper.glb'; a['source']['pipeline']='hunyuan3d+band-rig'; a['status']='generated'
json.dump(m,io.open('assets/asset-manifest.json','w'),ensure_ascii=False,indent=2)
print('manifest: char_keeper -> 绑骨产物')
PY
  $N $SK/optimize-glb.mjs --root . --only char_keeper 2>&1 | grep -E "^OK|^FAIL|聚合"
else
  echo "[rig] 没有 char_keeper.h3d.glb，跳过"
fi
echo "[retry] 失败的件重试一轮"
FAILIDS=$(grep "^.*FAIL " tools/gen-hunyuan.nohup.log | sed -E 's/.*FAIL ([a-z0-9_]+):.*/\1/' | sort -u | tr '\n' ',' | sed 's/,$//')
if [ -n "$FAILIDS" ]; then timeout 3000 $N tools/gen-hunyuan.mjs --only=$FAILIDS 2>&1 | tail -3; fi
echo "==== finish-upgrade DONE ===="
