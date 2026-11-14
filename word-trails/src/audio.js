// 程序化 WebAudio 音效（首次交互解锁，无外部音频文件）。
let ctx = null;
let muted = false;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', gain = 0.16, when = 0) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

export const audio = {
  unlock() { ac(); },
  setMuted(m) { muted = !!m; },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.07); },
  select(step = 0) { tone(440 + step * 40, 0.06, 'triangle', 0.1); },
  found(streak = 1) {
    const base = 523 + Math.min(streak, 6) * 50;
    tone(base, 0.1, 'sine', 0.15);
    tone(base * 1.25, 0.12, 'sine', 0.13, 0.06);
    tone(base * 1.5, 0.16, 'sine', 0.12, 0.12);
  },
  invalid() { tone(180, 0.12, 'sawtooth', 0.08); tone(140, 0.14, 'sawtooth', 0.07, 0.06); },
  hint() { tone(880, 0.08, 'triangle', 0.1); tone(1175, 0.1, 'triangle', 0.08, 0.05); },
  shuffle() { tone(392, 0.06, 'triangle', 0.09); tone(523, 0.06, 'triangle', 0.09, 0.05); },
  clear() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
};