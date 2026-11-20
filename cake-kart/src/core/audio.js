// src/core/audio.js — CAKE KART · 程序化音频（WebAudio 标准 API，零依赖零外链）。
// 采样级合成器（纯函数）+ 浏览器播放层；BGM 程序化合成循环，不打包音频文件。
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(mode), stopBgm() }。

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
// 各音效合成器
// ---------------------------------------------------------------------------

function sfxEngine(p, sr) {
  const rpm = clamp(p.rpm ?? 0, 0, 1);
  return osc({ type: 'sawtooth', freq: 90 + rpm * 80, freqEnd: 95 + rpm * 85, dur: 0.12, sr, gain: 0.16, attack: 0.02, release: 0.06 });
}

function sfxDrift(p, sr) {
  return noise({ dur: 0.35, sr, gain: 0.3, filter: 'bandpass', cutoff: 900, attack: 0.03, release: 0.16 });
}

function sfxBoost(p, sr) {
  const up = osc({ type: 'sawtooth', freq: 220, freqEnd: 880, dur: 0.4, sr, gain: 0.3, attack: 0.01, release: 0.16 });
  const nz = noise({ dur: 0.3, sr, gain: 0.2, filter: 'highpass', cutoff: 1400, attack: 0.01, release: 0.14 });
  return mix(up, nz);
}

function sfxItemPickup(p, sr) {
  return notes({ freqs: [660, 880], dur: 0.14, gap: 0.06, type: 'triangle', gain: 0.22, attack: 0.004, release: 0.06, sr });
}

function sfxItemUse(p, sr) {
  return osc({ type: 'square', freq: 520, freqEnd: 300, dur: 0.1, sr, gain: 0.2, attack: 0.003, release: 0.05 });
}

function sfxMissileHit(p, sr) {
  const boom = noise({ dur: 0.4, sr, gain: 0.4, filter: 'lowpass', cutoff: 320, attack: 0.003, release: 0.2 });
  const thud = osc({ type: 'triangle', freq: 90, freqEnd: 40, dur: 0.3, sr, gain: 0.4, attack: 0.004, release: 0.14 });
  return mix(boom, thud);
}

function sfxShieldBlock(p, sr) {
  return osc({ type: 'sine', freq: 1200, freqEnd: 800, dur: 0.1, sr, gain: 0.24, attack: 0.002, release: 0.05 });
}

function sfxCakeBlind(p, sr) {
  const splat = noise({ dur: 0.25, sr, gain: 0.34, filter: 'lowpass', cutoff: 500, attack: 0.002, release: 0.12 });
  const tone = osc({ type: 'triangle', freq: 200, freqEnd: 90, dur: 0.2, sr, gain: 0.26, attack: 0.004, release: 0.1 });
  return mix(splat, tone);
}

function sfxCrash(p, sr) {
  const bang = noise({ dur: 0.4, sr, gain: 0.44, filter: 'lowpass', cutoff: 600, attack: 0.002, release: 0.22 });
  const low = osc({ type: 'triangle', freq: 70, freqEnd: 36, dur: 0.32, sr, gain: 0.4, attack: 0.004, release: 0.16 });
  return mix(bang, low);
}

function sfxLap(p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.2, gap: 0.09, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.1, sr });
}

function sfxFinish(p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.32, gap: 0.12, type: 'triangle', gain: 0.26, attack: 0.01, release: 0.16, sr });
}

function sfxNearMiss(p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxMilestone(p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.05, sr, gain: 0.08, attack: 0.004, release: 0.03 });
}

function sfxUi(p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

function sfxOffroad(p, sr) {
  return noise({ dur: 0.22, sr, gain: 0.24, filter: 'lowpass', cutoff: 700, attack: 0.004, release: 0.1 });
}

const SYNTH = {
  engine: sfxEngine,
  drift: sfxDrift,
  boost: sfxBoost,
  itemPickup: sfxItemPickup,
  itemUse: sfxItemUse,
  missileHit: sfxMissileHit,
  shieldBlock: sfxShieldBlock,
  cakeBlind: sfxCakeBlind,
  crash: sfxCrash,
  lap: sfxLap,
  finish: sfxFinish,
  nearMiss: sfxNearMiss,
  milestone: sfxMilestone,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  offroad: sfxOffroad,
};

export const SFX_NAMES = Object.keys(SYNTH);

const EVENT_TO_SFX = {
  driftStart: 'drift',
  driftTier: 'milestone',
  boost: 'boost',
  itemPickup: 'itemPickup',
  itemUse: 'itemUse',
  missileHit: 'missileHit',
  shieldBlock: 'shieldBlock',
  cakeBlind: 'cakeBlind',
  crash: 'crash',
  lap: 'lap',
  finish: 'finish',
  nearMiss: 'nearMiss',
  milestone: 'milestone',
  offroad: 'offroad',
  ui: 'ui',
  newRecord: 'newRecord',
};

const SFX_PRIORITY = {
  boost: 6, missileHit: 6, cakeBlind: 6, crash: 6, finish: 6,
  lap: 5, itemPickup: 5, newRecord: 5,
  drift: 4, shieldBlock: 4,
  itemUse: 3, offroad: 3,
  nearMiss: 2, driftTier: 1, milestone: 1, ui: 1,
};

// ---------------------------------------------------------------------------
// 程序化 BGM 循环（合成一段 4s 甜点风 arpeggio，无缝 loop）
// ---------------------------------------------------------------------------

function synthBgm(sr = SAMPLE_RATE) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // C 大调明亮琶音：C4 E4 G4 A4 循环
  const chord = [261.63, 329.63, 392.0, 440.0, 329.63, 261.63];
  const step = dur / chord.length;
  chord.forEach((f, k) => {
    const s = osc({ type: 'triangle', freq: f, dur: step * 0.9, sr, gain: 0.12, attack: 0.02, release: 0.12 });
    addAt(out, s, Math.round(k * step * sr));
    const bass = osc({ type: 'sine', freq: f / 2, dur: step, sr, gain: 0.1, attack: 0.02, release: 0.15 });
    addAt(out, bass, Math.round(k * step * sr));
  });
  return normalizeRms(out, 0.18);
}

export const LOOP_NAMES = ['bgm'];

export function synthLoop(name, sr = SAMPLE_RATE) {
  if (name === 'bgm') return synthBgm(sr);
  throw new Error(`unknown loop: ${name}`);
}

export function synthSfx(name, payload = {}, sr = SAMPLE_RATE) {
  const fn = SYNTH[name];
  if (!fn) throw new Error(`unknown sfx: ${name}`);
  return fn(payload || {}, sr);
}

// ---------------------------------------------------------------------------
// 播放层
// ---------------------------------------------------------------------------

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: 0.8,
    muted: false,
    unlocked: false,
    bgmSource: null,
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
    if (type === 'engine') {
      playSfx('engine', payload);
      return;
    }
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

  async function playBgm() {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
    const pcm = synthBgm(ctx.sampleRate);
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
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
