// INK FINCH · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：水墨留白气质，BPM 88，C 大调五声音阶（C–D–E–G–A），和弦循环 C–Am–F–G。
// A 段 8 小节留白无主音 / B 段 4 小节主音进入，共 12 小节无缝循环（相位连续）。
// 四层编制：打击点=短噪声竹节敲击、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=拨弦感正弦短衰减。
// SFX：flap/ink/score/bonus/nearMiss/win/lose/approach/wind/tick，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 88;
const BEAT = 60 / BPM;            // 一拍秒数 ≈0.6818
const BAR = BEAT * 4;             // 一小节 ≈2.727
const BGM_BARS = 12;              // A 段 8 + B 段 4
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 ≈32.7s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（C 大调五声）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 48, pad: [55, 60] }, // C
  { root: 45, pad: [52, 57] }, // Am
  { root: 41, pad: [48, 53] }, // F
  { root: 43, pad: [50, 55] }, // G
];

// 主音（B 段 4 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 72, 1.5], [0, 2.0, 74, 1.5], [0, 3.5, 76, 0.5],
  [1, 0.0, 74, 2.0], [1, 2.0, 72, 2.0],
  [2, 0.0, 69, 1.5], [2, 2.0, 72, 1.5], [2, 3.5, 74, 0.5],
  [3, 0.0, 76, 3.0], [3, 3.0, 72, 1.0],
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
    const rel = 0.24;
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
  flap(ctx, out, t0) { // 振翅轻扫：低频嗡 + 上扫噪声
    tone(ctx, out, { t0, dur: 0.12, freq: 260, freqEnd: 380, type: 'sine', vol: 0.3, attack: 0.006 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.12, type: 'bandpass', freq: 900, freqEnd: 1600, q: 2 });
  },
  ink(ctx, out, t0) { // 墨滴落：短 blip 下行
    tone(ctx, out, { t0, dur: 0.09, freq: 1400, freqEnd: 620, type: 'sine', vol: 0.22, attack: 0.002 });
  },
  score(ctx, out, t0) { // 竹节轻叩
    tone(ctx, out, { t0, dur: 0.1, freq: 720, type: 'triangle', vol: 0.42, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.04, vol: 0.14, type: 'bandpass', freq: 2200, q: 6 });
  },
  bonus(ctx, out, t0) { // 朱砂加分：双音上行
    tone(ctx, out, { t0, dur: 0.1, freq: 660, type: 'triangle', vol: 0.36, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.12, freq: 880, type: 'triangle', vol: 0.36, attack: 0.002 });
  },
  nearMiss(ctx, out, t0) { // 擦边：短促 swish
    noise(ctx, out, { t0, dur: 0.16, vol: 0.55, type: 'bandpass', freq: 2600, freqEnd: 900, q: 1.4 });
  },
  approach(ctx, out, t0) { // 竹节逼近：极轻 tick
    tone(ctx, out, { t0, dur: 0.05, freq: 520, type: 'sine', vol: 0.16, attack: 0.002 });
  },
  wind(ctx, out, t0) { // 逆风：低频沙响
    noise(ctx, out, { t0, dur: 0.32, vol: 0.55, type: 'lowpass', freq: 900, freqEnd: 300, q: 1 });
  },
  tick(ctx, out, t0) { // 转轮节拍
    tone(ctx, out, { t0, dur: 0.04, freq: 900, type: 'square', vol: 0.12, attack: 0.001 });
  },
  win(ctx, out, t0) { // 通关：五声音阶上行 jingle
    [72, 74, 76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 墨洒：闷 thud + 短噪声
    tone(ctx, out, { t0, dur: 0.42, freq: 120, freqEnd: 52, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.22, vol: 0.28, type: 'lowpass', freq: 480, q: 1 });
  },
};

// 把事件名映射到 SFX
const SFX_EVENT_MAP = {
  flap: 'flap',
  ink: 'ink',
  gatePass: 'score',
  bonus: 'bonus',
  nearMiss: 'nearMiss',
  gateApproach: 'approach',
  windGust: 'wind',
  wheelSpin: 'tick',
  win: 'win',
  death: 'lose',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环的编排（12 小节，t0 起始，采样精确、无缝）----

function woodblock(ctx, out, { t0, vol = 0.36 }) {
  return noise(ctx, out, { t0, dur: 0.05, vol, type: 'bandpass', freq: 2300, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.32, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.32 });
}

function pluck(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.18, attack: 0.004, release: Math.min(dur, 0.4) });
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
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.36 : 0.24 }));
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
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'win' || name === 'death') duckBgm();
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
