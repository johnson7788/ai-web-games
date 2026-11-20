// Marble Dash — original procedural WebAudio (no audio assets)
export class Audio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.muted = false;
    this.rollGain = null;
    this.rollFilter = null;
    this.started = false;
  }

  // must be called from a user gesture
  unlock() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {}); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = this.muted ? 0 : 0.55;
      this.master.connect(this.ctx.destination);
      // rolling noise loop
      const len = this.ctx.sampleRate * 1.5;
      const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = buf.getChannelData(0);
      let last = 0;
      for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; last = (last + 0.02 * w) / 1.02; d[i] = last * 3.5; }
      const src = this.ctx.createBufferSource();
      src.buffer = buf; src.loop = true;
      this.rollFilter = this.ctx.createBiquadFilter();
      this.rollFilter.type = 'bandpass';
      this.rollFilter.frequency.value = 220;
      this.rollFilter.Q.value = 0.8;
      this.rollGain = this.ctx.createGain();
      this.rollGain.gain.value = 0;
      src.connect(this.rollFilter).connect(this.rollGain).connect(this.master);
      src.start();
      this.started = true;
    } catch (e) { this.ctx = null; }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.55;
  }

  // speed 0..15, grounded
  roll(speed, grounded) {
    if (!this.ctx || !this.rollGain) return;
    const t = this.ctx.currentTime;
    const target = grounded ? Math.min(0.32, speed * 0.028) : 0;
    this.rollGain.gain.setTargetAtTime(target, t, 0.08);
    this.rollFilter.frequency.setTargetAtTime(180 + speed * 42, t, 0.1);
  }

  tone(freq, dur, type = 'sine', vol = 0.3, delay = 0, slideTo = null) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0); o.stop(t0 + dur + 0.05);
  }

  noise(dur, vol = 0.25, freq = 800, delay = 0) {
    if (!this.ctx) return;
    const t0 = this.ctx.currentTime + delay;
    const len = Math.max(1, (dur * this.ctx.sampleRate) | 0);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = freq;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(vol, t0);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(f).connect(g).connect(this.master);
    src.start(t0);
  }

  click() { this.tone(660, 0.07, 'square', 0.12); this.tone(990, 0.06, 'square', 0.08, 0.03); }
  gem() { this.tone(1318, 0.12, 'sine', 0.3); this.tone(1975, 0.18, 'sine', 0.24, 0.06); this.tone(2637, 0.22, 'sine', 0.12, 0.12); }
  bounce(speed) { const v = Math.min(0.4, 0.1 + speed * 0.03); this.noise(0.09, v, 500); this.tone(130, 0.1, 'sine', v, 0, 70); }
  land(speed) { const v = Math.min(0.45, 0.12 + speed * 0.03); this.noise(0.14, v, 380); this.tone(95, 0.14, 'sine', v, 0, 55); }
  boost() { this.tone(240, 0.28, 'sawtooth', 0.16, 0, 720); this.noise(0.22, 0.12, 1600); }
  bumper() { this.tone(320, 0.14, 'square', 0.2, 0, 180); this.tone(640, 0.1, 'sine', 0.14, 0.02); }
  hit() { this.noise(0.18, 0.32, 900); this.tone(200, 0.2, 'sawtooth', 0.2, 0, 90); }
  checkpoint() { this.tone(784, 0.12, 'sine', 0.24); this.tone(1046, 0.2, 'sine', 0.22, 0.09); }
  fall() { this.tone(420, 0.7, 'sawtooth', 0.22, 0, 55); this.noise(0.5, 0.18, 700, 0.1); }
  star(i) { this.tone(880 + i * 220, 0.25, 'triangle', 0.26); }
  win() {
    const n = [523, 659, 784, 1046, 1318];
    n.forEach((f, i) => { this.tone(f, 0.3, 'triangle', 0.26, i * 0.11); this.tone(f * 2, 0.24, 'sine', 0.1, i * 0.11); });
    this.noise(0.5, 0.08, 4000, 0.5);
  }
  gameover() { [392, 330, 262, 196].forEach((f, i) => this.tone(f, 0.4, 'triangle', 0.24, i * 0.22)); }
  complete() {
    const n = [523, 659, 784, 1046, 784, 1046, 1318, 1568];
    n.forEach((f, i) => this.tone(f, 0.34, 'triangle', 0.26, i * 0.13));
  }
}