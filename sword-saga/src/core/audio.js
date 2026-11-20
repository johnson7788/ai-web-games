// src/core/audio.js — SWORD SAGA · 程序化音效与 BGM（WebAudio 标准 API，零依赖零外链）
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：PCM → AudioBuffer → AudioBufferSourceNode → GainNode；BGM 用 loop 长循环。
//
// 契约：createAudio() → { unlock, event(type, payload), setMuted(b), setVolume(v), playBgm(name), stopBgm() }
// 事件名与 sim 事件表一字不差（attack/skill/defend/switch/counter/…），UI 侧 ui。

import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 16;
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
  if (rms > 1e-6) { const k = target / rms; for (let i = 0; i < input.length; i += 1) input[i] *= k; }
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

function sfxAttack(_p, sr) {
  const slash = noise({ dur: 0.12, sr, gain: 0.5, filter: 'bandpass', cutoff: 1800, attack: 0.002, release: 0.05 });
  const ping = osc({ type: 'triangle', freq: 660, freqEnd: 330, dur: 0.09, sr, gain: 0.3, attack: 0.002, release: 0.04 });
  return mix(slash, ping);
}

function sfxSkill(p, sr) {
  const base = 330 * (1 + (p.skillIndex || 0) * 0.12);
  return notes({ freqs: [base, base * 1.5, base * 2], dur: 0.22, gap: 0.08, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.12, sr });
}

function sfxDefend(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 180, freqEnd: 120, dur: 0.16, sr, gain: 0.4, attack: 0.004, release: 0.08 });
  const sh = noise({ dur: 0.1, sr, gain: 0.16, filter: 'highpass', cutoff: 900, attack: 0.003, release: 0.05 });
  return mix(thud, sh);
}

function sfxSwitch(_p, sr) {
  return notes({ freqs: [440, 660], dur: 0.14, gap: 0.07, type: 'sine', gain: 0.28, attack: 0.006, release: 0.08, sr });
}

function sfxCounter(_p, sr) {
  const impact = noise({ dur: 0.28, sr, gain: 0.5, filter: 'lowpass', cutoff: 700, attack: 0.003, release: 0.15 });
  const tone = osc({ type: 'triangle', freq: 220, freqEnd: 98, dur: 0.3, sr, gain: 0.4, attack: 0.004, release: 0.14 });
  return mix(impact, tone);
}

function sfxSwordIntent(_p, sr) {
  return notes({ freqs: [523.25, 783.99, 1046.5], dur: 0.3, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.14, sr });
}

function sfxFoxSub(_p, sr) {
  return notes({ freqs: [392, 311, 392, 466], dur: 0.2, gap: 0.09, type: 'triangle', gain: 0.26, attack: 0.006, release: 0.1, sr });
}

function sfxFoxLeave(_p, sr) {
  return osc({ type: 'sine', freq: 500, freqEnd: 220, dur: 0.2, sr, gain: 0.22, attack: 0.01, release: 0.1 });
}

function sfxFoxReturn(_p, sr) {
  return notes({ freqs: [466, 587.33, 698.46], dur: 0.2, gap: 0.08, type: 'triangle', gain: 0.24, attack: 0.006, release: 0.1, sr });
}

function sfxEnemyDown(_p, sr) {
  return osc({ type: 'triangle', freq: 300, freqEnd: 60, dur: 0.3, sr, gain: 0.35, attack: 0.004, release: 0.14 });
}

function sfxHeroDown(_p, sr) {
  return osc({ type: 'triangle', freq: 260, freqEnd: 48, dur: 0.5, sr, gain: 0.4, attack: 0.008, release: 0.24 });
}

function sfxVictory(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

function sfxDefeat(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxBattleStart(_p, sr) {
  return notes({ freqs: [330, 392, 494], dur: 0.28, gap: 0.11, type: 'triangle', gain: 0.22, attack: 0.02, release: 0.12, sr });
}

function sfxChapterStart(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25], dur: 0.4, gap: 0.14, type: 'triangle', gain: 0.18, attack: 0.06, release: 0.18, sr });
}

function sfxItem(_p, sr) {
  return notes({ freqs: [523.25, 659.25], dur: 0.16, gap: 0.06, type: 'sine', gain: 0.24, attack: 0.006, release: 0.08, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

const SYNTH = {
  attack: sfxAttack,
  skill: sfxSkill,
  defend: sfxDefend,
  switch: sfxSwitch,
  counter: sfxCounter,
  swordIntent: sfxSwordIntent,
  foxSub: sfxFoxSub,
  foxLeave: sfxFoxLeave,
  foxReturn: sfxFoxReturn,
  enemyDown: sfxEnemyDown,
  heroDown: sfxHeroDown,
  victory: sfxVictory,
  defeat: sfxDefeat,
  battleStart: sfxBattleStart,
  chapterStart: sfxChapterStart,
  item: sfxItem,
  ui: sfxUi,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层 / BGM（可无缝 loop 的 PCM）
// ---------------------------------------------------------------------------

// 生成一段由「音符事件表」拼成的循环：events = [{freq, t, dur, type, gain}]
function loopFromEvents(events, dur, sr) {
  const n = Math.max(1, Math.round(dur * sr));
  const out = new Float32Array(n);
  for (const e of events) {
    const s = osc({ type: e.type || 'triangle', freq: e.freq, dur: e.dur || 0.4, sr, gain: e.gain || 0.14, attack: 0.02, release: 0.2 });
    addAt(out, s, Math.round((e.t || 0) * sr));
  }
  return normalizeRms(out, 0.16);
}

function loopBamboo(sr) {
  const ev = [];
  const scale = [261.63, 293.66, 329.63, 392, 440];
  for (let i = 0; i < 8; i += 1) {
    ev.push({ freq: scale[i % scale.length], t: i * 0.5, dur: 0.5, gain: 0.12 });
    ev.push({ freq: scale[(i + 2) % scale.length] * 2, t: i * 0.5 + 0.25, dur: 0.3, gain: 0.06 });
  }
  return loopFromEvents(ev, 4, sr);
}

function loopSnow(sr) {
  const ev = [];
  const scale = [261.63, 293.66, 349.23, 392, 523.25];
  for (let i = 0; i < 8; i += 1) {
    ev.push({ freq: scale[i % scale.length], t: i * 0.75, dur: 0.8, gain: 0.1, type: 'sine' });
  }
  return loopFromEvents(ev, 6, sr);
}

function loopTower(sr) {
  const ev = [];
  const scale = [220, 246.94, 293.66, 329.63];
  for (let i = 0; i < 8; i += 1) {
    ev.push({ freq: scale[i % scale.length], t: i * 0.6, dur: 0.6, gain: 0.11, type: 'sawtooth' });
    ev.push({ freq: scale[i % scale.length] / 2, t: i * 0.6, dur: 0.6, gain: 0.08, type: 'triangle' });
  }
  return loopFromEvents(ev, 4.8, sr);
}

function loopBoss(sr) {
  const ev = [];
  const scale = [196, 233.08, 293.66, 349.23];
  for (let i = 0; i < 8; i += 1) {
    ev.push({ freq: scale[i % scale.length], t: i * 0.4, dur: 0.4, gain: 0.14, type: 'square' });
    ev.push({ freq: scale[i % scale.length] / 2, t: i * 0.4, dur: 0.4, gain: 0.1, type: 'sawtooth' });
  }
  return loopFromEvents(ev, 3.2, sr);
}

const LOOPS = {
  bamboo: loopBamboo,
  snow: loopSnow,
  tower: loopTower,
  boss: loopBoss,
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
  attack: 'attack',
  enemyAttack: 'attack',
  skill: 'skill',
  defend: 'defend',
  switch: 'switch',
  counter: 'counter',
  inkWash: 'counter',
  swordIntentCharged: 'swordIntent',
  swordIntentUsed: 'swordIntent',
  foxSub: 'foxSub',
  foxLeave: 'foxLeave',
  foxReturn: 'foxReturn',
  enemyDown: 'enemyDown',
  heroDown: 'heroDown',
  victory: 'victory',
  defeat: 'defeat',
  battleStart: 'battleStart',
  chapterStart: 'chapterStart',
  item: 'item',
  dialogAdvance: 'ui',
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
    bgmSource: null,
    bgmName: null,
    lastPlay: new Map(),
    active: new Map(),
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
    state.bgmBus.gain.value = 0.8;
    state.bgmBus.connect(state.master);
    resumeIfNeeded();
    return state.ctx;
  }

  function prune(now) {
    for (const [k, v] of state.active) if (v.end <= now) state.active.delete(k);
  }

  function playSfx(name, payload) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);
    prune(now);
    if (state.active.size >= MAX_VOICES) {
      let minK = null; let minEnd = Infinity;
      for (const [k, v] of state.active) if (v.end < minEnd) { minEnd = v.end; minK = k; }
      if (minK) { try { state.active.get(minK).src.stop(now); } catch { /* noop */ } state.active.delete(minK); }
    }
    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.sfxBus);
    src.start(now);
    const key = 'v' + state.voiceSeq++;
    state.active.set(key, { end: now + pcm.length / ctx.sampleRate, src });
  }

  function playBgm(name) {
    const ctx = ensureCtx();
    if (!ctx || !LOOPS[name] || state.bgmName === name) return;
    stopBgm();
    const pcm = synthLoop(name, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(state.bgmBus);
    src.start();
    state.bgmSource = src;
    state.bgmName = name;
  }

  function stopBgm() {
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch { /* noop */ } state.bgmSource = null; }
    state.bgmName = null;
  }

  function unlock() { ensureCtx(); }

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

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
