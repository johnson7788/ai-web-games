#!/usr/bin/env python3
from __future__ import annotations
import base64, pathlib, sys, time
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_all_sprites as G
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hd" / "fantasy-tiles"; RAW = ROOT / "assets" / "hd" / "fantasy-raw"
P = {
 "space": "单块正方形地形素材：深空底色（接近黑色/深蓝），稀疏的星星与一处淡淡的蓝紫色星云，整体偏暗、干净、不拥挤，适合作为战棋地图底图；正上方俯视，铺满正方形，无边框、无网格、无六边形、无人物、无文字；手绘奇幻风格。",
 "base": "单块正方形地形素材：深紫色与灰色的金属地板，简洁的几何接缝和淡淡的能量纹路，低对比度、干净、不拥挤，适合作为战棋地图底图；正上方俯视，铺满正方形，无边框、无网格、无六边形、无人物、无文字；手绘奇幻风格。",
}
NEG = "六边形, 蜂窝, 棋盘格, 多个格子, 网格线, 边框, 等距, 斜45度, 人物, 机器人, 像素风, 低清, 模糊, 文字, UI, 密集, 拥挤, 高对比"
for key,prompt in P.items():
 data=None
 for i in range(3):
  try:
   data=G.post("/m/qwen-image/txt2img",{"prompt":prompt,"negative_prompt":NEG,"width":1024,"height":1024,"steps":26,"params":{"guidance_scale":4.5}}); break
  except Exception as e: print('warn',key,e,flush=True); time.sleep(4)
 if not data: continue
 (RAW/f"{key}.png").write_bytes(base64.b64decode(data["images"][0]))
 im=Image.open(RAW/f"{key}.png").convert("RGB"); w,h=im.size; m=int(min(w,h)*0.04)
 im.crop((m,m,w-m,h-m)).resize((512,512),Image.LANCZOS).save(OUT/f"{key}.webp","WEBP",quality=92,method=6)
 print(key,'ok',flush=True)
