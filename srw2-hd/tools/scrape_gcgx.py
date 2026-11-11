#!/usr/bin/env python3
"""抓取 gcgx.games/srw2 的 26 话攻略页 → data/gcgx.json

只做一次数据采集；生成的 JSON 会入库，运行游戏不需要联网。

输出结构：
{
  "01": {
    "title": "救出!!Ｚガンダム",
    "stageType": "ground" | "space" | "base",
    "map": {"cols": 17, "rows": 21, "image": {"width": 273, "height": 337}},
    "objective": {"victory": "...", "defeat": "..."},
    "allies":     [{x,y,pilot,unit,lv}],
    "enemies":    [{x,y,pilot,unit,lv,exp,money,ai,ability}],
    "npc":        [{x,y,pilot,unit,lv}],
    "reinforcements": [{turn, heading, units:[{x,y,pilot,unit,lv}]}],
    "strategy": "...",     # 攻略段
    "clear": "..."         # クリア後段
  }, ...
}

用法：
    python3 tools/scrape_gcgx.py            # 用缓存（data/gcgx.json 已存在则跳过抓取）
    python3 tools/scrape_gcgx.py --refresh  # 强制重新抓取
"""
from __future__ import annotations

import argparse
import html
import json
import pathlib
import re
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "data" / "gcgx.json"
CACHE = ROOT / "data" / ".gcgx-cache"
IMGDIR = ROOT / "assets" / "extracted" / "maps"
BASE = "https://gcgx.games/srw2"

KANA = "０１２３４５６７８９"


def fetch(url: str, cache: pathlib.Path) -> str:
    cache.parent.mkdir(parents=True, exist_ok=True)
    if cache.exists() and cache.stat().st_size > 1000:
        return cache.read_text(encoding="utf-8", errors="replace")
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (srw2-hd build)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    cache.write_bytes(data)
    return data.decode("utf-8", errors="replace")


def clean(s: str) -> str:
    s = re.sub(r"<br\s*/?>", "\n", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    s = s.replace("\u00a0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n\s*\n+", "\n", s)
    return s.strip()


def jpnum(s: str) -> int | None:
    """把 '11' / '１１' 转成 int。"""
    s = s.translate({ord(c): ord(str(i)) for i, c in enumerate(KANA)})
    m = re.search(r"\d+", s)
    return int(m.group(0)) if m else None


def parse_table(tb: str) -> list[dict]:
    """把 <table> 拆成 [{表头: 单元格}]。"""
    head = re.findall(r"<th[^>]*>(.*?)</th>", tb, re.S)
    head = [clean(h) for h in head]
    rows = []
    for tr in re.findall(r"<tr[^>]*>(.*?)</tr>", tb, re.S):
        cells = [clean(c) for c in re.findall(r"<td[^>]*>(.*?)</td>", tr, re.S)]
        if not cells:
            continue
        if len(cells) < len(head):
            cells += [""] * (len(head) - len(cells))
        rows.append(dict(zip(head, cells)))
    return rows


def to_int(v, default=None):
    try:
        return int(str(v).strip())
    except Exception:
        return default


def unit_row(row: dict) -> dict:
    return {
        "x": to_int(row.get("X")),
        "y": to_int(row.get("Y")),
        "pilot": (row.get("パイロット") or "").strip() or None,
        "unit": (row.get("ユニット") or "").strip(),
        "lv": to_int(row.get("Lv")),
        "exp": to_int(row.get("EXP")),
        "money": to_int(row.get("資金")),
        "ai": (row.get("行動") or "").strip() or None,
        "ability": (row.get("能力") or "").strip() or None,
    }


HEADING_RE = re.compile(r"<h([23])[^>]*>(.*?)</h\1>", re.S | re.I)


def walk(head: str) -> list[dict]:
    """把正文切成 [{level, title, html}]：每个标题 + 到下一个标题为止的内容。"""
    body = head[head.index('<div id="main">'):]
    marks = list(HEADING_RE.finditer(body))
    out = []
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(body)
        out.append({
            "level": int(m.group(1)),
            "title": clean(m.group(2)),
            "html": body[m.end():end],
        })
    return out


def first_table(html_text: str) -> list[dict]:
    m = re.search(r"<table>(.*?)</table>", html_text, re.S)
    return parse_table(m.group(1)) if m else []


def parse_page(ch: str, doc: str, img_size: tuple[int, int] | None) -> dict:
    body = doc[doc.index('<div id="main">'):]
    m = re.search(r"<H1[^>]*>(.*?)</H1>", body, re.S)
    title = clean(m.group(1)) if m else ""
    title = re.sub(r"^第\s*\d+\s*話\s*", "", title).strip()

    blocks = walk(body)
    # 同一 h2 下的 h3 属于该 h2 的子段
    sections: dict[str, list[dict]] = {}
    current = ""
    for b in blocks:
        if b["level"] == 2:
            current = b["title"]
            sections.setdefault(current, [])
            sections[current].append(b)
        else:
            sections.setdefault(current, []).append(b)

    def find(*names):
        for k, v in sections.items():
            if any(n in k for n in names):
                return v
        return []

    objective = {}
    for row in first_table("".join(b["html"] for b in find("作戦目的"))):
        key, val = row.get("条件", ""), row.get("説明", "")
        if "勝利" in key:
            objective["victory"] = val
        elif "敗北" in key:
            objective["defeat"] = val

    allies, enemies, npc, reinforcements = [], [], [], []
    current = ""
    side = "enemy"

    def rows(html_text):
        return [unit_row(r) for r in first_table(html_text)
                if to_int(r.get("X")) is not None and (r.get("ユニット") or "").strip()]

    for b in blocks:
        if b["level"] == 2:
            current = b["title"]
            if "味方" in current:
                side = "player"
                allies += rows(b["html"])
            elif "敵" in current:
                side = "enemy"
                enemies += rows(b["html"])
            continue
        # h3 子段
        if "増援" in b["title"] or "援軍" in b["title"]:
            units = rows(b["html"])
            if units:
                reinforcements.append({"turn": jpnum(b["title"]) or 1, "side": side,
                                       "heading": b["title"], "units": units})
        elif "NPC" in b["title"].upper() or "第三" in b["title"]:
            npc += rows(b["html"])

    strategy = "\n".join(clean(b["html"]) for b in find("攻略") if b["level"] == 2)
    clear = "\n".join(clean(b["html"]) for b in find("クリア後") if b["level"] == 2)

    # 地图尺寸：优先图片像素（16px/格，可能带 1px 边框）
    cols = rows = None
    if img_size:
        w, h = img_size
        cols = (w - 1) // 16 if w % 16 == 1 else w // 16
        rows = (h - 1) // 16 if h % 16 == 1 else h // 16

    return {
        "title": title,
        "map": {"cols": cols, "rows": rows,
                "image": {"width": img_size[0], "height": img_size[1]} if img_size else None},
        "objective": objective,
        "allies": allies,
        "enemies": enemies,
        "npc": npc,
        "reinforcements": reinforcements,
        "strategy": strategy,
        "clear": clear,
    }


def image_size(ch: str) -> tuple[int, int] | None:
    p = IMGDIR / f"official-{ch}.png"
    if not p.exists():
        return None
    try:
        from PIL import Image
        return Image.open(p).size
    except Exception:
        return None


def guess_stage_type(ch: str) -> str:
    """粗判关卡地形集：ground / space / base（人工校对过，见 README）。"""
    # 基地/要塞内景（紫色地板+灰白通路）
    base = {"07", "15", "18", "21", "26"}
    # 宇宙/月面（深色底 + 星点）
    space = {"09", "14", "16", "17", "19", "20", "22"}
    return "base" if ch in base else "space" if ch in space else "ground"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()

    result = {}
    for i in range(1, 27):
        ch = f"{i:02d}"
        cache = CACHE / f"{ch}.html"
        if args.refresh and cache.exists():
            cache.unlink()
        try:
            doc = fetch(f"{BASE}/map/{ch}.html", cache)
        except Exception as exc:  # 网络失败时用已入库的数据
            print(f"[warn] {ch}: {exc}", file=sys.stderr)
            if OUT.exists():
                old = json.loads(OUT.read_text())
                if ch in old:
                    result[ch] = old[ch]
                    continue
            raise
        info = parse_page(ch, doc, image_size(ch))
        info["stageType"] = guess_stage_type(ch)
        result[ch] = info
        print(f"{ch} {info['title']} {info['map']['cols']}x{info['map']['rows']} "
              f"allies={len(info['allies'])} enemies={len(info['enemies'])} "
              f"reinf={len(info['reinforcements'])} npc={len(info['npc'])}")

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
