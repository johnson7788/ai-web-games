// ANT FIRE SQUAD · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹街机快节奏，BPM 116，C 大调 4 和弦循环（C–Am–F–G，每和弦 2 小节，共 8 小节无缝）。
// 四层：贝斯=三角波根音、和弦垫=双锯齿轻 LPF、琶音=正弦短衰减、打击=短噪声。
// SFX：drop/grab/deliver/combo/special/boost/egg/burst/spawnWasp/killWasp/forgeHit/stun/dropSoldier/win/lose。
// 导出 createAudio()（实时）+ scheduleBgmLoop / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 116;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;

export { BPM, BEAT, BAR, BGM_BARS, BGM_LOOP };

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-13);
const SFX_GAIN = dbToGain(-9);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦（C 大调）：root=贝斯根音，pad=和弦垫双音，arp=琶音音高集合
const CHORDS = [
  { root: 48, pad: [55, 60], arp: [60, 64, 67, 72] }, // C
  { root: 45, pad: [52, 57], arp: [57, 60, 64, 69] }, // Am
  { root: 41, pad: [48, 53], arp: [53, 57, 60, 65] }, // F
  { root: 43, pad: [50, 55], arp: [55, 59, 62, 67] }, // G
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
  return osc;
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
  return src;
}

export function scheduleBgmLoop(ctx, out, t0) {
  const step = BEAT / 2; // 八分音符
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % CHORDS.length];
    const bt = t0 + bar * BAR;

    // 贝斯（三角波根音，整小节）
    tone(ctx, out, { t0: bt, dur: BAR, freq: midi(chord.root - 12), type: 'triangle', vol: 0.5 * BGM_GAIN, attack: 0.01, release: BAR - 0.02 });

    // 和弦垫（双锯齿轻 LPF，整小节）
    for (const p of chord.pad) {
      tone(ctx, out, { t0: bt, dur: BAR, freq: midi(p), type: 'sawtooth', vol: 0.16 * BGM_GAIN, attack: 0.02, release: BAR - 0.02 });
    }

    // 琶音（正弦，八分音符）
    for (let i = 0; i < 8; i += 1) {
      const note = chord.arp[i % chord.arp.length];
      tone(ctx, out, { t0: bt + i * step, dur: step * 0.9, freq: midi(note), type: 'sine', vol: 0.28 * BGM_GAIN, attack: 0.004, release: step * 0.5 });
    }

    // 打击（每拍短噪声）
    for (let b = 0; b < 4; b += 1) {
      noise(ctx, out, { t0: bt + b * BEAT, dur: 0.03, vol: 0.5 * BGM_GAIN, type: 'highpass', freq: 5000, q: 0.8 });
    }
  }
}

// 事件名 → SFX 名（供 audio.event 与 audio-check 共同使用）
export const SFX_EVENT_MAP = {
  drop: 'drop',
  grab: 'grab',
  deliver: 'deliver',
  combo: 'combo',
  special: 'special',
  boost: 'boost',
  egg: 'egg',
  burst: 'burst',
  spawnWasp: 'spawnWasp',
  killWasp: 'killWasp',
  forgeHit: 'forgeHit',
  stun: 'stun',
  dropSoldier: 'dropSoldier',
  win: 'win',
  lose: 'lose',
};

export function scheduleSfx(ctx, out, name, payload = {}) {
  const g = SFX_GAIN;
  switch (name) {
    case 'drop':
      tone(ctx, out, { t0: 0, dur: 0.09, freq: 620, freqEnd: 880, type: 'sine', vol: 0.5 * g });
      break;
    case 'grab':
      tone(ctx, out, { t0: 0, dur: 0.06, freq: 500, type: 'triangle', vol: 0.45 * g });
      break;
    case 'deliver':
      tone(ctx, out, { t0: 0, dur: 0.16, freq: 784, type: 'sine', vol: 0.5 * g });
      tone(ctx, out, { t0: 0.05, dur: 0.18, freq: 988, type: 'sine', vol: 0.4 * g });
      break;
    case 'combo': {
      const base = 660 * Math.pow(1.12, Math.min(4, payload.combo || 2));
      tone(ctx, out, { t0: 0, dur: 0.08, freq: base, type: 'triangle', vol: 0.4 * g });
      tone(ctx, out, { t0: 0.05, dur: 0.08, freq: base * 1.25, type: 'triangle', vol: 0.4 * g });
      tone(ctx, out, { t0: 0.1, dur: 0.1, freq: base * 1.5, type: 'triangle', vol: 0.4 * g });
      break;
    }
    case 'special':
      noise(ctx, out, { t0: 0, dur: 0.25, vol: 0.4 * g, type: 'bandpass', freq: 800, freqEnd: 2400, q: 1.2 });
      break;
    case 'boost':
      tone(ctx, out, { t0: 0, dur: 0.2, freq: 300, freqEnd: 900, type: 'sawtooth', vol: 0.35 * g });
      break;
    case 'egg':
      tone(ctx, out, { t0: 0, dur: 0.2, freq: 1046, type: 'sine', vol: 0.4 * g });
      tone(ctx, out, { t0: 0.07, dur: 0.25, freq: 1568, type: 'sine', vol: 0.3 * g });
      break;
    case 'burst':
      for (let i = 0; i < 3; i += 1) tone(ctx, out, { t0: i * 0.03, dur: 0.08, freq: 500 + i * 220, type: 'sine', vol: 0.4 * g });
      break;
    case 'spawnWasp':
      tone(ctx, out, { t0: 0, dur: 0.3, freq: 180, freqEnd: 120, type: 'sawtooth', vol: 0.35 * g });
      break;
    case 'killWasp':
      noise(ctx, out, { t0: 0, dur: 0.28, vol: 0.5 * g, type: 'lowpass', freq: 1200, freqEnd: 200, q: 1 });
      tone(ctx, out, { t0: 0, dur: 0.2, freq: 220, freqEnd: 60, type: 'square', vol: 0.35 * g });
      break;
    case 'forgeHit':
      tone(ctx, out, { t0: 0, dur: 0.25, freq: 160, freqEnd: 70, type: 'triangle', vol: 0.5 * g });
      break;
    case 'stun':
      tone(ctx, out, { t0: 0, dur: 0.18, freq: 200, freqEnd: 140, type: 'square', vol: 0.35 * g });
      break;
    case 'dropSoldier':
      tone(ctx, out, { t0: 0, dur: 0.22, freq: 500, freqEnd: 1400, type: 'sine', vol: 0.4 * g });
      break;
    case 'win':
      [523, 659, 784, 1046].forEach((f, i) => tone(ctx, out, { t0: i * 0.09, dur: 0.2, freq: f, type: 'triangle', vol: 0.4 * g }));
      break;
    case 'lose':
      [392, 330, 262].forEach((f, i) => tone(ctx, out, { t0: i * 0.11, dur: 0.25, freq: f, type: 'sawtooth', vol: 0.35 * g }));
      break;
    default:
      break;
  }
}

export function createAudio(opts = {}) {
  const createContext = opts.createContext || (() => {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    return AC ? new AC() : null;
  });

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let bgmBus = null;
  let bgmTimer = null;
  let muted = false;
  const lastAt = new Map();

  function ensure() {
    if (!ctx) {
      ctx = createContext();
      if (!ctx) return null;
      master = ctx.createGain();
      master.gain.value = 1;
      master.connect(ctx.destination);
      bgmBus = ctx.createGain();
      bgmBus.gain.value = muted ? 0 : 0.8;
      bgmBus.connect(master);
      sfxBus = ctx.createGain();
      sfxBus.gain.value = muted ? 0 : 1;
      sfxBus.connect(master);
    }
    return ctx;
  }

  function now() {
    return (typeof performance !== 'undefined' ? performance.now() / 1000 : ctx.currentTime);
  }

  return {
    get ctx() { return ctx; },
    get muted() { return muted; },

    unlock() {
      const c = ensure();
      if (c && c.state === 'suspended' && c.resume) c.resume();
    },

    setMuted(m) {
      muted = !!m;
      if (bgmBus) bgmBus.gain.value = muted ? 0 : 0.8;
      if (sfxBus) sfxBus.gain.value = muted ? 0 : 1;
    },

    event(name, payload = {}) {
      const sfx = SFX_EVENT_MAP[name];
      if (!sfx) return;
      const c = ensure();
      if (!c) return;
      // 节流：同名 SFX 40ms 内只播一次，避免 drop 事件轰炸
      const last = lastAt.get(sfx) || -1;
      if (now() - last < 0.04) return;
      lastAt.set(sfx, now());
      scheduleSfx(c, sfxBus, sfx, payload);
    },

    startBgm() {
      const c = ensure();
      if (!c || bgmTimer != null) return;
      const loopAt = () => {
        if (!ctx) return;
        scheduleBgmLoop(ctx, bgmBus, ctx.currentTime + 0.02);
        bgmTimer = setTimeout(loopAt, BGM_LOOP * 1000 - 40);
      };
      loopAt();
    },

    stopBgm() {
      if (bgmTimer != null) { clearTimeout(bgmTimer); bgmTimer = null; }
    },
  };
}
