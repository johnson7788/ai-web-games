// src/core/audio.js — BRAIN TEASE · 程序化音频（WebAudio 标准 API，零依赖零外链零音频文件）
//
// 分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，算成
//     mono Float32Array PCM。tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer，经 BufferSource → GainNode → destination。
//     BGM 也是程序化合成的一整段音乐循环（分层琶音 + 低音 + 垫底），无缝 loop。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }
// 音量/静音设置经 Sdk.save/load 持久化（存档唯一出口）。

import Sdk from './sdk.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.25;

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

/** 等间隔琶音/旋律：freqs 依次以 gap 秒叠放。 */
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

/** 限幅到 [-1,1]，防叠层爆音。 */
function softClip(out) {
  for (let i = 0; i < out.length; i += 1) {
    const x = out[i];
    if (x > 1) out[i] = 1;
    else if (x < -1) out[i] = -1;
  }
  return out;
}

// ---------------------------------------------------------------------------
// 各音效合成器（均为 (payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

function sfxTap(_p, sr) {
  const click = noise({ dur: 0.03, sr, gain: 0.16, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.01 });
  const pop = osc({ type: 'sine', freq: 720, freqEnd: 420, dur: 0.07, sr, gain: 0.28, attack: 0.002, release: 0.04 });
  return mix(pop, click);
}

function sfxDrag(_p, sr) {
  return noise({ dur: 0.26, sr, gain: 0.3, filter: 'bandpass', cutoff: 700, attack: 0.03, release: 0.12 });
}

function sfxDrop(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 240, freqEnd: 110, dur: 0.12, sr, gain: 0.4, attack: 0.003, release: 0.06 });
  const plop = noise({ dur: 0.05, sr, gain: 0.2, filter: 'lowpass', cutoff: 400, attack: 0.002, release: 0.03 });
  return mix(thud, plop);
}

function sfxWrong(_p, sr) {
  const buzz = osc({ type: 'square', freq: 130, freqEnd: 95, dur: 0.22, sr, gain: 0.2, attack: 0.004, release: 0.08 });
  const down = osc({ type: 'sawtooth', freq: 330, freqEnd: 180, dur: 0.2, sr, gain: 0.12, attack: 0.004, release: 0.08 });
  return mix(buzz, down);
}

function sfxClear(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.35, gap: 0.1, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

// 博士的魔性坏笑：一串快速下行的「哈」音 + 颤音。
function sfxRoast(_p, sr) {
  const ha = notes({ freqs: [392, 370, 349, 330, 311, 294], dur: 0.09, gap: 0.09, type: 'square', gain: 0.12, attack: 0.005, release: 0.04, sr });
  const warble = osc({ type: 'triangle', freq: 480, freqEnd: 320, dur: 0.6, sr, gain: 0.12, attack: 0.02, release: 0.2 });
  return softClip(mix(ha, warble));
}

function sfxHint(_p, sr) {
  return osc({ type: 'sine', freq: 880, freqEnd: 1180, dur: 0.18, sr, gain: 0.26, attack: 0.008, release: 0.09 });
}

function sfxHelp(_p, sr) {
  return notes({ freqs: [523.25, 659.25], dur: 0.2, gap: 0.09, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.12, sr });
}

function sfxDoctor(_p, sr) {
  return osc({ type: 'triangle', freq: 620, freqEnd: 260, dur: 0.3, sr, gain: 0.26, attack: 0.02, release: 0.14 });
}

function sfxInvert(_p, sr) {
  const whoosh = noise({ dur: 0.32, sr, gain: 0.32, filter: 'bandpass', cutoff: 1200, attack: 0.04, release: 0.14 });
  const flip = osc({ type: 'sine', freq: 300, freqEnd: 900, dur: 0.22, sr, gain: 0.16, attack: 0.01, release: 0.1 });
  return mix(whoosh, flip);
}

function sfxStar(_p, sr) {
  return osc({ type: 'sine', freq: 1568, freqEnd: 2093, dur: 0.16, sr, gain: 0.18, attack: 0.004, release: 0.09 });
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  tap: sfxTap,
  drag: sfxDrag,
  drop: sfxDrop,
  wrong: sfxWrong,
  clear: sfxClear,
  roast: sfxRoast,
  hint: sfxHint,
  help: sfxHelp,
  doctor: sfxDoctor,
  invert: sfxInvert,
  star: sfxStar,
  newRecord: sfxNewRecord,
  ui: sfxUi,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（无缝 loop 的 PCM）：BGM 程序化音乐 + 环境底噪
// ---------------------------------------------------------------------------

// BGM：4 秒音乐循环。C 大调琶音旋律 + 低音 + 软垫，整数周期首尾连续、无缝。
function loopBgm(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);

  // 软垫：Cmaj7 和弦（C4 E4 G4 B4），慢 LFO 呼吸
  const padFreqs = [261.63, 329.63, 392.0, 493.88];
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const lfo = 0.6 + 0.4 * Math.sin(2 * Math.PI * 0.25 * t);
    let s = 0;
    for (const f of padFreqs) s += Math.sin(2 * Math.PI * f * t) * 0.05;
    out[i] += s * lfo;
  }

  // 低音：C2 每 2 秒一拍
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const beat = (t % 2) < 0.9 ? 1 : 0;
    out[i] += Math.sin(2 * Math.PI * 65.41 * t) * 0.12 * beat;
  }

  // 旋律：8 个八分音符琶音（C4 E4 G4 C5 G4 E4 D4 G4），每 0.5s 一个
  const melody = [261.63, 329.63, 392.0, 523.25, 392.0, 329.63, 293.66, 392.0];
  const step = 0.5;
  const noteLen = Math.round(step * 0.85 * sr);
  melody.forEach((f, k) => {
    const start = Math.round(k * step * sr);
    for (let i = 0; i < noteLen && start + i < n; i += 1) {
      const t = i / sr;
      const env = Math.min(1, t / 0.02) * Math.min(1, Math.max(0, (noteLen / sr - t) / 0.08));
      out[start + i] += Math.sin(2 * Math.PI * f * t) * 0.1 * env;
    }
  });

  // 归一 RMS 到安全响度，再软限幅（峰值保证 < 0.95）
  normalizeRms(out, 0.16);
  return softClip(out);
}

// 环境底噪：4s 低通白噪，0.25Hz 慢 LFO（1 周期，无缝）。
function loopAmbient(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 420, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.04 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

const LOOPS = {
  bgm: loopBgm,
  ambient: loopAmbient,
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

const EVENT_TO_SFX = {
  tap: 'tap',
  drag: 'drag',
  correct: 'drop',
  wrong: 'wrong',
  levelClear: 'clear',
  roast: 'roast',
  hint: 'hint',
  helpUnlocked: 'help',
  doctorSolve: 'doctor',
  invert: 'invert',
  star: 'star',
  newRecord: 'newRecord',
  ui: 'ui',
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
    volume: clamp(Sdk.load('volume', 0.7), 0, 1),
    muted: !!Sdk.load('muted', false),
    unlocked: false,
    bgmSource: null,
    loops: { bgm: null, ambient: null },
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
    pruneActive(now);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null;
      let minPrio = Infinity;
      for (const [key, v] of state.active) {
        const prio = v.priority;
        if (prio < minPrio) { minPrio = prio; minKey = key; }
      }
      if (minKey == null) return;
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
      priority: 1,
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
    src.connect(state.bgmBus);
    src.start();
    state.loops[kind] = { src };
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
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      resumeIfNeeded();
      state.unlocked = true;
      startLoop('ambient');
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
    stopBgmSource();
    startLoop('bgm');
  }

  function stopBgm() {
    stopBgmSource();
    stopLoop('bgm');
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
