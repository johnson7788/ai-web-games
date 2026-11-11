#!/usr/bin/env python3
"""把官方地图的每一格地形（按 CHR tile 组）提取成独立 HD tile，并生成按格拼接的图集。

- 每个「连续 4-tile 组」选一个干净的代表格（跳过单位坐标），裁 16×16；
- Scale2x 放大 4 次到 256×256，保留原图布局/边缘/配色；
- 生成 config/tile-atlas.js：group→文件，以及逐话的 terrain→group 兜底（单位格用）。
"""
from __future__ import annotations

import collections
import json
import pathlib
import sys

import numpy as np
from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))
import chrlib  # noqa: E402
import rebuild_maps as rm  # noqa: E402

OUT = ROOT / "assets" / "hd" / "tiles-chr"
GEN = ROOT / "config" / "tile-atlas.js"
MANIFEST = ROOT / "data" / "tile-atlas.json"
MAPS = ROOT / "assets" / "extracted" / "maps"


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


def main() -> int:
    final = json.loads((ROOT / "data" / "maps-final.json").read_text())
    OUT.mkdir(parents=True, exist_ok=True)
    reps: dict[int, Image.Image] = {}
    source: dict[int, str] = {}
    counts = collections.Counter()
    ch_key_counts: dict[str, dict[str, collections.Counter]] = {}
    stage_key_counts: dict[str, dict[str, collections.Counter]] = {}

    for ch, info in sorted(final.items()):
        im = Image.open(MAPS / f"official-{ch}.png").convert("RGB")
        g = chrlib.content_box(ch, *chrlib.need_size(ch))
        x0, y0 = g["box"][0], g["box"][1]
        units = set(chrlib.unit_positions(ch))
        grid = info["grid"]; groups = info.get("groupsGrid") or []
        ck = ch_key_counts.setdefault(ch, collections.defaultdict(collections.Counter))
        sk = stage_key_counts.setdefault(info.get("stage", "ground"), collections.defaultdict(collections.Counter))
        for cy, row in enumerate(groups):
            for cx, grp in enumerate(row):
                if not grp or (cx, cy) in units:
                    continue
                if grp not in reps:
                    tile = im.crop((x0 + cx * 16, y0 + cy * 16, x0 + cx * 16 + 16, y0 + cy * 16 + 16)).copy()
                    # 官方格右/下带 1px 黑边：用内部像素回填，保持 16×16 布局不位移
                    a = np.asarray(tile).copy()
                    if np.mean(np.all(a[:, -1] == 0, axis=1)) > 0.8:
                        a[:, -1] = a[:, -2]
                    if np.mean(np.all(a[-1, :] == 0, axis=1)) > 0.8:
                        a[-1, :] = a[-2, :]
                    a[-1, -1] = a[-2, -2]
                    reps[grp] = Image.fromarray(a, "RGB")
                    source[grp] = f"{ch}@{cx},{cy}"
                counts[grp] += 1
                key = rm.CHAR_TO_KEY.get(grid[cy][cx], "plain")
                ck[key][grp] += 1
                sk[key][grp] += 1

    atlas = {}
    for grp, im in sorted(reps.items()):
        a = np.asarray(im.convert("RGB"))
        for _ in range(4):
            a = scale2x(a)
        big = Image.fromarray(a, "RGB")
        png = OUT / f"{grp}.png"
        webp = OUT / f"{grp}.webp"
        big.save(png)
        big.save(webp, "WEBP", quality=92, method=6)
        atlas[str(grp)] = f"assets/hd/tiles-chr/{grp}.webp"

    def pick(counter_map):
        out = {}
        for k, c in counter_map.items():
            out[k] = int(c.most_common(1)[0][0])
        return out

    fallback = {ch: pick(v) for ch, v in ch_key_counts.items()}
    stage_fb = {st: pick(v) for st, v in stage_key_counts.items()}
    GEN.write_text(
        "// 由 tools/build_tile_atlas.py 生成：官方每格地形 → HD tile 图集\n"
        f"export const TILE_ATLAS = {json.dumps(atlas, ensure_ascii=False, indent=1)};\n"
        f"export const TILE_FALLBACK = {json.dumps(fallback, ensure_ascii=False)};\n"
        f"export const TILE_STAGE_FALLBACK = {json.dumps(stage_fb, ensure_ascii=False)};\n"
    )
    MANIFEST.write_text(json.dumps({
        "groups": atlas, "counts": dict(counts), "source": source,
        "fallback": fallback, "stageFallback": stage_fb,
    }, ensure_ascii=False, indent=1))
    print(f"tiles {len(atlas)}  chapters {len(fallback)}  stages {len(stage_fb)}")
    print("missing keys per chapter:", {ch: [k for k in ("plain","forest","mountain","sea","desert","town","base","wall") if k not in v] for ch, v in fallback.items() if any(k not in v for k in ("plain","forest","mountain","sea","desert","town","base","wall"))})
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
