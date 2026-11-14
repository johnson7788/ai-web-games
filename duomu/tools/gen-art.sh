#!/bin/bash
set -u
GEN=/Users/admin/.agents/skills/generate-image/scripts/generate.py
cd "$(dirname "$0")/.."
python3 - "$@" <<'PY'
import json,subprocess,sys,os
spec=json.load(open('tools/art-prompts.json'))
GEN="/Users/admin/.agents/skills/generate-image/scripts/generate.py"
jobs=[(k,v) for k,v in spec.items()]
for k,p in jobs:
    out=f"assets/raw/{k}.png"
    if os.path.exists(out): print("skip",k,flush=True); continue
    size={"bg_wind":"720x1280","bg_fire":"720x1280","bg_thunder":"720x1280"}.get(k,"1024x1024")
    print("gen",k,flush=True)
    subprocess.run([sys.executable,GEN,"--prompt",p,"--size",size,"-o",out],check=False)
PY
