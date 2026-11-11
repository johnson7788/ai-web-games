#!/usr/bin/env python3
"""CHR-tile–based terrain extraction for all 26 chapters.

Hybrid approach:
  • For chapters where ≥90 % of cells match CHR tile signatures **and** each
    signature maps unambiguously to one terrain key → use CHR voting.
  • For the remaining chapters (sprite-overlay / base-interior cases) → fall
    back to the colour-classbased classification in tools/terrain.py.
  • Unit cells are filled from 4-neighbour majority voting, constrained to
    passable terrain.

Outputs data/maps-chr.json and (with --report) prints a summary table.
"""
from __future__ import annotations

import argparse
import json
import pathlib
import sys
from collections import Counter, defaultdict

import numpy as np
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

import chrlib  # noqa: E402
import terrain  # noqa: E402

MAPS = ROOT / "assets" / "extracted" / "maps"

CHAR_TO_KEY = {
    ".": "plain", ",": "bush", "~": "rough", "f": "forest",
    "m": "mountain", "w": "sea", "o": "rock", "d": "desert",
    "c": "town", "B": "base", "T": "tank", "#": "wall",
    "r": "plain", "b": "base",
}
KEY_TO_CHAR = {v: k for k, v in CHAR_TO_KEY.items() if k not in ("r", "b")}
PASSABLE = {"plain", "bush", "rough", "forest", "mountain", "sea", "rock",
            "desert", "town", "base"}

OVERLAY_COLORS = {
    "plain": (80, 200, 80), "bush": (40, 150, 60), "rough": (170, 140, 90),
    "forest": (0, 110, 40), "mountain": (240, 140, 30), "sea": (40, 90, 240),
    "rock": (150, 150, 160), "desert": (240, 220, 90), "town": (230, 230, 240),
    "base": (200, 200, 210), "tank": (160, 40, 160), "wall": (120, 0, 0),
}


# ── helpers ──────────────────────────────────────────────────────────────────

def load_old_scenarios() -> dict:
    """Parse config/scenarios.js with regex (no eval) → {ch: {map, cols, rows, stageType}}."""
    import re
    src = (ROOT / "config" / "scenarios.js").read_text()
    blocks = re.split(r'(?=\{[^{}]*id:\s*"s\d+)', src)
    out: dict = {}
    for block in blocks:
        ch_m = re.search(r'chapter:\s*(\d+)', block)
        map_m = re.search(r'map:\s*\[([^\]]+)\]', block)
        cols_m = re.search(r'cols:\s*(\d+)', block)
        rows_m = re.search(r'rows:\s*(\d+)', block)
        stage_m = re.search(r'stageType:\s*"(\w+)"', block)
        if not (ch_m and map_m and cols_m and rows_m and stage_m):
            continue
        ch = f"{int(ch_m.group(1)):02d}"
        rows_list = re.findall(r'"([^"]*)"', map_m.group(1))
        out[ch] = {
            "map": rows_list,
            "cols": int(cols_m.group(1)),
            "rows": int(rows_m.group(1)),
            "stageType": stage_m.group(1),
        }
    return out


def build_chr_terrain(ch: str, im: Image.Image, x0: int, y0: int,
                      cols: int, rows: int, shape_index: dict,
                      old_map: list[str], unit_pos: set[tuple[int, int]]
                      ) -> tuple[list[list[str | None]], dict[str, str], dict]:
    """Try to assign terrain via CHR 4-tile signatures.

    Returns (grid, groups, stats) where grid[y][x] is a terrain key or None.
    """
    sig_votes: dict[str, Counter] = defaultdict(Counter)
    cell_sigs: dict[tuple[int, int], str] = {}
    chr_ok = 0

    for cy in range(rows):
        for cx in range(cols):
            ids = chrlib.cell_tile_ids(im, x0, y0, cx, cy, shape_index)
            if ids is not None:
                chr_ok += 1
                sig = str(tuple(ids))
                cell_sigs[(cx, cy)] = sig
                if (cx, cy) not in unit_pos:
                    old_char = old_map[cy][cx]
                    sig_votes[sig][old_char] += 1

    sig_terrain: dict[str, str] = {}
    ambiguous: dict[str, Counter] = {}
    for sig, votes in sig_votes.items():
        top = votes.most_common(1)[0]
        sig_terrain[sig] = top[0]
        if len(votes) > 1:
            ambiguous[sig] = votes

    grid: list[list[str | None]] = [[None] * cols for _ in range(rows)]
    for (cx, cy), sig in cell_sigs.items():
        if sig in sig_terrain:
            grid[cy][cx] = CHAR_TO_KEY.get(sig_terrain[sig], sig_terrain[sig])

    coverage = chr_ok / (cols * rows) if cols * rows else 0
    ambig_cells = sum(
        1 for (cx, cy) in cell_sigs
        if cell_sigs[(cx, cy)] in ambiguous
    )
    stats = {
        "chr_matched": chr_ok,
        "total_cells": cols * rows,
        "coverage": round(coverage, 4),
        "ambiguous_sigs": len(ambiguous),
        "ambiguous_cells": ambig_cells,
    }
    groups = {}
    for sig, terrain_char in sig_terrain.items():
        first_id = sig.strip("()").split(",")[0].strip()
        terrain_name = CHAR_TO_KEY.get(terrain_char, terrain_char)
        groups[first_id] = terrain_name
    return grid, groups, stats


def fill_unit_cells(grid: list[list[str | None]], cols: int, rows: int,
                    unit_pos: set[tuple[int, int]], default: str) -> int:
    """Fill unit cells by 4-neighbour majority (passable only). Returns fill count."""
    filled = 0
    for _ in range(max(cols, rows) + 5):
        changed = 0
        for (ux, uy) in unit_pos:
            if not (0 <= ux < cols and 0 <= uy < rows):
                continue
            if grid[uy][ux] is not None:
                continue
            votes: Counter = Counter()
            for dx, dy in [(-1, 0), (1, 0), (0, -1), (0, 1)]:
                nx, ny = ux + dx, uy + dy
                if 0 <= nx < cols and 0 <= ny < rows and grid[ny][nx] is not None:
                    votes[grid[ny][nx]] += 1
            passable_votes = {k: v for k, v in votes.items() if k in PASSABLE}
            if passable_votes:
                grid[uy][ux] = max(passable_votes, key=passable_votes.get)
                changed += 1
                filled += 1
        if not changed:
            break
    for (ux, uy) in unit_pos:
        if 0 <= ux < cols and 0 <= uy < rows and grid[uy][ux] is None:
            grid[uy][ux] = default
            filled += 1
    return filled


def fill_unmatched(grid: list[list[str | None]], cols: int, rows: int,
                   fallback_map: list[str] | None) -> int:
    """Fill any remaining None cells from fallback terrain.py map or neighbour vote."""
    filled = 0
    if fallback_map:
        for cy in range(rows):
            for cx in range(cols):
                if grid[cy][cx] is None and cy < len(fallback_map) and cx < len(fallback_map[cy]):
                    ch = fallback_map[cy][cx]
                    grid[cy][cx] = CHAR_TO_KEY.get(ch, "plain")
                    filled += 1
    for _ in range(max(cols, rows) + 5):
        changed = 0
        for cy in range(rows):
            for cx in range(cols):
                if grid[cy][cx] is not None:
                    continue
                votes: Counter = Counter()
                for dy in (-1, 0, 1):
                    for dx in (-1, 0, 1):
                        if dx == 0 and dy == 0:
                            continue
                        nx, ny = cx + dx, cy + dy
                        if 0 <= nx < cols and 0 <= ny < rows and grid[ny][nx] is not None:
                            votes[grid[ny][nx]] += 1
                if votes:
                    grid[cy][cx] = max(votes, key=votes.get)
                    changed += 1
                    filled += 1
        if not changed:
            break
    for cy in range(rows):
        for cx in range(cols):
            if grid[cy][cx] is None:
                grid[cy][cx] = "plain"
                filled += 1
    return filled


def force_unit_passable(grid: list[list[str]], unit_pos: set[tuple[int, int]],
                        cols: int, rows: int, default: str) -> int:
    """Override any unit cell on impassable terrain to the most common passable neighbour."""
    fixed = 0
    for (ux, uy) in unit_pos:
        if not (0 <= ux < cols and 0 <= uy < rows):
            continue
        if grid[uy][ux] in PASSABLE:
            continue
        votes: Counter = Counter()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                if dx == 0 and dy == 0:
                    continue
                nx, ny = ux + dx, uy + dy
                if 0 <= nx < cols and 0 <= ny < rows and grid[ny][nx] in PASSABLE:
                    votes[grid[ny][nx]] += 1
        if votes:
            grid[uy][ux] = max(votes, key=votes.get)
        else:
            grid[uy][ux] = default
        fixed += 1
    return fixed


def compute_agreement(grid: list[list[str]], old_map: list[str],
                      unit_pos: set[tuple[int, int]], cols: int, rows: int
                      ) -> tuple[int, int, float]:
    """Non-unit cell agreement with old terrain. Returns (agree, total, pct)."""
    agree = 0
    total = 0
    for cy in range(rows):
        for cx in range(cols):
            if (cx, cy) in unit_pos:
                continue
            old_char = old_map[cy][cx]
            old_key = CHAR_TO_KEY.get(old_char, old_char)
            new_key = grid[cy][cx]
            total += 1
            if new_key == old_key:
                agree += 1
    return agree, total, round(agree / total * 100, 1) if total else 0.0


def check_unit_passable(grid: list[list[str]], unit_pos: set[tuple[int, int]],
                        cols: int, rows: int) -> list[tuple[int, int, str]]:
    """Return list of (x, y, terrain) for unit cells that are NOT passable."""
    bad = []
    for (ux, uy) in unit_pos:
        if 0 <= ux < cols and 0 <= uy < rows:
            t = grid[uy][ux]
            if t not in PASSABLE:
                bad.append((ux, uy, t))
    return bad


# ── main pipeline ────────────────────────────────────────────────────────────

def process_chapter(ch: str, shape_index: dict, old_data: dict,
                    gcgx: dict) -> dict:
    old = old_data[ch]
    old_map = old["map"]
    cols_old = old["cols"]
    rows_old = old["rows"]
    stage_type = old["stageType"]

    im = Image.open(MAPS / f"official-{ch}.png").convert("RGB")
    cb = chrlib.content_box(ch, cols_old, rows_old)
    x0, y0 = cb["box"][0], cb["box"][1]
    cols, rows = cb["cols"], cb["rows"]

    unit_pos_list = chrlib.unit_positions(ch)
    unit_pos = set(unit_pos_list)

    chr_grid, groups, chr_stats = build_chr_terrain(
        ch, im, x0, y0, cols, rows, shape_index, old_map, unit_pos)

    chr_pct = chr_stats["coverage"]
    use_chr = chr_pct >= 0.90 and chr_stats["ambiguous_sigs"] == 0

    fallback_grid = None
    if not use_chr:
        t_data = terrain.build_map(ch, cols_old, rows_old)
        fallback_grid = t_data["map"]

    if use_chr:
        grid = chr_grid
        method = "chr"
    else:
        grid_from_fallback = [[None] * cols for _ in range(rows)]
        if fallback_grid:
            for cy in range(min(rows, len(fallback_grid))):
                for cx in range(min(cols, len(fallback_grid[cy]))):
                    c = fallback_grid[cy][cx]
                    grid_from_fallback[cy][cx] = CHAR_TO_KEY.get(c, "plain")
        grid = grid_from_fallback
        method = "color"

    default_terrain = "base" if stage_type == "base" else "plain"
    fill_unit_cells(grid, cols, rows, unit_pos, default_terrain)
    fill_unmatched(grid, cols, rows, fallback_grid if not use_chr else None)
    force_unit_passable(grid, unit_pos, cols, rows, default_terrain)

    grid_chars = ["".join(KEY_TO_CHAR.get(grid[cy][cx], ".")
                           for cx in range(cols))
                  for cy in range(rows)]

    agree, agree_total, agree_pct = compute_agreement(
        grid, old_map, unit_pos, cols, rows)
    bad_units = check_unit_passable(grid, unit_pos, cols, rows)
    pass_ratio = sum(1 for cy in range(rows) for cx in range(cols)
                     if grid[cy][cx] in PASSABLE) / (cols * rows)

    stats = {
        "cells": cols * rows,
        "unitCells": len(unit_pos),
        "agreement": round(agree / agree_total, 4) if agree_total else 0,
        "agreementPct": agree_pct,
        "unknown": sum(1 for cy in range(rows) for cx in range(cols)
                       if grid[cy][cx] is None),
        "passRatio": round(pass_ratio, 4),
        "method": method,
        "chrCoverage": chr_stats["coverage"],
        "ambiguousSigs": chr_stats["ambiguous_sigs"],
        "unitPassFails": len(bad_units),
    }

    return {
        "cols": cols, "rows": rows, "stage": stage_type,
        "grid": grid_chars,
        "groups": groups if method == "chr" else {},
        "stats": stats,
        "_bad_units": bad_units,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", action="store_true")
    ap.add_argument("--preview", metavar="DIR")
    args = ap.parse_args()

    gcgx = chrlib.load_gcgx()
    old_data = load_old_scenarios()

    print("Building CHR shape index …")
    shape_index = chrlib.build_shape_index()
    print(f"  {len(shape_index)} unique tile shapes")

    result: dict[str, dict] = {}
    rows_report: list[list] = []

    for ch_num in range(1, 27):
        ch = f"{ch_num:02d}"
        print(f"Processing ch{ch} …", end=" ", flush=True)
        chapter_data = process_chapter(ch, shape_index, old_data, gcgx)
        bad = chapter_data.pop("_bad_units")
        result[ch] = chapter_data
        s = chapter_data["stats"]
        print(f"{s['method']:5s}  agree={s['agreementPct']:5.1f}%  "
              f"chr_cov={s['chrCoverage']*100:.0f}%  "
              f"pass={s['passRatio']*100:.0f}%  "
              f"unit_fail={s['unitPassFails']}")
        rows_report.append([
            ch, chapter_data["stage"], f"{chapter_data['cols']}×{chapter_data['rows']}",
            s["method"], f"{s['chrCoverage']*100:.0f}%", f"{s['agreementPct']}%",
            f"{s['passRatio']*100:.0f}%", s["unitPassFails"],
            ", ".join(f"({x},{y})={t}" for x, y, t in bad[:3]),
        ])

    out_path = ROOT / "data" / "maps-chr.json"
    out_path.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print(f"\nWrote {out_path}")

    if args.report:
        print("\n┌────┬───────┬────────┬───────┬────────┬─────────┬──────┬──────┬─────────────────────┐")
        print("│ ch │ stage │  size  │ method│ chr_cov│ agree%  │ pass │ fail │ notes               │")
        print("├────┼───────┼────────┼───────┼────────┼─────────┼──────┼──────┼─────────────────────┤")
        for r in rows_report:
            print(f"│ {r[0]} │ {r[1]:<5} │ {r[2]:<6} │ {r[3]:<5} │ {r[4]:<6} │ {r[5]:<7} │ {r[6]:<4} │ {r[7]:<4} │ {r[8][:19]:<19} │")
        print("└────┴───────┴────────┴───────┴────────┴─────────┴──────┴──────┴─────────────────────┘")

        below = [r for r in rows_report if float(r[5].rstrip('%')) < 95]
        if below:
            print(f"\n⚠  {len(below)} chapters below 95% agreement:")
            for r in below:
                print(f"  ch{r[0]}: {r[5]} ({r[3]} method, chr_cov={r[4]})")
        else:
            print("\n✓ All chapters ≥ 95% agreement")

    if args.preview:
        preview_dir = pathlib.Path(args.preview)
        preview_dir.mkdir(parents=True, exist_ok=True)
        for ch_num in range(1, 27):
            ch = f"{ch_num:02d}"
            d = result[ch]
            im = Image.open(MAPS / f"official-{ch}.png").convert("RGBA")
            overlay = Image.new("RGBA", im.size, (0, 0, 0, 0))
            dr = ImageDraw.Draw(overlay)
            cb = chrlib.content_box(ch, d["cols"], d["rows"])
            bx, by = cb["box"][0], cb["box"][1]
            for cy, row in enumerate(d["grid"]):
                for cx, c in enumerate(row):
                    key = CHAR_TO_KEY.get(c, "plain")
                    color = OVERLAY_COLORS.get(key, (128, 128, 128)) + (120,)
                    x = bx + cx * 16
                    y = by + cy * 16
                    dr.rectangle([x, y, x + 15, y + 15], fill=color)
            out = Image.alpha_composite(im, overlay).convert("RGB")
            out = out.resize((out.width * 2, out.height * 2), Image.NEAREST)
            out.save(preview_dir / f"terrain-chr-{ch}.png")
        print(f"\nPreview images written to {preview_dir}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
