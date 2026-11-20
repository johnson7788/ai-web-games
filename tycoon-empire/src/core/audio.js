// src/core/audio.js — 程序化 WebAudio 音频：采样级合成器（可离线校验）+ 浏览器播放层。
// BGM 用分层循环（主垫 + 行情垫），SFX 每个游戏事件至少一个。零外链零音频文件。
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.25;

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

function notes({ freqs, dur = 0.3, gap = 0.1, type = 'triangle', gain = 0.2, attack = 0.01, release = 0.12, sr = SAMPLE_RATE } = {}) {
  const total = (freqs.length - 1) * gap + dur;
  const out = new Float32Array(Math.max(1, Math.round(total * sr)));
  freqs.forEach((f, k) => {
    const s = osc({ type, freq: f, dur, sr, gain, attack, release });
    addAt(out, s, Math.round(k * gap * sr));
  });
  return out;
}

// ---------- 各音效 ----------
function sfxTap(_p, sr) {
  const click = osc({ type: 'sine', freq: 1500, freqEnd: 900, dur: 0.05, sr, gain: 0.28, attack: 0.002, release: 0.02 });
  const body = noise({ dur: 0.03, sr, gain: 0.1, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.01 });
  return mix(click, body);
}

function sfxTapCombo(_p, sr) {
  return notes({ freqs: [660, 880, 1320], dur: 0.16, gap: 0.05, type: 'sine', gain: 0.26, sr });
}

function sfxBuy(_p, sr) {
  const ring = notes({ freqs: [523.25, 659.25, 783.99], dur: 0.28, gap: 0.09, type: 'triangle', gain: 0.28, sr });
  const clink = noise({ dur: 0.05, sr, gain: 0.14, filter: 'highpass', cutoff: 3000, attack: 0.001, release: 0.02 });
  return mix(ring, clink);
}

function sfxUpgrade(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.2, gap: 0.07, type: 'triangle', gain: 0.24, sr });
}

function sfxHire(_p, sr) {
  return notes({ freqs: [587.33, 880], dur: 0.22, gap: 0.1, type: 'sine', gain: 0.24, sr });
}

function sfxCollect(_p, sr) {
  const clink = notes({ freqs: [880, 1108.7, 1318.5, 1760], dur: 0.18, gap: 0.05, type: 'sine', gain: 0.22, sr });
  const nz = noise({ dur: 0.08, sr, gain: 0.1, filter: 'highpass', cutoff: 2600, attack: 0.001, release: 0.04 });
  return mix(clink, nz);
}

function sfxIncome(_p, sr) {
  return osc({ type: 'sine', freq: 1200, freqEnd: 1000, dur: 0.04, sr, gain: 0.07, attack: 0.002, release: 0.02 });
}

function sfxMilestone(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.32, gap: 0.1, type: 'triangle', gain: 0.2, sr });
}

function sfxBuildingUp(_p, sr) {
  const clink = notes({ freqs: [660, 990, 1320, 1980], dur: 0.22, gap: 0.06, type: 'sine', gain: 0.22, sr });
  const chain = noise({ dur: 0.12, sr, gain: 0.12, filter: 'highpass', cutoff: 1800, attack: 0.002, release: 0.06 });
  return mix(clink, chain);
}

function sfxStockDay(_p, sr) {
  const bell = osc({ type: 'triangle', freq: 880, freqEnd: 860, dur: 0.4, sr, gain: 0.26, attack: 0.004, release: 0.2 });
  const bell2 = osc({ type: 'triangle', freq: 1174.7, freqEnd: 1150, dur: 0.4, sr, gain: 0.16, attack: 0.004, release: 0.2 });
  return mix(bell, bell2);
}

function sfxStockResolve(p, sr) {
  if (p && p.up) return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.24, gap: 0.07, type: 'triangle', gain: 0.24, sr });
  return notes({ freqs: [523.25, 415.3, 329.63, 246.94], dur: 0.24, gap: 0.07, type: 'triangle', gain: 0.24, sr });
}

function sfxAllIn(_p, sr) {
  const whoosh = noise({ dur: 0.3, sr, gain: 0.3, filter: 'highpass', cutoff: 900, attack: 0.03, release: 0.12 });
  return whoosh;
}

function sfxLoan(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 110, freqEnd: 60, dur: 0.3, sr, gain: 0.4, attack: 0.005, release: 0.15 });
  const nz = noise({ dur: 0.2, sr, gain: 0.2, filter: 'lowpass', cutoff: 300, attack: 0.004, release: 0.1 });
  return mix(thud, nz);
}

function sfxLoanInterest(_p, sr) {
  return osc({ type: 'square', freq: 620, freqEnd: 500, dur: 0.12, sr, gain: 0.14, attack: 0.004, release: 0.06 });
}

function sfxRepay(_p, sr) {
  return notes({ freqs: [659.25, 783.99, 1046.5], dur: 0.24, gap: 0.08, type: 'sine', gain: 0.24, sr });
}

function sfxBankrupt(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 500, freqEnd: 55, dur: 1.0, sr, gain: 0.4, attack: 0.01, release: 0.3 });
  const nz = noise({ dur: 0.7, sr, gain: 0.2, filter: 'lowpass', cutoff: 600, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxOfflineIncome(_p, sr) {
  return notes({ freqs: [659.25, 880, 1108.7, 1318.5], dur: 0.26, gap: 0.08, type: 'sine', gain: 0.22, sr });
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.24, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxChime(_p, sr) {
  return notes({ freqs: [880, 1318.5], dur: 0.3, gap: 0.08, type: 'sine', gain: 0.2, sr });
}

const SYNTH = {
  tap: sfxTap,
  tapCombo: sfxTapCombo,
  buy: sfxBuy,
  upgrade: sfxUpgrade,
  hire: sfxHire,
  collect: sfxCollect,
  income: sfxIncome,
  milestone: sfxMilestone,
  buildingUp: sfxBuildingUp,
  stockDay: sfxStockDay,
  stockResolve: sfxStockResolve,
  allIn: sfxAllIn,
  loan: sfxLoan,
  loanInterest: sfxLoanInterest,
  repay: sfxRepay,
  bankrupt: sfxBankrupt,
  offlineIncome: sfxOfflineIncome,
  newRecord: sfxNewRecord,
  ui: sfxUi,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------- 循环层（BGM 分层无缝循环） ----------
function loopMain(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const chord = [130.81, 196.0, 261.63, 329.63]; // C3 G3 C4 E4
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    let s = 0;
    for (const f of chord) {
      s += Math.sin(2 * Math.PI * f * t) * 0.06;
      s += Math.sin(2 * Math.PI * f * 2 * t) * 0.02;
    }
    out[i] = s * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t));
  }
  return out;
}

function loopMarket(sr) {
  const dur = 3;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 420, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.03 * Math.sin(2 * Math.PI * 0.5 * t);
  }
  return buf;
}

const LOOPS = { main: loopMain, market: loopMarket };
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

const EVENT_TO_SFX = {
  tap: 'tap',
  tapCombo: 'tapCombo',
  buy: 'buy',
  upgrade: 'upgrade',
  hire: 'hire',
  collect: 'collect',
  income: 'income',
  milestone: 'milestone',
  buildingUp: 'buildingUp',
  stockDay: 'stockDay',
  stockResolve: 'stockResolve',
  allIn: 'allIn',
  allInResult: 'allIn',
  loan: 'loan',
  loanInterest: 'loanInterest',
  repay: 'repay',
  bankrupt: 'bankrupt',
  offlineIncome: 'offlineIncome',
  newRecord: 'newRecord',
  tutorialDone: 'chime',
  ui: 'ui',
};

// ---------- 播放层 ----------
export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    loops: {},
    active: new Map(),
    lastPlay: new Map(),
    voiceSeq: 0,
    bgmKind: null,
  };

  function ensureCtx() {
    if (state.ctx) {
      if (state.ctx.state === 'suspended' && typeof state.ctx.resume === 'function') state.ctx.resume().catch(() => {});
      return state.ctx;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    state.ctx = new AC();
    state.master = state.ctx.createGain();
    state.master.gain.value = state.muted ? 0 : state.volume;
    state.master.connect(state.ctx.destination);
    return state.ctx;
  }

  function playSfx(name, payload) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);
    for (const [k, v] of state.active) if (v.endTime <= now) state.active.delete(k);
    if (state.active.size >= MAX_VOICES) return;
    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.master);
    src.start(now);
    const key = `v${state.voiceSeq++}`;
    state.active.set(key, { endTime: now + pcm.length / ctx.sampleRate });
  }

  function startLoop(kind) {
    const ctx = ensureCtx();
    if (!ctx || state.loops[kind]) return;
    const pcm = synthLoop(kind, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(state.master);
    src.start();
    state.loops[kind] = src;
  }

  function stopLoop(kind) {
    const l = state.loops[kind];
    if (!l) return;
    try { l.stop(); } catch { /* noop */ }
    state.loops[kind] = null;
  }

  function unlock() {
    ensureCtx();
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

  function playBgm(kind = 'main') {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmKind === kind) return;
    if (state.bgmKind) stopLoop(state.bgmKind);
    state.bgmKind = kind;
    startLoop(kind);
  }

  function stopBgm() {
    if (state.bgmKind) stopLoop(state.bgmKind);
    state.bgmKind = null;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
