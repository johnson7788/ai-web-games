// src/core/audio.js — 全程序化 WebAudio SFX + AI BGM（assets/audio/bgm.mp3，缺失回退程序化合成）。
// 契约：unlock/ensure/resume/stopAll/setMuted/muted/play(name)/event(name)/ui/getLevel。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.5;
const MASTER_GAIN = 0.85;
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
      this.sfx = ctx.createGain(); // SFX 分轨，与 BGM 独立
      this.sfx.gain.value = 1.0;
      this.sfx.connect(this.master);
      const comp = ctx.createDynamicsCompressor();
      this.master.connect(comp);
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
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
      if (b.kind === 'file' && b.buf && !b.src) this._fileStart();
      else if (b.kind === 'synth' && b.gain && !b.timer) this._synthStart();
    },
    stopAll() {
      if (!this.ctx) return;
      this._pauseBGM();
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
      for (let i = 0; i < n; i++) { const v = data[i], a = Math.abs(v); if (a > peak) peak = a; sum += v * v; }
      return { peak, rms: Math.sqrt(sum / n) };
    },

    play(name) { this.event(name); },
    ui() { this._envelope(520, 0.07, 'triangle', 0.07); },

    // 事件总线 → 音效（方法名=事件名或 audio-plan 必配名）
    event(name) {
      switch (name) {
        case 'ui_click': case 'start': case 'score': this._envelope(660, 0.09, 'triangle', 0.1, 880); break;
        case 'ui_back': this._envelope(440, 0.09, 'triangle', 0.1, 330); break;
        case 'pickup': case 'upgrade': case 'upgradeTaken': case 'combo': this._envelope(520, 0.12, 'triangle', 0.12, 1040); break;
        case 'countdown': this._envelope(880, 0.08, 'square', 0.08); break;
        case 'shot': this._shot(); break;
        case 'enemyShot': this._noise({ dur: 0.12, vol: 0.07, type: 'bandpass', freq: 2400, q: 1 }); break;
        case 'hit': this._envelope(220, 0.05, 'square', 0.09, 180); break;
        case 'kill': this._envelope(320, 0.18, 'square', 0.12, 90); break;
        case 'headshot': this._envelope(1500, 0.22, 'sine', 0.14, 2200); this._envelope(320, 0.14, 'square', 0.1, 90); break;
        case 'reload': this._reload(); break;
        case 'outOfAmmo': this._envelope(200, 0.1, 'square', 0.08); break;
        case 'explosion': case 'exploderDie': this._explosion(); break;
        case 'playerHurt': this._noise({ dur: 0.2, vol: 0.14, type: 'lowpass', freq: 500, q: 1 }); this._envelope(110, 0.2, 'sine', 0.12, 60); break;
        case 'waveStart': this._envelope(392, 0.14, 'triangle', 0.1); break;
        case 'waveClear': this._fanfare([392, 523.25, 659.25]); break;
        case 'bossSpawn': this._descend(); break;
        case 'dead': case 'fail': this._descend(); break;
        case 'victory': case 'win': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'weapon': this._envelope(330, 0.08, 'square', 0.08, 440); break;
        case 'dashBlast': this._noise({ dur: 0.15, vol: 0.12, type: 'lowpass', freq: 800 }); break;
        case 'impact': this._envelope(180, 0.04, 'square', 0.05); break;
        default: break;
      }
    },

    // ---------------------------------------------------------------- 内部
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
      g.gain.linearRampToValueAtTime(vol, t + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + dur + 0.05);
      o.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _noise({ dur, vol, type = 'lowpass', freq = 900, q = 1, slideTo = null, attack = 0.004 }) {
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

    _shot() {
      this._noise({ dur: 0.14, vol: 0.2, type: 'lowpass', freq: 2400, q: 0.8, slideTo: 500 });
      this._envelope(160, 0.1, 'sine', 0.16, 70);
    },
    _reload() {
      const t = this.ctx ? this.ctx.currentTime : 0;
      this._envelope(700, 0.05, 'square', 0.08, null, t);
      this._envelope(900, 0.05, 'square', 0.08, null, t + 0.12);
    },
    _explosion() {
      this._noise({ dur: 0.4, vol: 0.24, type: 'lowpass', freq: 900, q: 0.7, slideTo: 120 });
      this._envelope(90, 0.4, 'sine', 0.2, 40);
    },
    _fanfare(notes) {
      const t0 = this.ctx ? this.ctx.currentTime : 0;
      notes.forEach((f, i) => this._envelope(f, 0.2, 'triangle', 0.13, null, t0 + i * 0.09));
    },
    _descend() {
      this._envelope(520, 0.5, 'sawtooth', 0.14, 80);
      this._envelope(260, 0.5, 'square', 0.08, 60);
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
        .then((audioBuf) => { this.bgm.buf = audioBuf; this.bgm.kind = 'file'; this._fileStart(); })
        .catch(() => this._playBGMSynth());
    },
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
      const b = this.bgm;
      if (b.kind === 'synth') return;
      b.kind = 'synth';
      this._synthStart();
    },
    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      const notes = [55, 82.41, 110, 82.41, 65.41, 98, 130.81, 98];
      const STEP_DUR = 0.2;
      const tick = () => {
        const when = ctx.currentTime + 0.1;
        const f = notes[b.step % notes.length];
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.1, when + 0.01);
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
      else if (b.kind === 'synth' && b.timer) { clearInterval(b.timer); b.timer = null; }
    },
  };

  return A;
}
