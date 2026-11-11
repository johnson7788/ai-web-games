#!/usr/bin/env python3
"""扫描 assets/hd/units-side，写 config/sprites-generated.js 的 SIDE_KEYS。"""
from __future__ import annotations
import json, pathlib, re

ROOT = pathlib.Path(__file__).resolve().parents[1]
SIDE = ROOT / "assets" / "hd" / "units-side"
GEN = ROOT / "config" / "sprites-generated.js"


def main() -> int:
    keys = sorted(p.stem for p in SIDE.glob("*.webp"))
    s = GEN.read_text()
    line = f"export const SIDE_KEYS = {json.dumps(keys, ensure_ascii=False)};"
    if re.search(r"export const SIDE_KEYS = \[[^\]]*\];", s):
        s = re.sub(r"export const SIDE_KEYS = \[[^\]]*\];", line, s)
    else:
        s = s.rstrip() + "\n" + line + "\n"
    GEN.write_text(s)
    print(f"SIDE_KEYS {len(keys)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
