#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
生成 3D 赛车游戏的 HD PBR 贴图（可平铺 / 可直接给 three.js 用）。

产出（assets/）：
  car-albedo.jpg   2048²  车漆底色 + 赛车条纹 + 拉花 + 磨损
  car-normal.png   2048²  法线：钣金分缝、铆钉、贴纸边缘
  car-orm.png      2048²  R=AO  G=Roughness  B=Metalness（glTF 标准打包）
  road-albedo.jpg  2048²  沥青 + 车道线 + 胎痕（四方向无缝平铺）
  road-normal.png  2048²  沥青颗粒 + 标线凸起

设计取向：低模 + 霓虹，靠 PBR（法线/粗糙度/金属度）出细节，
而不是靠堆像素。所以贴图在手机上压到 1024 也不会糊。
"""
import os
import numpy as np
from PIL import Image, ImageDraw, ImageFont, ImageFilter

S = 2048
OUT = os.path.join(os.path.dirname(__file__), "..", "assets")
os.makedirs(OUT, exist_ok=True)
rng = np.random.default_rng(7)

FONT_BLACK = "/System/Library/Fonts/Supplemental/Arial Black.ttf"
FONT_BOLD = "/System/Library/Fonts/Supplemental/Arial Bold.ttf"

CYAN = np.array([0.16, 0.88, 1.00])  # 默认，运行时被参数覆盖
MAGENTA = np.array([1.00, 0.18, 0.47])
NAVY = np.array([0.055, 0.075, 0.20])
DEEP = np.array([0.03, 0.04, 0.11])


def periodic_noise(size, octaves=5, seed=1):
    """用整数频率的正弦叠加生成**四方向可平铺**的噪声。"""
    r = np.random.default_rng(seed)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32) / size
    out = np.zeros((size, size), np.float32)
    amp = 1.0
    for o in range(octaves):
        f = 2 ** o
        for _ in range(3):
            fx, fy = r.integers(-f * 2, f * 2 + 1), r.integers(-f * 2, f * 2 + 1)
            if fx == 0 and fy == 0:
                continue
            ph = r.uniform(0, 2 * np.pi)
            out += amp * np.sin(2 * np.pi * (fx * xx + fy * yy) + ph)
        amp *= 0.5
    out -= out.min()
    out /= max(out.max(), 1e-6)
    return out


def blur(a, radius):
    img = Image.fromarray((np.clip(a, 0, 1) * 255).astype(np.uint8))
    img = img.filter(ImageFilter.GaussianBlur(radius))
    return np.asarray(img).astype(np.float32) / 255.0


def normal_from_height(h, strength=2.0):
    dx = (np.roll(h, -1, axis=1) - np.roll(h, 1, axis=1)) * strength
    dy = (np.roll(h, -1, axis=0) - np.roll(h, 1, axis=0)) * strength
    nz = np.ones_like(h)
    ln = np.sqrt(dx * dx + dy * dy + nz * nz)
    n = np.stack([-dx / ln, -dy / ln, nz / ln], -1)
    return ((n * 0.5 + 0.5) * 255).astype(np.uint8)


# ---------------------------------------------------------------- 车漆
def build_car(idx, number, base_col, c1, c2, logo="PIPY", sub="NEON DRIFT"):
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S

    # 1) 底色：深海军蓝，带一点上亮下暗
    base = np.array(base_col)[None, None, :] * (1.0 - yy[..., None] * 0.45)
    base = base + np.array(base_col)[None, None, :] * 0.35 * (yy[..., None] * 0.45)

    # 2) 斜向赛车条纹（两条，青 + 品红），边缘柔化
    ang = np.pi / 4
    u = (xx * np.cos(ang) + yy * np.sin(ang)) % 1.0
    def band(center, width, soft=0.010):
        d = np.abs(((u - center + 0.5) % 1.0) - 0.5)
        return np.clip(1.0 - (d - width / 2) / soft, 0, 1)
    b_cyan = band(0.30, 0.085)
    b_mag = band(0.385, 0.032)

    # 3) 碳纤维纹理（右侧面板）
    weave = (np.sin(xx * S * 0.55) * np.sin(yy * S * 0.55))
    weave = (weave > 0.15).astype(np.float32)
    weave *= np.clip((xx - 0.62) * 8, 0, 1) * np.clip((0.98 - yy) * 8, 0, 1)
    weave = blur(weave, 1.2) * 0.55

    img = base.copy()
    img = img * (1 - b_cyan[..., None]) + np.array(c1)[None, None, :] * b_cyan[..., None]
    img = img * (1 - b_mag[..., None]) + np.array(c2)[None, None, :] * b_mag[..., None]
    img = img * (1 - weave[..., None] * 0.45) + 0.02 * weave[..., None]

    # 4) 清漆高光（顶部一条柔光带）
    sheen = np.exp(-((yy - 0.16) ** 2) / (2 * 0.10 ** 2)) * 0.22
    img = img + sheen[..., None]

    # 5) 磨损与划痕
    scratches = periodic_noise(S, 6, seed=3)
    scratches = np.clip((scratches - 0.82) * 6, 0, 1) * 0.18
    img = img + scratches[..., None]

    # 6) 贴纸 / 拉花（PIL 绘制，保留清晰边缘）
    pil = Image.fromarray((np.clip(img, 0, 1) * 255).astype(np.uint8))
    d = ImageDraw.Draw(pil)

    f_num = ImageFont.truetype(FONT_BLACK, 430)
    f_logo = ImageFont.truetype(FONT_BLACK, 190)
    f_small = ImageFont.truetype(FONT_BOLD, 64)

    # 大号码 07（带描边）
    d.text((1180, 1180), number, font=f_num, fill=(12, 14, 30), stroke_width=10, stroke_fill=(236, 244, 255))
    # 主 logo
    d.text((150, 1420), logo, font=f_logo, fill=(255, 255, 255))
    d.text((150, 1640), sub, font=f_small, fill=(255, 210, 120))
    # 侧向小字
    d.text((150, 200), "SLIPSTREAM DIVISION", font=f_small, fill=(190, 240, 255))
    # 竞技感斜切色块
    d.polygon([(0, 900), (520, 900), (430, 1010), (0, 1010)], fill=(255, 255, 255))
    d.text((60, 918), "GT-3", font=ImageFont.truetype(FONT_BLACK, 86), fill=(10, 12, 28))

    # —— 赞助商贴花（全部为虚构品牌，规避商标风险）——
    draw_sponsors(d, f_small)

    albedo = np.asarray(pil).astype(np.float32) / 255.0

    # 7) 法线：钣金分缝 + 铆钉 + 噪声
    panel = np.zeros((S, S), np.float32)
    for y in (620, 1240, 1860):
        panel += np.exp(-((np.arange(S) - y) ** 2) / (2 * 4.0 ** 2))[None, :].repeat(S, 0) * 0.0
    hgt = np.zeros((S, S), np.float32)
    for y in (620, 1240, 1860):
        band_y = np.exp(-((np.arange(S) - y) ** 2) / (2 * 5.0 ** 2))
        hgt -= band_y[:, None]
    for x in (700, 1400):
        band_x = np.exp(-((np.arange(S) - x) ** 2) / (2 * 5.0 ** 2))
        hgt -= band_x[None, :]
    # 铆钉
    for cy in (600, 1260):
        for cx in range(120, S, 190):
            hgt += 0.55 * np.exp(-(((np.arange(S)[None, :] - cx) ** 2 +
                                    (np.arange(S)[:, None] - cy) ** 2)) / (2 * 6.0 ** 2))
    hgt += periodic_noise(S, 6, seed=9) * 0.25
    normal = normal_from_height(hgt, 3.0)

    # 8) ORM
    ao = np.clip(1.0 - (np.clip(-hgt, 0, 1) * 0.8), 0.55, 1.0)
    rough = np.full((S, S), 0.22, np.float32)
    rough = rough * (1 - b_cyan) + 0.30 * b_cyan
    rough = rough * (1 - b_mag) + 0.26 * b_mag
    rough = rough * (1 - weave) + 0.58 * weave
    rough = np.clip(rough + scratches * 2.2, 0.10, 0.85)
    metal = np.full((S, S), 0.35, np.float32)
    metal = metal * (1 - weave) + 0.05 * weave
    metal = np.clip(metal + b_cyan * 0.25, 0, 1)
    orm = np.stack([ao, rough, metal], -1)

    Image.fromarray((np.clip(albedo, 0, 1) * 255).astype(np.uint8)).save(
        os.path.join(OUT, f"car-{idx}.jpg"), quality=92, subsampling=1)
    if idx == 0:
        Image.fromarray(normal).save(os.path.join(OUT, "car-normal.png"))
        Image.fromarray((np.clip(orm, 0, 1) * 255).astype(np.uint8)).save(
            os.path.join(OUT, "car-orm.png"))
    return albedo




# ---------------------------------------------------------------- 赞助商贴花
def draw_logo(d, kind, x, y, size, color=(240, 246, 255)):
    """画一个简单的虚构品牌标志"""
    c = color
    if kind == "star":                       # NOVA
        import math
        pts = []
        for i in range(8):
            a = i * math.pi / 4
            r = size if i % 2 == 0 else size * 0.34
            pts.append((x + math.cos(a) * r, y + math.sin(a) * r))
        d.polygon(pts, fill=c)
    elif kind == "helix":                    # HELIX
        d.arc([x - size, y - size, x + size, y + size], 200, 340, fill=c, width=max(3, size // 5))
        d.arc([x - size * 0.6, y - size, x + size * 1.4, y + size], 20, 160, fill=c, width=max(3, size // 5))
    elif kind == "pulse":                    # PULSE
        pts = [(x - size, y), (x - size * 0.45, y), (x - size * 0.2, y - size * 0.7),
               (x + size * 0.1, y + size * 0.7), (x + size * 0.35, y), (x + size, y)]
        d.line(pts, fill=c, width=max(3, size // 4), joint="curve")
    elif kind == "orbit":                    # ORBIT
        d.ellipse([x - size, y - size * 0.5, x + size, y + size * 0.5], outline=c, width=max(3, size // 5))
        d.ellipse([x - size * 0.16, y - size * 0.16, x + size * 0.16, y + size * 0.16], fill=c)
    elif kind == "bolt":                     # VOLT
        d.polygon([(x + size * 0.1, y - size), (x - size * 0.5, y + size * 0.12),
                   (x + size * 0.02, y + size * 0.12), (x - size * 0.12, y + size),
                   (x + size * 0.6, y - size * 0.18), (x + size * 0.06, y - size * 0.18)], fill=c)
    elif kind == "chip":                     # KERNEL
        d.rectangle([x - size * 0.7, y - size * 0.7, x + size * 0.7, y + size * 0.7], outline=c,
                    width=max(3, size // 5))
        d.rectangle([x - size * 0.28, y - size * 0.28, x + size * 0.28, y + size * 0.28], fill=c)


SPONSORS = [
    ("star", "NOVA"), ("helix", "HELIX"), ("pulse", "PULSE"),
    ("orbit", "ORBIT"), ("bolt", "VOLT"), ("chip", "KERNEL"),
]


def draw_sponsors(d, font):
    """车身侧面的一排小赞助商 + 一枚圆形徽章。位置避开号码与主 logo。"""
    y = 560
    # 半透明底板，保证贴花压在条纹上也读得清（真实拉花也是这么做的）
    d.rounded_rectangle([110, y - 26, 1330, y + 96], radius=26, fill=(6, 10, 22, 150))
    x = 130
    for i, (kind, name) in enumerate(SPONSORS[:4]):
        draw_logo(d, kind, x + 46, y + 26, 30, (232, 240, 252))
        d.text((x + 92, y + 4), name, font=font, fill=(236, 242, 255))
        x += 300
    # 徽章
    cx, cy, r = 1780, 470, 120
    d.ellipse([cx - r, cy - r, cx + r, cy + r], outline=(240, 246, 255), width=8)
    d.text((cx - 74, cy - 34), "ND", font=ImageFont.truetype(FONT_BLACK, 78), fill=(255, 220, 130))


# ---------------------------------------------------------------- 路面
def build_road():
    yy, xx = np.mgrid[0:S, 0:S].astype(np.float32) / S

    grit = periodic_noise(S, 7, seed=21)
    macro = blur(periodic_noise(S, 3, seed=22), 6)

    base = 0.055 + grit * 0.075 + macro * 0.035
    rgb = np.stack([base * 0.95, base * 0.97, base * 1.05], -1)

    # 车道线：沿 Y 方向平铺的两条虚线 + 两侧实线
    line_w = 0.012
    def vline(center, width, dash=None, phase=0.0):
        d = np.abs(((xx - center + 0.5) % 1.0) - 0.5)
        m = np.clip(1.0 - (d - width / 2) / 0.004, 0, 1)
        if dash:
            m = m * (np.sin((yy + phase) * np.pi * 2 * dash) > 0)
        return m

    edges = np.clip(vline(0.06, line_w * 2.4) + vline(0.94, line_w * 2.4), 0, 1)
    center = vline(0.5, line_w, dash=3, phase=0.1)

    white = np.array([0.90, 0.92, 0.95])
    yellow = np.array([0.95, 0.78, 0.25])
    rgb = rgb * (1 - edges[..., None]) + white * edges[..., None]
    rgb = rgb * (1 - center[..., None]) + yellow * center[..., None]

    # 胎痕：两条略暗的带
    for c in (0.28, 0.72):
        d = np.abs(((xx - c + 0.5) % 1.0) - 0.5)
        band = np.clip(1.0 - d / 0.06, 0, 1) ** 2
        rgb *= (1 - band[..., None] * 0.35)

    # 标线反光更亮一点
    rgb = np.clip(rgb + (edges + center)[..., None] * 0.05, 0, 1)

    hgt = periodic_noise(S, 7, seed=31) * 0.6 + (edges + center) * 0.5
    normal = normal_from_height(hgt, 2.2)

    Image.fromarray((rgb * 255).astype(np.uint8)).save(
        os.path.join(OUT, "road-albedo.jpg"), quality=92, subsampling=1)
    Image.fromarray(normal).save(os.path.join(OUT, "road-normal.png"))
    return rgb


if __name__ == "__main__":
    # 三款车：不同的主色 / 条纹 / 号码
    build_car(0, "07", [0.055, 0.075, 0.20], [0.16, 0.88, 1.00], [1.00, 0.18, 0.47])
    build_car(1, "21", [0.26, 0.045, 0.06], [1.00, 0.62, 0.18], [0.98, 0.96, 0.92], logo="VORTEX")
    build_car(2, "44", [0.045, 0.045, 0.055], [0.55, 1.00, 0.30], [0.36, 0.62, 1.00], logo="ARROW")
    build_road()
    for f in sorted(os.listdir(OUT)):
        p = os.path.join(OUT, f)
        print(f"{f:22s} {os.path.getsize(p)/1024/1024:5.2f} MB")
