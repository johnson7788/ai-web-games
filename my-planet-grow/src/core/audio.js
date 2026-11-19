// MY PLANET GROW · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：太空氛围，BPM 96，Am–F–C–G 四和弦各 2 小节，共 8 小节无缝循环。
// 三层编制：和弦垫（双音锯齿低通）、贝斯（三角波根音）、主音（正弦钟音 arpeggio）。
// SFX：meteor/gold/shield/hit/absorb/tierUp/gameover/combo，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 96;
const BEAT = 60 / BPM;            // 0.625s
const BAR = BEAT * 4;             // 2.5s
const BGM_BARS = 8;               // 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 20s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦（Am / F / C / G）：root=贝斯根音，pad=双音和弦垫
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// 主音 arpeggio：[小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 69, 1.0], [0, 1.0, 72, 1.0], [0, 2.0, 76, 1.0], [0, 3.0, 81, 1.0],
  [1, 0.0, 76, 1.0], [1, 2.0, 72, 1.5],
  [2, 0.0, 65, 1.0], [2, 1.0, 69, 1.0], [2, 2.0, 72, 1.0], [2, 3.0, 77, 1.0],
  [3, 0.0, 72, 1.0], [3, 2.0, 69, 1.5],
  [4, 0.0, 67, 1.0], [4, 1.0, 72, 1.0], [4, 2.0, 76, 1.0], [4, 3.0, 79, 1.0],
  [5, 0.0, 76, 1.0], [5, 2.0, 72, 1.5],
  [6, 0.0, 62, 1.0], [6, 1.0, 67, 1.0], [6, 2.0, 71, 1.0], [6, 3.0, 74, 1.0],
  [7, 0.0, 71, 1.0], [7, 1.0, 67, 1.0], [7, 2.0, 62, 2.0],
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

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.5, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.008, release: 0.4 });
}

function bell(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.2, attack: 0.003, release: Math.min(dur, 0.4) });
}

// ---- SFX 合成（每个 ≤0.6s）----
const SFX = {
  meteor(ctx, out, t0) { // 明亮上行 blip
    tone(ctx, out, { t0, dur: 0.12, freq: 760, freqEnd: 1180, type: 'sine', vol: 0.42, attack: 0.002 });
  },
  gold(ctx, out, t0) { // 双音上行 chime
    tone(ctx, out, { t0, dur: 0.16, freq: 880, type: 'sine', vol: 0.34, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.08, dur: 0.2, freq: 1320, type: 'sine', vol: 0.34, attack: 0.002 });
  },
  shield(ctx, out, t0) { // 温暖短促 pad blip
    tone(ctx, out, { t0, dur: 0.22, freq: 660, freqEnd: 990, type: 'triangle', vol: 0.34, attack: 0.004 });
  },
  hit(ctx, out, t0) { // 低沉闷响 + 噪声
    tone(ctx, out, { t0, dur: 0.28, freq: 130, freqEnd: 60, type: 'sine', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.16, vol: 0.24, type: 'lowpass', freq: 500, q: 1 });
  },
  absorb(ctx, out, t0) { // 护盾吸收：短促“啵”
    tone(ctx, out, { t0, dur: 0.14, freq: 520, freqEnd: 260, type: 'triangle', vol: 0.4, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.08, vol: 0.16, type: 'bandpass', freq: 1400, q: 4 });
  },
  tierUp(ctx, out, t0) { // 三连上行
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.3, freq: midi(m), type: 'sine', vol: 0.3, attack: 0.004 });
    });
  },
  gameover(ctx, out, t0) { // 下行闷 thud
    tone(ctx, out, { t0, dur: 0.5, freq: 110, freqEnd: 48, type: 'sine', vol: 0.55, attack: 0.006 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.26, type: 'lowpass', freq: 420, q: 1 });
  },
  combo(ctx, out, t0, payload) { // 连击提示：音高随 combo 上移（封顶 +7 半音）
    const n = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const shift = Math.min(Math.max(0, n - 1), 7);
    tone(ctx, out, { t0, dur: 0.07, freq: midi(76 + shift), type: 'square', vol: 0.16, attack: 0.002 });
  },
};

const SFX_EVENT_MAP = {
  meteor: 'meteor',
  gold: 'gold',
  shield: 'shield',
  hit: 'hit',
  absorb: 'absorb',
  tierUp: 'tierUp',
  gameover: 'gameover',
  combo: 'combo',
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
export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar) push(bell(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    if (sfx) {
      scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    }
    if (name === 'gameover') duckBgm();
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
