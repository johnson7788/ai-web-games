// Depth Diver · 程序化音频（纯 WebAudio，零音频文件零外链）
//
// BGM：深海氛围，BPM 92，e 小调进行 Em–C–G–D（每和弦 2 小节）。
// A 段 4 小节无主音 / B 段 4 小节主音（钟琴感正弦）进入，共 8 小节无缝循环（相位连续）。
// 四层编制：打击点=短噪声水泡、贝斯=低音正弦根音、和弦垫=双音锯齿轻 LPF、主音=发光钟琴。
// SFX：thrust/steer/sample/sampleStar/nearMiss/layerChange/oxygenLow/oxygenPickup/vent/chaser/crush/suffocate/win/sonar/dive，全部 ≤0.7s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 scheduleBgmLoop / scheduleSfx 与常量，供 tools/audio-check.mjs 离屏渲染复验。

const BPM = 92;
const BEAT = 60 / BPM;            // 一拍秒数 ≈0.652
const BAR = BEAT * 4;             // 一小节 ≈2.6087s
const BGM_BARS = 8;               // A 段 4 + B 段 4
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 ≈20.87s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 和弦进行（e 小调）：root=贝斯根音(MIDI)，pad=双音和弦垫(MIDI)
const CHORDS = [
  { root: 40, pad: [55, 59] }, // Em
  { root: 36, pad: [48, 52] }, // C
  { root: 43, pad: [55, 59] }, // G
  { root: 38, pad: [50, 54] }, // D
];

// 主音（B 段 4 小节）：[B段内小节, 拍, MIDI, 持续拍数]
const MELODY = [
  [0, 0.0, 76, 1.5], [0, 2.0, 79, 1.5], [0, 3.5, 83, 0.5],
  [1, 0.0, 79, 2.0], [1, 2.0, 76, 2.0],
  [2, 0.0, 71, 1.5], [2, 2.0, 76, 1.5], [2, 3.5, 79, 0.5],
  [3, 0.0, 81, 3.0], [3, 3.0, 79, 1.0],
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
    lp.frequency.value = 1200;
    lp.Q.value = 0.7;
    const att = 0.08;
    const rel = 0.3;
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

// ---- SFX 合成（每个都短 ≤0.7s）----

const SFX = {
  thrust(ctx, out, t0) { // 推进气泡：噪声上扫 + 低音嗡鸣
    noise(ctx, out, { t0, dur: 0.3, vol: 0.22, type: 'bandpass', freq: 400, freqEnd: 900, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.3, freq: 110, freqEnd: 150, type: 'sine', vol: 0.2, attack: 0.01 });
  },
  steer(ctx, out, t0) { // 水平微调：短促 tilt 扫频
    tone(ctx, out, { t0, dur: 0.12, freq: 500, freqEnd: 380, type: 'triangle', vol: 0.28, attack: 0.003 });
  },
  sample(ctx, out, t0) { // 采集：亮晶晶上行两音
    [72, 79].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.22, freq: midi(m), type: 'sine', vol: 0.3, attack: 0.004 });
    });
  },
  sampleStar(ctx, out, t0) { // 采满 3 颗：风铃三连音上行
    [72, 76, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.3, freq: midi(m), type: 'sine', vol: 0.26, attack: 0.004 });
    });
  },
  nearMiss(ctx, out, t0) { // 擦肩：急速 whoosh 下扫
    noise(ctx, out, { t0, dur: 0.22, vol: 0.32, type: 'bandpass', freq: 2400, freqEnd: 500, q: 1.0 });
  },
  layerChange(ctx, out, t0) { // 换层：声呐扫描 sweep
    tone(ctx, out, { t0, dur: 0.5, freq: 300, freqEnd: 1600, type: 'sine', vol: 0.24, attack: 0.02 });
  },
  oxygenLow(ctx, out, t0) { // 缺氧警报：双 beep
    [0, 0.16].forEach((d) => tone(ctx, out, { t0: t0 + d, dur: 0.12, freq: 880, type: 'square', vol: 0.22, attack: 0.003 }));
  },
  oxygenPickup(ctx, out, t0) { // 氧气罐：空气嘶声上扫
    noise(ctx, out, { t0, dur: 0.35, vol: 0.26, type: 'highpass', freq: 800, freqEnd: 2400, q: 0.7 });
  },
  vent(ctx, out, t0) { // 热泉：气泡柱咕噜
    noise(ctx, out, { t0, dur: 0.4, vol: 0.28, type: 'lowpass', freq: 500, freqEnd: 120, q: 1.2 });
    tone(ctx, out, { t0, dur: 0.3, freq: 90, freqEnd: 60, type: 'sine', vol: 0.18, attack: 0.01 });
  },
  chaser(ctx, out, t0) { // 追逐者：低沉威胁
    tone(ctx, out, { t0, dur: 0.5, freq: 70, freqEnd: 46, type: 'sawtooth', vol: 0.26, attack: 0.02 });
  },
  crush(ctx, out, t0) { // 撞毁：金属撞击 + 噪声爆发
    tone(ctx, out, { t0, dur: 0.4, freq: 120, freqEnd: 40, type: 'sine', vol: 0.55, attack: 0.004 });
    noise(ctx, out, { t0, dur: 0.3, vol: 0.4, type: 'lowpass', freq: 1400, freqEnd: 200, q: 1.0 });
  },
  suffocate(ctx, out, t0) { // 缺氧终结：泄气下扫
    noise(ctx, out, { t0, dur: 0.6, vol: 0.3, type: 'bandpass', freq: 1200, freqEnd: 200, q: 1.0 });
    tone(ctx, out, { t0, dur: 0.5, freq: 160, freqEnd: 60, type: 'sine', vol: 0.3, attack: 0.02 });
  },
  win(ctx, out, t0) { // 胜利：五音上行 jingle
    [72, 76, 79, 84, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.2, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.004 });
    });
  },
  sonar(ctx, out, t0) { // 声呐 ping（每层换层/心跳）
    tone(ctx, out, { t0, dur: 0.3, freq: 1200, freqEnd: 900, type: 'sine', vol: 0.14, attack: 0.004 });
  },
  dive(ctx, out, t0) { // 俯冲：whoosh 下冲
    noise(ctx, out, { t0, dur: 0.3, vol: 0.5, type: 'bandpass', freq: 500, freqEnd: 2400, q: 0.9 });
    tone(ctx, out, { t0, dur: 0.28, freq: 220, freqEnd: 90, type: 'sine', vol: 0.3, attack: 0.01 });
  },
};

// 把事件名映射到 SFX（ambient 心跳 depthTick/bubble 不发声）
const SFX_EVENT_MAP = {
  thrust: 'thrust',
  steer: 'steer',
  sample: 'sample',
  sampleStar: 'sampleStar',
  nearMiss: 'nearMiss',
  layerChange: 'layerChange',
  oxygenLow: 'oxygenLow',
  oxygenPickup: 'oxygenPickup',
  vent: 'vent',
  chaser: 'chaser',
  crush: 'crush',
  suffocate: 'suffocate',
  win: 'win',
  sonar: 'sonar',
  dive: 'dive',
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

function bubble(ctx, out, { t0, vol = 0.3 }) {
  return noise(ctx, out, { t0, dur: 0.05, vol, type: 'bandpass', freq: 1800, q: 5 });
}

function bassNote(ctx, out, { t0, midiNote }) {
  return tone(ctx, out, { t0, dur: 0.4, freq: midi(midiNote), type: 'sine', vol: 0.3, attack: 0.01, release: 0.4 });
}

function bell(ctx, out, { t0, midiNote, dur }) {
  return tone(ctx, out, { t0, dur, freq: midi(midiNote), type: 'sine', vol: 0.18, attack: 0.004, release: Math.min(dur, 0.5) });
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
      push(bubble(ctx, bus, { t0: barT + b * BEAT, vol: b === 0 ? 0.32 : 0.2 }));
      push(bassNote(ctx, bus, { t0: barT + b * BEAT, midiNote: chord.root }));
    }
    if (bar % 2 === 0) push(padNote(ctx, bus, { t0: barT, dur: BAR * 2, freqs: chord.pad }));
    if (bar >= 4) {
      for (const [mBar, beat, m, durBeats] of MELODY) {
        if (mBar === bar - 4) push(bell(ctx, bus, { t0: barT + beat * BEAT, midiNote: m, dur: durBeats * BEAT }));
      }
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
    if (sfx) {
      scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    } else if (name === 'oxygenLow') {
      scheduleSfx(ctx, sfxBus, 'oxygenLow', payload, ctx.currentTime);
    }
    if (name === 'win' || name === 'crush' || name === 'suffocate') duckBgm();
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
