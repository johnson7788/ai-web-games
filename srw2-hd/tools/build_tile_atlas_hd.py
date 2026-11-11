#!/usr/bin/env python3
"""用已有 HD 地图（AI 放大版）的干净格子生成逐格 HD tile 图集。

和 build_tile_atlas.py 的区别：不从 16×16 原生格放大，而是从 assets/hd/maps/sNN.webp
的对应格子裁切（约 64×64），再缩放到 256，得到更平滑的 HD 地形；仍然跳过单位格，
所以不会把原版人物/蓝色图标烘进地图。
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import chrlib  # noqa: E402

OUT = ROOT / "assets" / "hd" / "tiles-chr"
SCEN = json.loads(subprocess.check_output([
    "node", "-e",
    "import('./config/scenarios.js').then(m=>console.log(JSON.stringify(m.SCENARIOS.map(s=>({ch:s.chapter,bg:s.bg,cols:s.cols,rows:s.rows})))))"
], cwd=ROOT).decode())


def main() -> int:
    final = json.loads((ROOT / "data" / "maps-final.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    reps: dict[int, Image.Image] = {}
    source: dict[int, str] = {}
    for sc in SCEN:
        ch = sc["ch"]; ck = f"{int(ch):02d}"; info = final[ck]
        bg = sc["bg"]
        hd_path = ROOT / "assets" / "hd" / "maps" / f"s{ch}.webp"
        if not hd_path.exists() or not bg:
            continue
        hd = Image.open(hd_path).convert("RGB")
        ox = bg["x"] / bg["imgW"] * hd.width
        oy = bg["y"] / bg["imgH"] * hd.height
        cw = bg["w"] / bg["imgW"] * hd.width / sc["cols"]
        chh = bg["h"] / bg["imgH"] * hd.height / sc["rows"]
        units = set(chrlib.unit_positions(ck))
        groups = info.get("groupsGrid") or []
        for cy, row in enumerate(groups):
            for cx, grp in enumerate(row):
                if not grp or (cx, cy) in units:
                    continue
                # 避开地图最外圈（外框）和边缘格
                if cx < 1 or cy < 1 or cx >= sc["cols"] - 1 or cy >= sc["rows"] - 1:
                    continue
                if grp in reps:
                    continue
                # 优先选离单位格最远的代表格，避免相邻单位的 AI 残影
                if units:
                    d = min(abs(cx - ux) + abs(cy - uy) for ux, uy in units)
                else:
                    d = 99
                if d < 2:
                    continue
                box = (
                    round(ox + cx * cw + 2), round(oy + cy * chh + 2),
                    round(ox + (cx + 1) * cw - 2), round(oy + (cy + 1) * chh - 2),
                )
                if box[2] - box[0] < 8 or box[3] - box[1] < 8:
                    continue
                tile = hd.crop(box).resize((256, 256), Image.LANCZOS)
                tile = tile.filter(ImageFilter.UnsharpMask(radius=1.2, percent=55, threshold=2))
                reps[grp] = tile
                source[grp] = f"{ck}@{cx},{cy}"
    for grp, im in sorted(reps.items()):
        im.save(OUT / f"{grp}.png")
        im.save(OUT / f"{grp}.webp", "WEBP", quality=92, method=6)
    print(f"HD tiles {len(reps)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
