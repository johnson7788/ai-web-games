// 全程序化音效（WebAudio 合成，零音频文件）
export class GameAudio {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.sfx = null;
    this.music = null;
    this.muted = false;
    this.musicVol = 0.7;
    this.sfxVol = 0.8;
    this.musicTimer = null;
  }

  ensure() {
    if (this.ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = 0.9;
    this.master.connect(this.ctx.destination);
    this.sfx = this.ctx.createGain();
    this.sfx.gain.value = 0.24 * this.sfxVol;
    this.sfx.connect(this.master);
    this.music = this.ctx.createGain();
    this.music.gain.value = 0.12 * this.musicVol;
    this.music.connect(this.master);
    return true;
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') this.ctx.resume();
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 0.9;
  }

  setMusicVolume(v) {
    this.musicVol = Math.max(0, Math.min(1, v));
    if (this.music) this.music.gain.value = 0.12 * this.musicVol;
  }

  setSfxVolume(v) {
    this.sfxVol = Math.max(0, Math.min(1, v));
    if (this.sfx) this.sfx.gain.value = 0.24 * this.sfxVol;
  }

  tone({ freq = 440, to = freq, dur = 0.12, type = 'square', gain = 0.6, at = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + at;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(g);
    g.connect(this.sfx);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  noise({ dur = 0.12, gain = 0.4, at = 0 }) {
    if (!this.ctx || this.muted) return;
    const t0 = this.ctx.currentTime + at;
    const len = Math.max(1, Math.floor(this.ctx.sampleRate * dur));
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = this.ctx.createBufferSource();
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.buffer = buf;
    src.connect(g);
    g.connect(this.sfx);
    src.start(t0);
  }

  jump() { this.tone({ freq: 240, to: 520, dur: 0.11, type: 'square' }); }
  land() { this.tone({ freq: 110, to: 70, dur: 0.07, type: 'triangle', gain: 0.5 }); this.noise({ dur: 0.05, gain: 0.15 }); }
  coin() { this.tone({ freq: 988, dur: 0.06 }); this.tone({ freq: 1319, dur: 0.09, at: 0.06 }); }
  stomp() { this.noise({ dur: 0.09, gain: 0.35 }); this.tone({ freq: 180, to: 90, dur: 0.1, type: 'square' }); }
  kick() { this.tone({ freq: 320, to: 160, dur: 0.09, type: 'sawtooth', gain: 0.4 }); }
  hurt() { [0, 0.07, 0.14].forEach((at, i) => this.tone({ freq: 440 - i * 90, dur: 0.08, at, type: 'sawtooth' })); }
  bump() { this.tone({ freq: 200, to: 150, dur: 0.06, type: 'square', gain: 0.45 }); }
  brick() { this.noise({ dur: 0.12, gain: 0.4 }); this.tone({ freq: 140, to: 70, dur: 0.1, type: 'square' }); }
  powerup() { [523, 659, 784, 988, 1319].forEach((f, i) => this.tone({ freq: f, dur: 0.1, at: i * 0.06, type: 'triangle', gain: 0.45 })); }
  fire() { this.tone({ freq: 620, to: 300, dur: 0.12, type: 'sawtooth', gain: 0.4 }); this.noise({ dur: 0.08, gain: 0.2 }); }
  spring() { this.tone({ freq: 300, to: 900, dur: 0.16, type: 'sine', gain: 0.5 }); }

  checkpoint() { [660, 880].forEach((f, i) => this.tone({ freq: f, dur: 0.09, at: i * 0.08 })); }
  // ---- BGM：16 步循环（bass + arp + hat），全程序化
  startMusic() {
    if (!this.ctx || this.musicTimer) return;
    const stepDur = 60 / 104 / 4;
    const bass = [110, 0, 0, 0, 110, 0, 0, 0, 87.3, 0, 0, 0, 98, 0, 0, 0];
    const arp = [440, 523, 659, 523, 440, 523, 659, 784, 392, 523, 659, 523, 440, 523, 587, 659];
    let step = 0;
    let next = this.ctx.currentTime + 0.1;

    const voice = (freq, at, dur, type, gain, dest) => {
      const o = this.ctx.createOscillator();
      const g = this.ctx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(0.0001, at);
      g.gain.exponentialRampToValueAtTime(gain, at + 0.012);
      g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
      o.connect(g);
      g.connect(dest);
      o.start(at);
      o.stop(at + dur + 0.02);
    };

    const tick = () => {
      const horizon = this.ctx.currentTime + 0.22;
      while (next < horizon) {
        const i = step % 16;
        if (bass[i]) voice(bass[i], next, 0.22, 'triangle', 0.5, this.music);
        if (arp[i]) voice(arp[i], next, 0.11, 'square', 0.16, this.music);
        if (i % 2 === 0) {
          const o = this.ctx.createOscillator();
          const g = this.ctx.createGain();
          o.type = 'square';
          o.frequency.value = 6200;
          g.gain.setValueAtTime(0.02, next);
          g.gain.exponentialRampToValueAtTime(0.0001, next + 0.03);
          o.connect(g); g.connect(this.music);
          o.start(next); o.stop(next + 0.04);
        }
        next += stepDur;
        step++;
      }
    };
    tick();
    this.musicTimer = setInterval(tick, 80);
  }

  stopMusic() {
    if (this.musicTimer) { clearInterval(this.musicTimer); this.musicTimer = null; }
  }

  clear() { [523, 659, 784, 1047].forEach((f, i) => this.tone({ freq: f, dur: 0.16, at: i * 0.12, type: 'triangle', gain: 0.5 })); }
}
