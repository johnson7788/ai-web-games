// src/core/audio.js — BRICK SIX · 蜂巢工坊音效与程序化 BGM（WebAudio，零依赖零外链）。
//
// 两层架构：
//  1) 采样级合成器（纯函数）：每个音效 = 振荡器 + 噪声 + 包络 → mono Float32Array PCM，
//     使 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验 RMS。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer 播放；BGM 也是程序化生成的循环 PCM（不打包音频文件）。
//
// 契约：createAudio() → { unlock, event(type,payload), setMuted(b), setVolume(v), playBgm(name), stopBgm() }
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

// ---------------------------------------------------------------------------
// SFX 合成器
// ---------------------------------------------------------------------------

function sfxPlace(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 180, freqEnd: 110, dur: 0.09, sr, gain: 0.32, attack: 0.003, release: 0.04 });
  const click = noise({ dur: 0.03, sr, gain: 0.12, filter: 'highpass', cutoff: 1400, attack: 0.001, release: 0.01 });
  return mix(thud, click);
}

function sfxClear(p, sr) {
  const lines = clamp(p.lines ?? 1, 1, 6);
  const f = 440 * Math.pow(2, lines / 12);
  const pop = osc({ type: 'triangle', freq: f, freqEnd: f * 0.6, dur: 0.2, sr, gain: 0.5, attack: 0.004, release: 0.1 });
  const spark = noise({ dur: 0.08, sr, gain: 0.2, filter: 'bandpass', cutoff: f * 4, attack: 0.002, release: 0.04 });
  return mix(pop, spark);
}

function sfxCascade(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99, 1046.5], dur: 0.45, gap: 0.08, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.2, sr });
}

function sfxWax(_p, sr) {
  const a = osc({ type: 'sine', freq: 300, freqEnd: 260, dur: 0.12, sr, gain: 0.22, attack: 0.01, release: 0.05 });
  const b = osc({ type: 'sine', freq: 420, freqEnd: 380, dur: 0.12, sr, gain: 0.16, attack: 0.01, release: 0.05 });
  return mix(a, b);
}

function sfxWaxBreak(_p, sr) {
  return noise({ dur: 0.06, sr, gain: 0.3, filter: 'highpass', cutoff: 900, attack: 0.001, release: 0.03 });
}

function sfxPollen(_p, sr) {
  const a = osc({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.1, sr, gain: 0.18, attack: 0.004, release: 0.05 });
  const b = osc({ type: 'sine', freq: 990, freqEnd: 1320, dur: 0.1, sr, gain: 0.12, attack: 0.004, release: 0.05 });
  return mix(a, b);
}

function sfxPollenSpread(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.2, gap: 0.05, type: 'sine', gain: 0.16, attack: 0.005, release: 0.08, sr });
}

function sfxTierUp(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25], dur: 0.45, gap: 0.1, type: 'triangle', gain: 0.18, attack: 0.05, release: 0.16, sr });
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1200, dur: 0.05, sr, gain: 0.14, attack: 0.002, release: 0.02 });
}

function sfxRotate(_p, sr) {
  return osc({ type: 'square', freq: 700, freqEnd: 760, dur: 0.04, sr, gain: 0.1, attack: 0.002, release: 0.02 });
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 480, freqEnd: 62, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxChime(_p, sr) {
  return mix(
    osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 }),
    osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 }),
  );
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

const SYNTH = {
  place: sfxPlace,
  clear: sfxClear,
  cascade: sfxCascade,
  wax: sfxWax,
  waxBreak: sfxWaxBreak,
  pollen: sfxPollen,
  pollenSpread: sfxPollenSpread,
  tierUp: sfxTierUp,
  nearMiss: sfxNearMiss,
  rotate: sfxRotate,
  death: sfxDeath,
  ui: sfxUi,
  chime: sfxChime,
  newRecord: sfxNewRecord,
  milestone: sfxMilestone,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 程序化 BGM：三场景包各一条分层循环 pad（无音频文件）
// ---------------------------------------------------------------------------

const BGM_SCALES = {
  bgm: [220, 261.63, 329.63, 392],       // A 小调（春巢）
  bgmHoney: [196, 246.94, 293.66, 392],  // G 大调暖色（蜜库）
  bgmWinter: [174.61, 220, 261.63, 349.23], // F 调冷色（冬巢）
};

function loopBgmFor(scale) {
  return (sr) => {
    const dur = 6; // 6s 无缝循环
    const n = Math.round(dur * sr);
    const out = new Float32Array(n);
    const addTone = (freq, gain, type) => {
      const s = osc({ type, freq, freqEnd: freq, dur, sr, gain, attack: 0.6, release: 0.6 });
      for (let i = 0; i < s.length && i < n; i += 1) out[i] += s[i];
    };
    // 分层：低音持续 + 两个高八度 pad + 慢 LFO 呼吸
    addTone(scale[0] / 2, 0.10, 'sine');
    addTone(scale[0], 0.06, 'triangle');
    addTone(scale[2], 0.04, 'triangle');
    for (let i = 0; i < n; i += 1) {
      const t = i / sr;
      out[i] *= 0.72 + 0.28 * Math.sin(2 * Math.PI * 0.1667 * t);
    }
    return normalizeRms(out, 0.10);
  };
}

const LOOPS = {
  bgm: loopBgmFor(BGM_SCALES.bgm),
  bgmHoney: loopBgmFor(BGM_SCALES.bgmHoney),
  bgmWinter: loopBgmFor(BGM_SCALES.bgmWinter),
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
  cascade: 6, clear: 6,
  tierUp: 5, death: 5, newRecord: 5,
  pollenSpread: 4, waxBreak: 4,
  pollen: 3, wax: 3, place: 3,
  chime: 2, rotate: 2, nearMiss: 2, milestone: 2,
  ui: 1,
};

const EVENT_TO_SFX = {
  place: 'place',
  clear: 'clear',
  cascade: 'cascade',
  wax: 'wax',
  waxBreak: 'waxBreak',
  pollen: 'pollen',
  pollenSpread: 'pollenSpread',
  tierUp: 'tierUp',
  nearMiss: 'nearMiss',
  rotate: 'rotate',
  death: 'death',
  ui: 'ui',
  chime: 'chime',
  newRecord: 'newRecord',
  milestone: 'milestone',
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
    state.active.set(key, {
      name, priority, endTime: now + pcm.length / ctx.sampleRate,
      stop: (t) => { try { src.stop(t); } catch { /* noop */ } },
    });
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

  function stopBgm() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
  }

  function playBgm(name) {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgm();
    try {
      const pcm = synthLoop(name || 'bgm', ctx.sampleRate);
      const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      buf.getChannelData(0).set(pcm);
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.connect(state.bgmBus);
      node.start();
      state.bgmSource = node;
    } catch { /* BGM 合成失败静默降级 */ }
  }

  function unlock() {
    ensureCtx();
    resumeIfNeeded();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
