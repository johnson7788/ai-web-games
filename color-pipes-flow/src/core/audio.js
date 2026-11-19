// COLOR PIPES FLOW · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹 synthwave，BPM 120，A 小调 arp（A–F–C–G 每和弦 1 小节），8 小节无缝循环。
// 三层编制：低频贝斯三角波、琶音方波（轻 LPF）、打击点短噪声。
// SFX：drawStart/cellFill/pairComplete/combo/backtrack/hint/win/lose，全部 ≤0.6s。
// 导出 createAudio()（实时），另导出 scheduleBgmLoop / scheduleSfx / 常量供 tools/audio-check.mjs 离屏复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2s
const BGM_BARS = 8;               // 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，arp=琶音音组(MIDI)
const CHORDS = [
  { root: 45, arp: [57, 60, 64, 69] }, // Am
  { root: 41, arp: [53, 57, 60, 65] }, // F
  { root: 48, arp: [60, 64, 67, 72] }, // C
  { root: 43, arp: [55, 59, 62, 67] }, // G
];

// ---- 低层合成（对任意 AudioContext / OfflineAudioContext 通用） ----
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

// ---- SFX（每个都短 ≤0.6s） ----
const SFX = {
  drawStart(ctx, out, t0) { // 端口点亮：短促上行 blip
    tone(ctx, out, { t0, dur: 0.08, freq: 620, freqEnd: 880, type: 'square', vol: 0.28, attack: 0.003 });
  },
  cellFill(ctx, out, t0) { // 铺管：水滴 click
    tone(ctx, out, { t0, dur: 0.06, freq: 1500, freqEnd: 900, type: 'sine', vol: 0.34, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.1, type: 'bandpass', freq: 2600, q: 5 });
  },
  pairComplete(ctx, out, t0, payload) { // 管道接通：三连上行风铃
    const base = 74 + Math.min(6, (payload && payload.id) || 0);
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.22, freq: midi(base + iv), type: 'triangle', vol: 0.28, attack: 0.004 });
    });
  },
  combo(ctx, out, t0, payload) { // 连击：更高音域短琶音
    const base = 81 + Math.min(4, (payload && payload.combo) || 1);
    [0, 3, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.05, dur: 0.14, freq: midi(base + iv), type: 'square', vol: 0.22, attack: 0.003 });
    });
  },
  backtrack(ctx, out, t0) { // 撤销：短下滑
    tone(ctx, out, { t0, dur: 0.1, freq: 700, freqEnd: 420, type: 'triangle', vol: 0.26, attack: 0.003 });
  },
  hint(ctx, out, t0) { // 提示：高亮 ping
    tone(ctx, out, { t0, dur: 0.18, freq: 1800, type: 'sine', vol: 0.26, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.14, freq: 2400, type: 'sine', vol: 0.2, attack: 0.004 });
  },
  win(ctx, out, t0) { // 胜利：五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：闷 thud + 噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 130, freqEnd: 60, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  drawStart: 'drawStart',
  cellFill: 'cellFill',
  pairComplete: 'pairComplete',
  combo: 'combo',
  backtrack: 'backtrack',
  hint: 'hint',
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

// ---- BGM 一个循环的编排（8 小节，t0 起始，采样精确、无缝） ----
function kick(ctx, out, { t0 }) {
  return tone(ctx, out, { t0, dur: 0.16, freq: 150, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.003 });
}
function hat(ctx, out, { t0, vol = 0.12 }) {
  return noise(ctx, out, { t0, dur: 0.03, vol, type: 'highpass', freq: 7000, q: 1 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.42, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.4 });
}
function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.22, freq: midi(midiNote), type: 'square', vol: 0.11, attack: 0.004, release: 0.2 });
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
      push(kick(ctx, bus, { t0: bt }));
      push(hat(ctx, bus, { t0: bt + BEAT / 2, vol: 0.1 }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
    }
    // 八分音符琶音
    for (let i = 0; i < 8; i += 1) {
      const n = chord.arp[i % chord.arp.length];
      push(arpNote(ctx, bus, { t0: barT + i * (BEAT / 2), midiNote: n }));
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
