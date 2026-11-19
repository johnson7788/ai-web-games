// BEACH SOCCER 2V2 · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：沙滩合成流行，BPM 116，C 大调 C–Am–F–G 进行，8 小节无缝循环。
// SFX：kick/bounce/bumper/star/combo/mega/win/lose/settle，全部 ≤0.6s。
// 导出 createAudio()（实时）与 scheduleBgmLoop/scheduleSfx/SFX_EVENT_MAP，
// 供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 116;
const BEAT = 60 / BPM;            // ≈0.5172s
const BAR = BEAT * 4;             // ≈2.069s
const BGM_BARS = 8;               // 8 小节一个循环
const BGM_LOOP = BAR * BGM_BARS;  // ≈16.55s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-15);
const SFX_GAIN = dbToGain(-9);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

const CHORDS = [
  { root: 48, pad: [55, 60, 64] }, // C
  { root: 45, pad: [52, 57, 60] }, // Am
  { root: 41, pad: [48, 53, 57] }, // F
  { root: 43, pad: [50, 55, 59] }, // G
];

// 主音（第 5–8 小节进入）
const MELODY = [
  [4, 0.0, 76, 1.5], [4, 2.0, 79, 1.5], [4, 3.5, 84, 0.5],
  [5, 0.0, 79, 2.0], [5, 2.0, 76, 2.0],
  [6, 0.0, 72, 1.5], [6, 2.0, 76, 1.5], [6, 3.5, 79, 0.5],
  [7, 0.0, 81, 3.0], [7, 3.0, 79, 1.0],
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

const SFX = {
  kick(ctx, out, t0) { // 起脚：短噪声 whoosh + 低频砰
    noise(ctx, out, { t0, dur: 0.16, vol: 0.4, type: 'bandpass', freq: 1200, freqEnd: 300, q: 1 });
    tone(ctx, out, { t0, dur: 0.12, freq: 130, freqEnd: 60, type: 'sine', vol: 0.4, attack: 0.003 });
  },
  bounce(ctx, out, t0) { // 落地：闷 thud
    tone(ctx, out, { t0, dur: 0.09, freq: 160, freqEnd: 90, type: 'triangle', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.2, type: 'lowpass', freq: 500, q: 1 });
  },
  bumper(ctx, out, t0) { // 弹力垫：上滑 boing
    tone(ctx, out, { t0, dur: 0.28, freq: 260, freqEnd: 720, type: 'sine', vol: 0.5, attack: 0.003 });
  },
  star(ctx, out, t0) { // 吃星：双音上行
    tone(ctx, out, { t0, dur: 0.12, freq: 880, type: 'sine', vol: 0.3, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.08, dur: 0.2, freq: 1320, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  combo(ctx, out, t0, payload) { // 连击：三连音，音高随连击递增
    const c = Math.min(4, (payload && payload.combo) || 1);
    const base = 72 + c;
    [0, 4, 7].forEach((iv, i) => {
      tone(ctx, out, { t0: t0 + i * 0.06, dur: 0.16, freq: midi(base + iv), type: 'sine', vol: 0.26, attack: 0.002 });
    });
  },
  mega(ctx, out, t0) { // 能量球：锯齿上扫
    tone(ctx, out, { t0, dur: 0.3, freq: 200, freqEnd: 900, type: 'sawtooth', vol: 0.22, attack: 0.004 });
  },
  win(ctx, out, t0) { // 进球 jingle C-E-G-C-E
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.18, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：下行闷响
    tone(ctx, out, { t0, dur: 0.4, freq: 180, freqEnd: 70, type: 'sine', vol: 0.4, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.22, type: 'lowpass', freq: 500, q: 1 });
  },
  settle(ctx, out, t0) { // 停球：软 tick
    tone(ctx, out, { t0, dur: 0.06, freq: 520, type: 'sine', vol: 0.18, attack: 0.002 });
  },
};

const SFX_EVENT_MAP = {
  shot: 'kick',
  bounce: 'bounce',
  bumper: 'bumper',
  star: 'star',
  combo: 'combo',
  mega: 'mega',
  win: 'win',
  lose: 'lose',
  settle: 'settle',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

function woodblock(ctx, out, { t0, vol = 0.32 }) {
  return noise(ctx, out, { t0, dur: 0.045, vol, type: 'bandpass', freq: 2400, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.28, freq: midi(midiNote), type: 'triangle', vol: 0.3, attack: 0.006, release: 0.28 });
}

function marimba(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.18, attack: 0.003, release: Math.min(dur, 0.35) });
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
      push(woodblock(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.34 : 0.24 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 4) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar) push(marimba(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
      }
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
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.15);
    p.setValueAtTime(DUCK_GAIN, t + 2.5);
    p.linearRampToValueAtTime(1, t + 2.8);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    if (name === 'megaShot') {
      // 门控事件（不在 SFX_EVENT_MAP 里）：仅 mega 踢球才发声
      if (payload && payload.mega) scheduleSfx(ctx, sfxBus, 'mega', payload, ctx.currentTime);
      return;
    }
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
