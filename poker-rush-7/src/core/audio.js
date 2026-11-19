// POKER RUSH 7 · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹街机 synthwave，BPM 100，A 小调进行 Am–F–C–G（每和弦 1 小节）。
// 四层编制：鼓点=短噪声 kick/hat、贝斯=锯齿根音、和弦垫=双音锯齿轻 LPF、主音=方波短衰减。
// SFX：tap/wrong/rock/miss/combo/win/lose/reveal/go，全部 ≤0.6s。
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx / SFX_EVENT_MAP 与常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 一拍 ≈0.6s
const BAR = BEAT * 4;             // 一小节 ≈2.4s
const BGM_BARS = 8;               // 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 ≈19.2s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A 小调进行：Am–F–C–G（每和弦 2 小节）
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [55, 59] }, // G
];

const MELODY = [
  [0, 0.0, 81, 0.5], [0, 0.5, 84, 0.5], [0, 1.0, 88, 1.0],
  [1, 0.0, 79, 0.5], [1, 0.5, 84, 0.5], [1, 1.0, 81, 1.0],
  [2, 0.0, 76, 0.5], [2, 0.5, 79, 0.5], [2, 1.0, 84, 1.0],
  [3, 0.0, 83, 1.5], [3, 1.5, 79, 0.5],
  [4, 0.0, 81, 0.5], [4, 0.5, 79, 0.5], [4, 1.0, 76, 1.0],
  [5, 0.0, 72, 1.0], [5, 1.0, 76, 1.0],
  [6, 0.0, 74, 0.5], [6, 0.5, 76, 0.5], [6, 1.0, 79, 1.0],
  [7, 0.0, 81, 2.0],
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

// ---- SFX 合成（每个都短 ≤0.6s）----
const SFX = {
  tap(ctx, out, t0) { // 霓虹点中 blip（上行小二度）
    tone(ctx, out, { t0, dur: 0.09, freq: 900, freqEnd: 1350, type: 'square', vol: 0.28, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.04, vol: 0.12, type: 'highpass', freq: 4000, q: 2 });
  },
  wrong(ctx, out, t0) { // 低沉 buzz 下坠
    tone(ctx, out, { t0, dur: 0.22, freq: 220, freqEnd: 90, type: 'sawtooth', vol: 0.32, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.14, vol: 0.18, type: 'lowpass', freq: 900, q: 1 });
  },
  rock(ctx, out, t0) { // 岩石 thud（低频噪声爆发）
    noise(ctx, out, { t0, dur: 0.28, vol: 0.42, type: 'lowpass', freq: 2400, freqEnd: 260, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.16, freq: 120, freqEnd: 60, type: 'sine', vol: 0.3, attack: 0.004 });
  },
  miss(ctx, out, t0) { // 漏接 whoosh 下扫
    tone(ctx, out, { t0, dur: 0.3, freq: 700, freqEnd: 180, type: 'sine', vol: 0.24, attack: 0.006 });
  },
  combo(ctx, out, t0, payload) { // 连击里程碑上行琶音，音高随 combo 递进
    const c = payload && typeof payload.combo === 'number' ? payload.combo : 10;
    const shift = Math.min(Math.floor(c / 10), 7);
    const base = 76 + shift;
    [0, 3, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.22, freq: midi(base + iv), type: 'square', vol: 0.24, attack: 0.003 });
    });
  },
  win(ctx, out, t0) { // 五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 120Hz 闷 thud + 短噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 52, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  reveal(ctx, out, t0) { // 目标亮出：柔和双音
    tone(ctx, out, { t0, dur: 0.14, freq: 660, type: 'sine', vol: 0.2, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.16, freq: 880, type: 'sine', vol: 0.2, attack: 0.004 });
  },
  go(ctx, out, t0) { // 开始冲锋短促 kick + 高音
    tone(ctx, out, { t0, dur: 0.09, freq: 120, freqEnd: 70, type: 'sine', vol: 0.34, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.04, dur: 0.12, freq: 1320, type: 'square', vol: 0.2, attack: 0.002 });
  },
  countdown(ctx, out, t0) { // 最后 5s 每秒 beep
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.24, attack: 0.003 });
  },
};

// 事件名 → SFX 映射（countdownTick 特殊门控，不进这里）
const SFX_EVENT_MAP = {
  tapCorrect: 'tap',
  tapWrong: 'wrong',
  tapRock: 'rock',
  miss: 'miss',
  combo: 'combo',
  win: 'win',
  lose: 'lose',
  reveal: 'reveal',
  playStart: 'go',
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
function kick(ctx, out, { t0, vol = 0.4 }) {
  return tone(ctx, out, { t0, dur: 0.16, freq: 130, freqEnd: 48, type: 'sine', vol, attack: 0.003 });
}
function hat(ctx, out, { t0, vol = 0.16 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 8000, q: 1 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.24, freq: midi(midiNote), type: 'sawtooth', vol: 0.26, attack: 0.005, release: 0.24 });
}
function leadNote(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.16, attack: 0.003, release: Math.min(dur, 0.3) });
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
      push(kick(ctx, bus, { t0: bt, vol: b % 2 === 0 ? 0.4 : 0.26 }));
      push(hat(ctx, bus, { t0: bt + BEAT * 0.5, vol: 0.15 }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
    }
    push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar - 4) push(leadNote(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    p.setValueAtTime(DUCK_GAIN, t + 2.6);
    p.linearRampToValueAtTime(1, t + 2.9);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) {
      scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    } else if (name === 'countdownTick') {
      const left = payload && payload.timeLeft;
      if (typeof left === 'number' && left > 0 && left <= 5) {
        scheduleSfx(ctx, sfxBus, 'countdown', payload, ctx.currentTime);
      }
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
