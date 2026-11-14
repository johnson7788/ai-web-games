// WebAudio：程序化音效 + BGM 循环（首次交互解锁，无外部音频文件依赖）。
// 接口不变：unlock / setMuted / muted 及全部方法名与调用点；BGM 缺失回退纯程序化。
let ctx = null;
let muted = false;

// BGM 状态
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_VOL = 0.5;
const SFX_VOL = 0.85;
let bgmArrayBuf = null;
let bgmBuffer = null;
let bgmSource = null;
let bgmGain = null;
let sfxGain = null;
let bgmStarted = false;
let bgmStartedAt = 0;
let bgmOffset = 0;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -18;
      master.knee.value = 20;
      master.ratio.value = 6;
      master.attack.value = 0.003;
      master.release.value = 0.25;
      const out = ctx.createGain();
      out.gain.value = 0.9; // 峰值 ≤ 0.9
      master.connect(out);
      out.connect(ctx.destination);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = SFX_VOL;
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
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g); g.connect(sfxGain || c.destination);
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
  f.frequency.value = 1200;
  src.connect(f); f.connect(g); g.connect(sfxGain || c.destination);
  src.start(t0);
}

// ---- BGM：fetch 在模块加载时发起，decode 延后到首次交互（避免手势前建 AudioContext）----
function loadBgm() {
  if (typeof fetch === 'undefined') return;
  fetch(BGM_URL)
    .then((r) => (r && r.ok ? r.arrayBuffer() : null))
    .then((buf) => { bgmArrayBuf = buf; if (bgmStarted) ensureBgm(); })
    .catch(() => { bgmArrayBuf = null; });
}

function startBgmNow() {
  const c = ac();
  if (!c || !bgmBuffer || muted || bgmSource) return;
  const src = c.createBufferSource();
  src.buffer = bgmBuffer;
  src.loop = true;
  src.connect(bgmGain);
  src.start(0, bgmOffset % bgmBuffer.duration);
  bgmSource = src;
  bgmStartedAt = c.currentTime - (bgmOffset % bgmBuffer.duration);
}

function stopBgm() {
  if (!bgmSource) return;
  const c = ac();
  if (c && bgmBuffer) bgmOffset = (c.currentTime - bgmStartedAt) % bgmBuffer.duration;
  try { bgmSource.stop(); } catch { /* 已停 */ }
  bgmSource = null;
}

async function ensureBgm() {
  if (!bgmArrayBuf || bgmBuffer) return;
  const c = ac();
  if (!c) return;
  try {
    bgmBuffer = await c.decodeAudioData(bgmArrayBuf.slice(0));
    startBgmNow();
  } catch { bgmBuffer = null; }
}

export const audio = {
  unlock() {
    ac();
    if (!bgmStarted) { bgmStarted = true; ensureBgm(); }
  },
  setMuted(m) {
    muted = !!m;
    if (muted) stopBgm();
    else if (bgmStarted) startBgmNow();
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  dig() { noise(0.06, 0.1); tone(180 + Math.random() * 40, 0.06, 'sine', 0.1); },
  buy() { tone(523, 0.07, 'triangle', 0.12); tone(784, 0.09, 'triangle', 0.1, 0.05); },
  deny() { tone(160, 0.1, 'sawtooth', 0.07); },
  layer() { tone(523, 0.1, 'sine', 0.14); tone(659, 0.1, 'sine', 0.14, 0.08); tone(784, 0.16, 'sine', 0.14, 0.16); },
};

loadBgm();
