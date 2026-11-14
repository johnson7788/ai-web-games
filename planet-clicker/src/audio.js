// 音频：BGM 用 AI 采样（assets/audio/bgm.mp3，循环），SFX 保留程序化合成。
// 接口与调用点不变：unlock / setMuted / muted / click / buy / deny / planet。
// BGM/SFX 分轨 → DynamicsCompressor → master gain（峰值 ≤0.9）。
let ctx = null;
let muted = false;
let master = null;      // DynamicsCompressor
let masterGain = null;
let sfxGain = null;
let bgmGain = null;
let bgmBuffer = null;
let bgmSource = null;
let bgmLoading = false;

const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_VOL = 0.5;

function buildGraph(c) {
  if (master) return;
  master = c.createDynamicsCompressor();
  master.threshold.value = -14;
  master.knee.value = 20;
  master.ratio.value = 4;
  master.attack.value = 0.004;
  master.release.value = 0.25;
  masterGain = c.createGain();
  masterGain.gain.value = 0.9;
  sfxGain = c.createGain();
  sfxGain.gain.value = 1;
  bgmGain = c.createGain();
  bgmGain.gain.value = muted ? 0 : BGM_VOL;
  sfxGain.connect(master);
  bgmGain.connect(master);
  master.connect(masterGain);
  masterGain.connect(c.destination);
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx) {
    buildGraph(ctx);
    if (ctx.state === 'suspended') ctx.resume();
  }
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
  osc.connect(g); g.connect(sfxGain);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

async function loadBgm() {
  if (bgmLoading) return;
  bgmLoading = true;
  try {
    const res = await fetch(BGM_URL);
    if (!res.ok) return;
    const data = await res.arrayBuffer();
    const c = ac();
    if (!c) return;
    bgmBuffer = await c.decodeAudioData(data);
    startBgm();
  } catch {
    /* BGM 解码失败：静默降级，SFX 仍程序化 */
  }
}

function startBgm() {
  if (!ctx || !bgmBuffer || !bgmGain || bgmSource || muted) return;
  const src = ctx.createBufferSource();
  src.buffer = bgmBuffer;
  src.loop = true;
  src.connect(bgmGain);
  src.start(0);
  bgmSource = src;
}

export const audio = {
  unlock() {
    const c = ac();
    if (!c) return;
    if (bgmBuffer) startBgm();
    else loadBgm();
  },
  setMuted(m) {
    muted = !!m;
    if (ctx && bgmGain) bgmGain.gain.setTargetAtTime(muted ? 0 : BGM_VOL, ctx.currentTime, 0.01);
    if (!muted && bgmBuffer) startBgm();
  },
  get muted() { return muted; },
  click() { tone(300 + Math.random() * 80, 0.06, 'sine', 0.12); tone(600, 0.04, 'triangle', 0.06, 0.02); },
  buy() { tone(523, 0.07, 'triangle', 0.12); tone(784, 0.09, 'triangle', 0.1, 0.05); },
  deny() { tone(160, 0.1, 'sawtooth', 0.07); },
  planet() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
};
