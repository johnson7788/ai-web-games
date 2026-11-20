// 福州麻将 13 · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：五声调式轻快霓虹循环，BPM 96；SFX：出牌/摸牌/碰杠胡/胜负等全部 ≤0.6s。
// 导出 createAudio()（实时）+ scheduleBgm* / scheduleSfx*（供 tools/audio-check.mjs 离屏复验）。

const BPM = 96;
const BEAT = 60 / BPM;            // ≈0.625s
const BAR = BEAT * 4;             // ≈2.5s
const BGM_BARS = 8;               // 8 小节循环
const BGM_LOOP = BAR * BGM_BARS;  // ≈20s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 五声调式（C 宫）：根音 + 双音垫
const CHORDS = [
  { root: 48, pad: [55, 60] },
  { root: 45, pad: [52, 57] },
  { root: 43, pad: [50, 55] },
  { root: 48, pad: [55, 60] },
];

// 主音（后 4 小节进入）
const MELODY = [
  [4, 0.0, 72, 1.5], [4, 2.0, 76, 1.5],
  [5, 0.0, 79, 2.0], [5, 2.0, 76, 2.0],
  [6, 0.0, 74, 1.5], [6, 2.0, 72, 1.5],
  [7, 0.0, 69, 2.5], [7, 3.0, 72, 1.0],
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
    lp.frequency.value = 1600;
    lp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.06);
    g.gain.setValueAtTime(vol, t0 + dur - 0.2);
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
  discard(ctx, out, t0) { // 麻将落桌 click
    noise(ctx, out, { t0, dur: 0.05, vol: 0.5, type: 'bandpass', freq: 2600, q: 6 });
    tone(ctx, out, { t0, dur: 0.09, freq: 1200, freqEnd: 800, type: 'triangle', vol: 0.32, attack: 0.002 });
  },
  draw(ctx, out, t0) { // 摸牌轻响
    tone(ctx, out, { t0, dur: 0.07, freq: 900, freqEnd: 1400, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  flower(ctx, out, t0) { // 补花风铃
    tone(ctx, out, { t0, dur: 0.3, freq: midi(84), type: 'sine', vol: 0.26, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.07, dur: 0.3, freq: midi(88), type: 'sine', vol: 0.26, attack: 0.004 });
  },
  joker(ctx, out, t0) { // 开金闪光
    tone(ctx, out, { t0, dur: 0.35, freq: midi(72), type: 'triangle', vol: 0.3, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.4, freq: midi(79), type: 'triangle', vol: 0.24, attack: 0.004 });
  },
  chow(ctx, out, t0) { // 吃
    tone(ctx, out, { t0, dur: 0.09, freq: 660, type: 'square', vol: 0.22, attack: 0.003 });
  },
  pong(ctx, out, t0) { // 碰
    tone(ctx, out, { t0, dur: 0.12, freq: 520, type: 'square', vol: 0.26, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.03, dur: 0.1, freq: 780, type: 'square', vol: 0.2, attack: 0.003 });
  },
  kong(ctx, out, t0) { // 杠
    tone(ctx, out, { t0, dur: 0.14, freq: 440, type: 'square', vol: 0.28, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.04, dur: 0.12, freq: 660, type: 'square', vol: 0.24, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.06, vol: 0.2, type: 'bandpass', freq: 3000, q: 4 });
  },
  hu(ctx, out, t0) { // 胡
    [72, 76, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.24, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  win(ctx, out, t0) { // 五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 闷 thud
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
  drawRound(ctx, out, t0) { // 流局
    tone(ctx, out, { t0, dur: 0.3, freq: 200, freqEnd: 120, type: 'sine', vol: 0.4, attack: 0.004 });
  },
  coin(ctx, out, t0) { // 金币
    tone(ctx, out, { t0, dur: 0.09, freq: 1400, type: 'square', vol: 0.2, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.12, freq: 1800, type: 'square', vol: 0.18, attack: 0.002 });
  },
  hint(ctx, out, t0) { // 提示
    tone(ctx, out, { t0, dur: 0.16, freq: 1100, freqEnd: 1500, type: 'sine', vol: 0.24, attack: 0.003 });
  },
  click(ctx, out, t0) { // UI 点击
    noise(ctx, out, { t0, dur: 0.05, vol: 0.6, type: 'bandpass', freq: 2400, q: 3 });
  },
  deal(ctx, out, t0) { // 发牌
    tone(ctx, out, { t0, dur: 0.06, freq: 800, type: 'triangle', vol: 0.24, attack: 0.003 });
  },
};

const SFX_EVENT_MAP = {
  discard: 'discard',
  drawTile: 'draw',
  flower: 'flower',
  joker: 'joker',
  chow: 'chow',
  pong: 'pong',
  kong: 'kong',
  hu: 'hu',
  win: 'win',
  lose: 'lose',
  drawRound: 'drawRound',
  item: 'coin',
  hint: 'hint',
  click: 'click',
  deal: 'deal',
  roundStart: 'deal',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环编排（8 小节，t0 起，无缝）----

function woodblock(ctx, out, { t0, vol = 0.35 }) {
  return noise(ctx, out, { t0, dur: 0.045, vol, type: 'bandpass', freq: 2400, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.3, freq: midi(midiNote), type: 'triangle', vol: 0.32, attack: 0.006, release: 0.3 });
}

function marimba(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.2, attack: 0.003, release: Math.min(dur, 0.35) });
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
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.35 : 0.24 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar) push(marimba(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
