#!/usr/bin/env python3
"""批量生成第1话的 HD 机体立绘 / 战斗特效，并做透明背景处理。

- 文生图走优云智算网关（qwen-image，需先开 19100 隧道）
- 白底用「从边缘 flood fill」抠掉，避免误伤机体内部的白色装甲
- 输出 assets/hd/units/*.png（RGBA, 256px）与 assets/hd/fx/*.png
"""
from __future__ import annotations

import base64
import json
import pathlib
import sys
import urllib.request

from PIL import Image
from collections import deque

BASE = "http://127.0.0.1:19100"
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT_UNITS = ROOT / "assets" / "hd" / "units"
OUT_FX = ROOT / "assets" / "hd" / "fx"
RAW = ROOT / "assets" / "hd" / "raw"

STYLE = "Q版机甲战棋单位，全身正面站立，日系机器人动画风格，干净赛璐璐上色，纯白背景，居中构图，无文字，无阴影，游戏单位立绘"

UNITS = {
    "gundam": "白色装甲、蓝色胸部、红色肩甲、黄色V字天线的高达型机体，手持光束步枪",
    "mazinger": "黑色身体、红色胸甲、银色前臂、黄色眼睛的超级机器人，双拳巨大",
    "getter": "白色身体、红色胸甲、黄色腰带、背后一对白色机械翅膀的机器人，手持战斧",
    "aphrodite": "粉白色圆润女性型支援机体，红色装饰，没有武器，双手张开",
    "texas": "棕黄色西部风格机器人，戴宽檐帽，双手持左轮枪",
    "whitebase": "白色宇宙战舰，舰桥与弹射甲板，蓝色舰体线条，正面略微俯视",
    "zaku": "墨绿色量产型扎古，单眼粉色发光，左肩带刺甲，手持热能斧",
    "zakuChar": "红色夏亚专用扎古，单眼发光，头部有角饰，手持热能斧",
    "rada": "紫灰色机械兽，双臂是刀刃，四足站立",
    "buda": "蓝灰色双头机械兽，身体两侧各一个兽头，机械爪",
    "barrel": "灰色导弹发射机械，方形炮台，多管导弹舱",
    "zain": "深紫色大型机械兽，手持离子剑，肩部装甲厚重"
}

FX = {
    "beam": "横向能量光束特效，蓝白色高能粒子束，纯黑背景，发光，无文字",
    "impact": "能量命中冲击闪光，橙白色爆点，纯黑背景，发光，无文字",
    "explosion-1": "机甲爆炸初期，橙色火球与火花，纯黑背景，发光，无文字",
    "explosion-2": "机甲爆炸中期，巨大橙红色火球与碎片，纯黑背景，发光，无文字",
    "explosion-3": "机甲爆炸消散，黑烟与余烬，橙红色，纯黑背景，无文字"
}


def post(path, payload, timeout=600):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())


def gen(prompt, out, size=1024, steps=24, transparent=False):
    payload = {
        "prompt": prompt,
        "negative_prompt": "模糊, 水印, 文字, 低质量, 多只手, 错误结构",
        "width": size, "height": size, "steps": steps,
        "params": {"guidance_scale": 4.0},
    }
    if transparent:
        payload["params"]["transparent"] = True
    data = post("/m/qwen-image/txt2img", payload)
    pathlib.Path(out).parent.mkdir(parents=True, exist_ok=True)
    pathlib.Path(out).write_bytes(base64.b64decode(data["images"][0]))
    return pathlib.Path(out)


def cutout(path: pathlib.Path, out: pathlib.Path, white=238, max_side=256) -> None:
    im = Image.open(path).convert("RGB")
    w, h = im.size
    px = im.load()
    seen = bytearray(w * h)
    q = deque()
    for x in range(w):
        q.append((x, 0)); q.append((x, h - 1))
    for y in range(h):
        q.append((0, y)); q.append((w - 1, y))
    while q:
        x, y = q.popleft()
        if x < 0 or y < 0 or x >= w or y >= h:
            continue
        i = y * w + x
        if seen[i]:
            continue
        r, g, b = px[x, y]
        if r < white or g < white or b < white:
            continue
        seen[i] = 1
        q.append((x + 1, y)); q.append((x - 1, y)); q.append((x, y + 1)); q.append((x, y - 1))

    rgba = im.convert("RGBA")
    data = rgba.load()
    for y in range(h):
        for x in range(w):
            if seen[y * w + x]:
                data[x, y] = (0, 0, 0, 0)

    bbox = rgba.getbbox()
    if bbox:
        rgba = rgba.crop(bbox)
    ratio = max_side / max(rgba.size)
    if ratio < 1:
        rgba = rgba.resize((int(rgba.width * ratio), int(rgba.height * ratio)), Image.LANCZOS)
    out.parent.mkdir(parents=True, exist_ok=True)
    rgba.save(out)
    print("saved", out, rgba.size)


def main() -> None:
    only = sys.argv[1] if len(sys.argv) > 1 else None
    for key, desc in UNITS.items():
        if only and only != key:
            continue
        raw = RAW / f"unit-{key}.png"
        if not raw.exists():
            print("gen unit", key)
            gen(f"{STYLE}：{desc}", raw, steps=28)
        cutout(raw, OUT_UNITS / f"{key}.png")

    if not only:
        for key, desc in FX.items():
            raw = RAW / f"fx-{key}.png"
            if not raw.exists():
                print("gen fx", key)
                gen(desc, raw, steps=24)
            im = Image.open(raw).convert("RGB")
            im.thumbnail((512, 512), Image.LANCZOS)
            (OUT_FX / f"{key}.png").parent.mkdir(parents=True, exist_ok=True)
            im.save(OUT_FX / f"{key}.png")
            print("saved", OUT_FX / f"{key}.png", im.size)


if __name__ == "__main__":
    main()
