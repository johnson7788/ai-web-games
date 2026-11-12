// 程序化音频：全部用振荡器 + 噪声 + 滤波器 + 包络实时合成，不引外部音频文件。
// 首次交互才创建 AudioContext（浏览器自动播放策略）；静音状态由调用方持久化。
import { AUDIO } from '../../config/game.config.js';

let ctx = null;
let master = null;
let noiseBuf = null;
let muted = false;
let voices = 0;
const lastAt = new Map();

const THROTTLE = { clack: 0.016, rail: 0.05, pocket: 0.02, cue: 0.02 };
const MAX_VOICES = 22;

function ensure() {
  if (ctx) return ctx;
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : AUDIO.master;
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -14;
  comp.ratio.value = 6;
  master.connect(comp);
  comp.connect(ctx.destination);
  return ctx;
}

function noise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate), ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function track(node) {
  voices += 1;
  node.onended = () => {
    voices = Math.max(0, voices - 1);
  };
}

function tone({ type = 'sine', f = 440, f2, dur = 0.12, peak = 0.3, delay = 0, dest }) {
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (f2) osc.frequency.exponentialRampToValueAtTime(Math.max(20, f2), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g);
  g.connect(dest || master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
  track(osc);
  return g;
}

function burst({ dur = 0.06, peak = 0.3, type = 'bandpass', f = 1600, q = 1.2, f2, delay = 0 }) {
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  src.buffer = noise();
  const flt = ctx.createBiquadFilter();
  flt.type = type;
  flt.frequency.setValueAtTime(f, t);
  flt.Q.value = q;
  if (f2) flt.frequency.exponentialRampToValueAtTime(Math.max(40, f2), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt);
  flt.connect(g);
  g.connect(master);
  src.start(t);
  src.stop(t + dur + 0.02);
  track(src);
}

const VOICES = {
  cue: (o) => {
    const p = 0.2 + (o.gain || 0.5) * 0.4;
    burst({ dur: 0.05, peak: p, type: 'highpass', f: 900, f2: 2600 });
    tone({ type: 'triangle', f: 320 + (o.gain || 0.5) * 180, f2: 150, dur: 0.09, peak: p * 0.7 });
  },
  clack: (o) => {
    const g = Math.min(0.5, 0.06 + (o.gain || 0.4) * 0.42);
    burst({ dur: 0.028, peak: g, type: 'bandpass', f: 1500 + (o.gain || 0.4) * 1800, q: 1.5 });
    tone({ type: 'sine', f: 900 * (o.tone || 1), f2: 520, dur: 0.05, peak: g * 0.55 });
  },
  rail: (o) => {
    burst({ dur: 0.07, peak: 0.14 * (o.gain || 1), type: 'lowpass', f: 620, q: 0.9 });
  },
  pocket: () => {
    tone({ type: 'sine', f: 620, f2: 150, dur: 0.26, peak: 0.3 });
    burst({ dur: 0.2, peak: 0.16, type: 'lowpass', f: 1200, f2: 180, delay: 0.02 });
    tone({ type: 'triangle', f: 180, f2: 90, dur: 0.16, peak: 0.2, delay: 0.14 });
  },
  place: () => tone({ type: 'sine', f: 880, f2: 660, dur: 0.07, peak: 0.16 }),
  ding: () => {
    tone({ type: 'sine', f: 1180, dur: 0.16, peak: 0.22 });
    tone({ type: 'sine', f: 1760, dur: 0.12, peak: 0.12, delay: 0.03 });
  },
  foul: () => {
    tone({ type: 'square', f: 230, dur: 0.11, peak: 0.16 });
    tone({ type: 'square', f: 175, dur: 0.16, peak: 0.16, delay: 0.12 });
  },
  win: () => {
    [523, 659, 784, 1047].forEach((f, i) => tone({ type: 'triangle', f, dur: 0.3, peak: 0.22, delay: i * 0.1 }));
  },
  lose: () => {
    [392, 330, 262, 196].forEach((f, i) => tone({ type: 'sawtooth', f, dur: 0.34, peak: 0.15, delay: i * 0.13 }));
    burst({ dur: 0.6, peak: 0.07, type: 'lowpass', f: 420, delay: 0.1 });
  },
  ui: () => tone({ type: 'sine', f: 660, f2: 880, dur: 0.07, peak: 0.14 }),
};

export const Sound = {
  get available() {
    return !!ctx;
  },
  get muted() {
    return muted;
  },
  unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume().catch(() => {});
  },
  setMuted(value) {
    muted = !!value;
    if (master) master.gain.value = muted ? 0 : AUDIO.master;
    return muted;
  },
  play(name, opts = {}) {
    if (muted) return;
    const c = ensure();
    if (!c || c.state === 'suspended' || voices > MAX_VOICES) return;
    const voice = VOICES[name];
    if (!voice) return;
    const now = c.currentTime;
    const gap = THROTTLE[name] || 0;
    if (now - (lastAt.get(name) || -1) < gap) return;
    lastAt.set(name, now);
    voice(opts);
  },
};

export default Sound;
