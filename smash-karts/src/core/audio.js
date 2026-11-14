// SMASH KARTS · M4 音频：纯 WebAudio 程序化 SFX + BGM(bgm.mp3)。
// 契约见 docs/smash-karts/brief-m4.md §3：unlock/setMuted/muted/event/update/setScene/duck/dispose/debugRender。
// 全部参数写成模块内常量；不读 localStorage（静音由 main 经 setMuted 传入）。

const MASTER_GAIN = 0.8;  // 总音量上限
const DUCK = 0.2;         // 暂停/广告时音量比例
const BGM_GAIN = 0.35;    // BGM 音量
const MAX_VOICES = 16;    // 同时发声上限，超出丢弃最旧
const MAX_SPEED = 300;    // 引擎频率映射参考极速

let ac = null;       // 实时 AudioContext
let master = null;   // 主音量 GainNode（MASTER_GAIN × duck）
let unlocked = false;
let muted = false;
let ducked = false;
let disposed = false;

const voices = [];   // 活跃发声 { stop, end }，按开始时间升序

let engine = null;   // 引擎持续音节点（首次 update 后惰性创建）
let bgm = null;      // BGM <audio> 元素（唯一外部音频）
let scene = 'title';

const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

// ---- 基础设施 -------------------------------------------------------------
function ctx() {
  if (disposed) return null;
  if (!ac) {
    const AC = (typeof window !== 'undefined') && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    ac = new AC();
    master = ac.createGain();
    master.gain.value = ducked ? MASTER_GAIN * DUCK : MASTER_GAIN;
    master.connect(ac.destination);
  }
  if (ac.state === 'suspended') { const p = ac.resume(); if (p && p.catch) p.catch(() => {}); }
  return ac;
}
function dest() { return master || (ac && ac.destination); }

// 振荡短音：f0→f1 滑音；快起音 + 指数衰减（可爱卡通「弹」的包络）。
function beep(c, d, t, { type = 'sine', f0, f1 = f0, dur, gain = 0.2, attack = 0.004 } = {}) {
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = type;
  o.frequency.setValueAtTime(Math.max(1, f0), t);
  if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(d);
  o.start(t); o.stop(t + dur + 0.05);
  return { stop: () => { try { o.stop(); } catch { /* noop */ } }, end: t + dur + 0.05 };
}

// 滤波噪声爆（霰弹/爆炸/漂移/岩浆）。
function noise(c, d, t, { dur, gain = 0.2, freq = 1500, type = 'lowpass', q = 0.8 } = {}) {
  const len = Math.max(1, Math.floor(c.sampleRate * dur));
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = type; f.frequency.value = freq; f.Q.value = q;
  const g = c.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f); f.connect(g); g.connect(d);
  src.start(t);
  return { stop: () => { try { src.stop(); } catch { /* noop */ } }, end: t + dur };
}

// ---- 音效表（每个返回发声记录数组；同时被 live play 与 debugRender 复用） ----
const SFX = {
  shotGun(c, d, t) { return [beep(c, d, t, { type: 'triangle', f0: 620, f1: 420, dur: 0.08, gain: 0.24 })]; },
  shotRapid(c, d, t) { return [beep(c, d, t, { type: 'triangle', f0: 760, f1: 560, dur: 0.05, gain: 0.2 })]; },
  shotShotgun(c, d, t) { return [
    noise(c, d, t, { dur: 0.14, gain: 0.3, freq: 1200, q: 0.6 }),
    beep(c, d, t, { type: 'sine', f0: 180, f1: 90, dur: 0.16, gain: 0.28 }),
  ]; },
  shotRocket(c, d, t) { return [
    beep(c, d, t, { type: 'sawtooth', f0: 400, f1: 80, dur: 0.3, gain: 0.2 }),
    noise(c, d, t, { dur: 0.35, gain: 0.18, freq: 600, q: 0.5 }),
  ]; },
  hit(c, d, t) { return [
    beep(c, d, t, { type: 'square', f0: 300, f1: 200, dur: 0.07, gain: 0.18 }),
    noise(c, d, t, { dur: 0.06, gain: 0.1, freq: 2500, q: 1 }),
  ]; },
  ko(c, d, t) { return [
    beep(c, d, t, { type: 'sine', f0: 520, f1: 433, dur: 0.16, gain: 0.2 }),
    beep(c, d, t + 0.1, { type: 'sine', f0: 433, f1: 350, dur: 0.22, gain: 0.18 }),
    noise(c, d, t, { dur: 0.32, gain: 0.24, freq: 800, q: 0.7 }),
    beep(c, d, t, { type: 'sine', f0: 400, dur: 0.09, gain: 0.08 }),   // 下行小三度 + formant「哇」
    beep(c, d, t, { type: 'sine', f0: 800, dur: 0.07, gain: 0.05 }),
  ]; },
  respawn(c, d, t) { return [beep(c, d, t, { type: 'sine', f0: 300, f1: 620, dur: 0.16, gain: 0.2 })]; },
  crate(c, d, t) { return [beep(c, d, t, { type: 'triangle', f0: 500, f1: 520, dur: 0.06, gain: 0.2 })]; },
  crateOpen(c, d, t) { return [
    beep(c, d, t, { type: 'triangle', f0: 660, f1: 880, dur: 0.1, gain: 0.18 }),
    beep(c, d, t + 0.08, { type: 'triangle', f0: 990, dur: 0.1, gain: 0.16 }),
  ]; },
  driftStart(c, d, t) { return [noise(c, d, t, { dur: 0.18, gain: 0.35, freq: 2000, type: 'bandpass', q: 0.4 })]; },
  boost(c, d, t) { return [
    noise(c, d, t, { dur: 0.26, gain: 0.3, freq: 2500, q: 0.6 }),
    beep(c, d, t, { type: 'sawtooth', f0: 200, f1: 520, dur: 0.2, gain: 0.12 }),
  ]; },
  ram(c, d, t) { return [
    beep(c, d, t, { type: 'sine', f0: 130, f1: 60, dur: 0.12, gain: 0.3 }),
    noise(c, d, t, { dur: 0.1, gain: 0.18, freq: 500, q: 0.8 }),
  ]; },
  wallBump(c, d, t) { return [beep(c, d, t, { type: 'sine', f0: 190, f1: 130, dur: 0.08, gain: 0.2 })]; },
  hazard(c, d, t) { return [noise(c, d, t, { dur: 0.35, gain: 0.22, freq: 3200, type: 'bandpass', q: 0.6 })]; },
  roundStart(c, d, t) { return [
    beep(c, d, t, { type: 'triangle', f0: 523, dur: 0.12, gain: 0.16 }),
    beep(c, d, t + 0.1, { type: 'triangle', f0: 659, dur: 0.16, gain: 0.16 }),
  ]; },
  roundWin(c, d, t) { return [
    beep(c, d, t, { type: 'triangle', f0: 523, dur: 0.12, gain: 0.16 }),
    beep(c, d, t + 0.1, { type: 'triangle', f0: 659, dur: 0.12, gain: 0.16 }),
    beep(c, d, t + 0.2, { type: 'triangle', f0: 784, dur: 0.2, gain: 0.16 }),
  ]; },
  roundLose(c, d, t) { return [
    beep(c, d, t, { type: 'sawtooth', f0: 330, f1: 220, dur: 0.2, gain: 0.15 }),
    beep(c, d, t + 0.16, { type: 'sawtooth', f0: 220, f1: 147, dur: 0.26, gain: 0.15 }),
  ]; },
  matchWin(c, d, t) { return [
    beep(c, d, t, { type: 'triangle', f0: 523, dur: 0.14, gain: 0.16 }),
    beep(c, d, t + 0.12, { type: 'triangle', f0: 659, dur: 0.14, gain: 0.16 }),
    beep(c, d, t + 0.24, { type: 'triangle', f0: 784, dur: 0.14, gain: 0.16 }),
    beep(c, d, t + 0.36, { type: 'triangle', f0: 1047, dur: 0.4, gain: 0.16 }),
  ]; },
  matchLose(c, d, t) { return [
    beep(c, d, t, { type: 'sawtooth', f0: 392, f1: 330, dur: 0.2, gain: 0.12 }),
    beep(c, d, t + 0.18, { type: 'sawtooth', f0: 330, f1: 262, dur: 0.24, gain: 0.12 }),
    beep(c, d, t + 0.4, { type: 'sawtooth', f0: 262, f1: 196, dur: 0.4, gain: 0.12 }),
  ]; },
  countBeep(c, d, t) { return [beep(c, d, t, { type: 'square', f0: 440, dur: 0.1, gain: 0.16 })]; },
  countGo(c, d, t) { return [beep(c, d, t, { type: 'square', f0: 880, dur: 0.26, gain: 0.18 })]; },
  upgrade(c, d, t) { return [
    beep(c, d, t, { type: 'triangle', f0: 784, f1: 1175, dur: 0.14, gain: 0.16 }),
    beep(c, d, t + 0.12, { type: 'triangle', f0: 1175, dur: 0.12, gain: 0.14 }),
  ]; },
};

// ---- 发声（带同时发声上限） ----------------------------------------------
function prune(now) { while (voices.length && voices[0].end <= now) voices.shift(); }
function play(name, opt = {}) {
  const c = ctx();
  if (!c || !unlocked || muted || disposed) return;
  const fn = SFX[name];
  if (!fn) return;
  const t = c.currentTime;
  prune(t);
  if (voices.length >= MAX_VOICES) voices.shift().stop(); // 丢弃最旧
  for (const v of fn(c, dest(), t, opt)) voices.push(v);
}

// ---- 引擎持续音（sawtooth+lowpass，90–260Hz 随速度；漂移叠 bandpass 噪声） ---
function ensureEngine(c) {
  if (engine) return;
  const g = c.createGain(); g.gain.value = 0; g.connect(dest());
  const osc = c.createOscillator(); osc.type = 'sawtooth'; osc.frequency.value = 90;
  const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
  osc.connect(lp); lp.connect(g); osc.start();

  const dg = c.createGain(); dg.gain.value = 0; dg.connect(dest());
  const len = Math.floor(c.sampleRate * 1);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
  const ns = c.createBufferSource(); ns.buffer = buf; ns.loop = true;
  const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1600; bp.Q.value = 1;
  ns.connect(bp); bp.connect(dg); ns.start();

  engine = { osc, g, dg };
}

function update(dt, hud) {
  const c = ctx();
  if (!c || disposed || !unlocked) return;
  ensureEngine(c);
  const p = (hud && hud.player) || {};
  const speed = Math.abs(p.speed || 0);
  const drift = !!(p.drift && (p.drift.active || p.drift.charge > 0));
  const boosting = !!(p.boosting || p.boostTime > 0);
  const t = clamp(speed / MAX_SPEED, 0, 1);
  let f = 90 + 170 * t;
  if (boosting) f *= 1.35; // 加速时频率瞬升
  const vol = (muted || ducked) ? 0 : (0.04 + 0.09 * t);
  engine.osc.frequency.setTargetAtTime(f, c.currentTime, 0.05);
  engine.g.gain.setTargetAtTime(vol, c.currentTime, 0.05);
  engine.dg.gain.setTargetAtTime((drift && !muted && !ducked) ? 0.06 : 0, c.currentTime, 0.04);
}

// ---- BGM ------------------------------------------------------------------
function ensureBgm() {
  if (bgm || typeof window === 'undefined' || typeof Audio === 'undefined') return;
  const el = new Audio('assets/audio/bgm.mp3');
  el.loop = true;
  el.preload = 'auto';
  bgm = el;
  bgmRate();
}
function bgmRate() {
  if (!bgm) return;
  const rates = { title: 0.96, end: 0.96, meadow: 1.0, candy: 1.02, lava: 1.05 };
  bgm.playbackRate = rates[scene] || 1.0;
  bgm.volume = BGM_GAIN * (ducked ? DUCK : 1);
}
let bgmTimer = 0;
function startBgm() {
  // 没解锁（无用户手势）/静音时不碰网络：避免首屏出现 aborted 的音频请求
  if (!unlocked || muted) return;
  // 延迟 1.5s 再加载/播放：避开「刚开局就刷新」这类会把音频请求打断的场景
  if (bgmTimer) return;
  bgmTimer = setTimeout(() => {
    bgmTimer = 0;
    if (!unlocked || muted) return;
    ensureBgm();
    if (!bgm) return;
    const p = bgm.play(); if (p && p.catch) p.catch(() => {});
  }, 1500);
}
function stopBgm() { if (bgmTimer) { clearTimeout(bgmTimer); bgmTimer = 0; } if (bgm) { try { bgm.pause(); } catch { /* noop */ } } }

// ---- 离线渲染（供 tools/audio-check.mjs 在无头浏览器里跑） ------------------
const RENDER_LIST = [
  ['shotGun', 0.15], ['shotRapid', 0.12], ['shotShotgun', 0.25], ['shotRocket', 0.4],
  ['hit', 0.15], ['ko', 0.45], ['respawn', 0.25], ['crate', 0.12], ['crateOpen', 0.28],
  ['driftStart', 0.2], ['boost', 0.32], ['ram', 0.25], ['wallBump', 0.15], ['hazard', 0.4],
  ['roundStart', 0.3], ['roundWin', 0.45], ['roundLose', 0.5], ['matchWin', 0.8], ['matchLose', 0.9],
  ['countBeep', 0.15], ['countGo', 0.3], ['upgrade', 0.3],
];

async function debugRender() {
  const sr = 44100;
  const out = [];
  for (const [name, dur] of RENDER_LIST) {
    const off = new OfflineAudioContext(1, Math.ceil(sr * dur), sr);
    const g = off.createGain();
    g.gain.value = MASTER_GAIN; // 镜像 live 总音量上限
    g.connect(off.destination);
    SFX[name](off, g, 0, {});
    const buf = await off.startRendering();
    const data = buf.getChannelData(0);
    let peak = 0, sum = 0;
    for (let i = 0; i < data.length; i += 1) { const a = Math.abs(data[i]); if (a > peak) peak = a; sum += a * a; }
    out.push({ name, peak, rms: Math.sqrt(sum / data.length) });
  }
  return out;
}

// ---- 公共契约 -------------------------------------------------------------
export const audio = {
  unlock() { ctx(); unlocked = true; startBgm(); },
  setMuted(m) { muted = !!m; if (muted) stopBgm(); else startBgm(); },
  get muted() { return muted; },
  event(ev) {
    if (!ev || !ev.type || disposed) return;
    switch (ev.type) {
      case 'shot': {
        const m = { gun: 'shotGun', rapid: 'shotRapid', shotgun: 'shotShotgun', rocket: 'shotRocket' };
        play(m[ev.weapon] || 'shotGun'); break;
      }
      case 'hit': play('hit'); break;
      case 'ko': play('ko'); break;
      case 'respawn': play('respawn'); break;
      case 'crate': play('crate'); break;
      case 'crateOpen': play('crateOpen'); break;
      case 'driftStart': play('driftStart'); break;
      case 'boost': play('boost'); break;
      case 'ram': play('ram'); break;
      case 'wallBump': play('wallBump'); break;
      case 'hazard': play('hazard'); break;
      case 'roundStart': play('roundStart'); break;
      case 'roundEnd': play(ev.playerWon ? 'roundWin' : 'roundLose'); break;
      case 'matchEnd': play(ev.winner === 'player' ? 'matchWin' : 'matchLose'); break;
      case 'countdown': play(ev.value === 0 ? 'countGo' : 'countBeep'); break;
      case 'upgrade': play('upgrade'); break;
      default: break;
    }
  },
  update,
  setScene(id) { scene = id || 'title'; bgmRate(); },
  duck(on) {
    ducked = !!on;
    if (master && ac) master.gain.setTargetAtTime(ducked ? MASTER_GAIN * DUCK : MASTER_GAIN, ac.currentTime, 0.02);
    if (engine && ac) {
      engine.g.gain.setTargetAtTime(0, ac.currentTime, 0.05);
      engine.dg.gain.setTargetAtTime(0, ac.currentTime, 0.05);
    }
    if (bgm) bgm.volume = BGM_GAIN * (ducked ? DUCK : 1);
  },
  playMusic() { startBgm(); },
  stopMusic() { stopBgm(); },
  dispose() {
    disposed = true;
    if (engine) { try { engine.osc.stop(); } catch { /* noop */ } engine = null; }
    stopBgm();
    if (bgm) { try { bgm.src = ''; } catch { /* noop */ } bgm = null; }
    if (ac) { try { ac.close(); } catch { /* noop */ } ac = null; master = null; }
    voices.length = 0;
  },
  debugRender,
};
