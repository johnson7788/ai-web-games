// Hook & Gold · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：深海打捞氛围，BPM 96，D 小调进行 Dm–C–Bb–A（每和弦 2 小节）。
// 共 12 小节无缝循环（相位连续，不用 media 淡入淡出）。
// 四层编制：打击点=短噪声木鱼、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=马林巴感正弦短衰减。
// SFX：fire/grab/hookEnd/coin/win/lose/sting/explode/clam/bubble/whoosh/countdown，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 96;
const BEAT = 60 / BPM;            // 一拍 ≈0.625s
const BAR = BEAT * 4;             // 一小节 ≈2.5s
const BGM_BARS = 12;              // 12 小节
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 ≈30s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（D 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 38, pad: [53, 57] }, // Dm
  { root: 36, pad: [52, 55] }, // C
  { root: 34, pad: [50, 53] }, // Bb
  { root: 33, pad: [49, 52] }, // A
];

// 主音（全 12 小节）：[小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 74, 1.5], [0, 2.0, 77, 1.5], [0, 3.5, 81, 0.5],
  [1, 0.0, 77, 2.0], [1, 2.0, 74, 2.0],
  [2, 0.0, 72, 1.5], [2, 2.0, 74, 1.5], [2, 3.5, 76, 0.5],
  [3, 0.0, 79, 3.0], [3, 3.0, 76, 1.0],
  [4, 0.0, 70, 1.5], [4, 2.0, 74, 1.5], [4, 3.5, 77, 0.5],
  [5, 0.0, 76, 2.0], [5, 2.0, 72, 2.0],
  [6, 0.0, 69, 1.5], [6, 2.0, 72, 1.5], [6, 3.5, 74, 0.5],
  [7, 0.0, 76, 3.0], [7, 3.0, 74, 1.0],
  [8, 0.0, 74, 1.5], [8, 2.0, 77, 1.5], [8, 3.5, 81, 0.5],
  [9, 0.0, 77, 2.0], [9, 2.0, 79, 2.0],
  [10, 0.0, 72, 1.5], [10, 2.0, 74, 1.5], [10, 3.5, 76, 0.5],
  [11, 0.0, 74, 3.5], [11, 3.5, 69, 0.5],
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

// ---- SFX（每个 ≤0.6s）----
const SFX = {
  fire(ctx, out, t0) { // 锚爪发射：短促 whoosh + 金属滑
    noise(ctx, out, { t0, dur: 0.22, vol: 0.3, type: 'bandpass', freq: 1400, freqEnd: 500, q: 1.5 });
    tone(ctx, out, { t0, dur: 0.12, freq: 220, freqEnd: 140, type: 'triangle', vol: 0.22, attack: 0.004 });
  },
  grab(ctx, out, t0) { // 命中抓握：金属 clunk
    tone(ctx, out, { t0, dur: 0.1, freq: 320, freqEnd: 180, type: 'triangle', vol: 0.5, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.18, type: 'bandpass', freq: 2600, q: 6 });
  },
  hookEnd(ctx, out, t0) { // 拖上船：低 thump + 水声
    tone(ctx, out, { t0, dur: 0.18, freq: 150, freqEnd: 90, type: 'sine', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.16, vol: 0.16, type: 'lowpass', freq: 700, q: 1 });
  },
  coin(ctx, out, t0, payload) { // 金币入账：双音上行
    const m = 84 + Math.min(4, Math.floor((payload && payload.value || 0) / 150));
    tone(ctx, out, { t0, dur: 0.14, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.09, dur: 0.18, freq: midi(m + 4), type: 'triangle', vol: 0.3, attack: 0.003 });
  },
  win(ctx, out, t0) { // 通关 jingle
    [74, 78, 81, 86].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：闷 thud
    tone(ctx, out, { t0, dur: 0.42, freq: 120, freqEnd: 50, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  countdown(ctx, out, t0) { // 最后 5 秒 beep
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.26, attack: 0.003 });
  },
  sting(ctx, out, t0) { // 水母蜇：电流 zap
    noise(ctx, out, { t0, dur: 0.18, vol: 0.4, type: 'bandpass', freq: 3200, freqEnd: 900, q: 2 });
    tone(ctx, out, { t0, dur: 0.16, freq: 900, freqEnd: 220, type: 'sawtooth', vol: 0.2, attack: 0.002 });
  },
  explode(ctx, out, t0) { // 爆炸：噪声爆发 + 低频扫
    noise(ctx, out, { t0, dur: 0.4, vol: 0.55, type: 'lowpass', freq: 2600, freqEnd: 200, q: 1 });
    tone(ctx, out, { t0, dur: 0.3, freq: 140, freqEnd: 40, type: 'sine', vol: 0.5, attack: 0.003 });
  },
  clam(ctx, out, t0) { // 珍珠贝开合 blip
    tone(ctx, out, { t0, dur: 0.09, freq: 720, freqEnd: 980, type: 'sine', vol: 0.22, attack: 0.003 });
  },
  bubble(ctx, out, t0) { // 气泡 blip
    tone(ctx, out, { t0, dur: 0.07, freq: 1100, freqEnd: 600, type: 'sine', vol: 0.18, attack: 0.002 });
  },
  whoosh(ctx, out, t0) { // nearMiss：轻扫
    noise(ctx, out, { t0, dur: 0.22, vol: 0.5, type: 'bandpass', freq: 700, freqEnd: 1400, q: 1.2 });
  },
};

// 事件名 → SFX 名
const SFX_EVENT_MAP = {
  fire: 'fire',
  grab: 'grab',
  hookEnd: 'hookEnd',
  money: 'coin',
  win: 'win',
  lose: 'lose',
  sting: 'sting',
  explode: 'explode',
  clamOpen: 'clam',
  clamClose: 'clam',
  bubble: 'bubble',
  nearMiss: 'whoosh',
  abort: 'explode',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环（12 小节，无缝）----
function woodblock(ctx, out, { t0, vol = 0.36 }) {
  return noise(ctx, out, { t0, dur: 0.045, vol, type: 'bandpass', freq: 2300, q: 5 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.32, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}
function marimba(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.2, attack: 0.003, release: Math.min(dur, 0.4) });
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
    else if (name === 'countdownTick') {
      const left = payload && payload.timeLeft;
      if (typeof left === 'number' && left > 0 && left <= 5) scheduleSfx(ctx, sfxBus, 'countdown', payload, ctx.currentTime);
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
