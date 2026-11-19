// SNAIL MAZE · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹合成波，BPM 108，A 小调 A–F–C–G（每和弦 2 小节），16 小节无缝循环。
// SFX：turn/star/combo/bash/rockHit/arrow/veer/win/lose，全部 ≤0.6s。
// 导出 createAudio()（实时）+ scheduleBgmLoop / scheduleSfx / 常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 108;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 16;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音，pad=双音和弦垫
const CHORDS = [
  { root: 33, pad: [57, 60] }, // Am
  { root: 29, pad: [53, 57] }, // F
  { root: 36, pad: [55, 60] }, // C
  { root: 31, pad: [55, 59] }, // G
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 81, 1.5], [0, 2.0, 84, 1.5], [0, 3.5, 88, 0.5],
  [1, 0.0, 84, 2.0], [1, 2.0, 79, 2.0],
  [2, 0.0, 76, 1.5], [2, 2.0, 79, 1.5], [2, 3.5, 84, 0.5],
  [3, 0.0, 86, 3.0], [3, 3.0, 84, 1.0],
  [4, 0.0, 81, 1.5], [4, 2.0, 79, 1.5], [4, 3.5, 76, 0.5],
  [5, 0.0, 72, 2.0], [5, 2.0, 76, 2.0],
  [6, 0.0, 79, 1.5], [6, 2.0, 74, 1.5], [6, 3.5, 71, 0.5],
  [7, 0.0, 76, 3.5], [7, 3.5, 71, 0.5],
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
}

function padNote(ctx, out, { t0, dur, freqs, vol = 0.14 }) {
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = midi(f);
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.Q.value = 0.7;
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
  }
}

// ---- SFX ----
const SFX = {
  turn(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.09, freq: 620, freqEnd: 1240, type: 'sine', vol: 0.42, attack: 0.002 });
  },
  star(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.14, freq: midi(84), type: 'sine', vol: 0.3, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.16, freq: midi(88), type: 'sine', vol: 0.22, attack: 0.002 });
  },
  combo(ctx, out, t0, payload) {
    const base = 72 + Math.min(7, ((payload && payload.combo) || 1) - 1);
    tone(ctx, out, { t0, dur: 0.1, freq: midi(base), type: 'triangle', vol: 0.28, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.12, freq: midi(base + 4), type: 'triangle', vol: 0.24, attack: 0.002 });
  },
  bash(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.24, vol: 0.4, type: 'lowpass', freq: 2600, freqEnd: 300, q: 1.1 });
    tone(ctx, out, { t0, dur: 0.16, freq: 150, freqEnd: 70, type: 'sine', vol: 0.34, attack: 0.003 });
  },
  rockHit(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.3, freq: 120, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.16, vol: 0.24, type: 'lowpass', freq: 500, q: 1 });
  },
  arrow(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.05, freq: 2000, type: 'sine', vol: 0.24, attack: 0.002 });
  },
  veer(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.22, freq: 340, freqEnd: 150, type: 'square', vol: 0.22, attack: 0.003 });
  },
  win(ctx, out, t0) {
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.42, freq: 120, freqEnd: 52, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.22, vol: 0.26, type: 'lowpass', freq: 460, q: 1 });
  },
};

// 事件名 → SFX（注意：负例/门控事件不要放进映射）
const SFX_EVENT_MAP = {
  turn: 'turn',
  star: 'star',
  combo: 'combo',
  bash: 'bash',
  rockHit: 'rockHit',
  arrow: 'arrow',
  veer: 'veer',
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

// ---- BGM 一个循环（16 小节无缝） ----
function kick(ctx, out, { t0, vol = 0.4 }) {
  return tone(ctx, out, { t0, dur: 0.12, freq: 90, freqEnd: 45, type: 'sine', vol, attack: 0.002 });
}
function hat(ctx, out, { t0, vol = 0.16 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 6000, q: 1 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.28, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.28 });
}
function marimba(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.18, attack: 0.003, release: Math.min(dur, 0.35) });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      kick(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.42 : 0.3 });
      hat(ctx, bus, { t0: barT + b * BEAT + BEAT / 2 });
      bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root });
    }
    if (bar % 2 === 0) padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad });
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) marimba(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT });
      }
    }
  }
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
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'win' || name === 'lose') duckBgm();
  }

  function bgmTick() {
    if (!bgmPlaying || !ctx) return;
    const horizon = ctx.currentTime + 0.3;
    while (bgmNextTime < horizon) {
      scheduleBgmLoop(ctx, bgmBus, bgmNextTime, BGM_GAIN);
      bgmNextTime += BGM_LOOP;
    }
  }

  function startBgm() {
    if (!ensure() || bgmPlaying) return;
    bgmPlaying = true;
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
