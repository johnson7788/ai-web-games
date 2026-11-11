#!/usr/bin/env python3
"""为 9 套地图模板生成高清底图：先画色块 blockout，再用 qwen-image-edit 重绘。"""
import base64, json, pathlib, urllib.request
from PIL import Image, ImageDraw

ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hd" / "maps"
TMP = ROOT / "assets" / "hd" / "maps" / "blockout"
BASE = "http://127.0.0.1:19100"

COLORS = {".":(86,140,66), "r":(120,120,120), "f":(42,86,48), "m":(176,96,40),
          "w":(40,90,140), "c":(140,140,146), "b":(90,150,170), "#":(70,72,80)}

MAPS = {
"grass": ["...mmmmmm.cccccc","......mmm.cccccc","...mmmmmm.cccccc",".....mm...cccccc","..........cccccc",".......w..cc.c.f",".....f....cccccc","..........cc.cw.",".........ccccccc","ccc...c.cccc.cc.","wwww.w.wwwwwwwww"],
"fort":  ["cccccccccccccccc","c..c...cc...c..c","c..c...cc...c..c","c..cccccc...c..c","c...........c..c","c..cc...cc..c..c","c..cc...cc..c..c","c...........c..c","c..ccccccc..c..c","c...........c..c","cccccccccccccccc"],
"desert":["...mmm....ff....","..mmmm...fff....","...mmm....ff....","....m...........","........f.......","..f............f","...........mm...","....f......mmm..",".........mmmm...","...f............",".w..............w"],
"sea":   ["wwww....wwww....","wwww....wwww....","..w......ww.....","........ww......","...mm...........","...mm.....f.....","..........f.....","....w...........","....ww..........",".....w....cccc..","wwwwwwwwwwccccww"],
"space": ["................","..mm.......mm...","................","......mm........","................","..f.........f...","................","......mm........","................","..mm.......mm...","................"],
"moon":  ["..mm....mm......","...m.....m......","................","......mm........","..mm............","...........mm...","................",".....mm.....mm..","................","..mm............","................"],
"city":  ["cc.cc.cc.cc.cc.c","c..c..c..c..c..c","cc.cc.cc.cc.cc.c","...............c","c.cc.cc.cc.cc.c.","c..c..c..c..c...","cc.cc.cc.cc.cc.c","...............c","c.cc.cc.cc.cc.c.","c..c..c..c..c...","cc.cc.cc.cc.cc.c"],
"coast": ["...f.....f......",".f............f.","....c.....c.....","................","..mm......mm....","................","......wwww......","....wwwwwwww....","..wwwwwwwwwwww..",".wwwwwwwwwwwwww.","wwwwwwwwwwwwwwww"],
"base":  ["################","#..............#","#..cc......cc..#","#..cc......cc..#","#..............#","#....cccc......#","#....cccc......#","#..............#","#..cc......cc..#","#..............#","################"],
}

PROMPTS = {
"grass":"将这张 FC 战棋地形色块图重绘为高清现代战棋战场：绿色草原网格、橙色岩山、灰色要塞建筑、森林与海面，保持严格相同的格子布局与配色，俯视视角，细节丰富，无文字无UI无角色",
"fort":"将这张战棋地形色块图重绘为高清石造要塞内部战场：灰色砖墙与石板地、局部草地与通道，保持相同的格子布局与墙体结构，俯视视角，无文字无UI无角色",
"desert":"将这张战棋地形色块图重绘为高清沙漠战场：黄沙、红岩、稀疏植被与小片水域，保持相同的格子布局与配色，俯视视角，无文字无UI无角色",
"sea":"将这张战棋地形色块图重绘为高清海岛战场：深蓝海面、浅滩、礁石、岛屿与要塞，保持相同的格子布局与配色，俯视视角，无文字无UI无角色",
"space":"将这张战棋地形色块图重绘为高清宇宙战场：深空星海、陨石与空间站残骸，保持相同的格子布局，俯视视角，无文字无UI无角色",
"moon":"将这张战棋地形色块图重绘为高清月面战场：灰色环形山、月壤与岩石，保持相同的格子布局，俯视视角，无文字无UI无角色",
"city":"将这张战棋地形色块图重绘为高清城市街区战场：楼顶、街道、广场与绿地，保持相同的街区布局与格子，俯视视角，无文字无UI无角色",
"coast":"将这张战棋地形色块图重绘为高清海岸战场：沙滩、浅海、礁石与林地，保持相同的格子布局与配色，俯视视角，无文字无UI无角色",
"base":"将这张战棋地形色块图重绘为高清军事基地内部：金属地板、围墙、机库与通道，保持相同的墙体与格子布局，俯视视角，无文字无UI无角色",
}

def blockout(name, rows, cell=44):
    img = Image.new("RGB", (16*cell, 11*cell))
    d = ImageDraw.Draw(img)
    for y, row in enumerate(rows):
        for x, ch in enumerate(row):
            d.rectangle([x*cell, y*cell, (x+1)*cell-1, (y+1)*cell-1], fill=COLORS.get(ch,(86,140,66)), outline=(0,0,0))
    TMP.mkdir(parents=True, exist_ok=True)
    p = TMP / f"{name}.png"; img.save(p); return p

def edit(image_path, prompt, out):
    raw = base64.b64encode(pathlib.Path(image_path).read_bytes()).decode()
    payload = {"prompt": prompt, "image": raw, "steps": 28}
    req = urllib.request.Request(BASE + "/m/qwen-image-edit/edit",
        data=json.dumps(payload).encode(), headers={"Content-Type":"application/json"})
    with urllib.request.urlopen(req, timeout=600) as r:
        data = json.loads(r.read())
    out.parent.mkdir(parents=True, exist_ok=True)
    out.write_bytes(base64.b64decode(data["images"][0]))
    print("saved", out)

if __name__ == "__main__":
    import sys
    only = sys.argv[1:] or list(MAPS)
    for name in only:
        edit(blockout(name, MAPS[name]), PROMPTS[name], OUT / f"{name}.png")
