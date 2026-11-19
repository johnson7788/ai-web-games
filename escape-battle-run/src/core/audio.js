// ESCAPE BATTLE RUN · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹 synthwave，BPM 120，A 小调进行 Am–F–C–G（每和弦 1 小节）。
// 8 小节无缝循环（相位连续，不用 media 淡入淡出）。
// 四层编制：打击点=短噪声、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=方波感正弦短衰减。
// SFX：gem/combo/whoosh/nova/rock/wave/lose，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2s
const BGM_BARS = 8;               // 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [55, 59] }, // G
];

// 主音：[小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 81, 1.0], [0, 2.0, 84, 0.5], [0, 3.0, 81, 0.5],
  [1, 0.0, 77, 1.0], [1, 2.0, 81, 1.0], [1, 3.5, 79, 0.5],
  [2, 0.0, 84, 1.0], [2, 2.0, 81, 1.0], [2, 3.0, 79, 0.5],
  [3, 0.0, 76, 1.5], [3, 2.5, 74, 1.0],
  [4, 0.0, 72, 1.0], [4, 2.0, 76, 0.5], [4, 3.0, 79, 0.5],
  [5, 0.0, 84, 1.5], [5, 2.5, 81, 0.5], [5, 3.5, 79, 0.5],
  [6, 0.0, 76, 1.0], [6, 2.0, 79, 1.0], [6, 3.5, 81, 0.5],
  [7, 0.0, 84, 2.0], [7, 2.5, 88, 1.0],
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
  gem(ctx, out, t0, payload) { // 晶体：上行 blip，音高随连击递增
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const base = 78 + Math.min(6, Math.max(0, combo - 1));
    tone(ctx, out, { t0, dur: 0.12, freq: midi(base), type: 'sine', vol: 0.4, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.14, freq: midi(base + 7), type: 'sine', vol: 0.3, attack: 0.002 });
  },
  combo(ctx, out, t0) { // 连击里程碑：三连音
    [76, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.003 });
    });
  },
  whoosh(ctx, out, t0) { // 擦身：噪声扫频
    noise(ctx, out, { t0, dur: 0.22, vol: 0.6, type: 'bandpass', freq: 900, freqEnd: 2400, q: 1.2 });
  },
  nova(ctx, out, t0) { // 能量爆发：低音冲击 + 白噪扫
    tone(ctx, out, { t0, dur: 0.4, freq: 140, freqEnd: 50, type: 'sine', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.4, vol: 0.4, type: 'lowpass', freq: 4000, freqEnd: 200, q: 1 });
  },
  rock(ctx, out, t0) { // 岩石命中：闷 thud
    tone(ctx, out, { t0, dur: 0.2, freq: 120, freqEnd: 80, type: 'triangle', vol: 0.42, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.12, vol: 0.2, type: 'lowpass', freq: 500, q: 1 });
  },
  wave(ctx, out, t0) { // 波次切换：上升 sweep
    tone(ctx, out, { t0, dur: 0.4, freq: 220, freqEnd: 660, type: 'sawtooth', vol: 0.22, attack: 0.01 });
  },
  lose(ctx, out, t0) { // 死亡：低频下坠
    tone(ctx, out, { t0, dur: 0.5, freq: 200, freqEnd: 45, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.3, type: 'lowpass', freq: 700, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  gem: 'gem',
  combo: 'combo',
  nearMiss: 'whoosh',
  nova: 'nova',
  rockHit: 'rock',
  wave: 'wave',
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

// ---- BGM 一个循环的编排（8 小节，t0 起始，采样精确、无缝）----

function kick(ctx, out, { t0, vol = 0.4 }) {
  return tone(ctx, out, { t0, dur: 0.14, freq: 120, freqEnd: 45, type: 'sine', vol, attack: 0.002 });
}

function hat(ctx, out, { t0, vol = 0.18 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 7000, q: 1 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.28, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.005, release: 0.28 });
}

function lead(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.11, attack: 0.004, release: Math.min(dur, 0.3) });
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
      push(kick(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.42 : 0.3 }));
      push(hat(ctx, bus, { t0: barT + b * BEAT + BEAT / 2 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    push(padNote(ctx, bus, { t0: barT, dur: BAR, freqs: chord.pad }));
    for (const [mBar, beat, m, durBeats] of MELODY) {
      if (mBar === bar) push(lead(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.12);
    p.setValueAtTime(DUCK_GAIN, t + 1.8);
    p.linearRampToValueAtTime(1, t + 1.95);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) {
      scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    }
    if (name === 'death') duckBgm();
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
