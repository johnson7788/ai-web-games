// Ring Fusion · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹 synthwave，BPM 100，A 小调 Am–F–C–G（每和弦 1 小节，8 小节无缝循环）。
// 编制：鼓点=短噪声 + 正弦 kick、贝斯=锯齿 sub、和弦垫=失谐锯齿 LPF、琶音=方波 16 分。
// SFX：grab/place/placeFail/clear/combo/stone/burst/win/lose，全部 ≤0.6s。

const BPM = 100;
const BEAT = 60 / BPM;            // 0.6s
const BAR = BEAT * 4;             // 2.4s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;  // 19.2s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-22);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦（A 小调）：root=贝斯根音(MIDI)，pad=和弦垫(MIDI)，arp=琶音(MIDI)
const CHORDS = [
  { root: 45, pad: [57, 60, 64], arp: [69, 72, 76, 81] }, // Am
  { root: 41, pad: [53, 57, 60], arp: [65, 69, 72, 77] }, // F
  { root: 48, pad: [60, 64, 67], arp: [72, 76, 79, 84] }, // C
  { root: 43, pad: [55, 59, 62], arp: [67, 71, 74, 79] }, // G
];

function tone(ctx, out, { t0, dur, freq, freqEnd = null, type = 'sine', vol = 0.5, attack = 0.004, release = null }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const r = release == null ? dur : release;
  const t = Number.isFinite(t0) ? t0 : 0;
  const f = Number.isFinite(freq) ? freq : 440;
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, f), t);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, Number.isFinite(freqEnd) ? freqEnd : f), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + r);
  osc.connect(g);
  g.connect(out);
  osc.start(t);
  osc.stop(t + r + 0.02);
  return [osc];
}

function noise(ctx, out, { t0, dur, vol = 0.3, type = 'bandpass', freq = 2000, q = 1, freqEnd = null }) {
  const t = Number.isFinite(t0) ? t0 : 0;
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(Math.max(1, freq), t);
  if (freqEnd != null) filter.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t + dur);
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(t);
  src.stop(t + dur + 0.02);
  return [src];
}

function kick(ctx, out, t0) {
  return tone(ctx, out, { t0, dur: 0.12, freq: 150, freqEnd: 40, type: 'sine', vol: 0.4, attack: 0.002 });
}

function padNote(ctx, out, { t0, dur, freqs, vol = 0.12 }) {
  const oscs = [];
  for (const f of freqs) {
    for (const detune of [-4, 4]) {
      const osc = ctx.createOscillator();
      const lp = ctx.createBiquadFilter();
      const g = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.value = midi(f);
      osc.detune.value = detune;
      lp.type = 'lowpass';
      lp.frequency.value = 1500;
      lp.Q.value = 0.6;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(vol, t0 + 0.08);
      g.gain.setValueAtTime(vol, t0 + dur - 0.18);
      g.gain.linearRampToValueAtTime(0.0001, t0 + dur);
      osc.connect(lp);
      lp.connect(g);
      g.connect(out);
      osc.start(t0);
      osc.stop(t0 + dur + 0.02);
      oscs.push(osc);
    }
  }
  return oscs;
}

const SFX = {
  grab(ctx, out, t0) { // 拾取：轻巧 click
    tone(ctx, out, { t0, dur: 0.05, freq: 1600, type: 'sine', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.02, vol: 0.12, type: 'bandpass', freq: 2400, q: 6 });
  },
  place(ctx, out, t0) { // 放置：玻璃 clunk
    tone(ctx, out, { t0, dur: 0.14, freq: 240, freqEnd: 160, type: 'triangle', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.08, vol: 0.16, type: 'lowpass', freq: 700, q: 1 });
  },
  placeFail(ctx, out, t0) { // 放置失败：闷响
    tone(ctx, out, { t0, dur: 0.12, freq: 120, freqEnd: 80, type: 'square', vol: 0.24, attack: 0.003 });
  },
  clear(ctx, out, t0, payload) { // 消环：上行三连音，音高随连击递增
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 1;
    const base = 60 + Math.min(12, (combo - 1) * 2);
    [0, 5, 9].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.24, freq: midi(base + iv), type: 'sine', vol: 0.3, attack: 0.003 });
    });
  },
  combo(ctx, out, t0, payload) { // 连击提示
    const combo = payload && typeof payload.combo === 'number' ? payload.combo : 2;
    tone(ctx, out, { t0, dur: 0.18, freq: 520 + combo * 40, type: 'square', vol: 0.2, attack: 0.002 });
  },
  tick(ctx, out, t0) { // 倒计时 beep
    tone(ctx, out, { t0, dur: 0.12, freq: 880, type: 'square', vol: 0.45, attack: 0.003 });
  },
  stone(ctx, out, t0) { // 岩石震碎：噪声爆发 + 低通扫频
    noise(ctx, out, { t0, dur: 0.32, vol: 0.4, type: 'lowpass', freq: 3000, freqEnd: 300, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.14, freq: 160, freqEnd: 60, type: 'sine', vol: 0.28, attack: 0.004 });
  },
  burst(ctx, out, t0) { // 爆发：大闪 + 快速上行扫频
    noise(ctx, out, { t0, dur: 0.4, vol: 0.5, type: 'highpass', freq: 800, q: 0.8 });
    tone(ctx, out, { t0, dur: 0.3, freq: 300, freqEnd: 1600, type: 'sawtooth', vol: 0.22, attack: 0.004 });
  },
  win(ctx, out, t0) { // 胜利 jingle C-E-G-C-E
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.16, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：下行闷音
    [67, 63, 58, 55].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.1, dur: 0.16, freq: midi(m), type: 'sawtooth', vol: 0.2, attack: 0.004 });
    });
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 50, type: 'sine', vol: 0.5, attack: 0.005 });
  },
};

const SFX_EVENT_MAP = {
  grab: 'grab',
  place: 'place',
  placeFail: 'placeFail',
  clear: 'clear',
  combo: 'combo',
  stone: 'stone',
  burst: 'burst',
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

function arpNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.09, freq: midi(midiNote), type: 'square', vol: 0.12, attack: 0.002, release: 0.09 });
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
      push(kick(ctx, bus, { t0: barT + b * BEAT }));
      push(tone(ctx, bus, { t0: barT + b * BEAT, dur: 0.24, freq: midi(chord.root), type: 'sawtooth', vol: 0.2, attack: 0.004, release: 0.24 }));
      // 16 分琶音（每拍 4 个）
      for (let k = 0; k < 4; k += 1) {
        const note = chord.arp[(b + k) % chord.arp.length];
        push(arpNote(ctx, bus, { t0: barT + b * BEAT + k * (BEAT / 4), midiNote: note }));
      }
    }
    push(padNote(ctx, bus, { t0: barT, dur: BAR, freqs: chord.pad }));
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
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.15);
    p.setValueAtTime(DUCK_GAIN, t + 2.85);
    p.linearRampToValueAtTime(1, t + 3.0);
  }

  function event(name, payload) {
    try {
      if (!ensure() || muted) return;
      const sfx = SFX_EVENT_MAP[name];
      if (sfx) {
        scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
      } else if (name === 'countdownTick') {
        const left = payload && payload.timeLeft;
        if (typeof left === 'number' && left > 0 && left <= 5) {
          scheduleSfx(ctx, sfxBus, 'tick', payload, ctx.currentTime);
        }
      }
      if (name === 'win' || name === 'lose') duckBgm();
    } catch { /* 音频故障绝不影响游戏 */ }
  }

  function bgmTick() {
    try {
      if (!bgmPlaying || !ctx) return;
      const horizon = ctx.currentTime + 0.3;
      while (bgmNextTime < horizon) {
        scheduleBgmLoop(ctx, bgmBus, bgmNextTime, BGM_GAIN, bgmActive);
        bgmNextTime += BGM_LOOP;
      }
    } catch { /* 音频故障绝不影响游戏 */ }
  }

  function startBgm() {
    try {
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
    } catch { bgmPlaying = false; }
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
