// src/core/audio.js — FOOD CHAIN · 程序化音频（WebAudio 标准 API，零依赖零外链，无音频文件）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 / BGM 分层 = 振荡器 + 噪声 + 包络，
//     直接算成 mono Float32Array PCM，供 tools/audio-check.mjs 在 Node（无 WebAudio）离线校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer → AudioBufferSourceNode → GainNode → destination；
//     BGM 用分层合成（pad 和弦 + 低频 bass + 琶音 sparkle），频率快照到 loopDur 整数周期 → 无缝循环。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(mode), stopBgm() }

import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 2;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.25;

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

function sfxEatFood(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.08, sr, gain: 0.25, attack: 0.004, release: 0.04 });
}

function sfxEatPrey(_p, sr) {
  const tone = osc({ type: 'triangle', freq: 320, freqEnd: 180, dur: 0.16, sr, gain: 0.4, attack: 0.004, release: 0.08 });
  const pop = noise({ dur: 0.06, sr, gain: 0.22, filter: 'lowpass', cutoff: 1400, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

function sfxEatToxic(_p, sr) {
  const buzz = osc({ type: 'sawtooth', freq: 220, freqEnd: 96, dur: 0.28, sr, gain: 0.26, attack: 0.005, release: 0.12 });
  const nz = noise({ dur: 0.2, sr, gain: 0.2, filter: 'bandpass', cutoff: 700, attack: 0.003, release: 0.1 });
  return mix(buzz, nz);
}

function sfxLightChain(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.34, gap: 0.09, type: 'triangle', gain: 0.26, attack: 0.01, release: 0.14, sr });
}

function sfxEvolve(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.22, attack: 0.02, release: 0.16, sr });
}

function sfxDevolve(_p, sr) {
  return osc({ type: 'triangle', freq: 480, freqEnd: 180, dur: 0.4, sr, gain: 0.22, attack: 0.01, release: 0.18 });
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxSymbioseStart(_p, sr) {
  return osc({ type: 'sine', freq: 440, freqEnd: 520, dur: 0.3, sr, gain: 0.2, attack: 0.05, release: 0.12 });
}

function sfxSymbioseProgress(_p, sr) {
  return osc({ type: 'sine', freq: 700, freqEnd: 760, dur: 0.04, sr, gain: 0.08, attack: 0.004, release: 0.02 });
}

function sfxStingGain(_p, sr) {
  return notes({ freqs: [659.25, 783.99, 1046.5], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.14, sr });
}

function sfxStingUse(_p, sr) {
  const whoosh = noise({ dur: 0.3, sr, gain: 0.3, filter: 'bandpass', cutoff: 1200, attack: 0.03, release: 0.12 });
  const chime = notes({ freqs: [880, 1318.5], dur: 0.24, gap: 0.07, type: 'triangle', gain: 0.2, sr });
  return mix(whoosh, chime);
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.42, gap: 0.12, type: 'triangle', gain: 0.24, attack: 0.02, release: 0.2, sr });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.05, sr, gain: 0.07, attack: 0.004, release: 0.03 });
}

function sfxDanger(_p, sr) {
  return osc({ type: 'triangle', freq: 140, freqEnd: 90, dur: 0.12, sr, gain: 0.18, attack: 0.004, release: 0.06 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  eatFood: sfxEatFood,
  eatPrey: sfxEatPrey,
  eatToxic: sfxEatToxic,
  lightChain: sfxLightChain,
  evolve: sfxEvolve,
  devolve: sfxDevolve,
  nearMiss: sfxNearMiss,
  symbioseStart: sfxSymbioseStart,
  symbioseProgress: sfxSymbioseProgress,
  stingGain: sfxStingGain,
  stingUse: sfxStingUse,
  death: sfxDeath,
  win: sfxWin,
  milestone: sfxMilestone,
  danger: sfxDanger,
  ui: sfxUi,
  newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（无缝）：水声环境 + BGM（分层 pad+bass+sparkle，频率快照到 loopDur 整数周期）
// ---------------------------------------------------------------------------

function loopWater(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 380, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

// 频率快照到 loopDur 整数周期（保证无缝循环）
function snap(freq, loopDur) {
  return Math.max(1, Math.round(freq * loopDur) / loopDur);
}

function toneInto(buf, sr, { freq, startSec, durSec, type, gain, attack = 0.4, release = 0.8, loopDur }) {
  const f = snap(freq, loopDur);
  const n = Math.round(durSec * sr);
  const s = osc({ type, freq: f, dur: durSec, sr, gain, attack, release });
  addAt(buf, s, Math.round(startSec * sr));
}

// BGM：8s 无缝循环，水下小调氛围（pad 和弦 + bass + 琶音 sparkle）
function loopBgm(sr) {
  const loopDur = 8;
  const n = Math.round(loopDur * sr);
  const buf = new Float32Array(n);

  const chords = [
    [110.0, 164.81, 220.0],   // Am
    [98.0, 146.83, 196.0],    // G
    [87.31, 130.81, 174.61],  // F
    [110.0, 164.81, 220.0],   // Am
  ];
  const roots = [55.0, 49.0, 43.65, 55.0];

  for (let c = 0; c < 4; c += 1) {
    const startSec = c * 2;
    for (const f of chords[c]) {
      toneInto(buf, sr, { freq: f, startSec, durSec: 2.4, type: 'triangle', gain: 0.06, attack: 0.5, release: 0.9, loopDur });
    }
    toneInto(buf, sr, { freq: roots[c], startSec, durSec: 2.0, type: 'sine', gain: 0.10, attack: 0.2, release: 0.5, loopDur });
  }

  // 琶音 sparkle（每 0.5s 一个音，环绕和弦音高八度）
  const arp = [440.0, 523.25, 659.25, 783.99, 659.25, 523.25];
  for (let i = 0; i < 16; i += 1) {
    const f = arp[i % arp.length];
    toneInto(buf, sr, { freq: f, startSec: i * 0.5, durSec: 0.5, type: 'sine', gain: 0.045, attack: 0.02, release: 0.2, loopDur });
  }

  return normalizeRms(buf, 0.09);
}

const LOOPS = {
  water: loopWater,
  bgm: loopBgm,
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

// ---------------------------------------------------------------------------
// 播放层
// ---------------------------------------------------------------------------

const SFX_PRIORITY = {
  lightChain: 6, eatPrey: 6, eatFood: 6,
  stingUse: 5, evolve: 5, death: 5, win: 5, stingGain: 5,
  eatToxic: 4, devolve: 4, nearMiss: 4, newRecord: 4,
  symbioseStart: 3, danger: 3,
  milestone: 2, symbioseProgress: 2, ui: 1,
};

const EVENT_TO_SFX = {
  eatFood: 'eatFood',
  eatPrey: 'eatPrey',
  eatToxic: 'eatToxic',
  lightChain: 'lightChain',
  evolve: 'evolve',
  devolve: 'devolve',
  nearMiss: 'nearMiss',
  symbioseStart: 'symbioseStart',
  symbioseProgress: 'symbioseProgress',
  stingGain: 'stingGain',
  stingUse: 'stingUse',
  death: 'death',
  win: 'win',
  milestone: 'milestone',
  danger: 'danger',
  ui: 'ui',
  newRecord: 'newRecord',
};

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
    bgmLoop: null,
    loops: { water: null, bgm: null },
    active: new Map(),
    lastPlay: new Map(),
    voiceSeq: 0,
  };

  function resumeIfNeeded() {
    const c = state.ctx;
    if (c && c.state === 'suspended' && typeof c.resume === 'function') c.resume().catch(() => {});
  }

  function ensureCtx() {
    if (state.ctx) { resumeIfNeeded(); return state.ctx; }
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
    g.gain.value = 1;
    src.connect(g);
    g.connect(kind === 'bgm' ? state.bgmBus : state.sfxBus);
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
      startLoop('water');
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

  async function playBgm() {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmLoop) return;
    startLoop('bgm');
  }

  function stopBgm() {
    stopLoop('bgm');
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
