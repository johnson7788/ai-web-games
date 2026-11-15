// src/core/audio.js — 全程序化 WebAudio SFX + AI BGM（audio-plan.md 契约）。
// 暴露：unlock()/setMuted()/muted()/play(name)；必配事件名：ui_click/ui_back/start/score/hit/fail/win/combo/pickup/countdown。
// BGM：assets/audio/bgm.mp3 优先，缺失/解码失败回退程序化 marimba。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.4;
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, analyser: null, noise: null,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, offset: 0, startAt: 0 },
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
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 2048;
      this.master.connect(comp);
      comp.connect(this.analyser);
      this.analyser.connect(ctx.destination);

      const len = Math.floor(ctx.sampleRate * 1.0);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this._startBGM();
      return true;
    },

    unlock() {
      if (!this.ensure()) return false;
      return this.resume();
    },

    resume() {
      if (!this.ctx) return false;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      this._resumeBGM();
      return true;
    },

    stopAll() {
      if (!this.ctx) return;
      this._pauseBGM();
    },

    setMuted(b) {
      this.muted = !!b;
      if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN;
      if (b) this._pauseBGM();
      else if (this.ctx && this.ctx.state === 'running') this._resumeBGM();
    },

    muted() {
      return this.muted;
    },

    // 主入口：play('pickup') / event('fall') 同义
    play(name) {
      if (!name || !this.ctx) return;
      switch (name) {
        case 'ui_click': this._tone(520, 0.07, 'triangle', 0.07); break;
        case 'ui_back': this._tone(330, 0.08, 'triangle', 0.07); break;
        case 'start': this._tone(220, 0.4, 'sawtooth', 0.10, 660); break;
        case 'score': this._tone(880, 0.10, 'triangle', 0.08, 1320); break;
        case 'hit': this._noise({ dur: 0.28, vol: 0.2, type: 'lowpass', freq: 700 }); this._tone(90, 0.24, 'sine', 0.16, 45); break;
        case 'fail': this._tone(500, 0.6, 'sawtooth', 0.13, 90); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'combo': this._tone(660, 0.09, 'square', 0.07, 990); break;
        case 'pickup': this._tone(740, 0.12, 'triangle', 0.09, 1480); break;
        case 'countdown': this._tone(440, 0.12, 'square', 0.09); break;
        case 'jump': this._tone(300, 0.16, 'square', 0.09, 700); break;
        case 'bounce': this._tone(180, 0.22, 'sine', 0.13, 520); break;
        case 'roll': this._noise({ dur: 0.10, vol: 0.04, type: 'bandpass', freq: 260, slideTo: 380 }); break;
        case 'brake': this._noise({ dur: 0.22, vol: 0.10, type: 'bandpass', freq: 900, slideTo: 300 }); break;
        case 'land': this._tone(160, 0.08, 'sine', 0.08, 90); break;
        case 'hammerHit': this._noise({ dur: 0.3, vol: 0.2, type: 'lowpass', freq: 800 }); this._tone(110, 0.26, 'sine', 0.16, 50); break;
        case 'levelCleared': this._fanfare([523.25, 659.25, 783.99]); break;
        case 'finished': this._fanfare([392, 523.25, 659.25, 783.99, 1046.5]); break;
        default: break;
      }
    },

    event(name) {
      this.play(name);
    },

    getLevel() {
      if (!this.analyser) return { peak: 0, rms: 0 };
      const n = this.analyser.fftSize;
      const data = new Float32Array(n);
      this.analyser.getFloatTimeDomainData(data);
      let peak = 0, sum = 0;
      for (let i = 0; i < n; i++) {
        const a = Math.abs(data[i]);
        if (a > peak) peak = a;
        sum += data[i] * data[i];
      }
      return { peak, rms: Math.sqrt(sum / n) };
    },

    // ---------------------------------------------------------------- 内部
    _tone(freq, dur, type = 'sine', vol = 0.14, slide = null, when = null) {
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
      o.connect(g).connect(this.master);
      o.start(t); o.stop(t + dur + 0.05);
      o.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _noise({ dur, vol, type = 'lowpass', freq = 900, q = 1, slideTo = null }) {
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
      g.gain.exponentialRampToValueAtTime(vol, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.master);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _fanfare(notes) {
      const t0 = this.ctx.currentTime;
      notes.forEach((f, i) => this._tone(f, 0.2, 'triangle', 0.12, null, t0 + i * 0.09));
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

    _fileStart() {
      const b = this.bgm;
      if (!b.buf || b.src) return;
      const src = this.ctx.createBufferSource();
      src.buffer = b.buf; src.loop = true;
      src.connect(b.gain);
      const off = (b.offset || 0) % (b.buf.duration || 1);
      src.start(0, off);
      b.src = src;
      b.startAt = this.ctx.currentTime - off;
    },

    _resumeBGM() {
      const b = this.bgm;
      if (!this.ctx || this.muted) return;
      if (b.kind === 'file') this._fileStart();
      else if (b.kind === 'synth' && !b.timer) this._synthStart();
    },

    _playBGMSynth() {
      const b = this.bgm;
      if (b.kind === 'synth') return;
      b.kind = 'synth';
      this._resumeBGM();
    },

    // 程序化 marimba：F 大调琶音，lookahead 调度
    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      const notes = [87.31, 110, 130.81, 174.61, 146.83, 110, 98, 130.81];
      const STEP = 0.26;
      const tick = () => {
        const when = ctx.currentTime + 0.12;
        const f = notes[b.step % notes.length];
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.14, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, when + STEP);
        o.connect(g).connect(b.gain);
        o.start(when); o.stop(when + STEP + 0.03);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, STEP * 1000);
    },

    _pauseBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && b.src) {
        const dur = b.buf?.duration || 1;
        b.offset = (((this.ctx.currentTime - b.startAt) % dur) + dur) % dur;
        try { b.src.stop(); } catch { /* noop */ }
        b.src = null;
      } else if (b.kind === 'synth') {
        if (b.timer) { clearInterval(b.timer); b.timer = null; }
      }
    },
  };

  return A;
}
