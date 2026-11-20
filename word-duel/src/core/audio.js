// WORD DUEL · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：神秘决斗感，BPM 100，A 小调进行 Am–F–C–G（每和弦 2 小节）。
// A 段 8 小节铺底 / B 段 8 小节钟琴主音进入，共 16 小节无缝循环（相位连续）。
// 四层编制：打击点=短噪声"石击"、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、
// 主音=钟琴感正弦短衰减。
// SFX：tap/cast/hit/miss/enemyHit/freeze/shieldBreak/heal/wordCloud/swap/win/lose/countdown，均 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 一拍 ≈0.6s
const BAR = BEAT * 4;             // 一小节 ≈2.4s
const BGM_BARS = 16;              // A 段 8 + B 段 8
const BGM_LOOP = BAR * BGM_BARS;  // ≈38.4s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-21);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [60, 64] }, // C
  { root: 43, pad: [55, 59] }, // G
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 81, 1.5], [0, 2.0, 84, 1.5], [0, 3.5, 88, 0.5],
  [1, 0.0, 84, 2.0], [1, 2.0, 81, 2.0],
  [2, 0.0, 79, 1.5], [2, 2.0, 76, 1.5], [2, 3.5, 72, 0.5],
  [3, 0.0, 76, 3.0], [3, 3.0, 79, 1.0],
  [4, 0.0, 84, 1.5], [4, 2.0, 81, 1.5], [4, 3.5, 79, 0.5],
  [5, 0.0, 76, 2.0], [5, 2.0, 72, 2.0],
  [6, 0.0, 74, 1.5], [6, 2.0, 71, 1.5], [6, 3.5, 67, 0.5],
  [7, 0.0, 69, 3.5], [7, 3.5, 64, 0.5],
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

// ---- SFX 合成（每个都短 ≤0.6s）----

const SFX = {
  tap(ctx, out, t0) { // 木块 click
    tone(ctx, out, { t0, dur: 0.05, freq: 1800, type: 'sine', vol: 0.45, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.14, type: 'bandpass', freq: 2200, q: 6 });
  },
  cast(ctx, out, t0) { // 施法扫频上行
    tone(ctx, out, { t0, dur: 0.18, freq: 420, freqEnd: 1200, type: 'sawtooth', vol: 0.3, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.12, vol: 0.16, type: 'bandpass', freq: 1600, freqEnd: 3200, q: 2 });
  },
  hit(ctx, out, t0) { // 命中爆点
    noise(ctx, out, { t0, dur: 0.22, vol: 0.4, type: 'lowpass', freq: 3000, freqEnd: 400, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.1, freq: 160, freqEnd: 80, type: 'sine', vol: 0.3, attack: 0.004 });
  },
  miss(ctx, out, t0) { // 闷响
    tone(ctx, out, { t0, dur: 0.25, freq: 130, freqEnd: 70, type: 'triangle', vol: 0.4, attack: 0.004 });
  },
  enemyHit(ctx, out, t0) { // 被打：低通噪声
    noise(ctx, out, { t0, dur: 0.18, vol: 0.32, type: 'lowpass', freq: 700, freqEnd: 200, q: 1 });
    tone(ctx, out, { t0, dur: 0.1, freq: 110, freqEnd: 60, type: 'sine', vol: 0.28, attack: 0.004 });
  },
  freeze(ctx, out, t0) { // 冰冻：高音玻璃下滑
    tone(ctx, out, { t0, dur: 0.3, freq: 2400, freqEnd: 900, type: 'sine', vol: 0.3, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.3, freq: 1800, freqEnd: 700, type: 'sine', vol: 0.2, attack: 0.004 });
  },
  shieldBreak(ctx, out, t0) { // 破盾碎裂
    noise(ctx, out, { t0, dur: 0.3, vol: 0.4, type: 'highpass', freq: 1200, freqEnd: 4000, q: 1 });
    tone(ctx, out, { t0, dur: 0.2, freq: 300, freqEnd: 120, type: 'sawtooth', vol: 0.25, attack: 0.004 });
  },
  heal(ctx, out, t0) { // 治愈风铃上行
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.28, freq: midi(m), type: 'sine', vol: 0.24, attack: 0.004 });
    });
  },
  wordCloud(ctx, out, t0, payload) { // 长词签名：词云爆开的连音
    const n = payload && payload.length ? Math.min(6, payload.length) : 4;
    for (let i = 0; i < n; i += 1) {
      tone(ctx, out, { t0: t0 + i * 0.05, dur: 0.2, freq: midi(72 + (i % 5) * 3), type: 'triangle', vol: 0.2, attack: 0.003 });
    }
  },
  swap(ctx, out, t0) { // 换牌洗牌沙沙 + 上滑提示音
    noise(ctx, out, { t0, dur: 0.28, vol: 0.6, type: 'bandpass', freq: 700, freqEnd: 1600, q: 0.9 });
    tone(ctx, out, { t0, dur: 0.18, freq: 520, freqEnd: 980, type: 'triangle', vol: 0.3, attack: 0.004 });
  },
  win(ctx, out, t0) { // 五音上行
    [69, 72, 76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 下坠
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  countdown(ctx, out, t0) { // 最后 5s 每秒滴答
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.24, attack: 0.003 });
  },
};

// 事件名 → SFX
const SFX_EVENT_MAP = {
  letterSelect: 'tap',
  letterDeselect: 'tap',
  cast: 'cast',
  spell: 'cast',
  hit: 'hit',
  miss: 'miss',
  enemyAttack: 'enemyHit',
  playerHit: 'enemyHit',
  frozen: 'freeze',
  shieldBreak: 'shieldBreak',
  heal: 'heal',
  wordCloud: 'wordCloud',
  swap: 'swap',
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

// ---- BGM 一个循环的编排 ----

function stoneTap(ctx, out, { t0, vol = 0.4 }) {
  return noise(ctx, out, { t0, dur: 0.05, vol, type: 'bandpass', freq: 2200, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.3, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}

function glock(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.18, attack: 0.003, release: Math.min(dur, 0.35) });
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
      push(stoneTap(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.4 : 0.26 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(glock(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    } else if (name === 'turnTick') {
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
