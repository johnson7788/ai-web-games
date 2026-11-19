// HOOP FRENZY · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：synthwave 暗调轻快，BPM 112，D 小调进行 Dm–B♭–F–C（每和弦 2 小节）。
// A 段 8 小节无主音 / B 段 8 小节合成波主音进入，共 16 小节无缝循环。
// 四层编制：打击点=短噪声木鱼、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=正弦短衰减。
// SFX：shoot/swish/bank/miss/combo/flame/golden/stageUp/lifeLost/win/lose/clockTick，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 112;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 16;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Dm – B♭ – F – C
const CHORDS = [
  { root: 50, pad: [57, 62] }, // Dm
  { root: 46, pad: [53, 58] }, // B♭
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [52, 55] }, // C
];

// 主音（B 段 8 小节）：D 小调合成波旋律
const MELODY = [
  [0, 0.0, 74, 1.5], [0, 2.0, 77, 1.5], [0, 3.5, 81, 0.5],
  [1, 0.0, 79, 2.0], [1, 2.0, 74, 2.0],
  [2, 0.0, 72, 1.5], [2, 2.0, 74, 1.5], [2, 3.5, 77, 0.5],
  [3, 0.0, 79, 3.0], [3, 3.0, 76, 1.0],
  [4, 0.0, 74, 1.5], [4, 2.0, 72, 1.5], [4, 3.5, 69, 0.5],
  [5, 0.0, 67, 2.0], [5, 2.0, 69, 2.0],
  [6, 0.0, 72, 1.5], [6, 2.0, 69, 1.5], [6, 3.5, 65, 0.5],
  [7, 0.0, 69, 3.5], [7, 3.5, 65, 0.5],
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

// ---- SFX 合成（每个都短 ≤0.6s）----

const SFX = {
  shoot(ctx, out, t0) { // 出手：噪声高频扫低 + 音调上滑
    noise(ctx, out, { t0, dur: 0.18, vol: 0.22, type: 'highpass', freq: 4000, freqEnd: 1200, q: 0.8 });
    tone(ctx, out, { t0, dur: 0.14, freq: 300, freqEnd: 720, type: 'sine', vol: 0.22, attack: 0.004 });
  },
  swish(ctx, out, t0) { // 空心入网：白噪声快速扫过 + 高音 blip
    noise(ctx, out, { t0, dur: 0.22, vol: 0.34, type: 'bandpass', freq: 5000, freqEnd: 900, q: 2.4 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.16, freq: 1180, freqEnd: 1560, type: 'triangle', vol: 0.3, attack: 0.003 });
  },
  bank(ctx, out, t0) { // 擦板：闷 clunk + 短噪声
    tone(ctx, out, { t0, dur: 0.16, freq: 220, freqEnd: 150, type: 'triangle', vol: 0.42, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.2, type: 'lowpass', freq: 800, q: 1 });
  },
  miss(ctx, out, t0) { // 失手：低音 bounce
    tone(ctx, out, { t0, dur: 0.3, freq: 160, freqEnd: 90, type: 'sine', vol: 0.42, attack: 0.004 });
  },
  combo(ctx, out, t0) { // 连击：快速上行两音
    tone(ctx, out, { t0, dur: 0.08, freq: 880, type: 'square', vol: 0.24, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.07, dur: 0.1, freq: 1320, type: 'square', vol: 0.24, attack: 0.002 });
  },
  flame(ctx, out, t0) { // 烈焰：噪声低通向上扫
    noise(ctx, out, { t0, dur: 0.5, vol: 0.4, type: 'lowpass', freq: 400, freqEnd: 3200, q: 1.2 });
  },
  golden(ctx, out, t0) { // 金环：明亮三连上行
    [76, 79, 83].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.26, freq: midi(m), type: 'triangle', vol: 0.26, attack: 0.003 });
    });
  },
  stageUp(ctx, out, t0) { // 阶段升级：两音上行
    tone(ctx, out, { t0, dur: 0.12, freq: 660, type: 'triangle', vol: 0.3, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.11, dur: 0.2, freq: 990, type: 'triangle', vol: 0.3, attack: 0.003 });
  },
  lifeLost(ctx, out, t0) { // 扣命：下行警音
    tone(ctx, out, { t0, dur: 0.4, freq: 520, freqEnd: 210, type: 'sawtooth', vol: 0.3, attack: 0.004 });
  },
  win(ctx, out, t0) { // 通关：五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 出局：下行闷 thud
    tone(ctx, out, { t0, dur: 0.4, freq: 130, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.24, type: 'lowpass', freq: 500, q: 1 });
  },
  clockTick(ctx, out, t0) { // 倒计时 beep
    tone(ctx, out, { t0, dur: 0.09, freq: 880, type: 'square', vol: 0.24, attack: 0.002 });
  },
};

const SFX_EVENT_MAP = {
  shoot: 'shoot',
  swish: 'swish',
  bank: 'bank',
  miss: 'miss',
  combo: 'combo',
  flame: 'flame',
  golden: 'golden',
  stageUp: 'stageUp',
  lifeLost: 'lifeLost',
  win: 'win',
  lose: 'lose',
  clockTick: 'clockTick',
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
