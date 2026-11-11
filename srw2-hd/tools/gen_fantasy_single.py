#!/usr/bin/env python3
"""单个主体（一座山/一棵树/一丛灌木/一块岩石/一栋小屋）的手绘方形 tile。"""
from __future__ import annotations
import base64, pathlib, sys, time
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_all_sprites as G
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hd" / "fantasy-tiles"; RAW = ROOT / "assets" / "hd" / "fantasy-raw"
PREFIX = ("单块正方形地形 tile：{scene}。画面中央只有一个主体，周围地形填满四个边和四个角，"
          "没有白色背景、没有留白、没有边框、没有六边形、没有网格线；正上方俯视，"
          "手绘奇幻风格，厚涂笔触，丰富细节，鲜艳明亮的色彩，正方形构图。")
NEG = ("六边形, 蜂窝, 棋盘格, 多个主体, 很多树, 很多山, 网格线, 边框, 白色背景, 留白, 等距, 斜45度, 人物, 机器人, 像素风, 低清, 模糊, 文字, UI")
TILES = {
 "mountain": "一座清晰的橙褐色岩石山峰，山脚是绿色草坡",
 "forest": "一棵巨大的奇幻阔叶树，树冠茂密、树干清晰，周围是短草",
 "rough": "一丛低矮的灌木、杂草与泥土，周围是草地",
 "rock": "一块巨大的灰色岩石/巨石，周围是碎石与草地",
 "town": "一座奇幻小屋/小城堡，红瓦屋顶、木石结构，周围是石板广场与花坛",
}
for key,scene in TILES.items():
 prompt = PREFIX.format(scene=scene)
 data=None
 for i in range(3):
  try:
   data=G.post("/m/qwen-image/txt2img",{"prompt":prompt,"negative_prompt":NEG,"width":1024,"height":1024,"steps":26,"params":{"guidance_scale":4.5}}); break
  except Exception as e: print('warn',key,e,flush=True); time.sleep(4)
 if not data: continue
 (RAW/f"{key}-single.png").write_bytes(base64.b64decode(data["images"][0]))
 im=Image.open(RAW/f"{key}-single.png").convert("RGB"); w,h=im.size; m=int(min(w,h)*0.04)
 im.crop((m,m,w-m,h-m)).resize((512,512),Image.LANCZOS).save(OUT/f"{key}.webp","WEBP",quality=92,method=6)
 print(key,'ok',flush=True)
