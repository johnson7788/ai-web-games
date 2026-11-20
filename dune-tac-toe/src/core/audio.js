// DUNE TAC TOE · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：沙漠夜色，BPM 96，A 小调进行 Am–F–Dm–E（i–VI–iv–V，E 大三给和声小调的沙漠张力）。
// A 段 8 小节无主音 / B 段 8 小节主音进入，共 16 小节无缝循环（相位连续，不用 media 淡入淡出）。
// 四层编制：打击点=达布卡「dum」低噪 + 「tek」高噪、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、
// 主音=拨弦感的正弦短衰减（A 和声小调音阶）。
// SFX：place(仙人掌木敲/蝎子沙响)、threat/block/win/lose/draw/click，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 96;
const BEAT = 60 / BPM;            // 一拍秒数 =0.625
const BAR = BEAT * 4;             // 一小节 =2.5s
const BGM_BARS = 16;              // A 段 8 + B 段 8
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 =40s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);   // BGM 音量总线
const SFX_GAIN = dbToGain(-10);   // SFX 音量总线
const DUCK_GAIN = dbToGain(-20);  // win/lose/draw 时 BGM 短暂 duck

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [52, 57] }, // Am
  { root: 41, pad: [48, 53] }, // F
  { root: 38, pad: [45, 50] }, // Dm
  { root: 40, pad: [47, 52] }, // E
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]（A 和声小调）
const MELODY = [
  [0, 0.0, 69, 1.5], [0, 2.0, 72, 1.5], [0, 3.5, 76, 0.5],
  [1, 0.0, 74, 2.0], [1, 2.0, 72, 2.0],
  [2, 0.0, 69, 1.5], [2, 2.0, 71, 1.5], [2, 3.5, 72, 0.5],
  [3, 0.0, 76, 3.0], [3, 3.0, 74, 1.0],
  [4, 0.0, 72, 1.5], [4, 2.0, 71, 1.5], [4, 3.5, 69, 0.5],
  [5, 0.0, 64, 2.0], [5, 2.0, 69, 2.0],
  [6, 0.0, 71, 1.5], [6, 2.0, 72, 1.5], [6, 3.5, 76, 0.5],
  [7, 0.0, 80, 3.0], [7, 3.5, 76, 0.5],
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
    lp.frequency.value = 1400;
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
  // 仙人掌落子：木头脆敲（低 tone + 高 click）
  placeX(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.14, freq: 220, freqEnd: 150, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.2, type: 'bandpass', freq: 2600, q: 6 });
  },
  // 蝎子落子：沙沙响尾（噪声扫频 + 轻 hi click）
  placeO(ctx, out, t0) {
    noise(ctx, out, { t0, dur: 0.22, vol: 0.4, type: 'highpass', freq: 3200, freqEnd: 1800, q: 1 });
    tone(ctx, out, { t0, dur: 0.06, freq: 900, freqEnd: 600, type: 'sine', vol: 0.18, attack: 0.002 });
  },
  click(ctx, out, t0) {
    tone(ctx, out, { t0, dur: 0.06, freq: 1200, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  threat(ctx, out, t0) { // 成线威胁：上挑双音
    tone(ctx, out, { t0, dur: 0.12, freq: 660, type: 'triangle', vol: 0.3, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.09, dur: 0.14, freq: 880, type: 'triangle', vol: 0.28, attack: 0.003 });
  },
  block(ctx, out, t0) { // 堵截：低闷 thud
    tone(ctx, out, { t0, dur: 0.16, freq: 150, freqEnd: 90, type: 'sine', vol: 0.4, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.2, type: 'lowpass', freq: 500, q: 1 });
  },
  win(ctx, out, t0) { // 五音上行 jingle A-C-E-A-C
    [69, 72, 76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 下行 + 沙沙
    [69, 65, 60].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.12, dur: 0.24, freq: midi(m), type: 'sawtooth', vol: 0.18, attack: 0.004 });
    });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.16, type: 'lowpass', freq: 700, q: 1 });
  },
  draw(ctx, out, t0) { // 中性双音
    tone(ctx, out, { t0, dur: 0.2, freq: 520, type: 'sine', vol: 0.28, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.16, dur: 0.2, freq: 520, type: 'sine', vol: 0.22, attack: 0.004 });
  },
};

// 事件名 → SFX。place 按 payload.player 分派仙人掌/蝎子声音。
const SFX_EVENT_MAP = {
  place: 'place',
  threat: 'threat',
  block: 'block',
  win: 'win',
  lose: 'lose',
  draw: 'draw',
  click: 'click',
  turn: 'click',
  start: 'click',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  let fn = null;
  if (name === 'place') {
    fn = payload && payload.player === 'O' ? SFX.placeO : SFX.placeX;
  } else {
    fn = SFX[name];
  }
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环的编排（16 小节，t0 起始，采样精确、无缝）----

function dumBeat(ctx, out, { t0, vol = 0.5 }) {
  return noise(ctx, out, { t0, dur: 0.09, vol, type: 'lowpass', freq: 380, freqEnd: 180, q: 1.2 });
}

function tekBeat(ctx, out, { t0, vol = 0.3 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'bandpass', freq: 3200, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.32, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}

function pluck(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.18, attack: 0.003, release: Math.min(dur, 0.4) });
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
      // 达布卡：1、3 拍「dum」低噪，2、4 拍「tek」高噪
      if (b % 2 === 0) push(dumBeat(ctx, bus, { t0: barT + b * BEAT, vol: 0.5 }));
      else push(tekBeat(ctx, bus, { t0: barT + b * BEAT, vol: 0.3 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(pluck(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    }
    if (name === 'win' || name === 'lose' || name === 'draw') duckBgm();
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
