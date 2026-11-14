import numpy as np
from PIL import Image, ImageDraw
from scipy import ndimage

names = ['red_idle','red_raise','red_strike','red_dead','blue_idle','blue_raise','blue_strike','blue_dead']
report = {}
for n in names:
    im = Image.open(f'assets/raw/hero_{n}.png').convert('RGBA')
    a = np.array(im)
    mask = a[..., 3] > 32
    lab, cnt = ndimage.label(mask, structure=np.ones((3, 3)))
    if cnt == 0:
        continue
    sizes = ndimage.sum(mask, lab, range(1, cnt + 1))
    order = np.argsort(sizes)[::-1]
    keep = np.zeros(cnt + 1, bool)
    biggest = sizes[order[0]]
    ys, xs = np.where(lab == order[0] + 1)
    cx, cy = xs.mean(), ys.mean()
    for idx in order:
        if sizes[idx] < biggest * 0.012:
            continue
        ys2, xs2 = np.where(lab == idx + 1)
        if abs(xs2.mean() - cx) > 160 or abs(ys2.mean() - cy) > 260:
            continue
        keep[idx + 1] = True
    a[..., 3] = np.where(keep[lab], a[..., 3], 0)
    out = Image.fromarray(a, 'RGBA')
    bb = out.getbbox()
    out = out.crop(bb)
    out.save(f'assets/img/hero_{n}.png')
    report[n] = (bb, out.size)

for k, v in report.items():
    print(k, v)

# grid contact sheet for measuring feet offsets
CELLW, CELLH = 260, 620
sheet = Image.new('RGB', (CELLW * 4, CELLH * 2), 'white')
d = ImageDraw.Draw(sheet)
for i, n in enumerate(names):
    im = Image.open(f'assets/img/hero_{n}.png')
    s = min((CELLW - 20) / im.width, (CELLH - 20) / im.height)
    im2 = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    ox = (i % 4) * CELLW + (CELLW - im2.width) // 2
    oy = (i // 4) * CELLH + (CELLH - im2.height) // 2
    sheet.paste(im2, (ox, oy), im2)
    d.text((ox + 4, oy + 4), f'{n} {im.width}x{im.height}', fill='black')
    # horizontal 50px source-space grid lines
    for g in range(0, im.height, 50):
        y = oy + int(g * s)
        d.line([(ox, y), (ox + im2.width, y)], fill=(255, 0, 0) if g % 200 == 0 else (255, 180, 180), width=1)
sheet.save('assets/img/_heroes_grid.jpg', quality=88)
print('grid ok')
