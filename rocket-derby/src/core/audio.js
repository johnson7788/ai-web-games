// src/core/audio.js — 程序化 SFX + AI BGM（assets/audio/bgm.mp3 缺失回退程序化）。
// API 契约（audio-plan.md）：unlock() / setMuted() / muted() / play(name)。
// master 接 DynamicsCompressor，峰值 ≤0.9。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.42;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    _muted: false,
    ctx: null, master: null, noise: null, voices: 0,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0 },

    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        const ctx = new AC();
        this.ctx = ctx;
        this.master = ctx.createGain();
        this.master.gain.value = this._muted ? 0 : MASTER_GAIN;
        this.sfx = ctx.createGain(); this.sfx.connect(this.master);
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.knee.value = 24; comp.ratio.value = 8;
        this.master.connect(comp); comp.connect(ctx.destination);
        const len = Math.floor(ctx.sampleRate * 1.0);
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
        this._startBGM();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this._resumeBGM();
      return true;
    },

    muted() { return this._muted; },

    setMuted(b) {
      this._muted = !!b;
      if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN;
    },

    stopAll() { this._pauseBGM(); },

    play(name) {
      switch (name) {
        case 'ui_click': this._env(520, 0.07, 'triangle', 0.08); break;
        case 'ui_back': this._env(360, 0.09, 'triangle', 0.07); break;
        case 'start': this._fanfare([261.63, 329.63, 392.0]); break;
        case 'countdown': this._env(660, 0.08, 'square', 0.09); break;
        case 'kickoff': this._fanfare([392.0, 523.25]); break;
        case 'boostStart': this._env(180, 0.5, 'sawtooth', 0.12, 900); break;
        case 'hit': this._noise(0.16, 0.18, 900, 1800); break;
        case 'score':
        case 'goal': this._fanfare([523.25, 659.25, 783.99, 1046.5]); break;
        case 'concede':
        case 'fail': this._descend(); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99, 1046.5]); break;
        case 'combo': this._env(880, 0.14, 'square', 0.1, 1320); break;
        case 'pickup': this._chord([523.25, 783.99]); break;
        case 'aerial': this._env(700, 0.3, 'sine', 0.12, 1400); break;
        case 'demo': this._noise(0.3, 0.22, 500, 120); break;
        case 'overtime': this._env(440, 0.5, 'square', 0.1, 880); break;
        default: break;
      }
    },

    // ---------------------------------------------------------------- 内部
    _env(freq, dur, type = 'sine', vol = 0.14, slide = null, when = null) {
      if (!this.ctx || this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = when != null ? when : this.ctx.currentTime;
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + dur + 0.05);
      o.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _noise(dur, vol, freq, slideTo) {
      if (!this.ctx || !this.noise || this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = 1.2;
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.008);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _fanfare(notes) {
      const t0 = this.ctx ? this.ctx.currentTime : 0;
      notes.forEach((f, i) => this._env(f, 0.2, 'triangle', 0.13, null, t0 + i * 0.1));
    },
    _chord(notes) {
      const t0 = this.ctx ? this.ctx.currentTime : 0;
      notes.forEach((f) => this._env(f, 0.35, 'sine', 0.1, null, t0));
    },
    _descend() {
      this._env(500, 0.5, 'sawtooth', 0.12, 90);
      this._env(250, 0.5, 'square', 0.07, 60);
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
        .then((audioBuf) => { this.bgm.buf = audioBuf; this.bgm.kind = 'file'; this._resumeBGM(); })
        .catch(() => this._playBGMSynth());
    },

    _resumeBGM() {
      const b = this.bgm;
      if (b.kind === 'file') {
        if (b.buf && !b.src) {
          const src = this.ctx.createBufferSource();
          src.buffer = b.buf; src.loop = true;
          src.connect(b.gain); src.start();
          b.src = src;
        }
      } else if (b.kind === 'synth' && b.gain) {
        b.gain.gain.value = BGM_GAIN;
        if (!b.timer) this._synthStart();
      }
    },

    _pauseBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && b.src) { try { b.src.stop(); } catch {} b.src = null; }
      else if (b.kind === 'synth') {
        if (b.timer) { clearInterval(b.timer); b.timer = null; }
        b.gain.gain.value = 0;
      }
    },

    _playBGMSynth() {
      const b = this.bgm, ctx = this.ctx;
      if (b.kind === 'synth') return;
      b.kind = 'synth';
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.6;
      const padG = ctx.createGain(); padG.gain.value = 0.07;
      lp.connect(padG).connect(b.gain);
      b.pad = [];
      [110, 164.81, 220, 329.63].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        o.detune.value = i % 2 ? 4 : -4;
        o.connect(lp); o.start();
        b.pad.push(o);
      });
      this._resumeBGM();
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
        o.connect(g).connect(b.gain);
        o.start(when); o.stop(when + STEP_DUR + 0.03);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, STEP_DUR * 1000);
    },
  };

  return A;
}
