#!/usr/bin/env python3
"""用 CHR tile 分组 + 人工校正表重建 26 话地形（Lead 版，独立于 agent 脚本）。

与 tools/extract_maps_chr.py 的区别：
  - 分组→地形的映射是**人工校对过的全局表**（解决橙色山被误判为沙漠等问题）；
  - 单位格优先用「地形 tile 匹配」推断，匹配不到再用四邻多数；
  - 输出 data/maps-final.json，供 tools/build_scenarios.py 优先使用。

用法：
  python3 tools/rebuild_maps.py --report
  python3 tools/rebuild_maps.py --preview /tmp/maps-final
"""
from __future__ import annotations

import argparse
import collections
import json
import pathlib
import re
import sys

from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import chrlib  # noqa: E402
import terrain  # noqa: E402

MAPS = ROOT / "assets" / "extracted" / "maps"
OUT = ROOT / "data" / "maps-final.json"

KEY_TO_CHAR = {
    "plain": ".", "bush": ",", "rough": "~", "forest": "f", "mountain": "m",
    "sea": "w", "rock": "o", "desert": "d", "town": "c", "base": "B",
    "tank": "T", "wall": "#",
}
PASSABLE = {"plain", "bush", "rough", "forest", "mountain", "sea", "rock", "desert", "town", "base"}

# 人工校对：CHR 连续 4-tile 组 → 地形（对照 /tmp/ground-groups.png 与 GCGX 地形表）
GROUP_TERRAIN = {
    # 地上
    260: "plain", 264: "plain", 280: "bush", 284: "forest", 328: "forest", 344: "bush",
    268: "rough", 272: "mountain", 464: "mountain",
    288: "desert", 332: "desert",
    276: "sea", 336: "sea", 340: "sea",
    292: "town", 296: "town", 304: "town", 312: "town", 316: "town", 364: "town",
    324: "plain",
    # 宇宙 / 月面
    388: "plain", 392: "plain", 408: "plain", 428: "plain", 432: "plain",
    396: "rough", 416: "rough", 412: "rock", 436: "rock", 420: "rock",
    440: "town", 444: "town",
    # 基地 / 要塞
    452: "base", 460: "base",
    480: "wall", 484: "wall", 488: "wall", 492: "wall",
}
CHAR_TO_KEY = {v: k for k, v in KEY_TO_CHAR.items()}


def load_scenarios() -> list[dict]:
    src = (ROOT / "config" / "scenarios.js").read_text()
    blocks = re.split(r'(?=\{\s*\n\s*id:\s*"s\d+)', src)
    out = []
    for block in blocks:
        m = re.search(r'id:\s*"(s\d+)".*?chapter:\s*(\d+).*?map:\s*\[(.*?)\],\s*cols:\s*(\d+),\s*rows:\s*(\d+)',
                      block, re.S)
        if not m:
            continue
        rows = re.findall(r'"([^"]*)"', m.group(3))
        out.append({"id": m.group(1), "chapter": int(m.group(2)), "map": rows,
                    "cols": int(m.group(4)), "rows": int(m.group(5))})
    return out


def group_of(ids: list[int]) -> int | None:
    if ids and ids[1] == ids[0] + 1 and ids[2] == ids[0] + 2 and ids[3] == ids[0] + 3 and ids[0] % 4 == 0:
        return ids[0]
    return None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--preview", default="")
    args = ap.parse_args()

    idx = chrlib.build_shape_index()
    scenes = load_scenarios()
    result = {}
    report = []

    for sc in scenes:
        ch = f"{sc['chapter']:02d}"
        im = Image.open(MAPS / f"official-{ch}.png").convert("RGB")
        g = chrlib.content_box(ch, *chrlib.need_size(ch))
        x0, y0, cw, chh = g["box"]
        cols, rows = sc["cols"], sc["rows"]
        units = set(chrlib.unit_positions(ch))
        old = sc["map"]

        ids = [[None] * cols for _ in range(rows)]
        for cy in range(rows):
            for cx in range(cols):
                ids[cy][cx] = chrlib.cell_tile_ids(im, x0, y0, cx, cy, idx)

        # 该话使用到的地形 tile 集合（高置信组）
        terrain_tiles = set()
        for cy in range(rows):
            for cx in range(cols):
                t = ids[cy][cx]
                if not t:
                    continue
                grp = group_of(t)
                if grp in GROUP_TERRAIN:
                    terrain_tiles.update(range(grp, grp + 4))

        grid: list[list[str | None]] = [[None] * cols for _ in range(rows)]
        groups_grid: list[list[int]] = [[0] * cols for _ in range(rows)]
        unknown = 0
        for cy in range(rows):
            for cx in range(cols):
                t = ids[cy][cx]
                if not t:
                    continue
                grp = group_of(t)
                if grp in GROUP_TERRAIN and (cx, cy) not in units:
                    grid[cy][cx] = GROUP_TERRAIN[grp]
                    groups_grid[cy][cx] = grp
                elif grp in GROUP_TERRAIN and (cx, cy) in units:
                    # 单位格：先按地形 tile 匹配，再回退
                    best, score = None, -1
                    for cand, terr in GROUP_TERRAIN.items():
                        s = sum(1 for k in range(4) if t[k] in terrain_tiles and t[k] == cand + k)
                        if s > score:
                            best, score = terr, s
                    if score >= 2 and best in PASSABLE:
                        grid[cy][cx] = best

        # 单位格 / 无匹配格：四邻多数
        for _ in range(max(cols, rows)):
            changed = 0
            for cy in range(rows):
                for cx in range(cols):
                    if grid[cy][cx]:
                        continue
                    votes = collections.Counter()
                    for dy in (-1, 0, 1):
                        for dx in (-1, 0, 1):
                            if dx == 0 and dy == 0:
                                continue
                            nx, ny = cx + dx, cy + dy
                            if 0 <= nx < cols and 0 <= ny < rows and grid[ny][nx]:
                                votes[grid[ny][nx]] += 1
                    if votes:
                        grid[cy][cx] = votes.most_common(1)[0][0]
                        changed += 1
            if not changed:
                break

        # 最终兜底：旧图字符
        for cy in range(rows):
            for cx in range(cols):
                if not grid[cy][cx]:
                    grid[cy][cx] = CHAR_TO_KEY.get(old[cy][cx], "plain")
                    unknown += 1

        # 单位格必须可通行
        for (cx, cy) in units:
            if 0 <= cx < cols and 0 <= cy < rows and grid[cy][cx] not in PASSABLE:
                grid[cy][cx] = "plain"

        strings = ["".join(KEY_TO_CHAR[v] for v in row) for row in grid]
        agree = sum(1 for cy in range(rows) for cx in range(cols)
                    if (cx, cy) not in units and strings[cy][cx] == old[cy][cx])
        non_unit = sum(1 for cy in range(rows) for cx in range(cols) if (cx, cy) not in units)
        result[ch] = {
            "cols": cols, "rows": rows, "stage": terrain.stage_type(ch),
            "grid": strings,
            "groupsGrid": groups_grid,
            "groups": {str(k): v for k, v in GROUP_TERRAIN.items()},
            "stats": {"cells": cols * rows, "unitCells": len(units),
                      "unknown": unknown,
                      "agreement": round(agree / max(1, non_unit), 4)},
        }
        report.append((ch, cols, rows, len(units), unknown, round(agree / max(1, non_unit), 4)))

        if args.preview:
            outdir = pathlib.Path(args.preview); outdir.mkdir(parents=True, exist_ok=True)
            base = im.copy()
            d = ImageDraw.Draw(base, "RGBA")
            for (cx, cy) in units:
                d.ellipse([x0 + cx * 16 + 4, y0 + cy * 16 + 4, x0 + cx * 16 + 11, y0 + cy * 16 + 11], fill=(255, 80, 80, 220))
            base.resize((base.width * 2, base.height * 2), Image.NEAREST).save(outdir / f"{ch}.png")

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    if args.report:
        print("ch  size   units unknown agree")
        for r in report:
            print(f"{r[0]} {r[1]:>2}x{r[2]:<2} {r[3]:>5} {r[4]:>7} {r[5]:.3f}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
