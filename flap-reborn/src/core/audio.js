// FLAP REBORN · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：合成波（synthwave），BPM 100，A 小调进行 Am–F–C–G（每和弦 1 小节），共 8 小节无缝循环。
// 四层编制：底鼓=正弦快速降频、贝斯=锯齿根音、和弦垫=双音锯齿轻 LPF、琶音=方波 16 分音。
// SFX：flap/score/nearMiss/orb/shieldGain/shieldBreak/levelUp/lose/start，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 一拍 0.6s
const BAR = BEAT * 4;             // 一小节 2.4s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 19.2s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)，arp=琶音音阶(MIDI)
const CHORDS = [
  { root: 33, pad: [57, 60], arp: [57, 60, 64, 69] }, // Am
  { root: 29, pad: [53, 57], arp: [53, 57, 60, 65] }, // F
  { root: 36, pad: [48, 52], arp: [48, 52, 55, 60] }, // C
  { root: 31, pad: [55, 59], arp: [55, 59, 62, 67] }, // G
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
  return tone(ctx, out, { t0, dur: 0.14, freq: 130, freqEnd: 40, type: 'sine', vol, attack: 0.002, release: 0.14 });
}

function bass(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.28, freq: midi(midiNote), type: 'sawtooth', vol: 0.26, attack: 0.005, release: 0.28 });
}

function arp(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.12, freq: midi(midiNote), type: 'square', vol: 0.12, attack: 0.003, release: 0.1 });
}

// ---- SFX 合成（每个都短 ≤0.6s）----

const SFX = {
  start(ctx, out, t0) { // 上行的准备音
    [64, 69, 72].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.004 });
    });
  },
  flap(ctx, out, t0) { // 短促上挑 blip
    tone(ctx, out, { t0, dur: 0.12, freq: 520, freqEnd: 900, type: 'sine', vol: 0.32, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.12, type: 'bandpass', freq: 3200, q: 4 });
  },
  score(ctx, out, t0) { // 清亮 pluck
    tone(ctx, out, { t0, dur: 0.16, freq: 880, type: 'triangle', vol: 0.3, attack: 0.003, release: 0.14 });
    tone(ctx, out, { t0: t0 + 0.02, dur: 0.16, freq: 1320, type: 'sine', vol: 0.14, attack: 0.003, release: 0.14 });
  },
  nearMiss(ctx, out, t0) { // 擦边嘶声
    noise(ctx, out, { t0, dur: 0.18, vol: 0.6, type: 'bandpass', freq: 2600, freqEnd: 900, q: 1 });
  },
  orb(ctx, out, t0) { // 光珠上行三连
    [76, 79, 83].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.22, freq: midi(m), type: 'sine', vol: 0.24, attack: 0.003 });
    });
  },
  shieldGain(ctx, out, t0) { // 充能闪光
    tone(ctx, out, { t0, dur: 0.3, freq: 1200, freqEnd: 1900, type: 'sine', vol: 0.2, attack: 0.006 });
  },
  shieldBreak(ctx, out, t0) { // 破盾碎裂
    noise(ctx, out, { t0, dur: 0.22, vol: 0.4, type: 'highpass', freq: 1800, q: 1 });
    tone(ctx, out, { t0, dur: 0.18, freq: 300, freqEnd: 120, type: 'square', vol: 0.24, attack: 0.004 });
  },
  levelUp(ctx, out, t0) { // 加速过场
    tone(ctx, out, { t0, dur: 0.4, freq: 400, freqEnd: 1000, type: 'sawtooth', vol: 0.16, attack: 0.02 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.3, freq: 600, freqEnd: 1400, type: 'sine', vol: 0.12, attack: 0.02 });
  },
  lose(ctx, out, t0) { // 坠落闷响
    tone(ctx, out, { t0, dur: 0.5, freq: 220, freqEnd: 50, type: 'sawtooth', vol: 0.4, attack: 0.006, release: 0.5 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  start: 'start',
  flap: 'flap',
  score: 'score',
  nearMiss: 'nearMiss',
  orb: 'orb',
  shieldGain: 'shieldGain',
  shieldBreak: 'shieldBreak',
  levelUp: 'levelUp',
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
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(kick(ctx, bus, { t0: bt, vol: b === 0 ? 0.5 : 0.42 }));
      push(bass(ctx, bus, { t0: bt, midiNote: chord.root }));
    }
    // 16 分琶音（每拍 4 个，取 arp 音阶循环）
    for (let step = 0; step < 16; step += 1) {
      const m = chord.arp[step % 4];
      push(arp(ctx, bus, { t0: barT + step * (BEAT / 4), midiNote: m }));
    }
    push(padNote(ctx, bus, { t0: barT, dur: BAR, freqs: chord.pad }));
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
    p.setValueAtTime(DUCK_GAIN, t + 1.6);
    p.linearRampToValueAtTime(1, t + 1.8);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'lose') duckBgm();
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
