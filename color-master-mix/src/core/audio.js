// COLOR MASTER MIX · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹轻电子，BPM 100，A 小调进行 Am–F–C–G（每和弦 2 小节），8 小节无缝循环。
// 四层：鼓点=短噪声、贝斯=三角波根音、和弦垫=锯齿轻 LPF、主音=正弦短衰减（第 5 小节起）。
// SFX：paint / combo / unlock / magic / undo / win / lose / click，全部 ≤0.6s。
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx / 常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 0.6s
const BAR = BEAT * 4;             // 2.4s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;  // 19.2s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A 小调：Am - F - C - G
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// 主音（第 5–8 小节）：[小节内, 拍, MIDI, 持续拍数]，五声音阶，轻盈跳跃
const MELODY = [
  [4, 0.0, 76, 1.0], [4, 1.5, 79, 0.5], [4, 2.5, 81, 1.0],
  [5, 0.0, 79, 1.0], [5, 1.5, 76, 0.5], [5, 2.5, 72, 1.0],
  [6, 0.0, 74, 1.0], [6, 1.5, 76, 0.5], [6, 2.5, 79, 1.0],
  [7, 0.0, 81, 1.5], [7, 2.0, 76, 1.5],
];

// ---- 低层合成（对 AudioContext / OfflineAudioContext 通用）----

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
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + att);
    g.gain.setValueAtTime(vol, t0 + dur - 0.18);
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
  paint(ctx, out, t0, payload) { // 上色：音高随连击上升的亮 pluck
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const shift = Math.min(7, Math.max(0, combo - 1));
    tone(ctx, out, { t0, dur: 0.14, freq: midi(72 + shift), type: 'triangle', vol: 0.42, attack: 0.002, release: 0.12 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.1, type: 'bandpass', freq: 3000, q: 6 });
  },
  combo(ctx, out, t0) { // 连击：双音上行
    tone(ctx, out, { t0, dur: 0.1, freq: midi(79), type: 'square', vol: 0.18, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.07, dur: 0.12, freq: midi(84), type: 'square', vol: 0.18, attack: 0.002 });
  },
  unlock(ctx, out, t0) { // 封印解锁：小风铃
    tone(ctx, out, { t0, dur: 0.22, freq: midi(84), type: 'sine', vol: 0.3, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.22, freq: midi(88), type: 'sine', vol: 0.24, attack: 0.003 });
  },
  magic(ctx, out, t0) { // 魔法填充：上行扫频 + 闪
    tone(ctx, out, { t0, dur: 0.3, freq: 400, freqEnd: 1400, type: 'sine', vol: 0.32, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.16, type: 'highpass', freq: 2500, q: 1 });
  },
  undo(ctx, out, t0) { // 撤销：下行 blip
    tone(ctx, out, { t0, dur: 0.16, freq: 500, freqEnd: 240, type: 'triangle', vol: 0.34, attack: 0.003 });
  },
  win(ctx, out, t0) { // 五音上行 jingle C-E-G-C-E（紧凑）
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.14, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.003 });
    });
  },
  lose(ctx, out, t0) { // 120Hz 闷 thud + 短噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.18, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  click(ctx, out, t0) { // 选色 tick
    tone(ctx, out, { t0, dur: 0.04, freq: 1200, type: 'square', vol: 0.14, attack: 0.001 });
  },
  countdown(ctx, out, t0) { // 最后 5s 每秒 beep
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.26, attack: 0.003 });
  },
};

// 把 sim 事件映射到 SFX（countdownTick 有门控，单独处理，绝不放进 map）
const SFX_EVENT_MAP = {
  regionFill: 'paint',
  combo: 'combo',
  rockUnlock: 'unlock',
  magicFill: 'magic',
  undo: 'undo',
  win: 'win',
  lose: 'lose',
  selectShade: 'click',
  selectFamily: 'click',
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

function drum(ctx, out, { t0, vol = 0.34 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'bandpass', freq: 2600, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.28, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.28 });
}

function lead(ctx, out, { t0, midiNote, dur }) {
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
      push(drum(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.34 : 0.22 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 4) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar) push(lead(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
