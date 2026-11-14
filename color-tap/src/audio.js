// WebAudio：BGM 采样循环（首次交互解锁）+ 程序化 SFX（缺失回退 tone 合成）。
let ctx = null;
let muted = false;
let unlocked = false;

// 总线：BGM/SFX 分轨 → master → DynamicsCompressor → destination
let master = null;
let comp = null;
let bgmGain = null;
let sfxGain = null;

// BGM
const BGM_URL = 'assets/audio/bgm.mp3';
let bgmBuffer = null;
let bgmLoading = false;
let bgmSource = null;
let bgmOffset = 0; // 循环内当前位置（静音掐断后从这里恢复）
let bgmStartAt = 0;

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) ctx = new AC();
  }
  if (ctx && ctx.state === 'suspended') ctx.resume();
  if (ctx && !master) initGraph();
  return ctx;
}

function initGraph() {
  master = ctx.createGain();
  master.gain.value = 0.9; // 峰值安全线
  comp = ctx.createDynamicsCompressor();
  bgmGain = ctx.createGain();
  bgmGain.gain.value = 0.45;
  sfxGain = ctx.createGain();
  sfxGain.gain.value = 0.7;
  bgmGain.connect(master);
  sfxGain.connect(master);
  master.connect(comp);
  comp.connect(ctx.destination);
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

async function loadBgm() {
  if (bgmBuffer || bgmLoading) return;
  bgmLoading = true;
  try {
    const resp = await fetch(BGM_URL);
    if (!resp.ok) throw new Error(`http ${resp.status}`);
    const buf = await resp.arrayBuffer();
    bgmBuffer = await ac().decodeAudioData(buf);
  } catch {
    bgmBuffer = null; // 缺失/解码失败：BGM 静默，不报错
  } finally {
    bgmLoading = false;
  }
}

function startBgm() {
  const c = ac();
  if (!c || !unlocked || muted || !bgmBuffer || bgmSource) return;
  const src = c.createBufferSource();
  src.buffer = bgmBuffer;
  src.loop = true;
  src.connect(bgmGain || c.destination);
  src.start(0, bgmOffset % bgmBuffer.duration);
  bgmSource = src;
  bgmStartAt = c.currentTime;
}

function stopBgm() {
  if (!bgmSource) return;
  const c = ac();
  if (c && bgmBuffer) {
    bgmOffset = (bgmOffset + (c.currentTime - bgmStartAt)) % bgmBuffer.duration;
  }
  try { bgmSource.stop(); } catch { /* 已停止 */ }
  bgmSource = null;
}

export const audio = {
  async unlock() {
    const c = ac();
    if (c && c.state === 'suspended') { try { await c.resume(); } catch { /* noop */ } }
    unlocked = true;
    await loadBgm();
    startBgm();
  },
  setMuted(m) {
    muted = !!m;
    if (muted) stopBgm();
    else startBgm();
  },
  get muted() { return muted; },
  click() { tone(660, 0.05, 'square', 0.06); },
  select() { tone(523, 0.05, 'triangle', 0.08); },
  fill(step = 0) { tone(440 + (step % 8) * 40, 0.07, 'sine', 0.12); },
  wrong() { tone(180, 0.12, 'sawtooth', 0.08); },
  complete() { tone(523, 0.12, 'sine', 0.16); tone(659, 0.12, 'sine', 0.16, 0.1); tone(784, 0.12, 'sine', 0.16, 0.2); tone(1047, 0.24, 'sine', 0.16, 0.3); },
};
