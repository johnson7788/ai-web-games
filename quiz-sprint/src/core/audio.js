// src/core/audio.js — QUIZ SPRINT · 音效合成与播放（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     BGM 为程序化合成、首尾整数周期对齐的无缝循环，学霸冲刺另起一层呼吸噪声循环。
//
// 契约（README 事件表）：
//   createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(name), stopBgm() }
// 事件名与 sim 事件表一字不差：raceStart/questionShow/wagerReveal/answer/answerCorrect/answerWrong/
//   wagerSkip/comboUp/comboBreak/scholarSprint/exhausted/staminaLow/distanceMilestone/timerTick/
//   raceFinish/marathonEnd，外加 UI 侧 ui（按钮点击）、newRecord（新纪录 fanfare）。

import { save } from './save.js';

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

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

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxCorrect(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 520 * Math.pow(2, combo / 12);
  const a = osc({ type: 'triangle', freq: f, freqEnd: f * 1.4, dur: 0.14, sr, gain: 0.4, attack: 0.004, release: 0.08 });
  const b = osc({ type: 'sine', freq: f * 1.5, freqEnd: f * 1.9, dur: 0.12, sr, gain: 0.18, attack: 0.004, release: 0.06 });
  const out = new Float32Array(Math.round(0.18 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.05 * sr));
  return out;
}

function sfxWrong(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 420, freqEnd: 180, dur: 0.22, sr, gain: 0.34, attack: 0.004, release: 0.1 });
  const buzz = noise({ dur: 0.16, sr, gain: 0.16, filter: 'lowpass', cutoff: 500, attack: 0.003, release: 0.08 });
  return mix(glide, buzz);
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

function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 230, dur: 0.16, sr, gain: 0.2, attack: 0.005, release: 0.08 });
}

function sfxScholar(_p, sr) {
  const fan = notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.32, gap: 0.09, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.14, sr });
  const whoosh = noise({ dur: 0.4, sr, gain: 0.26, filter: 'bandpass', cutoff: 1600, attack: 0.03, release: 0.16 });
  return mix(fan, whoosh);
}

function sfxPop(_p, sr) {
  return osc({ type: 'sine', freq: 500, freqEnd: 720, dur: 0.09, sr, gain: 0.26, attack: 0.004, release: 0.05 });
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

function sfxStart(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25], dur: 0.22, gap: 0.1, type: 'square', gain: 0.14, attack: 0.01, release: 0.1, sr });
}

function sfxTick(_p, sr) {
  return osc({ type: 'sine', freq: 740, freqEnd: 900, dur: 0.05, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxLow(_p, sr) {
  return osc({ type: 'triangle', freq: 160, freqEnd: 110, dur: 0.16, sr, gain: 0.28, attack: 0.004, release: 0.08 });
}

function sfxSkip(_p, sr) {
  return osc({ type: 'sine', freq: 500, freqEnd: 460, dur: 0.1, sr, gain: 0.2, attack: 0.004, release: 0.05 });
}

function sfxFinish(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.28, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.13, sr });
}

function sfxFanfare(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  ui: sfxUi,
  correct: sfxCorrect,
  wrong: sfxWrong,
  comboUp: sfxComboUp,
  comboBreak: sfxComboBreak,
  scholar: sfxScholar,
  pop: sfxPop,
  chime: sfxChime,
  start: sfxStart,
  tick: sfxTick,
  low: sfxLow,
  skip: sfxSkip,
  finish: sfxFinish,
  fanfare: sfxFanfare,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop 的 PCM）：程序化 BGM 和弦垫 / 学霸冲刺呼吸噪声
// ---------------------------------------------------------------------------

function snapFreq(freq, dur) {
  return Math.round(freq * dur) / dur;
}

// BGM：4s 无缝和声垫（A 大调 A2/E3/A3/C#4），0.25Hz 呼吸 LFO，全部频率整数周期对齐。
function loopBgm(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const freqs = [110, 164.81, 220, 277.18].map((f) => snapFreq(f, dur));
  const amps = [0.16, 0.07, 0.06, 0.05];
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    let s = 0;
    for (let k = 0; k < freqs.length; k += 1) s += amps[k] * Math.sin(2 * Math.PI * freqs[k] * t);
    s *= 0.7 + 0.3 * Math.sin(2 * Math.PI * (1 / dur) * t);
    out[i] = s;
  }
  return normalizeRms(out, 0.14);
}

// 学霸冲刺呼吸白噪：2s 带通白噪，0.5Hz 呼吸 LFO（整数周期，首尾包络连续可无缝循环）。
function loopScholar(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = bandpass(buf, 1100, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.10 + 0.07 * Math.sin(2 * Math.PI * 0.5 * t);
  }
  return buf;
}

const LOOPS = {
  bgm: loopBgm,
  scholar: loopScholar,
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
  finish: 6, fanfare: 6, scholar: 6, correct: 6,
  wrong: 5, start: 4,
  comboUp: 3, comboBreak: 3, chime: 3, pop: 3,
  low: 2, skip: 2, ui: 1, tick: 1,
};

const EVENT_TO_SFX = {
  raceStart: 'start',
  questionShow: 'pop',
  wagerReveal: 'chime',
  answer: 'ui',
  answerCorrect: 'correct',
  answerWrong: 'wrong',
  wagerSkip: 'skip',
  comboUp: 'comboUp',
  comboBreak: 'comboBreak',
  scholarSprint: 'scholar',
  exhausted: 'low',
  staminaLow: 'low',
  distanceMilestone: 'tick',
  timerTick: 'tick',
  raceFinish: 'finish',
  marathonEnd: 'fanfare',
  ui: 'ui',
  newRecord: 'fanfare',
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
    bgmSource: null,
    loops: { bgm: null, scholar: null },
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
    g.gain.value = kind === 'bgm' ? 0.5 : 1;
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
    }
  }

  function event(type, payload = {}) {
    if (!type) return;
    if (type === 'scholarSprint' && payload && payload.on) {
      playSfx('scholar', payload);
      startLoop('scholar');
      return;
    }
    if (type === 'scholarSprint' && payload && !payload.on) {
      stopLoop('scholar');
      return;
    }
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

  // BGM：程序化无缝循环（name 为 bgm/scholar 的别名，默认 bgm）
  function playBgm(name = 'bgm') {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
    const kind = LOOPS[name] ? name : 'bgm';
    const pcm = synthLoop(kind, ctx.sampleRate);
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
    stopLoop('scholar');
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
