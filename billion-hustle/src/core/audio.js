// src/core/audio.js — BILLION HUSTLE · 音效与分层 BGM 合成（WebAudio 标准 API，零依赖零外链）
//
// 两层结构：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM，tools/audio-check.mjs 可在 Node（无 WebAudio）离线校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer → BufferSource → GainNode → destination；
//     BGM 用程序化分层循环（低音 + 和弦垫 + 琶音，整数周期无缝 loop），按场景切换。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(mode), stopBgm() }
// 事件名与 sim 事件表一致：click / income / upgrade / hire / bet / betWin / betLose /
//   windfall / burnStart / burnEnd / fund / valuationFlip / milestone / won / ui。

import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 24;
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
// 各音效合成器
// ---------------------------------------------------------------------------

// 点击挣钱：金币 blip（音高随每次收益微升，避免单调）
function sfxClick(p, sr) {
  const amount = clamp(Math.log2(p.amount ?? 1), 0, 24);
  const f = 620 * Math.pow(2, amount / 48);
  const blip = osc({ type: 'sine', freq: f, freqEnd: f * 1.6, dur: 0.09, sr, gain: 0.34, attack: 0.003, release: 0.05 });
  const spark = osc({ type: 'sine', freq: f * 2, freqEnd: f * 2.3, dur: 0.06, sr, gain: 0.1, attack: 0.002, release: 0.03 });
  return mix(blip, spark);
}

// 自动收入：极轻 tick（每 1s 一次，不抢戏）
function sfxIncome(_p, sr) {
  return osc({ type: 'sine', freq: 880, freqEnd: 980, dur: 0.04, sr, gain: 0.08, attack: 0.002, release: 0.02 });
}

// 购买升级：上滑 power-up chime
function sfxUpgrade(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.22, gap: 0.07, type: 'triangle', gain: 0.22, attack: 0.008, release: 0.1, sr });
}

// 雇佣伙伴：温暖两音和弦
function sfxHire(_p, sr) {
  return notes({ freqs: [523.25, 659.25], dur: 0.3, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.14, sr });
}

// 押注：干脆 click
function sfxBet(_p, sr) {
  const click = noise({ dur: 0.04, sr, gain: 0.2, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.02 });
  const tone = osc({ type: 'triangle', freq: 660, freqEnd: 520, dur: 0.08, sr, gain: 0.2, attack: 0.003, release: 0.04 });
  return mix(click, tone);
}

// 押中风口：短 fanfare（C-E-G）
function sfxBetWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.22, attack: 0.006, release: 0.14, sr });
}

// 押错：下坠
function sfxBetLose(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 250, dur: 0.22, sr, gain: 0.2, attack: 0.004, release: 0.1 });
}

// 新风口出现：上扬 whoosh
function sfxWindfall(_p, sr) {
  return noise({ dur: 0.4, sr, gain: 0.3, filter: 'bandpass', cutoff: 900, attack: 0.05, release: 0.18 });
}

// 烧钱开启：火焰 whoosh
function sfxBurnStart(_p, sr) {
  return noise({ dur: 0.35, sr, gain: 0.3, filter: 'lowpass', cutoff: 700, attack: 0.04, release: 0.16 });
}

// 烧钱结束/冷却：短 tick
function sfxBurnEnd(_p, sr) {
  return osc({ type: 'sine', freq: 420, freqEnd: 300, dur: 0.1, sr, gain: 0.16, attack: 0.003, release: 0.06 });
}

// 融资完成：三音上行
function sfxFund(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25], dur: 0.34, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.008, release: 0.14, sr });
}

// 估值翻牌：翻牌 tick
function sfxValuationFlip(_p, sr) {
  const tick = noise({ dur: 0.05, sr, gain: 0.22, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.02 });
  const tone = osc({ type: 'triangle', freq: 740, freqEnd: 740, dur: 0.06, sr, gain: 0.18, attack: 0.002, release: 0.03 });
  return mix(tick, tone);
}

// 估值里程碑（每 10 倍）：轻 ping
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.07, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

// 达成一亿（won）：大 fanfare
function sfxWon(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25, 783.99], dur: 0.5, gap: 0.11, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.2, sr });
}

// UI 按钮
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

const SYNTH = {
  click: sfxClick,
  income: sfxIncome,
  upgrade: sfxUpgrade,
  hire: sfxHire,
  bet: sfxBet,
  betWin: sfxBetWin,
  betLose: sfxBetLose,
  windfall: sfxWindfall,
  burnStart: sfxBurnStart,
  burnEnd: sfxBurnEnd,
  fund: sfxFund,
  valuationFlip: sfxValuationFlip,
  milestone: sfxMilestone,
  won: sfxWon,
  ui: sfxUi,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 分层 BGM 循环（整数周期，无缝 loop）
// ---------------------------------------------------------------------------

// 生成一个 dur 秒的无缝循环：chord 频率取整到「整数周期/时长」保证首尾连续。
function loopBgm({ dur = 4, sr = SAMPLE_RATE, chord = [110, 165, 220], arp = [440, 550, 660],
                  padGain = 0.06, arpGain = 0.05, arpStep = 0.25 } = {}) {
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // 和弦垫：整数周期
  for (const f of chord) {
    const fi = Math.round(f * dur) / dur;
    for (let i = 0; i < n; i += 1) out[i] += padGain * Math.sin(2 * Math.PI * fi * (i / sr));
  }
  // 低音：整数周期 + 轻微呼吸包络（周期数与 dur 对齐，无缝）
  for (const f of chord.slice(0, 1)) {
    const fi = Math.round(f * dur) / dur;
    for (let i = 0; i < n; i += 1) {
      const t = i / sr;
      out[i] += padGain * 0.8 * Math.sin(2 * Math.PI * fi * t) * (0.6 + 0.4 * Math.sin(2 * Math.PI * t / dur));
    }
  }
  // 琶音：短音符按拍落在循环内，包络在循环尾前衰减为 0
  const noteDur = arpStep * 0.8;
  const count = Math.floor(dur / arpStep);
  for (let k = 0; k < count; k += 1) {
    const f = arp[k % arp.length];
    const s = osc({ type: 'triangle', freq: f, dur: noteDur, sr, gain: arpGain, attack: 0.01, release: noteDur * 0.6 });
    addAt(out, s, Math.round(k * arpStep * sr));
  }
  return normalizeRms(out, 0.16);
}

function loopGarage(sr) {
  return loopBgm({ sr, chord: [98, 147, 196], arp: [392, 494, 587], padGain: 0.055 });
}
function loopIncubator(sr) {
  return loopBgm({ sr, chord: [110, 220, 330], arp: [440, 554, 660], padGain: 0.05, arpStep: 0.2 });
}
function loopSkyscraper(sr) {
  return loopBgm({ sr, chord: [82.5, 165, 247.5], arp: [330, 494, 659], padGain: 0.05, arpStep: 0.18 });
}

const LOOPS = {
  bgmGarage: loopGarage,
  bgmIncubator: loopIncubator,
  bgmSkyscraper: loopSkyscraper,
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

const SFX_PRIORITY = {
  won: 6, fund: 6, valuationFlip: 6,
  betWin: 5, upgrade: 5, hire: 5,
  burnStart: 4, windfall: 4, betLose: 4,
  milestone: 3, click: 3, bet: 3,
  burnEnd: 2, income: 2, ui: 1,
};

const EVENT_TO_SFX = {
  click: 'click',
  income: 'income',
  upgrade: 'upgrade',
  hire: 'hire',
  bet: 'bet',
  betWin: 'betWin',
  betLose: 'betLose',
  windfall: 'windfall',
  burnStart: 'burnStart',
  burnEnd: 'burnEnd',
  fund: 'fund',
  valuationFlip: 'valuationFlip',
  milestone: 'milestone',
  won: 'won',
  ui: 'ui',
};

// 场景 → BGM loop 名
const SCENE_TO_BGM = {
  garage: 'bgmGarage',
  incubator: 'bgmIncubator',
  skyscraper: 'bgmSkyscraper',
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

  function stopBgm() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
      state.bgmName = null;
    }
  }

  function playBgm(mode) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const name = SCENE_TO_BGM[mode] || 'bgmGarage';
    if (state.bgmName === name && state.bgmSource) return;
    stopBgm();
    const pcm = synthLoop(name, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(state.bgmBus);
    src.start();
    state.bgmSource = src;
    state.bgmName = name;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
