// SPIN PINGPONG · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机 synthwave，BPM 120，A 小调进行 Am–F–C–G（每和弦 2 小节）。
// 前 4 小节无主音 / 后 4 小节方波琶音进入，共 8 小节无缝循环（相位连续）。
// 四层编制：打击点=短噪声木鱼、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、琶音=方波。
// SFX：countdown/memorizeStart/memorizeEnd/peek/predict/bounce/correct/wrong/win/lose，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm*/scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 一拍 ≈0.5s
const BAR = BEAT * 4;             // 一小节 2s
const BGM_BARS = 8;               // 4 小节垫 + 4 小节琶音
const BGM_LOOP = BAR * BGM_BARS;  // 16s 无缝循环

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A 小调进行：Am–F–C–G（root=贝斯根音，pad=双音垫）
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// 琶音（后 4 小节）：[小节偏移, 拍, MIDI, 持续拍数]
const ARP = [
  [4, 0.0, 69, 0.5], [4, 0.5, 72, 0.5], [4, 1.0, 76, 0.5], [4, 1.5, 72, 0.5],
  [4, 2.0, 69, 0.5], [4, 2.5, 72, 0.5], [4, 3.0, 76, 0.5], [4, 3.5, 81, 0.5],
  [5, 0.0, 65, 0.5], [5, 0.5, 69, 0.5], [5, 1.0, 72, 0.5], [5, 1.5, 69, 0.5],
  [5, 2.0, 65, 0.5], [5, 2.5, 69, 0.5], [5, 3.0, 72, 0.5], [5, 3.5, 77, 0.5],
  [6, 0.0, 72, 0.5], [6, 0.5, 76, 0.5], [6, 1.0, 79, 0.5], [6, 1.5, 76, 0.5],
  [6, 2.0, 72, 0.5], [6, 2.5, 76, 0.5], [6, 3.0, 79, 0.5], [6, 3.5, 84, 0.5],
  [7, 0.0, 67, 0.5], [7, 0.5, 71, 0.5], [7, 1.0, 74, 0.5], [7, 1.5, 71, 0.5],
  [7, 2.0, 67, 0.5], [7, 2.5, 71, 0.5], [7, 3.0, 74, 0.5], [7, 3.5, 79, 0.5],
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

// ---- SFX 合成（每个都短 ≤0.6s）----

const SFX = {
  countdown(ctx, out, t0) { // 倒计时 beep 880Hz
    tone(ctx, out, { t0, dur: 0.09, freq: 880, type: 'square', vol: 0.24, attack: 0.003 });
  },
  memorizeStart(ctx, out, t0) { // 上扫提示
    tone(ctx, out, { t0, dur: 0.22, freq: 500, freqEnd: 1100, type: 'sine', vol: 0.22, attack: 0.01 });
  },
  memorizeEnd(ctx, out, t0) { // 轻 click
    tone(ctx, out, { t0, dur: 0.05, freq: 1200, type: 'sine', vol: 0.16, attack: 0.002 });
  },
  peek(ctx, out, t0) { // 明亮 blip
    tone(ctx, out, { t0, dur: 0.1, freq: 1400, freqEnd: 2000, type: 'triangle', vol: 0.24, attack: 0.003 });
  },
  predict(ctx, out, t0) { // 陶土 thunk
    tone(ctx, out, { t0, dur: 0.12, freq: 220, freqEnd: 150, type: 'triangle', vol: 0.3, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.06, vol: 0.14, type: 'lowpass', freq: 700, q: 1 });
  },
  bounce(ctx, out, t0) { // 弹跳 ping
    tone(ctx, out, { t0, dur: 0.08, freq: 1500, freqEnd: 900, type: 'sine', vol: 0.2, attack: 0.002 });
  },
  correct(ctx, out, t0) { // 双音上扬
    tone(ctx, out, { t0, dur: 0.1, freq: 660, type: 'triangle', vol: 0.22, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.09, dur: 0.12, freq: 990, type: 'triangle', vol: 0.22, attack: 0.003 });
  },
  wrong(ctx, out, t0) { // 闷 thud
    tone(ctx, out, { t0, dur: 0.3, freq: 130, freqEnd: 60, type: 'sine', vol: 0.4, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.15, vol: 0.2, type: 'lowpass', freq: 500, q: 1 });
  },
  win(ctx, out, t0) { // 上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.24, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 下行
    [72, 67, 60].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.12, dur: 0.2, freq: midi(m), type: 'sine', vol: 0.22, attack: 0.004 });
    });
  },
};

const SFX_EVENT_MAP = {
  countdownTick: 'countdown',
  memorizeStart: 'memorizeStart',
  memorizeEnd: 'memorizeEnd',
  peek: 'peek',
  predict: 'predict',
  bounce: 'bounce',
  correct: 'correct',
  wrong: 'wrong',
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

// ---- BGM 一个循环的编排（8 小节，t0 起始，采样精确、无缝）----

function woodblock(ctx, out, { t0, vol = 0.36 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'bandpass', freq: 2400, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.28, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.28 });
}

function arpNote(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.11, attack: 0.004, release: Math.min(dur, 0.12) });
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
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.36 : 0.24 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 4) {
      for (const [mBar, beat, m, durBeats] of ARP) {
        if (mBar === bar) push(arpNote(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.12);
    p.setValueAtTime(DUCK_GAIN, t + 2.4);
    p.linearRampToValueAtTime(1, t + 2.55);
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
