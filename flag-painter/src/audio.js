// WebAudio 音效（程序化 tone）+ BGM 循环（assets/audio/bgm.mp3）。
// 接口不变：unlock / setMuted / muted / click / paint / correct / wrong / done。
// 首次交互解锁后 BGM 起播；静音掐断、取消静音从当前位置恢复；BGM 与 SFX 分轨音量。
let ctx = null;
let muted = false;

let sfxBus = null;
let bgmBus = null;

let bgmBuffer = null;
let bgmLoading = false;
let bgmSource = null;
let bgmOffset = 0;
let bgmStartedAt = 0;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      const master = ctx.createGain();
      master.gain.value = 0.9; // 峰值 ≤0.9
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = 0.9;
      sfxBus.connect(master);
      bgmBus = ctx.createGain();
      bgmBus.gain.value = 0.4;
      bgmBus.connect(master);
    }
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
  osc.connect(g); g.connect(sfxBus);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function bgmPosition() {
  if (!bgmSource || !bgmBuffer) return bgmOffset;
  const c = ac();
  return (c.currentTime - bgmStartedAt + bgmOffset) % bgmBuffer.duration;
}

function stopBgm() {
  if (!bgmSource) return;
  bgmOffset = bgmPosition();
  try { bgmSource.stop(); } catch { /* 已停止 */ }
  bgmSource.disconnect();
  bgmSource = null;
}

function startBgm() {
  const c = ac();
  if (!c || muted || !bgmBuffer || bgmSource) return;
  const src = c.createBufferSource();
  src.buffer = bgmBuffer;
  src.loop = true;
  src.connect(bgmBus);
  src.start(0, bgmBuffer.duration ? bgmOffset % bgmBuffer.duration : 0);
  bgmSource = src;
  bgmStartedAt = c.currentTime;
}

async function loadBgm() {
  if (bgmLoading || bgmBuffer) return;
  bgmLoading = true;
  try {
    const res = await fetch('assets/audio/bgm.mp3');
    if (!res.ok) return;
    const buf = await res.arrayBuffer();
    const c = ac();
    if (!c) return;
    bgmBuffer = await c.decodeAudioData(buf);
    startBgm();
  } catch {
    bgmBuffer = null; // 解码失败回退：无 BGM，音效照常。
  } finally {
    bgmLoading = false;
  }
}

export const audio = {
  unlock() { ac(); loadBgm(); startBgm(); },
  setMuted(m) {
    muted = !!m;
    if (muted) stopBgm(); else startBgm();
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  paint() { tone(440 + Math.random() * 60, 0.06, 'sine', 0.1); },
  correct() { tone(523, 0.1, 'sine', 0.15); tone(659, 0.1, 'sine', 0.15, 0.08); tone(784, 0.16, 'sine', 0.15, 0.16); },
  wrong() { tone(200, 0.14, 'sawtooth', 0.09); tone(150, 0.16, 'sawtooth', 0.08, 0.08); },
  done() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
};
