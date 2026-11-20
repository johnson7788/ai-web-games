// src/core/audio.js — SLOT LEGENDS · 程序化音效与 BGM（WebAudio 标准 API，零依赖零外链）
//
// 分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM，方便 tools/audio-check.mjs 在 Node（无 WebAudio）里离线校验。
//  2) 浏览器播放层：PCM → AudioBuffer → AudioBufferSourceNode → GainNode → destination；
//     BGM 用程序化 loop 无缝循环（无外部音频文件，zip 体积零占用）。
//
// 事件名与 sim 事件表对齐：spin / reelStop / win / bigWin / jackpot / scatter / token /
//   nearMiss / freeSpin / pity / levelUp / milestone / settle / bankrupt / escort / ui / bet。

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 2;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.25;

// ---------------------------------------------------------------- DSP 原语
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

// ---------------------------------------------------------------- 各音效合成器
function sfxSpin(_p, sr) {
  return noise({ dur: 0.32, sr, gain: 0.4, filter: 'bandpass', cutoff: 900, attack: 0.04, release: 0.1 });
}

function sfxReelStop(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 130, freqEnd: 90, dur: 0.06, sr, gain: 0.3, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.01 });
  return mix(thud, click);
}

function sfxWin(p, sr) {
  const base = 520 + Math.min(12, Math.floor(p.amount / 10 || 0)) * 20;
  return notes({ freqs: [base, base * 1.26, base * 1.5], dur: 0.16, gap: 0.06, type: 'triangle', gain: 0.3, attack: 0.005, release: 0.07, sr });
}

function sfxBigWin(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.3, gap: 0.11, type: 'triangle', gain: 0.26, attack: 0.01, release: 0.16, sr });
}

function sfxJackpot(_p, sr) {
  const chord = notes({ freqs: [65.41, 130.81, 196, 261.63, 392], dur: 0.9, gap: 0.04, type: 'triangle', gain: 0.14, attack: 0.01, release: 0.4, sr });
  const crash = noise({ dur: 0.5, sr, gain: 0.14, filter: 'lowpass', cutoff: 1200, attack: 0.004, release: 0.28 });
  return mix(chord, crash);
}

function sfxScatter(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, freqEnd: 1320, dur: 0.1, sr, gain: 0.2, attack: 0.003, release: 0.05 });
  const b = osc({ type: 'sine', freq: 1320, freqEnd: 1760, dur: 0.1, sr, gain: 0.14, attack: 0.003, release: 0.05 });
  const out = new Float32Array(Math.round(0.16 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.05 * sr));
  return out;
}

function sfxToken(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.09, sr, gain: 0.2, attack: 0.003, release: 0.05 });
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 440, freqEnd: 380, dur: 0.08, sr, gain: 0.12, attack: 0.003, release: 0.05 });
}

function sfxFreeSpin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.22, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.12, sr });
}

function sfxPity(_p, sr) {
  const drum = osc({ type: 'triangle', freq: 82, freqEnd: 55, dur: 0.35, sr, gain: 0.4, attack: 0.004, release: 0.16 });
  const fanfare = notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.3, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.15, sr });
  return mix(drum, fanfare);
}

function sfxLevelUp(_p, sr) {
  return notes({ freqs: [440, 554.37, 659.25, 880], dur: 0.18, gap: 0.07, type: 'triangle', gain: 0.2, attack: 0.008, release: 0.09, sr });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 720, freqEnd: 960, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxSettle(_p, sr) {
  return osc({ type: 'sine', freq: 300, freqEnd: 240, dur: 0.04, sr, gain: 0.08, attack: 0.004, release: 0.02 });
}

function sfxBankrupt(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 400, freqEnd: 60, dur: 0.8, sr, gain: 0.34, attack: 0.01, release: 0.24 });
  const nz = noise({ dur: 0.5, sr, gain: 0.16, filter: 'lowpass', cutoff: 500, attack: 0.02, release: 0.28 });
  return mix(glide, nz);
}

function sfxEscort(_p, sr) {
  const a = osc({ type: 'square', freq: 200, dur: 0.05, sr, gain: 0.14, attack: 0.002, release: 0.03 });
  const b = osc({ type: 'square', freq: 300, dur: 0.05, sr, gain: 0.14, attack: 0.002, release: 0.03 });
  const out = new Float32Array(Math.round(0.09 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.04 * sr));
  return out;
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxBet(_p, sr) {
  return osc({ type: 'sine', freq: 500, freqEnd: 600, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.03 });
}

const SYNTH = {
  spin: sfxSpin,
  reelStop: sfxReelStop,
  win: sfxWin,
  bigWin: sfxBigWin,
  jackpot: sfxJackpot,
  scatter: sfxScatter,
  token: sfxToken,
  nearMiss: sfxNearMiss,
  freeSpin: sfxFreeSpin,
  pity: sfxPity,
  levelUp: sfxLevelUp,
  milestone: sfxMilestone,
  settle: sfxSettle,
  bankrupt: sfxBankrupt,
  escort: sfxEscort,
  ui: sfxUi,
  bet: sfxBet,
};

export const SFX_NAMES = Object.keys(SYNTH);

const EVENT_TO_SFX = {
  spin: 'spin',
  reelStop: 'reelStop',
  win: 'win',
  bigWin: 'bigWin',
  jackpot: 'jackpot',
  scatter: 'scatter',
  token: 'token',
  nearMiss: 'nearMiss',
  freeSpin: 'freeSpin',
  pity: 'pity',
  levelUp: 'levelUp',
  milestone: 'milestone',
  settle: 'settle',
  bankrupt: 'bankrupt',
  escort: 'escort',
  ui: 'ui',
  bet: 'bet',
};

// ---------------------------------------------------------------- 循环层（BGM）
// 4 秒无缝循环：软垫 + 五声音阶拨弦（C 大调 C D E G A），首尾连续。
function loopBgm(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);

  // 软垫：低通噪声，极低增益铺底
  let pad = new Float32Array(n);
  for (let i = 0; i < n; i += 1) pad[i] = Math.random() * 2 - 1;
  pad = lowpass(pad, 320, sr);
  pad = normalizeRms(pad, 0.06);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    pad[i] *= 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.5 * t); // 0.5Hz 呼吸
  }
  addAt(out, pad, 0);

  // 五声音阶拨弦：8 个音符，每个 0.45s
  const pent = [261.63, 293.66, 329.63, 392.0, 440.0, 392.0, 329.63, 293.66];
  const gap = dur / pent.length;
  pent.forEach((f, k) => {
    const pluck = osc({ type: 'triangle', freq: f, freqEnd: f, dur: 0.4, sr, gain: 0.1, attack: 0.004, release: 0.22 });
    addAt(out, pluck, Math.round(k * gap * sr));
  });

  return out;
}

const LOOPS = {
  bgm: loopBgm,
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

// ---------------------------------------------------------------- 播放层
export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    volume: 0.7,
    muted: false,
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

    pruneActive(now);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null;
      let minEnd = Infinity;
      for (const [key, v] of state.active) {
        if (v.endTime < minEnd) { minEnd = v.endTime; minKey = key; }
      }
      if (minKey == null) return;
      try { state.active.get(minKey).src.stop(now); } catch { /* noop */ }
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
    state.active.set(key, { name, endTime: now + pcm.length / ctx.sampleRate, src });
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
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
  }

  function playBgm() {
    startLoop('bgm');
  }

  function stopBgm() {
    stopLoop('bgm');
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
