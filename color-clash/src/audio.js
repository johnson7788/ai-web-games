// 程序化 WebAudio 音效 + AI BGM。
// - BGM：assets/audio/bgm.mp3 解码为 AudioBuffer，首次交互 unlock() 后循环起播；
//   静音掐断、取消静音从当前位置恢复；缺失/解码失败静默回退（无 BGM）。
// - 关键音效保留程序化合成（audio.* 接口名与全部调用点不变）。
// - BGM/SFX 分轨增益，master 接 DynamicsCompressor，峰值留余量。
let ctx = null;
let muted = false;
let unlocked = false;

let master = null;
let sfxBus = null;
let bgmBus = null;

let bgmBuffer = null;
let bgmSrc = null;
let bgmOffset = 0;   // 秒：下次起播从 buffer 的哪个位置开始
let bgmStartAt = 0;  // ctx.currentTime：当前 source 的起始时刻

function ac() {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createDynamicsCompressor();
    master.threshold.value = -12;
    master.knee.value = 24;
    master.ratio.value = 6;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 0.9;
    sfxBus.connect(master);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = 0.5;
    bgmBus.connect(master);
  }
  if (ctx.state === 'suspended') ctx.resume();
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
  osc.connect(g); g.connect(sfxBus);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function noise(dur, gain = 0.08, when = 0) {
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
  f.type = 'highpass';
  f.frequency.value = 1200;
  src.connect(f); f.connect(g); g.connect(sfxBus);
  src.start(t0);
}

// ---- BGM ------------------------------------------------------------------
function bgmPosition() {
  if (!ctx || !bgmSrc || !bgmBuffer) return bgmOffset;
  const d = bgmBuffer.duration || 1;
  return (bgmOffset + (ctx.currentTime - bgmStartAt)) % d;
}

function stopBgm() {
  if (!bgmSrc) return;
  bgmOffset = bgmPosition();
  try { bgmSrc.onended = null; bgmSrc.stop(); } catch { /* 已停 */ }
  bgmSrc = null;
}

function startBgm() {
  if (!ctx || muted || !bgmBuffer || bgmSrc) return;
  const d = bgmBuffer.duration || 1;
  bgmSrc = ctx.createBufferSource();
  bgmSrc.buffer = bgmBuffer;
  bgmSrc.loop = true;
  bgmSrc.connect(bgmBus);
  bgmSrc.start(0, bgmOffset % d);
  bgmStartAt = ctx.currentTime;
}

async function loadBgm() {
  if (typeof window === 'undefined') return;
  try {
    const res = await fetch('assets/audio/bgm.mp3');
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    const c = ac();
    if (!c) return;
    bgmBuffer = await c.decodeAudioData(buf);
    if (unlocked && !muted) startBgm();
  } catch { /* BGM 加载/解码失败 → 无 BGM，程序化音效照常 */ }
}
loadBgm();

export const audio = {
  unlock() {
    unlocked = true;
    ac();
    startBgm();
  },
  setMuted(m) {
    muted = !!m;
    if (muted) stopBgm();
    else if (unlocked) startBgm();
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  play() { noise(0.06, 0.1); tone(523, 0.06, 'triangle', 0.1); },
  draw() { noise(0.08, 0.08); tone(330, 0.06, 'triangle', 0.08); },
  special() { tone(784, 0.08, 'square', 0.1); tone(988, 0.1, 'square', 0.08, 0.05); },
  win() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
  lose() { tone(330, 0.18, 'sawtooth', 0.12); tone(220, 0.22, 'sawtooth', 0.12, 0.14); tone(147, 0.34, 'sawtooth', 0.12, 0.3); },
};
