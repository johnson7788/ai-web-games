// CANDY CRUSH POP · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机 synthwave，BPM 120，A 小调进行 Am–F–C–G（每和弦 2 小节）。
// A 段 8 小节无主音 / B 段 8 小节方波主音进入，共 16 小节无缝循环。
// 四层编制：四踩底鼓+闭合镲、锯齿贝斯根音八分、双音锯齿和弦垫、B 段方波主音。
// SFX：swap/swapBack/match/fall/rockBreak/rockChip/comboBonus/reshuffle/win/lose/countdown，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 一拍 0.5s
const BAR = BEAT * 4;             // 一小节 2s
const BGM_BARS = 16;              // A 段 8 + B 段 8
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 32s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 33, pad: [57, 60] }, // Am
  { root: 29, pad: [53, 57] }, // F
  { root: 36, pad: [55, 60] }, // C
  { root: 31, pad: [50, 55] }, // G
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]（A 小调五声音阶）
const MELODY = [
  [0, 0.0, 69, 2.0], [0, 2.0, 72, 1.0], [0, 3.0, 74, 1.0],
  [1, 0.0, 76, 1.5], [1, 1.5, 74, 0.5], [1, 2.0, 72, 2.0],
  [2, 0.0, 69, 2.0], [2, 2.0, 67, 1.0], [2, 3.0, 69, 1.0],
  [3, 0.0, 76, 3.0], [3, 3.0, 74, 1.0],
  [4, 0.0, 72, 2.0], [4, 2.0, 74, 2.0],
  [5, 0.0, 76, 2.0], [5, 2.0, 79, 2.0],
  [6, 0.0, 81, 2.0], [6, 2.0, 79, 1.0], [6, 3.0, 76, 1.0],
  [7, 0.0, 74, 3.0], [7, 3.0, 72, 1.0],
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

// ---- SFX 合成（每个都短 ≤0.6s）----
const SFX = {
  swap(ctx, out, t0) { // 谁谁滑动（噪声低通扫）
    noise(ctx, out, { t0, dur: 0.14, vol: 0.4, type: 'lowpass', freq: 2600, freqEnd: 900, q: 1.2 });
  },
  swapBack(ctx, out, t0) { // 拒绝：低闷 beep
    tone(ctx, out, { t0, dur: 0.12, freq: 220, freqEnd: 160, type: 'square', vol: 0.26, attack: 0.003 });
  },
  match(ctx, out, t0) { // 爆裂 pop：上跳正弦
    tone(ctx, out, { t0, dur: 0.12, freq: 620, freqEnd: 1180, type: 'sine', vol: 0.5, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.06, vol: 0.22, type: 'highpass', freq: 3200, q: 1 });
  },
  fall(ctx, out, t0) { // 下落 blip
    tone(ctx, out, { t0, dur: 0.08, freq: 980, freqEnd: 520, type: 'triangle', vol: 0.3, attack: 0.002 });
  },
  rockBreak(ctx, out, t0) { // 破冰 crack：噪声爆发
    noise(ctx, out, { t0, dur: 0.28, vol: 0.5, type: 'bandpass', freq: 2400, freqEnd: 500, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.14, freq: 320, freqEnd: 120, type: 'sine', vol: 0.3, attack: 0.003 });
  },
  rockChip(ctx, out, t0) { // 敲冰 tick
    tone(ctx, out, { t0, dur: 0.06, freq: 1600, freqEnd: 1000, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  comboBonus(ctx, out, t0) { // 连击奖励：三连上跳
    [72, 76, 81].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.003 });
    });
  },
  reshuffle(ctx, out, t0) { // 洗牌：快速噪声擦 + 低频扫
    noise(ctx, out, { t0, dur: 0.3, vol: 0.7, type: 'bandpass', freq: 1400, freqEnd: 300, q: 0.8 });
    tone(ctx, out, { t0, dur: 0.16, freq: 240, freqEnd: 120, type: 'sawtooth', vol: 0.24, attack: 0.003 });
  },
  win(ctx, out, t0) { // 胜利：A 小调上行 jingle
    [69, 72, 76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'square', vol: 0.24, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：下行 thud
    tone(ctx, out, { t0, dur: 0.4, freq: 200, freqEnd: 70, type: 'sawtooth', vol: 0.4, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.24, type: 'lowpass', freq: 600, q: 1 });
  },
  countdown(ctx, out, t0) { // 最后 5 秒每秒 beep
    tone(ctx, out, { t0, dur: 0.1, freq: 1000, type: 'square', vol: 0.24, attack: 0.003 });
  },
};

const SFX_EVENT_MAP = {
  swapStart: 'swap',
  swapBack: 'swapBack',
  match: 'match',
  fall: 'fall',
  rockBreak: 'rockBreak',
  rockChip: 'rockChip',
  comboBonus: 'comboBonus',
  reshuffle: 'reshuffle',
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

// ---- BGM 编排（16 小节，t0 起始，采样精确、无缝）----
function kick(ctx, out, t0) {
  return tone(ctx, out, { t0, dur: 0.14, freq: 160, freqEnd: 48, type: 'sine', vol: 0.5, attack: 0.002, release: 0.14 });
}

function hat(ctx, out, t0, vol = 0.16) {
  return noise(ctx, out, { t0, dur: 0.03, vol, type: 'highpass', freq: 7000, q: 1 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.2, freq: midi(midiNote), type: 'sawtooth', vol: 0.24, attack: 0.004, release: 0.2 });
}

function leadNote(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.15, attack: 0.004, release: Math.min(dur, 0.3) });
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
      const bt = barT + b * BEAT;
      push(kick(ctx, bus, bt));
      push(hat(ctx, bus, bt + BEAT / 2));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
      if (b % 2 === 1) push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root + 12 }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(leadNote(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    p.setValueAtTime(DUCK_GAIN, t + 2.6);
    p.linearRampToValueAtTime(1, t + 2.75);
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
