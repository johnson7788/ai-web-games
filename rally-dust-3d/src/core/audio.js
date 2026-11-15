// src/core/audio.js — 全程序化 WebAudio + AI BGM（M4）。
// API（audio-plan.md 方法名）：unlock()/setMuted(b)/muted()/play(name)；另暴露 ensure/resume/stopAll/setEngine/setSkid/event/ui/beep。
// 游戏特有事件音效按 src/game 事件总线补齐（drift/hit/paceNote/…）。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.42;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, analyser: null, noise: null,
    engine: null, skid: null,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, pad: null, out: null, offset: 0, startedAt: 0 },
    voices: 0,

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      this.compressor = ctx.createDynamicsCompressor();
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 20;
      this.compressor.ratio.value = 8;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
      this.sfx = ctx.createGain();
      this.sfx.gain.value = 1;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      this.sfx.connect(this.master);

      const len = Math.floor(ctx.sampleRate * 1.2);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this._buildEngine();
      this._buildSkid();
      this._startBGM();
      return true;
    },

    unlock() { this.ensure(); this.resume(); },

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
      this._pauseBGM();
    },

    setEngine(r) {
      if (!this.engine) return;
      const t = this.ctx.currentTime;
      const f = 46 + r * 120;
      this.engine.o1.frequency.setTargetAtTime(f, t, 0.06);
      this.engine.o2.frequency.setTargetAtTime(f * 1.5, t, 0.06);
      this.engine.lp.frequency.setTargetAtTime(520 + r * 1500, t, 0.08);
      this.engine.g.gain.setTargetAtTime(0.04 + r * 0.055, t, 0.12);
    },

    setSkid(on, i = 1) {
      if (!this.skid) return;
      const t = this.ctx.currentTime;
      this.skid.g.gain.setTargetAtTime(on ? 0.035 * i : 0, t, 0.05);
      this.skid.bp.frequency.setTargetAtTime(1500 + i * 900, t, 0.1);
    },

    muted() { return this.muted; },

    ui() { this._envelope(520, 0.07, 'triangle', 0.07); },
    beep(green) { this._envelope(green ? 880 : 440, green ? 0.3 : 0.14, 'square', 0.1); },

    play(name) { this.event(name); },

    event(name) {
      switch (name) {
        case 'ui_click': case 'ui': this._envelope(520, 0.07, 'triangle', 0.07); break;
        case 'ui_back': this._envelope(340, 0.09, 'triangle', 0.07); break;
        case 'start': this._fanfare([392, 523.25, 659.25]); break;
        case 'score': case 'pacePerfect': this._envelope(880, 0.12, 'triangle', 0.09, 1320); break;
        case 'combo': this._envelope(660, 0.1, 'square', 0.08); break;
        case 'pickup': this._envelope(720, 0.1, 'sine', 0.1, 1080); break;
        case 'countdown': this._envelope(440, 0.12, 'square', 0.1); break;
        case 'hit': this._crash(); break;
        case 'fail': case 'busted': this._descend(); break;
        case 'win': case 'finished': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'stageClear': this._fanfare([392, 523.25, 659.25]); break;
        case 'driftStart': this._noise({ dur: 0.4, vol: 0.14, type: 'bandpass', freq: 500, slideTo: 2200, q: 1.2, attack: 0.05 }); break;
        case 'driftTick': this._envelope(1200, 0.05, 'square', 0.05); break;
        case 'paceNote': this._envelope(700, 0.12, 'triangle', 0.11, 900); break;
        case 'offTrack': this._noise({ dur: 0.3, vol: 0.12, type: 'lowpass', freq: 500, q: 0.8 }); break;
        default: break;
      }
    },

    setMuted(b) {
      this.muted = !!b;
      if (!this.ctx) return;
      if (b) { this.master.gain.value = 0; this._pauseBGM(); }
      else { this.master.gain.value = MASTER_GAIN; this.resume(); }
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

    _buildEngine() {
      const ctx = this.ctx;
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 3.2;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 52;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 78;
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(this.sfx);
      o1.start(); o2.start();
      this.engine = { o1, o2, lp, g };
    },

    _buildSkid() {
      const ctx = this.ctx;
      const src = ctx.createBufferSource(); src.buffer = this.noise; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1800; bp.Q.value = 1.1;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp).connect(g).connect(this.sfx);
      src.start();
      this.skid = { g, bp };
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
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _crash() {
      this._noise({ dur: 0.32, vol: 0.22, type: 'lowpass', freq: 900, q: 0.8 });
      this._envelope(90, 0.28, 'sine', 0.18, 45);
    },

    _descend() {
      this._envelope(520, 0.6, 'sawtooth', 0.14, 80);
      this._envelope(260, 0.6, 'square', 0.08, 60);
    },

    _fanfare(notes) {
      const t0 = this.ctx.currentTime;
      notes.forEach((f, i) => this._envelope(f, 0.18, 'triangle', 0.13, null, t0 + i * 0.09));
    },

    _startBGM() {
      const g = this.ctx.createGain(); g.gain.value = BGM_GAIN; g.connect(this.master);
      this.bgm.gain = g;
      fetch(BGM_URL)
        .then((r) => { if (!r.ok) throw new Error('bgm missing'); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuf) => this._playBGMFile(audioBuf))
        .catch(() => this._playBGMSynth());
    },

    _playBGMFile(audioBuf) { this.bgm.buf = audioBuf; this.bgm.kind = 'file'; if (!this.muted) this._fileStart(); },

    _fileStart() {
      const b = this.bgm;
      if (!b.buf || b.src) return;
      const src = this.ctx.createBufferSource(); src.buffer = b.buf; src.loop = true; src.connect(b.gain);
      src.start(0, b.offset % b.buf.duration);
      b.src = src; b.startedAt = this.ctx.currentTime;
    },

    _fileStop() {
      const b = this.bgm;
      if (!b.src) return;
      b.offset = ((b.offset || 0) + this.ctx.currentTime - (b.startedAt || this.ctx.currentTime)) % b.buf.duration;
      try { b.src.stop(); } catch { /* 已停 */ }
      b.src = null;
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
          o.detune.value = i % 2 ? 4 : -4; o.connect(lp); o.start();
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
      if (b.kind === 'file') this._fileStop();
      else if (b.kind === 'synth') {
        if (b.timer) { clearInterval(b.timer); b.timer = null; }
        b.gain.gain.value = 0;
      }
    },
  };
  return A;
}
