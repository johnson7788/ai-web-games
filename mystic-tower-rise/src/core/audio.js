// Mystic Tower Rise · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：合成波爬塔，BPM 118，Am–F–C–G 进行（每和弦 2 小节），16 小节无缝循环。
// 编制：打击点=短噪声、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=正弦短衰减。
// SFX：step/pickup/door/fight/kill/combo/buy/stair/tele/talk/crystal/spike/win/lose，全部 ≤0.6s。
// 导出 createAudio()（实时）+ scheduleBgmLoop*/scheduleSfx* 与常量（供 tools/audio-check.mjs 离屏复验）。

const BPM = 118;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 16;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { root: 45, pad: [52, 57] }, // Am
  { root: 41, pad: [48, 53] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
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
  step(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.05, freq: 660, type: 'square', vol: 0.12, attack: 0.002 });
  },
  pickup(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.1, freq: 880, freqEnd: 1320, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  door(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.16, freq: 180, freqEnd: 110, type: 'triangle', vol: 0.4, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.16, type: 'lowpass', freq: 500, q: 1 });
  },
  fight(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.12, vol: 0.4, type: 'lowpass', freq: 2200, freqEnd: 500, q: 1 });
    tone(ctx, out, { t0, dur: 0.1, freq: 140, freqEnd: 80, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  kill(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.22, freq: 300, freqEnd: 60, type: 'sawtooth', vol: 0.28, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.18, vol: 0.22, type: 'bandpass', freq: 900, freqEnd: 200, q: 1 });
  },
  combo(ctx, out, t0) {
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.2, freq: midi(76 + iv), type: 'sine', vol: 0.26, attack: 0.003 });
    });
  },
  buy(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.09, freq: 1568, type: 'triangle', vol: 0.25, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.08, dur: 0.09, freq: 2093, type: 'triangle', vol: 0.25, attack: 0.002 });
  },
  stair(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.25, freq: 400, freqEnd: 1200, type: 'sine', vol: 0.22, attack: 0.01 });
    tone(ctx, out, { t0: t0 + 0.08, dur: 0.2, freq: 500, freqEnd: 1500, type: 'sine', vol: 0.18, attack: 0.01 });
  },
  tele(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.3, freq: 300, freqEnd: 2400, type: 'sine', vol: 0.3, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.2, type: 'highpass', freq: 3000, q: 1 });
  },
  talk(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.08, freq: 700, type: 'square', vol: 0.15, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.08, freq: 900, type: 'square', vol: 0.15, attack: 0.002 });
  },
  crystal(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.3, freq: 2000, freqEnd: 2600, type: 'triangle', vol: 0.24, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.25, vol: 0.2, type: 'highpass', freq: 4000, q: 2 });
  },
  spike(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.25, freq: 220, freqEnd: 70, type: 'sawtooth', vol: 0.3, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.15, vol: 0.3, type: 'bandpass', freq: 1200, q: 2 });
  },
  win(ctx, out, t0) {
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  step: 'step',
  pickup: 'pickup',
  door: 'door',
  fight: 'fight',
  kill: 'kill',
  combo: 'combo',
  buy: 'buy',
  stair: 'stair',
  tele: 'tele',
  talk: 'talk',
  crystal: 'crystal',
  spike: 'spike',
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
