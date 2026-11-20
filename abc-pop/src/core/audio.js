// src/core/audio.js — ABC POP · 音效与 BGM 程序化合成（WebAudio 标准 API，零依赖零外链）。
//
// 架构分两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，直接算成
//     mono Float32Array PCM。tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验。
//  2) 浏览器播放层：把 PCM 灌进 AudioBuffer，经 AudioBufferSourceNode → GainNode → destination。
//     BGM 用无缝 loop 的 AudioBufferSourceNode 长循环（按场景包换根音/和声色彩）。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(scene), stopBgm() }
// 事件名与 sim 事件表一字不差：bubblePop / bubbleMiss / comboBreak / bridge / roundClear /
//   letterClear / cleared / levelEnter / tapMiss，外加 ui、newRecord。
// 语音：不做 TTS，字母名用音高区分（letterFreq 映射 12 半音 + 五度双音提示）。

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 3;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.22;    // 噪声滤波后统一归一到的 RMS

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

// 字母 → 音高（12 半音循环 + 不做 TTS 的音高区分）
export function letterFreq(letter) {
  const idx = typeof letter === 'string'
    ? letter.toUpperCase().charCodeAt(0) - 65
    : Math.max(0, Math.min(25, Math.floor(letter || 0)));
  return 330 * Math.pow(2, (idx % 12) / 12);
}

// ---------------------------------------------------------------------------
// 各音效合成器（(payload, sr) => Float32Array）
// ---------------------------------------------------------------------------
function sfxBubblePop(p, sr) {
  const f = letterFreq(p.letter ?? 'A');
  const tone = osc({ type: 'sine', freq: f, freqEnd: f * 1.5, dur: 0.16, sr, gain: 0.34, attack: 0.004, release: 0.07 });
  const pop = noise({ dur: 0.05, sr, gain: 0.22, filter: 'bandpass', cutoff: f * 3, attack: 0.002, release: 0.03 });
  return mix(tone, pop);
}

function sfxBubbleMiss(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 95, dur: 0.16, sr, gain: 0.3, attack: 0.005, release: 0.09 });
  const wob = osc({ type: 'sine', freq: 220, freqEnd: 160, dur: 0.14, sr, gain: 0.18, attack: 0.005, release: 0.08 });
  return mix(thud, wob);
}

function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 420, freqEnd: 200, dur: 0.18, sr, gain: 0.2, attack: 0.005, release: 0.09 });
}

function sfxBridge(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392.0, 493.88, 523.25], dur: 0.34, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.16, sr });
}

function sfxRoundClear(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.3, sr, gain: 0.22, attack: 0.01, release: 0.13 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.3, sr, gain: 0.12, attack: 0.01, release: 0.13 });
  return mix(a, b);
}

function sfxLetterClear(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.36, gap: 0.12, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

function sfxCleared(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.22, sr });
}

function sfxLevelEnter(p, sr) {
  const f = letterFreq(p.letter ?? 'A');
  const a = osc({ type: 'sine', freq: f, dur: 0.22, sr, gain: 0.24, attack: 0.01, release: 0.1 });
  const b = osc({ type: 'sine', freq: f * 1.5, dur: 0.22, sr, gain: 0.16, attack: 0.01, release: 0.1 });
  const out = new Float32Array(Math.round(0.3 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.09 * sr));
  return out;
}

function sfxTapMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1200, freqEnd: 900, dur: 0.05, sr, gain: 0.1, attack: 0.002, release: 0.02 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [659.25, 783.99, 987.77], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  bubblePop: sfxBubblePop,
  bubbleMiss: sfxBubbleMiss,
  comboBreak: sfxComboBreak,
  bridge: sfxBridge,
  roundClear: sfxRoundClear,
  letterClear: sfxLetterClear,
  cleared: sfxCleared,
  levelEnter: sfxLevelEnter,
  tapMiss: sfxTapMiss,
  ui: sfxUi,
  newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM：按场景包的无缝循环 pad（4s 整数周期，首尾连续）
// ---------------------------------------------------------------------------
const SCENE_ROOTS = { morning: 261.63, rain: 293.66, night: 220.0 };

function loopBgm(root) {
  const sr = SAMPLE_RATE;
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const chords = [root, root * 1.5, root * 2, root * 1.25];
  // 慢速 pad：每个整秒放一层柔和三角波和弦音，LFO 微调音量
  for (let k = 0; k < chords.length; k += 1) {
    const s = osc({ type: 'triangle', freq: chords[k], dur, sr, gain: 0.055, attack: 1.0, release: 1.0 });
    addAt(out, s, 0);
  }
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    out[i] *= 0.8 + 0.2 * Math.sin(2 * Math.PI * 0.25 * t);
  }
  return out;
}

const LOOPS = {
  bgmMorning: () => loopBgm(SCENE_ROOTS.morning),
  bgmRain: () => loopBgm(SCENE_ROOTS.rain),
  bgmNight: () => loopBgm(SCENE_ROOTS.night),
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
  bubblePop: 6, bridge: 6, letterClear: 5, cleared: 5,
  roundClear: 4, levelEnter: 4, newRecord: 4,
  bubbleMiss: 3, comboBreak: 2, ui: 2, tapMiss: 1,
};

const EVENT_TO_SFX = {
  bubblePop: 'bubblePop',
  bubbleMiss: 'bubbleMiss',
  comboBreak: 'comboBreak',
  bridge: 'bridge',
  roundClear: 'roundClear',
  letterClear: 'letterClear',
  cleared: 'cleared',
  levelEnter: 'levelEnter',
  tapMiss: 'tapMiss',
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
    volume: 0.8,
    muted: false,
    unlocked: false,
    bgmSource: null,
    bgmScene: null,
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
    state.active.set(key, { name, priority, endTime: now + pcm.length / ctx.sampleRate, stop: (t) => { try { src.stop(t); } catch { /* noop */ } } });
  }

  function stopBgmSource() {
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch { /* noop */ } state.bgmSource = null; }
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) { resumeIfNeeded(); state.unlocked = true; }
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

  function playBgm(scene) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmScene === scene && state.bgmSource) return;
    stopBgmSource();
    state.bgmScene = scene;
    const name = `bgm${scene.charAt(0).toUpperCase()}${scene.slice(1)}`;
    const pcm = synthLoop(name, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(state.bgmBus);
    src.start();
    state.bgmSource = src;
  }

  function stopBgm() {
    stopBgmSource();
    state.bgmScene = null;
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
