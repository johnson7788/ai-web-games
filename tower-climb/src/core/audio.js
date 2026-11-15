// src/core/audio.js — 程序化 WebAudio SFX + AI BGM（缺失回退 synthwave 琶音）。
// API：ensure / resume / stopAll / event(name) / ui / setMuted / getLevel。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.4;
const SFX_GAIN = 0.9;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 8;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, sfx: null, analyser: null, noise: null,
    bgm: { kind: null, gain: null, buf: null, src: null, offset: 0, startedAt: 0, timer: null, step: 0, pad: null, out: null },
    wind: null,
    voices: 0,

    // audio-plan.md 契约别名
    unlock() { return this.ensure(); },
    muted() { return this.muted; },
    play(name) { this.event(name); },

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      this.sfx = ctx.createGain();
      this.sfx.gain.value = SFX_GAIN;
      this.sfx.connect(this.master);
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -14; comp.knee.value = 24; comp.ratio.value = 8;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(comp).connect(this.analyser).connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 1.2);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._buildWind();
      this._startBGM();
      return true;
    },

    resume() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this._resumeBGM();
    },

    stopAll() { if (this.ctx) this._pauseBGM(); if (this.wind) this.wind.g.gain.value = 0; },

    setWind(on) {
      if (!this.wind) return;
      const t = this.ctx.currentTime;
      this.wind.g.gain.setTargetAtTime(on ? 0.12 : 0, t, 0.3);
      this.wind.bp.frequency.setTargetAtTime(on ? 700 : 240, t, 0.5);
    },

    event(name) {
      switch (name) {
        case 'start': case 'ui_click': this._env(520, 0.07, 'triangle', 0.09); break;
        case 'jump': this._env(300, 0.16, 'square', 0.09, 620); break;
        case 'land': this._noise({ dur: 0.09, vol: 0.1, type: 'lowpass', freq: 500 }); break;
        case 'dash': this._noise({ dur: 0.22, vol: 0.14, type: 'bandpass', freq: 900, slideTo: 2600, q: 1.2 }); break;
        case 'crumble': this._descend(); break;
        case 'checkpoint': this._chord([261.63, 392.0, 523.25]); break;
        case 'fall': this._noise({ dur: 1.1, vol: 0.22, type: 'bandpass', freq: 200, slideTo: 1400, q: 0.8 }); break;
        case 'level_up': this._env(660, 0.12, 'triangle', 0.1, 880); break;
        case 'wind_gust': this._noise({ dur: 0.7, vol: 0.12, type: 'bandpass', freq: 400, slideTo: 1500, q: 0.9 }); break;
        case 'win': case 'won': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        default: break;
      }
    },

    ui() { this._env(520, 0.07, 'triangle', 0.07); },

    setMuted(b) {
      this.muted = !!b;
      if (!this.ctx) return;
      if (this.muted) {
        this._pauseBGM();
        this.master.gain.value = 0;
      } else {
        this.master.gain.value = MASTER_GAIN;
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
      if (!this.ctx) return;
      if (this.voices >= MAX_VOICES) return;
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

    _descend() { this._env(520, 0.5, 'sawtooth', 0.13, 70); this._env(260, 0.5, 'square', 0.07, 55); },

    _buildWind() {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass'; bp.frequency.value = 240; bp.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp).connect(g).connect(this.sfx);
      src.start();
      this.wind = { g, bp };
    },

    _chord(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.5, i % 2 ? 'triangle' : 'sine', 0.11, null, t)); },

    _fanfare(notes) { const t0 = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.2, 'triangle', 0.13, null, t0 + i * 0.09)); },

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
      const b = this.bgm;
      b.buf = audioBuf; b.kind = 'file'; b.offset = 0;
      this._resumeBGM();
    },

    _fileStart(offset = 0) {
      const b = this.bgm;
      if (!b.buf || b.src || this.muted) return;
      const src = this.ctx.createBufferSource();
      src.buffer = b.buf; src.loop = true;
      src.connect(b.gain);
      const at = offset % b.buf.duration;
      src.start(0, at);
      b.src = src; b.startedAt = this.ctx.currentTime; b.offset = at;
    },

    _playBGMSynth() {
      const b = this.bgm, ctx = this.ctx;
      if (b.kind === 'synth') return;
      b.kind = 'synth';
      b.out = b.gain;
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
      if (b.kind === 'file' && b.src) {
        b.offset = (b.offset + (this.ctx.currentTime - b.startedAt)) % b.buf.duration;
        try { b.src.stop(); } catch { /* 已停 */ }
        b.src = null;
      } else if (b.kind === 'synth') {
        if (b.timer) { clearInterval(b.timer); b.timer = null; }
        b.gain.gain.value = 0;
      }
    },

    _resumeBGM() {
      const b = this.bgm;
      if (this.muted) return;
      if (b.kind === 'file') this._fileStart(b.offset || 0);
      else if (b.kind === 'synth' && b.gain) {
        b.gain.gain.value = BGM_GAIN;
        if (!b.timer) this._synthStart();
      }
    },
  };
  return A;
}
