// FIGHTER KO ARENA · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机电子律动，BPM 138，A 小调 A–F–C–G 循环（每和弦 2 小节，共 8 小节无缝循环）。
// 三层编制：打击点=短噪声底鼓/hat、贝斯=锯齿根音、主音=方波短促霓虹 arp。
// SFX：punch/kick/block/super/enemyWindup/hitEnemy/combo/win/lose，全部 ≤0.6s。
//
// 导出 createAudio()（实时）+ scheduleBgmLoop/scheduleSfx/常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 138;
const BEAT = 60 / BPM;             // ≈0.4348s
const BAR = BEAT * 4;              // ≈1.739s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;   // ≈13.91s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-13);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A 小调循环：root=贝斯根音(MIDI)，arp=主音三音（根/五度/八度）
const CHORDS = [
  { root: 45, arp: [69, 72, 76] }, // Am
  { root: 41, arp: [65, 69, 72] }, // F
  { root: 48, arp: [72, 76, 79] }, // C
  { root: 43, arp: [67, 71, 74] }, // G
];

// 主音 arp（每小节 8 个十六分音）
const ARP = [0, 1, 2, 1, 0, 1, 2, 1];

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

// ---- SFX 合成（每个 ≤0.6s）----
const SFX = {
  punch(ctx, out, t0) { // 短促拳击：低频 punch + 噪声
    tone(ctx, out, { t0, dur: 0.12, freq: 220, freqEnd: 90, type: 'triangle', vol: 0.5, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.06, vol: 0.2, type: 'bandpass', freq: 1800, q: 2 });
  },
  kick(ctx, out, t0) { // 扫腿：更长扫频
    tone(ctx, out, { t0, dur: 0.22, freq: 180, freqEnd: 60, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.18, vol: 0.24, type: 'lowpass', freq: 1200, freqEnd: 300, q: 1 });
  },
  block(ctx, out, t0) { // 格挡：金属 clang
    tone(ctx, out, { t0, dur: 0.1, freq: 620, type: 'square', vol: 0.2, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.08, vol: 0.2, type: 'highpass', freq: 2400, q: 2 });
  },
  superMove(ctx, out, t0) { // 超必杀：上升扫频爆发
    tone(ctx, out, { t0, dur: 0.3, freq: 200, freqEnd: 1200, type: 'sawtooth', vol: 0.3, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.4, type: 'lowpass', freq: 400, freqEnd: 4000, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.4, freq: 90, freqEnd: 40, type: 'sine', vol: 0.5, attack: 0.004 });
  },
  enemyWindup(ctx, out, t0) { // 敌方预警 beep
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.16, attack: 0.003 });
  },
  hitEnemy(ctx, out, t0) { // 命中反馈：短 click + 下坠
    tone(ctx, out, { t0, dur: 0.09, freq: 320, freqEnd: 140, type: 'sine', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.04, vol: 0.16, type: 'bandpass', freq: 1500, q: 3 });
  },
  combo(ctx, out, t0, payload) { // 连击：音高随 combo 递增
    const n = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const shift = Math.min(7, n);
    tone(ctx, out, { t0, dur: 0.1, freq: midi(72 + shift), type: 'square', vol: 0.18, attack: 0.003 });
  },
  win(ctx, out, t0) { // 胜利 jingle
    [72, 76, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败 thud
    tone(ctx, out, { t0, dur: 0.4, freq: 130, freqEnd: 50, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  punch: 'punch',
  kick: 'kick',
  block: 'block',
  super: 'superMove',
  enemyWindup: 'enemyWindup',
  hitEnemy: 'hitEnemy',
  combo: 'combo',
  win: 'win',
  matchWin: 'win',
  levelWin: 'win',
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

// ---- BGM 一个循环的编排（8 小节，采样精确、无缝）----
function kick(ctx, out, { t0 }) {
  return tone(ctx, out, { t0, dur: 0.14, freq: 120, freqEnd: 45, type: 'sine', vol: 0.5, attack: 0.002, release: 0.14 });
}
function hat(ctx, out, { t0, vol = 0.12 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 6000, q: 1 });
}
function bass(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.22, freq: midi(midiNote), type: 'sawtooth', vol: 0.2, attack: 0.004, release: 0.22 });
}
function arp(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.09, freq: midi(midiNote), type: 'square', vol: 0.12, attack: 0.002, release: 0.09 });
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
      push(kick(ctx, bus, { t0: barT + b * BEAT }));
      push(hat(ctx, bus, { t0: barT + b * BEAT + BEAT / 2 }));
      push(bass(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    for (let i = 0; i < 8; i += 1) {
      push(arp(ctx, bus, { t0: barT + i * (BEAT / 2), midiNote: chord.arp[ARP[i]] }));
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
    if (name === 'win' || name === 'matchWin' || name === 'lose') duckBgm();
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
