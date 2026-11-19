// PENGUIN PAL · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：轻快北极小调，BPM 96，C 大调 C–Am–F–G，8 小节无缝循环。
// 三层：贝斯三角波根音、和弦垫双音锯齿 LPF、主音正弦短衰减（马林巴感）。
// SFX：tap/feed/wash/rest/play/train/work/buy/combo/levelup/win/denied，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏渲染复验。

export const BPM = 96;
export const BEAT = 60 / BPM;             // 一拍 ≈0.625s
export const BAR = BEAT * 4;              // 一小节 2.5s
export const BGM_BARS = 8;                // 8 小节
export const BGM_LOOP = BAR * BGM_BARS;   // 一个循环 20s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-9);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（C 大调）：root=贝斯根音，pad=和弦垫
const CHORDS = [
  { root: 48, pad: [55, 60, 64] }, // C
  { root: 45, pad: [52, 57, 60] }, // Am
  { root: 41, pad: [48, 53, 57] }, // F
  { root: 43, pad: [50, 55, 59] }, // G
];

// 主音：[小节内, 拍, MIDI, 持续拍]
const MELODY = [
  [0, 0, 76, 1.5], [0, 2, 79, 1.5],
  [1, 0, 81, 2.0], [1, 2, 79, 1.5],
  [2, 0, 76, 1.5], [2, 2, 72, 1.5],
  [3, 0, 74, 2.0], [3, 2, 71, 1.5],
  [4, 0, 76, 1.5], [4, 2, 79, 1.5],
  [5, 0, 84, 2.0], [5, 2, 81, 1.5],
  [6, 0, 79, 1.5], [6, 2, 76, 1.5],
  [7, 0, 72, 3.0],
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

function noise(ctx, out, { t0, dur, vol = 0.3, type = 'bandpass', freq = 2000, q = 1 }) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(Math.max(1, freq), t0);
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
    lp.frequency.value = 1400;
    lp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.05);
    g.gain.setValueAtTime(vol, t0 + dur - 0.18);
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

// ---- BGM 编排（导出供离线渲染）----

export function scheduleBgmLoop(ctx, out, t0) {
  const nodes = [];
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % CHORDS.length];
    const t = t0 + bar * BAR;
    // 贝斯
    nodes.push(...tone(ctx, out, { t0: t, dur: BAR * 0.98, freq: midi(chord.root - 12), type: 'triangle', vol: 0.28 }));
    // 和弦垫
    nodes.push(...padNote(ctx, out, { t0: t, dur: BAR * 0.98, freqs: chord.pad, vol: 0.12 }));
  }
  // 主音（后半段进入，像企鹅哼歌）
  for (const [bar, beat, note, beats] of MELODY) {
    const t = t0 + bar * BAR + beat * BEAT;
    nodes.push(...tone(ctx, out, { t0: t, dur: beats * BEAT, freq: midi(note), type: 'sine', vol: 0.22, attack: 0.004, release: beats * BEAT }));
  }
  return nodes;
}

// ---- SFX 合成（每个 ≤0.6s）----

export function scheduleSfx(ctx, out, name, t0) {
  switch (name) {
    case 'tap':
      tone(ctx, out, { t0, dur: 0.05, freq: 880, type: 'sine', vol: 0.3 });
      return;
    case 'feed':
      tone(ctx, out, { t0, dur: 0.08, freq: 320, freqEnd: 520, type: 'triangle', vol: 0.45 });
      noise(ctx, out, { t0, dur: 0.04, vol: 0.1, type: 'bandpass', freq: 1200, q: 3 });
      return;
    case 'wash':
      noise(ctx, out, { t0, dur: 0.28, vol: 0.3, type: 'bandpass', freq: 2600, q: 2, freqEnd: 1800 });
      return;
    case 'rest':
      tone(ctx, out, { t0, dur: 0.3, freq: 240, freqEnd: 180, type: 'sine', vol: 0.3 });
      return;
    case 'play':
      tone(ctx, out, { t0, dur: 0.1, freq: 520, type: 'triangle', vol: 0.4 });
      tone(ctx, out, { t0: t0 + 0.09, dur: 0.1, freq: 660, type: 'triangle', vol: 0.4 });
      return;
    case 'train':
      tone(ctx, out, { t0, dur: 0.09, freq: 440, type: 'sine', vol: 0.35 });
      tone(ctx, out, { t0: t0 + 0.09, dur: 0.12, freq: 587, type: 'sine', vol: 0.35 });
      return;
    case 'work':
      tone(ctx, out, { t0, dur: 0.08, freq: 196, type: 'square', vol: 0.22 });
      tone(ctx, out, { t0: t0 + 0.1, dur: 0.08, freq: 262, type: 'square', vol: 0.22 });
      return;
    case 'buy':
      tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'sine', vol: 0.35 });
      tone(ctx, out, { t0: t0 + 0.07, dur: 0.16, freq: 1320, type: 'sine', vol: 0.3 });
      return;
    case 'combo':
      tone(ctx, out, { t0, dur: 0.1, freq: 660, type: 'triangle', vol: 0.4 });
      tone(ctx, out, { t0: t0 + 0.06, dur: 0.14, freq: 880, type: 'triangle', vol: 0.4 });
      return;
    case 'levelup':
      tone(ctx, out, { t0, dur: 0.12, freq: 523, type: 'sine', vol: 0.4 });
      tone(ctx, out, { t0: t0 + 0.1, dur: 0.14, freq: 659, type: 'sine', vol: 0.4 });
      tone(ctx, out, { t0: t0 + 0.2, dur: 0.24, freq: 784, type: 'sine', vol: 0.4 });
      return;
    case 'win':
      tone(ctx, out, { t0, dur: 0.14, freq: 523, type: 'sine', vol: 0.42 });
      tone(ctx, out, { t0: t0 + 0.12, dur: 0.14, freq: 659, type: 'sine', vol: 0.42 });
      tone(ctx, out, { t0: t0 + 0.24, dur: 0.14, freq: 784, type: 'sine', vol: 0.42 });
      tone(ctx, out, { t0: t0 + 0.36, dur: 0.3, freq: 1047, type: 'sine', vol: 0.42 });
      return;
    case 'denied':
      tone(ctx, out, { t0, dur: 0.16, freq: 200, type: 'square', vol: 0.2 });
      return;
    default:
      tone(ctx, out, { t0, dur: 0.05, freq: 660, type: 'sine', vol: 0.2 });
  }
}

// ---- 事件 → SFX 映射（供 createAudio().event 使用）----
const SFX_EVENT_MAP = {
  tap: 'tap',
  feed: 'feed',
  wash: 'wash',
  rest: 'rest',
  play: 'play',
  train: 'train',
  work: 'work',
  buy: 'buy',
  combo: 'combo',
  levelup: 'levelup',
  win: 'win',
  denied: 'denied',
};

export function createAudio({ createContext }) {
  let ctx = null;
  let master = null;
  let sfxBus = null;
  let bgmBus = null;
  let muted = false;
  let bgmStarted = false;
  let nextLoopAt = 0;

  function ensure() {
    if (ctx) return true;
    try {
      ctx = createContext ? createContext() : new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = muted ? 0 : 1;
      master.connect(ctx.destination);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = SFX_GAIN;
      sfxBus.connect(master);
      bgmBus = ctx.createGain();
      bgmBus.gain.value = BGM_GAIN;
      bgmBus.connect(master);
      return true;
    } catch {
      ctx = null;
      return false;
    }
  }

  function now() {
    return ctx ? ctx.currentTime : 0;
  }

  function playSfx(name) {
    if (!ensure() || muted) return;
    scheduleSfx(ctx, sfxBus, name, now());
  }

  function startBgm() {
    if (!ensure() || bgmStarted) return;
    bgmStarted = true;
    nextLoopAt = now() + 0.05;
    const schedule = () => {
      if (!ctx || !bgmStarted) return;
      const loopDur = BGM_LOOP;
      while (nextLoopAt < ctx.currentTime + loopDur * 1.2) {
        scheduleBgmLoop(ctx, bgmBus, nextLoopAt);
        nextLoopAt += loopDur;
      }
    };
    schedule();
    // 用一个轻量定时器持续排布下一圈（浏览器用 setInterval，离线渲染则一次性已排满）
    if (typeof window !== 'undefined' && !createContext) {
      const iv = setInterval(schedule, 4000);
      stateTimers.push(iv);
    }
  }

  const stateTimers = [];

  function stopBgm() {
    bgmStarted = false;
  }

  return {
    get muted() { return muted; },
    setMuted(m) {
      muted = !!m;
      if (master) master.gain.value = muted ? 0 : 1;
    },
    toggleMuted() {
      this.setMuted(!muted);
      return muted;
    },
    event(name, payload = {}) {
      if (muted) return;
      if (name === 'bgmStart') { startBgm(); return; }
      const sfx = SFX_EVENT_MAP[name];
      if (sfx) playSfx(sfx);
    },
    startBgm,
    stopBgm,
    _ctx() { return ctx; },
  };
}
