// MONSTER MELTER · 程序化音频（纯 WebAudio，零文件零外链）
// BGM：霓虹合成波，BPM 120，A 小调进行 Am–F–C–G（每和弦 1 小节），8 小节无缝循环。
// 三层：贝斯三角波根音 + 锯齿和弦垫（低通）+ 16 分音符琶音主音。
// SFX：grab/place/clear/hit/combo/bomb/win/lose，全部 ≤0.6s。

const BPM = 120;
const BEAT = 60 / BPM;             // 0.5s
const BAR = BEAT * 4;              // 2s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;   // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-11);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Am F C G（A 小调，A=57）
const CHORDS = [
  { root: 45, pad: [57, 60, 64], arp: [69, 72, 76, 81] }, // Am
  { root: 41, pad: [53, 57, 60], arp: [65, 69, 72, 77] }, // F
  { root: 48, pad: [55, 60, 64], arp: [67, 72, 76, 79] }, // C
  { root: 43, pad: [55, 59, 62], arp: [67, 71, 74, 79] }, // G
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
}

function noise(ctx, out, { t0, dur, vol = 0.3, freq = 2000, q = 1, freqEnd = null, type = 'bandpass' }) {
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
}

function padNote(ctx, out, { t0, dur, freqs, vol = 0.12 }) {
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
    g.gain.linearRampToValueAtTime(vol, t0 + 0.06);
    g.gain.setValueAtTime(vol, t0 + dur - 0.2);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(lp);
    lp.connect(g);
    g.connect(out);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
}

const SFX = {
  grab(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.06, freq: 2100, type: 'sine', vol: 0.4, attack: 0.002 });
  },
  place(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.14, freq: 200, freqEnd: 130, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.16, freq: 700, q: 1, type: 'lowpass' });
  },
  clear(ctx, out, t0, payload) {
    const n = payload && payload.combo ? payload.combo : 1;
    [0, 3, 7, 12].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.22, freq: midi(72 + iv + Math.min(n, 6)), type: 'triangle', vol: 0.26, attack: 0.003 });
    });
  },
  hit(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.16, freq: 140, freqEnd: 60, type: 'sine', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.12, vol: 0.22, freq: 900, q: 1.2, type: 'lowpass' });
  },
  combo(ctx, out, t0, payload) {
    const n = payload && payload.combo ? payload.combo : 2;
    tone(ctx, out, { t0, dur: 0.12, freq: midi(76 + n * 2), type: 'square', vol: 0.18, attack: 0.002 });
  },
  bomb(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.5, vol: 0.5, freq: 3200, freqEnd: 250, q: 1, type: 'lowpass' });
    tone(ctx, out, { t0, dur: 0.3, freq: 90, freqEnd: 40, type: 'sine', vol: 0.55, attack: 0.004 });
  },
  win(ctx, out, t0) {
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.4, freq: 130, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.22, vol: 0.24, freq: 500, q: 1, type: 'lowpass' });
  },
};

const SFX_EVENT_MAP = {
  grab: 'grab',
  place: 'place',
  clear: 'clear',
  hit: 'hit',
  combo: 'combo',
  bomb: 'bomb',
  rock: 'bomb',
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

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.26, freq: midi(midiNote), type: 'triangle', vol: 0.34, attack: 0.006, release: 0.26 });
}

function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.12, freq: midi(midiNote), type: 'square', vol: 0.1, attack: 0.002, release: 0.12 });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root });
    }
    padNote(ctx, bus, { t0: barT, dur: BAR, freqs: chord.pad });
    for (let s = 0; s < 16; s += 1) {
      arpNote(ctx, bus, { t0: barT + s * (BEAT / 4), midiNote: chord.arp[s % 4] });
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
    bgmTick();
    bgmTimer = setInterval(bgmTick, 100);
  }

  function stopBgm() {
    bgmPlaying = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    const t = ctx ? ctx.currentTime : 0;
    for (const s of bgmActive) { try { s.stop(t + 0.03); } catch { /* noop */ } }
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
