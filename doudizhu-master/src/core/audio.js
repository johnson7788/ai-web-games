// DOUDIZHU MASTER · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机轻快 loop，BPM 100，Am–F–C–G 进行（每和弦 2 小节，共 8 小节无缝循环）。
// 三层：噪声 hat 点、三角波贝斯、正弦琶音；相位连续，不用 media 淡入淡出。
// SFX：select/play/pass/bomb/rocket/deal/win/lose/hint，全部 ≤0.6s。
//
// 导出 createAudio()（实时），另导出 scheduleBgmLoop / scheduleSfx / 常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 100;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-9);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { root: 45, arp: [57, 60, 64, 69] }, // Am
  { root: 41, arp: [53, 57, 60, 65] }, // F
  { root: 48, arp: [60, 64, 67, 72] }, // C
  { root: 43, arp: [55, 59, 62, 67] }, // G
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

// ---- SFX ----
const SFX = {
  select(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.05, freq: 1200, freqEnd: 900, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  play(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.12, freq: 240, freqEnd: 150, type: 'triangle', vol: 0.42, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.06, vol: 0.14, type: 'lowpass', freq: 900, q: 1 });
  },
  pass(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.16, freq: 160, freqEnd: 105, type: 'sine', vol: 0.34, attack: 0.004 });
  },
  bomb(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.4, vol: 0.5, type: 'lowpass', freq: 3200, freqEnd: 240, q: 1.1 });
    tone(ctx, out, { t0, dur: 0.28, freq: 130, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.004 });
  },
  rocket(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.5, freq: 200, freqEnd: 1400, type: 'sawtooth', vol: 0.3, attack: 0.01 });
    noise(ctx, out, { t0, dur: 0.4, vol: 0.3, type: 'highpass', freq: 900, q: 1 });
  },
  deal(ctx, out, t0) {
    for (let i = 0; i < 4; i += 1) {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.05, freq: 700 + i * 120, type: 'sine', vol: 0.22, attack: 0.002 });
    }
  },
  win(ctx, out, t0) {
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) {
    [79, 76, 72, 69].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.24, freq: midi(m), type: 'triangle', vol: 0.26, attack: 0.004 });
    });
  },
  hint(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.07, freq: 1000, type: 'square', vol: 0.2, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.08, dur: 0.07, freq: 1300, type: 'square', vol: 0.2, attack: 0.003 });
  },
};

const SFX_EVENT_MAP = {
  select: 'select',
  play: 'play',
  pass: 'pass',
  bomb: 'bomb',
  rocket: 'rocket',
  deal: 'deal',
  roundStart: 'deal',
  win: 'win',
  lose: 'lose',
  hint: 'hint',
  turn: 'select',
};

export function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

function hat(ctx, out, { t0, vol = 0.16 }) {
  return noise(ctx, out, { t0, dur: 0.03, vol, type: 'highpass', freq: 6000, q: 1 });
}

function bassNote(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.008, release: dur });
}

function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.18, freq: midi(midiNote), type: 'sine', vol: 0.16, attack: 0.004, release: 0.18 });
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
      const bt = barT + b * BEAT;
      push(hat(ctx, bus, { t0: bt, vol: b === 0 ? 0.2 : 0.14 }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root, dur: BEAT * 0.9 }));
      push(arpNote(ctx, bus, { t0: bt + BEAT / 2, midiNote: chord.arp[b % 4] }));
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
    p.setValueAtTime(DUCK_GAIN, t + 2.0);
    p.linearRampToValueAtTime(1, t + 2.2);
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

export { BPM, BEAT, BAR, BGM_BARS, BGM_LOOP, SFX_EVENT_MAP };
