// LINK LINE PAIR · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹合成波，BPM 100，Am–F–C–G 进行，8 小节无缝循环（相位连续）。
// SFX：select/connect/combo/miss/rock/undo/hint/win/lose，全部 ≤0.6s。
// countdownTick 是带门控的负例事件，刻意不进 SFX_EVENT_MAP。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 0.6s
const BAR = BEAT * 4;             // 2.4s
const BGM_BARS = 8;               // 一个循环 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 19.2s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Am – F – C – G（每和弦 2 小节）
const CHORDS = [
  { root: 45, pad: [57, 60, 64], arp: [57, 60, 64, 69, 64, 60] },
  { root: 41, pad: [53, 57, 60], arp: [53, 57, 60, 65, 60, 57] },
  { root: 48, pad: [52, 55, 60], arp: [52, 55, 60, 64, 60, 55] },
  { root: 43, pad: [50, 55, 59], arp: [50, 55, 59, 62, 59, 55] },
];

// ---- 低层合成 ----
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
    lp.Q.value = 0.6;
    const att = 0.08;
    const rel = 0.25;
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

// ---- SFX ----
const SFX = {
  select(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.06, freq: 1200, freqEnd: 1500, type: 'sine', vol: 0.4, attack: 0.002 });
  },
  connect(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.12, freq: 660, type: 'triangle', vol: 0.42, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.14, freq: 880, type: 'triangle', vol: 0.36, attack: 0.003 });
  },
  combo(ctx, out, t0, payload) {
    const step = Math.min(Math.max(0, (payload && payload.combo || 2) - 2), 6);
    tone(ctx, out, { t0, dur: 0.1, freq: midi(72 + step), type: 'sine', vol: 0.3, attack: 0.002 });
  },
  miss(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.18, freq: 220, freqEnd: 140, type: 'square', vol: 0.2, attack: 0.004 });
  },
  rock(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.22, vol: 0.34, type: 'lowpass', freq: 900, freqEnd: 180, q: 1.1 });
    tone(ctx, out, { t0, dur: 0.14, freq: 130, freqEnd: 60, type: 'sine', vol: 0.3, attack: 0.004 });
  },
  undo(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.16, freq: 900, freqEnd: 400, type: 'sine', vol: 0.3, attack: 0.003 });
  },
  hint(ctx, out, t0) {
    [76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.22, freq: midi(m), type: 'sine', vol: 0.24, attack: 0.003 });
    });
  },
  win(ctx, out, t0) {
    [72, 76, 79, 84, 88, 91].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.003 });
    });
  },
  lose(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.35, freq: 160, freqEnd: 55, type: 'sine', vol: 0.4, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.22, type: 'lowpass', freq: 500, q: 1 });
  },
  countdown(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.24, attack: 0.003 });
  },
};

// countdownTick 故意不在映射里：由 event() 单独按 timeLeft 门控。
const SFX_EVENT_MAP = {
  select: 'select',
  connect: 'connect',
  combo: 'combo',
  miss: 'miss',
  rock: 'rock',
  undo: 'undo',
  hint: 'hint',
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

// ---- BGM 循环编排 ----
function kick(ctx, out, { t0 }) {
  return tone(ctx, out, { t0, dur: 0.16, freq: 150, freqEnd: 45, type: 'sine', vol: 0.5, attack: 0.002 });
}
function hat(ctx, out, { t0 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol: 0.14, type: 'highpass', freq: 6000, q: 1 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.32, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}
function arp(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.1, attack: 0.004, release: Math.min(dur, 0.2) });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect && Array.isArray(srcs)) for (const s of srcs) collect.push(s); };

  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
      push(kick(ctx, bus, { t0: bt }));
      if (b % 2 === 1) push(hat(ctx, bus, { t0: bt }));
      // 琶音：每拍 3 个 16 分音符
      for (let s = 0; s < 3; s += 1) {
        const n = chord.arp[(b * 3 + s) % chord.arp.length];
        push(arp(ctx, bus, { t0: bt + s * (BEAT / 3), midiNote: n, dur: BEAT / 3 }));
      }
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
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
