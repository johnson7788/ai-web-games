// src/core/audio.js — NEON PINBALL · 音效/BGM 程序化合成（WebAudio 标准 API，零依赖零外链）
//
// 分两层：
//  1) 采样级合成器（纯函数，无 DOM）：每个音效/BGM = 振荡器 + 噪声 + 包络，算成 mono Float32Array PCM，
//     这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验 RMS/峰值/NaN。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer → AudioBufferSourceNode → GainNode → destination；
//     BGM 用 loop 的 AudioBufferSourceNode 无缝循环。
//
// 契约：createAudio() → { unlock(), event(type,payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }

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
  let xPrev = 0, yPrev = 0;
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
  freqs.forEach((f, k) => addAt(out, osc({ type, freq: f, dur, sr, gain, attack, release }), Math.round(k * gap * sr)));
  return out;
}

/** 无缝循环：尾部 crossfade 进头部，去掉一个 fade 长度。 */
function seamlessLoop(buf, sr, fade = 0.06) {
  const f = Math.max(1, Math.round(fade * sr));
  if (buf.length <= f) return buf;
  const out = new Float32Array(buf.length - f);
  for (let i = f; i < buf.length; i += 1) out[i - f] = buf[i];
  for (let i = 0; i < f; i += 1) {
    const t = i / f;
    out[i] = buf[i] * (1 - t) + buf[buf.length - f + i] * t;
  }
  return out;
}

// ---------------------------------------------------------------------------
// SFX
// ---------------------------------------------------------------------------

function sfxFlipper(_p, sr) {
  const thud = osc({ type: 'square', freq: 190, freqEnd: 90, dur: 0.06, sr, gain: 0.32, attack: 0.003, release: 0.03 });
  const click = noise({ dur: 0.03, sr, gain: 0.16, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.01 });
  return mix(thud, click);
}

function sfxLaunch(_p, sr) {
  return osc({ type: 'sawtooth', freq: 120, freqEnd: 320, dur: 0.3, sr, gain: 0.22, attack: 0.01, release: 0.1 });
}

function sfxBumperHit(p, sr) {
  const f = 300 + (p.value ?? 0) * 20;
  const tone = osc({ type: 'square', freq: f, freqEnd: f * 0.7, dur: 0.14, sr, gain: 0.28, attack: 0.004, release: 0.07 });
  const pop = noise({ dur: 0.05, sr, gain: 0.18, filter: 'lowpass', cutoff: f * 3, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

function sfxTargetHit(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 620 * Math.pow(2, combo / 12);
  return notes({ freqs: [f, f * 1.5], dur: 0.12, gap: 0.05, type: 'triangle', gain: 0.24, sr });
}

function sfxSuperconductLight(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.3, gap: 0.09, type: 'sine', gain: 0.2, attack: 0.01, release: 0.12, sr });
}

function sfxSuperconduct(_p, sr) {
  return notes({ freqs: [220, 277.18, 329.63, 440, 554.37, 659.25], dur: 0.6, gap: 0.06, type: 'sawtooth', gain: 0.1, attack: 0.02, release: 0.25, sr });
}

function sfxSuperconductEnd(_p, sr) {
  return osc({ type: 'sawtooth', freq: 880, freqEnd: 220, dur: 0.4, sr, gain: 0.12, attack: 0.01, release: 0.2 });
}

function sfxBlackHole(_p, sr) {
  return noise({ dur: 0.5, sr, gain: 0.35, filter: 'bandpass', cutoff: 500, attack: 0.02, release: 0.25 });
}

function sfxBlackHoleEject(_p, sr) {
  return osc({ type: 'sine', freq: 180, freqEnd: 720, dur: 0.35, sr, gain: 0.24, attack: 0.01, release: 0.12 });
}

function sfxDrain(_p, sr) {
  return osc({ type: 'sawtooth', freq: 520, freqEnd: 80, dur: 0.6, sr, gain: 0.3, attack: 0.01, release: 0.3 });
}

function sfxBallLost(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 400, freqEnd: 60, dur: 0.7, sr, gain: 0.32, attack: 0.01, release: 0.3 });
  const nz = noise({ dur: 0.5, sr, gain: 0.2, filter: 'lowpass', cutoff: 600, attack: 0.02, release: 0.25 });
  return mix(glide, nz);
}

function sfxComboUp(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 700 * Math.pow(2, combo / 12);
  return osc({ type: 'sine', freq: f, freqEnd: f * 1.4, dur: 0.09, sr, gain: 0.2, attack: 0.003, release: 0.05 });
}

function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 560, freqEnd: 240, dur: 0.15, sr, gain: 0.18, attack: 0.005, release: 0.08 });
}

function sfxMachineClear(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.5, gap: 0.14, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.18, sr });
}

function sfxGameOver(_p, sr) {
  return notes({ freqs: [392, 329.63, 261.63, 196], dur: 0.5, gap: 0.18, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.2, sr });
}

function sfxRamp(_p, sr) {
  return osc({ type: 'sine', freq: 200, freqEnd: 500, dur: 0.25, sr, gain: 0.2, attack: 0.01, release: 0.08 });
}

function sfxMagnet(_p, sr) {
  return noise({ dur: 0.35, sr, gain: 0.22, filter: 'bandpass', cutoff: 900, attack: 0.05, release: 0.15 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 700, freqEnd: 900, dur: 0.05, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

const SYNTH = {
  flipper: sfxFlipper,
  launch: sfxLaunch,
  bumperHit: sfxBumperHit,
  targetHit: sfxTargetHit,
  superconductLight: sfxSuperconductLight,
  superconduct: sfxSuperconduct,
  superconductEnd: sfxSuperconductEnd,
  blackHole: sfxBlackHole,
  blackHoleEject: sfxBlackHoleEject,
  drain: sfxDrain,
  ballLost: sfxBallLost,
  comboUp: sfxComboUp,
  comboBreak: sfxComboBreak,
  machineClear: sfxMachineClear,
  gameOver: sfxGameOver,
  ramp: sfxRamp,
  magnet: sfxMagnet,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  milestone: sfxMilestone,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM（程序化：bass + pad + arpeggio，无缝循环）
// ---------------------------------------------------------------------------

function snapFreq(f, base) { return Math.round(f / base) * base; }

function loopBgm(sr) {
  const dur = 8;
  const base = 1 / dur;
  const snap = (f) => snapFreq(f, base);
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const chords = [
    [110, 130.81, 164.81, 220],     // Am
    [87.31, 110, 130.81, 174.61],   // F
    [130.81, 164.81, 196, 261.63],  // C
    [98, 123.47, 146.83, 196],      // G
  ];
  const bass = [55, 43.65, 65.41, 49];
  const chordDur = dur / 4;
  for (let c = 0; c < 4; c += 1) {
    const t0 = c * chordDur;
    addAt(out, osc({ type: 'triangle', freq: snap(bass[c]), dur: chordDur * 0.96, sr, gain: 0.16, attack: 0.05, release: 0.4 }), Math.round(t0 * sr));
    for (const f of chords[c]) {
      addAt(out, osc({ type: 'triangle', freq: snap(f), dur: chordDur * 0.98, sr, gain: 0.055, attack: 0.3, release: 0.5 }), Math.round(t0 * sr));
    }
    const steps = 8;
    for (let s = 0; s < steps; s += 1) {
      const f = snap(chords[c][s % chords[c].length] * 2);
      addAt(out, osc({ type: 'square', freq: f, dur: 0.16, sr, gain: 0.045, attack: 0.005, release: 0.05 }), Math.round((t0 + s * (chordDur / steps)) * sr));
    }
  }
  return seamlessLoop(out, sr, 0.06);
}

const LOOPS = { bgm: loopBgm };

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
  gameOver: 6, machineClear: 6, superconduct: 6, ballLost: 5,
  drain: 5, blackHole: 4, blackHoleEject: 4, superconductLight: 4,
  bumperHit: 3, targetHit: 3, flipper: 3, launch: 3, ramp: 3,
  newRecord: 4, comboUp: 2, comboBreak: 2, magnet: 2, superconductEnd: 2,
  milestone: 1, ui: 1,
};

const EVENT_TO_SFX = {
  flipper: 'flipper',
  launch: 'launch',
  bumperHit: 'bumperHit',
  targetHit: 'targetHit',
  superconductLight: 'superconductLight',
  superconduct: 'superconduct',
  superconductEnd: 'superconductEnd',
  blackHole: 'blackHole',
  blackHoleEject: 'blackHoleEject',
  drain: 'drain',
  ballLost: 'ballLost',
  comboUp: 'comboUp',
  comboBreak: 'comboBreak',
  machineClear: 'machineClear',
  gameOver: 'gameOver',
  ramp: 'ramp',
  magnet: 'magnet',
  ui: 'ui',
  newRecord: 'newRecord',
};

export function createAudio() {
  const state = {
    ctx: null, master: null, sfxBus: null, bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    bgmSource: null, bgmBuffer: null,
    active: new Map(), lastPlay: new Map(), voiceSeq: 0,
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
      let minKey = null, minPrio = Infinity;
      for (const [key, v] of state.active) if (v.priority < minPrio) { minPrio = v.priority; minKey = key; }
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
    state.active.set(key, { name, priority, endTime: now + pcm.length / ctx.sampleRate, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
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
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch { /* noop */ } state.bgmSource = null; }
  }

  function playBgm() {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgm();
    if (!state.bgmBuffer) {
      const pcm = synthLoop('bgm', ctx.sampleRate);
      state.bgmBuffer = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      state.bgmBuffer.getChannelData(0).set(pcm);
    }
    const node = ctx.createBufferSource();
    node.buffer = state.bgmBuffer;
    node.loop = true;
    node.connect(state.bgmBus);
    node.start();
    state.bgmSource = node;
  }

  function unlock() {
    ensureCtx();
    if (state.ctx) { resumeIfNeeded(); }
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
