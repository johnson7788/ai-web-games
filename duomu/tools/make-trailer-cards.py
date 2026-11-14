#!/usr/bin/env python3
"""宣传片的标题卡 / 结论卡：跟游戏同一套暗色 + 金色，不用 skill 的纸质模板。

输出 1920×1080，给 beats.json 当 still 用。
"""
import os
import sys

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.expanduser("~/demos/duomu-trailer/media")
GOLD = (255, 217, 138)
GOLD_DEEP = (232, 180, 74)
PAPER = (242, 230, 207)
DIM = (196, 180, 152)
INK = (8, 6, 11)

FONT_FILES = [
    ("/System/Library/Fonts/Helvetica.ttc", 0),
    ("/System/Library/Fonts/Avenir Next.ttc", 0),
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 1),
]


def font(size, bold=False):
    for path, idx in FONT_FILES:
        if os.path.exists(path):
            try:
                f = ImageFont.truetype(path, size, index=idx)
                if bold:
                    try:
                        f.set_variation_by_name("Bold")
                    except Exception:
                        pass
                return f
            except Exception:
                continue
    return ImageFont.load_default()


def backdrop(w, h):
    src = Image.open(os.path.join(ROOT, "poster.jpg")).convert("RGB")
    s = max(w / src.width, h / src.height)
    src = src.resize((int(src.width * s) + 1, int(src.height * s) + 1), Image.LANCZOS)
    x = (src.width - w) // 2
    y = (src.height - h) // 2
    bg = src.crop((x, y, x + w, y + h)).filter(ImageFilter.GaussianBlur(9))
    dark = Image.new("RGB", (w, h), (5, 4, 9))
    bg = Image.blend(bg, dark, 0.72)
    # 中央再压暗一档，让字浮起来
    vig = Image.new("L", (w, h), 0)
    d = ImageDraw.Draw(vig)
    d.ellipse([-w * 0.25, -h * 0.5, w * 1.25, h * 1.5], fill=90)
    vig = vig.filter(ImageFilter.GaussianBlur(180))
    bg = Image.composite(bg, Image.new("RGB", (w, h), (4, 3, 7)), vig)
    return bg


def text(d, xy, s, f, fill, stroke=0, stroke_fill=INK, anchor="la"):
    d.text(xy, s, font=f, fill=fill, anchor=anchor, stroke_width=stroke, stroke_fill=stroke_fill)


def title_card(path, w=1920, h=1080):
    img = backdrop(w, h).convert("RGBA")
    d = ImageDraw.Draw(img)

    text(d, (140, 300), "ARCADE  ·  2 PLAYER  ·  BROWSER", font(28), GOLD_DEEP)
    text(d, (136, 356), "SEIZE", font(150), GOLD, stroke=10)
    text(d, (136, 486), "THE LOG", font(150), GOLD, stroke=10)
    text(d, (142, 690), "Two immortals. One world tree.", font(46), PAPER, stroke=5)
    text(d, (142, 752), "Half a second of nerve.", font(46), PAPER, stroke=5)

    # 右侧：一棵树 + 两个仙人的剪影，让卡不空
    tree = Image.open(os.path.join(ROOT, "assets/img/trunk.webp")).convert("RGBA")
    th = h + 160
    tw = int(th * tree.width / tree.height)
    tree = tree.resize((tw, th), Image.LANCZOS)
    tree_x = w - tw - 250
    img.alpha_composite(tree, (tree_x, -80))

    for name, dx in (("hero_red_raise.webp", -120), ("hero_blue_raise.webp", 150)):
        hero = Image.open(os.path.join(ROOT, "assets/img", name)).convert("RGBA")
        hh = 420
        hw = int(hh * hero.width / hero.height)
        hero = hero.resize((hw, hh), Image.LANCZOS)
        if "blue" in name:
            hero = hero.transpose(Image.FLIP_LEFT_RIGHT)
        img.alpha_composite(hero, (tree_x + tw // 2 + dx, h - hh - 30))

    d = ImageDraw.Draw(img)
    text(d, (140, h - 92), "pipygames.com", font(26), DIM)
    img.convert("RGB").save(path, "JPEG", quality=92, optimize=True)
    print("wrote", path)


def outro_card(path, w=1920, h=1080):
    img = backdrop(w, h).convert("RGBA")
    d = ImageDraw.Draw(img)
    text(d, (140, 210), "THREE WINDOWS. ONE BET.", font(74), GOLD, stroke=8)

    stats = [("x3", "blind strike"), ("x2", "hint strike"), ("+1", "first strike")]
    x = 140
    for big, label in stats:
        text(d, (x, 380), big, font(170), GOLD, stroke=10)
        text(d, (x + 6, 590), label, font(34), DIM)
        x += 560

    text(d, (146, 760), "First to 26 logs, or drain all three hearts.", font(40), PAPER, stroke=4)
    text(d, (146, 820), "Solo vs CPU, or two players on one screen.", font(40), PAPER, stroke=4)
    text(d, (140, h - 92), "pipygames.com  ·  play free in your browser", font(26), DIM)
    img.convert("RGB").save(path, "JPEG", quality=92, optimize=True)
    print("wrote", path)


if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    title_card(os.path.join(OUT, "still_title.png"))
    outro_card(os.path.join(OUT, "still_outro.png"))
    sys.exit(0)
