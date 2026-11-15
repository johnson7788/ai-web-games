// src/core/audio.js — 全程序化 WebAudio（+ AI BGM，缺失回退合成）。
// 契约：unlock()/setMuted()/muted()/play(name)/setHum(on)/setDanger(on)/getLevel()。
// 必配 play 名：ui_click, ui_back, start, score, hit, fail, win, combo, pickup, countdown，
// 游戏事件：footstep, flicker, breath, heartbeat, chase, caught, exit_found, maze_regen, panting。
// 依赖：assets/audio/bgm.mp3（可选，404 回退合成 drone）。
const BGM_URL = 'assets/audio/bgm.mp3';
const BGM_GAIN = 0.32;
const MASTER = 0.85;

export function createAudio() {
  const A = {
    muted: false,
    ctx: null, master: null, sfx: null, noise: null, comp: null,
    hum: null, heartbeatTimer: null, breath: null,
    bgm: { kind: null, gain: null, buf: null, src: null, pad: null, timer: null, step: 0 },
    voices: 0,

    ensure() {
      if (this.ctx) return true;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      const ctx = new AC();
      this.ctx = ctx;
      this.master = ctx.createGain();
      this.master.gain.value = this.muted ? 0 : MASTER;
      this.sfx = ctx.createGain();          // BGM/SFX 分轨：SFX 经 sfx 轨，BGM 经 bgm.gain
      this.sfx.gain.value = 1;
      this.sfx.connect(this.master);
      this.comp = ctx.createDynamicsCompressor();
      this.comp.threshold.value = -18; this.comp.ratio.value = 8;
      this.master.connect(this.comp);
      this.comp.connect(ctx.destination);

      const len = Math.floor(ctx.sampleRate * 1.5);
      this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this._buildHum();
      this._startBGM();
      return true;
    },

    unlock() { if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume(); },
    muted() { return this.muted; },
    setMuted(b) {
      this.muted = !!b;
      if (this.master) this.master.gain.value = b ? 0 : MASTER;
    },

    // 荧光灯嗡鸣（签名环境音）
    setHum(on) {
      if (!this.ctx || !this.hum) return;
      const t = this.ctx.currentTime;
      this.hum.g.gain.setTargetAtTime(on ? 0.05 : 0, t, 0.25);
    },

    // 实体逼近：心跳
    setDanger(on) {
      if (!this.ctx) return;
      if (on && !this.heartbeatTimer) {
        this.heartbeatTimer = setInterval(() => this._thump(), 620);
      } else if (!on && this.heartbeatTimer) {
        clearInterval(this.heartbeatTimer); this.heartbeatTimer = null;
      }
    },

    play(name) {
      if (!this.ctx) return;
      switch (name) {
        case 'ui_click': this._env(520, 0.06, 'triangle', 0.10); break;
        case 'ui_back': this._env(320, 0.08, 'triangle', 0.10); break;
        case 'start': this._env(220, 0.3, 'sawtooth', 0.10, 660); break;
        case 'score': this._env(880, 0.09, 'square', 0.08); break;
        case 'hit': this._noise(0.18, 0.16, 400); break;
        case 'fail': this._descend(); break;
        case 'win': this._fanfare([392, 523.25, 659.25, 783.99]); break;
        case 'combo': this._env(1200, 0.06, 'square', 0.07); break;
        case 'pickup': this._env(660, 0.12, 'triangle', 0.12, 990); break;
        case 'countdown': this._env(440, 0.10, 'square', 0.09); break;
        case 'footstep': this._noise(0.09, 0.08, 300, 0.004); break;
        case 'flicker': this._noise(0.07, 0.10, 2400, 0.003); break;
        case 'breath': this._noise(0.5, 0.12, 700, 0.03); break;
        case 'heartbeat': this._thump(); break;
        case 'chase': this._env(96, 0.5, 'sawtooth', 0.16, 60); break;
        case 'caught': this._descend(); this._noise(0.4, 0.20, 500); break;
        case 'exit_found': this._chord([523.25, 659.25]); break;
        case 'maze_regen': this._env(180, 0.7, 'sawtooth', 0.12, 90); break;
        case 'panting': this._noise(0.6, 0.14, 500, 0.04); break;
        default: break;
      }
    },

    getLevel() {
      if (!this.ctx) return { peak: 0, rms: 0 };
      const n = 2048; const data = new Float32Array(n);
      // 用 master 之前信号近似（无 analyser 时返回 0，非游戏依赖）
      return { peak: 0, rms: 0 };
    },

    // ---------------------------------------------------------------- 内部
    _env(freq, dur, type = 'sine', vol = 0.16, slide = null) {
      if (!this.ctx || this.voices >= 10) return;
      this.voices++;
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = type; o.frequency.setValueAtTime(freq, t);
      if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(1, slide), t + dur);
      g.gain.setValueAtTime(0, t);
      g.gain.linearRampToValueAtTime(vol, t + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + dur + 0.05);
      o.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _noise(dur, vol, freq, attack = 0.005) {
      if (!this.ctx || !this.noise || this.voices >= 10) return;
      this.voices++;
      const t = this.ctx.currentTime;
      const src = this.ctx.createBufferSource(); src.buffer = this.noise;
      const f = this.ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t); f.Q.value = 1.2;
      const g = this.ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(vol, t + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      src.connect(f).connect(g).connect(this.sfx);
      src.start(t); src.stop(t + dur + 0.05);
      src.onended = () => { this.voices = Math.max(0, this.voices - 1); };
    },

    _thump() {
      const t = this.ctx.currentTime;
      const o = this.ctx.createOscillator(); const g = this.ctx.createGain();
      o.type = 'sine'; o.frequency.setValueAtTime(64, t);
      o.frequency.exponentialRampToValueAtTime(42, t + 0.12);
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.5, t + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      o.connect(g).connect(this.sfx);
      o.start(t); o.stop(t + 0.3);
    },

    _descend() { this._env(520, 0.5, 'sawtooth', 0.14, 80); this._env(260, 0.5, 'square', 0.08, 60); },
    _chord(notes) { const t = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.4, 'triangle', 0.10, null)); },
    _fanfare(notes) { const t0 = this.ctx.currentTime; notes.forEach((f, i) => this._env(f, 0.18, 'triangle', 0.13, null)); },

    _buildHum() {
      const ctx = this.ctx;
      const g = ctx.createGain(); g.gain.value = 0;
      const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 120;
      const o2 = ctx.createOscillator(); o2.type = 'sawtooth'; o2.frequency.value = 121.5;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 0.8;
      o1.connect(lp); o2.connect(lp); lp.connect(g).connect(this.master);
      o1.start(); o2.start();
      this.hum = { g };
    },

    _startBGM() {
      const ctx = this.ctx;
      const g = ctx.createGain(); g.gain.value = BGM_GAIN; g.connect(this.master);
      this.bgm.gain = g;
      fetch(BGM_URL)
        .then((r) => { if (!r.ok) throw new Error('no bgm'); return r.arrayBuffer(); })
        .then((buf) => ctx.decodeAudioData(buf))
        .then((audioBuf) => {
          this.bgm.buf = audioBuf; this.bgm.kind = 'file';
          const src = ctx.createBufferSource(); src.buffer = audioBuf; src.loop = true;
          src.connect(g); src.start(); this.bgm.src = src;
        })
        .catch(() => this._synthDrone());
    },

    _synthDrone() {
      if (this.bgm.kind === 'synth') return;
      this.bgm.kind = 'synth';
      const ctx = this.ctx;
      const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 320; lp.Q.value = 0.5;
      lp.connect(this.bgm.gain);
      [55, 55.6, 82.4, 110.2].forEach((f, i) => {
        const o = ctx.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f; o.detune.value = i % 2 ? 5 : -5;
        o.connect(lp); o.start();
      });
    },
  };
  return A;
}
