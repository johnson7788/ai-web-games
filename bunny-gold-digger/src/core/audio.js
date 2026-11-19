// Bunny Gold Digger · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹街机 BPM 128，E 小调进行 Em–C–G–D，四层：底鼓、贝斯、琶音、和弦垫。
// SFX：drop/hit/grab/combo/miss/rock/carrot/power/fever/win/lose，全部 ≤0.7s。
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 128;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-11);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { root: 40, pad: [52, 55, 59] }, // Em
  { root: 36, pad: [48, 52, 55] }, // C
  { root: 43, pad: [55, 59, 62] }, // G
  { root: 38, pad: [50, 54, 57] }, // D
];

const ARP = [64, 67, 71, 76, 71, 67, 64, 67];

function tone(ctx, out, { t0, dur, freq, freqEnd = null, type = 'sine', vol = 0.4, attack = 0.004, release = null }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const r = release == null ? dur : release;
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + r);
  osc.connect(g); g.connect(out);
  osc.start(t0); osc.stop(t0 + r + 0.02);
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
  const g = ctx.createGain(); g.gain.value = vol;
  src.connect(filter); filter.connect(g); g.connect(out);
  src.start(t0); src.stop(t0 + dur + 0.02);
}

function kick(ctx, out, t0) {
  tone(ctx, out, { t0, dur: 0.16, freq: 150, freqEnd: 48, type: 'sine', vol: 0.9, attack: 0.002 });
}
function hat(ctx, out, t0) {
  noise(ctx, out, { t0, dur: 0.04, vol: 0.12, type: 'highpass', freq: 8000, q: 0.8 });
}
function bass(ctx, out, t0, midiNote) {
  tone(ctx, out, { t0, dur: 0.24, freq: midi(midiNote), type: 'square', vol: 0.16, attack: 0.004, release: 0.22 });
}
function arp(ctx, out, t0, midiNote) {
  tone(ctx, out, { t0, dur: 0.1, freq: midi(midiNote), type: 'triangle', vol: 0.16, attack: 0.002, release: 0.09 });
}
function pad(ctx, out, t0, freqs, dur) {
  for (const f of freqs) {
    const osc = ctx.createOscillator();
    const lp = ctx.createBiquadFilter();
    const g = ctx.createGain();
    osc.type = 'sawtooth'; osc.frequency.value = midi(f);
    lp.type = 'lowpass'; lp.frequency.value = 1200; lp.Q.value = 0.6;
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(0.05, t0 + 0.05);
    g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(lp); lp.connect(g); g.connect(out);
    osc.start(t0); osc.stop(t0 + dur + 0.02);
  }
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (fn) => { if (collect) collect.push(fn); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const bt = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      const t = bt + b * BEAT;
      push(kick(ctx, bus, t));
      push(hat(ctx, bus, t + BEAT / 2));
      push(bass(ctx, bus, t, chord.root));
      push(arp(ctx, bus, t, ARP[(bar * 4 + b) % ARP.length]));
    }
    push(pad(ctx, bus, bt, chord.pad, BAR));
  }
  return collect;
}

const SFX = {
  drop(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.3, vol: 0.55, type: 'lowpass', freq: 2600, freqEnd: 400, q: 1 }); },
  hit(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.09, freq: 220, freqEnd: 120, type: 'triangle', vol: 0.5 }); },
  grab(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.12, freq: 1200, freqEnd: 900, type: 'sine', vol: 0.4 }); tone(ctx, out, { t0: t0 + 0.05, dur: 0.12, freq: 1500, type: 'sine', vol: 0.3 }); },
  combo(ctx, out, t0, p) { const n = p && p.combo ? Math.min(p.combo, 8) : 2; for (let i = 0; i < n; i += 1) tone(ctx, out, { t0: t0 + i * 0.05, dur: 0.12, freq: midi(72 + i), type: 'triangle', vol: 0.24 }); },
  miss(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.22, freq: 150, freqEnd: 90, type: 'sine', vol: 0.4 }); },
  rock(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.3, vol: 0.4, type: 'lowpass', freq: 900, freqEnd: 200, q: 1 }); tone(ctx, out, { t0, dur: 0.16, freq: 110, freqEnd: 60, type: 'square', vol: 0.22 }); },
  carrot(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.1, freq: 700, freqEnd: 1100, type: 'sine', vol: 0.32 }); tone(ctx, out, { t0: t0 + 0.08, dur: 0.12, freq: 1000, freqEnd: 1400, type: 'sine', vol: 0.28 }); },
  powerReady(ctx, out, t0) { [76, 79, 83].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'triangle', vol: 0.3 })); },
  fever(ctx, out, t0) { noise(ctx, out, { t0, dur: 0.5, vol: 0.3, type: 'bandpass', freq: 500, freqEnd: 4000, q: 1.5 }); tone(ctx, out, { t0, dur: 0.5, freq: 300, freqEnd: 900, type: 'sawtooth', vol: 0.2 }); },
  retrieve(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.08, freq: 500, freqEnd: 300, type: 'sine', vol: 0.2 }); },
  countdown(ctx, out, t0) { tone(ctx, out, { t0, dur: 0.09, freq: 880, type: 'square', vol: 0.22 }); },
  win(ctx, out, t0) { [72, 76, 79, 84, 88].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3 })); },
  lose(ctx, out, t0) { [60, 57, 55, 52].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.12, dur: 0.22, freq: midi(m), type: 'sine', vol: 0.3 })); },
};

const SFX_EVENT_MAP = {
  drop: 'drop',
  hit: 'hit',
  grab: 'grab',
  combo: 'combo',
  miss: 'miss',
  rockHit: 'rock',
  carrot: 'carrot',
  powerReady: 'powerReady',
  fever: 'fever',
  retrieve: 'retrieve',
  countdownTick: 'countdown',
  win: 'win',
  lose: 'lose',
};

export function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
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

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended' && ctx.resume) ctx.resume(); return true; }
    const c = factory();
    if (!c) return false;
    ctx = c;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    bgmBus = ctx.createGain(); bgmBus.gain.value = 1; bgmBus.connect(master);
    sfxBus = ctx.createGain(); sfxBus.gain.value = 1; sfxBus.connect(master);
    return true;
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    if (name === 'countdownTick') {
      const left = payload && payload.timeLeft;
      if (typeof left !== 'number' || left <= 0 || left > 5) return;
    }
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
  }

  function bgmTick() {
    if (!bgmPlaying || !ctx) return;
    const horizon = ctx.currentTime + 0.3;
    while (bgmNextTime < horizon) {
      scheduleBgmLoop(ctx, bgmBus, bgmNextTime, BGM_GAIN);
      bgmNextTime += BGM_LOOP;
    }
  }

  function startBgm() {
    if (!ensure() || bgmPlaying) return;
    bgmPlaying = true;
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
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) master.gain.value = muted ? 0 : 1;
    return muted;
  }

  function unlock() { return ensure(); }

  return { event, setMuted, startBgm, stopBgm, unlock };
}

export { BPM, BEAT, BAR, BGM_BARS, BGM_LOOP, SFX_EVENT_MAP };
