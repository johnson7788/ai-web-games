// MEMORY TRIP MATCH · 程序化音频（纯 WebAudio，零音频文件零外链）。
// BGM：霓虹旅行风，BPM 120，Am–F–C–G 进行，4 小节无缝循环（≈8s）。
// 低层合成对 AudioContext / OfflineAudioContext 通用，供 tools/audio-check.mjs 离屏复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2.0s
const BGM_BARS = 4;               // 4 小节
const BGM_LOOP = BAR * BGM_BARS;  // 8.0s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-9);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（根音 MIDI + 琶音音级）
const CHORDS = [
  { root: 45, arp: [57, 60, 64, 69] }, // Am
  { root: 41, arp: [53, 57, 60, 65] }, // F
  { root: 48, arp: [60, 64, 67, 72] }, // C
  { root: 43, arp: [55, 59, 62, 67] }, // G
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

const SFX = {
  flip(ctx, out, t0) { // 翻牌：清脆 click
    tone(ctx, out, { t0, dur: 0.07, freq: 1400, freqEnd: 900, type: 'sine', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.12, type: 'bandpass', freq: 2600, q: 5 });
  },
  match(ctx, out, t0, payload) { // 配对成功：三连上行，音高随 combo 升
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const shift = Math.min(Math.max(0, combo - 1), 7);
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.22, freq: midi(72 + shift + iv), type: 'triangle', vol: 0.28, attack: 0.004 });
    });
  },
  mismatch(ctx, out, t0) { // 翻错：闷 thud
    tone(ctx, out, { t0, dur: 0.28, freq: 160, freqEnd: 90, type: 'sine', vol: 0.4, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.14, vol: 0.18, type: 'lowpass', freq: 500, q: 1 });
  },
  flipback(ctx, out, t0) { // 盖回：短 blip 下行
    tone(ctx, out, { t0, dur: 0.1, freq: 700, freqEnd: 500, type: 'sine', vol: 0.25, attack: 0.003 });
  },
  rockCrack(ctx, out, t0) { // 敲裂岩石：噪声爆发 + 低频
    noise(ctx, out, { t0, dur: 0.18, vol: 0.4, type: 'lowpass', freq: 1800, freqEnd: 300, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.1, freq: 130, freqEnd: 70, type: 'sine', vol: 0.3, attack: 0.003 });
  },
  hint(ctx, out, t0) { // 提示：柔和风铃两连
    [76, 81].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.3, freq: midi(m), type: 'sine', vol: 0.24, attack: 0.004 });
    });
  },
  combo(ctx, out, t0, payload) { // 连击：短高音 sparkle
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 2;
    tone(ctx, out, { t0, dur: 0.12, freq: midi(84 + Math.min(combo, 6)), type: 'sine', vol: 0.22, attack: 0.003 });
  },
  win(ctx, out, t0) { // 胜利：五音 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：低频下滑
    tone(ctx, out, { t0, dur: 0.45, freq: 150, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.22, type: 'lowpass', freq: 500, q: 1 });
  },
};

const SFX_EVENT_MAP = {
  reveal: 'flip',
  match: 'match',
  mismatch: 'mismatch',
  flipback: 'flipback',
  rockCrack: 'rockCrack',
  hint: 'hint',
  combo: 'combo',
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

// BGM：4 小节一个循环（贝斯根音 + 琶音 + 木鱼节奏）
export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % CHORDS.length];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(noise(ctx, bus, { t0: bt, dur: 0.04, vol: b === 0 ? 0.3 : 0.2, type: 'bandpass', freq: 2600, q: 5 }));
      push(tone(ctx, bus, { t0: bt, dur: 0.26, freq: midi(chord.root), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.26 }));
      push(tone(ctx, bus, { t0: bt, dur: 0.3, freq: midi(chord.arp[b]), type: 'sine', vol: 0.16, attack: 0.003, release: 0.3 }));
    }
  }
  return collect;
}

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
    p.setValueAtTime(DUCK_GAIN, t + 2.0);
    p.linearRampToValueAtTime(1, t + 2.2);
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
