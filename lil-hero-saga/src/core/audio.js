// LIL HERO SAGA · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹 synthwave，BPM 120，Am–F–C–G 进行（每和弦 2 小节，共 8 小节无缝循环）。
// 四层：木鱼鼓点 + 三角波贝斯 + 锯齿和弦垫 + 马林巴感主音。
// SFX：全部 ≤0.6s，事件名见 SFX_EVENT_MAP。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;  // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音，pad=双音和弦垫
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// 主音 [小节内, 拍, MIDI, 持续拍]
const MELODY = [
  [0, 0.0, 81, 0.5], [0, 0.5, 84, 0.5], [0, 1.0, 88, 0.5], [0, 1.5, 84, 0.5],
  [0, 2.0, 81, 1.0], [0, 3.0, 76, 1.0],
  [2, 0.0, 79, 0.5], [2, 0.5, 83, 0.5], [2, 1.0, 86, 0.5], [2, 1.5, 83, 0.5],
  [2, 2.0, 79, 1.0], [2, 3.0, 74, 1.0],
  [4, 0.0, 77, 0.5], [4, 0.5, 81, 0.5], [4, 1.0, 84, 0.5], [4, 1.5, 81, 0.5],
  [4, 2.0, 77, 1.0], [4, 3.0, 72, 1.0],
  [6, 0.0, 79, 0.5], [6, 0.5, 83, 0.5], [6, 1.0, 86, 0.5], [6, 1.5, 83, 0.5],
  [6, 2.0, 79, 0.5], [6, 2.5, 83, 0.5], [6, 3.0, 86, 0.5],
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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.13 }) {
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
    const rel = 0.3;
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

// ---- SFX（每个都短 ≤0.6s）----
const SFX = {
  cast(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.08, freq: 520, freqEnd: 880, type: 'triangle', vol: 0.4, attack: 0.002 }); },
  fire(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.22, vol: 0.4, type: 'lowpass', freq: 3200, freqEnd: 500, q: 1.2 }); tone(ctx, out, { t0, dur: 0.16, freq: 700, freqEnd: 180, type: 'sawtooth', vol: 0.3, attack: 0.003 }); },
  frost(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.24, freq: 1400, freqEnd: 700, type: 'sine', vol: 0.32, attack: 0.004 }); },
  dash(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.18, vol: 0.6, type: 'bandpass', freq: 1400, freqEnd: 2600, q: 1.2 }); },
  orange(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.3, freq: 90, freqEnd: 40, type: 'sawtooth', vol: 0.5, attack: 0.003 }); },
  purple(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.32, freq: 660, freqEnd: 990, type: 'triangle', vol: 0.3, attack: 0.006 }); },
  green(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.2, freq: 330, freqEnd: 660, type: 'sine', vol: 0.3, attack: 0.004 }); },
  white(ctx, out, t0) { [0, 4, 7, 12].forEach((iv, i) => tone(ctx, out, { t0: t0 + i * 0.05, dur: 0.3, freq: midi(72 + iv), type: 'triangle', vol: 0.3, attack: 0.004 })); },
  jump(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.12, freq: 300, freqEnd: 600, type: 'sine', vol: 0.28, attack: 0.003 }); },
  land(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.08, vol: 0.22, type: 'lowpass', freq: 500, q: 1 }); },
  hit(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.1, vol: 0.6, type: 'bandpass', freq: 1800, q: 1.5 }); },
  kill(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.3, vol: 0.42, type: 'lowpass', freq: 2200, freqEnd: 200, q: 1 }); tone(ctx, out, { t0, dur: 0.18, freq: 200, freqEnd: 60, type: 'sine', vol: 0.4, attack: 0.004 }); },
  hurt(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.3, freq: 160, freqEnd: 70, type: 'sawtooth', vol: 0.5, attack: 0.004 }); },
  collect(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.12, freq: 1040, type: 'sine', vol: 0.3, attack: 0.003 }); },
  rock(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.35, vol: 0.4, type: 'lowpass', freq: 1800, freqEnd: 300, q: 1 }); },
  flag(ctx, out, t0) { [72, 76, 79].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 })); },
  boss(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.5, freq: 55, freqEnd: 30, type: 'sawtooth', vol: 0.55, attack: 0.005 }); },
  win(ctx, out, t0) { [72, 76, 79, 84, 88].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 })); },
  lose(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 50, type: 'sine', vol: 0.55, attack: 0.005 }); noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 }); },
};

// 事件名 → SFX（enemyShoot 不发声，避免高频噪声干扰）
const SFX_EVENT_MAP = {
  cast: 'cast', fire: 'fire', frost: 'frost', dash: 'dash',
  orange: 'orange', purple: 'purple', green: 'green', white: 'white',
  jump: 'jump', land: 'land', hit: 'hit', kill: 'kill', hurt: 'hurt',
  collect: 'collect', rock_break: 'rock', rock_hit: 'hit', flag: 'flag',
  boss: 'boss', win: 'win', lose: 'lose',
};

export function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

function woodblock(ctx, out, { t0, vol = 0.36 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'bandpass', freq: 2400, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.26, freq: midi(midiNote), type: 'triangle', vol: 0.32, attack: 0.006, release: 0.26 });
}

function marimba(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.18, attack: 0.003, release: Math.min(dur, 0.3) });
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
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.36 : 0.24 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar) push(marimba(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
