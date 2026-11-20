// src/core/audio.js — CANNON ECHO · 音效合成与播放（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效/循环 = 振荡器 + 噪声 + 包络，
//     直接算成 mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer 播放；BGM 用 synthLoop 生成的 loop 层（3 场景包各一条）。
//
// 契约（docs/analysis.md 事件表）：
//   createAudio({ save, load }) → { unlock, event(type,payload), setMuted(b), setVolume(v), playBgm(name), stopBgm() }
// 事件名：shot / hit / break / echoBounce / waveEnter / overheat / overheatLock / upgrade /
//   bossSpawn / bossHit / bossBreak / death / nearMiss / ui / milestone / echoRoar。

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 4;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
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

// 无重叠琶音循环（noteDur 均分总时长，保证首尾无缝）
function loopNotes(freqs, { dur = 4, type = 'triangle', gain = 0.1, sr = SAMPLE_RATE } = {}) {
  const noteDur = dur / freqs.length;
  const out = new Float32Array(Math.max(1, Math.round(dur * sr)));
  freqs.forEach((f, k) => {
    const s = osc({ type, freq: f, dur: noteDur * 0.9, sr, gain, attack: 0.02, release: noteDur * 0.5 });
    addAt(out, s, Math.round(k * noteDur * sr));
  });
  return out;
}

// ---------------------------------------------------------------------------
// 各音效合成器（(payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

function sfxShot(_p, sr) {
  const body = osc({ type: 'square', freq: 180, freqEnd: 70, dur: 0.12, sr, gain: 0.22, attack: 0.003, release: 0.05 });
  const crack = noise({ dur: 0.05, sr, gain: 0.16, filter: 'highpass', cutoff: 900, attack: 0.001, release: 0.03 });
  return mix(body, crack);
}

function sfxHit(_p, sr) {
  return osc({ type: 'triangle', freq: 300, freqEnd: 170, dur: 0.09, sr, gain: 0.3, attack: 0.003, release: 0.05 });
}

function sfxBreak(p, sr) {
  const value = clamp(p.value ?? 1, 1, 60);
  const f = 480 * Math.pow(2, -value / 40);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 0.6, dur: 0.2, sr, gain: 0.4, attack: 0.003, release: 0.1 });
  const pop = noise({ dur: 0.07, sr, gain: 0.22, filter: 'lowpass', cutoff: f * 4, attack: 0.002, release: 0.04 });
  return mix(tone, pop);
}

function sfxEchoBounce(_p, sr) {
  const ping = osc({ type: 'sine', freq: 760, freqEnd: 1500, dur: 0.16, sr, gain: 0.2, attack: 0.004, release: 0.1 });
  const shimmer = noise({ dur: 0.1, sr, gain: 0.1, filter: 'bandpass', cutoff: 2200, attack: 0.004, release: 0.06 });
  return mix(ping, shimmer);
}

function sfxWaveEnter(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.16, attack: 0.06, release: 0.16, sr });
}

function sfxOverheat(_p, sr) {
  const hiss = noise({ dur: 0.35, sr, gain: 0.3, filter: 'highpass', cutoff: 1800, attack: 0.02, release: 0.15 });
  const buzz = osc({ type: 'sawtooth', freq: 120, freqEnd: 60, dur: 0.3, sr, gain: 0.18, attack: 0.01, release: 0.12 });
  return mix(hiss, buzz);
}

function sfxOverheatLock(_p, sr) {
  return osc({ type: 'square', freq: 440, freqEnd: 440, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}

function sfxUpgrade(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.14, sr });
}

function sfxBossSpawn(_p, sr) {
  const drone = osc({ type: 'sawtooth', freq: 55, freqEnd: 110, dur: 0.8, sr, gain: 0.22, attack: 0.06, release: 0.3 });
  const nz = noise({ dur: 0.6, sr, gain: 0.14, filter: 'lowpass', cutoff: 300, attack: 0.04, release: 0.28 });
  return mix(drone, nz);
}

function sfxBossHit(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 70, freqEnd: 45, dur: 0.2, sr, gain: 0.5, attack: 0.004, release: 0.1 });
  const nz = noise({ dur: 0.16, sr, gain: 0.3, filter: 'lowpass', cutoff: 160, attack: 0.003, release: 0.08 });
  return mix(thud, nz);
}

function sfxBossBreak(_p, sr) {
  const chord = notes({ freqs: [55, 82.41, 110, 164.81], dur: 0.9, gap: 0, type: 'triangle', gain: 0.14, attack: 0.02, release: 0.35, sr });
  const crash = noise({ dur: 0.5, sr, gain: 0.16, filter: 'lowpass', cutoff: 900, attack: 0.004, release: 0.25 });
  return mix(chord, crash);
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 500, freqEnd: 55, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

function sfxEchoRoar(_p, sr) {
  const roar = noise({ dur: 0.5, sr, gain: 0.3, filter: 'bandpass', cutoff: 700, attack: 0.02, release: 0.22 });
  const low = osc({ type: 'sawtooth', freq: 82, freqEnd: 55, dur: 0.5, sr, gain: 0.16, attack: 0.01, release: 0.2 });
  return mix(roar, low);
}

const SYNTH = {
  shot: sfxShot,
  hit: sfxHit,
  break: sfxBreak,
  echoBounce: sfxEchoBounce,
  waveEnter: sfxWaveEnter,
  overheat: sfxOverheat,
  overheatLock: sfxOverheatLock,
  upgrade: sfxUpgrade,
  bossSpawn: sfxBossSpawn,
  bossHit: sfxBossHit,
  bossBreak: sfxBossBreak,
  death: sfxDeath,
  nearMiss: sfxNearMiss,
  ui: sfxUi,
  milestone: sfxMilestone,
  echoRoar: sfxEchoRoar,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop 的 PCM）：三场景包 BGM
// ---------------------------------------------------------------------------

function loopMorning(sr) {
  return loopNotes([261.63, 329.63, 392.00, 523.25, 392.00, 329.63], { dur: 4.8, type: 'triangle', gain: 0.10, sr });
}

function loopSnow(sr) {
  return loopNotes([220.00, 261.63, 329.63, 261.63], { dur: 4.8, type: 'sine', gain: 0.10, sr });
}

function loopLava(sr) {
  const arp = loopNotes([110, 138.59, 164.81, 138.59], { dur: 3.2, type: 'sawtooth', gain: 0.07, sr });
  const n = Math.max(1, Math.round(3.2 * sr));
  let nz = new Float32Array(n);
  for (let i = 0; i < n; i += 1) nz[i] = Math.random() * 2 - 1;
  nz = lowpass(nz, 180, sr);
  nz = normalizeRms(nz, 0.06);
  return mix(arp, nz);
}

const LOOPS = {
  bgmMorning: loopMorning,
  bgmSnow: loopSnow,
  bgmLava: loopLava,
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

const SFX_PRIORITY = {
  bossBreak: 6, break: 6, echoRoar: 6,
  death: 5, bossSpawn: 5, overheat: 5,
  bossHit: 4, hit: 4, echoBounce: 4,
  shot: 3, upgrade: 3, waveEnter: 3, overheatLock: 3,
  nearMiss: 2, milestone: 2, ui: 1,
};

const EVENT_TO_SFX = {
  shot: 'shot',
  hit: 'hit',
  break: 'break',
  echoBounce: 'echoBounce',
  waveEnter: 'waveEnter',
  overheat: 'overheat',
  overheatLock: 'overheatLock',
  upgrade: 'upgrade',
  bossSpawn: 'bossSpawn',
  bossHit: 'bossHit',
  bossBreak: 'bossBreak',
  death: 'death',
  nearMiss: 'nearMiss',
  milestone: 'milestone',
  echoRoar: 'echoRoar',
  ui: 'ui',
};

// ---------------------------------------------------------------------------
// 播放层
// ---------------------------------------------------------------------------

export function createAudio({ save, load } = {}) {
  const noSave = (k, v) => {};
  const noLoad = (k, d) => d;
  const saveFn = save || noSave;
  const loadFn = load || noLoad;

  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: clamp(loadFn('audioVolume', 0.7), 0, 1),
    muted: !!loadFn('audioMuted', false),
    unlocked: false,
    bgm: null, // { name, src }
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

  function stopBgmSource() {
    if (state.bgm && state.bgm.src) {
      try { state.bgm.src.stop(); } catch { /* noop */ }
    }
    state.bgm = null;
  }

  function unlock() {
    ensureCtx();
    state.unlocked = true;
  }

  function event(type, payload = {}) {
    if (!type) return;
    const name = EVENT_TO_SFX[type];
    if (name) playSfx(name, payload);
  }

  function setMuted(b) {
    state.muted = !!b;
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
    saveFn('audioMuted', state.muted);
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
    saveFn('audioVolume', state.volume);
  }

  function playBgm(name) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgm && state.bgm.name === name) return;
    stopBgmSource();
    if (!LOOPS[name]) return;
    const pcm = synthLoop(name, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(state.bgmBus);
    src.start();
    state.bgm = { name, src };
  }

  function stopBgm() {
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
