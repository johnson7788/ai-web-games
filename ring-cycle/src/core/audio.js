// src/core/audio.js — RING CYCLE · M4 音效合成与播放（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer 播放；BGM 用 3 层程序化循环（pad 底/arp 琶音/hat 轻响），
//     全程不打包任何音频文件。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }

import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.24;

// ---------------------------------------------------------------------------
// 采样级 DSP 原语
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

function sfxRingClear(p, sr) {
  const f = 620 * Math.pow(2, clamp(p.combo ?? 0, 0, 12) / 12);
  const pop = osc({ type: 'triangle', freq: f, freqEnd: f * 0.6, dur: 0.14, sr, gain: 0.42, attack: 0.004, release: 0.07 });
  const click = noise({ dur: 0.05, sr, gain: 0.2, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.02 });
  return mix(pop, click);
}

function sfxRingBounce(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 80, dur: 0.12, sr, gain: 0.38, attack: 0.004, release: 0.06 });
  const crack = noise({ dur: 0.08, sr, gain: 0.2, filter: 'lowpass', cutoff: 900, attack: 0.002, release: 0.05 });
  return mix(thud, crack);
}

function sfxRainbow(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.34, gap: 0.09, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.14, sr });
}

function sfxBandEnter(_p, sr) {
  return notes({ freqs: [330, 415.3, 494, 659.25], dur: 0.5, gap: 0.11, type: 'triangle', gain: 0.15, attack: 0.05, release: 0.16, sr });
}

function sfxDyeShift(_p, sr) {
  return osc({ type: 'sine', freq: 700, freqEnd: 1050, dur: 0.09, sr, gain: 0.2, attack: 0.003, release: 0.05 });
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.9, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.6, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

function sfxComboUp(p, sr) {
  const f = 660 * Math.pow(2, clamp(p.combo ?? 0, 0, 12) / 12);
  return osc({ type: 'sine', freq: f, freqEnd: f * 1.5, dur: 0.1, sr, gain: 0.2, attack: 0.003, release: 0.05 });
}

function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 230, dur: 0.16, sr, gain: 0.18, attack: 0.005, release: 0.08 });
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.18, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.1, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  ringClear: sfxRingClear,
  ringBounce: sfxRingBounce,
  rainbow: sfxRainbow,
  bandEnter: sfxBandEnter,
  dyeShift: sfxDyeShift,
  nearMiss: sfxNearMiss,
  death: sfxDeath,
  milestone: sfxMilestone,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  comboUp: sfxComboUp,
  comboBreak: sfxComboBreak,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 循环层（无缝 loop 的 PCM；全部整数周期，边界无咔哒）
// ---------------------------------------------------------------------------

// 底层和弦 pad：f0=55Hz，谐波 1..6，2s 一周期（110 个整周期）
function loopPad(sr) {
  const dur = 2;
  const f0 = 55;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const amp = [0.30, 0.22, 0.16, 0.10, 0.06, 0.04];
  for (let k = 0; k < amp.length; k += 1) {
    const f = f0 * (k + 1);
    const s = osc({ type: 'triangle', freq: f, dur, sr, gain: amp[k], attack: 0.4, release: 0.4 });
    for (let i = 0; i < n; i += 1) out[i] += s[i];
  }
  return normalizeRms(out, 0.12);
}

// 琶音旋律层：A3-C#4-E4-C#4（都是 f0=55 的整数倍），每音 0.5s，共 2s，无缝
function loopArp(sr) {
  const f0 = 55;
  const freqs = [f0 * 4, f0 * 5, f0 * 6, f0 * 5];
  const noteDur = 0.42;
  const gap = 0.5;
  const total = freqs.length * gap;
  const out = new Float32Array(Math.max(1, Math.round(total * sr)));
  freqs.forEach((f, k) => {
    const s = osc({ type: 'triangle', freq: f, dur: noteDur, sr, gain: 0.22, attack: 0.01, release: 0.16 });
    addAt(out, s, Math.round(k * gap * sr));
  });
  return normalizeRms(out, 0.10);
}

// 轻响层：2s 内 4 个短促噪声 tick（首尾静音，无缝）
function loopHat(sr) {
  const dur = 2;
  const out = new Float32Array(Math.round(dur * sr));
  for (let k = 0; k < 4; k += 1) {
    const s = noise({ dur: 0.04, sr, gain: 0.1, filter: 'highpass', cutoff: 2400, attack: 0.001, release: 0.03 });
    addAt(out, s, Math.round((0.25 + k * 0.5) * sr));
  }
  return out;
}

const LOOPS = {
  pad: loopPad,
  arp: loopArp,
  hat: loopHat,
};

export const LOOP_NAMES = Object.keys(LOOPS);

// ---------------------------------------------------------------------------
// 公开合成接口（供 audio-check 离线调用）
// ---------------------------------------------------------------------------

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

const EVENT_TO_SFX = {
  ringClear: 'ringClear',
  ringBounce: 'ringBounce',
  rainbow: 'rainbow',
  bandEnter: 'bandEnter',
  dyeShift: 'dyeShift',
  nearMiss: 'nearMiss',
  death: 'death',
  depthMilestone: 'milestone',
  ringMilestone: 'milestone',
  comboUp: 'comboUp',
  comboBreak: 'comboBreak',
  tutorialDone: 'chime',
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
    loops: { pad: null, arp: null, hat: null },
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

    pruneActive(now);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null;
      let minEnd = Infinity;
      for (const [key, v] of state.active) {
        if (v.endTime < minEnd) { minEnd = v.endTime; minKey = key; }
      }
      if (minKey != null) { stopVoice(state.active.get(minKey), now); state.active.delete(minKey); }
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
      endTime: now + pcm.length / ctx.sampleRate,
      stop: (t) => { try { src.stop(t); } catch { /* noop */ } },
    });
  }

  function startLoop(kind) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.loops[kind]) return;
    const pcm = synthLoop(kind, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = kind === 'hat' ? 0.7 : 1;
    src.connect(g);
    g.connect(state.bgmBus);
    src.start();
    state.loops[kind] = { src, g };
  }

  function stopLoop(kind) {
    const l = state.loops[kind];
    if (!l) return;
    try { l.src.stop(); } catch { /* noop */ }
    state.loops[kind] = null;
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

  function playBgm() {
    ensureCtx();
    startLoop('pad');
    startLoop('arp');
    startLoop('hat');
  }

  function stopBgm() {
    stopLoop('pad');
    stopLoop('arp');
    stopLoop('hat');
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
