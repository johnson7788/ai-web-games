// src/core/audio.js — BALL ORBIT 音频合成（WebAudio 程序化，零依赖零外链零音频文件）
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，算成 mono
//     Float32Array PCM，供 tools/audio-check.mjs 在 Node 里离线渲染校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer 经 GainNode 播放；BGM 用 additive 分层循环（无缝）。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }
// 事件名：shot / aim / ballBounce / ballHit / asteroidBreak / rowClear / addBall / cometCharge /
//   cometFire / shieldBlock / waveEnter / ballReturn / death，外加 ui / newRecord。

import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.25;

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

function osc({ type = 'sine', freq = 440, freqEnd = null, dur = 0.2, sr = SAMPLE_RATE,
               gain = 0.5, attack = 0.005, release = 0.05 } = {}) {
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

function noise({ dur = 0.2, sr = SAMPLE_RATE, gain = 0.5, attack = 0.005, release = 0.05,
                 filter = 'none', cutoff = 1000 } = {}) {
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

function notes({ freqs, dur = 0.4, gap = 0.13, type = 'triangle', gain = 0.2,
                 attack = 0.01, release = 0.15, sr = SAMPLE_RATE } = {}) {
  const total = (freqs.length - 1) * gap + dur;
  const out = new Float32Array(Math.max(1, Math.round(total * sr)));
  freqs.forEach((f, k) => {
    const s = osc({ type, freq: f, dur, sr, gain, attack, release });
    addAt(out, s, Math.round(k * gap * sr));
  });
  return out;
}

// ---------------------------------------------------------------------------
// 各音效合成器
// ---------------------------------------------------------------------------
function sfxShot(_p, sr) {
  const whoosh = noise({ dur: 0.22, sr, gain: 0.4, filter: 'bandpass', cutoff: 900, attack: 0.02, release: 0.1 });
  const pop = osc({ type: 'triangle', freq: 220, freqEnd: 130, dur: 0.12, sr, gain: 0.3, attack: 0.004, release: 0.06 });
  return mix(whoosh, pop);
}

function sfxAim(_p, sr) {
  return osc({ type: 'sine', freq: 880, freqEnd: 990, dur: 0.05, sr, gain: 0.08, attack: 0.002, release: 0.02 });
}

function sfxBounce(_p, sr) {
  return osc({ type: 'triangle', freq: 260, freqEnd: 160, dur: 0.06, sr, gain: 0.22, attack: 0.002, release: 0.03 });
}

function sfxHit(p, sr) {
  const v = clamp(p.value ?? 1, 1, 40);
  const f = 480 * Math.pow(2, -v / 40);
  return osc({ type: 'triangle', freq: f, freqEnd: f * 0.7, dur: 0.09, sr, gain: 0.35, attack: 0.002, release: 0.05 });
}

function sfxBreak(p, sr) {
  const v = clamp(p.value ?? 1, 1, 40);
  const f = 560 * Math.pow(2, -v / 40);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 0.55, dur: 0.16, sr, gain: 0.4, attack: 0.004, release: 0.08 });
  const pop = noise({ dur: 0.06, sr, gain: 0.24, filter: 'lowpass', cutoff: f * 4, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

function sfxRowClear(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.42, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.16, sr });
}

function sfxAddBall(_p, sr) {
  const a = osc({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.12, sr, gain: 0.3, attack: 0.004, release: 0.05 });
  const b = osc({ type: 'sine', freq: 990, freqEnd: 1320, dur: 0.12, sr, gain: 0.18, attack: 0.004, release: 0.05 });
  return mix(a, b);
}

function sfxCometCharge(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.3, gap: 0.07, type: 'triangle', gain: 0.16, attack: 0.01, release: 0.12, sr });
}

function sfxCometFire(_p, sr) {
  const sweep = noise({ dur: 0.5, sr, gain: 0.4, filter: 'bandpass', cutoff: 1400, attack: 0.03, release: 0.2 });
  const rise = osc({ type: 'sawtooth', freq: 180, freqEnd: 720, dur: 0.4, sr, gain: 0.14, attack: 0.03, release: 0.18 });
  return mix(sweep, rise);
}

function sfxShieldBlock(_p, sr) {
  const clang = osc({ type: 'square', freq: 620, freqEnd: 420, dur: 0.08, sr, gain: 0.16, attack: 0.002, release: 0.04 });
  return mix(clang, noise({ dur: 0.04, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.02 }));
}

function sfxWaveEnter(_p, sr) {
  return notes({ freqs: [220, 277.18, 329.63, 440], dur: 0.5, gap: 0.1, type: 'triangle', gain: 0.16, attack: 0.05, release: 0.18, sr });
}

function sfxBallReturn(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 300, dur: 0.1, sr, gain: 0.14, attack: 0.004, release: 0.05 });
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  return mix(ping, noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 }));
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  shot: sfxShot,
  aim: sfxAim,
  bounce: sfxBounce,
  hit: sfxHit,
  break: sfxBreak,
  rowClear: sfxRowClear,
  addBall: sfxAddBall,
  cometCharge: sfxCometCharge,
  cometFire: sfxCometFire,
  shieldBlock: sfxShieldBlock,
  waveEnter: sfxWaveEnter,
  ballReturn: sfxBallReturn,
  death: sfxDeath,
  ui: sfxUi,
  newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 分层循环（additive，无缝）：8s 循环，所有分音频率取 m/8Hz 保证整数周期
// ---------------------------------------------------------------------------
function synthBgm(sr) {
  const dur = 8;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // 分音：频率 = round(f*8)/8，8s 内整数周期 → 首尾无缝
  const partials = [
    { f: 55, amp: 0.10, lfo: 0.25, lfoAmp: 0.03 },
    { f: 110, amp: 0.08, lfo: 0.25, lfoAmp: 0.03 },
    { f: 164.75, amp: 0.06, lfo: 0.5, lfoAmp: 0.02 },
    { f: 220, amp: 0.05, lfo: 0.5, lfoAmp: 0.02 },
    { f: 329.625, amp: 0.04, lfo: 0.25, lfoAmp: 0.015 },
    { f: 440, amp: 0.02, lfo: 0.5, lfoAmp: 0.008 },
  ];
  for (const p of partials) {
    const m = Math.round(p.f * dur);
    const f = m / dur;
    const phaseStep = (2 * Math.PI * f) / sr;
    const lfoStep = (2 * Math.PI * p.lfo) / sr;
    let phase = 0;
    for (let i = 0; i < n; i += 1) {
      const env = p.amp + p.lfoAmp * Math.sin(lfoStep * i);
      out[i] += Math.sin(phase) * env;
      phase += phaseStep;
    }
  }
  // 轻柔琶音层：8 个音各 1s
  const arp = [440, 329.625, 220, 164.75, 220, 329.625, 440, 523.25];
  arp.forEach((f, k) => {
    const m = Math.round(f * dur);
    const ff = m / dur;
    const s = osc({ type: 'triangle', freq: ff, dur: 0.6, sr, gain: 0.045, attack: 0.02, release: 0.3 });
    addAt(out, s, Math.round(k * 1.0 * sr));
  });
  // 低频噪声底（无缝：用整周期 LFO 调制）
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 300, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  addAt(out, buf, 0);
  // 归一峰峰值到安全范围
  let peak = 0;
  for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.9) {
    const k = 0.9 / peak;
    for (let i = 0; i < n; i += 1) out[i] *= k;
  }
  return out;
}

const LOOPS = { bgm: synthBgm };
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
  break: 6, cometFire: 6,
  rowClear: 5, addBall: 5,
  death: 4, waveEnter: 4, newRecord: 4, shot: 4,
  hit: 3, bounce: 3, shieldBlock: 3,
  cometCharge: 2, ballReturn: 2,
  aim: 1, ui: 1,
};

const EVENT_TO_SFX = {
  shot: 'shot',
  aim: 'aim',
  ballBounce: 'bounce',
  ballHit: 'hit',
  asteroidBreak: 'break',
  rowClear: 'rowClear',
  addBall: 'addBall',
  cometCharge: 'cometCharge',
  cometFire: 'cometFire',
  shieldBlock: 'shieldBlock',
  waveEnter: 'waveEnter',
  ballReturn: 'ballReturn',
  death: 'death',
  ui: 'ui',
  newRecord: 'newRecord',
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
    state.bgmBus.gain.value = 1;
    state.bgmBus.connect(state.master);
    resumeIfNeeded();
    return state.ctx;
  }

  function pruneActive(now) {
    for (const [key, v] of state.active) if (v.endTime <= now) state.active.delete(key);
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
      try { state.active.get(minKey).stop(now); } catch { /* noop */ }
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
    state.active.set(key, {
      name,
      priority,
      endTime: now + pcm.length / ctx.sampleRate,
      stop: (t) => { try { src.stop(t); } catch { /* noop */ } },
    });
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      resumeIfNeeded();
      state.unlocked = true;
    }
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

  function stopBgm() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
  }

  function playBgm() {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgm();
    try {
      const pcm = synthLoop('bgm', ctx.sampleRate);
      const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      buf.getChannelData(0).set(pcm);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(state.bgmBus);
      src.start();
      state.bgmSource = src;
    } catch { /* BGM 合成失败静默降级 */ }
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
