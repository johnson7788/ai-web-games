// src/core/audio.js — NEO TETRA · 音效与 BGM（WebAudio 程序化合成，零依赖零外链）
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/WebAudio）：音效 = 振荡器 + 噪声 + 包络 → mono Float32Array PCM；
//     BGM = 步进音序器叠加 bass/lead → 可无缝循环 PCM。tools/audio-check.mjs 在 Node 里离线校验。
//  2) 浏览器播放层：PCM 灌 AudioBuffer → AudioBufferSourceNode → GainNode → destination；
//     BGM 层用 loop 的 AudioBufferSourceNode；SFX 按优先级叠层去重。
//
// 契约：createAudio() → { unlock(), event(type,payload), setMuted(b), setVolume(v), playBgm(name), stopBgm() }

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 20;      // 同一音效去重窗口
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

function normalizePeak(input, target) {
  let peak = 0;
  for (let i = 0; i < input.length; i += 1) peak = Math.max(peak, Math.abs(input[i]));
  if (peak > 1e-6 && peak > target) {
    const k = target / peak;
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
function sfxMove(_p, sr) {
  return osc({ type: 'sine', freq: 320, freqEnd: 250, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
}

function sfxRotate(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 520, freqEnd: 620, dur: 0.06, sr, gain: 0.22, attack: 0.003, release: 0.03 }),
    osc({ type: 'triangle', freq: 660, freqEnd: 720, dur: 0.05, sr, gain: 0.14, attack: 0.003, release: 0.03 }),
  );
}

function sfxSoftDrop(_p, sr) {
  return osc({ type: 'sine', freq: 440, freqEnd: 360, dur: 0.06, sr, gain: 0.16, attack: 0.002, release: 0.04 });
}

function sfxHardDrop(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 160, freqEnd: 70, dur: 0.1, sr, gain: 0.42, attack: 0.002, release: 0.05 });
  const click = noise({ dur: 0.04, sr, gain: 0.18, filter: 'highpass', cutoff: 1400, attack: 0.001, release: 0.02 });
  return mix(thud, click);
}

function sfxHold(_p, sr) {
  return osc({ type: 'sine', freq: 500, freqEnd: 420, dur: 0.1, sr, gain: 0.24, attack: 0.004, release: 0.06 });
}

function sfxLock(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 180, freqEnd: 110, dur: 0.08, sr, gain: 0.3, attack: 0.002, release: 0.04 });
  const click = noise({ dur: 0.03, sr, gain: 0.14, filter: 'bandpass', cutoff: 900, attack: 0.001, release: 0.02 });
  return mix(thud, click);
}

function sfxLineClear(p, sr) {
  const n = clamp(p.n ?? 1, 1, 4);
  const base = [392, 523.25, 659.25, 783.99];
  return notes({ freqs: base.slice(0, Math.max(2, n)), dur: 0.16, gap: 0.05, type: 'triangle', gain: 0.22, attack: 0.006, release: 0.08, sr });
}

function sfxTetra(_p, sr) {
  const chord = notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.5, gap: 0.04, type: 'triangle', gain: 0.16, attack: 0.01, release: 0.2, sr });
  const crash = noise({ dur: 0.6, sr, gain: 0.18, filter: 'lowpass', cutoff: 2200, attack: 0.004, release: 0.3 });
  return mix(chord, crash);
}

function sfxHeatUp(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 900, dur: 0.12, sr, gain: 0.2, attack: 0.004, release: 0.06 });
}

function sfxWhiteHotStart(_p, sr) {
  const sweep = osc({ type: 'sawtooth', freq: 120, freqEnd: 720, dur: 0.5, sr, gain: 0.2, attack: 0.03, release: 0.2 });
  const nz = noise({ dur: 0.5, sr, gain: 0.2, filter: 'bandpass', cutoff: 1800, attack: 0.02, release: 0.2 });
  return mix(sweep, nz);
}

function sfxWhiteHotEnd(_p, sr) {
  return osc({ type: 'triangle', freq: 760, freqEnd: 180, dur: 0.4, sr, gain: 0.2, attack: 0.02, release: 0.18 });
}

function sfxLevelUp(_p, sr) {
  return notes({ freqs: [440, 554.37, 659.25, 880], dur: 0.2, gap: 0.07, type: 'triangle', gain: 0.2, attack: 0.008, release: 0.1, sr });
}

function sfxLayerEnter(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 440, 523.25], dur: 0.4, gap: 0.09, type: 'triangle', gain: 0.14, attack: 0.04, release: 0.16, sr });
}

function sfxGift(_p, sr) {
  return notes({ freqs: [659.25, 880, 1046.5], dur: 0.14, gap: 0.05, type: 'sine', gain: 0.2, attack: 0.004, release: 0.07, sr });
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 660, freqEnd: 55, dur: 0.9, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.16, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 700, freqEnd: 900, dur: 0.05, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

const SYNTH = {
  move: sfxMove,
  rotate: sfxRotate,
  softDrop: sfxSoftDrop,
  hardDrop: sfxHardDrop,
  hold: sfxHold,
  lock: sfxLock,
  lineClear: sfxLineClear,
  tetra: sfxTetra,
  heatUp: sfxHeatUp,
  whiteHotStart: sfxWhiteHotStart,
  whiteHotEnd: sfxWhiteHotEnd,
  levelUp: sfxLevelUp,
  layerEnter: sfxLayerEnter,
  gift: sfxGift,
  death: sfxDeath,
  win: sfxWin,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  milestone: sfxMilestone,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 层（步进音序器 → 可无缝循环 PCM）
// ---------------------------------------------------------------------------
function patternLoop({ bpm = 100, steps = 16, bass = [], lead = [], bassType = 'triangle',
                       leadType = 'sine', bassGain = 0.1, leadGain = 0.07, sr = SAMPLE_RATE } = {}) {
  const stepDur = 60 / bpm / 4;
  const totalDur = steps * stepDur;
  const n = Math.max(1, Math.round(totalDur * sr));
  const out = new Float32Array(n);
  for (let s = 0; s < steps; s += 1) {
    const t = s * stepDur;
    const bf = bass[s % bass.length];
    if (bf) {
      addAt(out, osc({ type: bassType, freq: bf, dur: Math.min(stepDur * 0.9, 0.45), sr, gain: bassGain, attack: 0.01, release: 0.08 }), Math.round(t * sr));
    }
    const lf = lead[s % lead.length];
    if (lf) {
      addAt(out, osc({ type: leadType, freq: lf, dur: Math.min(stepDur * 0.85, 0.35), sr, gain: leadGain, attack: 0.008, release: 0.06 }), Math.round(t * sr));
    }
  }
  return normalizePeak(out, 0.7);
}

function loopCopper(sr) {
  return patternLoop({
    bpm: 96, steps: 32,
    bass: [110, 110, 130.81, 110, 110, 110, 98, 98],
    lead: [220, 261.63, 329.63, 261.63, 220, 196, 220, 246.94],
    bassType: 'triangle', leadType: 'triangle', bassGain: 0.11, leadGain: 0.07, sr,
  });
}

function loopIce(sr) {
  return patternLoop({
    bpm: 122, steps: 32,
    bass: [174.61, 174.61, 146.83, 130.81, 174.61, 174.61, 196, 220],
    lead: [349.23, 440, 523.25, 440, 349.23, 392, 440, 523.25],
    bassType: 'sine', leadType: 'sine', bassGain: 0.1, leadGain: 0.08, sr,
  });
}

function loopCore(sr) {
  return patternLoop({
    bpm: 72, steps: 32,
    bass: [82.41, 82.41, 73.42, 65.41, 82.41, 82.41, 87.31, 98],
    lead: [164.81, 196, 220, 246.94, 220, 196, 164.81, 196],
    bassType: 'sawtooth', leadType: 'triangle', bassGain: 0.09, leadGain: 0.07, sr,
  });
}

function loopWhiteHot(sr) {
  return patternLoop({
    bpm: 160, steps: 32,
    bass: [110, 130.81, 164.81, 196, 220, 196, 164.81, 130.81],
    lead: [440, 523.25, 659.25, 783.99, 880, 783.99, 659.25, 523.25],
    bassType: 'square', leadType: 'triangle', bassGain: 0.08, leadGain: 0.09, sr,
  });
}

const LOOPS = {
  copper: loopCopper,
  ice: loopIce,
  core: loopCore,
  whiteHot: loopWhiteHot,
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

// ---------------------------------------------------------------------------
// 播放层
// ---------------------------------------------------------------------------
const SFX_PRIORITY = {
  tetra: 6, lineClear: 6, whiteHotStart: 6,
  death: 5, win: 5, newRecord: 5,
  hardDrop: 4, layerEnter: 4, levelUp: 4,
  lock: 3, gift: 3,
  move: 2, rotate: 2, softDrop: 2, hold: 2, heatUp: 2, whiteHotEnd: 2,
  ui: 1, milestone: 1,
};

const EVENT_TO_SFX = {
  move: 'move',
  rotate: 'rotate',
  softDrop: 'softDrop',
  hardDrop: 'hardDrop',
  hold: 'hold',
  lock: 'lock',
  lineClear: 'lineClear',
  tetra: 'tetra',
  heatUp: 'heatUp',
  whiteHotStart: 'whiteHotStart',
  whiteHotEnd: 'whiteHotEnd',
  levelUp: 'levelUp',
  layerEnter: 'layerEnter',
  gift: 'gift',
  death: 'death',
  win: 'win',
  ui: 'ui',
  newRecord: 'newRecord',
  milestone: 'milestone',
};

const SCENE_BGM = { copper: 'copper', ice: 'ice', core: 'core' };

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    bgmBus: null,
    volume: 0.7,
    muted: false,
    unlocked: false,
    bgmSource: null,
    bgmName: null,
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
    state.bgmBus.gain.value = 0.9;
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
    src.connect(state.bgmBus);
    src.start();
    state.loops[kind] = src;
  }

  function stopAllLoops() {
    for (const k of Object.keys(state.loops)) {
      try { state.loops[k].stop(); } catch { /* noop */ }
      delete state.loops[k];
    }
  }

  function playBgm(name) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmName === name) return;
    stopBgm();
    state.bgmName = name;
    const kind = typeof name === 'string' ? name : (SCENE_BGM[name] || 'copper');
    if (LOOPS[kind]) startLoop(kind);
  }

  function stopBgm() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
    stopAllLoops();
    state.bgmName = null;
  }

  function unlock() {
    ensureCtx();
    resumeIfNeeded();
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
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
