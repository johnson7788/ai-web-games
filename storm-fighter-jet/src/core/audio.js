// STORM FIGHTER JET · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：高速霓虹风暴，BPM 140，A 小调进行 Am–F–C–G（每和弦 2 小节）。
// A 段 8 小节无主音 / B 段 8 小节主音进入，共 16 小节无缝循环。
// 四层编制：打击点=短噪声、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=方波短衰减。
// SFX：coin/shield/shieldBreak/explosion/nearMiss/levelUp/missileShot/die/over，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 140;
const BEAT = 60 / BPM;            // ≈0.4286
const BAR = BEAT * 4;             // ≈1.7143
const BGM_BARS = 16;
const BGM_LOOP = BAR * BGM_BARS;  // ≈27.43s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-13);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A 小调进行：Am / F / C / G
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 36, pad: [48, 52] }, // C
  { root: 43, pad: [55, 59] }, // G
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 81, 1.5], [0, 2.0, 84, 1.5], [0, 3.5, 88, 0.5],
  [1, 0.0, 84, 2.0], [1, 2.0, 81, 2.0],
  [2, 0.0, 76, 1.5], [2, 2.0, 81, 1.5], [2, 3.5, 84, 0.5],
  [3, 0.0, 86, 3.0], [3, 3.0, 84, 1.0],
  [4, 0.0, 79, 1.5], [4, 2.0, 76, 1.5], [4, 3.5, 72, 0.5],
  [5, 0.0, 74, 2.0], [5, 2.0, 76, 2.0],
  [6, 0.0, 79, 1.5], [6, 2.0, 74, 1.5], [6, 3.5, 71, 0.5],
  [7, 0.0, 72, 3.5], [7, 3.5, 67, 0.5],
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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.15 }) {
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
  coin(ctx, out, t0, payload) {
    const shift = Math.min(12, (payload && payload.combo) ? Math.floor((payload.combo - 1) / 3) * 2 : 0);
    [72 + shift, 79 + shift].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.14, freq: midi(m), type: 'square', vol: 0.26, attack: 0.003 });
    });
  },
  shield(ctx, out, t0) {
    [64, 71, 76].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.003 });
    });
  },
  shieldBreak(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.22, vol: 0.4, type: 'highpass', freq: 1800, q: 1 });
    tone(ctx, out, { t0, dur: 0.18, freq: 300, freqEnd: 90, type: 'square', vol: 0.3, attack: 0.002 });
  },
  explosion(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.4, vol: 0.5, type: 'lowpass', freq: 2600, freqEnd: 180, q: 0.8 });
    tone(ctx, out, { t0, dur: 0.35, freq: 140, freqEnd: 45, type: 'sine', vol: 0.5, attack: 0.003 });
  },
  nearMiss(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.16, vol: 0.3, type: 'bandpass', freq: 3200, freqEnd: 900, q: 1.6 });
  },
  missileShot(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.22, vol: 0.5, type: 'bandpass', freq: 700, freqEnd: 2600, q: 1.1 });
    tone(ctx, out, { t0, dur: 0.18, freq: 420, freqEnd: 900, type: 'sawtooth', vol: 0.22, attack: 0.003 });
  },
  levelUp(ctx, out, t0) {
    [60, 64, 67, 72].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.004 });
    });
  },
  die(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.5, vol: 0.5, type: 'lowpass', freq: 2000, freqEnd: 90, q: 0.8 });
    tone(ctx, out, { t0, dur: 0.45, freq: 200, freqEnd: 40, type: 'sawtooth', vol: 0.35, attack: 0.004 });
  },
  over(ctx, out, t0) {
    [67, 63, 60, 55].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.12, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.004 });
    });
  },
};

// 事件名 → SFX（无音效的事件不在此表）
const SFX_EVENT_MAP = {
  coin: 'coin',
  shield: 'shield',
  shieldBreak: 'shieldBreak',
  explosion: 'explosion',
  nearMiss: 'nearMiss',
  missileShot: 'missileShot',
  levelUp: 'levelUp',
  die: 'die',
  over: 'over',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环的编排 ----
function kick(ctx, out, { t0, vol = 0.4 }) {
  return tone(ctx, out, { t0, dur: 0.12, freq: 90, freqEnd: 42, type: 'sine', vol, attack: 0.003 });
}
function hat(ctx, out, { t0, vol = 0.22 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 7000, q: 1 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.22, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.005, release: 0.22 });
}
function lead(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.16, attack: 0.004, release: Math.min(dur, 0.3) });
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
      push(kick(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.42 : 0.32 }));
      push(hat(ctx, bus, { t0: barT + b * BEAT + BEAT / 2 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(lead(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    p.setValueAtTime(DUCK_GAIN, t + 1.2);
    p.linearRampToValueAtTime(1, t + 1.35);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'die' || name === 'over') duckBgm();
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
