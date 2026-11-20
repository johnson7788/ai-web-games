// src/core/audio.js — DICE CASCADE 音效合成与播放（WebAudio 标准 API，零依赖零外链）
//
// 两层架构：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，
//     直接算成 mono Float32Array PCM，让 tools/audio-check.mjs 能在 Node 离线渲染校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer，经 GainNode 输出；BGM 用程序化 pad 循环。
//
// 事件名与 sim 事件表一致：ui / bet / rollStart / beadSettled / runeGain / triple /
//   cursedHit / stageClear / stageFail / newRecord。

import { save } from './save.js';

export const SAMPLE_RATE = 44100;
const MAX_VOICES = 2;
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

// ---------- 音效合成器 ----------
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxBet(_p, sr) {
  return osc({ type: 'triangle', freq: 520, freqEnd: 760, dur: 0.09, sr, gain: 0.3, attack: 0.004, release: 0.05 });
}

function sfxRoll(_p, sr) {
  const ticks = new Float32Array(Math.round(0.5 * sr));
  for (let k = 0; k < 9; k += 1) {
    const s = noise({ dur: 0.04, sr, gain: 0.16, filter: 'bandpass', cutoff: 900 + k * 60, attack: 0.001, release: 0.02 });
    addAt(ticks, s, Math.round(k * 0.045 * sr));
  }
  return ticks;
}

function sfxPeg(_p, sr) {
  return osc({ type: 'sine', freq: 720, freqEnd: 520, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 });
}

function sfxSettle(_p, sr) {
  const thock = osc({ type: 'triangle', freq: 180, freqEnd: 110, dur: 0.12, sr, gain: 0.3, attack: 0.004, release: 0.06 });
  const nz = noise({ dur: 0.05, sr, gain: 0.14, filter: 'lowpass', cutoff: 600, attack: 0.002, release: 0.03 });
  return mix(thock, nz);
}

function sfxRune(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

function sfxTriple(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.18, sr });
}

function sfxCursed(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 320, freqEnd: 90, dur: 0.4, sr, gain: 0.4, attack: 0.008, release: 0.18 });
  const nz = noise({ dur: 0.3, sr, gain: 0.2, filter: 'lowpass', cutoff: 400, attack: 0.004, release: 0.14 });
  return mix(glide, nz);
}

function sfxStageClear(_p, sr) {
  return notes({ freqs: [392, 493.88, 587.33, 783.99], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.16, sr });
}

function sfxStageFail(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 500, freqEnd: 70, dur: 0.9, sr, gain: 0.36, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.6, sr, gain: 0.18, filter: 'lowpass', cutoff: 600, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  ui: sfxUi,
  bet: sfxBet,
  roll: sfxRoll,
  peg: sfxPeg,
  settle: sfxSettle,
  rune: sfxRune,
  triple: sfxTriple,
  cursed: sfxCursed,
  stageClear: sfxStageClear,
  stageFail: sfxStageFail,
  newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------- BGM 循环层（程序化神殿 pad） ----------
function loopTemple(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const freqs = [110, 130.81, 164.81, 196];
  for (const f of freqs) {
    const layer = osc({ type: 'triangle', freq: f, dur, sr, gain: 0.05, attack: 1.2, release: 1.4 });
    for (let i = 0; i < n; i += 1) out[i] += layer[i] * (0.7 + 0.3 * Math.sin(2 * Math.PI * 0.25 * (i / sr)));
  }
  const pad = lowpass(out, 420, sr);
  return normalizeRms(pad, 0.16);
}

const LOOPS = { temple: loopTemple };
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

// sim 事件 → SFX 名
const EVENT_TO_SFX = {
  ui: 'ui',
  betToggle: 'bet',
  rollStart: 'roll',
  beadSettled: 'settle',
  runeGain: 'rune',
  runeLevelUp: 'rune',
  triple: 'triple',
  cursedHit: 'cursed',
  stageClear: 'stageClear',
  stageFail: 'stageFail',
  win: 'stageClear',
  newRecord: 'newRecord',
};

const SFX_PRIORITY = {
  triple: 6, stageClear: 6,
  stageFail: 5, cursed: 5,
  settle: 3, roll: 3, rune: 3, newRecord: 3,
  bet: 2, peg: 1, ui: 1,
};

export function createAudio() {
  const state = {
    ctx: null, master: null, sfxBus: null, bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    unlocked: false,
    bgmSource: null,
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
      let minKey = null; let minPrio = Infinity;
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

  function playBgmLoop() {
    const ctx = ensureCtx();
    if (!ctx || state.bgmSource) return;
    const pcm = synthLoop('temple', ctx.sampleRate);
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
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch { /* noop */ } state.bgmSource = null; }
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      resumeIfNeeded();
      state.unlocked = true;
      playBgmLoop();
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

  return { unlock, event, setMuted, setVolume, playBgm: playBgmLoop, stopBgm };
}

export default createAudio;
