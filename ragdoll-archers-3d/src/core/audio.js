// src/core/audio.js — 程序化 WebAudio SFX + AI BGM（assets/audio/bgm.mp3 缺失回退程序化）。
// 契约：ensure/unlock/setMuted/muted/play(name)/event(name)/resume/stopAll/getLevel。
// play(name) 与 event(name) 等价；事件名来自 src/game 事件总线（draw/shot/hit/kill/...）。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.4;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 8;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, sfx: null, analyser: null, noise: null,
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
      this.master.connect(comp);
      // SFX 分轨：独立于 BGM 的音量总线（BGM 走 bgm.gain），master 统一过压缩器
      this.sfx = ctx.createGain(); this.sfx.gain.value = 1; this.sfx.connect(this.master);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      comp.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 1.0);
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
      if (b.kind === 'file' && b.buf && !b.src) this._fileStart();
      else if (b.kind === 'synth' && b.gain) { b.gain.gain.value = BGM_GAIN; if (!b.timer) this._synthStart(); }
    },
    stopAll() {
      if (!this.ctx) return;
      this._pauseBGM();
    },
    muted() { return this.muted; },
    setMuted(b) {
      this.muted = !!b;
      if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN;
    },

    event(name) { this.play(name); },
    play(name) {
      switch (name) {
        case 'ui_click': this._env(560, 0.06, 'triangle', 0.08); break;
        case 'ui_back': this._env(320, 0.08, 'triangle', 0.08, 220); break;
        case 'start': this._chord([261.63, 329.63, 392.0]); break;
        case 'countdown': this._env(660, 0.09, 'square', 0.08); break;
        case 'draw': this._noise({ dur: 0.25, vol: 0.10, type: 'bandpass', freq: 300, slideTo: 1200, q: 2 }); break;
        case 'shot': this._noise({ dur: 0.18, vol: 0.22, type: 'bandpass', freq: 1800, slideTo: 400, q: 1.5 }); break;
        case 'enemy_shot': this._noise({ dur: 0.16, vol: 0.14, type: 'bandpass', freq: 1400, slideTo: 500, q: 1.5 }); break;
        case 'arrow_hit': this._noise({ dur: 0.22, vol: 0.28, type: 'lowpass', freq: 800, q: 0.8 }); break;
        case 'hit': this._env(220, 0.12, 'sawtooth', 0.16, 90); break;
        case 'combo': this._env(880, 0.1, 'square', 0.1); break;
        case 'score': this._chord([523.25, 659.25, 783.99]); break;
        case 'ragdoll': this._noise({ dur: 0.5, vol: 0.26, type: 'lowpass', freq: 500, slideTo: 120, q: 0.7 }); this._env(160, 0.4, 'sine', 0.16, 55); break;
        case 'heart_lost': this._descend(); break;
        case 'wind': this._noise({ dur: 0.5, vol: 0.08, type: 'bandpass', freq: 500, slideTo: 900, q: 0.6 }); break;
        case 'kill': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'level_clear': this._chord([392, 523.25, 659.25]); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99, 1046.5]); break;
        case 'fail': this._descend(); break;
        case 'pickup': this._env(700, 0.08, 'triangle', 0.1, 1000); break;
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

    // ------------------------------------------------ 内部
    _env(freq, dur, type = 'sine', vol = 0.14, slide = null, when = null) {
      if (!this.ctx || this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = when != null ? when : this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
      const g = this.ctx.createGain();
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
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },
    _chord(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.35, i % 2 ? 'triangle' : 'sine', 0.1, null, t)); },
    _fanfare(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.18, 'triangle', 0.12, null, t + i * 0.09)); },
    _descend() { this._env(520, 0.5, 'sawtooth', 0.12, 90); this._env(260, 0.5, 'square', 0.06, 60); },

    // ------------------------------------------------ BGM
    _startBGM() {
      const g = this.ctx.createGain(); g.gain.value = BGM_GAIN; g.connect(this.master);
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
      const src = this.ctx.createBufferSource(); src.buffer = b.buf; src.loop = true; src.connect(b.gain); src.start();
      b.src = src;
    },
    _playBGMSynth() {
      const b = this.bgm;
      if (b.kind === 'synth') return;
      b.kind = 'synth';
      this._synthStart();
    },
    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      const notes = [110, 130.81, 164.81, 130.81, 98, 123.47, 146.83, 123.47];
      const STEP_DUR = 0.28;
      const tick = () => {
        const when = ctx.currentTime + 0.12;
        const f = notes[b.step % notes.length];
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.12, when + 0.02);
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
      if (b.kind === 'file' && b.src) { try { b.src.stop(); } catch {} b.src = null; }
      else if (b.kind === 'synth') { if (b.timer) { clearInterval(b.timer); b.timer = null; } b.gain.gain.value = 0; }
    },
  };

  return A;
}
