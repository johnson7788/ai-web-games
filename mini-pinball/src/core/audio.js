// MINI PINBALL · 程序化音频（纯 WebAudio，零音频文件零外链）。
// BGM：霓虹 synthwave 轻快循环，BPM 124，Am–F–C–G（每和弦 1 小节，8 小节无缝循环）。
// 三层：低音根音 / 和弦垫 / 16 分音符琶音主音 + 打击点。
// SFX：launch / wall / hit / bumper / rubber / orb / combo / win / lose，全部 ≤0.6s。
// 导出 createAudio()（实时）与 scheduleBgmLoop / scheduleSfx，供 tools/audio-check.mjs 离屏复验。

const BPM = 124;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS; // ≈15.48s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Am – F – C – G（A 小调霓虹进行）
const CHORDS = [
  { root: 45, pad: [57, 60, 64], arp: [57, 60, 64, 69, 72] },
  { root: 41, pad: [53, 57, 60], arp: [53, 57, 60, 65, 69] },
  { root: 48, pad: [60, 64, 67], arp: [60, 64, 67, 72, 76] },
  { root: 43, pad: [55, 59, 62], arp: [55, 59, 62, 67, 71] },
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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.12 }) {
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

// ---- SFX 合成（全部 ≤0.6s）----
const SFX = {
  launch(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.22, freq: 260, freqEnd: 900, type: 'sawtooth', vol: 0.3, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.12, vol: 0.2, type: 'highpass', freq: 1500, q: 1 });
  },
  wall(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.05, freq: 520, freqEnd: 320, type: 'sine', vol: 0.26, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.2, type: 'bandpass', freq: 1200, q: 1.5 });
  },
  hit(ctx, out, t0, payload) {
    const shift = payload && payload.mult ? Math.min(payload.mult, 6) : 1;
    tone(ctx, out, { t0, dur: 0.09, freq: 640 + shift * 40, freqEnd: 380, type: 'square', vol: 0.3, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.18, type: 'highpass', freq: 2200, q: 1 });
  },
  bumper(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.16, freq: 240, freqEnd: 170, type: 'triangle', vol: 0.4, attack: 0.003 });
  },
  rubber(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.09, freq: 820, type: 'sine', vol: 0.28, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.08, dur: 0.12, freq: 1240, type: 'sine', vol: 0.26, attack: 0.002 });
  },
  orb(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.32, freq: 1400, freqEnd: 1800, type: 'sine', vol: 0.24, attack: 0.003 });
  },
  combo(ctx, out, t0, payload) {
    const n = payload && payload.combo ? payload.combo : 2;
    const base = 60 + Math.min(n, 6) * 2;
    tone(ctx, out, { t0, dur: 0.1, freq: midi(base), type: 'triangle', vol: 0.24, attack: 0.003 });
  },
  win(ctx, out, t0) {
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.4, freq: 130, freqEnd: 60, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.22, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  launch: 'launch',
  wall: 'wall',
  hit: 'hit',
  bumper: 'bumper',
  rubber: 'rubber',
  orb: 'orb',
  combo: 'combo',
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

// ---- BGM：8 小节无缝循环 ----
function kick(ctx, out, t0) {
  return tone(ctx, out, { t0, dur: 0.16, freq: 120, freqEnd: 45, type: 'sine', vol: 0.5, attack: 0.002 });
}
function hat(ctx, out, t0, vol = 0.12) {
  return noise(ctx, out, { t0, dur: 0.03, vol, type: 'highpass', freq: 7000, q: 1 });
}
function bass(ctx, out, t0, m) {
  return tone(ctx, out, { t0, dur: BEAT * 0.9, freq: midi(m), type: 'triangle', vol: 0.32, attack: 0.006 });
}
function pluck(ctx, out, t0, m) {
  return tone(ctx, out, { t0, dur: 0.12, freq: midi(m), type: 'square', vol: 0.14, attack: 0.002, release: 0.1 });
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
      push(kick(ctx, bus, barT + b * BEAT));
      push(bass(ctx, bus, barT + b * BEAT, chord.root));
      push(hat(ctx, bus, barT + b * BEAT + BEAT / 2, b % 2 ? 0.1 : 0.14));
    }
    push(padNote(ctx, bus, { t0: barT, dur: BAR, freqs: chord.pad }));
    // 16 分音符琶音（仅偶数小节加主音，避免过密）
    if (bar % 2 === 0) {
      for (let s = 0; s < 16; s += 1) {
        const m = chord.arp[s % chord.arp.length];
        push(pluck(ctx, bus, barT + s * (BEAT / 4), m));
      }
    }
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
