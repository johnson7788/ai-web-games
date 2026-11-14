// 程序化 WebAudio 音效（首次交互解锁，无外部音频文件）。
let ctx = null;
let muted = false;
let master = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.55;
      master.connect(ctx.destination);
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', gain = 0.14, when = 0, slideTo = null) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(master || c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.03);
}

function noise(dur = 0.08, gain = 0.05) {
  const c = ac();
  if (!c || muted) return;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g); g.connect(master || c.destination);
  src.start();
}

export const audio = {
  unlock() { ac(); },
  setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : 0.55;
  },
  get muted() { return muted; },
  click() { tone(620, 0.05, 'square', 0.05); },
  scan(n = 0) {
    tone(1180 + (n % 4) * 90, 0.055, 'square', 0.09);
    noise(0.03, 0.02);
  },
  money(cents = 100) {
    const f = cents >= 500 ? 320 : cents >= 100 ? 480 : 720;
    tone(f, 0.05, 'triangle', 0.07);
    tone(f * 1.5, 0.06, 'triangle', 0.05, 0.03);
  },
  reset() { tone(300, 0.06, 'triangle', 0.05); },
  sale(combo = 0) {
    const base = 523.25;
    const steps = [1, 1.26, 1.5, 1.78, 2];
    const n = Math.min(combo, steps.length - 1);
    tone(base, 0.1, 'sine', 0.11);
    tone(base * 1.5, 0.12, 'sine', 0.09, 0.06);
    tone(base * 2 * (steps[n] / 2), 0.14, 'sine', 0.08, 0.12);
    noise(0.04, 0.02);
  },
  wrong() {
    tone(180, 0.18, 'sawtooth', 0.09, 0, 120);
    tone(140, 0.2, 'square', 0.05, 0.02, 100);
  },
  left() {
    tone(300, 0.12, 'sine', 0.07, 0, 220);
    tone(220, 0.16, 'sine', 0.06, 0.1, 160);
  },
  upgrade() {
    [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.12, 'sine', 0.08, i * 0.07));
  },
  dayClear() {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.16, 'sine', 0.09, i * 0.09));
  },
  gameOver() {
    [784, 659, 523, 392].forEach((f, i) => tone(f, 0.22, 'sine', 0.09, i * 0.13));
  },
};
