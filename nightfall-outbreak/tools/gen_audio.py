#!/usr/bin/env python3
"""gen_audio.py — 纯合成音频（零采样、零外部素材），为 NIGHTFALL: OUTBREAK 生成 WAV 镜像。

运行时以 WebAudio 实时合成为主（src/core/audio.js），这里用同一套声音设计离线渲染：
  · 枪声 = 瞬态爆音 + 低频体感 + 高频裂纹 + 早期反射 + 空间尾音
  · 僵尸 = 声带脉冲 + 三段共振峰 + 湿噪气声 + 音高摇晃
  · BGM  = 132 BPM 激扬战斗循环（鼓组 / 失真 bass / 铜管和声 / 16 分 arp）
产物同时归档到 local/audio/AI_GEN/sfx（下次免生成）。
"""
from __future__ import annotations

import math
import os
import struct
import wave
from pathlib import Path

import numpy as np

SR = 32000
ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "assets" / "audio"
ARCHIVE = Path("D:/Develop/2026/ai-games/local/audio/AI_GEN/sfx")
rng = np.random.default_rng(20261111)


def env(n, attack_ms=1.0, decay_ms=120.0, curve=1.0):
    t = np.arange(n, dtype=np.float64) / SR
    a = max(1e-6, attack_ms / 1000.0)
    d = max(1e-6, decay_ms / 1000.0)
    rise = 1.0 - np.exp(-t / a)
    fall = np.exp(-t / d)
    return (rise * fall) ** curve


def lp(x, cutoff):
    """一阶低通（状态变量，足够做枪声的扫频质感）。"""
    out = np.empty_like(x)
    z = 0.0
    for i, v in enumerate(x):
        a = min(1.0, 2 * math.pi * cutoff[i] / SR) if hasattr(cutoff, "__len__") else min(1.0, 2 * math.pi * cutoff / SR)
        z += a * (v - z)
        out[i] = z
    return out


def hp(x, cutoff):
    return x - lp(x, cutoff)


def resonant(x, freq, q=8.0):
    """二阶共振带通：共振峰 / 机械点击都用它。"""
    w = 2 * math.pi * freq / SR
    alpha = math.sin(w) / (2 * q)
    b0, b1, b2 = alpha, 0.0, -alpha
    a0, a1, a2 = 1 + alpha, -2 * math.cos(w), 1 - alpha
    out = np.zeros_like(x)
    x1 = x2 = y1 = y2 = 0.0
    for i, v in enumerate(x):
        y = (b0 * v + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2) / a0
        out[i] = y
        x2, x1, y2, y1 = x1, v, y1, y
    return out


def saturate(x, drive=1.4):
    return np.tanh(x * drive) / math.tanh(drive)


def norm(x, peak=0.89):
    m = float(np.max(np.abs(x))) or 1.0
    return (x / m * peak).astype(np.float32)


def write_wav(name, x, also_archive=True):
    OUT.mkdir(parents=True, exist_ok=True)
    pcm = np.clip(x, -1, 1)
    data = (pcm * 32767).astype("<i2").tobytes()
    path = OUT / name
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(data)
    if also_archive:
        ARCHIVE.mkdir(parents=True, exist_ok=True)
        (ARCHIVE / name).write_bytes(path.read_bytes())
    return path


def rifle_shot(seed=0):
    """真实感步枪：瞬态 + 低频体感 + 裂纹 + 早期反射 + 房间尾音。"""
    r = np.random.default_rng(7000 + seed)
    n = int(SR * 0.72)
    t = np.arange(n) / SR
    noise = r.standard_normal(n).astype(np.float64)
    # 主爆音：低通从 9kHz 扫到 700Hz，模拟枪口冲击波
    cut = 9000 * np.exp(-t / 0.035) + 700
    body = lp(noise * env(n, 0.4, 95, 1.2), cut) * 1.0
    crack = hp(noise * env(n, 0.15, 12, 2.0), 3200) * 0.55
    # 低频体感（枪托抵肩）
    thump = np.sin(2 * np.pi * (78 - 24 * t) * t) * env(n, 1.2, 150, 1.6) * 0.55
    # 机械滑动（枪机）
    mech = resonant(r.standard_normal(n) * env(n, 0.3, 26), 1750, 5) * 0.18
    s = body + crack + thump + mech
    # 早期反射 + 室外尾音
    for delay_ms, gain in ((23, 0.34), (41, 0.22), (67, 0.16), (113, 0.10)):
        d = int(SR * delay_ms / 1000)
        s[d:] += body[:-d] * gain
    tail = lp(r.standard_normal(n) * env(n, 9, 260), 1500) * 0.13
    return norm(saturate(s + tail, 1.15))


def growl(seed=0, dur=1.05, base=96.0, down=False):
    """僵尸嘶吼：声带脉冲 + 三段共振峰 + 湿噪 + 摇晃。"""
    r = np.random.default_rng(900 + seed)
    n = int(SR * dur)
    t = np.arange(n) / SR
    wob = 1.0 + 0.09 * np.sin(2 * np.pi * 5.2 * t) + 0.04 * np.sin(2 * np.pi * 11.7 * t)
    f0 = base * (0.72 ** (t / dur) if down else wob)
    phase = np.cumsum(2 * np.pi * f0 / SR)
    # 脉冲串（声门闭合）+ 少量谐波
    buzz = np.sign(np.sin(phase)) * 0.35 + 0.28 * np.sin(phase * 2) + 0.16 * np.sin(phase * 3)
    breath = r.standard_normal(n) * 0.22
    src = buzz + breath
    # 共振峰：喉 / 口 / 鼻
    formants = (resonant(src, 320, 5) * 1.0 + resonant(src, 780, 7) * 0.65 +
                resonant(src, 1450, 9) * 0.32 + resonant(src, 2400, 12) * 0.12)
    wet = lp(breath, 900) * 0.42
    amp = env(n, 70, dur * 520, 1.1) * (0.82 + 0.18 * np.sin(2 * np.pi * 3.1 * t))
    s = (formants + wet) * amp
    return norm(saturate(s, 1.7))


def burst_noise(dur, decay_ms, freq, q=4, seed=1, thump=0.0):
    r = np.random.default_rng(seed * 31 + 17)
    n = int(SR * dur)
    t = np.arange(n) / SR
    x = resonant(r.standard_normal(n), freq, q) * env(n, 0.6, decay_ms, 1.3)
    if thump:
        x += np.sin(2 * np.pi * (110 - 45 * t) * t) * env(n, 1, decay_ms * 1.3) * thump
    return norm(x)


def click_seq():
    n = int(SR * 0.62)
    r = np.random.default_rng(4242)
    s = np.zeros(n)
    for i, (ms, f) in enumerate(((0, 2100), (140, 1650), (300, 2600), (430, 1250))):
        d = int(SR * ms / 1000)
        seg = resonant(r.standard_normal(int(SR * 0.09)), f, 6) * env(int(SR * 0.09), 0.4, 22, 1.6)
        s[d:d + len(seg)] += seg * (0.8 - i * 0.12)
    return norm(s)


def tone_chord(freqs, dur, detune=0.006, drive=1.2):
    n = int(SR * dur)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for f in freqs:
        for k in (-1, 1):
            s += np.sin(2 * np.pi * f * (1 + k * detune) * t + 0.3 * np.sin(2 * np.pi * 3 * t))
    return saturate(s / (len(freqs) * 2) * env(n, 12, dur * 430, 1.0), drive)


def fanfare(up=True):
    notes = (196, 247, 294, 392) if up else (294, 247, 196, 147)
    out = np.zeros(int(SR * 1.9))
    for i, f in enumerate(notes):
        seg = tone_chord((f, f * 1.5), 0.42)
        d = int(SR * i * 0.34)
        out[d:d + len(seg)] += seg * (1.0 - i * 0.12)
    return norm(out)


def bgm_loop():
    """132 BPM 激扬战斗循环：8 小节，首尾严格无缝（所有包络在循环长度内结束）。"""
    bpm = 132.0
    beat = 60.0 / bpm
    bars = 8
    total = beat * 4 * bars
    n = int(round(SR * total))
    s = np.zeros(n, dtype=np.float64)
    r = np.random.default_rng(31337)

    def add(at, seg, gain=1.0):
        i = int(at * SR)
        j = min(n, i + len(seg))
        if i < n and j > i:
            s[i:j] += seg[:j - i] * gain

    # 鼓组
    for b in range(bars * 4):
        t0 = b * beat
        tk = np.arange(int(SR * 0.26)) / SR
        kick = np.sin(2 * np.pi * (128 * np.exp(-tk / 0.055) + 42) * tk) * np.exp(-tk / 0.085)
        add(t0, kick, 0.85)
        if b % 4 in (1, 3):
            sn_t = np.arange(int(SR * 0.20)) / SR
            sn = (r.standard_normal(len(sn_t)) * 0.6 + resonant(r.standard_normal(len(sn_t)), 1800, 3) * 0.4) * np.exp(-sn_t / 0.055)
            add(t0, sn, 0.42)
        for eighth in range(2):
            ht = np.arange(int(SR * 0.055)) / SR
            hat = r.standard_normal(len(ht)) * np.exp(-ht / 0.012)
            add(t0 + eighth * beat / 2, hp(hat, 6000), 0.16 if eighth else 0.10)
        # 16 分 arp（激扬感的主要来源）
        for k in range(4):
            f = (220, 261.6, 329.6, 392.0)[(b + k) % 4] * 2
            at = t0 + k * beat / 4
            ln = beat / 4 * 0.9
            seg = np.sin(2 * np.pi * f * np.arange(int(SR * ln)) / SR) * np.exp(-np.arange(int(SR * ln)) / SR / 0.055)
            add(at, seg, 0.075)

    # 失真 bass 推进（根音每小节）
    roots = (55.0, 55.0, 65.4, 73.4, 55.0, 82.4, 73.4, 65.4)
    for bar, f in enumerate(roots):
        for step in range(8):
            at = bar * 4 * beat + step * beat / 2
            ln = beat / 2 * 0.82
            tt = np.arange(int(SR * ln)) / SR
            saw = np.sign(np.sin(2 * np.pi * f * tt)) * 0.5 + np.sin(2 * np.pi * f * 2 * tt) * 0.25
            seg = saturate(saw * np.exp(-tt / 0.16), 2.1)
            add(at, lp(seg, 420), 0.20)

    # 铜管式和声：每两小节一次 stab
    for bar in range(0, bars, 2):
        chord = (220, 261.6, 329.6) if bar < 4 else (196, 246.9, 293.7)
        seg = tone_chord(chord, beat * 1.6, drive=1.35)
        add(bar * 4 * beat, seg, 0.20)
        add((bar + 1) * 4 * beat + beat * 2, seg, 0.14)

    # 尾部留白 + 首尾交叉淡化（避免循环点咔哒）
    fade = int(SR * 0.02)
    s[:fade] *= np.linspace(0, 1, fade)
    s[-fade:] *= np.linspace(1, 0, fade)
    return norm(saturate(s, 1.05), 0.86)


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    files = {
        "bgm_main.wav": bgm_loop(),
        "sfx_rifle.wav": rifle_shot(0),
        "sfx_rifle_alt.wav": rifle_shot(3),
        "sfx_reload.wav": click_seq(),
        "sfx_dry.wav": burst_noise(0.16, 18, 2900, 8, 12),
        "sfx_impact.wav": burst_noise(0.26, 42, 520, 3, 5, thump=0.55),
        "sfx_headshot.wav": burst_noise(0.34, 60, 1180, 5, 7, thump=0.35),
        "sfx_zombie.wav": growl(1, 1.05, 96),
        "sfx_zombie_die.wav": growl(4, 0.85, 118, down=True),
        "sfx_hurt.wav": burst_noise(0.40, 90, 260, 2, 9, thump=0.8),
        "sfx_step.wav": burst_noise(0.18, 26, 380, 2, 14, thump=0.25),
        "sfx_wave.wav": norm(tone_chord((146.8, 220, 293.7), 1.5, drive=1.5) * 0.8),
        "sfx_boss.wav": norm(growl(8, 1.7, 62, down=False) * 0.9 + np.sin(2 * np.pi * 41 * np.arange(int(SR * 1.7)) / SR) * env(int(SR * 1.7), 60, 600) * 0.25),
        "sfx_explode.wav": norm(burst_noise(1.1, 260, 180, 1.5, 21, thump=0.9) + lp(rng.standard_normal(int(SR * 1.1)), 600) * env(int(SR * 1.1), 5, 320) * 0.35),
        "sfx_click.wav": burst_noise(0.11, 13, 2300, 7, 3),
        "sfx_win.wav": fanfare(True),
        "sfx_lose.wav": fanfare(False),
    }
    for name, x in files.items():
        p = write_wav(name, x)
        print(f"[audio] {p.name:24s} {p.stat().st_size // 1024:4d}KB")
    print(f"[audio] {len(files)} files -> {OUT}  (archive {ARCHIVE})")


if __name__ == "__main__":
    main()
