// 程序化 WebAudio 音效（首次交互解锁，无外部音频文件）。
let ctx = null;
let muted = false;
function ac() {
  if (!ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) ctx = new AC(); }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}
function tone(freq, dur, type = 'sine', gain = 0.14, when = 0, slideTo = null) {
  const c = ac(); if (!c || muted) return;
  const t0 = c.currentTime + when;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t0);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(gain, t0); g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(c.destination); o.start(t0); o.stop(t0 + dur + 0.02);
}
function noise(dur, gain = 0.1, when = 0, freq = 1500) {
  const c = ac(); if (!c || muted) return;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const s = c.createBufferSource(); s.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq;
  const g = c.createGain(); g.gain.value = gain;
  s.connect(f); f.connect(g); g.connect(c.destination); s.start(t0);
}
export const audio = {
  unlock() { ac(); },
  setMuted(m) { muted = !!m; },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  shoot() { noise(0.05, 0.05, 0, 2200); tone(720, 0.04, 'square', 0.04, 0, 300); },
  hit() { tone(200, 0.06, 'square', 0.08, 0, 120); },
  kill() { tone(523, 0.07, 'square', 0.1); tone(784, 0.1, 'square', 0.09, 0.06); },
  death() { tone(300, 0.2, 'sawtooth', 0.12, 0, 90); },
  respawn() { tone(440, 0.08, 'sine', 0.08); tone(660, 0.1, 'sine', 0.08, 0.06); },
  dash() { noise(0.09, 0.06, 0, 900); tone(300, 0.08, 'sine', 0.06, 0, 700); },
  pickup() { tone(660, 0.07, 'square', 0.08); tone(990, 0.09, 'square', 0.07, 0.06); },
  round() { tone(392, 0.1, 'sine', 0.09); tone(523, 0.14, 'sine', 0.09, 0.08); },
  warning() { tone(330, 0.12, 'square', 0.08); tone(330, 0.12, 'square', 0.08, 0.16); },
  win() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
  lose() { tone(330, 0.18, 'sawtooth', 0.12); tone(220, 0.22, 'sawtooth', 0.12, 0.14); tone(147, 0.34, 'sawtooth', 0.12, 0.3); },
};