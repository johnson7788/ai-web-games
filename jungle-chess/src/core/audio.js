// 翡翠林棋会 · 程序化音频（纯 WebAudio，零音频文件零外链）。
//
// BGM：丛林鼓点 + 五声音阶竹笛，BPM 100，循环 16 小节（相位连续无缝）。
// 四层编制：打击=短噪木鱼+低频鼓点、贝斯=三角波低音、和弦垫=双音锯齿轻 LPF、主音=竹笛感正弦短衰减。
// SFX：select / move / capture / jump / river / trap / win / lose / draw / thinking，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 一拍 ≈0.6s
const BAR = BEAT * 4;             // 一小节 ≈2.4s
const BGM_BARS = 16;              // 16 小节
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 ≈38.4s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 五声音阶（C 宫：C D E G A），贝斯根音循环
const PENTA = [60, 62, 64, 67, 69, 72, 74, 76, 79, 81];
const BASS_ROOTS = [48, 48, 45, 45, 43, 43, 48, 48, 45, 45, 50, 50, 43, 43, 45, 45]; // 每 2 小节换
const PAD_CHORDS = [
  [55, 60, 64], [55, 60, 64], [52, 57, 62], [52, 57, 62],
  [48, 55, 60], [48, 55, 60], [55, 60, 64], [55, 60, 64],
];

// 竹笛主音（B 段 8 小节）：[B段内小节, 拍, 音高, 持续拍数]
const MELODY = [
  [0, 0.0, 76, 1.5], [0, 1.5, 79, 1.0], [0, 3.0, 81, 1.0],
  [1, 0.0, 79, 2.0], [1, 2.5, 76, 1.5],
  [2, 0.0, 74, 1.5], [2, 2.0, 76, 1.5], [2, 3.5, 72, 0.5],
  [3, 0.0, 69, 2.5], [3, 3.0, 72, 1.0],
  [4, 0.0, 71, 1.5], [4, 2.0, 74, 1.5], [4, 3.5, 76, 0.5],
  [5, 0.0, 79, 2.0], [5, 2.5, 81, 1.5],
  [6, 0.0, 79, 1.5], [6, 2.0, 76, 1.5], [6, 3.5, 72, 0.5],
  [7, 0.0, 69, 3.0], [7, 3.5, 64, 0.5],
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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.13 }) {
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

// ---- SFX ----
const SFX = {
  select(ctx, out, t0) { // 轻木鱼 click
    tone(ctx, out, { t0, dur: 0.06, freq: 1800, type: 'sine', vol: 0.5, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.15, type: 'bandpass', freq: 2200, q: 6 });
  },
  move(ctx, out, t0) { // 软落子
    tone(ctx, out, { t0, dur: 0.14, freq: 220, freqEnd: 140, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.16, type: 'lowpass', freq: 700, q: 1 });
  },
  capture(ctx, out, t0) { // 藤蔓缠绕：噪声扫频 + 下行音
    noise(ctx, out, { t0, dur: 0.3, vol: 0.45, type: 'bandpass', freq: 2600, freqEnd: 500, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.18, freq: 520, freqEnd: 240, type: 'sine', vol: 0.3, attack: 0.004 });
  },
  jump(ctx, out, t0) { // 入水 splash
    noise(ctx, out, { t0, dur: 0.34, vol: 0.5, type: 'lowpass', freq: 3400, freqEnd: 300, q: 1.1 });
    tone(ctx, out, { t0: t0 + 0.04, dur: 0.2, freq: 300, freqEnd: 620, type: 'sine', vol: 0.24, attack: 0.004 });
  },
  river(ctx, out, t0) { // 水滴 blip
    tone(ctx, out, { t0, dur: 0.09, freq: 1250, freqEnd: 700, type: 'sine', vol: 0.38, attack: 0.002 });
  },
  trap(ctx, out, t0) { // 陷阱 snap
    tone(ctx, out, { t0, dur: 0.08, freq: 1400, freqEnd: 900, type: 'square', vol: 0.22, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.06, vol: 0.3, type: 'highpass', freq: 2500, q: 1 });
  },
  win(ctx, out, t0) { // 五声上行 jingle
    [72, 74, 76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 低闷 thud
    tone(ctx, out, { t0, dur: 0.4, freq: 130, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  draw(ctx, out, t0) { // 中性双音
    tone(ctx, out, { t0, dur: 0.18, freq: 392, type: 'triangle', vol: 0.28 });
    tone(ctx, out, { t0: t0 + 0.2, dur: 0.24, freq: 330, type: 'triangle', vol: 0.28 });
  },
  thinking(ctx, out, t0) { // 轻 tick
    tone(ctx, out, { t0, dur: 0.05, freq: 900, type: 'sine', vol: 0.2, attack: 0.002 });
  },
};

const SFX_EVENT_MAP = {
  select: 'select',
  move: 'move',
  capture: 'capture',
  jump: 'jump',
  river: 'river',
  trap: 'trap',
  win: 'win',
  lose: 'lose',
  draw: 'draw',
  thinking: 'thinking',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环 ----
function woodblock(ctx, out, { t0, vol = 0.4 }) {
  return noise(ctx, out, { t0, dur: 0.045, vol, type: 'bandpass', freq: 2400, q: 5 });
}
function drum(ctx, out, { t0, vol = 0.5 }) {
  return tone(ctx, out, { t0, dur: 0.22, freq: 120, freqEnd: 70, type: 'sine', vol, attack: 0.003, release: 0.2 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.3, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}
function flute(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.2, attack: 0.008, release: Math.min(dur, 0.3) });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const barT = t0 + bar * BAR;
    const root = BASS_ROOTS[bar % BASS_ROOTS.length];
    const pad = PAD_CHORDS[Math.floor(bar / 2) % PAD_CHORDS.length];
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(woodblock(ctx, bus, { t0: bt, vol: 0.34 }));
      if (b % 2 === 0) push(drum(ctx, bus, { t0: bt, vol: 0.4 }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(flute(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
