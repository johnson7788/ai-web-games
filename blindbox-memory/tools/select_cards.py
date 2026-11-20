#!/usr/bin/env python3
"""从 ComfyUI 素材池挑选盲盒角色卡 v2：排除名单 + pHash 去重 -> 裁方 384 WebP."""
import argparse, glob, json, math, os, subprocess, sys, tempfile
from PIL import Image

EXCLUDE = {  # 四宫格(接缝检测) + 躺尸/纯道具(视觉核验)
    6, 10, 11, 14, 16, 17, 18, 20, 21, 23, 24, 28, 29, 96, 107, 124,  # grid
    120, 320,                                                       # lying / prop
}

def phash(img, size=8, highfreqfactor=4):
    img_size = size * highfreqfactor
    im = img.convert("L").resize((img_size, img_size), Image.LANCZOS)
    px = list(im.getdata())
    # DCT-II
    def dct1(v):
        n = len(v); out = []
        for k in range(n):
            s = 0.0
            for t, x in enumerate(v):
                s += x * math.cos(math.pi * (2 * t + 1) * k / (2 * n))
            out.append(s)
        return out
    rows = [px[r*img_size:(r+1)*img_size] for r in range(img_size)]
    dct_rows = [dct1(r) for r in rows]
    cols = [[dct_rows[r][c] for r in range(img_size)] for c in range(img_size)]
    dct = [dct1(c) for c in cols]
    flat = [dct[r][c] for r in range(size) for c in range(size)]
    med = sorted(flat)[len(flat)//2]
    return [1 if v > med else 0 for v in flat]

def hdist(a, b):
    return sum(x != y for x, y in zip(a, b))

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pool", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--count", type=int, default=64)
    ap.add_argument("--size", type=int, default=384)
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--min-dist", type=int, default=11)
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.pool, "flux_character_*.png"))
                   + glob.glob(os.path.join(args.pool, "qwen_char_*.png")))
    pool = []
    for i, f in enumerate(files):
        if i in EXCLUDE:
            continue
        try:
            with Image.open(f) as im:
                im.draft("RGB", (64, 64))
                pool.append((i, f, phash(im)))
        except Exception:
            pass

    selected = []
    cand = list(pool)
    while cand and len(selected) < args.count:
        if not selected:
            selected.append(cand.pop(0)); continue
        best_i, best_d = 0, -1
        for j, (i, f, h) in enumerate(cand):
            d = min(hdist(h, sh[2]) for sh in selected)
            if d > best_d:
                best_d, best_j = d, j
        if best_d < args.min_dist and len(selected) >= args.count * 0.75:
            break
        selected.append(cand.pop(best_j))

    os.makedirs(args.out, exist_ok=True)
    tmpdir = tempfile.mkdtemp(prefix="bbm_")
    manifest = []
    for k, (i, f, h) in enumerate(selected):
        with Image.open(f) as im:
            im = im.convert("RGB")
            w, hh = im.size
            side = min(w, hh)
            left, top = (w - side) // 2, (hh - side) // 2
            im = im.crop((left, top, left + side, top + side)).resize((args.size, args.size), Image.LANCZOS)
            tmp_png = os.path.join(tmpdir, f"card_{k:02d}.png")
            im.save(tmp_png)
        out_webp = os.path.join(args.out, f"card_{k:02d}.webp")
        subprocess.run(["cwebp", "-quiet", "-q", str(args.quality), tmp_png, "-o", out_webp], check=True)
        manifest.append({"id": f"card_{k:02d}", "poolIndex": i, "src": os.path.basename(f), "file": f"card_{k:02d}.webp"})

    with open(os.path.join(args.out, "manifest.json"), "w") as fp:
        json.dump(manifest, fp, indent=2)
    print(json.dumps({"selected": len(manifest), "pool": len(pool), "out": args.out}))

if __name__ == "__main__":
    main()
