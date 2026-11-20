// src/core/audio.js — 全程序化 WebAudio SFX + AI BGM（缺失回退程序化）。契约见 tools/artgen/audio-plan.md。
const BGM_URL = 'assets/audio/bgm_main.mp3';
const BGM_GAIN = 0.42;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    _muted: false,
    ctx: null, master: null, analyser: null, noise: null,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, offset: 0, startedAt: 0 },
    voices: 0,

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this._muted ? 0 : MASTER_GAIN;
      this.sfx = ctx.createGain();
      this.sfx.gain.value = 1.0;
      const comp = ctx.createDynamicsCompressor();
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.sfx.connect(this.master);
      this.master.connect(comp).connect(this.analyser).connect(ctx.destination);
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
      this._resumeBGM();
    },
    _resumeBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && !b.src) this._fileStart();
      else if (b.kind === 'synth' && b.gain) { b.gain.gain.value = BGM_GAIN; if (!b.timer) this._synthStart(); }
    },
    stopAll() { if (!this.ctx) return; this._pauseBGM(); },
    muted() { return this._muted; },
    setMuted(b) {
      this._muted = !!b;
      if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN;
      if (!this.ctx) return;
      if (b) this._pauseBGM(); else this._resumeBGM();
    },

    getLevel() {
      if (!this.analyser) return { peak: 0, rms: 0 };
      const n = this.analyser.fftSize;
      const data = new Float32Array(n);
      this.analyser.getFloatTimeDomainData(data);
      let peak = 0, sum = 0;
      for (let i = 0; i < n; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; sum += data[i] * data[i]; }
      return { peak, rms: Math.sqrt(sum / n) };
    },

    // 通用音效入口：play(name) / event(name)
    play(name) { this.event(name); },
    event(name) {
      switch (name) {
        case 'ui_click': case 'ui': this._env(520, 0.07, 'triangle', 0.07); break;
        case 'ui_back': this._env(330, 0.09, 'triangle', 0.07); break;
        case 'start': this._fanfare([392, 523.25, 659.25]); break;
        case 'countdown': this._env(660, 0.06, 'square', 0.06); break;
        case 'build': this._env(180, 0.16, 'triangle', 0.14, 90); break;
        case 'upgrade': this._fanfare([523.25, 659.25, 783.99]); break;
        case 'sell': this._env(240, 0.12, 'square', 0.09, 120); break;
        case 'shoot': this._env(880, 0.06, 'square', 0.05, 200); break;
        case 'arrow_hit': case 'hit': this._noise({ dur: 0.1, vol: 0.12, type: 'bandpass', freq: 1600, q: 1.2 }); break;
        case 'aoe': this._noise({ dur: 0.3, vol: 0.2, type: 'lowpass', freq: 500, q: 0.8 }); break;
        case 'slow': this._env(1200, 0.18, 'sine', 0.1, 400); break;
        case 'wall_break': this._noise({ dur: 0.28, vol: 0.18, type: 'lowpass', freq: 300, q: 0.7 }); break;
        case 'core_hit': this._env(90, 0.3, 'sawtooth', 0.18, 45); break;
        case 'score': this._env(1046, 0.12, 'triangle', 0.12); break;
        case 'combo': this._env(1200, 0.08, 'square', 0.09); break;
        case 'pickup': this._env(760, 0.08, 'sine', 0.1); break;
        case 'wave': this._fanfare([330, 440]); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99, 1046.5]); break;
        case 'fail': this._descend(); break;
        default: break;
      }
    },

    // ---------------------------------------------------------------- 内部
    _env(freq, dur, type = 'sine', vol = 0.16, slide = null, when = null) {
      if (!this.ctx || this.voices >= MAX_VOICES) return;
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
    _noise({ dur, vol, type = 'lowpass', freq = 900, q = 1, slideTo = null }) {
      if (!this.ctx || !this.noise || this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },
    _fanfare(notes) {
      const t0 = this.ctx ? this.ctx.currentTime : 0;
      notes.forEach((f, i) => this._env(f, 0.18, 'triangle', 0.13, null, t0 + i * 0.09));
    },
    _descend() {
      this._env(520, 0.6, 'sawtooth', 0.14, 80);
      this._env(260, 0.6, 'square', 0.08, 60);
    },

    // ---------------------------------------------------------------- BGM
    _startBGM() {
      const g = this.ctx.createGain();
      g.gain.value = BGM_GAIN;
      g.connect(this.master);
      this.bgm.gain = g;
      fetch(BGM_URL)
        .then((r) => { if (!r.ok) throw new Error('bgm missing'); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuf) => { this.bgm.buf = audioBuf; this.bgm.kind = 'file'; if (!this._muted) this._fileStart(); })
        .catch(() => this._playBGMSynth());
    },
    _fileStart() {
      const b = this.bgm;
      if (!b.buf || b.src) return;
      const src = this.ctx.createBufferSource();
      src.buffer = b.buf; src.loop = true;
      src.connect(b.gain);
      src.start(0, b.offset % b.buf.duration);
      b.startedAt = this.ctx.currentTime;
      b.src = src;
    },
    _playBGMSynth() {
      const b = this.bgm, ctx = this.ctx;
      if (b.kind === 'synth') return;
      b.kind = 'synth';
      b.out = b.gain;
      [110, 130.81, 164.81, 196].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        o.detune.value = i % 2 ? 4 : -4;
        const og = ctx.createGain(); og.gain.value = 0.05;
        o.connect(og).connect(b.out); o.start();
      });
      this._synthStart();
    },
    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      const notes = [65.41, 82.41, 98, 82.41, 73.42, 87.31, 110, 87.31];
      const D = 0.24;
      const tick = () => {
        const when = ctx.currentTime + 0.12;
        const f = notes[b.step % notes.length];
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.12, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, when + D);
        o.connect(g).connect(b.out);
        o.start(when); o.stop(when + D + 0.03);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, D * 1000);
    },
    _pauseBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && b.src) {
        b.offset = (b.offset + (this.ctx.currentTime - b.startedAt)) % b.buf.duration;
        try { b.src.stop(); } catch {} b.src = null;
      } else if (b.kind === 'synth') {
        if (b.timer) { clearInterval(b.timer); b.timer = null; }
        b.gain.gain.value = 0;
      }
    },
  };

  return A;
}
