// src/core/audio.js — PLUMBER RUN · 音效/BGM 程序化合成（WebAudio 标准 API，零依赖零外链）
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络 → PCM；
//     三套 BGM 循环（晨市/下水道/夜工厂）= 低音 + 琶音 + 垫音分层，整数周期无缝循环。
//     这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer 播放；BGM 用 loop 的 AudioBufferSourceNode 长循环。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(theme), stopBgm() }
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 16;
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
  let xPrev = 0;
  let yPrev = 0;
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

// ---------------------------------------------------------------------------
// 音效合成器（(payload, sr) => Float32Array）
// ---------------------------------------------------------------------------
const SYNTH = {
  jump(p, sr) { return osc({ type: 'square', freq: 280, freqEnd: 520, dur: 0.16, sr, gain: 0.24, attack: 0.004, release: 0.06 }); },
  stomp(p, sr) { return mix(osc({ type: 'triangle', freq: 200, freqEnd: 70, dur: 0.16, sr, gain: 0.4, attack: 0.003, release: 0.08 }), noise({ dur: 0.08, sr, gain: 0.2, filter: 'lowpass', cutoff: 600 })); },
  coin(p, sr) { return notes({ freqs: [988, 1319], dur: 0.12, gap: 0.06, type: 'square', gain: 0.22, sr }); },
  powerUp(p, sr) { return notes({ freqs: [392, 523, 659, 784], dur: 0.16, gap: 0.08, type: 'triangle', gain: 0.2, sr }); },
  wrenchThrow(p, sr) { return noise({ dur: 0.28, sr, gain: 0.3, filter: 'bandpass', cutoff: 1800, attack: 0.02, release: 0.14 }); },
  wrenchHit(p, sr) { return mix(osc({ type: 'square', freq: 620, freqEnd: 180, dur: 0.12, sr, gain: 0.3, attack: 0.003, release: 0.06 }), noise({ dur: 0.06, sr, gain: 0.18, filter: 'highpass', cutoff: 1500 })); },
  bump(p, sr) { return osc({ type: 'triangle', freq: 140, freqEnd: 90, dur: 0.09, sr, gain: 0.32, attack: 0.003, release: 0.04 }); },
  brickBreak(p, sr) { return noise({ dur: 0.24, sr, gain: 0.32, filter: 'lowpass', cutoff: 700, attack: 0.002, release: 0.14 }); },
  steamGain(p, sr) { return noise({ dur: 0.2, sr, gain: 0.22, filter: 'highpass', cutoff: 1200, attack: 0.02, release: 0.1 }); },
  steamBurst(p, sr) { return noise({ dur: 0.5, sr, gain: 0.34, filter: 'bandpass', cutoff: 900, attack: 0.04, release: 0.24 }); },
  hit(p, sr) { return mix(osc({ type: 'sawtooth', freq: 320, freqEnd: 120, dur: 0.22, sr, gain: 0.28, attack: 0.003, release: 0.1 }), noise({ dur: 0.12, sr, gain: 0.16, filter: 'lowpass', cutoff: 800 })); },
  death(p, sr) { return mix(osc({ type: 'triangle', freq: 520, freqEnd: 60, dur: 0.9, sr, gain: 0.36, attack: 0.01, release: 0.3 }), noise({ dur: 0.6, sr, gain: 0.2, filter: 'lowpass', cutoff: 600 })); },
  levelClear(p, sr) { return notes({ freqs: [523, 659, 784, 1047], dur: 0.32, gap: 0.11, type: 'triangle', gain: 0.22, sr }); },
  win(p, sr) { return notes({ freqs: [392, 523, 659, 784, 1047], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, sr }); },
  milestone(p, sr) { return osc({ type: 'sine', freq: 720, freqEnd: 900, dur: 0.05, sr, gain: 0.1, attack: 0.003, release: 0.03 }); },
  ui(p, sr) { return mix(osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 }), noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000 })); },
  newRecord(p, sr) { return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, sr }); },
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 循环层（分层 + 无缝循环）
// ---------------------------------------------------------------------------
const BGM_THEMES = {
  morning: { bass: [110, 110, 130.81, 98], arp: [220, 261.63, 329.63, 392], pad: 220, tempo: 0.42 },
  sewer: { bass: [82.41, 82.41, 98, 73.42], arp: [164.81, 196, 246.94, 293.66], pad: 164.81, tempo: 0.5 },
  factory: { bass: [98, 98, 110, 87.31], arp: [196, 233.08, 293.66, 349.23], pad: 196, tempo: 0.36 },
};

function synthBgm(themeKey, sr) {
  const cfg = BGM_THEMES[themeKey] || BGM_THEMES.morning;
  const beat = Math.round(cfg.tempo * sr);
  const total = beat * cfg.bass.length;
  const out = new Float32Array(total);
  for (let i = 0; i < cfg.bass.length; i += 1) {
    // 低音：整拍正弦长音
    const b = osc({ type: 'triangle', freq: cfg.bass[i], dur: cfg.tempo * 0.9, sr, gain: 0.16, attack: 0.02, release: 0.12 });
    addAt(out, b, i * beat);
    // 琶音：短促方波点缀
    const a = osc({ type: 'square', freq: cfg.arp[i], dur: cfg.tempo * 0.4, sr, gain: 0.06, attack: 0.005, release: 0.1 });
    addAt(out, a, i * beat);
  }
  // 垫音：全曲低增益三角波，首尾用正弦整数周期保证无缝
  const pad = new Float32Array(total);
  const cycles = Math.round((cfg.pad * total) / sr);
  for (let i = 0; i < total; i += 1) pad[i] = 0.05 * Math.sin(2 * Math.PI * cycles * i / total);
  for (let i = 0; i < total; i += 1) out[i] += pad[i];
  return out;
}

const LOOPS = {
  bgmMorning: (sr) => synthBgm('morning', sr),
  bgmSewer: (sr) => synthBgm('sewer', sr),
  bgmFactory: (sr) => synthBgm('factory', sr),
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
const EVENT_TO_SFX = {
  jump: 'jump',
  stomp: 'stomp',
  coin: 'coin',
  powerUp: 'powerUp',
  wrenchThrow: 'wrenchThrow',
  wrenchHit: 'wrenchHit',
  bump: 'bump',
  brickBreak: 'brickBreak',
  steamGain: 'steamGain',
  steamBurst: 'steamBurst',
  hit: 'hit',
  death: 'death',
  levelClear: 'levelClear',
  win: 'win',
  milestone: 'milestone',
  ui: 'ui',
  newRecord: 'newRecord',
};

const THEME_TO_BGM = { 1: 'bgmMorning', 2: 'bgmSewer', 3: 'bgmFactory' };

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    bgmSource: null,
    active: new Map(),
    lastPlay: new Map(),
    voiceSeq: 0,
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
    state.sfxBus = state.ctx.createGain();
    state.sfxBus.gain.value = 1;
    state.sfxBus.connect(state.master);
    state.bgmBus = state.ctx.createGain();
    state.bgmBus.gain.value = 0.8;
    state.bgmBus.connect(state.master);
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
      let minKey = null; let minPrio = Infinity;
      for (const [k, v] of state.active) if (v.priority < minPrio) { minPrio = v.priority; minKey = k; }
      if (minKey != null) { try { state.active.get(minKey).stop(now); } catch {} state.active.delete(minKey); }
    }

    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.sfxBus);
    src.start(now);
    state.active.set(`v${state.voiceSeq++}`, {
      priority: name === 'death' || name === 'win' ? 5 : 1,
      endTime: now + pcm.length / ctx.sampleRate,
      stop: (t) => { try { src.stop(t); } catch {} },
    });
  }

  function unlock() {
    ensureCtx();
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

  function playBgm(theme) {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgm();
    const name = THEME_TO_BGM[theme] || 'bgmMorning';
    const pcm = synthLoop(name, ctx.sampleRate);
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
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch {} state.bgmSource = null; }
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
