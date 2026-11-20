// src/core/audio.js — SPOT IT · 程序化音频（WebAudio 零依赖零外链，BGM 程序化合成不打包音频文件）。
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络 → mono PCM。
//     tools/audio-check.mjs 在 Node（无 WebAudio）里离线渲染校验 RMS/peak/NaN。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer；BGM 用合成好的 loop buffer 无缝循环。
// 契约：createAudio() → { unlock(), event(type,payload), setMuted(b), setVolume(v), playBgm(mode), stopBgm() }
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.25;

// ---------------- DSP 原语 ----------------
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

// ---------------- 各音效 ----------------
function sfxFind(p, sr) {
  const streak = clamp(p.streak ?? 0, 0, 12);
  const f = 540 * Math.pow(2, streak / 12);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 1.6, dur: 0.16, sr, gain: 0.42, attack: 0.004, release: 0.08 });
  const spark = osc({ type: 'sine', freq: f * 2, freqEnd: f * 2.4, dur: 0.09, sr, gain: 0.12, attack: 0.004, release: 0.05 });
  return mix(tone, spark);
}
function sfxDecoy(_p, sr) {
  const buzz = osc({ type: 'square', freq: 160, freqEnd: 110, dur: 0.22, sr, gain: 0.24, attack: 0.004, release: 0.1 });
  const nz = noise({ dur: 0.18, sr, gain: 0.2, filter: 'lowpass', cutoff: 400, attack: 0.003, release: 0.09 });
  return mix(buzz, nz);
}
function sfxWrong(_p, sr) {
  return osc({ type: 'sine', freq: 420, freqEnd: 260, dur: 0.09, sr, gain: 0.18, attack: 0.004, release: 0.05 });
}
function sfxLevelClear(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.42, gap: 0.11, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}
function sfxNewScene(_p, sr) {
  return notes({ freqs: [220, 277.18, 329.63, 415.3], dur: 0.6, gap: 0.14, type: 'triangle', gain: 0.14, attack: 0.08, release: 0.3, sr });
}
function sfxLevelStart(_p, sr) {
  return notes({ freqs: [523.25, 659.25], dur: 0.2, gap: 0.09, type: 'triangle', gain: 0.16, attack: 0.01, release: 0.1, sr });
}
function sfxScoreMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 880, freqEnd: 1320, dur: 0.1, sr, gain: 0.16, attack: 0.004, release: 0.05 });
}
function sfxBatteryLow(_p, sr) {
  const a = osc({ type: 'square', freq: 520, dur: 0.1, sr, gain: 0.14, attack: 0.003, release: 0.05 });
  const b = osc({ type: 'square', freq: 520, dur: 0.1, sr, gain: 0.14, attack: 0.003, release: 0.05 });
  const out = new Float32Array(Math.round(0.24 * sr));
  addAt(out, a, 0); addAt(out, b, Math.round(0.12 * sr));
  return out;
}
function sfxBatteryUp(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 760, dur: 0.08, sr, gain: 0.14, attack: 0.004, release: 0.04 });
}
function sfxChecklist(_p, sr) {
  return notes({ freqs: [659.25, 880], dur: 0.16, gap: 0.07, type: 'triangle', gain: 0.2, attack: 0.005, release: 0.08, sr });
}
function sfxWon(_p, sr) {
  const chord = notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25], dur: 0.8, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.3, sr });
  const crash = noise({ dur: 0.6, sr, gain: 0.14, filter: 'lowpass', cutoff: 1200, attack: 0.004, release: 0.3 });
  return mix(chord, crash);
}
function sfxFail(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 500, freqEnd: 90, dur: 0.9, sr, gain: 0.36, attack: 0.01, release: 0.3 });
  const nz = noise({ dur: 0.6, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 880, freqEnd: 660, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}
function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  find: sfxFind, decoy: sfxDecoy, wrong: sfxWrong, levelClear: sfxLevelClear,
  newScene: sfxNewScene, levelStart: sfxLevelStart, scoreMilestone: sfxScoreMilestone,
  batteryLow: sfxBatteryLow, batteryUp: sfxBatteryUp, checklist: sfxChecklist,
  won: sfxWon, fail: sfxFail, ui: sfxUi, newRecord: sfxNewRecord, chime: sfxChime,
};
export const SFX_NAMES = Object.keys(SYNTH);

// ---------------- 循环层（环境 / BGM 程序化合成） ----------------
function loopAmbient(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 420, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.06 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}
function loopTension(sr) {
  const dur = 3;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = bandpass(buf, 900, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.04 + 0.02 * Math.sin(2 * Math.PI * 0.5 * t);
  }
  return buf;
}
const LOOPS = { ambient: loopAmbient, tension: loopTension };
export const LOOP_NAMES = Object.keys(LOOPS);

/** BGM：分层合成（低音铺底 + 拨弦琶音 + 环境噪声），4s 无缝循环。mode: 'menu' | 'play' | 'tense' */
export function synthBgm(mode = 'play', sr = SAMPLE_RATE) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // 低音铺底（A 小调 A2-E3 持续）
  const pad = osc({ type: 'triangle', freq: 110, dur, sr, gain: 0.12, attack: 0.5, release: 1.5 });
  addAt(out, pad, 0);
  const pad2 = osc({ type: 'sine', freq: 164.81, dur, sr, gain: 0.09, attack: 0.5, release: 1.5 });
  addAt(out, pad2, 0);
  // 拨弦琶音（A3 C4 E4 A4，每 0.5s 一个音，循环内重复 2 次）
  const arp = [220, 261.63, 329.63, 440];
  for (let rep = 0; rep < 2; rep += 1) {
    for (let k = 0; k < arp.length; k += 1) {
      const s = osc({ type: 'triangle', freq: arp[k], freqEnd: arp[k] * 0.995, dur: 0.32, sr, gain: 0.07, attack: 0.01, release: 0.14 });
      addAt(out, s, Math.round((rep * 2 + k * 0.5) * sr));
    }
  }
  // 环境噪声底
  let amb = new Float32Array(n);
  for (let i = 0; i < n; i += 1) amb[i] = Math.random() * 2 - 1;
  amb = lowpass(amb, 500, sr);
  amb = normalizeRms(amb, NOISE_RMS);
  for (let i = 0; i < n; i += 1) amb[i] *= 0.03;
  addAt(out, amb, 0);
  return out;
}

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
  find: 'find', decoy: 'decoy', wrong: 'wrong', levelClear: 'levelClear',
  newScene: 'newScene', levelStart: 'levelStart', scoreMilestone: 'scoreMilestone',
  batteryLow: 'batteryLow', batteryUp: 'batteryUp', checklist: 'checklist',
  won: 'won', fail: 'fail', ui: 'ui', newRecord: 'newRecord', tutorialDone: 'chime',
};

// ---------------- 播放层 ----------------
export function createAudio() {
  const state = {
    ctx: null, master: null, sfxBus: null, bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    unlocked: false,
    bgmSource: null, bgmMode: null,
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
    state.bgmBus.gain.value = 0.85;
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
    if (state.active.size >= MAX_VOICES) state.active.clear();
    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.sfxBus);
    src.start(now);
    const key = `v${state.voiceSeq++}`;
    state.active.set(key, { endTime: now + pcm.length / ctx.sampleRate });
  }
  function startLoopBuf(kind, gainVal) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const pcm = synthLoop(kind, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = ctx.createGain(); g.gain.value = gainVal;
    src.connect(g); g.connect(state.sfxBus);
    src.start();
    return { src, g };
  }
  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      resumeIfNeeded();
      state.unlocked = true;
      startLoopBuf('ambient', 1);
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
  function stopBgmSource() {
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch { /* noop */ } state.bgmSource = null; }
  }
  function playBgm(mode) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmMode === mode && state.bgmSource) return;
    stopBgmSource();
    state.bgmMode = mode;
    const pcm = synthBgm(mode, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const node = ctx.createBufferSource();
    node.buffer = buf; node.loop = true;
    node.connect(state.bgmBus);
    node.start();
    state.bgmSource = node;
  }
  function stopBgm() { stopBgmSource(); state.bgmMode = null; }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
