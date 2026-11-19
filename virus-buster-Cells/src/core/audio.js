// 程序化音频（纯 WebAudio，零音频文件零外链）。
// BGM：霓虹合成波，BPM 120，Am–F–C–G 进行（每和弦 2 小节），8 小节无缝循环。
// 四层：贝斯三角波根音、和弦垫锯齿轻 LPF、琶音方波、底鼓噪声点。
// SFX：shot/hit/kill/coin/combo/wave/boss/crystal/powerup/shield/bomb/win/lose/revive/start/gameover，均 ≤0.6s。
const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;  // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// Am – F – C – G（根音 MIDI / 和弦垫）
const CHORDS = [
  { root: 45, pad: [52, 57, 60] }, // Am
  { root: 41, pad: [48, 53, 57] }, // F
  { root: 48, pad: [55, 60, 64] }, // C
  { root: 43, pad: [50, 55, 59] }, // G
];
const ARP = [0, 4, 7, 12]; // 琶音音程（半音）

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

const SFX = {
  shot(ctx, out, t0) { // 激光短脉冲
    tone(ctx, out, { t0, dur: 0.07, freq: 1500, freqEnd: 600, type: 'square', vol: 0.16, attack: 0.002 });
  },
  hit(ctx, out, t0) { // 命中 tick
    tone(ctx, out, { t0, dur: 0.05, freq: 880, type: 'sine', vol: 0.22, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.1, type: 'highpass', freq: 4000, q: 1 });
  },
  kill(ctx, out, t0) { // 击杀 pop
    tone(ctx, out, { t0, dur: 0.16, freq: 300, freqEnd: 120, type: 'triangle', vol: 0.34, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.12, vol: 0.2, type: 'lowpass', freq: 1200, q: 1 });
  },
  coin(ctx, out, t0) { // 金币 ding
    tone(ctx, out, { t0, dur: 0.12, freq: 1320, type: 'sine', vol: 0.2, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.05, dur: 0.14, freq: 1760, type: 'sine', vol: 0.14, attack: 0.002 });
  },
  combo(ctx, out, t0, p) { // 连击上行琶音
    const base = 72 + Math.min(7, ((p && p.combo) || 10) % 12);
    [0, 4, 7].forEach((iv, i) => tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.24, freq: midi(base + iv), type: 'sine', vol: 0.18, attack: 0.003 }));
  },
  wave(ctx, out, t0) { // 波次 whoosh
    noise(ctx, out, { t0, dur: 0.4, vol: 0.22, type: 'bandpass', freq: 400, freqEnd: 2200, q: 1 });
  },
  boss(ctx, out, t0) { // BOSS 警报
    tone(ctx, out, { t0, dur: 0.3, freq: 220, freqEnd: 110, type: 'sawtooth', vol: 0.22, attack: 0.004 });
    tone(ctx, out, { t0: t0 + 0.16, dur: 0.3, freq: 220, freqEnd: 110, type: 'sawtooth', vol: 0.18, attack: 0.004 });
  },
  crystal(ctx, out, t0) { // 晶体玻璃碎
    tone(ctx, out, { t0, dur: 0.12, freq: 2400, freqEnd: 1800, type: 'triangle', vol: 0.14, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.12, type: 'highpass', freq: 5000, q: 1 });
  },
  powerup(ctx, out, t0) { // 道具 sparkle
    [0, 5, 10].forEach((iv, i) => tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.2, freq: midi(76 + iv), type: 'sine', vol: 0.2, attack: 0.003 }));
  },
  shield(ctx, out, t0) { // 护盾吸收
    tone(ctx, out, { t0, dur: 0.2, freq: 500, freqEnd: 300, type: 'sine', vol: 0.26, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.15, vol: 0.16, type: 'bandpass', freq: 900, q: 2 });
  },
  bomb(ctx, out, t0) { // 清屏爆炸
    noise(ctx, out, { t0, dur: 0.5, vol: 0.5, type: 'lowpass', freq: 4000, freqEnd: 200, q: 1 });
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 40, type: 'sine', vol: 0.4, attack: 0.004 });
  },
  win(ctx, out, t0) { // 胜利五音 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.24, attack: 0.004 }));
  },
  lose(ctx, out, t0) { // 失败闷响
    tone(ctx, out, { t0, dur: 0.45, freq: 130, freqEnd: 50, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.22, vol: 0.24, type: 'lowpass', freq: 500, q: 1 });
  },
  revive(ctx, out, t0) { // 复活上扫
    tone(ctx, out, { t0, dur: 0.3, freq: 200, freqEnd: 800, type: 'sine', vol: 0.22, attack: 0.004 });
  },
  start(ctx, out, t0) { // 开局提示
    tone(ctx, out, { t0, dur: 0.14, freq: 660, type: 'triangle', vol: 0.2, attack: 0.003 });
    tone(ctx, out, { t0: t0 + 0.1, dur: 0.18, freq: 880, type: 'triangle', vol: 0.18, attack: 0.003 });
  },
  gameover(ctx, out, t0) { // 终结
    [67, 64, 60, 55].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.13, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.2, attack: 0.004 }));
  },
};

const SFX_EVENT_MAP = {
  shot: 'shot', hit: 'hit', kill: 'kill', coin: 'coin', combo: 'combo', wave: 'wave',
  boss_spawn: 'boss', crystal_spawn: 'crystal', powerup: 'powerup', shield: 'shield',
  bomb: 'bomb', win: 'win', lose: 'lose', revive: 'revive', start: 'start', gameover: 'gameover',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

function kick(ctx, out, t0, vol = 0.3) {
  tone(ctx, out, { t0, dur: 0.12, freq: 110, freqEnd: 40, type: 'sine', vol, attack: 0.002 });
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
      const bt = barT + b * BEAT;
      push(tone(ctx, bus, { t0: bt, dur: 0.3, freq: midi(chord.root), type: 'triangle', vol: 0.26, attack: 0.006, release: 0.28 }));
      if (b % 2 === 0) push([...noise(ctx, bus, { t0: bt, dur: 0.05, vol: 0.16, type: 'lowpass', freq: 300, q: 1 })]);
      // 琶音
      const arpFreq = midi(chord.root + 12 + ARP[b]);
      push(tone(ctx, bus, { t0: bt + BEAT * 0.5, dur: 0.1, freq: arpFreq, type: 'square', vol: 0.05, attack: 0.002 }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
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
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'win' || name === 'lose' || name === 'gameover') duckBgm();
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
