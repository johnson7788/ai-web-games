// src/core/audio.js — KNIFE LORE · WebAudio 程序化合成（零依赖零外链，不打包音频文件）
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     BGM 用程序化音乐循环（竹庭/暮城/雪岳三套尺八风 pentatonic 循环）。
//
// 契约（docs/knife-lore/README.md 事件表）：
//   createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(name|buffer), stopBgm() }

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.25;    // 噪声滤波后统一归一到的 RMS

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
// 各音效合成器（均为 (payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

// 掷刀：上扬带通白噪 whoosh
function sfxThrow(_p, sr) {
  return noise({ dur: 0.16, sr, gain: 0.4, filter: 'bandpass', cutoff: 1600, attack: 0.02, release: 0.08 });
}

// 插刀：木质 thock + 极短高频 click
function sfxKnifeStick(p, sr) {
  const thud = osc({ type: 'triangle', freq: 320, freqEnd: 140, dur: 0.09, sr, gain: 0.5, attack: 0.003, release: 0.05 });
  const click = noise({ dur: 0.03, sr, gain: 0.16, filter: 'highpass', cutoff: 2400, attack: 0.001, release: 0.012 });
  return mix(thud, click);
}

// 崩刀：金属 crash + 低频轰
function sfxKnifeBreak(_p, sr) {
  const clang = noise({ dur: 0.22, sr, gain: 0.4, filter: 'bandpass', cutoff: 3200, attack: 0.002, release: 0.11 });
  const thud = osc({ type: 'triangle', freq: 180, freqEnd: 60, dur: 0.3, sr, gain: 0.45, attack: 0.004, release: 0.15 });
  return mix(clang, thud);
}

// 过关：上行五声音阶 fanfare
function sfxLevelCleared(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.42, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

// 通关：更长的四音和弦 fanfare
function sfxGameWon(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25], dur: 0.6, gap: 0.14, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.22, sr });
}

// 对称加成：双音 sparkle chime
function sfxSymBonus(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, freqEnd: 1174.66, dur: 0.12, sr, gain: 0.24, attack: 0.004, release: 0.06 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.16, sr, gain: 0.14, attack: 0.004, release: 0.08 });
  const out = new Float32Array(Math.round(0.2 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.05 * sr));
  return out;
}

// 斩铁：金属光泽 shimmer
function sfxZantie(_p, sr) {
  return notes({ freqs: [1567.98, 2093, 2637.02], dur: 0.16, gap: 0.05, type: 'sine', gain: 0.14, attack: 0.005, release: 0.08, sr });
}

// 死亡：下坠 gliss
function sfxDeath(_p, sr) {
  return osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.8, sr, gain: 0.38, attack: 0.01, release: 0.25 });
}

// 旋转里程碑：极短、极轻的 tick（连续播也不抢戏）
function sfxSweep(_p, sr) {
  return osc({ type: 'sine', freq: 1200, freqEnd: 900, dur: 0.02, sr, gain: 0.05, attack: 0.002, release: 0.01 });
}

// 脉冲/反转：短促 whoosh tick
function sfxPulse(_p, sr) {
  return noise({ dur: 0.08, sr, gain: 0.2, filter: 'bandpass', cutoff: 900, attack: 0.01, release: 0.04 });
}

// UI 按钮：短 ping
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.25, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

const SYNTH = {
  throw: sfxThrow,
  knifeStick: sfxKnifeStick,
  knifeBreak: sfxKnifeBreak,
  levelCleared: sfxLevelCleared,
  gameWon: sfxGameWon,
  symBonus: sfxSymBonus,
  zantie: sfxZantie,
  death: sfxDeath,
  sweep: sfxSweep,
  pulse: sfxPulse,
  ui: sfxUi,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 音乐循环层（可无缝 loop 的 PCM）：竹庭 / 暮城 / 雪岳 三套程序化 BGM
// ---------------------------------------------------------------------------

// 五声音阶音乐循环：固定时长 L，低音 drone + 等间隔 pluck，LFO 整数周期保证无缝。
function musicLoop({ base, scale, pluckGap, gain, droneGain, lfoHz, sr }) {
  const L = 4;
  const n = Math.round(L * sr);
  const out = new Float32Array(n);

  // 低音 drone（三角波 + 慢 LFO 振幅，整数周期）
  const droneN = Math.round(L * sr);
  const drone = new Float32Array(droneN);
  let phase = 0;
  for (let i = 0; i < droneN; i += 1) {
    phase += (2 * Math.PI * base) / sr;
    drone[i] = Math.sin(phase);
  }
  for (let i = 0; i < droneN; i += 1) {
    const t = i / sr;
    drone[i] *= droneGain * (0.55 + 0.45 * Math.sin(2 * Math.PI * lfoHz * t));
  }
  addAt(out, drone, 0);

  // 等间隔 pluck
  const count = Math.floor(L / pluckGap);
  for (let k = 0; k < count; k += 1) {
    const f = scale[k % scale.length];
    const s = osc({ type: 'triangle', freq: f, freqEnd: f * 0.985, dur: 0.5, sr, gain, attack: 0.01, release: 0.28 });
    addAt(out, s, Math.round(k * pluckGap * sr));
  }

  // 归一化峰值，避免削波
  let peak = 0;
  for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.9) {
    const k = 0.9 / peak;
    for (let i = 0; i < n; i += 1) out[i] *= k;
  }
  return out;
}

function loopBamboo(sr) {
  return musicLoop({ base: 110, scale: [220, 261.63, 293.66, 329.63, 392, 440], pluckGap: 0.5, gain: 0.18, droneGain: 0.12, lfoHz: 1, sr });
}
function loopDusk(sr) {
  return musicLoop({ base: 98, scale: [196, 233.08, 261.63, 293.66, 311.13, 349.23], pluckGap: 0.67, gain: 0.16, droneGain: 0.13, lfoHz: 0.75, sr });
}
function loopSnow(sr) {
  return musicLoop({ base: 130.81, scale: [261.63, 293.66, 329.63, 392, 440, 523.25], pluckGap: 0.8, gain: 0.13, droneGain: 0.1, lfoHz: 0.5, sr });
}

const LOOPS = {
  bamboo: loopBamboo,
  dusk: loopDusk,
  snow: loopSnow,
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

// 叠层优先级：崩刀/过关优先保
const SFX_PRIORITY = {
  knifeBreak: 6, levelCleared: 6, gameWon: 6,
  knifeStick: 5, death: 5,
  symBonus: 4, zantie: 4,
  throw: 3, pulse: 3,
  ui: 2, sweep: 1,
};

const EVENT_TO_SFX = {
  throw: 'throw',
  knifeStick: 'knifeStick',
  knifeBreak: 'knifeBreak',
  levelCleared: 'levelCleared',
  gameWon: 'gameWon',
  symBonus: 'symBonus',
  zantie: 'zantie',
  death: 'death',
  sweep: 'sweep',
  pulseStart: 'pulse',
  pulseEnd: 'pulse',
  reversal: 'pulse',
  ui: 'ui',
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
    volume: clamp(0.7, 0, 1),
    muted: false,
    unlocked: false,
    bgmSource: null,
    bgmName: null,
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
    state.bgmBus.gain.value = 0.9;
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
    if (type === 'sweep') {
      // 桩旋转反馈每帧都有；音效只偶尔 tick 一下，避免 60Hz 爆音
      const now = (ensureCtx() && state.ctx) ? state.ctx.currentTime : 0;
      if (now - (state._lastSweepAt || 0) < 0.2) return;
      state._lastSweepAt = now;
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

  // BGM：直接程序化合成循环（名字 bamboo/dusk/snow），或传 AudioBuffer
  function playBgm(src) {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
    try {
      let buf = null;
      if (src && typeof src === 'object' && typeof src.getChannelData === 'function') {
        buf = src;
      } else if (typeof src === 'string' && LOOPS[src]) {
        const pcm = synthLoop(src, ctx.sampleRate);
        buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
        buf.getChannelData(0).set(pcm);
      }
      if (!buf) return;
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.connect(state.bgmBus);
      node.start();
      state.bgmSource = node;
      state.bgmName = typeof src === 'string' ? src : null;
    } catch { /* BGM 合成失败静默降级，不影响 SFX */ }
  }

  function stopBgm() {
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
