// WebAudio：循环 BGM（assets/audio/bgm.mp3，首次交互解锁后起播）+ 程序化 SFX（缺失回退）。
// 对外接口与全部调用点不变：unlock / setMuted / muted / click / shoot / kill / splash / build / upgrade / leak / win / lose。
const BGM_URL = 'assets/audio/bgm.mp3';

let ctx = null;
let muted = false;
let master = null;
let sfxGain = null;
let bgmGain = null;

let bgmBuffer = null;      // 解码后的 AudioBuffer
let bgmSrc = null;         // 当前播放源
let bgmStartCtxTime = 0;   // 起播时的 context 时间
let bgmOffset = 0;         // 暂停/恢复位置（秒）
let bgmLoading = null;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -14;
      master.knee.value = 24;
      master.ratio.value = 8;
      master.attack.value = 0.003;
      master.release.value = 0.25;
      master.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.8;
      sfxGain.connect(master);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.4;
      bgmGain.connect(master);
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function sfxBus() { return sfxGain || (ctx ? ctx.destination : null); }

function tone(freq, dur, type = 'sine', gain = 0.16, when = 0) {
  const c = ac();
  const bus = sfxBus();
  if (!c || !bus || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(bus);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function noise(dur, gain = 0.1, when = 0) {
  const c = ac();
  const bus = sfxBus();
  if (!c || !bus || muted) return;
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
  f.frequency.value = 1500;
  src.connect(f); f.connect(g); g.connect(bus);
  src.start(t0);
}

// ---- BGM ----------------------------------------------------------------
function stopBgm() {
  if (!bgmSrc) return;
  if (ctx && bgmBuffer && bgmBuffer.duration > 0) {
    bgmOffset = (bgmOffset + ctx.currentTime - bgmStartCtxTime) % bgmBuffer.duration;
  }
  try { bgmSrc.stop(); } catch { /* noop */ }
  try { bgmSrc.disconnect(); } catch { /* noop */ }
  bgmSrc = null;
}

async function loadBgm() {
  if (bgmLoading) return bgmLoading;
  bgmLoading = (async () => {
    const c = ac();
    if (!c) return;
    try {
      const res = await fetch(BGM_URL);
      if (!res.ok) return;
      const buf = await res.arrayBuffer();
      bgmBuffer = await c.decodeAudioData(buf);
    } catch { bgmBuffer = null; }
  })();
  return bgmLoading;
}

function startBgm() {
  const c = ctx; // 只在已解锁的 context 上起播，避免提前创建
  if (!c || muted || !bgmBuffer || bgmSrc || !bgmBuffer.duration) return;
  bgmOffset %= bgmBuffer.duration;
  const src = c.createBufferSource();
  src.buffer = bgmBuffer;
  src.loop = true;
  src.connect(bgmGain || c.destination);
  src.start(0, bgmOffset);
  bgmStartCtxTime = c.currentTime;
  bgmSrc = src;
}

export const audio = {
  unlock() {
    ac();
    if (!muted) loadBgm().then(startBgm);
  },
  setMuted(m) {
    muted = !!m;
    if (muted) stopBgm();
    else startBgm();
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  shoot() { tone(880, 0.04, 'square', 0.04); },
  kill() { tone(523, 0.06, 'triangle', 0.1); noise(0.06, 0.06); },
  splash() { noise(0.18, 0.12); tone(120, 0.14, 'sine', 0.1); },
  build() { tone(392, 0.07, 'triangle', 0.12); tone(587, 0.09, 'triangle', 0.1, 0.05); },
  upgrade() { tone(523, 0.07, 'triangle', 0.12); tone(784, 0.1, 'triangle', 0.1, 0.06); },
  leak() { tone(200, 0.16, 'sawtooth', 0.12); },
  win() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
  lose() { tone(330, 0.18, 'sawtooth', 0.12); tone(220, 0.22, 'sawtooth', 0.12, 0.14); tone(147, 0.34, 'sawtooth', 0.12, 0.3); },
};
