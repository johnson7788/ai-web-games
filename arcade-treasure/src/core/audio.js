// src/core/audio.js — ARCADE TREASURE · 音效合成与播放（WebAudio 标准 API，零依赖零外链）。
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     循环层（大厅电流嗡鸣 / 机台运行嗡鸣）用 loop 的 AudioBufferSourceNode 长循环。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }。
// 事件名与 sim 事件表一致：hit / badHit / miss / machinePick / tokenSpent / tokenEarned /
//   heatUp / rankUp / cleared / grandPrix / gameover / pity / loseLife / waveClear / comboUp /
//   fire / score / ui / newRecord / tutorialDone。

import { save } from './save.js';

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
  for (let i = 0; i < input.length; i += 1) { y = a * y + (1 - a) * input[i]; out[i] = y; }
  return out;
}

function highpass(input, cutoff, sr) {
  const a = Math.exp(-2 * Math.PI * cutoff / sr);
  const out = new Float32Array(input.length);
  let xPrev = 0; let yPrev = 0;
  for (let i = 0; i < input.length; i += 1) {
    const x = input[i];
    const y = a * (yPrev + x - xPrev);
    out[i] = y; yPrev = y; xPrev = x;
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
  if (rms > 1e-6) { const k = target / rms; for (let i = 0; i < input.length; i += 1) input[i] *= k; }
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
  for (let i = 0; i < src.length; i += 1) { const j = offset + i; if (j >= 0 && j < dst.length) dst[j] += src[i]; }
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
function sfxHit(p, sr) {
  const f = 520 * Math.pow(2, clamp(p.combo ?? 0, 0, 12) / 12);
  return mix(
    osc({ type: 'square', freq: f, freqEnd: f * 1.3, dur: 0.09, sr, gain: 0.22, attack: 0.002, release: 0.04 }),
    noise({ dur: 0.04, sr, gain: 0.12, filter: 'highpass', cutoff: 2400, attack: 0.001, release: 0.02 }),
  );
}

function sfxBadHit(_p, sr) {
  return mix(
    osc({ type: 'sawtooth', freq: 200, freqEnd: 90, dur: 0.22, sr, gain: 0.28, attack: 0.003, release: 0.1 }),
    noise({ dur: 0.14, sr, gain: 0.18, filter: 'lowpass', cutoff: 700, attack: 0.002, release: 0.08 }),
  );
}

function sfxMiss(_p, sr) {
  return osc({ type: 'sine', freq: 420, freqEnd: 210, dur: 0.12, sr, gain: 0.16, attack: 0.004, release: 0.06 });
}

function sfxChime(_p, sr) {
  return mix(
    osc({ type: 'sine', freq: 880, dur: 0.26, sr, gain: 0.2, attack: 0.01, release: 0.12 }),
    osc({ type: 'sine', freq: 1318.5, dur: 0.26, sr, gain: 0.12, attack: 0.01, release: 0.12 }),
  );
}

function sfxToken(_p, sr) {
  return mix(
    osc({ type: 'square', freq: 1500, freqEnd: 1800, dur: 0.05, sr, gain: 0.18, attack: 0.001, release: 0.02 }),
    osc({ type: 'square', freq: 2000, freqEnd: 2300, dur: 0.05, sr, gain: 0.12, attack: 0.001, release: 0.02 }),
  );
}

function sfxCoinGain(_p, sr) {
  return notes({ freqs: [987.77, 1318.51], dur: 0.14, gap: 0.07, type: 'triangle', gain: 0.2, attack: 0.002, release: 0.08, sr });
}

function sfxHeatUp(_p, sr) {
  return osc({ type: 'triangle', freq: 300, freqEnd: 700, dur: 0.18, sr, gain: 0.18, attack: 0.02, release: 0.1 });
}

function sfxRankUp(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.14, sr });
}

function sfxCleared(_p, sr) {
  return notes({ freqs: [659.25, 783.99, 987.77], dur: 0.22, gap: 0.08, type: 'triangle', gain: 0.18, attack: 0.008, release: 0.1, sr });
}

function sfxGrandPrix(_p, sr) {
  const chord = notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25], dur: 0.9, gap: 0.08, type: 'triangle', gain: 0.16, attack: 0.02, release: 0.3, sr });
  const crash = noise({ dur: 0.6, sr, gain: 0.14, filter: 'lowpass', cutoff: 1200, attack: 0.004, release: 0.3 });
  return mix(chord, crash);
}

function sfxGameover(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 520, freqEnd: 70, dur: 0.9, sr, gain: 0.3, attack: 0.01, release: 0.3 }),
    noise({ dur: 0.6, sr, gain: 0.16, filter: 'lowpass', cutoff: 600, attack: 0.02, release: 0.3 }),
  );
}

function sfxPity(_p, sr) {
  return notes({ freqs: [880, 1174.66], dur: 0.18, gap: 0.09, type: 'sine', gain: 0.18, attack: 0.01, release: 0.09, sr });
}

function sfxLoseLife(_p, sr) {
  return osc({ type: 'sawtooth', freq: 320, freqEnd: 80, dur: 0.3, sr, gain: 0.24, attack: 0.003, release: 0.14 });
}

function sfxWaveClear(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.24, gap: 0.07, type: 'triangle', gain: 0.18, attack: 0.006, release: 0.1, sr });
}

function sfxComboUp(p, sr) {
  const f = 660 * Math.pow(2, clamp(p.combo ?? 0, 0, 12) / 12);
  return mix(
    osc({ type: 'sine', freq: f, freqEnd: f * 1.4, dur: 0.08, sr, gain: 0.16, attack: 0.003, release: 0.04 }),
    osc({ type: 'sine', freq: f * 1.5, freqEnd: f * 1.9, dur: 0.08, sr, gain: 0.12, attack: 0.003, release: 0.04 }),
  );
}

function sfxFire(_p, sr) {
  return noise({ dur: 0.08, sr, gain: 0.2, filter: 'bandpass', cutoff: 1600, attack: 0.001, release: 0.04 });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 760, freqEnd: 900, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxUi(_p, sr) {
  return mix(
    osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 }),
    noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.01 }),
  );
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.36, gap: 0.11, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.15, sr });
}

const SYNTH = {
  hit: sfxHit,
  badHit: sfxBadHit,
  miss: sfxMiss,
  machinePick: sfxChime,
  tokenSpent: sfxToken,
  tokenEarned: sfxCoinGain,
  heatUp: sfxHeatUp,
  rankUp: sfxRankUp,
  cleared: sfxCleared,
  grandPrix: sfxGrandPrix,
  gameover: sfxGameover,
  pity: sfxPity,
  loseLife: sfxLoseLife,
  waveClear: sfxWaveClear,
  comboUp: sfxComboUp,
  fire: sfxFire,
  score: sfxMilestone,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  tutorialDone: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------- 循环层（可无缝 loop 的 PCM） ----------
function loopHall(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 420, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.5 * t);
  }
  return buf;
}

function loopMachine(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = bandpass(buf, 900, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.06 + 0.03 * Math.sin(2 * Math.PI * 1.0 * t);
  }
  return buf;
}

const LOOPS = { hall: loopHall, machine: loopMachine };
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

// 事件 → 音效名（只有这里决定事件是否发声；audio-check 负例门控不放这里）
const EVENT_TO_SFX = {
  hit: 'hit',
  badHit: 'badHit',
  miss: 'miss',
  machinePick: 'machinePick',
  tokenSpent: 'tokenSpent',
  tokenEarned: 'tokenEarned',
  heatUp: 'heatUp',
  rankUp: 'rankUp',
  cleared: 'cleared',
  grandPrix: 'grandPrix',
  gameover: 'gameover',
  pity: 'pity',
  loseLife: 'loseLife',
  waveClear: 'waveClear',
  comboUp: 'comboUp',
  fire: 'fire',
  score: 'score',
  ui: 'ui',
  newRecord: 'newRecord',
  tutorialDone: 'tutorialDone',
};

export function createAudio() {
  const state = {
    ctx: null, master: null, sfxBus: null, bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    unlocked: false,
    loops: { hall: null, machine: null },
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
    state.sfxBus = state.ctx.createGain(); state.sfxBus.gain.value = 1; state.sfxBus.connect(state.master);
    state.bgmBus = state.ctx.createGain(); state.bgmBus.gain.value = 1; state.bgmBus.connect(state.master);
    resumeIfNeeded();
    return state.ctx;
  }

  function playSfx(name, payload) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null; let minPrio = Infinity;
      for (const [k, v] of state.active) { if (v.priority < minPrio) { minPrio = v.priority; minKey = k; } }
      const priority = 1;
      if (minKey == null || priority <= minPrio) return;
      const old = state.active.get(minKey);
      if (old && old.stop) { try { old.stop(now); } catch { /* noop */ } }
      state.active.delete(minKey);
    }
    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.connect(state.sfxBus); src.start(now);
    const key = `v${state.voiceSeq++}`;
    state.active.set(key, { name, priority: 1, endTime: now + pcm.length / ctx.sampleRate, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
  }

  function startLoop(kind) {
    const ctx = ensureCtx();
    if (!ctx || state.loops[kind]) return;
    const pcm = synthLoop(kind, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf; src.loop = true;
    const g = ctx.createGain(); g.gain.value = 1;
    src.connect(g); g.connect(state.sfxBus); src.start();
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
    if (ctx) { resumeIfNeeded(); state.unlocked = true; startLoop('hall'); }
  }

  function event(type, payload = {}) {
    if (!type) return;
    if (type === 'machinePick') { stopLoop('hall'); startLoop('machine'); }
    else if (type === 'machineResult' || type === 'gameover' || type === 'grandPrix') { stopLoop('machine'); }
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
  function playBgm() { /* BGM 由循环层承担，保留 API 兼容 */ }
  function stopBgm() { stopLoop('hall'); stopLoop('machine'); }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
