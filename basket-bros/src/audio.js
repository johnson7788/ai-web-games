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

function noise(dur, gain = 0.1, when = 0, freq = 1200) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const filt = c.createBiquadFilter();
  filt.type = 'bandpass'; filt.frequency.value = freq; filt.Q.value = 0.8;
  const g = c.createGain(); g.gain.value = gain;
  src.connect(filt); filt.connect(g); g.connect(c.destination);
  src.start(t0);
}

export const audio = {
  unlock() { ac(); },
  setMuted(m) { muted = !!m; },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  bounce() { tone(160, 0.06, 'sine', 0.12, 0, 90); },
  grab() { tone(320, 0.05, 'triangle', 0.1); },
  shoot() { noise(0.12, 0.06, 0, 900); tone(500, 0.1, 'sine', 0.06, 0, 700); },
  rim() { tone(210, 0.09, 'square', 0.1, 0, 180); noise(0.05, 0.05, 0, 2400); },
  swish() { noise(0.22, 0.12, 0, 3200); tone(880, 0.12, 'sine', 0.1, 0.02); tone(1320, 0.14, 'sine', 0.08, 0.08); },
  steal() { noise(0.08, 0.08, 0, 1800); tone(420, 0.06, 'square', 0.08, 0, 300); },
  win() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
  lose() { tone(330, 0.18, 'sawtooth', 0.12); tone(220, 0.22, 'sawtooth', 0.12, 0.14); tone(147, 0.34, 'sawtooth', 0.12, 0.3); },
};