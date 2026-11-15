/**
 * Every sound in the game is synthesized at runtime with the Web Audio API.
 * No audio files exist. Headphones strongly recommended.
 *
 * v2: convolution reverb, rain + thunder weather bed, the entity's breathing
 * and growls, banish shrieks, a chase music layer, and a burn sizzle loop.
 */
export class AudioEngine {
  constructor() {
    this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    const comp = this.ctx.createDynamicsCompressor();
    comp.threshold.value = -18;
    comp.knee.value = 12;
    comp.ratio.value = 7;
    this.master.connect(comp);
    comp.connect(this.ctx.destination);

    // shared house reverb — a synthesized 2s decaying impulse response
    this.reverb = this.ctx.createConvolver();
    this.reverb.buffer = this._makeImpulse(2.1, 2.6);
    const reverbOut = this.ctx.createGain();
    reverbOut.gain.value = 0.5;
    this.reverb.connect(reverbOut);
    reverbOut.connect(this.master);

    this.heartbeatTimer = null;
    this.chaseTimer = null;
    this._noiseBuffer = this._makeNoise(2);
  }

  resume() { if (this.ctx.state === 'suspended') this.ctx.resume(); }
  get now() { return this.ctx.currentTime; }

  /** Global mute (M key / sound button) — smooth fade, keeps the graph running. */
  setMuted(m) {
    this.muted = !!m;
    try {
      this.master.gain.setTargetAtTime(m ? 0 : 0.9, this.ctx.currentTime, 0.03);
    } catch (e) {
      this.master.gain.value = m ? 0 : 0.9;
    }
  }

  /* ================= primitives ================= */

  _makeNoise(seconds) {
    const buf = this.ctx.createBuffer(2, this.ctx.sampleRate * seconds, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    return buf;
  }

  _makeImpulse(seconds, decay) {
    const len = this.ctx.sampleRate * seconds;
    const buf = this.ctx.createBuffer(2, len, this.ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, decay);
      }
    }
    return buf;
  }

  _noiseSource(loop = false) {
    const src = this.ctx.createBufferSource();
    src.buffer = this._noiseBuffer;
    src.loop = loop;
    if (loop) src.loopStart = Math.random();
    return src;
  }

  /** Connect a node to the master plus a reverb send. */
  _out(node, wet = 0.2) {
    node.connect(this.master);
    if (wet > 0) {
      const send = this.ctx.createGain();
      send.gain.value = wet;
      node.connect(send);
      send.connect(this.reverb);
    }
  }

  _env(gainNode, t0, attack, peak, decay, sustain = 0) {
    const g = gainNode.gain;
    g.setValueAtTime(0.0001, t0);
    g.exponentialRampToValueAtTime(Math.max(peak, 0.0001), t0 + attack);
    g.exponentialRampToValueAtTime(Math.max(sustain, 0.0001), t0 + attack + decay);
  }

  _distortionCurve(amount = 30) {
    const n = 256, curve = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      const x = (i / (n - 1)) * 2 - 1;
      curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
    }
    return curve;
  }

  /* ================= persistent beds ================= */

  startAmbient() {
    const t = this.now;
    // sub drone — slowly beating sines
    this.droneGain = this.ctx.createGain();
    this.droneGain.gain.setValueAtTime(0.0001, t);
    this.droneGain.gain.exponentialRampToValueAtTime(0.045, t + 6);
    this._out(this.droneGain, 0.15);
    for (const f of [48, 52.7, 96.4]) {
      const o = this.ctx.createOscillator();
      o.type = 'sine';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      g.gain.value = f > 90 ? 0.22 : 1;
      o.connect(g);
      g.connect(this.droneGain);
      o.start();
    }
    // hollow wind through a wandering bandpass
    const wind = this._noiseSource(true);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 320;
    bp.Q.value = 2.4;
    const wg = this.ctx.createGain();
    wg.gain.value = 0.016;
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.07;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 140;
    lfo.connect(lfoG);
    lfoG.connect(bp.frequency);
    wind.connect(bp);
    bp.connect(wg);
    this._out(wg, 0.25);
    wind.start();
    lfo.start();
    // rain against the windows — hiss with slow swells
    const rain = this._noiseSource(true);
    const rainHp = this.ctx.createBiquadFilter();
    rainHp.type = 'highpass';
    rainHp.frequency.value = 2400;
    const rainLp = this.ctx.createBiquadFilter();
    rainLp.type = 'lowpass';
    rainLp.frequency.value = 7500;
    const rg = this.ctx.createGain();
    rg.gain.value = 0.011;
    const rLfo = this.ctx.createOscillator();
    rLfo.frequency.value = 0.045;
    const rLfoG = this.ctx.createGain();
    rLfoG.gain.value = 0.005;
    rLfo.connect(rLfoG);
    rLfoG.connect(rg.gain);
    rain.connect(rainHp); rainHp.connect(rainLp); rainLp.connect(rg);
    this._out(rg, 0.1);
    rain.start();
    rLfo.start();

    this._startBreath();
    this._startSizzle();
  }

  setDroneIntensity(level) { // 0..1
    if (!this.droneGain) return;
    this.droneGain.gain.cancelScheduledValues(this.now);
    this.droneGain.gain.linearRampToValueAtTime(0.045 + level * 0.085, this.now + 1.5);
  }

  /* ----- the entity's breathing (volume follows proximity) ----- */

  _startBreath() {
    const src = this._noiseSource(true);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 480;
    bp.Q.value = 1.1;
    this.breathGain = this.ctx.createGain();
    this.breathGain.gain.value = 0;
    // slow inhale/exhale shape
    const lfo = this.ctx.createOscillator();
    lfo.frequency.value = 0.31;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.5;
    const shaper = this.ctx.createGain();
    shaper.gain.value = 0.5;
    lfo.connect(lfoG);
    lfoG.connect(shaper.gain);
    src.connect(bp); bp.connect(shaper); shaper.connect(this.breathGain);
    // wet rumble underneath
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = 41;
    const am = this.ctx.createOscillator();
    am.frequency.value = 6.3;
    const amG = this.ctx.createGain();
    amG.gain.value = 0.5;
    const oG = this.ctx.createGain();
    oG.gain.value = 0.5;
    am.connect(amG); amG.connect(oG.gain);
    o.connect(oG); oG.connect(this.breathGain);
    this._out(this.breathGain, 0.3);
    src.start(); lfo.start(); o.start(); am.start();
  }

  /** 0 = silent, 1 = he is on top of you */
  setBreathLevel(level) {
    if (!this.breathGain) return;
    this.breathGain.gain.linearRampToValueAtTime(Math.min(1, level) * 0.14, this.now + 0.25);
  }

  /* ----- burn sizzle while the beam is on him ----- */

  _startSizzle() {
    const src = this._noiseSource(true);
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 2800;
    this.sizzleGain = this.ctx.createGain();
    this.sizzleGain.gain.value = 0;
    // crackle modulation
    const lfo = this.ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 27;
    const lfoG = this.ctx.createGain();
    lfoG.gain.value = 0.35;
    const sh = this.ctx.createGain();
    sh.gain.value = 0.65;
    lfo.connect(lfoG); lfoG.connect(sh.gain);
    src.connect(hp); hp.connect(sh); sh.connect(this.sizzleGain);
    this._out(this.sizzleGain, 0.15);
    src.start(); lfo.start();
  }

  setSizzle(level) { // 0..1
    if (!this.sizzleGain) return;
    this.sizzleGain.gain.linearRampToValueAtTime(level * 0.12, this.now + 0.08);
  }

  /* ----- heartbeat ----- */

  startHeartbeat(bpm = 80) {
    if (this._heartBpm === bpm && this.heartbeatTimer) return;
    this._heartBpm = bpm;
    this.stopHeartbeat(false);
    const beat = () => {
      for (const [offset, vol] of [[0, 0.5], [0.16, 0.32]]) {
        const t = this.now + offset;
        const o = this.ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(58, t);
        o.frequency.exponentialRampToValueAtTime(34, t + 0.12);
        const g = this.ctx.createGain();
        this._env(g, t, 0.012, vol, 0.16);
        o.connect(g);
        g.connect(this.master);
        o.start(t);
        o.stop(t + 0.35);
      }
    };
    beat();
    this.heartbeatTimer = setInterval(beat, 60000 / bpm);
  }

  stopHeartbeat(clearBpm = true) {
    if (this.heartbeatTimer) { clearInterval(this.heartbeatTimer); this.heartbeatTimer = null; }
    if (clearBpm) this._heartBpm = 0;
  }

  /* ----- chase music — dissonant pounding ostinato ----- */

  startChaseMusic() {
    if (this.chaseTimer) return;
    let step = 0;
    const tick = () => {
      const t = this.now;
      // pounding low cluster on every step
      for (const f of [98, 103.8]) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = f * (step % 4 === 3 ? 0.84 : 1);
        const lp = this.ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 600;
        const g = this.ctx.createGain();
        this._env(g, t, 0.005, 0.085, 0.16);
        o.connect(lp); lp.connect(g);
        this._out(g, 0.18);
        o.start(t); o.stop(t + 0.22);
      }
      // shrieking violin tremolo stab every other bar
      if (step % 8 === 4) {
        const o = this.ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.setValueAtTime(1244 + Math.random() * 220, t);
        o.frequency.linearRampToValueAtTime(1180, t + 0.8);
        const am = this.ctx.createOscillator();
        am.frequency.value = 16;
        const amG = this.ctx.createGain();
        amG.gain.value = 0.5;
        const sh = this.ctx.createGain();
        sh.gain.value = 0.5;
        am.connect(amG); amG.connect(sh.gain);
        const g = this.ctx.createGain();
        this._env(g, t, 0.03, 0.05, 0.85);
        o.connect(sh); sh.connect(g);
        this._out(g, 0.4);
        o.start(t); o.stop(t + 1);
        am.start(t); am.stop(t + 1);
      }
      step++;
    };
    tick();
    this.chaseTimer = setInterval(tick, 214); // ~140bpm eighths
  }

  stopChaseMusic() {
    if (this.chaseTimer) { clearInterval(this.chaseTimer); this.chaseTimer = null; }
  }

  /* ================= one-shots ================= */

  footstep(running = false, pan = 0) {
    const t = this.now;
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    this._out(p, 0.07);
    // heel thump
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(78, t);
    o.frequency.exponentialRampToValueAtTime(42, t + 0.07);
    const og = this.ctx.createGain();
    this._env(og, t, 0.003, running ? 0.2 : 0.11, 0.07);
    o.connect(og); og.connect(p);
    o.start(t); o.stop(t + 0.12);
    // sole scuff
    const src = this._noiseSource();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900 + Math.random() * 500;
    const g = this.ctx.createGain();
    this._env(g, t, 0.004, running ? 0.07 : 0.04, 0.06);
    src.connect(lp); lp.connect(g); g.connect(p);
    src.start(t); src.stop(t + 0.1);
    // old board resonance, sometimes
    if (Math.random() < 0.3) {
      const b = this.ctx.createOscillator();
      b.type = 'triangle';
      b.frequency.value = 120 + Math.random() * 90;
      const bg = this.ctx.createGain();
      this._env(bg, t + 0.01, 0.01, 0.045, 0.18);
      b.connect(bg); bg.connect(p);
      b.start(t); b.stop(t + 0.25);
    }
    if (Math.random() < 0.1) this.creak(0.25);
  }

  creak(vol = 0.4) {
    const t = this.now;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(90 + Math.random() * 60, t);
    o.frequency.exponentialRampToValueAtTime(40 + Math.random() * 30, t + 0.7);
    // stick-slip stutter
    const stut = this.ctx.createOscillator();
    stut.type = 'square';
    stut.frequency.value = 11 + Math.random() * 9;
    const stutG = this.ctx.createGain();
    stutG.gain.value = 0.4;
    const sh = this.ctx.createGain();
    sh.gain.value = 0.6;
    stut.connect(stutG); stutG.connect(sh.gain);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 420;
    const g = this.ctx.createGain();
    this._env(g, t, 0.08, vol * 0.16, 0.75);
    o.connect(lp); lp.connect(sh); sh.connect(g);
    this._out(g, 0.22);
    o.start(t); o.stop(t + 1);
    stut.start(t); stut.stop(t + 1);
  }

  doorCreak() {
    this.creak(0.9);
    // hinge squeal on top
    const t = this.now;
    const o = this.ctx.createOscillator();
    o.type = 'triangle';
    o.frequency.setValueAtTime(1180 + Math.random() * 300, t);
    o.frequency.exponentialRampToValueAtTime(640, t + 0.55);
    const g = this.ctx.createGain();
    this._env(g, t + 0.05, 0.06, 0.022, 0.5);
    o.connect(g);
    this._out(g, 0.3);
    o.start(t); o.stop(t + 0.8);
  }

  thump(vol = 0.5) {
    const t = this.now;
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(52, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 0.25);
    const g = this.ctx.createGain();
    this._env(g, t, 0.008, vol, 0.45);
    o.connect(g);
    this._out(g, 0.2);
    o.start(t); o.stop(t + 0.7);
  }

  slam() {
    const t = this.now;
    this.thump(0.85);
    const src = this._noiseSource();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 900;
    const g = this.ctx.createGain();
    this._env(g, t, 0.003, 0.5, 0.22);
    src.connect(lp); lp.connect(g);
    this._out(g, 0.3);
    src.start(t); src.stop(t + 0.3);
    // rattling frame after the hit
    const r = this._noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1700;
    bp.Q.value = 6;
    const rg = this.ctx.createGain();
    this._env(rg, t + 0.06, 0.01, 0.07, 0.4);
    r.connect(bp); bp.connect(rg);
    this._out(rg, 0.25);
    r.start(t); r.stop(t + 0.6);
  }

  whisper(pan = 0) {
    const t = this.now;
    const src = this._noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(1500 + Math.random() * 900, t);
    bp.Q.value = 7;
    const g = this.ctx.createGain();
    const p = this.ctx.createStereoPanner();
    p.pan.value = pan;
    let tt = t;
    g.gain.setValueAtTime(0.0001, tt);
    for (let i = 0; i < 11; i++) {
      const dur = 0.05 + Math.random() * 0.14;
      g.gain.linearRampToValueAtTime(Math.random() * 0.05 + 0.012, tt + dur * 0.4);
      g.gain.linearRampToValueAtTime(0.004, tt + dur);
      tt += dur;
    }
    g.gain.linearRampToValueAtTime(0.0001, tt + 0.1);
    src.connect(bp); bp.connect(g); g.connect(p);
    this._out(p, 0.55);
    src.start(t); src.stop(tt + 0.2);
    // low murmur under the sibilance
    const o = this.ctx.createOscillator();
    o.type = 'sine';
    o.frequency.setValueAtTime(170 + Math.random() * 60, t);
    o.frequency.linearRampToValueAtTime(120, tt);
    const og = this.ctx.createGain();
    this._env(og, t, 0.3, 0.015, tt - t);
    o.connect(og); og.connect(p);
    o.start(t); o.stop(tt + 0.3);
  }

  stinger(intensity = 1) {
    const t = this.now;
    for (const f of [98, 103.8, 196.5, 233]) {
      const o = this.ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * (1 + Math.random() * 0.01), t);
      o.frequency.linearRampToValueAtTime(f * 0.94, t + 1.1);
      const g = this.ctx.createGain();
      this._env(g, t, 0.006, 0.15 * intensity, 1.1);
      o.connect(g);
      this._out(g, 0.3);
      o.start(t); o.stop(t + 1.3);
    }
    const src = this._noiseSource();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 700;
    const g = this.ctx.createGain();
    this._env(g, t, 0.004, 0.28 * intensity, 0.5);
    src.connect(hp); hp.connect(g);
    this._out(g, 0.35);
    src.start(t); src.stop(t + 0.7);
  }

  scream() {
    const t = this.now;
    for (const [f0, f1, type] of [[620, 1480, 'sawtooth'], [880, 1960, 'square']]) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f1, t + 0.45);
      o.frequency.exponentialRampToValueAtTime(f1 * 0.7, t + 1.1);
      const vib = this.ctx.createOscillator();
      vib.frequency.value = 28;
      const vibG = this.ctx.createGain();
      vibG.gain.value = 70;
      vib.connect(vibG); vibG.connect(o.frequency);
      const g = this.ctx.createGain();
      this._env(g, t, 0.015, 0.16, 1.15);
      o.connect(g);
      this._out(g, 0.35);
      o.start(t); o.stop(t + 1.35);
      vib.start(t); vib.stop(t + 1.35);
    }
    const src = this._noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900, t);
    bp.frequency.exponentialRampToValueAtTime(2400, t + 0.5);
    bp.Q.value = 1.4;
    const g = this.ctx.createGain();
    this._env(g, t, 0.01, 0.4, 1.0);
    src.connect(bp); bp.connect(g);
    this._out(g, 0.4);
    src.start(t); src.stop(t + 1.3);
    this.stinger(1.2);
  }

  /** The entity recoiling from the light — a falling, defeated shriek. */
  banishShriek() {
    const t = this.now;
    for (const [f0, type] of [[1660, 'sawtooth'], [2210, 'square']]) {
      const o = this.ctx.createOscillator();
      o.type = type;
      o.frequency.setValueAtTime(f0, t);
      o.frequency.exponentialRampToValueAtTime(f0 * 0.22, t + 1.3);
      const vib = this.ctx.createOscillator();
      vib.frequency.value = 34;
      const vibG = this.ctx.createGain();
      vibG.gain.value = 110;
      vib.connect(vibG); vibG.connect(o.frequency);
      const g = this.ctx.createGain();
      this._env(g, t, 0.01, 0.12, 1.3);
      o.connect(g);
      this._out(g, 0.55);
      o.start(t); o.stop(t + 1.5);
      vib.start(t); vib.stop(t + 1.5);
    }
    // vapor hiss as he dissolves
    const src = this._noiseSource();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.setValueAtTime(1400, t);
    hp.frequency.exponentialRampToValueAtTime(5200, t + 1.2);
    const g = this.ctx.createGain();
    this._env(g, t, 0.02, 0.18, 1.25);
    src.connect(hp); hp.connect(g);
    this._out(g, 0.5);
    src.start(t); src.stop(t + 1.5);
  }

  /** Wet distorted growl when he begins to stalk. */
  growl() {
    const t = this.now;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(36, t);
    o.frequency.linearRampToValueAtTime(52, t + 0.8);
    o.frequency.linearRampToValueAtTime(30, t + 1.8);
    const am = this.ctx.createOscillator();
    am.frequency.value = 7.5;
    const amG = this.ctx.createGain();
    amG.gain.value = 0.5;
    const sh = this.ctx.createGain();
    sh.gain.value = 0.5;
    am.connect(amG); amG.connect(sh.gain);
    const dist = this.ctx.createWaveShaper();
    dist.curve = this._distortionCurve(60);
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 320;
    const g = this.ctx.createGain();
    this._env(g, t, 0.25, 0.5, 1.6);
    o.connect(sh); sh.connect(dist); dist.connect(lp); lp.connect(g);
    this._out(g, 0.3);
    o.start(t); o.stop(t + 2);
    am.start(t); am.stop(t + 2);
  }

  /** Distant thunder; call with the delay matching the lightning flash. */
  thunder(delay = 0.8, loud = false) {
    const t = this.now + delay;
    const src = this._noiseSource();
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(loud ? 160 : 95, t);
    lp.frequency.exponentialRampToValueAtTime(45, t + 3);
    lp.Q.value = 1.2;
    const g = this.ctx.createGain();
    this._env(g, t, loud ? 0.06 : 0.4, loud ? 0.5 : 0.28, 3.2);
    src.connect(lp); lp.connect(g);
    this._out(g, 0.25);
    src.start(t); src.stop(t + 4);
    if (loud) {
      // close-strike crack
      const c = this._noiseSource();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 900;
      bp.Q.value = 0.8;
      const cg = this.ctx.createGain();
      this._env(cg, t, 0.005, 0.3, 0.5);
      c.connect(bp); bp.connect(cg);
      this._out(cg, 0.35);
      c.start(t); c.stop(t + 0.7);
    }
  }

  staticBurst(vol = 0.25) {
    const t = this.now;
    const src = this._noiseSource();
    const hp = this.ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 1800;
    const g = this.ctx.createGain();
    this._env(g, t, 0.005, vol, 0.3);
    src.connect(hp); hp.connect(g);
    this._out(g, 0.15);
    src.start(t); src.stop(t + 0.4);
  }

  pickup() {
    const t = this.now;
    for (const [f, d] of [[1244, 0], [1864, 0.05], [2488, 0.11]]) {
      const o = this.ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      const g = this.ctx.createGain();
      this._env(g, t + d, 0.005, 0.08, 0.55);
      o.connect(g);
      this._out(g, 0.45);
      o.start(t + d); o.stop(t + d + 0.7);
    }
  }

  batteryPickup() {
    const t = this.now;
    // plastic clack + electric blip
    const src = this._noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2100;
    bp.Q.value = 3;
    const g = this.ctx.createGain();
    this._env(g, t, 0.002, 0.14, 0.07);
    src.connect(bp); bp.connect(g);
    this._out(g, 0.2);
    src.start(t); src.stop(t + 0.1);
    for (const [f, d] of [[520, 0.06], [780, 0.13]]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1600;
      const og = this.ctx.createGain();
      this._env(og, t + d, 0.004, 0.06, 0.09);
      o.connect(lp); lp.connect(og);
      this._out(og, 0.2);
      o.start(t + d); o.stop(t + d + 0.14);
    }
  }

  click() {
    const t = this.now;
    const src = this._noiseSource();
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 2600;
    bp.Q.value = 4;
    const g = this.ctx.createGain();
    this._env(g, t, 0.001, 0.12, 0.05);
    src.connect(bp); bp.connect(g); g.connect(this.master);
    src.start(t); src.stop(t + 0.08);
  }

  lockedRattle() {
    for (const d of [0, 0.13, 0.24]) {
      const t = this.now + d;
      const src = this._noiseSource();
      const bp = this.ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1100 + Math.random() * 500;
      bp.Q.value = 3;
      const g = this.ctx.createGain();
      this._env(g, t, 0.002, 0.2, 0.08);
      src.connect(bp); bp.connect(g);
      this._out(g, 0.2);
      src.start(t); src.stop(t + 0.12);
    }
    this.thump(0.25);
  }

  unlock() {
    const t = this.now;
    for (const [f, d] of [[480, 0], [720, 0.12], [340, 0.26], [180, 0.4]]) {
      const o = this.ctx.createOscillator();
      o.type = 'square';
      o.frequency.value = f;
      const lp = this.ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.value = 1400;
      const g = this.ctx.createGain();
      this._env(g, t + d, 0.002, 0.09, 0.09);
      o.connect(lp); lp.connect(g);
      this._out(g, 0.25);
      o.start(t + d); o.stop(t + d + 0.15);
    }
  }

  chairScrape() {
    const t = this.now;
    const o = this.ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(190, t);
    o.frequency.linearRampToValueAtTime(150, t + 0.8);
    const bp = this.ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 800;
    bp.Q.value = 1.2;
    const g = this.ctx.createGain();
    this._env(g, t, 0.04, 0.18, 0.85);
    o.connect(bp); bp.connect(g);
    this._out(g, 0.3);
    o.start(t); o.stop(t + 1);
    const src = this._noiseSource();
    const g2 = this.ctx.createGain();
    this._env(g2, t, 0.04, 0.06, 0.85);
    src.connect(bp);
    src.start(t); src.stop(t + 1);
  }
}
