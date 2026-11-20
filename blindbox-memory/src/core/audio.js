// 音频：WebAudio 合成音效 + BGM（assets/audio/bgm.mp3，AI 生成，缺失时静默降级）
// 音频解锁挂在首次交互；音量/静音设置持久化。
import { save } from './save.js';

let ctx = null;
let bgmEl = null;
let muted = false;

function ensureCtx() {
  if (!ctx) {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { ctx = null; }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

/** 首次交互解锁（幂等，可反复挂） */
export function unlockAudio() {
  ensureCtx();
  if (bgmEl && bgmEl.paused && !muted) bgmEl.play().catch(() => {});
}

function tone(freq, dur, type = 'sine', gain = 0.15, when = 0, slideTo = null) {
  const c = ensureCtx();
  if (!c || muted) return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + dur);
  osc.connect(g).connect(c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise(dur = 0.08, gain = 0.1) {
  const c = ensureCtx();
  if (!c || muted) return;
  const len = Math.floor(c.sampleRate * dur);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  const g = c.createGain();
  g.gain.value = gain;
  src.buffer = buf;
  src.connect(g).connect(c.destination);
  src.start();
}

export const Audio = {
  get muted() { return muted; },

  init() {
    muted = save.get('muted', false);
    bgmEl = document.getElementById('bgm');
    if (bgmEl) {
      bgmEl.loop = true;
      bgmEl.volume = 0.55;
      bgmEl.muted = muted;
    }
  },

  startBgm() {
    if (bgmEl && !muted) bgmEl.play().catch(() => {});
  },

  stopBgm() {
    if (bgmEl) bgmEl.pause();
  },

  setMuted(m) {
    muted = m;
    save.set('muted', m);
    if (bgmEl) bgmEl.muted = m;
    if (!m) this.startBgm();
  },

  /** 事件音效 */
  event(name) {
    switch (name) {
      case 'flip': noise(0.05, 0.08); tone(660, 0.08, 'triangle', 0.08); break;
      case 'match':
        tone(523, 0.12, 'triangle', 0.14);
        tone(659, 0.12, 'triangle', 0.14, 0.09);
        tone(784, 0.16, 'triangle', 0.14, 0.18);
        break;
      case 'star':
        tone(784, 0.1, 'sine', 0.16);
        tone(988, 0.1, 'sine', 0.16, 0.08);
        tone(1319, 0.2, 'sine', 0.16, 0.16);
        break;
      case 'mismatch': tone(220, 0.2, 'sawtooth', 0.07, 0, 160); break;
      case 'obstacle': tone(140, 0.25, 'square', 0.08, 0, 90); noise(0.12, 0.1); break;
      case 'combo': tone(880, 0.08, 'square', 0.08); tone(1175, 0.12, 'square', 0.08, 0.06); break;
      case 'peek': tone(1046, 0.09, 'sine', 0.12); tone(1568, 0.12, 'sine', 0.1, 0.08); break;
      case 'shuffle': noise(0.3, 0.12); tone(300, 0.3, 'sine', 0.05, 0, 600); break;
      case 'coin': tone(1318, 0.06, 'square', 0.1); tone(1760, 0.1, 'square', 0.1, 0.05); break;
      case 'win':
        [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.18, 'triangle', 0.15, i * 0.12));
        break;
      case 'fail':
        [392, 330, 262].forEach((f, i) => tone(f, 0.22, 'sawtooth', 0.09, i * 0.14));
        break;
      case 'ui': tone(880, 0.05, 'triangle', 0.08); break;
      default: break;
    }
  },
};

export default Audio;
