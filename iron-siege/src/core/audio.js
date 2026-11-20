// src/core/audio.js — IRON SIEGE · 蒸汽朋克要塞音效合成（WebAudio 标准 API，零依赖零外链）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     循环层（引擎嗡鸣）用 loop 的 AudioBufferSourceNode 长循环。
//
// 契约（docs/iron-siege/README.md 事件表）：
//   createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(src), stopBgm() }
// 事件名与 sim 事件表一字不差：shot / shotHeavy / enemyShot / hit / kill / playerHit / brickBreak /
//   steelBreak / furnaceHit / alarm / propSpawn / propGain / repair / waveClear / win / death /
//   milestone / upgrade / ui / playerSpawn。

import Sdk from './sdk.js';

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限（重炮/击毁优先保）
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

/** 白噪声 → 可选滤波 → 归一 RMS → 包络。filter: none|lowpass|highpass|bandpass。 */
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
// 各音效合成器（均为 (payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

// 主炮：明亮短促 crack + 高频噪声 click。
function sfxShoot(_p, sr) {
  const tone = osc({ type: 'square', freq: 900, freqEnd: 260, dur: 0.09, sr, gain: 0.26, attack: 0.002, release: 0.04 });
  const click = noise({ dur: 0.04, sr, gain: 0.16, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.02 });
  return mix(tone, click);
}

// 重炮：低沉 boom + 大噪声（signature 弹药）。payload.count 越高越低沉。
function sfxHeavy(p, sr) {
  const k = clamp(p.count ?? 0, 0, 4);
  const f = 90 * Math.pow(2, -k / 12);
  const thud = osc({ type: 'triangle', freq: f, freqEnd: f * 0.4, dur: 0.34, sr, gain: 0.5, attack: 0.004, release: 0.14 });
  const boom = noise({ dur: 0.3, sr, gain: 0.4, filter: 'lowpass', cutoff: 420, attack: 0.003, release: 0.16 });
  return mix(thud, boom);
}

// 敌弹：中频 click。
function sfxEnemyShot(_p, sr) {
  return osc({ type: 'triangle', freq: 320, freqEnd: 170, dur: 0.06, sr, gain: 0.22, attack: 0.003, release: 0.03 });
}

// 命中（未击杀）：金属 ping。
function sfxHit(_p, sr) {
  const ping = osc({ type: 'sine', freq: 1250, freqEnd: 900, dur: 0.07, sr, gain: 0.24, attack: 0.002, release: 0.03 });
  const clk = noise({ dur: 0.03, sr, gain: 0.12, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.02 });
  return mix(ping, clk);
}

// 击毁：爆炸（低频 + 噪声）。
function sfxKill(p, sr) {
  const big = clamp(p.armored ? 1 : 0, 0, 1);
  const thud = osc({ type: 'triangle', freq: 120, freqEnd: 45, dur: 0.32 + big * 0.12, sr, gain: 0.5, attack: 0.004, release: 0.14 });
  const nz = noise({ dur: 0.28 + big * 0.1, sr, gain: 0.4, filter: 'lowpass', cutoff: 300 + big * 200, attack: 0.003, release: 0.12 });
  return mix(thud, nz);
}

// 玩家被毁：更高、更锐的爆炸。
function sfxPlayerHit(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 500, freqEnd: 60, dur: 0.7, sr, gain: 0.42, attack: 0.01, release: 0.2 });
  const nz = noise({ dur: 0.5, sr, gain: 0.3, filter: 'lowpass', cutoff: 800, attack: 0.01, release: 0.22 });
  return mix(glide, nz);
}

// 破砖：脆裂 crunch。
function sfxBrickBreak(_p, sr) {
  const cr = noise({ dur: 0.09, sr, gain: 0.3, filter: 'bandpass', cutoff: 900, attack: 0.002, release: 0.04 });
  const thud = osc({ type: 'triangle', freq: 180, freqEnd: 110, dur: 0.08, sr, gain: 0.24, attack: 0.003, release: 0.04 });
  return mix(cr, thud);
}

// 破钢：铆钉震颤（signature）——高金属环 + 噪声。
function sfxSteelBreak(_p, sr) {
  const ring = osc({ type: 'triangle', freq: 1900, freqEnd: 900, dur: 0.24, sr, gain: 0.3, attack: 0.002, release: 0.1 });
  const nz = noise({ dur: 0.12, sr, gain: 0.2, filter: 'highpass', cutoff: 1600, attack: 0.002, release: 0.06 });
  return mix(ring, nz);
}

// 熔炉受击：低频警报重击。
function sfxFurnaceHit(_p, sr) {
  const thud = osc({ type: 'square', freq: 130, freqEnd: 70, dur: 0.24, sr, gain: 0.4, attack: 0.004, release: 0.12 });
  return thud;
}

// 红色报警脉冲：上扫 siren。
function sfxAlarm(_p, sr) {
  return osc({ type: 'sawtooth', freq: 420, freqEnd: 860, dur: 0.42, sr, gain: 0.24, attack: 0.03, release: 0.12 });
}

// 道具出现：火花 blip。
function sfxPropSpawn(_p, sr) {
  return osc({ type: 'sine', freq: 700, freqEnd: 1100, dur: 0.09, sr, gain: 0.2, attack: 0.004, release: 0.04 });
}

// 拾取道具：上行 chime。
function sfxPropGain(_p, sr) {
  const a = osc({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.12, sr, gain: 0.28, attack: 0.004, release: 0.05 });
  const b = osc({ type: 'sine', freq: 990, freqEnd: 1480, dur: 0.12, sr, gain: 0.18, attack: 0.004, release: 0.05 });
  return mix(a, b);
}

// 焊修：电焊 buzz + 低频 hum。
function sfxRepair(_p, sr) {
  const buzz = noise({ dur: 0.4, sr, gain: 0.3, filter: 'bandpass', cutoff: 700, attack: 0.02, release: 0.16 });
  const hum = osc({ type: 'triangle', freq: 110, freqEnd: 90, dur: 0.4, sr, gain: 0.2, attack: 0.03, release: 0.16 });
  return mix(buzz, hum);
}

// 清波：小号 fanfare。
function sfxWaveClear(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25], dur: 0.32, gap: 0.11, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.14, sr });
}

// 胜利：大 fanfare。
function sfxWin(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25], dur: 0.42, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

// 失败：下坠 gliss。
function sfxGameOver(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 480, freqEnd: 55, dur: 1.0, sr, gain: 0.4, attack: 0.01, release: 0.24 });
  const nz = noise({ dur: 0.7, sr, gain: 0.24, filter: 'lowpass', cutoff: 600, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

// UI：短 ping。
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 880, freqEnd: 660, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

// 雷达里程碑 ping（心跳事件，保证反馈密度）。
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 760, freqEnd: 820, dur: 0.05, sr, gain: 0.09, attack: 0.004, release: 0.03 });
}

// 波间强化 chime。
function sfxUpgrade(_p, sr) {
  return notes({ freqs: [523.25, 783.99, 1046.5], dur: 0.28, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.12, sr });
}

const SYNTH = {
  shoot: sfxShoot,
  heavy: sfxHeavy,
  enemyShot: sfxEnemyShot,
  hit: sfxHit,
  kill: sfxKill,
  playerHit: sfxPlayerHit,
  brickBreak: sfxBrickBreak,
  steelBreak: sfxSteelBreak,
  furnaceHit: sfxFurnaceHit,
  alarm: sfxAlarm,
  propSpawn: sfxPropSpawn,
  propGain: sfxPropGain,
  repair: sfxRepair,
  waveClear: sfxWaveClear,
  win: sfxWin,
  gameOver: sfxGameOver,
  ui: sfxUi,
  milestone: sfxMilestone,
  upgrade: sfxUpgrade,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop 的 PCM）：引擎嗡鸣
// ---------------------------------------------------------------------------

// 引擎嗡鸣：2s 低通噪声 + 100Hz 三角底噪 + 0.5Hz 慢 LFO（整数周期，首尾连续可无缝循环）。
function loopEngine(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 240, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  const hum = osc({ type: 'triangle', freq: 100, dur, sr, gain: 0.16, attack: 0, release: 0 });
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] = buf[i] * (0.05 + 0.03 * Math.sin(2 * Math.PI * 0.5 * t)) + hum[i];
  }
  return buf;
}

const LOOPS = {
  engine: loopEngine,
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

// 叠层优先级：重炮/击毁/破钢最高。
const SFX_PRIORITY = {
  heavy: 6, kill: 6, playerHit: 6,
  steelBreak: 5, furnaceHit: 5, win: 5,
  alarm: 4, gameOver: 4, waveClear: 4,
  hit: 3, brickBreak: 3, repair: 3,
  propGain: 2, propSpawn: 2, upgrade: 2, shoot: 2,
  enemyShot: 1, ui: 1, milestone: 1,
};

const EVENT_TO_SFX = {
  shot: 'shoot',
  shotHeavy: 'heavy',
  enemyShot: 'enemyShot',
  hit: 'hit',
  kill: 'kill',
  playerHit: 'playerHit',
  brickBreak: 'brickBreak',
  steelBreak: 'steelBreak',
  furnaceHit: 'furnaceHit',
  alarm: 'alarm',
  propSpawn: 'propSpawn',
  propGain: 'propGain',
  repair: 'repair',
  waveClear: 'waveClear',
  win: 'win',
  death: 'gameOver',
  milestone: 'milestone',
  upgrade: 'upgrade',
  ui: 'ui',
  playerSpawn: 'ui',
};

// ---------------------------------------------------------------------------
// 播放层
// ---------------------------------------------------------------------------

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    volume: clamp(Sdk.load('audioVolume', 0.7), 0, 1),
    muted: !!Sdk.load('audioMuted', false),
    unlocked: false,
    bgmSource: null,
    bgmUrl: null,
    bgmBuffer: null,
    loops: { engine: null },
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
      startLoop('engine'); // 引擎嗡鸣：首次手势即起
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

  async function playBgm(src) {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
    try {
      let buf = null;
      if (src && typeof src === 'object' && typeof src.getChannelData === 'function') {
        buf = src;
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
      node.connect(state.sfxBus);
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
