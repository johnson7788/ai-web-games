#!/bin/bash
cd "$(dirname "$0")/.."
python3 - <<'PY'
import json,subprocess,sys,os
spec=json.load(open('tools/art-prompts-2.json'))
GEN="/Users/admin/.agents/skills/generate-image/scripts/generate.py"
for k,p in spec.items():
    out=f"assets/raw/{k}.png"
    size="1280x512" if k=="log_wide" else "720x1280"
    print("gen",k,flush=True)
    subprocess.run([sys.executable,GEN,"--prompt",p,"--size",size,"-o",out],check=False)
PY
