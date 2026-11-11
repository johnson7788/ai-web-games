#!/usr/bin/env python3
"""把原版 CHR 提取的机体图标接入游戏（Lead 版）。

输入：
  data/sprites-lead.json      tools/extract_sprites_lead.py 的产物
  data/sprites-lead-16/*.png  16×16 RGBA 原版图标
  assets/hd/units-gen/*@16x.png 256×256 Scale2x 放大图
输出：
  assets/hd/units-map/<key>.webp   地图层用的原版像素图标（16×16）
  config/sprites-generated.js      GENERATED_MAP / GENERATED_CUTIN

用法：python3 tools/apply_sprites.py
"""
from __future__ import annotations

import json
import pathlib

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
MAP_OUT = ROOT / "assets" / "hd" / "units-map"
CUTIN = ROOT / "assets" / "hd" / "units-gen"
SMALL = ROOT / "data" / "sprites-lead-16"
MANIFEST = ROOT / "data" / "sprites-lead.json"
GEN = ROOT / "config" / "sprites-generated.js"


def main() -> int:
    manifest = json.loads(MANIFEST.read_text())
    MAP_OUT.mkdir(parents=True, exist_ok=True)
    mapped, cutin = [], []
    for key in sorted(manifest):
        small = SMALL / f"{key}.png"
        if small.exists():
            im = Image.open(small).convert("RGBA")
            im.save(MAP_OUT / f"{key}.webp", "WEBP", quality=95, method=6)
            mapped.append(key)
        if (CUTIN / f"{key}@16x.png").exists():
            cutin.append(key)
    GEN.write_text(
        "// 由 tools/apply_sprites.py 生成：原版 CHR 提取的机体图标\n"
        f"export const GENERATED_MAP = {json.dumps(mapped, ensure_ascii=False)};\n"
        f"export const GENERATED_CUTIN = {json.dumps(cutin, ensure_ascii=False)};\n"
    )
    print(f"map icons: {len(mapped)}  cutin: {len(cutin)}")
    missing = [k for k in manifest if k not in mapped]
    if missing:
        print("no 16px:", missing)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
