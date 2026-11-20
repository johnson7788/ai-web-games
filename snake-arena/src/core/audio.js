// src/core/audio.js — SNAKE ARENA · 程序化 WebAudio（零依赖零外链，BGM/SFX 全部合成，不打包音频文件）
//
// 两层架构：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 / 每段 BGM 都直接算成
//     mono Float32Array PCM，供 tools/audio-check.mjs 在 Node 里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer 经 GainNode 播放；BGM 用无缝循环 buffer。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v),
//   playBgm(mode), stopBgm() }；mode ∈ core | meltdown | deepnet。
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.24;

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

// ---- 音效合成器 ----
function sfxEat(_p, sr) {
  const blip = osc({ type: 'sine', freq: 560, freqEnd: 900, dur: 0.09, sr, gain: 0.28, attack: 0.004, release: 0.04 });
  const spark = osc({ type: 'sine', freq: 1120, freqEnd: 1400, dur: 0.05, sr, gain: 0.1, attack: 0.002, release: 0.03 });
  return mix(blip, spark);
}

function sfxGrow(_p, sr) {
  return notes({ freqs: [392, 523.25], dur: 0.16, gap: 0.07, type: 'triangle', gain: 0.22, sr });
}

function sfxBoostStart(_p, sr) {
  return noise({ dur: 0.32, sr, gain: 0.32, filter: 'bandpass', cutoff: 1500, attack: 0.05, release: 0.16 });
}

function sfxBoostEnd(_p, sr) {
  return osc({ type: 'triangle', freq: 520, freqEnd: 240, dur: 0.12, sr, gain: 0.18, attack: 0.004, release: 0.06 });
}

function sfxShardDrop(_p, sr) {
  return osc({ type: 'sine', freq: 880, freqEnd: 420, dur: 0.1, sr, gain: 0.14, attack: 0.003, release: 0.05 });
}

function sfxPulse(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 90, freqEnd: 40, dur: 0.4, sr, gain: 0.4, attack: 0.005, release: 0.2 });
  const sweep = noise({ dur: 0.3, sr, gain: 0.24, filter: 'bandpass', cutoff: 700, attack: 0.01, release: 0.18 });
  return mix(thud, sweep);
}

function sfxStun(_p, sr) {
  return notes({ freqs: [660, 440], dur: 0.12, gap: 0.05, type: 'square', gain: 0.12, sr });
}

function sfxKill(_p, sr) {
  const crash = noise({ dur: 0.4, sr, gain: 0.28, filter: 'highpass', cutoff: 900, attack: 0.004, release: 0.2 });
  const rise = osc({ type: 'sawtooth', freq: 180, freqEnd: 720, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.14 });
  return mix(crash, rise);
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 55, dur: 0.9, sr, gain: 0.34, attack: 0.01, release: 0.22 });
  const nz = noise({ dur: 0.6, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.28 });
  return mix(glide, nz);
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxRankChange(_p, sr) {
  return osc({ type: 'sine', freq: 440, freqEnd: 660, dur: 0.1, sr, gain: 0.12, attack: 0.004, release: 0.05 });
}

function sfxRoundWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.34, gap: 0.12, type: 'triangle', gain: 0.2, sr });
}

function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.24, sr });
}

function sfxUnlock(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.26, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.26, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

function sfxRoundStart(_p, sr) {
  return notes({ freqs: [440, 554.37, 659.25], dur: 0.3, gap: 0.1, type: 'triangle', gain: 0.18, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, sr });
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  eat: sfxEat, grow: sfxGrow, boostStart: sfxBoostStart, boostEnd: sfxBoostEnd,
  shardDrop: sfxShardDrop, pulse: sfxPulse, stun: sfxStun, kill: sfxKill,
  death: sfxDeath, nearMiss: sfxNearMiss, milestone: sfxMilestone, rankChange: sfxRankChange,
  roundWin: sfxRoundWin, win: sfxWin, unlock: sfxUnlock, roundStart: sfxRoundStart,
  ui: sfxUi, newRecord: sfxNewRecord, chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---- BGM 循环层（无缝 loop，整数周期 drone + 包络琶音） ----
function makeDrone(freq, dur, sr) {
  const n = Math.round(dur * sr);
  const cycles = Math.round(freq * dur);       // 整数周期保证首尾相接无缝
  const f = cycles / dur;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = Math.sin(2 * Math.PI * f * i / sr) * 0.5 + Math.sin(2 * Math.PI * f * 1.5 * i / sr) * 0.18;
  return out;
}

function loopTheme(sr, { drones, arp, arpGap, gain }) {
  const dur = 8;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  for (const f of drones) {
    const d = makeDrone(f, dur, sr);
    for (let i = 0; i < n; i += 1) out[i] += d[i] * 0.16;
  }
  arp.forEach((f, k) => {
    addAt(out, osc({ type: 'triangle', freq: f, dur: 0.5, sr, gain: 0.06, attack: 0.02, release: 0.2 }), Math.round(k * arpGap * sr));
  });
  return normalizeRms(out, gain);
}

function loopCore(sr) {
  return loopTheme(sr, { drones: [110, 165, 220], arp: [220, 261.63, 329.63, 392, 329.63, 261.63], arpGap: 0.5, gain: 0.1 });
}
function loopMeltdown(sr) {
  return loopTheme(sr, { drones: [98, 147, 196], arp: [196, 233.08, 293.66, 349.23, 293.66, 233.08], arpGap: 0.42, gain: 0.1 });
}
function loopDeepnet(sr) {
  return loopTheme(sr, { drones: [82.41, 123.47, 164.81], arp: [164.81, 196, 246.94, 329.63, 246.94, 196], arpGap: 0.46, gain: 0.1 });
}

const LOOPS = { core: loopCore, meltdown: loopMeltdown, deepnet: loopDeepnet };
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
  kill: 6, death: 6, win: 6, roundWin: 5, pulse: 5, unlock: 4,
  grow: 3, eat: 3, boostStart: 3, shardDrop: 2, stun: 2, nearMiss: 2,
  rankChange: 1, milestone: 1, roundStart: 1, boostEnd: 1, ui: 1, newRecord: 1, chime: 1,
};

const EVENT_TO_SFX = {
  eat: 'eat', grow: 'grow', boostStart: 'boostStart', boostEnd: 'boostEnd',
  shardDrop: 'shardDrop', pulse: 'pulse', stun: 'stun', kill: 'kill', death: 'death',
  nearMiss: 'nearMiss', milestone: 'milestone', rankChange: 'rankChange',
  roundWin: 'roundWin', win: 'win', unlock: 'unlock', roundStart: 'roundStart',
  lose: 'death', ui: 'ui', newRecord: 'newRecord', tutorialDone: 'chime',
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
    bgmMode: null,
    bgmSource: null,
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
    state.bgmBus.gain.value = 0.55;
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
      for (const [key, v] of state.active) {
        if (v.priority < minPrio) { minPrio = v.priority; minKey = key; }
      }
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
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
  }

  function playBgm(mode) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmMode === mode && state.bgmSource) return;
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

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) { resumeIfNeeded(); state.unlocked = true; }
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

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
