// src/core/audio.js — ENDLESS ORB · WebAudio 程序化合成（零依赖零外链，BGM 分层无缝循环）。
//
// 两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络 → mono Float32Array PCM，
//     让 tools/audio-check.mjs 在 Node（无 WebAudio）里离线渲染校验 RMS。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer → AudioBufferSourceNode → GainNode → destination；BGM 用 loop 循环。
//
// 事件名与 sim 事件表对齐：shot/pin/heavyPin/nearMiss/ringClear/sceneEnter/polarityReversal/
//   photonSuck/upgradeChosen/overloadReady/pulse/death/win，外加 ui。

export const SAMPLE_RATE = 44100;

const NOISE_RMS = 0.25;
const MAX_VOICES = 2;
const DEDUPE_MS = 16;

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
function sfxShot(_p, sr) {
  const ping = osc({ type: 'sine', freq: 760, freqEnd: 1020, dur: 0.08, sr, gain: 0.3, attack: 0.003, release: 0.04 });
  const clk = noise({ dur: 0.03, sr, gain: 0.12, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.01 });
  return mix(ping, clk);
}

function sfxPin(p, sr) {
  const ring = p.ring ?? 1;
  const f = 520 * Math.pow(2, (ring - 1) / 12);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 1.6, dur: 0.14, sr, gain: 0.4, attack: 0.004, release: 0.07 });
  const spark = osc({ type: 'sine', freq: f * 2, freqEnd: f * 2.5, dur: 0.08, sr, gain: 0.12, attack: 0.003, release: 0.04 });
  return mix(tone, spark);
}

function sfxHeavyPin(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 120, freqEnd: 70, dur: 0.24, sr, gain: 0.5, attack: 0.004, release: 0.1 });
  const nz = noise({ dur: 0.16, sr, gain: 0.25, filter: 'lowpass', cutoff: 260, attack: 0.003, release: 0.08 });
  return mix(thud, nz);
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1150, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}

function sfxRingClear(_p, sr) {
  const chord = notes({ freqs: [220, 277.18, 329.63, 440], dur: 0.6, gap: 0.05, type: 'triangle', gain: 0.16, attack: 0.02, release: 0.3, sr });
  const sweep = noise({ dur: 0.5, sr, gain: 0.18, filter: 'bandpass', cutoff: 900, attack: 0.01, release: 0.25 });
  return mix(chord, sweep);
}

function sfxSceneEnter(_p, sr) {
  return notes({ freqs: [196, 246.94, 293.66, 392], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.15, attack: 0.06, release: 0.18, sr });
}

function sfxPolarityReversal(_p, sr) {
  const zap = osc({ type: 'sawtooth', freq: 200, freqEnd: 900, dur: 0.22, sr, gain: 0.22, attack: 0.004, release: 0.1 });
  const nz = noise({ dur: 0.18, sr, gain: 0.2, filter: 'bandpass', cutoff: 1400, attack: 0.003, release: 0.09 });
  return mix(zap, nz);
}

function sfxPhotonSuck(_p, sr) {
  return osc({ type: 'sine', freq: 700, freqEnd: 200, dur: 0.2, sr, gain: 0.24, attack: 0.005, release: 0.09 });
}

function sfxUpgradeChosen(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.26, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.26, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

function sfxOverloadReady(_p, sr) {
  const a = osc({ type: 'square', freq: 660, dur: 0.09, sr, gain: 0.16, attack: 0.003, release: 0.05 });
  const b = osc({ type: 'square', freq: 660, dur: 0.09, sr, gain: 0.16, attack: 0.003, release: 0.05 });
  const out = new Float32Array(Math.round(0.24 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.12 * sr));
  return out;
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 52, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.5, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.2, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const clk = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, clk);
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxPulse(_p, sr) {
  return osc({ type: 'sine', freq: 300, freqEnd: 340, dur: 0.1, sr, gain: 0.06, attack: 0.03, release: 0.06 });
}

const SYNTH = {
  shot: sfxShot,
  pin: sfxPin,
  heavyPin: sfxHeavyPin,
  nearMiss: sfxNearMiss,
  ringClear: sfxRingClear,
  sceneEnter: sfxSceneEnter,
  polarityReversal: sfxPolarityReversal,
  photonSuck: sfxPhotonSuck,
  upgradeChosen: sfxUpgradeChosen,
  overloadReady: sfxOverloadReady,
  death: sfxDeath,
  win: sfxWin,
  ui: sfxUi,
  milestone: sfxMilestone,
  pulse: sfxPulse,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 循环层（程序化，4s 无缝）
// ---------------------------------------------------------------------------
function loopMain(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // 低音垫：A 小调根音 + 五度 + 八度，0.25Hz 呼吸 LFO（1 周期）
  const freqs = [110, 165, 220, 330];
  const gains = [0.10, 0.06, 0.05, 0.04];
  for (let k = 0; k < freqs.length; k += 1) {
    const f = freqs[k];
    let phase = 0;
    for (let i = 0; i < n; i += 1) {
      const t = i / sr;
      phase += (2 * Math.PI * f) / sr;
      const breath = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.25 * t);
      out[i] += Math.sin(phase) * gains[k] * breath;
    }
  }
  // 琶音层
  const arp = [220, 261.63, 329.63, 440, 329.63, 261.63];
  for (let step = 0; step < 8; step += 1) {
    const f = arp[step % arp.length];
    const s = osc({ type: 'triangle', freq: f, dur: 0.5, sr, gain: 0.05, attack: 0.05, release: 0.2 });
    addAt(out, s, Math.round(step * 0.5 * sr));
  }
  return normalizePeak(out, 0.9);
}

function loopTense(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // 脉冲低音
  for (let step = 0; step < 8; step += 1) {
    const s = osc({ type: 'square', freq: 82.41, dur: 0.3, sr, gain: 0.09, attack: 0.005, release: 0.15 });
    addAt(out, s, Math.round(step * 0.5 * sr));
  }
  // 快速琶音
  const arp = [329.63, 392, 440, 523.25, 440, 392];
  for (let step = 0; step < 16; step += 1) {
    const f = arp[step % arp.length];
    const s = osc({ type: 'triangle', freq: f, dur: 0.25, sr, gain: 0.05, attack: 0.03, release: 0.12 });
    addAt(out, s, Math.round(step * 0.25 * sr));
  }
  return normalizePeak(out, 0.9);
}

function normalizePeak(input, target) {
  let peak = 0;
  for (let i = 0; i < input.length; i += 1) peak = Math.max(peak, Math.abs(input[i]));
  if (peak > 1e-6) {
    const k = target / peak;
    for (let i = 0; i < input.length; i += 1) input[i] *= k;
  }
  return input;
}

const LOOPS = {
  main: loopMain,
  tense: loopTense,
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

// 事件 → 音效映射（sim 事件名 = 音效名，直接同名）
const EVENT_SFX = {
  shot: 'shot',
  pin: 'pin',
  heavyPin: 'heavyPin',
  nearMiss: 'nearMiss',
  ringClear: 'ringClear',
  sceneEnter: 'sceneEnter',
  polarityReversal: 'polarityReversal',
  photonSuck: 'photonSuck',
  upgradeChosen: 'upgradeChosen',
  overloadReady: 'overloadReady',
  death: 'death',
  win: 'win',
  ui: 'ui',
  milestone: 'milestone',
  pulse: 'pulse',
};

const SFX_PRIORITY = {
  ringClear: 6, death: 6, win: 6,
  heavyPin: 5, polarityReversal: 5, photonSuck: 5, overloadReady: 4,
  pin: 4, shot: 3, nearMiss: 3, sceneEnter: 4, upgradeChosen: 3,
  milestone: 2, pulse: 1, ui: 1,
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
    bgmMode: null,
    bgmSource: null,
    active: new Map(),
    lastPlay: new Map(),
    voiceSeq: 0,
  };

  function ensureCtx() {
    if (state.ctx) return state.ctx;
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
    return state.ctx;
  }

  function resumeIfNeeded() {
    const c = state.ctx;
    if (c && c.state === 'suspended' && typeof c.resume === 'function') c.resume().catch(() => {});
  }

  function pruneActive(now) {
    for (const [k, v] of state.active) if (v.endTime <= now) state.active.delete(k);
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
      for (const [k, v] of state.active) if (v.priority < minPrio) { minPrio = v.priority; minKey = k; }
      if (minKey == null || priority <= minPrio) return;
      try { state.active.get(minKey).stop(now); } catch { /* noop */ }
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
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch { /* noop */ } state.bgmSource = null; }
  }

  function playBgm(mode) {
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
    state.bgmMode = null;
    stopBgmSource();
  }

  function unlock() {
    ensureCtx();
    resumeIfNeeded();
  }

  function event(type, payload = {}) {
    const name = EVENT_SFX[type];
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

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
