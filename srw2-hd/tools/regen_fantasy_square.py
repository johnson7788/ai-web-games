#!/usr/bin/env python3
"""重生成被画成六边形/多格的地形，强制“单块正方形 tile”。"""
from __future__ import annotations
import base64, json, pathlib, sys, time
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_all_sprites as G

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hd" / "fantasy-tiles"
RAW = ROOT / "assets" / "hd" / "fantasy-raw"
PREFIX = ("单块正方形地形素材：一整块连续的{terrain}，从正上方俯视，铺满整个正方形画面，"
          "四个边都是地形，画面里不要出现多个格子、不要六边形、不要蜂窝网格、不要棋盘格、不要边框；"
          "手绘奇幻风格，厚涂笔触，丰富细节，鲜艳明亮的色彩，游戏地形 tile，正方形构图。")
NEG = ("六边形, 蜂窝, 棋盘格, 多个格子, 网格线, 边框, 等距, 斜45度, 人物, 机器人, 像素风, 低清, 模糊, 文字, UI, 建筑, 庭院")

TILES = {
 "desert": "金色沙丘与风纹沙地",
 "water": "清澈的蓝色海水，浪花与波纹",
 "space": "深空星云与星尘，蓝紫色",
 "moon": "灰白色月面与细小环形山",
 "wall": "厚重石砌城墙顶部，砖缝、苔藓与箭垛",
}

def one(key):
    prompt = PREFIX.format(terrain=TILES[key])
    data = None
    for i in range(3):
        try:
            data = G.post("/m/qwen-image/txt2img", {
                "prompt": prompt, "negative_prompt": NEG,
                "width": 1024, "height": 1024, "steps": 26,
                "params": {"guidance_scale": 4.5},
            })
            break
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] {key} {i+1}: {exc}", flush=True); time.sleep(4)
    if not data: print("skip", key); return
    raw = RAW / f"{key}.png"; raw.write_bytes(base64.b64decode(data["images"][0]))
    im = Image.open(raw).convert("RGB"); w,h = im.size; m=int(min(w,h)*0.05)
    im = im.crop((m,m,w-m,h-m)).resize((512,512), Image.LANCZOS)
    im.save(OUT / f"{key}.webp", "WEBP", quality=92, method=6)
    print(key, "ok", flush=True)

if __name__ == "__main__":
    for k in (sys.argv[1:] or list(TILES)): one(k)
