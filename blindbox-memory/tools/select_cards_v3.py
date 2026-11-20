#!/usr/bin/env python3
"""选卡 v3：网格检测(接缝+周期性) + pHash 聚类去族 + 位置错开 -> 裁方 WebP."""
import argparse, glob, json, math, os, subprocess, sys, tempfile
from PIL import Image
import numpy as np

def phash_bits(path, size=8):
    with Image.open(path) as im:
        im = im.convert("L").resize((32, 32), Image.LANCZOS)
    a = np.asarray(im, dtype=float)
    # 手工 DCT（取左上 8x8）
    n = 32
    cos = np.cos(math.pi / n * (np.arange(n)[None, :] * 2 + 1) * np.arange(n)[:, None])  # (k, t)
    A = np.apply_along_axis(lambda v: cos @ v, 1, a)   # 行 DCT
    A = np.apply_along_axis(lambda v: cos @ v, 0, A)   # 列 DCT
    low = A[:size, :size].flatten()
    med = np.median(low)
    return (low > med).astype(np.uint8)

def grid_score(path):
    """0-1，多面板拼图可能性。"""
    with Image.open(path) as im:
        g = np.asarray(im.convert("L").resize((96, 96), Image.LANCZOS), dtype=float)
    rs = g.std(axis=1); cs = g.std(axis=0)
    def band(v):
        n = len(v); hits = 0
        for i in range(int(n*0.15), int(n*0.85)):
            if v[i] < 7 and v[max(0,i-5)] > 16 and v[min(n-1,i+5)] > 16:
                hits += 1
        return hits
    # 周期性：行 i 与行 i+32 / i+48 的相似度（面板对齐）
    def periodic(a):
        best = 0
        for k in (24, 32, 48):
            if a.shape[0] > k:
                d = np.abs(a[k:, :] - a[:-k, :]).mean()
                best = max(best, 1.0 / (1.0 + d / 8))
        return best
    return (band(rs) >= 2 or band(cs) >= 2), periodic(g)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pool", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--count", type=int, default=96)
    ap.add_argument("--final", type=int, default=64)
    ap.add_argument("--size", type=int, default=384)
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--family-dist", type=int, default=14)
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.pool, "flux_character_*.png"))
                   + glob.glob(os.path.join(args.pool, "qwen_char_*.png")))
    infos = []
    for i, f in enumerate(files):
        try:
            grid, per = grid_score(f)
            h = phash_bits(f)
            infos.append({"idx": i, "file": f, "grid": grid, "per": per, "h": h})
        except Exception:
            pass

    # 1) 砍掉拼图
    kept = [x for x in infos if not x["grid"]]

    # 2) 聚类去族：pHash 距离 <= family-dist 或 (编号相邻 <=3 且距离 <= 22) 视为同族
    n = len(kept)
    parent = list(range(n))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for a in range(n):
        for b in range(a + 1, n):
            d = int((kept[a]["h"] != kept[b]["h"]).sum())
            adj = abs(kept[a]["idx"] - kept[b]["idx"]) <= 3
            if d <= args.family_dist or (adj and d <= 22):
                parent[find(a)] = find(b)
    fams = {}
    for a in range(n):
        fams.setdefault(find(a), []).append(kept[a])

    # 3) 每族取周期性最低（最像单图）的一张
    reps = [min(v, key=lambda x: x["per"]) for v in fams.values()]
    reps.sort(key=lambda x: x["idx"])

    # 4) 均匀错开编号取 count 张（避免同批次色系扎堆）
    step = max(1, len(reps) // args.count)
    picked = reps[::step][:args.count]

    os.makedirs(args.out, exist_ok=True)
    tmpdir = tempfile.mkdtemp(prefix="bbm_")
    manifest = []
    for k, x in enumerate(picked[:args.final]):
        with Image.open(x["file"]) as im:
            im = im.convert("RGB")
            w, hh = im.size
            side = min(w, hh)
            im = im.crop(((w-side)//2, (hh-side)//2, (w-side)//2+side, (hh-side)//2+side))
            im = im.resize((args.size, args.size), Image.LANCZOS)
            tmp_png = os.path.join(tmpdir, f"card_{k:02d}.png")
            im.save(tmp_png)
        out_webp = os.path.join(args.out, f"card_{k:02d}.webp")
        subprocess.run(["cwebp", "-quiet", "-q", str(args.quality), tmp_png, "-o", out_webp], check=True)
        manifest.append({"id": f"card_{k:02d}", "poolIndex": x["idx"], "src": os.path.basename(x["file"]), "file": f"card_{k:02d}.webp"})

    with open(os.path.join(args.out, "manifest.json"), "w") as fp:
        json.dump(manifest, fp, indent=2)
    print(json.dumps({"pool": len(infos), "afterGrid": len(kept), "families": len(fams), "selected": len(manifest)}))

if __name__ == "__main__":
    main()
