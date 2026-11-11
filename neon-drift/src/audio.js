/**
 * 全程序化音效（WebAudio 合成，零音频文件）：
 * 引擎声随速度变调、漂移用滤波噪声、氮气是噪声扫频、倒计时是正弦 beep。
 */
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.engine = null;
    this.skidNode = null;
    this.muted = false;
  }

  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);

    // 白噪声缓冲（漂移/氮气/撞击共用）
    const len = this.ctx.sampleRate * 1.2;
    this.noise = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    this._buildEngine();
    this._buildSkid();
    return true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  _buildEngine() {
    const ctx = this.ctx;
    const g = ctx.createGain();
    g.gain.value = 0;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 700;
    lp.Q.value = 3.2;

    const o1 = ctx.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 52;
    const o2 = ctx.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 78;
    const g2 = ctx.createGain();
    g2.gain.value = 0.35;

    o1.connect(lp);
    o2.connect(g2).connect(lp);
    lp.connect(g).connect(this.master);
    o1.start(); o2.start();

    this.engine = { o1, o2, lp, g };
  }

  _buildSkid() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 1800;
    bp.Q.value = 1.1;
    const g = ctx.createGain();
    g.gain.value = 0;
    src.connect(bp).connect(g).connect(this.master);
    src.start();
    this.skidNode = { g, bp };
  }

  setEngine(ratio, boosting) {
    if (!this.engine) return;
    const t = this.ctx.currentTime;
    const f = 48 + ratio * 118 + (boosting ? 26 : 0);
    this.engine.o1.frequency.setTargetAtTime(f, t, 0.06);
    this.engine.o2.frequency.setTargetAtTime(f * 1.51, t, 0.06);
    this.engine.lp.frequency.setTargetAtTime(520 + ratio * 1500 + (boosting ? 600 : 0), t, 0.08);
    this.engine.g.gain.setTargetAtTime(0.045 + ratio * 0.055, t, 0.12);
  }

  setSkid(on, intensity = 1) {
    if (!this.skidNode) return;
    const t = this.ctx.currentTime;
    this.skidNode.g.gain.setTargetAtTime(on ? 0.035 * intensity : 0, t, 0.05);
    this.skidNode.bp.frequency.setTargetAtTime(1500 + intensity * 900, t, 0.1);
  }

  envelope(freq, dur, type = 'sine', vol = 0.16, slide = null) {
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  }

  beep(high = false) { this.envelope(high ? 880 : 440, high ? 0.35 : 0.14, 'square', 0.10); }
  lap() { this.envelope(660, 0.18, 'triangle', 0.13, 990); }
  crash() {
    if (!this.ctx) return;
    const src = this.ctx.createBufferSource();
    src.buffer = this.noise;
    const lp = this.ctx.createBiquadFilter();
    lp.type = 'lowpass'; lp.frequency.value = 900;
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.22, this.ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.32);
    src.connect(lp).connect(g).connect(this.master);
    src.start(); src.stop(this.ctx.currentTime + 0.35);
    this.envelope(90, 0.25, 'sine', 0.18, 45);
  }
  boost() { this.envelope(220, 0.55, 'sawtooth', 0.12, 880); }
  ui() { this.envelope(520, 0.07, 'triangle', 0.07); }

  stopAll() {
    if (this.engine) this.engine.g.gain.value = 0;
    if (this.skidNode) this.skidNode.g.gain.value = 0;
  }
}
