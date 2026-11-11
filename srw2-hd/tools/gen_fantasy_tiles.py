#!/usr/bin/env python3
"""生成手绘奇幻风格的方形战棋地形 tile（非像素风）。"""
from __future__ import annotations
import base64, json, pathlib, sys, time
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_all_sprites as G  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parents[1]
RAW = ROOT / "assets" / "hd" / "fantasy-raw"
OUT = ROOT / "assets" / "hd" / "fantasy-tiles"
RAW.mkdir(parents=True, exist_ok=True); OUT.mkdir(parents=True, exist_ok=True)

PREFIX = ("正俯视方形战棋地形贴图，铺满整个画面，无边框、无网格线、无文字、无UI、无人物，"
          "手绘奇幻风格，厚涂笔触，丰富细节，鲜艳明亮的色彩，游戏地图 tile，正方形构图，无缝拼接。")
SUFFIX = "。画面只有地形本身，不要等距视角，不要斜45度，不要六边形，不要像素风，不要低清模糊。"
NEG = ("等距, 斜45度, 六边形, 边框, 网格线, 文字, UI, 人物, 机器人, 像素风, 低清, 模糊, 照片, 3D渲染, 暗沉")

TILES = {
 "plain": "茂密的绿色草地，点缀野花、小草丛和细碎石块，明亮鲜艳",
 "forest": "茂密的奇幻森林树冠，层层叠叠的绿叶、藤蔓、苔藓与斑驳阳光，色彩浓郁",
 "mountain": "嶙峋的岩石山峰与山脊，橙褐色岩壁、绿色草坡和阴影，雄伟",
 "water": "清澈的深蓝色海水，浪花、波纹与浅滩反光，鲜艳通透",
 "desert": "金色沙丘与干裂沙地，暖黄色调，风纹与碎石",
 "town": "奇幻城镇的屋顶与石板广场，红瓦、木结构、商铺与花坛，俯视",
 "base": "奇幻要塞内部地面，深紫色石板与金属纹路、能量纹章，整洁",
 "wall": "厚重的灰色石砌城墙顶部，砖缝、苔藓与箭垛，俯视",
 "space": "深空星云与星海，蓝紫色星尘、陨石碎片与微光",
 "moon": "灰白色月面，环形山、月壤与碎石，冷色",
 "rock": "荒芜的岩石荒地，灰褐色碎石、裂缝与少量枯草",
 "rough": "起伏的灌木荒地，低矮灌木、杂草、泥土与碎石，秋季色调",
}

def one(key, prompt, attempt=0):
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
    if not data:
        print(f"[skip] {key}", flush=True); return
    raw = RAW / f"{key}.png"
    raw.write_bytes(base64.b64decode(data["images"][0]))
    im = Image.open(raw).convert("RGB")
    # 去掉生成图可能带的边缘暗角/边框
    w, h = im.size; m = int(min(w, h) * 0.045)
    im = im.crop((m, m, w - m, h - m)).resize((512, 512), Image.LANCZOS)
    im.save(OUT / f"{key}.webp", "WEBP", quality=92, method=6)
    print(f"{key} ok", flush=True)

def main():
    only = sys.argv[1:] or list(TILES)
    for key in only:
        prompt = PREFIX + TILES[key] + SUFFIX
        one(key, prompt)
    return 0

if __name__ == "__main__":
    raise SystemExit(main())
