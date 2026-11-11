#!/usr/bin/env python3
"""用 DeepSeek Anthropic 兼容接口并行翻译剧情台本（data/script-ja.json）。

输出 data/script-zh-api/<ch>.json，结构与 script-ja 对齐：
  {"title","titleZh","lines":[{section,sectionZh}|{who,whoZh,text,textZh}|{text,textZh}]}

只读 ja、只写 api 目录；不依赖付费额度之外的服务。
"""
from __future__ import annotations

import concurrent.futures as cf
import importlib.util
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[1]
JA = ROOT / "data" / "script-ja.json"
OUT = ROOT / "data" / "script-zh-api"
SETTINGS = "/opt/salt-daily-check/claude/claude_deepseek.json"


def load_tr():
    spec = importlib.util.spec_from_file_location("story_tr", ROOT / "tools" / "translate_script.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def call(prompt: str, max_tokens=8000) -> str:
    env = json.load(open(SETTINGS))["env"]
    req = urllib.request.Request(env["ANTHROPIC_BASE_URL"].rstrip("/") + "/v1/messages",
        data=json.dumps({"model": env["ANTHROPIC_MODEL"], "max_tokens": max_tokens,
                         "temperature": 0.2,
                         "messages": [{"role": "user", "content": prompt}]}).encode(),
        headers={"content-type": "application/json", "x-api-key": env["ANTHROPIC_AUTH_TOKEN"],
                 "anthropic-version": "2023-06-01"})
    with urllib.request.urlopen(req, timeout=180) as r:
        data = json.loads(r.read())
    return "".join(b.get("text", "") for b in data.get("content", []) if b.get("type") == "text")


def extract_json(text: str):
    text = text.strip()
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?", "", text).rsplit("```", 1)[0]
    start = text.find("{")
    end = text.rfind("}")
    if start < 0 or end <= start:
        raise ValueError("no json")
    return json.loads(text[start:end + 1])


def translate_chapter(ch: str, info: dict, tr) -> dict:
    items = []
    lines = []
    for line in info.get("lines", []):
        if "section" in line:
            lines.append({"section": line["section"], "sectionZh": tr.SECTIONS.get(line["section"], line["section"])})
            continue
        items.append({"i": len(items), "who": line.get("who", ""), "text": line["text"]})
        lines.append(line)
    glossary = "\n".join(f"{k}→{v}" for k, v in list(tr.SPEAKERS.items())[:80])
    examples = "\n".join(f"{k} → {v}" for k, v in list(tr.ZH.get("01", {}).items())[:12])
    prompt = f"""你是《第2次超级机器人大战》的本地化译者。把下面 JSON 里每条日文台词翻译成简洁、口语化的简体中文。

要求：
- 只输出一个 JSON 对象：{{"zh": ["第0条译文", "第1条译文", ...]}}，长度必须等于输入条数。
- 不合并、不拆分、不增删；保持原来的语气（粗鲁/礼貌/自言自语）。
- 人名/机体名用术语表；没有的按常见译名。
- 不要解释、不要输出 markdown。

术语表：
{glossary}

风格示例：
{examples}

章节：{ch} {info.get('title','')}
输入：
{json.dumps(items, ensure_ascii=False)}"""
    for attempt in range(3):
        try:
            raw = call(prompt)
            data = extract_json(raw)
            zh = data.get("zh") or data.get("translations") or []
            if len(zh) == len(items) and all(str(x).strip() for x in zh):
                break
            raise ValueError(f"length {len(zh)} != {len(items)}")
        except Exception as exc:  # noqa: BLE001
            print(f"[warn] {ch} attempt {attempt+1}: {exc}", flush=True)
            zh = []
    else:
        zh = [""] * len(items)
    out_lines = []
    k = 0
    for line in info.get("lines", []):
        if "section" in line:
            out_lines.append({"section": line["section"], "sectionZh": tr.SECTIONS.get(line["section"], line["section"])})
        elif "who" in line:
            out_lines.append({"who": line["who"], "whoZh": tr.SPEAKERS.get(line["who"], line["who"]),
                              "text": line["text"], "textZh": zh[k] if k < len(zh) else ""})
            k += 1
        else:
            out_lines.append({"text": line["text"], "textZh": zh[k] if k < len(zh) else ""})
            k += 1
    return {"title": info.get("title", ""), "titleZh": tr.TITLES.get(ch, ""), "lines": out_lines}


def main() -> int:
    OUT.mkdir(parents=True, exist_ok=True)
    ja = json.loads(JA.read_text())
    tr = load_tr()
    todo = [ch for ch in ja if len(ja[ch].get("lines", [])) > 0]
    with cf.ThreadPoolExecutor(max_workers=4) as ex:
        futs = {ex.submit(translate_chapter, ch, ja[ch], tr): ch for ch in todo}
        for fut in cf.as_completed(futs):
            ch = futs[fut]
            try:
                data = fut.result()
                (OUT / f"{ch}.json").write_text(json.dumps(data, ensure_ascii=False, indent=1))
                empty = sum(1 for l in data["lines"] if "text" in l and not l.get("textZh"))
                print(f"{ch} lines={len(data['lines'])} empty={empty}", flush=True)
            except Exception as exc:  # noqa: BLE001
                print(f"[error] {ch}: {exc}", flush=True)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
