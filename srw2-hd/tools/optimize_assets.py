#!/usr/bin/env python3
"""把 assets/hd 下的 PNG 压成 WebP（保持分辨率），并清理可再生中间产物。

用法：
    python3 tools/optimize_assets.py            # 转换 + 删除原 PNG
    python3 tools/optimize_assets.py --keep     # 只生成 WebP，不删 PNG
    python3 tools/optimize_assets.py --dry-run  # 只报告体积

为什么要做：26 话 × 2 套地图的 PNG 共 ~78MB，WebP(q88) 后 ~30MB，
首屏与手机上加载都明显更快；像素图用 q88 肉眼看不出差别。
"""
from __future__ import annotations

import argparse
import pathlib
import shutil

from PIL import Image

ROOT = pathlib.Path(__file__).resolve().parents[1]
HD = ROOT / "assets" / "hd"
QUALITY = 88

TARGETS = [
    HD / "maps",
    HD / "maps-ai",
    HD / "units",
    HD / "fx",
    HD / "tiles",
    HD / "ucloud",
]
SINGLE = [
    HD / "units-sheet.png",
    HD / "portrait-jo.png",
    HD / "portrait-yumi.png",
    HD / "portrait-dawei.png",
]
# 可再生的中间产物（AI 原图 / 抠图中间帧）
PRUNE = [HD / "raw"]


def human(n: int) -> str:
    for unit in ("B", "KB", "MB", "GB"):
        if n < 1024 or unit == "GB":
            return f"{n:.1f}{unit}"
        n /= 1024
    return f"{n:.1f}GB"


def convert(p: pathlib.Path, keep: bool, dry: bool, before: int) -> tuple[int, int]:
    if not p.exists():
        return before, before
    out = p.with_suffix(".webp")
    if dry:
        tmp = pathlib.Path("/tmp") / out.name
        Image.open(p).save(tmp, "WEBP", quality=QUALITY, method=6)
        size = tmp.stat().st_size
        tmp.unlink()
    else:
        Image.open(p).save(out, "WEBP", quality=QUALITY, method=6)
        size = out.stat().st_size
        if not keep:
            p.unlink()
    return before + p.stat().st_size if p.exists() else before, size


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--keep", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    paths: list[pathlib.Path] = []
    for d in TARGETS:
        paths += sorted(d.glob("*.png"))
    paths += [p for p in SINGLE if p.exists()]

    total_before = sum(p.stat().st_size for p in paths)
    total_after = 0
    for p in paths:
        out = p.with_suffix(".webp")
        if args.dry_run:
            Image.open(p).save("/tmp/_probe.webp", "WEBP", quality=QUALITY, method=6)
            total_after += pathlib.Path("/tmp/_probe.webp").stat().st_size
        else:
            Image.open(p).save(out, "WEBP", quality=QUALITY, method=6)
            total_after += out.stat().st_size
            if not args.keep:
                p.unlink()
    print(f"images: {len(paths)}  {human(total_before)} → {human(total_after)} "
          f"({100 * total_after / max(1, total_before):.0f}%)")

    if not args.dry_run:
        for d in PRUNE:
            if d.exists():
                shutil.rmtree(d)
                print("pruned", d.relative_to(ROOT))

    webp_total = sum(p.stat().st_size for p in HD.rglob("*.webp"))
    png_total = sum(p.stat().st_size for p in HD.rglob("*.png"))
    print(f"assets/hd now: webp {human(webp_total)}, png {human(png_total)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
