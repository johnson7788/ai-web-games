// src/core/audio.js — ABYSS EEL · M4 音效合成与播放（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     循环层（冲刺呼吸白噪 / 环境水声）用 loop 的 AudioBufferSourceNode 长循环。
//
// 契约（docs/abyss-eel/README.md 事件表）：
//   createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(url|buffer), stopBgm() }
// 事件名与 sim 事件表一字不差：wallHit / wallBreak / orbGain / orbLose / urchinCut / comboUp /
//   comboBreak / dashStart / dashEnd / zoneEnter / bossHit / bossBreak / nearMiss / death / tutorialDone，
// 外加 UI 侧 ui（按钮点击）、newRecord（新纪录 fanfare）。

import { save } from './save.js';

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 2;      // 同时叠层的一发式音效上限（破墙/吃珠优先保）
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重（防一帧多次 wallHit 爆音）
const NOISE_RMS = 0.25;    // 噪声滤波后统一归一到的 RMS，保证各噪声层响度可预期

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

/** 单发振荡器：类型 / 起始频率 / 指数滑到 freqEnd / 时长 / 增益 / attack / release 包络。 */
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

/** 白噪声 → 可选滤波 → 归一 RMS → 包络。filter: none|lowpass|highpass|bandpass（以 cutoff 为中心）。 */
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

/** 线性 attack / release 包络 + 增益（就地）。 */
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

/** 一阶低通（就地返回新数组）。 */
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

/** 一阶高通。 */
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

/** 简易带通：低通(center*1.6) → 高通(center*0.62)。 */
function bandpass(input, center, sr) {
  return highpass(lowpass(input, center * 1.6, sr), center * 0.62, sr);
}

/** 归一化 RMS（就地）。 */
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

/** 混音：等长对齐求和到最长者。 */
function mix(...parts) {
  let len = 0;
  for (const p of parts) len = Math.max(len, p.length);
  const out = new Float32Array(len);
  for (const p of parts) for (let i = 0; i < p.length; i += 1) out[i] += p[i];
  return out;
}

/** 在 dst 的 offset（采样数）处叠加 src。 */
function addAt(dst, src, offset) {
  for (let i = 0; i < src.length; i += 1) {
    const j = offset + i;
    if (j >= 0 && j < dst.length) dst[j] += src[i];
  }
}

/** 等间隔琶音/旋律：freqs 依次以 gap 秒叠放。 */
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

// 撞墙（未破）：低频短 tick + 极短高频噪声 click，克制不抢戏。
function sfxWallHit(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 95, dur: 0.07, sr, gain: 0.3, attack: 0.004, release: 0.03 });
  const click = noise({ dur: 0.03, sr, gain: 0.12, filter: 'highpass', cutoff: 1200, attack: 0.001, release: 0.01 });
  return mix(thud, click);
}

// 破墙 pop：value 越高越低沉；连击每 +1 音高 +1 半音（封顶 +12）。
function sfxWallBreak(p, sr) {
  const value = clamp(p.value ?? 1, 1, 60);
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 520 * Math.pow(2, -value / 30) * Math.pow(2, combo / 12);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 0.62, dur: 0.18, sr, gain: 0.5, attack: 0.004, release: 0.09 });
  const pop = noise({ dur: 0.06, sr, gain: 0.25, filter: 'lowpass', cutoff: f * 4, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

// 吃珠：上滑 blip；连击内音高递增（每 +1 半音）。
function sfxOrbGain(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 520 * Math.pow(2, combo / 12);
  const blip = osc({ type: 'sine', freq: f, freqEnd: f * 1.8, dur: 0.13, sr, gain: 0.35, attack: 0.005, release: 0.06 });
  const spark = osc({ type: 'sine', freq: f * 2, freqEnd: f * 2.4, dur: 0.08, sr, gain: 0.1, attack: 0.004, release: 0.04 });
  return mix(blip, spark);
}

// 掉珠：下坠小 blip。
function sfxOrbLose(_p, sr) {
  return osc({ type: 'sine', freq: 620, freqEnd: 290, dur: 0.13, sr, gain: 0.22, attack: 0.005, release: 0.07 });
}

// 海胆断尾：低频 thud + 低频噪声。
function sfxUrchinCut(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 95, freqEnd: 48, dur: 0.26, sr, gain: 0.5, attack: 0.004, release: 0.12 });
  const nz = noise({ dur: 0.2, sr, gain: 0.32, filter: 'lowpass', cutoff: 220, attack: 0.003, release: 0.1 });
  return mix(thud, nz);
}

// 冲刺起手：上扬带通白噪 whoosh（循环层另由 dashLoop 负责）。
function sfxDashStart(_p, sr) {
  return noise({ dur: 0.3, sr, gain: 0.4, filter: 'bandpass', cutoff: 1400, attack: 0.03, release: 0.12 });
}

// 换带：水下调式 pad 琶音（A 小调 A3-C4-E4-A4）。
function sfxZoneEnter(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 440], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.16, attack: 0.06, release: 0.18, sr });
}

// Boss 段受击：重低频 thud + 噪声。
function sfxBossHit(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 70, freqEnd: 45, dur: 0.2, sr, gain: 0.5, attack: 0.004, release: 0.1 });
  const nz = noise({ dur: 0.16, sr, gain: 0.32, filter: 'lowpass', cutoff: 160, attack: 0.003, release: 0.08 });
  return mix(thud, nz);
}

// Boss 破：A 低音和弦轰 + 低频噪声 crash。
function sfxBossBreak(_p, sr) {
  const chord = notes({ freqs: [55, 82.41, 110, 164.81], dur: 0.9, gap: 0, type: 'triangle', gain: 0.15, attack: 0.02, release: 0.35, sr });
  const crash = noise({ dur: 0.5, sr, gain: 0.16, filter: 'lowpass', cutoff: 900, attack: 0.004, release: 0.25 });
  return mix(chord, crash);
}

// 死亡：下坠 gliss + 低频噪声。
function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

// 擦肩 nearMiss：短促高频 tick。
function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}

// 深度里程碑（每 25m）：极短水泡 ping，轻到可以连续播。
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.10, attack: 0.004, release: 0.03 });
}

// UI 按钮：短 ping + 极短 click。
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

// 新纪录：3 音 fanfare（C5-E5-G5）收尾高八度。
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

// 连击 +1：双音 sparkle，随连击升高。
function sfxComboUp(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 660 * Math.pow(2, combo / 12);
  const a = osc({ type: 'sine', freq: f, freqEnd: f * 1.3, dur: 0.08, sr, gain: 0.2, attack: 0.003, release: 0.04 });
  const b = osc({ type: 'sine', freq: f * 1.5, freqEnd: f * 1.9, dur: 0.08, sr, gain: 0.16, attack: 0.003, release: 0.04 });
  const out = new Float32Array(Math.round(0.16 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.06 * sr));
  return out;
}

// 连击中断：下坠 tick。
function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 230, dur: 0.16, sr, gain: 0.2, attack: 0.005, release: 0.08 });
}

// 教学完成 / 通用轻 chime。
function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  wallHit: sfxWallHit,
  wallBreak: sfxWallBreak,
  orbGain: sfxOrbGain,
  orbLose: sfxOrbLose,
  urchinCut: sfxUrchinCut,
  dashStart: sfxDashStart,
  zoneEnter: sfxZoneEnter,
  bossHit: sfxBossHit,
  bossBreak: sfxBossBreak,
  death: sfxDeath,
  nearMiss: sfxNearMiss,
  milestone: sfxMilestone,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  comboUp: sfxComboUp,
  comboBreak: sfxComboBreak,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop 的 PCM）：冲刺呼吸白噪 / 环境水声
// ---------------------------------------------------------------------------

// 冲刺呼吸白噪：2s 带通白噪，0.5Hz 呼吸 LFO（整数周期，首尾包络连续可无缝循环）。
function loopDash(sr) {
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

// 环境水声：4s 低通白噪，0.25Hz 慢 LFO（1 周期，无缝）。
function loopWater(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 380, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

const LOOPS = {
  dash: loopDash,
  water: loopWater,
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

// 叠层优先级：破墙/吃珠最高（规格要求超限时优先保它们）。
const SFX_PRIORITY = {
  wallBreak: 6, orbGain: 6,
  urchinCut: 5, bossBreak: 5,
  death: 4, dashStart: 4, zoneEnter: 4, newRecord: 4,
  bossHit: 3, wallHit: 3,
  chime: 2, comboUp: 2, orbLose: 2, comboBreak: 2,
  nearMiss: 1, ui: 1,
};

const EVENT_TO_SFX = {
  wallHit: 'wallHit',
  wallBreak: 'wallBreak',
  orbGain: 'orbGain',
  orbLose: 'orbLose',
  urchinCut: 'urchinCut',
  comboUp: 'comboUp',
  comboBreak: 'comboBreak',
  zoneEnter: 'zoneEnter',
  bossHit: 'bossHit',
  bossBreak: 'bossBreak',
  nearMiss: 'nearMiss',
  death: 'death',
  depthMilestone: 'milestone',
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
    bgmSource: null,
    bgmUrl: null,
    bgmBuffer: null,
    loops: { dash: null, water: null },
    active: new Map(),   // voiceKey -> { name, priority, endTime, stop }
    lastPlay: new Map(), // sfxName -> ctx.currentTime（16ms 去重）
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

    // 16ms 去重
    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);

    // 叠层 ≤2，超过优先保高优先级（破墙/吃珠）
    const priority = SFX_PRIORITY[name] ?? 1;
    pruneActive(now);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null;
      let minPrio = Infinity;
      for (const [key, v] of state.active) {
        if (v.priority < minPrio) { minPrio = v.priority; minKey = key; }
      }
      if (minKey == null || priority <= minPrio) return; // 丢弃新音效
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
      startLoop('water'); // P2 环境水声层：首次手势即起
    }
  }

  function event(type, payload = {}) {
    if (!type) return;
    if (type === 'dashStart') {
      playSfx('dashStart', payload);
      startLoop('dash'); // 冲刺呼吸白噪循环
      return;
    }
    if (type === 'dashEnd') {
      stopLoop('dash');
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

  async function playBgm(src) {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
    try {
      let buf = null;
      if (src && typeof src === 'object' && typeof src.getChannelData === 'function') {
        buf = src; // 直接给 AudioBuffer
      } else if (typeof src === 'string') {
        if (state.bgmUrl === src && state.bgmBuffer) {
          buf = state.bgmBuffer;
        } else {
          const res = await fetch(src);
          if (!res.ok) throw new Error(`bgm fetch ${res.status}`);
          buf = await ctx.decodeAudioData(await res.arrayBuffer());
          state.bgmUrl = src;
          state.bgmBuffer = buf;
        }
      }
      if (!buf) return;
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.connect(state.bgmBus);
      node.start();
      state.bgmSource = node;
    } catch { /* BGM 加载失败静默降级，不影响 SFX */ }
  }

  function stopBgm() {
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
