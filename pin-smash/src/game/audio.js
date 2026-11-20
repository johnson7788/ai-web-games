// src/game/audio.js — Procedural WebAudio (no asset files). All sounds synthesized.
// Created lazily on first user gesture; safe in sandbox (no network, no workers).

export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.rollNode = null;
    this.rollGain = null;
    this.noiseBuf = null;
  }

  ensure() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.9;
      this.master.connect(this.ctx.destination);
      // shared white-noise buffer
      const len = this.ctx.sampleRate * 1.5;
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    } catch (e) { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  _env(gainNode, t0, a, peak, dur) {
    const g = gainNode.gain;
    g.cancelScheduledValues(t0);
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + a);
    g.exponentialRampToValueAtTime(0.0001, t0 + dur);
  }

  tone(freq, dur, type = 'sine', peak = 0.3, delay = 0, slideTo = null) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(slideTo, 1), t0 + dur);
    this._env(g, t0, 0.008, peak, dur);
    o.connect(g); g.connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  noise(dur, peak = 0.4, filterFreq = 2000, type = 'bandpass', delay = 0, q = 1) {
    if (!this.ctx || this.muted || !this.noiseBuf) return;
    const t0 = this.ctx.currentTime + delay;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = this.ctx.createBiquadFilter();
    f.type = type; f.frequency.value = filterFreq; f.Q.value = q;
    const g = this.ctx.createGain();
    this._env(g, t0, 0.004, peak, dur);
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start(t0); src.stop(t0 + dur + 0.05);
  }

  // --- game sounds ---
  click() { this.tone(660, 0.07, 'square', 0.12); }
  hover() { this.tone(440, 0.04, 'sine', 0.05); }

  charge(power) {
    // short rising blip while charging (called throttled)
    this.tone(220 + power * 520, 0.06, 'sawtooth', 0.06);
  }

  throwWhoosh(power) {
    this.noise(0.35, 0.25 + power * 0.2, 900, 'lowpass');
    this.tone(180, 0.25, 'sine', 0.15, 0, 90);
  }

  startRoll() {
    if (!this.ctx || this.muted || this.rollNode) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noiseBuf; src.loop = true;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = 320; f.Q.value = 0.7;
    const g = this.ctx.createGain(); g.gain.value = 0.0001;
    src.connect(f); f.connect(g); g.connect(this.master);
    src.start();
    this.rollNode = src; this.rollGain = g; this.rollFilter = f;
  }
  updateRoll(speed01) {
    if (!this.rollGain || !this.ctx) return;
    const t = this.ctx.currentTime;
    this.rollGain.gain.setTargetAtTime(0.05 + speed01 * 0.22, t, 0.08);
    if (this.rollFilter) this.rollFilter.frequency.setTargetAtTime(220 + speed01 * 520, t, 0.1);
  }
  stopRoll() {
    if (!this.rollNode || !this.ctx) { this.rollNode = null; return; }
    const t = this.ctx.currentTime;
    this.rollGain.gain.setTargetAtTime(0.0001, t, 0.1);
    const node = this.rollNode;
    setTimeout(() => { try { node.stop(); } catch (e) {} }, 400);
    this.rollNode = null; this.rollGain = null;
  }

  pinHit(intensity = 1) {
    // clatter: noise burst + a couple of wooden clicks
    const p = Math.min(1, intensity);
    this.noise(0.12, 0.22 * p, 2600, 'bandpass', 0, 0.8);
    this.tone(520 + Math.random() * 240, 0.06, 'triangle', 0.16 * p);
    this.tone(1400 + Math.random() * 600, 0.04, 'square', 0.05 * p, 0.01);
  }

  gutter() {
    this.tone(300, 0.4, 'sawtooth', 0.18, 0, 110);
    this.tone(150, 0.5, 'sine', 0.14, 0.08, 70);
  }

  strike() {
    this.noise(0.5, 0.4, 3000, 'highpass');
    const notes = [523, 659, 784, 1047, 1319];
    notes.forEach((n, i) => this.tone(n, 0.35, 'square', 0.2, i * 0.09));
    this.tone(1568, 0.6, 'triangle', 0.18, 0.45);
  }

  spare() {
    this.noise(0.3, 0.3, 2600, 'highpass');
    const notes = [523, 784, 1047];
    notes.forEach((n, i) => this.tone(n, 0.3, 'square', 0.18, i * 0.1));
  }

  frameScore() { this.tone(880, 0.1, 'sine', 0.12); this.tone(1175, 0.12, 'sine', 0.1, 0.07); }

  gameOver(good) {
    if (good) {
      [523, 659, 784, 1047, 784, 1047, 1319].forEach((n, i) => this.tone(n, 0.3, 'triangle', 0.2, i * 0.13));
    } else {
      [392, 330, 262, 196].forEach((n, i) => this.tone(n, 0.35, 'sine', 0.16, i * 0.16));
    }
  }
}