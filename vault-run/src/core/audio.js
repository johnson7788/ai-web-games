// src/core/audio.js — 全程序化 WebAudio SFX + AI BGM（缺失回退合成）。
// API：unlock()/setMuted()/muted()/play(name, opts)/event(name, opts)/resume()/stopAll()/ui()/getLevel()。
// BGM：优先 assets/audio/bgm.mp3；解码失败回退程序化鼓点+贝斯循环。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.5;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, analyser: null, noise: null,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0 },
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
      else if (b.kind === 'synth' && b.gain && !b.timer) { b.gain.gain.value = BGM_GAIN; this._synthStart(); }
    },
    stopAll() { if (this.bgm.kind === 'synth' && this.bgm.timer) { clearInterval(this.bgm.timer); this.bgm.timer = null; this.bgm.gain.gain.value = 0; } if (this.bgm.kind === 'file' && this.bgm.src) { this.bgm.src.stop(); this.bgm.src = null; } },
    muted() { return this.muted; },
    setMuted(b) { this.muted = !!b; if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN; },

    ui() { this.play('ui_click'); },
    event(name, opts) { this.play(name, opts); },

    play(name, opts = {}) {
      if (!this.ctx) return;
      switch (name) {
        case 'ui_click': this._env(520, 0.07, 'triangle', 0.07); break;
        case 'ui_back': this._env(260, 0.09, 'triangle', 0.07); break;
        case 'start': this._env(220, 0.4, 'sawtooth', 0.12, 660); break;
        case 'score': this._env(880, 0.08, 'square', 0.06); break;
        case 'hit': this._noise(0.25, 0.2, 'lowpass', 800); this._env(90, 0.22, 'sine', 0.16, 45); break;
        case 'fail': this._env(520, 0.5, 'sawtooth', 0.13, 90); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'combo': { const n = opts.n || 2; const f = 440 * (1 + (n - 1) * 0.12); this._env(f, 0.12, 'square', 0.09); break; }
        case 'pickup': this._fanfare([784, 1175]); break;
        case 'countdown': this._env(880, 0.12, 'square', 0.1); break;
        case 'vault': this._noise(0.2, 0.14, 'bandpass', 500, 1400); this._env(200, 0.12, 'sine', 0.1, 70); break;
        case 'slide': this._noise(0.5, 0.12, 'bandpass', 1800, 900); break;
        case 'wallrun': this._noise(0.4, 0.12, 'bandpass', 700, 2200); break;
        case 'fall': this._env(700, 0.6, 'sine', 0.12, 140); break;
        case 'milestone': this._env(1046, 0.14, 'triangle', 0.09); break;
        case 'section': this._fanfare([523.25, 659.25]); break;
        case 'step': this._env(95, 0.05, 'sine', 0.035); break;
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
    _env(freq, dur, type = 'sine', vol = 0.16, slide = null, when = null) {
      if (this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = when != null ? when : this.ctx.currentTime;
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
      o.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },
    _noise(dur, vol, type = 'lowpass', freq = 900, slideTo = null) {
      if (!this.noise || this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = 1.1;
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },
    _fanfare(notes) {
      const t0 = this.ctx.currentTime;
      notes.forEach((f, i) => this._env(f, 0.18, 'triangle', 0.11, null, t0 + i * 0.09));
    },

    // ---------------------------------------------------------------- BGM
    _startBGM() {
      const g = this.ctx.createGain(); g.gain.value = BGM_GAIN; g.connect(this.master);
      this.bgm.gain = g;
      fetch(BGM_URL)
        .then((r) => { if (!r.ok) throw new Error('bgm missing'); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuf) => { this.bgm.buf = audioBuf; this.bgm.kind = 'file'; this._fileStart(); })
        .catch(() => { this.bgm.kind = 'synth'; this._synthStart(); });
    },
    _fileStart() {
      const b = this.bgm;
      if (!b.buf || b.src) return;
      const src = this.ctx.createBufferSource(); src.buffer = b.buf; src.loop = true; src.connect(b.gain); src.start();
      b.src = src;
    },
    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      if (b.timer) return;
      b.gain.gain.value = BGM_GAIN;
      const notes = [55, 65.41, 73.42, 82.41];
      const DUR = 0.24;
      const tick = () => {
        const when = ctx.currentTime + 0.1;
        const f = notes[b.step % notes.length];
        this._env(f, DUR, 'triangle', 0.13, null, when);
        if (b.step % 2 === 0) this._noise(0.05, 0.05, 'highpass', 4000, null);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, DUR * 1000);
    },
  };

  return A;
}
