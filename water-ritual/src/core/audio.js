// src/core/audio.js — WATER RITUAL · 程序化 WebAudio（零依赖零外链，不打包音频文件）。
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     BGM 由 pad / melody / bass / kettle 四个无缝循环层叠加，首帧起即分层、可无缝 loop。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 24;
const NOISE_RMS = 0.22;

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
  for (let i = 0; i < input.length; i += 1) { y = a * y + (1 - a) * input[i]; out[i] = y; }
  return out;
}

function highpass(input, cutoff, sr) {
  const a = Math.exp(-2 * Math.PI * cutoff / sr);
  const out = new Float32Array(input.length);
  let xPrev = 0; let yPrev = 0;
  for (let i = 0; i < input.length; i += 1) {
    const x = input[i];
    const y = a * (yPrev + x - xPrev);
    out[i] = y; yPrev = y; xPrev = x;
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

// 无缝循环音色：频率取整到循环时长内的整数周期，loop 边界相位连续。
function loopTone(dur, freq, type, sr, gain) {
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const k = Math.max(1, Math.round(freq * dur));
  for (let i = 0; i < n; i += 1) out[i] = oscSample(type, (2 * Math.PI * k * i) / n) * gain;
  return out;
}

// ---------------------------------------------------------------------------
// 音效合成器（均为 (payload, sr) => Float32Array）
// ---------------------------------------------------------------------------
function sfxPourStart(_p, sr) {
  return noise({ dur: 0.4, sr, gain: 0.32, filter: 'bandpass', cutoff: 900, attack: 0.04, release: 0.16 });
}
function sfxPourFeather(_p, sr) {
  return osc({ type: 'sine', freq: 720, freqEnd: 520, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.03 });
}
function sfxPourAbort(_p, sr) {
  return osc({ type: 'sine', freq: 480, freqEnd: 360, dur: 0.1, sr, gain: 0.14, attack: 0.004, release: 0.06 });
}
function sfxOrderScored(p, sr) {
  const rating = p.rating || 'ok';
  const base = rating === 'perfect' ? 740 : rating === 'good' ? 620 : rating === 'poor' ? 360 : 520;
  return notes({ freqs: [base, base * 1.25], dur: 0.18, gap: 0.07, type: 'triangle', gain: 0.26, sr, attack: 0.006, release: 0.1 });
}
function sfxPerfect(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.26, sr, attack: 0.01, release: 0.18 });
}
function sfxSpill(_p, sr) {
  const splash = noise({ dur: 0.4, sr, gain: 0.5, filter: 'lowpass', cutoff: 1600, attack: 0.004, release: 0.2 });
  const thud = osc({ type: 'triangle', freq: 130, freqEnd: 70, dur: 0.25, sr, gain: 0.32, attack: 0.004, release: 0.14 });
  return mix(splash, thud);
}
function sfxOrderExpired(_p, sr) {
  return osc({ type: 'triangle', freq: 420, freqEnd: 220, dur: 0.3, sr, gain: 0.2, attack: 0.006, release: 0.16 });
}
function sfxHeartLost(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 110, freqEnd: 55, dur: 0.3, sr, gain: 0.5, attack: 0.004, release: 0.16 });
  const nz = noise({ dur: 0.2, sr, gain: 0.28, filter: 'lowpass', cutoff: 240, attack: 0.003, release: 0.1 });
  return mix(thud, nz);
}
function sfxRushWave(_p, sr) {
  return notes({ freqs: [440, 554.37, 659.25], dur: 0.16, gap: 0.07, type: 'square', gain: 0.16, sr, attack: 0.004, release: 0.07 });
}
function sfxFullHouse(_p, sr) {
  return notes({ freqs: [392, 493.88, 587.33, 783.99, 987.77], dur: 0.34, gap: 0.08, type: 'triangle', gain: 0.26, sr, attack: 0.01, release: 0.16 });
}
function sfxDayStart(_p, sr) {
  return notes({ freqs: [330, 415.3], dur: 0.4, gap: 0.12, type: 'sine', gain: 0.18, sr, attack: 0.05, release: 0.2 });
}
function sfxDayEnd(_p, sr) {
  return notes({ freqs: [415.3, 330], dur: 0.4, gap: 0.12, type: 'sine', gain: 0.18, sr, attack: 0.05, release: 0.2 });
}
function sfxUpgradeUnlock(_p, sr) {
  return notes({ freqs: [330, 440, 554.37, 659.25], dur: 0.18, gap: 0.06, type: 'triangle', gain: 0.24, sr, attack: 0.005, release: 0.09 });
}
function sfxWin(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25, 783.99], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.24, sr, attack: 0.01, release: 0.22 });
}
function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 70, dur: 0.9, sr, gain: 0.36, attack: 0.01, release: 0.3 });
  const nz = noise({ dur: 0.6, sr, gain: 0.2, filter: 'lowpass', cutoff: 600, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 880, freqEnd: 660, dur: 0.06, sr, gain: 0.2, attack: 0.002, release: 0.04 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.42, gap: 0.12, type: 'triangle', gain: 0.26, sr, attack: 0.01, release: 0.18 });
}
function sfxOrderSkipped(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 420, dur: 0.12, sr, gain: 0.16, attack: 0.004, release: 0.07 });
}

const SYNTH = {
  pourStart: sfxPourStart,
  pourFeather: sfxPourFeather,
  pourAbort: sfxPourAbort,
  orderScored: sfxOrderScored,
  perfect: sfxPerfect,
  spill: sfxSpill,
  orderExpired: sfxOrderExpired,
  heartLost: sfxHeartLost,
  rushWave: sfxRushWave,
  fullHouse: sfxFullHouse,
  dayStart: sfxDayStart,
  dayEnd: sfxDayEnd,
  upgradeUnlock: sfxUpgradeUnlock,
  win: sfxWin,
  death: sfxDeath,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  orderSkipped: sfxOrderSkipped,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 循环层（无缝 loop 的 PCM）
// ---------------------------------------------------------------------------
const PENTA = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33, 659.25];

function loopPad(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // A 小调七和弦，每个音都是循环时长内的整数周期
  const freqs = [220, 261.63, 329.63, 392];
  for (const f of freqs) {
    const tone = loopTone(dur, f, 'triangle', sr, 0.05);
    for (let i = 0; i < n; i += 1) out[i] += tone[i];
  }
  // 慢呼吸 LFO（整数周期）
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    out[i] *= 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.5 * t);
  }
  return normalizeRms(out, 0.06);
}

function loopMelody(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const step = 0.5;
  for (let s = 0; s < 8; s += 1) {
    const idx = (s * 2 + s) % PENTA.length;
    const tone = osc({ type: 'triangle', freq: PENTA[idx], dur: 0.4, sr, gain: 0.11, attack: 0.01, release: 0.28 });
    addAt(out, tone, Math.round(s * step * sr));
  }
  return normalizeRms(out, 0.05);
}

function loopBass(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  let out = new Float32Array(n);
  const tone = loopTone(dur, 110, 'sine', sr, 0.14);
  for (let i = 0; i < n; i += 1) out[i] = tone[i];
  // 每 0.5s 一个轻柔的拨弦脉冲
  for (let s = 0; s < 4; s += 1) {
    const t = osc({ type: 'sine', freq: 220, dur: 0.22, sr, gain: 0.08, attack: 0.004, release: 0.14 });
    addAt(out, t, Math.round(s * 0.5 * sr));
  }
  return normalizeRms(out, 0.07);
}

function loopKettle(sr) {
  const dur = 3;
  const n = Math.round(dur * sr);
  let out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = Math.random() * 2 - 1;
  out = bandpass(out, 2400, sr);
  out = normalizeRms(out, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    out[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.333 * t);
  }
  return out;
}

const LOOPS = { pad: loopPad, melody: loopMelody, bass: loopBass, kettle: loopKettle };
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
const EVENT_TO_SFX = {
  pourStart: 'pourStart',
  pourFeather: 'pourFeather',
  pourAbort: 'pourAbort',
  orderScored: 'orderScored',
  perfect: 'perfect',
  spill: 'spill',
  orderExpired: 'orderExpired',
  heartLost: 'heartLost',
  rushWave: 'rushWave',
  fullHouse: 'fullHouse',
  dayStart: 'dayStart',
  dayEnd: 'dayEnd',
  upgradeUnlock: 'upgradeUnlock',
  win: 'win',
  death: 'death',
  ui: 'ui',
  newRecord: 'newRecord',
  orderSkipped: 'orderSkipped',
};

const SFX_PRIORITY = {
  perfect: 6, fullHouse: 6, win: 6,
  spill: 5, heartLost: 5, death: 5,
  orderScored: 4, upgradeUnlock: 4, newRecord: 4,
  rushWave: 3, dayStart: 3, dayEnd: 3,
  pourStart: 2, pourFeather: 1, pourAbort: 1, orderExpired: 2, orderSkipped: 1, ui: 1,
};

export function createAudio() {
  const state = {
    ctx: null, master: null, sfxBus: null, bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    unlocked: false,
    bgmNodes: [],
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
    state.sfxBus.connect(state.master);
    state.bgmBus = state.ctx.createGain();
    state.bgmBus.connect(state.master);
    resumeIfNeeded();
    return state.ctx;
  }

  function prune(now) {
    for (const [k, v] of state.active) if (v.endTime <= now) state.active.delete(k);
  }

  function playSfx(name, payload) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);

    const priority = SFX_PRIORITY[name] ?? 1;
    prune(now);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null; let minPrio = Infinity;
      for (const [k, v] of state.active) if (v.priority < minPrio) { minPrio = v.priority; minKey = k; }
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
    const key = 'v' + state.voiceSeq++;
    state.active.set(key, { name, priority, endTime: now + pcm.length / ctx.sampleRate, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
  }

  function startBgmLoop(name, gainVal) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const pcm = synthLoop(name, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = gainVal;
    src.connect(g);
    g.connect(state.bgmBus);
    src.start();
    state.bgmNodes.push({ src, g });
  }

  function stopBgm() {
    for (const n of state.bgmNodes) { try { n.src.stop(); } catch { /* noop */ } }
    state.bgmNodes = [];
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) { resumeIfNeeded(); state.unlocked = true; }
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
    const ctx = ensureCtx();
    if (!ctx || state.bgmNodes.length) return;
    startBgmLoop('pad', 0.5);
    startBgmLoop('melody', 0.34);
    startBgmLoop('bass', 0.42);
    startBgmLoop('kettle', 0.24);
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
