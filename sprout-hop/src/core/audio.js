// Sprout Hop · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：豆田轻快弹跳，BPM 116，G 大调进行 G–Em–C–D（每和弦 2 小节）。
// A 段 8 小节无主音 / B 段 8 小节主音进入，共 16 小节无缝循环（相位连续，不用 media 淡入淡出）。
// 四层编制：打击点=短噪声木鱼、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=马林巴感正弦短衰减。
// SFX：aim/launch/land/perfect/nearMiss/water/collapse/revive/win/lose/combo/flightTick，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 116;
const BEAT = 60 / BPM;            // 一拍秒数 ≈0.5172
const BAR = BEAT * 4;             // 一小节 ≈2.069s
const BGM_BARS = 16;              // A 段 8 + B 段 8
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 ≈33.1s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（G 大调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 43, pad: [55, 59] }, // G
  { root: 40, pad: [52, 55] }, // Em
  { root: 36, pad: [48, 52] }, // C
  { root: 38, pad: [50, 54] }, // D
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 71, 1.0], [0, 1.0, 74, 1.0], [0, 2.0, 78, 1.5], [0, 3.5, 74, 0.5],
  [1, 0.0, 76, 1.0], [1, 1.0, 74, 1.0], [1, 2.0, 71, 2.0],
  [2, 0.0, 67, 1.0], [2, 1.0, 71, 1.0], [2, 2.0, 74, 1.5], [2, 3.5, 71, 0.5],
  [3, 0.0, 74, 1.0], [3, 1.0, 76, 1.0], [3, 2.0, 78, 2.0],
  [4, 0.0, 79, 1.0], [4, 1.0, 78, 1.0], [4, 2.0, 74, 1.5], [4, 3.5, 71, 0.5],
  [5, 0.0, 69, 1.0], [5, 1.0, 71, 1.0], [5, 2.0, 74, 2.0],
  [6, 0.0, 76, 1.0], [6, 1.0, 78, 1.0], [6, 2.0, 81, 1.5], [6, 3.5, 78, 0.5],
  [7, 0.0, 79, 2.5], [7, 2.5, 74, 0.5], [7, 3.0, 71, 1.0],
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
    lp.frequency.value = 1600;
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

// ---- SFX 合成（每个都短 ≤0.6s）----

const SFX = {
  aim(ctx, out, t0) { // 藤蔓拉紧的吱呀（上行滑音）
    tone(ctx, out, { t0, dur: 0.28, freq: 180, freqEnd: 420, type: 'sine', vol: 0.22, attack: 0.02 });
  },
  launch(ctx, out, t0) { // 抽射：短噪声 + 快速上滑
    noise(ctx, out, { t0, dur: 0.1, vol: 0.34, type: 'bandpass', freq: 900, q: 1.4, freqEnd: 2600 });
    tone(ctx, out, { t0, dur: 0.18, freq: 240, freqEnd: 620, type: 'triangle', vol: 0.4, attack: 0.004 });
  },
  land(ctx, out, t0) { // 落地闷响
    tone(ctx, out, { t0, dur: 0.14, freq: 150, freqEnd: 90, type: 'triangle', vol: 0.45, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.2, type: 'lowpass', freq: 520, q: 1 });
  },
  perfect(ctx, out, t0) { // 完美：清脆三连上行
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.22, freq: midi(m), type: 'sine', vol: 0.3, attack: 0.003 });
    });
  },
  nearMiss(ctx, out, t0) { // 擦边：短促哨音
    tone(ctx, out, { t0, dur: 0.16, freq: 900, freqEnd: 700, type: 'square', vol: 0.16, attack: 0.004 });
  },
  water(ctx, out, t0) { // 落水：低频扫 + 噪声噗
    tone(ctx, out, { t0, dur: 0.5, freq: 500, freqEnd: 90, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.4, vol: 0.4, type: 'lowpass', freq: 1600, freqEnd: 220, q: 1 });
  },
  collapse(ctx, out, t0) { // 断藤：咔嗒 + 崩落
    noise(ctx, out, { t0, dur: 0.18, vol: 0.5, type: 'bandpass', freq: 2600, q: 5 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.4, freq: 180, freqEnd: 60, type: 'sawtooth', vol: 0.26, attack: 0.006 });
  },
  revive(ctx, out, t0) { // 发芽：上跳 blip
    tone(ctx, out, { t0, dur: 0.3, freq: 300, freqEnd: 760, type: 'sine', vol: 0.4, attack: 0.004 });
  },
  win(ctx, out, t0) { // 通关五音上行 jingle C-E-G-C-E
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：下坠闷响 + 水花
    tone(ctx, out, { t0, dur: 0.5, freq: 220, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
  combo(ctx, out, t0, payload) { // 连击：音高随连击递增
    const n = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const base = 76 + Math.min(8, n - 2) * 2;
    tone(ctx, out, { t0, dur: 0.16, freq: midi(base), type: 'sine', vol: 0.28, attack: 0.003 });
  },
  flightTick(ctx, out, t0) { // 飞行中的轻快气音（保持节奏感）
    tone(ctx, out, { t0, dur: 0.05, freq: 2600, freqEnd: 2000, type: 'sine', vol: 0.22, attack: 0.003 });
  },
};

// 事件名 → SFX 映射
const SFX_EVENT_MAP = {
  aim: 'aim',
  launch: 'launch',
  land: 'land',
  perfect: 'perfect',
  nearMiss: 'nearMiss',
  water: 'water',
  oob: 'lose',
  collapse: 'collapse',
  revive: 'revive',
  win: 'win',
  lose: 'lose',
  combo: 'combo',
  flightTick: 'flightTick',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环的编排（16 小节，t0 起始，采样精确、无缝）----

function woodblock(ctx, out, { t0, vol = 0.4 }) {
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
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.4 : 0.26 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(marimba(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
      }
    }
  }
  return collect;
}

// ---- 实时入口：createAudio() → { event, setMuted, startBgm, stopBgm, unlock } ----

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
    if (sfx) {
      scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    }
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
