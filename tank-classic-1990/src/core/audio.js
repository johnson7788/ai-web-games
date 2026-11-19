// TANK CLASSIC 1990 · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机循环，BPM 100，A 小调进行 Am–F–C–G（每和弦 2 小节）。
// 8 小节无缝循环，四层：底鼓=低频 sine 短促、贝斯=三角波根音、琶音=方波上行、垫=锯齿轻 LPF。
// SFX：fire/hit/kill/powerup/playerHit/freeze/shield/combo/win/lose/countdown，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 0.6s
const BAR = BEAT * 4;             // 2.4s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;  // 19.2s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Am F C G
const CHORDS = [
  { root: 45, pad: [52, 57] }, // Am
  { root: 41, pad: [48, 53] }, // F
  { root: 48, pad: [52, 55] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// 琶音（方波）：[小节, 拍, MIDI]
const ARP = [
  [0, 0, 69], [0, 1, 72], [0, 2, 76], [0, 3, 72],
  [1, 0, 69], [1, 1, 72], [1, 2, 76], [1, 3, 79],
  [2, 0, 65], [2, 1, 69], [2, 2, 72], [2, 3, 69],
  [3, 0, 65], [3, 1, 69], [3, 2, 72], [3, 3, 76],
  [4, 0, 72], [4, 1, 76], [4, 2, 79], [4, 3, 76],
  [5, 0, 72], [5, 1, 76], [5, 2, 79], [5, 3, 84],
  [6, 0, 67], [6, 1, 71], [6, 2, 74], [6, 3, 71],
  [7, 0, 67], [7, 1, 71], [7, 2, 74], [7, 3, 79],
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
    const att = 0.08;
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
  fire(ctx, out, t0) { // 炮击：短方波扫频 + 噪声脉冲
    tone(ctx, out, { t0, dur: 0.12, freq: 520, freqEnd: 120, type: 'square', vol: 0.5, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.08, vol: 0.3, type: 'highpass', freq: 2500, q: 1 });
  },
  hit(ctx, out, t0) { // 打中砖/岩：脆响
    noise(ctx, out, { t0, dur: 0.16, vol: 0.4, type: 'bandpass', freq: 1800, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.09, freq: 220, freqEnd: 140, type: 'triangle', vol: 0.4, attack: 0.002 });
  },
  kill(ctx, out, t0) { // 击毁坦克：爆炸，低通噪声下扫 + 低频 sine
    noise(ctx, out, { t0, dur: 0.4, vol: 0.55, type: 'lowpass', freq: 2400, freqEnd: 200, q: 0.8 });
    tone(ctx, out, { t0, dur: 0.32, freq: 140, freqEnd: 45, type: 'sine', vol: 0.6, attack: 0.004 });
  },
  playerHit(ctx, out, t0) { // 玩家被击中：闷 thud
    tone(ctx, out, { t0, dur: 0.3, freq: 130, freqEnd: 60, type: 'sine', vol: 0.6, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.16, vol: 0.3, type: 'lowpass', freq: 500, q: 1 });
  },
  powerup(ctx, out, t0) { // 道具拾取：上行三连音
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.18, freq: midi(72 + iv), type: 'square', vol: 0.3, attack: 0.002 });
    });
  },
  freeze(ctx, out, t0) { // 冻结：高音水晶下扫
    tone(ctx, out, { t0, dur: 0.35, freq: 1800, freqEnd: 400, type: 'sine', vol: 0.35, attack: 0.005 });
  },
  shield(ctx, out, t0) { // 护盾：柔和的上升两音
    [60, 64].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.3, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.006 }));
  },
  combo(ctx, out, t0, payload) { // 连击：音高随 combo 递增的短 blip
    const c = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const shift = Math.min(Math.max(0, c - 1), 12);
    tone(ctx, out, { t0, dur: 0.09, freq: midi(76 + shift), type: 'square', vol: 0.28, attack: 0.002 });
  },
  win(ctx, out, t0) { // 胜利：C-E-G-C-E
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.32, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：下行三音
    [76, 72, 67].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.16, dur: 0.3, freq: midi(m), type: 'triangle', vol: 0.34, attack: 0.006 });
    });
  },
  countdown(ctx, out, t0) { // 倒计时 beep
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.26, attack: 0.003 });
  },
};

// 事件名 → SFX 映射（sim 事件驱动）
const SFX_EVENT_MAP = {
  fire: 'fire',
  enemyFire: 'fire',
  hit: 'hit',
  kill: 'kill',
  playerHit: 'playerHit',
  powerup: 'powerup',
  freeze: 'freeze',
  shield: 'shield',
  combo: 'combo',
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

// ---- BGM 一个循环的编排（8 小节，t0 起始，采样精确、无缝）----

function kick(ctx, out, { t0, vol = 0.5 }) {
  return tone(ctx, out, { t0, dur: 0.16, freq: 110, freqEnd: 40, type: 'sine', vol, attack: 0.002 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.4, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.35 });
}

function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.16, freq: midi(midiNote), type: 'square', vol: 0.13, attack: 0.002, release: 0.1 });
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
      push(kick(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.5 : 0.34 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    for (const [mBar, beat, m] of ARP) {
      if (mBar === bar) push(arpNote(ctx, bus, { t0: barT + beat * BEAT, midiNote: m }));
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
