// src/core/audio.js — 全程序化 WebAudio SFX + AI BGM（缺失回退 synthwave）。
// 契约（audio-plan.md）：unlock()/setMuted()/muted()/play(name)；
// 必配音效名：ui_click, ui_back, start, score, hit, fail, win, combo, pickup, countdown。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.40;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    unlocked: false,
    ctx: null, master: null, analyser: null, noise: null,
    engine: null,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, pad: null },
    voices: 0,

    /** 首次交互解锁：创建 AudioContext 并起播 BGM。 */
    unlock() {
      if (this.ctx) { this.resume(); return true; }
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
      const comp = ctx.createDynamicsCompressor();
      comp.threshold.value = -18; comp.ratio.value = 6;
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(comp).connect(this.analyser).connect(ctx.destination);

      const len = Math.floor(ctx.sampleRate * 1.0);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this._buildEngine();
      this._startBGM();
      this.unlocked = true;
      this.resume();
      return true;
    },

    resume() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const b = this.bgm;
      if (b.kind === 'file' && !b.src) this._fileStart();
      else if (b.kind === 'synth' && b.gain && !b.timer) this._synthStart();
    },

    stopAll() {
      if (!this.ctx) return;
      if (this.engine) this.engine.g.gain.value = 0;
      this._pauseBGM();
    },

    setMuted(m) {
      this.muted = !!m;
      if (this.master) this.master.gain.value = m ? 0 : MASTER_GAIN;
    },

    muted() {
      return this.muted;
    },

    /** 引擎音（油门/氮气）。r∈[0,1] 速度比，boost 是否氮气。 */
    setEngine(r, boost) {
      if (!this.engine) return;
      const t = this.ctx.currentTime;
      const f = 46 + r * 116 + (boost ? 26 : 0);
      this.engine.o1.frequency.setTargetAtTime(f, t, 0.06);
      this.engine.o2.frequency.setTargetAtTime(f * 1.5, t, 0.06);
      this.engine.lp.frequency.setTargetAtTime(500 + r * 1500 + (boost ? 700 : 0), t, 0.08);
      this.engine.g.gain.setTargetAtTime(0.04 + r * 0.05, t, 0.12);
      this.engine.g2.gain.setTargetAtTime(boost ? 0.18 : 0, t, 0.08);
    },

    /** 事件音：play(name)。所有必配音效 + 游戏事件。 */
    play(name) {
      if (!this.ctx) return;
      switch (name) {
        case 'ui_click': this._env(520, 0.06, 'triangle', 0.07); break;
        case 'ui_back': this._env(340, 0.07, 'triangle', 0.06); break;
        case 'start': this._chord([261.63, 329.63, 392.0]); break;
        case 'countdown': this._env(660, 0.10, 'square', 0.09); break;
        case 'score': this._env(880, 0.08, 'triangle', 0.08); break;
        case 'hit': this._noise({ dur: 0.25, vol: 0.18, type: 'lowpass', freq: 900 }); break;
        case 'fail': this._descend(); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'combo': this._env(1046, 0.12, 'triangle', 0.11, 1568); break;
        case 'pickup': this._env(1318, 0.07, 'sine', 0.09, 1760); break;
        case 'coin': this._env(1318, 0.07, 'sine', 0.09, 1760); break;
        case 'flip': this._env(500, 0.16, 'sawtooth', 0.06, 900); break;
        case 'spin': this._env(700, 0.05, 'square', 0.05, 1100); break;
        case 'land': this._noise({ dur: 0.18, vol: 0.15, type: 'lowpass', freq: 500 }); break;
        case 'perfect': this._chord([523.25, 659.25, 783.99, 1046.5]); break;
        case 'nitroReady': this._env(880, 0.14, 'square', 0.09, 1320); break;
        case 'nitro': this._noise({ dur: 0.5, vol: 0.16, type: 'bandpass', freq: 300, slideTo: 2400, q: 1.2 }); break;
        case 'zone': this._fanfare([523.25, 659.25, 783.99]); break;
        case 'wreck': this._crash(); break;
        case 'finish': this._fanfare([392, 523.25, 659.25, 783.99, 1046.5]); break;
        default: break;
      }
    },

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
    _buildEngine() {
      const ctx = this.ctx;
      const g = ctx.createGain(); g.gain.value = 0;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 700; lp.Q.value = 3;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 50;
      const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 76;
      const g2 = ctx.createGain(); g2.gain.value = 0.35;
      const o3 = ctx.createOscillator(); o3.type = 'sawtooth'; o3.frequency.value = 104;
      const g3 = ctx.createGain(); g3.gain.value = 0;
      o1.connect(lp); o2.connect(g2).connect(lp); o3.connect(g3).connect(lp);
      lp.connect(g).connect(this.master);
      o1.start(); o2.start(); o3.start();
      this.engine = { o1, o2, o3, lp, g, g2: g3 };
    },

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
      o.connect(g).connect(this.master);
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
      src.connect(f).connect(g).connect(this.master);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _crash() {
      this._noise({ dur: 0.35, vol: 0.24, type: 'lowpass', freq: 900, q: 0.8 });
      this._env(90, 0.3, 'sine', 0.18, 45);
    },

    _descend() { this._env(520, 0.55, 'sawtooth', 0.13, 80); },

    _chord(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.5, i % 2 ? 'triangle' : 'sine', 0.11, null, t)); },

    _fanfare(notes) { const t0 = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.18, 'triangle', 0.13, null, t0 + i * 0.09)); },

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
      src.connect(b.gain); src.start();
      b.src = src;
    },

    _playBGMSynth() {
      const b = this.bgm, ctx = this.ctx;
      if (b.kind === 'synth') return;
      b.kind = 'synth';
      if (!b.pad) {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.6;
        const padG = ctx.createGain(); padG.gain.value = 0.09;
        lp.connect(padG).connect(b.gain);
        b.pad = [];
        [110, 164.81, 220, 329.63].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
          o.detune.value = i % 2 ? 4 : -4;
          o.connect(lp); o.start();
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
        o.connect(g).connect(b.gain);
        o.start(when); o.stop(when + STEP_DUR + 0.03);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, STEP_DUR * 1000);
    },

    _pauseBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && b.src) { b.src.stop(); b.src = null; }
      else if (b.kind === 'synth') { if (b.timer) { clearInterval(b.timer); b.timer = null; } b.gain.gain.value = 0; }
    },
  };

  return A;
}
