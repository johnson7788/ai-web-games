#!/usr/bin/env python3
"""把候选池分批拼成带编号的联系表，供视觉模型质检打标签."""
import argparse, glob, os
from PIL import Image, ImageDraw

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pool", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--per-sheet", type=int, default=56)
    ap.add_argument("--cell", type=int, default=168)
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.pool, "flux_character_*.png"))
                   + glob.glob(os.path.join(args.pool, "qwen_char_*.png")))
    os.makedirs(args.out_dir, exist_ok=True)
    cols = 8
    for s in range(0, len(files), args.per_sheet):
        batch = files[s:s + args.per_sheet]
        rows = (len(batch) + cols - 1) // cols
        sheet = Image.new('RGB', (cols * args.cell, rows * args.cell), (20, 20, 26))
        d = ImageDraw.Draw(sheet)
        for i, f in enumerate(batch):
            im = Image.open(f).convert('RGB')
            w, h = im.size
            side = min(w, h)
            im = im.crop(((w-side)//2, (h-side)//2, (w-side)//2+side, (h-side)//2+side))
            im = im.resize((args.cell, args.cell), Image.LANCZOS)
            x, y = (i % cols) * args.cell, (i // cols) * args.cell
            sheet.paste(im, (x, y))
            idx = s + i
            d.rectangle([x, y, x + 46, y + 22], fill=(0, 0, 0))
            d.text((x + 6, y + 4), f"#{idx}", fill=(255, 255, 80))
        sheet = sheet.resize((sheet.width // 2, sheet.height // 2), Image.LANCZOS)
        sheet.save(os.path.join(args.out_dir, f"sheet_{s//args.per_sheet:02d}.jpg"), quality=80)
    print(json := f"sheets={ (len(files)+args.per_sheet-1)//args.per_sheet } total={len(files)}")

if __name__ == "__main__":
    main()
