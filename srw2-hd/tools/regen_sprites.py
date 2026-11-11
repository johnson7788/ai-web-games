#!/usr/bin/env python3
"""定点重生成不满意的 AI 立绘（战舰 / 炮台 / 镜面 / 导弹）。

用法：
  python3 tools/regen_sprites.py --keys argama neelagama racalium midia tros --kind ship
  python3 tools/regen_sprites.py --keys turret mirror missile --kind prop
"""
from __future__ import annotations

import argparse
import base64
import json
import pathlib
import sys

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_all_sprites as G  # noqa: E402

SHIP = ("科幻宇宙战舰，{colors}舰体，舰桥、弹射甲板与推进器，正面略微俯视，"
        "干净赛璐璐上色，纯白背景，居中构图，无文字，无阴影，原创设计")
PROP = {
    "turret": "固定防御炮台，{colors}装甲，多管火炮与厚重基座，纯白背景，居中构图，无文字",
    "mirror": "六边形镜面反射装置，{colors}金属边框，纯白背景，居中构图，无文字",
    "missile": "流线型导弹，{colors}弹体，尾翼与弹头，纯白背景，居中构图，无文字",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keys", nargs="+", required=True)
    ap.add_argument("--kind", choices=["ship", "prop"], default="ship")
    ap.add_argument("--steps", type=int, default=24)
    args = ap.parse_args()
    plan = {x["key"]: x for x in json.loads(G.PLAN.read_text())}
    for key in args.keys:
        item = plan[key]
        colors = "、".join(dict.fromkeys([G.color_name(item["main"]), G.color_name(item["sub"]), G.color_name(item.get("accent", item["sub"]))]))
        if args.kind == "ship":
            prompt = SHIP.format(colors=colors)
        else:
            prompt = PROP[key].format(colors=colors)
        raw = G.RAW / f"{key}.png"; cut = G.CUT / f"{key}.png"
        data = None
        for attempt in range(3):
            try:
                data = G.post("/m/qwen-image/txt2img", {
                    "prompt": prompt,
                    "negative_prompt": "人形, 机器人, 机甲, 模糊, 水印, 文字, 背景, 地面, 阴影",
                    "width": 1024, "height": 1024, "steps": args.steps,
                    "params": {"guidance_scale": 4.0},
                })
                break
            except Exception as exc:  # noqa: BLE001
                body = ""
                try:
                    body = exc.read().decode(errors="replace")[:300]
                except Exception:
                    pass
                print(f"[warn] {key} attempt {attempt+1}: {exc} {body}", flush=True)
                import time; time.sleep(5)
        if not data:
            print(f"[skip] {key}", flush=True)
            continue
        raw.write_bytes(base64.b64decode(data["images"][0]))
        size = G.cutout(raw, cut)
        Image.open(cut).convert("RGBA").save(G.GAME / f"{key}.webp", "WEBP", quality=92, method=6)
        print(key, prompt[:30], size, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
