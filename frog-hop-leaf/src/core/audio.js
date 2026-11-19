// FROG HOP LEAF · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：池塘跳跃感，BPM 104，C 大调进行 C–G–Am–F（每和弦 1 小节），共 8 小节无缝循环。
// 三层编制：贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=马林巴感正弦短衰减 + 木鱼噪声点。
// SFX：jump/land/firefly/combo/golden/spring/win/lose/bubble，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 104;
const BEAT = 60 / BPM;            // ≈0.5769s
const BAR = BEAT * 4;             // ≈2.3077s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;  // ≈18.46s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
  { root: 45, pad: [52, 57] }, // Am
  { root: 41, pad: [48, 53] }, // F
];

const MELODY = [
  [0, 0.0, 72, 1.0], [0, 1.0, 76, 1.0], [0, 2.0, 79, 1.0], [0, 3.0, 76, 1.0],
  [1, 0.0, 74, 1.0], [1, 1.0, 71, 1.0], [1, 2.0, 74, 1.0], [1, 3.0, 79, 1.0],
  [2, 0.0, 72, 1.0], [2, 1.0, 76, 1.0], [2, 2.0, 81, 1.0], [2, 3.0, 79, 1.0],
  [3, 0.0, 77, 1.0], [3, 1.0, 72, 1.0], [3, 2.0, 74, 1.0], [3, 3.0, 77, 1.0],
  [4, 0.0, 76, 1.0], [4, 1.0, 79, 1.0], [4, 2.0, 84, 1.0], [4, 3.0, 79, 1.0],
  [5, 0.0, 74, 1.0], [5, 1.0, 79, 1.0], [5, 2.0, 83, 1.0], [5, 3.0, 79, 1.0],
  [6, 0.0, 72, 1.0], [6, 1.0, 76, 1.0], [6, 2.0, 81, 1.0], [6, 3.0, 76, 1.0],
  [7, 0.0, 71, 1.0], [7, 1.0, 74, 1.0], [7, 2.0, 79, 1.0], [7, 3.0, 72, 1.0],
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
    const att = 0.05;
    const rel = 0.15;
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
  jump(ctx, out, t0) { // 青蛙「啵」上跳
    tone(ctx, out, { t0, dur: 0.18, freq: 320, freqEnd: 720, type: 'triangle', vol: 0.5, attack: 0.003 });
  },
  land(ctx, out, t0) { // 软着陆
    tone(ctx, out, { t0, dur: 0.1, freq: 200, freqEnd: 130, type: 'sine', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.06, vol: 0.14, type: 'lowpass', freq: 700, q: 1 });
  },
  firefly(ctx, out, t0, payload) { // 萤火虫上行小音
    const step = payload && payload.combo ? Math.min(6, payload.combo - 1) : 0;
    tone(ctx, out, { t0, dur: 0.22, freq: midi(76 + step), type: 'sine', vol: 0.32, attack: 0.003 });
  },
  golden(ctx, out, t0) { // 金叶闪光三连
    [79, 83, 86].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.26, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.003 });
    });
  },
  spring(ctx, out, t0) { // 弹簧「boing」
    tone(ctx, out, { t0, dur: 0.3, freq: 260, freqEnd: 900, type: 'square', vol: 0.24, attack: 0.003 });
  },
  win(ctx, out, t0) { // 五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 闷 thud + 短噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
  bubble(ctx, out, t0) { // 气泡 blip
    tone(ctx, out, { t0, dur: 0.09, freq: 1100, freqEnd: 620, type: 'sine', vol: 0.32, attack: 0.002 });
  },
  wall(ctx, out, t0) { // 碰墙轻 tick
    tone(ctx, out, { t0, dur: 0.05, freq: 500, type: 'sine', vol: 0.2, attack: 0.002 });
  },
};

// 事件名 → SFX。注意：combo 走 event() 里的门控（combo>=2 才响），不进这张表，否则门控失效。
const SFX_EVENT_MAP = {
  jump: 'jump',
  land: 'land',
  firefly: 'firefly',
  golden: 'golden',
  spring: 'spring',
  win: 'win',
  lose: 'lose',
  bubbleSpawn: 'bubble',
  wallBounce: 'wall',
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
function woodblock(ctx, out, { t0, vol = 0.3 }) {
  return noise(ctx, out, { t0, dur: 0.045, vol, type: 'bandpass', freq: 2400, q: 5 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.3, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}
function marimba(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.2, attack: 0.003, release: Math.min(dur, 0.3) });
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
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.3 : 0.22 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    push(padNote(ctx, bus, { t0: barT, dur: BAR, freqs: chord.pad }));
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
    if (sfx) {
      scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    } else if (name === 'combo' && payload && payload.combo >= 2) {
      scheduleSfx(ctx, sfxBus, 'firefly', payload, ctx.currentTime);
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
