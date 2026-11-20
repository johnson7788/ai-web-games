// src/core/audio.js — CARD LORD 程序化音频：采样级合成（Node 可离线校验）+ 浏览器播放层。
// 零音频文件、零外链。BGM 用合成循环层（无 URL fetch），SFX 每事件至少一个。
// 契约：createAudio() → { unlock, event, setMuted, setVolume, playBgm(mode), stopBgm }。
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 20;
const NOISE_RMS = 0.22;

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

// ---------------- SFX ----------------

function sfxDeal(_p, sr) {
  const flick = noise({ dur: 0.08, sr, gain: 0.3, filter: 'highpass', cutoff: 1800, attack: 0.002, release: 0.04 });
  const blip = osc({ type: 'sine', freq: 720, freqEnd: 900, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 });
  return mix(flick, blip);
}

function sfxBid(_p, sr) {
  const click = osc({ type: 'square', freq: 520, freqEnd: 420, dur: 0.06, sr, gain: 0.2, attack: 0.002, release: 0.03 });
  const ring = osc({ type: 'sine', freq: 1040, dur: 0.08, sr, gain: 0.12, attack: 0.002, release: 0.05 });
  return mix(click, ring);
}

function sfxLandlord(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25], dur: 0.35, gap: 0.11, type: 'triangle', gain: 0.22, sr });
}

function sfxDouble(_p, sr) {
  return notes({ freqs: [523.25, 783.99], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.2, sr });
}

function sfxPlay(_p, sr) {
  const snap = noise({ dur: 0.04, sr, gain: 0.3, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.02 });
  const tap = osc({ type: 'triangle', freq: 880, freqEnd: 620, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.03 });
  return mix(snap, tap);
}

function sfxPass(_p, sr) {
  return osc({ type: 'sine', freq: 300, freqEnd: 210, dur: 0.07, sr, gain: 0.14, attack: 0.004, release: 0.04 });
}

function sfxBomb(_p, sr) {
  const boom = osc({ type: 'triangle', freq: 130, freqEnd: 40, dur: 0.5, sr, gain: 0.5, attack: 0.004, release: 0.22 });
  const crash = noise({ dur: 0.4, sr, gain: 0.4, filter: 'lowpass', cutoff: 500, attack: 0.003, release: 0.2 });
  return mix(boom, crash);
}

function sfxRocket(_p, sr) {
  const boom = osc({ type: 'sawtooth', freq: 90, freqEnd: 30, dur: 0.7, sr, gain: 0.45, attack: 0.004, release: 0.3 });
  const rise = osc({ type: 'square', freq: 220, freqEnd: 660, dur: 0.25, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const crash = noise({ dur: 0.5, sr, gain: 0.3, filter: 'lowpass', cutoff: 700, attack: 0.003, release: 0.25 });
  return mix(boom, crash, rise);
}

function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.24, sr });
}

function sfxLose(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 440, freqEnd: 110, dur: 0.6, sr, gain: 0.28, attack: 0.01, release: 0.2 });
  return glide;
}

function sfxSpring(_p, sr) {
  return notes({ freqs: [659.25, 783.99, 987.77, 1318.5], dur: 0.3, gap: 0.08, type: 'sine', gain: 0.2, sr });
}

function sfxRankUp(_p, sr) {
  return notes({ freqs: [392, 440, 523.25, 659.25, 783.99], dur: 0.28, gap: 0.09, type: 'triangle', gain: 0.22, sr });
}

function sfxHint(_p, sr) {
  return osc({ type: 'sine', freq: 980, freqEnd: 1180, dur: 0.06, sr, gain: 0.12, attack: 0.003, release: 0.03 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxInvalid(_p, sr) {
  const a = osc({ type: 'square', freq: 180, dur: 0.09, sr, gain: 0.16, attack: 0.003, release: 0.05 });
  const b = osc({ type: 'square', freq: 150, dur: 0.09, sr, gain: 0.16, attack: 0.003, release: 0.05 });
  const out = new Float32Array(Math.round(0.16 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.07 * sr));
  return out;
}

function sfxDoublePass(_p, sr) {
  return osc({ type: 'sine', freq: 320, freqEnd: 240, dur: 0.06, sr, gain: 0.12, attack: 0.003, release: 0.04 });
}

const SYNTH = {
  deal: sfxDeal,
  bid: sfxBid,
  landlord: sfxLandlord,
  double: sfxDouble,
  doublePass: sfxDoublePass,
  play: sfxPlay,
  pass: sfxPass,
  bomb: sfxBomb,
  rocket: sfxRocket,
  win: sfxWin,
  lose: sfxLose,
  spring: sfxSpring,
  rankUp: sfxRankUp,
  hint: sfxHint,
  ui: sfxUi,
  invalid: sfxInvalid,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------- 循环层（BGM） ----------------

function padNote(freq, dur, sr, gain) {
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const cyc = Math.round(freq * dur);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const env = 0.5 + 0.5 * Math.sin((2 * Math.PI * (i / n)) - Math.PI / 2); // 首尾 0，无缝
    out[i] = (Math.sin(2 * Math.PI * cyc * t / dur) * 0.6 + Math.sin(4 * Math.PI * cyc * t / dur) * 0.3
      + Math.sin(6 * Math.PI * cyc * t / dur) * 0.1) * env * gain;
  }
  return out;
}

function loopTitle(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const freqs = [220, 277.18, 329.63, 440];
  freqs.forEach((f) => addAt(out, padNote(f, dur, sr, 0.05), 0));
  let nz = new Float32Array(n);
  for (let i = 0; i < n; i += 1) nz[i] = Math.random() * 2 - 1;
  nz = bandpass(nz, 2600, sr);
  nz = normalizeRms(nz, NOISE_RMS);
  for (let i = 0; i < n; i += 1) out[i] += nz[i] * 0.04;
  return out;
}

function loopTable(sr) {
  const dur = 6;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const freqs = [110, 164.81, 220, 261.63];
  freqs.forEach((f) => addAt(out, padNote(f, dur, sr, 0.06), 0));
  let nz = new Float32Array(n);
  for (let i = 0; i < n; i += 1) nz[i] = Math.random() * 2 - 1;
  nz = lowpass(nz, 420, sr);
  nz = normalizeRms(nz, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    out[i] += nz[i] * (0.05 + 0.02 * Math.sin(2 * Math.PI * 0.5 * t));
  }
  return out;
}

const LOOPS = {
  title: loopTitle,
  table: loopTable,
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

const EVENT_TO_SFX = {
  deal: 'deal',
  bid: 'bid',
  landlord: 'landlord',
  double: 'double',
  doublePass: 'doublePass',
  play: 'play',
  pass: 'pass',
  bomb: 'bomb',
  rocket: 'rocket',
  spring: 'spring',
  antiSpring: 'spring',
  roundWin: 'win',
  roundLose: 'lose',
  tierUp: 'rankUp',
  hint: 'hint',
  invalid: 'invalid',
  ui: 'ui',
};

const SFX_PRIORITY = {
  bomb: 6, rocket: 6, win: 5, lose: 5, rankUp: 5,
  landlord: 4, spring: 4, deal: 3, play: 3, bid: 2, double: 2, hint: 2,
  pass: 1, doublePass: 1, invalid: 1, ui: 1,
};

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    bgmSource: null,
    bgmMode: null,
    active: new Map(),
    lastPlay: new Map(),
    voiceSeq: 0,
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
    state.sfxBus = state.ctx.createGain();
    state.sfxBus.connect(state.master);
    state.bgmBus = state.ctx.createGain();
    state.bgmBus.gain.value = 0.5;
    state.bgmBus.connect(state.master);
    return state.ctx;
  }

  function playSfx(name) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);

    const priority = SFX_PRIORITY[name] ?? 1;
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

    const pcm = synthSfx(name, {}, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.sfxBus);
    src.start(now);
    const key = `v${state.voiceSeq++}`;
    state.active.set(key, { name, priority, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
  }

  function stopBgmSource() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
  }

  function event(type, payload = {}) {
    if (!type) return;
    const name = EVENT_TO_SFX[type];
    if (name) playSfx(name);
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

  function unlock() {
    ensureCtx();
  }

  async function playBgm(mode) {
    if (state.bgmMode === mode) return;
    state.bgmMode = mode;
    stopBgmSource();
    if (!mode) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    const pcm = synthLoop(mode, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(state.bgmBus);
    src.start();
    state.bgmSource = src;
  }

  function stopBgm() {
    state.bgmMode = null;
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
