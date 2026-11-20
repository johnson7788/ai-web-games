// src/core/audio.js — STAR SWAP · M4 音效/BGM 程序化合成（WebAudio，零依赖零外链）
//
// 分两层：
//  1) 采样级合成器（纯函数，无 DOM/WebAudio）：每个音效 = 振荡器 + 噪声 + 包络 → mono Float32Array PCM，
//     供 tools/audio-check.mjs 在 Node 里离线渲染校验 RMS/峰值。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer → AudioBufferSourceNode 播放；BGM 用程序化循环层 loop。
//
// 事件名与 sim 事件一字不差：swap / invalidSwap / match / clearStar / specialCreate / specialBlast /
//   novaBlast / darkBreak / fall / refill / cascade / milestone / reshuffle / levelStart /
//   levelClear / levelFail / win / lens / comboUp，外加 ui。
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

function sfxSwap(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 620, freqEnd: 880, dur: 0.07, sr, gain: 0.3, attack: 0.003, release: 0.03 }),
    noise({ dur: 0.03, sr, gain: 0.1, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.015 }),
  );
}
function sfxInvalid(_p, sr) {
  return osc({ type: 'square', freq: 180, freqEnd: 140, dur: 0.08, sr, gain: 0.2, attack: 0.004, release: 0.04 });
}
function sfxMatch(p, sr) {
  const len = clamp(p.len ?? 3, 3, 8);
  const f = 520 * Math.pow(2, (len - 3) / 6);
  return mix(
    osc({ type: 'triangle', freq: f, freqEnd: f * 1.6, dur: 0.14, sr, gain: 0.4, attack: 0.004, release: 0.07 }),
    noise({ dur: 0.05, sr, gain: 0.2, filter: 'lowpass', cutoff: f * 4, attack: 0.002, release: 0.025 }),
  );
}
function sfxClear(_p, sr) {
  return noise({ dur: 0.05, sr, gain: 0.22, filter: 'bandpass', cutoff: 900, attack: 0.002, release: 0.02 });
}
function sfxSpecial(p, sr) {
  const f = (p.special === 'nova' ? 900 : 700);
  return notes({ freqs: [f, f * 1.26, f * 1.5], dur: 0.22, gap: 0.07, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.1, sr });
}
function sfxBlast(_p, sr) {
  return mix(
    osc({ type: 'sawtooth', freq: 260, freqEnd: 80, dur: 0.3, sr, gain: 0.28, attack: 0.005, release: 0.14 }),
    noise({ dur: 0.28, sr, gain: 0.26, filter: 'lowpass', cutoff: 700, attack: 0.003, release: 0.12 }),
  );
}
function sfxNova(_p, sr) {
  return mix(
    notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.6, gap: 0.08, type: 'triangle', gain: 0.16, attack: 0.02, release: 0.3, sr }),
    noise({ dur: 0.7, sr, gain: 0.18, filter: 'highpass', cutoff: 1200, attack: 0.02, release: 0.3 }),
  );
}
function sfxDark(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 90, freqEnd: 45, dur: 0.26, sr, gain: 0.42, attack: 0.004, release: 0.12 }),
    noise({ dur: 0.2, sr, gain: 0.26, filter: 'lowpass', cutoff: 200, attack: 0.003, release: 0.1 }),
  );
}
function sfxFall(_p, sr) {
  return osc({ type: 'sine', freq: 420, freqEnd: 240, dur: 0.12, sr, gain: 0.16, attack: 0.004, release: 0.06 });
}
function sfxRefill(_p, sr) {
  return osc({ type: 'sine', freq: 500, freqEnd: 760, dur: 0.1, sr, gain: 0.14, attack: 0.005, release: 0.05 });
}
function sfxCascade(p, sr) {
  const n = clamp(p.n ?? 2, 2, 6);
  const base = 440 + n * 60;
  return notes({ freqs: [base, base * 1.25, base * 1.5], dur: 0.2, gap: 0.05, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.08, sr });
}
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 880, freqEnd: 1320, dur: 0.06, sr, gain: 0.12, attack: 0.003, release: 0.03 });
}
function sfxReshuffle(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 523.25], dur: 0.16, gap: 0.06, type: 'triangle', gain: 0.18, attack: 0.008, release: 0.08, sr });
}
function sfxLevelStart(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.16, attack: 0.05, release: 0.15, sr });
}
function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.45, gap: 0.12, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.2, sr });
}
function sfxFail(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 400, freqEnd: 180, dur: 0.5, sr, gain: 0.3, attack: 0.01, release: 0.2 }),
    noise({ dur: 0.4, sr, gain: 0.16, filter: 'lowpass', cutoff: 500, attack: 0.01, release: 0.2 }),
  );
}
function sfxLens(_p, sr) {
  return noise({ dur: 0.3, sr, gain: 0.34, filter: 'bandpass', cutoff: 1400, attack: 0.03, release: 0.12 });
}
function sfxCombo(p, sr) {
  const c = clamp(p.combo ?? 0, 0, 12);
  const f = 660 * Math.pow(2, c / 12);
  return mix(
    osc({ type: 'sine', freq: f, freqEnd: f * 1.3, dur: 0.08, sr, gain: 0.2, attack: 0.003, release: 0.04 }),
    osc({ type: 'sine', freq: f * 1.5, freqEnd: f * 1.9, dur: 0.08, sr, gain: 0.14, attack: 0.003, release: 0.04 }),
  );
}
function sfxUi(_p, sr) {
  return mix(
    osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 }),
    noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 }),
  );
}

const SYNTH = {
  swap: sfxSwap,
  invalid: sfxInvalid,
  match: sfxMatch,
  clearStar: sfxClear,
  special: sfxSpecial,
  blast: sfxBlast,
  nova: sfxNova,
  dark: sfxDark,
  fall: sfxFall,
  refill: sfxRefill,
  cascade: sfxCascade,
  milestone: sfxMilestone,
  reshuffle: sfxReshuffle,
  levelStart: sfxLevelStart,
  win: sfxWin,
  fail: sfxFail,
  lens: sfxLens,
  combo: sfxCombo,
  ui: sfxUi,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（程序化 BGM：软垫 + 慢琶音，无缝 loop）
// ---------------------------------------------------------------------------

function loopBgm(sr) {
  const dur = 8;
  const n = Math.round(dur * sr);
  let out = new Float32Array(n);
  // 和弦垫：Am → F → C → G（低音 + 五度 + 三度），长音慢起慢落，首尾连续
  const chords = [
    [110, 164.81, 220],   // A2 E3 A3
    [87.31, 130.81, 174.61], // F2 C3 F3
    [130.81, 196, 261.63],   // C3 G3 C4
    [98, 146.83, 196],       // G2 D3 G3
  ];
  for (let ci = 0; ci < chords.length; ci += 1) {
    const start = Math.round(ci * 2 * sr);
    for (const f of chords[ci]) {
      const seg = osc({ type: 'triangle', freq: f, dur: 2.1, sr, gain: 0.05, attack: 0.5, release: 0.7 });
      addAt(out, seg, start);
    }
  }
  // 慢琶音
  const arp = [440, 523.25, 659.25, 783.99, 659.25, 523.25];
  for (let k = 0; k < 16; k += 1) {
    const f = arp[k % arp.length];
    const seg = osc({ type: 'sine', freq: f, dur: 0.5, sr, gain: 0.035, attack: 0.02, release: 0.3 });
    addAt(out, seg, Math.round(k * 0.5 * sr));
  }
  out = normalizeRms(out, 0.09);
  return out;
}

const LOOPS = {
  bgm: loopBgm,
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
  swap: 'swap',
  invalidSwap: 'invalid',
  match: 'match',
  clearStar: 'clearStar',
  specialCreate: 'special',
  specialBlast: 'blast',
  novaBlast: 'nova',
  darkBreak: 'dark',
  fall: 'fall',
  refill: 'refill',
  cascade: 'cascade',
  milestone: 'milestone',
  reshuffle: 'reshuffle',
  levelStart: 'levelStart',
  levelClear: 'win',
  levelFail: 'fail',
  win: 'win',
  lens: 'lens',
  comboUp: 'combo',
  ui: 'ui',
};

const SFX_PRIORITY = {
  nova: 6, blast: 6, win: 5, fail: 5, match: 5,
  special: 4, dark: 4, levelStart: 4,
  cascade: 3, combo: 3, lens: 3,
  swap: 2, clearStar: 2, reshuffle: 2,
  fall: 1, refill: 1, milestone: 1, invalid: 1, ui: 1,
};

// ---------------------------------------------------------------------------
// 播放层
// ---------------------------------------------------------------------------

export function createAudio() {
  const state = {
    ctx: null, master: null, sfxBus: null, bgmBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
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
    for (const [k, v] of state.active) if (v.endTime <= now) state.active.delete(k);
  }
  function stopVoice(v, now) { if (v && v.stop) { try { v.stop(now); } catch { /* noop */ } } }

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
      let minKey = null; let minPrio = Infinity;
      for (const [k, v] of state.active) if (v.priority < minPrio) { minPrio = v.priority; minKey = k; }
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
    state.active.set(key, { name, priority, endTime: now + pcm.length / ctx.sampleRate, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
  }

  function playBgm(kind = 'bgm') {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmKind === kind && state.bgmSource) return;
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
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch { /* noop */ } state.bgmSource = null; state.bgmKind = null; }
  }

  function unlock() {
    ensureCtx();
    resumeIfNeeded();
    playBgm('bgm');
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

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
