// src/core/audio.js — 程序化 WebAudio SFX + BGM（assets/audio/bgm.mp3，缺失回退合成）。
// API：unlock()/setMuted()/muted()/play(name)/event(name)/ui()/getLevel()/ensure()/resume()/stopAll()。
// master 接 DynamicsCompressor；BGM/SFX 分轨增益；静音掐断、恢复从当前位置。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.4;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, comp: null, analyser: null, noise: null,
    bgmGain: null, sfxGain: null, bgm: { kind: null, src: null, buf: null, timer: null, step: 0, pad: null },
    voices: 0, unlocked: false,

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18; this.comp.ratio.value = 6;
      this.analyser = ctx.createAnalyser(); this.analyser.fftSize = 2048;
      this.master.connect(this.comp); this.comp.connect(this.analyser); this.analyser.connect(ctx.destination);
      this.bgmGain = ctx.createGain(); this.bgmGain.gain.value = BGM_GAIN; this.bgmGain.connect(this.master);
      this.sfxGain = ctx.createGain(); this.sfxGain.gain.value = 0.9; this.sfxGain.connect(this.master);
      const len = Math.floor(ctx.sampleRate * 1.2);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      return true;
    },

    // 首次交互解锁：创建 ctx 并起播 BGM
    unlock() {
      if (!this.ensure()) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.unlocked) { this.unlocked = true; this._startBGM(); }
    },

    resume() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (!this.unlocked) { this.unlocked = true; this._startBGM(); }
    },

    stopAll() {
      if (!this.ctx) return;
      this._pauseBGM();
    },

    setMuted(b) { this.muted = !!b; if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN; },
    muted() { return this.muted; },

    play(name) {
      if (!this.ctx || !this.unlocked) return;
      switch (name) {
        case 'ui_click': this._env(600, 0.06, 'triangle', 0.10); break;
        case 'ui_back': this._env(320, 0.08, 'triangle', 0.10); break;
        case 'start': this._env(220, 0.3, 'sawtooth', 0.10, 660); break;
        case 'score': this._chime([880, 1320]); break;
        case 'hit': this._noise(0.16, 0.20, 500, 900); break;
        case 'fail': this._env(400, 0.5, 'sawtooth', 0.14, 90); break;
        case 'win': this._fanfare([523.25, 659.25, 783.99, 1046.5]); break;
        case 'combo': this._chime([660, 990, 1320]); break;
        case 'pickup': this._env(880, 0.09, 'sine', 0.14, 1760); break;
        case 'countdown': this._env(440, 0.08, 'square', 0.10); break;
        case 'dig': this._noise(0.2, 0.22, 300, 800); break;
        case 'place': this._env(180, 0.09, 'square', 0.12, 90); break;
        case 'feed': this._chime([660, 880]); break;
        case 'harvest': this._env(520, 0.1, 'sine', 0.14, 1040); break;
        case 'produce': this._chime([523.25, 783.99]); break;
        case 'goal_complete': this._fanfare([659.25, 783.99, 987.77]); break;
        case 'day': this._chime([392, 523.25, 659.25]); break;
        case 'peacock_fan': this._chime([660, 880, 1100, 1320]); break;
        case 'gold_egg': this._env(1320, 0.3, 'sine', 0.14, 1980); break;
        case 'collapse': this._env(300, 0.6, 'sawtooth', 0.14, 70); break;
        default: break;
      }
    },

    // 事件总线 → SFX 名
    event(name) {
      const map = { dig: 'dig', place: 'place', feed: 'feed', harvest: 'harvest', produce: 'produce', goal_complete: 'goal_complete', day: 'day', peacock_fan: 'peacock_fan', gold_egg: 'gold_egg', win: 'win', collapse: 'collapse', start: 'start' };
      if (map[name]) this.play(map[name]);
    },

    ui() { this.play('ui_click'); },
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
    _env(freq, dur, type, vol, slide = null, when = null) {
      if (this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = when != null ? when : this.ctx.currentTime;
      const o = this.ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.sfxGain);
      o.start(t); o.stop(t + dur + 0.05);
      o.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },
    _noise(dur, vol, freq, slideTo = null) {
      if (this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = 1.2;
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.sfxGain);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },
    _chime(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.18, 'triangle', 0.11, null, t + i * 0.07)); },
    _fanfare(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.2, 'triangle', 0.12, null, t + i * 0.09)); },

    // ---------------------------------------------------------------- BGM
    _startBGM() {
      if (this.bgm.kind) { this._resumeBGM(); return; }
      fetch(BGM_URL)
        .then((r) => { if (!r.ok) throw new Error('missing'); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuf) => { this.bgm.kind = 'file'; this.bgm.buf = audioBuf; this._fileStart(); })
        .catch(() => this._synthStart());
    },
    _fileStart() {
      if (!this.bgm.buf || this.bgm.src) return;
      const src = this.ctx.createBufferSource(); src.buffer = this.bgm.buf; src.loop = true;
      src.connect(this.bgmGain); src.start(); this.bgm.src = src;
    },
    _resumeBGM() {
      if (this.bgm.kind === 'file' && !this.bgm.src) this._fileStart();
      else if (this.bgm.kind === 'synth' && !this.bgm.timer) this._synthLoop();
    },
    _synthStart() {
      if (this.bgm.kind === 'synth') return;
      this.bgm.kind = 'synth';
      if (!this.bgm.pad) {
        const lp = this.ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.5;
        const padG = this.ctx.createGain(); padG.gain.value = 0.07;
        lp.connect(padG).connect(this.bgmGain);
        this.bgm.pad = [];
        [130.81, 196.0, 261.63, 329.63].forEach((f) => {
          const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f; o.connect(lp); o.start();
          this.bgm.pad.push(o);
        });
      }
      this._synthLoop();
    },
    _synthLoop() {
      if (this.bgm.timer) return;
      const notes = [65.41, 98.0, 130.81, 98.0, 73.42, 110.0, 146.83, 110.0];
      const STEP_DUR = 0.25;
      const tick = () => {
        const when = this.ctx.currentTime + 0.12;
        const f = notes[this.bgm.step % notes.length];
        const o = this.ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = this.ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.14, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, when + STEP_DUR);
        o.connect(g).connect(this.bgmGain);
        o.start(when); o.stop(when + STEP_DUR + 0.03);
        this.bgm.step++;
      };
      tick();
      this.bgm.timer = setInterval(tick, STEP_DUR * 1000);
    },
    _pauseBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && b.src) { b.src.stop(); b.src = null; }
      else if (b.kind === 'synth' && b.timer) { clearInterval(b.timer); b.timer = null; }
    },
  };

  return A;
}
