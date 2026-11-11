#!/usr/bin/env python3
"""把 SRW2 的 NSF 音轨渲染成可循环的 BGM（MP3）。

前置：
  - brew install game-music-emu （提供 /opt/homebrew/lib/libgme.dylib）
  - 自备 NSF（版权物，不入库）：例如 nsf.joshw.info 的
    "Dai-2-ji Super Robot Taisen (1991-12-19)(Winkysoft)(Banpresto)[NES].7z"
用法：
  python3 tools/render_nsf.py --nsf /path/to/srw2.nsf --out assets/audio/nsf
  python3 tools/render_nsf.py --nsf ... --seconds 45 --crossfade 1.0
说明：
  - 用 libgme 逐 track 渲染 44.1kHz 立体声；
  - 取前 N 秒，末尾 1 秒与开头 1 秒交叉淡化，得到无爆音的循环；
  - 峰值归一化后编码 MP3 128kbps。
"""
from __future__ import annotations

import argparse
import ctypes
import json
import pathlib
import subprocess
import tempfile
import wave

import numpy as np

LIB = "/opt/homebrew/lib/libgme.dylib"
RATE = 44100


class Gme:
    def __init__(self, path: str):
        self.lib = ctypes.CDLL(LIB)
        self.lib.gme_open_file.restype = ctypes.c_char_p
        self.lib.gme_open_file.argtypes = [ctypes.c_char_p, ctypes.POINTER(ctypes.c_void_p), ctypes.c_int]
        self.lib.gme_track_count.restype = ctypes.c_int
        self.lib.gme_start_track.restype = ctypes.c_char_p
        self.lib.gme_start_track.argtypes = [ctypes.c_void_p, ctypes.c_int]
        self.lib.gme_play.restype = ctypes.c_char_p
        self.lib.gme_play.argtypes = [ctypes.c_void_p, ctypes.c_int, ctypes.POINTER(ctypes.c_short)]
        self.lib.gme_delete.argtypes = [ctypes.c_void_p]
        self.emu = ctypes.c_void_p()
        err = self.lib.gme_open_file(path.encode(), ctypes.byref(self.emu), RATE)
        if err:
            raise RuntimeError(err)

    def count(self) -> int:
        return self.lib.gme_track_count(self.emu)

    def render(self, index: int, seconds: float) -> np.ndarray:
        err = self.lib.gme_start_track(self.emu, index)
        if err:
            raise RuntimeError(err)
        frames = int(RATE * seconds)
        buf = (ctypes.c_short * (2048 * 2))()
        out = []
        left = frames
        while left > 0:
            n = min(2048, left)
            self.lib.gme_play(self.emu, n * 2, buf)
            out.append(np.frombuffer(ctypes.string_at(buf, n * 4), dtype=np.int16).copy())
            left -= n
        return np.concatenate(out).reshape(-1, 2).astype(np.float32) / 32768.0

    def close(self):
        self.lib.gme_delete(self.emu)


def loop_crossfade(x: np.ndarray, crossfade: float) -> np.ndarray:
    """末尾与开头交叉淡化，得到首尾相接的循环。"""
    n = int(crossfade * RATE)
    if n <= 0 or len(x) <= 3 * n:
        return x
    body = x[n:len(x) - n]
    tail = x[-n:]
    head = x[:n]
    a = np.linspace(0.0, 1.0, n, dtype=np.float32)[:, None]
    blend = tail * (1 - a) + head * a
    return np.concatenate([body, blend])


def write_wav(path: pathlib.Path, x: np.ndarray):
    pcm = np.clip(x, -1, 1)
    pcm = (pcm * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(2)
        w.setsampwidth(2)
        w.setframerate(RATE)
        w.writeframes(pcm.tobytes())


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--nsf", required=True)
    ap.add_argument("--out", default="assets/audio/nsf")
    ap.add_argument("--seconds", type=float, default=45.0)
    ap.add_argument("--crossfade", type=float, default=1.0)
    ap.add_argument("--bitrate", default="128k")
    args = ap.parse_args()

    outdir = pathlib.Path(args.out)
    outdir.mkdir(parents=True, exist_ok=True)
    gme = Gme(args.nsf)
    manifest = []
    try:
        for i in range(gme.count()):
            x = gme.render(i, args.seconds)
            x = loop_crossfade(x, args.crossfade)
            peak = float(np.max(np.abs(x))) or 1.0
            x = x / peak * 0.89
            with tempfile.TemporaryDirectory() as td:
                wav = pathlib.Path(td) / f"t{i:02d}.wav"
                mp3 = outdir / f"track-{i:02d}.mp3"
                write_wav(wav, x)
                subprocess.run([
                    "ffmpeg", "-y", "-loglevel", "error", "-i", str(wav),
                    "-codec:a", "libmp3lame", "-b:a", args.bitrate, "-ar", str(RATE),
                    str(mp3)
                ], check=True)
            manifest.append({"index": i, "file": str(mp3), "seconds": round(len(x) / RATE, 2),
                             "bytes": mp3.stat().st_size})
            print("wrote", mp3, manifest[-1]["seconds"], "s")
    finally:
        gme.close()
    (outdir / "manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1))
    print(f"tracks: {len(manifest)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
