// DRIFT KING CN · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：合成器浪潮（synthwave），BPM 128，Am–F–C–G 每和弦 2 小节，共 8 小节无缝循环。
// 四层编制：底鼓=正弦下扫+噪声、贝斯=锯齿根音、和弦垫=双音锯齿低通、主音琶音=方波短音。
// SFX：star/bomb/shield/range/hit/hot/kill/pylon/hurt/death/combo/stage/click，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx / SFX_EVENT_MAP 与常量，供 tools/audio-check.mjs 复验。

const BPM = 128;
const BEAT = 60 / BPM;            // 一拍秒数 ≈0.46875
const BAR = BEAT * 4;             // 一小节 ≈1.875s
const BGM_BARS = 8;               // 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 = 15.0s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60] }, // Am
  { root: 41, pad: [53, 57] }, // F
  { root: 48, pad: [52, 55] }, // C
  { root: 43, pad: [50, 55] }, // G
];

// 琶音（16 分音符，每和弦 2 小节）：[和弦内拍, MIDI]
const ARP = [0, 3, 7, 12, 7, 3];

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

// ---- SFX 合成（每个都短 ≤0.6s）----

const SFX = {
  star(ctx, out, t0) { // 明亮双音上行 blip
    tone(ctx, out, { t0, dur: 0.12, freq: 1046, type: 'sine', vol: 0.4, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.07, dur: 0.16, freq: 1568, type: 'sine', vol: 0.36, attack: 0.002 });
  },
  bomb(ctx, out, t0) { // 低频轰鸣 + 噪声
    tone(ctx, out, { t0, dur: 0.4, freq: 140, freqEnd: 40, type: 'sine', vol: 0.6, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.4, type: 'lowpass', freq: 900, freqEnd: 120, q: 1 });
  },
  shield(ctx, out, t0) { // 上扫风铃
    tone(ctx, out, { t0, dur: 0.3, freq: 700, freqEnd: 1400, type: 'sine', vol: 0.32, attack: 0.004 });
  },
  range(ctx, out, t0) { // 磁吸 sweep up
    tone(ctx, out, { t0, dur: 0.28, freq: 500, freqEnd: 1800, type: 'triangle', vol: 0.3, attack: 0.003 });
  },
  hit(ctx, out, t0) { // 狂暴 whoosh
    noise(ctx, out, { t0, dur: 0.4, vol: 0.5, type: 'bandpass', freq: 400, freqEnd: 3600, q: 2 });
    tone(ctx, out, { t0, dur: 0.3, freq: 220, freqEnd: 660, type: 'sawtooth', vol: 0.22, attack: 0.004 });
  },
  hot(ctx, out, t0) { // 超狂暴 aggressive rise
    tone(ctx, out, { t0, dur: 0.5, freq: 300, freqEnd: 900, type: 'sawtooth', vol: 0.3, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.4, vol: 0.35, type: 'highpass', freq: 800, q: 1 });
  },
  kill(ctx, out, t0, payload) { // 撞击 punch（音高随连击微升）
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const base = 90 + Math.min(combo - 1, 8) * 12;
    tone(ctx, out, { t0, dur: 0.18, freq: midi(base), freqEnd: midi(base - 12), type: 'square', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.12, vol: 0.3, type: 'bandpass', freq: 1600, q: 4 });
  },
  pylon(ctx, out, t0) { // 玻璃碎裂 ping
    tone(ctx, out, { t0, dur: 0.2, freq: 2200, freqEnd: 900, type: 'sine', vol: 0.32, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.08, vol: 0.2, type: 'highpass', freq: 4000, q: 2 });
  },
  hurt(ctx, out, t0) { // 闷 thud
    tone(ctx, out, { t0, dur: 0.3, freq: 160, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.15, vol: 0.3, type: 'lowpass', freq: 600, q: 1 });
  },
  death(ctx, out, t0) { // 下坠 + 噪声
    tone(ctx, out, { t0, dur: 0.55, freq: 300, freqEnd: 40, type: 'sawtooth', vol: 0.4, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.4, vol: 0.35, type: 'lowpass', freq: 1200, freqEnd: 200, q: 1 });
  },
  combo(ctx, out, t0, payload) { // 连击 tick（音高随连击上升）
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 2;
    const base = 70 + Math.min(combo - 1, 10) * 2;
    tone(ctx, out, { t0, dur: 0.09, freq: midi(base), type: 'triangle', vol: 0.28, attack: 0.002 });
  },
  stage(ctx, out, t0) { // 阶段升级三音上行
    [72, 76, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.26, attack: 0.003 });
    });
  },
  click(ctx, out, t0) { // UI click
    tone(ctx, out, { t0, dur: 0.05, freq: 1200, type: 'sine', vol: 0.3, attack: 0.002 });
  },
};

const SFX_EVENT_MAP = {
  star: 'star',
  bomb: 'bomb',
  shield: 'shield',
  range: 'range',
  hit: 'hit',
  hot: 'hot',
  kill: 'kill',
  pylon: 'pylon',
  hurt: 'hurt',
  death: 'death',
  combo: 'combo',
  stage: 'stage',
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
  tone(ctx, out, { t0, dur: 0.22, freq: 150, freqEnd: 45, type: 'sine', vol, attack: 0.002 });
  return noise(ctx, out, { t0, dur: 0.05, vol: vol * 0.5, type: 'lowpass', freq: 2000, q: 1 });
}

function hat(ctx, out, { t0, vol = 0.12 }) {
  return noise(ctx, out, { t0, dur: 0.04, vol, type: 'highpass', freq: 6000, q: 1 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: BEAT * 0.9, freq: midi(midiNote), type: 'sawtooth', vol: 0.3, attack: 0.005, release: BEAT * 0.9 });
}

function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.12, freq: midi(midiNote), type: 'square', vol: 0.1, attack: 0.002 });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  const STEP16 = BEAT / 4;
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(kick(ctx, bus, { t0: bt }));
      push(bassNote(ctx, bus, { t0: bt, midiNote: chord.root }));
      push(hat(ctx, bus, { t0: bt + BEAT / 2 }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    for (let s = 0; s < 8; s += 1) {
      const iv = ARP[s % ARP.length];
      push(arpNote(ctx, bus, { t0: barT + s * STEP16, midiNote: chord.root + 12 + iv }));
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
    if (name === 'death') duckBgm();
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
