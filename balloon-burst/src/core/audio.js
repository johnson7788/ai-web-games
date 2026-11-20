// Balloon Burst · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：纸灯笼节轻快暖调，BPM 96，C 大调进行 C–G–Am–F（每和弦 2 小节）。
// A 段 8 小节无主音 / B 段 8 小节主音进入，共 16 小节无缝循环。
// 四层编制：打击=柔和木鱼、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=马林巴感正弦短衰减。
// SFX：tap/pop/cascade/metalHit/fireRow/chain/shift/refill/shuffle/bigClear/timeBonus/bomb/double/win/lose，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 96;
const BEAT = 60 / BPM;            // 一拍 ≈0.625s
const BAR = BEAT * 4;             // 一小节 ≈2.5s
const BGM_BARS = 16;              // A 段 8 + B 段 8
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 ≈40s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（C 大调，温暖节日感）：C–G–Am–F
const CHORDS = [
  { root: 48, pad: [55, 60, 64] }, // C
  { root: 43, pad: [50, 55, 59] }, // G
  { root: 45, pad: [52, 57, 60] }, // Am
  { root: 41, pad: [48, 53, 57] }, // F
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 76, 1.5], [0, 2.0, 79, 1.5], [0, 3.5, 84, 0.5],
  [1, 0.0, 79, 2.0], [1, 2.0, 76, 2.0],
  [2, 0.0, 72, 1.5], [2, 2.0, 76, 1.5], [2, 3.5, 79, 0.5],
  [3, 0.0, 81, 3.0], [3, 3.0, 79, 1.0],
  [4, 0.0, 77, 1.5], [4, 2.0, 76, 1.5], [4, 3.5, 72, 0.5],
  [5, 0.0, 69, 2.0], [5, 2.0, 72, 2.0],
  [6, 0.0, 74, 1.5], [6, 2.0, 71, 1.5], [6, 3.5, 67, 0.5],
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
  tap(ctx, out, t0) { // 轻点：2kHz 阻尼 click
    tone(ctx, out, { t0, dur: 0.05, freq: 1800, type: 'sine', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.14, type: 'bandpass', freq: 1800, q: 6 });
  },
  pop(ctx, out, t0, payload) { // 爆破：音高随群大小下移，越大越低
    const n = payload && typeof payload.n === 'number' ? payload.n : 2;
    const f = Math.max(300, 700 - (n - 2) * 70);
    tone(ctx, out, { t0, dur: 0.16, freq: f, freqEnd: f * 0.6, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.2, type: 'lowpass', freq: 900, q: 1 });
  },
  cascade(ctx, out, t0, payload) { // 灯串连锁：三连上行风铃
    const n = payload && typeof payload.chain === 'number' ? Math.min(7, payload.chain) : 0;
    const base = 72 + n;
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.28, freq: midi(base + iv), type: 'sine', vol: 0.24, attack: 0.004 });
    });
  },
  metalHit(ctx, out, t0) { // 金属受击：高音 + 金属噪声
    tone(ctx, out, { t0, dur: 0.09, freq: 2400, type: 'square', vol: 0.2, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.18, type: 'bandpass', freq: 3200, q: 9 });
  },
  fireRow(ctx, out, t0) { // 火星引燃：噪声低通扫频 whoosh
    noise(ctx, out, { t0, dur: 0.32, vol: 0.4, type: 'lowpass', freq: 3400, freqEnd: 300, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.16, freq: 160, freqEnd: 80, type: 'sine', vol: 0.24, attack: 0.004 });
  },
  chain(ctx, out, t0) { // 连锁计数：小钟
    tone(ctx, out, { t0, dur: 0.22, freq: 1200, type: 'sine', vol: 0.26, attack: 0.003 });
  },
  chainBreak(ctx, out, t0) { // 锁链断裂：短 clink
    tone(ctx, out, { t0, dur: 0.07, freq: 1600, type: 'triangle', vol: 0.24, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.04, vol: 0.12, type: 'bandpass', freq: 2600, q: 8 });
  },
  shift(ctx, out, t0) { // 变色：sparkle 高音
    tone(ctx, out, { t0, dur: 0.12, freq: 2200, freqEnd: 3000, type: 'sine', vol: 0.16, attack: 0.002 });
  },
  refill(ctx, out, t0) { // 补充：soft blip
    tone(ctx, out, { t0, dur: 0.06, freq: 600, freqEnd: 500, type: 'sine', vol: 0.14, attack: 0.002 });
  },
  shuffle(ctx, out, t0) { // 洗牌：swish
    noise(ctx, out, { t0, dur: 0.24, vol: 0.45, type: 'bandpass', freq: 1100, freqEnd: 2600, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.14, freq: 900, freqEnd: 1400, type: 'sine', vol: 0.2, attack: 0.004 });
  },
  bigClear(ctx, out, t0) { // 孔明灯升空：温暖上行四连
    [72, 76, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.3, freq: midi(m), type: 'sine', vol: 0.22, attack: 0.004 });
    });
  },
  timeBonus(ctx, out, t0) { // 加时：tick-tock 双音
    tone(ctx, out, { t0, dur: 0.08, freq: 1200, type: 'square', vol: 0.16, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.08, freq: 1500, type: 'square', vol: 0.16, attack: 0.002 });
  },
  bomb(ctx, out, t0) { // 爆点：低 thud + 噪声
    tone(ctx, out, { t0, dur: 0.2, freq: 140, freqEnd: 60, type: 'sine', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.16, vol: 0.3, type: 'lowpass', freq: 700, q: 1 });
  },
  double(ctx, out, t0) { // 双倍：明亮双 blip
    tone(ctx, out, { t0, dur: 0.08, freq: 1000, type: 'triangle', vol: 0.3, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.07, dur: 0.1, freq: 1300, type: 'triangle', vol: 0.3, attack: 0.002 });
  },
  win(ctx, out, t0) { // 胜利 jingle C-E-G-C
    [72, 76, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：闷 thud
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.24, type: 'lowpass', freq: 500, q: 1 });
  },
  countdown(ctx, out, t0) { // 最后 5 秒每秒 beep
    tone(ctx, out, { t0, dur: 0.08, freq: 880, type: 'square', vol: 0.22, attack: 0.003 });
  },
};

// 事件名 → SFX
const SFX_EVENT_MAP = {
  tap: 'tap',
  pop: 'pop',
  cascade: 'cascade',
  metalHit: 'metalHit',
  fireRow: 'fireRow',
  chain: 'chain',
  chainBreak: 'chainBreak',
  shift: 'shift',
  refill: 'refill',
  shuffle: 'shuffle',
  bigClear: 'bigClear',
  timeBonus: 'timeBonus',
  bomb: 'bomb',
  double: 'double',
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

// ---- BGM 一个循环的编排（16 小节，采样精确、无缝）----

function woodblock(ctx, out, { t0, vol = 0.36 }) {
  return noise(ctx, out, { t0, dur: 0.05, vol, type: 'bandpass', freq: 2200, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.3, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}

function marimba(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.18, attack: 0.003, release: Math.min(dur, 0.32) });
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
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(marimba(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
      }
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
    if (sfx) {
      scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    } else if (name === 'countdownTick') {
      const left = payload && payload.timeLeft;
      if (typeof left === 'number' && left > 0 && left <= 5) {
        scheduleSfx(ctx, sfxBus, 'countdown', payload, ctx.currentTime);
      }
    }
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
