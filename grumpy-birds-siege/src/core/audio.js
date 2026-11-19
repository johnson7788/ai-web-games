// GRUMPY BIRDS SIEGE · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：合成波攻城曲，BPM 100，a 小调进行 Am–F–C–G（每和弦 2 小节）。
// A 段 8 小节节奏铺底无主音 / B 段 8 小节主音进入，共 16 小节无缝循环。
// 四层：kick=正弦坠击、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、arp=方波十六分琶音、主音=锯齿短衰减。
// SFX：flap/score/combo/rock/rockDodge/shield/shieldGet/shieldUse/win/star/lose，全部 ≤0.6s。
//
// 导出 createAudio()（实时），另导出 scheduleBgmLoop / scheduleSfx / 常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 0.6s
const BAR = BEAT * 4;             // 2.4s
const BGM_BARS = 16;              // A 8 + B 8
const BGM_LOOP = BAR * BGM_BARS;  // 38.4s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（a 小调）：root=贝斯根音，pad=和弦垫，arp=琶音音组
const CHORDS = [
  { root: 45, pad: [52, 57], arp: [57, 60, 64, 69] }, // Am
  { root: 41, pad: [48, 53], arp: [53, 57, 60, 65] }, // F
  { root: 48, pad: [55, 60], arp: [60, 64, 67, 72] }, // C
  { root: 43, pad: [50, 55], arp: [55, 59, 62, 67] }, // G
];

// 主音（B 段 8 小节）：[段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 81, 1.0], [0, 1.5, 76, 0.5], [0, 2.0, 72, 1.0], [0, 3.0, 76, 1.0],
  [1, 0.0, 77, 1.0], [1, 1.5, 72, 0.5], [1, 2.0, 69, 1.5],
  [2, 0.0, 76, 1.0], [2, 1.5, 77, 0.5], [2, 2.0, 81, 1.0], [2, 3.0, 84, 1.0],
  [3, 0.0, 81, 1.5], [3, 2.0, 79, 2.0],
  [4, 0.0, 77, 1.0], [4, 1.5, 76, 0.5], [4, 2.0, 72, 1.5],
  [5, 0.0, 74, 1.0], [5, 1.5, 71, 0.5], [5, 2.0, 67, 2.0],
  [6, 0.0, 72, 1.0], [6, 1.5, 76, 0.5], [6, 2.0, 79, 1.0], [6, 3.0, 76, 1.0],
  [7, 0.0, 72, 3.5], [7, 3.5, 67, 0.5],
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
    lp.frequency.value = 1400;
    lp.Q.value = 0.6;
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
    oscs.push(osc);
  }
  return oscs;
}

function kick(ctx, out, { t0, vol = 0.5 }) {
  return tone(ctx, out, { t0, dur: 0.14, freq: 120, freqEnd: 46, type: 'sine', vol, attack: 0.002 });
}

function snare(ctx, out, { t0, vol = 0.2 }) {
  return noise(ctx, out, { t0, dur: 0.1, vol, type: 'highpass', freq: 1800, q: 0.8 });
}

function hat(ctx, out, { t0, vol = 0.1 }) {
  return noise(ctx, out, { t0, dur: 0.03, vol, type: 'highpass', freq: 6000, q: 1 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.24, freq: midi(midiNote), type: 'triangle', vol: 0.34, attack: 0.005, release: 0.24 });
}

function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.09, freq: midi(midiNote), type: 'square', vol: 0.09, attack: 0.002, release: 0.05 });
}

function leadNote(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sawtooth', vol: 0.16, attack: 0.006, release: Math.min(dur, 0.3) });
}

// ---- SFX（每个 ≤0.6s）----

const SFX = {
  flap(ctx, out, t0) { // 振翅 chirp
    tone(ctx, out, { t0, dur: 0.09, freq: 520, freqEnd: 940, type: 'sine', vol: 0.42, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.1, type: 'bandpass', freq: 2600, q: 4 });
  },
  score(ctx, out, t0) { // 过墙 blip
    tone(ctx, out, { t0, dur: 0.09, freq: 700, freqEnd: 1080, type: 'triangle', vol: 0.4, attack: 0.002 });
  },
  combo(ctx, out, t0, payload) { // 连击三连音
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const shift = Math.min(Math.max(0, combo - 5), 7);
    const base = 72 + shift;
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(base + iv), type: 'sine', vol: 0.24, attack: 0.003 });
    });
  },
  rock(ctx, out, t0) { // 投石 whoosh
    noise(ctx, out, { t0, dur: 0.34, vol: 0.34, type: 'lowpass', freq: 3200, freqEnd: 420, q: 1.2 });
  },
  rockDodge(ctx, out, t0) { // 擦身而过 swoosh
    noise(ctx, out, { t0, dur: 0.22, vol: 0.46, type: 'bandpass', freq: 900, freqEnd: 2200, q: 0.8 });
  },
  shield(ctx, out, t0) { // 盾牌出现 shimmer
    tone(ctx, out, { t0, dur: 0.2, freq: 1320, freqEnd: 1560, type: 'sine', vol: 0.2, attack: 0.004 });
  },
  shieldGet(ctx, out, t0) { // 拾取 chime
    [0, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.22, freq: midi(76 + iv), type: 'sine', vol: 0.3, attack: 0.003 });
    });
  },
  shieldUse(ctx, out, t0) { // 破盾 clank
    tone(ctx, out, { t0, dur: 0.16, freq: 220, freqEnd: 120, type: 'square', vol: 0.32, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.2, type: 'highpass', freq: 2400, q: 1 });
  },
  win(ctx, out, t0, payload) { // 破城 jingle
    const stars = payload && typeof payload.stars === 'number' ? payload.stars : 1;
    [72, 76, 79, 84, 88, 91].slice(0, 3 + stars).forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  star(ctx, out, t0) { // 星级 sparkle
    tone(ctx, out, { t0, dur: 0.3, freq: 1568, freqEnd: 2093, type: 'sine', vol: 0.2, attack: 0.004 });
  },
  lose(ctx, out, t0) { // 失败 thud
    tone(ctx, out, { t0, dur: 0.42, freq: 130, freqEnd: 52, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.24, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  start: 'flap',
  flap: 'flap',
  score: 'score',
  combo: 'combo',
  nearMiss: 'rockDodge',
  rock: 'rock',
  rockDodge: 'rockDodge',
  shield: 'shield',
  shieldGet: 'shieldGet',
  shieldUse: 'shieldUse',
  win: 'win',
  star: 'star',
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

// ---- BGM 一个循环（16 小节，无缝）----

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(kick(ctx, bus, { t0: bt, vol: b === 0 ? 0.5 : 0.42 }));
      push(snare(ctx, bus, { t0: bt + BEAT / 2 }));
      push(hat(ctx, bus, { t0: bt + BEAT / 2 }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    // arp 十六分音符
    for (let s = 0; s < 16; s += 1) {
      const note = chord.arp[s % 4];
      push(arpNote(ctx, bus, { t0: barT + s * (BEAT / 4), midiNote: note }));
    }
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(leadNote(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
