// NEON SERPENT · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：合成波/复古街机风，BPM 100，A 小调进行 Am–F–C–G（每和弦 2 小节，共 8 小节无缝循环）。
// 四层编制：底鼓=正弦扫频闷击、踩镲=短噪声、贝斯=锯齿根音、和弦垫=双音锯齿轻 LPF、琶音主音=方波。
// SFX：flap/score/combo/hit/shield/life/star/fever/zone/die/bonus，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgm* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 100;
const BEAT = 60 / BPM;            // 一拍 ≈0.6s
const BAR = BEAT * 4;             // 一小节 ≈2.4s
const BGM_BARS = 8;               // Am-F-C-G ×2
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 ≈19.2s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// A 小调进行：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 33, pad: [57, 60] }, // Am
  { root: 29, pad: [53, 57] }, // F
  { root: 36, pad: [48, 52] }, // C
  { root: 31, pad: [55, 59] }, // G
];

// 琶音主音（每小节 4 个八分音符上行，A 自然小调：A C E G）
const ARP = [57, 60, 64, 67, 69, 72, 76, 79];

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
    osc.detune && (osc.detune.value = (oscs.length % 2 === 0 ? -6 : 6));
    lp.type = 'lowpass';
    lp.frequency.value = 1500;
    lp.Q.value = 0.6;
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
  flap(ctx, out, t0) { // 拍翼：短促上行 blip
    tone(ctx, out, { t0, dur: 0.09, freq: 320, freqEnd: 640, type: 'sine', vol: 0.4, attack: 0.002 });
  },
  score(ctx, out, t0) { // 过门：清脆 ping
    tone(ctx, out, { t0, dur: 0.08, freq: 880, type: 'square', vol: 0.22, attack: 0.002 });
    tone(ctx, out, { t0, dur: 0.14, freq: 1320, type: 'sine', vol: 0.18, attack: 0.002 });
  },
  combo(ctx, out, t0, payload) { // 连击：音高随 combo 升半音
    const c = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    tone(ctx, out, { t0, dur: 0.1, freq: midi(84 + Math.min(7, c)), type: 'triangle', vol: 0.24, attack: 0.002 });
  },
  hit(ctx, out, t0) { // 撞击：噪声爆发 + 低闷 thud
    noise(ctx, out, { t0, dur: 0.18, vol: 0.4, type: 'lowpass', freq: 1600, freqEnd: 240, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.2, freq: 150, freqEnd: 70, type: 'sine', vol: 0.4, attack: 0.003 });
  },
  shield(ctx, out, t0) { // 护盾：上行 shimmer
    tone(ctx, out, { t0, dur: 0.25, freq: 520, freqEnd: 1240, type: 'sine', vol: 0.28, attack: 0.006 });
  },
  life(ctx, out, t0) { // 加长：温暖双音
    tone(ctx, out, { t0, dur: 0.16, freq: 660, type: 'triangle', vol: 0.3, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.2, freq: 880, type: 'triangle', vol: 0.3, attack: 0.004 });
  },
  star(ctx, out, t0) { // 星星：高频 sparkle
    tone(ctx, out, { t0, dur: 0.12, freq: 1760, type: 'sine', vol: 0.24, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.12, freq: 2093, type: 'sine', vol: 0.2, attack: 0.002 });
  },
  fever(ctx, out, t0) { // 狂热：四音上行琶音
    [84, 88, 91, 96].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'square', vol: 0.2, attack: 0.003 });
    });
  },
  zone(ctx, out, t0) { // 进 zone：小号角
    [76, 80, 83].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.24, attack: 0.003 });
    });
  },
  die(ctx, out, t0) { // 坠落：下行 + 噪声
    tone(ctx, out, { t0, dur: 0.5, freq: 300, freqEnd: 60, type: 'sawtooth', vol: 0.3, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.26, type: 'lowpass', freq: 700, q: 1 });
  },
  bonus(ctx, out, t0) { // 满身吃心：金币叮
    tone(ctx, out, { t0, dur: 0.08, freq: 1047, type: 'square', vol: 0.2, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.14, freq: 1568, type: 'square', vol: 0.2, attack: 0.002 });
  },
};

// 事件名 → SFX（门控事件只放「真实会响」的映射；shieldOff/feverOff/lastHit/start 静音）
const SFX_EVENT_MAP = {
  flap: 'flap',
  score: 'score',
  combo: 'combo',
  hit: 'hit',
  shield: 'shield',
  life: 'life',
  star: 'star',
  fever: 'fever',
  zone: 'zone',
  die: 'die',
  bonus: 'bonus',
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
function kick(ctx, out, { t0, vol = 0.42 }) {
  return tone(ctx, out, { t0, dur: 0.14, freq: 150, freqEnd: 45, type: 'sine', vol, attack: 0.002, release: 0.14 });
}

function hat(ctx, out, { t0, vol = 0.14 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 6000, q: 1 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.26, freq: midi(midiNote), type: 'sawtooth', vol: 0.26, attack: 0.004, release: 0.26 });
}

function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.14, freq: midi(midiNote), type: 'square', vol: 0.12, attack: 0.002, release: 0.14 });
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
      push(kick(ctx, bus, { t0: bt, vol: b === 0 ? 0.44 : 0.34 }));
      push(hat(ctx, bus, { t0: bt + BEAT * 0.5 }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
      // 八分音符琶音
      push(arpNote(ctx, bus, { t0: bt, midiNote: ARP[(bar * 4 + b) % ARP.length] }));
      push(arpNote(ctx, bus, { t0: bt + BEAT * 0.5, midiNote: ARP[(bar * 4 + b + 2) % ARP.length] }));
    }
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
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.12);
    p.setValueAtTime(DUCK_GAIN, t + 1.8);
    p.linearRampToValueAtTime(1, t + 2.0);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'die') duckBgm();
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
