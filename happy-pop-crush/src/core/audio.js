// HAPPY POP CRUSH · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹街机 synthwave，BPM 120，A 小调进行 Am–F–C–G（每和弦 4 小节），16 小节无缝循环。
// 四层编制：鼓点=噪声木鱼、贝斯=三角波根音、和弦垫=双音锯齿轻 LPF、主音=正弦短衰减琶音。
// SFX：select/swap/swapBack/crush/special/rockBreak/combo/hammer/shuffle/win/lose，全部 ≤0.6s。
// 导出 createAudio()（实时），另导出 scheduleBgmLoop / scheduleSfx / 常量，供 audio-check 离屏复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2.0s
const BGM_BARS = 16;              // 4 和弦 × 4 小节
const BGM_LOOP = BAR * BGM_BARS;  // 32.0s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [55, 59] }, // G
];

// 琶音主音（每和弦 4 小节，取和弦音上行再下行）
const ARP = [0, 3, 7, 12];

// ---- 低层合成 ----
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
    lp.Q.value = 0.6;
    const att = 0.08;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + att);
    g.gain.setValueAtTime(vol, t0 + dur - 0.25);
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

// ---- SFX ----
const SFX = {
  select(ctx, out, t0) { // 高音点击
    tone(ctx, out, { t0, dur: 0.05, freq: 1500, freqEnd: 1900, type: 'sine', vol: 0.32, attack: 0.002 });
  },
  deselect(ctx, out, t0) { // 低软 tick
    tone(ctx, out, { t0, dur: 0.05, freq: 700, type: 'triangle', vol: 0.22, attack: 0.002 });
  },
  swap(ctx, out, t0) { // 快速滑动
    noise(ctx, out, { t0, dur: 0.14, vol: 0.5, type: 'bandpass', freq: 1200, freqEnd: 2600, q: 1.5 });
    tone(ctx, out, { t0, dur: 0.12, freq: 700, freqEnd: 1100, type: 'sine', vol: 0.22, attack: 0.003 });
  },
  swapBack(ctx, out, t0) { // 闷 thud
    tone(ctx, out, { t0, dur: 0.12, freq: 180, freqEnd: 110, type: 'triangle', vol: 0.34, attack: 0.003 });
  },
  crush(ctx, out, t0) { // 爆裂 pop
    tone(ctx, out, { t0, dur: 0.1, freq: 320, freqEnd: 620, type: 'square', vol: 0.24, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.08, vol: 0.28, type: 'highpass', freq: 1400, q: 1 });
  },
  special(ctx, out, t0) { // 闪光琶音
    [0, 4, 7, 12].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.22, freq: midi(72 + iv), type: 'sine', vol: 0.26, attack: 0.003 });
    });
  },
  rockBreak(ctx, out, t0) { // 石裂 crunch
    noise(ctx, out, { t0, dur: 0.28, vol: 0.42, type: 'lowpass', freq: 2600, freqEnd: 300, q: 1.1 });
    tone(ctx, out, { t0, dur: 0.14, freq: 140, freqEnd: 60, type: 'sine', vol: 0.3, attack: 0.004 });
  },
  combo(ctx, out, t0, payload) { // 连击上行 blip（音高随 combo 递增）
    const n = payload && typeof payload.combo === 'number' ? payload.combo : 2;
    const base = 76 + Math.min(12, (n - 2) * 2);
    tone(ctx, out, { t0, dur: 0.28, freq: midi(base), freqEnd: midi(base + 7), type: 'sine', vol: 0.3, attack: 0.003 });
  },
  hammer(ctx, out, t0) { // 重锤
    tone(ctx, out, { t0, dur: 0.2, freq: 120, freqEnd: 45, type: 'sine', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.16, vol: 0.34, type: 'lowpass', freq: 900, q: 1 });
  },
  shuffle(ctx, out, t0) { // 洗牌 swish
    noise(ctx, out, { t0, dur: 0.3, vol: 0.26, type: 'bandpass', freq: 900, freqEnd: 1800, q: 2 });
  },
  win(ctx, out, t0) { // 上行 jingle C-E-G-C-E
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 下行闷响
    [72, 67, 63, 60].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.22, freq: midi(m), type: 'sine', vol: 0.3, attack: 0.004 });
    });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.2, type: 'lowpass', freq: 500, q: 1 });
  },
};

// 事件名 → SFX（combo 有门控，单独处理，不进这里）
const SFX_EVENT_MAP = {
  select: 'select',
  deselect: 'deselect',
  swap: 'swap',
  swapBack: 'swapBack',
  crush: 'crush',
  special: 'special',
  rockBreak: 'rockBreak',
  hammer: 'hammer',
  shuffle: 'shuffle',
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

// ---- BGM ----
function woodblock(ctx, out, { t0, vol = 0.34 }) {
  return noise(ctx, out, { t0, dur: 0.05, vol, type: 'bandpass', freq: 2400, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.28, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.28 });
}

function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.16, freq: midi(midiNote), type: 'sine', vol: 0.16, attack: 0.003, release: 0.16 });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 4) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(woodblock(ctx, bus, { t0: bt, vol: b % 2 === 0 ? 0.36 : 0.2 }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root - 12 }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    // 琶音：每小节前两拍轻弹和弦音
    const arpBase = chord.pad[0];
    for (let step = 0; step < 4; step += 1) {
      const iv = ARP[step % ARP.length];
      push(arpNote(ctx, bus, { t0: barT + step * BEAT, midiNote: arpBase + iv }));
    }
  }
  return collect;
}

// ---- 实时入口 ----
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
    if (name === 'combo') {
      // 门控：只有 ≥2 连才发声（负例在 audio-check 里验证）
      if (!payload || !(payload.combo >= 2)) return;
      scheduleSfx(ctx, sfxBus, 'combo', payload, ctx.currentTime);
      return;
    }
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
