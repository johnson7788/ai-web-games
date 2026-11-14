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
  osc.connect(g);
  g.connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur, gain = 0.12, when = 0) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const filter = c.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.value = 900;
  src.connect(filter);
  filter.connect(g);
  g.connect(c.destination);
  src.start(t0);
}

export const audio = {
  unlock() { ac(); },
  setMuted(m) { muted = !!m; },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.07); },
  pickup() { tone(440, 0.06, 'triangle', 0.1); tone(660, 0.05, 'triangle', 0.08, 0.03); },
  place() { tone(300, 0.07, 'sine', 0.14); tone(450, 0.06, 'sine', 0.1, 0.02); },
  invalid() { tone(160, 0.12, 'sawtooth', 0.08); },
  blast(combo = 1) {
    noise(0.22, 0.14);
    const base = 523 + Math.min(combo, 6) * 60;
    tone(base, 0.12, 'square', 0.12);
    tone(base * 1.5, 0.14, 'square', 0.1, 0.06);
    tone(base * 2, 0.18, 'sine', 0.1, 0.12);
  },
  over() { tone(330, 0.18, 'sawtooth', 0.12); tone(220, 0.22, 'sawtooth', 0.12, 0.14); tone(147, 0.34, 'sawtooth', 0.12, 0.3); },
};