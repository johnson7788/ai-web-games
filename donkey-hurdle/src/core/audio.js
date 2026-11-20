// src/core/audio.js — DONKEY HURDLE · 程序化音频（WebAudio 标准 API，零依赖零外链零音频文件）
// 分两层：
//  1) 采样级合成器（纯函数，无 DOM/WebAudio）：每个音效 = 振荡器 + 噪声 + 包络 → mono Float32Array PCM，
//     让 tools/audio-check.mjs 在 Node（无 WebAudio）里离线渲染校验 RMS/峰值/NaN。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer 经 GainNode 播放；BGM 用分层无缝 loop 合成（不打包音频文件）。
// 契约：createAudio() → { unlock(), event(type,payload), setMuted(b), setVolume(v), playBgm(scene), stopBgm() }

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
// 各音效合成器（(payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

function sfxJump(_p, sr) {
  return osc({ type: 'sine', freq: 380, freqEnd: 720, dur: 0.12, sr, gain: 0.3, attack: 0.008, release: 0.06 });
}
function sfxLand(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 130, freqEnd: 80, dur: 0.08, sr, gain: 0.3, attack: 0.004, release: 0.04 });
  const click = noise({ dur: 0.03, sr, gain: 0.12, filter: 'lowpass', cutoff: 700, attack: 0.001, release: 0.02 });
  return mix(thud, click);
}
function sfxHit(_p, sr) {
  const crack = noise({ dur: 0.16, sr, gain: 0.5, filter: 'highpass', cutoff: 900, attack: 0.002, release: 0.08 });
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 70, dur: 0.14, sr, gain: 0.4, attack: 0.003, release: 0.07 });
  const tink = osc({ type: 'sine', freq: 2400, freqEnd: 1500, dur: 0.09, sr, gain: 0.2, attack: 0.002, release: 0.04 });
  return mix(crack, thud, tink);
}
function sfxFell(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 300, freqEnd: 60, dur: 0.35, sr, gain: 0.4, attack: 0.005, release: 0.15 });
  const nz = noise({ dur: 0.3, sr, gain: 0.3, filter: 'lowpass', cutoff: 400, attack: 0.004, release: 0.14 });
  return mix(glide, nz);
}
function sfxJarDrop(_p, sr) {
  const down = osc({ type: 'triangle', freq: 520, freqEnd: 190, dur: 0.18, sr, gain: 0.3, attack: 0.005, release: 0.08 });
  const tink = notes({ freqs: [1800, 1400, 1100], dur: 0.08, gap: 0.04, type: 'sine', gain: 0.15, sr });
  return mix(down, tink);
}
function sfxSuperJump(_p, sr) {
  return noise({ dur: 0.34, sr, gain: 0.4, filter: 'bandpass', cutoff: 1300, attack: 0.03, release: 0.15 });
}
function sfxObstacleClear(_p, sr) {
  return osc({ type: 'sine', freq: 620, freqEnd: 940, dur: 0.1, sr, gain: 0.22, attack: 0.004, release: 0.05 });
}
function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1600, freqEnd: 1200, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}
function sfxJarGain(_p, sr) {
  const a = osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.1, sr, gain: 0.25, attack: 0.004, release: 0.05 });
  const b = osc({ type: 'sine', freq: 990, freqEnd: 1320, dur: 0.1, sr, gain: 0.18, attack: 0.004, release: 0.05 });
  const out = new Float32Array(Math.round(0.18 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.05 * sr));
  return out;
}
function sfxSegmentEnter(_p, sr) {
  return notes({ freqs: [220, 277.18, 329.63, 440], dur: 0.5, gap: 0.11, type: 'triangle', gain: 0.16, attack: 0.06, release: 0.18, sr });
}
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 700, freqEnd: 920, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}
function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 55, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}
function sfxFullArc(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.25, gap: 0.07, type: 'sine', gain: 0.16, attack: 0.006, release: 0.1, sr });
}
function sfxComboUp(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 660 * Math.pow(2, combo / 12);
  return osc({ type: 'sine', freq: f, freqEnd: f * 1.4, dur: 0.08, sr, gain: 0.18, attack: 0.003, release: 0.04 });
}
function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 230, dur: 0.16, sr, gain: 0.2, attack: 0.005, release: 0.08 });
}
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}
function sfxStride(_p, sr) {
  // 极轻的蹄声（跑步节奏反馈，可高频触发不吵）
  return noise({ dur: 0.03, sr, gain: 0.05, filter: 'lowpass', cutoff: 320, attack: 0.001, release: 0.015 });
}

const SYNTH = {
  jump: sfxJump,
  land: sfxLand,
  hit: sfxHit,
  fell: sfxFell,
  jarDrop: sfxJarDrop,
  superJump: sfxSuperJump,
  obstacleClear: sfxObstacleClear,
  nearMiss: sfxNearMiss,
  jarGain: sfxJarGain,
  segmentEnter: sfxSegmentEnter,
  milestone: sfxMilestone,
  death: sfxDeath,
  fullArc: sfxFullArc,
  comboUp: sfxComboUp,
  comboBreak: sfxComboBreak,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  stride: sfxStride,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（无缝 loop）：BGM 分层（低音 drone + 五声音阶旋律）+ 风沙环境噪声
// ---------------------------------------------------------------------------

function loopBgm(sr) {
  const dur = 4; // 4 秒无缝（整数拍，首尾包络连续）
  const n = Math.round(dur * sr);
  const drone = new Float32Array(n);
  const mel = new Float32Array(n);
  // 低音 drone（A2 + E3，慢 LFO）
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const lfo = 0.5 + 0.5 * Math.sin(2 * Math.PI * 0.25 * t);
    drone[i] = 0.06 * Math.sin(2 * Math.PI * 110 * t) + 0.04 * Math.sin(2 * Math.PI * 164.81 * t);
    drone[i] *= 0.7 + 0.3 * lfo;
  }
  // 五声音阶旋律（A 小调五声：A C D E G），每 0.5s 一个音，均匀落在 4s 内
  const scale = [220, 261.63, 293.66, 329.63, 392.0];
  const step = 0.5;
  for (let k = 0; k < dur / step; k += 1) {
    const f = scale[(k * 7) % scale.length];
    const s = osc({ type: 'triangle', freq: f, dur: 0.5, sr, gain: 0.09, attack: 0.02, release: 0.2 });
    addAt(mel, s, Math.round(k * step * sr));
  }
  const out = mix(drone, mel);
  return normalizeRms(out, 0.2);
}

function loopWind(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = bandpass(buf, 500, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.04 + 0.03 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

const LOOPS = {
  bgm: loopBgm,
  wind: loopWind,
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

const EVENT_TO_SFX = {
  jump: 'jump',
  land: 'land',
  hit: 'hit',
  fell: 'fell',
  jarDrop: 'jarDrop',
  superJump: 'superJump',
  obstacleClear: 'obstacleClear',
  nearMiss: 'nearMiss',
  jarGain: 'jarGain',
  segmentEnter: 'segmentEnter',
  distanceMilestone: 'milestone',
  death: 'death',
  fullArc: 'fullArc',
  comboUp: 'comboUp',
  comboBreak: 'comboBreak',
  ui: 'ui',
  newRecord: 'newRecord',
  stride: 'stride',
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
    bgmScene: null,
    loops: { wind: null },
    active: new Map(),
    lastPlay: new Map(),
    lastStrideAt: -Infinity,
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
    if (state.active.size >= MAX_VOICES) return;

    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.sfxBus);
    src.start(now);
    const key = `v${state.voiceSeq++}`;
    state.active.set(key, { endTime: now + pcm.length / ctx.sampleRate, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
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
      startLoop('wind');
    }
  }

  function event(type, payload = {}) {
    if (!type) return;
    if (type === 'stride') {
      // 每逻辑帧都有 stride 事件，但蹄声节流成 gallop 节奏（≈7.7 次/秒），避免连发
      const ctx = ensureCtx();
      if (!ctx) return;
      if (ctx.currentTime - state.lastStrideAt < 0.13) return;
      state.lastStrideAt = ctx.currentTime;
      playSfx('stride', payload);
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

  // playBgm(scene)：用合成 BGM loop（不打包音频文件）；scene 变化时重起以切氛围。
  function playBgm(scene = 'dawn') {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmScene === scene && state.bgmSource) return;
    stopBgmSource();
    const pcm = synthLoop('bgm', ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.loop = true;
    node.connect(state.bgmBus);
    node.start();
    state.bgmSource = node;
    state.bgmScene = scene;
  }

  function stopBgm() {
    stopBgmSource();
    state.bgmScene = null;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
