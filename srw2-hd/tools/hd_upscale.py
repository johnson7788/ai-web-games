#!/usr/bin/env python3
"""用阿里云百炼 qwen-image-3.0 做「图生图」高清化。

用法：
  python3 tools/hd_upscale.py --input a.png --prompt "..." --size 1024*768 --output out.png

会把输入图以 data URI 传给 qwen-image-3.0（multimodal-generation），
模型在参考构图/配色的前提下重绘为高清版本，脚本自动下载结果。
"""
from __future__ import annotations

import argparse
import base64
import json
import os
import pathlib
import sys
import urllib.request

KEY = os.environ.get(
    "DASHSCOPE_API_KEY",
    "sk-ws-H.EHPIEPE.JiSa.MEUCIQCiVTGmLIIyAPV_5pLGzelb5-oOQTUJRWS95Y1FAfGPZAIgZgbOFozJLjZzc8cOi3KXtnpeWsYqWaHPG8kthxCn1dg",
)
URL = "https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation"


def generate(input_path: str, prompt: str, size: str, out_path: str) -> pathlib.Path:
    raw = pathlib.Path(input_path).read_bytes()
    data_uri = "data:image/png;base64," + base64.b64encode(raw).decode()
    payload = {
        "model": "qwen-image-3.0",
        "input": {
            "messages": [{
                "role": "user",
                "content": [{"image": data_uri}, {"text": prompt}],
            }]
        },
        "parameters": {"size": size.replace("x", "*"), "n": 1, "watermark": False},
    }
    req = urllib.request.Request(
        URL,
        data=json.dumps(payload).encode(),
        headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json"},
    )
    with urllib.request.urlopen(req, timeout=300) as r:
        data = json.loads(r.read())

    image_url = None
    for choice in data.get("output", {}).get("choices", []):
        for item in choice.get("message", {}).get("content", []):
            if item.get("type") == "image" and item.get("image"):
                image_url = item["image"]
    if not image_url:
        raise RuntimeError(f"没有拿到图片: {json.dumps(data, ensure_ascii=False)[:400]}")

    dest = pathlib.Path(out_path)
    dest.parent.mkdir(parents=True, exist_ok=True)
    req = urllib.request.Request(image_url, headers={"User-Agent": "Mozilla/5.0"})
    with urllib.request.urlopen(req, timeout=180) as r:
        dest.write_bytes(r.read())
    print(dest)
    return dest


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--input", required=True)
    ap.add_argument("--prompt", required=True)
    ap.add_argument("--size", default="1024*768")
    ap.add_argument("--output", required=True)
    args = ap.parse_args()
    generate(args.input, args.prompt, args.size, args.output)
    return 0


if __name__ == "__main__":
    sys.exit(main())
