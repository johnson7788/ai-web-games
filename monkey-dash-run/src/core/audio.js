// MONKEY DASH RUN · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹跑酷，BPM 132，A 小调进行 Am–F–C–G（每和弦 1 小节），8 小节无缝循环。
// 四层：打击点=短噪声木鱼、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=方波短衰减。
// SFX：switch/collect/shield/spark/rushStart/rushEnd/smash/nearMiss/death/tierUp，全部 ≤0.6s。
// 导出 createAudio()（实时）+ scheduleBgmLoop/scheduleSfx 与常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 132;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音，pad=和弦垫
const CHORDS = [
  { root: 45, pad: [52, 57] }, // Am
  { root: 41, pad: [48, 53] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// 主音：[小节, 拍, MIDI, 持续拍]
const MELODY = [
  [0, 0.0, 76, 1.0], [0, 1.0, 72, 1.0], [0, 2.0, 76, 1.0], [0, 3.0, 79, 1.0],
  [1, 0.0, 81, 1.5], [1, 2.0, 77, 1.5],
  [2, 0.0, 76, 1.0], [2, 1.0, 72, 1.0], [2, 2.0, 69, 1.0], [2, 3.0, 72, 1.0],
  [3, 0.0, 74, 2.0], [3, 2.0, 71, 2.0],
  [4, 0.0, 76, 1.0], [4, 1.0, 72, 1.0], [4, 2.0, 76, 1.0], [4, 3.0, 81, 1.0],
  [5, 0.0, 79, 1.5], [5, 2.0, 76, 1.5],
  [6, 0.0, 72, 1.0], [6, 1.0, 76, 1.0], [6, 2.0, 79, 1.0], [6, 3.0, 84, 1.0],
  [7, 0.0, 81, 3.0], [7, 3.0, 79, 1.0],
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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.15 }) {
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

// ---- SFX（每个 ≤0.6s）----

const SFX = {
  switch(ctx, out, t0) { // 车道切换：短促 blip 上行
    tone(ctx, out, { t0, dur: 0.08, freq: 520, freqEnd: 780, type: 'square', vol: 0.3, attack: 0.002 });
  },
  collect(ctx, out, t0) { // 香蕉：弹跳 pop
    tone(ctx, out, { t0, dur: 0.09, freq: 720, freqEnd: 1080, type: 'sine', vol: 0.42, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.1, freq: 1080, freqEnd: 1320, type: 'sine', vol: 0.28, attack: 0.002 });
  },
  shield(ctx, out, t0) { // 护盾：三连上行
    [72, 76, 81].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  spark(ctx, out, t0) { // 火花：玻璃闪光
    tone(ctx, out, { t0, dur: 0.16, freq: 1560, freqEnd: 2100, type: 'sine', vol: 0.24, attack: 0.002 });
  },
  rushStart(ctx, out, t0) { // 冲刺：扫频上行
    noise(ctx, out, { t0, dur: 0.5, vol: 0.3, type: 'bandpass', freq: 500, freqEnd: 4000, q: 2 });
    tone(ctx, out, { t0, dur: 0.5, freq: 220, freqEnd: 880, type: 'sawtooth', vol: 0.18, attack: 0.01 });
  },
  rushEnd(ctx, out, t0) { // 冲刺结束：扫频下行
    noise(ctx, out, { t0, dur: 0.3, vol: 0.42, type: 'bandpass', freq: 3200, freqEnd: 500, q: 2 });
    tone(ctx, out, { t0, dur: 0.3, freq: 900, freqEnd: 300, type: 'triangle', vol: 0.3, attack: 0.004 });
  },
  smash(ctx, out, t0) { // 撞碎：噪声爆发
    noise(ctx, out, { t0, dur: 0.28, vol: 0.5, type: 'lowpass', freq: 2400, freqEnd: 300, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.16, freq: 160, freqEnd: 70, type: 'triangle', vol: 0.32, attack: 0.003 });
  },
  nearMiss(ctx, out, t0) { // 擦身：whoosh
    noise(ctx, out, { t0, dur: 0.18, vol: 0.45, type: 'bandpass', freq: 800, freqEnd: 2400, q: 1.5 });
    tone(ctx, out, { t0, dur: 0.16, freq: 500, freqEnd: 900, type: 'sine', vol: 0.28, attack: 0.003 });
  },
  death(ctx, out, t0) { // 撞车：闷 thud + 噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 130, freqEnd: 50, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  tierUp(ctx, out, t0) { // 升档：五音 jingle
    [69, 72, 76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'square', vol: 0.22, attack: 0.003 });
    });
  },
};

const SFX_EVENT_MAP = {
  switch: 'switch',
  collect: 'collect',
  shield: 'shield',
  spark: 'spark',
  rushStart: 'rushStart',
  rushEnd: 'rushEnd',
  smash: 'smash',
  nearMiss: 'nearMiss',
  death: 'death',
  tierUp: 'tierUp',
};

export function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环的编排（8 小节，无缝循环）----

function woodblock(ctx, out, { t0, vol = 0.34 }) {
  return noise(ctx, out, { t0, dur: 0.045, vol, type: 'bandpass', freq: 2400, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.26, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.26 });
}

function leadNote(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.16, attack: 0.003, release: Math.min(dur, 0.22) });
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
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.34 : 0.22 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar) push(leadNote(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    p.setValueAtTime(DUCK_GAIN, t + 0.85);
    p.linearRampToValueAtTime(1, t + 1.0);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'death') duckBgm();
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

export { BPM, BEAT, BAR, BGM_BARS, BGM_LOOP, SFX_EVENT_MAP };
