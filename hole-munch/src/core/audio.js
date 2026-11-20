// src/core/audio.js — HOLE MUNCH · 程序化音效合成与播放（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     BGM 与吸入环境声用 loop 的 AudioBufferSourceNode 长循环（分层无缝）。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }
// 事件名与 sim 事件表对齐：swallow / building / meteorRain / meteorGain / chain / chainEnd / kill /
//   death / nearMiss / matchEnd / upgrade / respawn / ui / tutorialDone / newRecord。

import Sdk from './sdk.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.25;    // 噪声滤波后统一归一 RMS

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
// 各音效合成器
// ---------------------------------------------------------------------------

function sfxSwallow(p, sr) {
  const n = clamp(p.n ?? 1, 1, 20);
  const f = 260 * Math.pow(1.06, n); // 连吞越多音越高
  const gulp = osc({ type: 'triangle', freq: f, freqEnd: f * 0.55, dur: 0.12, sr, gain: 0.4, attack: 0.004, release: 0.06 });
  const pop = noise({ dur: 0.05, sr, gain: 0.18, filter: 'lowpass', cutoff: f * 3, attack: 0.002, release: 0.02 });
  return mix(gulp, pop);
}

function sfxBuilding(p, sr) {
  const crash = noise({ dur: 0.5, sr, gain: 0.3, filter: 'lowpass', cutoff: 500, attack: 0.003, release: 0.24 });
  const rumble = osc({ type: 'triangle', freq: 70, freqEnd: 40, dur: 0.6, sr, gain: 0.5, attack: 0.01, release: 0.25 });
  const crack = noise({ dur: 0.12, sr, gain: 0.2, filter: 'bandpass', cutoff: 2000, attack: 0.001, release: 0.05 });
  return mix(crash, rumble, crack);
}

function sfxMeteorRain(_p, sr) {
  return noise({ dur: 0.6, sr, gain: 0.4, filter: 'bandpass', cutoff: 900, attack: 0.06, release: 0.2 });
}

function sfxMeteorGain(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 1300, dur: 0.16, sr, gain: 0.35, attack: 0.005, release: 0.08 });
}

function sfxChain(_p, sr) {
  return notes({ freqs: [330, 392, 494, 660], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.12, sr });
}

function sfxChainEnd(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 240, dur: 0.16, sr, gain: 0.18, attack: 0.005, release: 0.08 });
}

function sfxKill(_p, sr) {
  const chomp = osc({ type: 'triangle', freq: 130, freqEnd: 55, dur: 0.22, sr, gain: 0.5, attack: 0.004, release: 0.1 });
  const crunch = noise({ dur: 0.2, sr, gain: 0.3, filter: 'lowpass', cutoff: 700, attack: 0.002, release: 0.09 });
  return mix(chomp, crunch);
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 480, freqEnd: 52, dur: 0.8, sr, gain: 0.4, attack: 0.01, release: 0.2 });
  const nz = noise({ dur: 0.6, sr, gain: 0.22, filter: 'lowpass', cutoff: 650, attack: 0.02, release: 0.25 });
  return mix(glide, nz);
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1150, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxMatchEnd(_p, sr) {
  return notes({ freqs: [392, 494, 587, 784], dur: 0.5, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.02, release: 0.2, sr });
}

function sfxUpgrade(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.15, sr });
}

function sfxRespawn(_p, sr) {
  return osc({ type: 'sine', freq: 440, freqEnd: 700, dur: 0.2, sr, gain: 0.25, attack: 0.01, release: 0.1 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  swallow: sfxSwallow,
  building: sfxBuilding,
  meteorRain: sfxMeteorRain,
  meteorGain: sfxMeteorGain,
  chain: sfxChain,
  chainEnd: sfxChainEnd,
  kill: sfxKill,
  death: sfxDeath,
  nearMiss: sfxNearMiss,
  matchEnd: sfxMatchEnd,
  upgrade: sfxUpgrade,
  respawn: sfxRespawn,
  ui: sfxUi,
  chime: sfxChime,
  newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop 的 PCM）：BGM 三层 + 吸入环境声
// ---------------------------------------------------------------------------

// 生成「整周期正弦叠加」的音符：频率取 (sr/dur) 的整数倍，保证 dur 内正好整数个周期（无缝）。
function loopTone({ sr, dur, freqs, gains, type = 'sine', lfoHz = 0, lfoDepth = 0 }) {
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  for (let k = 0; k < freqs.length; k += 1) {
    const f0 = freqs[k] * (sr / dur);
    const cycles = Math.round(f0 * dur);
    const f = cycles / dur;
    for (let i = 0; i < n; i += 1) {
      const t = i / sr;
      out[i] += gains[k] * oscSample(type, 2 * Math.PI * f * t);
    }
  }
  if (lfoHz > 0) {
    for (let i = 0; i < n; i += 1) {
      const t = i / sr;
      out[i] *= 1 + lfoDepth * Math.sin(2 * Math.PI * lfoHz * t);
    }
  }
  return normalizeRms(out, 0.08);
}

function loopBgmPad(sr) {
  // A 小调 pad：A2/E3/A3/C4 长音，慢呼吸 LFO
  return loopTone({
    sr, dur: 8, freqs: [110, 164.81, 220, 261.63],
    gains: [0.5, 0.35, 0.3, 0.2], type: 'triangle', lfoHz: 0.125, lfoDepth: 0.3,
  });
}

function loopBgmBass(sr) {
  // 低音脉冲：A1 与 E2 交替
  return loopTone({
    sr, dur: 4, freqs: [55, 82.41],
    gains: [0.7, 0.5], type: 'sine', lfoHz: 0.25, lfoDepth: 0.2,
  });
}

function loopBgmArp(sr) {
  // 琶音旋律：A3-C4-E4-G4 轻巧重复
  return loopTone({
    sr, dur: 4, freqs: [220, 261.63, 329.63, 392],
    gains: [0.4, 0.3, 0.28, 0.22], type: 'triangle', lfoHz: 0, lfoDepth: 0,
  });
}

function loopSwirl(sr) {
  // 吸入环境声：低通白噪 + 慢 LFO（黑洞持续吸入的「嗡」）
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 240, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.06 + 0.03 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

const LOOPS = {
  bgmPad: loopBgmPad,
  bgmBass: loopBgmBass,
  bgmArp: loopBgmArp,
  swirl: loopSwirl,
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
  building: 6, kill: 6, death: 6,
  meteorRain: 5, chain: 5, matchEnd: 5,
  swallow: 4, meteorGain: 4, newRecord: 4,
  upgrade: 3, respawn: 3, chainEnd: 3,
  chime: 2, nearMiss: 2, ui: 1,
};

const EVENT_TO_SFX = {
  swallow: 'swallow',
  building: 'building',
  meteorRain: 'meteorRain',
  meteorGain: 'meteorGain',
  chain: 'chain',
  chainEnd: 'chainEnd',
  kill: 'kill',
  death: 'death',
  nearMiss: 'nearMiss',
  matchEnd: 'matchEnd',
  upgrade: 'upgrade',
  respawn: 'respawn',
  ui: 'ui',
  tutorialDone: 'chime',
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
    volume: clamp(Sdk.load('volume', 0.7), 0, 1),
    muted: !!Sdk.load('muted', false),
    unlocked: false,
    bgmLayers: {},
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

  function startLoop(kind, gain = 1) {
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
    g.gain.value = gain;
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

  function stopAllLoops() {
    for (const k of Object.keys(state.loops)) stopLoop(k);
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      resumeIfNeeded();
      state.unlocked = true;
      startLoop('swirl', 0.6); // 吸入环境声：首次手势即起
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
    Sdk.save('muted', state.muted);
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
    Sdk.save('volume', state.volume);
  }

  function playBgm() {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopAllLoops();
    startLoop('bgmPad', 0.5);
    startLoop('bgmBass', 0.4);
    startLoop('bgmArp', 0.22);
  }

  function stopBgm() {
    stopAllLoops();
    if (state.unlocked) startLoop('swirl', 0.6);
  }

  return {
    unlock, event, setMuted, setVolume, playBgm, stopBgm,
    get muted() { return state.muted; },
    get volume() { return state.volume; },
  };
}

export default createAudio;
