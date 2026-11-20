// src/core/audio.js — HERO VANGUARD · 程序化 WebAudio（零依赖零外链）
//
// 两层结构：
//  1) 采样级合成器（纯函数，无 DOM/WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，
//     直接算成 mono Float32Array PCM，供 tools/audio-check.mjs 在 Node 里离线校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer → AudioBufferSourceNode → GainNode 播放；
//     BGM 用 synthLoop 生成的循环 PCM 无缝 loop（分层垫底：低音 + 铺底 + 琶音）。
//
// 契约：createAudio() → { unlock, event(type,payload), setMuted(b), setVolume(v), playBgm(name), stopBgm() }

import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 3;
const DEDUPE_MS = 24;
const NOISE_RMS = 0.24;

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

// 射击：短促上扬 blip（弓更清脆、刃更低沉）
function sfxShot(p, sr) {
  const base = p.kind === 'blade' ? 300 : 620;
  const a = osc({ type: 'triangle', freq: base, freqEnd: base * 1.5, dur: 0.07, sr, gain: 0.28, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.08, filter: 'highpass', cutoff: 2400, attack: 0.001, release: 0.008 });
  return mix(a, click);
}

// 命中：低频 thud + 短 click
function sfxHit(p, sr) {
  const f = p.shield ? 520 : 260;
  const thud = osc({ type: 'triangle', freq: f, freqEnd: f * 0.55, dur: 0.09, sr, gain: 0.3, attack: 0.003, release: 0.04 });
  const click = noise({ dur: 0.025, sr, gain: 0.12, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.01 });
  return mix(thud, click);
}

// 击杀：pop + 上行 sparkle（Boss 用低沉和弦）
function sfxKill(p, sr) {
  if (p.enemy === 'boss') {
    return notes({ freqs: [110, 164.81, 220], dur: 0.5, gap: 0.02, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.22, sr });
  }
  const pop = osc({ type: 'triangle', freq: 420, freqEnd: 190, dur: 0.14, sr, gain: 0.4, attack: 0.003, release: 0.07 });
  const spark = osc({ type: 'sine', freq: 880, freqEnd: 1400, dur: 0.09, sr, gain: 0.16, attack: 0.002, release: 0.05 });
  return mix(pop, spark);
}

// 金币：双音 blip
function sfxGold(_p, sr) {
  const a = osc({ type: 'sine', freq: 980, freqEnd: 1180, dur: 0.07, sr, gain: 0.2, attack: 0.002, release: 0.03 });
  const b = osc({ type: 'sine', freq: 1470, freqEnd: 1660, dur: 0.07, sr, gain: 0.14, attack: 0.002, release: 0.03 });
  return mix(a, b);
}

// 基地受击：重低频 + 噪声（危险信号）
function sfxBaseHit(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 88, freqEnd: 46, dur: 0.24, sr, gain: 0.5, attack: 0.004, release: 0.12 });
  const nz = noise({ dur: 0.18, sr, gain: 0.3, filter: 'lowpass', cutoff: 260, attack: 0.003, release: 0.09 });
  return mix(thud, nz);
}

// 波次开始：小号三连（A-C-E）
function sfxWaveStart(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.18, attack: 0.04, release: 0.16, sr });
}

// 波次清空：上行琶音
function sfxWaveClear(_p, sr) {
  return notes({ freqs: [329.63, 392, 493.88, 659.25], dur: 0.42, gap: 0.09, type: 'triangle', gain: 0.17, attack: 0.03, release: 0.14, sr });
}

// 升级选择：轻 chime
function sfxUpgrade(_p, sr) {
  const a = osc({ type: 'sine', freq: 660, dur: 0.24, sr, gain: 0.2, attack: 0.008, release: 0.1 });
  const b = osc({ type: 'sine', freq: 990, dur: 0.24, sr, gain: 0.13, attack: 0.008, release: 0.1 });
  return mix(a, b);
}

// 共鸣斩：宽频带通 whoosh + 低频轰
function sfxResonance(_p, sr) {
  const whoosh = noise({ dur: 0.32, sr, gain: 0.34, filter: 'bandpass', cutoff: 1500, attack: 0.02, release: 0.14 });
  const boom = osc({ type: 'triangle', freq: 130, freqEnd: 60, dur: 0.3, sr, gain: 0.4, attack: 0.006, release: 0.15 });
  return mix(whoosh, boom);
}

// 换位：快速上滑 gliss
function sfxSwap(_p, sr) {
  return osc({ type: 'sawtooth', freq: 240, freqEnd: 720, dur: 0.16, sr, gain: 0.22, attack: 0.006, release: 0.07 });
}

// 护盾充能起手：上抬 pad
function sfxShieldCharge(_p, sr) {
  return osc({ type: 'sine', freq: 300, freqEnd: 480, dur: 0.3, sr, gain: 0.22, attack: 0.06, release: 0.12 });
}

// 护盾到账：坚定双音
function sfxShieldGain(_p, sr) {
  const a = osc({ type: 'triangle', freq: 392, dur: 0.22, sr, gain: 0.26, attack: 0.008, release: 0.1 });
  const b = osc({ type: 'triangle', freq: 523.25, dur: 0.22, sr, gain: 0.18, attack: 0.008, release: 0.1 });
  return mix(a, b);
}

// 胜利：四音 fanfare
function sfxWin(_p, sr) {
  return notes({ freqs: [392, 493.88, 587.33, 783.99], dur: 0.5, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.2, sr });
}

// 死亡：下坠 gliss + 低频噪声
function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.95, sr, gain: 0.4, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

// 擦肩 nearMiss：短促高频 tick
function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1120, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}

// Boss 登场：低沉警报
function sfxBossSpawn(_p, sr) {
  const drone = osc({ type: 'square', freq: 82, freqEnd: 55, dur: 0.7, sr, gain: 0.2, attack: 0.03, release: 0.25 });
  const nz = noise({ dur: 0.5, sr, gain: 0.2, filter: 'lowpass', cutoff: 320, attack: 0.02, release: 0.2 });
  return mix(drone, nz);
}

// UI 按钮：短 ping + click
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

// 新纪录：C5-E5-G5 fanfare
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

// 教程完成 / 轻 chime
function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  shot: sfxShot,
  hit: sfxHit,
  kill: sfxKill,
  gold: sfxGold,
  baseHit: sfxBaseHit,
  waveStart: sfxWaveStart,
  waveClear: sfxWaveClear,
  upgrade: sfxUpgrade,
  resonance: sfxResonance,
  swap: sfxSwap,
  shieldCharge: sfxShieldCharge,
  shieldGain: sfxShieldGain,
  win: sfxWin,
  death: sfxDeath,
  nearMiss: sfxNearMiss,
  bossSpawn: sfxBossSpawn,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 循环层（无缝 loop：整数周期 + 首尾连续包络）
// ---------------------------------------------------------------------------

// 近轨主题：明亮 A 小调垫底 + 低音 + 慢琶音
function loopMain(sr) {
  const dur = 8; // 8s 一循环
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // 低音（A2 持续）
  addAt(out, osc({ type: 'triangle', freq: 110, dur: dur, sr, gain: 0.12, attack: 0.4, release: 0.4 }), 0);
  // 铺底 pad（A3-C4-E4，慢 LFO 呼吸）
  const pad = mix(
    osc({ type: 'sine', freq: 220, dur: dur, sr, gain: 0.08, attack: 0.5, release: 0.5 }),
    osc({ type: 'sine', freq: 261.63, dur: dur, sr, gain: 0.06, attack: 0.5, release: 0.5 }),
    osc({ type: 'sine', freq: 329.63, dur: dur, sr, gain: 0.05, attack: 0.5, release: 0.5 }),
  );
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const lfo = 0.75 + 0.25 * Math.sin(2 * Math.PI * 0.25 * t); // 0.25Hz 呼吸
    out[i] += pad[i] * lfo;
  }
  // 慢琶音
  const arpFreqs = [220, 261.63, 329.63, 392, 329.63, 261.63];
  for (let k = 0; k < arpFreqs.length; k += 1) {
    addAt(out, osc({ type: 'triangle', freq: arpFreqs[k], dur: 0.6, sr, gain: 0.05, attack: 0.02, release: 0.2 }), Math.round(k * (dur / arpFreqs.length) * sr));
  }
  return out;
}

// 深空 Boss 主题：更暗更重
function loopBoss(sr) {
  const dur = 8;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  addAt(out, osc({ type: 'triangle', freq: 55, dur: dur, sr, gain: 0.14, attack: 0.3, release: 0.4 }), 0);
  const pad = mix(
    osc({ type: 'sawtooth', freq: 110, dur: dur, sr, gain: 0.05, attack: 0.5, release: 0.5 }),
    osc({ type: 'sawtooth', freq: 164.81, dur: dur, sr, gain: 0.04, attack: 0.5, release: 0.5 }),
  );
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    out[i] += pad[i] * (0.6 + 0.4 * Math.sin(2 * Math.PI * 0.5 * t));
  }
  addAt(out, noise({ dur: 2, sr, gain: 0.03, filter: 'lowpass', cutoff: 300, attack: 0.4, release: 0.4 }), 0);
  return out;
}

const LOOPS = {
  main: loopMain,
  boss: loopBoss,
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
  resonance: 6, kill: 6, death: 5, win: 5,
  baseHit: 4, waveClear: 4, bossSpawn: 4, newRecord: 4,
  shieldGain: 3, upgrade: 3, swap: 3,
  hit: 2, shot: 2, gold: 2, waveStart: 2,
  nearMiss: 1, shieldCharge: 1, ui: 1, chime: 1,
};

const EVENT_TO_SFX = {
  shot: 'shot',
  hit: 'hit',
  kill: 'kill',
  gold: 'gold',
  baseHit: 'baseHit',
  waveStart: 'waveStart',
  waveClear: 'waveClear',
  upgrade: 'upgrade',
  resonance: 'resonance',
  swap: 'swap',
  shieldCharge: 'shieldCharge',
  shieldGain: 'shieldGain',
  shieldCancel: 'ui',
  win: 'win',
  death: 'death',
  nearMiss: 'nearMiss',
  bossSpawn: 'bossSpawn',
  tutorialDone: 'chime',
  newRecord: 'newRecord',
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
    state.bgmBus.gain.value = 0.85;
    state.bgmBus.connect(state.master);
    resumeIfNeeded();
    return state.ctx;
  }

  function playSfx(name, payload) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < DEDUPE_MS / 1000) return;
    state.lastPlay.set(name, now);

    const priority = SFX_PRIORITY[name] ?? 1;
    const alive = [];
    for (const [key, v] of state.active) {
      if (v.endTime > now) alive.push([key, v]);
      else if (v.stop) { try { v.stop(now); } catch { /* noop */ } }
    }
    state.active = new Map(alive);
    if (state.active.size >= MAX_VOICES) {
      let minKey = null; let minPrio = Infinity;
      for (const [key, v] of state.active) {
        if (v.priority < minPrio) { minPrio = v.priority; minKey = key; }
      }
      if (minKey == null || priority <= minPrio) return;
      const v = state.active.get(minKey);
      if (v && v.stop) { try { v.stop(now); } catch { /* noop */ } }
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

  async function playBgm(name) {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
    try {
      const pcm = synthLoop(name || 'main', ctx.sampleRate);
      const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      buf.getChannelData(0).set(pcm);
      const node = ctx.createBufferSource();
      node.buffer = buf;
      node.loop = true;
      node.connect(state.bgmBus);
      node.start();
      state.bgmSource = node;
      state.bgmName = name || 'main';
    } catch { /* BGM 合成失败静默降级 */ }
  }

  function stopBgm() {
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
