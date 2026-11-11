#!/usr/bin/env python3
"""把 80 台侧面立绘按解剖区域切成 6 层：head/torso/arm-l/arm-r/leg-l/leg-r。

不是重新画，而是对有 alpha 的原始侧面图做像素级分区，保证静止时六层叠回去
与原图完全一致；每层记录相对整图的偏移和肩/髋/颈枢轴，供骨骼播放。
"""
from __future__ import annotations
import json
import pathlib
from PIL import Image, ImageFilter
import numpy as np

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "assets" / "hd" / "units-side"
OUT = ROOT / "assets" / "hd" / "parts"
META = ROOT / "data" / "unit-parts.json"
CONFIG = ROOT / "config" / "unit-parts.js"


def main() -> int:
    keys = sorted(p.stem for p in SRC.glob("*.webp"))
    OUT.mkdir(parents=True, exist_ok=True)
    data = {}
    for key in keys:
        im = Image.open(SRC / f"{key}.webp").convert("RGBA")
        a = np.array(im)
        alpha = a[:, :, 3] > 12
        ys, xs = np.where(alpha)
        if not len(xs):
            continue
        x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
        w, h = x1 - x0, y1 - y0
        cx = (x0 + x1) / 2
        # 头/肩分界固定在 24% 高度：避免把肩甲切进头部，也避免只切到天线
        head_end = y0 + h * 0.24
        neck = int(head_end)
        hip = y0 + h * 0.58
        shoulder = min(hip - 1, neck + h * 0.06)
        side = w * 0.16
        parts = {
            "head": np.zeros_like(alpha),
            "torso": np.zeros_like(alpha),
            "arm-l": np.zeros_like(alpha),
            "arm-r": np.zeros_like(alpha),
            "leg-l": np.zeros_like(alpha),
            "leg-r": np.zeros_like(alpha),
        }
        yy, xx = np.mgrid[0:a.shape[0], 0:a.shape[1]]
        parts["head"] = alpha & (yy < head_end)
        upper = alpha & (yy >= head_end) & (yy < hip)
        parts["arm-l"] = upper & (xx < cx - side)
        parts["arm-r"] = upper & (xx > cx + side)
        parts["torso"] = upper & (xx >= cx - side) & (xx <= cx + side)
        lower = alpha & (yy >= hip)
        parts["leg-l"] = lower & (xx < cx)
        parts["leg-r"] = lower & (xx >= cx)
        # 全部 alpha 必须被六层覆盖
        cover = np.zeros_like(alpha)
        for m in parts.values():
            cover |= m
        if not np.array_equal(cover, alpha):
            # 兜底：未覆盖像素归到 torso
            parts["torso"] |= (alpha & ~cover)

        # 躯干/腿部的“底衬”：把整行 alpha 用该区域中位色填满，
        # 手臂/腿旋转后露出的是身体底色，而不是背景空洞。
        def make_back(name, ya, yb, pivot):
            # 用该区域原始像素做大半径模糊底衬：手臂/腿旋转时露出柔和的机体底色，
            # 而不是一条条中位色横带。
            region = np.zeros_like(alpha)
            region[max(0, int(ya)):min(a.shape[0], int(yb)), :] = True
            region &= alpha
            if not region.any():
                return None
            py, px = np.where(region)
            bx0, bx1, by0, by1 = int(px.min()), int(px.max()) + 1, int(py.min()), int(py.max()) + 1
            out = a.copy()
            mean = a[region][:, :3].mean(axis=0).astype(np.uint8)
            out[region, 0] = mean[0]; out[region, 1] = mean[1]; out[region, 2] = mean[2]
            out[:, :, 3] = np.where(region, a[:, :, 3], 0)
            im = Image.fromarray(out[by0:by1, bx0:bx1], "RGBA").filter(ImageFilter.GaussianBlur(1.2))
            d = OUT / key; d.mkdir(parents=True, exist_ok=True)
            im.save(d / f"{name}.webp", "WEBP", lossless=True, quality=100, method=6)
            return {"file": f"assets/hd/parts/{key}/{name}.webp", "x": bx0, "y": by0,
                    "w": bx1 - bx0, "h": by1 - by0,
                    "pivotX": pivot[0] - bx0, "pivotY": pivot[1] - by0,
                    "fullW": a.shape[1], "fullH": a.shape[0]}

        back_torso = make_back("torso-back", head_end, hip, (cx, hip))
        back_legs = make_back("legs-back", hip, y1, (cx, hip))

        pivots = {
            "head": (cx, head_end),
            "torso": (cx, hip),
            "arm-l": (cx - side, shoulder),
            "arm-r": (cx + side, shoulder),
            "leg-l": (cx - w * 0.10, hip),
            "leg-r": (cx + w * 0.10, hip),
        }
        entry = {}
        for name in ("head", "torso", "arm-l", "arm-r", "leg-l", "leg-r"):
            m = parts[name]
            if not m.any():
                continue
            pix = a.copy()
            pix[:, :, 3] = np.where(m, a[:, :, 3], 0)
            py, px = np.where(m)
            bx0, bx1, by0, by1 = int(px.min()), int(px.max()) + 1, int(py.min()), int(py.max()) + 1
            crop = Image.fromarray(pix[by0:by1, bx0:bx1], "RGBA")
            d = OUT / key
            d.mkdir(parents=True, exist_ok=True)
            crop.save(d / f"{name}.webp", "WEBP", lossless=True, quality=100, method=6)
            entry[name] = {
                "file": f"assets/hd/parts/{key}/{name}.webp",
                "x": bx0, "y": by0, "w": bx1 - bx0, "h": by1 - by0,
                "pivotX": pivots[name][0] - bx0, "pivotY": pivots[name][1] - by0,
                "fullW": a.shape[1], "fullH": a.shape[0],
            }
        # 个别非人形单位（如战舰）没有独立右臂：复制最近层补齐 6 层，
        # 保证 80 台都有统一的 head/torso/arm-l/arm-r/leg-l/leg-r 资源。
        for name in ("head", "torso", "arm-l", "arm-r", "leg-l", "leg-r"):
            if name in entry:
                continue
            donor = entry.get("arm-l") or entry.get("torso") or next(iter(entry.values()))
            d = OUT / key
            (d / f"{name}.webp").write_bytes((ROOT / donor["file"]).read_bytes())
            entry[name] = {**donor, "file": f"assets/hd/parts/{key}/{name}.webp", "fallback": True}
        if back_legs: entry["legs-back"] = back_legs
        if back_torso: entry["torso-back"] = back_torso
        data[key] = entry
        print(key, len(entry), flush=True)
    META.write_text(json.dumps(data, ensure_ascii=False, indent=1))
    CONFIG.write_text("// 由 tools/build_unit_parts.py 生成\nexport const UNIT_PARTS = "
                      + json.dumps(data, ensure_ascii=False)
                      + ";\n")
    print("units", len(data), "parts", sum(len(v) for v in data.values()))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
