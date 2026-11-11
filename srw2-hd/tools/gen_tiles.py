#!/usr/bin/env python3
"""生成 9 张可平铺的 HD 地形贴图（俯视、无缝、无文字）。"""
import base64, json, pathlib, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hd" / "tiles"
BASE = "http://127.0.0.1:19100"

TILES = {
"ground_grass": "俯视无缝草地贴图，均匀的深绿色草皮，几乎没有明显图案，边缘光照一致，游戏地形素材，无文字",
"ground_sand":  "俯视无缝沙地贴图，暖黄色细沙，轻微风纹，游戏地形素材，无文字",
"ground_space": "俯视无缝深空贴图，深蓝黑色星海，稀疏星点与淡淡星云，游戏地形素材，无文字",
"ground_moon":  "俯视无缝月球表面贴图，灰色月壤与细小坑洞，游戏地形素材，无文字",
"forest":       "俯视无缝森林贴图，深绿色树冠层层叠叠，阴影自然，游戏地形素材，无文字",
"mountain":     "俯视无缝山地贴图，橙棕色岩石峰峦与阴影，游戏地形素材，无文字",
"water":        "俯视无缝海面贴图，深蓝色海水与细碎波纹，游戏地形素材，无文字",
"city":         "俯视无缝要塞石板地贴图，灰色石砖与接缝，游戏地形素材，无文字",
"wall":         "俯视无缝石墙贴图，厚重灰石砌块，深色缝隙，游戏地形素材，无文字",
}

def gen(prompt, out):
    payload = {"prompt": prompt, "negative_prompt": "文字, 水印, 标志, 角色, UI, 透视",
               "width": 512, "height": 512, "steps": 20, "params": {"guidance_scale": 4.0}}
    req = urllib.request.Request(BASE + "/m/qwen-image/txt2img",
        data=json.dumps(payload).encode(), headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.loads(r.read())
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(data["images"][0]))
    print("saved", out.name)

if __name__ == "__main__":
    import sys
    for name in (sys.argv[1:] or TILES):
        gen(TILES[name], OUT / f"{name}.png")
