// src/core/audio.js — BUBBLE REEF · 程序化音频（WebAudio 标准 API，零依赖零外链）
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM，方便 tools/audio-check.mjs 在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer → AudioBufferSourceNode → GainNode → destination 播放；
//     BGM 用分层无缝循环（水声 ambience / 和弦 pad / 琶音 arp）程序化合成，不打包音频文件。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(mode), stopBgm() }
import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.22;

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
// 音效合成器
// ---------------------------------------------------------------------------

function sfxShot(_p, sr) {
  const whoosh = noise({ dur: 0.22, sr, gain: 0.3, filter: 'bandpass', cutoff: 900, attack: 0.02, release: 0.1 });
  const thunk = osc({ type: 'triangle', freq: 220, freqEnd: 180, dur: 0.1, sr, gain: 0.25, attack: 0.004, release: 0.05 });
  return mix(whoosh, thunk);
}

function sfxBounce(_p, sr) {
  return osc({ type: 'sine', freq: 360, freqEnd: 260, dur: 0.06, sr, gain: 0.2, attack: 0.002, release: 0.03 });
}

function sfxLand(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 90, dur: 0.08, sr, gain: 0.32, attack: 0.003, release: 0.04 });
  const click = noise({ dur: 0.03, sr, gain: 0.14, filter: 'highpass', cutoff: 1500, attack: 0.001, release: 0.015 });
  return mix(thud, click);
}

// 消除 pop：连击越高音越高（每 +1 半音，封顶 +12）
function sfxMatch(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 520 * Math.pow(2, combo / 12);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 0.6, dur: 0.16, sr, gain: 0.45, attack: 0.004, release: 0.08 });
  const pop = noise({ dur: 0.05, sr, gain: 0.24, filter: 'lowpass', cutoff: f * 4, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

// 整簇掉落：下坠琶音 + 水声
function sfxDrop(_p, sr) {
  const glide = osc({ type: 'sine', freq: 700, freqEnd: 190, dur: 0.32, sr, gain: 0.3, attack: 0.01, release: 0.12 });
  const splash = noise({ dur: 0.28, sr, gain: 0.2, filter: 'lowpass', cutoff: 520, attack: 0.02, release: 0.16 });
  return mix(glide, splash);
}

function sfxGold(_p, sr) {
  return notes({ freqs: [659.25, 880, 1318.5], dur: 0.28, gap: 0.07, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.12, sr });
}

// 百搭装载：彩虹琶音
function sfxWildcardArm(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.3, gap: 0.06, type: 'sine', gain: 0.2, attack: 0.01, release: 0.14, sr });
}

// 潮汐预览：声呐 ping
function sfxPreview(_p, sr) {
  const ping = osc({ type: 'sine', freq: 1100, freqEnd: 700, dur: 0.14, sr, gain: 0.24, attack: 0.004, release: 0.08 });
  return ping;
}

// 顶棚下沉：低频隆隆
function sfxSink(_p, sr) {
  const rumble = osc({ type: 'triangle', freq: 80, freqEnd: 55, dur: 0.4, sr, gain: 0.35, attack: 0.02, release: 0.2 });
  const nz = noise({ dur: 0.3, sr, gain: 0.18, filter: 'lowpass', cutoff: 200, attack: 0.02, release: 0.18 });
  return mix(rumble, nz);
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 480, freqEnd: 52, dur: 0.9, sr, gain: 0.4, attack: 0.01, release: 0.24 });
  const nz = noise({ dur: 0.65, sr, gain: 0.2, filter: 'lowpass', cutoff: 620, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxLevelClear(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.4, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.18, sr });
}

function sfxWon(_p, sr) {
  const fanfare = notes({ freqs: [392, 523.25, 659.25, 783.99, 1046.5], dur: 0.42, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.2, sr });
  const crash = noise({ dur: 0.5, sr, gain: 0.14, filter: 'lowpass', cutoff: 900, attack: 0.004, release: 0.25 });
  return mix(fanfare, crash);
}

function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 500, freqEnd: 220, dur: 0.15, sr, gain: 0.2, attack: 0.005, release: 0.08 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  shot: sfxShot,
  bounce: sfxBounce,
  land: sfxLand,
  match: sfxMatch,
  drop: sfxDrop,
  gold: sfxGold,
  wildcardArm: sfxWildcardArm,
  preview: sfxPreview,
  sink: sfxSink,
  death: sfxDeath,
  levelClear: sfxLevelClear,
  won: sfxWon,
  comboBreak: sfxComboBreak,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（程序化 BGM，分层 + 无缝循环）
// ---------------------------------------------------------------------------

// 水声 ambience：4s 低通白噪 + 0.25Hz 慢 LFO（整数周期，无缝）
function loopWater(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 360, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

// 和弦 pad：A 小调 A2-C3-E3，8s 整数周期叠加（无缝）
function loopPad(sr) {
  const dur = 8;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const freqs = [110, 130.81, 164.81];
  for (const f of freqs) {
    for (let i = 0; i < n; i += 1) {
      out[i] += 0.05 * Math.sin((2 * Math.PI * f * i) / sr) * (0.7 + 0.3 * Math.sin((2 * Math.PI * 0.125 * i) / sr));
    }
  }
  return normalizeRms(out, 0.1);
}

// 琶音：A 小调琶音，整数周期（无缝）
function loopArp(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const freqs = [220, 261.63, 329.63, 440];
  const step = dur / freqs.length;
  for (let k = 0; k < freqs.length; k += 1) {
    const f = freqs[k];
    const start = Math.round(k * step * sr);
    const end = Math.round((k + 1) * step * sr);
    for (let i = start; i < end && i < n; i += 1) {
      const t = (i - start) / sr;
      const env = Math.min(1, t / 0.05) * Math.min(1, Math.max(0, (step - t) / 0.2));
      out[i] += 0.06 * Math.sin((2 * Math.PI * f * i) / sr) * env;
    }
  }
  return normalizeRms(out, 0.08);
}

const LOOPS = {
  water: loopWater,
  pad: loopPad,
  arp: loopArp,
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

const SFX_PRIORITY = {
  match: 6, drop: 6, gold: 6,
  death: 5, won: 5, levelClear: 5, newRecord: 5,
  wildcardArm: 4, preview: 4, sink: 4,
  shot: 3, land: 3, bounce: 3, comboBreak: 3,
  chime: 2, ui: 1,
};

const EVENT_TO_SFX = {
  shot: 'shot',
  bounce: 'bounce',
  land: 'land',
  match: 'match',
  drop: 'drop',
  gold: 'gold',
  wildcardArm: 'wildcardArm',
  preview: 'preview',
  sink: 'sink',
  death: 'death',
  levelClear: 'levelClear',
  won: 'won',
  comboBreak: 'comboBreak',
  tutorialDone: 'chime',
  ui: 'ui',
  newRecord: 'newRecord',
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
    state.bgmBus.gain.value = 1;
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
    for (const k of Object.keys(state.loops)) stopLoop(k);
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

  function playBgm(_mode = 'main') {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopAllLoops();
    startLoop('water');
    startLoop('pad');
    startLoop('arp');
  }

  function stopBgm() {
    stopAllLoops();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
