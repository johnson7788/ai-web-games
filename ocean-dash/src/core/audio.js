// src/core/audio.js — OCEAN DASH · 程序化音效与 BGM（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放。
//     BGM 是程序化合成的分层循环 PCM（整数周期，无缝），不打包任何音频文件。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(kind), stopBgm() }

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.25;

// ---------------------------------------------------------------------------
// 采样级 DSP 原语
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
// 各音效合成器
// ---------------------------------------------------------------------------

function sfxBubbleGain(_p, sr) {
  const blip = osc({ type: 'sine', freq: 520, freqEnd: 940, dur: 0.14, sr, gain: 0.35, attack: 0.005, release: 0.06 });
  const spark = osc({ type: 'sine', freq: 1040, freqEnd: 1500, dur: 0.08, sr, gain: 0.12, attack: 0.004, release: 0.04 });
  return mix(blip, spark);
}

function sfxCurrentBoost(_p, sr) {
  const whoosh = noise({ dur: 0.4, sr, gain: 0.35, filter: 'bandpass', cutoff: 1200, attack: 0.05, release: 0.15 });
  const arp = notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.5, gap: 0.09, type: 'triangle', gain: 0.16, attack: 0.02, release: 0.18, sr });
  return mix(whoosh, arp);
}

function sfxGatherStart(_p, sr) {
  return noise({ dur: 0.12, sr, gain: 0.3, filter: 'bandpass', cutoff: 800, attack: 0.01, release: 0.05 });
}

function sfxGatherEnd(_p, sr) {
  return noise({ dur: 0.16, sr, gain: 0.24, filter: 'bandpass', cutoff: 1400, attack: 0.005, release: 0.08 });
}

function sfxJump(_p, sr) {
  return osc({ type: 'sine', freq: 300, freqEnd: 780, dur: 0.22, sr, gain: 0.3, attack: 0.01, release: 0.1 });
}

function sfxGlideStart(_p, sr) {
  return noise({ dur: 0.5, sr, gain: 0.32, filter: 'bandpass', cutoff: 1600, attack: 0.06, release: 0.2 });
}

function sfxGlideEnd(_p, sr) {
  const splash = noise({ dur: 0.18, sr, gain: 0.3, filter: 'lowpass', cutoff: 900, attack: 0.004, release: 0.08 });
  const drop = osc({ type: 'sine', freq: 500, freqEnd: 240, dur: 0.14, sr, gain: 0.18, attack: 0.004, release: 0.07 });
  return mix(splash, drop);
}

function sfxObstacleHit(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 80, dur: 0.16, sr, gain: 0.4, attack: 0.004, release: 0.08 });
  const nz = noise({ dur: 0.1, sr, gain: 0.2, filter: 'lowpass', cutoff: 300, attack: 0.002, release: 0.05 });
  return mix(thud, nz);
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1150, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 900, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxSegmentEnter(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25], dur: 0.45, gap: 0.1, type: 'triangle', gain: 0.16, attack: 0.05, release: 0.16, sr });
}

function sfxSegmentClear(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.5, gap: 0.11, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.18, sr });
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
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
  bubbleGain: sfxBubbleGain,
  currentBoost: sfxCurrentBoost,
  gatherStart: sfxGatherStart,
  gatherEnd: sfxGatherEnd,
  jump: sfxJump,
  glideStart: sfxGlideStart,
  glideEnd: sfxGlideEnd,
  obstacleHit: sfxObstacleHit,
  nearMiss: sfxNearMiss,
  milestone: sfxMilestone,
  segmentEnter: sfxSegmentEnter,
  segmentClear: sfxSegmentClear,
  death: sfxDeath,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

const EVENT_TO_SFX = {
  bubbleGain: 'bubbleGain',
  currentBoost: 'currentBoost',
  gatherStart: 'gatherStart',
  gatherEnd: 'gatherEnd',
  jump: 'jump',
  glideStart: 'glideStart',
  glideEnd: 'glideEnd',
  obstacleHit: 'obstacleHit',
  nearMiss: 'nearMiss',
  milestone: 'milestone',
  segmentEnter: 'segmentEnter',
  segmentClear: 'segmentClear',
  death: 'death',
  rank: 'ui',
  tutorialDone: 'chime',
  newRecord: 'newRecord',
  ui: 'ui',
};

// ---------------------------------------------------------------------------
// 程序化 BGM（分层 + 无缝循环）：把整段音乐直接算成整数周期 PCM
// ---------------------------------------------------------------------------

function bgmBar(kind, sr) {
  const dur = 4; // 4s 循环
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);

  // 分层 1：低音根音（sine，两小节交替根音，频率为整数周期保证无缝）
  const roots = kind === 'coral' ? [130.81, 164.81] : kind === 'trench' ? [110, 130.81] : [98, 130.81];
  const rootDur = dur / roots.length;
  roots.forEach((f, k) => {
    const seg = Math.round(rootDur * sr);
    const bass = osc({ type: 'sine', freq: f, freqEnd: f, dur: rootDur, sr, gain: 0.16, attack: 0.4, release: 0.4 });
    for (let i = 0; i < seg && i < bass.length; i += 1) out[k * seg + i] += bass[i];
  });

  // 分层 2：琶音（triangle，八分音符）
  const arps = kind === 'coral' ? [523.25, 659.25, 783.99, 1046.5]
    : kind === 'trench' ? [440, 523.25, 659.25, 880]
    : [392, 523.25, 587.33, 783.99];
  const step = 0.5;
  for (let k = 0; k < dur / step; k += 1) {
    const f = arps[k % arps.length];
    const tone = osc({ type: 'triangle', freq: f, freqEnd: f, dur: step * 0.9, sr, gain: 0.08, attack: 0.02, release: 0.1 });
    addAt(out, tone, Math.round(k * step * sr));
  }

  // 分层 3：环境水声（低通白噪，慢 LFO，整数周期）
  let amb = new Float32Array(n);
  for (let i = 0; i < n; i += 1) amb[i] = Math.random() * 2 - 1;
  amb = lowpass(amb, kind === 'coral' ? 520 : kind === 'trench' ? 380 : 460, sr);
  amb = normalizeRms(amb, 0.06);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    amb[i] *= 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  for (let i = 0; i < n; i += 1) out[i] += amb[i];

  return normalizePeak(out, 0.5);
}

const LOOPS = {
  water: (sr) => {
    const dur = 4;
    const n = Math.round(dur * sr);
    let buf = new Float32Array(n);
    for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
    buf = lowpass(buf, 380, sr);
    buf = normalizeRms(buf, NOISE_RMS);
    for (let i = 0; i < n; i += 1) buf[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.25 * (i / sr));
    return buf;
  },
  'bgm-coral': (sr) => bgmBar('coral', sr),
  'bgm-trench': (sr) => bgmBar('trench', sr),
  'bgm-mangrove': (sr) => bgmBar('mangrove', sr),
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
// 播放层
// ---------------------------------------------------------------------------

const SFX_PRIORITY = {
  currentBoost: 6, segmentClear: 6,
  obstacleHit: 5, death: 5,
  gatherStart: 4, gatherEnd: 4, glideStart: 4, glideEnd: 4, newRecord: 4,
  segmentEnter: 3, bubbleGain: 3, jump: 3,
  nearMiss: 1, milestone: 1, ui: 1, chime: 1,
};

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: 0.8,
    muted: false,
    unlocked: false,
    bgmSource: null,
    loops: { water: null },
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
    state.active.set(key, {
      name, priority,
      endTime: now + pcm.length / ctx.sampleRate,
      stop: (t) => { try { src.stop(t); } catch { /* noop */ } },
    });
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

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      resumeIfNeeded();
      state.unlocked = true;
      startLoop('water');
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

  function stopBgm() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
  }

  function playBgm(kind) {
    const ctx = ensureCtx();
    if (!ctx || !kind) { stopBgm(); return; }
    stopBgm();
    const name = `bgm-${kind}`;
    if (!LOOPS[name]) return;
    const pcm = synthLoop(name, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.loop = true;
    node.connect(state.bgmBus);
    node.start();
    state.bgmSource = node;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
