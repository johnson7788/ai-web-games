// src/core/audio.js — SAUCER STRIKE · 程序化音效与 BGM（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效/循环层 = 振荡器 + 噪声 + 包络，
//     直接算成 mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     BGM 用 3 个无缝循环层（低音嗡 / 琶音 / 垫底）叠加，不打包任何音频文件。
//
// 契约（事件名与 sim 事件表一致）：createAudio() → { unlock, event(type,payload), setMuted(b), setVolume(v), playBgm(mode), stopBgm() }
import { save } from './save.js';

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.25;    // 噪声滤波后统一归一到的 RMS

// ---------------------------------------------------------------------------
// 采样级 DSP 原语（振荡器 / 噪声 / 滤波 / 包络 / 混音）
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

function sfxShot(p, sr) {
  const f = 220 * Math.pow(2, -((p.power ?? 0.5) * 0.6));
  const whoosh = noise({ dur: 0.12, sr, gain: 0.3, filter: 'bandpass', cutoff: 900, attack: 0.004, release: 0.05 });
  const thud = osc({ type: 'triangle', freq: f, freqEnd: f * 0.5, dur: 0.1, sr, gain: 0.35, attack: 0.003, release: 0.05 });
  return mix(whoosh, thud);
}

function sfxHit(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 620 * Math.pow(2, combo / 12);
  const ping = osc({ type: 'triangle', freq: f, freqEnd: f * 1.4, dur: 0.09, sr, gain: 0.3, attack: 0.002, release: 0.04 });
  const click = noise({ dur: 0.04, sr, gain: 0.16, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.02 });
  return mix(ping, click);
}

function sfxKill(p, sr) {
  const big = p.type === 'mother';
  const boom = noise({ dur: big ? 0.5 : 0.28, sr, gain: 0.4, filter: 'lowpass', cutoff: big ? 420 : 900, attack: 0.003, release: big ? 0.2 : 0.12 });
  const tone = osc({ type: 'triangle', freq: big ? 110 : 200, freqEnd: 45, dur: big ? 0.5 : 0.25, sr, gain: 0.4, attack: 0.003, release: 0.12 });
  return mix(boom, tone);
}

function sfxEscape(_p, sr) {
  return osc({ type: 'sawtooth', freq: 340, freqEnd: 120, dur: 0.22, sr, gain: 0.22, attack: 0.005, release: 0.1 });
}

function sfxOverheat(_p, sr) {
  const hiss = noise({ dur: 0.35, sr, gain: 0.28, filter: 'highpass', cutoff: 2200, attack: 0.01, release: 0.14 });
  const warn = osc({ type: 'square', freq: 130, freqEnd: 90, dur: 0.3, sr, gain: 0.12, attack: 0.005, release: 0.12 });
  return mix(hiss, warn);
}

function sfxOverheatEnd(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 760, dur: 0.12, sr, gain: 0.2, attack: 0.005, release: 0.06 });
}

function sfxTracerFired(_p, sr) {
  const flare = noise({ dur: 0.4, sr, gain: 0.3, filter: 'bandpass', cutoff: 2600, attack: 0.02, release: 0.18 });
  const ping = osc({ type: 'sine', freq: 1560, freqEnd: 2400, dur: 0.25, sr, gain: 0.16, attack: 0.01, release: 0.12 });
  return mix(flare, ping);
}

function sfxReveal(_p, sr) {
  return notes({ freqs: [440, 554.37, 659.25, 880], dur: 0.4, gap: 0.08, type: 'triangle', gain: 0.14, attack: 0.03, release: 0.16, sr });
}

function sfxMeteor(_p, sr) {
  return noise({ dur: 0.4, sr, gain: 0.22, filter: 'bandpass', cutoff: 700, attack: 0.05, release: 0.18 });
}

function sfxMeteorBlock(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 160, freqEnd: 70, dur: 0.14, sr, gain: 0.3, attack: 0.003, release: 0.07 });
  const nz = noise({ dur: 0.1, sr, gain: 0.2, filter: 'lowpass', cutoff: 500, attack: 0.002, release: 0.05 });
  return mix(thud, nz);
}

function sfxUpgrade(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.18, attack: 0.01, release: 0.12, sr });
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1100, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxLifeLost(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 420, freqEnd: 150, dur: 0.3, sr, gain: 0.3, attack: 0.005, release: 0.14 });
  const nz = noise({ dur: 0.2, sr, gain: 0.18, filter: 'lowpass', cutoff: 600, attack: 0.005, release: 0.1 });
  return mix(glide, nz);
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 620, freqEnd: 50, dur: 1.0, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.8, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxWin(_p, sr) {
  return notes({ freqs: [392, 493.88, 587.33, 783.99, 1046.5], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.2, sr });
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

function sfxComboUp(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 660 * Math.pow(2, combo / 12);
  const a = osc({ type: 'sine', freq: f, freqEnd: f * 1.3, dur: 0.08, sr, gain: 0.2, attack: 0.003, release: 0.04 });
  const b = osc({ type: 'sine', freq: f * 1.5, freqEnd: f * 1.9, dur: 0.08, sr, gain: 0.14, attack: 0.003, release: 0.04 });
  const out = new Float32Array(Math.round(0.16 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.06 * sr));
  return out;
}

function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 230, dur: 0.16, sr, gain: 0.2, attack: 0.005, release: 0.08 });
}

function sfxWaveStart(_p, sr) {
  return osc({ type: 'triangle', freq: 196, freqEnd: 392, dur: 0.22, sr, gain: 0.2, attack: 0.02, release: 0.1 });
}

function sfxWaveCleared(_p, sr) {
  return notes({ freqs: [392, 493.88, 587.33], dur: 0.35, gap: 0.1, type: 'triangle', gain: 0.18, attack: 0.02, release: 0.14, sr });
}

function sfxChapterEnter(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 440], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.16, attack: 0.06, release: 0.18, sr });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
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
  shot: sfxShot,
  hit: sfxHit,
  kill: sfxKill,
  escape: sfxEscape,
  overheat: sfxOverheat,
  overheatEnd: sfxOverheatEnd,
  tracerFired: sfxTracerFired,
  reveal: sfxReveal,
  meteor: sfxMeteor,
  meteorBlock: sfxMeteorBlock,
  upgrade: sfxUpgrade,
  nearMiss: sfxNearMiss,
  lifeLost: sfxLifeLost,
  death: sfxDeath,
  win: sfxWin,
  newRecord: sfxNewRecord,
  comboUp: sfxComboUp,
  comboBreak: sfxComboBreak,
  waveStart: sfxWaveStart,
  waveCleared: sfxWaveCleared,
  chapterEnter: sfxChapterEnter,
  milestone: sfxMilestone,
  ui: sfxUi,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（BGM 分层 + 无缝 loop 的 PCM）
// ---------------------------------------------------------------------------

// 低音嗡：4s 慢速三角波漂移（整数周期，首尾连续）。
function loopBass(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const f0 = 55;
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const f = f0 + 6 * Math.sin(2 * Math.PI * 0.25 * t);
    const phase = 2 * Math.PI * (f0 * t + (6 / (2 * Math.PI * 0.25)) * (1 - Math.cos(2 * Math.PI * 0.25 * t)));
    out[i] = Math.sin(phase) * 0.10;
  }
  return out;
}

// 琶音：A 小调 A3-C4-E4-A4 循环，2s 一周期。
function loopArp(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const freqs = [220, 261.63, 329.63, 440];
  const step = dur / freqs.length;
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const k = Math.floor(t / step) % freqs.length;
    const env = Math.min(1, (t % step) / 0.06) * Math.max(0, 1 - ((t % step) / step));
    out[i] = Math.sin(2 * Math.PI * freqs[k] * t) * 0.05 * env;
  }
  return out;
}

// 垫底：C 大调和弦长音 + 0.125Hz 呼吸 LFO，4s 无缝。
function loopPad(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const freqs = [196, 293.66, 392];
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    let s = 0;
    for (const f of freqs) s += Math.sin(2 * Math.PI * f * t);
    s = s / freqs.length;
    s *= 0.035 + 0.012 * Math.sin(2 * Math.PI * 0.125 * t);
    out[i] = s;
  }
  return out;
}

const LOOPS = {
  bgmBass: loopBass,
  bgmArp: loopArp,
  bgmPad: loopPad,
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

// 叠层优先级（击杀/命中最高）
const SFX_PRIORITY = {
  kill: 6, win: 6, death: 6,
  hit: 5, escape: 5, lifeLost: 5, overheat: 5,
  tracerFired: 4, reveal: 4, upgrade: 4, newRecord: 4,
  shot: 3, meteorBlock: 3, meteor: 3, waveStart: 3, waveCleared: 3, chapterEnter: 3,
  comboUp: 2, comboBreak: 2, nearMiss: 2, overheatEnd: 2,
  milestone: 1, ui: 1, chime: 1,
};

const EVENT_TO_SFX = {
  shot: 'shot',
  hit: 'hit',
  kill: 'kill',
  escape: 'escape',
  overheat: 'overheat',
  overheatEnd: 'overheatEnd',
  tracerFired: 'tracerFired',
  reveal: 'reveal',
  meteor: 'meteor',
  meteorBlock: 'meteorBlock',
  upgrade: 'upgrade',
  nearMiss: 'nearMiss',
  lifeLost: 'lifeLost',
  death: 'death',
  win: 'win',
  newRecord: 'newRecord',
  comboUp: 'comboUp',
  comboBreak: 'comboBreak',
  waveStart: 'waveStart',
  waveCleared: 'waveCleared',
  chapterEnter: 'chapterEnter',
  milestone: 'milestone',
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
    bgmMode: 'none',
    loops: {},            // kind -> { src, g }
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
    state.bgmBus.gain.value = 0.8;
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
    g.gain.value = 1;
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
    for (const kind of Object.keys(state.loops)) stopLoop(kind);
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
    ensureCtx();
    if (mode === state.bgmMode) return;
    state.bgmMode = mode;
    stopAllLoops();
    if (mode === 'main') {
      startLoop('bgmBass');
      startLoop('bgmPad');
      startLoop('bgmArp');
    } else if (mode === 'boss') {
      startLoop('bgmBass');
      startLoop('bgmPad');
    }
  }

  function stopBgm() {
    state.bgmMode = 'none';
    stopAllLoops();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
