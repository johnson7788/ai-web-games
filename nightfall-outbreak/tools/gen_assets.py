#!/usr/bin/env python3
"""gen_assets.py — 程序化美术产物（零生图）：横版海报 + 开屏背景 + 区域/模式卡。

海报 ≤200KB / 800×450；既是 og:image 也是开屏整屏底图。
海报刻意不画任何文字：开屏的游戏名艺术字由 DOM 叠加，画进图里会出现两层标题。
所有图形都由 Pillow 绘制，不引用任何第三方素材或在线模型。
"""
from __future__ import annotations

import math
import random
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent.parent
random.seed(20261111)


def font(size, bold=True):
    cands = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
        "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    ]
    for c in cands:
        try:
            return ImageFont.truetype(c, size)
        except OSError:
            continue
    return ImageFont.load_default()


def sky(w, h, moon_x, moon_y, moon_r):
    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        v = y / h
        # 顶部深靛 → 地平线冷青灰 → 地面墨绿
        r = int(10 + 26 * v + 16 * max(0, v - 0.7))
        g = int(16 + 40 * v + 10 * max(0, v - 0.7))
        b = int(30 + 52 * v - 8 * max(0, v - 0.7))
        for x in range(w):
            # 血月附近的暖辉 + 低频噪点
            d = math.hypot(x - moon_x, y - moon_y) / max(1, moon_r * 4)
            glow = max(0.0, 1.0 - d) ** 2
            n = random.randint(-5, 5)
            px[x, y] = (
                min(255, r + int(72 * glow) + n),
                min(255, g + int(30 * glow) + n),
                min(255, b + int(8 * glow) + n),
            )
    return im


def draw_scene(w, h, weapon=True):
    moon_x, moon_y = int(w * 0.78), int(h * 0.30)
    moon_r = int(h * 0.115)
    im = sky(w, h, moon_x, moon_y, moon_r)
    d = ImageDraw.Draw(im, "RGBA")

    # 血月 + 光晕
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    for i in range(7, 0, -1):
        rr = moon_r * (1 + i * 0.42)
        hd.ellipse((moon_x - rr, moon_y - rr, moon_x + rr, moon_y + rr),
                   fill=(255, 92, 48, 9 + (7 - i) * 3))
    im = Image.alpha_composite(im.convert("RGBA"), halo.filter(ImageFilter.GaussianBlur(14)))
    d = ImageDraw.Draw(im, "RGBA")
    d.ellipse((moon_x - moon_r, moon_y - moon_r, moon_x + moon_r, moon_y + moon_r),
              fill=(255, 176, 104, 255))
    d.ellipse((moon_x - moon_r * 0.82, moon_y - moon_r * 0.86, moon_x + moon_r * 0.3, moon_y + moon_r * 0.1),
              fill=(255, 218, 166, 70))

    # 云带
    for i in range(14):
        cy = int(h * (0.10 + 0.36 * random.random()))
        cx = random.randint(-100, w)
        cw = random.randint(90, 320)
        d.ellipse((cx, cy, cx + cw, cy + int(h * 0.035)), fill=(150, 170, 178, 16))

    # 远景城市剪影
    horizon = int(h * 0.68)
    for i in range(26):
        x = i * (w // 24) - 20
        bw = random.randint(22, 62)
        bh = random.randint(int(h * 0.08), int(h * 0.30))
        d.rectangle((x, horizon - bh, x + bw, horizon), fill=(11, 20, 26, 220))
        for wy in range(horizon - bh + 8, horizon - 6, 14):
            if random.random() < 0.35:
                d.rectangle((x + 6, wy, x + 10, wy + 5), fill=(255, 138, 62, 110))
    # 破损天线
    for i in range(7):
        x = int(w * (0.06 + i * 0.14)) + random.randint(-12, 12)
        top = horizon - random.randint(60, 150)
        d.line((x, horizon, x, top), fill=(8, 16, 20, 220), width=2)
        d.line((x - 9, top + 20, x + 9, top + 8), fill=(8, 16, 20, 220), width=2)

    # 地面 + 雾
    d.rectangle((0, horizon, w, h), fill=(13, 22, 22, 255))
    fog = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fog)
    for i in range(16):
        y = horizon - 20 + i * (h - horizon) / 14
        fd.ellipse((-60, y, w + 60, y + 42), fill=(120, 152, 156, 7))
    im = Image.alpha_composite(im, fog.filter(ImageFilter.GaussianBlur(12)))
    d = ImageDraw.Draw(im, "RGBA")

    # 前景：枯树 + 僵尸剪影 + 士兵持枪剪影
    def tree(x, scale):
        top = horizon - int(150 * scale)
        d.line((x, horizon + 20, x, top), fill=(5, 10, 12, 255), width=max(2, int(7 * scale)))
        for k in range(5):
            y = top + k * int(32 * scale)
            side = -1 if k % 2 else 1
            d.line((x, y, x + side * int(48 * scale), y - int(38 * scale)),
                   fill=(5, 10, 12, 255), width=max(1, int(3 * scale)))

    tree(int(w * 0.09), 1.15)
    tree(int(w * 0.94), 0.9)

    # 远处僵尸群（剪影 + 弱点红光）
    for i in range(9):
        zx = int(w * (0.20 + i * 0.067)) + random.randint(-12, 12)
        zh = int(h * (0.12 + 0.06 * random.random()))
        zy = horizon - zh + int(h * 0.03)
        col = (16, 27, 28, 235)
        d.ellipse((zx - 8, zy - 12, zx + 8, zy + 4), fill=col)
        d.rectangle((zx - 9, zy + 2, zx + 9, zy + zh // 2), fill=col)
        d.line((zx - 5, zy + zh // 2, zx - 7, zy + zh), fill=col, width=4)
        d.line((zx + 5, zy + zh // 2, zx + 9, zy + zh), fill=col, width=4)
        d.line((zx - 8, zy + 14, zx - 20, zy + 26), fill=col, width=3)
        d.ellipse((zx - 3, zy - 8, zx + 1, zy - 4), fill=(255, 64, 48, 210))

    if weapon:
        # 右下第一人称枪械剪影 + 枪口火光（只画场景，不画游戏名/水印）
        gx, gy = int(w * 0.62), int(h * 0.96)
        d.polygon([(gx, gy), (gx + int(w * 0.30), gy - int(h * 0.10)),
                   (gx + int(w * 0.36), gy - int(h * 0.03)), (gx + int(w * 0.06), gy)],
                  fill=(24, 30, 32, 255))
        d.polygon([(gx + int(w * 0.30), gy - int(h * 0.10)), (gx + int(w * 0.335), gy - int(h * 0.13)),
                   (gx + int(w * 0.365), gy - int(h * 0.07)), (gx + int(w * 0.33), gy - int(h * 0.065))],
                  fill=(42, 50, 52, 255))
        fx, fy = gx + int(w * 0.335), gy - int(h * 0.125)
        flare = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        fl = ImageDraw.Draw(flare)
        for i in range(6, 0, -1):
            rr = int(h * 0.02) * i
            fl.ellipse((fx - rr, fy - rr, fx + rr, fy + rr), fill=(255, 150 - i * 12, 42, 30 + (6 - i) * 18))
        im = Image.alpha_composite(im, flare.filter(ImageFilter.GaussianBlur(6)))
        d = ImageDraw.Draw(im, "RGBA")
        d.ellipse((fx - 8, fy - 8, fx + 8, fy + 8), fill=(255, 244, 205, 255))
    return im.convert("RGB")


def _byte(v):
    return max(0, min(255, int(v)))


def card_scene(w, h, idx, mood=0.0):
    """区域/模式卡背景：同一套废土夜色语法，逐关偏移月位、色温、尸群密度与火光。
    idx 1..10 对应 10 个区域；mood 用于模式卡额外拉冷暖（0 冷 / 1 灼热）。
    纯 Pillow 程序化绘制，不引入任何外部素材，也不触发生图通道。
    """
    tone = max(0.0, min(1.0, (idx - 1) / 9.0))
    boss = idx in (5, 10)
    warm = max(tone * 0.75, mood)
    moon_x = int(w * (0.60 + 0.04 * (idx % 6)))
    moon_y = int(h * (0.24 + 0.05 * (idx % 4)))
    moon_r = max(12, int(h * (0.12 + 0.03 * (idx % 3))))

    im = Image.new("RGB", (w, h))
    px = im.load()
    for y in range(h):
        v = y / h
        r = 7 + 24 * v + 30 * warm * v + (7 if boss else 0)
        g = 15 + 40 * v - 9 * warm + (3 if boss else 0)
        b = 29 + 57 * v - 24 * warm
        for x in range(w):
            d = math.hypot(x - moon_x, y - moon_y) / max(1.0, moon_r * 4)
            glow = max(0.0, 1.0 - d) ** 2
            n = random.randint(-4, 4)
            px[x, y] = (_byte(r + 96 * glow + n), _byte(g + 44 * glow + n), _byte(b + 16 * glow + n))

    layer = im.convert("RGBA")
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    for i in range(6, 0, -1):
        rr = moon_r * (1 + i * 0.5)
        hd.ellipse((moon_x - rr, moon_y - rr, moon_x + rr, moon_y + rr),
                   fill=(255, 92, 44, 8 + (6 - i) * 4))
    layer = Image.alpha_composite(layer, halo.filter(ImageFilter.GaussianBlur(max(3, int(h * 0.02)))))
    d = ImageDraw.Draw(layer, "RGBA")
    d.ellipse((moon_x - moon_r, moon_y - moon_r, moon_x + moon_r, moon_y + moon_r),
              fill=(255, 172 + int(20 * warm), 104, 255))
    d.ellipse((moon_x - moon_r * 0.75, moon_y - moon_r * 0.85, moon_x + moon_r * 0.25, moon_y),
              fill=(255, 226, 178, 60))

    for _ in range(10):
        cy = int(h * (0.08 + 0.34 * random.random()))
        cx = random.randint(-int(w * 0.2), w)
        cw = random.randint(int(w * 0.16), int(w * 0.55))
        d.ellipse((cx, cy, cx + cw, cy + int(h * 0.035)), fill=(140, 168, 176, 15))

    horizon = int(h * 0.68)
    for i in range(22):
        x = i * (w // 20) - 10
        bw = random.randint(int(w * 0.025), int(w * 0.075))
        bh = random.randint(int(h * 0.07), int(h * 0.30))
        d.rectangle((x, horizon - bh, x + bw, horizon), fill=(9, 18, 24, 225))
        for wy in range(horizon - bh + 6, horizon - 5, max(6, int(h * 0.045))):
            if random.random() < 0.28:
                d.rectangle((x + 3, wy, x + 6, wy + 3), fill=(255, 140, 64, 105))
    for i in range(5):
        x = int(w * (0.08 + i * 0.2)) + random.randint(-8, 8)
        top = horizon - random.randint(int(h * 0.18), int(h * 0.42))
        d.line((x, horizon, x, top), fill=(7, 14, 18, 230), width=2)
        d.line((x - 6, top + 12, x + 6, top + 5), fill=(7, 14, 18, 230), width=2)

    # 地面：地平线被月光/雾照亮，越近越暗；这样纯黑剪影才有轮廓可读
    for y in range(horizon, h):
        v = (y - horizon) / max(1, h - horizon)
        base = (38 - int(26 * v), 56 - int(38 * v), 60 - int(42 * v))
        d.line((0, y, w, y), fill=(*base, 255))
    for i in range(5):
        yy = horizon + int((h - horizon) * (0.10 + i * 0.19))
        d.ellipse((-30, yy, w + 30, yy + int(h * 0.035)), fill=(120, 156, 160, 12))

    ink = (3, 8, 10, 255)
    rim = (150, 190, 196, 90)
    # 前景枯树 / 墓碑 / 围栏
    def tree(x, s):
        top = horizon - int(h * 0.42 * s)
        d.line((x, horizon + 8, x, top), fill=ink, width=max(2, int(0.012 * h * s)))
        d.line((x + 2, horizon + 8, x + 2, top), fill=rim, width=1)
        for k in range(4):
            y = top + k * int(h * 0.09 * s)
            side = -1 if k % 2 else 1
            d.line((x, y, x + side * int(w * 0.075 * s), y - int(h * 0.10 * s)),
                   fill=ink, width=max(1, int(0.009 * h * s)))

    tree(int(w * 0.07), 1.05)
    tree(int(w * 0.95), 0.80)
    for i in range(5):
        gx = int(w * (0.16 + i * 0.17)) + random.randint(-6, 6)
        gh = int(h * (0.09 + 0.05 * random.random()))
        d.rounded_rectangle((gx, horizon - gh, gx + int(w * 0.035), horizon + 4),
                            radius=max(2, int(w * 0.012)), fill=ink)
        d.line((gx + 1, horizon - gh + 2, gx + 1, horizon + 2), fill=rim, width=1)

    # 尸群密度随关卡上升；首领关多一只放大的剪影
    crowd = 3 + idx
    for i in range(crowd):
        zx = int(w * (0.10 + (i + 0.5) * 0.82 / crowd)) + random.randint(-7, 7)
        zh = int(h * (0.13 + 0.07 * random.random()))
        zy = horizon - zh + int(h * 0.035)
        d.ellipse((zx - 6, zy - 9, zx + 6, zy + 3), fill=ink)
        d.rectangle((zx - 7, zy + 2, zx + 7, zy + zh // 2), fill=ink)
        d.line((zx - 4, zy + zh // 2, zx - 6, zy + zh), fill=ink, width=3)
        d.line((zx + 4, zy + zh // 2, zx + 7, zy + zh), fill=ink, width=3)
        d.ellipse((zx - 4, zy - 7, zx + 1, zy - 2), fill=(255, 74, 48, 235))
    if boss:
        bx, bh = int(w * 0.5), int(h * 0.34)
        d.ellipse((bx - 20, horizon - bh, bx + 20, horizon - bh + 32), fill=ink)
        d.rectangle((bx - 26, horizon - bh + 28, bx + 26, horizon + 6), fill=ink)
        d.line((bx - 26, horizon - bh + 40, bx - 40, horizon - bh + 62), fill=ink, width=7)
        d.line((bx + 26, horizon - bh + 40, bx + 40, horizon - bh + 62), fill=ink, width=7)
        d.ellipse((bx - 7, horizon - bh + 38, bx + 7, horizon - bh + 52), fill=(255, 198, 92, 245))

    if idx >= 6 or mood > 0.7:
        fx, fy = int(w * (0.24 + 0.12 * (idx % 3))), horizon + int(h * 0.06)
        flare = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        fl = ImageDraw.Draw(flare)
        for i in range(6, 0, -1):
            rr = int(h * 0.035) * i
            fl.ellipse((fx - rr, fy - rr, fx + rr, fy + rr), fill=(255, 138 - i * 10, 44, 16 + (6 - i) * 12))
        layer = Image.alpha_composite(layer, flare.filter(ImageFilter.GaussianBlur(max(2, int(h * 0.012)))))
        d = ImageDraw.Draw(layer, "RGBA")

    fog = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    fd = ImageDraw.Draw(fog)
    for i in range(8):
        y = horizon - int(h * 0.06) + i * (h - horizon) / 7
        fd.ellipse((-40, y, w + 40, y + int(h * 0.10)), fill=(120, 156, 160, 8))
    layer = Image.alpha_composite(layer, fog.filter(ImageFilter.GaussianBlur(max(2, int(h * 0.015)))))

    # 底部压暗，保证 DOM 上的编号 / 标题始终可读
    shade = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shade)
    for y in range(int(h * 0.58), h):
        a = int(112 * max(0.0, (y - h * 0.58) / (h * 0.42)) ** 1.4)
        sd.line((0, y, w, y), fill=(3, 10, 14, a))
    layer = Image.alpha_composite(layer, shade)
    return layer.convert("RGB")


def generate_cards():
    """10 张区域缩略图 + 3 张模式卡背景；全部 WebP，单张控制在 ~30KB 内。"""
    out = ROOT / "assets" / "images"
    sectors = out / "sectors"
    modes = out / "modes"
    sectors.mkdir(parents=True, exist_ok=True)
    modes.mkdir(parents=True, exist_ok=True)
    sizes = []
    for i in range(1, 11):
        im = card_scene(360, 220, i)
        p = sectors / f"sector-{i:02d}.webp"
        im.save(p, "WEBP", quality=72, method=5)
        sizes.append(p.stat().st_size // 1024)
    for name, idx, mood in (("operations", 2, 0.0), ("survival", 6, 0.45), ("nightmare", 10, 1.0)):
        im = card_scene(560, 320, idx, mood=mood)
        p = modes / f"{name}.webp"
        im.save(p, "WEBP", quality=72, method=5)
        sizes.append(p.stat().st_size // 1024)
    print(f"[cards] 10 sectors + 3 modes -> assets/images  ({min(sizes)}~{max(sizes)}KB each)")


def main():
    generate_cards()
    random.seed(20261111)          # 卡片不扰动海报/背景的既有构图
    # 海报：800×450，JPEG ≤200KB；纯场景，文字全部交给开屏 DOM
    poster = draw_scene(800, 450, weapon=True)
    p = ROOT / "poster.jpg"
    for q in (86, 80, 72, 64):
        poster.save(p, "JPEG", quality=q, optimize=True)
        if p.stat().st_size <= 200 * 1024:
            break
    print(f"[poster] {p.name} {p.stat().st_size // 1024}KB  {poster.size}")

    bg = draw_scene(1280, 720, weapon=False)
    bp = ROOT / "assets" / "images" / "bg_loading.webp"
    bp.parent.mkdir(parents=True, exist_ok=True)
    bg.save(bp, "WEBP", quality=68, method=5)
    print(f"[bg] {bp.name} {bp.stat().st_size // 1024}KB  {bg.size}")


if __name__ == "__main__":
    main()
