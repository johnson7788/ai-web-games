// src/core/audio.js — MARRY RICH · 程序化音效 + 分层 BGM（WebAudio，零依赖零外链）。
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效/循环层直接算成 mono Float32Array PCM，
//     这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination；
//     BGM 用 loop 的 AudioBufferSourceNode 长循环（程序化合成，不打包音频文件）。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(mode), stopBgm() }
// 事件名与 sim 事件表对齐：choiceMade / nodeEnter / attrChange / resultShown / timerStart /
//   timerTick / scaleTilt / success / advance / ending，外加 UI 侧 ui。

import { save } from './save.js';

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.25;    // 噪声层统一归一 RMS

// ---------------------------------------------------------------------------
// DSP 原语
// ---------------------------------------------------------------------------

function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function oscSample(type, phase) {
  const p = phase % (2 * Math.PI);
  switch (type) {
    case 'sine': return Math.sin(p);
    case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(p));
    case 'square': return Math.sign(Math.sin(p));
    case 'sawtooth': return 2 * ((p / (2 * Math.PI)) - Math.floor(p / (2 * Math.PI) + 0.5));
    default: return Math.sin(p);
  }
}

function osc({ type = 'sine', freq = 440, freqEnd = null, dur = 0.2, sr = SAMPLE_RATE, gain = 0.5, attack = 0.005, release = 0.05 } = {}) {
  const n = Math.max(1, Math.round(dur * sr));
  const out = new Float32Array(n);
  const ratio = freqEnd != null && freq > 0 ? freqEnd / freq : 1;
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    const f = freq * Math.pow(ratio, i / (n - 1 || 1));
    phase += (2 * Math.PI * f) / sr;
    out[i] = oscSample(type, phase);
  }
  return applyEnv(out, sr, gain, attack, release);
}

function noise({ dur = 0.2, sr = SAMPLE_RATE, gain = 0.5, attack = 0.005, release = 0.05, filter = 'none', cutoff = 1000 } = {}) {
  const n = Math.max(1, Math.round(dur * sr));
  let out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = Math.random() * 2 - 1;
  if (filter === 'lowpass') out = lowpass(out, cutoff, sr);
  else if (filter === 'highpass') out = highpass(out, cutoff, sr);
  else if (filter === 'bandpass') out = bandpass(out, cutoff, sr);
  out = normalizeRms(out, NOISE_RMS);
  return applyEnv(out, sr, gain, attack, release);
}

function applyEnv(out, sr, gain, attack, release) {
  const dur = out.length / sr;
  for (let i = 0; i < out.length; i += 1) {
    const t = i / sr;
    const a = attack > 0 ? Math.min(1, t / attack) : 1;
    const r = release > 0 ? Math.min(1, Math.max(0, (dur - t) / release)) : 1;
    out[i] *= gain * Math.min(a, r);
  }
  return out;
}

function lowpass(input, cutoff, sr) {
  const a = Math.exp(-2 * Math.PI * cutoff / sr);
  const out = new Float32Array(input.length);
  let y = 0;
  for (let i = 0; i < input.length; i += 1) {
    y = a * y + (1 - a) * input[i];
    out[i] = y;
  }
  return out;
}

function highpass(input, cutoff, sr) {
  const a = Math.exp(-2 * Math.PI * cutoff / sr);
  const out = new Float32Array(input.length);
  let xPrev = 0;
  let yPrev = 0;
  for (let i = 0; i < input.length; i += 1) {
    const x = input[i];
    const y = a * (yPrev + x - xPrev);
    out[i] = y;
    yPrev = y;
    xPrev = x;
  }
  return out;
}

function bandpass(input, center, sr) {
  return highpass(lowpass(input, center * 1.6, sr), center * 0.62, sr);
}

function normalizeRms(input, target) {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) sum += input[i] * input[i];
  const rms = Math.sqrt(sum / Math.max(1, input.length));
  if (rms > 1e-6) {
    const k = target / rms;
    for (let i = 0; i < input.length; i += 1) input[i] *= k;
  }
  return input;
}

function mix(...parts) {
  let len = 0;
  for (const p of parts) len = Math.max(len, p.length);
  const out = new Float32Array(len);
  for (const p of parts) for (let i = 0; i < p.length; i += 1) out[i] += p[i];
  return out;
}

function addAt(dst, src, offset) {
  for (let i = 0; i < src.length; i += 1) {
    const j = offset + i;
    if (j >= 0 && j < dst.length) dst[j] += src[i];
  }
}

function notes({ freqs, dur = 0.4, gap = 0.13, type = 'triangle', gain = 0.2, attack = 0.01, release = 0.15, sr = SAMPLE_RATE } = {}) {
  const total = (freqs.length - 1) * gap + dur;
  const out = new Float32Array(Math.max(1, Math.round(total * sr)));
  freqs.forEach((f, k) => {
    const s = osc({ type, freq: f, dur, sr, gain, attack, release });
    addAt(out, s, Math.round(k * gap * sr));
  });
  return out;
}

// 单个持续音（BGM 用）：无硬包络，仅线性淡入淡出避免爆音。
function tone({ type = 'sine', freq = 220, dur = 2, sr = SAMPLE_RATE, gain = 0.2 } = {}) {
  const n = Math.max(1, Math.round(dur * sr));
  const out = new Float32Array(n);
  let phase = 0;
  for (let i = 0; i < n; i += 1) {
    phase += (2 * Math.PI * freq) / sr;
    out[i] = oscSample(type, phase) * gain;
  }
  const fade = Math.min(160, Math.floor(n / 4));
  for (let i = 0; i < fade; i += 1) {
    const k = i / fade;
    out[i] *= k;
    out[n - 1 - i] *= k;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 各音效合成器（(payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

function sfxSelect(p, sr) {
  const f = 660 + clamp(p.chapter ?? 0, 0, 12) * 8;
  const a = osc({ type: 'sine', freq: f, freqEnd: f * 1.4, dur: 0.09, sr, gain: 0.3, attack: 0.003, release: 0.04 });
  const c = noise({ dur: 0.03, sr, gain: 0.1, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.015 });
  return mix(a, c);
}

function sfxChapter(_p, sr) {
  return notes({ freqs: [392, 493.88, 587.33], dur: 0.5, gap: 0.09, type: 'triangle', gain: 0.14, attack: 0.04, release: 0.2, sr });
}

function sfxAttr(p, sr) {
  const dir = (p.abi ?? 0) >= 0 ? 1 : -1;
  const f = 520 + dir * 60;
  return osc({ type: 'sine', freq: f, freqEnd: f * 1.25, dur: 0.1, sr, gain: 0.18, attack: 0.004, release: 0.05 });
}

function sfxResult(_p, sr) {
  const a = osc({ type: 'sine', freq: 523.25, dur: 0.22, sr, gain: 0.16, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 783.99, dur: 0.22, sr, gain: 0.1, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

function sfxTimer(_p, sr) {
  return osc({ type: 'square', freq: 880, dur: 0.05, sr, gain: 0.12, attack: 0.002, release: 0.02 });
}

function sfxTick(_p, sr) {
  return osc({ type: 'square', freq: 1100, dur: 0.03, sr, gain: 0.08, attack: 0.001, release: 0.015 });
}

function sfxTilt(_p, sr) {
  return noise({ dur: 0.3, sr, gain: 0.24, filter: 'bandpass', cutoff: 900, attack: 0.04, release: 0.14 });
}

function sfxSuccess(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.28, gap: 0.08, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.14, sr });
}

function sfxEnding(_p, sr) {
  const chord = notes({ freqs: [261.63, 329.63, 392, 523.25], dur: 0.9, gap: 0, type: 'triangle', gain: 0.14, attack: 0.02, release: 0.4, sr });
  const c = noise({ dur: 0.4, sr, gain: 0.1, filter: 'lowpass', cutoff: 900, attack: 0.004, release: 0.2 });
  return mix(chord, c);
}

function sfxAdvance(_p, sr) {
  return osc({ type: 'sine', freq: 720, freqEnd: 540, dur: 0.05, sr, gain: 0.14, attack: 0.002, release: 0.025 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

const SYNTH = {
  select: sfxSelect,
  chapter: sfxChapter,
  attr: sfxAttr,
  result: sfxResult,
  timer: sfxTimer,
  tick: sfxTick,
  tilt: sfxTilt,
  success: sfxSuccess,
  ending: sfxEnding,
  advance: sfxAdvance,
  ui: sfxUi,
};

export const SFX_NAMES = Object.keys(SYNTH);

const EVENT_TO_SFX = {
  choiceMade: 'select',
  nodeEnter: 'chapter',
  attrChange: 'attr',
  resultShown: 'result',
  timerStart: 'timer',
  timerTick: 'tick',
  scaleTilt: 'tilt',
  success: 'success',
  ending: 'ending',
  advance: 'advance',
  ui: 'ui',
};

// ---------------------------------------------------------------------------
// 程序化 BGM 循环层（3 场景包：小镇暖 / 都市青 / 巅峰金紫）
// ---------------------------------------------------------------------------

const BGM_PROGRESSIONS = {
  town: { chords: [[220, 261.63, 329.63], [174.61, 220, 261.63], [196, 246.94, 293.66], [164.81, 196, 246.94]], root: 'sine', step: 'triangle' },
  city: { chords: [[261.63, 329.63, 392], [220, 261.63, 329.63], [246.94, 293.66, 369.99], [196, 246.94, 293.66]], root: 'triangle', step: 'sine' },
  peak: { chords: [[329.63, 415.3, 493.88], [293.66, 369.99, 440], [311.13, 392, 466.16], [261.63, 329.63, 392]], root: 'sine', step: 'sine' },
};

function synthBgm(mode, sr) {
  const prog = BGM_PROGRESSIONS[mode] || BGM_PROGRESSIONS.town;
  const chordSec = 2; // 每和弦 2s，4 和弦 = 8s 一循环（无缝循环）
  const total = chordSec * prog.chords.length;
  const out = new Float32Array(Math.round(total * sr));

  prog.chords.forEach((chord, ci) => {
    const off = Math.round(ci * chordSec * sr);
    // 根音 pad（低八度）
    const root = tone({ type: prog.root, freq: chord[0] / 2, dur: chordSec, sr, gain: 0.16 });
    addAt(out, root, off);
    // 三和弦（中高）
    for (const f of chord) {
      const t = tone({ type: prog.step, freq: f, dur: chordSec, sr, gain: 0.07 });
      addAt(out, t, off);
    }
    // 简单琶音点缀（每和弦 4 个八分音符）
    for (let k = 0; k < 4; k += 1) {
      const f = chord[k % chord.length] * 2;
      const s = osc({ type: 'triangle', freq: f, dur: 0.35, sr, gain: 0.05, attack: 0.02, release: 0.25 });
      addAt(out, s, off + Math.round((k * chordSec / 4) * sr));
    }
  });
  return normalizeRms(out, 0.12);
}

const LOOPS = {
  town: (sr) => synthBgm('town', sr),
  city: (sr) => synthBgm('city', sr),
  peak: (sr) => synthBgm('peak', sr),
};

export const LOOP_NAMES = Object.keys(LOOPS);

export function synthSfx(name, payload = {}, sr = SAMPLE_RATE) {
  const fn = SYNTH[name];
  if (!fn) throw new Error(`unknown sfx: ${name}`);
  return fn(payload || {}, sr);
}

export function synthLoop(name, sr = SAMPLE_RATE) {
  const fn = LOOPS[name];
  if (!fn) throw new Error(`unknown loop: ${name}`);
  return fn(sr);
}

const SFX_PRIORITY = {
  ending: 6, success: 6,
  chapter: 5, select: 5, result: 4, tilt: 4,
  attr: 3, timer: 3,
  tick: 2, advance: 2, ui: 2,
};

// ---------------------------------------------------------------------------
// 播放层
// ---------------------------------------------------------------------------

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    unlocked: false,
    bgmSource: null,
    bgmMode: null,
    active: new Map(),
    lastPlay: new Map(),
    voiceSeq: 0,
  };

  function resumeIfNeeded() {
    const c = state.ctx;
    if (c && c.state === 'suspended' && typeof c.resume === 'function') c.resume().catch(() => {});
  }

  function ensureCtx() {
    if (state.ctx) {
      resumeIfNeeded();
      return state.ctx;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    state.ctx = new AC();
    state.master = state.ctx.createGain();
    state.master.gain.value = state.muted ? 0 : state.volume;
    state.master.connect(state.ctx.destination);
    state.sfxBus = state.ctx.createGain();
    state.sfxBus.gain.value = 1;
    state.sfxBus.connect(state.master);
    state.bgmBus = state.ctx.createGain();
    state.bgmBus.gain.value = 0.9;
    state.bgmBus.connect(state.master);
    resumeIfNeeded();
    return state.ctx;
  }

  function pruneActive(now) {
    for (const [key, v] of state.active) if (v.endTime <= now) state.active.delete(key);
  }

  function stopVoice(v, now) {
    if (v && v.stop) { try { v.stop(now); } catch { /* noop */ } }
  }

  function playSfx(name, payload) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;

    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);

    const priority = SFX_PRIORITY[name] ?? 1;
    pruneActive(now);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null;
      let minPrio = Infinity;
      for (const [key, v] of state.active) {
        if (v.priority < minPrio) { minPrio = v.priority; minKey = key; }
      }
      if (minKey == null || priority <= minPrio) return;
      stopVoice(state.active.get(minKey), now);
      state.active.delete(minKey);
    }

    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.sfxBus);
    src.start(now);
    const key = `v${state.voiceSeq++}`;
    state.active.set(key, { name, priority, endTime: now + pcm.length / ctx.sampleRate, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
  }

  function stopBgmSource() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) resumeIfNeeded();
    state.unlocked = true;
  }

  function event(type, payload = {}) {
    if (!type) return;
    const name = EVENT_TO_SFX[type];
    if (name) playSfx(name, payload);
  }

  function setMuted(b) {
    state.muted = !!b;
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
    save.set('audioMuted', state.muted);
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
    save.set('audioVolume', state.volume);
  }

  function playBgm(mode) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmMode === mode && state.bgmSource) return;
    stopBgmSource();
    const pcm = synthLoop(mode, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(state.bgmBus);
    src.start();
    state.bgmSource = src;
    state.bgmMode = mode;
  }

  function stopBgm() {
    stopBgmSource();
    state.bgmMode = null;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
