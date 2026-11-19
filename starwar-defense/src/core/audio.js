// STARWAR DEFENSE · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：太空合成器，BPM 126，A 小调 A–F–C–G 进行，8 小节无缝循环。
// 层次：贝斯（三角波根音）、琶音（方波 16 分音符）、pad（锯齿双音低通）、hihat（噪声）。
// SFX：fire/hit/kill/leak/blast/collect/shield/combo/win/lose，全部 ≤0.6s。
// 导出 createAudio()（实时）+ scheduleBgmLoop / 常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 126;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A 小调 A–F–C–G（每和弦 2 小节）
const CHORDS = [
  { root: 33, arp: [57, 60, 64, 69] }, // Am
  { root: 29, arp: [53, 57, 60, 65] }, // F
  { root: 36, arp: [60, 64, 67, 72] }, // C
  { root: 31, arp: [55, 59, 62, 67] }, // G
];

// 主音（8 小节，稀疏）：[小节, 拍, MIDI, 持续拍]
const MELODY = [
  [0, 0.0, 81, 1.0], [0, 2.0, 84, 1.0],
  [1, 0.0, 88, 1.5], [1, 2.0, 84, 1.0],
  [2, 0.0, 81, 1.0], [2, 2.0, 79, 1.0],
  [3, 0.0, 76, 2.0],
  [4, 0.0, 81, 1.0], [4, 2.0, 84, 1.0],
  [5, 0.0, 88, 2.0],
  [6, 0.0, 84, 1.0], [6, 2.0, 81, 1.0],
  [7, 0.0, 79, 3.0],
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
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.08);
    g.gain.setValueAtTime(vol, t0 + dur - 0.25);
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
  fire(ctx, out, t0) { // 激光 zing 快速下扫
    tone(ctx, out, { t0, dur: 0.12, freq: 1500, freqEnd: 400, type: 'square', vol: 0.32, attack: 0.002 });
  },
  hit(ctx, out, t0) { // 命中 tick
    tone(ctx, out, { t0, dur: 0.05, freq: 2200, type: 'sine', vol: 0.28, attack: 0.001 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.12, type: 'bandpass', freq: 2600, q: 6 });
  },
  kill(ctx, out, t0) { // 击落爆炸
    noise(ctx, out, { t0, dur: 0.3, vol: 0.4, type: 'lowpass', freq: 3000, freqEnd: 300, q: 1 });
    tone(ctx, out, { t0, dur: 0.22, freq: 220, freqEnd: 60, type: 'sine', vol: 0.3, attack: 0.004 });
  },
  leak(ctx, out, t0) { // 漏敌警报 thud
    tone(ctx, out, { t0, dur: 0.4, freq: 160, freqEnd: 60, type: 'square', vol: 0.32, attack: 0.005 });
  },
  blast(ctx, out, t0) { // 大招全屏光束
    tone(ctx, out, { t0, dur: 0.5, freq: 3200, freqEnd: 80, type: 'sawtooth', vol: 0.4, attack: 0.01 });
    noise(ctx, out, { t0, dur: 0.5, vol: 0.3, type: 'lowpass', freq: 4000, freqEnd: 200, q: 1 });
  },
  collect(ctx, out, t0) { // 拾取 chime
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.16, freq: midi(m), type: 'sine', vol: 0.26, attack: 0.003 });
    });
  },
  shield(ctx, out, t0) { // 护盾吸收 pop
    tone(ctx, out, { t0, dur: 0.16, freq: 500, freqEnd: 900, type: 'triangle', vol: 0.3, attack: 0.004 });
  },
  combo(ctx, out, t0, payload) { // 连击上升 blip（音高随连击递增，封顶 +12）
    const n = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const shift = Math.min(12, n);
    tone(ctx, out, { t0, dur: 0.09, freq: midi(72 + shift), type: 'sine', vol: 0.24, attack: 0.002 });
  },
  win(ctx, out, t0) { // 胜利 jingle 五连音
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败低沉
    tone(ctx, out, { t0, dur: 0.5, freq: 130, freqEnd: 50, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.25, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  shot: 'fire',
  hit: 'hit',
  kill: 'kill',
  leak: 'leak',
  blast: 'blast',
  collect: 'collect',
  shield: 'shield',
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

// ---- BGM 一个循环的编排（8 小节，t0 起始，采样精确、无缝）----

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  const hatStep = BEAT / 2;
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    // 贝斯：每小节 4 个四分音符
    for (let b = 0; b < 4; b += 1) {
      push(tone(ctx, bus, { t0: barT + b * BEAT, dur: 0.3, freq: midi(chord.root), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.28 }));
    }
    // hihat：8 分音符噪声
    for (let h = 0; h < 8; h += 1) {
      push(noise(ctx, bus, { t0: barT + h * hatStep, dur: 0.03, vol: h % 4 === 2 ? 0.16 : 0.1, type: 'highpass', freq: 6000, q: 1 }));
    }
    // 琶音：16 分音符方波
    for (let s = 0; s < 16; s += 1) {
      const m = chord.arp[s % 4];
      push(tone(ctx, bus, { t0: barT + s * (BEAT / 4), dur: 0.1, freq: midi(m + 12), type: 'square', vol: 0.08, attack: 0.002, release: 0.09 }));
    }
    // pad：每 2 小节铺一次
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: [chord.root + 24, chord.root + 31] }));
    // 主音：8 小节
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar) push(tone(ctx, bus, { t0: barT + beat * BEAT, dur: durBeats * BEAT, freq: midi(m), type: 'sine', vol: 0.2, attack: 0.004, release: Math.min(durBeats * BEAT, 0.4) }));
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

export { BPM, BEAT, BAR, BGM_BARS, BGM_LOOP, scheduleSfx, SFX_EVENT_MAP };
