#!/bin/bash
cd "$(dirname "$0")/.."
python3 - <<'PY'
import subprocess, sys
GEN="/Users/admin/.agents/skills/generate-image/scripts/generate.py"
p=("游戏贴图，竖向长条树干纹理，宽高比 1比2.4：一株参天古树的树干正面，"
   "深褐色与焦黑色树皮，深深的纵向裂纹，树皮上刻着疏落的金色甲骨文符文，"
   "没有树枝没有树梢，整根树干占满画面，左右边缘是自然的树皮轮廓，"
   "纯白色背景，厚涂质感，无文字标题，无边框")
subprocess.run([sys.executable,GEN,"--prompt",p,"--size","512x1280","-o","assets/raw/trunk_tall.png"],check=False)
PY
