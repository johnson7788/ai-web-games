// Bubble Tap Pop · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机 synthwave，BPM 120，Am–F–C–G 进行（每和弦 2 小节，共 8 小节无缝循环）。
// 四层：贝斯三角波根音、8 分音符琶音方波、节拍 kick 噪声、长和弦 pad（低通锯齿）。
// SFX：correct/wrong/rock/timeout/combo/levelUp/gameover/newBest，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2s
const BGM_BARS = 8;               // Am F C G × 2
const BGM_LOOP = BAR * BGM_BARS;  // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-10);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（Am F C G）：root=贝斯根音，arp=琶音和弦音
const CHORDS = [
  { root: 45, arp: [57, 60, 64, 69] }, // Am
  { root: 41, arp: [53, 57, 60, 65] }, // F
  { root: 48, arp: [60, 64, 67, 72] }, // C
  { root: 43, arp: [55, 59, 62, 67] }, // G
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

// ---- SFX（每个都短 ≤0.6s）----

const SFX = {
  correct(ctx, out, t0) { // 明亮上行 blip
    tone(ctx, out, { t0, dur: 0.14, freq: 880, freqEnd: 1320, type: 'sine', vol: 0.5, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.1, freq: 1320, type: 'triangle', vol: 0.22, attack: 0.002 });
  },
  wrong(ctx, out, t0) { // 低沉嗡 + 短噪
    tone(ctx, out, { t0, dur: 0.2, freq: 180, freqEnd: 120, type: 'square', vol: 0.35, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.12, vol: 0.2, type: 'lowpass', freq: 500, q: 1 });
  },
  rock(ctx, out, t0) { // 尖锐噪 + 闷 thud
    noise(ctx, out, { t0, dur: 0.28, vol: 0.4, type: 'highpass', freq: 900, q: 1 });
    tone(ctx, out, { t0, dur: 0.22, freq: 110, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.004 });
  },
  timeout(ctx, out, t0) { // 三连下行
    [720, 540, 360].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.12, freq: f, type: 'triangle', vol: 0.3, attack: 0.002 });
    });
  },
  combo(ctx, out, t0) { // 上行琶音
    [660, 830, 990, 1320].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.12, freq: f, type: 'square', vol: 0.2, attack: 0.002 });
    });
  },
  levelUp(ctx, out, t0) { // 小号角三连
    [523, 659, 784].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: f, type: 'triangle', vol: 0.32, attack: 0.004 });
    });
  },
  newBest(ctx, out, t0) { // 星星闪烁
    [880, 1108, 1318].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.16, freq: f, type: 'sine', vol: 0.26, attack: 0.002 });
    });
  },
  gameover(ctx, out, t0) { // 下行四连
    [659, 523, 392, 262].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.14, dur: 0.28, freq: f, type: 'triangle', vol: 0.32, attack: 0.006 });
    });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.22, type: 'lowpass', freq: 400, q: 1 });
  },
};

// 事件名 → SFX
const SFX_EVENT_MAP = {
  correct: 'correct',
  wrong: 'wrong',
  rockTap: 'rock',
  timeout: 'timeout',
  comboUp: 'combo',
  levelUp: 'levelUp',
  newBest: 'newBest',
  gameover: 'gameover',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环（8 小节）----

function kick(ctx, out, { t0, vol = 0.42 }) {
  return tone(ctx, out, { t0, dur: 0.09, freq: 120, freqEnd: 45, type: 'sine', vol, attack: 0.002 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.24, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.004, release: 0.24 });
}

function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.1, freq: midi(midiNote), type: 'square', vol: 0.11, attack: 0.002, release: 0.1 });
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
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
      if (b % 2 === 0) push(kick(ctx, bus, { t0: barT + b * BEAT }));
    }
    for (let e = 0; e < 8; e += 1) {
      push(arpNote(ctx, bus, { t0: barT + e * BEAT * 0.5, midiNote: chord.arp[e % 4] }));
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
