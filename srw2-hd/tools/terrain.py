#!/usr/bin/env python3
"""地形分类：把官方地图（16px/格）逐格归类成地形字符。

分类是**按关卡类型**（地上 / 宇宙 / 基地）分别写的颜色规则：
原作三种地形集（平地/森/山/海/町/基地/外枠 …、宇宙/陨石/月面 …、
通路/床/壁 …）的图块配色差别很大，用同一套阈值必然出错。

另外做了两件保证一致性的事：
1. 先算出图片的「地图内容框」（去掉四周 8px 装饰边框），再按 16px 取格，
   保证格子和底图严格对齐；
2. 同一张图里像素完全相同的格子只判定一次（同图同貌必然同地形）。

用法：
    python3 tools/terrain.py --preview out_dir   # 生成叠加预览图，人工校对
"""
from __future__ import annotations

import json
import pathlib
import sys

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
MAPS = ROOT / "assets" / "extracted" / "maps"

# 装饰边框颜色（大地图四周 8px 的白色/灰色框）
FRAME_COLORS = {(255, 255, 255), (192, 192, 192), (128, 128, 128), (0, 0, 0)}

CHARS = {
    "plain": ".", "bush": ",", "rough": "~", "forest": "f", "mountain": "m",
    "sea": "w", "rock": "o", "desert": "d", "town": "c", "base": "B",
    "tank": "T", "wall": "#",
}

# 地形集：基地/要塞内景、宇宙/月面、其余按地上处理
BASE_STAGES = {"07", "15", "18", "21", "26"}
SPACE_STAGES = {"14", "16", "17", "19", "20", "22"}


def stage_type(ch: str) -> str:
    if ch in BASE_STAGES:
        return "base"
    if ch in SPACE_STAGES:
        return "space"
    return "ground"


def frame_is_map_like(im: Image.Image, idx: int, axis: str) -> bool:
    """该行/列是否包含非「边框色」像素（即地图内容）。"""
    arr = np.asarray(im)
    line = arr[:, idx, :] if axis == "x" else arr[idx, :, :]
    packed = (line[:, 0].astype(np.int32) << 16) | (line[:, 1].astype(np.int32) << 8) | line[:, 2]
    allow = np.array([(r << 16) | (g << 8) | b for r, g, b in FRAME_COLORS], dtype=np.int32)
    return bool(np.any(~np.isin(packed, allow)))


def content_box(im: Image.Image) -> tuple[int, int, int, int]:
    w, h = im.size
    x0, y0, x1, y1 = 0, 0, w - 1, h - 1
    while x0 < w and not frame_is_map_like(im, x0, "x"):
        x0 += 1
    while x1 >= 0 and not frame_is_map_like(im, x1, "x"):
        x1 -= 1
    while y0 < h and not frame_is_map_like(im, y0, "y"):
        y0 += 1
    while y1 >= 0 and not frame_is_map_like(im, y1, "y"):
        y1 -= 1
    return x0, y0, x1, y1


def grid_for(ch: str, need_cols: int = 0, need_rows: int = 0) -> dict:
    im = Image.open(MAPS / f"official-{ch}.png").convert("RGB")
    w, h = im.size
    x0, y0, x1, y1 = content_box(im)
    cw, chh = x1 - x0 + 1, y1 - y0 + 1
    cols, rows = round(cw / 16), round(chh / 16)
    # 地图必须容纳所有官方坐标：内容框判小了就退回整张图
    if cols < need_cols or rows < need_rows:
        x0, y0, cw, chh = 0, 0, w, h
        cols, rows = round(w / 16), round(h / 16)
    return {"cols": cols, "rows": rows, "box": [x0, y0, cw, chh],
            "image": {"width": w, "height": h}}


def features(cell: np.ndarray) -> dict:
    r = cell[:, :, 0].astype(np.int16)
    g = cell[:, :, 1].astype(np.int16)
    b = cell[:, :, 2].astype(np.int16)
    n = r.size
    lum = 0.299 * r + 0.587 * g + 0.114 * b
    return {
        "black": np.mean(lum < 28),
        "white": np.mean((r > 225) & (g > 225) & (b > 225)),
        "gray": np.mean((np.abs(r - g) < 26) & (np.abs(g - b) < 26) & (lum > 90) & (lum < 225)),
        "green": np.mean((g > 110) & (g > r + 40) & (g > b + 50)),
        "liteg": np.mean((g > 175) & (g > r + 40) & (g > b + 50)),
        "blue": np.mean((b > 90) & (b > r + 40) & (b > g + 20)),
        "cyan": np.mean((b > 110) & (g > 110) & (b > r + 30) & (g > r + 30)),
        "orange": np.mean((r > 130) & (g > 45) & (g < 195) & (b < 90) & (r > b + 70)),
        "yellow": np.mean((r > 165) & (g > 145) & (b < 165) & (r > b + 40)),
        "purple": np.mean((b > 90) & (r > 55) & (b > g + 45) & (r > g + 15)),
        "olive": np.mean((r > 90) & (g > 80) & (b < 90) & (np.abs(r - g) < 55)),
        "std": float(np.std(lum)),
        "n": n,
    }


def classify(f: dict, stage: str) -> str:
    black = f["black"]
    gray = f["gray"] + f["white"]
    if stage == "base":
        # 基地内景：紫色格纹是地板（可走），灰白砖墙/结构是墙
        if black > 0.62:
            return "wall"
        if f["purple"] > 0.18:
            return "base"
        if gray > 0.32:
            return "wall"
        if f["orange"] > 0.32:
            return "mountain"
        return "base"
    if stage == "space":
        if black > 0.45 and f["blue"] < 0.20:
            return "plain"          # 宇宙空间
        if f["blue"] > 0.30 or f["cyan"] > 0.30:
            return "plain"          # 宇宙 / 星云
        if f["olive"] > 0.22 and f["orange"] < 0.25:
            return "plain"          # 月面
        if f["orange"] > 0.24:
            return "mountain"       # 岩山 / 陨石
        if gray > 0.42:
            return "town"           # 殖民地 / 要塞
        if gray > 0.22:
            return "rock"
        return "plain"
    # ground
    if f["purple"] > 0.30:
        return "wall"
    if black > 0.55:
        return "wall"
    if f["blue"] > 0.24:
        return "sea"
    if f["yellow"] > 0.30 and f["green"] < 0.35:
        return "desert"
    if f["orange"] > 0.22:
        return "mountain"
    if gray > 0.40:
        return "town"
    if f["liteg"] > 0.12 and black > 0.10:
        return "forest"
    if f["green"] > 0.25:
        return "plain"
    if gray > 0.25:
        return "town"
    return "plain"


def build_map(ch: str, need_cols: int = 0, need_rows: int = 0,
              mask_cells=None) -> dict:
    """mask_cells: {(x,y)} 已知站了机体的格子——官方图里机体 sprite 会盖住地形，
    这些格子先标记为未知，再从周围 8 格多数投票补回。"""
    im = Image.open(MAPS / f"official-{ch}.png").convert("RGB")
    grid = grid_for(ch, need_cols, need_rows)
    x0, y0, cw, chh = grid["box"]
    stage = stage_type(ch)
    cols, nrows = grid["cols"], grid["rows"]
    cells: list[list[str | None]] = []
    cache = {}
    for cy in range(nrows):
        row = []
        for cx in range(cols):
            cell = np.asarray(im.crop((x0 + cx * 16, y0 + cy * 16,
                                       x0 + min(cx * 16 + 16, cw + x0),
                                       y0 + min(cy * 16 + 16, chh + y0))))
            sig = cell.tobytes()
            key = hash(sig)
            if key not in cache:
                cache[key] = classify(features(cell), stage)
            row.append(cache[key])
        cells.append(row)

    # 1) 站了机体的格子 = 未知
    for (x, y) in (mask_cells or ()):
        if 0 <= x < cols and 0 <= y < nrows:
            cells[y][x] = None
    # 2) 地上/宇宙图不应该有内部墙（外框已裁掉）：黑块多半是文字/图标/机体
    if stage != "base":
        for y in range(nrows):
            for x in range(cols):
                if cells[y][x] == "wall" and 0 < x < cols - 1 and 0 < y < nrows - 1:
                    cells[y][x] = None

    # 3) 多轮邻域多数投票补全
    for _ in range(max(cols, nrows)):
        changed = 0
        for y in range(nrows):
            for x in range(cols):
                if cells[y][x] is not None:
                    continue
                votes = {}
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        nx, ny = x + dx, y + dy
                        if 0 <= nx < cols and 0 <= ny < nrows and cells[ny][nx]:
                            votes[cells[ny][nx]] = votes.get(cells[ny][nx], 0) + 1
                if votes:
                    # 机体站过的格子必须是可通行地形：只要邻格有非墙地形就不选墙
                    passable = {k: v for k, v in votes.items() if k != "wall"}
                    pool = passable or votes
                    cells[y][x] = max(pool.items(), key=lambda kv: kv[1])[0]
                    changed += 1
        if not changed:
            break
    default_terrain = "base" if stage == "base" else "plain"
    rows = ["".join(CHARS[c or default_terrain] for c in row) for row in cells]
    return {"map": rows, "cols": cols, "rows": nrows,
            "box": grid["box"], "stage": stage, "image": grid["image"]}


# ---------------------------------------------------------------- 预览

COLORS = {
    "plain": (80, 200, 80), "bush": (40, 150, 60), "rough": (170, 140, 90),
    "forest": (0, 110, 40), "mountain": (240, 140, 30), "sea": (40, 90, 240),
    "rock": (150, 150, 160), "desert": (240, 220, 90), "town": (230, 230, 240),
    "base": (200, 200, 210), "tank": (160, 40, 160), "wall": (120, 0, 0),
}


def load_need() -> dict:
    p = ROOT / "data" / "gcgx.json"
    if not p.exists():
        return {}
    data = json.loads(p.read_text())
    out = {}
    for ch, v in data.items():
        xs, ys = [0], [0]
        for k in ("allies", "enemies", "npc"):
            for u in v.get(k, []):
                if u.get("x") is not None and u.get("y") is not None:
                    xs.append(u["x"]); ys.append(u["y"])
        for r in v.get("reinforcements", []):
            for u in r.get("units", []):
                if u.get("x") is not None and u.get("y") is not None:
                    xs.append(u["x"]); ys.append(u["y"])
        out[ch] = (max(xs) + 1, max(ys) + 1)
    return out


NEED = load_need()


def preview(chs, outdir: pathlib.Path):
    outdir.mkdir(parents=True, exist_ok=True)
    for ch in chs:
        nc, nr = NEED.get(ch, (0, 0))
        data = build_map(ch, nc, nr)
        im = Image.open(MAPS / f"official-{ch}.png").convert("RGBA")
        x0, y0, cw, chh = data["box"]
        overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
        dr = __import__("PIL.ImageDraw", fromlist=["ImageDraw"]).Draw(overlay)
        for cy, row in enumerate(data["map"]):
            for cx, c in enumerate(row):
                name = [k for k, v in CHARS.items() if v == c][0]
                color = COLORS[name] + (120,)
                x = x0 + cx * 16
                y = y0 + cy * 16
                dr.rectangle([x, y, x + 15, y + 15], fill=color)
        out = Image.alpha_composite(im, overlay).convert("RGB")
        out = out.resize((out.width * 2, out.height * 2), Image.NEAREST)
        out.save(outdir / f"terrain-{ch}.png")
        print(ch, data["stage"], data["cols"], "x", data["rows"])


def main() -> int:
    args = sys.argv[1:]
    if args and args[0] == "--preview":
        outdir = pathlib.Path(args[1]) if len(args) > 1 else pathlib.Path("/tmp/srw2-terrain")
        chs = [f"{i:02d}" for i in range(1, 27)]
        preview(chs, outdir)
        print("wrote", outdir)
        return 0
    # 否则输出 JSON 到 stdout（给 build_scenarios.py 用）
    out = {}
    for i in range(1, 27):
        ch = f"{i:02d}"
        nc, nr = NEED.get(ch, (0, 0))
        out[ch] = build_map(ch, nc, nr)
    json.dump(out, sys.stdout, ensure_ascii=False)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
