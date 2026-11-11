#!/usr/bin/env python3
from __future__ import annotations
import base64, pathlib, sys, time
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_all_sprites as G
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hd" / "fantasy-tiles"; RAW = ROOT / "assets" / "hd" / "fantasy-raw"
P = {
 "plain": "单块正方形地形素材：一整片自然草绿色的草地，草叶、野花、小草丛与细碎石块，细节丰富但不过分荧光；正上方俯视，铺满正方形，单块 tile，没有六边形/网格/边框；手绘奇幻风格，厚涂，鲜艳色彩。",
 "water": "单块正方形地形素材：一整片清澈的蓝绿色海水，细碎浪花、波纹、浅滩光斑与深浅变化，细节丰富；正上方俯视，铺满正方形，单块 tile，没有六边形/网格/边框；手绘奇幻风格，厚涂，鲜艳色彩。",
 "wall": "单块正方形地形素材：一段厚重石砌城墙的顶部特写，灰白石块堆叠、砖缝、苔藓与箭垛，画面全部是石墙，不要庭院、地板、树木、建筑；正上方俯视，铺满正方形，单块 tile，没有六边形/网格/边框；手绘奇幻风格，厚涂，丰富细节。",
}
NEG = "六边形, 蜂窝, 棋盘格, 多个格子, 网格线, 边框, 等距, 斜45度, 人物, 机器人, 像素风, 低清, 模糊, 文字, UI, 庭院, 地板, 建筑, 树"
for key,prompt in P.items():
    data=None
    for i in range(3):
        try:
            data=G.post("/m/qwen-image/txt2img",{"prompt":prompt,"negative_prompt":NEG,"width":1024,"height":1024,"steps":26,"params":{"guidance_scale":4.5}}); break
        except Exception as e: print('warn',key,e,flush=True); time.sleep(4)
    if not data: continue
    (RAW/f"{key}.png").write_bytes(base64.b64decode(data["images"][0]))
    im=Image.open(RAW/f"{key}.png").convert("RGB"); w,h=im.size; m=int(min(w,h)*0.05)
    im.crop((m,m,w-m,h-m)).resize((512,512),Image.LANCZOS).save(OUT/f"{key}.webp","WEBP",quality=92,method=6)
    print(key,'ok',flush=True)
