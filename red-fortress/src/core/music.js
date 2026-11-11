// 赤色要塞 · 程序化 chiptune 音乐引擎（纯 WebAudio 合成，零音频文件）。
// 被 src/core/audio.js 引用；不直接依赖 DOM，可离线渲染用于验收。

export const MUSIC_SCENES = [
  'title', 'jungle', 'river', 'desert', 'fortress', 'boss',
  'clear', 'gameover', 'ending',
];

const midiToFreq = (m) => 440 * 2 ** ((m - 69) / 12);

// 每关一套：速度 / 根音 / 调式（音阶半音偏移）/ 波形 / 是否单次 / 小节数 / hat 密度
const SCENES = {
  title:    { bpm: 92,  root: 45, scale: [0, 2, 3, 5, 7, 8, 10],      quality: 'minor', bass: 'triangle', lead: 'square',  oneShot: false, bars: 16, hat: 0.5 },
  jungle:   { bpm: 128, root: 45, scale: [0, 2, 3, 5, 7, 8, 10],      quality: 'minor', bass: 'sawtooth', lead: 'square',  oneShot: false, bars: 16, hat: 1 },
  river:    { bpm: 116, root: 50, scale: [0, 2, 3, 5, 7, 9, 10],      quality: 'minor', bass: 'triangle', lead: 'square',  oneShot: false, bars: 16, hat: 0.6 },
  desert:   { bpm: 132, root: 45, scale: [0, 1, 3, 5, 7, 8, 10],      quality: 'minor', bass: 'sawtooth', lead: 'square',  oneShot: false, bars: 16, hat: 0.75 },
  fortress: { bpm: 140, root: 41, scale: [0, 1, 3, 4, 5, 7, 8, 10],   quality: 'dark',  bass: 'sawtooth', lead: 'square',  oneShot: false, bars: 16, hat: 1 },
  boss:     { bpm: 150, root: 41, scale: [0, 1, 3, 4, 6, 7, 9, 10],   quality: 'dark',  bass: 'sawtooth', lead: 'square',  oneShot: false, bars: 16, hat: 1 },
  clear:    { bpm: 132, root: 57, scale: [0, 2, 4, 5, 7, 9, 11],      quality: 'major', bass: 'triangle', lead: 'square',  oneShot: true,  bars: 8,  hat: 0.5 },
  gameover: { bpm: 80,  root: 45, scale: [0, 2, 3, 5, 7, 8, 10],      quality: 'minor', bass: 'triangle', lead: 'triangle', oneShot: true,  bars: 4,  hat: 0 },
  ending:   { bpm: 88,  root: 57, scale: [0, 2, 4, 5, 7, 9, 11],      quality: 'major', bass: 'triangle', lead: 'square',  oneShot: false, bars: 16, hat: 0.4 },
};

// 和弦进行（相对根音的半音偏移），A 段（前 8 小节）与 B 段（后 8 小节）不同。
const PROG = {
  minor: { A: [0, 5, 7, 3], B: [7, 5, 0, 0] },
  major: { A: [0, 5, 7, 5], B: [9, 5, 7, 0] },
  dark:  { A: [0, 1, 5, 7], B: [0, 1, 6, 7] },
};

// 和弦音（相对和弦根音的半音偏移）
const CHORD = {
  minor: [0, 3, 7],
  major: [0, 4, 7],
  dark:  [0, 1, 7],
};

const STEP = 16; // 每小节 16 步（16 分音符）

export function scoreFor(name) {
  const c = SCENES[name];
  if (!c) return null;
  const stepDur = 60 / c.bpm / 4;
  const bars = c.bars;
  const loopDur = bars * STEP * stepDur;
  const prog = PROG[c.quality];
  const chord = CHORD[c.quality];
  const events = [];

  for (let b = 0; b < bars; b++) {
    const section = b < bars / 2 ? 'A' : 'B';
    const chordRoot = c.root + prog[section][b % prog[section].length];
    const barStart = b * STEP * stepDur;

    // 贝斯：8 分音符，根音/五度交替，低八度
    for (let s = 0; s < STEP; s += 2) {
      const note = chordRoot + ((s / 2) % 2 === 0 ? 0 : 7) - 12;
      events.push({ t: barStart + s * stepDur, f: midiToFreq(note), dur: stepDur * 1.8, w: c.bass, g: 0.22, p: -0.15, k: 'tone' });
    }

    // 旋律：A 段 8 分琶音（稀疏），B 段 16 分琶音（密集）+ 高八度
    const density = section === 'A' ? 2 : 1;
    const octave = section === 'A' ? 0 : 12;
    for (let s = 0; s < STEP; s += density) {
      const note = chordRoot + chord[(s / density) % chord.length] + octave;
      events.push({ t: barStart + s * stepDur, f: midiToFreq(note), dur: stepDur * density * 0.9, w: c.lead, g: 0.15, p: 0.15, k: 'tone' });
    }

    // 鼓：底鼓 0/8，军鼓 4/12
    events.push({ t: barStart + 0 * stepDur, kind: 'kick', g: 0.4, p: 0 });
    events.push({ t: barStart + 8 * stepDur, kind: 'kick', g: 0.4, p: 0 });
    events.push({ t: barStart + 4 * stepDur, kind: 'snare', g: 0.22, p: 0 });
    events.push({ t: barStart + 12 * stepDur, kind: 'snare', g: 0.22, p: 0 });

    // hi-hat：8 分反拍；hat>=1 时再加 16 分碎拍
    for (let s = 2; s < STEP; s += 4) {
      if (c.hat > 0) events.push({ t: barStart + s * stepDur, kind: 'hat', g: 0.12 * c.hat, p: 0.25 });
    }
    if (c.hat >= 1) {
      for (let s = 1; s < STEP; s += 2) {
        events.push({ t: barStart + s * stepDur, kind: 'hat', g: 0.06, p: 0.2 });
      }
    }
  }

  return { loopDur, oneShot: !!c.oneShot, events };
}

// ---------- 合成原语（离线/实时共用） ----------

const noiseCache = new WeakMap();
function noiseBuffer(ctx) {
  let buf = noiseCache.get(ctx);
  if (!buf) {
    const len = Math.ceil(ctx.sampleRate * 2);
    buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    noiseCache.set(ctx, buf);
  }
  return buf;
}

function pan(ctx, p) {
  if (!p || typeof ctx.createStereoPanner !== 'function') return null;
  const n = ctx.createStereoPanner();
  n.pan.value = Math.max(-1, Math.min(1, p));
  return n;
}

function chain(ctx, out, p, node) {
  if (p) { node.connect(p); p.connect(out); } else node.connect(out);
}

export function tone(ctx, out, o) {
  const t0 = o.t0;
  const osc = ctx.createOscillator();
  osc.type = o.type || 'square';
  osc.frequency.setValueAtTime(o.freq, t0);
  if (o.glide) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.glide), t0 + (o.dur || 0.1));
  const g = ctx.createGain();
  const peak = Math.max(0.0001, o.gain ?? 0.3);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.004));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + (o.dur || 0.1));
  osc.connect(g);
  chain(ctx, out, pan(ctx, o.pan), g);
  osc.start(t0);
  osc.stop(t0 + (o.dur || 0.1) + 0.02);
}

export function noise(ctx, out, o) {
  const t0 = o.t0;
  const dur = o.dur || 0.1;
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  f.type = o.filterType || 'highpass';
  f.frequency.setValueAtTime(o.freq || 1000, t0);
  if (o.freqEnd) f.frequency.exponentialRampToValueAtTime(o.freqEnd, t0 + dur);
  f.Q.value = o.q || 1;
  const g = ctx.createGain();
  const peak = Math.max(0.0001, o.gain ?? 0.3);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(peak, t0 + (o.attack ?? 0.002));
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(f);
  f.connect(g);
  chain(ctx, out, pan(ctx, o.pan), g);
  src.start(t0, 0, dur + 0.05);
}

export function kick(ctx, out, t0, gain = 0.5) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(150, t0);
  osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.09);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.003);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.16);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + 0.18);
}

export function snare(ctx, out, t0, gain = 0.26) {
  noise(ctx, out, { t0, dur: 0.12, gain: gain * 0.9, filterType: 'bandpass', freq: 1800, q: 0.8 });
  tone(ctx, out, { t0, freq: 180, dur: 0.08, type: 'triangle', gain: gain * 0.6 });
}

export function hat(ctx, out, t0, gain = 0.12) {
  noise(ctx, out, { t0, dur: 0.04, gain, filterType: 'highpass', freq: 7000 });
}

// ---------- 调度 ----------

function scheduleOne(ctx, out, ev, start) {
  const t = start + ev.t;
  if (ev.k === 'tone') tone(ctx, out, { t0: t, freq: ev.f, dur: ev.dur, type: ev.w, gain: ev.g, pan: ev.p });
  else if (ev.kind === 'kick') kick(ctx, out, t, ev.g);
  else if (ev.kind === 'snare') snare(ctx, out, t, ev.g);
  else if (ev.kind === 'hat') hat(ctx, out, t, ev.g);
}

export function scheduleScore(ctx, out, score, start) {
  for (const ev of score.events) scheduleOne(ctx, out, ev, start);
}

// ---------- 实时播放器（lookahead 0.1s / 25ms 定时器 + 淡入淡出） ----------

export class Music {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.dest = dest;
    this.scene = 'none';
    this.voices = [];
  }

  get activeVoices() {
    return this.voices.filter((v) => !v.stopped && !v.done).length;
  }

  setScene(name) {
    if (name === this.scene) return;
    const prev = this.voices.find((v) => !v.stopped && !v.done);
    if (prev) this._stopVoice(prev, 0.3);
    this.scene = name;
    if (name === 'none' || !scoreFor(name)) return;
    this._startVoice(name);
  }

  _startVoice(name) {
    const score = scoreFor(name);
    const ctx = this.ctx;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(1, ctx.currentTime + 0.3);
    gain.connect(this.dest);
    const voice = {
      name,
      gain,
      stopped: false,
      done: false,
      timer: null,
      next: ctx.currentTime + 0.08,
      loopDur: score.loopDur,
      loops: score.oneShot ? 1 : Infinity,
    };
    const tick = () => {
      if (voice.stopped) return;
      const ahead = ctx.currentTime + 0.1;
      while (voice.loops > 0 && voice.next < ahead) {
        scheduleScore(ctx, gain, score, voice.next);
        voice.next += score.loopDur;
        voice.loops -= 1;
      }
      if (voice.loops <= 0) {
        const end = voice.next + 0.05;
        try {
          gain.gain.setValueAtTime(gain.gain.value, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.0001, end);
        } catch { /* 忽略 */ }
        const wait = Math.max(60, (end - ctx.currentTime) * 1000 + 100);
        setTimeout(() => this._stopVoice(voice, 0.05), wait);
      }
    };
    voice.timer = setInterval(tick, 25);
    tick();
    this.voices.push(voice);
  }

  _stopVoice(voice, fade) {
    if (voice.stopped) return;
    voice.stopped = true;
    clearInterval(voice.timer);
    const g = voice.gain;
    const t = this.ctx.currentTime;
    try {
      g.gain.cancelScheduledValues(t);
      g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + fade);
    } catch { /* 忽略 */ }
    const done = () => {
      voice.done = true;
      try { g.disconnect(); } catch { /* 忽略 */ }
      this.voices = this.voices.filter((v) => v !== voice || !v.done);
    };
    setTimeout(done, fade * 1000 + 80);
  }
}
