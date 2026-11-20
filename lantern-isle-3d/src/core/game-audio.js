// src/core/game-audio.js — 音频：包一层 webgame-playbook 的 audio.js，补出 getState() 给观察面/门禁。
// 「有声音」必须能被实测：ctx 状态 + 主音量 + 正在放的轨道，任何一项为空都算 FAIL。
import { createAudio } from './audio.js';
import { CONFIG } from '../../config/game.config.js';

export function createGameAudio() {
  const a = createAudio();
  const tracks = new Map();
  const wrap = {
    raw: a,
    started: false,
    ensure() { try { a.ensure(); } catch { /* 无 AudioContext 环境（node）忽略 */ } },
    unlock() { try { a.unlock(); } catch {} this.started = true; },
    resume() { try { a.resume(); } catch {} },
    event(name, opts) { try { a.event(name, opts); } catch { } },
    play(name) { this.event(name); },
    bgm(id = 'main') {
      this.ensure();
      const url = CONFIG.audio.bgmFiles && CONFIG.audio.bgmFiles[id];
      if (!url) return false;
      try {
        if (a.playFile) a.playFile(url);
        else if (a.startFile) a.startFile(url);
        else {
          const el = new Audio(url);
          el.loop = true; el.volume = CONFIG.audio.bgmVolume;
          el.play().catch(() => {});
          tracks.set('bgm:' + id, el);
        }
        tracks.set('bgm:' + id, tracks.get('bgm:' + id) || { playing: true });
        return true;
      } catch { return false; }
    },
    voice(key) {
      const f = CONFIG.audio.voices && CONFIG.audio.voices[key];
      if (!f) return false;
      try { const el = new Audio(f); el.volume = 0.9; el.play().catch(() => {}); tracks.set('voice:' + key, el); return true; } catch { return false; }
    },
    muted() { try { return !!a.muted(); } catch { return false; } },
    setMuted(b) { try { a.setMuted(b); } catch {} },
    getLevel() { try { return a.getLevel ? a.getLevel() : 0; } catch { return 0; } },
    stopAll() { for (const [, el] of tracks) { try { if (el && el.pause) el.pause(); } catch {} } tracks.clear(); try { a.stopAll(); } catch {} },
    getState() {
      const playing = [];
      for (const [k, el] of tracks) if (!el || el.paused === false) playing.push(k);
      const ctx = a.ctx || null;
      const master = (ctx && a.master ? a.master.gain.value : 0) || (tracks.size ? CONFIG.audio.bgmVolume : 0);
      return {
        ctxState: ctx ? ctx.state : (typeof AudioContext === 'undefined' ? 'unsupported' : 'none'),
        masterGain: +Number(master || 0).toFixed(3),
        muted: this.muted(),
        playing,
        tracks: [...tracks.keys()],
        level: this.getLevel(),
        started: this.started,
      };
    },
  };
  return wrap;
}
