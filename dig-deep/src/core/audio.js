// src/core/audio.js — DIG DEEP 音效合成与播放（WebAudio 标准 API，零依赖零外链）
// 分两层：1) 采样级合成器（纯函数，无 DOM）：振荡器+噪声+包络 → Float32Array PCM，
//          供 tools/audio-check.mjs 在 Node 里离线校验；2) 浏览器播放层。
// createAudio() → { unlock, event, setMuted, setVolume, playBgm, stopBgm }
import Sdk from './sdk.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
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
// 音效合成器
// ---------------------------------------------------------------------------
function sfxDig(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 120, freqEnd: 70, dur: 0.08, sr, gain: 0.3, attack: 0.004, release: 0.04 }),
    noise({ dur: 0.05, sr, gain: 0.16, filter: 'lowpass', cutoff: 500, attack: 0.002, release: 0.02 }),
  );
}

function sfxCellHit(_p, sr) {
  return osc({ type: 'square', freq: 210, freqEnd: 150, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.02 });
}

function sfxCellBreak(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 300, freqEnd: 120, dur: 0.12, sr, gain: 0.4, attack: 0.003, release: 0.06 }),
    noise({ dur: 0.07, sr, gain: 0.22, filter: 'lowpass', cutoff: 900, attack: 0.002, release: 0.03 }),
  );
}

function sfxDiamond(_p, sr) {
  return notes({ freqs: [880, 1318.5, 1760], dur: 0.12, gap: 0.05, type: 'sine', gain: 0.3, attack: 0.003, release: 0.06, sr });
}

function sfxFossil(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.16, gap: 0.06, type: 'triangle', gain: 0.26, attack: 0.004, release: 0.08, sr });
}

function sfxFaultBreak(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 90, freqEnd: 45, dur: 0.24, sr, gain: 0.4, attack: 0.004, release: 0.1 }),
    noise({ dur: 0.18, sr, gain: 0.24, filter: 'lowpass', cutoff: 220, attack: 0.003, release: 0.08 }),
  );
}

function sfxCollapse(_p, sr) {
  return mix(
    osc({ type: 'sawtooth', freq: 70, freqEnd: 34, dur: 0.3, sr, gain: 0.36, attack: 0.004, release: 0.14 }),
    noise({ dur: 0.24, sr, gain: 0.3, filter: 'lowpass', cutoff: 300, attack: 0.003, release: 0.12 }),
  );
}

function sfxRockCut(_p, sr) {
  return noise({ dur: 0.22, sr, gain: 0.32, filter: 'bandpass', cutoff: 2400, attack: 0.02, release: 0.1 });
}

function sfxRockBlocked(_p, sr) {
  return osc({ type: 'square', freq: 160, freqEnd: 110, dur: 0.06, sr, gain: 0.22, attack: 0.002, release: 0.03 });
}

function sfxLava(_p, sr) {
  return noise({ dur: 0.4, sr, gain: 0.34, filter: 'highpass', cutoff: 600, attack: 0.02, release: 0.18 });
}

function sfxLayerEnter(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 440], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.18, attack: 0.05, release: 0.16, sr });
}

function sfxToolChange(_p, sr) {
  return osc({ type: 'square', freq: 500, freqEnd: 640, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.02 });
}

function sfxToolUnlock(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25], dur: 0.22, gap: 0.07, type: 'triangle', gain: 0.26, attack: 0.006, release: 0.1, sr });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.12, attack: 0.004, release: 0.03 });
}

function sfxMove(_p, sr) {
  return noise({ dur: 0.05, sr, gain: 0.1, filter: 'highpass', cutoff: 1200, attack: 0.01, release: 0.02 });
}

function sfxStaminaLow(_p, sr) {
  return mix(
    osc({ type: 'square', freq: 220, dur: 0.09, sr, gain: 0.2, attack: 0.002, release: 0.04 }),
    osc({ type: 'square', freq: 220, dur: 0.09, sr, gain: 0.2, attack: 0.002, release: 0.04 }),
  );
}

function sfxDeath(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.9, sr, gain: 0.4, attack: 0.01, release: 0.25 }),
    noise({ dur: 0.6, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.28 }),
  );
}

function sfxDrown(_p, sr) {
  return mix(
    osc({ type: 'sine', freq: 400, freqEnd: 80, dur: 0.8, sr, gain: 0.32, attack: 0.01, release: 0.3 }),
    noise({ dur: 0.5, sr, gain: 0.2, filter: 'lowpass', cutoff: 500, attack: 0.02, release: 0.22 }),
  );
}

function sfxCoreReach(_p, sr) {
  return mix(
    notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25], dur: 0.6, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.3, sr }),
    noise({ dur: 0.8, sr, gain: 0.12, filter: 'lowpass', cutoff: 1200, attack: 0.01, release: 0.4 }),
  );
}

function sfxUi(_p, sr) {
  return mix(
    osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 }),
    noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 }),
  );
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.35, gap: 0.11, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.14, sr });
}

function sfxChime(_p, sr) {
  return mix(
    osc({ type: 'sine', freq: 880, dur: 0.24, sr, gain: 0.2, attack: 0.01, release: 0.1 }),
    osc({ type: 'sine', freq: 1318.5, dur: 0.24, sr, gain: 0.12, attack: 0.01, release: 0.1 }),
  );
}

function sfxLaserCharge(_p, sr) {
  return osc({ type: 'sine', freq: 700, freqEnd: 1400, dur: 0.14, sr, gain: 0.24, attack: 0.006, release: 0.06 });
}

const SYNTH = {
  dig: sfxDig,
  cellHit: sfxCellHit,
  cellBreak: sfxCellBreak,
  diamond: sfxDiamond,
  fossil: sfxFossil,
  faultBreak: sfxFaultBreak,
  collapse: sfxCollapse,
  rockCut: sfxRockCut,
  rockBlocked: sfxRockBlocked,
  lava: sfxLava,
  layerEnter: sfxLayerEnter,
  toolChange: sfxToolChange,
  toolUnlock: sfxToolUnlock,
  milestone: sfxMilestone,
  move: sfxMove,
  staminaLow: sfxStaminaLow,
  death: sfxDeath,
  drown: sfxDrown,
  coreReach: sfxCoreReach,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
  laserCharge: sfxLaserCharge,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（BGM：程序化无缝，洞穴低鸣 / 熔核嗡鸣）
// ---------------------------------------------------------------------------
function loopCavern(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 220, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.025 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

function loopMagma(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = bandpass(buf, 140, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.06 + 0.03 * Math.sin(2 * Math.PI * 0.5 * t);
  }
  return buf;
}

const LOOPS = {
  cavern: loopCavern,
  magma: loopMagma,
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
  coreReach: 6, diamond: 6, fossil: 6,
  collapse: 5, death: 5, drown: 5, toolUnlock: 5,
  faultBreak: 4, rockCut: 4, layerEnter: 4, newRecord: 4,
  cellBreak: 3, rockBlocked: 3, lava: 3,
  dig: 2, cellHit: 2, staminaLow: 2,
  laserCharge: 2, toolChange: 2, chime: 2,
  milestone: 1, move: 1, ui: 1,
};

const EVENT_TO_SFX = {
  dig: 'dig',
  cellHit: 'cellHit',
  cellBreak: 'cellBreak',
  diamond: 'diamond',
  fossil: 'fossil',
  faultBreak: 'faultBreak',
  collapse: 'collapse',
  rockCut: 'rockCut',
  rockBlocked: 'rockBlocked',
  lava: 'lava',
  layerEnter: 'layerEnter',
  toolChange: 'toolChange',
  toolUnlock: 'toolUnlock',
  milestone: 'milestone',
  move: 'move',
  staminaLow: 'staminaLow',
  death: 'death',
  drown: 'drown',
  coreReach: 'coreReach',
  laserCharge: 'laserCharge',
  ui: 'ui',
  newRecord: 'newRecord',
  tutorialDone: 'chime',
  layerRestart: 'collapse',
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
    volume: clamp(Number(Sdk.load('audioVolume', 0.7)), 0, 1),
    muted: !!Sdk.load('audioMuted', false),
    unlocked: false,
    bgmSource: null,
    bgmMode: null,
    loops: { cavern: null, magma: null },
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
      let minKey = null;
      let minPrio = Infinity;
      for (const [key, v] of state.active) if (v.priority < minPrio) { minPrio = v.priority; minKey = key; }
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
    g.gain.value = 0.5;
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
    }
  }

  function event(type, payload = {}) {
    if (!type) return;
    if (type === 'fossil') {
      playSfx('fossil', payload);
      playSfx('laserCharge', payload);
      return;
    }
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

  function playBgm(mode) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (mode === state.bgmMode) return;
    state.bgmMode = mode;
    stopBgm();
    if (mode === 'core') startLoop('magma');
    else if (mode === 'dig') startLoop('cavern');
  }

  function stopBgm() {
    stopBgmSource();
    stopLoop('cavern');
    stopLoop('magma');
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
