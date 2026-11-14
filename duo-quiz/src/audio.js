// WebAudio：循环 BGM（assets/audio/bgm.mp3 解码为 AudioBuffer）+ 程序化 SFX。
// 接口与静音逻辑不变：unlock / setMuted / muted / click / lock / correct / wrong / win。
// 首次交互解锁后起播 BGM；静音 suspend 掐断，取消静音 resume 从当前位置恢复。
// BGM / SFX 分轨增益 → master DynamicsCompressor → destination（峰值 ≤0.9）。
let ctx = null;
let muted = false;
let master = null;
let sfxGain = null;
let bgmGain = null;

let bgmPromise = null;   // Promise<ArrayBuffer|null>
let bgmBuffer = null;    // AudioBuffer
let bgmStarted = false;

const BGM_URL = 'assets/audio/bgm.mp3';

function buildGraph(c) {
  master = c.createDynamicsCompressor();
  master.threshold.value = -12;
  master.knee.value = 20;
  master.ratio.value = 6;
  master.attack.value = 0.003;
  master.release.value = 0.25;
  master.connect(c.destination);

  sfxGain = c.createGain();
  sfxGain.gain.value = 0.85;
  sfxGain.connect(master);

  bgmGain = c.createGain();
  bgmGain.gain.value = 0.45;
  bgmGain.connect(master);
}

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      buildGraph(ctx);
    }
  }
  if (ctx && ctx.state === 'suspended' && !muted) ctx.resume();
  return ctx;
}

function ensureBgmData() {
  if (!bgmPromise) {
    bgmPromise = fetch(BGM_URL)
      .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(`bgm ${r.status}`))))
      .catch(() => null);
  }
  return bgmPromise;
}

function startBgm() {
  if (!ctx || !bgmBuffer || bgmStarted) return;
  bgmStarted = true;
  const src = ctx.createBufferSource();
  src.buffer = bgmBuffer;
  src.loop = true;
  src.connect(bgmGain);
  src.start(0);
}

// BGM 就绪即起播（静音时不播）；加载失败静默降级为纯 SFX。
export async function startBgmIfPossible() {
  if (muted || !ctx || bgmStarted) return;
  const data = await ensureBgmData();
  if (!data || muted || bgmStarted) return;
  try {
    if (!bgmBuffer) bgmBuffer = await ctx.decodeAudioData(data.slice(0));
  } catch {
    bgmBuffer = null;
    return;
  }
  if (!muted && !bgmStarted) startBgm();
}

function tone(freq, dur, type = 'sine', gain = 0.16, when = 0) {
  if (muted) return;
  const c = ac();
  if (!c || !sfxGain) return;
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

export const audio = {
  unlock() {
    const c = ac();
    if (!c) return;
    startBgmIfPossible();
  },
  setMuted(m) {
    muted = !!m;
    if (ctx) {
      if (muted) ctx.suspend();
      else {
        ctx.resume();
        startBgmIfPossible();
      }
    }
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  lock() { tone(440, 0.06, 'triangle', 0.1); },
  correct() { tone(660, 0.08, 'sine', 0.14); tone(880, 0.1, 'sine', 0.12, 0.06); },
  wrong() { tone(180, 0.14, 'sawtooth', 0.09); },
  win() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
};
