// src/core/audio.js — STAR SLAYER · 音效与 BGM（WebAudio 程序化合成，零依赖零外链）
//
// 架构两层：
//  1) 采样级合成器（纯函数，无 DOM/无 WebAudio）：每个音效 = 振荡器 + 噪声 + 包络，算成
//     mono Float32Array PCM，供 tools/audio-check.mjs 在 Node 里离线渲染校验。
//  2) 浏览器播放层：PCM 灌进 AudioBuffer，经 BufferSource → GainNode 播放；
//     BGM 走程序化「分层 loop」（pad 和弦 + 贝斯 + 琶音三层混成无缝循环）。
//
// 契约：createAudio() → { unlock, event(type, payload), setMuted, setVolume, playBgm(name), stopBgm() }

const SAMPLE_RATE = 44100;
const MAX_VOICES = 3;
const DEDUPE_MS = 16;
const NOISE_RMS = 0.25;

// ---------------- DSP 原语 ----------------
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

const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------- 音效合成 ----------------
function sfxShot(_p, sr) {
  return mix(
    osc({ type: 'square', freq: 880, freqEnd: 320, dur: 0.08, sr, gain: 0.22, attack: 0.002, release: 0.03 }),
    noise({ dur: 0.03, sr, gain: 0.1, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.015 }),
  );
}

function sfxCoreCopy(_p, sr) {
  return mix(
    osc({ type: 'sine', freq: 1320, freqEnd: 520, dur: 0.1, sr, gain: 0.18, attack: 0.002, release: 0.05 }),
    osc({ type: 'sine', freq: 660, freqEnd: 330, dur: 0.12, sr, gain: 0.12, attack: 0.002, release: 0.05 }),
  );
}

function sfxHit(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 220, freqEnd: 110, dur: 0.08, sr, gain: 0.4, attack: 0.002, release: 0.04 }),
    noise({ dur: 0.04, sr, gain: 0.18, filter: 'bandpass', cutoff: 1800, attack: 0.001, release: 0.02 }),
  );
}

function sfxKill(_p, sr) {
  return mix(
    osc({ type: 'sawtooth', freq: 260, freqEnd: 70, dur: 0.22, sr, gain: 0.3, attack: 0.002, release: 0.12 }),
    noise({ dur: 0.16, sr, gain: 0.3, filter: 'lowpass', cutoff: 500, attack: 0.002, release: 0.08 }),
  );
}

function sfxPlayerHurt(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 140, freqEnd: 70, dur: 0.18, sr, gain: 0.5, attack: 0.002, release: 0.09 }),
    noise({ dur: 0.12, sr, gain: 0.24, filter: 'lowpass', cutoff: 320, attack: 0.002, release: 0.06 }),
  );
}

function sfxEnemyShot(_p, sr) {
  return osc({ type: 'square', freq: 420, freqEnd: 200, dur: 0.09, sr, gain: 0.16, attack: 0.002, release: 0.04 });
}

function sfxEnemyDash(_p, sr) {
  return noise({ dur: 0.18, sr, gain: 0.2, filter: 'bandpass', cutoff: 900, attack: 0.02, release: 0.08 });
}

function sfxWaveStart(_p, sr) {
  return notes({ freqs: [392, 523.25, 659.25], dur: 0.32, gap: 0.09, type: 'triangle', gain: 0.22, attack: 0.02, release: 0.1, sr });
}

function sfxWaveClear(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5], dur: 0.3, gap: 0.09, type: 'triangle', gain: 0.2, attack: 0.01, release: 0.12, sr });
}

function sfxCardPick(_p, sr) {
  return notes({ freqs: [660, 880, 1100], dur: 0.18, gap: 0.05, type: 'sine', gain: 0.22, attack: 0.005, release: 0.08, sr });
}

function sfxPhaseSync(_p, sr) {
  return mix(
    noise({ dur: 0.3, sr, gain: 0.35, filter: 'bandpass', cutoff: 1500, attack: 0.03, release: 0.12 }),
    osc({ type: 'sine', freq: 700, freqEnd: 1400, dur: 0.22, sr, gain: 0.16, attack: 0.02, release: 0.1 }),
  );
}

function sfxOverload(_p, sr) {
  return mix(
    notes({ freqs: [55, 82.41, 110, 164.81], dur: 1.0, gap: 0, type: 'triangle', gain: 0.16, attack: 0.02, release: 0.4, sr }),
    noise({ dur: 0.8, sr, gain: 0.4, filter: 'lowpass', cutoff: 800, attack: 0.004, release: 0.4 }),
  );
}

function sfxOverloadNo(_p, sr) {
  return osc({ type: 'square', freq: 180, freqEnd: 140, dur: 0.1, sr, gain: 0.18, attack: 0.003, release: 0.05 });
}

function sfxCoreOffline(_p, sr) {
  return osc({ type: 'triangle', freq: 520, freqEnd: 160, dur: 0.5, sr, gain: 0.28, attack: 0.01, release: 0.25 });
}

function sfxCoreOnline(_p, sr) {
  return osc({ type: 'triangle', freq: 160, freqEnd: 520, dur: 0.4, sr, gain: 0.24, attack: 0.01, release: 0.18 });
}

function sfxBossSpawn(_p, sr) {
  return notes({ freqs: [220, 233.08, 246.94], dur: 0.4, gap: 0.16, type: 'square', gain: 0.14, attack: 0.02, release: 0.15, sr });
}

function sfxBossHit(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 90, freqEnd: 55, dur: 0.16, sr, gain: 0.45, attack: 0.003, release: 0.08 }),
    noise({ dur: 0.1, sr, gain: 0.26, filter: 'lowpass', cutoff: 240, attack: 0.002, release: 0.05 }),
  );
}

function sfxBossBreak(_p, sr) {
  return mix(
    notes({ freqs: [55, 82.41, 110, 164.81, 220], dur: 1.1, gap: 0, type: 'triangle', gain: 0.14, attack: 0.02, release: 0.45, sr }),
    noise({ dur: 0.7, sr, gain: 0.34, filter: 'lowpass', cutoff: 900, attack: 0.004, release: 0.35 }),
  );
}

function sfxDeath(_p, sr) {
  return mix(
    osc({ type: 'triangle', freq: 520, freqEnd: 50, dur: 1.0, sr, gain: 0.4, attack: 0.01, release: 0.3 }),
    noise({ dur: 0.6, sr, gain: 0.22, filter: 'lowpass', cutoff: 600, attack: 0.02, release: 0.3 }),
  );
}

function sfxWin(_p, sr) {
  return notes({ freqs: [523.25, 659.25, 783.99, 1046.5, 1318.5], dur: 0.4, gap: 0.12, type: 'triangle', gain: 0.24, attack: 0.01, release: 0.18, sr });
}

function sfxUi(_p, sr) {
  return mix(
    osc({ type: 'sine', freq: 900, freqEnd: 700, dur: 0.05, sr, gain: 0.22, attack: 0.002, release: 0.03 }),
    noise({ dur: 0.02, sr, gain: 0.1, filter: 'highpass', cutoff: 2200, attack: 0.001, release: 0.01 }),
  );
}

const SYNTH = {
  shot: sfxShot,
  coreCopy: sfxCoreCopy,
  hit: sfxHit,
  kill: sfxKill,
  playerHurt: sfxPlayerHurt,
  enemyShot: sfxEnemyShot,
  enemyDash: sfxEnemyDash,
  waveStart: sfxWaveStart,
  waveClear: sfxWaveClear,
  cardPick: sfxCardPick,
  phaseSync: sfxPhaseSync,
  overload: sfxOverload,
  overloadNo: sfxOverloadNo,
  coreOffline: sfxCoreOffline,
  coreOnline: sfxCoreOnline,
  bossSpawn: sfxBossSpawn,
  bossHit: sfxBossHit,
  bossBreak: sfxBossBreak,
  death: sfxDeath,
  win: sfxWin,
  ui: sfxUi,
};

export const SFX_NAMES = Object.keys(SYNTH);

// ---------------- BGM：分层无缝循环 ----------------
// 每段 BGM = pad 和弦层 + 贝斯脉冲层 + 琶音层，混进一个整数时长 buffer（首尾包络到 0，无缝）。
function musicLoop({ chords, roots, arp, chordSec = 2, type = 'triangle', sr = SAMPLE_RATE, gain = 0.05 }) {
  const dur = chords.length * chordSec;
  const n = Math.max(1, Math.round(dur * sr));
  const out = new Float32Array(n);

  // pad 层：每和弦持续 chordSec，软起软收
  chords.forEach((chord, ci) => {
    for (const midi of chord) {
      const s = osc({ type, freq: midiFreq(midi), dur: chordSec, sr, gain, attack: 0.25, release: 0.4 });
      addAt(out, s, Math.round(ci * chordSec * sr));
    }
  });
  // 贝斯层：每和弦根音，四分音符脉冲
  chords.forEach((chord, ci) => {
    const root = roots[ci];
    const step = chordSec / 4;
    for (let k = 0; k < 4; k += 1) {
      const s = osc({ type: 'triangle', freq: midiFreq(root), dur: step * 0.8, sr, gain: gain * 1.2, attack: 0.01, release: 0.1 });
      addAt(out, s, Math.round((ci * chordSec + k * step) * sr));
    }
  });
  // 琶音层：八分音符，轻声
  const arpNotes = arp || chords.flat();
  const step = chordSec / 8;
  arpNotes.forEach((midi, ai) => {
    const t = ai * step;
    if (t >= dur) return;
    const s = osc({ type: 'sine', freq: midiFreq(midi + 12), dur: step * 0.7, sr, gain: gain * 0.7, attack: 0.01, release: 0.08 });
    addAt(out, s, Math.round(t * sr));
  });

  // 整体归一 → 峰值限幅 → 首尾交叉淡出到 0（保证 loop 无缝且不削顶）
  let buf = normalizePcm(out, 0.28);
  buf = limitPeak(buf, 0.9);
  return fadeEdges(buf, sr, 0.12);
}

function limitPeak(input, max) {
  let peak = 0;
  for (let i = 0; i < input.length; i += 1) peak = Math.max(peak, Math.abs(input[i]));
  if (peak > max) {
    const k = max / peak;
    for (let i = 0; i < input.length; i += 1) input[i] *= k;
  }
  return input;
}

function normalizePcm(input, target) {
  let sum = 0;
  for (let i = 0; i < input.length; i += 1) sum += input[i] * input[i];
  const rms = Math.sqrt(sum / Math.max(1, input.length));
  if (rms > 1e-6) {
    const k = target / rms;
    for (let i = 0; i < input.length; i += 1) input[i] *= k;
  }
  return input;
}

function fadeEdges(input, sr, fadeSec) {
  const f = Math.min(Math.round(fadeSec * sr), Math.floor(input.length / 2));
  for (let i = 0; i < f; i += 1) {
    const k = i / f;
    input[i] *= k;
    input[input.length - 1 - i] *= k;
  }
  return input;
}

// A 小调（舰桥，蓝白）
const loopBridge = (sr) => musicLoop({
  chords: [[57, 60, 64], [53, 57, 60], [60, 64, 67], [55, 59, 62]],
  roots: [45, 41, 48, 43],
  arp: [69, 72, 76, 72, 67, 72, 76, 72, 72, 76, 79, 76, 71, 74, 79, 74],
  sr,
});
// D 小调（舰体外壳，灰橙，更紧）
const loopHull = (sr) => musicLoop({
  chords: [[62, 65, 69], [58, 62, 65], [57, 60, 65], [60, 64, 67]],
  roots: [50, 46, 41, 48],
  arp: [74, 77, 81, 77, 74, 77, 81, 77, 72, 76, 79, 76, 74, 77, 81, 77],
  type: 'sawtooth',
  sr,
});
// C 小调（反应堆，青紫，神秘）
const loopReactor = (sr) => musicLoop({
  chords: [[60, 63, 67], [56, 60, 63], [58, 63, 67], [63, 67, 70]],
  roots: [48, 44, 46, 51],
  arp: [72, 75, 79, 75, 70, 74, 77, 74, 75, 79, 82, 79, 72, 75, 79, 75],
  sr,
});
// E 小调（Boss，紧张）
const loopBoss = (sr) => musicLoop({
  chords: [[64, 67, 71], [60, 64, 67], [64, 67, 71], [62, 65, 69]],
  roots: [40, 36, 40, 38],
  arp: [76, 79, 83, 79, 76, 79, 83, 79, 76, 79, 83, 79, 74, 77, 81, 77],
  type: 'square',
  chordSec: 1.5,
  sr,
});

const LOOPS = {
  bgm1: loopBridge,
  bgm2: loopHull,
  bgm3: loopReactor,
  bgmBoss: loopBoss,
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

const EVENT_TO_SFX = {
  shot: 'shot',
  coreCopy: 'coreCopy',
  hit: 'hit',
  kill: 'kill',
  playerHurt: 'playerHurt',
  enemyShot: 'enemyShot',
  enemyDash: 'enemyDash',
  enemyDetonate: 'kill',
  webTrap: 'playerHurt',
  echoStrike: 'hit',
  waveStart: 'waveStart',
  waveClear: 'waveClear',
  cardPick: 'cardPick',
  upgrade: 'cardPick',
  phaseSync: 'phaseSync',
  overload: 'overload',
  overloadNo: 'overloadNo',
  syncNo: 'overloadNo',
  coreOffline: 'coreOffline',
  coreOnline: 'coreOnline',
  bossSpawn: 'bossSpawn',
  bossHit: 'bossHit',
  bossBreak: 'bossBreak',
  bossLaser: 'bossSpawn',
  bossBomb: 'enemyShot',
  death: 'death',
  win: 'win',
  ui: 'ui',
};

const SFX_PRIORITY = {
  kill: 6, overload: 6, bossBreak: 6,
  waveClear: 5, phaseSync: 5,
  death: 4, bossSpawn: 4, waveStart: 4, win: 4,
  hit: 3, playerHurt: 3, bossHit: 3, coreOffline: 3, coreOnline: 3,
  shot: 2, coreCopy: 2, cardPick: 2, enemyShot: 2, enemyDash: 2,
  overloadNo: 1, ui: 1,
};

export function createAudio() {
  const state = {
    ctx: null, master: null, sfxBus: null, bgmBus: null,
    volume: 0.7, muted: false, unlocked: false,
    bgmSource: null, bgmName: null,
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
      let minKey = null;
      let minPrio = Infinity;
      for (const [k, v] of state.active) {
        if (v.priority < minPrio) { minPrio = v.priority; minKey = k; }
      }
      if (minKey == null || priority <= minPrio) return;
      if (state.active.get(minKey)?.stop) { try { state.active.get(minKey).stop(now); } catch { /* noop */ } }
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
      name, priority,
      endTime: now + pcm.length / ctx.sampleRate,
      stop: (t) => { try { src.stop(t); } catch { /* noop */ } },
    });
  }

  function stopBgmSource() {
    if (state.bgmSource) {
      try { state.bgmSource.stop(); } catch { /* noop */ }
      state.bgmSource = null;
    }
    state.bgmName = null;
  }

  function unlock() {
    ensureCtx();
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

  async function playBgm(name) {
    const ctx = ensureCtx();
    if (!ctx) return;
    if (state.bgmName === name && state.bgmSource) return;
    stopBgmSource();
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

  function stopBgm() {
    stopBgmSource();
  }

  return { unlock, event, setMuted, setVolume, playBgm, stopBgm };
}

export default createAudio;
export { SAMPLE_RATE };
