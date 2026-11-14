#!/usr/bin/env python3
"""把游戏里的真实素材拼成封面/海报（720×1280 竖版 + 1280×720 横版）。

不是重新画一张，而是拿运行资源摆出一帧「像游戏」的画面，保证封面和实际画面不打架。
"""
import os
import sys

from PIL import Image, ImageChops, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets/img")
OUT = os.path.join(ROOT, "docs")

FONT_CANDIDATES = [
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 1),
    ("/System/Library/Fonts/STHeiti Medium.ttc", 0),
    ("/System/Library/Fonts/PingFang.ttc", 0),
    ("/System/Library/Fonts/Supplemental/Songti.ttc", 0),
]
GOLD = (232, 180, 74)
PAPER = (242, 230, 207)
INK = (10, 8, 13)


def font(size):
    for path, index in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size, index=index)
            except Exception:
                continue
    return ImageFont.load_default()


def cover(img, w, h):
    """按 cover 规则缩放裁切"""
    s = max(w / img.width, h / img.height)
    nw, nh = int(img.width * s + 0.5), int(img.height * s + 0.5)
    img = img.resize((nw, nh), Image.LANCZOS)
    x = (nw - w) // 2
    y = (nh - h) // 2
    return img.crop((x, y, x + w, y + h))


def vertical_shade(w, h, stops):
    g = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(g)
    for i in range(h):
        t = i / (h - 1)
        for (p0, c0), (p1, c1) in zip(stops, stops[1:]):
            if p0 <= t <= p1:
                k = (t - p0) / max(1e-6, p1 - p0)
                col = tuple(int(c0[j] + (c1[j] - c0[j]) * k) for j in range(4))
                d.line([(0, i), (w, i)], fill=col)
                break
    return g


def stroke_text(d, xy, text, f, fill, stroke, width=6, anchor="mm"):
    d.text(xy, text, font=f, fill=fill, anchor=anchor,
           stroke_width=width, stroke_fill=stroke)


TEXT = {
    "zh": {"title": "夺 木", "sub": "通天建木 · 双仙夺木", "tag": "蒙着的那半秒，你敢不敢先砍",
           "meta": "单人战电脑 · 双人同屏 · 纯网页", "title_scale": 1.0},
    "en": {"title": "SEIZE THE LOG", "sub": "Two immortals · One world tree",
           "tag": "Half a second of nerve.", "meta": "Solo vs CPU · Duo on one screen · Runs in your browser",
           "title_scale": 0.52},
}


def build(w, h, path, layout, lang="zh"):
    bg = cover(Image.open(os.path.join(IMG, "bg_thunder.jpg")).convert("RGB"), w, h).convert("RGBA")

    # 雾层
    fog = Image.effect_noise((w // 4, h // 4), 28).resize((w, h)).convert("L")
    fog = fog.filter(ImageFilter.GaussianBlur(18))
    fog_rgba = Image.new("RGBA", (w, h), (150, 180, 210, 0))
    fog_rgba.putalpha(fog.point(lambda v: int(v * 0.16)))
    bg = Image.alpha_composite(bg, fog_rgba)

    # 通天建木
    trunk = Image.open(os.path.join(IMG, "trunk.webp")).convert("RGBA")
    tw = int(w * layout["trunk_w"])
    th = int(tw * trunk.height / trunk.width)
    trunk = trunk.resize((tw, th), Image.LANCZOS)
    tx = (w - tw) // 2
    bg.alpha_composite(trunk, (tx, h - th - int(h * layout["trunk_bottom"])))

    # 最下面的锯切面
    stump = Image.open(os.path.join(IMG, "log.webp")).convert("RGBA")
    sw = int(w * layout["stump_w"])
    sh = int(sw * stump.height / stump.width)
    stump = stump.resize((sw, sh), Image.LANCZOS)
    sx = (w - sw) // 2
    sy = h - sh - int(h * layout["stump_bottom"])
    bg.alpha_composite(stump, (sx, sy))

    # 雷印叠在锯切面上（加色），位置压在木头里，别糊到地面
    rune = Image.open(os.path.join(IMG, "rune.jpg")).convert("RGB")
    rs = int(sw * 0.40)
    rune = rune.resize((rs, rs), Image.LANCZOS)
    rx, ry = sx + int(sw * 0.04), sy + int(sh * 0.12)
    region = bg.crop((rx, ry, rx + rs, ry + rs)).convert("RGB")
    bg.paste(ImageChops.add(region, rune), (rx, ry))

    # 两个仙人
    for team, x_frac, pose in (("red", layout["red_x"], "raise"), ("blue", layout["blue_x"], "raise")):
        hero = Image.open(os.path.join(IMG, f"hero_{team}_{pose}.webp")).convert("RGBA")
        hh = int(h * layout["hero_h"])
        hw = int(hh * hero.width / hero.height)
        hero = hero.resize((hw, hh), Image.LANCZOS)
        if team == "blue":
            hero = hero.transpose(Image.FLIP_LEFT_RIGHT)
        bg.alpha_composite(hero, (int(w * x_frac - hw / 2), h - int(h * layout["hero_bottom"]) - hh))

    # 上下压暗
    bg = Image.alpha_composite(bg, vertical_shade(w, h, [
        (0.0, (6, 5, 10, 235)), (0.22, (6, 5, 10, 120)),
        (0.55, (6, 5, 10, 0)), (0.86, (6, 5, 10, 150)), (1.0, (6, 5, 10, 245)),
    ]))

    d = ImageDraw.Draw(bg)

    tx = TEXT[lang]
    title_size = int(layout["title_size"] * tx["title_scale"])
    f_title = font(title_size)
    stroke_text(d, (w // 2, h * layout["title_y"]), tx["title"], f_title, GOLD, INK, width=max(6, title_size // 10))

    f_sub = font(int(title_size * (0.42 if lang == "en" else 0.26)))
    stroke_text(d, (w // 2, h * layout["sub_y"]), tx["sub"], f_sub, PAPER, INK, width=5)

    f_tag = font(int(title_size * (0.46 if lang == "en" else 0.30)))
    stroke_text(d, (w // 2, h * layout["tag_y"]), tx["tag"], f_tag, (255, 226, 170), INK, width=6)

    f_meta = font(int(title_size * 0.26))
    stroke_text(d, (w // 2, h * 0.955), tx["meta"], f_meta, (218, 205, 182), INK, width=4)

    bg.convert("RGB").save(path, "JPEG", quality=92, optimize=True)
    print("wrote", path, bg.size)


def main():
    os.makedirs(OUT, exist_ok=True)
    build(720, 1280, os.path.join(OUT, "poster.jpg"), {
        "trunk_w": 0.42, "trunk_bottom": 0.13,
        "stump_w": 0.50, "stump_bottom": 0.10,
        "hero_h": 0.27, "hero_bottom": 0.09,
        "red_x": 0.17, "blue_x": 0.82,
        "title_size": 146, "title_y": 0.105, "sub_y": 0.178, "tag_y": 0.225,
    })
    build(1280, 720, os.path.join(OUT, "poster-en-16x9.jpg"), {
        "trunk_w": 0.17, "trunk_bottom": 0.10,
        "stump_w": 0.21, "stump_bottom": 0.06,
        "hero_h": 0.44, "hero_bottom": 0.05,
        "red_x": 0.30, "blue_x": 0.70,
        "title_size": 120, "title_y": 0.20, "sub_y": 0.285, "tag_y": 0.355,
    }, lang="en")
    build(1280, 720, os.path.join(OUT, "poster-16x9.jpg"), {
        "trunk_w": 0.17, "trunk_bottom": 0.10,
        "stump_w": 0.21, "stump_bottom": 0.06,
        "hero_h": 0.44, "hero_bottom": 0.05,
        "red_x": 0.30, "blue_x": 0.70,
        "title_size": 120, "title_y": 0.20, "sub_y": 0.285, "tag_y": 0.355,
    })


if __name__ == "__main__":
    sys.exit(main())
