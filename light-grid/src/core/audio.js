// src/core/audio.js — LIGHT GRID · WebAudio 程序化音效 + BGM（零外部音频文件）。
// 分两层：采样级合成器（纯函数，无 DOM/WebAudio，供 tools/audio-check.mjs 离线校验）
//        + 浏览器播放层（PCM 灌进 AudioBuffer 播放）。
// 契约：createAudio() → { unlock, event(type,payload), setMuted(b), setVolume(v), playBgm(name), stopBgm() }。

// 注意：音频设置（静音/音量）的持久化由 main.js 走 Sdk.save/load 统一出口；
// 本模块只负责运行时状态与合成，不直写 localStorage（遵守「存档只走 sdk」铁律）。
export const SAMPLE_RATE = 44100;
const MAX_VOICES = 2;
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
    addAt(out, osc({ type, freq: f, dur, sr, gain, attack, release }), Math.round(k * gap * sr));
  });
  return out;
}

// ---------- 各音效合成器 ----------
function sfxPress(_p, sr) {
  const click = osc({ type: 'triangle', freq: 720, freqEnd: 520, dur: 0.06, sr, gain: 0.35, attack: 0.002, release: 0.03 });
  const tick = noise({ dur: 0.03, sr, gain: 0.12, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.01 });
  return mix(click, tick);
}

function sfxCharge(_p, sr) {
  return osc({ type: 'sine', freq: 420, freqEnd: 760, dur: 0.09, sr, gain: 0.28, attack: 0.004, release: 0.05 });
}

function sfxBlocked(_p, sr) {
  return osc({ type: 'triangle', freq: 150, freqEnd: 110, dur: 0.08, sr, gain: 0.25, attack: 0.003, release: 0.04 });
}

function sfxSolved(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.5, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.18, sr });
}

function sfxOverload(_p, sr) {
  const buzz = osc({ type: 'sawtooth', freq: 220, freqEnd: 60, dur: 0.5, sr, gain: 0.2, attack: 0.01, release: 0.2 });
  const nz = noise({ dur: 0.4, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.004, release: 0.2 });
  return mix(buzz, nz);
}

function sfxHint(_p, sr) {
  return notes({ freqs: [880, 1108.73], dur: 0.22, gap: 0.08, type: 'sine', gain: 0.18, attack: 0.01, release: 0.1, sr });
}

function sfxSignature(_p, sr) {
  return osc({ type: 'sine', freq: 620, freqEnd: 1240, dur: 0.4, sr, gain: 0.16, attack: 0.03, release: 0.18 });
}

function sfxUi(_p, sr) {
  return osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 });
}

function sfxStar(_p, sr) {
  return osc({ type: 'sine', freq: 1046.5, dur: 0.18, sr, gain: 0.16, attack: 0.01, release: 0.1 });
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.15, sr });
}

function sfxLevelStart(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.12, attack: 0.05, release: 0.2, sr });
}

const SYNTH = {
  press: sfxPress,
  charge: sfxCharge,
  blocked: sfxBlocked,
  solved: sfxSolved,
  overload: sfxOverload,
  hint: sfxHint,
  signature: sfxSignature,
  ui: sfxUi,
  star: sfxStar,
  newRecord: sfxNewRecord,
  levelStart: sfxLevelStart,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------- 循环层（BGM：缓慢的和弦 pad + 轻琶音，整数周期无缝循环） ----------
function loopBgm(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // 底和弦（A 小调）：A2 C3 E3 A3，慢 LFO 呼吸。
  const chord = [110, 130.81, 164.81, 220];
  const arp = [220, 261.63, 329.63, 440, 329.63, 261.63];
  const chordLen = Math.round(dur * sr);
  for (const f of chord) {
    const buf = osc({ type: 'triangle', freq: f, dur, sr, gain: 0.05, attack: 0.4, release: 0.4 });
    for (let i = 0; i < buf.length; i += 1) out[i] += buf[i];
  }
  // 轻琶音（每拍一个音，形成旋律层）
  const step = Math.round((dur / arp.length) * sr);
  arp.forEach((f, k) => {
    const buf = osc({ type: 'sine', freq: f, dur: 0.5, sr, gain: 0.04, attack: 0.02, release: 0.2 });
    addAt(out, buf, k * step);
  });
  // 呼吸 LFO（整数周期，首尾连续可无缝）
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    out[i] *= 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return normalizeRms(out, 0.12);
}

const LOOPS = { bgm: loopBgm };
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

const EVENT_TO_SFX = {
  press: 'press',
  charge: 'charge',
  blocked: 'blocked',
  solved: 'solved',
  overload: 'overload',
  hint: 'hint',
  signature: 'signature',
  levelStart: 'levelStart',
  ui: 'ui',
  star: 'star',
  newRecord: 'newRecord',
};

const SFX_PRIORITY = {
  solved: 6, overload: 6, newRecord: 5, signature: 5,
  press: 4, charge: 4, levelStart: 3, hint: 3, star: 2, blocked: 2, ui: 1,
};

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: 0.7,
    muted: false,
    bgmSource: null,
    bgmName: null,
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
      const v = state.active.get(minKey);
      if (v && v.stop) { try { v.stop(now); } catch { /* noop */ } }
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
      name, priority,
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

  function playBgm(name) {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
    try {
      const pcm = synthLoop(name, ctx.sampleRate);
      const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      buf.getChannelData(0).set(pcm);
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.connect(state.bgmBus);
      node.start();
      state.bgmSource = node;
      state.bgmName = name;
    } catch { /* BGM 失败静默降级 */ }
  }

  function stopBgm() {
    stopBgmSource();
    state.bgmName = null;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
