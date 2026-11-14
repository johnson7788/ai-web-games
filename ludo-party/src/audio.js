// 音频：循环 BGM（assets/audio/bgm.mp3）+ 程序化 SFX。
// 首次交互 unlock 后 BGM 起播；静音掐断、取消静音从当前位置恢复；BGM/SFX 分轨 + 压限。
// 接口与调用点不变；BGM 缺失/解码失败静默回退（无声，不报错），SFX 保持程序化合成。
let ctx = null;
let muted = false;
let unlocked = false;

let master = null;     // master gain -> compressor -> destination
let sfxGain = null;    // SFX 分轨
let bgmGain = null;    // BGM 分轨
let bgmBuffer = null;  // 解码后的 BGM AudioBuffer
let bgmSource = null;  // 当前循环源
let bgmLoading = null; // 解码中 promise

const BGM_VOL = 0.5;
const MASTER_VOL = 0.9;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18;
      comp.knee.value = 24;
      comp.ratio.value = 6;
      comp.attack.value = 0.003;
      comp.release.value = 0.25;
      master = ctx.createGain();
      master.gain.value = MASTER_VOL;
      master.connect(comp);
      comp.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 1;
      sfxGain.connect(master);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = BGM_VOL;
      bgmGain.connect(master);
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur, type = 'sine', gain = 0.16, when = 0) {
  const c = ac();
  if (!c || muted || !sfxGain) return;
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

function noise(dur, gain = 0.08, when = 0) {
  const c = ac();
  if (!c || muted || !sfxGain) return;
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
  f.type = 'highpass';
  f.frequency.value = 2000;
  src.connect(f); f.connect(g); g.connect(sfxGain);
  src.start(t0);
}

function loadBgm() {
  if (bgmBuffer) return Promise.resolve(bgmBuffer);
  if (bgmLoading) return bgmLoading;
  bgmLoading = (async () => {
    try {
      const res = await fetch('assets/audio/bgm.mp3');
      if (!res.ok) return null;
      const buf = await res.arrayBuffer();
      const c = ac();
      if (!c) return null;
      bgmBuffer = await c.decodeAudioData(buf);
    } catch {
      bgmBuffer = null;
    }
    bgmLoading = null;
    return bgmBuffer;
  })();
  return bgmLoading;
}

function startBgm() {
  const c = ac();
  if (!c || !bgmGain || !bgmBuffer || bgmSource) return;
  const src = c.createBufferSource();
  src.buffer = bgmBuffer;
  src.loop = true;
  src.connect(bgmGain);
  src.start();
  bgmSource = src;
}

function ensureBgm() {
  if (muted || !unlocked || bgmSource) return;
  if (bgmBuffer) { startBgm(); return; }
  if (!bgmLoading) loadBgm().then(() => { if (unlocked && !muted && !bgmSource) startBgm(); });
}

export const audio = {
  unlock() {
    ac();
    unlocked = true;
    ensureBgm();
  },
  setMuted(m) {
    muted = !!m;
    if (ctx && bgmGain) {
      const t = ctx.currentTime;
      bgmGain.gain.cancelScheduledValues(t);
      bgmGain.gain.setTargetAtTime(muted ? 0 : BGM_VOL, t, 0.01);
    }
    ensureBgm();
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  roll() { noise(0.1, 0.1); tone(300, 0.05, 'square', 0.06, 0.05); },
  move() { tone(440, 0.06, 'triangle', 0.1); },
  capture() { tone(200, 0.12, 'sawtooth', 0.12); tone(150, 0.14, 'sawtooth', 0.1, 0.06); },
  finish() { tone(660, 0.08, 'sine', 0.14); tone(880, 0.1, 'sine', 0.12, 0.06); },
  win() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
};
