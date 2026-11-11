#!/usr/bin/env python3
"""从 iNES ROM 里解码 CHR 图块，输出可视化图集。

用法：python3 tools/extract_chr.py
输出：assets/extracted/chr/bank-XX.png（每张 128x256，16x32 个 8x8 图块）
      assets/extracted/chr/contact-XX.png（4 个 bank 拼一张，便于目视）
"""
from __future__ import annotations

import pathlib

from PIL import Image, ImageDraw

ROM = pathlib.Path(__file__).resolve().parents[2] / "srw2-web" / "rom" / "srw2.nes"
OUT = pathlib.Path(__file__).resolve().parents[1] / "assets" / "extracted" / "chr"

# NES 常用灰阶（0..3）
GRAY = [(10, 12, 18), (78, 88, 108), (158, 172, 196), (240, 246, 255)]
# 一套偏“机甲”的彩色调色板，便于辨认
COLOR = [(8, 10, 16), (196, 60, 60), (90, 170, 255), (245, 245, 230)]


def decode_tile(data: bytes, offset: int) -> list[list[int]]:
    """一个 8x8 2bpp 图块 -> 8 行、每行 8 个 0..3 的索引"""
    px = [[0] * 8 for _ in range(8)]
    for y in range(8):
        lo = data[offset + y]
        hi = data[offset + y + 8]
        for x in range(8):
            bit = 7 - x
            px[y][x] = ((lo >> bit) & 1) | (((hi >> bit) & 1) << 1)
    return px


def render_tile(draw: ImageDraw.ImageDraw, px: list[list[int]], ox: int, oy: int, pal, scale: int = 1):
    for y in range(8):
        for x in range(8):
            c = pal[px[y][x]]
            draw.rectangle([ox + x * scale, oy + y * scale, ox + x * scale + scale - 1, oy + y * scale + scale - 1], fill=c)


def main() -> None:
    rom = ROM.read_bytes()
    assert rom[:4] == b"NES\x1a"
    chr_banks = rom[5]
    chr_start = 16 + rom[4] * 16384
    OUT.mkdir(parents=True, exist_ok=True)

    tiles_per_bank = 512  # 8KB / 16
    cols, rows = 16, 32
    cell = 9  # 8px + 1px 分隔

    sheets = []
    for bank in range(chr_banks):
        base = chr_start + bank * 8192
        img = Image.new("RGB", (cols * cell + 1, rows * cell + 1), (24, 26, 34))
        d = ImageDraw.Draw(img)
        for i in range(tiles_per_bank):
            tx = (i % cols) * cell + 1
            ty = (i // cols) * cell + 1
            px = decode_tile(rom, base + i * 16)
            render_tile(d, px, tx, ty, GRAY)
        img.save(OUT / f"bank-{bank:02d}.png")
        sheets.append(img)

    # 4 个 bank 拼一张 contact sheet
    for i in range(0, len(sheets), 4):
        group = sheets[i:i + 4]
        w = sum(s.width for s in group) + 8 * (len(group) - 1)
        h = max(s.height for s in group)
        sheet = Image.new("RGB", (w, h), (14, 16, 22))
        x = 0
        for s in group:
            sheet.paste(s, (x, 0))
            x += s.width + 8
        sheet.save(OUT / f"contact-{i // 4:02d}.png")

    print(f"CHR banks: {chr_banks}, tiles: {chr_banks * tiles_per_bank}")
    print(OUT)


if __name__ == "__main__":
    main()
