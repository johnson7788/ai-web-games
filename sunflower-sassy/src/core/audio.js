// SUNFLOWER SASSY · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹迪斯科，BPM 120，E 小调进行 Em–C–G–D（每和弦 1 小节），16 小节无缝循环。
// 四层编制：打击=噪声 hats（正拍/反拍）、贝斯=方波根音八度弹跳、和弦垫=双音锯齿轻 LPF、主音=霓虹正弦短衰减。
// SFX：match/dodge/miss/timeout/score/fever/stage/win/lose/countdown，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 一拍秒数 = 0.5
const BAR = BEAT * 4;             // 一小节 = 2.0s
const BGM_BARS = 16;              // A 段 8 + B 段 8
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 = 32.0s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（E 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 40, pad: [52, 55] }, // Em
  { root: 36, pad: [48, 52] }, // C
  { root: 43, pad: [55, 59] }, // G
  { root: 38, pad: [50, 54] }, // D
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 76, 0.5], [0, 0.5, 79, 0.5], [0, 1.0, 76, 1.0], [0, 2.0, 72, 0.5], [0, 2.5, 71, 0.5], [0, 3.0, 72, 1.0],
  [1, 0.0, 79, 1.0], [1, 1.0, 76, 1.0], [1, 2.0, 72, 0.5], [1, 2.5, 74, 0.5], [1, 3.0, 76, 1.0],
  [2, 0.0, 83, 1.0], [2, 1.0, 79, 1.0], [2, 2.0, 76, 0.5], [2, 2.5, 79, 0.5], [2, 3.0, 83, 1.0],
  [3, 0.0, 84, 2.0], [3, 2.0, 83, 0.5], [3, 2.5, 79, 0.5], [3, 3.0, 76, 1.0],
  [4, 0.0, 74, 0.5], [4, 0.5, 76, 0.5], [4, 1.0, 74, 1.0], [4, 2.0, 71, 0.5], [4, 2.5, 72, 0.5], [4, 3.0, 74, 1.0],
  [5, 0.0, 76, 1.0], [5, 1.0, 74, 1.0], [5, 2.0, 71, 0.5], [5, 2.5, 69, 0.5], [5, 3.0, 71, 1.0],
  [6, 0.0, 79, 1.5], [6, 1.5, 76, 0.5], [6, 2.0, 72, 1.0], [6, 3.0, 67, 1.0],
  [7, 0.0, 76, 2.0], [7, 2.0, 79, 0.5], [7, 2.5, 83, 0.5], [7, 3.0, 84, 1.0],
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
  match(ctx, out, t0) { // 命中：亮 pop 880→660 + 高频 click
    tone(ctx, out, { t0, dur: 0.1, freq: 880, freqEnd: 660, type: 'triangle', vol: 0.5, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.14, type: 'highpass', freq: 3000, q: 1 });
  },
  dodge(ctx, out, t0) { // 闪避：whoosh 带通下扫
    noise(ctx, out, { t0, dur: 0.28, vol: 0.45, type: 'bandpass', freq: 3200, freqEnd: 500, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.18, freq: 500, freqEnd: 240, type: 'sine', vol: 0.2, attack: 0.004 });
  },
  miss(ctx, out, t0) { // 失误：闷 thud 120→55
    tone(ctx, out, { t0, dur: 0.34, freq: 120, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.16, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  timeout(ctx, out, t0) { // 超时：双短 beep 下行
    tone(ctx, out, { t0, dur: 0.09, freq: 720, type: 'square', vol: 0.26, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.12, dur: 0.12, freq: 480, type: 'square', vol: 0.26, attack: 0.003 });
  },
  score(ctx, out, t0, payload) { // 里程碑得分：三连音上行，音高随 tier 递增
    const tier = payload && typeof payload.tier === 'number' ? payload.tier : 0;
    const shift = Math.min(Math.max(0, tier), 6);
    const base = 72 + shift;
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.24, freq: midi(base + iv), type: 'sine', vol: 0.26, attack: 0.003 });
    });
  },
  fever(ctx, out, t0) { // 狂热：上行 sweep 200→900
    tone(ctx, out, { t0, dur: 0.42, freq: 200, freqEnd: 900, type: 'sawtooth', vol: 0.32, attack: 0.006 });
    noise(ctx, out, { t0, dur: 0.4, vol: 0.18, type: 'highpass', freq: 2000, q: 1 });
  },
  stage(ctx, out, t0) { // 阶段切换：两音上行小号角
    tone(ctx, out, { t0, dur: 0.12, freq: 523, type: 'triangle', vol: 0.3, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.13, dur: 0.16, freq: 784, type: 'triangle', vol: 0.3, attack: 0.004 });
  },
  win(ctx, out, t0) { // 胜利：五音 jingle C-E-G-C-E
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：低 thud + 短噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
  countdown(ctx, out, t0) { // 最后 5s 每秒 beep 880
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.28, attack: 0.003 });
  },
};

// 把事件名映射到 SFX；countdownTick 故意不放进 map（负例门控，见 audio-check）。
const SFX_EVENT_MAP = {
  match: 'match',
  dodge: 'dodge',
  miss: 'miss',
  timeout: 'timeout',
  score: 'score',
  fever: 'fever',
  stage: 'stage',
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

// ---- BGM 一个循环的编排（16 小节，t0 起始，采样精确、无缝）----

function hat(ctx, out, { t0, vol = 0.24 }) {
  return noise(ctx, out, { t0, dur: 0.035, vol, type: 'highpass', freq: 7000, q: 1 });
}

function clap(ctx, out, { t0, vol = 0.3 }) {
  return noise(ctx, out, { t0, dur: 0.09, vol, type: 'bandpass', freq: 1500, q: 1.6 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  const srcs = [];
  srcs.push(...tone(ctx, out, { t0, dur: 0.16, freq: midi(midiNote), type: 'square', vol: 0.24, attack: 0.004, release: 0.16 }));
  srcs.push(...tone(ctx, out, { t0: t0 + BEAT / 2, dur: 0.12, freq: midi(midiNote + 12), type: 'square', vol: 0.16, attack: 0.004, release: 0.12 }));
  return srcs;
}

function neonLead(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.18, attack: 0.003, release: Math.min(dur, 0.3) });
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
      push(hat(ctx, bus, { t0: bt, vol: 0.22 }));           // 正拍 hat
      push(hat(ctx, bus, { t0: bt + BEAT / 2, vol: 0.16 })); // 反拍 hat
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
      if (b === 1 || b === 3) push(clap(ctx, bus, { t0: bt, vol: 0.26 })); // 2/4 拍 clap
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(neonLead(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
