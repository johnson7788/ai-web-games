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
  harvest() { tone(392, 0.06, 'triangle', 0.12); tone(587, 0.08, 'triangle', 0.1, 0.04); },
  buy() { tone(523, 0.07, 'triangle', 0.12); tone(784, 0.09, 'triangle', 0.1, 0.05); },
  deny() { tone(160, 0.1, 'sawtooth', 0.07); },
};