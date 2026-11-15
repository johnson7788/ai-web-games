// src/core/audio.js — 程序化 WebAudio SFX + AI BGM 接线（assets/audio/bgm.mp3 缺失回退程序化）。
// 契约（audio-plan.md）：unlock()/setMuted()/muted()/play(name)；额外 event(name) 接事件总线、getLevel() 供自检。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.4;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, sfx: null, analyser: null, noise: null, voices: 0,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, pad: null, out: null },

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      this.sfx = ctx.createGain(); // SFX 分轨：BGM 走 bgm.gain，SFX 走这里，master 统一限幅
      this.sfx.gain.value = 1;
      this.sfx.connect(this.master);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      const comp = ctx.createDynamicsCompressor();
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

    unlock() { return this.ensure(); },

    resume() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const b = this.bgm;
      if (b.kind === 'file' && !b.src) this._fileStart();
      else if (b.kind === 'synth' && !b.timer) this._synthStart();
    },

    stopAll() {
      if (!this.ctx) return;
      if (this.bgm.kind === 'file' && this.bgm.src) { try { this.bgm.src.stop(); } catch {} this.bgm.src = null; }
      else if (this.bgm.kind === 'synth') { if (this.bgm.timer) clearInterval(this.bgm.timer); this.bgm.timer = null; }
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
      for (let i = 0; i < n; i++) { const a = Math.abs(data[i]); if (a > peak) peak = a; sum += data[i] * data[i]; }
      return { peak, rms: Math.sqrt(sum / n) };
    },

    // 事件总线 → SFX
    event(name) {
      const map = {
        shot: 'shot', hit: 'hit', kill: 'kill', deathBox: 'deathBox', blockBreak: 'blockBreak',
        build: 'build', pickup: 'pickup', zone: 'zone', airdrop: 'airdrop', land: 'land',
        reload: 'reload', heal: 'heal', dead: 'fail', win: 'win', combo: 'combo', score: 'score',
      };
      this.play(map[name] || null);
    },

    ui() { this.play('ui_click'); },

    play(name) {
      if (!this.ctx) return;
      switch (name) {
        case 'ui_click': this._env(520, 0.07, 'triangle', 0.08); break;
        case 'ui_back': this._env(320, 0.07, 'triangle', 0.07); break;
        case 'start': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'countdown': this._env(880, 0.12, 'square', 0.09); break;
        case 'score': this._env(1046, 0.14, 'triangle', 0.1, 1568); break;
        case 'combo': this._env(1318, 0.12, 'triangle', 0.1, 2093); break;
        case 'hit': this._env(220, 0.05, 'square', 0.08, 110); break;
        case 'shot': this._noise({ dur: 0.1, vol: 0.14, type: 'highpass', freq: 1800 }); break;
        case 'kill': this._chord([392, 523.25, 659.25]); break;
        case 'deathBox': this._env(180, 0.25, 'sine', 0.12, 60); break;
        case 'blockBreak': this._noise({ dur: 0.16, vol: 0.12, type: 'lowpass', freq: 600, slideTo: 200 }); break;
        case 'build': this._env(200, 0.09, 'square', 0.1, 320); break;
        case 'pickup': this._env(660, 0.1, 'triangle', 0.1, 990); break;
        case 'zone': this._env(440, 0.4, 'sawtooth', 0.07, 220); break;
        case 'airdrop': this._env(330, 0.5, 'sawtooth', 0.08, 660); break;
        case 'land': this._noise({ dur: 0.12, vol: 0.1, type: 'lowpass', freq: 400 }); break;
        case 'reload': this._env(600, 0.05, 'square', 0.07, 400); break;
        case 'heal': this._env(740, 0.2, 'sine', 0.08, 880); break;
        case 'fail': this._descend(); break;
        case 'win': this._fanfare([523.25, 659.25, 783.99, 1046.5]); break;
        default: break;
      }
    },

    // ---------------- 内部 ----------------
    _env(freq, dur, type, vol, slide) {
      if (!this.ctx || this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
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
    _noise({ dur, vol, type, freq, slideTo }) {
      if (!this.ctx || !this.noise || this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = 1;
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },
    _chord(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.4, i % 2 ? 'triangle' : 'sine', 0.1, null)); },
    _fanfare(notes) { const t0 = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.2, 'triangle', 0.12, null)); },
    _descend() { this._env(520, 0.6, 'sawtooth', 0.12, 80); this._env(260, 0.6, 'square', 0.08, 60); },

    // ---------------- BGM ----------------
    _startBGM() {
      const g = this.ctx.createGain(); g.gain.value = BGM_GAIN; g.connect(this.master);
      this.bgm.gain = g;
      fetch(BGM_URL)
        .then((r) => { if (!r.ok) throw new Error('bgm missing'); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuf) => { this.bgm.buf = audioBuf; this.bgm.kind = 'file'; if (this.ctx.state === 'running') this._fileStart(); })
        .catch(() => { this._playSynth(); });
    },
    _fileStart() {
      const b = this.bgm;
      if (!b.buf || b.src) return;
      const src = this.ctx.createBufferSource(); src.buffer = b.buf; src.loop = true; src.connect(b.gain); src.start();
      b.src = src;
    },
    _playSynth() {
      const b = this.bgm, ctx = this.ctx;
      if (b.kind === 'synth') return;
      b.kind = 'synth'; b.out = b.gain;
      if (!b.pad) {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.6;
        const padG = ctx.createGain(); padG.gain.value = 0.08;
        lp.connect(padG).connect(b.out);
        b.pad = [];
        [110, 146.83, 220, 293.66].forEach((f, i) => { const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = i % 2 ? 5 : -5; o.connect(lp); o.start(); b.pad.push(o); });
      }
      if (!b.timer) this._synthStart();
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
        o.connect(g).connect(b.out);
        o.start(when); o.stop(when + STEP_DUR + 0.03);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, STEP_DUR * 1000);
    },
  };

  return A;
}
