// src/core/audio.js — 全程序化 WebAudio + AI BGM（M4）。
// API 契约：ensure/resume/stopAll/setEngine/setSkid/setSiren/event/ui/beep/setMuted。
// 额外调试口：getLevel()（tools/audio-check.mjs 采样 master RMS 用，非游戏依赖）。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.45;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 8; // 粒子音（一次性噪声/短音）并发上限，复用共享噪声 buffer

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, analyser: null, noise: null,
    engine: null, skid: null, siren: null,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, pad: null, out: null },
    voices: 0,

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      const len = Math.floor(ctx.sampleRate * 1.2);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this._buildEngine();
      this._buildSkid();
      this._buildSiren();
      this._startBGM();
      return true;
    },

    resume() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const b = this.bgm;
      if (b.kind === 'file' && !b.src) this._fileStart();
      else if (b.kind === 'synth' && b.gain) {
        b.gain.gain.value = BGM_GAIN;
        if (!b.timer) this._synthStart();
      }
    },

    stopAll() {
      if (!this.ctx) return;
      if (this.engine) this.engine.g.gain.value = 0;
      if (this.skid) this.skid.g.gain.value = 0;
      if (this.siren) this.siren.g.gain.value = 0;
      this._pauseBGM();
    },

    setEngine(r, boost) {
      if (!this.engine) return;
      const t = this.ctx.currentTime;
      const f = 48 + r * 118 + (boost ? 24 : 0);
      this.engine.o1.frequency.setTargetAtTime(f, t, 0.06);
      this.engine.o2.frequency.setTargetAtTime(f * 1.51, t, 0.06);
      this.engine.o3.frequency.setTargetAtTime(f * 2.02, t, 0.06);
      this.engine.lp.frequency.setTargetAtTime(520 + r * 1500 + (boost ? 600 : 0), t, 0.08);
      this.engine.g.gain.setTargetAtTime(0.045 + r * 0.055, t, 0.12);
      this.engine.g3.gain.setTargetAtTime(boost ? 0.22 : 0, t, 0.08);
    },

    setSkid(on, i = 1) {
      if (!this.skid) return;
      const t = this.ctx.currentTime;
      this.skid.g.gain.setTargetAtTime(on ? 0.035 * i : 0, t, 0.05);
      this.skid.bp.frequency.setTargetAtTime(1500 + i * 900, t, 0.1);
    },

    setSiren(level) {
      if (!this.siren) return;
      const t = this.ctx.currentTime;
      this.siren.g.gain.setTargetAtTime(level > 0 ? 0.02 + level * 0.10 : 0, t, 0.05);
    },

    event(name) {
      switch (name) {
        case 'crash': this._crash(); break;
        case 'nearMiss': this._noise({ dur: 0.28, vol: 0.18, type: 'bandpass', freq: 400, slideTo: 2400, q: 1.4, attack: 0.06 }); break;
        case 'boostStart': this._envelope(220, 0.5, 'sawtooth', 0.12, 880); break;
        case 'driftTick': this._envelope(1200, 0.05, 'square', 0.06); break;
        case 'lap': this._fanfare([523.25, 659.25, 783.99]); break;
        case 'heat': this._heat(); break;
        case 'launchPerfect': this._chord([261.63, 329.63, 392.0, 523.25]); break;
        case 'launchJump': this._envelope(200, 0.3, 'square', 0.15, 80); break;
        case 'busted': this._descend(); break;
        case 'finished': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        // offTrack/boostEnd/driftStart/driftEnd/multReset/copClose/launchNormal：静默
        default: break;
      }
    },

    ui() { this._envelope(520, 0.07, 'triangle', 0.07); },
    beep(green) { this._envelope(green ? 880 : 440, green ? 0.3 : 0.14, 'square', 0.10); },

    setMuted(b) {
      this.muted = !!b;
      if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN;
    },

    getLevel() {
      if (!this.analyser) return { peak: 0, rms: 0 };
      const n = this.analyser.fftSize;
      const data = new Float32Array(n);
      this.analyser.getFloatTimeDomainData(data);
      let peak = 0, sum = 0;
      for (let i = 0; i < n; i++) {
        const v = data[i], a = Math.abs(v);
        if (a > peak) peak = a;
        sum += v * v;
      }
      return { peak, rms: Math.sqrt(sum / n) };
    },

    // ---------------------------------------------------------------- 内部
    _buildEngine() {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 3.2;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 52;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 78;
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      const o3 = ctx.createOscillator(); o3.type = 'sawtooth'; o3.frequency.value = 105;
      const g3 = ctx.createGain(); g3.gain.value = 0; // boost 谐波
      o1.connect(lp);
      o2.connect(g2).connect(lp);
      o3.connect(g3).connect(lp);
      lp.connect(g).connect(this.master);
      o1.start(); o2.start(); o3.start();
      this.engine = { o1, o2, o3, lp, g, g3 };
    },

    _buildSkid() {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.1;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      this.skid = { g, bp };
    },

    _buildSiren() {
      const ctx = this.ctx;
      const osc = ctx.createOscillator(); osc.type = 'square'; osc.frequency.value = 700;
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 8;
      const lfoGain = ctx.createGain(); lfoGain.gain.value = 100; // 700±100 → 600/800 交替
      lfo.connect(lfoGain); lfoGain.connect(osc.frequency);
      const g = ctx.createGain(); g.gain.value = 0;
      osc.connect(g).connect(this.master);
      osc.start(); lfo.start();
      this.siren = { g };
    },

    // 一次性短音（粒子音）：并发 ≤ MAX_VOICES
    _envelope(freq, dur, type = 'sine', vol = 0.16, slide = null, when = null) {
      if (!this.ctx) return;
      if (this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = when != null ? when : this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
      o.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    // 一次性滤波噪声：复用 this.noise buffer
    _noise({ dur, vol, type = 'lowpass', freq = 900, q = 1, slideTo = null, attack = 0.005 }) {
      if (!this.ctx || !this.noise) return;
      if (this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _crash() {
      this._noise({ dur: 0.32, vol: 0.22, type: 'lowpass', freq: 900, q: 0.8 });
      this._envelope(90, 0.28, 'sine', 0.18, 45);
    },

    _heat() {
      const t = this.ctx.currentTime;
      this._envelope(600, 0.09, 'square', 0.12, null, t);
      this._envelope(800, 0.09, 'square', 0.12, null, t + 0.10);
    },

    _descend() {
      this._envelope(520, 0.6, 'sawtooth', 0.14, 80);
      this._envelope(260, 0.6, 'square', 0.08, 60);
    },

    _chord(notes) {
      const t = this.ctx.currentTime;
      notes.forEach((f, i) => this._envelope(f, 0.5, i % 2 ? 'triangle' : 'sine', 0.11, null, t));
    },

    _fanfare(notes) {
      const t0 = this.ctx.currentTime;
      notes.forEach((f, i) => this._envelope(f, 0.18, 'triangle', 0.13, null, t0 + i * 0.09));
    },

    // ---------------------------------------------------------------- BGM
    _startBGM() {
      const g = this.ctx.createGain();
      g.gain.value = BGM_GAIN;
      g.connect(this.master);
      this.bgm.gain = g;
      // 优先 AI BGM（Lead 稍后生成）；缺失/解码失败 → 程序化 synthwave 降级
      fetch(BGM_URL)
        .then((r) => { if (!r.ok) throw new Error('bgm missing'); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuf) => this._playBGMFile(audioBuf))
        .catch(() => this._playBGMSynth());
    },

    _playBGMFile(audioBuf) {
      this.bgm.buf = audioBuf;
      this.bgm.kind = 'file';
      this._fileStart();
    },

    _fileStart() {
      const b = this.bgm;
      if (!b.buf || b.src) return;
      const src = this.ctx.createBufferSource();
      src.buffer = b.buf; src.loop = true;
      src.connect(b.gain);
      src.start();
      b.src = src;
    },

    _playBGMSynth() {
      const b = this.bgm, ctx = this.ctx;
      if (b.kind === 'synth') return;
      b.kind = 'synth';
      b.out = b.gain;
      // 和弦垫：Am 三和弦（+八度），轻微失谐，低通
      if (!b.pad) {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.6;
        const padG = ctx.createGain(); padG.gain.value = 0.09;
        lp.connect(padG).connect(b.out);
        b.pad = [];
        [110, 164.81, 220, 329.63].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
          o.detune.value = i % 2 ? 4 : -4;
          o.connect(lp); o.start();
          b.pad.push(o);
        });
      }
      this._synthStart();
    },

    // 贝斯琶音：lookahead 调度，A 小调 8 步循环
    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      const notes = [55, 82.41, 110, 82.41, 65.41, 98, 130.81, 98];
      const STEP_DUR = 0.22;
      const tick = () => {
        const when = ctx.currentTime + 0.12;
        const f = notes[b.step % notes.length];
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.16, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, when + STEP_DUR);
        o.connect(g).connect(b.out);
        o.start(when); o.stop(when + STEP_DUR + 0.03);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, STEP_DUR * 1000);
    },

    _pauseBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && b.src) { b.src.stop(); b.src = null; }
      else if (b.kind === 'synth') {
        if (b.timer) { clearInterval(b.timer); b.timer = null; }
        b.gain.gain.value = 0;
      }
    },
  };

  return A;
}
