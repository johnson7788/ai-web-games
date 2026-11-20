// src/core/audio.js — ALIEN SIEGE · 程序化音效与 BGM（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     BGM 用 3 层无缝循环（低音 drone / 琶音 / 脉冲噪声）叠加。
//
// 事件名与 sim 事件表一字不差：shoot / hit / kill / reload / reloadDone / mark / shieldOn /
//   shieldOff / shieldBreak / playerHurt / waveStart / waveClear / weaponUnlock / sceneEnter /
//   bossSpawn / bossHit / nearMiss / splat / death / win / milestone，外加 UI 侧 ui / newRecord。

import Sdk from './sdk.js';

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限（射击/命中优先保）
const DEDUPE_MS = 24;      // 同一音效 24ms 内去重
const NOISE_RMS = 0.25;    // 噪声滤波后统一归一到的 RMS

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
// 各音效合成器
// ---------------------------------------------------------------------------

function sfxShoot(_p, sr) {
  const crack = noise({ dur: 0.08, sr, gain: 0.5, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.04 });
  const thud = osc({ type: 'triangle', freq: 130, freqEnd: 60, dur: 0.11, sr, gain: 0.4, attack: 0.002, release: 0.06 });
  return mix(crack, thud);
}

function sfxHit(_p, sr) {
  const tick = noise({ dur: 0.04, sr, gain: 0.3, filter: 'bandpass', cutoff: 2200, attack: 0.001, release: 0.02 });
  const body = osc({ type: 'triangle', freq: 220, freqEnd: 110, dur: 0.08, sr, gain: 0.32, attack: 0.002, release: 0.04 });
  return mix(tick, body);
}

function sfxKill(_p, sr) {
  const pop = osc({ type: 'triangle', freq: 300, freqEnd: 70, dur: 0.22, sr, gain: 0.45, attack: 0.003, release: 0.12 });
  const nz = noise({ dur: 0.16, sr, gain: 0.3, filter: 'lowpass', cutoff: 800, attack: 0.002, release: 0.08 });
  return mix(pop, nz);
}

function sfxReload(_p, sr) {
  return noise({ dur: 0.05, sr, gain: 0.25, filter: 'highpass', cutoff: 2400, attack: 0.001, release: 0.02 });
}

function sfxReloadDone(_p, sr) {
  const a = osc({ type: 'square', freq: 620, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.02 });
  const b = osc({ type: 'square', freq: 930, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.02 });
  const out = new Float32Array(Math.round(0.1 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.05 * sr));
  return out;
}

function sfxMark(_p, sr) {
  return osc({ type: 'sine', freq: 880, freqEnd: 1760, dur: 0.28, sr, gain: 0.22, attack: 0.01, release: 0.12 });
}

function sfxShieldOn(_p, sr) {
  const whoosh = noise({ dur: 0.28, sr, gain: 0.3, filter: 'bandpass', cutoff: 900, attack: 0.03, release: 0.14 });
  const tone = osc({ type: 'sine', freq: 260, freqEnd: 420, dur: 0.3, sr, gain: 0.22, attack: 0.02, release: 0.15 });
  return mix(whoosh, tone);
}

function sfxShieldOff(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 240, dur: 0.16, sr, gain: 0.2, attack: 0.005, release: 0.09 });
}

function sfxShieldBreak(_p, sr) {
  const nz = noise({ dur: 0.3, sr, gain: 0.4, filter: 'highpass', cutoff: 1800, attack: 0.002, release: 0.16 });
  const thud = osc({ type: 'triangle', freq: 200, freqEnd: 70, dur: 0.3, sr, gain: 0.4, attack: 0.003, release: 0.15 });
  return mix(nz, thud);
}

function sfxPlayerHurt(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 110, freqEnd: 45, dur: 0.28, sr, gain: 0.5, attack: 0.003, release: 0.14 });
  const nz = noise({ dur: 0.2, sr, gain: 0.3, filter: 'lowpass', cutoff: 500, attack: 0.002, release: 0.1 });
  return mix(thud, nz);
}

function sfxWaveStart(_p, sr) {
  return notes({ freqs: [330, 415, 494], dur: 0.32, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.12, sr });
}

function sfxWaveClear(_p, sr) {
  return notes({ freqs: [523, 659, 784], dur: 0.36, gap: 0.11, type: 'triangle', gain: 0.22, attack: 0.02, release: 0.14, sr });
}

function sfxWeaponUnlock(_p, sr) {
  return notes({ freqs: [440, 554, 659, 880], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.15, sr });
}

function sfxSceneEnter(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 440], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.16, attack: 0.06, release: 0.18, sr });
}

function sfxBossSpawn(_p, sr) {
  const low = osc({ type: 'sawtooth', freq: 55, freqEnd: 40, dur: 0.8, sr, gain: 0.35, attack: 0.05, release: 0.4 });
  const nz = noise({ dur: 0.6, sr, gain: 0.25, filter: 'lowpass', cutoff: 300, attack: 0.03, release: 0.3 });
  return mix(low, nz);
}

function sfxBossHit(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 70, freqEnd: 45, dur: 0.2, sr, gain: 0.5, attack: 0.004, release: 0.1 });
  const nz = noise({ dur: 0.16, sr, gain: 0.32, filter: 'lowpass', cutoff: 160, attack: 0.003, release: 0.08 });
  return mix(thud, nz);
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}

function sfxSplat(_p, sr) {
  const nz = noise({ dur: 0.28, sr, gain: 0.5, filter: 'lowpass', cutoff: 700, attack: 0.002, release: 0.16 });
  const splat = osc({ type: 'sine', freq: 300, freqEnd: 80, dur: 0.3, sr, gain: 0.42, attack: 0.002, release: 0.18 });
  return mix(nz, splat);
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxWin(_p, sr) {
  return notes({ freqs: [392, 523, 659, 784], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.18, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.09, attack: 0.004, release: 0.03 });
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  shoot: sfxShoot,
  hit: sfxHit,
  kill: sfxKill,
  reload: sfxReload,
  reloadDone: sfxReloadDone,
  mark: sfxMark,
  shieldOn: sfxShieldOn,
  shieldOff: sfxShieldOff,
  shieldBreak: sfxShieldBreak,
  playerHurt: sfxPlayerHurt,
  waveStart: sfxWaveStart,
  waveClear: sfxWaveClear,
  weaponUnlock: sfxWeaponUnlock,
  sceneEnter: sfxSceneEnter,
  bossSpawn: sfxBossSpawn,
  bossHit: sfxBossHit,
  nearMiss: sfxNearMiss,
  splat: sfxSplat,
  death: sfxDeath,
  win: sfxWin,
  ui: sfxUi,
  milestone: sfxMilestone,
  newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 循环层（可无缝 loop 的 PCM）：低音 drone / 琶音 / 脉冲噪声
// ---------------------------------------------------------------------------

function loopBass(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    out[i] = Math.sin(2 * Math.PI * 55 * t) * 0.5 + Math.sin(2 * Math.PI * 82.5 * t) * 0.3;
    out[i] *= 0.10 + 0.04 * Math.sin(2 * Math.PI * 0.5 * t);
  }
  return out;
}

function loopArp(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const seq = [220, 261.63, 329.63, 261.63];
  const step = dur / seq.length;
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const idx = Math.floor(t / step) % seq.length;
    const f = seq[idx];
    const local = t % step;
    const env = Math.max(0, Math.min(1, Math.min(local / 0.03, (step - local) / 0.3)));
    out[i] = oscSample('triangle', 2 * Math.PI * f * local) * 0.16 * env;
  }
  return out;
}

function loopPulse(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = bandpass(buf, 1400, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.04 * Math.sin(2 * Math.PI * 1.0 * t);
  }
  return buf;
}

const LOOPS = {
  bgmBass: loopBass,
  bgmArp: loopArp,
  bgmPulse: loopPulse,
};

export const LOOP_NAMES = Object.keys(LOOPS);

// ---------------------------------------------------------------------------
// 公开合成接口（供 audio-check 离线调用）
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
  shoot: 'shoot',
  hit: 'hit',
  kill: 'kill',
  reload: 'reload',
  reloadDone: 'reloadDone',
  mark: 'mark',
  shieldOn: 'shieldOn',
  shieldOff: 'shieldOff',
  shieldBreak: 'shieldBreak',
  playerHurt: 'playerHurt',
  waveStart: 'waveStart',
  waveClear: 'waveClear',
  weaponUnlock: 'weaponUnlock',
  sceneEnter: 'sceneEnter',
  bossSpawn: 'bossSpawn',
  bossHit: 'bossHit',
  nearMiss: 'nearMiss',
  splat: 'splat',
  death: 'death',
  win: 'win',
  ui: 'ui',
  milestone: 'milestone',
  newRecord: 'newRecord',
};

const SFX_PRIORITY = {
  shoot: 5, kill: 5, splat: 5, death: 5,
  hit: 4, playerHurt: 4, shieldBreak: 4, bossHit: 4, win: 4,
  mark: 3, shieldOn: 3, weaponUnlock: 3, waveStart: 3, waveClear: 3, bossSpawn: 3,
  reload: 2, reloadDone: 2, shieldOff: 2, sceneEnter: 2, newRecord: 2,
  nearMiss: 1, ui: 1, milestone: 1,
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
    volume: clamp(Sdk.load('audioVolume', 0.7), 0, 1),
    muted: !!Sdk.load('audioMuted', false),
    unlocked: false,
    bgmActive: false,
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
    Sdk.save('audioMuted', state.muted);
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
    Sdk.save('audioVolume', state.volume);
  }

  function playBgm() {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmActive) return;
    state.bgmActive = true;
    startLoop('bgmBass');
    startLoop('bgmArp');
    startLoop('bgmPulse');
  }

  function stopBgm() {
    if (!state.bgmActive) return;
    state.bgmActive = false;
    for (const kind of Object.keys(state.loops)) stopLoop(kind);
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
