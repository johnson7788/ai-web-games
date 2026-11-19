// src/core/audio.js — 程序化音频（纯 WebAudio 合成，零音频文件零外链）
//
// 统一走 PCM 合成：synthSfx(name,payload,sr) / synthLoop('bgm',sr) 输出 Float32Array，
// 浏览器 createAudio() 把 PCM 包成 AudioBuffer 播放；tools/audio-check.mjs 在 Node 里离屏复验。
// 气质：霓虹街机 —— 短促 blip、上行 arpeggio、whoosh 清场、BGM 为 Am–F–C–G 八分琶音驱动。

export const SAMPLE_RATE = 44100;

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);
const clamp01 = (v) => Math.max(0, Math.min(1, v));

function makeBuf(sr, dur) {
  return new Float32Array(Math.max(1, Math.floor(sr * dur)));
}

function addTone(buf, sr, { t0, dur, freq, freqEnd = null, type = 'sine', vol = 0.5, attack = 0.004, release = 0.05 }) {
  const n0 = Math.max(0, Math.floor(t0 * sr));
  const n1 = Math.min(buf.length, Math.floor((t0 + dur) * sr));
  const twoPi = Math.PI * 2;
  let phase = 0;
  for (let i = n0; i < n1; i += 1) {
    const t = i / sr - t0;
    const f = freqEnd != null ? freq + (freqEnd - freq) * clamp01(t / Math.max(0.0001, dur)) : freq;
    phase += (twoPi * f) / sr;
    let env = 1;
    if (t < attack) env = t / Math.max(0.0001, attack);
    else if (t > dur - release) env = clamp01((dur - t) / Math.max(0.0001, release));
    let s;
    if (type === 'square') s = Math.sin(phase) >= 0 ? 1 : -1;
    else if (type === 'sawtooth') s = 2 * ((phase / twoPi) % 1) - 1;
    else if (type === 'triangle') s = 2 * Math.abs(2 * ((phase / twoPi) % 1) - 1) - 1;
    else s = Math.sin(phase);
    buf[i] += s * vol * env;
  }
}

function addNoise(buf, sr, { t0, dur, vol = 0.3, lp = 2000, lpEnd = null }) {
  const n0 = Math.max(0, Math.floor(t0 * sr));
  const n1 = Math.min(buf.length, Math.floor((t0 + dur) * sr));
  let prev = 0;
  for (let i = n0; i < n1; i += 1) {
    const t = i / sr - t0;
    const f = lpEnd != null ? lp + (lpEnd - lp) * clamp01(t / Math.max(0.0001, dur)) : lp;
    const a = 1 - Math.exp((-2 * Math.PI * f) / sr);
    const white = Math.random() * 2 - 1;
    prev += a * (white - prev);
    let env = 1;
    if (t < 0.004) env = t / 0.004;
    else if (t > dur - 0.02) env = clamp01((dur - t) / 0.02);
    buf[i] += prev * vol * env * 4;
  }
}

// ---------- SFX ----------
const SFX_BUILDERS = {
  ui(buf, sr) {
    addTone(buf, sr, { t0: 0, dur: 0.06, freq: 1600, freqEnd: 900, type: 'sine', vol: 0.4, attack: 0.002, release: 0.02 });
    addNoise(buf, sr, { t0: 0, dur: 0.03, vol: 0.12, lp: 2400 });
  },
  correct(buf, sr, p) {
    const combo = Math.min(8, Math.max(0, p.combo ?? 0));
    const base = 72 + combo;
    addTone(buf, sr, { t0: 0, dur: 0.09, freq: midi(base), type: 'triangle', vol: 0.32, attack: 0.002, release: 0.04 });
    addTone(buf, sr, { t0: 0.07, dur: 0.14, freq: midi(base + 5), type: 'triangle', vol: 0.3, attack: 0.002, release: 0.06 });
  },
  wrong(buf, sr) {
    addTone(buf, sr, { t0: 0, dur: 0.3, freq: 150, freqEnd: 70, type: 'sawtooth', vol: 0.3, attack: 0.003, release: 0.08 });
    addNoise(buf, sr, { t0: 0, dur: 0.14, vol: 0.2, lp: 600 });
  },
  comboUp(buf, sr, p) {
    const c = Math.min(10, Math.max(0, p.combo ?? 0));
    [0, 4, 7].forEach((iv, i) => {
      addTone(buf, sr, { t0: i * 0.05, dur: 0.12, freq: midi(76 + Math.min(c, 4) + iv), type: 'sine', vol: 0.24, attack: 0.002, release: 0.05 });
    });
  },
  shieldGain(buf, sr) {
    [84, 88, 91].forEach((m, i) => addTone(buf, sr, { t0: i * 0.07, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.26, attack: 0.003, release: 0.08 }));
  },
  shieldBreak(buf, sr) {
    addTone(buf, sr, { t0: 0, dur: 0.25, freq: 300, freqEnd: 120, type: 'square', vol: 0.2, attack: 0.002, release: 0.05 });
    addNoise(buf, sr, { t0: 0, dur: 0.2, vol: 0.24, lp: 900, lpEnd: 300 });
  },
  golden(buf, sr) {
    [72, 76, 79, 84].forEach((m, i) => addTone(buf, sr, { t0: i * 0.06, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.002, release: 0.08 }));
  },
  tick(buf, sr) {
    addTone(buf, sr, { t0: 0, dur: 0.07, freq: 1100, type: 'sine', vol: 0.22, attack: 0.001, release: 0.03 });
  },
  count(buf, sr) {
    addTone(buf, sr, { t0: 0, dur: 0.12, freq: 660, type: 'square', vol: 0.2, attack: 0.002, release: 0.04 });
  },
  sweep(buf, sr) {
    addNoise(buf, sr, { t0: 0, dur: 0.5, vol: 0.24, lp: 3200, lpEnd: 300 });
  },
  eliminate(buf, sr) {
    addTone(buf, sr, { t0: 0, dur: 0.35, freq: 500, freqEnd: 90, type: 'sawtooth', vol: 0.26, attack: 0.002, release: 0.06 });
  },
  stage(buf, sr) {
    [64, 69, 76].forEach((m, i) => addTone(buf, sr, { t0: i * 0.08, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.26, attack: 0.003, release: 0.08 }));
  },
  start(buf, sr) {
    addTone(buf, sr, { t0: 0, dur: 0.1, freq: 520, type: 'triangle', vol: 0.28, attack: 0.002, release: 0.04 });
    addTone(buf, sr, { t0: 0.1, dur: 0.16, freq: 780, type: 'triangle', vol: 0.28, attack: 0.002, release: 0.07 });
  },
  win(buf, sr) {
    [72, 76, 79, 84, 88, 91].forEach((m, i) => addTone(buf, sr, { t0: i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.003, release: 0.08 }));
  },
  lose(buf, sr) {
    [76, 72, 69, 64].forEach((m, i) => addTone(buf, sr, { t0: i * 0.14, dur: 0.24, freq: midi(m), type: 'sawtooth', vol: 0.22, attack: 0.003, release: 0.1 }));
  },
};

export const SFX_NAMES = Object.keys(SFX_BUILDERS);

export function synthSfx(name, payload = {}, sr = SAMPLE_RATE) {
  const build = SFX_BUILDERS[name];
  if (!build) return new Float32Array(1);
  const dur = name === 'sweep' ? 0.5 : name === 'win' ? 0.7 : 0.4;
  const buf = makeBuf(sr, dur);
  build(buf, sr, payload || {});
  return buf;
}

// ---------- BGM 循环 ----------
const BGM_BPM = 120;
const BEAT = 60 / BGM_BPM;
const BAR = BEAT * 4;
const BGM_BARS = 4;
export const BGM_LOOP = BAR * BGM_BARS; // 8s

const CHORDS = [
  { bass: 45, triad: [57, 60, 64] }, // Am
  { bass: 41, triad: [53, 57, 60] }, // F
  { bass: 48, triad: [48, 52, 55] }, // C
  { bass: 43, triad: [55, 59, 62] }, // G
];

const MELODY = [69, 72, 76, 72, 74, 71, 67, 72]; // 每小节两个音

export function synthLoop(name, sr = SAMPLE_RATE) {
  if (name !== 'bgm') return new Float32Array(1);
  const buf = makeBuf(sr, BGM_LOOP);
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % CHORDS.length];
    const barT = bar * BAR;
    // 贝斯：四分音符
    for (let b = 0; b < 4; b += 1) {
      addTone(buf, sr, { t0: barT + b * BEAT, dur: 0.28, freq: midi(chord.bass), type: 'triangle', vol: 0.22, attack: 0.005, release: 0.12 });
    }
    // 和弦垫
    for (const m of chord.triad) {
      addTone(buf, sr, { t0: barT, dur: BAR, freq: midi(m), type: 'sawtooth', vol: 0.05, attack: 0.1, release: 0.3 });
    }
    // 八分琶音（上行 0-1-2-1）
    const seq = [0, 1, 2, 1];
    for (let e = 0; e < 8; e += 1) {
      const m = chord.triad[seq[e % seq.length]] + 12;
      addTone(buf, sr, { t0: barT + e * (BEAT / 2), dur: 0.14, freq: midi(m), type: 'sine', vol: 0.14, attack: 0.002, release: 0.06 });
    }
    // 主旋律（每小节 2 音）
    addTone(buf, sr, { t0: barT, dur: 0.4, freq: midi(MELODY[bar * 2] + 12), type: 'triangle', vol: 0.16, attack: 0.004, release: 0.2 });
    addTone(buf, sr, { t0: barT + 2 * BEAT, dur: 0.4, freq: midi(MELODY[bar * 2 + 1] + 12), type: 'triangle', vol: 0.16, attack: 0.004, release: 0.2 });
  }
  return buf;
}

export const LOOP_NAMES = ['bgm'];

// ---------- 实时入口 ----------
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
  let bgmSource = null;
  let bgmGain = null;

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
    if (!ensure() || muted) return;
    const buf = ctx.createBuffer(1, pcm.length, ctx.sampleRate);
    buf.copyToChannel(pcm, 0);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const g = ctx.createGain();
    g.gain.value = gain;
    if (loop) src.loop = true;
    src.connect(g);
    g.connect(master);
    src.start();
    return { src, g };
  }

  function event(name, payload) {
    const pcm = synthSfx(name, payload, ctx ? ctx.sampleRate : SAMPLE_RATE);
    playPcm(pcm);
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) master.gain.value = muted ? 0 : volume;
    return muted;
  }

  function setVolume(v) {
    volume = clamp01(Number(v) || 0);
    if (master && ctx && !muted) master.gain.value = volume;
    return volume;
  }

  function playBgm() {
    if (!ensure() || bgmSource) return;
    const pcm = synthLoop('bgm', ctx.sampleRate);
    const r = playPcm(pcm, { loop: true, gain: 0.5 });
    bgmSource = r.src;
    bgmGain = r.g;
  }

  function stopBgm() {
    if (bgmSource) {
      try { bgmSource.stop(); } catch { /* noop */ }
      bgmSource = null;
      bgmGain = null;
    }
  }

  function unlock() { return ensure(); }

  return { event, setMuted, setVolume, playBgm, stopBgm, unlock };
}
