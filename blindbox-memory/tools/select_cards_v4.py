#!/usr/bin/env python3
"""选卡 v4：可迭代。排除池 + pHash 聚族(紧) -> 均匀取 N 张; 联系表打标后把坏图 poolIndex 写进 excludes.json 再跑."""
import argparse, glob, json, math, os, subprocess, tempfile
from PIL import Image
import numpy as np

def phash_bits(path, size=8):
    with Image.open(path) as im:
        im = im.convert("L").resize((32, 32), Image.LANCZOS)
    a = np.asarray(im, dtype=float)
    n = 32
    cos = np.cos(math.pi / n * (np.arange(n)[None, :] * 2 + 1) * np.arange(n)[:, None])
    A = np.apply_along_axis(lambda v: cos @ v, 1, a)
    A = np.apply_along_axis(lambda v: cos @ v, 0, A)
    low = A[:size, :size].flatten()
    return (low > np.median(low)).astype(np.uint8)

def grid_flag(path):
    with Image.open(path) as im:
        g = np.asarray(im.convert("L").resize((96, 96), Image.LANCZOS), dtype=float)
    rs = g.std(axis=1); cs = g.std(axis=0)
    def band(v):
        n = len(v); hits = 0
        for i in range(int(n*0.15), int(n*0.85)):
            if v[i] < 7 and v[max(0,i-5)] > 16 and v[min(n-1,i+5)] > 16:
                hits += 1
        return hits
    return band(rs) >= 2 or band(cs) >= 2

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--pool", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--count", type=int, default=48)
    ap.add_argument("--size", type=int, default=384)
    ap.add_argument("--quality", type=int, default=82)
    ap.add_argument("--family-dist", type=int, default=18)
    args = ap.parse_args()

    files = sorted(glob.glob(os.path.join(args.pool, "flux_character_*.png"))
                   + glob.glob(os.path.join(args.pool, "qwen_char_*.png")))
    excl_path = os.path.join(args.out, "excludes.json")
    excl = set()
    if os.path.exists(excl_path):
        excl = set(json.load(open(excl_path)))

    infos = []
    for i, f in enumerate(files):
        if i in excl:
            continue
        try:
            if grid_flag(f):
                continue
            infos.append({"idx": i, "file": f, "h": phash_bits(f)})
        except Exception:
            pass

    n = len(infos)
    parent = list(range(n))
    def find(a):
        while parent[a] != a:
            parent[a] = parent[parent[a]]; a = parent[a]
        return a
    for a in range(n):
        for b in range(a + 1, n):
            d = int((infos[a]["h"] != infos[b]["h"]).sum())
            adj = abs(infos[a]["idx"] - infos[b]["idx"]) <= 5
            if d <= args.family_dist or (adj and d <= 26):
                parent[find(a)] = find(b)
    fams = {}
    for a in range(n):
        fams.setdefault(find(a), []).append(infos[a])
    reps = [min(v, key=lambda x: x["idx"]) for v in fams.values()]
    reps.sort(key=lambda x: x["idx"])

    if len(reps) <= args.count:
        picked = reps
    else:
        step = len(reps) / args.count
        picked = [reps[int(k * step)] for k in range(args.count)]

    os.makedirs(args.out, exist_ok=True)
    # 清掉旧卡（保持目录与 manifest 一致）
    for f in os.listdir(args.out):
        if f.endswith(".webp"):
            os.remove(os.path.join(args.out, f))
    tmpdir = tempfile.mkdtemp(prefix="bbm_")
    manifest = []
    for k, x in enumerate(picked):
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
    print(json.dumps({"candidates": n, "families": len(fams), "selected": len(manifest)}))

if __name__ == "__main__":
    main()
