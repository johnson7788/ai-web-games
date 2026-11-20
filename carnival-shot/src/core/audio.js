// src/core/audio.js — CARNIVAL SHOT · 音效合成与播放（WebAudio 标准 API，零依赖零外链）。
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination 播放；
//     BGM 用程序化分层的无缝循环（pad / arp / shimmer），不打包任何音频文件。
//
// 事件名与 sim 事件表一字不差：shot / hit / miss / ghostHit / goldenHit / redDuckHit / reward /
//   reloadStart / reloadDone / comboUp / comboBreak / lanternRain / levelClear / levelFail /
//   nearMiss / milestone / gameWin，外加 UI 侧 ui、newRecord。

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
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

/** 白噪声 → 可选滤波 → 归一 RMS → 包络。 */
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

// 开枪：短促带通噪声 click + 下坠低频 thud。
function sfxShot(_p, sr) {
  const crack = noise({ dur: 0.05, sr, gain: 0.5, filter: 'bandpass', cutoff: 2600, attack: 0.001, release: 0.03 });
  const thud = osc({ type: 'triangle', freq: 240, freqEnd: 110, dur: 0.07, sr, gain: 0.28, attack: 0.002, release: 0.04 });
  return mix(thud, crack);
}

// 命中普通目标：清脆 pop，连击越高音越高。
function sfxHit(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 620 * Math.pow(2, combo / 12);
  const tone = osc({ type: 'triangle', freq: f, freqEnd: f * 0.62, dur: 0.15, sr, gain: 0.42, attack: 0.003, release: 0.07 });
  const pop = noise({ dur: 0.05, sr, gain: 0.2, filter: 'lowpass', cutoff: f * 4, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

// 脱靶：短促下滑 swish。
function sfxMiss(_p, sr) {
  return osc({ type: 'sine', freq: 780, freqEnd: 330, dur: 0.12, sr, gain: 0.2, attack: 0.004, release: 0.07 });
}

// 小鬼灯：低沉警告。
function sfxGhostHit(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 70, dur: 0.24, sr, gain: 0.42, attack: 0.004, release: 0.12 });
  const nz = noise({ dur: 0.18, sr, gain: 0.24, filter: 'lowpass', cutoff: 300, attack: 0.003, release: 0.1 });
  return mix(thud, nz);
}

// 金鸭：双音 sparkle。
function sfxGoldenHit(_p, sr) {
  return notes({ freqs: [880, 1318.5, 1760], dur: 0.22, gap: 0.06, type: 'triangle', gain: 0.24, attack: 0.005, release: 0.12, sr });
}

// 红灯鸭：轻 chime。
function sfxRedDuckHit(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.26, sr, gain: 0.22, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.26, sr, gain: 0.14, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

// 轮盘奖励：三音 fanfare。
function sfxReward(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.34, gap: 0.1, type: 'triangle', gain: 0.22, attack: 0.008, release: 0.16, sr });
}

// 换弹开始：金属 click。
function sfxReloadStart(_p, sr) {
  const click = noise({ dur: 0.04, sr, gain: 0.3, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.02 });
  const ping = osc({ type: 'sine', freq: 980, freqEnd: 720, dur: 0.06, sr, gain: 0.2, attack: 0.002, release: 0.03 });
  return mix(click, ping);
}

// 换弹完成：短促 clack。
function sfxReloadDone(_p, sr) {
  const clack = noise({ dur: 0.04, sr, gain: 0.32, filter: 'bandpass', cutoff: 900, attack: 0.001, release: 0.02 });
  const tone = osc({ type: 'triangle', freq: 500, freqEnd: 700, dur: 0.05, sr, gain: 0.2, attack: 0.002, release: 0.03 });
  return mix(clack, tone);
}

// 连击 +1：双音 sparkle 随连击升高。
function sfxComboUp(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 16);
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

// 孔明灯雨：金色大 fanfare（低音和弦 + 高频 sparkle）。
function sfxLanternRain(_p, sr) {
  const chord = notes({ freqs: [220, 329.63, 440, 659.25], dur: 0.9, gap: 0, type: 'triangle', gain: 0.14, attack: 0.02, release: 0.35, sr });
  const sparkle = notes({ freqs: [880, 1174.66, 1567.98, 2093], dur: 0.3, gap: 0.09, type: 'sine', gain: 0.12, attack: 0.01, release: 0.18, sr });
  return mix(chord, sparkle);
}

// 过关：上行三音。
function sfxLevelClear(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.36, gap: 0.11, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

// 失败：下坠 gliss。
function sfxLevelFail(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 90, dur: 0.8, sr, gain: 0.36, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.6, sr, gain: 0.18, filter: 'lowpass', cutoff: 600, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

// 擦肩 nearMiss：短促高频 tick。
function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}

// 分数里程碑：轻 ping。
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}

// 通关全 12 关：大 fanfare。
function sfxGameWin(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99, 1046.5], dur: 0.5, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.2, sr });
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

const SYNTH = {
  shot: sfxShot,
  hit: sfxHit,
  miss: sfxMiss,
  ghostHit: sfxGhostHit,
  goldenHit: sfxGoldenHit,
  redDuckHit: sfxRedDuckHit,
  reward: sfxReward,
  reloadStart: sfxReloadStart,
  reloadDone: sfxReloadDone,
  comboUp: sfxComboUp,
  comboBreak: sfxComboBreak,
  lanternRain: sfxLanternRain,
  levelClear: sfxLevelClear,
  levelFail: sfxLevelFail,
  nearMiss: sfxNearMiss,
  milestone: sfxMilestone,
  gameWin: sfxGameWin,
  ui: sfxUi,
  newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（无缝 loop 的 PCM）：BGM 三层（pad / arp / shimmer）
// ---------------------------------------------------------------------------

function makeTone(freq, dur, sr, amp) {
  const f = Math.round(freq * dur) / dur; // 整数周期 → 无缝循环
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i += 1) out[i] = amp * Math.sin((2 * Math.PI * f * i) / sr);
  return out;
}

function toneSum(tones, dur, sr) {
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  for (const t of tones) {
    const pcm = makeTone(t[0], dur, sr, t[1]);
    for (let i = 0; i < n; i += 1) out[i] += pcm[i];
  }
  return out;
}

function applyLfo(buf, sr, cycles, depth) {
  const dur = buf.length / sr;
  const rate = cycles / dur; // 整数周期 → 无缝
  for (let i = 0; i < buf.length; i += 1) {
    const t = i / sr;
    buf[i] *= 1 - depth / 2 + (depth / 2) * Math.sin(2 * Math.PI * rate * t);
  }
  return buf;
}

function loopPad(sr) {
  const dur = 4;
  const buf = toneSum([[110, 0.16], [164.81, 0.12], [220, 0.10], [261.63, 0.07]], dur, sr);
  return applyLfo(buf, sr, 2, 0.35); // 0.5Hz 呼吸
}

function loopArp(sr) {
  const dur = 4;
  const buf = toneSum([[440, 0.09], [523.25, 0.08], [659.25, 0.08], [783.99, 0.06]], dur, sr);
  return applyLfo(buf, sr, 6, 0.5); // 1.5Hz 颤音，给运动感
}

function loopShimmer(sr) {
  const dur = 4;
  const buf = toneSum([[880, 0.05], [1318.5, 0.04], [1760, 0.03]], dur, sr);
  return applyLfo(buf, sr, 1, 0.7); // 0.25Hz 缓慢闪烁
}

const LOOPS = {
  pad: loopPad,
  arp: loopArp,
  shimmer: loopShimmer,
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

// 叠层优先级：命中/金鸭/孔明灯雨最高。
const SFX_PRIORITY = {
  lanternRain: 7, goldenHit: 6, redDuckHit: 6,
  hit: 5, reward: 5, levelClear: 5, gameWin: 5, newRecord: 5,
  comboUp: 4, ghostHit: 4,
  shot: 3, reloadDone: 3, levelFail: 4,
  reloadStart: 2, comboBreak: 2, miss: 2,
  nearMiss: 1, milestone: 1, ui: 1,
};

const EVENT_TO_SFX = {
  shot: 'shot',
  hit: 'hit',
  miss: 'miss',
  ghostHit: 'ghostHit',
  goldenHit: 'goldenHit',
  redDuckHit: 'redDuckHit',
  reward: 'reward',
  reloadStart: 'reloadStart',
  reloadDone: 'reloadDone',
  comboUp: 'comboUp',
  comboBreak: 'comboBreak',
  lanternRain: 'lanternRain',
  levelClear: 'levelClear',
  levelFail: 'levelFail',
  nearMiss: 'nearMiss',
  milestone: 'milestone',
  gameWin: 'gameWin',
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
    volume: 0.7,
    muted: false,
    unlocked: false,
    bgmLayers: [],   // { src, gain } 当前 BGM 分层
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
    state.bgmBus.gain.value = 0.8;
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

  function startLoopLayer(name, gainVal) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const pcm = synthLoop(name, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const g = ctx.createGain();
    g.gain.value = gainVal;
    src.connect(g);
    g.connect(state.bgmBus);
    src.start();
    state.bgmLayers.push({ src, g });
  }

  function stopBgm() {
    for (const l of state.bgmLayers) {
      try { l.src.stop(); } catch { /* noop */ }
    }
    state.bgmLayers = [];
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
  }

  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
  }

  // BGM：分层无缝循环（pad + arp + shimmer），不打包音频文件。
  async function playBgm() {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgm();
    startLoopLayer('pad', 1.0);
    startLoopLayer('arp', 0.55);
    startLoopLayer('shimmer', 0.4);
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
