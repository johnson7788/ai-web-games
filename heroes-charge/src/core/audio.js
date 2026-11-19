// src/core/audio.js — HEROES CHARGE · 程序化音频（纯数学 PCM 合成，零音频文件零外链）
// 单源：SFX/BGM 都先合成 PCM（Node 离线复验 + 浏览器实时播放共用同一套合成器）。
// BGM：霓虹合成器脉冲（A 小调 Am–F–C–G，BPM 120）。
// 导出 createAudio()（实时）；另导出 SAMPLE_RATE/SFX_NAMES/LOOP_NAMES/synthSfx/synthLoop 供 audio-check 离线复验。

const BPM = 120;
const BEAT = 60 / BPM;          // 0.5s
const BAR = BEAT * 4;           // 2s
const BGM_BARS = 2;             // 一个循环 4s
const BGM_LOOP = BAR * BGM_BARS;

export const SAMPLE_RATE = 44100;
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const dbToGain = (db) => Math.pow(10, db / 20);

// ---------- PCM 合成核心 ----------

function addTone(out, sr, { t0 = 0, dur, freq, freqEnd = null, type = 'sine', vol = 0.4, attack = 0.004, release = 0.02 }) {
  const start = Math.floor(t0 * sr);
  const len = Math.floor(dur * sr);
  let phase = 0;
  for (let i = 0; i < len; i += 1) {
    const idx = start + i;
    if (idx >= out.length) break;
    const t = i / sr;
    const prog = t / dur;
    const f = freqEnd != null ? Math.max(1, freq * Math.pow(freqEnd / freq, prog)) : freq;
    phase += (2 * Math.PI * f) / sr;
    const ph = phase;
    let s;
    if (type === 'sine') s = Math.sin(ph);
    else if (type === 'square') s = Math.sign(Math.sin(ph));
    else if (type === 'sawtooth') s = 2 * ((ph / (2 * Math.PI)) % 1) - 1;
    else if (type === 'triangle') s = 2 * Math.abs(2 * ((ph / (2 * Math.PI)) % 1) - 1) - 1;
    else s = Math.sin(ph);
    const a = Math.min(1, t / Math.max(0.0005, attack));
    const r = Math.min(1, (dur - t) / Math.max(0.0005, release));
    const env = Math.max(0, Math.min(a, r));
    out[idx] += s * vol * env;
  }
}

function addNoise(out, sr, { t0 = 0, dur, vol = 0.3, attack = 0.002, release = 0.02 }) {
  const start = Math.floor(t0 * sr);
  const len = Math.floor(dur * sr);
  for (let i = 0; i < len; i += 1) {
    const idx = start + i;
    if (idx >= out.length) break;
    const t = i / sr;
    const a = Math.min(1, t / Math.max(0.0005, attack));
    const r = Math.min(1, (dur - t) / Math.max(0.0005, release));
    const env = Math.max(0, Math.min(a, r)) * (1 - t / dur);
    out[idx] += (Math.random() * 2 - 1) * vol * env;
  }
}

function mix(sr, durSec, build) {
  const out = new Float32Array(Math.max(1, Math.floor(sr * durSec)));
  build(out, sr);
  return out;
}

// ---------- SFX（每个 ≤0.6s，win/lose 略长）----------

const SFX = {
  attack: { dur: 0.16, build(out, sr) {
    addTone(out, sr, { t0: 0, dur: 0.14, freq: 1600, freqEnd: 420, type: 'sawtooth', vol: 0.32 });
    addNoise(out, sr, { t0: 0, dur: 0.06, vol: 0.18 });
  } },
  hit: { dur: 0.14, build(out, sr) {
    addTone(out, sr, { t0: 0, dur: 0.12, freq: 200, freqEnd: 90, type: 'triangle', vol: 0.5 });
    addNoise(out, sr, { t0: 0, dur: 0.04, vol: 0.22 });
  } },
  enemyDown: { dur: 0.32, build(out, sr) {
    addNoise(out, sr, { t0: 0, dur: 0.3, vol: 0.5 });
    addTone(out, sr, { t0: 0, dur: 0.22, freq: 220, freqEnd: 55, type: 'sine', vol: 0.4 });
  } },
  dash: { dur: 0.18, build(out, sr) {
    addNoise(out, sr, { t0: 0, dur: 0.16, vol: 0.4 });
    addTone(out, sr, { t0: 0, dur: 0.12, freq: 500, freqEnd: 1400, type: 'sine', vol: 0.2 });
  } },
  jump: { dur: 0.18, build(out, sr) {
    addTone(out, sr, { t0: 0, dur: 0.16, freq: 380, freqEnd: 720, type: 'square', vol: 0.24 });
  } },
  special: { dur: 0.4, build(out, sr) {
    [0, 0.06, 0.12].forEach((dt, i) => {
      addTone(out, sr, { t0: dt, dur: 0.2, freq: midi(72 + i * 4), type: 'sine', vol: 0.26 });
    });
  } },
  orb: { dur: 0.16, build(out, sr) {
    addTone(out, sr, { t0: 0, dur: 0.14, freq: 1320, freqEnd: 1760, type: 'sine', vol: 0.3 });
  } },
  shield: { dur: 0.32, build(out, sr) {
    addTone(out, sr, { t0: 0, dur: 0.3, freq: midi(76), type: 'sine', vol: 0.28 });
    addTone(out, sr, { t0: 0.05, dur: 0.24, freq: midi(80), type: 'sine', vol: 0.2 });
  } },
  playerHurt: { dur: 0.26, build(out, sr) {
    addTone(out, sr, { t0: 0, dur: 0.24, freq: 160, freqEnd: 60, type: 'sawtooth', vol: 0.4 });
    addNoise(out, sr, { t0: 0, dur: 0.14, vol: 0.28 });
  } },
  levelClear: { dur: 0.6, build(out, sr) {
    [72, 76, 79, 84].forEach((m, i) => addTone(out, sr, { t0: i * 0.08, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.26 }));
  } },
  win: { dur: 0.7, build(out, sr) {
    [72, 76, 79, 84, 88].forEach((m, i) => addTone(out, sr, { t0: i * 0.08, dur: 0.24, freq: midi(m), type: 'triangle', vol: 0.28 }));
  } },
  lose: { dur: 0.55, build(out, sr) {
    addTone(out, sr, { t0: 0, dur: 0.5, freq: 140, freqEnd: 50, type: 'sine', vol: 0.5 });
    addNoise(out, sr, { t0: 0, dur: 0.3, vol: 0.26 });
  } },
  star: { dur: 0.2, build(out, sr) {
    addTone(out, sr, { t0: 0, dur: 0.18, freq: midi(84), type: 'sine', vol: 0.24 });
  } },
  combo: { dur: 0.14, build(out, sr, payload) {
    const shift = Math.min(12, Math.floor((payload?.combo || 5) / 5) * 2);
    addTone(out, sr, { t0: 0, dur: 0.12, freq: midi(72 + shift), type: 'square', vol: 0.2 });
  } },
  ui: { dur: 0.06, build(out, sr) {
    addTone(out, sr, { t0: 0, dur: 0.05, freq: 1200, type: 'sine', vol: 0.22 });
  } },
};

export const SFX_NAMES = Object.keys(SFX);

const SFX_EVENT_MAP = {
  attack: 'attack',
  hit: 'hit',
  enemyDown: 'enemyDown',
  dash: 'dash',
  jump: 'jump',
  special: 'special',
  orb: 'orb',
  shield: 'shield',
  playerHurt: 'playerHurt',
  levelClear: 'levelClear',
  win: 'win',
  lose: 'lose',
  star: 'star',
  combo: 'combo',
  ui: 'ui',
};

// ---------- BGM（合成器脉冲：Am–F–C–G）----------

const CHORDS = [
  { root: 45, arp: [57, 60, 64, 69] }, // Am
  { root: 41, arp: [53, 57, 60, 65] }, // F
  { root: 48, arp: [60, 64, 67, 72] }, // C
  { root: 43, arp: [55, 59, 62, 67] }, // G
];

function buildBgmLoop(out, sr) {
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const barT = bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      addTone(out, sr, { t0: bt, dur: 0.28, freq: midi(chord.root), type: 'sawtooth', vol: 0.2, attack: 0.004 });
      addTone(out, sr, { t0: bt, dur: 0.12, freq: midi(chord.arp[b % 4] + 12), type: 'square', vol: 0.09, attack: 0.002 });
      addNoise(out, sr, { t0: bt + BEAT / 2, dur: 0.03, vol: 0.06, attack: 0.001 });
    }
  }
}

// ---------- 对外采样 ----------

export function synthSfx(name, payload = {}, sr = SAMPLE_RATE) {
  const def = SFX[name];
  if (!def) return new Float32Array(0);
  return mix(sr, def.dur, (out, s) => def.build(out, s, payload || {}));
}

export function synthLoop(name = 'combat', sr = SAMPLE_RATE) {
  return mix(sr, BGM_LOOP + 0.05, buildBgmLoop);
}

export const LOOP_NAMES = ['combat'];

// ---------- 实时入口（浏览器 WebAudio）----------

export function createAudio(opts = {}) {
  const factory = opts.createContext || (() => {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    return AC ? new AC() : null;
  });

  let ctx = null;
  let master = null;
  let muted = false;
  let volume = 0.8;
  let bgmPlaying = false;
  let bgmSrc = null;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return true;
    }
    const c = factory();
    if (!c) return false;
    ctx = c;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    return true;
  }

  function playPcm(pcm, { loop = false, gain = 1 } = {}) {
    if (!pcm.length) return null;
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.getChannelData(0).set(pcm);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = loop;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g);
    g.connect(master);
    src.start();
    return src;
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfxName = SFX_EVENT_MAP[name];
    if (!sfxName || !SFX[sfxName]) return;
    playPcm(synthSfx(sfxName, payload || {}, ctx.sampleRate), { gain: dbToGain(-6) });
  }

  function playBgm() {
    if (!ensure() || bgmPlaying) return;
    bgmPlaying = true;
    bgmSrc = playPcm(synthLoop('combat', ctx.sampleRate), { loop: true, gain: dbToGain(-14) });
  }

  function stopBgm() {
    bgmPlaying = false;
    if (bgmSrc) { try { bgmSrc.stop(); } catch { /* noop */ } bgmSrc = null; }
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) master.gain.value = muted ? 0 : volume;
    return muted;
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, Number(v) || 0));
    if (master && ctx && !muted) master.gain.value = volume;
    return volume;
  }

  function unlock() { return ensure(); }

  return { event, setMuted, setVolume, playBgm, stopBgm, unlock };
}

export { SFX_EVENT_MAP, BPM, BEAT, BAR, BGM_BARS, BGM_LOOP };
