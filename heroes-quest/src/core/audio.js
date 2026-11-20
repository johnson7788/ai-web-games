// src/core/audio.js — HEROES QUEST · 程序化音频（WebAudio，零外链零打包音频文件）
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器+噪声+包络 → mono Float32Array。
//     这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验 RMS/峰值/NaN。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer 播放；BGM 用程序化循环层（分场景）。
// 契约：createAudio() → { unlock, event(type,payload), setMuted(b), setVolume(v), playBgm(name), stopBgm() }

export const SAMPLE_RATE = 44100;
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
  let xp = 0, yp = 0;
  for (let i = 0; i < input.length; i += 1) {
    const x = input[i];
    const y = a * (yp + x - xp);
    out[i] = y; yp = y; xp = x;
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

function notes({ freqs, dur = 0.4, gap = 0.13, type = 'triangle', gain = 0.2, attack = 0.01, release = 0.15, sr = SAMPLE_RATE } = {}) {
  const total = (freqs.length - 1) * gap + dur;
  const out = new Float32Array(Math.max(1, Math.round(total * sr)));
  freqs.forEach((f, k) => addAt(out, osc({ type, freq: f, dur, sr, gain, attack, release }), Math.round(k * gap * sr)));
  return out;
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

// ---------- 音效合成器 ----------
function thud(freq, freqEnd, dur, gain, filterCut) {
  return mix(
    osc({ type: 'triangle', freq, freqEnd, dur, gain, attack: 0.004, release: dur * 0.5 }),
    noise({ dur: dur * 0.7, gain: gain * 0.5, filter: 'lowpass', cutoff: filterCut, attack: 0.003, release: dur * 0.3 }),
  );
}

const SYNTH = {
  march: () => mix(thud(170, 120, 0.09, 0.3, 400), osc({ type: 'triangle', freq: 150, freqEnd: 110, dur: 0.09, gain: 0.3, attack: 0.004 })),
  formation: () => noise({ dur: 0.05, gain: 0.2, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.02 }),
  battleStart: () => thud(90, 60, 0.5, 0.5, 300),
  turn: () => osc({ type: 'sine', freq: 880, freqEnd: 990, dur: 0.09, gain: 0.22, attack: 0.002, release: 0.04 }),
  strike: () => mix(osc({ type: 'triangle', freq: 220, freqEnd: 80, dur: 0.14, gain: 0.5, attack: 0.003, release: 0.07 }), noise({ dur: 0.06, gain: 0.22, filter: 'bandpass', cutoff: 900, attack: 0.002, release: 0.03 })),
  skill: () => notes({ freqs: [660, 880, 1320], dur: 0.16, gap: 0.05, type: 'sine', gain: 0.18, attack: 0.01, release: 0.06 }),
  heal: () => osc({ type: 'sine', freq: 520, freqEnd: 900, dur: 0.3, gain: 0.28, attack: 0.02, release: 0.1 }),
  buff: () => notes({ freqs: [523, 659, 784], dur: 0.25, gap: 0.09, type: 'triangle', gain: 0.16, attack: 0.02, release: 0.1 }),
  guard: () => mix(osc({ type: 'triangle', freq: 160, freqEnd: 130, dur: 0.2, gain: 0.35, attack: 0.004, release: 0.1 }), noise({ dur: 0.12, gain: 0.15, filter: 'lowpass', cutoff: 700, attack: 0.003, release: 0.06 })),
  signature: () => mix(notes({ freqs: [220, 277.18, 329.63, 440], dur: 0.6, gap: 0.05, type: 'triangle', gain: 0.22, attack: 0.02, release: 0.2 }), noise({ dur: 0.5, gain: 0.2, filter: 'lowpass', cutoff: 800, attack: 0.005, release: 0.2 })),
  enemyHit: () => thud(140, 90, 0.16, 0.4, 500),
  kill: () => osc({ type: 'triangle', freq: 400, freqEnd: 120, dur: 0.22, gain: 0.4, attack: 0.004, release: 0.1 }),
  heroDown: () => osc({ type: 'triangle', freq: 300, freqEnd: 58, dur: 0.5, gain: 0.45, attack: 0.01, release: 0.2 }),
  win: () => notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.15 }),
  lose: () => notes({ freqs: [330, 262, 196], dur: 0.5, gap: 0.18, type: 'triangle', gain: 0.24, attack: 0.02, release: 0.2 }),
  rest: () => notes({ freqs: [392, 493.88], dur: 0.6, gap: 0.1, type: 'sine', gain: 0.16, attack: 0.06, release: 0.2 }),
  event: () => osc({ type: 'sine', freq: 300, freqEnd: 520, dur: 0.35, gain: 0.2, attack: 0.03, release: 0.15 }),
  upgrade: () => notes({ freqs: [523, 659, 784, 1046], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.18, attack: 0.01, release: 0.1 }),
  ui: () => mix(osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, gain: 0.22, attack: 0.002, release: 0.03 }), noise({ dur: 0.02, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 })),
  victory: () => mix(notes({ freqs: [392, 523.25, 659.25, 783.99, 1046.5], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.02, release: 0.2 }), noise({ dur: 0.6, gain: 0.15, filter: 'lowpass', cutoff: 900, attack: 0.01, release: 0.3 })),
  newRecord: () => notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16 }),
  chime: () => mix(osc({ type: 'sine', freq: 880, dur: 0.28, gain: 0.2, attack: 0.01, release: 0.12 }), osc({ type: 'sine', freq: 1318.5, dur: 0.28, gain: 0.12, attack: 0.01, release: 0.12 })),
};

export const SFX_NAMES = Object.keys(SYNTH);

// 事件名 → 音效名（sim 事件表 → 音频）
const EVENT_TO_SFX = {
  formationDone: 'formation',
  nodeMarch: 'march',
  battleStart: 'battleStart',
  turnReady: 'turn',
  heroAttack: 'strike',
  heroSkill: 'skill',
  heal: 'heal',
  buff: 'buff',
  guard: 'guard',
  signature: 'signature',
  enemyAttack: 'enemyHit',
  kill: 'kill',
  heroDown: 'heroDown',
  battleWin: 'win',
  battleLose: 'lose',
  rest: 'rest',
  event: 'event',
  eventResolved: 'event',
  upgradeAvailable: 'upgrade',
  upgrade: 'upgrade',
  reward: 'win',
  victory: 'victory',
  defeat: 'lose',
  newRecord: 'newRecord',
  tutorialDone: 'chime',
  ui: 'ui',
};

// ---------- 程序化 BGM 循环层（三场景：绿野 / 雪原 / 灰烬） ----------
// 简单可无缝循环的琶音 pad：整数个完整周期，首尾连续。
function bgmPad(sr, base, scale, lfoHz, bright) {
  const dur = 8;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const steps = [0, 3, 5, 7, 10, 7, 5, 3]; // 自然小调琶音骨架（半音步）
  const stepDur = dur / steps.length;
  for (let s = 0; s < steps.length; s += 1) {
    const f = base * Math.pow(2, scale + steps[s] / 12);
    const t0 = Math.round(s * stepDur * sr);
    const len = Math.round(stepDur * sr);
    for (let i = 0; i < len; i += 1) {
      const t = i / sr;
      const env = Math.sin(Math.PI * (i / len)) * 0.5; // 每步淡入淡出，无缝
      const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * lfoHz * (t + s * stepDur));
      out[t0 + i] += env * (0.6 + 0.4 * lfo) * (
        Math.sin(2 * Math.PI * f * (t + s * stepDur)) * 0.7
        + Math.sin(2 * Math.PI * f * 2 * (t + s * stepDur)) * bright
      );
    }
  }
  return normalizeRms(out, 0.14);
}

const LOOPS = {
  meadow: (sr) => bgmPad(sr, 220, 0, 0.5, 0.25),
  snow: (sr) => bgmPad(sr, 196, 5, 0.35, 0.15),
  ash: (sr) => bgmPad(sr, 175, -2, 0.6, 0.35),
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
  signature: 6, victory: 6, battleWin: 5, win: 5,
  strike: 5, skill: 5, kill: 5, heroDown: 5,
  enemyHit: 4, heal: 4, battleStart: 4, battleLose: 4, lose: 4,
  buff: 3, guard: 3, rest: 3, upgrade: 3, event: 3,
  turn: 2, march: 2, formation: 2, newRecord: 2, chime: 2,
  ui: 1,
};

// ---------- 播放层 ----------
export function createAudio() {
  const state = {
    ctx: null, master: null, sfxBus: null, bgmBus: null,
    volume: 0.7, muted: false, unlocked: false,
    bgmSource: null, bgmName: null, bgmBuffers: {},
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
    state.bgmBus.gain.value = 0.55;
    state.bgmBus.connect(state.master);
    resumeIfNeeded();
    return state.ctx;
  }

  function playSfx(name) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < 0.016) return;
    state.lastPlay.set(name, now);
    const pcm = synthSfx(name, {}, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.sfxBus);
    src.start(now);
  }

  function event(type) {
    if (!type) return;
    const name = EVENT_TO_SFX[type];
    if (name) playSfx(name);
  }

  function unlock() {
    ensureCtx();
    state.unlocked = true;
  }

  function setMuted(b) {
    state.muted = !!b;
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
  }
  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
  }

  function stopBgm() {
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch { /* noop */ } state.bgmSource = null; }
    state.bgmName = null;
  }

  function playBgm(name) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmName === name && state.bgmSource) return;
    stopBgm();
    try {
      let buf = state.bgmBuffers[name];
      if (!buf) {
        const pcm = synthLoop(name, ctx.sampleRate);
        buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
        buf.getChannelData(0).set(pcm);
        state.bgmBuffers[name] = buf;
      }
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.connect(state.bgmBus);
      node.start();
      state.bgmSource = node;
      state.bgmName = name;
    } catch { /* BGM 静默降级 */ }
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
