// src/core/audio.js — SKY DROP DODGE · 程序化音效与循环（WebAudio 标准 API，零依赖零外链）
//
// 两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效/循环 = 振荡器 + 噪声 + 包络 → PCM，
//     这样 tools/audio-check.mjs 能在 Node（无 WebAudio）离线校验 RMS/峰值/NaN。
//  2) 浏览器播放层：PCM → AudioBufferSourceNode → GainNode；循环层用 loop 无缝长循环。
//
// 契约：
//   createAudio() → { unlock(), event(type,payload), setMuted(b), setVolume(v), playBgm(kind), stopBgm() }
// 事件名与 sim 事件表一致：spawn / blockSmall / blockBig / umbrellaBreak / shieldRecharge / hit /
//   nearMiss / ripple / waveEnter / waveClear / death / win，外加 ui / newRecord / tutorialDone。
import { save } from './save.js';

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
// SFX 合成器（(payload, sr) => Float32Array）
// ---------------------------------------------------------------------------
function sfxSpawn(_p, sr) {
  return osc({ type: 'sine', freq: 880, freqEnd: 1180, dur: 0.06, sr, gain: 0.12, attack: 0.003, release: 0.03 });
}

function sfxBlockSmall(p, sr) {
  const thud = osc({ type: 'triangle', freq: 200, freqEnd: 130, dur: 0.08, sr, gain: 0.3, attack: 0.004, release: 0.04 });
  const pop = noise({ dur: 0.05, sr, gain: 0.2, filter: 'bandpass', cutoff: 900, attack: 0.002, release: 0.03 });
  return mix(thud, pop);
}

function sfxBlockBig(p, sr) {
  const thud = osc({ type: 'triangle', freq: 90, freqEnd: 46, dur: 0.26, sr, gain: 0.5, attack: 0.004, release: 0.12 });
  const nz = noise({ dur: 0.22, sr, gain: 0.34, filter: 'lowpass', cutoff: 220, attack: 0.003, release: 0.1 });
  return mix(thud, nz);
}

function sfxUmbrellaBreak(p, sr) {
  const crack = noise({ dur: 0.12, sr, gain: 0.4, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.06 });
  const low = osc({ type: 'sawtooth', freq: 120, freqEnd: 60, dur: 0.14, sr, gain: 0.2, attack: 0.003, release: 0.08 });
  return mix(crack, low);
}

function sfxShieldRecharge(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 760, dur: 0.12, sr, gain: 0.16, attack: 0.02, release: 0.06 });
}

function sfxHit(p, sr) {
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 70, dur: 0.16, sr, gain: 0.42, attack: 0.004, release: 0.08 });
  const nz = noise({ dur: 0.12, sr, gain: 0.3, filter: 'lowpass', cutoff: 420, attack: 0.003, release: 0.07 });
  return mix(thud, nz);
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1600, freqEnd: 1240, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}

function sfxRipple(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.32, gap: 0.07, type: 'sine', gain: 0.16, attack: 0.02, release: 0.16, sr });
}

function sfxWaveEnter(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 440], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.16, attack: 0.06, release: 0.18, sr });
}

function sfxWaveClear(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.08, sr, gain: 0.14, attack: 0.004, release: 0.04 });
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.42, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.18, sr });
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
  spawn: sfxSpawn,
  blockSmall: sfxBlockSmall,
  blockBig: sfxBlockBig,
  umbrellaBreak: sfxUmbrellaBreak,
  shieldRecharge: sfxShieldRecharge,
  hit: sfxHit,
  nearMiss: sfxNearMiss,
  ripple: sfxRipple,
  waveEnter: sfxWaveEnter,
  waveClear: sfxWaveClear,
  death: sfxDeath,
  win: sfxWin,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（无缝 loop 的 PCM）
// ---------------------------------------------------------------------------

// 城市天台氛围 BGM：低音垫 + 轻琶音，8s 整数周期可无缝循环。
function loopBgm(sr) {
  const dur = 8;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const chord = [110, 164.81, 220, 261.63];
  for (const f of chord) {
    const s = osc({ type: 'triangle', freq: f, dur, sr, gain: 0.06, attack: 1.5, release: 1.5 });
    addAt(out, s, 0);
  }
  // 轻琶音点缀
  const arp = [440, 523.25, 659.25, 783.99];
  for (let k = 0; k < 8; k += 1) {
    const s = osc({ type: 'sine', freq: arp[k % arp.length], dur: 0.4, sr, gain: 0.05, attack: 0.02, release: 0.2 });
    addAt(out, s, Math.round(k * 1.0 * sr));
  }
  return normalizeRms(out, 0.08);
}

// 风带气流：4s 带通白噪 + 0.25Hz 呼吸 LFO，无缝。
function loopWind(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = bandpass(buf, 900, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.03 * Math.sin(2 * Math.PI * 0.25 * t);
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

const SFX_PRIORITY = {
  umbrellaBreak: 6, blockBig: 6, win: 6, newRecord: 5,
  death: 4, ripple: 4, waveEnter: 4,
  hit: 3, blockSmall: 3, waveClear: 2, shieldRecharge: 2, chime: 2,
  spawn: 1, nearMiss: 1, ui: 1,
};

const EVENT_TO_SFX = {
  spawn: 'spawn',
  blockSmall: 'blockSmall',
  blockBig: 'blockBig',
  umbrellaBreak: 'umbrellaBreak',
  shieldRecharge: 'shieldRecharge',
  hit: 'hit',
  nearMiss: 'nearMiss',
  ripple: 'ripple',
  waveEnter: 'waveEnter',
  waveClear: 'waveClear',
  death: 'death',
  win: 'win',
  ui: 'ui',
  newRecord: 'newRecord',
  tutorialDone: 'chime',
};

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    unlocked: false,
    bgmSource: null,
    bgmKind: null,
    loops: { bgm: null, wind: null },
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
    state.bgmBus.gain.value = 0.8;
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
      name,
      priority,
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

  function playBgm(kind) {
    if (!kind || state.bgmKind === kind) return;
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
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
  }

  function stopBgm() {
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
