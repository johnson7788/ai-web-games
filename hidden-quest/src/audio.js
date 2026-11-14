// 程序化 WebAudio 音效 + AI BGM（首次交互解锁循环；静音掐断、取消静音续播）。
// 接口名与全部调用点不变；BGM 解码失败回退为纯程序化（仅 SFX），游戏不报错。
let ctx = null;
let muted = false;
let userUnlocked = false;

// 分轨：BGM / SFX 各自音量，进 DynamicsCompressor，最终限幅 0.9。
let outGain = null;
let sfxGain = null;
let bgmGain = null;

// BGM 状态
let bgmBytes = null;      // 已抓取的原始字节
let bgmBuf = null;        // 解码后的 AudioBuffer
let bgmSource = null;     // 当前循环源
let bgmOffset = 0;        // 循环内偏移（秒）
let bgmStartedAt = null;  // ctx.currentTime 锚点
let bgmDecoding = false;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) {
      ctx = new AC();
      const master = ctx.createDynamicsCompressor();
      master.threshold.value = -12;
      master.knee.value = 24;
      master.ratio.value = 12;
      master.attack.value = 0.003;
      master.release.value = 0.25;
      outGain = ctx.createGain();
      outGain.gain.value = 0.9;
      master.connect(outGain);
      outGain.connect(ctx.destination);
      bgmGain = ctx.createGain();
      bgmGain.gain.value = 0.5;
      bgmGain.connect(master);
      sfxGain = ctx.createGain();
      sfxGain.gain.value = 0.9;
      sfxGain.connect(master);
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
  osc.connect(g);
  g.connect(sfxGain || c.destination);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

// ---- BGM ----
function bgmPosition() {
  const c = ctx;
  if (!c || !bgmBuf) return 0;
  if (bgmSource && bgmStartedAt != null) {
    return (bgmOffset + (c.currentTime - bgmStartedAt)) % bgmBuf.duration;
  }
  return bgmOffset % bgmBuf.duration;
}

function stopBgm() {
  if (bgmSource) {
    try { bgmSource.stop(); } catch { /* 已停 */ }
    try { bgmSource.disconnect(); } catch { /* noop */ }
    bgmSource = null;
  }
  bgmStartedAt = null;
}

function playBgm(from) {
  const c = ac();
  if (!c || !bgmBuf || muted) return;
  stopBgm();
  bgmSource = c.createBufferSource();
  bgmSource.buffer = bgmBuf;
  bgmSource.loop = true;
  bgmSource.connect(bgmGain);
  bgmOffset = from % bgmBuf.duration;
  bgmStartedAt = c.currentTime;
  bgmSource.start(0, bgmOffset);
}

function tryStartBgm() {
  if (!userUnlocked || muted || bgmSource || !bgmBytes) return;
  const c = ac();
  if (!c) return;
  if (bgmBuf) { playBgm(bgmOffset); return; }
  if (bgmDecoding) return;
  bgmDecoding = true;
  c.decodeAudioData(bgmBytes.slice(0))
    .then((buf) => { bgmBuf = buf; tryStartBgm(); })
    .catch(() => { bgmBytes = null; })
    .finally(() => { bgmDecoding = false; });
}

function loadBgm() {
  fetch('assets/audio/bgm.mp3')
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error('bgm http'))))
    .then((buf) => { bgmBytes = buf; tryStartBgm(); })
    .catch(() => { bgmBytes = null; });
}
loadBgm();

export const audio = {
  unlock() {
    userUnlocked = true;
    ac();
    tryStartBgm();
  },
  setMuted(m) {
    muted = !!m;
    if (muted) {
      bgmOffset = bgmPosition();
      stopBgm();
    } else {
      tryStartBgm();
    }
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  find() { tone(660, 0.08, 'sine', 0.14); tone(880, 0.1, 'sine', 0.12, 0.06); },
  wrong() { tone(180, 0.12, 'sawtooth', 0.08); },
  hint() { tone(880, 0.08, 'triangle', 0.1); tone(1175, 0.1, 'triangle', 0.08, 0.05); },
  clear() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
};
