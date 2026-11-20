// src/core/audio.js — STACK SKY · M4 音效与 BGM 合成（WebAudio 标准 API，零依赖零外链）
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效/循环层 = 振荡器 + 噪声 + 包络，
//     直接算成 mono Float32Array PCM，tools/audio-check.mjs 能在 Node 离线渲染校验 RMS/峰值。
//  2) 浏览器播放层：PCM 灌 AudioBuffer → AudioBufferSourceNode → GainNode → destination；
//     BGM 用 3 个场景循环层（晨曦/雷雨/星夜）无缝 loop。
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 2;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.25;

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
// 各音效合成器（均为 (payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

function sfxDrop(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 190, freqEnd: 120, dur: 0.09, sr, gain: 0.4, attack: 0.004, release: 0.05 });
  const click = noise({ dur: 0.04, sr, gain: 0.14, filter: 'lowpass', cutoff: 900, attack: 0.001, release: 0.02 });
  return mix(thud, click);
}

function sfxCut(_p, sr) {
  const slice = noise({ dur: 0.12, sr, gain: 0.32, filter: 'bandpass', cutoff: 1500, attack: 0.002, release: 0.06 });
  const tone = osc({ type: 'sine', freq: 720, freqEnd: 380, dur: 0.1, sr, gain: 0.12, attack: 0.003, release: 0.05 });
  return mix(slice, tone);
}

function sfxPerfect(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, freqEnd: 1174, dur: 0.16, sr, gain: 0.3, attack: 0.004, release: 0.08 });
  const b = osc({ type: 'sine', freq: 1318, freqEnd: 1568, dur: 0.16, sr, gain: 0.18, attack: 0.004, release: 0.08 });
  return mix(a, b);
}

function sfxComboUp(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 660 * Math.pow(2, combo / 12);
  const a = osc({ type: 'sine', freq: f, freqEnd: f * 1.3, dur: 0.08, sr, gain: 0.2, attack: 0.003, release: 0.04 });
  const b = osc({ type: 'sine', freq: f * 1.5, freqEnd: f * 1.9, dur: 0.08, sr, gain: 0.16, attack: 0.003, release: 0.04 });
  const out = new Float32Array(Math.round(0.16 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.06 * sr));
  return out;
}

function sfxCloudWrap(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.5, gap: 0.1, type: 'triangle', gain: 0.18, attack: 0.02, release: 0.2, sr });
}

function sfxWindGust(_p, sr) {
  return noise({ dur: 0.7, sr, gain: 0.4, filter: 'bandpass', cutoff: 900, attack: 0.12, release: 0.3 });
}

function sfxShrineReady(_p, sr) {
  return osc({ type: 'sine', freq: 587.33, dur: 0.5, sr, gain: 0.2, attack: 0.02, release: 0.2 });
}

function sfxShrineSuccess(_p, sr) {
  const bell = notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.6, gap: 0.09, type: 'triangle', gain: 0.18, attack: 0.01, release: 0.25, sr });
  const chime = osc({ type: 'sine', freq: 1046.5, dur: 0.7, sr, gain: 0.1, attack: 0.01, release: 0.3 });
  return mix(bell, chime);
}

function sfxSegmentEnter(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 440], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.15, attack: 0.06, release: 0.18, sr });
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  drop: sfxDrop,
  cut: sfxCut,
  perfect: sfxPerfect,
  comboUp: sfxComboUp,
  cloudWrap: sfxCloudWrap,
  windGust: sfxWindGust,
  shrineReady: sfxShrineReady,
  shrineSuccess: sfxShrineSuccess,
  segmentEnter: sfxSegmentEnter,
  death: sfxDeath,
  milestone: sfxMilestone,
  nearMiss: sfxNearMiss,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（BGM：晨曦/雷雨/星夜，各一个可无缝 loop 的分层 pad）
// ---------------------------------------------------------------------------

function loopPad(sr, { freqs, gain = 0.05, dur = 4, type = 'triangle' }) {
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  for (const f of freqs) {
    for (const det of [0.997, 1.003]) {
      let phase = 0;
      for (let i = 0; i < n; i += 1) {
        const t = i / sr;
        const lfo = 0.72 + 0.28 * Math.sin(2 * Math.PI * (1 / dur) * t); // 1 周期 / dur，首尾连续
        phase += (2 * Math.PI * f * det) / sr;
        out[i] += oscSample(type, phase) * gain * lfo;
      }
    }
  }
  return normalizeRms(out, 0.16);
}

function loopDawn(sr) {
  return loopPad(sr, { freqs: [220, 277.18, 329.63, 440], gain: 0.055 });
}

function loopStorm(sr) {
  return loopPad(sr, { freqs: [146.83, 174.61, 220, 293.66], gain: 0.06, type: 'sawtooth' });
}

function loopNight(sr) {
  return loopPad(sr, { freqs: [164.81, 196, 246.94, 329.63], gain: 0.06 });
}

const LOOPS = {
  dawn: loopDawn,
  storm: loopStorm,
  night: loopNight,
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

const SFX_PRIORITY = {
  shrineSuccess: 6, cloudWrap: 6, perfect: 6,
  death: 5, shrineReady: 5,
  cut: 4, segmentEnter: 4, windGust: 4, newRecord: 4,
  drop: 3, comboUp: 3,
  chime: 2, milestone: 2, nearMiss: 2,
  ui: 1,
};

const EVENT_TO_SFX = {
  drop: 'drop',
  cut: 'cut',
  perfect: 'perfect',
  comboUp: 'comboUp',
  cloudWrap: 'cloudWrap',
  windGust: 'windGust',
  shrineReady: 'shrineReady',
  shrineSuccess: 'shrineSuccess',
  segmentEnter: 'segmentEnter',
  sceneEnter: 'segmentEnter',
  death: 'death',
  milestone: 'milestone',
  nearMiss: 'nearMiss',
  ui: 'ui',
  newRecord: 'newRecord',
  tutorialDone: 'chime',
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
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    bgmSource: null,
    bgmMode: null,
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
    state.bgmBus.gain.value = 0.5;
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

  function playBgm(mode) {
    const ctx = ensureCtx();
    if (!ctx || state.bgmMode === mode) return;
    stopBgmSource();
    state.bgmMode = mode;
    if (!LOOPS[mode]) return;
    const pcm = synthLoop(mode, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.loop = true;
    node.connect(state.bgmBus);
    node.start();
    state.bgmSource = node;
  }

  function stopBgm() {
    stopBgmSource();
    state.bgmMode = null;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
