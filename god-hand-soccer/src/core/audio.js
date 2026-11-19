// GOD HAND SOCCER · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：Synthwave 轻快，BPM 116，和弦进行 Am–F–C–G（每和弦 2 小节），8 小节无缝循环。
// 四层编制：kick=短噪声低频、bass=锯齿根音、pad=双音锯齿轻 LPF、arp=方波/正弦琶音主音。
// SFX：flick/dodge/nearMiss/orb/combo/shield/slow/magnet/rock/wall/win/lose/levelStart，全部 ≤0.6s。
// 导出 createAudio()（实时）与 scheduleBgmLoop / scheduleSfx / 常量（供 tools/audio-check.mjs 离屏复验）。

const BPM = 116;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Am–F–C–G（Synthwave 常见小调进行）
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [60, 64] }, // C
  { root: 43, pad: [55, 59] }, // G
];

// 琶音（后 4 小节进入）：[小节内拍, MIDI, 持续拍数]
const ARP = [
  [0, 0.0, 72, 0.5], [0, 1.0, 76, 0.5], [0, 2.0, 79, 0.5], [0, 3.0, 84, 0.5],
  [1, 0.0, 76, 0.5], [1, 1.0, 79, 0.5], [1, 2.0, 84, 0.5], [1, 3.0, 88, 0.5],
  [2, 0.0, 72, 0.5], [2, 1.0, 77, 0.5], [2, 2.0, 81, 0.5], [2, 3.0, 84, 0.5],
  [3, 0.0, 79, 0.5], [3, 1.0, 83, 0.5], [3, 2.0, 86, 0.5], [3, 3.0, 91, 0.5],
];

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

// ---------- SFX 合成（均 ≤0.6s） ----------
const SFX = {
  flick(ctx, out, t0) { // 快速 blip（神手拨球）
    tone(ctx, out, { t0, dur: 0.07, freq: 660, freqEnd: 990, type: 'square', vol: 0.22, attack: 0.002 });
  },
  dodge(ctx, out, t0) { // 谁失声（躲过屏障）
    noise(ctx, out, { t0, dur: 0.22, vol: 0.5, type: 'bandpass', freq: 1400, freqEnd: 500, q: 1.2 });
  },
  nearMiss(ctx, out, t0) { // 贴脸擦过（岩石）
    noise(ctx, out, { t0, dur: 0.18, vol: 0.34, type: 'highpass', freq: 900, freqEnd: 2000, q: 1.0 });
    tone(ctx, out, { t0, dur: 0.1, freq: 420, freqEnd: 720, type: 'sawtooth', vol: 0.16, attack: 0.003 });
  },
  orb(ctx, out, t0, payload) { // 晶片上行琶音（音高随连击）
    const combo = payload && payload.combo ? payload.combo : 1;
    const shift = Math.min(Math.max(0, combo - 1), 7);
    tone(ctx, out, { t0, dur: 0.16, freq: midi(79 + shift), type: 'sine', vol: 0.3, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.16, freq: midi(84 + shift), type: 'sine', vol: 0.22, attack: 0.002 });
  },
  combo(ctx, out, t0) { // 连击升级 jingle
    [76, 81, 88].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'triangle', vol: 0.26, attack: 0.003 }));
  },
  shield(ctx, out, t0) { // 护盾开启
    tone(ctx, out, { t0, dur: 0.3, freq: 520, freqEnd: 1040, type: 'triangle', vol: 0.28, attack: 0.004 });
  },
  slow(ctx, out, t0) { // 减速
    tone(ctx, out, { t0, dur: 0.4, freq: 300, freqEnd: 150, type: 'sine', vol: 0.3, attack: 0.006 });
  },
  magnet(ctx, out, t0) { // 磁吸
    tone(ctx, out, { t0, dur: 0.28, freq: 220, freqEnd: 660, type: 'sawtooth', vol: 0.2, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.2, freq: 330, freqEnd: 880, type: 'square', vol: 0.12, attack: 0.004 });
  },
  rock(ctx, out, t0) { // 岩石登场 rumble
    noise(ctx, out, { t0, dur: 0.3, vol: 0.7, type: 'lowpass', freq: 500, freqEnd: 120, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.25, freq: 90, freqEnd: 55, type: 'sine', vol: 0.4, attack: 0.004 });
  },
  wall(ctx, out, t0) { // 屏障刷出（轻但可闻）
    noise(ctx, out, { t0, dur: 0.08, vol: 0.5, type: 'bandpass', freq: 1800, q: 4 });
  },
  shieldBlock(ctx, out, t0) { // 护盾挡下撞击
    tone(ctx, out, { t0, dur: 0.16, freq: 880, freqEnd: 440, type: 'triangle', vol: 0.3, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.2, type: 'highpass', freq: 2000, q: 2 });
  },
  levelStart(ctx, out, t0) { // 开球哨
    tone(ctx, out, { t0, dur: 0.14, freq: 1245, type: 'square', vol: 0.2, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.16, dur: 0.2, freq: 1660, type: 'square', vol: 0.16, attack: 0.002 });
  },
  win(ctx, out, t0) { // 进球五音上行
    [72, 76, 79, 84, 88].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 }));
  },
  lose(ctx, out, t0) { // 被挡下闷 thud
    tone(ctx, out, { t0, dur: 0.4, freq: 130, freqEnd: 60, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
};

// 事件名 → SFX（combo 是门控事件，不在这里，见 event()）
const SFX_EVENT_MAP = {
  flick: 'flick',
  dodge: 'dodge',
  nearMiss: 'nearMiss',
  orb: 'orb',
  shield: 'shield',
  slow: 'slow',
  magnet: 'magnet',
  rock: 'rock',
  wall: 'wall',
  shieldBlock: 'shieldBlock',
  levelStart: 'levelStart',
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

// ---------- BGM 一个循环（8 小节，采样精确、无缝） ----------
function kick(ctx, out, { t0, vol = 0.4 }) {
  return noise(ctx, out, { t0, dur: 0.05, vol, type: 'lowpass', freq: 400, freqEnd: 90, q: 1 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.26, freq: midi(midiNote), type: 'sawtooth', vol: 0.24, attack: 0.005, release: 0.26 });
}

function arp(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'square', vol: 0.13, attack: 0.003, release: Math.min(dur, 0.2) });
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
      push(kick(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.4 : 0.3 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 4) {
      for (const [mBar, beat, m, durBeats] of ARP) {
        if (mBar === bar - 4) push(arp(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
      }
    }
  }
  return collect;
}

// ---------- 实时入口 ----------
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
    } else if (name === 'combo') {
      // 门控：连击 <2 不发声（负例由 audio-check 复验）
      const combo = payload && payload.combo;
      if (typeof combo === 'number' && combo >= 2) {
        scheduleSfx(ctx, sfxBus, 'combo', payload, ctx.currentTime);
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
