// src/core/audio.js — 程序化 WebAudio 音效 + AI BGM（缺失回退程序化暗噪）。
// API：unlock()/ensure()/resume()/stopAll()/setMuted()/muted()/play(name)/event(name)/ui()/setHeartbeat(level)/getLevel()。
// 必配音效（方法名=事件名）：ui_click, ui_back, start, score, hit, fail, win, combo, pickup, countdown + 游戏特有。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.35;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 8;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, analyser: null, noise: null,
    heart: null, breath: null, bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, pad: null },
    voices: 0,

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      this.sfx = ctx.createGain();
      this.sfx.gain.value = 1.0;                       // SFX 分轨音量
      this.compressor = ctx.createDynamicsCompressor(); // master 压限，峰值 ≤0.9
      this.compressor.threshold.value = -12;
      this.compressor.knee.value = 12;
      this.compressor.ratio.value = 6;
      this.compressor.attack.value = 0.003;
      this.compressor.release.value = 0.25;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(this.compressor);
      this.compressor.connect(this.analyser);
      this.analyser.connect(ctx.destination);
      const len = Math.floor(ctx.sampleRate * 1.2);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._buildHeart();
      this._buildBreath();
      this._startBGM();
      return true;
    },

    unlock() { this.ensure(); this.resume(); },
    resume() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const b = this.bgm;
      if (b.kind === 'file' && !b.src) this._fileStart();
      else if (b.kind === 'synth' && b.gain && !b.timer) this._synthStart();
    },
    stopAll() {
      if (!this.ctx) return;
      if (this.heart) this.heart.g.gain.value = 0;
      if (this.breath) this.breath.g.gain.value = 0;
      this._pauseBGM();
    },
    muted() { return this.muted; },
    setMuted(b) {
      this.muted = !!b;
      if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN;
    },

    // 心跳强度（实体距离越近越强）
    setHeartbeat(level) {
      if (!this.heart) return;
      const t = this.ctx.currentTime;
      this.heart.g.gain.setTargetAtTime(level > 0 ? 0.10 + level * 0.22 : 0, t, 0.15);
      this.heart.rate.setTargetAtTime(1.1 + level * 1.9, t, 0.2);
    },

    play(name) {
      switch (name) {
        case 'ui_click': this._env(520, 0.07, 'triangle', 0.07); break;
        case 'ui_back': this._env(300, 0.09, 'triangle', 0.07, 180); break;
        case 'start': this._chord([261.63, 329.63, 392.0]); break;
        case 'score': this._env(660, 0.12, 'square', 0.08); break;
        case 'hit': this._noise({ dur: 0.18, vol: 0.18, freq: 300, q: 1.2 }); break;
        case 'fail': this._descend(); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'combo': this._env(880, 0.16, 'triangle', 0.10, 1320); break;
        case 'pickup': this._env(520, 0.1, 'sine', 0.12, 780); break;
        case 'countdown': this._env(440, 0.09, 'square', 0.08); break;
        case 'key': this._chord([523.25, 659.25]); break;
        case 'door': this._noise({ dur: 0.4, vol: 0.16, freq: 240, slideTo: 900, q: 1.0 }); break;
        case 'battery': this._env(300, 0.14, 'sine', 0.12, 600); break;
        case 'search': this._noise({ dur: 0.3, vol: 0.12, freq: 700, slideTo: 1500, q: 1.2 }); break;
        case 'hide': this._noise({ dur: 0.2, vol: 0.1, freq: 500, q: 1.0 }); break;
        case 'caught': this._crash(); break;
        case 'generator': this._fanfare([220, 440, 660]); break;
        case 'lightsOn': this._env(1200, 0.3, 'sine', 0.10, 2400); break;
        case 'lightsOff': this._descend(); break;
        case 'flicker': this._noise({ dur: 0.1, vol: 0.12, freq: 2000, q: 2 }); break;
        case 'silhouette': this._env(80, 0.4, 'sawtooth', 0.12, 40); break;
        case 'heartbeat': break; // 由 setHeartbeat 连续驱动
        case 'breath': break;
        default: break;
      }
    },

    event(name) { this.play(name); },
    ui() { this.play('ui_click'); },

    getLevel() {
      if (!this.analyser) return { peak: 0, rms: 0 };
      const n = this.analyser.fftSize;
      const data = new Float32Array(n);
      this.analyser.getFloatTimeDomainData(data);
      let peak = 0, sum = 0;
      for (let i = 0; i < n; i++) {
        const v = data[i], a = Math.abs(v);
        if (a > peak) peak = a;
        sum += v * v;
      }
      return { peak, rms: Math.sqrt(sum / n) };
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
    _noise({ dur, vol, type = 'lowpass', freq = 900, q = 1, slideTo = null, attack = 0.005 }) {
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
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },
    _chord(notes) {
      const t = this.ctx.currentTime;
      notes.forEach((f, i) => this._env(f, 0.5, i % 2 ? 'triangle' : 'sine', 0.11, null, t));
    },
    _fanfare(notes) {
      const t0 = this.ctx.currentTime;
      notes.forEach((f, i) => this._env(f, 0.2, 'triangle', 0.13, null, t0 + i * 0.09));
    },
    _crash() {
      this._noise({ dur: 0.4, vol: 0.24, freq: 700, q: 0.8 });
      this._env(120, 0.3, 'sawtooth', 0.16, 45);
    },
    _descend() {
      this._env(520, 0.6, 'sawtooth', 0.14, 80);
      this._env(260, 0.6, 'square', 0.08, 60);
    },

    _buildHeart() {
      const ctx = this.ctx;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = 55;
      const g = ctx.createGain(); g.gain.value = 0;
      // 用 LFO 模拟心跳两声
      const lfo = ctx.createOscillator(); lfo.type = 'square'; lfo.frequency.value = 1.4;
      const lg = ctx.createGain(); lg.gain.value = 0.08;
      lfo.connect(lg); lg.connect(g.gain);
      o.connect(g).connect(this.master);
      o.start(); lfo.start();
      this.heart = { g, rate: lfo.frequency };
    },

    _buildBreath() {
      const ctx = this.ctx;
      const src = ctx.createBufferSource();
      src.buffer = this.noise; src.loop = true;
      const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 400; bp.Q.value = 0.6;
      const g = ctx.createGain(); g.gain.value = 0;
      src.connect(bp).connect(g).connect(this.master);
      src.start();
      this.breath = { g };
    },

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
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 500; lp.Q.value = 0.6;
      const padG = ctx.createGain(); padG.gain.value = 0.05;
      lp.connect(padG).connect(b.gain);
      [55, 82.41, 110, 164.81].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        o.detune.value = i % 2 ? 5 : -5;
        o.connect(lp); o.start();
      });
      this._synthStart();
    },
    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      const notes = [55, 65.41, 82.41, 65.41, 49, 58.27, 73.42, 58.27];
      const DUR = 0.5;
      const tick = () => {
        const when = ctx.currentTime + 0.12;
        const f = notes[b.step % notes.length];
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.12, when + 0.02);
        g.gain.exponentialRampToValueAtTime(0.001, when + DUR);
        o.connect(g).connect(b.gain);
        o.start(when); o.stop(when + DUR + 0.03);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, DUR * 1000);
    },
    _pauseBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && b.src) { b.src.stop(); b.src = null; }
      else if (b.kind === 'synth') { if (b.timer) { clearInterval(b.timer); b.timer = null; } b.gain.gain.value = 0; }
    },
  };

  return A;
}
