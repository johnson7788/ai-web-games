// src/core/audio.js — ELITE GUNSTRIKE · 音效与程序化 BGM（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，
//     直接算成 mono Float32Array PCM，供 tools/audio-check.mjs 在 Node 里离线校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer 播放；BGM 用分层循环（程序化合成，不打包音频文件）。
//
// 契约：createAudio() → { unlock(), event(type,payload), setMuted(b), setVolume(v), playBgm(kind), stopBgm() }
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 2;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.25;

// ---------------------------------------------------------------------------
// DSP 原语
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
// 音效合成器
// ---------------------------------------------------------------------------

function sfxShoot(_p, sr) {
  const boom = noise({ dur: 0.09, sr, gain: 0.42, filter: 'lowpass', cutoff: 700, attack: 0.001, release: 0.04 });
  const crack = noise({ dur: 0.03, sr, gain: 0.26, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.015 });
  const thud = osc({ type: 'triangle', freq: 200, freqEnd: 76, dur: 0.08, sr, gain: 0.3, attack: 0.002, release: 0.04 });
  return mix(boom, crack, thud);
}

function sfxHit(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 900, freqEnd: 500, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 }),
    noise({ dur: 0.04, sr, gain: 0.13, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.02 }),
  );
}

function sfxKill(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 420 * Math.pow(2, combo / 12);
  return mix(
    osc({ type: 'triangle', freq: f, freqEnd: f * 0.55, dur: 0.16, sr, gain: 0.36, attack: 0.003, release: 0.08 }),
    noise({ dur: 0.1, sr, gain: 0.2, filter: 'lowpass', cutoff: 900, attack: 0.002, release: 0.05 }),
  );
}

function sfxEnemyShot(_p, sr) {
  return noise({ dur: 0.06, sr, gain: 0.2, filter: 'bandpass', cutoff: 1200, attack: 0.002, release: 0.03 });
}

function sfxPlayerHit(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 120, freqEnd: 55, dur: 0.22, sr, gain: 0.42, attack: 0.003, release: 0.1 }),
    noise({ dur: 0.16, sr, gain: 0.24, filter: 'lowpass', cutoff: 260, attack: 0.003, release: 0.08 }),
  );
}

function sfxExplosion(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 60, freqEnd: 30, dur: 0.5, sr, gain: 0.42, attack: 0.004, release: 0.22 }),
    noise({ dur: 0.45, sr, gain: 0.3, filter: 'lowpass', cutoff: 500, attack: 0.004, release: 0.2 }),
  );
}

function sfxChainExplosion(_p, sr) {
  return notes({ freqs: [196, 261.63, 392], dur: 0.18, gap: 0.05, type: 'triangle', gain: 0.22, attack: 0.004, release: 0.08, sr });
}

function sfxBounce(_p, sr) {
  return osc({ type: 'sine', freq: 620, freqEnd: 420, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}

function sfxComboUp(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 660 * Math.pow(2, combo / 12);
  return mix(
    osc({ type: 'sine', freq: f, freqEnd: f * 1.3, dur: 0.08, sr, gain: 0.18, attack: 0.003, release: 0.04 }),
    osc({ type: 'sine', freq: f * 1.5, freqEnd: f * 1.9, dur: 0.08, sr, gain: 0.13, attack: 0.003, release: 0.04 }),
  );
}

function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 230, dur: 0.16, sr, gain: 0.18, attack: 0.005, release: 0.08 });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 880, dur: 0.03, sr, gain: 0.05, attack: 0.004, release: 0.02 });
}

function sfxLevelCleared(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.14, sr });
}

function sfxLevelStart(_p, sr) {
  return osc({ type: 'sine', freq: 330, freqEnd: 440, dur: 0.1, sr, gain: 0.14, attack: 0.01, release: 0.05 });
}

function sfxSceneEnter(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 440], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.16, attack: 0.06, release: 0.18, sr });
}

function sfxCaptiveHit(_p, sr) {
  return mix(
    osc({ type: 'square', freq: 220, freqEnd: 110, dur: 0.4, sr, gain: 0.3, attack: 0.004, release: 0.16 }),
    noise({ dur: 0.34, sr, gain: 0.2, filter: 'lowpass', cutoff: 400, attack: 0.004, release: 0.15 }),
  );
}

function sfxDeath(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 }),
    noise({ dur: 0.7, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 }),
  );
}

function sfxVictory(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99, 1046.5], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.2, sr });
}

function sfxUi(_p, sr) {
  return mix(
    osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 }),
    noise({ dur: 0.02, sr, gain: 0.09, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 }),
  );
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

function sfxStars(_p, sr) {
  return notes({ freqs: [659.25, 783.99, 1046.5], dur: 0.22, gap: 0.08, type: 'sine', gain: 0.18, attack: 0.01, release: 0.1, sr });
}

const SYNTH = {
  shoot: sfxShoot,
  hit: sfxHit,
  kill: sfxKill,
  enemyShot: sfxEnemyShot,
  playerHit: sfxPlayerHit,
  explosion: sfxExplosion,
  chainExplosion: sfxChainExplosion,
  bounce: sfxBounce,
  comboUp: sfxComboUp,
  comboBreak: sfxComboBreak,
  milestone: sfxMilestone,
  levelCleared: sfxLevelCleared,
  levelStart: sfxLevelStart,
  sceneEnter: sfxSceneEnter,
  captiveHit: sfxCaptiveHit,
  death: sfxDeath,
  victory: sfxVictory,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  stars: sfxStars,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 循环层（程序化合成，可无缝 loop）
// ---------------------------------------------------------------------------

// 霓虹铸造厂：A 小调霓虹 pad + 低频脉冲
function loopFoundry(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const pad = notes({ freqs: [220, 261.63, 329.63], dur, gap: 0, type: 'triangle', gain: 0.07, attack: 1.2, release: 1.2, sr });
  const pulse = osc({ type: 'square', freq: 110, dur: 0.14, sr, gain: 0.06, attack: 0.01, release: 0.06 });
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = pad[i] || 0;
  for (let k = 0; k < 4; k += 1) addAt(out, pulse, Math.round(k * 1.0 * sr));
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    out[i] *= 0.9 + 0.1 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return normalizeRms(out, 0.1);
}

// 深红反应堆：低音紧张脉冲 + 上行拨弦
function loopReactor(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const bed = noise({ dur, sr, gain: 0.04, filter: 'lowpass', cutoff: 260, attack: 1, release: 1, sr });
  const pluck = notes({ freqs: [130.81, 164.81, 196.0], dur: 0.4, gap: 0.9, type: 'triangle', gain: 0.07, attack: 0.005, release: 0.2, sr });
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = (bed[i] || 0) + (pluck[i] || 0);
  return normalizeRms(out, 0.1);
}

// 紫罗兰堡垒：五声音阶拨弦 + 柔和高频
function loopCitadel(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const pluck = notes({ freqs: [261.63, 293.66, 329.63, 392.0], dur: 0.4, gap: 0.4, type: 'triangle', gain: 0.07, attack: 0.005, release: 0.2, sr });
  const bed = noise({ dur, sr, gain: 0.04, filter: 'lowpass', cutoff: 320, attack: 1, release: 1, sr });
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = (pluck[i] || 0) + (bed[i] || 0);
  return normalizeRms(out, 0.1);
}

const LOOPS = {
  foundry: loopFoundry,
  reactor: loopReactor,
  citadel: loopCitadel,
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
  shot: 'shoot',
  hit: 'hit',
  kill: 'kill',
  enemyShot: 'enemyShot',
  playerHit: 'playerHit',
  explosion: 'explosion',
  chainExplosion: 'chainExplosion',
  bounce: 'bounce',
  comboUp: 'comboUp',
  comboBreak: 'comboBreak',
  milestone: 'milestone',
  levelCleared: 'levelCleared',
  levelStart: 'levelStart',
  sceneEnter: 'sceneEnter',
  captiveHit: 'captiveHit',
  death: 'death',
  victory: 'victory',
  ui: 'ui',
  newRecord: 'newRecord',
  stars: 'stars',
};

const SFX_PRIORITY = {
  kill: 6, explosion: 6, captiveHit: 6,
  shoot: 4, playerHit: 4, death: 4, victory: 4,
  hit: 3, chainExplosion: 3, newRecord: 3,
  levelCleared: 2, comboUp: 2, sceneEnter: 2, stars: 2,
  bounce: 1, levelStart: 1, enemyShot: 1, comboBreak: 1, milestone: 1, ui: 1,
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
    bgmKind: null,
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
    state.bgmBus.gain.value = 0.5;
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
      name, priority,
      endTime: now + pcm.length / ctx.sampleRate,
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

  function playBgm(kind) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmKind === kind) return;
    stopBgm();
    const pcm = synthLoop(kind, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(state.bgmBus);
    src.start();
    state.bgmSource = src;
    state.bgmKind = kind;
  }

  function stopBgm() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
    state.bgmKind = null;
  }

  function unlock() {
    ensureCtx();
    state.unlocked = true;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
