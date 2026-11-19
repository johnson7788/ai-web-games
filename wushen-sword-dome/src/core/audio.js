// WUSHEN SWORD DOME · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机合成波，BPM 120，A 小调循环 Am–F–C–G（每和弦 2 小节，共 8 小节无缝循环）。
// 四层编制：木鱼噪声点、三角波贝斯根音、锯齿低通和弦垫、正弦主音。
// SFX：launch/hit/crit/clash/skill/dodge/orb/win/lose/combo，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx / SFX_EVENT_MAP 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 120;
const BEAT = 60 / BPM;             // 0.5s
const BAR = BEAT * 4;              // 2s
const BGM_BARS = 8;                // 8 小节
const BGM_LOOP = BAR * BGM_BARS;   // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A 小调进行：root=贝斯根音(MIDI)，pad=和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [55, 60] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// 主音（后 4 小节进入）：[小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [4, 0.0, 76, 1.5], [4, 2.0, 72, 1.5], [4, 3.5, 69, 0.5],
  [5, 0.0, 72, 2.0], [5, 2.0, 74, 2.0],
  [6, 0.0, 76, 1.5], [6, 2.0, 79, 1.5], [6, 3.5, 81, 0.5],
  [7, 0.0, 79, 3.0], [7, 3.0, 76, 1.0],
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

// ---- SFX 合成（每个 ≤0.6s）----

const SFX = {
  launch(ctx, out, t0) { // 刀刃破空：噪声扫频 + 上行音
    noise(ctx, out, { t0, dur: 0.28, vol: 0.4, type: 'bandpass', freq: 800, freqEnd: 3200, q: 1.6 });
    tone(ctx, out, { t0, dur: 0.2, freq: 320, freqEnd: 720, type: 'sawtooth', vol: 0.16, attack: 0.005 });
  },
  hit(ctx, out, t0) { // 命中闷响
    tone(ctx, out, { t0, dur: 0.16, freq: 180, freqEnd: 90, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.3, type: 'lowpass', freq: 900, q: 1 });
  },
  crit(ctx, out, t0) { // 暴击更亮
    tone(ctx, out, { t0, dur: 0.2, freq: 320, freqEnd: 120, type: 'square', vol: 0.34, attack: 0.003 });
    tone(ctx, out, { t0, dur: 0.12, freq: 1400, freqEnd: 700, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  clash(ctx, out, t0) { // 兵器相撞金属感
    noise(ctx, out, { t0, dur: 0.22, vol: 0.42, type: 'highpass', freq: 1800, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.18, freq: 660, freqEnd: 220, type: 'triangle', vol: 0.3, attack: 0.003 });
  },
  skill(ctx, out, t0) { // 技能强力扫频
    noise(ctx, out, { t0, dur: 0.4, vol: 0.4, type: 'lowpass', freq: 200, freqEnd: 3400, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.4, freq: 110, freqEnd: 440, type: 'sawtooth', vol: 0.2, attack: 0.008 });
  },
  dodge(ctx, out, t0) { // 闪避快扫
    noise(ctx, out, { t0, dur: 0.3, vol: 0.55, type: 'bandpass', freq: 500, freqEnd: 3000, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.18, freq: 900, freqEnd: 300, type: 'sine', vol: 0.22, attack: 0.003 });
  },
  orb(ctx, out, t0) { // 拾取风铃三连
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.24, freq: midi(76 + iv), type: 'sine', vol: 0.26, attack: 0.004 });
    });
  },
  combo(ctx, out, t0) { // 连击短 blip，音高随连击数升
    const shift = Math.min(12, (arguments[3] || 0) * 2);
    tone(ctx, out, { t0, dur: 0.08, freq: midi(72 + shift), type: 'square', vol: 0.2, attack: 0.002 });
  },
  win(ctx, out, t0) { // 胜利上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败下行
    [67, 63, 58].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.24, freq: midi(m), type: 'sine', vol: 0.3, attack: 0.005 });
    });
    tone(ctx, out, { t0, dur: 0.38, freq: 120, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
  },
};

const SFX_EVENT_MAP = {
  launch: 'launch',
  enemyLaunch: 'launch',
  hit: 'hit',
  enemyHit: 'hit',
  crit: 'crit',
  clash: 'clash',
  skillCast: 'skill',
  enemySkill: 'skill',
  dodge: 'dodge',
  orbTaken: 'orb',
  orbSpawn: 'orb',
  roundWin: 'win',
  win: 'win',
  roundLose: 'lose',
  lose: 'lose',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  if (name === 'combo') fn(ctx, bus, t0, payload && payload.combo);
  else fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环的编排 ----

function woodblock(ctx, out, { t0, vol = 0.36 }) {
  return noise(ctx, out, { t0, dur: 0.045, vol, type: 'bandpass', freq: 2400, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.3, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.3 });
}

function pluck(ctx, out, { t0, midiNote, dur }) {
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
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.36 : 0.24 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 4) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar) push(pluck(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
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
    p.setValueAtTime(DUCK_GAIN, t + 2.6);
    p.linearRampToValueAtTime(1, t + 3.0);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) {
      scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    } else if (name === 'comboUp') {
      scheduleSfx(ctx, sfxBus, 'combo', payload, ctx.currentTime);
    }
    if (name === 'win' || name === 'lose' || name === 'roundWin' || name === 'roundLose') duckBgm();
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
