// src/core/audio.js — IDIOM FORGE · M4 程序化音频（WebAudio 标准 API，零依赖零外链，不打包音频文件）
//
// 两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络 → mono Float32Array PCM。
//     这样 tools/audio-check.mjs 能在 Node（无 WebAudio）里离线渲染校验 RMS/峰值/NaN。
//  2) 浏览器播放层：PCM → AudioBuffer → AudioBufferSourceNode → GainNode → destination；
//     BGM 用 3 条场景循环（铁匠铺 / 书院 / 天工阁）程序化合成，无缝 loop。
//
// 契约：createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(kind), stopBgm() }
// 事件名与 sim 事件表一致：tileTap / charCorrect / charWrong / solve / forge / riddle / hint / reset /
//   slag / smelt / comboUp / comboBreak / levelStart / levelClear / death / win / ui / newRecord / chime。

export const SAMPLE_RATE = 44100; // 离线/测试默认采样率；浏览器端改用 ctx.sampleRate

const MAX_VOICES = 2;      // 同时叠层的一发式音效上限
const DEDUPE_MS = 16;      // 同一音效 16ms 内去重
const NOISE_RMS = 0.25;    // 噪声滤波后统一归一 RMS

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
// 音效合成器
// ---------------------------------------------------------------------------

function sfxTileTap(_p, sr) {
  const ping = osc({ type: 'sine', freq: 760, freqEnd: 640, dur: 0.06, sr, gain: 0.3, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.03, sr, gain: 0.12, filter: 'highpass', cutoff: 1600, attack: 0.001, release: 0.012 });
  return mix(ping, click);
}

// 填对字：上扬 blip，连击越高音越高
function sfxCharCorrect(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 520 * Math.pow(2, combo / 12);
  const a = osc({ type: 'sine', freq: f, freqEnd: f * 1.8, dur: 0.12, sr, gain: 0.34, attack: 0.004, release: 0.06 });
  const b = osc({ type: 'sine', freq: f * 2, freqEnd: f * 2.4, dur: 0.07, sr, gain: 0.1, attack: 0.004, release: 0.04 });
  return mix(a, b);
}

// 填错字：下坠 buzz
function sfxCharWrong(_p, sr) {
  const buzz = osc({ type: 'sawtooth', freq: 220, freqEnd: 120, dur: 0.16, sr, gain: 0.2, attack: 0.005, release: 0.09 });
  const nz = noise({ dur: 0.1, sr, gain: 0.1, filter: 'lowpass', cutoff: 500, attack: 0.003, release: 0.05 });
  return mix(buzz, nz);
}

// 成语补全：三音上行 + 轻微金属
function sfxSolve(_p, sr) {
  const ch = notes({ freqs: [523.25, 659.25, 783.99], dur: 0.32, gap: 0.09, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.14, sr });
  const clink = noise({ dur: 0.08, sr, gain: 0.1, filter: 'highpass', cutoff: 2400, attack: 0.002, release: 0.04 });
  return mix(ch, clink);
}

// 铸成神兵：金属敲击 + 上行和弦
function sfxForge(_p, sr) {
  const hit = noise({ dur: 0.18, sr, gain: 0.28, filter: 'bandpass', cutoff: 1800, attack: 0.002, release: 0.12 });
  const chord = notes({ freqs: [261.63, 329.63, 392.0, 523.25], dur: 0.5, gap: 0.04, type: 'triangle', gain: 0.16, attack: 0.02, release: 0.2, sr });
  return mix(hit, chord);
}

// 字谜题：神秘下行 chime
function sfxRiddle(_p, sr) {
  return notes({ freqs: [880, 659.25, 523.25], dur: 0.3, gap: 0.1, type: 'sine', gain: 0.2, attack: 0.01, release: 0.16, sr });
}

// 提示：柔和 reveal
function sfxHint(_p, sr) {
  return notes({ freqs: [659.25, 880, 1174.66], dur: 0.26, gap: 0.08, type: 'sine', gain: 0.2, attack: 0.01, release: 0.14, sr });
}

// 重置：换题 whoosh
function sfxReset(_p, sr) {
  return noise({ dur: 0.26, sr, gain: 0.24, filter: 'bandpass', cutoff: 900, attack: 0.03, release: 0.14 });
}

// 炉渣入炉：金属 clink
function sfxSlag(_p, sr) {
  const clink = noise({ dur: 0.05, sr, gain: 0.2, filter: 'highpass', cutoff: 3200, attack: 0.001, release: 0.03 });
  const thud = osc({ type: 'triangle', freq: 300, freqEnd: 200, dur: 0.08, sr, gain: 0.2, attack: 0.003, release: 0.05 });
  return mix(clink, thud);
}

// 炉渣熔炼成提示：气泡 + chime
function sfxSmelt(_p, sr) {
  const bubble = noise({ dur: 0.16, sr, gain: 0.14, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.08 });
  const chime = notes({ freqs: [784, 1046.5], dur: 0.28, gap: 0.08, type: 'sine', gain: 0.18, attack: 0.01, release: 0.14, sr });
  return mix(bubble, chime);
}

function sfxComboUp(p, sr) {
  const combo = clamp(p.combo ?? 0, 0, 12);
  const f = 660 * Math.pow(2, combo / 12);
  const a = osc({ type: 'sine', freq: f, freqEnd: f * 1.3, dur: 0.08, sr, gain: 0.2, attack: 0.003, release: 0.04 });
  const b = osc({ type: 'sine', freq: f * 1.5, freqEnd: f * 1.9, dur: 0.08, sr, gain: 0.14, attack: 0.003, release: 0.04 });
  const out = new Float32Array(Math.round(0.16 * sr));
  addAt(out, a, 0);
  addAt(out, b, Math.round(0.06 * sr));
  return out;
}

function sfxComboBreak(_p, sr) {
  return osc({ type: 'sine', freq: 520, freqEnd: 230, dur: 0.16, sr, gain: 0.18, attack: 0.005, release: 0.08 });
}

function sfxLevelStart(_p, sr) {
  return notes({ freqs: [220, 261.63, 329.63, 440], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.15, attack: 0.05, release: 0.16, sr });
}

function sfxLevelClear(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.42, gap: 0.1, type: 'triangle', gain: 0.17, attack: 0.02, release: 0.18, sr });
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 58, dur: 0.9, sr, gain: 0.35, attack: 0.01, release: 0.25 });
  const nz = noise({ dur: 0.6, sr, gain: 0.18, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxWin(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25, 659.25, 783.99], dur: 0.5, gap: 0.12, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.2, sr });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.18, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.1, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  tileTap: sfxTileTap,
  charCorrect: sfxCharCorrect,
  charWrong: sfxCharWrong,
  solve: sfxSolve,
  forge: sfxForge,
  riddle: sfxRiddle,
  hint: sfxHint,
  reset: sfxReset,
  slag: sfxSlag,
  smelt: sfxSmelt,
  comboUp: sfxComboUp,
  comboBreak: sfxComboBreak,
  levelStart: sfxLevelStart,
  levelClear: sfxLevelClear,
  death: sfxDeath,
  win: sfxWin,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 循环层（程序化合成，无缝 loop）
// ---------------------------------------------------------------------------

// 铁匠铺：低沉脉冲 + 周期铁砧敲击（4s 一周期）
function loopForge(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const pulse = osc({ type: 'triangle', freq: 82.41, freqEnd: 82.41, dur, sr, gain: 0.14, attack: 0.3, release: 0.3 });
  addAt(out, pulse, 0);
  for (const t of [0.5, 1.5, 2.5, 3.5]) {
    const clink = noise({ dur: 0.1, sr, gain: 0.1, filter: 'bandpass', cutoff: 2000, attack: 0.002, release: 0.06 });
    addAt(out, clink, Math.round(t * sr));
    const thud = osc({ type: 'sine', freq: 120, freqEnd: 70, dur: 0.14, sr, gain: 0.14, attack: 0.003, release: 0.09 });
    addAt(out, thud, Math.round(t * sr));
  }
  return out;
}

// 书院：五声音阶拨弦琶音（4s 一周期）
function loopAcademy(sr) {
  const dur = 4;
  const out = new Float32Array(Math.round(dur * sr));
  const scale = [523.25, 587.33, 659.25, 783.99, 880, 783.99, 659.25, 587.33];
  scale.forEach((f, k) => {
    const s = osc({ type: 'triangle', freq: f, dur: 0.5, sr, gain: 0.1, attack: 0.02, release: 0.3 });
    addAt(out, s, Math.round(k * 0.5 * sr));
  });
  return out;
}

// 天工阁：高音 sparkle 琶音 + 慢 LFO（4s 一周期）
function loopSky(sr) {
  const dur = 4;
  const out = new Float32Array(Math.round(dur * sr));
  const scale = [1046.5, 1174.66, 1318.5, 1567.98, 1318.5, 1174.66];
  scale.forEach((f, k) => {
    const s = osc({ type: 'sine', freq: f, dur: 0.4, sr, gain: 0.08, attack: 0.02, release: 0.22 });
    addAt(out, s, Math.round(k * 0.6 * sr));
  });
  return out;
}

const LOOPS = {
  bgm0: loopForge,
  bgm1: loopAcademy,
  bgm2: loopSky,
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
  forge: 6, win: 6, solve: 6,
  death: 5, levelClear: 5, newRecord: 5,
  charCorrect: 4, charWrong: 4, levelStart: 4,
  hint: 3, reset: 3, smelt: 3, riddle: 3, slag: 3,
  comboUp: 2, comboBreak: 2,
  tileTap: 1, ui: 1, chime: 1,
};

const EVENT_TO_SFX = {
  tileTap: 'tileTap',
  charCorrect: 'charCorrect',
  charWrong: 'charWrong',
  solve: 'solve',
  forge: 'forge',
  riddle: 'riddle',
  hint: 'hint',
  reset: 'reset',
  slag: 'slag',
  smelt: 'smelt',
  comboUp: 'comboUp',
  comboBreak: 'comboBreak',
  levelStart: 'levelStart',
  levelClear: 'levelClear',
  death: 'death',
  win: 'win',
  ui: 'ui',
  newRecord: 'newRecord',
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
    volume: 0.7,
    muted: false,
    unlocked: false,
    bgmSource: null,
    bgmKind: null,
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

  function stopBgmSource() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
    state.bgmKind = null;
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

  async function playBgm(kind) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmKind === kind && state.bgmSource) return;
    stopBgmSource();
    const pcm = synthLoop(kind, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const node = ctx.createBufferSource();
    node.buffer = buf;
    node.loop = true;
    node.connect(state.bgmBus);
    node.start();
    state.bgmSource = node;
    state.bgmKind = kind;
  }

  function stopBgm() {
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
