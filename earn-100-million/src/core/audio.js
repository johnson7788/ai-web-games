// EARN 100 MILLION · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹 city-pop 轻快，BPM 108，Am–F–C–G 进行，16 小节无缝循环。
// SFX：buy/sell/profit/year/event/win/retire/company/date/marry/bet/treat/hospital/bankrupt/click，全部 ≤0.6s。
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

export const BPM = 108;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
export const BGM_BARS = 16;
export const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-9);
const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { root: 45, pad: [52, 57] }, // Am
  { root: 41, pad: [48, 53] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

const MELODY = [
  [0, 0.0, 76, 1.5], [0, 2.0, 79, 1.5], [0, 3.5, 84, 0.5],
  [1, 0.0, 79, 2.0], [1, 2.0, 76, 2.0],
  [2, 0.0, 72, 1.5], [2, 2.0, 76, 1.5], [2, 3.5, 79, 0.5],
  [3, 0.0, 81, 3.0], [3, 3.0, 79, 1.0],
  [4, 0.0, 77, 1.5], [4, 2.0, 76, 1.5], [4, 3.5, 72, 0.5],
  [5, 0.0, 69, 2.0], [5, 2.0, 72, 2.0],
  [6, 0.0, 74, 1.5], [6, 2.0, 71, 1.5], [6, 3.5, 67, 0.5],
  [7, 0.0, 72, 3.5], [7, 3.5, 67, 0.5],
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

// BGM：循环编排，返回节点数组（供 bgmActive 收集与离屏渲染）
export function scheduleBgmLoop(ctx, out, t0) {
  const nodes = [];
  const chordsPerBar = 1;
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % CHORDS.length];
    const t = t0 + bar * BAR;
    // 贝斯
    nodes.push(...tone(ctx, out, { t0: t, dur: BAR * 0.95, freq: midi(chord.root), type: 'triangle', vol: 0.22 }));
    // 和弦垫
    for (const p of chord.pad) {
      nodes.push(...tone(ctx, out, { t0: t, dur: BAR * 0.95, freq: midi(p), type: 'sawtooth', vol: 0.07, attack: 0.08, release: BAR * 0.9 }));
    }
    // 打击木鱼
    for (let b = 0; b < 4; b += 1) {
      nodes.push(...noise(ctx, out, { t0: t + b * BEAT, dur: 0.04, vol: 0.18, type: 'highpass', freq: 6000, q: 1 }));
    }
  }
  // 主音（后 8 小节）
  for (const [bar, beat, note, dur] of MELODY) {
    const t = t0 + (bar + 8) * BAR + beat * BEAT;
    nodes.push(...tone(ctx, out, { t0: t, dur: dur * BEAT * 0.9, freq: midi(note), type: 'sine', vol: 0.16, attack: 0.005 }));
  }
  return nodes;
}

const SFX_FN = {
  buy(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.09, freq: 520, freqEnd: 780, type: 'triangle', vol: 0.4 }); },
  sell(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.09, freq: 780, freqEnd: 520, type: 'triangle', vol: 0.4 }); },
  profit(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.12, freq: 880, type: 'sine', vol: 0.4 }); tone(ctx, out, { t0: t0 + 0.06, dur: 0.14, freq: 1320, type: 'sine', vol: 0.3 }); },
  combo(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.1, freq: 660, freqEnd: 990, type: 'square', vol: 0.22 }); },
  year(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.18, vol: 0.24, type: 'bandpass', freq: 900, freqEnd: 300, q: 1.5 }); },
  event(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.2, freq: 440, freqEnd: 440, type: 'sine', vol: 0.3 }); tone(ctx, out, { t0: t0 + 0.12, dur: 0.2, freq: 554, type: 'sine', vol: 0.3 }); },
  win(ctx, out, t0) { [523, 659, 784, 1047].forEach((f, i) => tone(ctx, out, { t0: t0 + i * 0.12, dur: 0.3, freq: f, type: 'triangle', vol: 0.4 })); },
  retire(ctx, out, t0) { [392, 330, 262].forEach((f, i) => tone(ctx, out, { t0: t0 + i * 0.14, dur: 0.3, freq: f, type: 'triangle', vol: 0.32 })); },
  company(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'bandpass', freq: 1200, q: 2 }); tone(ctx, out, { t0, dur: 0.2, freq: 220, freqEnd: 330, type: 'square', vol: 0.16 }); },
  dividend(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.1, freq: 1200, type: 'sine', vol: 0.26 }); },
  milestone(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.25, freq: 740, freqEnd: 1480, type: 'sine', vol: 0.32 }); },
  date(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.12, freq: 660, type: 'sine', vol: 0.3 }); tone(ctx, out, { t0: t0 + 0.08, dur: 0.12, freq: 880, type: 'sine', vol: 0.3 }); },
  marry(ctx, out, t0) { [523, 659, 784, 1047, 1319].forEach((f, i) => tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.3, freq: f, type: 'sine', vol: 0.34 })); },
  bet(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.15, vol: 0.28, type: 'bandpass', freq: 2000, freqEnd: 500, q: 3 }); },
  treat(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.2, freq: 300, freqEnd: 600, type: 'sine', vol: 0.3 }); },
  hospital(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.35, freq: 220, freqEnd: 160, type: 'sawtooth', vol: 0.24 }); },
  bankrupt(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.4, freq: 300, freqEnd: 90, type: 'sawtooth', vol: 0.28 }); },
  recover(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.18, freq: 500, freqEnd: 800, type: 'sine', vol: 0.26 }); },
  mood(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.1, vol: 0.16, type: 'bandpass', freq: 1500, q: 2 }); },
  skill(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.14, freq: 900, freqEnd: 1400, type: 'triangle', vol: 0.3 }); },
  click(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.04, vol: 0.2, type: 'bandpass', freq: 2400, q: 4 }); },
};

export function createAudio(opts = {}) {
  let ctx = null;
  let bgmNodes = [];
  let muted = false;
  let bgmOn = false;
  let bgmTimer = null;
  const master = opts.master || null;

  function ensure() {
    if (ctx) return ctx;
    if (typeof opts.createContext === 'function') {
      ctx = opts.createContext();
      return ctx;
    }
    const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
    if (!AC) return null;
    ctx = new AC();
    return ctx;
  }
  function unlock() {
    const c = ensure();
    if (c && c.state === 'suspended') c.resume();
  }
  function outBus() {
    const c = ensure();
    if (!c) return null;
    if (master) return master;
    const g = c.createGain();
    g.gain.value = muted ? 0 : 1;
    g.connect(c.destination);
    return g;
  }
  function sfx(name) {
    if (muted) return;
    const c = ensure();
    if (!c) return;
    const bus = c.createGain();
    bus.gain.value = SFX_GAIN;
    bus.connect(c.destination);
    const fn = SFX_FN[name];
    if (fn) fn(c, bus, c.currentTime);
  }
  return {
    event(type) { sfx(type); },
    sfx(name) { sfx(name); },
    unlock,
    setMuted(m) { muted = !!m; },
    get muted() { return muted; },
    startBgm() {
      if (bgmOn) return;
      const c = ensure();
      if (!c || muted) return;
      bgmOn = true;
      const bus = c.createGain();
      bus.gain.value = BGM_GAIN;
      bus.connect(c.destination);
      let next = c.currentTime + 0.05;
      const loop = (t0) => { bgmNodes.push(...scheduleBgmLoop(c, bus, t0)); };
      loop(next);
      next += BGM_LOOP;
      // 无缝循环：按绝对时间补排，相位连续
      bgmTimer = setInterval(() => {
        if (!bgmOn) { clearInterval(bgmTimer); bgmTimer = null; return; }
        loop(next);
        next += BGM_LOOP;
      }, BGM_LOOP * 1000);
    },
    stopBgm() {
      bgmOn = false;
      if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
      bgmNodes = [];
    },
  };
}
