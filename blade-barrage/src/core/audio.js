// BLADE BARRAGE · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机 synthwave，BPM 120，A 小调进行 Am–F–C–G（每和弦 2 小节）。
// A 段 8 小节无主音 / B 段 8 小节主音进入，共 16 小节无缝循环。
// 编制：打击点=短噪声、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=方波琶音（synthwave）。
// SFX：fire/hit/perfect/gem/surge/burst/die/lose/wave，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2s
const BGM_BARS = 16;              // A 8 + B 8
const BGM_LOOP = BAR * BGM_BARS;  // 32s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-16);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Am–F–C–G（A 小调）
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// B 段主音（synthwave 琶音）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 69, 0.5], [0, 0.5, 72, 0.5], [0, 1.0, 76, 0.5], [0, 1.5, 72, 0.5],
  [0, 2.0, 69, 0.5], [0, 2.5, 72, 0.5], [0, 3.0, 76, 0.5], [0, 3.5, 81, 0.5],
  [1, 0.0, 77, 0.5], [1, 0.5, 74, 0.5], [1, 1.0, 70, 0.5], [1, 1.5, 74, 0.5],
  [1, 2.0, 77, 0.5], [1, 2.5, 74, 0.5], [1, 3.0, 70, 0.5], [1, 3.5, 65, 0.5],
  [2, 0.0, 72, 0.5], [2, 0.5, 76, 0.5], [2, 1.0, 79, 0.5], [2, 1.5, 76, 0.5],
  [2, 2.0, 72, 0.5], [2, 2.5, 76, 0.5], [2, 3.0, 79, 0.5], [2, 3.5, 84, 0.5],
  [3, 0.0, 79, 0.5], [3, 0.5, 76, 0.5], [3, 1.0, 71, 0.5], [3, 1.5, 76, 0.5],
  [3, 2.0, 79, 0.5], [3, 2.5, 76, 0.5], [3, 3.0, 71, 0.5], [3, 3.5, 67, 0.5],
  [4, 0.0, 69, 0.5], [4, 0.5, 72, 0.5], [4, 1.0, 76, 0.5], [4, 1.5, 72, 0.5],
  [4, 2.0, 69, 0.5], [4, 2.5, 72, 0.5], [4, 3.0, 76, 0.5], [4, 3.5, 81, 0.5],
  [5, 0.0, 77, 0.5], [5, 0.5, 74, 0.5], [5, 1.0, 70, 0.5], [5, 1.5, 74, 0.5],
  [5, 2.0, 77, 0.5], [5, 2.5, 81, 0.5], [5, 3.0, 84, 0.5], [5, 3.5, 81, 0.5],
  [6, 0.0, 72, 0.5], [6, 0.5, 76, 0.5], [6, 1.0, 79, 0.5], [6, 1.5, 76, 0.5],
  [6, 2.0, 72, 0.5], [6, 2.5, 76, 0.5], [6, 3.0, 79, 0.5], [6, 3.5, 84, 0.5],
  [7, 0.0, 86, 0.5], [7, 0.5, 84, 0.5], [7, 1.0, 79, 0.5], [7, 1.5, 76, 0.5],
  [7, 2.0, 79, 0.5], [7, 2.5, 76, 0.5], [7, 3.0, 71, 0.5], [7, 3.5, 67, 0.5],
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
    lp.frequency.value = 1400;
    lp.Q.value = 0.7;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.06);
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

// ---- SFX（每个 ≤0.6s）----
const SFX = {
  fire(ctx, out, t0) { // 上冲 whoosh：噪声高通扫频 + 上行短音
    noise(ctx, out, { t0, dur: 0.28, vol: 0.32, type: 'bandpass', freq: 600, freqEnd: 3600, q: 0.9 });
    tone(ctx, out, { t0, dur: 0.18, freq: 300, freqEnd: 900, type: 'sawtooth', vol: 0.22, attack: 0.004 });
  },
  hit(ctx, out, t0) { // 命中 blip
    tone(ctx, out, { t0, dur: 0.1, freq: 900, freqEnd: 1400, type: 'square', vol: 0.3, attack: 0.002 });
  },
  perfect(ctx, out, t0) { // 完美：双音 chime
    tone(ctx, out, { t0, dur: 0.14, freq: 1320, type: 'triangle', vol: 0.32, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.16, freq: 1980, type: 'triangle', vol: 0.28, attack: 0.002 });
  },
  gem(ctx, out, t0) { // 宝石：上行叮咚
    [1046, 1568].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.2, freq: f, type: 'sine', vol: 0.3, attack: 0.002 });
    });
  },
  surge(ctx, out, t0) { // 爆发：快速上行 riser
    tone(ctx, out, { t0, dur: 0.5, freq: 220, freqEnd: 1760, type: 'sawtooth', vol: 0.3, attack: 0.02 });
    noise(ctx, out, { t0, dur: 0.5, vol: 0.18, type: 'highpass', freq: 1200, q: 0.8 });
  },
  burst(ctx, out, t0) { // 当空爆发：噪声爆 + 低频 thump
    noise(ctx, out, { t0, dur: 0.3, vol: 0.4, type: 'lowpass', freq: 3200, freqEnd: 500, q: 1 });
    tone(ctx, out, { t0, dur: 0.16, freq: 200, freqEnd: 80, type: 'triangle', vol: 0.34, attack: 0.003 });
  },
  die(ctx, out, t0) { // 死亡：下行闷响
    tone(ctx, out, { t0, dur: 0.35, freq: 180, freqEnd: 60, type: 'sawtooth', vol: 0.36, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.24, type: 'lowpass', freq: 800, q: 1 });
  },
  lose(ctx, out, t0) { // 结算：三音下行
    [330, 262, 196].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.12, dur: 0.24, freq: f, type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  wave(ctx, out, t0) { // 进波：双音上行提示
    tone(ctx, out, { t0, dur: 0.12, freq: 660, type: 'square', vol: 0.22, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.09, dur: 0.14, freq: 990, type: 'square', vol: 0.22, attack: 0.003 });
  },
};

const SFX_EVENT_MAP = {
  fire: 'fire',
  hit: 'hit',
  perfect: 'perfect',
  gem: 'gem',
  surge: 'surge',
  burst: 'burst',
  die: 'die',
  lose: 'lose',
  wave: 'wave',
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
function hat(ctx, out, { t0, vol = 0.16 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 6000, q: 1 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.24, freq: midi(midiNote), type: 'triangle', vol: 0.34, attack: 0.006, release: 0.24 });
}

function lead(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.14, attack: 0.003, release: Math.min(dur, 0.18) });
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
      push(hat(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.18 : 0.13 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(lead(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    if (name === 'lose') duckBgm();
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
