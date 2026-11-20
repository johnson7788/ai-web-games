// src/core/audio.js — COLOR FLUX · 程序化 WebAudio 合成与播放（零依赖零外链，不打包音频文件）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     BGM 用合成的无缝循环（pad + 琶音 + 空气噪声分层）。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(name), stopBgm() }
// 事件名与 sim 事件表一字不差：jump / hoverStart / hoverEnd / pass / wrongColor / fall / death /
//   colorChange / dualStart / dualEnd / rhythmBeat / auroraBurst / nearMiss / segmentEnter /
//   milestone / newRecord，外加 UI 侧 ui / chime。

import { save } from './save.js';

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 2;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.25;    // 噪声滤波后统一归一到的 RMS

// ---------------------------------------------------------------------------
// 采样级 DSP 原语（振荡器 / 噪声 / 滤波 / 包络 / 混音）
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
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = Math.random() * 2 - 1;
  let filtered = out;
  if (filter === 'lowpass') filtered = lowpass(out, cutoff, sr);
  else if (filter === 'highpass') filtered = highpass(out, cutoff, sr);
  else if (filter === 'bandpass') filtered = bandpass(out, cutoff, sr);
  normalizeRms(filtered, NOISE_RMS);
  return applyEnv(filtered, sr, gain, attack, release);
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
// 各音效合成器（均为 (payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

// 起跳：上扬 blip。
function sfxJump(_p, sr) {
  return osc({ type: 'sine', freq: 380, freqEnd: 760, dur: 0.12, sr, gain: 0.3, attack: 0.004, release: 0.06 });
}

// 悬浮起手：空气带通 whoosh。
function sfxHoverStart(_p, sr) {
  return noise({ dur: 0.3, sr, gain: 0.28, filter: 'bandpass', cutoff: 1200, attack: 0.05, release: 0.14 });
}

// 悬浮结束：极短 click。
function sfxHoverEnd(_p, sr) {
  return noise({ dur: 0.03, sr, gain: 0.12, filter: 'highpass', cutoff: 1800, attack: 0.002, release: 0.02 });
}

// 过环：明亮 chime，连穿越高音越高。
function sfxPass(p, sr) {
  const streak = clamp(p.streak ?? 0, 0, 12);
  const f = 620 * Math.pow(2, streak / 12);
  const a = osc({ type: 'sine', freq: f, freqEnd: f * 1.4, dur: 0.14, sr, gain: 0.34, attack: 0.004, release: 0.07 });
  const b = osc({ type: 'sine', freq: f * 1.5, freqEnd: f * 1.8, dur: 0.1, sr, gain: 0.14, attack: 0.004, release: 0.05 });
  return mix(a, b);
}

// 撞错色：低频 buzz + 噪声 crash。
function sfxWrongColor(_p, sr) {
  const buzz = osc({ type: 'square', freq: 110, freqEnd: 82, dur: 0.16, sr, gain: 0.3, attack: 0.004, release: 0.08 });
  const nz = noise({ dur: 0.14, sr, gain: 0.28, filter: 'lowpass', cutoff: 500, attack: 0.002, release: 0.07 });
  return mix(buzz, nz);
}

// 掉出屏幕：下坠 gliss。
function sfxFall(_p, sr) {
  return osc({ type: 'triangle', freq: 480, freqEnd: 70, dur: 0.6, sr, gain: 0.32, attack: 0.01, release: 0.2 });
}

// 死亡：更长的下坠 + 低频噪声。
function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.9, sr, gain: 0.4, attack: 0.01, release: 0.22 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

// 变色：三音 sparkle 琶音。
function sfxColorChange(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.22, gap: 0.08, type: 'triangle', gain: 0.22, attack: 0.008, release: 0.12, sr });
}

// 双色开启：双音和弦。
function sfxDualStart(_p, sr) {
  const a = osc({ type: 'triangle', freq: 392, dur: 0.3, sr, gain: 0.22, attack: 0.01, release: 0.15 });
  const b = osc({ type: 'triangle', freq: 587.33, dur: 0.3, sr, gain: 0.18, attack: 0.01, release: 0.15 });
  return mix(a, b);
}

// 双色结束：下坠 tick。
function sfxDualEnd(_p, sr) {
  return osc({ type: 'sine', freq: 587.33, freqEnd: 294, dur: 0.18, sr, gain: 0.2, attack: 0.006, release: 0.09 });
}

// 韵律节拍：短促 percussive tick。
function sfxRhythmBeat(_p, sr) {
  const tick = osc({ type: 'sine', freq: 880, freqEnd: 660, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.025 });
  const clk = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.01 });
  return mix(tick, clk);
}

// 极光爆发：和弦轰 + 上升噪声 swell。
function sfxAuroraBurst(_p, sr) {
  const chord = notes({ freqs: [220, 261.63, 329.63, 440], dur: 0.9, gap: 0, type: 'triangle', gain: 0.15, attack: 0.03, release: 0.35, sr });
  const swell = noise({ dur: 0.9, sr, gain: 0.18, filter: 'bandpass', cutoff: 900, attack: 0.1, release: 0.4 });
  return mix(chord, swell);
}

// 擦肩：高频 tick。
function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

// 换段：上行 pad 琶音。
function sfxSegmentEnter(_p, sr) {
  return notes({ freqs: [220, 277.18, 329.63, 440], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.16, attack: 0.05, release: 0.16, sr });
}

// 里程碑：轻 ping。
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

// UI 按钮：短 ping + click。
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

// 新纪录：fanfare。
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

// 通用 chime（教程完成）。
function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  jump: sfxJump,
  hoverStart: sfxHoverStart,
  hoverEnd: sfxHoverEnd,
  pass: sfxPass,
  wrongColor: sfxWrongColor,
  fall: sfxFall,
  death: sfxDeath,
  colorChange: sfxColorChange,
  dualStart: sfxDualStart,
  dualEnd: sfxDualEnd,
  rhythmBeat: sfxRhythmBeat,
  auroraBurst: sfxAuroraBurst,
  nearMiss: sfxNearMiss,
  segmentEnter: sfxSegmentEnter,
  milestone: sfxMilestone,
  newRecord: sfxNewRecord,
  ui: sfxUi,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop 的 PCM）
// ---------------------------------------------------------------------------

// 悬浮空气层：2s 带通白噪，0.5Hz 呼吸 LFO（整数周期，无缝）。
function loopHover(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = bandpass(buf, 1100, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.10 + 0.07 * Math.sin(2 * Math.PI * 0.5 * t);
  }
  return buf;
}

// 极光环境 BGM：8s 无缝循环，三层叠加（pad 长音 + 琶音 + 空气噪声 shimmer）。
// pad 频率取 0.125Hz 网格整数倍（8s 内整周期），首尾严格连续；琶音每音自带包络自零起止。
function loopBgm(sr) {
  const dur = 8;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const fund = 1 / dur; // 0.125 Hz

  // 层 1：A 小调 pad（A2 110 / C3 131 / E3 164.75 / G3 196，取整周期近似）
  const padFreqs = [110, 131, 164.75, 196];
  for (const f of padFreqs) {
    const amp = 0.055;
    for (let i = 0; i < n; i += 1) {
      const t = i / sr;
      // 慢 LFO（0.25Hz = 2 周期/loop，无缝）
      const lfo = 0.7 + 0.3 * Math.sin(2 * Math.PI * 0.25 * t);
      out[i] += amp * lfo * Math.sin(2 * Math.PI * f * t);
    }
  }

  // 层 2：琶音 pluck（每 1s 一个音，8 个音覆盖 loop，每个音 0.6s 包络自零起止）
  const arp = [220, 261.63, 329.63, 440, 392, 329.63, 261.63, 220];
  for (let k = 0; k < arp.length; k += 1) {
    const s = osc({ type: 'triangle', freq: arp[k], dur: 0.7, sr, gain: 0.12, attack: 0.02, release: 0.4 });
    addAt(out, s, Math.round(k * 1.0 * sr));
  }

  // 层 3：空气噪声 shimmer（低通，0.25Hz LFO，整周期）
  let shim = new Float32Array(n);
  for (let i = 0; i < n; i += 1) shim[i] = Math.random() * 2 - 1;
  shim = lowpass(shim, 1500, sr);
  shim = normalizeRms(shim, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    out[i] += shim[i] * (0.04 + 0.03 * Math.sin(2 * Math.PI * 0.25 * t));
  }

  // 归一峰值防削波
  let peak = 0;
  for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.88) {
    const k = 0.88 / peak;
    for (let i = 0; i < n; i += 1) out[i] *= k;
  }
  return out;
}

const LOOPS = {
  hover: loopHover,
  bgm: loopBgm,
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

// 叠层优先级
const SFX_PRIORITY = {
  auroraBurst: 6, pass: 6,
  death: 5, wrongColor: 5, dualStart: 4, segmentEnter: 4, newRecord: 4, colorChange: 4,
  fall: 3, jump: 3,
  hoverStart: 2, chime: 2, milestone: 2, rhythmBeat: 2,
  dualEnd: 1, nearMiss: 1, ui: 1, hoverEnd: 1,
};

const EVENT_TO_SFX = {
  jump: 'jump',
  hoverStart: 'hoverStart',
  hoverEnd: 'hoverEnd',
  pass: 'pass',
  wrongColor: 'wrongColor',
  fall: 'fall',
  death: 'death',
  colorChange: 'colorChange',
  dualStart: 'dualStart',
  dualEnd: 'dualEnd',
  rhythmBeat: 'rhythmBeat',
  auroraBurst: 'auroraBurst',
  nearMiss: 'nearMiss',
  segmentEnter: 'segmentEnter',
  milestone: 'milestone',
  newRecord: 'newRecord',
  ui: 'ui',
  tutorialDone: 'chime',
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
    loops: { hover: null, bgm: null },
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
    g.connect(state.sfxBus);
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
    }
  }

  function event(type, payload = {}) {
    if (!type) return;
    if (type === 'hoverStart') {
      playSfx('hoverStart', payload);
      startLoop('hover');
      return;
    }
    if (type === 'hoverEnd') {
      stopLoop('hover');
      playSfx('hoverEnd', payload);
      return;
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

  // 播放程序化 BGM 循环（不 fetch，不依赖外部音频文件）。
  function playBgm(name) {
    stopBgmSource();
    const ctx = ensureCtx();
    if (!ctx || name === 'none') return;
    const pcm = synthLoop(name === 'bgm' ? 'bgm' : 'bgm', ctx.sampleRate);
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
