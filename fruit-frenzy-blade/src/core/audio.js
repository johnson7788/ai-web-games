// fruit-frenzy-blade · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机快节奏，BPM 120，C 大调 C–G–Am–F（每和弦 2 小节），8 小节无缝循环。
// 三层编制：打击点=短噪声木鱼、贝斯=三角波根音、主音=短衰减正弦（马林巴感）。
// SFX：slice/golden/bomb/rock/combo/frenzy/miss/gameover/throw，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 一拍 0.5s
const BAR = BEAT * 4;             // 一小节 2.0s
const BGM_BARS = 8;               // 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 16.0s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-12);   // BGM 总线
const SFX_GAIN = dbToGain(-10);   // SFX 总线
const DUCK_GAIN = dbToGain(-22);  // 结算时 BGM duck

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（C 大调）：贝斯根音（MIDI）
const CHORDS = [
  { root: 48 }, // C
  { root: 43 }, // G
  { root: 45 }, // Am
  { root: 41 }, // F
];

// 主音（8 小节）：[小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 76, 1.0], [0, 1.0, 79, 1.0], [0, 2.0, 84, 1.0], [0, 3.0, 79, 1.0],
  [1, 0.0, 81, 1.0], [1, 1.0, 79, 1.0], [1, 2.0, 76, 1.0], [1, 3.0, 72, 1.0],
  [2, 0.0, 76, 1.0], [2, 1.0, 79, 1.0], [2, 2.0, 84, 1.5], [2, 3.5, 86, 0.5],
  [3, 0.0, 88, 1.0], [3, 1.0, 86, 1.0], [3, 2.0, 84, 1.0], [3, 3.0, 81, 1.0],
  [4, 0.0, 72, 1.0], [4, 1.0, 76, 1.0], [4, 2.0, 79, 1.0], [4, 3.0, 76, 1.0],
  [5, 0.0, 74, 1.0], [5, 1.0, 76, 1.0], [5, 2.0, 79, 1.0], [5, 3.0, 83, 1.0],
  [6, 0.0, 72, 1.0], [6, 1.0, 76, 1.0], [6, 2.0, 81, 1.5], [6, 3.5, 79, 0.5],
  [7, 0.0, 79, 1.5], [7, 1.5, 76, 1.0], [7, 2.5, 72, 1.5],
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

// ---- SFX（每个都 ≤0.6s）----

const SFX = {
  slice(ctx, out, t0) { // 切裂：高 blip + 噪声沙
    tone(ctx, out, { t0, dur: 0.12, freq: 900, freqEnd: 480, type: 'sine', vol: 0.5, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.22, type: 'bandpass', freq: 2600, q: 4 });
  },
  golden(ctx, out, t0) { // 金果：三连上行
    [76, 80, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.22, freq: midi(m), type: 'sine', vol: 0.3, attack: 0.003 });
    });
  },
  bomb(ctx, out, t0) { // 炸弹：低频轰 + 噪声
    tone(ctx, out, { t0, dur: 0.5, freq: 150, freqEnd: 40, type: 'sine', vol: 0.55, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.4, vol: 0.34, type: 'lowpass', freq: 900, freqEnd: 120, q: 1 });
  },
  rock(ctx, out, t0) { // 岩石：闷 thud
    tone(ctx, out, { t0, dur: 0.22, freq: 200, freqEnd: 90, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.14, vol: 0.22, type: 'lowpass', freq: 500, q: 1 });
  },
  combo(ctx, out, t0, payload) { // 连击：音高随连击递增
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 2;
    const base = 72 + Math.min(8, Math.max(0, combo - 2));
    tone(ctx, out, { t0, dur: 0.12, freq: midi(base), type: 'triangle', vol: 0.32, attack: 0.002 });
  },
  frenzy(ctx, out, t0) { // 暴走：四音上行
    [72, 76, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.2, freq: midi(m), type: 'sawtooth', vol: 0.18, attack: 0.003 });
    });
  },
  miss(ctx, out, t0) { // 漏果：低 thud
    tone(ctx, out, { t0, dur: 0.3, freq: 130, freqEnd: 70, type: 'sine', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.18, vol: 0.24, type: 'lowpass', freq: 420, q: 1 });
  },
  gameover(ctx, out, t0) { // 结算：下行 jingle
    [79, 74, 71, 67].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.12, dur: 0.24, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  throwSfx(ctx, out, t0) { // 抛出：柔 whoosh + 短促上行
    noise(ctx, out, { t0, dur: 0.18, vol: 0.5, type: 'bandpass', freq: 1400, freqEnd: 500, q: 1.0 });
    tone(ctx, out, { t0, dur: 0.14, freq: 420, freqEnd: 640, type: 'sine', vol: 0.22, attack: 0.003 });
  },
};

const SFX_EVENT_MAP = {
  fruitSliced: 'slice',
  goldenSliced: 'golden',
  bombHit: 'bomb',
  rockHit: 'rock',
  comboUp: 'combo',
  frenzyStart: 'frenzy',
  lifeLost: 'miss',
  gameOver: 'gameover',
  spawn: 'throwSfx',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环（8 小节，t0 起始，采样精确、无缝）----

function woodblock(ctx, out, { t0, vol = 0.34 }) {
  return noise(ctx, out, { t0, dur: 0.045, vol, type: 'bandpass', freq: 2400, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.28, freq: midi(midiNote), type: 'triangle', vol: 0.34, attack: 0.006, release: 0.28 });
}

function marimba(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.22, attack: 0.003, release: Math.min(dur, 0.35) });
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
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.34 : 0.24 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar) push(marimba(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'gameOver' || name === 'bombHit') duckBgm();
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
