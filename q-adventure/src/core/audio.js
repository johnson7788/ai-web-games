// src/core/audio.js — Q ADVENTURE · 程序化音频（WebAudio 标准 API，零依赖零外链，不打包音频文件）
//
// 两层：
//  1) 采样级合成器（纯函数，无 DOM）：每个 SFX / BGM 循环条 = 振荡器 + 噪声 + 包络 → mono Float32Array PCM。
//     这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验 RMS/峰值/NaN。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer，经 GainNode 播放；BGM 循环条用 loop=true 无缝循环。
//
// 契约（docs/analysis.md 事件表）：createAudio() → { unlock, event, setMuted, setVolume, playBgm, stopBgm, beatPhase }。
// 存档（音量/静音）只走 src/core/sdk.js。

import Sdk from './sdk.js';

export const SAMPLE_RATE = 44100;

const BPM = 128;
const BEAT = 60 / BPM;
const MAX_VOICES = 3;
const DEDUPE_MS = 14;
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
    const x = input[i]; const y = a * (yPrev + x - xPrev);
    out[i] = y; yPrev = y; xPrev = x;
  }
  return out;
}
function bandpass(input, center, sr) { return highpass(lowpass(input, center * 1.6, sr), center * 0.62, sr); }

function normalizeRms(input, target) {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) sum += input[i] * input[i];
  const rms = Math.sqrt(sum / Math.max(1, input.length));
  if (rms > 1e-6) { const k = target / rms; for (let i = 0; i < input.length; i += 1) input[i] *= k; }
  return input;
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

function mix(...parts) {
  let len = 0;
  for (const p of parts) len = Math.max(len, p.length);
  const out = new Float32Array(len);
  for (const p of parts) for (let i = 0; i < p.length; i += 1) out[i] += p[i];
  return out;
}

function addAt(dst, src, offset) {
  for (let i = 0; i < src.length; i += 1) { const j = offset + i; if (j >= 0 && j < dst.length) dst[j] += src[i]; }
}

function notes({ freqs, dur = 0.4, gap = 0.13, type = 'triangle', gain = 0.2, attack = 0.01, release = 0.15, sr = SAMPLE_RATE } = {}) {
  const total = (freqs.length - 1) * gap + dur;
  const out = new Float32Array(Math.max(1, Math.round(total * sr)));
  freqs.forEach((f, k) => addAt(out, osc({ type, freq: f, dur, sr, gain, attack, release }), Math.round(k * gap * sr)));
  return out;
}

// ---------------------------------------------------------------------------
// SFX 合成器（(payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

function fJump(_p, sr) { return mix(osc({ type: 'triangle', freq: 320, freqEnd: 640, dur: 0.14, sr, gain: 0.4, attack: 0.004, release: 0.06 }), noise({ dur: 0.04, sr, gain: 0.1, filter: 'highpass', cutoff: 1500 })); }
function fDoubleJump(_p, sr) { return mix(osc({ type: 'triangle', freq: 420, freqEnd: 860, dur: 0.15, sr, gain: 0.38, attack: 0.004, release: 0.06 }), osc({ type: 'sine', freq: 840, freqEnd: 1200, dur: 0.1, sr, gain: 0.12 })); }
function fWallJump(_p, sr) { return mix(osc({ type: 'square', freq: 260, freqEnd: 520, dur: 0.12, sr, gain: 0.22, attack: 0.004, release: 0.05 }), noise({ dur: 0.06, sr, gain: 0.14, filter: 'bandpass', cutoff: 900 })); }
function fLand(_p, sr) { return noise({ dur: 0.05, sr, gain: 0.2, filter: 'lowpass', cutoff: 420, attack: 0.002, release: 0.03 }); }
function fCoin(_p, sr) { return notes({ freqs: [1046.5, 1318.5], dur: 0.09, gap: 0.05, type: 'sine', gain: 0.3, sr }); }
function fStar(_p, sr) { return notes({ freqs: [659.25, 783.99, 987.77, 1318.5], dur: 0.16, gap: 0.07, type: 'triangle', gain: 0.28, sr }); }
function fStomp(_p, sr) { return mix(osc({ type: 'triangle', freq: 180, freqEnd: 70, dur: 0.16, sr, gain: 0.4, attack: 0.003, release: 0.08 }), noise({ dur: 0.06, sr, gain: 0.16, filter: 'lowpass', cutoff: 500 })); }
function fEnemyDefeat(_p, sr) { return mix(osc({ type: 'square', freq: 220, freqEnd: 55, dur: 0.22, sr, gain: 0.24, attack: 0.004, release: 0.1 }), noise({ dur: 0.12, sr, gain: 0.14, filter: 'bandpass', cutoff: 700 })); }
function fHurt(_p, sr) { return mix(osc({ type: 'sawtooth', freq: 240, freqEnd: 120, dur: 0.2, sr, gain: 0.26, attack: 0.003, release: 0.08 }), noise({ dur: 0.1, sr, gain: 0.12, filter: 'lowpass', cutoff: 800 })); }
function fDeath(_p, sr) { return mix(osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.9, sr, gain: 0.34, attack: 0.01, release: 0.25 }), noise({ dur: 0.6, sr, gain: 0.16, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 })); }
function fRespawn(_p, sr) { return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.24, gap: 0.09, type: 'triangle', gain: 0.24, sr }); }
function fCheckpoint(_p, sr) { return notes({ freqs: [660, 880], dur: 0.18, gap: 0.06, type: 'sine', gain: 0.24, sr }); }
function fGoal(_p, sr) { return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.35, gap: 0.1, type: 'triangle', gain: 0.26, sr }); }
function fLevelClear(_p, sr) { return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.32, gap: 0.09, type: 'triangle', gain: 0.24, sr }); }
function fSpring(_p, sr) { return osc({ type: 'sine', freq: 300, freqEnd: 1400, dur: 0.28, sr, gain: 0.3, attack: 0.004, release: 0.12 }); }
function fBeat(_p, sr) { return mix(osc({ type: 'sine', freq: 880, freqEnd: 1320, dur: 0.14, sr, gain: 0.26, attack: 0.003, release: 0.06 }), osc({ type: 'sine', freq: 1760, dur: 0.08, sr, gain: 0.1 })); }
function fNearMiss(_p, sr) { return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 }); }
function fMilestone(_p, sr) { return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.08, attack: 0.004, release: 0.03 }); }
function fUi(_p, sr) { return mix(osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 }), noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000 })); }
function fWin(_p, sr) { return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5, 1318.5], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.26, sr }); }

const SYNTH = {
  jump: fJump, doubleJump: fDoubleJump, wallJump: fWallJump, land: fLand,
  coin: fCoin, star: fStar, stomp: fStomp, enemyDefeat: fEnemyDefeat,
  hurt: fHurt, death: fDeath, respawn: fRespawn, checkpoint: fCheckpoint,
  goal: fGoal, levelClear: fLevelClear, spring: fSpring, beat: fBeat,
  nearMiss: fNearMiss, milestone: fMilestone, ui: fUi, win: fWin,
};

export const SFX_NAMES = Object.keys(SYNTH);

const EVENT_TO_SFX = {
  jump: 'jump', doubleJump: 'doubleJump', wallJump: 'wallJump', land: 'land',
  coinGet: 'coin', starGet: 'star', stomp: 'stomp', enemyDefeat: 'enemyDefeat',
  hurt: 'hurt', death: 'death', respawn: 'respawn', checkpoint: 'checkpoint',
  goalReached: 'goal', levelClear: 'levelClear', gameComplete: 'win',
  spring: 'spring', beatJump: 'beat', nearMiss: 'nearMiss', milestone: 'milestone',
  ui: 'ui',
};

// ---------------------------------------------------------------------------
// BGM 循环条：4 拍一循环，kick/hihat/bass，按场景包换调式（无缝 loop）
// ---------------------------------------------------------------------------

function synthBgmBar(scale, root, sr = SAMPLE_RATE) {
  const n = Math.round(4 * BEAT * sr);
  const out = new Float32Array(n);
  const add = (src, at) => addAt(out, src, Math.round(at * sr));
  const kick = () => mix(osc({ type: 'sine', freq: 120, freqEnd: 48, dur: 0.18, sr, gain: 0.5, attack: 0.002, release: 0.08 }), noise({ dur: 0.05, sr, gain: 0.14, filter: 'lowpass', cutoff: 200 }));
  const hat = (open) => noise({ dur: open ? 0.12 : 0.03, sr, gain: open ? 0.12 : 0.09, filter: 'highpass', cutoff: 6000, attack: 0.001, release: open ? 0.08 : 0.01 });
  const bass = (f) => osc({ type: 'triangle', freq: f, dur: 0.3, sr, gain: 0.2, attack: 0.005, release: 0.16 });
  for (let b = 0; b < 4; b += 1) {
    add(kick(), b * BEAT);
    add(hat(b === 3), b * BEAT + BEAT / 2);
    add(bass(root * scale[(b * 2) % scale.length] / scale[0]), b * BEAT);
    add(bass(root * scale[(b * 2 + 1) % scale.length] / scale[0]), b * BEAT + BEAT / 2);
  }
  // 归一化到安全峰值，避免叠加爆音
  let peak = 0;
  for (let i = 0; i < out.length; i += 1) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.9) { const k = 0.9 / peak; for (let i = 0; i < out.length; i += 1) out[i] *= k; }
  return out;
}

const LOOPS = {
  bgmTitle: (sr) => synthBgmBar([1, 1.25, 1.5, 2], 220, sr),   // C 大三和弦
  bgmCandy: (sr) => synthBgmBar([1, 1.26, 1.5, 1.68], 261.63, sr), // C 大调五声
  bgmCloud: (sr) => synthBgmBar([1, 1.19, 1.5, 1.78], 196, sr),   // G 大调
  bgmNight: (sr) => synthBgmBar([1, 1.19, 1.42, 1.68], 220, sr),  // A 小调
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

const SFX_PRIORITY = { star: 6, stomp: 6, enemyDefeat: 6, levelClear: 5, win: 5, goal: 5, spring: 5, death: 4, hurt: 4, jump: 3, doubleJump: 3, wallJump: 3, coin: 2, checkpoint: 2, respawn: 2, land: 1, nearMiss: 1, milestone: 1, beat: 2, ui: 1 };

// ---------------------------------------------------------------------------
// 播放层
// ---------------------------------------------------------------------------

export function createAudio() {
  const state = {
    ctx: null, master: null, sfxBus: null, bgmBus: null,
    volume: clamp(Sdk.load('audioVolume', 0.7), 0, 1),
    muted: !!Sdk.load('audioMuted', false),
    bgmSource: null, bgmName: null, bgmStart: 0,
    active: new Map(), lastPlay: new Map(), voiceSeq: 0,
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
    state.sfxBus = state.ctx.createGain(); state.sfxBus.gain.value = 1; state.sfxBus.connect(state.master);
    state.bgmBus = state.ctx.createGain(); state.bgmBus.gain.value = 0.85; state.bgmBus.connect(state.master);
    return state.ctx;
  }

  function playSfx(name, payload) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);
    const priority = SFX_PRIORITY[name] ?? 1;
    for (const [k, v] of state.active) if (v.endTime <= now) state.active.delete(k);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null; let minPrio = Infinity;
      for (const [k, v] of state.active) if (v.priority < minPrio) { minPrio = v.priority; minKey = k; }
      if (minKey == null || priority <= minPrio) return;
      const v = state.active.get(minKey); try { v.stop(now); } catch { /* noop */ }
      state.active.delete(minKey);
    }
    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource(); src.buffer = buf; src.connect(state.sfxBus); src.start(now);
    const key = `v${state.voiceSeq++}`;
    state.active.set(key, { priority, endTime: now + pcm.length / ctx.sampleRate, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
  }

  function stopBgmSource() {
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch { /* noop */ } state.bgmSource = null; }
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  }

  function event(type, payload = {}) {
    if (!type) return;
    const name = EVENT_TO_SFX[type];
    if (name) playSfx(name, payload);
  }

  function setMuted(b) {
    state.muted = !!b;
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
    Sdk.save('audioMuted', state.muted);
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
    Sdk.save('audioVolume', state.volume);
  }

  function playBgm(name) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmName === name && state.bgmSource) return;
    stopBgmSource();
    const pcm = synthLoop(name, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true; src.connect(state.bgmBus); src.start();
    state.bgmSource = src; state.bgmName = name; state.bgmStart = ctx.currentTime;
  }

  function stopBgm() { stopBgmSource(); state.bgmName = null; }

  function beatPhase() {
    if (!state.ctx || !state.bgmSource) return 0;
    return ((state.ctx.currentTime - state.bgmStart) / BEAT) % 1;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm, beatPhase };
}

export default createAudio;
