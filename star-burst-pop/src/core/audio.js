// STAR BURST POP · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹星域轻快电子，BPM 108，Am–F–C–G 进行（每和弦 2 小节），
// 8 小节无缝循环。编制：短噪声「星点」打击 + 三角波贝斯 + 双音锯齿轻 LPF 垫 + 五声音阶马林巴主音。
// SFX：select/pop/rockBreak/combo/levelClear/win/perfect/deadlock，全部 ≤0.5s。
//
// 导出 createAudio()（实时）与 scheduleBgm* / scheduleSfx* + 常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 108;
const BEAT = 60 / BPM;            // ≈0.5556s
const BAR = BEAT * 4;             // ≈2.2222s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;  // ≈17.7778s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-16);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调色彩）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [55, 59] }, // G
];

// 五声音阶主音（8 小节）：[小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 76, 1.5], [0, 2.0, 79, 1.5], [0, 3.5, 81, 0.5],
  [1, 0.0, 84, 2.0], [1, 2.0, 81, 2.0],
  [2, 0.0, 79, 1.5], [2, 2.0, 76, 1.5], [2, 3.5, 72, 0.5],
  [3, 0.0, 74, 3.0], [3, 3.0, 72, 1.0],
  [4, 0.0, 76, 1.5], [4, 2.0, 79, 1.5], [4, 3.5, 84, 0.5],
  [5, 0.0, 88, 2.0], [5, 2.0, 84, 2.0],
  [6, 0.0, 81, 1.5], [6, 2.0, 79, 1.5], [6, 3.5, 76, 0.5],
  [7, 0.0, 79, 3.5], [7, 3.5, 72, 0.5],
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

// ---- SFX（每个都 ≤0.5s）----

const SFX = {
  select(ctx, out, t0) { // 选中的清脆 blip
    tone(ctx, out, { t0, dur: 0.06, freq: 1800, type: 'sine', vol: 0.4, attack: 0.002 });
  },
  pop(ctx, out, t0, payload) { // 引爆：短噪声 burst + 下行正弦
    noise(ctx, out, { t0, dur: 0.16, vol: 0.4, type: 'bandpass', freq: 2600, q: 1.4 });
    const n = payload && typeof payload.size === 'number' ? Math.min(payload.size, 12) : 4;
    tone(ctx, out, { t0, dur: 0.18, freq: 700 + n * 60, freqEnd: 300, type: 'triangle', vol: 0.3, attack: 0.003 });
  },
  rockBreak(ctx, out, t0) { // 岩石碎裂：噪声低通扫频
    noise(ctx, out, { t0, dur: 0.2, vol: 0.4, type: 'lowpass', freq: 1400, freqEnd: 240, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.14, freq: 160, freqEnd: 70, type: 'square', vol: 0.2, attack: 0.003 });
  },
  combo(ctx, out, t0, payload) { // 连击：上行双音
    const c = payload && typeof payload.combo === 'number' ? Math.min(payload.combo, 8) : 2;
    [0, 4].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.14, freq: midi(72 + Math.min(c, 7) + iv), type: 'sine', vol: 0.24, attack: 0.003 });
    });
  },
  levelClear(ctx, out, t0, payload) { // 过关 jingle：三音上行
    const stars = payload && typeof payload.stars === 'number' ? payload.stars : 1;
    const base = 72 + Math.min(stars, 3) * 0; // 保持稳定
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.2, freq: midi(base + iv), type: 'triangle', vol: 0.26, attack: 0.004 });
    });
  },
  win(ctx, out, t0) { // 战役完成：五音上行
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.004 });
    });
  },
  perfect(ctx, out, t0) { // 完美清空：大和弦
    [72, 76, 79].forEach((m) => tone(ctx, out, { t0, dur: 0.3, freq: midi(m), type: 'sine', vol: 0.26, attack: 0.004 }));
  },
  deadlock(ctx, out, t0) { // 死局结算：柔和收束
    tone(ctx, out, { t0, dur: 0.2, freq: 520, freqEnd: 380, type: 'sine', vol: 0.2, attack: 0.005 });
  },
};

const SFX_EVENT_MAP = {
  select: 'select',
  pop: 'pop',
  rockBreak: 'rockBreak',
  combo: 'combo',
  levelClear: 'levelClear',
  win: 'win',
  perfect: 'perfect',
  deadlock: 'deadlock',
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

function stardust(ctx, out, { t0, vol = 0.3 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'bandpass', freq: 2600, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.28, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.28 });
}

function pluck(ctx, out, { t0, midiNote, dur }) {
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
      push(stardust(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.32 : 0.22 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar) push(pluck(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.12);
    p.setValueAtTime(DUCK_GAIN, t + 2.4);
    p.linearRampToValueAtTime(1, t + 2.55);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'win' || name === 'levelClear') duckBgm();
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
