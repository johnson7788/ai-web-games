#!/usr/bin/env python3
"""扫描 AI 生成的机体立绘，写 config/sprites-generated.js（AI_HD / MAP / CUTIN）。"""
from __future__ import annotations
import json, pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
PLAN = ROOT / "data" / "sprites-plan.json"
UNITS = ROOT / "assets" / "hd" / "units"
GEN = ROOT / "config" / "sprites-generated.js"


def main() -> int:
    plan = json.loads(PLAN.read_text()) if PLAN.exists() else []
    ai = []
    for item in plan:
        k = item["key"]
        p = UNITS / f"{k}.webp"
        if p.exists() and p.stat().st_size > 2000:
            ai.append(k)
    maps = sorted(p.stem for p in (ROOT / "assets" / "hd" / "units-map").glob("*.webp"))
    cut = sorted(p.stem.replace("@16x", "") for p in (ROOT / "assets" / "hd" / "units-gen").glob("*@16x.png"))
    GEN.write_text(
        "// 由 tools/sync_ai_sprites.py 生成\n"
        f"export const AI_HD = {json.dumps(ai, ensure_ascii=False)};\n"
        f"export const GENERATED_MAP = {json.dumps(maps, ensure_ascii=False)};\n"
        f"export const GENERATED_CUTIN = {json.dumps(cut, ensure_ascii=False)};\n"
    )
    print(f"AI_HD {len(ai)}  MAP {len(maps)}  CUTIN {len(cut)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
