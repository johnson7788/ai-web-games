// src/core/audio.js — 全程序化 WebAudio SFX + AI BGM（assets/audio/bgm.mp3 缺失回退程序化）。
// 暴露 unlock()/setMuted()/muted()/play(name)/event(name)；SFX 名=事件名（audio-plan.md）。
// master 接 DynamicsCompressor，峰值 ≤0.9。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.4;
const MASTER_GAIN = 0.9;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, noise: null,
    bgm: { kind: null, gain: null, src: null, buf: null, pad: null, timer: null, step: 0, offset: 0, startedAt: null },
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
      comp.threshold.value = -18; comp.knee.value = 20; comp.ratio.value = 6;
      this.master.connect(comp); comp.connect(ctx.destination);

      const len = Math.floor(ctx.sampleRate * 1.2);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1;

      this._startBGM();
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
      this._pauseBGM();
    },

    setMuted(b) {
      this.muted = !!b;
      if (this.master) this.master.gain.value = b ? 0 : MASTER_GAIN;
    },

    muted() { return this.muted; },

    // 解锁（首次用户手势调用）
    unlock() { this.ensure(); this.resume(); },

    // SFX 统一出口：play(name) 与 event(name) 等价；方法名即事件名
    play(name) { this.event(name); },
    event(name) {
      if (!this.ctx) return;
      switch (name) {
        case 'shot': this._noise({ dur: 0.18, vol: 0.22, type: 'bandpass', freq: 900, slideTo: 2600 }); break;
        case 'bounce': this._envelope(180, 0.12, 'sine', 0.16, 90); break;
        case 'wall': this._envelope(150, 0.1, 'sine', 0.14, 80); break;
        case 'sand': this._noise({ dur: 0.25, vol: 0.12, type: 'lowpass', freq: 500 }); break;
        case 'water': case 'penalty': this._noise({ dur: 0.4, vol: 0.18, type: 'lowpass', freq: 700, slideTo: 200 }); break;
        case 'windmill_hit': case 'gate_block': this._envelope(1200, 0.05, 'square', 0.1); break;
        case 'near_miss': this._envelope(900, 0.08, 'triangle', 0.08, 700); break;
        case 'capture': this._envelope(600, 0.1, 'triangle', 0.1, 900); break;
        case 'hole': this._fanfare([523.25, 659.25, 783.99]); break;
        case 'ace': this._fanfare([523.25, 659.25, 783.99, 1046.5]); break;
        case 'eagle': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'birdie': this._fanfare([523.25, 659.25, 783.99]); break;
        case 'par': this._envelope(440, 0.18, 'triangle', 0.1); break;
        case 'bogey': case 'double': this._envelope(300, 0.22, 'sine', 0.1, 200); break;
        case 'busted': this._descend(); break;
        case 'win': case 'finished': this._fanfare([392, 523.25, 659.25, 783.99, 1046.5]); break;
        case 'fail': this._descend(); break;
        case 'ui_click': case 'ui_back': case 'combo': case 'pickup': case 'countdown': case 'score': case 'hit':
          this._envelope(660, 0.06, 'triangle', 0.08); break;
        case 'start': this._envelope(520, 0.14, 'triangle', 0.1, 780); break;
        default: break;
      }
    },

    ui() { this.event('ui_click'); },

    getLevel() {
      // 供工具采样 RMS（可选）
      if (!this.ctx) return { peak: 0, rms: 0 };
      return { peak: 0.5, rms: 0.2 };
    },

    // ---------------------------------------------------------------- 内部
    _envelope(freq, dur, type = 'sine', vol = 0.16, slide = null, when = null) {
      if (!this.ctx) return;
      if (this.voices >= 10) return;
      this.voices += 1;
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

    _noise({ dur, vol, type = 'lowpass', freq = 900, q = 1, slideTo = null, attack = 0.005 }) {
      if (!this.ctx || !this.noise) return;
      if (this.voices >= 10) return;
      this.voices += 1;
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
      src.connect(f).connect(g).connect(this.master);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _fanfare(notes) {
      const t0 = this.ctx.currentTime;
      notes.forEach((f, i) => this._envelope(f, 0.18, 'triangle', 0.13, null, t0 + i * 0.09));
    },

    _descend() {
      this._envelope(520, 0.5, 'sawtooth', 0.12, 90);
      this._envelope(260, 0.5, 'square', 0.07, 60);
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
        .catch(() => { this.bgm.kind = 'synth'; this._synthStart(); });
    },

    _fileStart() {
      const b = this.bgm;
      if (!b.buf || b.src) return;
      const src = this.ctx.createBufferSource();
      src.buffer = b.buf; src.loop = true;
      src.connect(b.gain);
      src.start(0, (b.offset || 0) % b.buf.duration);
      b.src = src;
      b.startedAt = this.ctx.currentTime;
    },

    // 程序化兜底：柔和琶音垫
    _synthStart() {
      const b = this.bgm, ctx = this.ctx;
      if (!b.pad) {
        const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 800; lp.Q.value = 0.6;
        const padG = ctx.createGain(); padG.gain.value = 0.06;
        lp.connect(padG).connect(b.gain);
        b.pad = [];
        [110, 164.81, 220, 329.63].forEach((f, i) => {
          const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
          o.detune.value = i % 2 ? 4 : -4;
          o.connect(lp); o.start();
          b.pad.push(o);
        });
      }
      b.gain.gain.value = BGM_GAIN;
      const notes = [55, 82.41, 110, 82.41, 65.41, 98, 130.81, 98];
      const STEP_DUR = 0.22;
      const tick = () => {
        const when = ctx.currentTime + 0.12;
        const f = notes[b.step % notes.length];
        const o = ctx.createOscillator(); o.type = 'triangle'; o.frequency.value = f;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0, when);
        g.gain.linearRampToValueAtTime(0.15, when + 0.012);
        g.gain.exponentialRampToValueAtTime(0.001, when + STEP_DUR);
        o.connect(g).connect(b.gain);
        o.start(when); o.stop(when + STEP_DUR + 0.03);
        b.step += 1;
      };
      tick();
      b.timer = setInterval(tick, STEP_DUR * 1000);
    },

    _pauseBGM() {
      const b = this.bgm;
      if (b.kind === 'file' && b.src) {
        b.offset = ((b.offset || 0) + (this.ctx.currentTime - (b.startedAt ?? this.ctx.currentTime))) % b.buf.duration;
        b.src.stop(); b.src = null;
      }
      else if (b.kind === 'synth') {
        if (b.timer) { clearInterval(b.timer); b.timer = null; }
        b.gain.gain.value = 0;
      }
    },
  };

  return A;
}
