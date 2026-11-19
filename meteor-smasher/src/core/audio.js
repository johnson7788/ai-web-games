// METEOR SMASHER · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机，BPM 120，A 小调 arp 循环 C–Am–F–G 走向（每和弦 2 小节，8 小节无缝循环）。
// 四层编制：kick=短噪声低频、贝斯=三角波根音、arp=方波 16 分音符、pad=双音锯齿轻 LPF。
// SFX：slam/floor/killMeteor/core/thruster/pad/spike/combo/levelUp/gameOver/star/uiClick，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 一拍 ≈0.5s
const BAR = BEAT * 4;             // 一小节 ≈2.0s
const BGM_BARS = 8;               // 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 ≈16.0s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-16);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// arp 16 分音符音高（每小节 16 个半拍），跨 8 小节循环
const ARP_PATTERN = [57, 60, 64, 60, 69, 64, 60, 64, 57, 60, 64, 60, 69, 64, 60, 64];

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
    const rel = 0.25;
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
  slam(ctx, out, t0) { // 快速下坠 whoosh
    noise(ctx, out, { t0, dur: 0.28, vol: 0.4, type: 'bandpass', freq: 2600, freqEnd: 500, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.22, freq: 300, freqEnd: 90, type: 'sine', vol: 0.3, attack: 0.004 });
  },
  floor(ctx, out, t0) { // 甲板闷响
    tone(ctx, out, { t0, dur: 0.18, freq: 150, freqEnd: 70, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.24, type: 'lowpass', freq: 600, q: 1 });
  },
  killMeteor(ctx, out, t0) { // 陨石碎裂
    noise(ctx, out, { t0, dur: 0.3, vol: 0.5, type: 'lowpass', freq: 3600, freqEnd: 300, q: 1.1 });
    tone(ctx, out, { t0, dur: 0.16, freq: 220, freqEnd: 90, type: 'square', vol: 0.22, attack: 0.004 });
  },
  core(ctx, out, t0) { // 能量核心拾取（上行叮）
    [60, 67, 72].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.18, freq: midi(m), type: 'sine', vol: 0.3, attack: 0.003 });
    });
  },
  thruster(ctx, out, t0) { // 推进器点火（上行扫频）
    tone(ctx, out, { t0, dur: 0.4, freq: 160, freqEnd: 640, type: 'sawtooth', vol: 0.28, attack: 0.01 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.26, type: 'bandpass', freq: 1200, freqEnd: 3200, q: 2 });
  },
  pad(ctx, out, t0) { // 修复台双音
    tone(ctx, out, { t0, dur: 0.12, freq: 520, type: 'triangle', vol: 0.3, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.09, dur: 0.14, freq: 660, type: 'triangle', vol: 0.3, attack: 0.004 });
  },
  spike(ctx, out, t0) { // 尖刺警报（不协和）
    tone(ctx, out, { t0, dur: 0.22, freq: 180, freqEnd: 120, type: 'square', vol: 0.3, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.03, dur: 0.22, freq: 175, freqEnd: 118, type: 'square', vol: 0.26, attack: 0.004 });
  },
  combo(ctx, out, t0, payload) { // 连击 blip，音高随层数升
    const n = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const m = 72 + Math.min(Math.max(0, n - 1), 7);
    tone(ctx, out, { t0, dur: 0.1, freq: midi(m), type: 'sine', vol: 0.3, attack: 0.002 });
  },
  levelUp(ctx, out, t0) { // 升级 arp
    [60, 64, 67, 72].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'square', vol: 0.22, attack: 0.003 });
    });
  },
  gameOver(ctx, out, t0) { // 坠落闷音
    tone(ctx, out, { t0, dur: 0.5, freq: 140, freqEnd: 50, type: 'sine', vol: 0.5, attack: 0.006 });
    noise(ctx, out, { t0, dur: 0.24, vol: 0.26, type: 'lowpass', freq: 500, q: 1 });
  },
  star(ctx, out, t0) { // 星级 jingle C-E-G
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  uiClick(ctx, out, t0) { // 按钮 click
    tone(ctx, out, { t0, dur: 0.05, freq: 900, type: 'square', vol: 0.2, attack: 0.002 });
  },
};

// 把事件名映射到 SFX
const SFX_EVENT_MAP = {
  slam: 'slam',
  floor: 'floor',
  killMeteor: 'killMeteor',
  core: 'core',
  thruster: 'thruster',
  pad: 'pad',
  spike: 'spike',
  combo: 'combo',
  levelUp: 'levelUp',
  gameOver: 'gameOver',
  star: 'star',
  uiClick: 'uiClick',
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
  return noise(ctx, out, { t0, dur: 0.08, vol, type: 'lowpass', freq: 900, freqEnd: 120, q: 1 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.22, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.22 });
}

function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.09, freq: midi(midiNote), type: 'square', vol: 0.11, attack: 0.002 });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const barT = t0 + bar * BAR;
    // 每拍 kick + 贝斯
    for (let b = 0; b < 4; b += 1) {
      push(kick(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.5 : 0.34 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    // arp 16 分音符
    for (let s = 0; s < 16; s += 1) {
      push(arpNote(ctx, bus, { t0: barT + s * BEAT * 0.25, midiNote: ARP_PATTERN[s % ARP_PATTERN.length] }));
    }
    // 每 2 小节 pad
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
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
    p.setValueAtTime(DUCK_GAIN, t + 2.6);
    p.linearRampToValueAtTime(1, t + 2.8);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'gameOver') duckBgm();
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
