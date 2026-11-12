// WebAudio 程序化音效：首次交互解锁；棘轮/撞击/锁定/解除/胜利。无外部音频文件。
export function createAudio() {
  let ctx = null;
  let master = null;
  let muted = false;
  const volume = 0.5;

  function ensure() {
    if (ctx) {
      if (ctx.state === 'suspended') ctx.resume();
      return true;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : volume;
    master.connect(ctx.destination);
    return true;
  }

  function tone({ freq, freqEnd, dur = 0.1, type = 'sine', vol = 0.5, delay = 0 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    if (freqEnd) osc.frequency.exponentialRampToValueAtTime(Math.max(1, freqEnd), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol, t0 + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(master);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }

  function noise({ dur = 0.05, vol = 0.3, delay = 0, freq = 2000 }) {
    if (!ctx || muted) return;
    const t0 = ctx.currentTime + delay;
    const len = Math.max(1, Math.floor(ctx.sampleRate * dur));
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i += 1) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = freq;
    filter.Q.value = 1.2;
    const gain = ctx.createGain();
    gain.gain.value = vol;
    src.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    src.start(t0);
  }

  function unlock() { ensure(); }

  function setMuted(m) {
    muted = !!m;
    if (master) master.gain.value = muted ? 0 : volume;
    return muted;
  }

  function isMuted() { return muted; }

  // 棘轮：一串快速咔哒（与 180ms 旋出动画同步）
  function ratchet() {
    if (!ctx || muted) return;
    for (let i = 0; i < 7; i += 1) {
      const d = i * 0.026;
      tone({ freq: 900 + i * 40, freqEnd: 520, dur: 0.03, type: 'square', vol: 0.2, delay: d });
      noise({ dur: 0.02, vol: 0.16, freq: 2600, delay: d });
    }
  }

  function thud() { // 掉板撞击
    if (!ctx || muted) return;
    tone({ freq: 95, freqEnd: 40, dur: 0.18, type: 'sine', vol: 0.5 });
    noise({ dur: 0.07, vol: 0.35, freq: 900 });
  }

  function dong() { // 锁定提示
    if (!ctx || muted) return;
    tone({ freq: 150, freqEnd: 118, dur: 0.12, type: 'sine', vol: 0.3 });
  }

  function clank() { // 掉板解除固定
    if (!ctx || muted) return;
    tone({ freq: 240, freqEnd: 160, dur: 0.07, type: 'square', vol: 0.2 });
    noise({ dur: 0.04, vol: 0.2, freq: 3200 });
  }

  function win() {
    if (!ctx || muted) return;
    [523.25, 659.25, 783.99].forEach((f, i) => {
      tone({ freq: f, dur: 0.16, type: 'triangle', vol: 0.32, delay: i * 0.12 });
    });
  }

  return { unlock, setMuted, isMuted, ratchet, thud, dong, clank, win };
}
