// GUN GOD ARENA · 程序化音频（纯 WebAudio，零音频文件零外链）
// 风格：霓虹街机 synthwave。BGM 120 BPM，Em–C–G–D 进行（每和弦 2 小节），8 小节无缝循环。
// 编制：kick（低频正弦鼓点）、hat（短噪声镲）、bass（锯齿低音 8 分音符）、pad（双音锯齿轻 LPF）、
//       arp（16 分音符方波琶音，A 段低 / B 段高八度）。
// SFX：shot/reflect/kill/crate/rock/pickup/combo/boom/noAmmo/levelclear/vipfail/fail/win/crush，全部 ≤0.6s。
// 导出 createAudio()（实时）+ scheduleBgmLoop/scheduleSfx/常量（供 tools/audio-check.mjs 离屏复验）。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2s
const BGM_BARS = 8;               // A 段 4 + B 段 4
const BGM_LOOP = BAR * BGM_BARS;  // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-13);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（Em / C / G / D，根音为低音 MIDI，pad 为双音）
const CHORDS = [
  { root: 40, pad: [52, 55], arp: [52, 55, 59, 64] },  // Em
  { root: 36, pad: [48, 52], arp: [48, 52, 55, 60] },  // C
  { root: 43, pad: [55, 59], arp: [55, 59, 62, 67] },  // G
  { root: 38, pad: [50, 54], arp: [50, 54, 57, 62] },  // D
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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.12 }) {
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
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.05);
    g.gain.setValueAtTime(vol, t0 + dur - 0.2);
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
  shot(ctx, out, t0) { // 激光 zap：高频短促下降
    tone(ctx, out, { t0, dur: 0.09, freq: 1600, freqEnd: 460, type: 'sawtooth', vol: 0.26, attack: 0.002 });
  },
  reflect(ctx, out, t0) { // 弹射 ping：短促上行
    tone(ctx, out, { t0, dur: 0.06, freq: 900, freqEnd: 1400, type: 'square', vol: 0.18, attack: 0.001 });
  },
  kill(ctx, out, t0) { // 击碎爆炸：噪声 + 低频 thump
    noise(ctx, out, { t0, dur: 0.28, vol: 0.4, type: 'lowpass', freq: 2600, freqEnd: 300, q: 1 });
    tone(ctx, out, { t0, dur: 0.2, freq: 170, freqEnd: 52, type: 'sine', vol: 0.42, attack: 0.003 });
  },
  crate(ctx, out, t0) { // 箱子打爆：clunk + 碎片
    tone(ctx, out, { t0, dur: 0.12, freq: 320, freqEnd: 90, type: 'square', vol: 0.24, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.2, type: 'bandpass', freq: 1200, q: 1 });
  },
  rock(ctx, out, t0) { // 岩石坠落：低沉 rumbling
    tone(ctx, out, { t0, dur: 0.3, freq: 120, freqEnd: 60, type: 'sine', vol: 0.32, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.18, type: 'lowpass', freq: 700, freqEnd: 200, q: 1 });
  },
  pickup(ctx, out, t0) { // 道具：双音 blip 上行
    tone(ctx, out, { t0, dur: 0.07, freq: 1320, type: 'sine', vol: 0.24, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.09, freq: 1760, type: 'sine', vol: 0.24, attack: 0.002 });
  },
  combo(ctx, out, t0) { // 连击：三音上行 jingle
    [880, 1108, 1318].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.1, freq: f, type: 'square', vol: 0.18, attack: 0.002 });
    });
  },
  boom(ctx, out, t0) { // 炸弹爆炸
    noise(ctx, out, { t0, dur: 0.45, vol: 0.5, type: 'lowpass', freq: 2800, freqEnd: 120, q: 1 });
    tone(ctx, out, { t0, dur: 0.4, freq: 140, freqEnd: 40, type: 'sine', vol: 0.5, attack: 0.004 });
  },
  noAmmo(ctx, out, t0) { // 空膛 click
    tone(ctx, out, { t0, dur: 0.05, freq: 800, type: 'square', vol: 0.14, attack: 0.001 });
  },
  levelclear(ctx, out, t0) { // 过关小号角
    [523, 659, 784].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.18, freq: f, type: 'triangle', vol: 0.26, attack: 0.003 });
    });
  },
  vipfail(ctx, out, t0) { // 误伤 VIP：警报
    tone(ctx, out, { t0, dur: 0.24, freq: 700, freqEnd: 420, type: 'square', vol: 0.22, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.24, dur: 0.24, freq: 700, freqEnd: 420, type: 'square', vol: 0.22, attack: 0.002 });
  },
  fail(ctx, out, t0) { // 失败：低沉扫频
    noise(ctx, out, { t0, dur: 0.5, vol: 0.45, type: 'lowpass', freq: 2600, freqEnd: 140, q: 1 });
    tone(ctx, out, { t0, dur: 0.5, freq: 200, freqEnd: 55, type: 'sawtooth', vol: 0.3, attack: 0.005 });
  },
  win(ctx, out, t0) { // 胜利：上行号角 + 尾音
    [523, 659, 784, 1046].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.16, freq: f, type: 'triangle', vol: 0.24, attack: 0.003 });
    });
  },
  crush(ctx, out, t0) { // 碾压：闷响 thud
    tone(ctx, out, { t0, dur: 0.18, freq: 180, freqEnd: 70, type: 'sine', vol: 0.36, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.16, vol: 0.2, type: 'lowpass', freq: 800, q: 1 });
  },
};

// 事件名 → SFX 映射
const SFX_EVENT_MAP = {
  shot: 'shot',
  reflect: 'reflect',
  kill: 'kill',
  crate: 'crate',
  rock: 'rock',
  pickup: 'pickup',
  combo: 'combo',
  boom: 'boom',
  noAmmo: 'noAmmo',
  levelclear: 'levelclear',
  vipfail: 'vipfail',
  fail: 'fail',
  win: 'win',
  crush: 'crush',
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
function kick(ctx, out, { t0, vol = 0.42 }) {
  return tone(ctx, out, { t0, dur: 0.12, freq: 150, freqEnd: 45, type: 'sine', vol, attack: 0.002 });
}
function hat(ctx, out, { t0, vol = 0.1 }) {
  return noise(ctx, out, { t0, dur: 0.03, vol, type: 'highpass', freq: 7000, q: 1 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.16, freq: midi(midiNote), type: 'sawtooth', vol: 0.24, attack: 0.004, release: 0.16 });
}
function arpNote(ctx, out, { t0, midiNote, octave = 1 }) {
  return tone(ctx, out, { t0, dur: 0.1, freq: midi(midiNote + 12 * octave), type: 'square', vol: 0.07, attack: 0.002, release: 0.1 });
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
      const bt = barT + b * BEAT;
      push(kick(ctx, bus, { t0: bt, vol: b === 0 ? 0.42 : 0.34 }));
      push(hat(ctx, bus, { t0: bt + BEAT / 2 }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
      push(bassNote(ctx, bus, { t0: bt + BEAT / 2, midiNote: chord.root + 12 }));
    }
    push(padNote(ctx, bus, { t0: barT, dur: BAR, freqs: chord.pad }));
    const octave = bar >= 4 ? 1 : 0;
    for (let s = 0; s < 16; s += 1) {
      push(arpNote(ctx, bus, { t0: barT + s * (BEAT / 4), midiNote: chord.arp[s % 4], octave }));
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
    p.setValueAtTime(DUCK_GAIN, t + 2.0);
    p.linearRampToValueAtTime(1, t + 2.15);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'fail' || name === 'win' || name === 'vipfail') duckBgm();
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
