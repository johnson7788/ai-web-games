// src/core/audio.js — DUNE BUGGY · 音效合成与播放（WebAudio 标准 API，零依赖零外链）
//
// 两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络 → mono Float32Array PCM，
//     让 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer → AudioBufferSourceNode → GainNode → destination；
//     循环层（引擎 / 沙暴风噪）用 loop 的 AudioBufferSourceNode 长循环。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(buffer), stopBgm() }

import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 18;
const NOISE_RMS = 0.24;

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

function sfxThrottle(_p, sr) {
  return noise({ dur: 0.18, sr, gain: 0.3, filter: 'bandpass', cutoff: 240, attack: 0.02, release: 0.08 });
}

function sfxSteer(_p, sr) {
  return osc({ type: 'sine', freq: 340, freqEnd: 260, dur: 0.05, sr, gain: 0.12, attack: 0.004, release: 0.03 });
}

function sfxTune(_p, sr) {
  const click = noise({ dur: 0.04, sr, gain: 0.2, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.02 });
  const blip = osc({ type: 'sine', freq: 620, freqEnd: 880, dur: 0.1, sr, gain: 0.22, attack: 0.004, release: 0.05 });
  return mix(click, blip);
}

function sfxRidgeBoost(_p, sr) {
  const a = osc({ type: 'sine', freq: 720, freqEnd: 980, dur: 0.12, sr, gain: 0.2, attack: 0.004, release: 0.06 });
  const b = osc({ type: 'triangle', freq: 1440, freqEnd: 1560, dur: 0.1, sr, gain: 0.1, attack: 0.004, release: 0.05 });
  return mix(a, b);
}

function sfxCheckpoint(_p, sr) {
  return osc({ type: 'triangle', freq: 880, freqEnd: 880, dur: 0.09, sr, gain: 0.22, attack: 0.004, release: 0.05 });
}

function sfxJump(_p, sr) {
  return noise({ dur: 0.4, sr, gain: 0.34, filter: 'bandpass', cutoff: 900, attack: 0.04, release: 0.18 });
}

function sfxLand(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 120, freqEnd: 60, dur: 0.22, sr, gain: 0.4, attack: 0.004, release: 0.12 });
  const nz = noise({ dur: 0.18, sr, gain: 0.24, filter: 'lowpass', cutoff: 220, attack: 0.003, release: 0.1 });
  return mix(thud, nz);
}

function sfxOffTrack(_p, sr) {
  return noise({ dur: 0.3, sr, gain: 0.3, filter: 'lowpass', cutoff: 180, attack: 0.02, release: 0.16 });
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 620, freqEnd: 760, dur: 0.05, sr, gain: 0.09, attack: 0.003, release: 0.025 });
}

function sfxStageStart(_p, sr) {
  return notes({ freqs: [220, 277.18, 329.63], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.16, attack: 0.04, release: 0.15, sr });
}

function sfxStageClear(_p, sr) {
  return notes({ freqs: [392, 493.88, 587.33, 783.99], dur: 0.35, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.14, sr });
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 60, dur: 0.9, sr, gain: 0.36, attack: 0.01, release: 0.24 });
  const nz = noise({ dur: 0.7, sr, gain: 0.2, filter: 'lowpass', cutoff: 620, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxChampion(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.18, sr });
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxChime(_p, sr) {
  return notes({ freqs: [880, 1318.5], dur: 0.28, gap: 0.06, type: 'sine', gain: 0.16, attack: 0.01, release: 0.12, sr });
}

const SYNTH = {
  throttle: sfxThrottle,
  steer: sfxSteer,
  tune: sfxTune,
  ridgeBoost: sfxRidgeBoost,
  checkpoint: sfxCheckpoint,
  jump: sfxJump,
  land: sfxLand,
  offTrack: sfxOffTrack,
  nearMiss: sfxNearMiss,
  milestone: sfxMilestone,
  stageStart: sfxStageStart,
  stageClear: sfxStageClear,
  death: sfxDeath,
  champion: sfxChampion,
  newRecord: sfxNewRecord,
  ui: sfxUi,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop）
// ---------------------------------------------------------------------------

// 引擎循环：4s 低频蜂鸣 + 0.5Hz 呼吸 LFO（1 周期，首尾连续）
function loopEngine(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const eng = 0.09 * Math.sin(2 * Math.PI * 46 * t) + 0.05 * Math.sin(2 * Math.PI * 92 * t);
    const lfo = 0.06 + 0.03 * Math.sin(2 * Math.PI * 0.5 * t);
    out[i] = eng * lfo;
  }
  return out;
}

// 沙暴风噪：4s 低通白噪 + 0.25Hz 慢 LFO（1 周期）
function loopWind(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 420, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

const LOOPS = {
  engine: loopEngine,
  wind: loopWind,
};

export const LOOP_NAMES = Object.keys(LOOPS);

// ---------------------------------------------------------------------------
// 公开合成接口
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
  throttle: 'throttle',
  steer: 'steer',
  tune: 'tune',
  ridgeBoost: 'ridgeBoost',
  checkpoint: 'checkpoint',
  jump: 'jump',
  land: 'land',
  offTrack: 'offTrack',
  nearMiss: 'nearMiss',
  speedMilestone: 'milestone',
  stageStart: 'stageStart',
  stageClear: 'stageClear',
  death: 'death',
  champion: 'champion',
  newRecord: 'newRecord',
  ui: 'ui',
  tutorialDone: 'chime',
};

const SFX_PRIORITY = {
  stageClear: 6, champion: 6, newRecord: 6,
  checkpoint: 5, jump: 5, death: 5,
  land: 4, tune: 4, stageStart: 4,
  ridgeBoost: 3, offTrack: 3, nearMiss: 3,
  throttle: 2, milestone: 2, steer: 1, ui: 1, chime: 2,
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
    loops: { engine: null, wind: null },
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
      startLoop('engine'); // 引擎底噪
    }
  }

  function event(type, payload = {}) {
    if (!type) return;
    if (type === 'stormEnter' || type === 'stageStart') {
      // 沙暴赛段风噪（stageStart 后按 hud 决定，此处只响应显式事件）
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

  async function playBgm(src) {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
    try {
      let buf = null;
      if (src && typeof src === 'object' && typeof src.getChannelData === 'function') {
        buf = src;
      } else if (typeof src === 'string') {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`bgm fetch ${res.status}`);
        buf = await ctx.decodeAudioData(await res.arrayBuffer());
      }
      if (!buf) return;
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.connect(state.bgmBus);
      node.start();
      state.bgmSource = node;
    } catch { /* BGM 加载失败静默降级 */ }
  }

  function stopBgm() {
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
