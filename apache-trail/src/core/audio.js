// APACHE TRAIL · 程序化音频（纯 WebAudio，零音频文件零外链）。
// BGM：沙漠跑动主题，BPM 100，五声音阶进行，马林巴主音 + 三角波贝斯 + 噪声沙锤。
// SFX：jump/doubleJump/land/collect/combo/shield/shieldBreak/time/spring/wind/climb/death/win/lose/countdown。
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop/scheduleSfx 与常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 一拍 0.6s
const BAR = BEAT * 4;             // 一小节 2.4s
const BGM_BARS = 12;              // 12 小节循环
const BGM_LOOP = BAR * BGM_BARS;  // 28.8s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-9);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 五声音阶根音（A 小调五声：A C D E G）
const PENTA = [57, 60, 62, 64, 67, 69, 72, 74, 76, 79, 81, 84];
const BASS_ROOTS = [45, 45, 48, 48, 43, 43, 45, 45, 41, 41, 43, 45]; // 每小节根音

// 主音旋律（[小节内拍, 五声索引, 持续拍]）
const MELODY = [
  [0, 0.0, 5, 1.0], [0, 2.0, 6, 1.0], [0, 3.0, 5, 1.0],
  [1, 0.0, 4, 1.5], [1, 2.0, 5, 2.0],
  [2, 0.0, 3, 1.0], [2, 2.0, 4, 1.0], [2, 3.0, 5, 1.0],
  [3, 0.0, 7, 2.5], [3, 3.0, 6, 1.0],
  [4, 0.0, 8, 1.0], [4, 2.0, 7, 1.0], [4, 3.0, 6, 1.0],
  [5, 0.0, 5, 2.0], [5, 2.0, 4, 2.0],
  [6, 0.0, 6, 1.0], [6, 2.0, 5, 1.0], [6, 3.0, 4, 1.0],
  [7, 0.0, 3, 3.0], [7, 3.0, 2, 1.0],
  [8, 0.0, 5, 1.5], [8, 2.0, 6, 1.5], [8, 3.5, 7, 0.5],
  [9, 0.0, 6, 2.0], [9, 2.0, 5, 2.0],
  [10, 0.0, 4, 1.0], [10, 2.0, 3, 1.0], [10, 3.0, 4, 1.0],
  [11, 0.0, 2, 3.5], [11, 3.5, 0, 0.5],
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

// ---- SFX 合成（每个都短 ≤0.6s）----

const SFX = {
  jump(ctx, out, t0) { // 上跳 blip
    tone(ctx, out, { t0, dur: 0.14, freq: 420, freqEnd: 780, type: 'sine', vol: 0.45, attack: 0.003 });
  },
  doubleJump(ctx, out, t0) { // 更高 blip
    tone(ctx, out, { t0, dur: 0.14, freq: 560, freqEnd: 1000, type: 'sine', vol: 0.42, attack: 0.003 });
  },
  land(ctx, out, t0) { // 落地闷响
    tone(ctx, out, { t0, dur: 0.1, freq: 180, freqEnd: 90, type: 'triangle', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.08, vol: 0.14, type: 'lowpass', freq: 500, q: 1 });
  },
  collect(ctx, out, t0) { // 水晶清脆
    tone(ctx, out, { t0, dur: 0.16, freq: 880, type: 'sine', vol: 0.4, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.2, freq: 1320, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  combo(ctx, out, t0) { // 连击上行
    [880, 1100, 1320].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.05, dur: 0.12, freq: f, type: 'triangle', vol: 0.28, attack: 0.002 });
    });
  },
  shield(ctx, out, t0) { // 护盾拾取 shimmer
    [660, 880, 1320].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.3, freq: f, type: 'sine', vol: 0.24, attack: 0.004 });
    });
  },
  shieldBreak(ctx, out, t0) { // 护盾破裂
    noise(ctx, out, { t0, dur: 0.3, vol: 0.4, type: 'highpass', freq: 2500, q: 1 });
    tone(ctx, out, { t0, dur: 0.2, freq: 900, freqEnd: 300, type: 'sawtooth', vol: 0.2, attack: 0.003 });
  },
  time(ctx, out, t0) { // 时间沙漏 tick
    tone(ctx, out, { t0, dur: 0.1, freq: 1200, type: 'square', vol: 0.24, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.08, dur: 0.1, freq: 1600, type: 'square', vol: 0.2, attack: 0.002 });
  },
  spring(ctx, out, t0) { // 弹簧 boing
    tone(ctx, out, { t0, dur: 0.3, freq: 200, freqEnd: 900, type: 'triangle', vol: 0.4, attack: 0.003 });
  },
  wind(ctx, out, t0) { // 风声 whoosh
    noise(ctx, out, { t0, dur: 0.5, vol: 0.55, type: 'bandpass', freq: 800, freqEnd: 2400, q: 1.1 });
  },
  climb(ctx, out, t0) { // 抓墙沙沙
    noise(ctx, out, { t0, dur: 0.25, vol: 0.55, type: 'bandpass', freq: 1400, q: 1.2 });
  },
  death(ctx, out, t0) { // 死亡低闷
    tone(ctx, out, { t0, dur: 0.45, freq: 160, freqEnd: 50, type: 'sawtooth', vol: 0.4, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.3, type: 'lowpass', freq: 600, q: 1 });
  },
  win(ctx, out, t0) { // 通关五音上行
    [69, 72, 76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败闷响
    tone(ctx, out, { t0, dur: 0.4, freq: 140, freqEnd: 60, type: 'sine', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  countdown(ctx, out, t0) { // 最后 5s beep
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.26, attack: 0.003 });
  },
};

const SFX_EVENT_MAP = {
  jump: 'jump',
  doubleJump: 'doubleJump',
  land: 'land',
  collect: 'collect',
  combo: 'combo',
  shield: 'shield',
  shieldBreak: 'shieldBreak',
  time: 'time',
  spring: 'spring',
  wind: 'wind',
  climb: 'climb',
  death: 'death',
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

// ---- BGM 一个循环的编排（12 小节，采样精确、无缝）----

function shaker(ctx, out, { t0, vol = 0.2 }) {
  return noise(ctx, out, { t0, dur: 0.05, vol, type: 'bandpass', freq: 5000, q: 1.5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.3, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}

function marimba(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.2, attack: 0.003, release: Math.min(dur, 0.35) });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const barT = t0 + bar * BAR;
    const root = BASS_ROOTS[bar % BASS_ROOTS.length];
    for (let b = 0; b < 4; b += 1) {
      push(shaker(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.22 : 0.14 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: root }));
    }
    for (const [mBar, beat, idx, durBeats] of MELODY) {
      if (mBar === bar) push(marimba(ctx, bus, { t0: barT + beat * BEAT, midiNote: PENTA[idx], dur: durBeats * BEAT }));
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
