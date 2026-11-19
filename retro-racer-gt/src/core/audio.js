// RETRO RACER GT · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：synthwave 驾驶感，BPM 122，A 小调进行 Am–F–C–G（每和弦 2 小节），
// 8 小节无缝循环。四层：kick=低音正弦 thump、snare/hat=噪声、bass=8 分音锯齿脉冲、
// pad=双音锯齿轻 LPF、lead=后 4 小节正弦主音。
// SFX：turn/nitro/nitroEnd/pass/nearMiss/collect/combo/levelUp/crash/start，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 122;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { root: 45, pad: [57, 60, 64] }, // Am
  { root: 41, pad: [53, 57, 60] }, // F
  { root: 48, pad: [55, 60, 64] }, // C
  { root: 43, pad: [50, 55, 59] }, // G
];

// 主音（后 4 小节）：[小节内, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 76, 1.0], [0, 1.5, 79, 0.5], [0, 2.0, 81, 1.5],
  [1, 0.0, 79, 1.0], [1, 1.5, 76, 0.5], [1, 2.0, 72, 2.0],
  [2, 0.0, 74, 1.0], [2, 1.5, 76, 0.5], [2, 2.0, 79, 1.5],
  [3, 0.0, 81, 2.5], [3, 3.0, 79, 1.0],
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

const SFX = {
  start(ctx, out, t0) { // 引擎发动：低音上扫
    tone(ctx, out, { t0, dur: 0.4, freq: 90, freqEnd: 240, type: 'sawtooth', vol: 0.3, attack: 0.01 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.14, type: 'lowpass', freq: 500, q: 1 });
  },
  turn(ctx, out, t0) { // 轮胎短 squeak
    tone(ctx, out, { t0, dur: 0.12, freq: 900, freqEnd: 1500, type: 'sine', vol: 0.22, attack: 0.003 });
  },
  nitro(ctx, out, t0) { // 氮气 whoosh 上扫
    noise(ctx, out, { t0, dur: 0.5, vol: 0.34, type: 'bandpass', freq: 600, freqEnd: 4200, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.4, freq: 160, freqEnd: 520, type: 'sawtooth', vol: 0.2, attack: 0.02 });
  },
  nitroEnd(ctx, out, t0) { // 泄压短促
    noise(ctx, out, { t0, dur: 0.18, vol: 0.22, type: 'highpass', freq: 2200, q: 1 });
  },
  pass(ctx, out, t0) { // 超车 blip 上行
    tone(ctx, out, { t0, dur: 0.14, freq: 880, freqEnd: 1320, type: 'square', vol: 0.18, attack: 0.004 });
  },
  nearMiss(ctx, out, t0) { // 擦身 whoosh（噪声 + 下行哨音，更响）
    noise(ctx, out, { t0, dur: 0.22, vol: 0.45, type: 'bandpass', freq: 2000, freqEnd: 600, q: 1.0 });
    tone(ctx, out, { t0, dur: 0.18, freq: 1200, freqEnd: 400, type: 'sine', vol: 0.22, attack: 0.004 });
  },
  collect(ctx, out, t0) { // 能量星风铃
    [72, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.24, freq: midi(m), type: 'sine', vol: 0.24, attack: 0.004 });
    });
  },
  combo(ctx, out, t0, payload) { // 连击音高随层数上升
    const n = payload && payload.combo ? Math.min(payload.combo, 8) : 1;
    const base = 60 + n * 2;
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.2, freq: midi(base + iv), type: 'triangle', vol: 0.22, attack: 0.004 });
    });
  },
  levelUp(ctx, out, t0) { // 难度升级上行琶音
    [67, 71, 74, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.2, freq: midi(m), type: 'square', vol: 0.2, attack: 0.004 });
    });
  },
  crash(ctx, out, t0) { // 撞车：噪声爆发 + 低频 thud
    noise(ctx, out, { t0, dur: 0.4, vol: 0.4, type: 'lowpass', freq: 2800, freqEnd: 200, q: 1.1 });
    tone(ctx, out, { t0, dur: 0.45, freq: 120, freqEnd: 40, type: 'sine', vol: 0.5, attack: 0.005 });
  },
};

const SFX_EVENT_MAP = {
  start: 'start',
  turn: 'turn',
  nitro: 'nitro',
  nitroEnd: 'nitroEnd',
  pass: 'pass',
  nearMiss: 'nearMiss',
  collect: 'collect',
  combo: 'combo',
  levelUp: 'levelUp',
  crash: 'crash',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

function kick(ctx, out, { t0, vol = 0.5 }) {
  return tone(ctx, out, { t0, dur: 0.16, freq: 150, freqEnd: 45, type: 'sine', vol, attack: 0.002 });
}
function snare(ctx, out, { t0, vol = 0.3 }) {
  return noise(ctx, out, { t0, dur: 0.12, vol, type: 'bandpass', freq: 1800, q: 0.8 });
}
function hat(ctx, out, { t0, vol = 0.12 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 7000, q: 1 });
}
function bassPulse(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.22, freq: midi(midiNote), type: 'sawtooth', vol: 0.24, attack: 0.004, release: 0.18 });
}
function lead(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.16, attack: 0.008, release: Math.min(dur, 0.3) });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(kick(ctx, bus, { t0: bt, vol: b === 0 ? 0.5 : 0.42 }));
      if (b === 1 || b === 3) push(snare(ctx, bus, { t0: bt }));
      if (b % 2 === 1) push(hat(ctx, bus, { t0: bt + BEAT / 2 }));
    }
    // 8 分音 bass 脉冲
    for (let e = 0; e < 8; e += 1) {
      const et = barT + e * (BEAT / 2);
      push(bassPulse(ctx, bus, { t0: et, midiNote: e % 2 === 0 ? chord.root : chord.root + 7 }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 4) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 4) push(lead(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
      }
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
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.12);
    p.setValueAtTime(DUCK_GAIN, t + 2.6);
    p.linearRampToValueAtTime(1, t + 2.75);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'crash') duckBgm();
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
