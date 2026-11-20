// Spider Ball Web · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：霓虹街机合成波，BPM 120，Am–F–C–G 循环（每和弦 2 小节，共 8 小节）。
// 三层编制：贝斯=三角波根音、琶音=方波短音、和弦垫=双音锯齿轻 LPF。
// SFX：shoot/hit/break/bounce/powerup/laser/burst/catch/combo/win/lose，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop* / scheduleSfx* 与常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2s
const BGM_BARS = 8;               // 8 小节
const BGM_LOOP = BAR * BGM_BARS;  // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-22);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)，arp=琶音音集
const CHORDS = [
  { root: 45, pad: [52, 57], arp: [57, 60, 64, 69] }, // Am
  { root: 41, pad: [48, 53], arp: [53, 57, 60, 65] }, // F
  { root: 48, pad: [55, 60], arp: [60, 64, 67, 72] }, // C
  { root: 43, pad: [50, 55], arp: [55, 59, 62, 67] }, // G
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
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + att);
    g.gain.setValueAtTime(vol, t0 + dur - 0.25);
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
  shoot(ctx, out, t0) { // 发射：上扫 sine 快速上升
    tone(ctx, out, { t0, dur: 0.22, freq: 320, freqEnd: 900, type: 'sine', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.08, vol: 0.14, type: 'highpass', freq: 3000, q: 1 });
  },
  hit(ctx, out, t0) { // 命中数字砖：清脆 click
    tone(ctx, out, { t0, dur: 0.07, freq: 1600, freqEnd: 900, type: 'square', vol: 0.3, attack: 0.002 });
  },
  break(ctx, out, t0) { // 碎裂：短噪声爆发 + 低音
    noise(ctx, out, { t0, dur: 0.28, vol: 0.4, type: 'bandpass', freq: 2600, freqEnd: 500, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.18, freq: 220, freqEnd: 90, type: 'triangle', vol: 0.35, attack: 0.003 });
  },
  bounce(ctx, out, t0) { // 地面/墙壁反弹：闷 pop
    tone(ctx, out, { t0, dur: 0.1, freq: 240, freqEnd: 140, type: 'sine', vol: 0.32, attack: 0.002 });
  },
  powerup(ctx, out, t0) { // 道具拾取：三连音上行
    [72, 76, 79].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.16, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.003 }));
  },
  laser(ctx, out, t0) { // 激光清列：扫频 saw
    tone(ctx, out, { t0, dur: 0.4, freq: 200, freqEnd: 2600, type: 'sawtooth', vol: 0.22, attack: 0.006 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.18, type: 'bandpass', freq: 1800, q: 2 });
  },
  burst(ctx, out, t0) { // 紫爆：噪声爆发 + 低通扫
    noise(ctx, out, { t0, dur: 0.4, vol: 0.4, type: 'lowpass', freq: 3200, freqEnd: 350, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.2, freq: 130, freqEnd: 60, type: 'sine', vol: 0.4, attack: 0.004 });
  },
  catch(ctx, out, t0) { // 球回收：短 blip
    tone(ctx, out, { t0, dur: 0.09, freq: 1100, freqEnd: 700, type: 'sine', vol: 0.3, attack: 0.002 });
  },
  combo(ctx, out, t0, payload) { // 连击里程碑：音高随 combo 递增
    const c = payload && typeof payload.combo === 'number' ? payload.combo : 3;
    const shift = Math.min(Math.max(0, Math.floor(c / 3) - 1), 5);
    tone(ctx, out, { t0, dur: 0.12, freq: midi(84 + shift), type: 'triangle', vol: 0.3, attack: 0.002 });
  },
  win(ctx, out, t0) { // 胜利：五音 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 }));
  },
  lose(ctx, out, t0) { // 失败：闷 thud
    tone(ctx, out, { t0, dur: 0.42, freq: 120, freqEnd: 52, type: 'sine', vol: 0.5, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.22, vol: 0.24, type: 'lowpass', freq: 500, q: 1 });
  },
};

// 把事件名映射到 SFX（combo 走显式门控，不进映射表，避免负例门控失效）
const SFX_EVENT_MAP = {
  shot: 'shoot',
  brickHit: 'hit',
  brickBreak: 'break',
  floorBounce: 'bounce',
  wallBounce: 'bounce',
  rockHit: 'hit',
  powerUp: 'powerup',
  addBall: 'powerup',
  laser: 'laser',
  violet: 'burst',
  ballCaught: 'catch',
  levelWin: 'win',
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

// ---- BGM 一个循环的编排（8 小节，t0 起始，采样精确、无缝）----

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[bar % 4];
    const barT = t0 + bar * BAR;
    // 贝斯：每拍根音
    for (let b = 0; b < 4; b += 1) {
      push(tone(ctx, bus, { t0: barT + b * BEAT, dur: 0.28, freq: midi(chord.root), type: 'triangle', vol: 0.3, attack: 0.005, release: 0.28 }));
    }
    // 琶音：16 分音符扫弦（每拍 2 个音）
    for (let b = 0; b < 8; b += 1) {
      const note = chord.arp[b % chord.arp.length];
      push(tone(ctx, bus, { t0: barT + b * (BEAT / 2), dur: 0.14, freq: midi(note), type: 'square', vol: 0.12, attack: 0.003, release: 0.14 }));
    }
    // 和弦垫：每 2 小节一换
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
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.15);
    p.setValueAtTime(DUCK_GAIN, t + 2.6);
    p.linearRampToValueAtTime(1, t + 3.0);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    if (name === 'combo') {
      // 门控：只在连击里程碑（≥3）时出声
      if (payload && payload.combo >= 3) scheduleSfx(ctx, sfxBus, 'combo', payload, ctx.currentTime);
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
