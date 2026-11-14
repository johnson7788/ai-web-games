// WebAudio：BGM 循环 + 程序化音效。首次交互解锁后起播，静音掐断、取消静音从当前位置恢复。
// audio.* 接口与调用点不变；BGM 素材缺失/解码失败时回退纯程序化（无 BGM，音效照常）。
let ctx = null;
let muted = false;
let master = null;
let sfxGain = null;
let bgmGain = null;

let bgmData = null;     // 已 fetch 的 ArrayBuffer（未解码）
let bgmBuffer = null;   // 已解码 AudioBuffer
let bgmSource = null;
let bgmOffset = 0;      // 当前循环位置（秒）
let bgmStartAt = 0;     // 起播时的 ctx.currentTime

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      master = ctx.createDynamicsCompressor();
      master.threshold.value = -12;
      master.knee.value = 20;
      master.ratio.value = 6;
      master.attack.value = 0.003;
      master.release.value = 0.25;
      const out = ctx.createGain();
      out.gain.value = 0.9; // 峰值 ≤0.9
      master.connect(out);
      out.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.9;
      sfxGain.connect(master);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.55;
      bgmGain.connect(master);
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
  osc.connect(g); g.connect(sfxGain);
  osc.start(t0); osc.stop(t0 + dur + 0.02);
}

function stopBgm() {
  if (!bgmSource || !ctx) return;
  try { bgmOffset = (bgmOffset + ctx.currentTime - bgmStartAt) % (bgmBuffer.duration || 1); } catch { bgmOffset = 0; }
  try { bgmSource.stop(); } catch { /* 已停 */ }
  bgmSource = null;
}

function startBgm() {
  if (muted || !ctx || !bgmBuffer || bgmSource) return;
  const src = ctx.createBufferSource();
  src.buffer = bgmBuffer;
  src.loop = true;
  src.connect(bgmGain);
  try {
    src.start(0, bgmOffset % bgmBuffer.duration);
  } catch {
    bgmOffset = 0;
    src.start(0, 0);
  }
  bgmSource = src;
  bgmStartAt = ctx.currentTime;
}

async function loadBgm() {
  if (bgmData || bgmBuffer) return;
  try {
    const res = await fetch('assets/audio/bgm.mp3');
    if (!res.ok) return;
    bgmData = await res.arrayBuffer();
  } catch {
    bgmData = null;
  }
}

async function decodeBgm() {
  if (!bgmData || bgmBuffer || !ctx) return;
  const c = ctx;
  try {
    bgmBuffer = await c.decodeAudioData(bgmData.slice(0));
    bgmData = null;
    startBgm();
  } catch {
    bgmBuffer = null;
  }
}

export const audio = {
  loadBgm() { loadBgm(); },
  unlock() {
    ac();
    if (bgmBuffer) startBgm();
    else if (bgmData) decodeBgm();
  },
  setMuted(m) {
    muted = !!m;
    if (muted) stopBgm();
    else startBgm();
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  place() { tone(440 + Math.random() * 40, 0.06, 'triangle', 0.1); },
  correct() { tone(523, 0.1, 'sine', 0.15); tone(659, 0.1, 'sine', 0.15, 0.08); tone(784, 0.16, 'sine', 0.15, 0.16); },
  wrong() { tone(180, 0.14, 'sawtooth', 0.09); },
  hint() { tone(880, 0.08, 'triangle', 0.1); },
  complete() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
};
