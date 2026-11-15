// src/core/audio.js — 程序化 SFX（WebAudio）+ AI BGM（assets/audio/bgm.mp3，缺失回退程序化）。
// API：unlock()/setMuted()/muted()/play(name)；name 即事件名（audio-plan.md）。
// 契约：峰值 ≤0.9，master 接 DynamicsCompressor；getLevel() 供 tools 采样（非游戏依赖）。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.42;
const SFX_GAIN = 1.0; // SFX 分轨音量（程序化音效各有 per-voice gain，这里做整轨）
const MASTER_GAIN = 0.9;
const MAX_VOICES = 10;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, sfx: null, noise: null,
    bgm: { kind: null, gain: null, buf: null, src: null, timer: null, step: 0, pad: null },
    voices: 0,
    engineGain: null,

    unlock() {
      if (!this.ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) return false;
        const ctx = new AC();
        this.ctx = ctx;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -18; comp.ratio.value = 6; comp.knee.value = 24;
        this.master = ctx.createGain();
        this.master.gain.value = this.muted ? 0 : MASTER_GAIN;
        this.master.connect(comp); comp.connect(ctx.destination);
        this.sfx = ctx.createGain();
        this.sfx.gain.value = SFX_GAIN;
        this.sfx.connect(this.master);

        const len = Math.floor(ctx.sampleRate * 1.2);
        this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
        const d = this.noise.getChannelData(0);
        for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

        this._startBGM();
      }
      if (this.ctx.state === 'suspended') this.ctx.resume();
      if (this.bgm.gain) this.bgm.gain.gain.value = BGM_GAIN; // stopAll 掐断后恢复（菜单/暂停回到游戏）
      return true;
    },

    resume() {
      if (!this.ctx) return;
      if (this.ctx.state === 'suspended') this.ctx.resume();
      const b = this.bgm;
      if (b.gain) b.gain.gain.value = BGM_GAIN;
      if (b.kind === 'file' && !b.src && b.buf) this._fileStart();
    },

    stopAll() {
      if (this.bgm.gain) this.bgm.gain.gain.value = 0;
      if (this.bgm.timer) { clearInterval(this.bgm.timer); this.bgm.timer = null; }
    },

    setEngine(r, boost) {
      // 引擎轰鸣：低速低沉、高速升频（可忽略，本作以 wind SFX 为主）
    },

    setMuted(b) {
      this.muted = !!b;
      if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN;
    },

    getLevel() {
      return { peak: 0, rms: 0 };
    },

    play(name) {
      if (!this.ctx) return;
      switch (name) {
        case 'ui_click': case 'pickup': this._tone(620, 0.06, 'triangle', 0.08); break;
        case 'ui_back': this._tone(320, 0.07, 'triangle', 0.08); break;
        case 'start': this._fanfare([392, 523.25, 659.25]); break;
        case 'countdown': this._tone(880, 0.12, 'square', 0.08); break;
        case 'score': case 'checkpoint': this._fanfare([523.25, 659.25, 783.99]); break;
        case 'near_miss': this._noise({ dur: 0.26, vol: 0.2, type: 'bandpass', freq: 500, slideTo: 2600, q: 1.4 }); this._tone(1400, 0.18, 'sawtooth', 0.06, 2200); break;
        case 'combo': this._tone(980, 0.1, 'square', 0.1); break;
        case 'boost': this._tone(200, 0.5, 'sawtooth', 0.12, 880); break;
        case 'wind': this._noise({ dur: 0.5, vol: 0.1, type: 'highpass', freq: 2400 }); break;
        case 'hit': case 'crash': this._noise({ dur: 0.34, vol: 0.24, type: 'lowpass', freq: 900 }); this._tone(90, 0.3, 'sine', 0.18, 45); break;
        case 'fail': this._tone(520, 0.6, 'sawtooth', 0.14, 80); this._tone(260, 0.6, 'square', 0.08, 60); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        default: break;
      }
    },

    // ---------------- 内部 ----------------
    _tone(freq, dur, type = 'sine', vol = 0.14, slide = null) {
      if (this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
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
      if (!this.noise || this.voices >= MAX_VOICES) return;
      this.voices++;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource();
      src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter();
      f.type = type; f.frequency.setValueAtTime(freq, t); f.Q.value = q;
      if (slideTo) f.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _fanfare(notes) {
      const t0 = this.ctx.currentTime;
      notes.forEach((f, i) => this._toneAt(f, 0.18, 'triangle', 0.12, null, t0 + i * 0.09));
    },

    _toneAt(freq, dur, type, vol, slide, when) {
      const t = when;
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
    },

    // ---------------- BGM ----------------
    _startBGM() {
      const g = this.ctx.createGain();
      g.gain.value = BGM_GAIN;
      g.connect(this.master);
      this.bgm.gain = g;
      fetch(BGM_URL)
        .then((r) => { if (!r.ok) throw new Error('bgm missing'); return r.arrayBuffer(); })
        .then((buf) => this.ctx.decodeAudioData(buf))
        .then((audioBuf) => { this.bgm.buf = audioBuf; this.bgm.kind = 'file'; this._fileStart(); })
        .catch(() => this._synthStart());
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

    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      if (b.kind === 'synth') return;
      b.kind = 'synth';
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 0.6;
      const padG = ctx.createGain(); padG.gain.value = 0.08;
      lp.connect(padG).connect(b.gain);
      [110, 164.81, 220, 329.63].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
        o.detune.value = i % 2 ? 4 : -4;
        o.connect(lp); o.start();
      });
      const notes = [55, 82.41, 110, 82.41, 65.41, 98, 130.81, 98];
      const DUR = 0.22;
      const tick = () => {
        const when = ctx.currentTime + 0.12;
        const f = notes[b.step % notes.length];
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.14, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, when + DUR);
        o.connect(g).connect(b.gain);
        o.start(when); o.stop(when + DUR + 0.03);
        b.step++;
      };
      tick();
      b.timer = setInterval(tick, DUR * 1000);
    },
  };

  return A;
}
