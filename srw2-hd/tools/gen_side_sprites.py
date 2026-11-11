#!/usr/bin/env python3
"""为全部机体生成「正侧面、面向右」的战斗立绘（cut-in 用）。

- 复用 qwen-image 网关与 gen_all_sprites 的抠图/缩放函数；
- 输出 assets/hd/units-side/<key>.png（256 RGBA）与 .webp；
- 只读 data/side-plan.json；不改正面立绘。

用法：
  python3 tools/gen_side_sprites.py --only zeta
  python3 tools/gen_side_sprites.py --resume
"""
from __future__ import annotations

import argparse
import base64
import json
import pathlib
import sys
import time

from PIL import Image

sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_all_sprites as G  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
PLAN = ROOT / "data" / "side-plan.json"
RAW = ROOT / "assets" / "hd" / "side-raw"
CUT = ROOT / "assets" / "hd" / "units-side"
MANIFEST = ROOT / "data" / "side-sprites.json"

STYLE = ("Q版机甲战棋单位，正侧面视角（90度侧身），全身，面向画面右侧，战斗准备姿态，"
         "日系机器人动画风格，干净赛璐璐上色，纯白背景，居中构图，无文字，无阴影，"
         "游戏单位立绘，原创设计")

SHAPE = {
    "mech": "人形真实系机甲，侧面轮廓，肩甲与背包推进器",
    "bulky": "超级系机器人，侧面，厚重装甲与巨大拳头",
    "ship": "宇宙战舰，舰首朝右，舰桥与弹射甲板",
    "beast": "机械兽，侧面，头朝右，四足与利爪",
    "boss": "大型BOSS机甲，侧面，独眼与重型火炮",
    "turret": "固定炮台，侧面，炮口朝右",
    "mirror": "六边形镜面装置，侧面",
    "missile": "流线型导弹，侧面，弹头朝右",
    "heavy": "重装机甲，侧面，厚装甲",
}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--only", default="")
    ap.add_argument("--resume", action="store_true")
    ap.add_argument("--steps", type=int, default=24)
    args = ap.parse_args()
    plan = json.loads(PLAN.read_text())
    manifest = json.loads(MANIFEST.read_text()) if MANIFEST.exists() else {}
    CUT.mkdir(parents=True, exist_ok=True)
    done = 0
    for item in plan:
        key = item["key"]
        if args.only and key != args.only:
            continue
        target = CUT / f"{key}.webp"
        if args.resume and target.exists():
            continue
        colors = "、".join(dict.fromkeys([G.color_name(item["main"]), G.color_name(item["sub"]),
                                          G.color_name(item.get("accent", item["sub"]))]))
        desc = SHAPE.get(item.get("shape", "mech"), SHAPE["mech"])
        prompt = f"{STYLE}。原创{desc}，主色{colors}。"
        raw = RAW / f"{key}.png"
        cut = CUT / f"{key}.png"
        raw.parent.mkdir(parents=True, exist_ok=True)
        data = None
        t0 = time.time()
        for attempt in range(3):
            try:
                data = G.post("/m/qwen-image/txt2img", {
                    "prompt": prompt,
                    "negative_prompt": "正面, 背面, 四分之三侧, 两个角色, 多视角, 裁切, 模糊, 水印, 文字, 背景, 地面, 阴影",
                    "width": 1024, "height": 1024, "steps": args.steps,
                    "params": {"guidance_scale": 4.0},
                })
                break
            except Exception as exc:  # noqa: BLE001
                print(f"[warn] {key} {attempt+1}: {exc}", flush=True)
                time.sleep(5)
        if not data:
            print(f"[skip] {key}", flush=True)
            continue
        raw.write_bytes(base64.b64decode(data["images"][0]))
        size = G.cutout(raw, cut)
        Image.open(cut).convert("RGBA").save(target, "WEBP", quality=92, method=6)
        manifest[key] = {"file": str(target), "size": list(size), "seconds": round(time.time() - t0, 1),
                         "prompt": prompt, "facing": "right"}
        MANIFEST.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
        done += 1
        print(f"[{done}] {key} {size} {manifest[key]['seconds']}s", flush=True)
    print("done", done, "manifest", len(manifest), flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
