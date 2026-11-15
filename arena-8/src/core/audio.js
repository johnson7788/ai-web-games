// src/core/audio.js — 程序化 WebAudio SFX + AI BGM（缺失回退程序化）。
// API：ensure/resume/stopAll/unlock/setMuted/muted/play(name)/event(type)/getLevel。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.4;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, analyser: null, noise: null,
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
      const comp = ctx.createDynamicsCompressor();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(comp);
      comp.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 1.2);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._startBGM();
      return true;
    },

    unlock() { this.ensure(); this.resume(); },
    resume() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const b = this.bgm;
      if (b.kind === 'file' && !b.src) this._fileStart();
      else if (b.kind === 'synth' && b.gain) { b.gain.gain.value = BGM_GAIN; if (!b.timer) this._synthStart(); }
    },
    stopAll() {
      if (!this.ctx) return;
      this._pauseBGM();
    },
    setMuted(b) {
      this.muted = !!b;
      if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN;
    },
    muted() { return this.muted; },
    getLevel() {
      if (!this.analyser) return { peak: 0, rms: 0 };
      const n = this.analyser.fftSize;
      const data = new Float32Array(n);
      this.analyser.getFloatTimeDomainData(data);
      let peak = 0, sum = 0;
      for (let i = 0; i < n; i++) { const v = data[i], a = Math.abs(v); if (a > peak) peak = a; sum += v * v; }
      return { peak, rms: Math.sqrt(sum / n) };
    },

    // 具名音效（audio-plan 方法名）
    play(name) { this.event(name); },
    event(name) {
      switch (name) {
        case 'ui_click': case 'ui': this._env(520, 0.06, 'triangle', 0.08); break;
        case 'ui_back': this._env(320, 0.08, 'triangle', 0.08); break;
        case 'start': case 'countdown': this._env(440, 0.18, 'square', 0.10); break;
        case 'score': case 'pickup': case 'weaponPickup': this._env(660, 0.10, 'triangle', 0.10, 990); break;
        case 'weaponBreak': this._noise({ dur: 0.16, vol: 0.16, type: 'bandpass', freq: 1200, q: 2 }); break;
        case 'punch': this._env(180, 0.08, 'square', 0.07, 90); break;
        case 'hit': this._noise({ dur: 0.12, vol: 0.2, type: 'lowpass', freq: 900, q: 1 }); break;
        case 'grab': this._env(220, 0.12, 'square', 0.09, 150); break;
        case 'throw': this._env(900, 0.25, 'sawtooth', 0.10, 180); break;
        case 'ult': this._noise({ dur: 0.35, vol: 0.24, type: 'lowpass', freq: 500, q: 0.8 }); this._env(90, 0.3, 'sine', 0.18, 40); break;
        case 'kill': case 'fall': this._env(700, 0.3, 'sawtooth', 0.12, 140); this._env(140, 0.25, 'sine', 0.12, 60); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'fail': case 'lose': this._descend(); break;
        case 'combo': this._env(780, 0.1, 'triangle', 0.10, 1200); break;
        default: break;
      }
    },

    // ---------------------------------------------------------------- 内部
    _env(freq, dur, type = 'sine', vol = 0.16, slide = null) {
      if (!this.ctx || this.voices >= MAX_VOICES) return;
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
    _noise({ dur, vol, type = 'lowpass', freq = 900, q = 1 }) {
      if (!this.ctx || !this.noise || this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.value = freq; f.Q.value = q;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },
    _fanfare(notes) {
      notes.forEach((f) => this._env(f, 0.18, 'triangle', 0.13));
    },
    _descend() { this._env(520, 0.6, 'sawtooth', 0.14, 80); this._env(260, 0.6, 'square', 0.08, 60); },

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
    _playBGMFile(audioBuf) {
      this.bgm.buf = audioBuf; this.bgm.kind = 'file'; this._fileStart();
    },
    _fileStart() {
      const b = this.bgm;
      if (!b.buf || b.src) return;
      const src = this.ctx.createBufferSource();
      src.buffer = b.buf; src.loop = true;
      src.connect(b.gain); src.start();
      b.src = src;
    },
    _playBGMSynth() {
      const b = this.bgm, ctx = this.ctx;
      if (b.kind === 'synth') return;
      b.kind = 'synth'; b.out = b.gain;
      if (!b.pad) {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 0.5;
        const padG = ctx.createGain(); padG.gain.value = 0.07;
        lp.connect(padG).connect(b.out);
        b.pad = [];
        [110, 164.81, 220, 329.63].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
          o.detune.value = i % 2 ? 4 : -4;
          o.connect(lp); o.start(); b.pad.push(o);
        });
      }
      this._synthStart();
    },
    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      const notes = [55, 82.41, 110, 82.41, 65.41, 98, 130.81, 98];
      const STEP = 0.22;
      const tick = () => {
        const when = ctx.currentTime + 0.12;
        const f = notes[b.step % notes.length];
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.14, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, when + STEP);
        o.connect(g).connect(b.out);
        o.start(when); o.stop(when + STEP + 0.03);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, STEP * 1000);
    },
    _pauseBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && b.src) { b.src.stop(); b.src = null; }
      else if (b.kind === 'synth') { if (b.timer) { clearInterval(b.timer); b.timer = null; } b.gain.gain.value = 0; }
    },
  };

  return A;
}
