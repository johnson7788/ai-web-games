// BARBARIAN BASH · 程序化霓虹街机音频（纯 WebAudio，零音频文件零外链）
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏复验。
const BPM = 128;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A 小调五声走法（每小节一个根音 + 上行琶音）
const BASS = [45, 45, 48, 48, 43, 43, 41, 41];       // A2 A2 C3 C3 G2 G2 F2 F2
const ARP = [
  [57, 60, 64, 60], [57, 60, 64, 67], [60, 64, 67, 72], [60, 64, 67, 72],
  [55, 59, 62, 67], [55, 59, 62, 67], [53, 57, 60, 65], [53, 57, 60, 64],
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

// ---- SFX（全部 ≤0.6s）----
const SFX = {
  aim(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.08, freq: 1200, freqEnd: 900, type: 'sine', vol: 0.25, attack: 0.002 });
  },
  throw(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.28, vol: 0.5, type: 'bandpass', freq: 2600, freqEnd: 500, q: 1.4 });
  },
  hit(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.16, freq: 220, freqEnd: 110, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.24, type: 'lowpass', freq: 900, q: 1 });
  },
  crit(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.14, freq: 1568, type: 'square', vol: 0.28, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.07, dur: 0.2, freq: 2093, type: 'square', vol: 0.24, attack: 0.002 });
  },
  kill(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.32, freq: 140, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.24, vol: 0.34, type: 'lowpass', freq: 1400, freqEnd: 300, q: 1 });
  },
  break(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.22, vol: 0.42, type: 'highpass', freq: 2400, q: 1 });
    tone(ctx, out, { t0, dur: 0.1, freq: 500, freqEnd: 200, type: 'triangle', vol: 0.3, attack: 0.003 });
  },
  explode(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 40, type: 'sine', vol: 0.6, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.4, vol: 0.5, type: 'lowpass', freq: 1800, freqEnd: 180, q: 1 });
  },
  bounce(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.08, freq: 700, freqEnd: 400, type: 'sine', vol: 0.26, attack: 0.002 });
  },
  combo(ctx, out, t0, payload) {
    const c = payload && typeof payload.combo === 'number' ? Math.min(payload.combo, 5) : 2;
    for (let i = 0; i < 3; i += 1) {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.12, freq: midi(72 + Math.min(c, 5) + i * 2), type: 'triangle', vol: 0.26, attack: 0.003 });
    }
  },
  captiveHit(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.3, freq: 880, freqEnd: 440, type: 'square', vol: 0.3, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.12, dur: 0.3, freq: 660, freqEnd: 330, type: 'square', vol: 0.26, attack: 0.003 });
  },
  win(ctx, out, t0) {
    [72, 76, 79, 84].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 }));
  },
  lose(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.45, freq: 160, freqEnd: 60, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.28, vol: 0.3, type: 'lowpass', freq: 600, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  aim: 'aim',
  throw: 'throw',
  hit: 'hit',
  crit: 'crit',
  kill: 'kill',
  break: 'break',
  explode: 'explode',
  bounce: 'bounce',
  combo: 'combo',
  captiveHit: 'captiveHit',
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

// ---- BGM 编排（8 小节，驱动感：低音 + 琶音 + 底鼓）----
function kick(ctx, out, t0) {
  return [
    ...tone(ctx, out, { t0, dur: 0.16, freq: 130, freqEnd: 42, type: 'sine', vol: 0.5, attack: 0.002 }),
    ...noise(ctx, out, { t0, dur: 0.04, vol: 0.2, type: 'lowpass', freq: 900, q: 1 }),
  ];
}

function bassNote(ctx, out, t0, m) {
  return tone(ctx, out, { t0, dur: 0.28, freq: midi(m), type: 'sawtooth', vol: 0.2, attack: 0.006, release: 0.28 });
}

function arpNote(ctx, out, t0, m) {
  return tone(ctx, out, { t0, dur: 0.16, freq: midi(m), type: 'square', vol: 0.14, attack: 0.003, release: 0.12 });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  // 低音持续 drone：保证循环拼接处无静音（audio-check 无缝验证）
  {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = midi(45);
    const att = 0.1;
    const rel = 0.4;
    const dur = BGM_LOOP + 0.4;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.08, t0 + att);
    g.gain.setValueAtTime(0.08, t0 + dur - rel);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g); g.connect(bus);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
    push([osc]);
  }
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(kick(ctx, bus, bt));
      push(bassNote(ctx, bus, bt, BASS[bar]));
      const arp = ARP[bar];
      push(arpNote(ctx, bus, bt + BEAT / 2, arp[b % arp.length]));
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
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.12);
    p.setValueAtTime(DUCK_GAIN, t + 2.5);
    p.linearRampToValueAtTime(1, t + 2.62);
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
