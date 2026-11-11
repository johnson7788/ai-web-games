#!/usr/bin/env python3
"""用优云 qwen-image 为全部机体生成 256px RGBA 立绘（补齐只有 12 台 HD 的缺口）。

前置：
  - GPU 网关：ssh -f -N -L 19100:127.0.0.1:9100 -p 23 root@117.50.187.176
  - 模型：curl -X POST http://127.0.0.1:19100/v1/start -d '{"name":"qwen-image"}'
  - data/sprites-plan.json（node 从 config/units.js 导出）

产物：
  assets/hd/ai-raw/<key>.png     1024 原图
  assets/hd/units-ai/<key>.png   256 RGBA 透明底
  assets/hd/units/<key>.webp     游戏实际使用（若已存在则不覆盖）
  data/ai-sprites.json           清单与状态

用法：
  python3 tools/gen_all_sprites.py --resume
  python3 tools/gen_all_sprites.py --only zeta
"""
from __future__ import annotations

import argparse
import base64
import json
import pathlib
import sys
import time
import urllib.request
from collections import deque

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
BASE = "http://127.0.0.1:19100"
PLAN = ROOT / "data" / "sprites-plan.json"
RAW = ROOT / "assets" / "hd" / "ai-raw"
CUT = ROOT / "assets" / "hd" / "units-ai"
GAME = ROOT / "assets" / "hd" / "units"
MANIFEST = ROOT / "data" / "ai-sprites.json"

STYLE = ("Q版机甲战棋单位，全身正面站立，日系机器人动画风格，干净赛璐璐上色，纯白背景，"
         "居中构图，无文字，无阴影，游戏单位立绘，原创设计，不模仿任何现有作品")

SHAPE_DESC = {
    "mech": "人形真实系机甲，修长四肢，背包与推进器",
    "bulky": "超级系机器人，厚重装甲，巨大肩甲与拳头",
    "ship": "宇宙战舰，舰桥、弹射甲板与推进器",
    "beast": "机械兽，四足站立，机械利爪与装甲尾巴",
    "boss": "大型BOSS机甲，厚重装甲，独眼与重型火炮",
    "turret": "固定炮台，多管火炮与厚重基座",
    "mirror": "六边形镜面反射装置，金属边框",
    "missile": "流线型导弹，尾翼与弹头",
}

COLORS = [
    ("白色", (240, 244, 250)), ("银色", (200, 205, 215)), ("灰色", (130, 130, 140)),
    ("黑色", (40, 42, 50)), ("红色", (200, 50, 50)), ("深红", (140, 30, 40)),
    ("橙色", (225, 140, 50)), ("黄色", (230, 200, 70)), ("金色", (200, 160, 60)),
    ("绿色", (70, 140, 80)), ("深绿", (40, 80, 50)), ("蓝色", (50, 95, 190)),
    ("浅蓝", (120, 190, 240)), ("深蓝", (35, 50, 100)), ("紫色", (120, 80, 170)),
    ("粉色", (240, 180, 200)), ("棕色", (130, 95, 60)), ("青色", (60, 140, 140)),
]


def color_name(hex_color: str) -> str:
    h = hex_color.lstrip("#")
    r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
    return min(COLORS, key=lambda c: (c[1][0] - r) ** 2 + (c[1][1] - g) ** 2 + (c[1][2] - b) ** 2)[0]


def prompt_for(item: dict) -> str:
    shape = item.get("shape", "mech")
    desc = SHAPE_DESC.get(shape, SHAPE_DESC["mech"])
    cols = "、".join(dict.fromkeys([color_name(item["main"]), color_name(item["sub"]), color_name(item.get("accent", item["sub"]))]))
    feature = "手持光束步枪" if shape == "mech" else ("双手握拳" if shape == "bulky" else "细节丰富")
    return f"{STYLE}。原创{desc}，主色{cols}，{feature}"


def post(path: str, payload: dict, timeout=600):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def cutout(src: pathlib.Path, out: pathlib.Path, max_side=256):
    im = Image.open(src).convert("RGB")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        r, g, b = px[x, y]
        if r < 238 or g < 238 or b < 238:
            continue
        seen[i] = 1
        q.append((x + 1, y)); q.append((x - 1, y)); q.append((x, y + 1)); q.append((x, y - 1))
    rgba = im.convert("RGBA")
    data = rgba.load()
    for y in range(h):
        for x in range(w):
            if seen[y * w + x]:
                data[x, y] = (0, 0, 0, 0)
    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    ratio = max_side / max(rgba.size)
    if ratio < 1:
        rgba = rgba.resize((max(1, int(rgba.width * ratio)), max(1, int(rgba.height * ratio))), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(out)
    return rgba.size


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--only", default="")
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--steps", type=int, default=24)
    args = ap.parse_args()

    plan = json.loads(PLAN.read_text())
    manifest = {}
    if MANIFEST.exists():
        manifest = json.loads(MANIFEST.read_text())
    done = 0
    for item in plan:
        key = item["key"]
        if args.only and key != args.only:
            continue
        target = GAME / f"{key}.webp"
        if args.resume and (manifest.get(key, {}).get("status") == "ok" or target.exists()):
            continue
        if args.limit and done >= args.limit:
            break
        prompt = prompt_for(item)
        raw = RAW / f"{key}.png"
        cut = CUT / f"{key}.png"
        raw.parent.mkdir(parents=True, exist_ok=True)
        t0 = time.time()
        status, err = "ok", None
        try:
            data = post("/m/qwen-image/txt2img", {
                "prompt": prompt,
                "negative_prompt": "模糊, 水印, 文字, 低质量, 多只手, 错误结构, 背景, 地面, 阴影, 写实照片",
                "width": 1024, "height": 1024, "steps": args.steps,
                "params": {"guidance_scale": 4.0},
            })
            raw.write_bytes(base64.b64decode(data["images"][0]))
            size = cutout(raw, cut)
            im = Image.open(cut).convert("RGBA")
            im.save(target, "WEBP", quality=92, method=6)
            manifest[key] = {"status": "ok", "prompt": prompt, "file": str(target),
                             "size": list(size), "seconds": round(time.time() - t0, 1)}
            done += 1
            print(f"[{done}] {key} ok {size} {manifest[key]['seconds']}s", flush=True)
        except Exception as exc:  # noqa: BLE001
            status, err = "error", str(exc)
            manifest[key] = {"status": status, "error": err, "prompt": prompt}
            print(f"[!] {key} FAILED: {err}", flush=True)
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f"done {done}, manifest {len(manifest)}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
