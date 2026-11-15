// src/core/audio.js — 全程序化 WebAudio + AI BGM。
// API：ensure/resume/stopAll/setEngine/event/ui/setMuted/getLevel（main 集成）
//      + unlock()/muted()/play(name)（audio-plan.md 契约）。
// BGM 缺失回退程序化 synthwave；master 接 DynamicsCompressor。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.42;
const SFX_GAIN = 0.9;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, sfx: null, analyser: null, noise: null,
    engine: null,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, out: null },
    voices: 0,

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      this.sfx = ctx.createGain(); // BGM/SFX 分轨：SFX 与引擎声走此轨
      this.sfx.gain.value = SFX_GAIN;
      this.sfx.connect(this.master);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 6;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(comp);
      comp.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      const len = Math.floor(ctx.sampleRate * 1.2);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this._buildEngine();
      this._startBGM();
      return true;
    },

    unlock() { return this.ensure(); },

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
      this._pauseBGM();
    },

    setEngine(r, boost) {
      if (!this.engine) return;
      const t = this.ctx.currentTime;
      const f = 60 + r * 150 + (boost ? 40 : 0);
      this.engine.o.frequency.setTargetAtTime(f, t, 0.08);
      this.engine.lp.frequency.setTargetAtTime(600 + r * 1600 + (boost ? 700 : 0), t, 0.1);
      this.engine.g.gain.setTargetAtTime(0.03 + r * 0.05, t, 0.14);
    },

    event(name) {
      switch (name) {
        case 'ringPass': this._noise({ dur: 0.16, vol: 0.14, type: 'bandpass', freq: 900, slideTo: 2600, q: 1.2 }); this._envelope(660, 0.12, 'triangle', 0.1, 990); break;
        case 'ringHit': this._crash(); break;
        case 'ringMiss': this._envelope(220, 0.24, 'sawtooth', 0.1, 110); break;
        case 'groundHit': this._noise({ dur: 0.2, vol: 0.16, type: 'lowpass', freq: 500, q: 1 }); break;
        case 'crash': this._crash(); this._envelope(90, 0.5, 'sine', 0.18, 45); break;
        case 'boostStart': this._envelope(240, 0.5, 'sawtooth', 0.11, 900); break;
        case 'slipstream': this._envelope(1200, 0.08, 'square', 0.05); break;
        case 'lap': this._fanfare([523.25, 659.25, 783.99]); break;
        case 'finished': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'countdown': this._envelope(440, 0.18, 'square', 0.09); break;
        case 'raceStart': this._envelope(880, 0.3, 'square', 0.12); break;
        case 'ui_click': case 'ui': this._envelope(520, 0.06, 'triangle', 0.06); break;
        case 'win': this._fanfare([523.25, 659.25, 783.99]); break;
        case 'fail': this._envelope(200, 0.4, 'sawtooth', 0.12, 80); break;
        case 'start': this._envelope(660, 0.2, 'triangle', 0.1, 990); break;
        case 'score': case 'pickup': case 'combo': this._envelope(990, 0.1, 'triangle', 0.09, 1320); break;
        case 'hit': this._crash(); break;
        case 'ui_back': this._envelope(330, 0.08, 'triangle', 0.06); break;
        default: break;
      }
    },

    ui() { this.event('ui_click'); },
    play(name) { this.event(name); },
    muted() { return this.muted; },

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

    // ---------------- 内部 ----------------
    _buildEngine() {
      const ctx = this.ctx;
      const g = ctx.createGain();
      g.gain.value = 0;
      const lp = ctx.createBiquadFilter();
      lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 2.6;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 70;
      const o2 = ctx.createOscillator(); o2.type = 'triangle'; o2.frequency.value = 140;
      const g2 = ctx.createGain(); g2.gain.value = 0.4;
      o.connect(lp); o2.connect(g2).connect(lp);
      lp.connect(g).connect(this.sfx);
      o.start(); o2.start();
      this.engine = { o, lp, g };
    },

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
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + dur + 0.05);
      o.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

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
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _crash() { this._noise({ dur: 0.3, vol: 0.2, type: 'lowpass', freq: 800, q: 0.8 }); },

    _fanfare(notes) {
      const t0 = this.ctx.currentTime;
      notes.forEach((f, i) => this._envelope(f, 0.2, 'triangle', 0.12, null, t0 + i * 0.1));
    },

    _startBGM() {
      const g = this.ctx.createGain();
      g.gain.value = BGM_GAIN;
      g.connect(this.master);
      this.bgm.gain = g;
      fetch(BGM_URL)
        .then((r) => { if (!r.ok) throw new Error('bgm missing'); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuf) => { this.bgm.buf = audioBuf; this.bgm.kind = 'file'; this._fileStart(); })
        .catch(() => this._playBGMSynth());
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
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1000; lp.Q.value = 0.6;
      const padG = ctx.createGain(); padG.gain.value = 0.08;
      lp.connect(padG).connect(b.out);
      [110, 164.81, 220, 329.63].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        o.detune.value = i % 2 ? 4 : -4;
        o.connect(lp); o.start();
      });
      this._synthStart();
    },

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
        g.gain.linearRampToValueAtTime(0.15, when + 0.012);
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
      if (b.kind === 'file' && b.src) { try { b.src.stop(); } catch {} b.src = null; }
      else if (b.kind === 'synth') {
        if (b.timer) { clearInterval(b.timer); b.timer = null; }
        b.gain.gain.value = 0;
      }
    },
  };

  return A;
}
