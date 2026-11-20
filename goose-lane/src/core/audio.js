// src/core/audio.js — GOOSE LANE · 程序化 WebAudio 合成（零依赖零外链，BGM 不打包音频文件）。
//
// 架构两层：
//  1) 采样级合成器（纯函数）：每个 SFX / 循环层 = 振荡器 + 噪声 + 包络，算成 mono Float32Array PCM，
//     tools/audio-check.mjs 可在 Node（无 WebAudio）离线渲染校验 RMS/峰值/NaN。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer → BufferSource → Gain → destination；
//     BGM 用无缝循环 buffer（分层 pad + 低音 + 琶音），道路环境声用 loop 噪声层。
//
// 契约：
//   createAudio() → { unlock(), event(type, payload), setMuted(b), setVolume(v), playBgm(name), stopBgm() }
// 事件名与 sim 事件表一字不差：laneChange / gem / balloonGain / balloonSave / balloonPop /
//   nearMiss / gateOpen / gatePass / stationEnter / sceneEnter / milestone / smoothTransfer /
//   stopHold / hit / death / revive，外加 ui / newRecord。
import Sdk from './sdk.js';

export const SAMPLE_RATE = 44100;
const MAX_VOICES = 2;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.25;

// ---------------------------------------------------------------------------
// DSP 原语
// ---------------------------------------------------------------------------
function clamp(v, lo, hi) {
  if (Number.isNaN(v)) return lo;
  return v < lo ? lo : (v > hi ? hi : v);
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

function osc({ type = 'sine', freq = 440, freqEnd = null, dur = 0.2, sr = SAMPLE_RATE, gain = 0.5, attack = 0.005, release = 0.05 } = {}) {
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

function noise({ dur = 0.2, sr = SAMPLE_RATE, gain = 0.5, attack = 0.005, release = 0.05, filter = 'none', cutoff = 1000 } = {}) {
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
  for (let i = 0; i < input.length; i += 1) { y = a * y + (1 - a) * input[i]; out[i] = y; }
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

function notes({ freqs, dur = 0.4, gap = 0.13, type = 'triangle', gain = 0.2, attack = 0.01, release = 0.15, sr = SAMPLE_RATE } = {}) {
  const total = (freqs.length - 1) * gap + dur;
  const out = new Float32Array(Math.max(1, Math.round(total * sr)));
  freqs.forEach((f, k) => {
    const s = osc({ type, freq: f, dur, sr, gain, attack, release });
    addAt(out, s, Math.round(k * gap * sr));
  });
  return out;
}

// ---------------------------------------------------------------------------
// SFX 合成器
// ---------------------------------------------------------------------------
function sfxLane(_p, sr) {
  return noise({ dur: 0.09, sr, gain: 0.28, filter: 'bandpass', cutoff: 1600, attack: 0.004, release: 0.05 });
}
function sfxGem(_p, sr) {
  const a = osc({ type: 'sine', freq: 880, freqEnd: 1560, dur: 0.12, sr, gain: 0.32, attack: 0.003, release: 0.05 });
  const b = osc({ type: 'sine', freq: 1760, freqEnd: 2100, dur: 0.1, sr, gain: 0.12, attack: 0.003, release: 0.04 });
  return mix(a, b);
}
function sfxBalloon(_p, sr) {
  return osc({ type: 'triangle', freq: 520, freqEnd: 780, dur: 0.16, sr, gain: 0.34, attack: 0.006, release: 0.08 });
}
function sfxBalloonSave(p, sr) {
  const thud = osc({ type: 'triangle', freq: 200, freqEnd: 90, dur: 0.14, sr, gain: 0.4, attack: 0.004, release: 0.07 });
  const pop = noise({ dur: 0.08, sr, gain: 0.3, filter: 'highpass', cutoff: 900, attack: 0.002, release: 0.04 });
  return mix(thud, pop);
}
function sfxBalloonPop(_p, sr) {
  return noise({ dur: 0.07, sr, gain: 0.34, filter: 'bandpass', cutoff: 1300, attack: 0.001, release: 0.03 });
}
function sfxNearMiss(_p, sr) {
  return osc({ type: 'sine', freq: 1500, freqEnd: 1150, dur: 0.05, sr, gain: 0.18, attack: 0.002, release: 0.02 });
}
function sfxGateOpen(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.14, sr });
}
function sfxGatePass(_p, sr) {
  return noise({ dur: 0.22, sr, gain: 0.26, filter: 'bandpass', cutoff: 1200, attack: 0.02, release: 0.12 });
}
function sfxStation(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99], dur: 0.4, gap: 0.1, type: 'triangle', gain: 0.2, attack: 0.02, release: 0.18, sr });
}
function sfxScene(_p, sr) {
  return notes({ freqs: [261.63, 329.63, 392, 523.25], dur: 0.6, gap: 0.12, type: 'triangle', gain: 0.14, attack: 0.06, release: 0.24, sr });
}
function sfxMilestone(_p, sr) {
  return osc({ type: 'sine', freq: 660, freqEnd: 880, dur: 0.06, sr, gain: 0.1, attack: 0.004, release: 0.03 });
}
function sfxDove(_p, sr) {
  return notes({ freqs: [659.25, 783.99, 987.77, 1318.5, 1567.98], dur: 0.35, gap: 0.07, type: 'sine', gain: 0.16, attack: 0.01, release: 0.2, sr });
}
function sfxStop(_p, sr) {
  const squeal = noise({ dur: 0.18, sr, gain: 0.3, filter: 'bandpass', cutoff: 2400, attack: 0.02, release: 0.1 });
  const thud = osc({ type: 'triangle', freq: 150, freqEnd: 80, dur: 0.14, sr, gain: 0.3, attack: 0.004, release: 0.08 });
  return mix(squeal, thud);
}
function sfxHit(_p, sr) {
  const crash = noise({ dur: 0.3, sr, gain: 0.4, filter: 'lowpass', cutoff: 500, attack: 0.002, release: 0.18 });
  const thud = osc({ type: 'triangle', freq: 110, freqEnd: 50, dur: 0.28, sr, gain: 0.4, attack: 0.003, release: 0.14 });
  return mix(crash, thud);
}
function sfxDeath(_p, sr) {
  const glide = osc({ type: 'triangle', freq: 520, freqEnd: 55, dur: 0.9, sr, gain: 0.36, attack: 0.01, release: 0.3 });
  const nz = noise({ dur: 0.6, sr, gain: 0.2, filter: 'lowpass', cutoff: 700, attack: 0.02, release: 0.3 });
  return mix(glide, nz);
}
function sfxRevive(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25, 783.99, 1046.5], dur: 0.35, gap: 0.08, type: 'triangle', gain: 0.22, attack: 0.01, release: 0.16, sr });
}
function sfxUi(_p, sr) {
  const ping = osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.24, attack: 0.002, release: 0.03 });
  const click = noise({ dur: 0.02, sr, gain: 0.12, filter: 'highpass', cutoff: 2000, attack: 0.001, release: 0.01 });
  return mix(ping, click);
}
function sfxNewRecord(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.4, gap: 0.13, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.16, sr });
}

const SYNTH = {
  lane: sfxLane, gem: sfxGem, balloon: sfxBalloon, balloonSave: sfxBalloonSave, balloonPop: sfxBalloonPop,
  nearMiss: sfxNearMiss, gateOpen: sfxGateOpen, gatePass: sfxGatePass, station: sfxStation, scene: sfxScene,
  milestone: sfxMilestone, dove: sfxDove, stop: sfxStop, hit: sfxHit, death: sfxDeath, revive: sfxRevive,
  ui: sfxUi, newRecord: sfxNewRecord,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------------------------------------------------------------------
// 循环层（无缝 loop）：BGM 主旋律 + 道路环境声
// ---------------------------------------------------------------------------
function loopBgm(sr) {
  const dur = 8; // 8s 一整段，整数小节（120bpm：4/4 × 4 小节）
  const n = Math.round(dur * sr);
  const out = new Float32Array(n);
  const root = 196.0;       // G3
  const chords = [
    [root, root * 1.5, root * 2],           // G
    [root * 1.3348, root * 2, root * 2.5],  // C
    [root * 1.1892, root * 1.7818, root * 2.3784], // D
    [root, root * 1.5, root * 2],           // G
  ];
  const bassFreq = [root, root * 1.3348, root * 1.1892, root];
  const arp = [root * 2, root * 2.5, root * 3, root * 2.5];
  const seg = dur / chords.length; // 2s
  for (let c = 0; c < chords.length; c += 1) {
    // 分层 pad：三和弦长音
    for (const f of chords[c]) {
      const s = osc({ type: 'triangle', freq: f, dur: seg, sr, gain: 0.05, attack: 0.4, release: 0.6 });
      addAt(out, s, Math.round(c * seg * sr));
    }
    // 低音
    const b = osc({ type: 'sine', freq: bassFreq[c], dur: seg, sr, gain: 0.09, attack: 0.1, release: 0.4 });
    addAt(out, b, Math.round(c * seg * sr));
    // 琶音 8 分音符
    for (let k = 0; k < 8; k += 1) {
      const f = arp[k % arp.length];
      const a = osc({ type: 'sine', freq: f, dur: 0.18, sr, gain: 0.045, attack: 0.01, release: 0.1 });
      addAt(out, a, Math.round((c * seg + k * (seg / 8)) * sr));
    }
  }
  return out;
}

function loopRoad(sr) {
  const dur = 2;
  const n = Math.round(dur * sr);
  let buf = new Float32Array(n);
  for (let i = 0; i < n; i += 1) buf[i] = Math.random() * 2 - 1;
  buf = lowpass(buf, 420, sr);
  buf = normalizeRms(buf, NOISE_RMS);
  for (let i = 0; i < n; i += 1) {
    const t = i / sr;
    buf[i] *= 0.06 + 0.02 * Math.sin(2 * Math.PI * 0.5 * t);
  }
  return buf;
}

const LOOPS = { bgm: loopBgm, road: loopRoad };
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
  death: 6, hit: 6, balloonSave: 5, gem: 5, gateOpen: 4, station: 4, scene: 4, revive: 4, dove: 4,
  gatePass: 3, balloon: 3, lane: 3, stop: 3, balloonPop: 3, newRecord: 3,
  nearMiss: 2, milestone: 1, ui: 1,
};

const EVENT_TO_SFX = {
  laneChange: 'lane', gem: 'gem', balloonGain: 'balloon', balloonSave: 'balloonSave', balloonPop: 'balloonPop',
  nearMiss: 'nearMiss', gateOpen: 'gateOpen', gatePass: 'gatePass', stationEnter: 'station', sceneEnter: 'scene',
  milestone: 'milestone', smoothTransfer: 'dove', stopHold: 'stop', hit: 'hit', death: 'death', revive: 'revive',
  ui: 'ui', newRecord: 'newRecord',
};

// ---------------------------------------------------------------------------
// 播放层
// ---------------------------------------------------------------------------
export function createAudio() {
  const state = {
    ctx: null, master: null, sfxBus: null, bgmBus: null,
    volume: clamp(Sdk.load('audioVolume', 0.7), 0, 1),
    muted: !!Sdk.load('audioMuted', false),
    unlocked: false,
    bgmSource: null, roadSource: null,
    active: new Map(), lastPlay: new Map(), voiceSeq: 0,
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
    state.sfxBus = state.ctx.createGain(); state.sfxBus.gain.value = 1; state.sfxBus.connect(state.master);
    state.bgmBus = state.ctx.createGain(); state.bgmBus.gain.value = 1; state.bgmBus.connect(state.master);
    resumeIfNeeded();
    return state.ctx;
  }

  function pruneActive(now) {
    for (const [k, v] of state.active) if (v.endTime <= now) state.active.delete(k);
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
      let minKey = null; let minPrio = Infinity;
      for (const [k, v] of state.active) if (v.priority < minPrio) { minPrio = v.priority; minKey = k; }
      if (minKey == null || priority <= minPrio) return;
      try { state.active.get(minKey).stop(); } catch { /* noop */ }
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
    state.active.set(key, { priority, endTime: now + pcm.length / ctx.sampleRate, stop: () => { try { src.stop(); } catch { /* noop */ } } });
  }

  function startLoop(name, bus) {
    const ctx = ensureCtx();
    if (!ctx) return;
    const pcm = synthLoop(name, ctx.sampleRate);
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    src.connect(bus);
    src.start();
    return src;
  }

  function stopBgmSource() {
    if (state.bgmSource) { try { state.bgmSource.stop(); } catch { /* noop */ } state.bgmSource = null; }
    if (state.roadSource) { try { state.roadSource.stop(); } catch { /* noop */ } state.roadSource = null; }
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
    Sdk.save('audioMuted', state.muted);
  }
  function setVolume(v) {
    state.volume = clamp(Number(v) || 0, 0, 1);
    if (state.master) state.master.gain.value = state.muted ? 0 : state.volume;
    Sdk.save('audioVolume', state.volume);
  }

  function playBgm() {
    const ctx = ensureCtx();
    if (!ctx) return;
    stopBgmSource();
    state.bgmSource = startLoop('bgm', state.bgmBus);
    state.roadSource = startLoop('road', state.bgmBus);
  }
  function stopBgm() { stopBgmSource(); }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
