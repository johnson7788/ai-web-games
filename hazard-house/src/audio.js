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

function tone(freq, dur, type = 'sine', gain = 0.16, when = 0, slideTo = null) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(c.destination);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function noise(dur, gain = 0.12, when = 0, freq = 800) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(); src.buffer = buf;
  const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = freq;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(f); f.connect(g); g.connect(c.destination);
  src.start(t0);
}

export const audio = {
  unlock() { ac(); },
  setMuted(m) { muted = !!m; },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  hit() { tone(220, 0.1, 'square', 0.12, 0, 120); noise(0.08, 0.08, 0, 1200); },
  eliminated() { tone(330, 0.16, 'sawtooth', 0.12, 0, 110); tone(165, 0.24, 'sawtooth', 0.1, 0.12, 80); },
  boom() { noise(0.3, 0.18, 0, 500); tone(90, 0.2, 'sine', 0.14, 0, 50); },
  spike() { noise(0.06, 0.06, 0, 3000); tone(1400, 0.05, 'square', 0.05); },
  go() { tone(523, 0.1, 'sine', 0.14); tone(784, 0.16, 'sine', 0.14, 0.08); },
  roundWin() { tone(659, 0.1, 'sine', 0.14); tone(880, 0.16, 'sine', 0.14, 0.1); },
  champion() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.12); tone(784, 0.12, 'sine', 0.16, 0.24); tone(1047, 0.3, 'sine', 0.16, 0.36); },
};