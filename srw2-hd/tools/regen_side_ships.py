#!/usr/bin/env python3
"""重生成战舰/运输舰的侧面图（避免 AI 在舰体前加小人/机器人）。"""
from __future__ import annotations
import base64, json, pathlib, sys, time
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_all_sprites as G  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
PLAN = {x["key"]: x for x in json.loads((ROOT / "data" / "side-plan.json").read_text())}
CUT = ROOT / "assets" / "hd" / "units-side"
RAW = ROOT / "assets" / "hd" / "side-raw"

SHIPS = ["argama", "neelagama", "racalium", "midia", "tros", "whitebase"]


def main() -> int:
    for key in SHIPS:
        item = PLAN[key]
        colors = "、".join(dict.fromkeys([G.color_name(item["main"]), G.color_name(item["sub"]),
                                          G.color_name(item.get("accent", item["sub"]))]))
        prompt = (f"纯宇宙战舰，没有任何人物，没有机器人，没有驾驶员，没有小人。舰体占满画面，"
                  f"正侧面视角，舰首朝右，舰桥、弹射甲板、推进器清晰，{colors}舰体，"
                  f"日系科幻设定图，干净赛璐璐上色，纯白背景，居中构图，无文字，无阴影，原创设计")
        data = None
        for attempt in range(3):
            try:
                data = G.post("/m/qwen-image/txt2img", {
                    "prompt": prompt,
                    "negative_prompt": "人物, 人形, 机器人, 机甲, 驾驶员, 小人, 多个对象, 正面, 背面, 四分之三侧, 模糊, 水印, 文字, 背景, 地面, 阴影",
                    "width": 1024, "height": 1024, "steps": 24,
                    "params": {"guidance_scale": 4.2},
                })
                break
            except Exception as exc:  # noqa: BLE001
                print(f"[warn] {key} {attempt+1}: {exc}", flush=True)
                time.sleep(5)
        if not data:
            print(f"[skip] {key}", flush=True)
            continue
        raw = RAW / f"{key}.png"
        cut = CUT / f"{key}.png"
        raw.write_bytes(base64.b64decode(data["images"][0]))
        size = G.cutout(raw, cut)
        Image.open(cut).convert("RGBA").save(CUT / f"{key}.webp", "WEBP", quality=92, method=6)
        print(key, size, flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
