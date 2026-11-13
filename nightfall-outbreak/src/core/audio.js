// src/core/audio.js — 纯 WebAudio 实时合成（用户选择：零真实采样文件）。
// 枪声 = 瞬态噪声 + 扫频低通 + 低频体感 + 高频裂纹 + 早期反射 + 卷积房间尾音
// 僵尸 = 声带锯齿脉冲 + 三段共振峰 + 湿噪气声 + 音高摇晃
// BGM  = 132 BPM 激扬战斗循环（底鼓/军鼓/16 分 hat/失真 bass/铜管和声/arp），随波次加层
// assets/audio/*.wav 是 tools/gen_audio.py 用同算法离线渲染的镜像，仅在 AudioContext 不可用时降级播放。
import { GAME } from "config/game.config.js";

const BPM = 132;
const STEP = 60 / BPM / 4;              // 16 分音符
const MUTE_KEY = "pipy:nightfall-outbreak:muted:v2";
// 8 小节进行式：Am → C → G → F → Am → C → G → F。
// 根音 / 三和弦 / 主旋律音高都逐小节变化，避免「只有 4 个和弦永远循环」的单调鼓机感。
const PROG = [
  { bass: 55.00, chord: [220.00, 261.63, 329.63], lead: [440.00, 523.25, 659.25, 587.33] },
  { bass: 65.41, chord: [196.00, 261.63, 329.63], lead: [392.00, 523.25, 659.25, 587.33] },
  { bass: 73.42, chord: [196.00, 246.94, 293.66], lead: [392.00, 493.88, 587.33, 523.25] },
  { bass: 87.31, chord: [174.61, 220.00, 261.63], lead: [349.23, 440.00, 523.25, 493.88] },
  { bass: 55.00, chord: [220.00, 261.63, 329.63], lead: [659.25, 587.33, 523.25, 440.00] },
  { bass: 65.41, chord: [196.00, 261.63, 329.63], lead: [659.25, 784.00, 659.25, 523.25] },
  { bass: 73.42, chord: [196.00, 246.94, 293.66], lead: [587.33, 784.00, 880.00, 784.00] },
  { bass: 87.31, chord: [174.61, 220.00, 261.63], lead: [698.46, 880.00, 784.00, 698.46] }
];

export class GameAudio {
  constructor(cfg = GAME.audio) {
    this.cfg = cfg;
    this.dir = cfg.dir || "assets/audio/";
    this.files = cfg.files || {};
    this.master = typeof cfg.master === "number" ? cfg.master : 0.8;
    this.muted = false;
    this.unlocked = false;
    this.ctx = null;
    this.intensity = 0.35;
    this._step = 0;
    this._nextTime = 0;
    this._timer = 0;
    this._fallback = new Map();
    // 换 key 是为了丢弃旧版「暂停误写静音」留下的脏状态；v2 起只有用户主动点喇叭才持久化。
    try { this.muted = localStorage.getItem(MUTE_KEY) === "1"; } catch (_) { /* 忽略 */ }
  }

  /** 建立降级用的 <audio> 池（不 await、不挡开屏） */
  build() {
    const mk = (file, loop) => {
      const el = document.createElement("audio");
      el.src = this.dir + file;
      el.preload = "none";
      el.loop = !!loop;
      el.volume = this.master * 0.8;
      return el;
    };
    for (const [name, file] of Object.entries(this.files)) this._fallback.set(name, mk(file, false));
    this._fallback.set("bgm", mk(this.cfg.bgm, true));
    return this;
  }

  /** 首次用户交互后解锁（自动播放策略）；真正建 AudioContext 在这里 */
  unlock() {
    if (this.unlocked) return;
    this.unlocked = true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) { this._fallbackMusic(); return; }
    try {
      const ctx = new AC();
      this.ctx = ctx;
      this.out = ctx.createGain();
      this.out.gain.value = this.muted ? 0 : this.master;
      this.limiter = ctx.createDynamicsCompressor();
      this.limiter.threshold.value = -10;
      this.limiter.ratio.value = 8;
      this.limiter.attack.value = 0.003;
      this.limiter.release.value = 0.18;
      this.out.connect(this.limiter).connect(ctx.destination);
      // 0 增益旁路分析节点：让冒烟能实测「主输出确实有波形」，而不只是「调度器在跑」
      this.analyser = ctx.createAnalyser();
      this.analyser.fftSize = 1024;
      this._fft = new Float32Array(this.analyser.fftSize);
      const silent = ctx.createGain();
      silent.gain.value = 0;
      this.out.connect(this.analyser).connect(silent).connect(ctx.destination);

      this.dry = ctx.createGain();
      this.dry.gain.value = 0.92;
      this.dry.connect(this.out);
      this.wet = ctx.createConvolver();
      this.wet.buffer = this._impulse(1.15, 2.6);
      this.wetGain = ctx.createGain();
      this.wetGain.gain.value = 0.26;
      this.wet.connect(this.wetGain).connect(this.out);
      this.send = ctx.createGain();
      this.send.gain.value = 0.5;
      this.send.connect(this.wet);

      this.noise = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const d = this.noise.getChannelData(0);
      for (let i = 0; i < d.length; i += 1) d[i] = Math.random() * 2 - 1;

      if (ctx.state === "suspended") ctx.resume().catch(() => {});
      this._startWind();
      this.ensureMusic();
    } catch (_) {
      this.ctx = null;
      this._fallbackMusic();
    }
  }

  _impulse(dur, decay) {
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(2, n, this.ctx.sampleRate);
    for (let c = 0; c < 2; c += 1) {
      const d = buf.getChannelData(c);
      for (let i = 0; i < n; i += 1) {
        d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, decay);
      }
    }
    return buf;
  }

  _noiseSource(at, dur) {
    const s = this.ctx.createBufferSource();
    s.buffer = this.noise;
    s.loop = true;
    s.start(at, Math.random() * 1.5);
    s.stop(at + dur);
    return s;
  }

  _env(at, peak, attack, decay) {
    const g = this.ctx.createGain();
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    return g;
  }

  _toBus(node, wet = 0.5) {
    node.connect(this.dry);
    if (wet > 0) {
      const s = this.ctx.createGain();
      s.gain.value = wet;
      node.connect(s).connect(this.send);
    }
  }

  _startWind() {
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 420;
    const g = ctx.createGain();
    g.gain.value = 0.022;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.13;
    const lg = ctx.createGain();
    lg.gain.value = 0.014;
    lfo.connect(lg).connect(g.gain);
    src.connect(lp).connect(g).connect(this.out);
    src.start();
    lfo.start();
    this.wind = g;
  }

  // ------------------------------------------------------------ 合成音效
  _rifle(at, gain = 1) {
    const ctx = this.ctx;
    // 主爆音：低通 9kHz → 700Hz 扫频
    const n = this._noiseSource(at, 0.36);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(9500, at);
    lp.frequency.exponentialRampToValueAtTime(720, at + 0.085);
    const g = this._env(at, 0.85 * gain, 0.001, 0.24);
    n.connect(lp).connect(g);
    this._toBus(g, 0.55);
    // 高频裂纹
    const c = this._noiseSource(at, 0.035);
    const hp = ctx.createBiquadFilter();
    hp.type = "highpass";
    hp.frequency.value = 3400;
    const cg = this._env(at, 0.42 * gain, 0.0005, 0.024);
    c.connect(hp).connect(cg);
    this._toBus(cg, 0.2);
    // 枪托抵肩的低频体感
    const o = ctx.createOscillator();
    o.type = "sine";
    o.frequency.setValueAtTime(96, at);
    o.frequency.exponentialRampToValueAtTime(48, at + 0.13);
    const og = this._env(at, 0.55 * gain, 0.002, 0.16);
    o.connect(og);
    this._toBus(og, 0.1);
    o.start(at); o.stop(at + 0.2);
    // 早期反射：三声短促的同类爆音，越远越闷
    for (const [ms, amp, cut] of [[23, 0.34, 4200], [47, 0.20, 2400], [83, 0.12, 1400]]) {
      const t2 = at + ms / 1000;
      const r = this._noiseSource(t2, 0.12);
      const f = ctx.createBiquadFilter();
      f.type = "lowpass"; f.frequency.value = cut;
      const rg = this._env(t2, amp * gain, 0.001, 0.08);
      r.connect(f).connect(rg);
      this._toBus(rg, 0.7);
    }
    // 枪机
    const m = this._noiseSource(at + 0.045, 0.05);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = 1900; bp.Q.value = 5;
    const mg = this._env(at + 0.045, 0.16 * gain, 0.001, 0.035);
    m.connect(bp).connect(mg);
    this._toBus(mg, 0.15);
  }

  _growl(at, { dur = 1.0, base = 96, down = false, gain = 1 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = "sawtooth";
    o.frequency.setValueAtTime(base, at);
    if (down) o.frequency.exponentialRampToValueAtTime(base * 0.55, at + dur);
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 5.1;
    const lg = ctx.createGain();
    lg.gain.value = base * 0.06;
    lfo.connect(lg).connect(o.frequency);
    const amp = this._env(at, 0.24 * gain, 0.07, dur * 0.72);
    // 三段共振峰并联（喉 / 口 / 鼻）
    for (const [f, q, v] of [[320, 6, 1.0], [780, 8, 0.7], [1450, 10, 0.35]]) {
      const bp = ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = f; bp.Q.value = q;
      const vg = ctx.createGain(); vg.gain.value = v;
      o.connect(bp).connect(vg).connect(amp);
    }
    // 湿噪气声
    const n = this._noiseSource(at, dur);
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass"; lp.frequency.value = 900;
    const ng = ctx.createGain(); ng.gain.value = 0.12;
    n.connect(lp).connect(ng).connect(amp);
    this._toBus(amp, 0.35);
    o.start(at); o.stop(at + dur + 0.05);
    lfo.start(at); lfo.stop(at + dur + 0.05);
  }

  _hit(at, { freq = 520, gain = 1, dur = 0.22, thump = 0.4 } = {}) {
    const ctx = this.ctx;
    const n = this._noiseSource(at, dur);
    const bp = ctx.createBiquadFilter();
    bp.type = "bandpass"; bp.frequency.value = freq; bp.Q.value = 2.2;
    const g = this._env(at, 0.5 * gain, 0.001, dur * 0.7);
    n.connect(bp).connect(g);
    this._toBus(g, 0.3);
    if (thump) {
      const o = ctx.createOscillator();
      o.type = "sine";
      o.frequency.setValueAtTime(150, at);
      o.frequency.exponentialRampToValueAtTime(55, at + 0.12);
      const og = this._env(at, thump * gain, 0.002, 0.14);
      o.connect(og); this._toBus(og, 0.12);
      o.start(at); o.stop(at + 0.18);
    }
  }

  _tone(at, f, dur, { type = "sine", gain = 0.2, cutoff = 0, wet = 0.25 } = {}) {
    const ctx = this.ctx;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.value = f;
    const g = this._env(at, gain, 0.004, dur * 0.8);
    let last = o;
    if (cutoff) {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass"; lp.frequency.value = cutoff;
      o.connect(lp); last = lp;
    }
    last.connect(g);
    this._toBus(g, wet);
    o.start(at); o.stop(at + dur);
  }

  _clicks(at, count = 3) {
    for (let i = 0; i < count; i += 1) {
      const t = at + i * 0.13;
      const n = this._noiseSource(t, 0.06);
      const bp = this.ctx.createBiquadFilter();
      bp.type = "bandpass"; bp.frequency.value = 2100 - i * 320; bp.Q.value = 7;
      const g = this._env(t, 0.22 - i * 0.03, 0.001, 0.03);
      n.connect(bp).connect(g);
      this._toBus(g, 0.1);
    }
  }

  // ------------------------------------------------------------ BGM 合成器
  /** 幂等：任何交互 / resume / 开局都会调一次，调度器意外停掉也能自己复活 */
  music() { this.ensureMusic(); }

  ensureMusic() {
    if (!this.ctx) { this._fallbackMusic(); return; }
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => {});
    if (this._timer) return;
    this._nextTime = this.ctx.currentTime + 0.06;
    this._timer = setInterval(() => this._schedule(), 25);
  }

  _fallbackMusic() {
    const el = this._fallback.get("bgm");
    if (el && !this.muted) { el.volume = this.master * 0.5; el.play().catch(() => {}); }
  }

  _schedule() {
    const ctx = this.ctx;
    if (!ctx) return;
    const now = ctx.currentTime;
    // 静音 / 后台期间也推进时间轴：恢复时不能把几百个过期音符一次性倒出来。
    if (this.muted) { this._nextTime = now + 0.05; return; }
    if (this._nextTime < now - 0.30) this._nextTime = now + 0.05;
    const ahead = now + 0.16;
    let guard = 0;
    while (this._nextTime < ahead && guard++ < 24) {
      const t = this._nextTime;
      const s = this._step % 128;                 // 8 小节 × 16 个 16 分音符
      const bar = Math.floor(s / 16);
      const beat = s % 16;
      const P = PROG[bar];
      const I = this.intensity;

      // 底鼓：1 / 3 拍 + 切分，强度高时补一记收尾
      if (beat === 0 || beat === 6 || beat === 10 || (I > 0.55 && beat === 14)) {
        const o = ctx.createOscillator();
        o.type = "sine";
        o.frequency.setValueAtTime(148, t);
        o.frequency.exponentialRampToValueAtTime(44, t + 0.09);
        const g = this._env(t, 0.62, 0.002, 0.15);
        o.connect(g); this._toBus(g, 0.04);
        o.start(t); o.stop(t + 0.2);
      }
      // 军鼓：2 / 4 拍；第 4、8 小节末尾加滚奏推进下一轮
      if (beat === 4 || beat === 12 || (I > 0.45 && bar % 4 === 3 && beat >= 13)) {
        const n = this._noiseSource(t, 0.16);
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 1150;
        const g = this._env(t, beat === 4 || beat === 12 ? 0.30 : 0.13, 0.001, 0.085);
        n.connect(hp).connect(g); this._toBus(g, 0.28);
      }
      // 16 分 hi-hat，重拍稍亮
      if (beat % 2 === 0) {
        const n = this._noiseSource(t, 0.045);
        const hp = ctx.createBiquadFilter();
        hp.type = "highpass"; hp.frequency.value = 6200;
        const g = this._env(t, (beat % 4 === 0 ? 0.085 : 0.055) + 0.025 * I, 0.001, 0.024);
        n.connect(hp).connect(g); this._toBus(g, 0.05);
      }
      // 失真 bass：八分音符，隔拍跳八度，低通留住厚度
      if (beat % 2 === 0) {
        const f = beat % 4 === 2 ? P.bass * 2 : P.bass;
        this._tone(t, f, STEP * 1.7, { type: "square", gain: 0.19 + 0.04 * I, cutoff: 430, wet: 0.05 });
      }
      // 铜管切分和弦：每小节头与第 9 个 16 分各一记
      if (beat === 0 || beat === 8) {
        for (const f of P.chord) {
          this._tone(t, f, STEP * (beat === 0 ? 3.2 : 2.0),
                     { type: "sawtooth", gain: 0.055 + 0.018 * I, cutoff: 1550, wet: 0.38 });
        }
      }
      // 长音铺底：让和弦进行听得出来，而不是只剩鼓点
      if (beat === 0) {
        for (const f of P.chord) {
          this._tone(t, f / 2, STEP * 14, { type: "triangle", gain: 0.026, cutoff: 760, wet: 0.45 });
        }
      }
      // 主旋律：8 分音符推进，逐小节换句，强度越高越亮
      if (beat % 2 === 0) {
        const note = P.lead[Math.floor(beat / 2) % 4];
        this._tone(t, note, STEP * 1.55,
                   { type: "sawtooth", gain: 0.085 + 0.045 * I, cutoff: 2300 + 900 * I, wet: 0.36 });
      }
      // 每 4 小节一次铜管高八度重音
      if (beat === 0 && bar % 4 === 0) {
        for (const f of P.chord) {
          this._tone(t, f * 2, STEP * 2.4, { type: "square", gain: 0.038, cutoff: 2600, wet: 0.42 });
        }
      }
      // 第 8 小节末尾上行噪声 riser，接回 Am 时推力最足
      if (bar === 7 && beat === 12 && I > 0.30) {
        const n = this._noiseSource(t, STEP * 4);
        const bp = ctx.createBiquadFilter();
        bp.type = "bandpass"; bp.Q.value = 1.1;
        bp.frequency.setValueAtTime(420, t);
        bp.frequency.exponentialRampToValueAtTime(5400, t + STEP * 4);
        const g = this._env(t, 0.12, STEP * 3, 0.10);
        n.connect(bp).connect(g); this._toBus(g, 0.42);
      }
      this._step += 1;
      this._nextTime += STEP;
    }
  }

  /** 波次升级时把 BGM 推得更满（0..1） */
  setIntensity(v) {
    this.intensity = Math.max(0, Math.min(1, Number(v) || 0));
    this.ensureMusic();
  }

  /** 冒烟契约：确认 BGM 调度器真的活着，而不是「代码写了但没响」 */
  audioState() {
    let rms = 0;
    if (this.analyser && this._fft) {
      this.analyser.getFloatTimeDomainData(this._fft);
      let sum = 0;
      for (let i = 0; i < this._fft.length; i += 1) sum += this._fft[i] * this._fft[i];
      rms = Math.sqrt(sum / this._fft.length);
    }
    return {
      ctx: !!this.ctx,
      state: this.ctx ? this.ctx.state : "none",
      unlocked: this.unlocked,
      muted: this.muted,
      timer: !!this._timer,
      step: this._step,
      intensity: this.intensity,
      rms: Number(rms.toFixed(5))
    };
  }

  // ------------------------------------------------------------ 对外 API
  play(name, opts = {}) {
    if (this.muted) return;
    const ctx = this.ctx;
    if (!ctx) {
      const el = this._fallback.get(name);
      if (el) { try { el.pause(); el.currentTime = 0; el.play().catch(() => {}); } catch (_) { /* 忽略 */ } }
      return;
    }
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    if (!this._timer) this.ensureMusic();
    const at = ctx.currentTime + 0.002;
    const v = opts.volume ?? 1;
    switch (name) {
      case "rifle": this._rifle(at, v); break;
      case "reload": this._clicks(at, 4); break;
      case "dry": this._clicks(at, 1); break;
      case "impact": this._hit(at, { freq: 480, gain: 0.7 * v, thump: 0.35 }); break;
      case "headshot": this._hit(at, { freq: 1250, gain: 0.9 * v, thump: 0.3 }); this._tone(at + 0.02, 880, 0.18, { gain: 0.12 * v }); break;
      case "zombie": this._growl(at, { dur: 0.95, base: 88 + Math.random() * 26, gain: v }); break;
      case "zombieDie": this._growl(at, { dur: 0.8, base: 112, down: true, gain: 0.8 * v }); break;
      case "boss": this._growl(at, { dur: 1.7, base: 58, gain: 1.2 * v }); this._tone(at, 41, 1.4, { gain: 0.22, type: "sine" }); break;
      case "hurt": this._hit(at, { freq: 240, gain: 0.9 * v, dur: 0.36, thump: 0.75 }); break;
      case "step": this._hit(at, { freq: 360, gain: 0.28 * v, dur: 0.11, thump: 0.15 }); break;
      case "explode":
        this._hit(at, { freq: 150, gain: 1.0 * v, dur: 0.9, thump: 0.9 });
        this._growl(at + 0.05, { dur: 0.7, base: 70, down: true, gain: 0.5 });
        break;
      case "wave":
        [146.8, 220, 293.7].forEach((f, i) => this._tone(at + i * 0.06, f, 1.2, { type: "sawtooth", gain: 0.10, cutoff: 1100, wet: 0.5 }));
        break;
      case "click": this._tone(at, 900, 0.07, { type: "square", gain: 0.07 * v, wet: 0 }); break;
      case "win": [196, 247, 294, 392].forEach((f, i) => this._tone(at + i * 0.16, f, 0.4, { type: "sawtooth", gain: 0.13, cutoff: 1400, wet: 0.35 })); break;
      case "lose": [294, 247, 196, 147].forEach((f, i) => this._tone(at + i * 0.2, f, 0.5, { type: "sawtooth", gain: 0.11, cutoff: 900, wet: 0.35 })); break;
      default: this._tone(at, 660, 0.08, { gain: 0.06 * v, wet: 0 }); break;
    }
  }

  /** 只改音量，不碰持久化；玩法暂停与用户偏好是两件事 */
  _applyMute(v) {
    this.muted = !!v;
    if (this.out && this.ctx) {
      this.out.gain.setTargetAtTime(this.muted ? 0 : this.master, this.ctx.currentTime, 0.03);
    }
    for (const el of this._fallback.values()) el.muted = this.muted;
    const bgm = this._fallback.get("bgm");
    if (this.muted) { if (bgm) bgm.pause(); }
    else if (!this.ctx) this._fallbackMusic();
    else this.ensureMusic();
  }

  /** 用户主动点喇叭：这才是需要跨会话记住的偏好 */
  setMuted(next) {
    this._applyMute(!!next);
    try { localStorage.setItem(MUTE_KEY, this.muted ? "1" : "0"); } catch (_) { /* 忽略 */ }
  }

  toggleMute() { this.setMuted(!this.muted); return this.muted; }
  /** 广告 / 切后台的静默暂停：绝不写 localStorage，否则刷新后 BGM 永久消失 */
  suspend() { this._wasMuted = this.muted; this._applyMute(true); }
  restore() { this._applyMute(this._wasMuted ?? false); }
}
