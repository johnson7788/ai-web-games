/**
 * Procedural audio synthesis for VOID SURVIVOR.
 * Every SFX and the music loop are rendered offline into AudioBuffers at boot
 * (no audio files, no fetch, no CORS). Buffers are registered into the
 * template's ResourceLoader and played through its AudioManager.
 */

const SR = 44100;

function offline(seconds, channels = 1) {
  const Ctx = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  return new Ctx(channels, Math.ceil(seconds * SR), SR);
}

function noiseBuffer(ctx, seconds) {
  const buf = ctx.createBuffer(1, Math.ceil(seconds * SR), SR);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

function env(gain, t0, peak, attack, decay) {
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.linearRampToValueAtTime(peak, t0 + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
}

function tone(ctx, { type = 'sine', f0 = 440, f1, t0 = 0, dur = 0.2, peak = 0.3, attack = 0.004, dest }) {
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(f0, t0);
  if (f1 != null) osc.frequency.exponentialRampToValueAtTime(Math.max(1, f1), t0 + dur);
  env(g, t0, peak, attack, dur);
  osc.connect(g).connect(dest || ctx.destination);
  osc.start(t0);
  osc.stop(t0 + dur + attack + 0.05);
  return { osc, g };
}

function noise(ctx, { t0 = 0, dur = 0.2, peak = 0.3, type = 'lowpass', f0 = 3000, f1, q = 1, dest }) {
  const src = ctx.createBufferSource();
  src.buffer = noiseBuffer(ctx, dur + 0.1);
  const filt = ctx.createBiquadFilter();
  filt.type = type;
  filt.Q.value = q;
  filt.frequency.setValueAtTime(f0, t0);
  if (f1 != null) filt.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t0 + dur);
  const g = ctx.createGain();
  env(g, t0, peak, 0.003, dur);
  src.connect(filt).connect(g).connect(dest || ctx.destination);
  src.start(t0);
  src.stop(t0 + dur + 0.1);
}

/** Render a builder function into an AudioBuffer. */
async function render(seconds, builder, channels = 1) {
  const ctx = offline(seconds, channels);
  builder(ctx);
  return ctx.startRendering();
}

/* ------------------------------------------------------------------ */
/* SFX builders                                                        */
/* ------------------------------------------------------------------ */

const BUILDERS = {
  shoot(ctx) {
    tone(ctx, { type: 'square', f0: 920, f1: 240, dur: 0.08, peak: 0.16 });
    tone(ctx, { type: 'sine', f0: 1800, f1: 500, dur: 0.05, peak: 0.1 });
    noise(ctx, { dur: 0.03, peak: 0.06, type: 'highpass', f0: 2500 });
  },
  hit(ctx) {
    noise(ctx, { dur: 0.07, peak: 0.22, type: 'bandpass', f0: 1400, q: 1.4 });
    tone(ctx, { type: 'triangle', f0: 340, f1: 120, dur: 0.07, peak: 0.16 });
  },
  kill(ctx) {
    noise(ctx, { dur: 0.28, peak: 0.34, type: 'lowpass', f0: 5200, f1: 240 });
    tone(ctx, { type: 'sine', f0: 150, f1: 42, dur: 0.26, peak: 0.34 });
    for (let i = 0; i < 4; i++) {
      noise(ctx, { t0: 0.02 + i * 0.045, dur: 0.04, peak: 0.12, type: 'bandpass', f0: 2200 + i * 700, q: 2 });
    }
  },
  pickup(ctx) {
    tone(ctx, { type: 'sine', f0: 660, dur: 0.07, peak: 0.2 });
    tone(ctx, { type: 'sine', f0: 990, t0: 0.06, dur: 0.08, peak: 0.2 });
    tone(ctx, { type: 'sine', f0: 1320, t0: 0.12, dur: 0.1, peak: 0.16 });
  },
  heal(ctx) {
    tone(ctx, { type: 'sine', f0: 520, f1: 780, dur: 0.16, peak: 0.22 });
    tone(ctx, { type: 'sine', f0: 780, f1: 1040, t0: 0.12, dur: 0.16, peak: 0.16 });
  },
  dash(ctx) {
    noise(ctx, { dur: 0.2, peak: 0.2, type: 'highpass', f0: 500, f1: 4200 });
    tone(ctx, { type: 'sine', f0: 220, f1: 640, dur: 0.16, peak: 0.14 });
  },
  hurt(ctx) {
    tone(ctx, { type: 'sawtooth', f0: 170, f1: 55, dur: 0.22, peak: 0.3 });
    noise(ctx, { dur: 0.16, peak: 0.22, type: 'lowpass', f0: 1600, f1: 300 });
  },
  wave(ctx) {
    tone(ctx, { type: 'sawtooth', f0: 220, dur: 0.3, peak: 0.16 });
    tone(ctx, { type: 'sawtooth', f0: 330, t0: 0.14, dur: 0.34, peak: 0.16 });
    tone(ctx, { type: 'sine', f0: 110, dur: 0.4, peak: 0.22 });
    noise(ctx, { t0: 0.14, dur: 0.3, peak: 0.08, type: 'highpass', f0: 3000 });
  },
  upgrade(ctx) {
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => tone(ctx, { type: 'triangle', f0: f, t0: i * 0.08, dur: 0.14, peak: 0.18 }));
  },
  gameover(ctx) {
    tone(ctx, { type: 'sawtooth', f0: 220, f1: 55, dur: 0.9, peak: 0.24 });
    tone(ctx, { type: 'sine', f0: 110, f1: 30, dur: 1.0, peak: 0.28 });
    noise(ctx, { t0: 0.1, dur: 0.7, peak: 0.1, type: 'lowpass', f0: 900, f1: 120 });
  },
  click(ctx) {
    tone(ctx, { type: 'square', f0: 1200, f1: 800, dur: 0.04, peak: 0.1 });
  },
  spawn(ctx) {
    tone(ctx, { type: 'sine', f0: 90, f1: 240, dur: 0.18, peak: 0.12 });
    noise(ctx, { dur: 0.14, peak: 0.07, type: 'bandpass', f0: 900, q: 3 });
  },
};

/* ------------------------------------------------------------------ */
/* Music loop — 8s dark synthwave at 100 BPM, seamless                 */
/* ------------------------------------------------------------------ */

function buildMusic(ctx) {
  const beat = 0.6; // 100 BPM
  const master = ctx.createGain();
  master.gain.value = 0.5;
  master.connect(ctx.destination);

  // Kick on every beat
  for (let i = 0; i < 13; i++) {
    const t = i * beat;
    if (t >= 8) break;
    tone(ctx, { type: 'sine', f0: 130, f1: 40, t0: t, dur: 0.16, peak: 0.5, dest: master });
  }
  // Hats off-beat
  for (let i = 0; i < 13; i++) {
    const t = i * beat + beat / 2;
    if (t >= 8) break;
    noise(ctx, { t0: t, dur: 0.04, peak: 0.1, type: 'highpass', f0: 6000, dest: master });
  }
  // Bass line: A1 A1 C2 G1 per 2 beats
  const bass = [55, 55, 65.4, 49];
  for (let bar = 0; bar < 4; bar++) {
    const t = bar * 2 * beat;
    const f = bass[bar % 4];
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    const filt = ctx.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.setValueAtTime(420, t);
    filt.frequency.exponentialRampToValueAtTime(140, t + beat * 1.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(0.3, t + 0.02);
    g.gain.setValueAtTime(0.3, t + beat * 1.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + beat * 1.95);
    osc.connect(filt).connect(g).connect(master);
    osc.start(t);
    osc.stop(t + beat * 2);
  }
  // Pad: Am chord, detuned saws, slow attack, whole loop
  [220, 261.6, 329.6].forEach((f, i) => {
    [-4, 4].forEach((det) => {
      const osc = ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.value = f;
      osc.detune.value = det;
      const filt = ctx.createBiquadFilter();
      filt.type = 'lowpass';
      filt.frequency.value = 700 + i * 120;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, 0);
      g.gain.linearRampToValueAtTime(0.035, 1.2);
      g.gain.setValueAtTime(0.035, 6.6);
      g.gain.linearRampToValueAtTime(0.0001, 8);
      osc.connect(filt).connect(g).connect(master);
      osc.start(0);
      osc.stop(8);
    });
  });
  // Sparkle arp
  const arp = [440, 523.25, 659.25, 880, 659.25, 523.25];
  arp.forEach((f, i) => {
    const t = 0.3 + i * 1.25;
    if (t < 7.6) tone(ctx, { type: 'triangle', f0: f, t0: t, dur: 0.22, peak: 0.05, dest: master });
  });
}

/**
 * Generate every buffer. Returns { id: AudioBuffer }.
 * Uses OfflineAudioContext only — no user gesture required.
 */
export async function generateAllAudio() {
  const items = {};
  const jobs = Object.entries(BUILDERS).map(async ([id, builder]) => {
    const dur = id === 'gameover' ? 1.3 : id === 'wave' ? 0.7 : id === 'upgrade' ? 0.5 : 0.4;
    items[id] = await render(dur, builder, 1);
  });
  jobs.push(
    (async () => {
      items.bgm = await render(8, buildMusic, 2);
    })(),
  );
  await Promise.all(jobs);
  return items;
}