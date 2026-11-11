#!/usr/bin/env python3
"""抓取 adventureisland.org 的 SRW2 会話数据 → data/script-ja.json

只读数据采集：抓 kw0..kw27（Shift_JIS），解析出逐行台本（保留原始 who/text）。
运行游戏不需要联网；HTML 缓存到 data/.script-cache/（勿提交）。

输出结构（script-ja.json）：
{
  "00": {"title": "プロローグ", "lines": [{"text": "…"}], ...},
  "01": {"title": "第１話　「…」", "lines": [
          {"section": "【インターミッション】"},
          {"who": "ブライト", "text": "…"}, ...
  ]},
  ...
}

用法：
    python3 tools/scrape_script.py            # 用缓存，缺失才抓取
    python3 tools/scrape_script.py --refresh  # 强制重新抓取
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
OUT = ROOT / "data" / "script-ja.json"
CACHE = ROOT / "data" / ".script-cache"
BASE = "http://www.adventureisland.org/srw2"
PAGES = [f"kw{i}.html" for i in range(28)]  # kw0..kw27

# 「 是对话引导符；源站第10话有一处误作 ｛，一并按说话人解析
DIALOG_RE = re.compile(r"^(.+?)[「｛](.*)$")
# 对话/旁白块：<td bgcolor="#FFFFFF"> 内直接/包一层 <p> 的 <font size="-1">…</font>
CONTENT_RE = re.compile(
    r'<td bgcolor="#FFFFFF">\s*(?:<p>\s*)?<font size="-1">(.*?)</font>\s*(?:</p>)?\s*</td>',
    re.S,
)
TITLE_RE = re.compile(r'<td bgcolor="#0099FF">(.*?)</td>', re.S)


def fetch(url: str, cache: pathlib.Path) -> bytes:
    cache.parent.mkdir(parents=True, exist_ok=True)
    if cache.exists() and cache.stat().st_size > 500:
        return cache.read_bytes()
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (srw2-hd build)"})
    with urllib.request.urlopen(req, timeout=30) as r:
        data = r.read()
    cache.write_bytes(data)
    return data


def strip_tags(s: str) -> str:
    # <br> 是逻辑换行；源码里的 ASCII 空白只是排版（正文分词用全角　）。
    # 先把 <br> 换成哨兵，再删 ASCII 空白、剥标签，最后还原换行。
    s = re.sub(r"<br\s*/?>", "\x00", s, flags=re.I)
    s = re.sub(r"[\t\r\n ]+", "", s)
    s = re.sub(r"<[^>]+>", "", s)
    s = html.unescape(s)
    return s.replace("\x00", "\n")


def section_titles(doc: str) -> list[str]:
    out = []
    for m in TITLE_RE.finditer(doc):
        t = strip_tags(m.group(1)).strip()
        if t and t != "会話集":
            out.append(t)
    return out


def content_blocks(doc: str) -> list[str]:
    return [m.group(1) for m in CONTENT_RE.finditer(doc)]


def parse_staff(doc: str) -> list[dict]:
    """エピローグ的 staff roll：role/name 两列表格。"""
    m = re.search(r'bgcolor="#6699FF"', doc)
    if not m:
        return []
    region = doc[m.start():]
    rows = []
    for r in re.finditer(r'<tr bgcolor="#FFFFFF">(.*?)</tr>', region, re.S):
        cells = [strip_tags(c).strip() for c in re.findall(r"<td>(.*?)</td>", r.group(1), re.S)]
        if len(cells) >= 2 and cells[0] and cells[1]:
            rows.append({"who": cells[0], "text": cells[1]})
    return rows


def parse_content(frag: str) -> list[dict]:
    """一段 <font> 正文 → line 条目。旁白按空行并段；对话逐 <br> 行。"""
    text = strip_tags(frag).replace("\r", "")
    raw = [l.strip() for l in text.split("\n")]
    has_dialog = any(DIALOG_RE.match(l) for l in raw)
    out: list[dict] = []

    if not has_dialog:  # 旁白（プロローグ/エピローグ）：空行分段
        para: list[str] = []
        for l in raw:
            if l:
                para.append(l)
            elif para:
                out.append({"text": "".join(para)})
                para = []
        if para:
            out.append({"text": "".join(para)})
        return out

    for l in raw:
        if not l:
            continue
        m = DIALOG_RE.match(l)
        if m:
            who, body = m.group(1).strip(), m.group(2).strip()
            if body:
                out.append({"who": who, "text": body})
        else:
            out.append({"section": l})
    return out


def parse_page(page: str, raw: bytes) -> dict:
    doc = raw.decode("shift_jis", errors="replace")
    titles = section_titles(doc)
    blocks = content_blocks(doc)
    staff = parse_staff(doc)
    if not titles:
        raise ValueError(f"{page}: 找不到章节标题")

    lines = parse_content(blocks[0]) if blocks else []
    if staff:
        if len(titles) > 1:
            lines.append({"section": titles[1]})
        lines.extend(staff)
    return {"title": titles[0], "lines": lines}


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()

    result: dict[str, dict] = {}
    for i, page in enumerate(PAGES):
        key = f"{i:02d}"
        cache = CACHE / page
        if args.refresh and cache.exists():
            cache.unlink()
        try:
            raw = fetch(f"{BASE}/{page}", cache)
        except Exception as exc:
            print(f"[warn] {page}: {exc}", file=sys.stderr)
            if OUT.exists() and key in json.loads(OUT.read_text()):
                result[key] = json.loads(OUT.read_text())[key]
                continue
            raise
        info = parse_page(page, raw)
        result[key] = info
        n = len(info["lines"])
        print(f"{key} {info['title']}  lines={n}")

    OUT.write_text(json.dumps(result, ensure_ascii=False, indent=1))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
