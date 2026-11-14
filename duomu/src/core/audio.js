/**
 * 全程序化音频（WebAudio），零外部素材。
 * 音量/开关集中在这里，业务层只调 play(name)。
 *
 * 音色设计：木 = 短促的木质敲击；雷 = 噪声 + 高频扫频；天雷 = 低频轰击 + 残响。
 */

let ctx = null;
let master = null;
let sfxBus = null;
let musicBus = null;
let noiseBuf = null;
let enabled = true;
let started = false;

function makeNoise(ac) {
  const len = Math.floor(ac.sampleRate * 1.2);
  const buf = ac.createBuffer(1, len, ac.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

export function init() {
  if (ctx) return ctx;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = 0.85;
  master.connect(ctx.destination);
  sfxBus = ctx.createGain();
  sfxBus.gain.value = 0.9;
  sfxBus.connect(master);
  musicBus = ctx.createGain();
  musicBus.gain.value = 0.22;
  musicBus.connect(master);
  noiseBuf = makeNoise(ctx);
  return ctx;
}

export function unlock() {
  init();
  if (!ctx) return;
  if (ctx.state === 'suspended') ctx.resume();
  if (!started) { started = true; startDrone(); }
}

export function setEnabled(on) {
  enabled = !!on;
  if (master) master.gain.setTargetAtTime(enabled ? 0.85 : 0, ctx.currentTime, 0.05);
}
export function isEnabled() { return enabled; }

function now() { return ctx ? ctx.currentTime : 0; }

function tone({ freq = 220, type = 'sine', dur = 0.18, gain = 0.3, bus = null, sweep = null, delay = 0, curve = 'exp' }) {
  if (!ctx || !enabled) return;
  const t0 = now() + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (sweep) {
    if (curve === 'exp') osc.frequency.exponentialRampToValueAtTime(Math.max(20, sweep), t0 + dur);
    else osc.frequency.linearRampToValueAtTime(Math.max(20, sweep), t0 + dur);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + Math.min(0.02, dur * 0.25));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  osc.connect(g).connect(bus || sfxBus);
  osc.start(t0);
  osc.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.2, gain = 0.3, filter = 'bandpass', freq = 1200, q = 0.8, sweep = null, delay = 0, bus = null }) {
  if (!ctx || !enabled) return;
  const t0 = now() + delay;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter();
  f.type = filter;
  f.frequency.setValueAtTime(freq, t0);
  f.Q.value = q;
  if (sweep) f.frequency.exponentialRampToValueAtTime(Math.max(60, sweep), t0 + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f).connect(g).connect(bus || sfxBus);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
}

/** 极简环境音：低音持续 + 偶尔的雷声，避免死寂 */
let droneNodes = null;
function startDrone() {
  if (!ctx || droneNodes) return;
  const o1 = ctx.createOscillator();
  const o2 = ctx.createOscillator();
  const g = ctx.createGain();
  const f = ctx.createBiquadFilter();
  o1.type = 'sine'; o1.frequency.value = 55;
  o2.type = 'sine'; o2.frequency.value = 82.5;   // 五度
  f.type = 'lowpass'; f.frequency.value = 240;
  g.gain.value = 0.0;
  o1.connect(f); o2.connect(f); f.connect(g).connect(musicBus);
  o1.start(); o2.start();
  g.gain.setTargetAtTime(0.5, ctx.currentTime, 1.5);
  droneNodes = { o1, o2, g };
}

const SFX = {
  ui() { tone({ freq: 520, type: 'triangle', dur: 0.07, gain: 0.16 }); },

  /** 砍中：档次越高越亮 */
  chop(tier, first) {
    const bright = tier === 'blind' ? 2400 : tier === 'hint' ? 1600 : 1100;
    noise({ dur: 0.12, gain: 0.34, filter: 'bandpass', freq: bright, q: 0.7, sweep: 400 });
    tone({ freq: tier === 'blind' ? 190 : 150, type: 'square', dur: 0.1, gain: 0.22, sweep: 70 });
    if (first) tone({ freq: 880, type: 'triangle', dur: 0.09, gain: 0.12, delay: 0.03 });
  },

  /** 劈中雷印 */
  zap() {
    noise({ dur: 0.3, gain: 0.42, filter: 'highpass', freq: 2400, q: 0.5, sweep: 200 });
    tone({ freq: 1400, type: 'sawtooth', dur: 0.18, gain: 0.2, sweep: 90 });
    tone({ freq: 70, type: 'square', dur: 0.3, gain: 0.25, sweep: 40 });
  },

  /** 天雷轰顶 */
  smite() {
    tone({ freq: 90, type: 'sawtooth', dur: 0.7, gain: 0.4, sweep: 28 });
    noise({ dur: 0.55, gain: 0.3, filter: 'lowpass', freq: 900, sweep: 120 });
    tone({ freq: 240, type: 'square', dur: 0.4, gain: 0.14, sweep: 60, delay: 0.05 });
  },

  /** 微光出现 */
  hint() {
    tone({ freq: 1320, type: 'sine', dur: 0.16, gain: 0.1, sweep: 1760 });
  },

  /** 真印亮起 */
  reveal() {
    tone({ freq: 660, type: 'triangle', dur: 0.14, gain: 0.14 });
    tone({ freq: 990, type: 'sine', dur: 0.2, gain: 0.08, delay: 0.04 });
  },

  /** 双雷段飘过 */
  pass() {
    noise({ dur: 0.45, gain: 0.14, filter: 'lowpass', freq: 700, sweep: 180 });
  },

  /** 木段溜走 */
  escape() {
    noise({ dur: 0.3, gain: 0.12, filter: 'bandpass', freq: 900, q: 1.2, sweep: 260 });
  },

  win() {
    [523, 659, 784, 1046].forEach((f, i) => tone({ freq: f, type: 'triangle', dur: 0.32, gain: 0.2, delay: i * 0.11 }));
  },

  lose() {
    [392, 330, 262, 196].forEach((f, i) => tone({ freq: f, type: 'sawtooth', dur: 0.34, gain: 0.16, delay: i * 0.12 }));
  },

  act() {
    tone({ freq: 196, type: 'sawtooth', dur: 0.5, gain: 0.16, sweep: 98 });
    noise({ dur: 0.6, gain: 0.16, filter: 'lowpass', freq: 500, sweep: 120 });
  },
};

export function play(name, a, b) {
  if (!ctx || !enabled) return;
  const fn = SFX[name];
  if (fn) fn(a, b);
}
