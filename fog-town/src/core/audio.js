// src/core/audio.js — FOG TOWN · 程序化音频（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     环境层（灯焰呼吸 / 雾巷底噪）用 loop 的 AudioBufferSourceNode 长循环。
//
// 契约：createAudio() → { unlock, event(type, payload), setMuted(b), setVolume(v), playBgm(mode), stopBgm() }

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 20;      // 同一音效 20ms 内去重
const NOISE_RMS = 0.22;    // 噪声滤波后统一归一到的 RMS

// ---------------------------------------------------------------------------
// 采样级 DSP 原语（振荡器 / 噪声 / 滤波 / 包络 / 混音）
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

/** 单发振荡器：类型 / 起始频率 / 指数滑到 freqEnd / 时长 / 增益 / attack / release 包络。 */
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

/** 白噪声 → 可选滤波 → 归一 RMS → 包络。 */
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

// ---------------------------------------------------------------------------
// 各音效合成器（均为 (payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

function sfxStep(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 120, freqEnd: 70, dur: 0.06, sr, gain: 0.22, attack: 0.004, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.08, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.01 });
  return mix(thud, click);
}

function sfxReveal(p, sr) {
  const f = 440 + (clamp(p.count ?? 1, 0, 30) * 6);
  return osc({ type: 'sine', freq: f, freqEnd: f * 1.5, dur: 0.14, sr, gain: 0.14, attack: 0.01, release: 0.07 });
}

function sfxKeyGain(_p, sr) {
  const a = osc({ type: 'triangle', freq: 1320, freqEnd: 1760, dur: 0.1, sr, gain: 0.3, attack: 0.003, release: 0.05 });
  const b = osc({ type: 'sine', freq: 1760, freqEnd: 2200, dur: 0.08, sr, gain: 0.2, attack: 0.003, release: 0.04 });
  return mix(a, b);
}

function sfxClueGain(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, freqEnd: 1174.66, dur: 0.16, sr, gain: 0.24, attack: 0.004, release: 0.08 });
  const b = osc({ type: 'sine', freq: 1318.5, freqEnd: 1567.98, dur: 0.16, sr, gain: 0.14, attack: 0.006, release: 0.08 });
  return mix(a, b);
}

function sfxLeverFlip(_p, sr) {
  const clunk = osc({ type: 'square', freq: 220, freqEnd: 130, dur: 0.09, sr, gain: 0.22, attack: 0.002, release: 0.04 });
  const click = noise({ dur: 0.03, sr, gain: 0.1, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.01 });
  return mix(clunk, click);
}

function sfxDoorOpen(_p, sr) {
  const creak = noise({ dur: 0.32, sr, gain: 0.2, filter: 'bandpass', cutoff: 900, attack: 0.05, release: 0.16 });
  const thud = osc({ type: 'triangle', freq: 90, freqEnd: 55, dur: 0.25, sr, gain: 0.28, attack: 0.004, release: 0.12 });
  return mix(creak, thud);
}

function sfxTruthMoment(_p, sr) {
  const chord = notes({ freqs: [220, 277.18, 329.63, 440, 554.37], dur: 1.1, gap: 0.03, type: 'triangle', gain: 0.16, attack: 0.04, release: 0.4, sr });
  const shimmer = noise({ dur: 0.8, sr, gain: 0.08, filter: 'highpass', cutoff: 3000, attack: 0.06, release: 0.4 });
  return mix(chord, shimmer);
}

function sfxTrap(_p, sr) {
  const clank = osc({ type: 'square', freq: 190, freqEnd: 95, dur: 0.18, sr, gain: 0.26, attack: 0.002, release: 0.08 });
  const nz = noise({ dur: 0.12, sr, gain: 0.16, filter: 'lowpass', cutoff: 700, attack: 0.002, release: 0.06 });
  return mix(clank, nz);
}

function sfxGuardAlert(_p, sr) {
  const a = osc({ type: 'square', freq: 620, dur: 0.06, sr, gain: 0.16, attack: 0.002, release: 0.02 });
  const b = osc({ type: 'square', freq: 620, dur: 0.06, sr, gain: 0.16, attack: 0.002, release: 0.02 });
  const out = new Float32Array(Math.round(0.16 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.08 * sr));
  return out;
}

function sfxEcho(_p, sr) {
  const ping = osc({ type: 'sine', freq: 780, freqEnd: 520, dur: 0.3, sr, gain: 0.26, attack: 0.004, release: 0.2 });
  const tail = osc({ type: 'sine', freq: 520, freqEnd: 340, dur: 0.24, sr, gain: 0.1, attack: 0.02, release: 0.16 });
  return mix(ping, tail);
}

function sfxBlocked(_p, sr) {
  return osc({ type: 'triangle', freq: 150, freqEnd: 90, dur: 0.05, sr, gain: 0.16, attack: 0.003, release: 0.02 });
}

function sfxBlockClear(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.34, gap: 0.11, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.14, sr });
}

function sfxOilLow(_p, sr) {
  const a = osc({ type: 'triangle', freq: 300, freqEnd: 260, dur: 0.07, sr, gain: 0.2, attack: 0.003, release: 0.03 });
  const b = osc({ type: 'triangle', freq: 300, freqEnd: 260, dur: 0.07, sr, gain: 0.2, attack: 0.003, release: 0.03 });
  const out = new Float32Array(Math.round(0.18 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.09 * sr));
  return out;
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxWin(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25, 783.99], dur: 0.5, gap: 0.13, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.2, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  step: sfxStep,
  reveal: sfxReveal,
  keyGain: sfxKeyGain,
  clueGain: sfxClueGain,
  leverFlip: sfxLeverFlip,
  doorOpen: sfxDoorOpen,
  truthMoment: sfxTruthMoment,
  trap: sfxTrap,
  guardAlert: sfxGuardAlert,
  echo: sfxEcho,
  blocked: sfxBlocked,
  blockClear: sfxBlockClear,
  oilLow: sfxOilLow,
  death: sfxDeath,
  win: sfxWin,
  ui: sfxUi,
  milestone: sfxMilestone,
  newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop 的 PCM）：环境底噪 / 灯焰呼吸
// ---------------------------------------------------------------------------

// 雾巷底噪：4s 低通白噪 + 0.25Hz 慢 LFO（1 周期，无缝）
function loopFog(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 320, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

// 灯焰呼吸：2s 带通白噪 + 0.6Hz 呼吸 LFO（无缝）
function loopLamp(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = bandpass(buf, 900, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.07 + 0.05 * Math.sin(2 * Math.PI * 0.6 * t);
  }
  return buf;
}

const LOOPS = {
  fog: loopFog,
  lamp: loopLamp,
};

export const LOOP_NAMES = Object.keys(LOOPS);

// ---------------------------------------------------------------------------
// 公开合成接口（供 audio-check 离线调用，也供 createAudio 内部复用）
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
  step: 'step',
  reveal: 'reveal',
  keyGain: 'keyGain',
  clueGain: 'clueGain',
  leverFlip: 'leverFlip',
  doorOpen: 'doorOpen',
  truthMoment: 'truthMoment',
  trap: 'trap',
  guardAlert: 'guardAlert',
  echo: 'echo',
  blocked: 'blocked',
  blockClear: 'blockClear',
  oilLow: 'oilLow',
  death: 'death',
  win: 'win',
  ui: 'ui',
  milestone: 'milestone',
  newRecord: 'newRecord',
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
    volume: 0.7,
    muted: false,
    unlocked: false,
    bgmSource: null,
    bgmMode: null,
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
    if (state.ctx) {
      resumeIfNeeded();
      return state.ctx;
    }
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

  function playSfx(name, payload) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null;
      let minEnd = Infinity;
      for (const [key, v] of state.active) if (v.endTime < minEnd) { minEnd = v.endTime; minKey = key; }
      if (minKey != null) {
        const v = state.active.get(minKey);
        if (v && v.stop) { try { v.stop(now); } catch { /* noop */ } }
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

  function startLoop(kind) {
    const ctx = ensureCtx();
    if (!ctx || state.loops[kind]) return;
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

  function stopLoop(kind) {
    const l = state.loops[kind];
    if (!l) return;
    try { l.src.stop(); } catch { /* noop */ }
    state.loops[kind] = null;
  }

  function stopBgmSource() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      resumeIfNeeded();
      state.unlocked = true;
      startLoop('lamp');
      startLoop('fog');
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
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
  }

  async function playBgm(mode) {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
    // 程序化 BGM：按场景包切换不同底噪/灯焰配比（无需外部音频文件）
    try {
      const buf = ctx.createBuffer(1, ctx.sampleRate * 4, ctx.sampleRate);
      const data = buf.getChannelData(0);
      const fog = synthLoop('fog', ctx.sampleRate);
      const lamp = synthLoop('lamp', ctx.sampleRate);
      for (let i = 0; i < data.length; i += 1) {
        const g = mode === 'boss' ? 0.9 : mode === 'menu' ? 0.5 : 0.7;
        data[i] = fog[i % fog.length] * (g) + lamp[i % lamp.length] * (1 - g) * 0.6;
      }
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.connect(state.bgmBus);
      node.start();
      state.bgmSource = node;
      state.bgmMode = mode;
    } catch { /* 静默降级 */ }
  }

  function stopBgm() {
    stopBgmSource();
    state.bgmMode = null;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
