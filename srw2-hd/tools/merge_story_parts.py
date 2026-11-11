#!/usr/bin/env python3
"""合并主线翻译与并行分块翻译，产出 data/script-zh.json。

- 优先 data/script-zh-parts/NN.json（并行 agent 产物）
- 否则用 tools/translate_script.py 里的 ZH 表（主线 agent 已翻的 00-08/27）
- 逐行校验：行数、textZh 非空；缺翻译保留日文并报告
"""
from __future__ import annotations

import importlib.util
import json
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parents[1]
JA = ROOT / "data" / "script-ja.json"
PARTS = ROOT / "data" / "script-zh-parts"
OUT = ROOT / "data" / "script-zh.json"
SPK = ROOT / "data" / "speaker-map.json"


def load_translations() -> dict:
    path = pathlib.Path("/tmp/story_translations.py")
    if not path.exists():
        path = ROOT / "tools" / "translate_script.py"
    spec = importlib.util.spec_from_file_location("story_tr", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return {"ZH": getattr(mod, "ZH", {}), "SPEAKERS": getattr(mod, "SPEAKERS", {}),
            "TITLES": getattr(mod, "TITLES", {}), "SECTIONS": getattr(mod, "SECTIONS", {})}


FIXES = {
    ("08", "だいすけさん！！」"): "大介先生！！",
    ("08", "！\u3000いまだ！！」"): "！就是现在！！",
}


def main() -> int:
    ja = json.loads(JA.read_text())
    tr = load_translations()
    out = {}
    report = []
    for ch, info in ja.items():
        part = PARTS / f"{ch}.json"
        if part.exists():
            data = json.loads(part.read_text())
            lines = data.get("lines", [])
            if len(lines) != len(info.get("lines", [])):
                print(f"[warn] {ch} part lines {len(lines)} != ja {len(info['lines'])}")
            out[ch] = {"title": info.get("title", ""), "titleZh": data.get("titleZh") or tr["TITLES"].get(ch, ""), "lines": lines}
        else:
            lines = []
            for line in info.get("lines", []):
                if "section" in line:
                    lines.append({"section": line["section"], "sectionZh": tr["SECTIONS"].get(line["section"], line["section"])})
                elif "who" in line:
                    text = line["text"]
                    lines.append({"who": line["who"], "whoZh": tr["SPEAKERS"].get(line["who"], line["who"]),
                                  "text": text, "textZh": tr["ZH"].get(ch, {}).get(text, "")})
                else:
                    text = line["text"]
                    lines.append({"text": text, "textZh": tr["ZH"].get(ch, {}).get(text, "")})
            out[ch] = {"title": info.get("title", ""), "titleZh": tr["TITLES"].get(ch, ""), "lines": lines}
        for l in out[ch]["lines"]:
            if "text" in l and not (l.get("textZh") or "").strip():
                l["textZh"] = FIXES.get((ch, l["text"]), l.get("textZh", ""))
        empty = sum(1 for l in out[ch]["lines"] if "text" in l and not (l.get("textZh") or "").strip())
        report.append((ch, len(out[ch]["lines"]), empty))
        if empty:
            print(f"[warn] {ch}: {empty} 行未翻译")

    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1))
    SPK.write_text(json.dumps(tr["SPEAKERS"], ensure_ascii=False, indent=1))
    print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
    print("ch lines empty")
    for r in report:
        print(f"{r[0]} {r[1]:>4} {r[2]:>5}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
