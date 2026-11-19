// GET ON BUS 3D · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹合成浪潮 Am–F–C–G，BPM 112，16 小节无缝循环。
// SFX：go/pickup/dropoff/coin/nearMiss/shield/shieldBreak/turbo/win/crash，全部 ≤0.6s。

const BPM = 112;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 16;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音，pad=双音和弦垫
const CHORDS = [
  { root: 33, pad: [45, 48, 52] }, // Am
  { root: 29, pad: [41, 45, 48] }, // F
  { root: 36, pad: [48, 52, 55] }, // C
  { root: 31, pad: [43, 47, 50] }, // G
];

// 主音（B 段 8 小节）：[段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 76, 0.5], [0, 0.5, 79, 0.5], [0, 1.0, 81, 1.0], [0, 2.5, 79, 0.5], [0, 3.0, 76, 1.0],
  [1, 0.0, 72, 1.0], [1, 1.0, 74, 0.5], [1, 1.5, 76, 1.5], [1, 3.0, 72, 1.0],
  [2, 0.0, 76, 0.5], [2, 0.5, 79, 0.5], [2, 1.0, 81, 1.0], [2, 2.5, 84, 0.5], [2, 3.0, 81, 1.0],
  [3, 0.0, 79, 1.5], [3, 1.5, 76, 1.5], [3, 3.0, 74, 1.0],
  [4, 0.0, 76, 0.5], [4, 0.5, 79, 0.5], [4, 1.0, 81, 1.0], [4, 2.5, 79, 0.5], [4, 3.0, 76, 1.0],
  [5, 0.0, 72, 1.0], [5, 1.0, 69, 0.5], [5, 1.5, 72, 1.5], [5, 3.0, 74, 1.0],
  [6, 0.0, 76, 0.5], [6, 0.5, 79, 0.5], [6, 1.0, 81, 1.0], [6, 2.5, 84, 0.5], [6, 3.0, 86, 1.0],
  [7, 0.0, 88, 2.0], [7, 2.0, 84, 1.0], [7, 3.0, 79, 1.0],
];

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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.11 }) {
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
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.08);
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

// ---- SFX 合成（每个都短 ≤0.6s）----

const SFX = {
  go(ctx, out, t0) { // 出发双音上行
    tone(ctx, out, { t0, dur: 0.12, freq: 660, type: 'square', vol: 0.3, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.2, freq: 990, type: 'square', vol: 0.3, attack: 0.003 });
  },
  pickup(ctx, out, t0) { // 接客 chime 上行两音
    tone(ctx, out, { t0, dur: 0.18, freq: midi(76), type: 'triangle', vol: 0.3, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.24, freq: midi(81), type: 'triangle', vol: 0.3, attack: 0.003 });
  },
  dropoff(ctx, out, t0) { // 送客收银 cha-ching
    tone(ctx, out, { t0, dur: 0.12, freq: 2400, type: 'square', vol: 0.2, attack: 0.002 });
    noise(ctx, out, { t0: t0 + 0.02, dur: 0.18, vol: 0.22, type: 'highpass', freq: 3200, q: 1 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.22, freq: midi(88), type: 'triangle', vol: 0.28, attack: 0.003 });
  },
  coin(ctx, out, t0) { // 金币 blip
    tone(ctx, out, { t0, dur: 0.09, freq: 1500, freqEnd: 2100, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  nearMiss(ctx, out, t0) { // 擦肩 whoosh（噪声扫频 + 上行哨音，能量更足）
    noise(ctx, out, { t0, dur: 0.28, vol: 0.6, type: 'bandpass', freq: 800, freqEnd: 3600, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.24, freq: 500, freqEnd: 1200, type: 'sine', vol: 0.32, attack: 0.004 });
  },
  shield(ctx, out, t0) { // 护盾 shimmer
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.2, freq: midi(m), type: 'sine', vol: 0.24, attack: 0.003 });
    });
  },
  shieldBreak(ctx, out, t0) { // 护盾破碎
    noise(ctx, out, { t0, dur: 0.3, vol: 0.4, type: 'highpass', freq: 2400, freqEnd: 600, q: 1 });
  },
  turbo(ctx, out, t0) { // 氮气 zap
    tone(ctx, out, { t0, dur: 0.3, freq: 200, freqEnd: 1400, type: 'sawtooth', vol: 0.3, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.2, type: 'bandpass', freq: 900, freqEnd: 3000, q: 1.2 });
  },
  win(ctx, out, t0) { // 五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  crash(ctx, out, t0) { // 撞车闷响 + 噪声
    tone(ctx, out, { t0, dur: 0.42, freq: 120, freqEnd: 50, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.26, vol: 0.32, type: 'lowpass', freq: 500, q: 1 });
  },
};

// 事件名 → SFX 映射（负例门控事件不要放这里，避免被 SFX_EVENT_MAP 兜底）
const SFX_EVENT_MAP = {
  go: 'go',
  pickup: 'pickup',
  dropoff: 'dropoff',
  coin: 'coin',
  nearMiss: 'nearMiss',
  shield: 'shield',
  shieldBreak: 'shieldBreak',
  turbo: 'turbo',
  win: 'win',
  crash: 'crash',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环的编排 ----

function kick(ctx, out, { t0, vol = 0.34 }) {
  return tone(ctx, out, { t0, dur: 0.16, freq: 110, freqEnd: 45, type: 'sine', vol, attack: 0.002 });
}

function hat(ctx, out, { t0, vol = 0.1 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 7000, q: 1 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.24, freq: midi(midiNote), type: 'sawtooth', vol: 0.2, attack: 0.004, release: 0.2 });
}

function leadNote(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.12, attack: 0.004, release: Math.min(dur, 0.3) });
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
      push(hat(ctx, bus, { t0: bt + BEAT / 2 }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 8) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 8) push(leadNote(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
      }
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
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'win' || name === 'crash') duckBgm();
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
