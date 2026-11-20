// src/core/audio.js — GOBLIN MINES · 程序化 WebAudio 合成（零依赖零外链）。
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，
//     直接算成 mono Float32Array PCM，供 tools/audio-check.mjs 在 Node 里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode 播放；
//     BGM 用多层 loop 的 AudioBufferSourceNode 无缝循环（矿洞环境底噪 + 灯笼琶音）。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(), stopBgm() }
// 事件名与 sim 事件表一字不差（见 src/game/sim.js）。

import { save } from './save.js';

export const SAMPLE_RATE = 44100;

const MAX_VOICES = 4;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 20;      // 同一音效 20ms 内去重（防一帧多次爆音）
const NOISE_RMS = 0.25;

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
// 各音效合成器（(payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

// 交换矿石：短促 click + 上滑 blip
function sfxSwap(_p, sr) {
  const click = noise({ dur: 0.03, sr, gain: 0.15, filter: 'highpass', cutoff: 1800, attack: 0.001, release: 0.01 });
  const blip = osc({ type: 'sine', freq: 640, freqEnd: 720, dur: 0.06, sr, gain: 0.18, attack: 0.002, release: 0.03 });
  return mix(click, blip);
}

// 三连消：矿石爆裂 pop；连击越高音高越高
function sfxMatch(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 520 * Math.pow(2, combo / 12);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 0.62, dur: 0.16, sr, gain: 0.42, attack: 0.004, release: 0.09 });
  const pop = noise({ dur: 0.06, sr, gain: 0.22, filter: 'lowpass', cutoff: f * 4, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

// 大型消除（4/5 连）：更亮的琶音
function sfxMatchBig(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.3, gap: 0.08, type: 'triangle', gain: 0.2, sr });
}

// 岩壁碎裂：低频 thud + 石头噪声
function sfxRock(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 70, dur: 0.16, sr, gain: 0.4, attack: 0.004, release: 0.09 });
  const nz = noise({ dur: 0.12, sr, gain: 0.28, filter: 'lowpass', cutoff: 500, attack: 0.003, release: 0.07 });
  return mix(thud, nz);
}

// 冻结解冻：玻璃感高频
function sfxFrozen(_p, sr) {
  return noise({ dur: 0.1, sr, gain: 0.22, filter: 'bandpass', cutoff: 2600, attack: 0.003, release: 0.06 });
}

// 向下挖：低频隆隆 + 短噪声
function sfxDig(_p, sr) {
  const rumble = osc({ type: 'triangle', freq: 70, freqEnd: 40, dur: 0.45, sr, gain: 0.5, attack: 0.01, release: 0.2 });
  const nz = noise({ dur: 0.35, sr, gain: 0.3, filter: 'lowpass', cutoff: 300, attack: 0.02, release: 0.18 });
  return mix(rumble, nz);
}

// 塌方：重低音 + 长噪声
function sfxCollapse(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 55, freqEnd: 30, dur: 0.7, sr, gain: 0.55, attack: 0.005, release: 0.3 });
  const nz = noise({ dur: 0.6, sr, gain: 0.34, filter: 'lowpass', cutoff: 240, attack: 0.01, release: 0.3 });
  return mix(thud, nz);
}

// 加固：金属叮当
function sfxReinforce(_p, sr) {
  const a = osc({ type: 'square', freq: 700, freqEnd: 680, dur: 0.05, sr, gain: 0.12, attack: 0.002, release: 0.02 });
  const b = osc({ type: 'square', freq: 1050, freqEnd: 1020, dur: 0.07, sr, gain: 0.1, attack: 0.002, release: 0.03 });
  const out = new Float32Array(Math.round(0.14 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.05 * sr));
  return out;
}

// 采到矿石：上滑 blip（不同矿石不同基频由 payload.kind 决定）
function sfxOre(p, sr) {
  const base = { ruby: 660, sapphire: 620, amethyst: 740, emerald: 560, fuel: 500, gold: 880 }[p.kind] || 640;
  return osc({ type: 'sine', freq: base, freqEnd: base * 1.7, dur: 0.12, sr, gain: 0.3, attack: 0.005, release: 0.06 });
}

// 金币：双音 sparkle
function sfxCoin(_p, sr) {
  const a = osc({ type: 'sine', freq: 988, dur: 0.07, sr, gain: 0.24, attack: 0.002, release: 0.03 });
  const b = osc({ type: 'sine', freq: 1319, dur: 0.09, sr, gain: 0.18, attack: 0.002, release: 0.04 });
  const out = new Float32Array(Math.round(0.16 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.05 * sr));
  return out;
}

// 矿兽受击：重低频
function sfxBossHit(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 80, freqEnd: 48, dur: 0.2, sr, gain: 0.5, attack: 0.004, release: 0.1 });
  const nz = noise({ dur: 0.16, sr, gain: 0.3, filter: 'lowpass', cutoff: 180, attack: 0.003, release: 0.08 });
  return mix(thud, nz);
}

// 矿兽击破：低音和弦 + 噪声 crash
function sfxBossBreak(_p, sr) {
  const chord = notes({ freqs: [55, 82.41, 110, 164.81], dur: 0.9, gap: 0, type: 'triangle', gain: 0.16, attack: 0.02, release: 0.35, sr });
  const crash = noise({ dur: 0.5, sr, gain: 0.16, filter: 'lowpass', cutoff: 900, attack: 0.004, release: 0.25 });
  return mix(chord, crash);
}

// 技能：上扬 whoosh
function sfxSkill(_p, sr) {
  return noise({ dur: 0.3, sr, gain: 0.4, filter: 'bandpass', cutoff: 1400, attack: 0.03, release: 0.12 });
}

// 死亡：下坠 gliss + 噪声
function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 55, dur: 0.9, sr, gain: 0.42, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

// 矿道打通：上行 fanfare
function sfxShaftClear(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.4, gap: 0.11, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.16, sr });
}

// 新纪录：3 音 fanfare + 高八度
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

// 深度里程碑：极短 ping
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

// UI 按钮
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

// 雇佣/升级地精：木门吱呀（低频 + 上滑）
function sfxGoblin(_p, sr) {
  const creak = osc({ type: 'triangle', freq: 180, freqEnd: 260, dur: 0.18, sr, gain: 0.25, attack: 0.01, release: 0.08 });
  const ping = osc({ type: 'sine', freq: 1200, freqEnd: 1500, dur: 0.09, sr, gain: 0.14, attack: 0.004, release: 0.05 });
  return mix(creak, ping);
}

// 教学完成 / 通用 chime
function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  swap: sfxSwap,
  match: sfxMatch,
  matchBig: sfxMatchBig,
  rock: sfxRock,
  frozen: sfxFrozen,
  dig: sfxDig,
  collapse: sfxCollapse,
  reinforce: sfxReinforce,
  ore: sfxOre,
  coin: sfxCoin,
  bossHit: sfxBossHit,
  bossBreak: sfxBossBreak,
  skill: sfxSkill,
  death: sfxDeath,
  shaftClear: sfxShaftClear,
  newRecord: sfxNewRecord,
  milestone: sfxMilestone,
  ui: sfxUi,
  goblin: sfxGoblin,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（可无缝 loop 的 PCM）：矿洞环境底噪 / 灯笼琶音
// ---------------------------------------------------------------------------

function loopCave(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 240, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.05 + 0.02 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return buf;
}

function loopLantern(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  // 灯笼琶音（C 小调 C4-D#4-G4-A#4），1 周期无缝
  const chord = [261.63, 311.13, 392.0, 466.16];
  chord.forEach((f, k) => {
    const tone = osc({ type: 'sine', freq: f, freqEnd: f * 1.01, dur: 3.6, sr, gain: 0.05, attack: 0.6, release: 1.2 });
    addAt(out, tone, Math.round((k * 0.9) * sr));
  });
  return out;
}

const LOOPS = {
  cave: loopCave,
  lantern: loopLantern,
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
  match: 6, matchBig: 6, rock: 5, bossBreak: 5,
  death: 4, dig: 4, shaftClear: 4, newRecord: 4, collapse: 4,
  bossHit: 3, reinforce: 3,
  ore: 2, coin: 2, goblin: 2, chime: 2, frozen: 2,
  swap: 1, skill: 1, milestone: 1, ui: 1,
};

const EVENT_TO_SFX = {
  swap: 'swap',
  match: 'match',
  matchBig: 'matchBig',
  rockBreak: 'rock',
  frozenBreak: 'frozen',
  dig: 'dig',
  collapse: 'collapse',
  reinforce: 'reinforce',
  oreGain: 'ore',
  coinGain: 'coin',
  bossHit: 'bossHit',
  bossBreak: 'bossBreak',
  skill: 'skill',
  death: 'death',
  shaftClear: 'shaftClear',
  newRecord: 'newRecord',
  depthMilestone: 'milestone',
  tutorialDone: 'chime',
  goblinHire: 'goblin',
  goblinUpgrade: 'goblin',
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
    bgmSource: null,
    loops: { cave: null, lantern: null },
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
    state.sfxBus.connect(state.master);
    state.bgmBus = state.ctx.createGain();
    state.bgmBus.gain.value = 0.6;
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
      for (const [key, v] of state.active) if (v.priority < minPrio) { minPrio = v.priority; minKey = key; }
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
    state.active.set(key, { name, priority, endTime: now + pcm.length / ctx.sampleRate, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
  }

  function startLoop(kind) {
    const ctx = ensureCtx();
    if (!ctx || state.loops[kind]) return;
    const pcm = synthLoop(kind, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = kind === 'cave' ? 0.6 : 0.4;
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

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) { resumeIfNeeded(); startLoop('cave'); startLoop('lantern'); }
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

  function playBgm() { ensureCtx(); startLoop('cave'); startLoop('lantern'); }
  function stopBgm() { stopLoop('cave'); stopLoop('lantern'); }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
