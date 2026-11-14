#!/bin/bash
cd "$(dirname "$0")/.."
python3 - <<'PY'
import subprocess, sys
GEN="/Users/admin/.agents/skills/generate-image/scripts/generate.py"
p=("游戏贴图，横向长条树皮纹理，宽高比 2.5比1：一株通天古树的树皮表面，"
   "深深的纵向裂纹，褐色与焦黑色调，表面刻着金色的甲骨文符文，"
   "上下边缘收口自然可以竖向拼接，树皮占满整个画面，纯白色背景，厚涂质感，无文字标题，无边框")
subprocess.run([sys.executable,GEN,"--prompt",p,"--size","1024x420","-o","assets/raw/bark_strip.png"],check=False)
PY
