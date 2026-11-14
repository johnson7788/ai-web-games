import numpy as np
from PIL import Image, ImageFilter

src = Image.open('art-concept/hero-sheet.png').convert('RGBA')
a = np.array(src).astype(int)
bg = np.array([54, 54, 54])
dist = np.abs(a[..., :3] - bg).sum(2)
# feather the key: 0 at <28, 1 at >70
alpha = np.clip((dist - 28) / 42.0, 0, 1)
alpha = (alpha * 255).astype(np.uint8)
# clean up: remove isolated specks by median-ish blur on the mask only
m = Image.fromarray(alpha).filter(ImageFilter.MedianFilter(3))
a[..., 3] = np.array(m)
out = Image.fromarray(a.astype(np.uint8), 'RGBA')
out.save('assets/img/_heroes_keyed.png')

density = (np.array(m) > 40).sum(0)
runs = []
start = None
for i, v in enumerate(density > 2):
    if v and start is None: start = i
    if not v and start is not None: runs.append((start, i)); start = None
if start is not None: runs.append((start, len(density)))
runs = [r for r in runs if r[1] - r[0] > 40]
print('runs', runs)

def split_run(r, n):
    lo, hi = r
    seg = density[lo:hi].astype(float)
    # smooth
    k = np.ones(9) / 9
    seg = np.convolve(seg, k, mode='same')
    cuts = []
    step = (hi - lo) / n
    for i in range(1, n):
        guess = int(lo + step * i)
        w = int(step * 0.35)
        lo2, hi2 = max(lo, guess - w), min(hi, guess + w)
        j = int(lo2 + np.argmin(seg[lo2 - lo:hi2 - lo]))
        cuts.append(j)
    bounds = [lo] + cuts + [hi]
    return [(bounds[i], bounds[i + 1]) for i in range(n)]

boxes = []
for r in runs:
    boxes.extend(split_run(r, 4))
print('boxes', boxes)

names = ['red_idle', 'red_raise', 'red_strike', 'red_dead', 'blue_idle', 'blue_raise', 'blue_strike', 'blue_dead']
mm = np.array(m)
for name, (x0, x1) in zip(names, boxes):
    sub = mm[:, max(0, x0 - 6):min(1280, x1 + 6)]
    rows = np.where((sub > 40).sum(1) > 1)[0]
    y0, y1 = int(rows.min()), int(rows.max()) + 1
    pad = 8
    bx = (max(0, x0 - 6 - pad), max(0, y0 - pad), min(1280, x1 + 6 + pad), min(720, y1 + pad))
    crop = out.crop(bx)
    crop.save(f'assets/raw/hero_{name}.png')
    print(name, bx, crop.size)
