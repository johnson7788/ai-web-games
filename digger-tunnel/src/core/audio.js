// DIGGER TUNNEL · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹街机 A 小调 synthwave，BPM 120，和弦进行 Am–F–C–G，8 小节无缝循环。
// 三层编制：底鼓=短噪声、贝斯=三角波根音、琶音=方波八分、主音=正弦短衰减。
// SFX：dig/rock/gem/combo/win/lose/fall/start，全部 ≤0.6s。
// 导出 createAudio()（实时）与 scheduleBgmLoop / scheduleSfx / 常量，
// 供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2.0s
const BGM_BARS = 8;               // 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-8);
const SFX_GAIN = dbToGain(-10);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行：root=贝斯根音，arp=琶音音列
const CHORDS = [
  { root: 45, arp: [57, 60, 64, 69, 64, 60] }, // Am
  { root: 41, arp: [53, 57, 60, 65, 60, 57] }, // F
  { root: 48, arp: [60, 64, 67, 72, 67, 64] }, // C
  { root: 43, arp: [55, 59, 62, 67, 62, 59] }, // G
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

// ---- SFX ----

const SFX = {
  start(ctx, out, t0) { // 上电 blip 上行
    tone(ctx, out, { t0, dur: 0.12, freq: 520, freqEnd: 980, type: 'square', vol: 0.32, attack: 0.003 });
  },
  dig(ctx, out, t0) { // 挖掘：噪声爆发 + 低通下扫
    noise(ctx, out, { t0, dur: 0.28, vol: 0.42, type: 'lowpass', freq: 3200, freqEnd: 320, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.12, freq: 160, freqEnd: 70, type: 'sine', vol: 0.26, attack: 0.004 });
  },
  rock(ctx, out, t0) { // 撞岩：金属 clank
    tone(ctx, out, { t0, dur: 0.1, freq: 320, freqEnd: 180, type: 'square', vol: 0.3, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.06, vol: 0.2, type: 'bandpass', freq: 1800, q: 8 });
  },
  gem(ctx, out, t0) { // 宝石：明亮 ding
    tone(ctx, out, { t0, dur: 0.18, freq: 1320, freqEnd: 1760, type: 'sine', vol: 0.32, attack: 0.002 });
  },
  combo(ctx, out, t0) { // 连击：三连上行
    [0, 3, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.16, freq: midi(79 + iv), type: 'triangle', vol: 0.26, attack: 0.002 });
    });
  },
  fall(ctx, out, t0) { // 坠落 whoosh
    noise(ctx, out, { t0, dur: 0.24, vol: 0.4, type: 'bandpass', freq: 700, freqEnd: 2400, q: 1 });
    tone(ctx, out, { t0, dur: 0.2, freq: 400, freqEnd: 120, type: 'sine', vol: 0.22, attack: 0.003 });
  },
  win(ctx, out, t0) { // 五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 下行闷响
    tone(ctx, out, { t0, dur: 0.42, freq: 220, freqEnd: 70, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.22, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  start: 'start',
  carve: 'dig',
  rock: 'rock',
  gem: 'gem',
  combo: 'combo',
  fall: 'fall',
  win: 'win',
  lose: 'lose',
};

export function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环（8 小节） ----

function kick(ctx, out, t0, vol = 0.5) {
  return tone(ctx, out, { t0, dur: 0.12, freq: 150, freqEnd: 45, type: 'sine', vol, attack: 0.002 });
}

function bass(ctx, out, t0, m) {
  return tone(ctx, out, { t0, dur: 0.26, freq: midi(m), type: 'triangle', vol: 0.34, attack: 0.006, release: 0.26 });
}

function arp(ctx, out, t0, m, vol = 0.22) {
  return tone(ctx, out, { t0, dur: 0.16, freq: midi(m), type: 'square', vol, attack: 0.003, release: 0.1 });
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
      push(kick(ctx, bus, barT + b * BEAT, b === 0 ? 0.5 : 0.34));
      push(bass(ctx, bus, barT + b * BEAT, chord.root));
    }
    // 琶音八分
    for (let s = 0; s < 6; s += 1) {
      push(arp(ctx, bus, barT + s * (BEAT / 1.5), chord.arp[s]));
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

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
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

export { BPM, BEAT, BAR, BGM_BARS, BGM_LOOP };
