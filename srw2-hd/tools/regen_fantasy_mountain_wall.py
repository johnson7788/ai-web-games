#!/usr/bin/env python3
import base64, pathlib, sys, time
from PIL import Image
sys.path.insert(0, str(pathlib.Path(__file__).resolve().parent))
import gen_all_sprites as G
ROOT = pathlib.Path(__file__).resolve().parents[1]
OUT = ROOT / "assets" / "hd" / "fantasy-tiles"; RAW = ROOT / "assets" / "hd" / "fantasy-raw"
P = {
 "mountain": "单块正方形地形素材：一座雄伟的岩石山峰与山脊从画面中央隆起，橙褐色岩壁、绿色草坡、清晰的山体轮廓和阴影，正上方俯视，铺满正方形，单块 tile，没有六边形/网格/边框；手绘奇幻风格，厚涂，丰富细节，鲜艳色彩。",
 "wall": "单块正方形地形素材：整画面都是厚重的灰色石砌城墙墙面，堆叠石块、砖缝、苔藓与风化痕迹，不要庭院、地板、树木、建筑、天空；正上方俯视，铺满正方形，单块 tile，没有六边形/网格/边框；手绘奇幻风格，厚涂，丰富细节。",
}
NEG = "六边形, 蜂窝, 棋盘格, 多个格子, 网格线, 边框, 等距, 斜45度, 人物, 机器人, 像素风, 低清, 模糊, 文字, UI, 庭院, 地板, 建筑, 树, 天空"
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
