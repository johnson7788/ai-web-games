// 霓虹转生街机 · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：朦胧氛围，BPM 96，A 小调进行 Am–F–C–G，8 小节无缝循环。
// SFX：tick / year / event / choice / luck / death / summary，全部 ≤0.6s。
// 导出 createAudio()（实时），另导出 scheduleBgmLoop / scheduleSfx / SFX_EVENT_MAP 供 tools/audio-check.mjs 复验。

const BPM = 96;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-16);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { root: 45, pad: [52, 57] }, // Am
  { root: 41, pad: [48, 53] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

const ARPEGGIO = [
  [0, 0.0, 69, 1.0], [0, 1.5, 72, 1.0], [0, 3.0, 76, 1.0],
  [1, 0.0, 69, 1.0], [1, 1.5, 72, 1.0], [1, 3.0, 76, 1.0],
  [2, 0.0, 65, 1.0], [2, 1.5, 69, 1.0], [2, 3.0, 72, 1.0],
  [3, 0.0, 64, 1.0], [3, 1.5, 67, 1.0], [3, 3.0, 71, 1.0],
  [4, 0.0, 72, 1.0], [4, 1.5, 76, 1.0], [4, 3.0, 79, 1.0],
  [5, 0.0, 72, 1.0], [5, 1.5, 76, 1.0], [5, 3.0, 79, 1.0],
  [6, 0.0, 67, 1.0], [6, 1.5, 71, 1.0], [6, 3.0, 74, 1.0],
  [7, 0.0, 67, 1.0], [7, 1.5, 71, 1.0], [7, 3.0, 74, 1.5],
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
  osc.connect(g); g.connect(out);
  osc.start(t0); osc.stop(t0 + r + 0.02);
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
  src.connect(filter); filter.connect(g); g.connect(out);
  src.start(t0); src.stop(t0 + dur + 0.02);
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
    g.gain.linearRampToValueAtTime(vol, t0 + 0.08);
    g.gain.setValueAtTime(vol, t0 + dur - 0.25);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(lp); lp.connect(g); g.connect(out);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
    oscs.push(osc);
  }
  return oscs;
}

const SFX = {
  tick(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.05, freq: 2000, type: 'sine', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.02, vol: 0.12, type: 'bandpass', freq: 2200, q: 6 });
  },
  year(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.12, freq: 880, freqEnd: 660, type: 'sine', vol: 0.32, attack: 0.003 });
  },
  event(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.14, freq: 660, type: 'triangle', vol: 0.3, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.08, dur: 0.16, freq: 880, type: 'triangle', vol: 0.24, attack: 0.004 });
  },
  choice(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.16, freq: 523, type: 'triangle', vol: 0.3, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.12, dur: 0.2, freq: 659, type: 'triangle', vol: 0.28, attack: 0.004 });
  },
  luck(ctx, out, t0) {
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.3, freq: midi(m), type: 'sine', vol: 0.26, attack: 0.004 });
    });
  },
  death(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.24, type: 'lowpass', freq: 500, q: 1 });
  },
  summary(ctx, out, t0) {
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.004 });
    });
  },
};

const SFX_EVENT_MAP = {
  talentPick: 'tick',
  talentTrigger: 'tick',
  year: 'year',
  event: 'event',
  choice: 'choice',
  luck: 'luck',
  death: 'death',
  summary: 'summary',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const barT = t0 + bar * BAR;
    push([tone(ctx, bus, { t0: barT, dur: 0.3, freq: midi(chord.root), type: 'triangle', vol: 0.26, attack: 0.006, release: 0.3 })]);
    push(padNote(ctx, bus, { t0: barT, dur: BAR * 1.02, freqs: chord.pad }));
    for (const [aBar, beat, m, durBeats] of ARPEGGIO) {
      if (aBar === bar) push([tone(ctx, bus, { t0: barT + beat * BEAT, dur: durBeats * BEAT, freq: midi(m), type: 'sine', vol: 0.16, attack: 0.004, release: 0.4 })]);
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
    bgmBus = ctx.createGain(); bgmBus.gain.value = 1; bgmBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    return true;
  }

  function duckBgm() {
    if (!ctx || !bgmBus) return;
    const t = ctx.currentTime;
    const p = bgmBus.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(Math.max(0.0001, p.value || 1), t);
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.15);
    p.setValueAtTime(DUCK_GAIN, t + 1.6);
    p.linearRampToValueAtTime(1, t + 1.8);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'death' || name === 'summary') duckBgm();
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
