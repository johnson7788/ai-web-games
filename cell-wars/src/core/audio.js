// src/core/audio.js — CELL WARS · M4 音效合成与播放（WebAudio 标准 API，零依赖零外链零音频文件）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     BGM 用程序化合成（培养皿环境 pad + 琶音），无缝 loop。
//
// 契约（docs/report.md 事件表）：
//   createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(kind), stopBgm() }
// 事件名与 sim 事件表一致：infect / capture / blocked / nutrient / phage / phageReady / turn /
//   dishClear / dishStart / virus / gameOver / victory / bigChain，
//   外加 UI 侧 ui（按钮点击）、newRecord（新纪录 fanfare）、chime（教学完成）。

import Sdk from './sdk.js';

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 2;      // 同时叠层的一发式音效上限（大爆发/占领优先保）
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.25;    // 噪声滤波后统一归一到的 RMS

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

// 感染点击：短促上扬 blip。
function sfxInfect(_p, sr) {
  const blip = osc({ type: 'sine', freq: 520, freqEnd: 760, dur: 0.09, sr, gain: 0.32, attack: 0.003, release: 0.05 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.01 });
  return mix(blip, click);
}

// 占领：水泡 pop，chain 越大越亮。
function sfxCapture(p, sr) {
  const chain = clamp(p.chain ?? 0, 0, 12);
  const f = 420 * Math.pow(2, chain / 12);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 1.5, dur: 0.13, sr, gain: 0.34, attack: 0.004, release: 0.06 });
  const pop = noise({ dur: 0.05, sr, gain: 0.2, filter: 'lowpass', cutoff: f * 3, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

// 大爆发（签名光丝蔓延）：上扬琶音 + 亮噪声。
function sfxBigChain(_p, sr) {
  const arp = notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.34, gap: 0.07, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.14, sr });
  const shimmer = noise({ dur: 0.4, sr, gain: 0.1, filter: 'highpass', cutoff: 2400, attack: 0.03, release: 0.2 });
  return mix(arp, shimmer);
}

// 感染失败：低沉闷响（被防御挡住）。
function sfxBlocked(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 90, dur: 0.14, sr, gain: 0.3, attack: 0.004, release: 0.07 });
  const nz = noise({ dur: 0.1, sr, gain: 0.16, filter: 'lowpass', cutoff: 220, attack: 0.003, release: 0.05 });
  return mix(thud, nz);
}

// 营养滴：水滴下坠。
function sfxNutrient(_p, sr) {
  const drop = osc({ type: 'sine', freq: 880, freqEnd: 330, dur: 0.18, sr, gain: 0.3, attack: 0.004, release: 0.08 });
  const spl = noise({ dur: 0.06, sr, gain: 0.12, filter: 'bandpass', cutoff: 900, attack: 0.002, release: 0.04 });
  return mix(drop, spl);
}

// 噬菌体：横扫 whoosh + 低频轰。
function sfxPhage(_p, sr) {
  const whoosh = noise({ dur: 0.32, sr, gain: 0.3, filter: 'bandpass', cutoff: 1200, attack: 0.03, release: 0.16 });
  const boom = osc({ type: 'triangle', freq: 90, freqEnd: 44, dur: 0.3, sr, gain: 0.34, attack: 0.005, release: 0.15 });
  return mix(whoosh, boom);
}

// 噬菌体充能就绪：轻 chime。
function sfxPhageReady(_p, sr) {
  return notes({ freqs: [659.25, 783.99], dur: 0.18, gap: 0.1, type: 'sine', gain: 0.2, attack: 0.01, release: 0.1, sr });
}

// 回合切换：极短 tick。
function sfxTurn(_p, sr) {
  return osc({ type: 'sine', freq: 700, freqEnd: 560, dur: 0.05, sr, gain: 0.14, attack: 0.002, release: 0.03 });
}

// 过关：上行小琶音。
function sfxDishClear(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.42, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.02, release: 0.16, sr });
}

// 新皿：低沉 pad 起音。
function sfxDishStart(_p, sr) {
  const pad = osc({ type: 'triangle', freq: 196, freqEnd: 220, dur: 0.5, sr, gain: 0.2, attack: 0.05, release: 0.2 });
  const nz = noise({ dur: 0.4, sr, gain: 0.1, filter: 'lowpass', cutoff: 400, attack: 0.04, release: 0.2 });
  return mix(pad, nz);
}

// 病毒风暴：扭曲下降。
function sfxVirus(_p, sr) {
  const glide = osc({ type: 'sawtooth', freq: 660, freqEnd: 120, dur: 0.35, sr, gain: 0.16, attack: 0.01, release: 0.12 });
  const nz = noise({ dur: 0.3, sr, gain: 0.14, filter: 'bandpass', cutoff: 700, attack: 0.02, release: 0.15 });
  return mix(glide, nz);
}

// 失败：下坠 gliss。
function sfxGameOver(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 480, freqEnd: 58, dur: 0.9, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

// 全通：大和弦 fanfare。
function sfxVictory(_p, sr) {
  const chord = notes({ freqs: [220, 261.63, 329.63, 440, 523.25], dur: 1.1, gap: 0, type: 'triangle', gain: 0.16, attack: 0.03, release: 0.4, sr });
  const crash = noise({ dur: 0.6, sr, gain: 0.12, filter: 'lowpass', cutoff: 1200, attack: 0.004, release: 0.3 });
  return mix(chord, crash);
}

// UI 按钮：短 ping。
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

// 新纪录：三音 fanfare。
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

// 教学完成：轻 chime。
function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  infect: sfxInfect,
  capture: sfxCapture,
  bigChain: sfxBigChain,
  blocked: sfxBlocked,
  nutrient: sfxNutrient,
  phage: sfxPhage,
  phageReady: sfxPhageReady,
  turn: sfxTurn,
  dishClear: sfxDishClear,
  dishStart: sfxDishStart,
  virus: sfxVirus,
  gameOver: sfxGameOver,
  victory: sfxVictory,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 程序化 BGM（培养皿环境：低通 pad + 慢琶音，整数周期无缝 loop）
// ---------------------------------------------------------------------------

function loopBgm(sr) {
  const dur = 8; // 8 秒一循环
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);

  // 底层 pad：A 小调三和弦（A2/C3/E3）慢呼吸
  const padFreqs = [110, 130.81, 164.81];
  const pad = new Float32Array(n);
  for (const f of padFreqs) {
    let phase = 0;
    for (let i = 0; i < n; i += 1) {
      phase += (2 * Math.PI * f) / sr;
      pad[i] += Math.sin(phase);
    }
  }
  normalizeRms(pad, 0.05);
  // 0.125Hz 慢 LFO（1 周期 / 8s，整数周期 → 无缝）
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    pad[i] *= 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.125 * t);
  }
  addAt(out, pad, 0);

  // 琶音层：A3-C4-E4-G4，每 2s 一组，共 4 组（整周期）
  const arp = [220, 261.63, 329.63, 392];
  for (let g = 0; g < 4; g += 1) {
    const start = Math.round(g * 2 * sr);
    for (let k = 0; k < arp.length; k += 1) {
      const s = osc({ type: 'triangle', freq: arp[k], dur: 0.5, sr, gain: 0.07, attack: 0.04, release: 0.3 });
      addAt(out, s, start + Math.round(k * 0.5 * sr));
    }
  }

  return normalizeRms(out, 0.16);
}

const LOOPS = {
  bgm: loopBgm,
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

// 叠层优先级：大爆发/占领最高。
const SFX_PRIORITY = {
  bigChain: 6, capture: 6,
  phage: 5, dishClear: 5, victory: 5,
  gameOver: 4, dishStart: 4, newRecord: 4, virus: 4,
  infect: 3, blocked: 3, nutrient: 3,
  phageReady: 2, chime: 2,
  turn: 1, ui: 1,
};

const EVENT_TO_SFX = {
  infect: 'infect',
  capture: 'capture',
  bigChain: 'bigChain',
  blocked: 'blocked',
  nutrient: 'nutrient',
  phage: 'phage',
  phageReady: 'phageReady',
  turn: 'turn',
  dishClear: 'dishClear',
  dishStart: 'dishStart',
  virus: 'virus',
  gameOver: 'gameOver',
  victory: 'victory',
  ui: 'ui',
  newRecord: 'newRecord',
  chime: 'chime',
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
    volume: clamp(Sdk.load('audioVolume', 0.7), 0, 1),
    muted: !!Sdk.load('audioMuted', false),
    unlocked: false,
    bgmSource: null,
    bgmKind: null,
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
    if (ctx) resumeIfNeeded();
  }

  function event(type, payload = {}) {
    if (!type) return;
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

  function playBgm(kind = 'bgm') {
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
    } catch { /* BGM 合成失败静默降级，不影响 SFX */ }
  }

  function stopBgm() {
    stopBgmSource();
    state.bgmKind = null;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
