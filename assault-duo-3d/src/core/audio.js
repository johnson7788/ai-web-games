// ASSAULT DUO 3D · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机 A 小调，BPM 128，和弦 Am–F–C–G（每和弦 2 小节），16 小节无缝循环。
// A 段 8 小节（打击+贝斯+垫子）/ B 段 8 小节（加入主音琶音）。
// SFX：shoot/hit/kill/hurt/jump/pickup/combo/duo/weapon/enemyShoot/win/lose，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 128;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 16;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [60, 64] }, // C
  { root: 43, pad: [55, 59] }, // G
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 81, 0.5], [0, 1.0, 84, 0.5], [0, 2.0, 88, 0.5], [0, 3.0, 84, 0.5],
  [1, 0.0, 79, 0.5], [1, 1.0, 84, 0.5], [1, 2.0, 79, 0.5], [1, 3.0, 76, 0.5],
  [2, 0.0, 76, 0.5], [2, 1.0, 79, 0.5], [2, 2.0, 84, 0.5], [2, 3.0, 88, 0.5],
  [3, 0.0, 83, 1.0], [3, 2.0, 79, 1.0],
  [4, 0.0, 77, 0.5], [4, 1.0, 81, 0.5], [4, 2.0, 84, 0.5], [4, 3.0, 81, 0.5],
  [5, 0.0, 76, 0.5], [5, 1.0, 72, 0.5], [5, 2.0, 76, 0.5], [5, 3.0, 79, 0.5],
  [6, 0.0, 74, 0.5], [6, 1.0, 77, 0.5], [6, 2.0, 81, 0.5], [6, 3.0, 77, 0.5],
  [7, 0.0, 72, 1.5], [7, 2.0, 76, 1.5],
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
  shoot(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.06, freq: 760, freqEnd: 320, type: 'square', vol: 0.24, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.12, type: 'highpass', freq: 3000, q: 1 });
  },
  hit(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.05, freq: 420, freqEnd: 200, type: 'triangle', vol: 0.3, attack: 0.001 });
  },
  kill(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.12, freq: 520, freqEnd: 160, type: 'sawtooth', vol: 0.28, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.12, vol: 0.16, type: 'lowpass', freq: 1200, freqEnd: 300, q: 1 });
  },
  hurt(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.16, freq: 180, freqEnd: 70, type: 'sine', vol: 0.4, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.08, vol: 0.2, type: 'lowpass', freq: 600, q: 1 });
  },
  jump(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.12, freq: 320, freqEnd: 640, type: 'triangle', vol: 0.24, attack: 0.003 });
  },
  pickup(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.1, freq: 990, freqEnd: 1320, type: 'sine', vol: 0.22, attack: 0.002 });
  },
  combo(ctx, out, t0, payload) {
    const level = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    if (level < 1) return; // 负例门控：combo<1 静音（audio-check 用它做 gated 断言）
    const shift = Math.min(level, 6);
    tone(ctx, out, { t0, dur: 0.14, freq: midi(72 + shift), type: 'square', vol: 0.2, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.04, dur: 0.12, freq: midi(76 + shift), type: 'square', vol: 0.16, attack: 0.002 });
  },
  duo(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.5, vol: 0.4, type: 'lowpass', freq: 2600, freqEnd: 120, q: 1 });
    tone(ctx, out, { t0, dur: 0.5, freq: 90, freqEnd: 40, type: 'sine', vol: 0.5, attack: 0.005 });
  },
  weapon(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.04, vol: 0.2, type: 'highpass', freq: 2500, q: 2 });
    tone(ctx, out, { t0, dur: 0.05, freq: 220, type: 'square', vol: 0.16, attack: 0.002 });
  },
  enemyShoot(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.08, freq: 300, freqEnd: 150, type: 'sawtooth', vol: 0.2, attack: 0.002 });
  },
  win(ctx, out, t0) {
    [69, 72, 76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.4, freq: 110, freqEnd: 50, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
};

// 事件名 → SFX 映射
const SFX_EVENT_MAP = {
  shoot: 'shoot',
  hit: 'hit',
  kill: 'kill',
  hurt: 'hurt',
  jump: 'jump',
  pickup: 'pickup',
  combo: 'combo',
  duo: 'duo',
  weapon: 'weapon',
  enemyShoot: 'enemyShoot',
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

// ---- BGM 一个循环的编排（16 小节，t0 起始，采样精确、无缝）----

function hat(ctx, out, { t0, vol = 0.26 }) {
  return noise(ctx, out, { t0, dur: 0.03, vol, type: 'highpass', freq: 6000, q: 1 });
}

function kick(ctx, out, { t0, vol = 0.4 }) {
  return tone(ctx, out, { t0, dur: 0.12, freq: 120, freqEnd: 45, type: 'sine', vol, attack: 0.002 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.22, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.22 });
}

function pluck(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.12, attack: 0.002, release: Math.min(dur, 0.18) });
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
      push(kick(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.4 : 0.32 }));
      push(hat(ctx, bus, { t0: barT + b * BEAT + BEAT / 2, vol: 0.24 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(pluck(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.15);
    p.setValueAtTime(DUCK_GAIN, t + 2.85);
    p.linearRampToValueAtTime(1, t + 3.0);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) {
      scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
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
