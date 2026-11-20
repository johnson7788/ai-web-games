// src/core/audio.js — EGG BOOM · 音效合成与播放（WebAudio 标准 API，零依赖零外链）
//
// 两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，算成 mono PCM。
//     这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验 RMS/峰值。
//  2) 浏览器播放层：PCM 灌 AudioBuffer → BufferSource → Gain → destination。
// 事件名与 sim 事件表一致（见 docs/analysis.md），外加 UI 侧 ui / newRecord。

import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 2;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.25;

// ---------------------------------------------------------------------------
// DSP 原语
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

// 发射米粒弹：短促 pop
function sfxShoot(_p, sr) {
  const pop = osc({ type: 'triangle', freq: 760, freqEnd: 320, dur: 0.06, sr, gain: 0.3, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.025, sr, gain: 0.12, filter: 'highpass', cutoff: 2400, attack: 0.001, release: 0.01 });
  return mix(pop, click);
}

// 弹命中面团：闷响 tick
function sfxDoughHit(p, sr) {
  const value = clamp(p.value ?? 1, 1, 20);
  const f = 300 * Math.pow(2, -value / 24);
  return osc({ type: 'triangle', freq: f, freqEnd: f * 0.6, dur: 0.07, sr, gain: 0.32, attack: 0.003, release: 0.03 });
}

// 破团：面团裂开 pop（连击越高音越高）
function sfxDoughBreak(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 420 * Math.pow(2, combo / 12);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 0.55, dur: 0.16, sr, gain: 0.45, attack: 0.004, release: 0.08 });
  const crack = noise({ dur: 0.05, sr, gain: 0.2, filter: 'lowpass', cutoff: f * 4, attack: 0.002, release: 0.03 });
  return mix(tone, crack);
}

// 跳起：上扬 whoosh
function sfxJump(_p, sr) {
  return noise({ dur: 0.22, sr, gain: 0.34, filter: 'bandpass', cutoff: 900, attack: 0.02, release: 0.1 });
}

// 落地：轻闷响
function sfxLand(_p, sr) {
  return osc({ type: 'triangle', freq: 160, freqEnd: 90, dur: 0.08, sr, gain: 0.26, attack: 0.003, release: 0.04 });
}

// 连击 +1：双音 sparkle
function sfxComboUp(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 660 * Math.pow(2, combo / 12);
  const a = osc({ type: 'sine', freq: f, freqEnd: f * 1.3, dur: 0.08, sr, gain: 0.2, attack: 0.003, release: 0.04 });
  const b = osc({ type: 'sine', freq: f * 1.5, freqEnd: f * 1.9, dur: 0.08, sr, gain: 0.15, attack: 0.003, release: 0.04 });
  const out = new Float32Array(Math.round(0.16 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.06 * sr));
  return out;
}

// 连击中断：下坠 tick
function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 230, dur: 0.16, sr, gain: 0.2, attack: 0.005, release: 0.08 });
}

// 蛋黄弹就绪：上扬 chime
function sfxYolkReady(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.22, gap: 0.07, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.1, sr });
}

// 蛋黄弹爆：范围炸响
function sfxYolkFired(_p, sr) {
  const boom = osc({ type: 'triangle', freq: 130, freqEnd: 50, dur: 0.3, sr, gain: 0.4, attack: 0.004, release: 0.15 });
  const splash = noise({ dur: 0.25, sr, gain: 0.28, filter: 'lowpass', cutoff: 700, attack: 0.003, release: 0.12 });
  return mix(boom, splash);
}

// 拾取道具：上滑 blip（种类不同音高不同）
function sfxPropGain(p, sr) {
  const base = p.kind === 'fire' ? 620 : p.kind === 'ammo' ? 520 : 440;
  return osc({ type: 'sine', freq: base, freqEnd: base * 1.8, dur: 0.14, sr, gain: 0.3, attack: 0.005, release: 0.06 });
}

// 壳碎：清脆 crack
function sfxShellBreak(_p, sr) {
  const crack = noise({ dur: 0.12, sr, gain: 0.36, filter: 'bandpass', cutoff: 2200, attack: 0.002, release: 0.06 });
  const thud = osc({ type: 'triangle', freq: 220, freqEnd: 110, dur: 0.14, sr, gain: 0.3, attack: 0.003, release: 0.07 });
  return mix(crack, thud);
}

// 壳长回：柔和 chime
function sfxShellRegrow(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.18, sr, gain: 0.2, attack: 0.02, release: 0.1 });
}

// 护甲团弹开：金属 tick
function sfxArmorDeflect(_p, sr) {
  return osc({ type: 'square', freq: 880, freqEnd: 660, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

// 清整排：彩带 fanfare
function sfxRackClear(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.28, gap: 0.08, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.12, sr });
}

// 换关：上行琶音
function sfxLevelEnter(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.16, attack: 0.05, release: 0.16, sr });
}

// 换景：更大琶音
function sfxSceneEnter(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 392, 523.25], dur: 0.45, gap: 0.09, type: 'triangle', gain: 0.15, attack: 0.06, release: 0.18, sr });
}

// 滚动里程碑：极轻 ping
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 720, freqEnd: 900, dur: 0.05, sr, gain: 0.08, attack: 0.004, release: 0.03 });
}

// 蓄满：提示音
function sfxChargeFull(_p, sr) {
  return osc({ type: 'sine', freq: 880, dur: 0.1, sr, gain: 0.18, attack: 0.005, release: 0.06 });
}

// 无弹药：短促低 tick
function sfxNoAmmo(_p, sr) {
  return osc({ type: 'square', freq: 180, freqEnd: 140, dur: 0.05, sr, gain: 0.14, attack: 0.002, release: 0.02 });
}

// 死亡：下坠 gliss + 噪声
function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 500, freqEnd: 55, dur: 0.9, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

// 胜利 fanfare
function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.45, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.18, sr });
}

// UI 按钮
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

// 新纪录 fanfare
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

// 教学完成 / 通用 chime
function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  shoot: sfxShoot,
  doughHit: sfxDoughHit,
  doughBreak: sfxDoughBreak,
  jump: sfxJump,
  land: sfxLand,
  comboUp: sfxComboUp,
  comboBreak: sfxComboBreak,
  yolkReady: sfxYolkReady,
  yolkFired: sfxYolkFired,
  propGain: sfxPropGain,
  shellBreak: sfxShellBreak,
  shellRegrow: sfxShellRegrow,
  armorDeflect: sfxArmorDeflect,
  rackClear: sfxRackClear,
  levelEnter: sfxLevelEnter,
  sceneEnter: sfxSceneEnter,
  milestone: sfxMilestone,
  chargeFull: sfxChargeFull,
  noAmmo: sfxNoAmmo,
  death: sfxDeath,
  win: sfxWin,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// 循环层：无（本作 BGM 用简单程序化低频层，可选）
export const LOOP_NAMES = [];

const EVENT_TO_SFX = {
  shoot: 'shoot',
  doughHit: 'doughHit',
  doughBreak: 'doughBreak',
  jump: 'jump',
  land: 'land',
  comboUp: 'comboUp',
  comboBreak: 'comboBreak',
  yolkReady: 'yolkReady',
  yolkFired: 'yolkFired',
  propGain: 'propGain',
  shellBreak: 'shellBreak',
  shellRegrow: 'shellRegrow',
  armorDeflect: 'armorDeflect',
  rackClear: 'rackClear',
  levelEnter: 'levelEnter',
  sceneEnter: 'sceneEnter',
  milestone: 'milestone',
  chargeFull: 'chargeFull',
  noAmmo: 'noAmmo',
  death: 'death',
  win: 'win',
  ui: 'ui',
  newRecord: 'newRecord',
  tutorialDone: 'chime',
};

const SFX_PRIORITY = {
  doughBreak: 6, rackClear: 6, win: 6,
  yolkFired: 5, death: 5, shellBreak: 5, propGain: 5,
  levelEnter: 4, sceneEnter: 4, newRecord: 4,
  doughHit: 3, shoot: 3, comboUp: 3,
  jump: 3, land: 3, armorDeflect: 3, shellRegrow: 3, yolkReady: 3,
  chargeFull: 2, noAmmo: 2, comboBreak: 2, chime: 2,
  milestone: 1, ui: 1,
};

export function synthSfx(name, payload = {}, sr = SAMPLE_RATE) {
  const fn = SYNTH[name];
  if (!fn) throw new Error(`unknown sfx: ${name}`);
  return fn(payload || {}, sr);
}

export function synthLoop(name, sr = SAMPLE_RATE) {
  throw new Error(`unknown loop: ${name}`);
}

export function createAudio() {
  const state = {
    ctx: null,
    master: null,
    sfxBus: null,
    volume: clamp(save.get('audioVolume', 0.7), 0, 1),
    muted: !!save.get('audioMuted', false),
    unlocked: false,
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
      const mv = state.active.get(minKey);
      if (mv && mv.stop) { try { mv.stop(now); } catch { /* noop */ } }
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

  async function playBgm() { /* 本作无循环层，保留接口 */ }
  function stopBgm() { /* noop */ }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
