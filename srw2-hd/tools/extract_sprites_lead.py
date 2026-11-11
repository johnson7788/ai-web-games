#!/usr/bin/env python3
"""从官方地图 + CHR 提取每台机体的 16×16 原版图标（Lead 版）。

- 官方地图在每个单位格画了 16×16 机体 sprite（4 个 8×8 CHR tile + 黑底）；
- 用 chrlib 的偏移容忍匹配取 tile id，按 2bpp 索引还原透明与调色板；
- 用 Scale2x 放大 4 次（16→256），保留像素风、平滑斜边；
- 按 data/unit-sprite-map.json 去重到 sprite key，输出 assets/hd/units-gen/。

用法：
  python3 tools/extract_sprites_lead.py --report
"""
from __future__ import annotations

import argparse
import collections
import json
import pathlib
import sys

import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import chrlib  # noqa: E402
import importlib.util
spec = importlib.util.spec_from_file_location("rm", ROOT / "tools" / "rebuild_maps.py")
rm = importlib.util.module_from_spec(spec)
spec.loader.exec_module(rm)

OUT = ROOT / "assets" / "hd" / "units-gen"
DATA = ROOT / "data" / "sprites-lead.json"
SCRATCH = ROOT / "data" / "sprites-lead-16"


def scale2x(a: np.ndarray) -> np.ndarray:
    p = a
    up = np.roll(p, 1, axis=0); up[0] = p[0]
    dn = np.roll(p, -1, axis=0); dn[-1] = p[-1]
    lf = np.roll(p, 1, axis=1); lf[:, 0] = p[:, 0]
    rt = np.roll(p, -1, axis=1); rt[:, -1] = p[:, -1]
    e0 = np.where((lf == up) & (lf != dn) & (up != rt), up, p)
    e1 = np.where((up == rt) & (up != lf) & (rt != dn), rt, p)
    e2 = np.where((dn == lf) & (dn != rt) & (lf != up), lf, p)
    e3 = np.where((rt == dn) & (rt != up) & (dn != lf), dn, p)
    h, w = a.shape[:2]
    out = np.empty((h * 2, w * 2, a.shape[2]), dtype=a.dtype)
    out[0::2, 0::2] = e0; out[0::2, 1::2] = e1
    out[1::2, 0::2] = e2; out[1::2, 1::2] = e3
    return out


def upscale(a: np.ndarray, times: int = 4) -> np.ndarray:
    for _ in range(times):
        a = scale2x(a)
    return a


def extract_cell(im: Image.Image, arr: np.ndarray, x0: int, y0: int, cx: int, cy: int,
                 ids: list[int], terrain: set[int], chb: np.ndarray) -> np.ndarray | None:
    canvas = np.zeros((16, 16, 4), dtype=np.uint8)
    used = 0
    for i, tile_id in enumerate(ids):
        if tile_id in terrain or tile_id < 1000:
            continue
        used += 1
        px = x0 + cx * 16 + (i % 2) * 8
        py = y0 + cy * 16 + (i // 2) * 8
        tile = chrlib.decode_tile(chb, tile_id)
        block = arr[py:py + 8, px:px + 8]
        pal = {}
        for k in (1, 2, 3):
            mask = tile == k
            if not mask.any():
                continue
            cols = block[mask].reshape(-1, 3)
            vals, counts = np.unique(cols, axis=0, return_counts=True)
            pal[k] = vals[counts.argmax()]
        ox = (i % 2) * 8
        oy = (i // 2) * 8
        for y in range(8):
            for x in range(8):
                v = int(tile[y, x])
                if v == 0 or v not in pal:
                    continue
                c = pal[v]
                canvas[oy + y, ox + x] = [int(c[0]), int(c[1]), int(c[2]), 255]
    return canvas if used else None


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    args = ap.parse_args()
    OUT.mkdir(parents=True, exist_ok=True)
    SCRATCH.mkdir(parents=True, exist_ok=True)

    idx = chrlib.build_shape_index()
    chb = chrlib.chr_data(chrlib.load_rom())
    scenes = {s["chapter"]: s for s in rm.load_scenarios()}
    gcgx = json.loads((ROOT / "data" / "gcgx.json").read_text())
    smap = json.loads((ROOT / "data" / "unit-sprite-map.json").read_text())

    # sprite_key -> best candidate
    best: dict[str, tuple[int, str, np.ndarray, dict]] = {}
    failures = []
    for ch_num, sc in scenes.items():
        ch = f"{ch_num:02d}"
        im = Image.open(ROOT / "assets" / "extracted" / "maps" / f"official-{ch}.png").convert("RGB")
        arr = np.asarray(im)
        g = chrlib.content_box(ch, *chrlib.need_size(ch))
        x0, y0 = g["box"][0], g["box"][1]
        units = set(chrlib.unit_positions(ch))

        # 地形 tile 集合
        terrain: set[int] = set()
        for cy in range(sc["rows"]):
            for cx in range(sc["cols"]):
                if (cx, cy) in units:
                    continue
                ids = chrlib.cell_tile_ids(im, x0, y0, cx, cy, idx)
                if not ids:
                    continue
                grp = rm.group_of(ids)
                if grp in rm.GROUP_TERRAIN:
                    terrain.update(range(grp, grp + 4))

        entries = []
        for k in ("allies", "enemies", "npc"):
            for u in gcgx[ch].get(k, []):
                if u.get("x") is not None and u.get("y") is not None:
                    entries.append((u["unit"], int(u["x"]), int(u["y"])))
        for u in entries:
            name, cx, cy = u
            ids = chrlib.cell_tile_ids(im, x0, y0, cx, cy, idx)
            if not ids:
                failures.append((ch, name, cx, cy, "no chr match"))
                continue
            canvas = extract_cell(im, arr, x0, y0, cx, cy, ids, terrain, chb)
            if canvas is None:
                failures.append((ch, name, cx, cy, "no sprite tiles"))
                continue
            info = smap.get(name)
            if not info:
                # 名称规范化后再试
                for jp, meta in smap.items():
                    if jp.replace("Ｚ", "Z") == name.replace("Ｚ", "Z"):
                        info = meta; break
            if not info:
                failures.append((ch, name, cx, cy, "no sprite map"))
                continue
            key = info["sprite"]
            # 质量分：非透明像素数 + 优先较早章节
            score = int((canvas[:, :, 3] > 0).sum()) * 1000 - ch_num
            if key not in best or score > best[key][0]:
                best[key] = (score, name, canvas, {"chapter": ch, "x": cx, "y": cy})

    manifest = {}
    sheet_items = []
    for key, (score, name, canvas, where) in sorted(best.items()):
        small = Image.fromarray(canvas, "RGBA")
        small.save(SCRATCH / f"{key}.png")
        big = Image.fromarray(upscale(canvas, 4), "RGBA")
        big.save(OUT / f"{key}@16x.png")
        big.save(OUT / f"{key}.png")
        manifest[key] = {"unit": name, "file": str(OUT / f"{key}.png"),
                         "file16": str(SCRATCH / f"{key}.png"),
                         "w": 256, "h": 256, "source": where}
        sheet_items.append((key, small, big))

    DATA.write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    # 联系表
    cell = (140, 160)
    cols = 8
    rows = (len(sheet_items) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * cell[0], max(1, rows) * cell[1]), (18, 20, 28))
    d = ImageDraw.Draw(sheet)
    for i, (key, small, big) in enumerate(sheet_items):
        x = (i % cols) * cell[0]; y = (i // cols) * cell[1]
        sheet.paste(big.convert("RGB").resize((128, 128), Image.NEAREST), (x + 6, y + 24))
        d.text((x + 6, y + 6), key, fill=(255, 220, 140))
    sheet.save(OUT / "_sheet.png")

    print(f"sprites: {len(manifest)}  failures: {len(failures)}")
    if args.report:
        for key, m in sorted(manifest.items()):
            print(f"  {key:<12} {m['unit']:<20} {m['source']}")
        for f in failures[:30]:
            print("  FAIL", f)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
