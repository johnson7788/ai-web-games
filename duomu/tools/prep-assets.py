#!/usr/bin/env python3
"""把 assets/raw 里的生成原图加工成运行资源：裁切、去底、缩放、压体积，并写 manifest。

规则（来自 playbook）：
  · 单文件 <= 512KB，总量 <= 4MB
  · 每张图都要有来源记录（模型 / 原文件 / 提示词 / 散列）
"""
import hashlib
import json
import os
import sys

from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "docs/source-art/raw")
OUT = os.path.join(ROOT, "assets/img")

PROMPTS = {}
for name in ("art-prompts.json", "art-prompts-2.json"):
    p = os.path.join(ROOT, "tools", name)
    if os.path.exists(p):
        PROMPTS.update(json.load(open(p, encoding="utf-8")))

manifest = {"generatedBy": "tools/prep-assets.py", "model": "dashscope/qwen-image-3.0", "assets": {}}


def sha(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def save_png(img, name, prompt_key=None, quality_note="", webp=True):
    """带透明通道的一律走 WebP：体积约为 PNG 的 1/6，现代浏览器全支持。"""
    if webp and name.endswith(".png"):
        name = name[:-4] + ".webp"
    path = os.path.join(OUT, name)
    if name.endswith(".webp"):
        img.save(path, "WEBP", quality=86, method=6)
    else:
        img.save(path, "PNG", optimize=True)
    size = os.path.getsize(path)
    manifest["assets"][name] = {
        "w": img.width, "h": img.height, "bytes": size,
        "promptKey": prompt_key, "note": quality_note,
        "prompt": PROMPTS.get(prompt_key, ""),
        "source": "ai-generated",
    }
    print(f"  {name:28s} {img.width}x{img.height}  {size/1024:6.1f} KB")
    return size


def save_jpg(img, name, quality=86):
    path = os.path.join(OUT, name)
    img.convert("RGB").save(path, "JPEG", quality=quality, optimize=True, progressive=True)
    size = os.path.getsize(path)
    manifest["assets"][name] = {
        "w": img.width, "h": img.height, "bytes": size,
        "promptKey": name.split(".")[0], "prompt": PROMPTS.get(name.split(".")[0], ""),
        "source": "ai-generated",
    }
    print(f"  {name:28s} {img.width}x{img.height}  {size/1024:6.1f} KB")
    return size


def cutout(img):
    """白底 → 透明。

    rembg 在这批「大面积同色 + 细长主体」的图上会把主体本身判成背景
    （树干、玉牌都被整块抠空过），所以默认走白底键控，阈值拉陡一点把
    投影一起吃掉；只有显式要软边缘时才用 rembg。
    """
    import numpy as np
    arr = np.array(img.convert("RGBA")).astype(np.int16)
    rgb = arr[..., :3]
    # 到纯白的距离：越接近白越透明
    dist = 255 - rgb.mean(axis=2)
    alpha = np.clip((dist - 14) / 26.0, 0, 1)
    arr[..., 3] = (alpha * arr[..., 3] / 255.0 * 255).astype(np.int16)
    return Image.fromarray(arr.astype(np.uint8), "RGBA")


def trim(img, pad=6):
    bb = img.getbbox()
    if not bb:
        return img
    x0, y0, x1, y1 = bb
    return img.crop((max(0, x0 - pad), max(0, y0 - pad), min(img.width, x1 + pad), min(img.height, y1 + pad)))


def fit(img, max_w=None, max_h=None):
    s = 1.0
    if max_w and img.width > max_w:
        s = min(s, max_w / img.width)
    if max_h and img.height > max_h:
        s = min(s, max_h / img.height)
    if s < 1:
        img = img.resize((max(1, int(img.width * s)), max(1, int(img.height * s))), Image.LANCZOS)
    return img


def clean_islands(img, min_side=26, min_frac=0.02):
    """切图后总会带进邻居的碎屑：只保留够大、够像主体的连通块。"""
    import numpy as np
    from scipy import ndimage
    a = np.array(img)
    mask = a[..., 3] > 32
    lab, cnt = ndimage.label(mask, structure=np.ones((3, 3)))
    if cnt == 0:
        return img
    sizes = ndimage.sum(mask, lab, range(1, cnt + 1))
    objs = ndimage.find_objects(lab)
    best = int(np.argmax(sizes))
    keep = np.zeros(cnt + 1, bool)
    for i in range(cnt):
        h = objs[i][0].stop - objs[i][0].start
        w = objs[i][1].stop - objs[i][1].start
        if w < min_side or h < min_side:
            continue
        if sizes[i] < sizes[best] * min_frac:
            continue
        keep[i + 1] = True
    keep[best + 1] = True
    a[..., 3] = np.where(keep[lab], a[..., 3], 0)
    out = Image.fromarray(a, "RGBA")
    return out.crop(out.getbbox())


def main():
    os.makedirs(OUT, exist_ok=True)
    print("加工运行资源 →", OUT)

    # 背景：直接转 JPG
    for key in ("bg_wind", "bg_fire", "bg_thunder"):
        src = os.path.join(RAW, key + ".png")
        if os.path.exists(src):
            img = Image.open(src).convert("RGB").resize((720, 1280), Image.LANCZOS)
            save_jpg(img, key + ".jpg")
        else:
            print(f"  !! 缺 {key}")

    # 横木段：白底去背。
    #  · log.png      —— 完整一段（带锯切面），只给最下面那节用
    #  · log_body.png —— 纯树皮带，往上无限叠成「通天建木」的树干
    src = os.path.join(RAW, "log_wide.png")
    if os.path.exists(src):
        raw = Image.open(src)
        cut = trim(cutout(raw))
        save_png(fit(cut, max_w=760), "log.png", "log_wide", "去底裁切·含锯切面")

        # 专属树皮带（可竖向拼接）优先；没有再退回从木段里裁一条
        bark = os.path.join(RAW, "bark_strip.png")
        if os.path.exists(bark):
            body = trim(cutout(Image.open(bark)))
            save_png(fit(body, max_w=760), "log_body.png", "bark_strip", "专属树皮带·竖向拼接")
        else:
            body = raw.crop((int(raw.width * 0.03), int(raw.height * 0.38),
                             int(raw.width * 0.97), int(raw.height * 0.93)))
            body = trim(cutout(body))
            save_png(fit(body, max_w=760), "log_body.png", "log_wide", "树皮带·叠加成树干")

    # 整根树干：竖版一次贴满
    src = os.path.join(RAW, "trunk_tall.png")
    if os.path.exists(src):
        body = trim(cutout(Image.open(src)))
        save_png(fit(body, max_w=440), "trunk.png", "trunk_tall", "竖版整根树干·去底")

    # 雷符：保留黑底，用加色混合绘制
    src = os.path.join(RAW, "brand_rune.png")
    if os.path.exists(src):
        img = Image.open(src).convert("RGB").resize((512, 512), Image.LANCZOS)
        save_jpg(img, "rune.jpg", quality=88)
        manifest["assets"]["rune.jpg"]["promptKey"] = "brand_rune"
        manifest["assets"]["rune.jpg"]["note"] = "黑底·加色混合"

    # 玉牌面板：去背，给九宫格用
    src = os.path.join(RAW, "ui_panel.png")
    if os.path.exists(src):
        img = Image.open(src)
        cut = trim(cutout(img), pad=2)
        cut = fit(cut, max_w=768, max_h=768)
        save_png(cut, "panel.png", "ui_panel", "去底·九宫格")

    # 角色：从 raw 里切出来的单帧，去碎屑后压到合适尺寸
    for team in ("red", "blue"):
        for pose in ("idle", "raise", "strike", "dead"):
            src = os.path.join(RAW, f"hero_{team}_{pose}.png")
            if not os.path.exists(src):
                print(f"  !! 缺 hero_{team}_{pose}")
                continue
            img = clean_islands(Image.open(src).convert("RGBA"))
            save_png(fit(img, max_h=380), f"hero_{team}_{pose}.png", None, "生成角色图集切分 + 去底")

    total = sum(a["bytes"] for a in manifest["assets"].values())
    manifest["totalBytes"] = total
    with open(os.path.join(ROOT, "assets/manifest.json"), "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
    print(f"\n合计 {total/1024/1024:.2f} MB / 预算 4.00 MB")
    over = [k for k, v in manifest["assets"].items() if v["bytes"] > 512 * 1024]
    if over:
        print("超 512KB 的文件：", over)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
