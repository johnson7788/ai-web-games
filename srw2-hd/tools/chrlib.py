#!/usr/bin/env python3
"""共享 CHR 工具：把官方地图的 8×8 像素块匹配回 ROM 的 CHR tile。

原理：官方地图是游戏 nametable 的原生渲染（8px = 1 个 CHR tile，16px = 1 个地图格）。
把每个 8×8 块的颜色**按首次出现顺序**归一化成 0..3 的符号（等价于忽略调色板），
再和 CHR 的 2bpp 图块做同样归一化，就能精确匹配到 tile id。

只读工具，供 extract_maps_chr.py / extract_sprites_chr.py 共用。
"""
from __future__ import annotations

import pathlib
import subprocess

import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
DEFAULT_ROM = pathlib.Path("/Users/admin/Documents/Game/fc第二次机器人大战/第二次机器人大战.nes")
MAPS = ROOT / "assets" / "extracted" / "maps"


def load_rom(path: pathlib.Path | str = DEFAULT_ROM) -> np.ndarray:
    return np.fromfile(str(path), dtype=np.uint8)


def prg_size(rom: np.ndarray) -> int:
    return 16384 * int(rom[4])


def chr_data(rom: np.ndarray) -> np.ndarray:
    return rom[16 + prg_size(rom):]


def canon(arr: np.ndarray) -> np.ndarray:
    """把颜色/索引值按首次出现顺序重编号，消除调色板差异。"""
    mapping: dict[int, int] = {}
    out = np.empty(arr.shape, dtype=np.int16)
    for y in range(arr.shape[0]):
        for x in range(arr.shape[1]):
            v = int(arr[y, x])
            if v not in mapping:
                mapping[v] = len(mapping)
            out[y, x] = mapping[v]
    return out


def decode_tile(chr_bytes: np.ndarray, tile_index: int) -> np.ndarray:
    """解码 1 个 8×8 2bpp 图块为 0..3 索引。"""
    off = tile_index * 16
    a = np.empty((8, 8), dtype=np.uint8)
    for y in range(8):
        lo = int(chr_bytes[off + y])
        hi = int(chr_bytes[off + y + 8])
        for x in range(8):
            a[y, x] = ((lo >> (7 - x)) & 1) | (((hi >> (7 - x)) & 1) << 1)
    return a


def build_shape_index(chr_bytes: np.ndarray | None = None) -> dict[bytes, list[int]]:
    rom = load_rom()
    data = chr_data(rom) if chr_bytes is None else chr_bytes
    index: dict[bytes, list[int]] = {}
    for i in range(len(data) // 16):
        key = canon(decode_tile(data, i)).tobytes()
        index.setdefault(key, []).append(i)
    return index


def _as_packed(img) -> np.ndarray:
    """缓存到图片对象上，避免用 id() 做 key 时对象回收导致的串图。"""
    arr = getattr(img, "_chr_packed", None)
    if arr is None:
        a = np.asarray(img.convert("RGB"), dtype=np.uint32)
        arr = (a[:, :, 0] << 16) | (a[:, :, 1] << 8) | a[:, :, 2]
        try:
            img._chr_packed = arr
        except Exception:
            pass
    return arr


def _block_sig(packed: np.ndarray) -> bytes:
    """8×8 块 → 按首次出现顺序重编号的形状签名（忽略调色板）。"""
    vals, first, inv = np.unique(packed, return_inverse=True, return_index=True)
    order = np.argsort(first)
    rank = np.empty(len(order), dtype=np.int16)
    rank[order] = np.arange(len(order), dtype=np.int16)
    return rank[inv].reshape(8, 8).tobytes()


def _cell_ids_at(arr: np.ndarray, x0: int, y0: int, cx: int, cy: int,
                 dx: int, dy: int, shape_index: dict[bytes, list[int]]) -> list[int] | None:
    ids: list[int] = []
    h, w = arr.shape
    for by in range(2):
        for bx in range(2):
            px = x0 + cx * 16 + bx * 8 + dx
            py = y0 + cy * 16 + by * 8 + dy
            if px < 0 or py < 0 or px + 8 > w or py + 8 > h:
                return None
            matches = shape_index.get(_block_sig(arr[py:py + 8, px:px + 8]))
            if not matches:
                return None
            ids.append(matches[0])
    return ids


def cell_tile_ids(img, x0: int, y0: int, cx: int, cy: int,
                  shape_index: dict[bytes, list[int]], search: int = 1) -> list[int] | None:
    """返回一个 16×16 地图格的 4 个 CHR tile id（顺序：左上/右上/左下/右下）。

    官方拼接图可能有 1px 的错位/缩放漂移：先试 (0,0)，再按距离搜索 ±search 像素
    （4 个块必须共享同一偏移，避免块间错位）。
    """
    arr = _as_packed(img)
    offsets = [(0, 0)]
    for r in range(1, max(1, search) + 1):
        ring = [(dx, dy) for dy in range(-r, r + 1) for dx in range(-r, r + 1)
                if max(abs(dx), abs(dy)) == r]
        ring.sort(key=lambda p: (abs(p[0]) + abs(p[1]), p[1], p[0]))
        offsets += ring
    for dx, dy in offsets:
        ids = _cell_ids_at(arr, x0, y0, cx, cy, dx, dy, shape_index)
        if ids:
            return ids
    return None


def content_box(chapter: str, need_cols: int = 0, need_rows: int = 0) -> dict:
    """复用 tools/terrain.py 的内容框/尺寸计算（避免两套逻辑）。

    need_cols/need_rows：该话必须容纳的格数（来自官方坐标）。内容框判小了会退回整张图。
    """
    import sys
    sys.path.insert(0, str(ROOT / "tools"))
    import terrain  # noqa: E402
    return terrain.grid_for(chapter, need_cols, need_rows)


def need_size(chapter: str) -> tuple[int, int]:
    """该话所有官方坐标需要的 (cols, rows)。"""
    d = load_gcgx()[chapter]
    xs, ys = [0], [0]
    for k in ("allies", "enemies", "npc"):
        for u in d.get(k, []):
            if u.get("x") is not None and u.get("y") is not None:
                xs.append(int(u["x"])); ys.append(int(u["y"]))
    for r in d.get("reinforcements", []):
        for u in r.get("units", []):
            if u.get("x") is not None and u.get("y") is not None:
                xs.append(int(u["x"])); ys.append(int(u["y"]))
    return max(xs) + 1, max(ys) + 1


def load_gcgx() -> dict:
    import json
    return json.loads((ROOT / "data" / "gcgx.json").read_text())


def unit_positions(chapter: str) -> list[tuple[int, int]]:
    """该话所有官方单位坐标（含增援/NPC），用于掩膜/立绘定位。"""
    d = load_gcgx()[chapter]
    out: list[tuple[int, int]] = []
    for k in ("allies", "enemies", "npc"):
        for u in d.get(k, []):
            if u.get("x") is not None and u.get("y") is not None:
                out.append((int(u["x"]), int(u["y"])))
    for r in d.get("reinforcements", []):
        for u in r.get("units", []):
            if u.get("x") is not None and u.get("y") is not None:
                out.append((int(u["x"]), int(u["y"])))
    return list(dict.fromkeys(out))
