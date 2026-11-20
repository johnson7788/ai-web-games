// src/core/audio.js — GEM CASCADE 音效：WebAudio 程序化合成（零外链、零音频文件）。
// 分两层：1) 采样级合成器（纯函数，Node 可离线校验）；2) 浏览器播放层。
// 契约：createAudio() → { unlock, event, setMuted, setVolume, playBgm, stopBgm }
// 事件映射：pop / avalanche / pick / pickReady / wash / levelClear / fail / streak / thaw / ui / newRecord。
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 20;
const NOISE_RMS = 0.22;

// ---------- DSP 原语 ----------
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

// ---------- SFX 合成器 ----------
function sfxPop(p, sr) {
  const n = clamp(p.n ?? 2, 2, 60);
  const f = 560 * Math.pow(2, -n / 26);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 0.6, dur: 0.16, sr, gain: 0.5, attack: 0.004, release: 0.08 });
  const pop = noise({ dur: 0.06, sr, gain: 0.22, filter: 'lowpass', cutoff: f * 4, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

function sfxAvalanche(p, sr) {
  const n = clamp(p.n ?? 6, 6, 40);
  const base = 720 * Math.pow(2, -n / 40);
  const sweep = osc({ type: 'sawtooth', freq: base, freqEnd: base * 0.4, dur: 0.5, sr, gain: 0.3, attack: 0.01, release: 0.22 });
  const crash = noise({ dur: 0.42, sr, gain: 0.28, filter: 'bandpass', cutoff: 900, attack: 0.004, release: 0.2 });
  const chord = notes({ freqs: [base, base * 1.5, base * 2], dur: 0.5, gap: 0, type: 'triangle', gain: 0.12, attack: 0.02, release: 0.2, sr });
  return mix(sweep, crash, chord);
}

function sfxPick(_p, sr) {
  const clang = osc({ type: 'square', freq: 340, freqEnd: 200, dur: 0.09, sr, gain: 0.28, attack: 0.002, release: 0.04 });
  const ring = osc({ type: 'sine', freq: 2100, freqEnd: 900, dur: 0.16, sr, gain: 0.14, attack: 0.002, release: 0.08 });
  const nz = noise({ dur: 0.05, sr, gain: 0.16, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.02 });
  return mix(clang, ring, nz);
}

function sfxPickReady(_p, sr) {
  return notes({ freqs: [660, 880, 1320], dur: 0.22, gap: 0.09, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.1, sr });
}

function sfxWash(_p, sr) {
  const whoosh = noise({ dur: 0.42, sr, gain: 0.32, filter: 'bandpass', cutoff: 1200, attack: 0.04, release: 0.18 });
  const sparkle = notes({ freqs: [880, 1174.66, 1567.98], dur: 0.16, gap: 0.06, type: 'sine', gain: 0.12, attack: 0.01, release: 0.08, sr });
  return mix(whoosh, sparkle);
}

function sfxLevelClear(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.18, sr });
}

function sfxFail(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 480, freqEnd: 60, dur: 0.9, sr, gain: 0.36, attack: 0.01, release: 0.22 });
  const nz = noise({ dur: 0.6, sr, gain: 0.2, filter: 'lowpass', cutoff: 600, attack: 0.02, release: 0.28 });
  return mix(glide, nz);
}

function sfxStreak(p, sr) {
  const s = clamp(p.streak ?? 1, 1, 12);
  const f = 700 * Math.pow(2, s / 12);
  return osc({ type: 'sine', freq: f, freqEnd: f * 1.6, dur: 0.08, sr, gain: 0.16, attack: 0.003, release: 0.04 });
}

function sfxThaw(_p, sr) {
  return osc({ type: 'sine', freq: 1600, freqEnd: 2400, dur: 0.09, sr, gain: 0.14, attack: 0.003, release: 0.05 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  return ping;
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.4, gap: 0.11, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  pop: sfxPop,
  avalanche: sfxAvalanche,
  pick: sfxPick,
  pickReady: sfxPickReady,
  wash: sfxWash,
  levelClear: sfxLevelClear,
  fail: sfxFail,
  streak: sfxStreak,
  thaw: sfxThaw,
  ui: sfxUi,
  newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------- 循环层（程序化 BGM，无缝 loop） ----------
function loopDrone(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    // 多个正弦谐波叠加（频率为整数周期，保证无缝）
    out[i] = 0.10 * Math.sin(2 * Math.PI * 55 * t)
      + 0.06 * Math.sin(2 * Math.PI * 110 * t)
      + 0.04 * Math.sin(2 * Math.PI * 165 * t)
      + 0.02 * Math.sin(2 * Math.PI * 220 * t);
    // 慢呼吸 LFO（1 个完整周期）
    out[i] *= 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return out;
}

function loopSparkle(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const penta = [659.25, 783.99, 880, 1046.5, 1174.66];
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    let v = 0;
    for (let k = 0; k < 5; k += 1) {
      const noteAt = (k / 5) * dur;
      const age = t - noteAt;
      if (age >= 0 && age < 0.8) {
        v += 0.05 * Math.exp(-age * 5) * Math.sin(2 * Math.PI * penta[k] * age);
      }
    }
    out[i] = v;
  }
  return out;
}

function loopPulse(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const beat = (t % 0.5) / 0.5;
    out[i] = 0.08 * Math.exp(-beat * 14) * Math.sin(2 * Math.PI * 82 * t);
  }
  return out;
}

const LOOPS = {
  drone: loopDrone,
  sparkle: loopSparkle,
  pulse: loopPulse,
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

// ---------- 事件→音效映射 ----------
const EVENT_TO_SFX = {
  pop: 'pop',
  avalanche: 'avalanche',
  pick: 'pick',
  pickReady: 'pickReady',
  wash: 'wash',
  levelClear: 'levelClear',
  fail: 'fail',
  streak: 'streak',
  thaw: 'thaw',
  ui: 'ui',
  newRecord: 'newRecord',
};

const SFX_PRIORITY = {
  avalanche: 6, levelClear: 6, fail: 5,
  pop: 4, pickReady: 4, wash: 4, newRecord: 4,
  pick: 3, streak: 2, thaw: 2, ui: 1,
};

// ---------- 播放层 ----------
export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    unlocked: false,
    bgm: [],
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
    state.bgmBus.gain.value = 0.7;
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
    state.active.set(`v${state.voiceSeq++}`, {
      name,
      priority,
      endTime: now + pcm.length / ctx.sampleRate,
      stop: (t) => { try { src.stop(t); } catch { /* noop */ } },
    });
  }

  function startLoop(kind, bus) {
    const ctx = ensureCtx();
    if (!ctx) return null;
    const pcm = synthLoop(kind, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = kind === 'drone' ? 0.5 : 0.35;
    src.connect(g);
    g.connect(bus);
    src.start();
    return { src, g };
  }

  function stopBgm() {
    for (const b of state.bgm) { try { b.src.stop(); } catch { /* noop */ } }
    state.bgm = [];
  }

  function unlock() {
    ensureCtx();
    state.unlocked = true;
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
    if (!ctx) return;
    stopBgm();
    const kinds = mode === 'quiet' ? ['drone'] : ['drone', 'sparkle', 'pulse'];
    for (const k of kinds) {
      const b = startLoop(k, state.bgmBus);
      if (b) state.bgm.push(b);
    }
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
