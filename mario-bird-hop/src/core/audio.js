// MARIO BIRD HOP · 程序化音频（纯 WebAudio，零音频文件零外链）
// BGM：霓虹街机 chiptune，BPM 120，8 小节无缝循环（相位连续）。
// 编制：底鼓=低频噪声+正弦、贝斯=三角波根音、琶音=方波 16 分、主音=锯齿轻 LPF。
// SFX：jump/land/coin/star/box/stomp/powerup/hurt/win/lose/combo，全部 ≤0.6s。
// 导出 createAudio()（实时）与 scheduleBgmLoop/scheduleSfx/SFX_EVENT_MAP（供 audio-check 离屏复验）。

const BPM = 120;
const BEAT = 60 / BPM;            // 一拍 = 0.5s
const BAR = BEAT * 4;             // 一小节 = 2s
const BGM_BARS = 8;
const BGM_LOOP = BAR * BGM_BARS;  // 一个循环 = 16s

const dbToGain = (db) => Math.pow(10, db / 20);
const BGM_GAIN = dbToGain(-14);
const SFX_GAIN = dbToGain(-10);
const DUCK_GAIN = dbToGain(-20);

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// 低层合成（对任意 AudioContext / OfflineAudioContext 通用）
function tone(ctx, out, { t0, dur, freq, freqEnd = null, type = 'sine', vol = 0.5, attack = 0.004, release = null }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  const r = release == null ? dur : release;
  osc.type = type;
  osc.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + r);
  osc.connect(g);
  g.connect(out);
  osc.start(t0);
  osc.stop(t0 + r + 0.02);
  return [osc];
}

function noise(ctx, out, { t0, dur, vol = 0.3, type = 'bandpass', freq = 2000, q = 1, freqEnd = null }) {
  const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.setValueAtTime(Math.max(1, freq), t0);
  if (freqEnd != null) filter.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
  filter.Q.value = q;
  const g = ctx.createGain();
  g.gain.value = vol;
  src.connect(filter);
  filter.connect(g);
  g.connect(out);
  src.start(t0);
  src.stop(t0 + dur + 0.02);
  return [src];
}

// ---- SFX ----
const SFX = {
  jump(ctx, out, t0) { // 上跳 chirp
    tone(ctx, out, { t0, dur: 0.12, freq: 380, freqEnd: 720, type: 'square', vol: 0.3, attack: 0.003 });
  },
  land(ctx, out, t0) { // 落地闷响
    tone(ctx, out, { t0, dur: 0.09, freq: 160, freqEnd: 90, type: 'sine', vol: 0.4, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.05, vol: 0.16, type: 'lowpass', freq: 500, q: 1 });
  },
  coin(ctx, out, t0, p) { // 金币两连音，音高随连击升高
    const step = p && typeof p.combo === 'number' ? Math.min(p.combo - 1, 5) : 0;
    const base = 84 + step;
    tone(ctx, out, { t0, dur: 0.08, freq: midi(base), type: 'square', vol: 0.26, attack: 0.002 });
    tone(ctx, out, { t0: t0 + 0.06, dur: 0.14, freq: midi(base + 7), type: 'square', vol: 0.26, attack: 0.002 });
  },
  star(ctx, out, t0) { // 星星上行琶音
    [76, 80, 83, 88].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.07, dur: 0.24, freq: midi(m), type: 'triangle', vol: 0.28, attack: 0.003 });
    });
  },
  box(ctx, out, t0) { // 顶箱 burst
    noise(ctx, out, { t0, dur: 0.16, vol: 0.4, type: 'bandpass', freq: 900, freqEnd: 300, q: 1.4 });
    tone(ctx, out, { t0, dur: 0.12, freq: 220, freqEnd: 120, type: 'square', vol: 0.28, attack: 0.003 });
  },
  stomp(ctx, out, t0) { // 踩敌 thud
    tone(ctx, out, { t0, dur: 0.16, freq: 200, freqEnd: 70, type: 'sine', vol: 0.5, attack: 0.003 });
    noise(ctx, out, { t0, dur: 0.1, vol: 0.3, type: 'lowpass', freq: 700, q: 1 });
  },
  powerup(ctx, out, t0) { // 道具风铃
    [72, 79, 84].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.08, dur: 0.3, freq: midi(m), type: 'sine', vol: 0.28, attack: 0.003 });
    });
  },
  hurt(ctx, out, t0) { // 受伤（护盾破裂）
    noise(ctx, out, { t0, dur: 0.25, vol: 0.5, type: 'highpass', freq: 1600, q: 1 });
    tone(ctx, out, { t0, dur: 0.3, freq: 300, freqEnd: 90, type: 'sawtooth', vol: 0.24, attack: 0.003 });
  },
  win(ctx, out, t0) { // 胜利 jingle
    [72, 76, 79, 84, 88, 91].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.09, dur: 0.22, freq: midi(m), type: 'triangle', vol: 0.3, attack: 0.003 });
    });
  },
  lose(ctx, out, t0) { // 失败下滑
    [64, 60, 55, 48].forEach((m, i) => {
      tone(ctx, out, { t0: t0 + i * 0.12, dur: 0.26, freq: midi(m), type: 'sawtooth', vol: 0.24, attack: 0.004 });
    });
  },
  combo(ctx, out, t0, p) { // 连击 blip
    const n = p && typeof p.combo === 'number' ? p.combo : 2;
    tone(ctx, out, { t0, dur: 0.1, freq: midi(72 + n * 2), type: 'square', vol: 0.24, attack: 0.002 });
  },
};

const SFX_EVENT_MAP = {
  jump: 'jump',
  land: 'land',
  coin: 'coin',
  star: 'star',
  box: 'box',
  stomp: 'stomp',
  magnet: 'powerup',
  shield: 'powerup',
  hurt: 'hurt',
  win: 'win',
  lose: 'lose',
  combo: 'combo',
};

function scheduleSfx(ctx, out, name, payload, t0, gain = SFX_GAIN) {
  const fn = SFX[name];
  if (!fn) return;
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  fn(ctx, bus, t0, payload || {});
}

// ---- BGM 一个循环（8 小节 chiptune，无缝）----
const BASS = [48, 48, 45, 45, 43, 43, 46, 46];          // 每小节根音
const ARP = [60, 64, 67, 72, 67, 64, 60, 64];           // 16 分琶音（半小节循环）

export function scheduleBgmLoop(ctx, out, t0, gain = BGM_GAIN, collect = null) {
  const bus = ctx.createGain();
  bus.gain.value = gain;
  bus.connect(out);
  const push = (srcs) => { if (collect) for (const s of srcs) collect.push(s); };

  for (let bar = 0; bar < BGM_BARS; bar += 1) {
    const barT = t0 + bar * BAR;
    // 底鼓每拍 + 贝斯根音
    for (let b = 0; b < 4; b += 1) {
      const bt = barT + b * BEAT;
      push(tone(ctx, bus, { t0: bt, dur: 0.1, freq: 140, freqEnd: 55, type: 'sine', vol: 0.5, attack: 0.002 }));
      push(noise(ctx, bus, { t0: bt, dur: 0.03, vol: 0.14, type: 'bandpass', freq: 2200, q: 3 }));
    }
    push(tone(ctx, bus, { t0: barT, dur: BAR * 0.9, freq: midi(BASS[bar]), type: 'triangle', vol: 0.3, attack: 0.01, release: BAR * 0.4 }));
    // 琶音 16 分（仅前 4 小节），主音进入后 4 小节
    for (let s = 0; s < 16; s += 1) {
      const st = barT + s * (BEAT / 4);
      if (bar < 4) {
        push(tone(ctx, bus, { t0: st, dur: 0.09, freq: midi(ARP[s % ARP.length]), type: 'square', vol: 0.1, attack: 0.002 }));
      } else {
        const lead = ARP[s % ARP.length] + 12;
        push(tone(ctx, bus, { t0: st, dur: 0.14, freq: midi(lead), type: 'sawtooth', vol: 0.08, attack: 0.002 }));
      }
    }
  }
  return collect;
}

// ---- 实时入口 ----
export function createAudio(opts = {}) {
  const factory = opts.createContext || (() => {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    return AC ? new AC() : null;
  });

  let ctx = null;
  let master = null;
  let bgmBus = null;
  let sfxBus = null;
  let muted = false;
  let bgmPlaying = false;
  let bgmNextTime = 0;
  let bgmTimer = null;
  let bgmActive = [];

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended' && ctx.resume) ctx.resume();
      return true;
    }
    const c = factory();
    if (!c) return false;
    ctx = c;
    master = ctx.createGain();
    master.gain.value = muted ? 0 : 1;
    master.connect(ctx.destination);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = 1;
    bgmBus.connect(master);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(master);
    return true;
  }

  function duckBgm() {
    if (!ctx || !bgmBus) return;
    const t = ctx.currentTime;
    const p = bgmBus.gain;
    p.cancelScheduledValues(t);
    p.setValueAtTime(Math.max(0.0001, p.value || 1), t);
    p.linearRampToValueAtTime(DUCK_GAIN, t + 0.15);
    p.setValueAtTime(DUCK_GAIN, t + 2.85);
    p.linearRampToValueAtTime(1, t + 3.0);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (sfx) scheduleSfx(ctx, sfxBus, sfx, payload, ctx.currentTime);
    if (name === 'win' || name === 'lose') duckBgm();
  }

  function bgmTick() {
    if (!bgmPlaying || !ctx) return;
    const horizon = ctx.currentTime + 0.3;
    while (bgmNextTime < horizon) {
      scheduleBgmLoop(ctx, bgmBus, bgmNextTime, BGM_GAIN, bgmActive);
      bgmNextTime += BGM_LOOP;
    }
  }

  function startBgm() {
    if (!ensure() || bgmPlaying) return;
    bgmPlaying = true;
    bgmActive = [];
    bgmNextTime = ctx.currentTime + 0.05;
    const p = bgmBus.gain;
    p.cancelScheduledValues(ctx.currentTime);
    p.setValueAtTime(Math.max(0.0001, p.value || 1), ctx.currentTime);
    p.linearRampToValueAtTime(1, ctx.currentTime + 0.05);
    bgmTick();
    bgmTimer = setInterval(bgmTick, 100);
  }

  function stopBgm() {
    bgmPlaying = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    if (ctx && bgmBus) {
      const t = ctx.currentTime;
      const p = bgmBus.gain;
      p.cancelScheduledValues(t);
      p.setValueAtTime(Math.max(0.0001, p.value || 1), t);
      p.linearRampToValueAtTime(0.0001, t + 0.05);
    }
    const t = ctx ? ctx.currentTime : 0;
    for (const s of bgmActive) { try { s.stop(t + 0.03); } catch (e) { /* noop */ } }
    bgmActive = [];
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) master.gain.value = muted ? 0 : 1;
    return muted;
  }

  function unlock() { return ensure(); }

  return { event, setMuted, startBgm, stopBgm, unlock };
}

export { BPM, BEAT, BAR, BGM_BARS, BGM_LOOP, scheduleSfx, SFX_EVENT_MAP };
