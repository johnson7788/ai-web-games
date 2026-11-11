#!/usr/bin/env python3
"""从现有 HD 地图中移除烘焙的单位（蓝色人物），输出 maps-clean/sNN.webp。

做法：对每个单位格，从附近同地形、3×3 内无单位的格子复制一块 HD 地形补上，
羽化边缘；最后整体 2× LANCZOS + 轻锐化，提高清晰度。
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import chrlib  # noqa: E402

SCEN = json.loads(subprocess.check_output([
    "node", "-e",
    "import('./config/scenarios.js').then(m=>console.log(JSON.stringify(m.SCENARIOS.map(s=>({ch:s.chapter,bg:s.bg,cols:s.cols,rows:s.rows})))))"
], cwd=ROOT).decode())
OUT = ROOT / "assets" / "hd" / "maps-clean"


def main() -> int:
    final = json.loads((ROOT / "data" / "maps-final.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    for sc in SCEN:
        ch = f"{int(sc['ch']):02d}"; bg = sc["bg"]
        src = ROOT / "assets" / "hd" / "maps" / f"s{ch}.webp"
        if not src.exists() or not bg:
            continue
        hd = Image.open(src).convert("RGB")
        ox = bg["x"] / bg["imgW"] * hd.width
        oy = bg["y"] / bg["imgH"] * hd.height
        cw = bg["w"] / bg["imgW"] * hd.width / sc["cols"]
        chh = bg["h"] / bg["imgH"] * hd.height / sc["rows"]
        units = set(chrlib.unit_positions(ch))
        info = final[ch]
        grid = info["grid"]; groups = info.get("groupsGrid") or []
        clean = hd.copy()

        def cell_box(cx, cy, pad=0):
            return (round(ox + cx * cw - pad), round(oy + cy * chh - pad),
                    round(ox + (cx + 1) * cw + pad), round(oy + (cy + 1) * chh + pad))

        def block3(cx, cy):
            # 单位及其黑色阴影可能溢出 1 格，整块 3×3 替换
            x0 = max(0, cx - 1); y0 = max(0, cy - 1)
            x1 = min(sc["cols"], cx + 2); y1 = min(sc["rows"], cy + 2)
            return (round(ox + x0 * cw), round(oy + y0 * chh),
                    round(ox + x1 * cw), round(oy + y1 * chh))

        for ux, uy in sorted(units):
            if not (0 <= ux < sc["cols"] and 0 <= uy < sc["rows"]):
                continue
            key = grid[uy][ux]
            # 找附近同地形、3×3 无单位的 donor
            best = None; best_d = 99
            for dy in range(-5, 6):
                for dx in range(-5, 6):
                    nx, ny = ux + dx, uy + dy
                    if dx == 0 and dy == 0: continue
                    if not (1 <= nx < sc["cols"] - 1 and 1 <= ny < sc["rows"] - 1): continue
                    if (nx, ny) in units: continue
                    if grid[ny][nx] != key: continue
                    if any((nx + ax, ny + ay) in units for ax in (-1, 0, 1) for ay in (-1, 0, 1)): continue
                    d = max(abs(dx), abs(dy))
                    if d < best_d:
                        best_d = d; best = (nx, ny)
                if best: break
            if not best:
                best = (max(1, ux - 1), uy)
            dx, dy = best
            src_box = cell_box(dx, dy, pad=1)
            dst_box = cell_box(ux, uy, pad=1)
            patch = hd.crop(src_box)
            # 羽化 mask：中心不透明，边缘 4px 渐隐
            w, h = patch.size
            mask = Image.new("L", (w, h), 0)
            md = ImageDraw.Draw(mask)
            md.rounded_rectangle([0, 0, w - 1, h - 1], radius=max(2, min(w, h) // 8), fill=255)
            mask = mask.filter(ImageFilter.GaussianBlur(2.5))
            clean.paste(patch, (dst_box[0], dst_box[1]), mask)

        # 2× 放大 + 轻锐化，显示更清晰
        big = clean.resize((clean.width * 2, clean.height * 2), Image.LANCZOS)
        big = big.filter(ImageFilter.UnsharpMask(radius=1.3, percent=65, threshold=2))
        big.save(OUT / f"s{ch}.webp", "WEBP", quality=90, method=6)
        print(ch, hd.size, "->", big.size)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
