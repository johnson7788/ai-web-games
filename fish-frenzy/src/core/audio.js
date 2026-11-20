// src/core/audio.js — FISH FRENZY · M4 音效合成与播放（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放。
//
// BGM 全程序化（4s 无缝 pad 琶音循环），不打包任何音频文件（硬约束）。
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }

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
// 各音效合成器（均为 (payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

function sfxShot(_p, sr) {
  const whoosh = noise({ dur: 0.18, sr, gain: 0.3, filter: 'bandpass', cutoff: 1500, attack: 0.02, release: 0.09 });
  const tick = osc({ type: 'triangle', freq: 320, freqEnd: 180, dur: 0.06, sr, gain: 0.2, attack: 0.003, release: 0.03 });
  return mix(whoosh, tick);
}

function sfxNetBurst(_p, sr) {
  const pop = osc({ type: 'sine', freq: 420, freqEnd: 90, dur: 0.14, sr, gain: 0.4, attack: 0.003, release: 0.07 });
  const bub = noise({ dur: 0.12, sr, gain: 0.18, filter: 'lowpass', cutoff: 900, attack: 0.002, release: 0.06 });
  return mix(pop, bub);
}

function sfxCatch(p, sr) {
  const value = clamp(p.value ?? 3, 1, 1000);
  const f = 620 + Math.min(600, Math.log2(value + 1) * 90);
  const a = osc({ type: 'sine', freq: f, freqEnd: f * 1.6, dur: 0.14, sr, gain: 0.34, attack: 0.004, release: 0.07 });
  const b = osc({ type: 'sine', freq: f * 1.5, dur: 0.2, sr, gain: 0.16, attack: 0.004, release: 0.1 });
  return mix(a, b);
}

function sfxNetMiss(_p, sr) {
  return osc({ type: 'triangle', freq: 180, freqEnd: 110, dur: 0.12, sr, gain: 0.22, attack: 0.004, release: 0.06 });
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxTierChange(p, sr) {
  const tier = clamp(p.tier ?? 1, 1, 7);
  const f = 400 + tier * 60;
  const a = osc({ type: 'square', freq: f, dur: 0.04, sr, gain: 0.12, attack: 0.002, release: 0.02 });
  const b = osc({ type: 'square', freq: f * 1.25, dur: 0.04, sr, gain: 0.12, attack: 0.002, release: 0.02 });
  const out = new Float32Array(Math.round(0.08 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.04 * sr));
  return out;
}

function sfxForecast(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.12, sr, gain: 0.16, attack: 0.01, release: 0.06 });
}

function sfxStageStart(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 440], dur: 0.4, gap: 0.09, type: 'triangle', gain: 0.14, attack: 0.04, release: 0.14, sr });
}

function sfxStageClear(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.34, gap: 0.1, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.14, sr });
}

function sfxBossSpawn(_p, sr) {
  const drone = osc({ type: 'sawtooth', freq: 62, freqEnd: 48, dur: 0.7, sr, gain: 0.3, attack: 0.03, release: 0.3 });
  const nz = noise({ dur: 0.6, sr, gain: 0.2, filter: 'lowpass', cutoff: 200, attack: 0.03, release: 0.3 });
  return mix(drone, nz);
}

function sfxElectricReady(_p, sr) {
  return osc({ type: 'sine', freq: 380, freqEnd: 900, dur: 0.22, sr, gain: 0.22, attack: 0.02, release: 0.08 });
}

function sfxElectricFire(_p, sr) {
  const zap = noise({ dur: 0.4, sr, gain: 0.4, filter: 'bandpass', cutoff: 2400, attack: 0.005, release: 0.2 });
  const thud = osc({ type: 'triangle', freq: 90, freqEnd: 40, dur: 0.3, sr, gain: 0.4, attack: 0.004, release: 0.15 });
  return mix(zap, thud);
}

function sfxCoinMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 880, freqEnd: 1180, dur: 0.08, sr, gain: 0.14, attack: 0.004, release: 0.04 });
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.9, sr, gain: 0.36, attack: 0.01, release: 0.22 });
  const nz = noise({ dur: 0.6, sr, gain: 0.18, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.25 });
  return mix(glide, nz);
}

function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.4, gap: 0.11, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.26, sr, gain: 0.2, attack: 0.01, release: 0.1 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.26, sr, gain: 0.11, attack: 0.01, release: 0.1 });
  return mix(a, b);
}

const SYNTH = {
  shot: sfxShot,
  netBurst: sfxNetBurst,
  catch: sfxCatch,
  netMiss: sfxNetMiss,
  nearMiss: sfxNearMiss,
  tierChange: sfxTierChange,
  forecast: sfxForecast,
  stageStart: sfxStageStart,
  stageClear: sfxStageClear,
  bossSpawn: sfxBossSpawn,
  electricReady: sfxElectricReady,
  electricFire: sfxElectricFire,
  coinMilestone: sfxCoinMilestone,
  death: sfxDeath,
  win: sfxWin,
  ui: sfxUi,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop 的 PCM）
// ---------------------------------------------------------------------------

// 环境水声：4s 低通白噪，0.25Hz 慢 LFO（1 周期，无缝）
function loopWater(sr) {
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

// 程序化 BGM：4s 无缝 pad 琶音循环（A 小调，频率均为 0.25Hz 整数倍，首尾无 click）
function loopBgm(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // 低频 drone
  const drone = osc({ type: 'sine', freq: 110, dur, sr, gain: 0.10, attack: 0.6, release: 0.6 });
  for (let i = 0; i < drone.length; i += 1) out[i] += drone[i];
  // 琶音：A2 E3 A3 C#4 E4 A4（每 0.5s 一个）
  const arp = [110, 165, 220, 275, 330, 440];
  for (let k = 0; k < arp.length; k += 1) {
    const s = osc({ type: 'triangle', freq: arp[k], dur: 0.9, sr, gain: 0.10, attack: 0.05, release: 0.4 });
    addAt(out, s, Math.round(k * 0.5 * sr));
  }
  // 慢 LFO pad（1 周期 4s）
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    out[i] *= 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.25 * t + 0.5);
  }
  return normalizeRms(out, 0.05);
}

const LOOPS = {
  water: loopWater,
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

const SFX_PRIORITY = {
  catch: 6, electricFire: 6,
  stageClear: 5, win: 5,
  bossSpawn: 4, electricReady: 4, death: 4,
  netBurst: 3, shot: 3,
  netMiss: 2, nearMiss: 2, tierChange: 2, forecast: 2, stageStart: 2, coinMilestone: 2,
  chime: 2, ui: 1,
};

const EVENT_TO_SFX = {
  shot: 'shot',
  netBurst: 'netBurst',
  catch: 'catch',
  netMiss: 'netMiss',
  nearMiss: 'nearMiss',
  tierChange: 'tierChange',
  forecast: 'forecast',
  stageStart: 'stageStart',
  stageClear: 'stageClear',
  bossSpawn: 'bossSpawn',
  electricReady: 'electricReady',
  electricFire: 'electricFire',
  coinMilestone: 'coinMilestone',
  death: 'death',
  win: 'win',
  tutorialDone: 'chime',
  ui: 'ui',
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
    unlocked: false,
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

  function startLoop(kind, bus) {
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
    g.connect(bus);
    src.start();
    state.loops[kind] = { src, g };
  }

  function stopLoop(kind) {
    const l = state.loops[kind];
    if (!l) return;
    try { l.src.stop(); } catch { /* noop */ }
    state.loops[kind] = null;
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      resumeIfNeeded();
      state.unlocked = true;
      startLoop('water', state.sfxBus);
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

  function playBgm() {
    const ctx = ensureCtx();
    if (!ctx) return;
    startLoop('bgm', state.bgmBus);
  }

  function stopBgm() {
    stopLoop('bgm');
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
