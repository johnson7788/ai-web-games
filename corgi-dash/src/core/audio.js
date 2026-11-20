// src/core/audio.js — CORGI DASH · 程序化 WebAudio（零依赖零外链，无音频文件）
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。BGM 也是程序化合成（分层 pad + 琶音，量化到整数周期 → 无缝循环）。
//     这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer 播放；BGM 用 loop 的 AudioBufferSourceNode 长循环。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }
// 事件名与 sim 事件表一致：jump / land / sheepGain / sheepLose / whistle / perfectLand / sheepSurge /
//   sheepScatter / obstacleHit / death / segmentEnter / milestone / nearMiss，
// 外加 UI 侧 ui、newRecord。

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

function normalizePeak(input, target) {
  let peak = 0;
  for (let i = 0; i < input.length; i += 1) peak = Math.max(peak, Math.abs(input[i]));
  if (peak > 1e-6) {
    const k = target / peak;
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
// 音效合成器（(payload, sr) => Float32Array）
// ---------------------------------------------------------------------------
function sfxJump(_p, sr) {
  return osc({ type: 'triangle', freq: 380, freqEnd: 620, dur: 0.14, sr, gain: 0.35, attack: 0.004, release: 0.07 });
}
function sfxLand(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 90, dur: 0.07, sr, gain: 0.3, attack: 0.003, release: 0.03 });
  const dust = noise({ dur: 0.04, sr, gain: 0.1, filter: 'lowpass', cutoff: 800, attack: 0.001, release: 0.02 });
  return mix(thud, dust);
}
function sfxSheepGain(p, sr) {
  const flock = clamp(p.flock ?? 1, 1, 30);
  const f = 620 * Math.pow(2, Math.min(flock, 12) / 12);
  return osc({ type: 'sine', freq: f, freqEnd: f * 1.5, dur: 0.12, sr, gain: 0.32, attack: 0.004, release: 0.06 });
}
function sfxSheepLose(p, sr) {
  const glide = osc({ type: 'sine', freq: 620, freqEnd: 240, dur: 0.18, sr, gain: 0.3, attack: 0.004, release: 0.08 });
  const bleat = osc({ type: 'triangle', freq: 520, freqEnd: 400, dur: 0.14, sr, gain: 0.18, attack: 0.01, release: 0.07 });
  return mix(glide, bleat);
}
function sfxWhistle(_p, sr) {
  const w1 = osc({ type: 'sine', freq: 1500, freqEnd: 1900, dur: 0.16, sr, gain: 0.28, attack: 0.01, release: 0.08 });
  const w2 = osc({ type: 'sine', freq: 1900, freqEnd: 1500, dur: 0.18, sr, gain: 0.2, attack: 0.01, release: 0.09 });
  return mix(w1, w2);
}
function sfxPerfect(_p, sr) {
  return notes({ freqs: [880, 1318.5], dur: 0.18, gap: 0.06, type: 'triangle', gain: 0.24, attack: 0.005, release: 0.1, sr });
}
function sfxSurge(_p, sr) {
  const chord = notes({ freqs: [523.25, 659.25, 783.99], dur: 0.5, gap: 0, type: 'triangle', gain: 0.16, attack: 0.02, release: 0.22, sr });
  const sweep = noise({ dur: 0.4, sr, gain: 0.2, filter: 'bandpass', cutoff: 1600, attack: 0.03, release: 0.2 });
  return mix(chord, sweep);
}
function sfxSheepScatter(_p, sr) {
  return noise({ dur: 0.28, sr, gain: 0.3, filter: 'bandpass', cutoff: 900, attack: 0.02, release: 0.16 });
}
function sfxHit(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 120, freqEnd: 60, dur: 0.2, sr, gain: 0.4, attack: 0.003, release: 0.1 });
  const nz = noise({ dur: 0.16, sr, gain: 0.26, filter: 'lowpass', cutoff: 500, attack: 0.002, release: 0.09 });
  return mix(thud, nz);
}
function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 560, freqEnd: 60, dur: 0.9, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}
function sfxSegment(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.15, attack: 0.04, release: 0.14, sr });
}
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.05, sr, gain: 0.1, attack: 0.003, release: 0.025 });
}
function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1200, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}
function sfxUi(_p, sr) {
  return osc({ type: 'sine', freq: 900, freqEnd: 720, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 });
}
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.38, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.15, sr });
}

const SYNTH = {
  jump: sfxJump,
  land: sfxLand,
  sheepGain: sfxSheepGain,
  sheepLose: sfxSheepLose,
  whistle: sfxWhistle,
  perfect: sfxPerfect,
  surge: sfxSurge,
  sheepScatter: sfxSheepScatter,
  hit: sfxHit,
  death: sfxDeath,
  segment: sfxSegment,
  milestone: sfxMilestone,
  nearMiss: sfxNearMiss,
  ui: sfxUi,
  newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（BGM / 环境风声）—— 程序化合成，整数周期 → 无缝循环
// ---------------------------------------------------------------------------
const BGM_LOOP_SEC = 8;

function synthBgm(sr = SAMPLE_RATE) {
  const L = BGM_LOOP_SEC;
  const n = Math.max(1, Math.round(L * sr));
  const out = new Float32Array(n);
  const q = (f) => Math.round(f * L) / L; // 量化到整数周期

  // 分层 pad：A 大调低中高三音 + 低音，慢 LFO（整数周期）
  const pads = [
    [220.00, 0.085, 'triangle', 0.25, 0.28],
    [277.18, 0.055, 'sine', 0.50, 0.20],
    [329.63, 0.060, 'triangle', 0.25, 0.26],
    [110.00, 0.045, 'sine', 0, 0],
  ];
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    for (const [f, g, type, tr, dep] of pads) {
      const trem = dep > 0 ? (1 - dep + dep * Math.sin(2 * Math.PI * tr * t)) : 1;
      out[i] += g * trem * oscSample(type, 2 * Math.PI * q(f) * t);
    }
  }

  // 琶音旋律（每 1s 一个音，8 音循环回主音）
  const seq = [220.00, 329.63, 277.18, 440.00, 329.63, 277.18, 220.00, 246.94];
  seq.forEach((f, k) => {
    const note = osc({ type: 'sine', freq: q(f), dur: 0.85, sr, gain: 0.09, attack: 0.02, release: 0.4 });
    addAt(out, note, Math.round(k * 1.0 * sr));
  });

  return normalizePeak(out, 0.7);
}

function synthAmbient(sr = SAMPLE_RATE) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 380, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

const LOOPS = {
  bgm: synthBgm,
  ambient: synthAmbient,
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

// ---------------------------------------------------------------------------
// 事件名 → 音效
// ---------------------------------------------------------------------------
const EVENT_TO_SFX = {
  jump: 'jump',
  land: 'land',
  sheepGain: 'sheepGain',
  sheepLose: 'sheepLose',
  whistle: 'whistle',
  perfectLand: 'perfect',
  sheepSurge: 'surge',
  sheepScatter: 'sheepScatter',
  obstacleHit: 'hit',
  death: 'death',
  segmentEnter: 'segment',
  milestone: 'milestone',
  nearMiss: 'nearMiss',
  ui: 'ui',
  newRecord: 'newRecord',
};

const SFX_PRIORITY = {
  surge: 6, sheepGain: 6, perfect: 6,
  death: 5, whistle: 5, segment: 4, newRecord: 4,
  hit: 3, sheepLose: 3, sheepScatter: 3,
  jump: 2, land: 2,
  nearMiss: 1, milestone: 1, ui: 1,
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
    ambientSource: null,
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
    state.active.set(key, {
      name, priority,
      endTime: now + pcm.length / ctx.sampleRate,
      stop: (t) => { try { src.stop(t); } catch { /* noop */ } },
    });
  }

  function startLoopPcm(pcm, bus) {
    const ctx = ensureCtx();
    if (!ctx) return null;
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = 1;
    src.connect(g);
    g.connect(bus);
    src.start();
    return { src, g };
  }

  function stopSource(ref) {
    if (!ref) return;
    try { ref.src.stop(); } catch { /* noop */ }
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      resumeIfNeeded();
      state.unlocked = true;
      if (!state.ambientSource) state.ambientSource = startLoopPcm(synthAmbient(ctx.sampleRate), state.sfxBus);
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

  function playBgm() {
    const ctx = ensureCtx();
    if (!ctx || state.bgmSource) return;
    state.bgmSource = startLoopPcm(synthBgm(ctx.sampleRate), state.bgmBus);
  }

  function stopBgm() {
    stopSource(state.bgmSource);
    state.bgmSource = null;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
