// HELIX ORBIT · 音频：WebAudio 程序化合成（BGM 分层无缝循环 + SFX 每事件≥1），零外部文件。
// 分两层：
//  1) 采样级合成器（纯函数，无 WebAudio）：每个 SFX/循环层 = 振荡器 + 噪声 + 包络 → mono Float32Array PCM，
//     供 tools/audio-check.mjs 在 Node 里离线校验（RMS>0 / 峰值<0.95 / 无 NaN）。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer 播放；BGM 由 pad/arp/pulse 三层循环层叠加。
export const SAMPLE_RATE = 44100;

const TWO_PI = Math.PI * 2;
const NOISE_RMS = 0.25;

function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : v > hi ? hi : v;
}

function oscSample(type, phase) {
  const p = phase % TWO_PI;
  switch (type) {
    case 'sine': return Math.sin(p);
    case 'triangle': return (2 / Math.PI) * Math.asin(Math.sin(p));
    case 'square': return Math.sign(Math.sin(p));
    case 'sawtooth': return 2 * ((p / TWO_PI) - Math.floor(p / TWO_PI + 0.5));
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
    phase += (TWO_PI * f) / sr;
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
  const a = Math.exp(-TWO_PI * cutoff / sr);
  const out = new Float32Array(input.length);
  let y = 0;
  for (let i = 0; i < input.length; i += 1) {
    y = a * y + (1 - a) * input[i];
    out[i] = y;
  }
  return out;
}

function highpass(input, cutoff, sr) {
  const a = Math.exp(-TWO_PI * cutoff / sr);
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

// 等间隔音序（可复用的琶音/旋律）
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
// SFX 合成器（均为 (payload, sr) => Float32Array）
// ---------------------------------------------------------------------------

function sfxBounce(_p, sr) {
  const thud = osc({ type: 'triangle', freq: 170, freqEnd: 100, dur: 0.09, sr, gain: 0.34, attack: 0.004, release: 0.04 });
  const click = noise({ dur: 0.03, sr, gain: 0.12, filter: 'highpass', cutoff: 1500, attack: 0.001, release: 0.01 });
  return mix(thud, click);
}

function sfxPass(_p, sr) {
  return osc({ type: 'sine', freq: 540, freqEnd: 880, dur: 0.11, sr, gain: 0.22, attack: 0.004, release: 0.05 });
}

function sfxCrevice(_p, sr) {
  const a = osc({ type: 'triangle', freq: 720, freqEnd: 1180, dur: 0.16, sr, gain: 0.26, attack: 0.005, release: 0.08 });
  const b = osc({ type: 'sine', freq: 1440, dur: 0.12, sr, gain: 0.12, attack: 0.004, release: 0.06 });
  return mix(a, b);
}

function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 990, dur: 0.07, sr, gain: 0.12, attack: 0.004, release: 0.03 });
}

function sfxMeteorStart(_p, sr) {
  return noise({ dur: 0.4, sr, gain: 0.4, filter: 'bandpass', cutoff: 1300, attack: 0.05, release: 0.15 });
}

function sfxMeteorSmash(_p, sr) {
  const boom = osc({ type: 'triangle', freq: 90, freqEnd: 40, dur: 0.5, sr, gain: 0.5, attack: 0.004, release: 0.24 });
  const crash = noise({ dur: 0.4, sr, gain: 0.3, filter: 'lowpass', cutoff: 900, attack: 0.003, release: 0.2 });
  return mix(boom, crash);
}

function sfxCrystal(_p, sr) {
  const f = 880;
  const a = osc({ type: 'sine', freq: f, freqEnd: f * 1.6, dur: 0.14, sr, gain: 0.28, attack: 0.004, release: 0.06 });
  const b = osc({ type: 'sine', freq: f * 2, dur: 0.1, sr, gain: 0.12, attack: 0.004, release: 0.05 });
  return mix(a, b);
}

function sfxFreeze(_p, sr) {
  const a = osc({ type: 'sine', freq: 520, freqEnd: 260, dur: 0.5, sr, gain: 0.22, attack: 0.01, release: 0.2 });
  const b = noise({ dur: 0.4, sr, gain: 0.14, filter: 'lowpass', cutoff: 500, attack: 0.02, release: 0.2 });
  return mix(a, b);
}

function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 60, dur: 1.0, sr, gain: 0.4, attack: 0.01, release: 0.3 });
  const nz = noise({ dur: 0.7, sr, gain: 0.22, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}

function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1180, dur: 0.05, sr, gain: 0.16, attack: 0.002, release: 0.02 });
}

function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}

function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

function sfxChime(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, dur: 0.28, sr, gain: 0.2, attack: 0.01, release: 0.12 });
  const b = osc({ type: 'sine', freq: 1318.5, dur: 0.28, sr, gain: 0.12, attack: 0.01, release: 0.12 });
  return mix(a, b);
}

const SYNTH = {
  bounce: sfxBounce,
  pass: sfxPass,
  crevice: sfxCrevice,
  milestone: sfxMilestone,
  meteorStart: sfxMeteorStart,
  meteorSmash: sfxMeteorSmash,
  crystal: sfxCrystal,
  freeze: sfxFreeze,
  death: sfxDeath,
  nearMiss: sfxNearMiss,
  ui: sfxUi,
  newRecord: sfxNewRecord,
  chime: sfxChime,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// BGM 循环层（可无缝 loop 的 PCM）
// ---------------------------------------------------------------------------

// 低音 pad：4s，正弦叠加（频率取整数周期保证无缝），0.25Hz 呼吸 LFO
function loopPad(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const parts = [
    { f: 110, amp: 0.5 },
    { f: 164.81, amp: 0.32 },  // E3
    { f: 220, amp: 0.2 },      // A3
  ];
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    const breath = 0.8 + 0.2 * Math.sin(TWO_PI * 0.25 * t);
    let v = 0;
    for (const p of parts) v += Math.sin(TWO_PI * p.f * t) * p.amp;
    out[i] = v * breath;
  }
  return normalizeRms(out, 0.16);
}

// 琶音：4s，A 小调 4 音循环（每音短促衰减，落在整数周期上）
function loopArp(sr) {
  const dur = 4;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const seq = [220, 261.63, 329.63, 440];
  const step = dur / seq.length; // 1s
  seq.forEach((f, k) => {
    const s = osc({ type: 'triangle', freq: f, freqEnd: f, dur: 0.8, sr, gain: 0.5, attack: 0.01, release: 0.5 });
    addAt(out, s, Math.round(k * step * sr));
  });
  return normalizeRms(out, 0.12);
}

// 脉冲：2s，4 个低频脉冲（滤波噪声短促点）
function loopPulse(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  for (let k = 0; k < 4; k += 1) {
    const thud = osc({ type: 'triangle', freq: 82, freqEnd: 60, dur: 0.16, sr, gain: 0.5, attack: 0.003, release: 0.1 });
    addAt(out, thud, Math.round((k * dur / 4) * sr));
  }
  return normalizeRms(out, 0.14);
}

const LOOPS = {
  pad: loopPad,
  arp: loopArp,
  pulse: loopPulse,
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

// 事件 → SFX 映射
const EVENT_TO_SFX = {
  bounce: 'bounce',
  layerPass: 'pass',
  crevice: 'crevice',
  milestone: 'milestone',
  meteorStart: 'meteorStart',
  meteorSmash: 'meteorSmash',
  crystal: 'crystal',
  freezeStart: 'freeze',
  freezeEnd: 'chime',
  death: 'death',
  nearMiss: 'nearMiss',
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
    bgmNodes: [],
    lastPlay: new Map(),
  };

  function ensureCtx() {
    if (state.ctx) {
      if (state.ctx.state === 'suspended') state.ctx.resume().catch(() => {});
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
    state.bgmBus.gain.value = 0.5;
    state.bgmBus.connect(state.master);
    return state.ctx;
  }

  function playBuffer(pcm, bus) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.connect(bus);
    src.start();
    return src;
  }

  function playSfx(name, payload) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const now = ctx.currentTime;
    const last = state.lastPlay.get(name);
    if (last != null && now - last < 0.016) return;
    state.lastPlay.set(name, now);
    const pcm = synthSfx(name, payload, ctx.sampleRate);
    playBuffer(pcm, state.sfxBus);
  }

  function unlock() {
    const ctx = ensureCtx();
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume().catch(() => {});
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

  function playBgm() {
    const ctx = ensureCtx();
    if (!ctx || state.bgmNodes.length) return;
    for (const name of ['pad', 'arp', 'pulse']) {
      const pcm = synthLoop(name, ctx.sampleRate);
      const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
      buf.getChannelData(0).set(pcm);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      src.connect(state.bgmBus);
      src.start();
      state.bgmNodes.push(src);
    }
  }

  function stopBgm() {
    for (const src of state.bgmNodes) {
      try { src.stop(); } catch { /* noop */ }
    }
    state.bgmNodes = [];
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
