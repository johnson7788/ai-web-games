// CARD ROYALE · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：宫廷小步舞曲，BPM 100，A 小调进行 Am–G–F–E（每和弦 2 小节）。
// A 段 8 小节仅伴奏 / B 段 8 小节琉特琴主音进入，共 16 小节无缝循环（相位连续）。
// 四层编制：低音鼓点=帧鼓短噪声、持续低音=三角波根音长音、和声垫=双音锯齿轻 LPF、主音=琉特琴感三角波短衰减。
// SFX：draw/play/reveal/combo/royalStreak/thaw/wildcard/redeal/win/lose/timeTick，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 一拍秒数 = 0.6
const BAR = BEAT * 4;             // 一小节 = 2.4s
const BGM_BARS = 16;              // A 段 8 + B 段 8
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 = 38.4s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);   // BGM 音量总线
const SFX_GAIN = dbToGain(-10);   // SFX 音量总线
const DUCK_GAIN = dbToGain(-20);  // win/lose 时 BGM 短暂 duck

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=低音根音(MIDI)，pad=双音和声垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 43, pad: [55, 59] }, // G
  { root: 41, pad: [53, 57] }, // F
  { root: 40, pad: [52, 55] }, // E
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 69, 1.0], [0, 1.0, 72, 0.5], [0, 2.0, 76, 1.0], [0, 3.0, 72, 1.0],
  [1, 0.0, 74, 1.0], [1, 2.0, 72, 1.5], [1, 3.5, 69, 0.5],
  [2, 0.0, 67, 1.0], [2, 1.0, 71, 0.5], [2, 2.0, 74, 1.5], [2, 3.5, 71, 0.5],
  [3, 0.0, 76, 2.0], [3, 2.0, 72, 1.0], [3, 3.0, 69, 1.0],
  [4, 0.0, 72, 1.0], [4, 1.0, 76, 0.5], [4, 2.0, 79, 1.0], [4, 3.0, 76, 1.0],
  [5, 0.0, 77, 1.0], [5, 2.0, 74, 1.5], [5, 3.5, 72, 0.5],
  [6, 0.0, 74, 1.0], [6, 1.0, 71, 0.5], [6, 2.0, 74, 1.5], [6, 3.5, 71, 0.5],
  [7, 0.0, 76, 2.5], [7, 3.0, 69, 1.0],
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
    const att = 0.08;
    const rel = 0.25;
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
  draw(ctx, out, t0) { // 翻牌：纸片 swipe 高频噪声
    noise(ctx, out, { t0, dur: 0.09, vol: 0.3, type: 'highpass', freq: 2400, q: 1 });
    tone(ctx, out, { t0, dur: 0.05, freq: 900, freqEnd: 1400, type: 'sine', vol: 0.18, attack: 0.002 });
  },
  play(ctx, out, t0) { // 出牌：木桌 snap + 短木鱼
    tone(ctx, out, { t0, dur: 0.09, freq: 2200, type: 'sine', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.04, vol: 0.2, type: 'bandpass', freq: 2600, q: 6 });
  },
  reveal(ctx, out, t0) { // 露头：轻 chime
    tone(ctx, out, { t0, dur: 0.12, freq: 1200, freqEnd: 900, type: 'sine', vol: 0.22, attack: 0.002 });
  },
  combo(ctx, out, t0, payload) { // 同花连击：上行三连音，音高随 combo 递增（封顶 +7 半音）
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const shift = Math.min(Math.max(0, combo - 1), 7);
    const base = 72 + shift;
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.2, freq: midi(base + iv), type: 'triangle', vol: 0.22, attack: 0.003 });
    });
  },
  royalStreak(ctx, out, t0) { // 皇家连胜：号角五连音上行
    [67, 71, 74, 79, 83].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'square', vol: 0.16, attack: 0.004 });
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'triangle', vol: 0.14, attack: 0.004 });
    });
  },
  thaw(ctx, out, t0) { // 解冻：冰裂噪声 + 高频下扫
    noise(ctx, out, { t0, dur: 0.2, vol: 0.3, type: 'highpass', freq: 5000, freqEnd: 1800, q: 2 });
    tone(ctx, out, { t0, dur: 0.14, freq: 2600, freqEnd: 900, type: 'sine', vol: 0.2, attack: 0.003 });
  },
  wildcard(ctx, out, t0) { // 鬼牌：魔法闪烁 glissando
    tone(ctx, out, { t0, dur: 0.3, freq: 600, freqEnd: 1800, type: 'sine', vol: 0.2, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.25, vol: 0.16, type: 'bandpass', freq: 3000, q: 4 });
  },
  redeal(ctx, out, t0) { // 重翻：洗牌擦擦声
    noise(ctx, out, { t0, dur: 0.3, vol: 0.45, type: 'bandpass', freq: 1600, freqEnd: 800, q: 1 });
    noise(ctx, out, { t0, dur: 0.22, vol: 0.3, type: 'highpass', freq: 3000, q: 1 });
  },
  win(ctx, out, t0) { // 通关号角 C-E-G-C-E
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：120Hz 闷 thud + 短噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.24, type: 'lowpass', freq: 500, q: 1 });
  },
  timeTick(ctx, out, t0) { // 最后 5s 每秒 beep 880Hz
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.24, attack: 0.003 });
  },
};

// 把事件名映射到 SFX
const SFX_EVENT_MAP = {
  draw: 'draw',
  play: 'play',
  reveal: 'reveal',
  combo: 'combo',
  royalStreak: 'royalStreak',
  thaw: 'thaw',
  wildcard: 'wildcard',
  redeal: 'redeal',
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

// ---- BGM 一个循环的编排（16 小节，t0 起始，采样精确、无缝）----

function taborDrum(ctx, out, { t0, vol = 0.4 }) {
  return noise(ctx, out, { t0, dur: 0.05, vol, type: 'bandpass', freq: 2200, q: 5 });
}

function droneNote(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'triangle', vol: 0.2, attack: 0.05, release: 0.4 });
}

function lute(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'triangle', vol: 0.17, attack: 0.003, release: Math.min(dur, 0.3) });
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
      push(taborDrum(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.38 : 0.24 }));
    }
    push(droneNote(ctx, bus, { t0: barT, midiNote: chord.root, dur: BAR }));
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(lute(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    } else if (name === 'timeTick') {
      const left = payload && payload.timeLeft;
      if (typeof left === 'number' && left > 0 && left <= 5) {
        scheduleSfx(ctx, sfxBus, 'timeTick', payload, ctx.currentTime);
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
