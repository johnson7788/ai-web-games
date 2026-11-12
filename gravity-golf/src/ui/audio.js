// 程序化音效：WebAudio 合成，无外部音频文件。首次交互解锁；静音状态经 Sdk 持久化。
import Sdk from '../core/sdk.js';

let ctx = null;
let noiseBuf = null;
let muted = false;

function ensureCtx() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(type, freq, t0, dur, vol, freqEnd) {
  const c = ctx;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(t0, dur, vol, type, freq, freqEnd) {
  const c = ctx;
  const src = c.createBufferSource();
  src.buffer = noiseBuf;
  const f = c.createBiquadFilter();
  f.type = type;
  f.frequency.setValueAtTime(freq, t0);
  if (freqEnd) f.frequency.exponentialRampToValueAtTime(Math.max(20, freqEnd), t0 + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(c.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

function play(fn) {
  if (muted) return;
  if (!ensureCtx()) return;
  try { fn(ctx.currentTime); } catch { /* 音频失败不影响玩法 */ }
}

export const audio = {
  get muted() { return muted; },

  init() {
    muted = !!Sdk.load('muted', false);
  },

  unlock() {
    ensureCtx();
  },

  setMuted(m) {
    muted = !!m;
    Sdk.save('muted', muted);
  },

  click() {
    play((t) => tone('square', 620, t, 0.06, 0.12));
  },

  swing(power) {
    play((t) => noise(t, 0.16, 0.1 + power * 0.1, 'bandpass', 500, 2400));
  },

  hit(power) {
    play((t) => {
      noise(t, 0.1, 0.16 + power * 0.14, 'lowpass', 1400);
      tone('sine', 150, t, 0.12, 0.2 + power * 0.15, 60);
    });
  },

  bounce(impact) {
    const v = Math.min(0.22, impact / 900 * 0.2);
    play((t) => tone('sine', 100 + impact * 0.05, t, 0.09, v, 55));
  },

  coin() {
    play((t) => {
      tone('square', 880, t, 0.06, 0.08);
      tone('square', 1318, t + 0.07, 0.09, 0.08);
    });
  },

  fire() {
    play((t) => noise(t, 0.35, 0.16, 'lowpass', 900, 300));
  },

  burnout() {
    play((t) => {
      noise(t, 0.5, 0.2, 'lowpass', 1200, 120);
      tone('sawtooth', 420, t, 0.5, 0.14, 50);
    });
  },

  upgrade() {
    play((t) => {
      tone('square', 523, t, 0.09, 0.1);
      tone('square', 659, t + 0.09, 0.09, 0.1);
      tone('square', 784, t + 0.18, 0.14, 0.1);
    });
  },

  banner() {
    play((t) => tone('triangle', 330, t, 0.4, 0.1, 440));
  },

  best() {
    play((t) => {
      tone('square', 659, t, 0.1, 0.1);
      tone('square', 784, t + 0.1, 0.1, 0.1);
      tone('square', 1047, t + 0.2, 0.22, 0.12);
    });
  },
};
