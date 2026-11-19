// CROW BLASTER · 程序化音频（纯 WebAudio，零音频文件零外链）。
// BGM：霓虹合成波循环（A 小调琶音 + 低音脉冲 + 明亮主音）。
// SFX：shot/hit/tankHit/goldenHit/ghostHit/miss/nearMiss/comboUp/comboBreak/kill/
//       levelClear/levelFail/gameWin/targetSpawn，全部 ≤0.6s。
//
// 导出 createAudio()（实时，main 用 event() 消费 sim 事件），
// 另导出 synthSfx / synthLoop 与常量，供 tools/audio-check.mjs 离屏渲染复验。

export const SAMPLE_RATE = 44100;
export const SFX_NAMES = [
  'shot', 'hit', 'tankHit', 'goldenHit', 'ghostHit', 'miss', 'nearMiss',
  'comboUp', 'comboBreak', 'kill', 'levelClear', 'levelFail', 'gameWin', 'targetSpawn',
];
export const LOOP_NAMES = ['bgm'];

const midi = (m) => 440 * Math.pow(2, (m - 69) / 12);

// ---------------- 离线 PCM 合成（供 audio-check 用） ----------------

function writeTone(buf, sr, t0, dur, freq, opts = {}) {
  const { type = 'sine', vol = 0.5, freqEnd = null, attack = 0.004 } = opts;
  const start = Math.max(0, Math.floor(t0 * sr));
  const end = Math.min(buf.length, Math.floor((t0 + dur) * sr));
  for (let i = start; i < end; i += 1) {
    const t = i / sr - t0;
    const env = Math.min(1, t / attack) * Math.exp(-3 * t / dur);
    const f = freqEnd != null ? freq * Math.pow(freqEnd / freq, Math.min(1, t / dur)) : freq;
    const ph = 2 * Math.PI * f * t;
    let s = type === 'saw' ? 2 * ((ph / (2 * Math.PI)) % 1) - 1
      : type === 'square' ? (Math.sin(ph) >= 0 ? 1 : -1)
      : Math.sin(ph);
    buf[i] += s * vol * env;
  }
}

function writeNoise(buf, sr, t0, dur, vol = 0.3, freq = 2000) {
  const start = Math.max(0, Math.floor(t0 * sr));
  const end = Math.min(buf.length, Math.floor((t0 + dur) * sr));
  let lp = 0;
  const k = Math.min(0.99, freq / sr * 2);
  for (let i = start; i < end; i += 1) {
    const t = (i - start) / sr;
    const env = Math.exp(-4 * t / dur);
    const w = Math.random() * 2 - 1;
    lp += k * (w - lp);
    buf[i] += lp * vol * env;
  }
}

function makeBuf(sr, dur) {
  return new Float32Array(Math.max(1, Math.floor(sr * dur)));
}

// 每个 SFX 一个合成函数（离线 + 实时复用同样的参数描述）
const SFX_SPECS = {
  shot(sr, p) { // 激光啁啾
    const b = makeBuf(sr, 0.25);
    writeTone(b, sr, 0, 0.18, 880, { type: 'saw', vol: 0.4, freqEnd: 220, attack: 0.002 });
    writeNoise(b, sr, 0, 0.1, 0.2, 3000);
    return b;
  },
  hit(sr, p) { // 命中爆点 + 随连击升调
    const combo = (p && p.combo) || 0;
    const b = makeBuf(sr, 0.3);
    writeTone(b, sr, 0, 0.12, 500 + combo * 40, { type: 'square', vol: 0.4, freqEnd: 700 + combo * 50, attack: 0.002 });
    writeNoise(b, sr, 0, 0.08, 0.25, 4000);
    return b;
  },
  tankHit(sr, p) { // 装甲闷响
    const b = makeBuf(sr, 0.3);
    writeTone(b, sr, 0, 0.2, 180, { type: 'triangle', vol: 0.5, freqEnd: 90, attack: 0.003 });
    writeNoise(b, sr, 0, 0.1, 0.25, 600);
    return b;
  },
  goldenHit(sr, p) { // 金鸦风铃
    const b = makeBuf(sr, 0.5);
    [0, 4, 7, 12].forEach((iv, i) => writeTone(b, sr, i * 0.07, 0.3, midi(84 + iv), { type: 'sine', vol: 0.3, attack: 0.002 }));
    return b;
  },
  ghostHit(sr, p) { // 惩罚下坠
    const b = makeBuf(sr, 0.4);
    writeTone(b, sr, 0, 0.3, 300, { type: 'saw', vol: 0.4, freqEnd: 60, attack: 0.004 });
    return b;
  },
  miss(sr, p) { // 短促漏气
    const b = makeBuf(sr, 0.2);
    writeNoise(b, sr, 0, 0.16, 0.22, 900);
    return b;
  },
  nearMiss(sr, p) { // 擦肩嗖
    const b = makeBuf(sr, 0.2);
    writeNoise(b, sr, 0, 0.14, 0.25, 2000);
    return b;
  },
  comboUp(sr, p) { // 连击滴答
    const c = (p && p.combo) || 1;
    const b = makeBuf(sr, 0.12);
    writeTone(b, sr, 0, 0.09, 700 + Math.min(c, 12) * 30, { type: 'sine', vol: 0.3, attack: 0.002 });
    return b;
  },
  comboBreak(sr, p) { // 连击断
    const b = makeBuf(sr, 0.25);
    writeTone(b, sr, 0, 0.2, 400, { type: 'triangle', vol: 0.3, freqEnd: 180, attack: 0.003 });
    return b;
  },
  kill(sr, p) { // 击杀爆裂
    const b = makeBuf(sr, 0.35);
    writeTone(b, sr, 0, 0.14, 300, { type: 'square', vol: 0.35, freqEnd: 120, attack: 0.002 });
    writeNoise(b, sr, 0, 0.16, 0.3, 2600);
    return b;
  },
  levelClear(sr, p) { // 过关三连音
    const b = makeBuf(sr, 0.7);
    [60, 64, 67, 72].forEach((m, i) => writeTone(b, sr, i * 0.11, 0.22, midi(m), { type: 'triangle', vol: 0.32, attack: 0.003 }));
    return b;
  },
  levelFail(sr, p) { // 失败下沉
    const b = makeBuf(sr, 0.6);
    [67, 63, 60, 55].forEach((m, i) => writeTone(b, sr, i * 0.12, 0.3, midi(m), { type: 'saw', vol: 0.3, attack: 0.004 }));
    return b;
  },
  gameWin(sr, p) { // 通关号角
    const b = makeBuf(sr, 1.0);
    [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => writeTone(b, sr, i * 0.1, 0.24, midi(m), { type: 'square', vol: 0.28, attack: 0.003 }));
    return b;
  },
  targetSpawn(sr, p) { // 生成轻响
    const b = makeBuf(sr, 0.15);
    writeTone(b, sr, 0, 0.1, 300, { type: 'sine', vol: 0.12, freqEnd: 500, attack: 0.01 });
    return b;
  },
};

export function synthSfx(name, payload, sr = SAMPLE_RATE) {
  const fn = SFX_SPECS[name];
  if (!fn) return new Float32Array(0);
  return fn(sr, payload || {});
}

export function synthLoop(name, sr = SAMPLE_RATE) {
  // BGM：16 拍琶音循环（A 小调），4 层：低音脉冲 + 琶音 + 主音 + 轻噪鼓点
  const bar = 2.0; // 4 拍，120 BPM
  const dur = bar * 4; // 8 秒循环
  const b = makeBuf(sr, dur);
  const roots = [57, 53, 55, 52]; // A3 F3 G3 E3
  const arp = [69, 72, 76, 81];   // A4 C5 E5 A5
  for (let seg = 0; seg < 4; seg += 1) {
    const t0 = seg * bar;
    writeTone(b, sr, t0, bar * 0.9, midi(roots[seg]), { type: 'triangle', vol: 0.22, attack: 0.01 });
    for (let k = 0; k < 8; k += 1) {
      const m = arp[(seg + k) % arp.length];
      writeTone(b, sr, t0 + k * (bar / 8), 0.16, midi(m), { type: 'sine', vol: 0.14, attack: 0.005 });
    }
    writeNoise(b, sr, t0, bar * 0.4, 0.06, 1500);
  }
  // 主音（后两段）
  [69, 72, 76, 81, 76, 72, 69, 67].forEach((m, i) => {
    writeTone(b, sr, bar * 2 + i * (bar / 8), 0.22, midi(m), { type: 'square', vol: 0.1, attack: 0.006 });
  });
  return b;
}

// ---------------- 实时 WebAudio ----------------

const SFX_EVENT_MAP = {
  shot: 'shot', hit: 'hit', tankHit: 'tankHit', goldenHit: 'goldenHit', ghostHit: 'ghostHit',
  miss: 'miss', nearMiss: 'nearMiss', comboUp: 'comboUp', comboBreak: 'comboBreak',
  kill: 'kill', levelClear: 'levelClear', levelFail: 'levelFail', gameWin: 'gameWin',
  targetSpawn: 'targetSpawn',
};

export function createAudio(opts = {}) {
  const factory = opts.createContext || (() => {
    if (typeof window === 'undefined') return null;
    const AC = window.AudioContext || window.webkitAudioContext;
    return AC ? new AC() : null;
  });

  let ctx = null;
  let master = null;
  let sfxBus = null;
  let bgmBus = null;
  let muted = false;
  let volume = 0.7;
  let bgmPlaying = false;
  let bgmTimer = null;
  let bgmNext = 0;
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
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    sfxBus = ctx.createGain();
    sfxBus.gain.value = 1;
    sfxBus.connect(master);
    bgmBus = ctx.createGain();
    bgmBus.gain.value = 0.5;
    bgmBus.connect(master);
    return true;
  }

  function rtTone(t0, dur, freq, { type = 'sine', vol = 0.4, freqEnd = null } = {}) {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(Math.max(1, freq), t0);
    if (freqEnd != null) o.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0001, vol), t0 + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g);
    g.connect(sfxBus);
    o.start(t0);
    o.stop(t0 + dur + 0.02);
  }

  function rtNoise(t0, dur, vol = 0.2, freq = 2000) {
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq;
    const g = ctx.createGain();
    g.gain.value = vol;
    src.connect(f);
    f.connect(g);
    g.connect(sfxBus);
    src.start(t0);
    src.stop(t0 + dur + 0.02);
  }

  function event(name, payload) {
    if (!ensure() || muted) return;
    const sfx = SFX_EVENT_MAP[name];
    if (!sfx) return;
    const t0 = ctx.currentTime;
    // 简单映射到实时合成（复用离线参数描述里最核心的声音）
    switch (sfx) {
      case 'shot': rtTone(t0, 0.16, 880, { type: 'sawtooth', vol: 0.3, freqEnd: 240 }); rtNoise(t0, 0.08, 0.12, 3000); break;
      case 'hit': rtTone(t0, 0.1, 500 + (payload?.combo || 0) * 40, { type: 'square', vol: 0.3, freqEnd: 700 }); rtNoise(t0, 0.06, 0.16, 4000); break;
      case 'tankHit': rtTone(t0, 0.18, 180, { type: 'triangle', vol: 0.4, freqEnd: 90 }); break;
      case 'goldenHit': [84, 88, 91, 96].forEach((m, i) => rtTone(t0 + i * 0.07, 0.28, midi(m), { type: 'sine', vol: 0.24 })); break;
      case 'ghostHit': rtTone(t0, 0.28, 300, { type: 'sawtooth', vol: 0.3, freqEnd: 60 }); break;
      case 'miss': rtNoise(t0, 0.14, 0.16, 900); break;
      case 'nearMiss': rtNoise(t0, 0.12, 0.2, 2000); break;
      case 'comboUp': rtTone(t0, 0.08, 700 + Math.min(payload?.combo || 1, 12) * 30, { type: 'sine', vol: 0.22 }); break;
      case 'comboBreak': rtTone(t0, 0.18, 400, { type: 'triangle', vol: 0.22, freqEnd: 180 }); break;
      case 'kill': rtTone(t0, 0.12, 300, { type: 'square', vol: 0.26, freqEnd: 120 }); rtNoise(t0, 0.14, 0.2, 2600); break;
      case 'levelClear': [60, 64, 67, 72].forEach((m, i) => rtTone(t0 + i * 0.11, 0.22, midi(m), { type: 'triangle', vol: 0.26 })); break;
      case 'levelFail': [67, 63, 60, 55].forEach((m, i) => rtTone(t0 + i * 0.12, 0.3, midi(m), { type: 'sawtooth', vol: 0.24 })); break;
      case 'gameWin': [60, 64, 67, 72, 76, 79, 84].forEach((m, i) => rtTone(t0 + i * 0.1, 0.24, midi(m), { type: 'square', vol: 0.22 })); break;
      case 'targetSpawn': rtTone(t0, 0.1, 300, { type: 'sine', vol: 0.08, freqEnd: 500 }); break;
    }
  }

  function bgmTick() {
    if (!bgmPlaying || !ctx) return;
    const horizon = ctx.currentTime + 0.4;
    while (bgmNext < horizon) {
      const bar = 2.0;
      const t0 = bgmNext;
      const roots = [57, 53, 55, 52];
      const arp = [69, 72, 76, 81];
      for (let seg = 0; seg < 4; seg += 1) {
        const st = t0 + seg * bar;
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.type = 'triangle';
        o.frequency.value = midi(roots[seg]);
        g.gain.setValueAtTime(0.0001, st);
        g.gain.exponentialRampToValueAtTime(0.2, st + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, st + bar * 0.9);
        o.connect(g); g.connect(bgmBus);
        o.start(st); o.stop(st + bar);
        bgmActive.push(o);
        for (let k = 0; k < 8; k += 1) {
          const o2 = ctx.createOscillator();
          const g2 = ctx.createGain();
          o2.type = 'sine';
          o2.frequency.value = midi(arp[(seg + k) % 4]);
          g2.gain.setValueAtTime(0.0001, st + k * bar / 8);
          g2.gain.exponentialRampToValueAtTime(0.1, st + k * bar / 8 + 0.01);
          g2.gain.exponentialRampToValueAtTime(0.0001, st + k * bar / 8 + 0.16);
          o2.connect(g2); g2.connect(bgmBus);
          o2.start(st + k * bar / 8); o2.stop(st + k * bar / 8 + 0.2);
          bgmActive.push(o2);
        }
      }
      bgmNext += bar * 4;
    }
  }

  function playBgm() {
    if (!ensure() || bgmPlaying) return;
    bgmPlaying = true;
    bgmNext = ctx.currentTime + 0.05;
    bgmActive = [];
    bgmTick();
    bgmTimer = setInterval(bgmTick, 200);
  }

  function stopBgm() {
    bgmPlaying = false;
    if (bgmTimer) { clearInterval(bgmTimer); bgmTimer = null; }
    const t = ctx ? ctx.currentTime : 0;
    for (const s of bgmActive) { try { s.stop(t + 0.03); } catch (e) { /* noop */ } }
    bgmActive = [];
  }

  function setMuted(m) {
    muted = !!m;
    if (master && ctx) master.gain.value = muted ? 0 : volume;
    return muted;
  }

  function setVolume(v) {
    volume = Math.max(0, Math.min(1, v));
    if (master && ctx && !muted) master.gain.value = volume;
    return volume;
  }

  function unlock() { return ensure(); }

  return { event, setMuted, setVolume, playBgm, stopBgm, unlock };
}
