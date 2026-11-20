// TILE TRIAD · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：集市轻快小调，BPM 108，G 大调进行 G–Em–C–D（每和弦 2 小节）。
// A 段 8 小节无主音 / B 段 8 小节主音进入，共 16 小节无缝循环（相位连续，不用 media 淡入淡出）。
// 四层编制：打击点=短噪声木鱼、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=马林巴感正弦短衰减。
// SFX：pick/clear/reveal/nearFull/undo/shuffle/cat/win/lose/countdown，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 108;
const BEAT = 60 / BPM;            // 一拍秒数 ≈0.5556
const BAR = BEAT * 4;             // 一小节 ≈2.2222s
const BGM_BARS = 16;              // A 段 8 + B 段 8
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 ≈35.5556s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);   // BGM 音量总线
const SFX_GAIN = dbToGain(-10);   // SFX 音量总线
const DUCK_GAIN = dbToGain(-20);  // win/lose 时 BGM 短暂 duck

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（G 大调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 43, pad: [50, 55] }, // G
  { root: 40, pad: [47, 52] }, // Em
  { root: 48, pad: [55, 60] }, // C
  { root: 50, pad: [57, 62] }, // D
];

// 主音（B 段 8 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 74, 1.5], [0, 2.0, 76, 1.5], [0, 3.5, 79, 0.5],
  [1, 0.0, 76, 2.0], [1, 2.0, 74, 2.0],
  [2, 0.0, 71, 1.5], [2, 2.0, 74, 1.5], [2, 3.5, 76, 0.5],
  [3, 0.0, 78, 3.0], [3, 3.0, 76, 1.0],
  [4, 0.0, 74, 1.5], [4, 2.0, 71, 1.5], [4, 3.5, 67, 0.5],
  [5, 0.0, 64, 2.0], [5, 2.0, 67, 2.0],
  [6, 0.0, 69, 1.5], [6, 2.0, 71, 1.5], [6, 3.5, 74, 0.5],
  [7, 0.0, 71, 3.5], [7, 3.5, 67, 0.5],
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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.16 }) {
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
  pick(ctx, out, t0) { // 木 click 2kHz + 短噪声（拾取入槽）
    tone(ctx, out, { t0, dur: 0.06, freq: 1800, type: 'sine', vol: 0.5, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.16, type: 'bandpass', freq: 1800, q: 6 });
  },
  clear(ctx, out, t0) { // 陶罐碰撞：瓷片 clink 三连 + 香料粉尘噪声
    [1800, 2200, 2600].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.045, dur: 0.12, freq: f, type: 'triangle', vol: 0.32, attack: 0.002 });
    });
    noise(ctx, out, { t0, dur: 0.28, vol: 0.3, type: 'highpass', freq: 1200, q: 0.8 });
  },
  reveal(ctx, out, t0) { // 翻牌轻 tick
    tone(ctx, out, { t0, dur: 0.05, freq: 900, freqEnd: 1400, type: 'sine', vol: 0.28, attack: 0.002 });
  },
  nearFull(ctx, out, t0) { // 收槽告警：低鸣
    tone(ctx, out, { t0, dur: 0.14, freq: 320, freqEnd: 240, type: 'square', vol: 0.22, attack: 0.004 });
  },
  undo(ctx, out, t0) { // 撤回：反向 whoosh + 短哨
    tone(ctx, out, { t0, dur: 0.18, freq: 700, freqEnd: 1100, type: 'sine', vol: 0.32, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.22, vol: 0.5, type: 'bandpass', freq: 900, freqEnd: 300, q: 1.4 });
  },
  shuffle(ctx, out, t0) { // 洗牌：快速 rattle + 下行扫频
    tone(ctx, out, { t0, dur: 0.24, freq: 1400, freqEnd: 520, type: 'triangle', vol: 0.34, attack: 0.004 });
    for (let i = 0; i < 5; i += 1) {
      noise(ctx, out, { t0: t0 + i * 0.05, dur: 0.045, vol: 0.5, type: 'bandpass', freq: 2600 + i * 240, q: 3 });
    }
  },
  cat(ctx, out, t0) { // 掌柜小猫：两声上行 chirp
    [880, 1320].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.1, freq: f, freqEnd: f * 1.3, type: 'triangle', vol: 0.26, attack: 0.004 });
    });
  },
  win(ctx, out, t0) { // 五音上行 jingle G-B-D-G-B
    [67, 71, 74, 79, 83].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 120Hz 闷 thud + 短噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
  countdown(ctx, out, t0) { // 最后 5s 每秒 beep 880Hz
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.28, attack: 0.003 });
  },
};

// 把事件名映射到 SFX
const SFX_EVENT_MAP = {
  pick: 'pick',
  clear: 'clear',
  reveal: 'reveal',
  nearFull: 'nearFull',
  undo: 'undo',
  shuffle: 'shuffle',
  catReact: 'cat',
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
