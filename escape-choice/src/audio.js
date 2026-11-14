// WebAudio：循环 BGM（assets/audio/bgm.mp3）+ 程序化 SFX。
// 首次交互解锁后起播；静音掐断、取消静音从当前位置恢复；BGM/SFX 分轨，master 压限峰值 ≤0.9。
// 接口不变：unlock / setMuted / muted / click / choice / fail / win；BGM 缺失回退纯程序化音效。
let ctx = null;
let muted = false;
let unlocked = false;

let master = null;   // master gain → compressor → destination
let bgmGain = null;  // BGM 分轨
let sfxGain = null;  // SFX 分轨

let bgmBuffer = null;    // 解码后的 BGM AudioBuffer
let bgmLoading = null;   // 加载 promise（去重）
let bgmSource = null;    // 当前播放 source
let bgmStartedAt = 0;    // 当前 source 的 ctx.currentTime 起点
let bgmOffset = 0;       // 下次 resume 的缓冲内偏移（秒）

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.9;
      const comp = ctx.createDynamicsCompressor();
      master.connect(comp);
      comp.connect(ctx.destination);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.3; // BGM 背景化，给 slapstick 音效留头空间
      bgmGain.connect(master);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 1.0;
      sfxGain.connect(master);
      loadBgm();
    }
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function loadBgm() {
  if (bgmLoading) return bgmLoading;
  bgmLoading = (async () => {
    try {
      const res = await fetch('assets/audio/bgm.mp3');
      if (!res.ok) throw new Error(`http ${res.status}`);
      const ab = await res.arrayBuffer();
      bgmBuffer = await ctx.decodeAudioData(ab);
    } catch {
      bgmBuffer = null; // 回退：无 BGM，程序化 SFX 仍在
    }
    syncBgm();
  })();
  return bgmLoading;
}

function startBgm() {
  if (!ctx || !bgmBuffer || muted) return;
  stopBgmSource();
  const off = bgmOffset % bgmBuffer.duration;
  bgmSource = ctx.createBufferSource();
  bgmSource.buffer = bgmBuffer;
  bgmSource.loop = true;
  bgmSource.connect(bgmGain);
  bgmSource.start(0, off);
  bgmStartedAt = ctx.currentTime;
  bgmOffset = off;
}

function stopBgmSource() {
  if (!bgmSource) return;
  if (bgmBuffer && bgmBuffer.duration) {
    bgmOffset = (bgmOffset + Math.max(0, ctx.currentTime - bgmStartedAt)) % bgmBuffer.duration;
  }
  try { bgmSource.stop(); } catch { /* 已停 */ }
  try { bgmSource.disconnect(); } catch { /* noop */ }
  bgmSource = null;
}

function syncBgm() {
  if (!ctx || !bgmBuffer) return;
  if (muted || !unlocked) stopBgmSource();
  else if (!bgmSource) startBgm();
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
  osc.connect(g);
  g.connect(sfxGain || c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

export const audio = {
  unlock() {
    ac();
    unlocked = true;
    syncBgm();
  },
  setMuted(m) {
    muted = !!m;
    if (muted) stopBgmSource();
    else syncBgm();
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.07); },
  choice() { tone(440, 0.06, 'triangle', 0.1); tone(587, 0.07, 'triangle', 0.08, 0.04); },
  fail() { tone(330, 0.16, 'sawtooth', 0.12); tone(220, 0.2, 'sawtooth', 0.1, 0.1); tone(147, 0.3, 'sawtooth', 0.1, 0.22); },
  win() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
};
