#!/usr/bin/env python3
"""生成平台物料：根目录 poster.jpg（横版封面）、favicon.png / icon.png。

封面是横版、游戏是竖版——站方卡片是横的，封面按横版做；游戏本体在 iframe 里
letterbox 居中，两边是云海，不违和。
"""
import os

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DOCS = os.path.join(ROOT, "docs")
IMG = os.path.join(ROOT, "assets/img")

FONT_CANDIDATES = [
    ("/System/Library/Fonts/Hiragino Sans GB.ttc", 1),
    ("/System/Library/Fonts/STHeiti Medium.ttc", 0),
]


def font(size):
    for path, index in FONT_CANDIDATES:
        if os.path.exists(path):
            try:
                return ImageFont.truetype(path, size, index=index)
            except Exception:
                continue
    return ImageFont.load_default()


def main():
    # 1) 封面：直接用 16:9 海报，压到 200KB 以内
    src = os.path.join(DOCS, "poster-en-16x9.jpg")
    cover = Image.open(src).convert("RGB").resize((1280, 720), Image.LANCZOS)
    out = os.path.join(ROOT, "poster.jpg")
    for q in (92, 88, 84, 80, 76, 72, 66):
        cover.save(out, "JPEG", quality=q, optimize=True, progressive=True)
        if os.path.getsize(out) <= 200 * 1024:
            break
    print(f"poster.jpg {os.path.getsize(out)/1024:.0f} KB")

    # 2) 图标：雷印 + 夜色底
    rune = Image.open(os.path.join(IMG, "rune.jpg")).convert("RGB").resize((512, 512), Image.LANCZOS)
    icon = Image.new("RGBA", (512, 512), (10, 8, 14, 255))
    d = ImageDraw.Draw(icon)
    for r in range(256, 0, -8):
        a = int(70 * (1 - r / 256) ** 2)
        d.ellipse([256 - r, 256 - r, 256 + r, 256 + r], fill=(120, 70, 20, a))
    icon.alpha_composite(rune.convert("RGBA"))
    # 圆角
    mask = Image.new("L", (512, 512), 0)
    ImageDraw.Draw(mask).rounded_rectangle([0, 0, 511, 511], radius=96, fill=255)
    icon.putalpha(mask)
    icon.save(os.path.join(ROOT, "favicon.png"), "PNG", optimize=True)
    icon.resize((256, 256), Image.LANCZOS).save(os.path.join(ROOT, "icon.png"), "PNG", optimize=True)
    print(f"favicon.png {os.path.getsize(os.path.join(ROOT,'favicon.png'))/1024:.0f} KB")


if __name__ == "__main__":
    main()
