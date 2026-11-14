// 程序化 WebAudio 音效 + BGM 循环（首次交互解锁）。
// BGM 走 assets/audio/bgm.mp3；缺失静默回退。SFX 保留程序化合成。
let ctx = null;
let muted = false;
let master = null;
let comp = null;
let sfxGain = null;
let bgmGain = null;
let bgmBuffer = null;
let bgmSrc = null;
let bgmOffset = 0;   // 静音/暂停时的播放位置（秒）
let bgmLoading = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      comp = ctx.createDynamicsCompressor();
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.8;
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.3;
      sfxGain.connect(master);
      bgmGain.connect(master);
      master.connect(comp);
      comp.connect(ctx.destination);
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

async function loadBgm() {
  if (bgmBuffer) return bgmBuffer;
  if (bgmLoading) return bgmLoading;
  const c = ac();
  if (!c) return null;
  bgmLoading = fetch('assets/audio/bgm.mp3')
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('bgm fetch'))))
    .then((buf) => c.decodeAudioData(buf))
    .then((b) => { bgmBuffer = b; return b; })
    .catch(() => { bgmBuffer = null; return null; });
  return bgmLoading;
}

function playBgm() {
  if (!ctx || !bgmBuffer || muted || bgmSrc) return;
  bgmSrc = ctx.createBufferSource();
  bgmSrc.buffer = bgmBuffer;
  bgmSrc.loop = true;
  bgmSrc.connect(bgmGain);
  bgmSrc._startedAt = ctx.currentTime - bgmOffset;
  bgmSrc.start(0, bgmOffset % bgmBuffer.duration);
}

function stopBgm() {
  if (!bgmSrc) return;
  bgmOffset = (ctx.currentTime - bgmSrc._startedAt) % (bgmBuffer ? bgmBuffer.duration : 1);
  try { bgmSrc.stop(); } catch { /* noop */ }
  bgmSrc.disconnect();
  bgmSrc = null;
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
  osc.connect(g); g.connect(sfxGain);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function noise(dur, gain = 0.1, when = 0) {
  const c = ac();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 1400;
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t0);
}

export const audio = {
  unlock() {
    ac();
    loadBgm().then(() => { if (!muted) playBgm(); });
  },
  setMuted(m) {
    m = !!m;
    if (m === muted) return;
    muted = m;
    if (m) stopBgm();
    else playBgm();
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  move() { noise(0.05, 0.1); tone(300, 0.05, 'sine', 0.08); },
  capture() { noise(0.09, 0.14); tone(180, 0.1, 'sine', 0.12); },
  castle() { noise(0.06, 0.1); noise(0.06, 0.1, 0.08); },
  check() { tone(880, 0.1, 'square', 0.1); tone(660, 0.12, 'square', 0.08, 0.08); },
  win() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
  lose() { tone(330, 0.18, 'sawtooth', 0.12); tone(220, 0.22, 'sawtooth', 0.12, 0.14); tone(147, 0.34, 'sawtooth', 0.12, 0.3); },
};
