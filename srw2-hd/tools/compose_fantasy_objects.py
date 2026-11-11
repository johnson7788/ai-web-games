#!/usr/bin/env python3
"""把单个山/树/岩石/城镇从白底抠出，合成到草地 base 上，保证整格铺满、主体唯一。"""
from __future__ import annotations
from collections import deque
import pathlib
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parents[1]
T = ROOT / "assets" / "hd" / "fantasy-tiles"
RAW = ROOT / "assets" / "hd" / "fantasy-raw"

def cutout(src: pathlib.Path) -> Image.Image:
    im = Image.open(src).convert("RGB")
    w, h = im.size
    px = im.load()
    # 从边界 flood fill 近白背景
    white = bytearray(w * h)
    q = deque()
    for x in range(w):
        for y in (0, h - 1):
            if not white[y * w + x] and min(px[x, y]) > 236:
                white[y * w + x] = 1; q.append((x, y))
    for y in range(h):
        for x in (0, w - 1):
            if not white[y * w + x] and min(px[x, y]) > 236:
                white[y * w + x] = 1; q.append((x, y))
    while q:
        x, y = q.popleft()
        for nx, ny in ((x-1,y),(x+1,y),(x,y-1),(x,y+1)):
            if 0 <= nx < w and 0 <= ny < h and not white[ny*w+nx] and min(px[nx,ny]) > 236:
                white[ny*w+nx] = 1; q.append((nx,ny))
    out = im.convert("RGBA")
    alpha = Image.frombytes("L", (w, h), bytes(0 if white[i] else 255 for i in range(w*h)))
    alpha = alpha.filter(ImageFilter.GaussianBlur(1.2))
    out.putalpha(alpha)
    bbox = out.getbbox()
    return out.crop(bbox) if bbox else out

def compose(obj: Image.Image, base: Image.Image, frac=0.78, bottom=0.96) -> Image.Image:
    base = base.convert("RGB").resize((512, 512), Image.LANCZOS)
    maxw = int(512 * frac); maxh = int(512 * frac)
    r = min(maxw / obj.width, maxh / obj.height)
    obj = obj.resize((max(1, int(obj.width*r)), max(1, int(obj.height*r))), Image.LANCZOS)
    canvas = Image.new("RGBA", (512, 512), (0,0,0,0))
    x = (512 - obj.width)//2
    y = int(512*bottom) - obj.height
    # 脚下软阴影
    sh = Image.new("RGBA", (512,512), (0,0,0,0)); sd = ImageDraw.Draw(sh)
    sd.ellipse([x+obj.width*0.12, y+obj.height*0.90, x+obj.width*0.88, y+obj.height*1.02], fill=(0,0,0,95))
    sh = sh.filter(ImageFilter.GaussianBlur(7))
    canvas = Image.alpha_composite(canvas, sh)
    canvas.alpha_composite(obj, (x, y))
    return Image.alpha_composite(base.convert("RGBA"), canvas).convert("RGB")

def main():
    grass = Image.open(T / "plain.webp")
    specs = {
        "mountain": (RAW / "mountain-object.png", 0.86, 0.94),
        "forest": (RAW / "forest-single.png", 0.82, 0.96),
        "rock": (RAW / "rock-single.png", 0.58, 0.97),
        "town": (RAW / "town-single.png", 0.88, 0.96),
    }
    for key, (src, frac, bottom) in specs.items():
        if not src.exists():
            print("missing", src); continue
        compose(cutout(src), grass, frac, bottom).save(T / f"{key}.webp", "WEBP", quality=92, method=6)
        print("composed", key)

if __name__ == "__main__":
    main()
