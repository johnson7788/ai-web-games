// SKY STRIKE ALPHA · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹 synthwave，BPM 120，小调进行 Am–F–C–G（每和弦 2 小节）。
// A 段 8 小节铺底 / B 段 8 小节锯齿主音进入，共 16 小节无缝循环（相位连续）。
// 四层编制：鼓点=短噪声、贝斯=三角波根音、和弦垫=锯齿轻 LPF、主音=锯齿 lead + 回响感。
// SFX：start/spawn/core/score/combo/nearMiss/shield/shieldGot/shieldBlock/win/lose，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 一拍 ≈0.5s
const BAR = BEAT * 4;             // 一小节 2.0s
const BGM_BARS = 16;              // A 段 8 + B 段 8
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 32.0s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-13);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-19);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=三和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60, 64] }, // Am
  { root: 41, pad: [53, 57, 60] }, // F
  { root: 48, pad: [60, 64, 67] }, // C
  { root: 43, pad: [55, 59, 62] }, // G
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 69, 0.9], [0, 1.0, 72, 0.9], [0, 2.0, 76, 0.9], [0, 3.0, 72, 0.9],
  [1, 0.0, 69, 0.9], [1, 1.0, 74, 0.9], [1, 2.0, 77, 0.9], [1, 3.0, 74, 0.9],
  [2, 0.0, 72, 0.9], [2, 1.0, 76, 0.9], [2, 2.0, 79, 0.9], [2, 3.0, 76, 0.9],
  [3, 0.0, 71, 0.9], [3, 1.0, 74, 0.9], [3, 2.0, 79, 0.9], [3, 3.0, 83, 0.9],
  [4, 0.0, 69, 0.9], [4, 1.0, 72, 0.9], [4, 2.0, 76, 0.9], [4, 3.0, 72, 0.9],
  [5, 0.0, 69, 0.9], [5, 1.0, 74, 0.9], [5, 2.0, 77, 0.9], [5, 3.0, 74, 0.9],
  [6, 0.0, 72, 0.9], [6, 1.0, 76, 0.9], [6, 2.0, 81, 0.9], [6, 3.0, 76, 0.9],
  [7, 0.0, 71, 0.9], [7, 1.0, 74, 0.9], [7, 2.0, 79, 0.9], [7, 3.0, 71, 0.9],
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
    const att = 0.07;
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
  start(ctx, out, t0) { // 引擎点火：噪声上扫
    noise(ctx, out, { t0, dur: 0.35, vol: 0.3, type: 'bandpass', freq: 300, freqEnd: 2400, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.35, freq: 110, freqEnd: 320, type: 'sawtooth', vol: 0.16, attack: 0.02 });
  },
  spawn(ctx, out, t0) { // 闸门闪现：低方波 blip
    tone(ctx, out, { t0, dur: 0.08, freq: 200, freqEnd: 140, type: 'square', vol: 0.18, attack: 0.003 });
  },
  core(ctx, out, t0) { // 核心生成：软 ping
    tone(ctx, out, { t0, dur: 0.16, freq: 900, freqEnd: 1200, type: 'sine', vol: 0.22, attack: 0.003 });
  },
  score(ctx, out, t0) { // 收核：明亮短 pluck 上行
    tone(ctx, out, { t0, dur: 0.14, freq: 1180, freqEnd: 1600, type: 'triangle', vol: 0.34, attack: 0.002 });
  },
  combo(ctx, out, t0, payload) { // 连击：音高随 combo 递增的小琶音
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 2;
    const base = 76 + Math.min(Math.max(0, combo - 2), 6);
    [0, 3, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.05, dur: 0.16, freq: midi(base + iv), type: 'triangle', vol: 0.24, attack: 0.002 });
    });
  },
  nearMiss(ctx, out, t0) { // 贴边掠过：高频 whoosh
    noise(ctx, out, { t0, dur: 0.22, vol: 0.5, type: 'bandpass', freq: 1200, freqEnd: 3400, q: 1.6 });
    tone(ctx, out, { t0, dur: 0.2, freq: 1400, freqEnd: 2600, type: 'sine', vol: 0.2, attack: 0.003 });
  },
  shield(ctx, out, t0) { // 护盾闪现：上行风铃
    [64, 67, 71].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.05, dur: 0.18, freq: midi(m), type: 'sine', vol: 0.2, attack: 0.003 });
    });
  },
  shieldGot(ctx, out, t0) { // 护盾拾取：能量激活琶音
    [72, 76, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.05, dur: 0.2, freq: midi(m), type: 'square', vol: 0.18, attack: 0.003 });
    });
  },
  shieldBlock(ctx, out, t0) { // 护盾抵挡：金属撞击 + 碎裂
    tone(ctx, out, { t0, dur: 0.3, freq: 220, freqEnd: 90, type: 'sine', vol: 0.5, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.24, vol: 0.3, type: 'highpass', freq: 1600, q: 1 });
  },
  win(ctx, out, t0) { // 胜利：五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 坠毁：低频爆 thud + 噪声
    tone(ctx, out, { t0, dur: 0.5, freq: 130, freqEnd: 42, type: 'sawtooth', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.32, vol: 0.32, type: 'lowpass', freq: 900, freqEnd: 200, q: 1 });
  },
};

// 事件名 → SFX 映射（未列的事件保持静音）
const SFX_EVENT_MAP = {
  start: 'start',
  spawn: 'spawn',
  core: 'core',
  score: 'score',
  combo: 'combo',
  nearMiss: 'nearMiss',
  shield: 'shield',
  shieldGot: 'shieldGot',
  shieldBlock: 'shieldBlock',
  win: 'win',
  lose: 'lose',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return [];
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
  return [bus];
}

// ---- BGM 一个循环的编排（16 小节，t0 起始，采样精确、无缝）----

function kick(ctx, out, { t0, vol = 0.4 }) {
  return noise(ctx, out, { t0, dur: 0.05, vol, type: 'bandpass', freq: 2200, q: 4 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.32, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}

function lead(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sawtooth', vol: 0.13, attack: 0.004, release: Math.min(dur, 0.3) });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const nodes = [];
  const push = (srcs) => { for (const s of srcs) nodes.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      push(kick(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.4 : 0.26 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(lead(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
      }
    }
  }
  if (collect) for (const s of nodes) collect.push(s);
  return nodes;
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
