// src/core/audio.js — MERGE 2048 · 音效合成与播放（WebAudio 标准 API，零依赖零外链）
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer → AudioBufferSourceNode → GainNode → destination；
//     BGM 用 loop 的 AudioBufferSourceNode 无缝循环（分层 pad + 闪烁层）。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }
import Sdk from './sdk.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 4;
const DEDUPE_MS = 14;
const NOISE_RMS = 0.22;

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
  for (let i = 0; i < input.length; i += 1) { y = a * y + (1 - a) * input[i]; out[i] = y; }
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
function sfxMove(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 200, freqEnd: 140, dur: 0.07, sr, gain: 0.28, attack: 0.004, release: 0.03 });
  const click = noise({ dur: 0.03, sr, gain: 0.1, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.01 });
  return mix(thud, click);
}

function sfxMerge(p, sr) {
  const value = clamp(p.value ?? 2, 2, 4096);
  const f = 420 * Math.pow(2, -Math.log2(value) / 12);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 1.5, dur: 0.16, sr, gain: 0.42, attack: 0.004, release: 0.08 });
  const pop = noise({ dur: 0.06, sr, gain: 0.2, filter: 'lowpass', cutoff: f * 4, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

function sfxSpawn(_p, sr) {
  return osc({ type: 'sine', freq: 760, freqEnd: 980, dur: 0.07, sr, gain: 0.16, attack: 0.004, release: 0.03 });
}

function sfxBlocked(_p, sr) {
  return osc({ type: 'square', freq: 150, freqEnd: 120, dur: 0.06, sr, gain: 0.16, attack: 0.002, release: 0.03 });
}

function sfxGravity(_p, sr) {
  const drone = osc({ type: 'sine', freq: 90, freqEnd: 55, dur: 0.4, sr, gain: 0.32, attack: 0.03, release: 0.15 });
  const nz = noise({ dur: 0.3, sr, gain: 0.14, filter: 'lowpass', cutoff: 260, attack: 0.02, release: 0.12 });
  return mix(drone, nz);
}

function sfxGravityLock(_p, sr) {
  const buzz = osc({ type: 'sawtooth', freq: 220, freqEnd: 110, dur: 0.16, sr, gain: 0.2, attack: 0.004, release: 0.08 });
  return mix(buzz, noise({ dur: 0.1, sr, gain: 0.1, filter: 'lowpass', cutoff: 400, attack: 0.002, release: 0.05 }));
}

function sfxGravityExpire(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 720, dur: 0.12, sr, gain: 0.18, attack: 0.005, release: 0.06 });
}

function sfxWarp(p, sr) {
  const f = 600 * Math.pow(2, Math.log2(clamp(p.value ?? 2, 2, 4096)) / 12);
  const whoosh = noise({ dur: 0.4, sr, gain: 0.3, filter: 'bandpass', cutoff: 1400, attack: 0.04, release: 0.15 });
  const rise = osc({ type: 'sine', freq: f, freqEnd: f * 2.4, dur: 0.35, sr, gain: 0.22, attack: 0.04, release: 0.12 });
  return mix(whoosh, rise);
}

function sfxUnlock(_p, sr) {
  return notes({ freqs: [392, 493.88, 587.33, 783.99], dur: 0.4, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.14, sr });
}

function sfxLevelClear(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25], dur: 0.45, gap: 0.1, type: 'triangle', gain: 0.22, attack: 0.02, release: 0.16, sr });
}

function sfxLevelEnter(_p, sr) {
  return notes({ freqs: [440, 523.25, 659.25], dur: 0.35, gap: 0.08, type: 'sine', gain: 0.16, attack: 0.03, release: 0.12, sr });
}

function sfxWin(_p, sr) {
  const chord = notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25], dur: 0.8, gap: 0, type: 'triangle', gain: 0.18, attack: 0.02, release: 0.3, sr });
  const crash = noise({ dur: 0.5, sr, gain: 0.14, filter: 'lowpass', cutoff: 1200, attack: 0.004, release: 0.25 });
  return mix(chord, crash);
}

function sfxLose(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 480, freqEnd: 70, dur: 0.9, sr, gain: 0.36, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.6, sr, gain: 0.18, filter: 'lowpass', cutoff: 600, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

function sfxChime(_p, sr) {
  return mix(osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.18, attack: 0.01, release: 0.12 }),
    osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.1, attack: 0.01, release: 0.12 }));
}

const SYNTH = {
  move: sfxMove,
  merge: sfxMerge,
  spawn: sfxSpawn,
  blocked: sfxBlocked,
  gravitySpawn: sfxGravity,
  gravityLock: sfxGravityLock,
  gravityExpire: sfxGravityExpire,
  warp: sfxWarp,
  unlock: sfxUnlock,
  levelClear: sfxLevelClear,
  levelEnter: sfxLevelEnter,
  win: sfxWin,
  lose: sfxLose,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop 的 PCM）
// ---------------------------------------------------------------------------

// 环境 pad：4s，四音 A3/C#4/E4/A4 级（全部取 0.25Hz 的整数倍，保证无缝循环），慢 LFO 呼吸
function loopBgm(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const freqs = [220, 275, 330, 440]; // 均为 55Hz 的整数倍 → 4s 内整数周期
  const amps = [0.5, 0.32, 0.28, 0.2];
  for (let k = 0; k < freqs.length; k += 1) {
    for (let i = 0; i < n; i += 1) {
      out[i] += Math.sin((2 * Math.PI * freqs[k] * i) / sr) * amps[k];
    }
  }
  // 低通噪声床（慢 LFO，1 周期 = 4s）
  let bed = new Float32Array(n);
  for (let i = 0; i < n; i += 1) bed[i] = Math.random() * 2 - 1;
  bed = lowpass(bed, 320, sr);
  bed = normalizeRms(bed, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    bed[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  for (let i = 0; i < n; i += 1) out[i] += bed[i];
  return normalizeRms(out, 0.16);
}

// 闪烁层：高频缓慢琶音，给 BGM 一点星野感
function loopShimmer(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const freqs = [880, 1100, 1320, 1760];
  for (let k = 0; k < freqs.length; k += 1) {
    const on = (k * dur) / freqs.length;
    for (let i = 0; i < n; i += 1) {
      const t = i / sr;
      const gate = Math.max(0, Math.sin((2 * Math.PI * 0.25 * t) + k));
      out[i] += Math.sin((2 * Math.PI * freqs[k] * i) / sr) * 0.05 * gate;
    }
  }
  return normalizeRms(out, 0.08);
}

const LOOPS = {
  bgm: loopBgm,
  shimmer: loopShimmer,
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
  move: 'move',
  merge: 'merge',
  spawn: 'spawn',
  blocked: 'blocked',
  gravitySpawn: 'gravitySpawn',
  gravityLock: 'gravityLock',
  gravityExpire: 'gravityExpire',
  warp: 'warp',
  unlock: 'unlock',
  levelClear: 'levelClear',
  levelEnter: 'levelEnter',
  win: 'win',
  lose: 'lose',
  ui: 'ui',
  newRecord: 'newRecord',
  tutorialDone: 'chime',
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
    volume: clamp(Sdk.load('volume', 0.75), 0, 1),
    muted: !!Sdk.load('muted', false),
    unlocked: false,
    loops: { bgm: null, shimmer: null },
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
    state.bgmBus.gain.value = 0.9;
    state.bgmBus.connect(state.master);
    resumeIfNeeded();
    return state.ctx;
  }

  function playSfx(name, payload) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);

    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.sfxBus);
    src.start(now);
    const key = `v${state.voiceSeq++}`;
    state.active.set(key, { endTime: now + pcm.length / ctx.sampleRate, src });
    // 叠层上限
    let count = 0;
    for (const [k, v] of state.active) { if (v.endTime <= now) state.active.delete(k); else count += 1; }
    if (count > MAX_VOICES) {
      // 丢弃最早的一个
      let oldestKey = null; let oldestT = Infinity;
      for (const [k, v] of state.active) { if (v.endTime < oldestT) { oldestT = v.endTime; oldestKey = k; } }
      if (oldestKey) { const v = state.active.get(oldestKey); try { v.src.stop(); } catch { /* noop */ } state.active.delete(oldestKey); }
    }
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
    Sdk.save('muted', state.muted);
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
    Sdk.save('volume', state.volume);
  }

  function playBgm() {
    startLoop('bgm');
    startLoop('shimmer');
  }

  function stopBgm() {
    stopLoop('bgm');
    stopLoop('shimmer');
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
