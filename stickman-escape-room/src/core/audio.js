// STICKMAN ESCAPE ROOM · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹密室悬疑脉冲，BPM 100，a 小调进行 Am–F–C–G（每和弦 2 小节）。
// 共 8 小节无缝循环（相位连续）。四层：低音方波根音、和弦垫锯齿轻 LPF、
// 心跳 kick、紧张钟琴点缀。
// SFX：move/boost/collect/countdownTick/descendStart/ceilingStep/survive/
//      shieldUsed/slowUsed/nearMiss/danger/crush/win/lose/levelStart，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 一拍秒数 = 0.6
const BAR = BEAT * 4;             // 一小节 = 2.4s
const BGM_BARS = 8;               // 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 = 19.2s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（a 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [55, 59] }, // G
];

// B 段（第 5-8 小节）的紧张钟琴点缀：[B段内小节, 拍, MIDI, 持续拍]
const BELLS = [
  [0, 0.0, 81, 0.5], [0, 2.0, 84, 0.5],
  [1, 0.0, 79, 0.5], [1, 2.0, 76, 0.5],
  [2, 0.0, 74, 0.5], [2, 2.0, 77, 0.5],
  [3, 0.0, 72, 1.0],
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
  move(ctx, out, t0) { // 轻脚步 blip
    tone(ctx, out, { t0, dur: 0.05, freq: 700, type: 'square', vol: 0.18, attack: 0.002 });
  },
  boost(ctx, out, t0) { // 冲刺 whoosh
    noise(ctx, out, { t0, dur: 0.25, vol: 0.35, type: 'bandpass', freq: 900, freqEnd: 3600, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.2, freq: 300, freqEnd: 900, type: 'sine', vol: 0.2, attack: 0.004 });
  },
  collect(ctx, out, t0) { // 宝石风铃二连
    tone(ctx, out, { t0, dur: 0.18, freq: 1320, type: 'sine', vol: 0.3, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.07, dur: 0.2, freq: 1760, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  countdownTick(ctx, out, t0) { // 最后倒计时 beep
    tone(ctx, out, { t0, dur: 0.08, freq: 1040, type: 'square', vol: 0.26, attack: 0.002 });
  },
  descendStart(ctx, out, t0) { // 警报：双音
    tone(ctx, out, { t0, dur: 0.22, freq: 620, type: 'square', vol: 0.3, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.02, dur: 0.22, freq: 440, type: 'square', vol: 0.3, attack: 0.003 });
  },
  ceilingStep(ctx, out, t0) { // 机械 thud
    tone(ctx, out, { t0, dur: 0.12, freq: 150, freqEnd: 80, type: 'triangle', vol: 0.34, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.08, vol: 0.16, type: 'lowpass', freq: 400, q: 1 });
  },
  survive(ctx, out, t0) { // 存活成功上行三连
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.18, freq: midi(72 + iv), type: 'triangle', vol: 0.3, attack: 0.003 });
    });
  },
  shieldUsed(ctx, out, t0) { // 护盾铮一声
    tone(ctx, out, { t0, dur: 0.3, freq: 880, freqEnd: 880, type: 'square', vol: 0.26, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.2, type: 'highpass', freq: 3000, q: 1 });
  },
  slowUsed(ctx, out, t0) { // 时间减速滑音
    tone(ctx, out, { t0, dur: 0.5, freq: 1200, freqEnd: 300, type: 'sine', vol: 0.3, attack: 0.006 });
  },
  nearMiss(ctx, out, t0) { // 擦边掠过
    noise(ctx, out, { t0, dur: 0.2, vol: 0.6, type: 'bandpass', freq: 500, freqEnd: 2200, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.18, freq: 220, freqEnd: 1200, type: 'sine', vol: 0.34, attack: 0.004 });
  },
  danger(ctx, out, t0) { // 踩上熔岩警告
    tone(ctx, out, { t0, dur: 0.1, freq: 200, type: 'sawtooth', vol: 0.22, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.1, freq: 160, type: 'sawtooth', vol: 0.22, attack: 0.002 });
  },
  crush(ctx, out, t0) { // 压扁低沉 thud
    tone(ctx, out, { t0, dur: 0.45, freq: 110, freqEnd: 45, type: 'sine', vol: 0.55, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.25, vol: 0.3, type: 'lowpass', freq: 400, q: 1 });
  },
  win(ctx, out, t0) { // 通关五音上行 C-E-G-C-E
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.32, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败下行
    [72, 69, 65, 60].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.12, dur: 0.3, freq: midi(m), type: 'sine', vol: 0.3, attack: 0.004 });
    });
  },
  levelStart(ctx, out, t0) { // 新关上升
    tone(ctx, out, { t0, dur: 0.12, freq: 520, type: 'triangle', vol: 0.26, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.14, freq: 660, type: 'triangle', vol: 0.26, attack: 0.003 });
  },
};

// 把事件名映射到 SFX
const SFX_EVENT_MAP = {
  move: 'move',
  boost: 'boost',
  collect: 'collect',
  descendStart: 'descendStart',
  ceilingStep: 'ceilingStep',
  survive: 'survive',
  shieldUsed: 'shieldUsed',
  slowUsed: 'slowUsed',
  nearMiss: 'nearMiss',
  danger: 'danger',
  crush: 'crush',
  win: 'win',
  lose: 'lose',
  levelStart: 'levelStart',
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
function kick(ctx, out, { t0, vol = 0.4 }) {
  return tone(ctx, out, { t0, dur: 0.16, freq: 90, freqEnd: 40, type: 'sine', vol, attack: 0.002 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.24, freq: midi(midiNote), type: 'square', vol: 0.2, attack: 0.004 });
}

function bell(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.16, attack: 0.002, release: Math.min(dur, 0.3) });
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
      if (b === 0) push(kick(ctx, bus, { t0: barT + b * BEAT, vol: 0.34 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 4) {
      for (const [mBar, beat, m, durBeats] of BELLS) {
        if (mBar === bar - 4) push(bell(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    p.setValueAtTime(DUCK_GAIN, t + 2.5);
    p.linearRampToValueAtTime(1, t + 2.7);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    if (name === 'countdownTick') {
      const left = payload && payload.timeLeft;
      if (typeof left === 'number' && left > 0 && left <= 5) {
        scheduleSfx(ctx, sfxBus, 'countdownTick', payload, ctx.currentTime);
      }
      return;
    }
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
