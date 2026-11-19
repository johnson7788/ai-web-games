// Frenzy Racer · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：合成波风格，BPM 120，和弦进行 Am–F–C–G（每和弦 2 小节），8 小节无缝循环。
// 四层编制：鼓点=噪声底鼓/军鼓/踩镲、贝斯=方波根音八分、和弦垫=锯齿低通、琶音=正弦主音。
// SFX：switch/collect/miss/nearMiss/shield/shieldBreak/combo/win/lose/countdown，全部 ≤0.6s。
// 导出 createAudio()（实时）+ scheduleBgmLoop/scheduleSfx/常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2s
const BGM_BARS = 8;               // 4 和弦 × 2 小节
const BGM_LOOP = BAR * BGM_BARS;  // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=三音和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60, 64] }, // Am
  { root: 41, pad: [53, 57, 60] }, // F
  { root: 48, pad: [55, 60, 64] }, // C
  { root: 43, pad: [55, 59, 62] }, // G
];

// 琶音（B 段 4 小节）：[B段内小节, 十六分步, MIDI]
const ARP = [
  [0, 0, 69], [0, 2, 72], [0, 4, 76], [0, 6, 81],
  [1, 0, 65], [1, 2, 69], [1, 4, 72], [1, 6, 76],
  [2, 0, 67], [2, 2, 72], [2, 4, 76], [2, 6, 79],
  [3, 0, 71], [3, 2, 74], [3, 4, 78], [3, 6, 83],
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

function padNote(ctx, out, { t0, dur, freqs, vol = 0.13 }) {
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
  switch(ctx, out, t0) { // 换道 blip 短促
    tone(ctx, out, { t0, dur: 0.08, freq: 660, freqEnd: 880, type: 'square', vol: 0.22, attack: 0.002 });
  },
  collect(ctx, out, t0) { // 吃球上行叮
    tone(ctx, out, { t0, dur: 0.16, freq: 880, freqEnd: 1320, type: 'sine', vol: 0.34, attack: 0.003 });
  },
  combo(ctx, out, t0, payload) { // 连击更高音
    const n = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const f = 660 * Math.pow(1.06, Math.min(n, 8));
    tone(ctx, out, { t0, dur: 0.12, freq: f, type: 'triangle', vol: 0.3, attack: 0.002 });
  },
  miss(ctx, out, t0) { // 漏球下行弱音
    tone(ctx, out, { t0, dur: 0.18, freq: 420, freqEnd: 240, type: 'sine', vol: 0.22, attack: 0.004 });
  },
  nearMiss(ctx, out, t0) { // 擦肩 whoosh
    noise(ctx, out, { t0, dur: 0.22, vol: 0.6, type: 'bandpass', freq: 900, freqEnd: 2400, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.2, freq: 300, freqEnd: 900, type: 'sine', vol: 0.3, attack: 0.004 });
  },
  shield(ctx, out, t0) { // 护盾获得风铃
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.24, freq: midi(m), type: 'sine', vol: 0.26, attack: 0.003 });
    });
  },
  shieldBreak(ctx, out, t0) { // 护盾碎裂
    noise(ctx, out, { t0, dur: 0.3, vol: 0.4, type: 'highpass', freq: 2600, q: 1 });
    tone(ctx, out, { t0, dur: 0.2, freq: 190, freqEnd: 90, type: 'triangle', vol: 0.34, attack: 0.003 });
  },
  win(ctx, out, t0) { // 五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 撞车闷响 + 噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 50, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.25, vol: 0.3, type: 'lowpass', freq: 420, q: 1 });
  },
  countdown(ctx, out, t0) { // 最后 5s 每秒 beep
    tone(ctx, out, { t0, dur: 0.1, freq: 880, type: 'square', vol: 0.26, attack: 0.003 });
  },
};

// 事件名 → SFX（countdownTick 是门控事件，不放进 map，见 event()）
const SFX_EVENT_MAP = {
  switch: 'switch',
  collect: 'collect',
  combo: 'combo',
  miss: 'miss',
  nearMiss: 'nearMiss',
  shield: 'shield',
  shieldBreak: 'shieldBreak',
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

// ---- BGM 一个循环的编排（8 小节，t0 起始，采样精确、无缝）----
function kick(ctx, out, { t0 }) {
  return tone(ctx, out, { t0, dur: 0.12, freq: 150, freqEnd: 45, type: 'sine', vol: 0.5, attack: 0.002, release: 0.12 });
}
function snare(ctx, out, { t0 }) {
  return noise(ctx, out, { t0, dur: 0.12, vol: 0.3, type: 'bandpass', freq: 1800, q: 0.8 });
}
function hat(ctx, out, { t0 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol: 0.16, type: 'highpass', freq: 7000, q: 1 });
}
function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.22, freq: midi(midiNote), type: 'square', vol: 0.2, attack: 0.004, release: 0.22 });
}
function arp(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.14, freq: midi(midiNote), type: 'sine', vol: 0.16, attack: 0.002, release: 0.14 });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  const sixteenth = BEAT / 4;

  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    // 鼓点：每拍 kick，第 2/4 拍 snare，反拍 hat
    for (let b = 0; b < 4; b += 1) {
      push(kick(ctx, bus, { t0: barT + b * BEAT }));
      if (b === 1 || b === 3) push(snare(ctx, bus, { t0: barT + b * BEAT }));
      push(hat(ctx, bus, { t0: barT + b * BEAT + BEAT / 2 }));
    }
    // 贝斯八分
    for (let e = 0; e < 8; e += 1) {
      push(bassNote(ctx, bus, { t0: barT + e * BEAT / 2, midiNote: chord.root }));
    }
    // 和弦垫每 2 小节
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    // 琶音 B 段（后 4 小节）
    if (bar >= 4) {
      for (const [mBar, step, m] of ARP) {
        if (mBar === bar - 4) push(arp(ctx, bus, { t0: barT + step * sixteenth, midiNote: m }));
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
