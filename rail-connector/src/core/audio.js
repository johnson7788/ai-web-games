// Rail Connector · 程序化音频（纯 WebAudio，零音频文件零外链）。
//
// BGM：霓虹电子轻快，BPM 116，A 小调进行 Am–F–C–G（每和弦 1 小节）。
// 四层：打击点=短噪声、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=方波短衰减。
// SFX：switch/pickup/deliver/combo/boom/rockCrash/wrongPickup/frost/cross/win/lose，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx / 常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 116;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [55, 59] }, // G
];

const MELODY = [
  [0, 0.0, 69, 1.0], [0, 1.0, 72, 0.5], [0, 1.5, 76, 1.0], [0, 3.0, 72, 0.5],
  [1, 0.0, 77, 1.5], [1, 2.0, 76, 1.0], [1, 3.0, 72, 0.5],
  [2, 0.0, 74, 1.0], [2, 1.0, 72, 0.5], [2, 2.0, 69, 1.5],
  [3, 0.0, 71, 1.0], [3, 1.0, 74, 1.0], [3, 2.0, 76, 1.0], [3, 3.0, 79, 0.5],
  [4, 0.0, 81, 1.5], [4, 2.0, 79, 1.0], [4, 3.0, 76, 0.5],
  [5, 0.0, 77, 1.5], [5, 2.0, 76, 1.0], [5, 3.0, 72, 0.5],
  [6, 0.0, 74, 1.0], [6, 1.0, 71, 0.5], [6, 2.0, 69, 1.5],
  [7, 0.0, 67, 2.0], [7, 2.0, 64, 1.0], [7, 3.0, 60, 0.5],
];

// ---- 低层合成（对任意 AudioContext / OfflineAudioContext 通用）----
function tone(ctx, out, { t0, dur, freq, freqEnd = null, type = 'sine', vol = 0.5, attack = 0.004, release = null }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const r = release == null ? dur : release;
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + r);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + r + 0.02);
  return [osc];
}

function noise(ctx, out, { t0, dur, vol = 0.3, type = 'bandpass', freq = 2000, q = 1, freqEnd = null }) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd != null) filter.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
  return [src];
}

function padNote(ctx, out, { t0, dur, freqs, vol = 0.13 }) {
  const oscs = [];
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = midi(f);
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.Q.value = 0.7;
    const att = 0.05;
    const rel = 0.2;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + att);
    g.gain.setValueAtTime(vol, t0 + dur - rel);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
    oscs.push(osc);
  }
  return oscs;
}

// ---- SFX 合成（每个 ≤0.6s）----
const SFX = {
  switch(ctx, out, t0) { // 道岔咔哒
    tone(ctx, out, { t0, dur: 0.05, freq: 900, type: 'square', vol: 0.3, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.04, vol: 0.18, type: 'bandpass', freq: 2600, q: 6 });
  },
  cross(ctx, out, t0) { // 车轮过缝轻嗒
    tone(ctx, out, { t0, dur: 0.04, freq: 1200, freqEnd: 900, type: 'triangle', vol: 0.12, attack: 0.001 });
  },
  pickup(ctx, out, t0) { // 拾取核心：上行 blip
    tone(ctx, out, { t0, dur: 0.12, freq: 660, type: 'sine', vol: 0.32, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.14, freq: 990, type: 'sine', vol: 0.28, attack: 0.003 });
  },
  deliver(ctx, out, t0, p) { // 投递成功：双音 + 颜色音
    const base = p && p.color === 'blue' ? 880 : 660;
    tone(ctx, out, { t0, dur: 0.16, freq: base, type: 'triangle', vol: 0.34, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.08, dur: 0.2, freq: base * 1.5, type: 'triangle', vol: 0.3, attack: 0.003 });
  },
  combo(ctx, out, t0, p) { // 连击上行
    const n = Math.min(4, (p && p.combo) || 2);
    for (let i = 0; i < n; i += 1) {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.12, freq: midi(72 + i * 2), type: 'sine', vol: 0.24, attack: 0.002 });
    }
  },
  wrongPickup(ctx, out, t0) { // 错色：低闷哔
    tone(ctx, out, { t0, dur: 0.16, freq: 200, freqEnd: 150, type: 'square', vol: 0.26, attack: 0.004 });
  },
  boom(ctx, out, t0) { // 相撞：噪声爆发 + 低频
    noise(ctx, out, { t0, dur: 0.4, vol: 0.5, type: 'lowpass', freq: 2600, freqEnd: 300, q: 1 });
    tone(ctx, out, { t0, dur: 0.4, freq: 130, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.004 });
  },
  rockCrash(ctx, out, t0) { // 撞岩：碎石沙
    noise(ctx, out, { t0, dur: 0.35, vol: 0.45, type: 'bandpass', freq: 3200, freqEnd: 700, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.2, freq: 110, freqEnd: 60, type: 'triangle', vol: 0.4, attack: 0.004 });
  },
  frost(ctx, out, t0) { // 霜冻：下扫冷音
    tone(ctx, out, { t0, dur: 0.4, freq: 1400, freqEnd: 500, type: 'sine', vol: 0.3, attack: 0.006 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.3, freq: 900, freqEnd: 300, type: 'sine', vol: 0.2, attack: 0.006 });
  },
  win(ctx, out, t0) { // 通关 jingle C-E-G-C
    [72, 76, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：闷 thud
    tone(ctx, out, { t0, dur: 0.5, freq: 120, freqEnd: 50, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.25, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  countdown(ctx, out, t0) { // 最后 5s beep
    tone(ctx, out, { t0, dur: 0.09, freq: 880, type: 'square', vol: 0.24, attack: 0.003 });
  },
};

// 事件名 → SFX（countdownTick 是门控负例，不放这里）
const SFX_EVENT_MAP = {
  switch: 'switch',
  cross: 'cross',
  pickup: 'pickup',
  deliver: 'deliver',
  combo: 'combo',
  wrongPickup: 'wrongPickup',
  boom: 'boom',
  rockCrash: 'rockCrash',
  frost: 'frost',
  win: 'win',
  lose: 'lose',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环的编排（8 小节，采样精确、无缝）----
function hat(ctx, out, { t0, vol = 0.22 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 6000, q: 1 });
}
function kick(ctx, out, { t0 }) {
  return tone(ctx, out, { t0, dur: 0.18, freq: 110, freqEnd: 45, type: 'sine', vol: 0.5, attack: 0.002 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.24, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.24 });
}
function lead(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.1, attack: 0.004, release: Math.min(dur, 0.22) });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const barT = t0 + bar * BAR;
    push(kick(ctx, bus, { t0: barT }));
    for (let b = 0; b < 4; b += 1) {
      push(hat(ctx, bus, { t0: barT + b * BEAT, vol: b % 2 === 1 ? 0.24 : 0.14 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    push(padNote(ctx, bus, { t0: barT, dur: BAR, freqs: chord.pad }));
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar) push(lead(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
    }
  }
  return collect;
}

// ---- 实时入口 ----
export function createAudio(opts = {}) {
  const factory = opts.createContext || (() => {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    return AC ? new AC() : null;
  });

  let ctx = null;
  let master = null;
  let bgmBus = null;
  let sfxBus = null;
  let muted = false;
  let bgmPlaying = false;
  let bgmNextTime = 0;
  let bgmTimer = null;
  let bgmActive = [];
  let lastCross = 0;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return true;
    }
    const c = factory();
    if (!c) return false;
    ctx = c;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = 1;
    bgmBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(master);
    return true;
  }

  function duckBgm() {
    if (!ctx || !bgmBus) return;
    const t = ctx.currentTime;
    const p = bgmBus.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(Math.max(0.0001, p.value || 1), t);
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.15);
    p.setValueAtTime(DUCK_GAIN, t + 2.85);
    p.linearRampToValueAtTime(1, t + 3.0);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    if (name === 'countdownTick') {
      const left = payload && payload.timeLeft;
      if (typeof left === 'number' && left > 0 && left <= 5) {
        scheduleSfx(ctx, sfxBus, 'countdown', payload, ctx.currentTime);
      }
      return;
    }
    const sfx = SFX_EVENT_MAP[name];
    if (!sfx) return;
    // cross 太密集 → 限流，避免爆音
    if (name === 'cross') {
      const now = performance && performance.now ? performance.now() : (ctx.currentTime * 1000);
      if (now - lastCross < 140) return;
      lastCross = now;
    }
    scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'win' || name === 'lose') duckBgm();
  }

  function bgmTick() {
    if (!bgmPlaying || !ctx) return;
    const horizon = ctx.currentTime + 0.3;
    while (bgmNextTime < horizon) {
      scheduleBgmLoop(ctx, bgmBus, bgmNextTime, BGM_GAIN, bgmActive);
      bgmNextTime += BGM_LOOP;
    }
  }

  function startBgm() {
    if (!ensure() || bgmPlaying) return;
    bgmPlaying = true;
    bgmActive = [];
    bgmNextTime = ctx.currentTime + 0.05;
    bgmTick();
    bgmTimer = setInterval(bgmTick, 100);
  }

  function stopBgm() {
    bgmPlaying = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    if (ctx && bgmBus) {
      const t = ctx.currentTime;
      const p = bgmBus.gain;
      p.cancelScheduledValues(t);
      p.setValueAtTime(Math.max(0.0001, p.value || 1), t);
      p.linearRampToValueAtTime(0.0001, t + 0.05);
    }
    const t = ctx ? ctx.currentTime : 0;
    for (const s of bgmActive) { try { s.stop(t + 0.03); } catch (e) { /* noop */ } }
    bgmActive = [];
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) master.gain.value = muted ? 0 : 1;
    return muted;
  }

  function unlock() { return ensure(); }

  return { event, setMuted, startBgm, stopBgm, unlock };
}

export { BPM, BEAT, BAR, BGM_BARS, BGM_LOOP, scheduleSfx, SFX_EVENT_MAP };
