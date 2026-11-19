// Carrier Pigeon Dash · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹街机轻快，BPM 128，A 小调 i–VI–III–VII 循环，四层编制（贝斯三角波 / 琶音方波 / 和弦垫 / 噪声打击）。
// SFX：flap/score/collect/delivery/combo/levelup/nearmiss/rock/death/best，全部 ≤0.6s。
// 导出 createAudio()（实时）与 scheduleBgm*/scheduleSfx* 常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 128;
const BEAT = 60 / BPM;            // ≈0.46875s
const BAR = BEAT * 4;             // ≈1.875s
const BGM_BARS = 16;              // 16 小节
const BGM_LOOP = BAR * BGM_BARS;  // = 30s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A 小调 i–VI–III–VII（root=贝斯根音，pad=和弦垫，arp=琶音音级）
const CHORDS = [
  { root: 45, pad: [57, 60], arp: [69, 72, 76, 81] }, // Am
  { root: 41, pad: [53, 57], arp: [65, 69, 72, 77] }, // F
  { root: 48, pad: [55, 60], arp: [72, 76, 79, 84] }, // C
  { root: 43, pad: [50, 55], arp: [67, 71, 74, 79] }, // G
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
    oscs.push(osc);
  }
  return oscs;
}

// ---- SFX 合成（每个都短 ≤0.6s）----

const SFX = {
  flap(ctx, out, t0) { // 振翅：短促上行 chirp
    tone(ctx, out, { t0, dur: 0.08, freq: 420, freqEnd: 720, type: 'sine', vol: 0.45, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.04, vol: 0.12, type: 'bandpass', freq: 1800, q: 3 });
  },
  score(ctx, out, t0) { // 过塔得分：双音 blip
    tone(ctx, out, { t0, dur: 0.09, freq: 880, type: 'square', vol: 0.26, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.08, dur: 0.12, freq: 1320, type: 'square', vol: 0.24, attack: 0.002 });
  },
  collect(ctx, out, t0) { // 接信：高频 sparkle
    tone(ctx, out, { t0, dur: 0.12, freq: 1200, freqEnd: 1700, type: 'sine', vol: 0.32, attack: 0.003 });
  },
  delivery(ctx, out, t0) { // 配送完成：三连上行
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.24, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.003 });
    });
  },
  combo(ctx, out, t0, payload) { // 连击：音高随 combo 递增（封顶 +7）
    const n = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const shift = Math.min(6, Math.max(0, n - 3));
    [0, 4].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.14, freq: midi(72 + shift + iv), type: 'square', vol: 0.24, attack: 0.002 });
    });
  },
  levelup(ctx, out, t0) { // 进入新区域：四音上行
    [67, 71, 74, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'triangle', vol: 0.26, attack: 0.003 });
    });
  },
  nearmiss(ctx, out, t0) { // 差一点：whoosh 扫频
    noise(ctx, out, { t0, dur: 0.22, vol: 0.6, type: 'bandpass', freq: 900, freqEnd: 3200, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.16, freq: 500, freqEnd: 1400, type: 'sine', vol: 0.22, attack: 0.004 });
  },
  rock(ctx, out, t0) { // 岩石出现：低沉 thud
    tone(ctx, out, { t0, dur: 0.16, freq: 110, freqEnd: 70, type: 'sine', vol: 0.4, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.16, type: 'lowpass', freq: 500, q: 1 });
  },
  death(ctx, out, t0) { // 坠毁：下滑 + 闷 thud
    tone(ctx, out, { t0, dur: 0.4, freq: 520, freqEnd: 90, type: 'sawtooth', vol: 0.4, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.22, vol: 0.26, type: 'lowpass', freq: 700, freqEnd: 180, q: 1 });
  },
  best(ctx, out, t0) { // 新纪录：亮双音
    tone(ctx, out, { t0, dur: 0.12, freq: 988, type: 'square', vol: 0.26, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.12, dur: 0.2, freq: 1319, type: 'square', vol: 0.26, attack: 0.002 });
  },
};

const SFX_EVENT_MAP = {
  flap: 'flap',
  start: 'flap',
  score: 'score',
  collect: 'collect',
  delivery: 'delivery',
  combo: 'combo',
  levelup: 'levelup',
  nearmiss: 'nearmiss',
  rock: 'rock',
  death: 'death',
  best: 'best',
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

function kick(ctx, out, t0) {
  return tone(ctx, out, { t0, dur: 0.12, freq: 120, freqEnd: 45, type: 'sine', vol: 0.5, attack: 0.002 });
}

function hat(ctx, out, t0, vol = 0.16) {
  return noise(ctx, out, { t0, dur: 0.03, vol, type: 'highpass', freq: 6000, q: 1 });
}

function bassNote(ctx, out, t0, midiNote) {
  return tone(ctx, out, { t0, dur: 0.22, freq: midi(midiNote), type: 'triangle', vol: 0.34, attack: 0.005, release: 0.22 });
}

function arpNote(ctx, out, t0, midiNote) {
  return tone(ctx, out, { t0, dur: 0.14, freq: midi(midiNote), type: 'square', vol: 0.13, attack: 0.002, release: 0.1 });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const barT = t0 + bar * BAR;
    // 每拍：kick（1、3 拍） / hat（每拍弱）
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      if (b % 2 === 0) push(kick(ctx, bus, bt));
      push(hat(ctx, bus, bt + (b % 2 ? BEAT / 2 : 0), b % 2 ? 0.1 : 0.16));
    }
    // 贝斯：八分音符根音
    for (let e = 0; e < 8; e += 1) {
      push(bassNote(ctx, bus, barT + e * BEAT / 2, chord.root - 12));
    }
    // 和弦垫：每 2 小节
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    // 琶音：十六分音符
    for (let s = 0; s < 16; s += 1) {
      const arp = chord.arp[s % 4];
      push(arpNote(ctx, bus, barT + s * BEAT / 4, arp + (bar >= 8 ? 12 : 0)));
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
    p.setValueAtTime(DUCK_GAIN, t + 2.6);
    p.linearRampToValueAtTime(1, t + 2.75);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'death' || name === 'best') duckBgm();
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
