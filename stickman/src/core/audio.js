// 程序化音频 —— 零素材：所有音效/音乐用振荡器 + 噪声 + 滤波器 + 包络实时合成。
// 契约（README §6.3）：window.G.Audio = { init, unlock, event, play, setScene, setIntensity, setVolumes, getState }。
// 任何调用在 AudioContext 未创建（init 前）或浏览器不支持 WebAudio 时静默降级，不抛异常。
import { CONFIG } from '../../config/game.config.js';
import { MusicEngine } from './music.js';

const hasWebAudio = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);

// —— 模块级状态（避免 this 依赖）——
let ctx = null;
let master = null;
let musicGain = null;
let sfxGain = null;
let comp = null;
let analyser = null;
let analyserBuf = null;
let noiseBuf = null;
let engine = null;

let ready = false;
let scene = null;
let intensity = 0;
let ducked = false;
let muted = false;
let voices = 0;
let comboChain = 0;
let duckBound = false;

const vol = { music: CONFIG.audio.music, sfx: CONFIG.audio.sfx };
const lastPlayed = new Map();

const clamp01 = (v) => Math.max(0, Math.min(1, v));

function makeNoise() {
  if (!noiseBuf) {
    noiseBuf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return noiseBuf;
}

function countVoice(node) {
  voices += 1;
  node.addEventListener('ended', () => { voices = Math.max(0, voices - 1); });
}

// 振荡器单音（带可选滤波、下滑）。
function tone({ type = 'sine', f = 440, t = ctx.currentTime, dur = 0.1, peak = 0.3, attack = 0.002, glide, ftype, fq, q, dest }) {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(f, t);
  if (glide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, glide), t + Math.max(0.01, dur));
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + Math.max(0.001, attack));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  let head = osc;
  if (ftype) {
    const flt = ctx.createBiquadFilter();
    flt.type = ftype; flt.frequency.value = fq; flt.Q.value = q ?? 1;
    head.connect(flt); head = flt;
  }
  head.connect(g); g.connect(dest ?? sfxGain);
  osc.start(t); osc.stop(t + dur + 0.03);
  countVoice(osc);
}

// 噪声爆（带滤波/扫频）。
function noise({ t = ctx.currentTime, dur = 0.1, peak = 0.3, ftype = 'bandpass', fq = 1000, q = 1, fq2, attack = 0.003, dest }) {
  const src = ctx.createBufferSource();
  src.buffer = makeNoise();
  const flt = ctx.createBiquadFilter();
  flt.type = ftype; flt.frequency.setValueAtTime(fq, t); flt.Q.value = q;
  if (fq2) flt.frequency.exponentialRampToValueAtTime(Math.max(1, fq2), t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, peak), t + Math.max(0.001, attack));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(flt); flt.connect(g); g.connect(dest ?? sfxGain);
  src.start(t); src.stop(t + dur + 0.03);
  countVoice(src);
}

// —— 音效表：每个都"听得出来是什么" ——
const SFX = {
  'shot.pencil': () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.02, peak: 0.5, ftype: 'highpass', fq: 3200, q: 0.7 });
    tone({ t, type: 'square', f: 1600, dur: 0.03, peak: 0.4, glide: 700 });
  },
  'shot.brush': () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.12, peak: 0.55, ftype: 'lowpass', fq: 700, fq2: 180, q: 0.8 });
    tone({ t, type: 'sine', f: 80, dur: 0.12, peak: 0.5, glide: 40 });
  },
  'shot.nib': () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.05, peak: 0.5, ftype: 'bandpass', fq: 4200, q: 6 });
    tone({ t, type: 'sine', f: 2400, dur: 0.06, peak: 0.4, glide: 1800 });
  },
  hit: () => {
    const t = ctx.currentTime;
    tone({ t, type: 'triangle', f: 200, dur: 0.05, peak: 0.5, glide: 90 });
    noise({ t, dur: 0.03, peak: 0.4, ftype: 'lowpass', fq: 900 });
  },
  kill: () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.2, peak: 0.6, ftype: 'lowpass', fq: 2400, fq2: 300, q: 0.5 });
    tone({ t, type: 'sine', f: 160, dur: 0.2, peak: 0.55, glide: 45 });
  },
  'ragdoll.thud': () => {
    const t = ctx.currentTime;
    tone({ t, type: 'sine', f: 90, dur: 0.18, peak: 0.5, glide: 45 });
    noise({ t, dur: 0.1, peak: 0.3, ftype: 'lowpass', fq: 400 });
  },
  dash: () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.16, peak: 0.45, ftype: 'bandpass', fq: 200, fq2: 2000, q: 1.2 });
  },
  melee: () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.12, peak: 0.5, ftype: 'highpass', fq: 1800, fq2: 5000, q: 0.8 });
    tone({ t, type: 'sawtooth', f: 120, dur: 0.08, peak: 0.2, glide: 400 });
  },
  reload: () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.02, peak: 0.4, ftype: 'highpass', fq: 2600 });
    noise({ t: t + 0.12, dur: 0.02, peak: 0.5, ftype: 'highpass', fq: 3200 });
  },
  'ink.pickup': (o = {}) => {
    const t = ctx.currentTime;
    const f0 = 440 * Math.pow(2, (o.combo || 0) / 12);
    tone({ t, type: 'sine', f: f0, dur: 0.08, peak: 0.4, glide: f0 * 2 });
  },
  hurt: () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.2, peak: 0.5, ftype: 'lowpass', fq: 1200, fq2: 300, q: 0.7 });
  },
  'wave.start': () => {
    const t = ctx.currentTime;
    tone({ t, type: 'sine', f: 55, dur: 0.5, peak: 0.4 });
    tone({ t, type: 'sine', f: 82, dur: 0.5, peak: 0.3 });
  },
  'wave.clear': () => {
    const t = ctx.currentTime;
    [0, 4, 7].forEach((d, i) => tone({ t: t + i * 0.09, type: 'triangle', f: 440 * Math.pow(2, d / 12), dur: 0.25, peak: 0.35 }));
  },
  'act.change': () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.35, peak: 0.4, ftype: 'lowpass', fq: 600, fq2: 4000, q: 0.6 });
  },
  'boss.roar': () => {
    const t = ctx.currentTime;
    tone({ t, type: 'sawtooth', f: 40, dur: 0.9, peak: 0.5, glide: 28 });
    noise({ t, dur: 0.8, peak: 0.45, ftype: 'lowpass', fq: 400, fq2: 900, q: 0.8 });
  },
  death: () => {
    const t = ctx.currentTime;
    [69, 65, 62].forEach((m, i) => tone({ t: t + i * 0.16, type: 'triangle', f: 440 * Math.pow(2, (m - 69) / 12), dur: 0.4, peak: 0.35, glide: 440 * Math.pow(2, (m - 76) / 12) }));
    noise({ t: t + 0.1, dur: 0.4, peak: 0.4, ftype: 'lowpass', fq: 1200, fq2: 200 });
  },
  splash: () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.15, peak: 0.45, ftype: 'bandpass', fq: 900, fq2: 250, q: 0.8 });
    tone({ t, type: 'sine', f: 200, dur: 0.12, peak: 0.3, glide: 60 });
  },
  lore: () => {
    const t = ctx.currentTime;
    tone({ t, type: 'sine', f: 880, dur: 0.12, peak: 0.3, glide: 1320 });
  },
  'boss.down': () => {
    const t = ctx.currentTime;
    tone({ t, type: 'sine', f: 70, dur: 1.1, peak: 0.55, glide: 30 });
    noise({ t, dur: 1.0, peak: 0.5, ftype: 'lowpass', fq: 300, fq2: 80 });
  },
  'ui.click': () => {
    const t = ctx.currentTime;
    noise({ t, dur: 0.008, peak: 0.25, ftype: 'highpass', fq: 3000 });
    tone({ t, type: 'sine', f: 1200, dur: 0.02, peak: 0.18 });
  },
  'ui.hover': () => {
    const t = ctx.currentTime;
    tone({ t, type: 'sine', f: 700, dur: 0.03, peak: 0.12 });
  },
  'ui.pick': () => {
    const t = ctx.currentTime;
    tone({ t, type: 'sine', f: 660, dur: 0.06, peak: 0.2, glide: 990 });
  },
  'ui.back': () => {
    const t = ctx.currentTime;
    tone({ t, type: 'sine', f: 520, dur: 0.05, peak: 0.18, glide: 330 });
  },
};

// 事件 → 音效路由（sim 事件，README §6.3）
const EVENT_MAP = {
  shot: (e) => play('shot.' + (e?.weapon === 'brush' ? 'brush' : e?.weapon === 'nib' ? 'nib' : 'pencil')),
  shotHit: () => play('hit'),
  hit: () => play('hit'),
  kill: () => {
    comboChain = Math.min(12, comboChain + 1);
    play('kill');
    setTimeout(() => play('ragdoll.thud'), 350);
  },
  splash: () => play('splash'),
  dash: () => play('dash'),
  melee: () => play('melee'),
  reload: () => play('reload'),
  pickup: (e) => {
    if (e?.kind === 'lore') play('lore');
    else if (e?.kind === 'ink') play('ink.pickup', { combo: comboChain });
    else play('ui.pick');
  },
  hurt: () => { comboChain = 0; play('hurt'); },
  waveStart: () => play('wave.start'),
  waveClear: () => play('wave.clear'),
  actStart: () => play('act.change'),
  actClear: () => play('act.change'),
  bossPhase: () => play('boss.roar'),
  bossDown: () => play('boss.down'),
  dead: () => { comboChain = 0; play('death'); },
  lore: () => play('lore'),
};

function play(name, opts = {}) {
  if (!ready || !ctx) return;
  const fn = SFX[name];
  if (!fn) return;
  const t = ctx.currentTime;
  if (t - (lastPlayed.get(name) || -Infinity) < 0.03) return; // 同音效 30ms 限流
  lastPlayed.set(name, t);
  fn(opts);
}

function event(events) {
  if (!ready || !Array.isArray(events)) return;
  for (const e of events) {
    const type = typeof e === 'string' ? e : e?.type;
    const fn = EVENT_MAP[type];
    if (fn) fn(e);
  }
}

function updateMusicGain() {
  if (!musicGain || !ctx) return;
  const target = muted ? 0 : (ducked ? 0.15 : vol.music);
  musicGain.gain.setTargetAtTime(target, ctx.currentTime, 0.1);
}

function bindDuck() {
  if (duckBound || typeof document === 'undefined') return;
  duckBound = true;
  document.addEventListener('visibilitychange', () => { ducked = document.hidden; updateMusicGain(); });
  window.addEventListener('blur', () => { ducked = true; updateMusicGain(); });
  window.addEventListener('focus', () => { ducked = document.hidden; updateMusicGain(); });
}

function init() {
  if (!hasWebAudio) return;
  if (ctx) { unlock(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  try { ctx = new AC(); } catch { return; }
  master = ctx.createGain();
  master.gain.value = CONFIG.audio.master;
  comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 6;
  comp.attack.value = 0.003; comp.release.value = 0.2;
  analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyserBuf = new Float32Array(analyser.fftSize);
  musicGain = ctx.createGain();
  musicGain.gain.value = vol.music;
  sfxGain = ctx.createGain();
  sfxGain.gain.value = vol.sfx;
  musicGain.connect(master);
  sfxGain.connect(master);
  master.connect(comp);
  comp.connect(analyser);
  analyser.connect(ctx.destination);
  engine = new MusicEngine(ctx, musicGain);
  if (scene) engine.setScene(scene);
  engine.setIntensity(intensity);
  ready = true;
  bindDuck();
  unlock();
}

function unlock() {
  if (ctx && ctx.state === 'suspended') ctx.resume();
}

function setScene(id) {
  scene = id || null;
  if (engine) engine.setScene(scene);
}

function setIntensity(v) {
  intensity = clamp01(v);
  if (engine) engine.setIntensity(intensity);
}

function setVolumes(v = {}) {
  if (typeof v.music === 'number') vol.music = clamp01(v.music);
  if (typeof v.sfx === 'number') vol.sfx = clamp01(v.sfx);
  if (!ctx) return;
  updateMusicGain();
  sfxGain.gain.setTargetAtTime(muted ? 0 : vol.sfx, ctx.currentTime, 0.1);
}

function mute(on = true) {
  muted = on;
  if (!ctx) return;
  updateMusicGain();
  sfxGain.gain.setTargetAtTime(muted ? 0 : vol.sfx, ctx.currentTime, 0.1);
}

function getState() {
  let rms = 0;
  let peak = 0;
  if (analyser) {
    analyser.getFloatTimeDomainData(analyserBuf);
    let sum = 0;
    for (let i = 0; i < analyserBuf.length; i++) {
      const v = analyserBuf[i];
      const a = Math.abs(v);
      if (a > peak) peak = a;
      sum += v * v;
    }
    rms = Math.sqrt(sum / analyserBuf.length);
  }
  return { ready, scene, intensity, rms, peak, voices, muted };
}

export const Audio = {
  init,
  unlock,
  event,
  play,
  setScene,
  setIntensity,
  setVolumes,
  getState,
  mute,
};

if (typeof window !== 'undefined') {
  window.G = window.G || {};
  window.G.Audio = Audio;
}

export default Audio;
