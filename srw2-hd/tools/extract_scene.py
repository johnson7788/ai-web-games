#!/usr/bin/env python3
"""从模拟器截帧里裁出角色立绘 / 地图 / 地形图块，并输出高清预览。

素材来源：用 Playwright 驱动 FCEUmm 跑原版 ROM，在 256x224 原生分辨率下截帧。
输出：assets/extracted/
  portraits/*.png        NPC 立绘（38x42 原尺寸 + 8x 预览）
  scene/scenario01-map.png   第1话战场全图（256x184）
  tiles/terrain.png     地形图块（16x16，4x 预览）
"""
from __future__ import annotations

import pathlib
import shutil

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = pathlib.Path("/tmp/srw2_emu")
OUT = ROOT / "assets" / "extracted"

PORTRAIT_BOX = (11, 164, 49, 206)   # 立绘框（含边框）
MAP_BOX = (0, 0, 256, 184)          # 战场区域


def ensure(*parts):
    p = OUT.joinpath(*parts)
    p.mkdir(parents=True, exist_ok=True)
    return p


def upscale(img: Image.Image, factor: int) -> Image.Image:
    return img.resize((img.width * factor, img.height * factor), Image.NEAREST)


def main() -> None:
    pdir = ensure("portraits")
    sdir = ensure("scene")
    tdir = ensure("tiles")

    # 立绘：乔(布莱特) / 由美(沙耶加) / 大卫(阿姆罗)
    names = {"a04": "jo-bright", "a08": "yumi-sayaka", "a24": "dawei-amuro"}
    sheet = Image.new("RGB", (len(names) * 46 * 6, 42 * 6), (8, 10, 16))
    for i, (frame, name) in enumerate(names.items()):
        im = Image.open(SRC / f"{frame}.png").convert("RGB")
        crop = im.crop(PORTRAIT_BOX)
        crop.save(pdir / f"{name}.png")
        upscale(crop, 8).save(pdir / f"{name}@8x.png")
        sheet.paste(upscale(crop, 6), (i * 46 * 6, 0))
    sheet.save(pdir / "portraits-sheet.png")
    print("portraits:", len(names))

    # 地图全图
    im = Image.open(SRC / "b_map.png").convert("RGB")
    scene = im.crop(MAP_BOX)
    scene.save(sdir / "scenario01-map.png")
    upscale(scene, 3).save(sdir / "scenario01-map@3x.png")
    print("scene:", scene.size)

    # 地形图块：在 16px 网格上取样（平原 / 山 / 城市 / 森林 / 海 / 道路）
    samples = {
        "plain": (32, 32),
        "mountain": (112, 16),
        "city": (208, 16),
        "forest": (96, 128),
        "water": (160, 96),
        "road": (16, 64)
    }
    tiles = Image.new("RGB", (len(samples) * 16 * 6, 16 * 6), (8, 10, 16))
    for i, (name, (x, y)) in enumerate(samples.items()):
        tile = im.crop((x, y, x + 16, y + 16))
        tile.save(tdir / f"terrain-{name}.png")
        tiles.paste(upscale(tile, 6), (i * 16 * 6, 0))
    tiles.save(tdir / "terrain-sheet.png")
    print("tiles:", len(samples))

    # 原始全帧，留作对照
    shutil.copy(SRC / "b_map.png", sdir / "raw-battle-frame.png")
    shutil.copy(SRC / "00_title.png", sdir / "raw-title-frame.png")


if __name__ == "__main__":
    main()
