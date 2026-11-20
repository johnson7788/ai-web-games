// src/core/audio.js — CONSTELLATION LINE · 程序化音频（WebAudio 标准 API，零依赖零外链）
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络 → PCM，
//     让 tools/audio-check.mjs 能在 Node（无 WebAudio）离线渲染校验 RMS/峰值/NaN。
//  2) 浏览器播放层：PCM 灌 AudioBuffer → AudioBufferSourceNode → 播放；BGM 用无缝循环 pad。
//
// 契约：createAudio() → { unlock(), event(type,payload), setMuted(b), setVolume(v), playBgm(kind), stopBgm() }
// 事件名与 sim 事件表一字不差：edge / wrong / win / fail / waypoint / meteorBlock / meteorClear /
//   brushSwitch / progress / levelStart / perfect / ui / newRecord / tutorialDone。

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.24;

// ---------- DSP 原语 ----------
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

// ---------- 各音效 ----------
function sfxEdge(p, sr) {
  // 连星：上滑 pluck，步数越高音越高（音阶感）
  const steps = clamp(p.steps ?? 0, 0, 24);
  const f = 392 * Math.pow(2, (steps % 12) / 12);
  const pluck = osc({ type: 'triangle', freq: f, freqEnd: f * 1.5, dur: 0.14, sr, gain: 0.3, attack: 0.004, release: 0.07 });
  const spark = osc({ type: 'sine', freq: f * 2, freqEnd: f * 2.6, dur: 0.09, sr, gain: 0.1, attack: 0.003, release: 0.04 });
  return mix(pluck, spark);
}

function sfxWrong(_p, sr) {
  const buzz = osc({ type: 'sawtooth', freq: 160, freqEnd: 90, dur: 0.18, sr, gain: 0.18, attack: 0.004, release: 0.08 });
  const thud = osc({ type: 'triangle', freq: 110, freqEnd: 70, dur: 0.16, sr, gain: 0.22, attack: 0.003, release: 0.08 });
  return mix(buzz, thud);
}

function sfxWin(_p, sr) {
  // 星座点亮：大调琶音 C-E-G-C-E
  return notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25], dur: 0.5, gap: 0.11, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.22, sr });
}

function sfxFail(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 120, dur: 0.8, sr, gain: 0.3, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.6, sr, gain: 0.16, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.25 });
  return mix(glide, nz);
}

function sfxWaypoint(_p, sr) {
  // 北极星：高音 sparkle 双音
  const a = osc({ type: 'sine', freq: 880, freqEnd: 1174.7, dur: 0.22, sr, gain: 0.22, attack: 0.004, release: 0.1 });
  const b = osc({ type: 'sine', freq: 1318.5, freqEnd: 1760, dur: 0.3, sr, gain: 0.14, attack: 0.004, release: 0.14 });
  const out = new Float32Array(Math.round(0.34 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.08 * sr));
  return out;
}

function sfxMeteor(_p, sr) {
  // 流星划过：bandpass whoosh
  return noise({ dur: 0.42, sr, gain: 0.3, filter: 'bandpass', cutoff: 1200, attack: 0.05, release: 0.18 });
}

function sfxBrushSwitch(_p, sr) {
  return osc({ type: 'sine', freq: 500, freqEnd: 720, dur: 0.07, sr, gain: 0.2, attack: 0.003, release: 0.03 });
}

function sfxProgress(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxLevelStart(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 392], dur: 0.45, gap: 0.1, type: 'triangle', gain: 0.14, attack: 0.05, release: 0.18, sr });
}

function sfxPerfect(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  edge: sfxEdge,
  wrong: sfxWrong,
  win: sfxWin,
  fail: sfxFail,
  waypoint: sfxWaypoint,
  meteorBlock: sfxMeteor,
  meteorClear: sfxMeteor,
  brushSwitch: sfxBrushSwitch,
  progress: sfxProgress,
  levelStart: sfxLevelStart,
  perfect: sfxPerfect,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  tutorialDone: sfxPerfect,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------- 循环层 ----------
// 星空 pad：4s 低通正弦和声 + 0.25Hz 呼吸（整数周期，首尾连续无缝循环）
function loopBgm(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const chord = [110, 164.81, 220, 329.63];
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    let s = 0;
    for (const f of chord) s += Math.sin(2 * Math.PI * f * t) * (1 / chord.length);
    out[i] = s * (0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t));
  }
  return normalizeRms(out, 0.16);
}

// 流星风：4s 带通白噪 + 0.25Hz 慢 LFO（无缝）
function loopWind(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = bandpass(buf, 900, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.06 + 0.03 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

const LOOPS = {
  bgm: loopBgm,
  wind: loopWind,
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
  edge: 'edge',
  wrong: 'wrong',
  win: 'win',
  fail: 'fail',
  waypoint: 'waypoint',
  meteorBlock: 'meteorBlock',
  meteorClear: 'meteorClear',
  brushSwitch: 'brushSwitch',
  progress: 'progress',
  levelStart: 'levelStart',
  perfect: 'perfect',
  ui: 'ui',
  newRecord: 'newRecord',
  tutorialDone: 'tutorialDone',
};

// ---------- 播放层 ----------
export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: 0.7,
    muted: false,
    unlocked: false,
    bgmSource: null,
    bgmKind: null,
    loops: {},
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
    state.bgmBus.gain.value = 0.7;
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

    pruneActive(now);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null;
      let minPrio = Infinity;
      for (const [key, v] of state.active) {
        if (v.endTime < minPrio) { minPrio = v.endTime; minKey = key; }
      }
      if (minKey != null) {
        try { state.active.get(minKey).stop(now); } catch { /* noop */ }
        state.active.delete(minKey);
      }
    }

    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.sfxBus);
    src.start(now);
    const key = `v${state.voiceSeq++}`;
    state.active.set(key, { endTime: now + pcm.length / ctx.sampleRate, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
  }

  function stopBgmSource() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
    state.bgmKind = null;
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      resumeIfNeeded();
      state.unlocked = true;
      startLoop('wind');
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
    g.connect(state.sfxBus);
    src.start();
    state.loops[kind] = { src, g };
  }

  function event(type, payload = {}) {
    if (!type) return;
    const name = EVENT_TO_SFX[type];
    if (name) playSfx(name, payload);
  }

  function setMuted(b) {
    state.muted = !!b;
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
  }

  function playBgm(kind) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmKind === kind && state.bgmSource) return;
    stopBgmSource();
    try {
      const pcm = synthLoop(kind, ctx.sampleRate);
      const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      buf.getChannelData(0).set(pcm);
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.connect(state.bgmBus);
      node.start();
      state.bgmSource = node;
      state.bgmKind = kind;
    } catch { /* BGM 失败静默降级 */ }
  }

  function stopBgm() {
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
