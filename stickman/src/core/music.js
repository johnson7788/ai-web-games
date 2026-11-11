// 程序化音乐引擎 —— 循环音序器 + 强度分层 + 场景淡入淡出。
// 零素材：全部音符由振荡器实时合成。由 audio.js 持有 AudioContext 并驱动。
import { MAPS } from '../../config/maps.js';

const midiFreq = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 分层归属：intensity 0 = base（pad/bass 之类的地基），0.5 = mid（旋律/节奏），1.0 = high（鼓/高音）。
const TIER = {
  pad: 'base', bass: 'base', drone: 'base', heart: 'base', piano: 'base',
  pluck: 'mid', koto: 'mid', arp: 'mid', pulse: 'mid',
};

// 标题与结局不在 maps.js 里，单独定义（气质见 brief-m4 §4）。
const EXTRA = {
  title:  { root: 62, scale: [0, 2, 4, 7, 9],    tempo: 62, mood: 'quiet',   tracks: { pad: 'base', pluck: 'base' } },
  ending: { root: 62, scale: [0, 2, 4, 7, 9, 11], tempo: 50, mood: 'resolve', tracks: { pad: 'base', piano: 'base' } },
};

function sceneDef(id) {
  if (EXTRA[id]) return EXTRA[id];
  const m = MAPS[id]?.music;
  if (m) return { ...m, tracks: Object.fromEntries((m.layers || []).map((layer) => [layer, TIER[layer] || 'mid'])) };
  return { root: 62, scale: [0, 2, 4, 7, 9], tempo: 70, mood: 'quiet', tracks: { pad: 'base' } };
}

// 音阶度数 → MIDI：deg(def, d, oct) = root + scale[d % len] + 12*oct
function deg(def, d, oct = 0) {
  const n = def.scale.length;
  return def.root + def.scale[((d % n) + n) % n] + 12 * oct;
}

let sharedNoise = null;
function noiseBuf(ctx) {
  if (!sharedNoise) {
    sharedNoise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = sharedNoise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  return sharedNoise;
}

// —— 合成器声音（voice）——
function envGain(ctx, t, peak, attack) {
  const g = ctx.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(Math.max(0.0001, peak), t + Math.max(0.01, attack));
  return g;
}

function padVoice(ctx, dest, chord, t, dur) {
  if (!Array.isArray(chord)) return;
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = 850; flt.Q.value = 0.6;
  flt.connect(dest);
  chord.forEach((midi, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = midiFreq(midi);
    osc.detune.value = (i - 1) * 5;
    const g = envGain(ctx, t, 0.14 / chord.length, 0.5);
    g.gain.setValueAtTime(Math.max(0.0001, 0.14 / chord.length), t + 0.55);
    g.gain.setTargetAtTime(0.0001, t + dur * 6, 0.7);
    osc.connect(g); g.connect(flt);
    osc.start(t); osc.stop(t + dur * 6 + 3);
  });
}

function bassVoice(ctx, dest, midi, t, dur) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = midiFreq(midi);
  const g = envGain(ctx, t, 0.26, 0.02);
  g.gain.setTargetAtTime(0.0001, t + dur * 1.4, 0.12);
  osc.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + dur * 2 + 0.3);
}

function arpVoice(ctx, dest, midi, t) {
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = 4200; flt.Q.value = 1.2;
  flt.connect(dest);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = midiFreq(midi);
  const g = envGain(ctx, t, 0.09, 0.004);
  g.gain.setTargetAtTime(0.0001, t + 0.11, 0.03);
  osc.connect(g); g.connect(flt);
  osc.start(t); osc.stop(t + 0.4);
}

function pluckVoice(ctx, dest, midi, t) {
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = 2400; flt.Q.value = 0.8;
  flt.connect(dest);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = midiFreq(midi);
  const g = envGain(ctx, t, 0.16, 0.004);
  g.gain.setTargetAtTime(0.0001, t + 0.16, 0.08);
  osc.connect(g); g.connect(flt);
  osc.start(t); osc.stop(t + 1.0);
}

function pulseVoice(ctx, dest, midi, t) {
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = 5000; flt.Q.value = 0.7;
  flt.connect(dest);
  const osc = ctx.createOscillator();
  osc.type = 'square';
  osc.frequency.value = midiFreq(midi);
  const g = envGain(ctx, t, 0.11, 0.004);
  g.gain.setTargetAtTime(0.0001, t + 0.05, 0.02);
  osc.connect(g); g.connect(flt);
  osc.start(t); osc.stop(t + 0.25);
}

function kotoVoice(ctx, dest, midi, t) {
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = 3600; flt.Q.value = 1.0;
  flt.connect(dest);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = midiFreq(midi);
  const g = envGain(ctx, t, 0.18, 0.006);
  g.gain.setTargetAtTime(0.0001, t + 0.2, 0.14);
  osc.connect(g); g.connect(flt);
  osc.start(t); osc.stop(t + 1.4);
  // 拨弦的"嚓"：极短噪声起音
  const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
  const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 3000;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.05, t);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.02);
  src.connect(hf); hf.connect(ng); ng.connect(dest);
  src.start(t); src.stop(t + 0.03);
}

function droneVoice(ctx, dest, midi, t, dur) {
  const flt = ctx.createBiquadFilter();
  flt.type = 'lowpass'; flt.frequency.value = 300; flt.Q.value = 0.7;
  flt.connect(dest);
  const freqs = [midiFreq(midi), midiFreq(midi + 7)];
  freqs.forEach((freq, i) => {
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = freq;
    osc.detune.value = (i ? 5 : -5);
    const g = envGain(ctx, t, 0.13, 1.2);
    g.gain.setValueAtTime(0.13, t + 1.3);
    g.gain.setTargetAtTime(0.0001, t + dur * 10, 1.2);
    osc.connect(g); g.connect(flt);
    osc.start(t); osc.stop(t + dur * 10 + 3);
  });
}

function heartVoice(ctx, dest, midi, t) {
  const osc = ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.value = midiFreq(midi);
  const g = envGain(ctx, t, 0.3, 0.06);
  g.gain.setTargetAtTime(0.0001, t + 0.2, 0.12);
  osc.connect(g); g.connect(dest);
  osc.start(t); osc.stop(t + 1.0);
}

function pianoVoice(ctx, dest, midi, t) {
  const base = midiFreq(midi);
  [[1, 0.2], [2, 0.06]].forEach(([ratio, peak]) => {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.value = base * ratio;
    const g = envGain(ctx, t, peak, 0.008);
    g.gain.setTargetAtTime(0.0001, t + 0.6, 0.5);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + 3.5);
  });
}

function sparkleVoice(ctx, dest, midi, t) {
  const flt = ctx.createBiquadFilter();
  flt.type = 'highpass'; flt.frequency.value = 2500;
  flt.connect(dest);
  const osc = ctx.createOscillator();
  osc.type = 'triangle';
  osc.frequency.value = midiFreq(midi);
  const g = envGain(ctx, t, 0.08, 0.006);
  g.gain.setTargetAtTime(0.0001, t + 0.3, 0.1);
  osc.connect(g); g.connect(flt);
  osc.start(t); osc.stop(t + 1.2);
}

function percVoice(ctx, dest, note, t) {
  if (note?.k === 'hat') {
    const src = ctx.createBufferSource(); src.buffer = noiseBuf(ctx);
    const hf = ctx.createBiquadFilter(); hf.type = 'highpass'; hf.frequency.value = 6500;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.1, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    src.connect(hf); hf.connect(g); g.connect(dest);
    src.start(t); src.stop(t + 0.04);
  } else {
    const osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(130, t);
    osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
    const g = envGain(ctx, t, 0.32, 0.004);
    g.gain.setTargetAtTime(0.0001, t + 0.1, 0.04);
    osc.connect(g); g.connect(dest);
    osc.start(t); osc.stop(t + 0.4);
  }
}

// 每个音色：note(step, def) 返回 MIDI / 和弦数组 / {k:'kick'|'hat'}，null 表示本步不发声。
const TRACKS = {
  pad: { voice: padVoice, note: (step, def) => (step % 8 === 0 ? [deg(def, (Math.floor(step / 8) % 2) ? 3 : 0, 0), deg(def, (Math.floor(step / 8) % 2) ? 5 : 2, 0), deg(def, (Math.floor(step / 8) % 2) ? 7 : 4, 1)] : null) },
  bass: { voice: bassVoice, note: (step, def) => (step % 2 === 0 ? deg(def, (Math.floor(step / 8) % 2) ? 3 : 0, -1) : null) },
  arp: { voice: arpVoice, note: (step, def) => { const seq = [0, 2, 4, 2]; return deg(def, (Math.floor(step / 8) % 2 ? 3 : 0) + seq[step % 4], 1); } },
  pluck: { voice: pluckVoice, note: (step, def) => { if (step % 4) return null; const mel = [0, 2, 4, 7, 9, 7, 4, 2]; return deg(def, mel[(step / 4 | 0) % mel.length] + (Math.floor(step / 8) % 2 ? 3 : 0), 1); } },
  pulse: { voice: pulseVoice, note: (step, def) => (step % 2 === 0 ? deg(def, (Math.floor(step / 8) % 2) ? 3 : 0, 1) : null) },
  koto: { voice: kotoVoice, note: (step, def) => { if (step % 4 !== 2) return null; const mel = [0, 3, 5, 7, 10, 7, 5, 3]; return deg(def, mel[(step / 4 | 0) % mel.length], 0); } },
  drone: { voice: droneVoice, note: (step, def) => (step === 0 ? deg(def, 0, -1) : null) },
  heart: { voice: heartVoice, note: (step, def) => (step % 4 === 0 ? deg(def, 0, -2) : null) },
  piano: { voice: pianoVoice, note: (step, def) => { if (step % 8) return null; const mel = [0, 4, 7, 11, 9, 7, 4, 2]; return deg(def, mel[Math.floor(step / 8) % mel.length], 0); } },
  percussion: { voice: percVoice, note: (step) => (step % 8 === 0 ? { k: 'kick' } : (step % 2 ? { k: 'hat' } : null)) },
  sparkle: { voice: sparkleVoice, note: (step, def) => (step % 8 === 4 ? deg(def, (Math.floor(step / 8) % 2 ? 3 : 0) + 4, 2) : null) },
};

function smoothstep(v, a, b) {
  const x = (v - a) / (b - a);
  return Math.max(0, Math.min(1, x));
}

export class MusicEngine {
  constructor(ctx, outGain) {
    this.ctx = ctx;
    this.out = outGain;
    this.scene = null;
    this.intensity = 0;
    this.groups = [];   // 活动的场景组；切换时旧组淡出
    this.step = 0;
    this.stepDur = 0.5;
    this.steps = 128;   // 16 小节 × 8 分音符
    this.nextTime = ctx.currentTime + 0.1;
    this.timer = setInterval(() => this._schedule(), 90);
  }

  setScene(id) {
    if (id && id === this.scene && this.groups.length) return; // 同场景不重启
    this.scene = id || null;
    for (const g of this.groups) this._fadeOut(g);
    this.groups = this.groups.filter((g) => !g.done);
    if (!id) return;
    const def = sceneDef(id);
    this.stepDur = 60 / def.tempo / 2; // 8 分音符秒数
    this.step = 0;
    this.nextTime = this.ctx.currentTime + 0.08;
    const group = this._buildGroup(id, def);
    this.groups.push(group);
    group.gain.gain.setValueAtTime(0.0001, this.ctx.currentTime);
    group.gain.gain.setTargetAtTime(1, this.ctx.currentTime, 0.5); // 淡入
    this._applyIntensity(group);
  }

  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, v));
    for (const g of this.groups) this._applyIntensity(g);
  }

  _buildGroup(id, def) {
    const gain = this.ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(this.out);
    const tracks = [];
    for (const [layer, tier] of Object.entries(def.tracks)) {
      const t = TRACKS[layer];
      if (!t) continue;
      const tg = this.ctx.createGain();
      tg.gain.value = 0;
      tg.connect(gain);
      tracks.push({ tier, gain: tg, voice: t.voice, note: t.note, active: false });
    }
    // 高密度层（鼓 + 高音）所有场景通用，随 intensity 1.0 亮起
    for (const layer of ['percussion', 'sparkle']) {
      const t = TRACKS[layer];
      const tg = this.ctx.createGain();
      tg.gain.value = 0;
      tg.connect(gain);
      tracks.push({ tier: 'high', gain: tg, voice: t.voice, note: t.note, active: false });
    }
    return { id, def, gain, tracks };
  }

  _applyIntensity(group) {
    for (const tr of group.tracks) {
      let target = 0;
      if (tr.tier === 'base') target = 1;
      else if (tr.tier === 'mid') target = smoothstep(this.intensity, 0.4, 0.65);
      else target = smoothstep(this.intensity, 0.75, 0.95);
      tr.active = target > 0.01;
      tr.gain.gain.setTargetAtTime(target, this.ctx.currentTime, 0.4); // crossfade ≥ 0.8s
    }
  }

  _fadeOut(group) {
    if (group.done) return;
    group.done = true;
    const now = this.ctx.currentTime;
    group.gain.gain.setTargetAtTime(0.0001, now, 0.4); // ~1.2s 淡出
    setTimeout(() => {
      try { group.gain.disconnect(); } catch { /* 已断开 */ }
      this.groups = this.groups.filter((g) => g !== group);
    }, 1400);
  }

  _schedule() {
    if (this.ctx.state !== 'running') return;
    const ahead = this.ctx.currentTime + 0.25;
    while (this.nextTime < ahead) {
      const step = this.step;
      for (const group of this.groups) {
        if (group.done) continue;
        for (const tr of group.tracks) {
          if (!tr.active) continue;
          const note = tr.note(step, group.def);
          if (note != null) tr.voice(this.ctx, tr.gain, note, this.nextTime, this.stepDur);
        }
      }
      this.step = (step + 1) % this.steps;
      this.nextTime += this.stepDur;
    }
  }
}
