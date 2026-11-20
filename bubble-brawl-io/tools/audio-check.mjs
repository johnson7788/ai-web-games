// Oasis Pipeworks 音频验收：离屏渲染 BGM 与全部 SFX，断言 RMS / 时长 / 峰值 / 循环无缝。
// Node 无 WebAudio，故内置一个零依赖的最小 OfflineAudioContext 渲染器（mono），
// 用与浏览器完全相同的 createAudio()/scheduleBgmLoop() 代码路径驱动它。
import { createAudio, scheduleBgmLoop, BGM_LOOP, BPM, BGM_BARS } from '../src/core/audio.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- 最小 OfflineAudioContext ----------

class AudioParam {
  constructor(value = 0) { this.defaultValue = value; this.events = []; }
  set value(v) { this.defaultValue = v; this.events = [{ type: 'set', time: 0, value: v }]; }
  get value() { const e = this.events[this.events.length - 1]; return e ? e.value : this.defaultValue; }
  setValueAtTime(v, t) { this.events.push({ type: 'set', time: t, value: v }); }
  linearRampToValueAtTime(v, t) { this.events.push({ type: 'lin', time: t, value: v }); }
  exponentialRampToValueAtTime(v, t) { this.events.push({ type: 'exp', time: t, value: v }); }
  setTargetAtTime(v, t, tc) { this.events.push({ type: 'target', time: t, value: v, tc }); }
  cancelScheduledValues(t) { this.events = this.events.filter((e) => e.time < t); }
  valueAt(t) {
    let prev = null;
    let next = null;
    for (const e of this.events) {
      if (e.time <= t) prev = e;
      else { next = e; break; }
    }
    if (!prev) return this.defaultValue;
    if (!next) return prev.value;
    if (next.type === 'set') return prev.value;
    const dt = (next.time - prev.time) || 1e-9;
    const k = Math.min(1, Math.max(0, (t - prev.time) / dt));
    if (next.type === 'lin') return prev.value + (next.value - prev.value) * k;
    if (next.type === 'exp') {
      if (!(prev.value > 0) || !(next.value > 0)) return prev.value;
      return prev.value * Math.pow(next.value / prev.value, k);
    }
    if (next.type === 'target') return next.value + (prev.value - next.value) * Math.exp(-(t - next.time) / (next.tc || 0.01));
    return prev.value;
  }
}

class AudioNode {
  constructor(ctx) { this.context = ctx; this.downstream = null; this.upstreams = []; }
  connect(dest) { this.downstream = dest; if (dest) dest.upstreams.push(this); return dest; }
}

class GainNode extends AudioNode {
  constructor(ctx, value = 1) { super(ctx); this.gain = new AudioParam(value); }
  process(x, i, t) { return x * this.gain.valueAt(t); }
}

class BiquadFilterNode extends AudioNode {
  constructor(ctx) {
    super(ctx);
    this.type = 'lowpass';
    this.frequency = new AudioParam(350);
    this.Q = new AudioParam(1);
    this.gain = new AudioParam(0);
    this._z1 = 0;
    this._z2 = 0;
    this._c = null;
    this._lastF = -1;
    this._lastQ = -1;
    this._lastType = null;
  }
  _coeffs(f, q, sr) {
    const omega = 2 * Math.PI * f / sr;
    const sin = Math.sin(omega);
    const cos = Math.cos(omega);
    const alpha = sin / (2 * Math.max(0.001, q));
    let b0;
    let b1;
    let b2;
    let a0;
    let a1;
    let a2;
    if (this.type === 'lowpass') {
      b0 = (1 - cos) / 2; b1 = 1 - cos; b2 = (1 - cos) / 2;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else if (this.type === 'highpass') {
      b0 = (1 + cos) / 2; b1 = -(1 + cos); b2 = (1 + cos) / 2;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else if (this.type === 'bandpass') {
      b0 = alpha; b1 = 0; b2 = -alpha;
      a0 = 1 + alpha; a1 = -2 * cos; a2 = 1 - alpha;
    } else {
      b0 = 1; b1 = 0; b2 = 0; a0 = 1; a1 = 0; a2 = 0;
    }
    return { b0: b0 / a0, b1: b1 / a0, b2: b2 / a0, a1: a1 / a0, a2: a2 / a0 };
  }
  process(x, i, t) {
    const f = Math.max(1, this.frequency.valueAt(t));
    const q = Math.max(0.001, this.Q.valueAt(t));
    if (this.type !== this._lastType || f !== this._lastF || q !== this._lastQ) {
      this._c = this._coeffs(f, q, this.context.sampleRate);
      this._lastType = this.type;
      this._lastF = f;
      this._lastQ = q;
    }
    const { b0, b1, b2, a1, a2 } = this._c;
    const out = b0 * x + this._z1;
    this._z1 = b1 * x - a1 * out + this._z2;
    this._z2 = b2 * x - a2 * out;
    return out;
  }
}

class OscillatorNode extends AudioNode {
  constructor(ctx) { super(ctx); this.type = 'sine'; this.frequency = new AudioParam(440); this.startTime = null; this.stopTime = null; }
  start(t) { this.startTime = t; }
  stop(t) { this.stopTime = t; }
  wave(phase) {
    if (this.type === 'square') return Math.sin(phase) >= 0 ? 1 : -1;
    if (this.type === 'sawtooth') return 2 * (((phase / (2 * Math.PI)) % 1) - 0.5);
    if (this.type === 'triangle') return (2 / Math.PI) * Math.asin(Math.sin(phase));
    return Math.sin(phase);
  }
}

class AudioBuffer {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.duration = length / sampleRate;
    this._channels = [];
    for (let c = 0; c < channels; c += 1) this._channels.push(new Float32Array(length));
  }
  getChannelData(c) { return this._channels[c] || this._channels[0]; }
}

class AudioBufferSourceNode extends AudioNode {
  constructor(ctx) { super(ctx); this.buffer = null; this.startTime = null; this.stopTime = null; }
  start(t) { this.startTime = t; }
  stop(t) { this.stopTime = t; }
}

class OfflineAudioContext {
  constructor(channels, length, sampleRate) {
    this.numberOfChannels = channels;
    this.length = length;
    this.sampleRate = sampleRate;
    this.currentTime = 0;
    this.state = 'running';
    this.destination = new AudioNode(this);
    this._sources = [];
  }
  resume() { return Promise.resolve(); }
  createGain(v = 1) { return new GainNode(this, v); }
  createOscillator() { const n = new OscillatorNode(this); this._sources.push(n); return n; }
  createBuffer(channels, length, sampleRate) { return new AudioBuffer(channels, length, sampleRate); }
  createBufferSource() { const n = new AudioBufferSourceNode(this); this._sources.push(n); return n; }
  createBiquadFilter() { return new BiquadFilterNode(this); }
  createDynamicsCompressor() { return new GainNode(this, 1); }
  startRendering() {
    const sr = this.sampleRate;
    const len = this.length;
    const out = new Float32Array(len);
    const dest = this.destination;
    for (const src of this._sources) {
      const startT = src.startTime == null ? 0 : src.startTime;
      const stopT = src.stopTime == null ? Infinity : src.stopTime;
      const startIdx = Math.max(0, Math.ceil(startT * sr));
      const endIdx = Math.min(len, Math.floor(stopT * sr));
      if (startIdx >= endIdx) continue;
      const chain = [];
      let n = src.downstream;
      while (n && n !== dest) { chain.push(n); n = n.downstream; }
      let phase = 0;
      const isOsc = src instanceof OscillatorNode;
      for (let i = startIdx; i < endIdx; i += 1) {
        const t = i / sr;
        let v;
        if (isOsc) {
          const f = Math.max(1, src.frequency.valueAt(t));
          phase += (2 * Math.PI * f) / sr;
          v = src.wave(phase);
        } else {
          const d = src.buffer ? src.buffer.getChannelData(0) : null;
          if (!d) continue;
          const bi = Math.max(0, i - Math.round(startT * sr));
          v = bi < d.length ? d[bi] : 0;
        }
        for (const node of chain) v = node.process(v, i, t);
        out[i] += v;
      }
    }
    for (let i = 0; i < len; i += 1) out[i] = Math.tanh(out[i]);
    const buf = new AudioBuffer(1, len, sr);
    buf._channels[0].set(out);
    return Promise.resolve(buf);
  }
}

// ---------- 测量 ----------

function measure(buf) {
  const d = buf.getChannelData(0);
  let sum = 0;
  let peak = 0;
  for (let i = 0; i < d.length; i += 1) {
    const v = d[i];
    sum += v * v;
    if (Math.abs(v) > peak) peak = Math.abs(v);
  }
  return { rms: Math.sqrt(sum / Math.max(1, d.length)), peak, duration: buf.duration, length: d.length };
}

function rmsRange(buf, t0, t1) {
  const sr = buf.sampleRate;
  const d = buf.getChannelData(0);
  const a = Math.max(0, Math.floor(t0 * sr));
  const b = Math.min(d.length, Math.ceil(t1 * sr));
  let sum = 0;
  for (let i = a; i < b; i += 1) sum += d[i] * d[i];
  return Math.sqrt(sum / Math.max(1, b - a));
}

function activeSpan(buf, thresh = 0.002) {
  const d = buf.getChannelData(0);
  let first = -1;
  let last = -1;
  for (let i = 0; i < d.length; i += 1) {
    if (Math.abs(d[i]) > thresh) { if (first < 0) first = i; last = i; }
  }
  return { first, last };
}

function activeDuration(buf, thresh = 0.002) {
  const { first, last } = activeSpan(buf, thresh);
  if (first < 0) return 0;
  return (last - first + 1) / buf.sampleRate;
}

// 短音效的 RMS 应在「实际有声区间」上度量，避免被 0.8s 静音填充稀释。
function activeRms(buf, thresh = 0.002) {
  const { first, last } = activeSpan(buf, thresh);
  if (first < 0) return 0;
  const d = buf.getChannelData(0);
  let sum = 0;
  for (let i = first; i <= last; i += 1) sum += d[i] * d[i];
  return Math.sqrt(sum / (last - first + 1));
}

// ---------- 主流程 ----------

const SFX_RATE = 44100;
const BGM_RATE = 22050;
const checks = [];
const audioReport = [];
let pass = true;

function check(name, ok, detail) {
  checks.push({ name, ok, ...detail });
  if (!ok) pass = false;
}

const SFX_CASES = [
  { event: 'shoot', sfx: 'shoot', payload: {} },
  { event: 'gap', sfx: 'gap', payload: {} },
  { event: 'hit', sfx: 'hit', payload: {} },
  { event: 'crit', sfx: 'crit', payload: {} },
  { event: 'bounce', sfx: 'bounce', payload: {} },
  { event: 'hurt', sfx: 'hurt', payload: {} },
  { event: 'spike', sfx: 'spike', payload: {} },
  { event: 'rock', sfx: 'rock', payload: {} },
  { event: 'combo', sfx: 'combo', payload: { combo: 3 } },
  { event: 'win', sfx: 'win', payload: { stars: 2 } },
  { event: 'lose', sfx: 'lose', payload: { reason: 'knockedOut' } },
  { event: 'levelup', sfx: 'levelup', payload: {} },
  { event: 'dodge', sfx: 'dodge', payload: {} },
];

async function renderSfx(eventName, payload) {
  const len = Math.ceil(0.8 * SFX_RATE);
  const ctx = new OfflineAudioContext(1, len, SFX_RATE);
  const audio = createAudio({ createContext: () => ctx });
  audio.event(eventName, payload);
  return { buf: await ctx.startRendering(), ctx };
}

async function main() {
  // --- BGM：渲染 1 个循环 + 0.5s 下一循环首部，用于验证无缝拼接 ---
  {
    const sr = BGM_RATE;
    const ctx = new OfflineAudioContext(1, Math.ceil((BGM_LOOP + 0.5) * sr), sr);
    const outGain = ctx.createGain();
    outGain.gain.value = 1;
    outGain.connect(ctx.destination);
    scheduleBgmLoop(ctx, outGain, 0);
    scheduleBgmLoop(ctx, outGain, BGM_LOOP);
    const buf = await ctx.startRendering();
    const m = measure(buf);
    const headRms = rmsRange(buf, 0, 0.25);
    const spliceRms = rmsRange(buf, BGM_LOOP - 0.25, BGM_LOOP + 0.25);

    check('bgm-loop-seconds≈32', Math.abs(BGM_LOOP - 32) < 0.05, { loopSeconds: BGM_LOOP, bpm: BPM, bars: BGM_BARS });
    check('bgm-render-duration', Math.abs(m.duration - (BGM_LOOP + 0.5)) < 0.05, { duration: m.duration });
    check('bgm-rms>0.01', m.rms > 0.01, { rms: m.rms });
    check('bgm-head-no-fadein', headRms > 0.01, { headRms });
    check('bgm-loop-splice-no-silence', spliceRms > 0.01, { spliceRms });
    check('bgm-peak<=0.98', m.peak <= 0.98, { peak: m.peak });

    audioReport.push({
      kind: 'bgm',
      loopSeconds: BGM_LOOP,
      bpm: BPM,
      bars: BGM_BARS,
      duration: m.duration,
      rms: m.rms,
      peak: m.peak,
      headRms,
      spliceRms,
    });
  }

  // --- SFX ---
  for (const c of SFX_CASES) {
    const { buf } = await renderSfx(c.event, c.payload);
    const m = measure(buf);
    const dur = activeDuration(buf, 0.002);
    const rms = activeRms(buf, 0.002);
    check(`sfx-${c.sfx}-rms>0.01`, rms > 0.01, { rms });
    check(`sfx-${c.sfx}-dur<=0.6s`, dur <= 0.6, { activeDuration: dur });
    check(`sfx-${c.sfx}-peak<=0.98`, m.peak <= 0.98, { peak: m.peak });
    audioReport.push({ kind: 'sfx', name: c.sfx, event: c.event, rms, peak: m.peak, activeDuration: dur });
  }

  // --- 负例：未注册事件必须静音（SFX_EVENT_MAP 之外的名称不发声） ---
  {
    const { buf } = await renderSfx('notARegisteredEvent', {});
    const m = measure(buf);
    check('unknown-event-silent', m.rms < 0.005, { rms: m.rms });
  }

  // --- 输出 ---
  const report = {
    game: 'bubble-brawl-io',
    generatedAt: new Date().toISOString(),
    pass,
    checks,
    audio: audioReport,
  };
  const here = dirname(fileURLToPath(import.meta.url));
  const outFile = join(here, 'fun', 'audio-report.json');
  mkdirSync(dirname(outFile), { recursive: true });
  writeFileSync(outFile, JSON.stringify(report, null, 2));

  for (const c of checks) {
    const { name, ok, ...detail } = c;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}  ${JSON.stringify(detail)}`);
  }
  console.log(`\n${pass ? 'PASS' : 'FAIL'}  audio-check  (report: ${outFile})`);
  process.exitCode = pass ? 0 : 1;
}

main().catch((e) => {
  console.error('audio-check crashed:', e);
  process.exitCode = 1;
});
