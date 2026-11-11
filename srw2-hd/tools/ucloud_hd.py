#!/usr/bin/env python3
"""调用优云智算推理网关（qwen-image / qwen-image-edit）批量做高清重绘。

网关需先开 SSH 隧道：ssh -f -N -L 19100:127.0.0.1:9100 -p 23 root@117.50.187.176
"""
from __future__ import annotations
import argparse, base64, json, pathlib, sys, urllib.request

BASE = "http://127.0.0.1:19100"

def post(path, payload, timeout=600):
    req = urllib.request.Request(BASE + path, data=json.dumps(payload).encode(),
                                 headers={"Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=timeout) as r:
        return json.loads(r.read())

def save(data, out):
    out = pathlib.Path(out); out.parent.mkdir(parents=True, exist_ok=True)
    import base64 as b64
    out.write_bytes(b64.b64decode(data["images"][0]))
    print(out)

def edit(image, prompt, out, steps=30):
    raw = base64.b64encode(pathlib.Path(image).read_bytes()).decode()
    save(post("/m/qwen-image-edit/edit", {"prompt": prompt, "image": raw, "steps": steps}), out)

def txt2img(prompt, out, width=1024, height=1024, steps=24, transparent=False, negative="模糊, 水印, 文字, 低质量"):
    payload = {"prompt": prompt, "negative_prompt": negative, "width": width, "height": height,
               "steps": steps, "params": {"guidance_scale": 4.0}}
    if transparent:
        payload["params"]["transparent"] = True
    save(post("/m/qwen-image/txt2img", payload), out)

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("mode", choices=["edit", "txt2img"])
    ap.add_argument("--image"); ap.add_argument("--prompt", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", default="1024x1024")
    ap.add_argument("--steps", type=int, default=24)
    ap.add_argument("--transparent", action="store_true")
    a = ap.parse_args()
    w, h = a.size.split("x")
    if a.mode == "edit":
        edit(a.image, a.prompt, a.out, a.steps)
    else:
        txt2img(a.prompt, a.out, int(w), int(h), a.steps, a.transparent)
