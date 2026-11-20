// HAPPY CHICK HOP · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：轻快农场风，BPM 108，C 大调 C–G–Am–F，8 小节无缝循环。
// SFX：drop/merge/combo/hammer/stage/win/lose/rock/click，全部 ≤0.6s。
// 导出 createAudio()（实时，main 用 event() 消费事件），
// 另导出 scheduleBgmLoop / scheduleSfx 与常量供 tools/audio-check.mjs 离屏复验。

const BPM = 108;
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
  { root: 48, pad: [55, 60, 64] }, // C
  { root: 43, pad: [50, 55, 59] }, // G
  { root: 45, pad: [52, 57, 60] }, // Am
  { root: 41, pad: [48, 53, 57] }, // F
];

// 主音（8 小节轻快旋律）：[小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 72, 0.5], [0, 0.5, 76, 0.5], [0, 1.0, 79, 1.0], [0, 2.5, 76, 0.5], [0, 3.0, 72, 1.0],
  [1, 0.0, 74, 0.5], [1, 0.5, 77, 0.5], [1, 1.0, 81, 1.0], [1, 2.5, 79, 0.5], [1, 3.0, 77, 1.0],
  [2, 0.0, 76, 0.5], [2, 0.5, 72, 0.5], [2, 1.0, 76, 1.5], [2, 3.0, 69, 1.0],
  [3, 0.0, 67, 0.5], [3, 0.5, 71, 0.5], [3, 1.0, 74, 1.0], [3, 2.5, 71, 0.5], [3, 3.0, 67, 1.0],
  [4, 0.0, 72, 0.5], [4, 0.5, 76, 0.5], [4, 1.0, 79, 1.0], [4, 2.5, 76, 0.5], [4, 3.0, 72, 1.0],
  [5, 0.0, 74, 0.5], [5, 0.5, 77, 0.5], [5, 1.0, 81, 1.0], [5, 2.5, 79, 0.5], [5, 3.0, 77, 1.0],
  [6, 0.0, 76, 0.5], [6, 0.5, 79, 0.5], [6, 1.0, 84, 1.5], [6, 3.0, 81, 1.0],
  [7, 0.0, 79, 0.5], [7, 0.5, 76, 0.5], [7, 1.0, 72, 1.5], [7, 3.0, 67, 1.0],
];

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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.14 }) {
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
    const att = 0.06;
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

const SFX = {
  click(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.06, freq: 1600, type: 'sine', vol: 0.4, attack: 0.002 });
  },
  aim(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.05, freq: 900, freqEnd: 1100, type: 'sine', vol: 0.16, attack: 0.002 });
  },
  drop(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.14, freq: 420, freqEnd: 200, type: 'triangle', vol: 0.4, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.16, type: 'lowpass', freq: 700, q: 1 });
  },
  merge(ctx, out, t0, payload) {
    const tier = payload && typeof payload.tier === 'number' ? payload.tier : 1;
    const base = midi(60 + Math.min(12, tier * 2));
    tone(ctx, out, { t0, dur: 0.16, freq: base, type: 'sine', vol: 0.4, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.16, freq: base * 1.26, type: 'sine', vol: 0.34, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.12, dur: 0.2, freq: base * 1.5, type: 'sine', vol: 0.3, attack: 0.003 });
  },
  combo(ctx, out, t0) {
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.05, dur: 0.12, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.003 });
    });
  },
  rock(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.16, freq: 180, freqEnd: 90, type: 'sine', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.12, vol: 0.24, type: 'lowpass', freq: 400, q: 1.2 });
  },
  hammer(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.25, vol: 0.45, type: 'lowpass', freq: 3000, freqEnd: 300, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.14, freq: 200, freqEnd: 60, type: 'sine', vol: 0.4, attack: 0.003 });
  },
  stage(ctx, out, t0) {
    [72, 76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.003 });
    });
  },
  win(ctx, out, t0) {
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.4, freq: 130, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.22, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  aim: 'aim',
  drop: 'drop',
  merge: 'merge',
  combo: 'combo',
  rock: 'rock',
  hammer: 'hammer',
  stage: 'stage',
  win: 'win',
  lose: 'lose',
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

function pluck(ctx, out, { t0, midiNote, dur = 0.5, vol = 0.2 }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol, attack: 0.003, release: Math.min(dur, 0.4) });
}

function bass(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.3, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}

function hat(ctx, out, { t0, vol = 0.18 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 6000, q: 1 });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      push(hat(ctx, bus, { t0: barT + b * BEAT, vol: b % 2 === 0 ? 0.2 : 0.12 }));
      push(bass(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar) push(pluck(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
    }
  }
  return collect;
}

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
