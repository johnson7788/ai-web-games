// src/core/audio.js — 程序化霓虹合成波音频（纯 WebAudio，零音频文件零外链）。
//
// BGM：合成波 Bm 进行 Bm–G–A–F#m，BPM 104，8 小节无缝循环。
// 四层：底鼓=低频正弦 thump、贝斯=锯齿根音、琶音=16 分方波 pluck、和声垫=双音锯齿 LPF。
// SFX：eat/combo/boost/death/win/lose/stageUp/gold/click，全部 ≤0.6s。
// 导出 createAudio()（实时）与 scheduleBgmLoop/scheduleSfx 供 tools/audio-check.mjs 离屏复验。

const BPM = 104;
const BEAT = 60 / BPM; // ≈0.5769s
const BAR = BEAT * 4; // ≈2.3077s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS; // ≈18.46s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-16);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { root: 35, pad: [59, 62, 66] }, // Bm
  { root: 31, pad: [55, 59, 62] }, // G
  { root: 33, pad: [57, 61, 64] }, // A
  { root: 30, pad: [54, 57, 61] }, // F#m
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
    const att = 0.08;
    const rel = 0.25;
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

// ---- SFX 合成（每个都短 ≤0.6s）----

const SFX = {
  eat(ctx, out, t0) { // 明亮 blip 上行
    tone(ctx, out, { t0, dur: 0.09, freq: 880, freqEnd: 1320, type: 'sine', vol: 0.42, attack: 0.002 });
    tone(ctx, out, { t0, dur: 0.03, freq: 2000, type: 'sine', vol: 0.16, attack: 0.001 });
  },
  combo(ctx, out, t0) { // 两音上行，随 combo 更高
    [660, 990, 1320].slice(0, 2).forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.05, dur: 0.1, freq: f, type: 'triangle', vol: 0.3, attack: 0.002 });
    });
  },
  boost(ctx, out, t0) { // 噪声 whoosh 上扫 + 锯齿音 sweep
    noise(ctx, out, { t0, dur: 0.22, vol: 0.5, type: 'bandpass', freq: 500, freqEnd: 3200, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.22, freq: 280, freqEnd: 900, type: 'sawtooth', vol: 0.2, attack: 0.02 });
  },
  death(ctx, out, t0) { // 低频闷响 + 噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 50, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  win(ctx, out, t0) { // 五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 与 death 同型（撞车结算）
    tone(ctx, out, { t0, dur: 0.4, freq: 110, freqEnd: 48, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'lowpass', freq: 480, q: 1 });
  },
  stageUp(ctx, out, t0) { // 三连音上行
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'square', vol: 0.2, attack: 0.003 });
    });
  },
  gold(ctx, out, t0) { // 风铃闪亮
    [84, 88, 91].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.22, freq: midi(m), type: 'sine', vol: 0.26, attack: 0.003 });
    });
  },
  click(ctx, out, t0) { // UI click
    tone(ctx, out, { t0, dur: 0.04, freq: 1500, type: 'sine', vol: 0.25, attack: 0.001 });
  },
};

const SFX_EVENT_MAP = {
  food: 'eat',
  combo: 'combo',
  boostStart: 'boost',
  death: 'lose',
  win: 'win',
  lose: 'lose',
  stageUp: 'stageUp',
  goldEat: 'gold',
  click: 'click',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环的编排（8 小节）----

function kick(ctx, out, { t0, vol = 0.5 }) {
  return tone(ctx, out, { t0, dur: 0.14, freq: 120, freqEnd: 45, type: 'sine', vol, attack: 0.002 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  const osc = ctx.createOscillator();
  const lp = ctx.createBiquadFilter();
  const g = ctx.createGain();
  osc.type = 'sawtooth';
  osc.frequency.value = midi(midiNote);
  lp.type = 'lowpass';
  lp.frequency.value = 400;
  lp.Q.value = 1;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(0.26, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.5);
  osc.connect(lp);
  lp.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.52);
  return [osc];
}

function arpNote(ctx, out, { t0, midiNote, vol = 0.11 }) {
  return tone(ctx, out, { t0, dur: 0.09, freq: midi(midiNote), type: 'square', vol, attack: 0.002, release: 0.09 });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  const steps = 4; // 每拍 4 个 16 分音符
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(kick(ctx, bus, { t0: bt, vol: b === 0 ? 0.5 : 0.34 }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
    }
    // 琶音 16 分
    const arpTones = [chord.pad[0] + 12, chord.pad[1] + 12, chord.pad[2] + 12, chord.pad[1] + 12];
    for (let s = 0; s < 16; s += 1) {
      push(arpNote(ctx, bus, { t0: barT + (s / steps) * BEAT, midiNote: arpTones[s % 4] }));
    }
    // 和声垫（两小节一换）
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
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
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
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
    const p = bgmBus.gain;
    p.cancelScheduledValues(ctx.currentTime);
    p.setValueAtTime(Math.max(0.0001, p.value || 1), ctx.currentTime);
    p.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
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
