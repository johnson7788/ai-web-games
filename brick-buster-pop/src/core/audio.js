// BRICK BUSTER POP · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹合成器，BPM 120，A 小调进行 Am–F–C–G（每和弦 2 小节），8 小节无缝循环。
// 四层：底鼓=短噪声、贝斯=三角波八分音、和弦垫=锯齿轻 LPF、琶音=方波短音。
// SFX：fire/hit/break/rock/line/bomb/plus/scatter/win/lose/combo，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx / SFX_EVENT_MAP 与常量，供 tools/audio-check.mjs 离屏复验。

const BPM = 120;
const BEAT = 60 / BPM;            // 0.5s
const BAR = BEAT * 4;             // 2s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;  // 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（A 小调）：root=贝斯根音(MIDI)，pad=和弦垫双音，arp=琶音音高序列
const CHORDS = [
  { root: 45, pad: [57, 60], arp: [69, 72, 76, 81] }, // Am
  { root: 41, pad: [53, 57], arp: [65, 69, 72, 77] }, // F
  { root: 48, pad: [52, 55], arp: [64, 67, 72, 76] }, // C
  { root: 43, pad: [50, 55], arp: [62, 67, 71, 74] }, // G
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
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.06);
    g.gain.setValueAtTime(vol, t0 + dur - 0.2);
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
  fire(ctx, out, t0) { // 发射：短促激光 pew
    tone(ctx, out, { t0, dur: 0.14, freq: 1200, freqEnd: 420, type: 'square', vol: 0.3, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.06, vol: 0.12, type: 'highpass', freq: 900, q: 1 });
  },
  hit(ctx, out, t0) { // 命中：清脆 click
    tone(ctx, out, { t0, dur: 0.06, freq: 1900, type: 'sine', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.03, vol: 0.15, type: 'bandpass', freq: 2400, q: 6 });
  },
  break(ctx, out, t0) { // 破砖：爆裂 + 下坠音
    noise(ctx, out, { t0, dur: 0.22, vol: 0.4, type: 'lowpass', freq: 3200, freqEnd: 500, q: 1 });
    tone(ctx, out, { t0, dur: 0.16, freq: 520, freqEnd: 240, type: 'triangle', vol: 0.35, attack: 0.003 });
  },
  rock(ctx, out, t0) { // 撞岩石：闷 thud
    tone(ctx, out, { t0, dur: 0.09, freq: 160, freqEnd: 90, type: 'sine', vol: 0.4, attack: 0.002 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.18, type: 'lowpass', freq: 500, q: 1 });
  },
  line(ctx, out, t0) { // 激光：扫频
    tone(ctx, out, { t0, dur: 0.34, freq: 300, freqEnd: 2200, type: 'sawtooth', vol: 0.28, attack: 0.004 });
  },
  bomb(ctx, out, t0) { // 炸弹：大爆发
    noise(ctx, out, { t0, dur: 0.5, vol: 0.5, type: 'lowpass', freq: 2600, freqEnd: 120, q: 0.8 });
    tone(ctx, out, { t0, dur: 0.4, freq: 90, freqEnd: 40, type: 'sine', vol: 0.5, attack: 0.004 });
  },
  plus(ctx, out, t0) { // 加球：上行 blip
    tone(ctx, out, { t0, dur: 0.12, freq: 700, freqEnd: 1050, type: 'sine', vol: 0.35, attack: 0.003 });
  },
  scatter(ctx, out, t0) { // 散射：双 blip
    tone(ctx, out, { t0, dur: 0.09, freq: 900, type: 'square', vol: 0.28, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.09, dur: 0.09, freq: 1350, type: 'square', vol: 0.28, attack: 0.002 });
  },
  combo(ctx, out, t0, payload) { // 连击：音高随连击数上行（封顶 +7）
    const n = payload && typeof payload.combo === 'number' ? Math.min(payload.combo, 8) : 1;
    tone(ctx, out, { t0, dur: 0.08, freq: 660 * Math.pow(1.06, n), type: 'sine', vol: 0.24, attack: 0.002 });
  },
  win(ctx, out, t0) { // 胜利：上行五音
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  lose(ctx, out, t0) { // 失败：下坠闷响
    tone(ctx, out, { t0, dur: 0.42, freq: 130, freqEnd: 55, type: 'sine', vol: 0.55, attack: 0.005 });
    noise(ctx, out, { t0, dur: 0.2, vol: 0.28, type: 'lowpass', freq: 500, q: 1 });
  },
};

// 事件名 → SFX（launch 故意不映射：每颗球不单独发声，只整束 fire 一声）
const SFX_EVENT_MAP = {
  fire: 'fire',
  hit: 'hit',
  break: 'break',
  rockHit: 'rock',
  lineClear: 'line',
  bomb: 'bomb',
  plusBall: 'plus',
  scatter: 'scatter',
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

// ---- BGM 一个循环的编排（8 小节，t0 起始，采样精确、无缝）----
function kick(ctx, out, { t0, vol = 0.34 }) {
  return noise(ctx, out, { t0, dur: 0.06, vol, type: 'lowpass', freq: 150, q: 1 });
}
function bass(ctx, out, { t0, note }) {
  return tone(ctx, out, { t0, dur: 0.2, freq: midi(note), type: 'triangle', vol: 0.3, attack: 0.005, release: 0.2 });
}
function arp(ctx, out, { t0, note }) {
  return tone(ctx, out, { t0, dur: 0.1, freq: midi(note), type: 'square', vol: 0.14, attack: 0.002 });
}

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const chord = CHORDS[Math.floor(bar / 2) % 4];
    const barT = t0 + bar * BAR;
    for (let b = 0; b < 4; b += 1) {
      kick(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.34 : 0.26 });
      bass(ctx, bus, { t0: barT + b * BEAT, note: chord.root });
      bass(ctx, bus, { t0: barT + b * BEAT + BEAT / 2, note: chord.root });
      arp(ctx, bus, { t0: barT + b * BEAT + BEAT / 4, note: chord.arp[b % 4] });
    }
    if (bar % 2 === 0) padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad });
  }
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
    if (name === 'win' || name === 'lose') duckBgm();
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
