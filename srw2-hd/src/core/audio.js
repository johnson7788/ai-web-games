/**
 * src/core/audio.js — BGM 管理
 *
 * 音轨表在 config/audio-tracks.js（26 话 × 4 类）。
 * 标题/剧情/战斗 = 3 条原版录音；各话战场 = NSF 渲染的 19 首真实音轨（按话轮换）；
 * BOSS 战 = 其中节奏最激烈的一首。cut-in 时压低音量。
 */
import { trackFor } from "../../config/audio-tracks.js";

const FALLBACK = {
  title: "assets/audio/bgm-title.mp3",
  story: "assets/audio/bgm-story.mp3",
  battle: "assets/audio/bgm-sortie.mp3",
  scenario: "assets/audio/bgm-sortie.mp3"
};

const BASE_VOLUME = 0.32;

export function createAudio() {
  const el = document.getElementById("bgm");
  let current = null;        // { category, chapter, src }
  let muted = false;
  let ducked = false;
  let gain = 1;
  let fadeTimer = null;
  let unlocked = false;

  function targetVolume() {
    if (muted) return 0;
    const base = BASE_VOLUME * gain;
    return ducked ? base * 0.25 : base;
  }

  function fadeTo(volume, ms = 260) {
    if (!el) return;
    clearInterval(fadeTimer);
    const from = el.volume;
    const start = performance.now();
    fadeTimer = setInterval(() => {
      const k = Math.min(1, (performance.now() - start) / ms);
      el.volume = from + (volume - from) * k;
      if (k >= 1) clearInterval(fadeTimer);
    }, 30);
  }

  function play(category, chapter = 1) {
    if (!el) return;
    const track = trackFor(Number(chapter), category);
    const src = (track && track.src) || FALLBACK[category] || FALLBACK.battle;
    const rate = track && track.rate ? track.rate : 1;
    gain = track && track.gain ? track.gain : 1;
    const same = current && current.src === src && current.chapter === chapter;
    current = { category, chapter, src };
    el.loop = true;
    el.playbackRate = rate;
    if (!same) {
      el.src = src;
      el.volume = 0;
      fadeTo(targetVolume(), 480);
    } else {
      fadeTo(targetVolume(), 200);
    }
    el.play().catch(() => {
      /* 自动播放被拦：等第一次交互 */
    });
  }

  function duck(on) {
    ducked = !!on;
    fadeTo(targetVolume(), on ? 160 : 320);
  }

  function toggleMute() {
    muted = !muted;
    if (el) {
      el.muted = muted;
      if (!muted) fadeTo(targetVolume(), 200);
    }
    return muted;
  }

  // 浏览器自动播放限制：第一次交互后再尝试
  window.addEventListener("pointerdown", () => {
    unlocked = true;
    if (el && current && el.paused) {
      el.play().catch(() => {});
    }
  }, { once: true });

  return {
    play,
    duck,
    toggleMute,
    get muted() { return muted; },
    get unlocked() { return unlocked; },
    get current() { return current; }
  };
}
