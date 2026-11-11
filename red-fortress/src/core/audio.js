// 赤色要塞 · 程序化音频（SFX + 每关音乐）。纯 WebAudio 合成，零音频文件。
// main 只依赖：init / unlock / event / setScene / setMuted / setVolumes / ready / currentScene。
import { Music, MUSIC_SCENES, scoreFor, scheduleScore, tone, noise } from './music.js';

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let music = null;

let muted = false;
let ducked = false;
let volumes = { music: 0.7, sfx: 1 };
let currentScene = 'none';
let gains = { master: 1, music: 0.7, sfx: 1 };

const lastSfx = new Map();
const explodeTimes = [];

function ensureCtx() {
  if (ctx) return;
  if (typeof window === 'undefined' || !window.AudioContext) return;
  ctx = new window.AudioContext();
  master = ctx.createGain();
  sfxBus = ctx.createGain();
  musicBus = ctx.createGain();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -10;
  comp.knee.value = 20;
  comp.ratio.value = 8;
  comp.attack.value = 0.003;
  comp.release.value = 0.25;
  sfxBus.connect(master);
  musicBus.connect(master);
  master.connect(comp);
  const headroom = ctx.createGain();
  headroom.gain.value = 0.7; // 总峰值余量，防削波
  comp.connect(headroom);
  headroom.connect(ctx.destination);
  music = new Music(ctx, musicBus);
  applyGains();
  if (currentScene !== 'none') music.setScene(currentScene);
  try { if (ctx.state === 'suspended') ctx.resume(); } catch { /* 忽略 */ }
}

function applyGains() {
  if (!ctx) return;
  gains = {
    master: muted ? 0 : 1,
    music: muted ? 0 : volumes.music * (ducked ? 0.3 : 1),
    sfx: muted ? 0 : volumes.sfx,
  };
  const t = ctx.currentTime;
  master.gain.setValueAtTime(gains.master, t);
  musicBus.gain.setValueAtTime(gains.music, t);
  sfxBus.gain.setValueAtTime(gains.sfx, t);
}

function throttle(key, min) {
  const t = ctx.currentTime;
  const prev = lastSfx.get(key) || -1e9;
  if (t - prev < min) return false;
  lastSfx.set(key, t);
  return true;
}

function throttleExplode() {
  const t = ctx.currentTime;
  while (explodeTimes.length && t - explodeTimes[0] > 0.6) explodeTimes.shift();
  if (explodeTimes.length >= 4) return false;
  explodeTimes.push(t);
  return true;
}

function playSfx(name) {
  if (!ctx) return;
  const fn = SFX[name];
  if (!fn) return;
  fn(ctx, sfxBus, ctx.currentTime + 0.01);
}

// ---------- SFX（每个函数 (ctx, out, t0)，可离线渲染） ----------

const SFX = {
  shot_mg(c, o, t) {
    noise(c, o, { t0: t, dur: 0.05, gain: 0.22, filterType: 'bandpass', freq: 2600, q: 1.1 });
    tone(c, o, { t0: t, freq: 1300, dur: 0.03, type: 'square', gain: 0.12 });
  },
  shot_grenade(c, o, t) {
    noise(c, o, { t0: t, dur: 0.28, gain: 0.2, filterType: 'bandpass', freq: 600, freqEnd: 3200, q: 1 });
  },
  shot_tank(c, o, t) {
    tone(c, o, { t0: t, freq: 70, dur: 0.3, type: 'sine', gain: 0.5, glide: 32 });
    noise(c, o, { t0: t, dur: 0.3, gain: 0.3, filterType: 'lowpass', freq: 200 });
  },
  shot_cannon(c, o, t) { SFX.shot_tank(c, o, t); },
  shot_rocket(c, o, t) {
    noise(c, o, { t0: t, dur: 0.45, gain: 0.18, filterType: 'highpass', freq: 1200, freqEnd: 5200 });
    tone(c, o, { t0: t, freq: 90, dur: 0.4, type: 'sine', gain: 0.2 });
  },
  explode_small(c, o, t) {
    tone(c, o, { t0: t, freq: 90, dur: 0.4, type: 'sine', gain: 0.5, glide: 40 });
    noise(c, o, { t0: t, dur: 0.45, gain: 0.4, filterType: 'lowpass', freq: 400 });
  },
  explode_big(c, o, t) {
    tone(c, o, { t0: t, freq: 70, dur: 0.7, type: 'sine', gain: 0.55, glide: 28 });
    noise(c, o, { t0: t, dur: 0.8, gain: 0.45, filterType: 'lowpass', freq: 260 });
  },
  explode_huge(c, o, t) {
    tone(c, o, { t0: t, freq: 50, dur: 1.2, type: 'sine', gain: 0.6, glide: 22 });
    noise(c, o, { t0: t, dur: 1.3, gain: 0.5, filterType: 'lowpass', freq: 180 });
    tone(c, o, { t0: t + 0.05, freq: 45, dur: 1.1, type: 'triangle', gain: 0.4, glide: 20 });
  },
  hit(c, o, t) {
    tone(c, o, { t0: t, freq: 2600, dur: 0.045, type: 'square', gain: 0.2, glide: 1800 });
  },
  kill(c, o, t) {
    tone(c, o, { t0: t, freq: 520, dur: 0.08, type: 'square', gain: 0.25, glide: 200 });
    tone(c, o, { t0: t + 0.05, freq: 1400, dur: 0.1, type: 'square', gain: 0.18, glide: 2400 });
  },
  playerHit(c, o, t) {
    tone(c, o, { t0: t, freq: 240, dur: 0.25, type: 'sawtooth', gain: 0.32, glide: 90 });
    noise(c, o, { t0: t, dur: 0.2, gain: 0.28, filterType: 'highpass', freq: 3200 });
  },
  playerDead(c, o, t) {
    tone(c, o, { t0: t, freq: 520, dur: 0.6, type: 'sawtooth', gain: 0.3, glide: 60 });
    SFX.explode_big(c, o, t + 0.35);
  },
  powPickup(c, o, t) {
    tone(c, o, { t0: t, freq: 880, dur: 0.09, type: 'square', gain: 0.2 });
    tone(c, o, { t0: t + 0.09, freq: 1320, dur: 0.12, type: 'square', gain: 0.2 });
  },
  deliver(c, o, t) {
    [660, 880, 1320].forEach((f, i) => tone(c, o, { t0: t + i * 0.08, freq: f, dur: 0.12, type: 'square', gain: 0.2 }));
  },
  deliverMilestone(c, o, t) {
    [523, 659, 784, 1047].forEach((f, i) => tone(c, o, { t0: t + i * 0.09, freq: f, dur: 0.16, type: 'square', gain: 0.22 }));
  },
  airstrike(c, o, t) {
    tone(c, o, { t0: t, freq: 600, dur: 0.35, type: 'sawtooth', gain: 0.22, glide: 1200 });
    tone(c, o, { t0: t + 0.35, freq: 1200, dur: 0.35, type: 'sawtooth', gain: 0.22, glide: 600 });
    noise(c, o, { t0: t, dur: 0.9, gain: 0.18, filterType: 'lowpass', freq: 150 });
  },
  heliIn(c, o, t) {
    for (let i = 0; i < 8; i++) noise(c, o, { t0: t + i * 0.07, dur: 0.08, gain: 0.34, filterType: 'lowpass', freq: 260 });
  },
  bossAwake(c, o, t) {
    tone(c, o, { t0: t, freq: 110, dur: 0.5, type: 'sawtooth', gain: 0.3, glide: 70 });
    tone(c, o, { t0: t + 0.55, freq: 110, dur: 0.5, type: 'sawtooth', gain: 0.3, glide: 70 });
  },
  bossNodeDown(c, o, t) {
    tone(c, o, { t0: t, freq: 70, dur: 0.5, type: 'sine', gain: 0.5, glide: 30 });
    tone(c, o, { t0: t + 0.05, freq: 400, dur: 0.5, type: 'sawtooth', gain: 0.25, glide: 60 });
  },
  bossDead(c, o, t) {
    tone(c, o, { t0: t, freq: 45, dur: 1.4, type: 'sine', gain: 0.6, glide: 18 });
    noise(c, o, { t0: t, dur: 1.5, gain: 0.5, filterType: 'lowpass', freq: 140 });
    tone(c, o, { t0: t + 0.6, freq: 30, dur: 1.2, type: 'triangle', gain: 0.4, glide: 12 });
  },
  stageClear(c, o, t) {
    [523, 659, 784, 1047, 1319].forEach((f, i) => tone(c, o, { t0: t + i * 0.11, freq: f, dur: 0.2, type: 'square', gain: 0.24 }));
  },
  shock(c, o, t) {
    tone(c, o, { t0: t, freq: 80, dur: 0.25, type: 'sine', gain: 0.4, glide: 50 });
  },
  ui(c, o, t) {
    tone(c, o, { t0: t, freq: 1800, dur: 0.03, type: 'square', gain: 0.15 });
  },
  powDown(c, o, t) {
    tone(c, o, { t0: t, freq: 700, dur: 0.12, type: 'square', gain: 0.18, glide: 300 });
    tone(c, o, { t0: t + 0.12, freq: 350, dur: 0.16, type: 'square', gain: 0.16, glide: 150 });
  },
};

// ---------- 离线渲染（供 audio-check 验收） ----------

async function renderSceneRMS(name) {
  if (typeof window === 'undefined' || !window.OfflineAudioContext) return { rms: 0, peak: 0 };
  const score = scoreFor(name);
  if (!score) return { rms: 0, peak: 0 };
  const sr = 44100;
  const dur = score.loopDur + 0.3;
  const off = new window.OfflineAudioContext(2, Math.max(1, Math.ceil(sr * dur)), sr);
  const comp = off.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 20; comp.ratio.value = 8;
  comp.attack.value = 0.003; comp.release.value = 0.25;
  scheduleScore(off, comp, score, 0.05);
  const headroom = off.createGain();
  headroom.gain.value = 0.7;
  comp.connect(headroom);
  headroom.connect(off.destination);
  return measure(await off.startRendering());
}

async function renderSfxRMS(name) {
  if (typeof window === 'undefined' || !window.OfflineAudioContext) return { rms: 0, peak: 0 };
  const fn = SFX[name];
  if (!fn) return { rms: 0, peak: 0 };
  const sr = 44100;
  const dur = 1.6;
  const off = new window.OfflineAudioContext(2, Math.ceil(sr * dur), sr);
  const comp = off.createDynamicsCompressor();
  comp.threshold.value = -10; comp.knee.value = 20; comp.ratio.value = 8;
  comp.attack.value = 0.003; comp.release.value = 0.25;
  fn(off, comp, 0.05);
  const headroom = off.createGain();
  headroom.gain.value = 0.7;
  comp.connect(headroom);
  headroom.connect(off.destination);
  return measure(await off.startRendering());
}

function measure(buf) {
  let sum = 0;
  let peak = 0;
  let n = 0;
  for (let ch = 0; ch < buf.numberOfChannels; ch++) {
    const d = buf.getChannelData(ch);
    for (let i = 0; i < d.length; i++) {
      const v = d[i];
      sum += v * v;
      const a = Math.abs(v);
      if (a > peak) peak = a;
    }
    n += d.length;
  }
  return { rms: n ? Math.sqrt(sum / n) : 0, peak };
}

// ---------- 对外契约 ----------

export const audio = {
  get ready() { return !!ctx; },
  get currentScene() { return currentScene; },

  init() { ensureCtx(); },

  unlock() {
    ensureCtx();
    if (ctx && ctx.state === 'suspended') {
      try { ctx.resume(); } catch { /* 忽略 */ }
    }
  },

  event(ev) {
    if (!ev || !ev.type || !ctx) return; // 未知/无上下文：静默忽略
    switch (ev.type) {
      case 'shot':
        if (ev.weapon === 'mg') { if (throttle('mg', 0.04)) playSfx('shot_mg'); }
        else if (ev.weapon === 'grenade') playSfx('shot_grenade');
        else if (ev.weapon === 'tank' || ev.weapon === 'cannon') playSfx('shot_tank');
        else if (ev.weapon === 'rocket') playSfx('shot_rocket');
        break;
      case 'explode':
        if (ev.kind === 'grenade') { if (throttleExplode()) playSfx('explode_small'); }
        else if (ev.kind === 'tank' || ev.kind === 'mine') { if (throttleExplode()) playSfx('explode_big'); }
        else if (ev.kind === 'boss' || ev.kind === 'airstrike') { if (throttleExplode()) playSfx('explode_huge'); }
        break;
      case 'hit': playSfx('hit'); break;
      case 'kill': playSfx('kill'); break;
      case 'playerHit': playSfx('playerHit'); break;
      case 'playerDead': playSfx('playerDead'); break;
      case 'powPickup': playSfx('powPickup'); break;
      case 'powDown': playSfx('powDown'); break;
      case 'deliver': playSfx('deliver'); break;
      case 'deliverMilestone': playSfx('deliverMilestone'); break;
      case 'airstrike': playSfx('airstrike'); break;
      case 'heliIn': playSfx('heliIn'); break;
      case 'bossAwake': playSfx('bossAwake'); break;
      case 'bossNodeDown': playSfx('bossNodeDown'); break;
      case 'bossDead': playSfx('bossDead'); break;
      case 'stageClear': playSfx('stageClear'); break;
      case 'shock': playSfx('shock'); break;
      case 'ui': playSfx('ui'); break;
      default: break;
    }
  },

  setScene(name) {
    currentScene = MUSIC_SCENES.includes(name) ? name : 'none';
    if (music) music.setScene(currentScene);
  },

  setMuted(b) { muted = !!b; applyGains(); },

  setVolumes(v) {
    if (v && typeof v === 'object') {
      if (typeof v.music === 'number') volumes.music = Math.max(0, Math.min(1, v.music));
      if (typeof v.sfx === 'number') volumes.sfx = Math.max(0, Math.min(1, v.sfx));
    }
    applyGains();
  },

  debug: {
    get sceneKeys() { return [...MUSIC_SCENES]; },
    get sfxKeys() { return Object.keys(SFX); },
    rmsFor(key) {
      if (MUSIC_SCENES.includes(key)) return renderSceneRMS(key);
      if (SFX[key]) return renderSfxRMS(key);
      return Promise.resolve({ rms: 0, peak: 0 });
    },
    state() { return { ready: !!ctx, currentScene, muted, ducked, volumes: { ...volumes } }; },
    gains() { return ctx ? { ...gains } : null; },
    activeVoices() { return music ? music.activeVoices : 0; },
  },
};

// 页面隐藏时把音乐降到 30%（音量/静音不中断调度）
if (typeof document !== 'undefined' && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    ducked = document.hidden;
    applyGains();
  });
}
