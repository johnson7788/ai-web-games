// STICKMAN ESCAPE ROOM · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 玩法：9 根柱子上有发光安全缺口；天花板开始下落后，站进安全缺口存活。
// 存活 → 下一关（更快天花板 + 新障碍）；撑过 8 关 = 逃出密室。
// 随机：注入 seed 的 mulberry32，可复现。事件表供 main 消费（音效/反馈/教程推进）。

import { LEVELS, LEVEL_COUNT } from '../../config/levels.js';
import { GAME, STEP } from '../../config/game.config.js';

// ------------------------------------------------------------------ RNG
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const startLevel = Math.min(GAME.MAX_LEVEL, Math.max(1, (levelIndex | 0) + 1));

  const state = {
    level: startLevel,
    phase: 'countdown',     // 'countdown' | 'descending' | 'won' | 'lost'
    columns: GAME.COLUMNS,
    heights: [],            // 每列柱高（1..5，纯视觉）
    safe: [],               // 发光安全缺口（逃生口）
    rocks: [],              // 岩石墙（不能站）
    hazards: [],            // 熔岩（压顶时塌陷，假缺口）
    powers: [],             // 'gem' | 'shield' | 'slow' | null
    playerIndex: GAME.PLAYER_START,
    countdown: 0,
    countdownMax: 0,
    descend: 0,             // 0..1 天花板下落进度
    descendTime: 1,
    combo: 0,
    score: 0,
    totalStars: 0,
    lastStars: 0,
    shield: 0,
    slow: 0,
    boost: GAME.BOOST_PER_LEVEL,
    settled: false,         // 天花板开始下落时是否已站在安全缺口
    result: null,
  };

  const run = {
    state,
    _level: LEVELS[state.level - 1],
    _rng: rng,
    _events: [],
    _clock: 0,
    _lastTick: 0,
    _lastCeil: 0,

    // ---- 时间推进
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1; // 防大跳帧
      this._clock += dt;

      if (s.phase === 'countdown') {
        s.countdown -= dt;
        const sec = Math.ceil(s.countdown);
        if (sec < this._lastTick && sec >= 0) {
          this._lastTick = sec;
          this._emit({ type: 'countdownTick', timeLeft: sec });
        }
        if (s.countdown <= 0) {
          s.countdown = 0;
          s.settled = s.safe[s.playerIndex] && !s.hazards[s.playerIndex];
          s.phase = 'descending';
          s.descend = 0;
          this._lastCeil = 0;
          if (s.slow > 0) {
            s.slow -= 1;
            s.descendTime *= 1.8;
            this._emit({ type: 'slowUsed' });
          }
          this._emit({ type: 'descendStart' });
        }
      } else if (s.phase === 'descending') {
        s.descend += dt / s.descendTime;
        const stepIdx = Math.floor(s.descend / 0.2);
        while (this._lastCeil < stepIdx) {
          this._lastCeil += 1;
          this._emit({ type: 'ceilingStep', progress: Math.min(1, this._lastCeil * 0.2) });
        }
        if (s.descend >= 1) this._resolve();
      }
    },

    // ---- 移动一列
    move(dir) {
      const s = this.state;
      if (s.phase !== 'countdown' && s.phase !== 'descending') return { ok: false, reason: 'phase' };
      if (dir !== -1 && dir !== 1) return { ok: false, reason: 'badDir' };
      const to = s.playerIndex + dir;
      if (to < 0 || to >= s.columns) return { ok: false, reason: 'bounds' };
      if (s.rocks[to]) return { ok: false, reason: 'rock' };
      const from = s.playerIndex;
      s.playerIndex = to;
      this._emit({ type: 'move', dir, from, to });
      this._land();
      return { ok: true, from, to };
    },

    // ---- 冲刺两列（可越过岩石，每关一次）
    boost(dir) {
      const s = this.state;
      if (s.phase !== 'countdown' && s.phase !== 'descending') return { ok: false, reason: 'phase' };
      if (s.boost <= 0) return { ok: false, reason: 'noBoost' };
      if (dir !== -1 && dir !== 1) return { ok: false, reason: 'badDir' };
      const to = s.playerIndex + dir * 2;
      if (to < 0 || to >= s.columns) return { ok: false, reason: 'bounds' };
      if (s.rocks[to]) return { ok: false, reason: 'rock' };
      s.boost -= 1;
      const from = s.playerIndex;
      s.playerIndex = to;
      this._emit({ type: 'boost', dir, from, to });
      this._land();
      return { ok: true, from, to };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        countdown: s.countdown,
        descend: s.descend,
        combo: s.combo,
        score: s.score,
        totalStars: s.totalStars,
        lastStars: s.lastStars,
        shield: s.shield,
        slow: s.slow,
        boost: s.boost,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _setupLevel() {
      const s = this.state;
      const lv = LEVELS[s.level - 1] || LEVELS[0];
      this._level = lv;
      const N = s.columns;
      s.heights = [];
      for (let i = 0; i < N; i += 1) s.heights.push(1 + Math.floor(this._rng() * 5));

      s.rocks = new Array(N).fill(false);
      for (const r of (lv.rocks || [])) s.rocks[r] = true;

      // 熔岩：随机落在 1..7（避开岩石，不落边角）
      s.hazards = new Array(N).fill(false);
      const hzCount = lv.hazardsCount || 0;
      let placed = 0;
      let guard = 0;
      while (placed < hzCount && guard++ < 40) {
        const i = 1 + Math.floor(this._rng() * 7);
        if (!s.hazards[i] && !s.rocks[i]) { s.hazards[i] = true; placed += 1; }
      }

      // 安全缺口：随机、避开岩石与熔岩
      s.safe = new Array(N).fill(false);
      const safeCount = lv.safeMin + Math.floor(this._rng() * (lv.safeMax - lv.safeMin + 1));
      placed = 0;
      guard = 0;
      while (placed < safeCount && guard++ < 40) {
        const i = Math.floor(this._rng() * N);
        if (!s.safe[i] && !s.rocks[i] && !s.hazards[i]) { s.safe[i] = true; placed += 1; }
      }

      // 道具：随机落在非岩石/非熔岩柱
      s.powers = new Array(N).fill(null);
      const placePower = (kind) => {
        let tries = 0;
        while (tries++ < 40) {
          const i = Math.floor(this._rng() * N);
          if (!s.powers[i] && !s.rocks[i] && !s.hazards[i]) { s.powers[i] = kind; return; }
        }
      };
      for (let g = 0; g < (lv.gemCount || 0); g += 1) placePower('gem');
      if ((lv.powers || []).includes('shield')) placePower('shield');
      if ((lv.powers || []).includes('slow')) placePower('slow');

      s.playerIndex = GAME.PLAYER_START;
      if (s.rocks[s.playerIndex]) s.playerIndex = 4; // 4 永不落岩石（生成规则保证）
      s.countdown = lv.countdown;
      s.countdownMax = lv.countdown;
      s.descend = 0;
      s.descendTime = lv.descendTime;
      s.boost = GAME.BOOST_PER_LEVEL;
      s.settled = false;
      s.lastStars = 0;
      s.phase = 'countdown';
      this._lastTick = Math.ceil(s.countdown);
      this._lastCeil = 0;
      this._emit({ type: 'levelStart', level: s.level });
    },

    _land() {
      const s = this.state;
      const idx = s.playerIndex;
      if (s.hazards[idx]) this._emit({ type: 'danger', index: idx });
      const kind = s.powers[idx];
      if (!kind) return;
      s.powers[idx] = null;
      if (kind === 'gem') s.score += GAME.SCORE_GEM;
      else if (kind === 'shield') { s.shield = Math.min(GAME.SHIELD_MAX, s.shield + 1); s.score += GAME.SCORE_SHIELD; }
      else if (kind === 'slow') { s.slow = Math.min(GAME.SLOW_MAX, s.slow + 1); s.score += GAME.SCORE_SLOW; }
      this._emit({ type: 'collect', kind, index: idx, score: s.score });
    },

    _resolve() {
      const s = this.state;
      const idx = s.playerIndex;
      const safe = s.safe[idx] && !s.hazards[idx];
      if (!safe) {
        if (s.shield > 0) {
          s.shield -= 1;
          this._emit({ type: 'shieldUsed', index: idx });
          this._survive(idx, true);
          return;
        }
        let near = false;
        if (idx > 0 && s.safe[idx - 1] && !s.hazards[idx - 1]) near = true;
        if (idx < s.columns - 1 && s.safe[idx + 1] && !s.hazards[idx + 1]) near = true;
        if (near) this._emit({ type: 'nearMiss', index: idx });
        s.phase = 'lost';
        s.result = {
          won: false,
          level: s.level,
          score: s.score,
          combo: s.combo,
          totalStars: s.totalStars,
          roomsCleared: s.level - 1,
          reason: s.hazards[idx] ? 'lava' : 'crush',
        };
        this._emit({ type: 'crush', index: idx });
        this._emit({ type: 'lose', reason: s.result.reason, level: s.level });
      } else {
        this._survive(idx, false);
      }
    },

    _survive(idx, shielded) {
      const s = this.state;
      s.combo += 1;
      const stars = 1 + (s.settled ? 1 : 0) + (s.combo >= GAME.COMBO_STAR_AT ? 1 : 0);
      s.lastStars = stars;
      s.totalStars += stars;
      s.score += GAME.SCORE_SURVIVE * s.combo;
      this._emit({ type: 'survive', index: idx, combo: s.combo, stars, shielded: !!shielded });
      if (s.level >= GAME.MAX_LEVEL) {
        s.phase = 'won';
        s.result = {
          won: true,
          level: s.level,
          score: s.score,
          combo: s.combo,
          totalStars: s.totalStars,
          roomsCleared: s.level,
        };
        this._emit({ type: 'win', level: s.level, score: s.score, combo: s.combo, stars: s.totalStars });
      } else {
        s.level += 1;
        this._setupLevel();
      }
    },
  };

  run._setupLevel();
  return run;
}

// ------------------------------------------------------------------ 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(STEP);
  return sim;
}

export { LEVELS, LEVEL_COUNT };
