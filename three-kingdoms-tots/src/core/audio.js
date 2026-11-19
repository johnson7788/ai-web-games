// Three Kingdoms Tots · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：行军鼓点 + 五声音阶主音（C-D-E-G-A），BPM 104，东方战争进行曲气质。
// 16 小节无缝循环。四层编制：鼓点=短噪声、贝斯=三角波根音、垫=双音锯齿轻 LPF、主音=马林巴感正弦。
// SFX：energy/spawn/hit/death/towerDown/keepHit/win/lose + 法术（fire/heal/frost/rock）+ 连击（combo），全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 104;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 16;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 五声音阶进行（C 宫）：根音贝斯 + 垫和弦
const CHORDS = [
  { root: 48, pad: [55, 60] }, // C
  { root: 45, pad: [52, 57] }, // A
  { root: 41, pad: [48, 55] }, // F
  { root: 43, pad: [50, 55] }, // G
];

// 主音（B 段 8 小节）：[段内小节, 拍, MIDI, 持续拍]
const MELODY = [
  [0, 0.0, 72, 1.0], [0, 1.0, 76, 1.0], [0, 2.0, 79, 1.0], [0, 3.0, 84, 1.0],
  [1, 0.0, 79, 2.0], [1, 2.0, 76, 1.5], [1, 3.5, 72, 0.5],
  [2, 0.0, 69, 1.0], [2, 1.0, 72, 1.0], [2, 2.0, 76, 1.0], [2, 3.0, 79, 1.0],
  [3, 0.0, 81, 2.5], [3, 2.5, 79, 1.0], [3, 3.5, 76, 0.5],
  [4, 0.0, 77, 1.0], [4, 1.0, 76, 1.0], [4, 2.0, 72, 1.0], [4, 3.0, 69, 1.0],
  [5, 0.0, 72, 2.0], [5, 2.0, 74, 2.0],
  [6, 0.0, 76, 1.5], [6, 1.5, 79, 1.5], [6, 3.0, 84, 1.0],
  [7, 0.0, 79, 2.0], [7, 2.0, 76, 1.0], [7, 3.0, 72, 1.0],
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
  energy(ctx, out, t0) { // 能量 +1：清脆上扬 blip
    tone(ctx, out, { t0, dur: 0.12, freq: 880, freqEnd: 1320, type: 'sine', vol: 0.32, attack: 0.003 });
  },
  spawn(ctx, out, t0) { // 出兵：短促号角
    tone(ctx, out, { t0, dur: 0.16, freq: 392, freqEnd: 523, type: 'triangle', vol: 0.4, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.06, vol: 0.14, type: 'bandpass', freq: 1200, q: 4 });
  },
  hit(ctx, out, t0) { // 命中：木鱼敲击
    noise(ctx, out, { t0, dur: 0.05, vol: 0.3, type: 'bandpass', freq: 1800, q: 6 });
    tone(ctx, out, { t0, dur: 0.05, freq: 320, type: 'square', vol: 0.2, attack: 0.002 });
  },
  death(ctx, out, t0) { // 单位阵亡：短促下沉
    tone(ctx, out, { t0, dur: 0.22, freq: 300, freqEnd: 120, type: 'sine', vol: 0.4, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.14, vol: 0.2, type: 'lowpass', freq: 900, q: 1 });
  },
  towerDown(ctx, out, t0) { // 箭塔倒塌：低沉轰响
    tone(ctx, out, { t0, dur: 0.4, freq: 140, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.006 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.35, type: 'lowpass', freq: 700, freqEnd: 200, q: 1.1 });
  },
  keepHit(ctx, out, t0) { // 主城受击：警钟
    tone(ctx, out, { t0, dur: 0.18, freq: 660, type: 'triangle', vol: 0.34, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.18, freq: 660, type: 'triangle', vol: 0.22, attack: 0.003 });
  },
  fire(ctx, out, t0) { // 火攻：噪声爆发扫频
    noise(ctx, out, { t0, dur: 0.4, vol: 0.5, type: 'lowpass', freq: 3200, freqEnd: 380, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.2, freq: 180, freqEnd: 80, type: 'sawtooth', vol: 0.2, attack: 0.004 });
  },
  heal(ctx, out, t0) { // 回春：三连上行风铃
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.3, freq: midi(m), type: 'sine', vol: 0.24, attack: 0.004 });
    });
  },
  frost(ctx, out, t0) { // 寒冰：高音冰晶
    [1200, 1500, 1800].forEach((f, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.16, freq: f, type: 'sine', vol: 0.2, attack: 0.003 });
    });
  },
  rock(ctx, out, t0) { // 岩壁：厚重闷响
    tone(ctx, out, { t0, dur: 0.3, freq: 120, freqEnd: 70, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.16, vol: 0.3, type: 'lowpass', freq: 500, q: 1 });
  },
  combo(ctx, out, t0) { // 连击：短促双音上行
    tone(ctx, out, { t0, dur: 0.14, freq: 1046, type: 'triangle', vol: 0.3, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.09, dur: 0.2, freq: 1568, type: 'triangle', vol: 0.3, attack: 0.003 });
  },
  win(ctx, out, t0) { // 胜利：五音上行 jingle C-E-G-A-C
    [72, 76, 79, 81, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：120Hz 闷 thud + 短噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
};

// 事件 → SFX 映射（combo/spell 有门控，不在此表，见 event()）
const SFX_EVENT_MAP = {
  energy: 'energy',
  spawn: 'spawn',
  hit: 'hit',
  death: 'death',
  towerDown: 'towerDown',
  keepHit: 'keepHit',
  win: 'win',
  lose: 'lose',
};

const SPELL_SFX = { fire: 'fire', heal: 'heal', frost: 'frost', rock: 'rock' };

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环的编排（16 小节，采样精确、无缝）----
function drum(ctx, out, { t0, vol = 0.4 }) {
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
      push(drum(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.4 : 0.26 }));
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
    const p = payload || {};
    if (name === 'combo') {
      // 门控：连击 ≥3 才出声（避免 1-2 连击刷屏）
      if (typeof p.combo === 'number' && p.combo >= 3) scheduleSfx(ctx, sfxBus, 'combo', p, ctx.currentTime);
      return;
    }
    if (name === 'spell') {
      const s = SPELL_SFX[p.cardId];
      if (s) scheduleSfx(ctx, sfxBus, s, p, ctx.currentTime);
      return;
    }
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, p, ctx.currentTime);
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
