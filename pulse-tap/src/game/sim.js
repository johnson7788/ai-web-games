// PULSE TAP · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：谱面推进、四轨下落、判定（Perfect/Great/Miss）、连击与断连惩罚、
//       长按/滑键、律动模式、血量、结算与事件表。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（JUDGE/HP/SCORE/GROOVE）、chart.js。
// 随机：注入 seed 的 mulberry32（谱面与判定可复现）。
// 契约：createRun(levelIndex, { seed }) → run；run.step/tap/release/getHud/drainEvents。

import { LEVELS } from '../../config/levels.js';
import { generateChart, mulberry32 } from './chart.js';
import { JUDGE, HP, SCORE, GROOVE, GAME, TRACK_COUNT } from '../../config/game.config.js';

export { mulberry32, generateChart };

const REAL_KINDS = new Set(['tap', 'hold', 'slide', 'slideEnd']);

function clamp(v, a, b) {
  return Math.min(b, Math.max(a, v));
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const chart = generateChart(level, seed);

  const notes = chart.notes.map((n) => ({
    id: n.id,
    time: n.time,
    track: n.track,
    dur: n.dur || 0,
    kind: n.kind,
    toTrack: n.toTrack != null ? n.toTrack : null,
    slideTime: n.slideTime != null ? n.slideTime : null,
    fromTrack: n.fromTrack != null ? n.fromTrack : null,
    status: 'pending', // pending | active | hit | missed
    grade: null,       // 'perfect' | 'great' | null
    held: false,
    holdComplete: false,
    holdBroken: false,
    judgedAt: null,
  }));

  const state = {
    level: level.index,
    scene: level.scene,
    bpm: chart.bpm,
    phase: 'countdown', // countdown | playing | won | lost
    countdown: GAME.LEAD_IN,
    time: 0,           // 歌曲时间（秒）
    duration: chart.duration,
    notes,
    totalNotes: notes.filter((n) => REAL_KINDS.has(n.kind)).length,
    hp: HP.START,
    hpMax: HP.MAX,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfect: 0,
    great: 0,
    miss: 0,
    perfectStreak: 0,
    groove: false,
    heldTrack: [null, null, null, null], // 每轨当前按住的 note id
    result: null,
  };

  const run = {
    state,
    _level: level,
    _chart: chart,
    _events: [],
    _beatIdx: 0,
    _countdownTickIdx: 0,
    _slideArm: null, // { toTrack, until }

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;

      if (s.phase === 'countdown') {
        s.countdown -= dt;
        const tick = Math.floor((GAME.LEAD_IN - s.countdown) / 0.5);
        while (this._countdownTickIdx < tick) {
          this._countdownTickIdx += 1;
          this._emit({ type: 'countdownTick', timeLeft: Math.max(0, s.countdown) });
        }
        if (s.countdown <= 0) {
          s.countdown = 0;
          s.phase = 'playing';
          this._emit({ type: 'songStart' });
        }
        return;
      }

      const prevTime = s.time;
      s.time += dt;

      // 节拍事件（每半拍一发，保证事件密度与可感知反馈）
      const beatLen = (60 / s.bpm) / GAME.BPM_EVENT_DIVISOR;
      const curBeat = Math.floor(s.time / beatLen);
      while (this._beatIdx < curBeat) {
        this._beatIdx += 1;
        this._emit({ type: 'beat', i: this._beatIdx, t: s.time });
      }

      const W = windows(s);

      // 激活进入判定窗的 note
      for (const n of s.notes) {
        if (n.status === 'pending' && s.time >= n.time - W.great) {
          n.status = 'active';
          this._emit({ type: 'noteSpawn', id: n.id, track: n.track, kind: n.kind });
        }
      }

      // 漏判真实 note
      for (const n of s.notes) {
        if (REAL_KINDS.has(n.kind) && (n.status === 'pending' || n.status === 'active') && s.time > n.time + W.great) {
          this._missNote(n);
        }
      }

      // 假 note 静默过期（只是诱饵，不惩罚未点击）
      for (const n of s.notes) {
        if (n.kind === 'fake' && n.status === 'active' && s.time > n.time + W.great) {
          n.status = 'missed';
        }
      }

      // 长按完成
      for (let tr = 0; tr < TRACK_COUNT; tr += 1) {
        const hid = s.heldTrack[tr];
        if (hid == null) continue;
        const n = s.notes[hid];
        if (n && n.status === 'hit' && n.kind === 'hold' && n.held && !n.holdComplete && s.time >= n.time + n.dur) {
          n.holdComplete = true;
          s.heldTrack[tr] = null;
          s.score += SCORE.HOLD_BONUS;
          this._emit({ type: 'holdEnd', id: n.id, track: tr });
        }
      }

      if (s.time >= s.duration) this._win();
    },

    // ---- 点击一轨（判定最近 note；空轨/假 note 走惩罚分支）----
    tap(track) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (track < 0 || track >= TRACK_COUNT) return { ok: false, reason: 'bounds' };
      const W = windows(s);
      let best = null;
      let bestD = Infinity;
      for (const n of s.notes) {
        if (n.track !== track) continue;
        if (n.status !== 'pending' && n.status !== 'active') continue;
        const d = Math.abs(s.time - n.time);
        if (d <= W.great + 1e-6 && d < bestD) {
          best = n;
          bestD = d;
        }
      }

      if (!best) {
        this._breakCombo('ghostTap');
        this._emit({ type: 'ghostTap', track });
        return { ok: false, reason: 'empty', track };
      }

      if (best.kind === 'fake') {
        best.status = 'missed';
        this._breakCombo('fakeHit');
        s.hp = Math.max(0, s.hp - HP.FAKE_DAMAGE);
        this._emit({ type: 'fakeHit', track });
        this._emit({ type: 'hpLost', hp: s.hp });
        if (s.hp <= 0) this._lose('hp');
        return { ok: true, kind: 'fake', track };
      }

      const delta = s.time - best.time;
      const abs = Math.abs(delta);
      const grade = abs <= W.perfect ? 'perfect' : 'great';
      best.status = 'hit';
      best.grade = grade;
      best.judgedAt = s.time;

      if (grade === 'perfect') {
        s.perfect += 1;
        s.perfectStreak += 1;
      } else {
        s.great += 1;
        s.perfectStreak = 0;
      }
      s.score += grade === 'perfect' ? SCORE.PERFECT : SCORE.GREAT;
      s.combo += 1;
      s.maxCombo = Math.max(s.maxCombo, s.combo);
      if (s.combo > 0 && s.combo % GAME.COMBO_EVENT_STEP === 0) {
        this._emit({ type: 'combo', combo: s.combo });
      }
      this._setGroove(s.perfectStreak >= GROOVE.STREAK);

      if (best.kind === 'hold') {
        best.held = true;
        s.heldTrack[track] = best.id;
        this._emit({ type: 'holdStart', id: best.id, track });
      }

      if (best.kind === 'slide') {
        this._slideArm = { toTrack: best.toTrack, until: s.time + 0.6 };
        this._emit({ type: 'slideStart', id: best.id, track, toTrack: best.toTrack });
      }

      if (best.kind === 'slideEnd' && this._slideArm && this._slideArm.toTrack === track && s.time <= this._slideArm.until) {
        s.score += SCORE.SLIDE_CHAIN;
        this._slideArm = null;
        this._emit({ type: 'slideChain', track });
      }

      this._emit({ type: 'noteHit', id: best.id, track, kind: best.kind, grade });
      return { ok: true, kind: best.kind, grade, track };
    },

    // ---- 松手（长按提前松开 → 断连 + 小扣血）----
    release(track) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (track < 0 || track >= TRACK_COUNT) return { ok: false, reason: 'bounds' };
      const hid = s.heldTrack[track];
      if (hid == null) return { ok: false, reason: 'notHolding', track };
      const n = s.notes[hid];
      s.heldTrack[track] = null;
      if (n && n.kind === 'hold' && n.status === 'hit' && !n.holdComplete && !n.holdBroken) {
        n.holdBroken = true;
        n.held = false;
        this._breakCombo('holdBreak');
        s.hp = Math.max(0, s.hp - HP.HOLD_BREAK_DAMAGE);
        this._emit({ type: 'holdBreak', id: n.id, track });
        this._emit({ type: 'hpLost', hp: s.hp });
        if (s.hp <= 0) this._lose('hp');
      }
      return { ok: true, track };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        time: s.time,
        duration: s.duration,
        score: s.score,
        combo: s.combo,
        maxCombo: s.maxCombo,
        hp: s.hp,
        hpMax: s.hpMax,
        groove: s.groove,
        perfect: s.perfect,
        great: s.great,
        miss: s.miss,
        totalNotes: s.totalNotes,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) {
      this._events.push(e);
    },

    _setGroove(on) {
      const s = this.state;
      if (on === s.groove) return;
      s.groove = on;
      this._emit(on ? { type: 'grooveOn' } : { type: 'grooveOff' });
    },

    _breakCombo(source) {
      const s = this.state;
      if (s.combo > 0) {
        s.combo = 0;
        s.perfectStreak = 0;
        this._setGroove(false);
        this._emit({ type: 'comboBreak', source });
      } else {
        s.perfectStreak = 0;
        this._setGroove(false);
      }
    },

    _missNote(n) {
      const s = this.state;
      n.status = 'missed';
      s.miss += 1;
      if (n.kind === 'hold' && n.held) {
        s.heldTrack[n.track] = null;
        n.held = false;
      }
      this._breakCombo('miss');
      s.hp = Math.max(0, s.hp - HP.MISS_DAMAGE);
      this._emit({ type: 'noteMiss', id: n.id, track: n.track, kind: n.kind });
      this._emit({ type: 'hpLost', hp: s.hp });
      if (s.hp <= 0) this._lose('hp');
    },

    _win() {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      s.phase = 'won';
      const real = s.notes.filter((n) => REAL_KINDS.has(n.kind));
      const hit = real.filter((n) => n.status === 'hit').length;
      const accuracy = s.totalNotes > 0 ? (s.perfect + s.great) / s.totalNotes : 0;
      const stars = 1 + (accuracy >= SCORE.STAR_ACCURACY ? 1 : 0) + (s.maxCombo >= s.totalNotes ? 1 : 0);
      s.result = {
        won: true,
        stars,
        score: s.score,
        accuracy,
        maxCombo: s.maxCombo,
        perfect: s.perfect,
        great: s.great,
        miss: s.miss,
        totalNotes: s.totalNotes,
      };
      this._emit({ type: 'win', stars, score: s.score, accuracy, maxCombo: s.maxCombo });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      s.phase = 'lost';
      s.result = {
        won: false,
        stars: 0,
        score: s.score,
        accuracy: s.totalNotes > 0 ? (s.perfect + s.great) / s.totalNotes : 0,
        maxCombo: s.maxCombo,
        perfect: s.perfect,
        great: s.great,
        miss: s.miss,
        totalNotes: s.totalNotes,
      };
      this._emit({ type: 'lose', reason });
    },
  };

  return run;
}

function windows(state) {
  return state.groove
    ? { perfect: JUDGE.GROOVE_PERFECT_MS / 1000, great: JUDGE.GROOVE_GREAT_MS / 1000 }
    : { perfect: JUDGE.PERFECT_MS / 1000, great: JUDGE.GREAT_MS / 1000 };
}
