// All-procedural WebAudio: engine loop, sea rush, and one-shot SFX. No assets,
// no network. Created lazily on the first user gesture (Start button).
let ctx = null, master = null, engine = null, sea = null;
let muted = false, started = false;

function noiseBuffer(seconds = 2) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  return buf;
}

export function initAudio() {
  if (started) { ctx?.resume?.(); return; }
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  } catch { return; }
  started = true;
  master = ctx.createGain();
  master.gain.value = muted ? 0 : 0.9;
  master.connect(ctx.destination);

  // engine: two detuned saws through a lowpass, pitch follows speed
  const g = ctx.createGain(); g.gain.value = 0;
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 420; lp.Q.value = 1.2;
  const o1 = ctx.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 55;
  const o2 = ctx.createOscillator(); o2.type = 'square'; o2.frequency.value = 27.5;
  const g2 = ctx.createGain(); g2.gain.value = 0.4;
  o1.connect(lp); o2.connect(g2).connect(lp); lp.connect(g).connect(master);
  o1.start(); o2.start();
  engine = { g, lp, o1, o2 };

  // sea rush: looped noise through a bandpass, gain follows speed
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(); src.loop = true;
  const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 900; bp.Q.value = 0.6;
  const sg = ctx.createGain(); sg.gain.value = 0;
  src.connect(bp).connect(sg).connect(master); src.start();
  sea = { bp, sg };

  // ambient surf: very quiet lowpassed noise, always on while racing
  const amb = ctx.createBufferSource(); amb.buffer = noiseBuffer(3); amb.loop = true;
  const alp = ctx.createBiquadFilter(); alp.type = 'lowpass'; alp.frequency.value = 320;
  const ag = ctx.createGain(); ag.gain.value = 0.035;
  amb.connect(alp).connect(ag).connect(master); amb.start();
}

export function setMuted(m) {
  muted = m;
  if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ctx.currentTime, 0.05);
  return muted;
}
export function isMuted() { return muted; }

// speed 0..1, throttle 0..1, boosting
export function engineUpdate(speedN, throttle, boosting) {
  if (!ctx || !engine) return;
  const t = ctx.currentTime;
  const rpm = 48 + speedN * 150 + (boosting ? 30 : 0);
  engine.o1.frequency.setTargetAtTime(rpm, t, 0.08);
  engine.o2.frequency.setTargetAtTime(rpm * 0.5, t, 0.08);
  engine.lp.frequency.setTargetAtTime(300 + speedN * 1600 + throttle * 300, t, 0.1);
  engine.g.gain.setTargetAtTime(0.028 + speedN * 0.05 + throttle * 0.02, t, 0.1);
  sea.bp.frequency.setTargetAtTime(600 + speedN * 2400, t, 0.15);
  sea.sg.gain.setTargetAtTime(speedN * speedN * 0.11, t, 0.2);
}

export function engineIdle() {
  if (!ctx || !engine) return;
  const t = ctx.currentTime;
  engine.g.gain.setTargetAtTime(0.012, t, 0.2);
  sea.sg.gain.setTargetAtTime(0, t, 0.3);
}

function tone(freq, dur, type = 'sine', gain = 0.2, when = 0, slideTo = null) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const o = ctx.createOscillator(); o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(gain, t + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(master);
  o.start(t); o.stop(t + dur + 0.05);
}

function burst(dur, freq, gain, when = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + when;
  const src = ctx.createBufferSource(); src.buffer = noiseBuffer(1);
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.setValueAtTime(freq, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(80, freq * 0.25), t + dur); f.Q.value = 0.8;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(f).connect(g).connect(master);
  src.start(t); src.stop(t + dur + 0.05);
}

export const sfx = {
  checkpoint() { tone(880, 0.12, 'sine', 0.25); tone(1318.5, 0.22, 'sine', 0.25, 0.09); burst(0.25, 3200, 0.1); },
  lap() { [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => tone(f, 0.18, 'triangle', 0.24, i * 0.09)); },
  boost() { burst(0.6, 1800, 0.22); tone(180, 0.5, 'sawtooth', 0.08, 0, 420); },
  hit() { tone(70, 0.25, 'sine', 0.4, 0, 38); burst(0.3, 500, 0.3); },
  splash() { burst(0.35, 2400, 0.12); },
  count() { tone(440, 0.12, 'square', 0.16); },
  go() { tone(880, 0.4, 'square', 0.2); tone(1760, 0.5, 'sine', 0.12, 0.02); },
  win() { [523.25, 659.25, 783.99, 1046.5, 1318.5, 1568].forEach((f, i) => tone(f, 0.3, 'triangle', 0.24, i * 0.12)); },
  fail() { [392, 349.23, 311.13, 233.08].forEach((f, i) => tone(f, 0.3, 'sawtooth', 0.12, i * 0.16)); },
  tick() { tone(1200, 0.05, 'sine', 0.08); },
};