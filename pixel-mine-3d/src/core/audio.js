// src/core/audio.js — 程序化 WebAudio 音效 + BGM（assets/audio/bgm.mp3，缺失回退合成）。
// API：unlock()/setMuted()/muted()/play(name)/event(name)/ui()/getLevel()。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.4;
const SFX_GAIN = 0.9;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, sfx: null, comp: null, analyser: null, noise: null, voices: 0,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, out: null },

    unlock() { return this.ensure(); },
    muted() { return this.muted; },

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
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -12;
      this.comp.knee.value = 20;
      this.comp.ratio.value = 12;
      this.comp.attack.value = 0.003;
      this.comp.release.value = 0.25;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.sfx.connect(this.master);            // SFX 分轨
      this.master.connect(this.comp);           // master → 压限器，峰值 ≤0.9
      this.comp.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 1.2);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._startBGM();
      return true;
    },

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

    ui() { this._envelope(520, 0.07, 'triangle', 0.08); },
    play(name) { this.event(name); },

    event(name) {
      switch (name) {
        case 'ui_click': case 'ui_back': this.ui(); break;
        case 'start': this._fanfare([392, 523.25, 659.25]); break;
        case 'block_break': this._noise({ dur: 0.18, vol: 0.2, type: 'lowpass', freq: 700, slideTo: 160 }); break;
        case 'crack': this._noise({ dur: 0.05, vol: 0.08, type: 'highpass', freq: 2200 }); break;
        case 'ore_collect': case 'pickup': this._envelope(880, 0.12, 'triangle', 0.14, 1320); break;
        case 'sell': case 'score': this._fanfare([659.25, 783.99, 1046.5]); break;
        case 'upgrade': case 'combo': this._chord([523.25, 659.25, 783.99]); break;
        case 'climb': case 'ladder_place': this._envelope(320, 0.06, 'square', 0.07); break;
        case 'stamina_low': this._envelope(220, 0.3, 'square', 0.12, 140); break;
        case 'lava_hit': case 'fail': this._descend(); break;
        case 'forced_return': this._descend(); break;
        case 'inventory_full': this._envelope(180, 0.22, 'square', 0.12, 120); break;
        case 'goal_complete': case 'depth_record': this._fanfare([523.25, 659.25, 783.99, 1046.5]); break;
        case 'gold_vein': this._chord([987.77, 1318.5]); break;
        case 'treasure_found': case 'win': case 'countdown': this._fanfare([523.25, 659.25, 783.99, 1046.5, 1318.5]); break;
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

    _envelope(freq, dur, type = 'sine', vol = 0.16, slide = null, when = null) {
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
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _chord(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._envelope(f, 0.4, i % 2 ? 'triangle' : 'sine', 0.1, null, t)); },
    _fanfare(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._envelope(f, 0.16, 'triangle', 0.13, null, t + i * 0.08)); },
    _descend() { this._envelope(400, 0.5, 'sawtooth', 0.13, 70); this._envelope(200, 0.5, 'square', 0.07, 50); },

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
      b.out = b.gain;
      if (!b.pad) {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.6;
        const padG = ctx.createGain(); padG.gain.value = 0.07;
        lp.connect(padG).connect(b.out);
        b.pad = [];
        [98, 146.83, 220, 293.66].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
          o.detune.value = i % 2 ? 4 : -4; o.connect(lp); o.start(); b.pad.push(o);
        });
      }
      this._synthStart();
    },
    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      const notes = [49, 73.42, 98, 73.42, 58.27, 87.31, 116.54, 87.31];
      const STEP_DUR = 0.24;
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
      if (b.kind === 'file' && b.src) { try { b.src.stop(); } catch { /* noop */ } b.src = null; }
      else if (b.kind === 'synth') { if (b.timer) { clearInterval(b.timer); b.timer = null; } b.gain.gain.value = 0; }
    },
  };
  return A;
}
