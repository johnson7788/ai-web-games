// src/core/audio.js — 程序化 WebAudio SFX + AI BGM（缺失回退 synthwave 琶音）。
// API：unlock / setMuted / muted / play(name) / event(name) / setThrust(level) / getLevel。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.40;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, analyser: null, noise: null,
    thrust: null, voices: 0,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, pad: null },

    unlock() {
      if (this.ctx) { this.resume(); return true; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 8;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(comp);
      comp.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      const len = Math.floor(ctx.sampleRate * 1.0);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this._buildThrust();
      this._startBGM();
      return true;
    },

    resume() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const b = this.bgm;
      if (b.kind === 'file' && !b.src) this._fileStart();
      else if (b.kind === 'synth' && !b.timer) this._synthStart();
    },

    stopAll() {
      if (!this.ctx) return;
      if (this.thrust) this.thrust.g.gain.value = 0;
      this._pauseBGM();
    },

    muted() { return this.muted; },
    setMuted(b) { this.muted = !!b; if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN; },

    play(name) { this.event(name); },

    // 引擎/推力持续声：按住时给一层升调
    setThrust(level) {
      if (!this.thrust) return;
      const t = this.ctx.currentTime;
      const f = 90 + level * 200;
      this.thrust.o.frequency.setTargetAtTime(f, t, 0.08);
      this.thrust.g.gain.setTargetAtTime(level > 0.05 ? 0.05 + level * 0.05 : 0, t, 0.1);
    },

    event(name) {
      switch (name) {
        case 'ui_click': case 'ui': this._env(520, 0.07, 'triangle', 0.07); break;
        case 'ui_back': this._env(300, 0.09, 'triangle', 0.06); break;
        case 'start': this._chord([261.63, 329.63, 392.0]); break;
        case 'countdown': this._env(440, 0.1, 'square', 0.08); break;
        case 'score': this._env(880, 0.08, 'triangle', 0.06); break;
        case 'pass': this._env(600, 0.1, 'sine', 0.08, 900); break;
        case 'perfect': this._env(1200, 0.12, 'triangle', 0.12, 1600); break;
        case 'nearMiss': this._noise({ dur: 0.2, vol: 0.12, type: 'bandpass', freq: 500, slideTo: 2200, q: 1.6 }); break;
        case 'combo': this._env(1400, 0.1, 'square', 0.08, 2000); break;
        case 'pickup': case 'orb': this._env(980, 0.12, 'sine', 0.12, 1400); break;
        case 'shield': this._noise({ dur: 0.3, vol: 0.18, type: 'lowpass', freq: 1200 }); this._env(300, 0.3, 'square', 0.1, 120); break;
        case 'slowmo': this._noise({ dur: 0.25, vol: 0.1, type: 'lowpass', freq: 800, slideTo: 200 }); break;
        case 'segment': this._fanfare([523.25, 659.25, 783.99]); break;
        case 'hit': case 'fail': this._crash(); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        default: break;
      }
    },

    getLevel() {
      if (!this.analyser) return { peak: 0, rms: 0 };
      const n = this.analyser.fftSize;
      const data = new Float32Array(n);
      this.analyser.getFloatTimeDomainData(data);
      let peak = 0, sum = 0;
      for (let i = 0; i < n; i++) { const v = data[i], a = Math.abs(v); if (a > peak) peak = a; sum += v * v; }
      return { peak, rms: Math.sqrt(sum / n) };
    },

    // ---------------------------------------------------------------- 内部
    _buildThrust() {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = 90;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 2;
      const g = ctx.createGain(); g.gain.value = 0;
      o.connect(lp).connect(g).connect(this.master);
      o.start();
      this.thrust = { o, g };
    },

    _env(freq, dur, type = 'sine', vol = 0.16, slide = null) {
      if (!this.ctx) return;
      if (this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
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

    _noise({ dur, vol, type = 'lowpass', freq = 900, q = 1, slideTo = null }) {
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
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _crash() {
      this._noise({ dur: 0.34, vol: 0.22, type: 'lowpass', freq: 1000, q: 0.8 });
      this._env(120, 0.3, 'sine', 0.18, 50);
    },

    _chord(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.4, i % 2 ? 'triangle' : 'sine', 0.1, null, t)); },
    _fanfare(notes) { const t0 = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.16, 'triangle', 0.12, null, t0 + i * 0.08)); },

    // ---------------------------------------------------------------- BGM
    _startBGM() {
      const g = this.ctx.createGain();
      g.gain.value = BGM_GAIN;
      g.connect(this.master);
      this.bgm.gain = g;
      fetch(BGM_URL)
        .then((r) => { if (!r.ok) throw new Error('bgm missing'); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuf) => this._playBGMFile(audioBuf))
        .catch(() => this._playBGMSynth());
    },

    _playBGMFile(audioBuf) { this.bgm.buf = audioBuf; this.bgm.kind = 'file'; this._fileStart(); },
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
      if (!b.pad) {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.5;
        const padG = ctx.createGain(); padG.gain.value = 0.07;
        lp.connect(padG).connect(b.gain);
        b.pad = [];
        [110, 164.81, 220, 329.63].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = i % 2 ? 5 : -5;
          o.connect(lp); o.start();
          b.pad.push(o);
        });
      }
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
        g.gain.linearRampToValueAtTime(0.14, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, when + STEP_DUR);
        o.connect(g).connect(b.gain);
        o.start(when); o.stop(when + STEP_DUR + 0.03);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, STEP_DUR * 1000);
    },

    _pauseBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && b.src) { try { b.src.stop(); } catch { /* noop */ } b.src = null; }
      else if (b.kind === 'synth') { if (b.timer) { clearInterval(b.timer); b.timer = null; } }
    },
  };

  return A;
}
