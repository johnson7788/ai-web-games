#!/usr/bin/env python3
"""把 26 张官方地图逐张高清重绘，输出 assets/hd/maps/sNN.png（保持原始宽高比）。"""
import base64, json, pathlib, sys, urllib.request
from PIL import Image
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hd" / "maps"
BASE = "http://127.0.0.1:19100"
PROMPT = ("将这张 FC 战棋地图重绘为高清现代战棋战场：严格保持原来的格子布局、地形位置与配色"
          "（草原、森林、岩山、要塞砖墙、海面），俯视视角，细节丰富，"
          "完整填满画面、不加边框、不要文字、不要 UI、不要角色")

def edit(src, dst):
    raw = base64.b64encode(pathlib.Path(src).read_bytes()).decode()
    payload = {"prompt": PROMPT, "image": raw, "steps": 26}
    req = urllib.request.Request(BASE + "/m/qwen-image-edit/edit",
        data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.loads(r.read())
    tmp = dst.with_suffix(".raw.png")
    tmp.write_bytes(base64.b64decode(data["images"][0]))
    src_im = Image.open(src); out = Image.open(tmp).convert("RGB")
    sw, sh = src_im.size
    target = sw / sh
    w, h = out.size
    if abs((w / h) - target) > 0.02:
        if w / h > target:
            nw = int(h * target); left = (w - nw) // 2
            out = out.crop((left, 0, left + nw, h))
        else:
            nh = int(w / target); top = (h - nh) // 2
            out = out.crop((0, top, w, top + nh))
    out.save(dst, quality=92)
    tmp.unlink(missing_ok=True)
    print("saved", dst.name, out.size)

if __name__ == "__main__":
    OUT.mkdir(parents=True, exist_ok=True)
    chapters = sys.argv[1:] or [f"{i:02d}" for i in range(1, 27)]
    for c in chapters:
        src = ROOT / "assets" / "extracted" / "maps" / f"official-{c}.png"
        dst = OUT / f"s{c}.png"
        if dst.exists():
            continue
        edit(src, dst)
