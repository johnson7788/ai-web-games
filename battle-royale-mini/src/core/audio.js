// src/core/audio.js — BATTLE ROYALE MINI · 程序化 WebAudio 合成（零依赖零外链零音频文件）
//
// 两层架构：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络 → mono Float32Array PCM。
//     这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer → AudioBufferSourceNode → GainNode → destination；
//     BGM 由 synthLoop('bgm') 合成（分层 pad + 低音琶音 + 噪声底），loop=true 无缝循环。
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 2;
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

// ---------------------------------------------------------------------------
// 各音效合成器
// ---------------------------------------------------------------------------
function sfxShot(_p, sr) {
  const crack = noise({ dur: 0.08, sr, gain: 0.5, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.03 });
  const body = osc({ type: 'triangle', freq: 160, freqEnd: 80, dur: 0.09, sr, gain: 0.4, attack: 0.002, release: 0.05 });
  return mix(crack, body);
}
function sfxHit(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 120, freqEnd: 60, dur: 0.08, sr, gain: 0.45, attack: 0.002, release: 0.04 });
  const tick = noise({ dur: 0.04, sr, gain: 0.2, filter: 'highpass', cutoff: 2400, attack: 0.001, release: 0.02 });
  return mix(thud, tick);
}
function sfxKill(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.22, gap: 0.09, type: 'triangle', gain: 0.28, attack: 0.01, release: 0.12, sr });
}
function sfxPickup(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.12, sr, gain: 0.3, attack: 0.005, release: 0.06 });
}
function sfxEquip(_p, sr) {
  return notes({ freqs: [523.25, 783.99], dur: 0.14, gap: 0.07, type: 'triangle', gain: 0.28, attack: 0.005, release: 0.1, sr });
}
function sfxReload(_p, sr) {
  const a = osc({ type: 'triangle', freq: 700, freqEnd: 500, dur: 0.05, sr, gain: 0.28, attack: 0.002, release: 0.03 });
  const b = osc({ type: 'triangle', freq: 500, freqEnd: 700, dur: 0.05, sr, gain: 0.28, attack: 0.002, release: 0.03 });
  const out = new Float32Array(Math.round(0.16 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.08 * sr));
  return out;
}
function sfxReloadDone(_p, sr) {
  return osc({ type: 'triangle', freq: 900, freqEnd: 1200, dur: 0.06, sr, gain: 0.3, attack: 0.002, release: 0.03 });
}
function sfxMed(_p, sr) {
  return notes({ freqs: [659.25, 880], dur: 0.24, gap: 0.1, type: 'sine', gain: 0.22, attack: 0.03, release: 0.12, sr });
}
function sfxGasWarn(_p, sr) {
  return notes({ freqs: [880, 880], dur: 0.12, gap: 0.18, type: 'square', gain: 0.16, attack: 0.01, release: 0.05, sr });
}
function sfxGasShrink(_p, sr) {
  return noise({ dur: 0.5, sr, gain: 0.3, filter: 'bandpass', cutoff: 900, attack: 0.08, release: 0.25 });
}
function sfxGasTick(_p, sr) {
  return osc({ type: 'triangle', freq: 200, freqEnd: 140, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 });
}
function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}
function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}
function sfxLose(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}
function sfxMatchStart(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25], dur: 0.3, gap: 0.12, type: 'triangle', gain: 0.2, attack: 0.04, release: 0.14, sr });
}
function sfxScan(_p, sr) {
  return osc({ type: 'sine', freq: 1180, freqEnd: 1240, dur: 0.05, sr, gain: 0.08, attack: 0.004, release: 0.02 });
}
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}
function sfxFinal(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25], dur: 0.5, gap: 0.1, type: 'triangle', gain: 0.18, attack: 0.06, release: 0.2, sr });
}

const SYNTH = {
  shot: sfxShot,
  hit: sfxHit,
  kill: sfxKill,
  pickup: sfxPickup,
  equip: sfxEquip,
  reload: sfxReload,
  reloadDone: sfxReloadDone,
  med: sfxMed,
  gasWarn: sfxGasWarn,
  gasShrink: sfxGasShrink,
  gasTick: sfxGasTick,
  nearMiss: sfxNearMiss,
  win: sfxWin,
  lose: sfxLose,
  matchStart: sfxMatchStart,
  scan: sfxScan,
  ui: sfxUi,
  final: sfxFinal,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层：BGM（分层 pad + 低音琶音 + 噪声底）
// ---------------------------------------------------------------------------
function loopBgm(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // 低音 pad：两个低八度正弦（110Hz / 164.81Hz 近似，慢 LFO 0.25Hz 整数周期保证无缝）
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
    out[i] = 0.07 * Math.sin(2 * Math.PI * 110 * t) + 0.06 * Math.sin(2 * Math.PI * 164.81 * t) + 0.03 * lfo * Math.sin(2 * Math.PI * 220 * t);
  }
  // 低音琶音 pluck（110/130.81/146.83/164.81，每 1s 一拍，衰减在下一拍前结束）
  const bass = [110, 130.81, 146.83, 164.81];
  for (let k = 0; k < 4; k += 1) {
    const s = osc({ type: 'triangle', freq: bass[k], freqEnd: bass[k] * 0.98, dur: 0.5, sr, gain: 0.12, attack: 0.01, release: 0.3 });
    addAt(out, s, Math.round(k * 1 * sr));
  }
  // 软噪声底
  let bed = new Float32Array(n);
  for (let i = 0; i < n; i += 1) bed[i] = Math.random() * 2 - 1;
  bed = lowpass(bed, 420, sr);
  bed = normalizeRms(bed, 0.02);
  for (let i = 0; i < n; i += 1) out[i] += bed[i];
  return normalizeRms(out, 0.20);
}

const LOOPS = {
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

const SFX_PRIORITY = {
  kill: 6, win: 6, lose: 6, final: 6,
  shot: 5, hit: 5, med: 5,
  equip: 4, gasShrink: 4, gasWarn: 4, matchStart: 4,
  pickup: 3, reload: 3, reloadDone: 3,
  nearMiss: 2, gasTick: 2, scan: 1, ui: 1,
};

const EVENT_TO_SFX = {
  shot: 'shot',
  hit: 'hit',
  kill: 'kill',
  pickup: 'pickup',
  equip: 'equip',
  reload: 'reload',
  reloadDone: 'reloadDone',
  med: 'med',
  gasWarn: 'gasWarn',
  gasShrink: 'gasShrink',
  gasTick: 'gasTick',
  nearMiss: 'nearMiss',
  win: 'win',
  lose: 'lose',
  matchStart: 'matchStart',
  scan: 'scan',
  final: 'final',
  ui: 'ui',
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
    bgmBuffer: null,
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
    state.bgmBus.gain.value = 0.55;
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

  function playBgm(mode = 'bgm') {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmMode === mode && state.bgmSource) return;
    state.bgmMode = mode;
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
  }

  function stopBgm() {
    stopBgmSource();
    state.bgmMode = null;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
