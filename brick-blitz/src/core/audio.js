// BRICK BLITZ · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：窑火暖调，BPM 104，A 小调进行 Am–F–C–G（每和弦 2 小节）。
// A 段 8 小节无主音 / B 段 8 小节主音进入，共 16 小节无缝循环（相位连续）。
// 四层编制：打击点=短噪声木鱼、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=马林巴感正弦短衰减。
// SFX：serve/paddle/wall/hit/break/powerDrop/powerCatch/kilnFire/kilnEnd/lifeLost/win/lose，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 104;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 16;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [52, 57] }, // Am
  { root: 41, pad: [48, 53] }, // F
  { root: 48, pad: [52, 55] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 69, 1.5], [0, 2.0, 72, 1.5], [0, 3.5, 76, 0.5],
  [1, 0.0, 74, 2.0], [1, 2.0, 72, 2.0],
  [2, 0.0, 69, 1.5], [2, 2.0, 72, 1.5], [2, 3.5, 74, 0.5],
  [3, 0.0, 76, 3.0], [3, 3.0, 74, 1.0],
  [4, 0.0, 71, 1.5], [4, 2.0, 72, 1.5], [4, 3.5, 69, 0.5],
  [5, 0.0, 67, 2.0], [5, 2.0, 69, 2.0],
  [6, 0.0, 72, 1.5], [6, 2.0, 71, 1.5], [6, 3.5, 67, 0.5],
  [7, 0.0, 69, 3.5], [7, 3.5, 64, 0.5],
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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.16 }) {
  const oscs = [];
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.value = midi(f);
    lp.type = 'lowpass';
    lp.frequency.value = 1600;
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

// ---- SFX 合成（每个 ≤0.6s）----
const SFX = {
  serve(ctx, out, t0) { // 发球：上滑 whoosh
    tone(ctx, out, { t0, dur: 0.18, freq: 320, freqEnd: 760, type: 'sine', vol: 0.4, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.12, vol: 0.16, type: 'highpass', freq: 1500, q: 1 });
  },
  paddle(ctx, out, t0) { // 挡板反弹：清脆木击
    tone(ctx, out, { t0, dur: 0.09, freq: 520, freqEnd: 260, type: 'triangle', vol: 0.5, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.04, vol: 0.18, type: 'bandpass', freq: 2200, q: 6 });
  },
  wall(ctx, out, t0) { // 窑壁反弹：短闷响
    tone(ctx, out, { t0, dur: 0.07, freq: 300, freqEnd: 160, type: 'square', vol: 0.26, attack: 0.002 });
  },
  hit(ctx, out, t0) { // 砸砖：陶响
    tone(ctx, out, { t0, dur: 0.14, freq: 220, freqEnd: 140, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.2, type: 'lowpass', freq: 900, q: 1 });
  },
  breakBrick(ctx, out, t0) { // 破砖：噪声爆发
    noise(ctx, out, { t0, dur: 0.3, vol: 0.5, type: 'lowpass', freq: 3400, freqEnd: 420, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.12, freq: 180, freqEnd: 90, type: 'sine', vol: 0.3, attack: 0.004 });
  },
  powerDrop(ctx, out, t0) { // 道具掉落：下落滑音
    tone(ctx, out, { t0, dur: 0.28, freq: 900, freqEnd: 420, type: 'sine', vol: 0.26, attack: 0.004 });
  },
  powerCatch(ctx, out, t0) { // 接道具：上行三连
    [60, 64, 67].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.14, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.003 });
    });
  },
  kilnFire(ctx, out, t0) { // 窑火全开：燃爆暖音
    noise(ctx, out, { t0, dur: 0.5, vol: 0.4, type: 'lowpass', freq: 4200, freqEnd: 700, q: 1 });
    [72, 76, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + 0.02 + i * 0.07, dur: 0.22, freq: midi(m), type: 'sawtooth', vol: 0.18, attack: 0.004 });
    });
  },
  kilnEnd(ctx, out, t0) { // 窑火消退
    tone(ctx, out, { t0, dur: 0.2, freq: 500, freqEnd: 220, type: 'sine', vol: 0.2, attack: 0.006 });
  },
  lifeLost(ctx, out, t0) { // 失命：闷雷
    tone(ctx, out, { t0, dur: 0.4, freq: 150, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
  win(ctx, out, t0) { // 通关：五音上行
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：下沉
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  serve: 'serve',
  paddleBounce: 'paddle',
  wallBounce: 'wall',
  brickHit: 'hit',
  brickBreak: 'breakBrick',
  powerDrop: 'powerDrop',
  powerCatch: 'powerCatch',
  kilnFire: 'kilnFire',
  kilnEnd: 'kilnEnd',
  lifeLost: 'lifeLost',
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

// ---- BGM 编排 ----
function woodblock(ctx, out, { t0, vol = 0.4 }) {
  return noise(ctx, out, { t0, dur: 0.045, vol, type: 'bandpass', freq: 2400, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.3, freq: midi(midiNote), type: 'triangle', vol: 0.32, attack: 0.006, release: 0.3 });
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
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.4 : 0.28 }));
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
