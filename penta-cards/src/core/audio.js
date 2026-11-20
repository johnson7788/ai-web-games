// src/core/audio.js — PENTA CARDS · 音效与 BGM（WebAudio 程序化合成，零外链零音频文件）
//
// 两层架构：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，
//     直接算成 mono Float32Array PCM，tools/audio-check.mjs 可在 Node 里离线渲染校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer → AudioBufferSourceNode → GainNode → destination；
//     BGM 用三个场景包的循环层（observatory / teahouse / aurora）无缝 loop 播放。
//
// 契约：
//   createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v),
//                     playBgm(mode), stopBgm() }
// 事件名与 sim 事件表一致：deal / draw / discard / peng / gang / hu / zimo / dianpao /
//   stargaze / swap / ting / roundWin / roundLose / roundDraw / newRecord / milestone，
//   外加 UI 侧 ui（按钮）。

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.25;    // 噪声滤波后归一到的 RMS

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
// 音效合成器（(payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

function sfxDraw(_p, sr) {
  const blip = osc({ type: 'sine', freq: 720, freqEnd: 880, dur: 0.08, sr, gain: 0.22, attack: 0.004, release: 0.04 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.01 });
  return mix(blip, click);
}

function sfxDiscard(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 420, freqEnd: 300, dur: 0.07, sr, gain: 0.28, attack: 0.003, release: 0.03 });
  const click = noise({ dur: 0.03, sr, gain: 0.14, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.01 });
  return mix(thud, click);
}

function sfxPeng(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 260, freqEnd: 190, dur: 0.12, sr, gain: 0.36, attack: 0.004, release: 0.06 });
  const nz = noise({ dur: 0.08, sr, gain: 0.2, filter: 'lowpass', cutoff: 500, attack: 0.002, release: 0.04 });
  return mix(thud, nz);
}

function sfxGang(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 170, freqEnd: 110, dur: 0.16, sr, gain: 0.42, attack: 0.004, release: 0.08 });
  const nz = noise({ dur: 0.12, sr, gain: 0.26, filter: 'lowpass', cutoff: 320, attack: 0.002, release: 0.06 });
  return mix(thud, nz);
}

function sfxHu(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.18, sr });
}

function sfxZimo(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.5, gap: 0.1, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.18, sr });
}

function sfxDianpao(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 480, freqEnd: 200, dur: 0.3, sr, gain: 0.3, attack: 0.01, release: 0.14 });
  return glide;
}

function sfxStargaze(_p, sr) {
  return notes({ freqs: [880, 1108.7, 1318.5, 1760], dur: 0.4, gap: 0.09, type: 'sine', gain: 0.14, attack: 0.02, release: 0.16, sr });
}

function sfxSwap(_p, sr) {
  const whoosh = noise({ dur: 0.22, sr, gain: 0.3, filter: 'bandpass', cutoff: 1200, attack: 0.03, release: 0.1 });
  const blip = osc({ type: 'sine', freq: 620, freqEnd: 740, dur: 0.08, sr, gain: 0.16, attack: 0.004, release: 0.04 });
  return mix(whoosh, blip);
}

function sfxTing(_p, sr) {
  return notes({ freqs: [659.25, 783.99], dur: 0.3, gap: 0.08, type: 'sine', gain: 0.16, attack: 0.01, release: 0.12, sr });
}

function sfxRoundWin(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99, 1046.5], dur: 0.5, gap: 0.11, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.2, sr });
}

function sfxRoundLose(_p, sr) {
  return notes({ freqs: [392, 329.63, 261.63], dur: 0.5, gap: 0.14, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.2, sr });
}

function sfxRoundDraw(_p, sr) {
  return osc({ type: 'sine', freq: 440, freqEnd: 440, dur: 0.5, sr, gain: 0.16, attack: 0.05, release: 0.25 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.18, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.1, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

function sfxDeal(_p, sr) {
  // 发牌：一串极短 click
  const out = new Float32Array(Math.round(0.5 * sr));
  for (let k = 0; k < 14; k += 1) {
    const c = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.01 });
    addAt(out, c, Math.round(k * 0.032 * sr));
  }
  return out;
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.08, sr, gain: 0.12, attack: 0.004, release: 0.04 });
}

const SYNTH = {
  draw: sfxDraw,
  discard: sfxDiscard,
  peng: sfxPeng,
  gang: sfxGang,
  hu: sfxHu,
  zimo: sfxZimo,
  dianpao: sfxDianpao,
  stargaze: sfxStargaze,
  swap: sfxSwap,
  ting: sfxTing,
  roundWin: sfxRoundWin,
  roundLose: sfxRoundLose,
  roundDraw: sfxRoundDraw,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
  deal: sfxDeal,
  milestone: sfxMilestone,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（BGM：三场景包程序化合成，首尾包络连续可无缝 loop）
// ---------------------------------------------------------------------------

function padLoop(buf, sr) {
  // 首尾各 60ms 做淡入淡出，避免循环爆音。
  const fade = Math.round(0.06 * sr);
  for (let i = 0; i < fade && i < buf.length; i += 1) {
    const k = i / fade;
    buf[i] *= k;
    buf[buf.length - 1 - i] *= k;
  }
  return buf;
}

// 观星台：蓝金 —— 低音 pad + 高音星点琶音（A 小调），8s 循环
function loopObservatory(sr) {
  const dur = 8;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const pad = notes({ freqs: [220, 261.63, 329.63], dur: dur, gap: 0, type: 'triangle', gain: 0.05, attack: 0.8, release: 1.2, sr });
  addAt(out, pad, 0);
  const sparkles = [440, 523.25, 659.25, 880, 587.33, 698.46];
  for (let k = 0; k < sparkles.length; k += 1) {
    const s = osc({ type: 'sine', freq: sparkles[k] * 2, dur: 0.5, sr, gain: 0.05, attack: 0.02, release: 0.4 });
    addAt(out, s, Math.round(((k * dur) / sparkles.length + (k % 2) * 0.4) * sr));
  }
  normalizeRms(out, 0.1);
  return padLoop(out, sr);
}

// 茶室：暖褐 —— 木质感中频 pad + 缓慢五声音阶，8s 循环
function loopTeahouse(sr) {
  const dur = 8;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const pad = notes({ freqs: [196, 246.94, 293.66], dur: dur, gap: 0, type: 'triangle', gain: 0.06, attack: 0.7, release: 1.1, sr });
  addAt(out, pad, 0);
  const pluck = [293.66, 329.63, 392, 440, 329.63, 293.66];
  for (let k = 0; k < pluck.length; k += 1) {
    const s = osc({ type: 'triangle', freq: pluck[k], dur: 0.6, sr, gain: 0.06, attack: 0.01, release: 0.5 });
    addAt(out, s, Math.round((k * 1.1) * sr));
  }
  normalizeRms(out, 0.1);
  return padLoop(out, sr);
}

// 极光：青紫 —— 高音 shimmer + 上行琶音，8s 循环
function loopAurora(sr) {
  const dur = 8;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const pad = notes({ freqs: [261.63, 311.13, 392], dur: dur, gap: 0, type: 'sine', gain: 0.05, attack: 0.9, release: 1.4, sr });
  addAt(out, pad, 0);
  const arp = [523.25, 587.33, 659.25, 783.99, 880, 987.77, 783.99, 659.25];
  for (let k = 0; k < arp.length; k += 1) {
    const s = osc({ type: 'sine', freq: arp[k], dur: 0.7, sr, gain: 0.05, attack: 0.02, release: 0.5 });
    addAt(out, s, Math.round(k * 0.9 * sr));
  }
  normalizeRms(out, 0.1);
  return padLoop(out, sr);
}

const LOOPS = {
  observatory: loopObservatory,
  teahouse: loopTeahouse,
  aurora: loopAurora,
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

const SFX_PRIORITY = {
  hu: 6, zimo: 6, roundWin: 6, newRecord: 6,
  gang: 5, peng: 5, dianpao: 5,
  draw: 3, discard: 3, stargaze: 3, swap: 3, ting: 3,
  roundLose: 2, roundDraw: 2, milestone: 2, chime: 2, deal: 2,
  ui: 1,
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
    volume: 0.7,
    muted: false,
    unlocked: false,
    bgmSource: null,
    bgmMode: null,
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
    state.bgmBus.gain.value = 0.7;
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
      const v = state.active.get(minKey);
      try { v.src.stop(now); } catch { /* noop */ }
      state.active.delete(minKey);
    }

    const pcm = synthSfx(name, payload, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(state.sfxBus);
    src.start(now);
    state.active.set(`v${state.voiceSeq++}`, {
      name,
      priority,
      endTime: now + pcm.length / ctx.sampleRate,
      src,
    });
  }

  function stopBgmSource() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
    state.bgmMode = null;
  }

  function unlock() {
    ensureCtx();
    resumeIfNeeded();
    state.unlocked = true;
  }

  function event(type, payload = {}) {
    if (!type) return;
    // sim 事件 → SFX 映射（直接同名）
    if (SYNTH[type]) playSfx(type, payload);
    else if (type === 'roundStart') playSfx('deal', payload);
    else if (type === 'sessionEnd') playSfx(type.endsWith('win') ? 'roundWin' : 'roundLose', payload);
  }

  function setMuted(b) {
    state.muted = !!b;
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
  }

  function playBgm(mode) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmMode === mode) return;
    stopBgmSource();
    if (!LOOPS[mode]) return;
    const pcm = synthLoop(mode, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(state.bgmBus);
    src.start();
    state.bgmSource = src;
    state.bgmMode = mode;
  }

  function stopBgm() {
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
