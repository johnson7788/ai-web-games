import { loadSave, updateSettings } from './core/save.js';

export function createAudio() {
  let context = null;
  let master = null;
  let musicMaster = null;
  let noiseBuffer = null;
  let musicTimer = null;
  let musicStep = 0;
  let muted = Boolean(loadSave().settings.muted);
  let paused = false;
  let suppressed = false;
  let background = document.hidden;

  function syncGains() {
    if (!context) return;
    const now = context.currentTime;
    const settings = loadSave().settings;
    master.gain.setTargetAtTime(!muted && !suppressed && settings.sfx ? (paused ? 0.18 : 1) : 0, now, 0.04);
    musicMaster.gain.setTargetAtTime(!muted && !suppressed && settings.music ? (paused ? 0.22 : 1) : 0, now, 0.08);
  }

  function unlock() {
    if (!context) {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context = new AudioContext();
      master = context.createGain();
      musicMaster = context.createGain();
      master.connect(context.destination);
      musicMaster.connect(context.destination);
      syncGains();
      startMusic();
    }
    if (!background && context.state === 'suspended') context.resume().catch(() => {});
  }

  function tone(frequency, duration, { type = 'sine', volume = 0.15, endFrequency = frequency, delay = 0, music = false } = {}) {
    if (!context || muted || (music ? !loadSave().settings.music : !loadSave().settings.sfx)) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), start + duration);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + Math.min(0.012, duration * 0.2));
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(music ? musicMaster : master);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  function noise(duration, { volume = 0.12, frequency = 900, delay = 0, filterType = 'lowpass' } = {}) {
    if (!context || muted || !loadSave().settings.sfx) return;
    if (!noiseBuffer) {
      noiseBuffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
      const data = noiseBuffer.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    }
    const start = context.currentTime + delay;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = noiseBuffer;
    filter.type = filterType;
    filter.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    source.start(start);
    source.stop(start + duration);
  }

  function startMusic() {
    if (musicTimer) return;
    musicTimer = window.setInterval(() => {
      if (!context || context.state !== 'running' || muted || !loadSave().settings.music) return;
      const chords = [[261.63, 329.63, 392], [293.66, 369.99, 440], [246.94, 329.63, 392], [261.63, 349.23, 440]];
      const chord = chords[Math.floor(musicStep / 4) % chords.length];
      tone(chord[musicStep % 3], 0.24, { type: 'triangle', volume: 0.022, music: true });
      if (musicStep % 4 === 0) tone(chord[0] / 2, 0.42, { type: 'sine', volume: 0.018, music: true });
      musicStep = (musicStep + 1) % 16;
    }, 320);
  }

  function play(name, variant = 0) {
    if (muted || !loadSave().settings.sfx) return;
    unlock();
    if (!context) return;
    if (name === 'punchLight' || name === 'fish') {
      noise(0.07, { volume: 0.09, frequency: 1400 });
      tone(150, 0.08, { type: 'triangle', volume: 0.08, endFrequency: 85 });
    } else if (name === 'punchHeavy' || name === 'slam' || name === 'hammer') {
      noise(0.13, { volume: 0.15, frequency: 750 });
      tone(110, 0.16, { type: 'sawtooth', volume: 0.12, endFrequency: 45 });
    } else if (name === 'whoosh') {
      noise(0.11, { volume: 0.09, frequency: 1400, filterType: 'highpass' });
    } else if (name === 'hit' || name === 'hitLight') {
      tone(110, 0.08, { type: 'sine', volume: 0.15, endFrequency: 65 });
      noise(0.04, { volume: 0.13, frequency: 2000, filterType: 'highpass' });
      noise(0.07, { volume: 0.055, frequency: 1800, filterType: 'highpass' });
    } else if (name === 'hitHeavy') {
      tone(110, 0.08, { type: 'sine', volume: 0.18, endFrequency: 60 });
      noise(0.04, { volume: 0.17, frequency: 2000, filterType: 'highpass' });
      noise(0.09, { volume: 0.08, frequency: 1500, filterType: 'highpass' });
      tone(60, 0.12, { type: 'sine', volume: 0.20, endFrequency: 35 });
      tone(740, 0.10, { type: 'triangle', volume: 0.08, endFrequency: 390 });
    } else if (name === 'grab' || name === 'pickup') {
      tone(420, 0.08, { type: 'sine', volume: 0.10, endFrequency: 700 });
      tone(880, 0.045, { type: 'sine', volume: 0.07, endFrequency: 420 });
    } else if (name === 'throw' || name === 'bomb') {
      noise(0.20, { volume: 0.12, frequency: 1200, filterType: 'highpass' });
      tone(300, 0.14, { type: 'triangle', volume: 0.07, endFrequency: 120 });
    } else if (name === 'explosion') {
      noise(0.35, { volume: 0.17, frequency: 500 });
      tone(90, 0.32, { type: 'sawtooth', volume: 0.12, endFrequency: 30 });
    } else if (name === 'star') {
      tone(523, 0.16, { volume: 0.08, endFrequency: 784 });
      tone(784, 0.22, { volume: 0.07, endFrequency: 1047, delay: 0.12 });
    } else if (name === 'land') {
      tone(90, 0.08, { type: 'sine', volume: 0.07, endFrequency: 45 });
    } else if (name === 'jump') {
      tone(260, 0.11, { type: 'sine', volume: 0.07, endFrequency: 520 });
    } else if (name === 'dizzy') {
      tone(660, 0.12, { volume: 0.07, endFrequency: 880 });
      tone(880, 0.12, { volume: 0.06, endFrequency: 660, delay: 0.12 });
    } else if (name === 'ko') {
      tone(70, 0.42, { type: 'sine', volume: 0.22, endFrequency: 32 });
      tone(520, 0.42, { type: 'sawtooth', volume: 0.10, endFrequency: 75 });
      tone(160, 0.22, { type: 'triangle', volume: 0.07, endFrequency: 720, delay: 0.04 });
      noise(0.25, { volume: 0.10, frequency: 650 });
      noise(0.55, { volume: 0.10, frequency: 1500, filterType: 'bandpass', delay: 0.05 });
      tone(523, 0.20, { type: 'triangle', volume: 0.04, endFrequency: 659, delay: 0.12 });
      tone(659, 0.24, { type: 'triangle', volume: 0.04, endFrequency: 784, delay: 0.28 });
    } else if (name === 'countdown') {
      const go = variant === 'GO';
      tone(go ? 720 : 440, go ? 0.24 : 0.11, { type: 'square', volume: 0.07, endFrequency: go ? 960 : 440 });
    } else if (name === 'cheer') {
      noise(0.7, { volume: 0.09, frequency: 1600 });
      tone(523, 0.22, { type: 'triangle', volume: 0.05, endFrequency: 659 });
      tone(659, 0.25, { type: 'triangle', volume: 0.05, endFrequency: 784, delay: 0.18 });
    }
  }

  function toggleMute() {
    muted = !muted;
    updateSettings({ muted });
    syncGains();
    return muted;
  }

  function setSfx(value) {
    updateSettings({ sfx: Boolean(value) });
    syncGains();
  }

  function setMusic(value) {
    updateSettings({ music: Boolean(value) });
    syncGains();
  }

  function setPaused(value, silent = false) {
    paused = Boolean(value);
    suppressed = Boolean(silent);
    syncGains();
  }

  function setBackground(value) {
    background = Boolean(value);
    if (!context) return;
    if (background && context.state === 'running') context.suspend().catch(() => {});
    else if (!background && context.state === 'suspended') context.resume().catch(() => {});
  }

  window.addEventListener('pointerdown', unlock, { passive: true });
  window.addEventListener('keydown', unlock, { passive: true });
  document.addEventListener('visibilitychange', () => setBackground(document.hidden));
  return { unlock, play, toggleMute, setSfx, setMusic, setPaused, setBackground, get muted() { return muted; } };
}
