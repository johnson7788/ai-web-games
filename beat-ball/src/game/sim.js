// BEAT BALL · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：节拍时钟（BPM）、鼓槌/节拍点生成（seeded 可复现）、横移/跳跃、碰撞判定、结算、事件表。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（GAME）。
// 随机：注入 seed 的 mulberry32，可复现；验收脚本关闭 WebAudio 也完全可玩可测。

import { LEVELS } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

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

// 返回拍点时刻表（秒）；支持 tempoShift 中段变速。times[i] = 第 i 拍的绝对秒。
export function beatTimes(level) {
  const d1 = 60 / level.bpm;
  const d2 = level.bpm2 ? 60 / level.bpm2 : d1;
  const shift = level.shiftBeat ?? Infinity;
  const times = [0];
  for (let i = 1; i <= level.beats; i += 1) {
    const d = i < shift ? d1 : d2;
    times.push(times[i - 1] + d);
  }
  return times;
}

// 由 level.feature 字符串推导玩法开关（levels.js 用唯一 feature 标识，避免重复写 flags）
function featureFlags(level) {
  const f = level.feature;
  return {
    doubleHazard: f === 'doubleStick' || f === 'doubleDrum',
    jumpPads: f === 'jumpPad',
    fog: f === 'fog',
    tempoShift: f === 'tempoShift',
    storm: f === 'storm',
    burst: f === 'padStorm',
    crossSticks: f === 'crossSticks',
    boss: f === 'doubleDrum',
  };
}

function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ------------------------------------------------------------------ 事件生成
// obstacle: { kind:'hazard'|'pad', lane, t(秒), travel(秒), jump?(bool), resolved, hit, warned }
function buildObstacles(level, rng) {
  const times = beatTimes(level);
  const list = [];
  const features = featureFlags(level);
  const firstHazard = GAME.FIRST_HAZARD_BEAT;
  const lanes = level.lanes;

  for (let i = 1; i <= level.beats; i += 1) {
    const t = times[i];
    const beatDur = times[i] - times[i - 1];
    const warnBeats = level.warnBeats ?? GAME.WARN_BEATS_DEFAULT;
    const travel = warnBeats * beatDur;

    // ---- 鼓槌（障碍）----
    if (i >= firstHazard) {
      let n = 0;
      if (lanes === 1) {
        if (rng() < level.hazardProb) n = 1;
      } else {
        if (features.boss && rng() < 0.7) n = 2;
        else if (features.doubleHazard && rng() < 0.5) n = 2;
        else if (rng() < level.hazardProb) n = 1;
        n = Math.min(n, lanes - 1); // 至少留一条安全轨（仅多轨）
      }
      if (n > 0) {
        const chosen = shuffle(Array.from({ length: lanes }, (_, k) => k), rng).slice(0, n);
        for (const lane of chosen) {
          list.push({ kind: 'hazard', lane, t, travel, resolved: false, hit: false, warned: false });
        }
      }
    }

    // ---- 节拍点（可得分）----
    if (rng() < level.padProb) {
      const lane = Math.floor(rng() * lanes);
      const jump = !!(features.jumpPads && rng() < 0.5);
      list.push({ kind: 'pad', lane, t, travel, jump, resolved: false, hit: false, warned: false });
    }
  }

  // 按时间排序；同一拍鼓槌先于节拍点结算（撞槌即死，得分无意义）
  list.sort((a, b) => (a.t - b.t) || (a.kind === 'hazard' ? -1 : 1));
  return list;
}

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);
  const times = beatTimes(level);
  const duration = times[level.beats];
  const obstacles = buildObstacles(level, rng);
  const padsTotal = obstacles.filter((o) => o.kind === 'pad').length;

  const state = {
    level: level.index,
    phase: 'playing',       // 'playing' | 'won' | 'lost'
    clock: 0,
    bpm: level.bpm,
    lanes: level.lanes,
    scene: level.scene,
    feature: level.feature,
    duration,
    playerLane: 0,
    playerJumping: false,
    jumpT: 0,
    score: 0,
    combo: 0,
    maxCombo: 0,
    perfects: 0,
    padsTotal,
    distance: 0,
    obstacles,
    result: null,
    stars: 0,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _resolvedIdx: 0,
    _beatIdx: 0,        // 已跨过的拍点序号
    _lastSec: 0,
    _warned: new Set(),

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      s.clock += dt;
      s.distance = Math.round(s.clock * GAME.DIST_PER_SEC);

      // 跳跃计时
      if (s.playerJumping) {
        s.jumpT -= dt;
        if (s.jumpT <= 0) {
          s.playerJumping = false;
          s.jumpT = 0;
          this._emit({ type: 'jumpLand' });
        }
      }

      // 拍点事件（细粒度，保证事件密度）
      while (this._beatIdx < times.length && times[this._beatIdx] <= s.clock) {
        this._beatIdx += 1;
        this._emit({ type: 'beat', beat: this._beatIdx, t: s.clock });
      }

      // 每秒距离心跳
      if (Math.floor(s.clock) > this._lastSec) {
        this._lastSec = Math.floor(s.clock);
        this._emit({ type: 'distanceTick', distance: s.distance });
      }

      // 预警：鼓槌进入预警窗口
      for (const o of s.obstacles) {
        if (o.kind === 'hazard' && !o.warned && !o.resolved && o.t - o.travel <= s.clock) {
          o.warned = true;
          this._emit({ type: 'warning', lane: o.lane, t: o.t });
        }
      }

      // 结算到达拍点的事件
      while (this._resolvedIdx < s.obstacles.length && s.obstacles[this._resolvedIdx].t <= s.clock) {
        this._resolve(this._resolvedIdx);
        this._resolvedIdx += 1;
        if (s.phase !== 'playing') break;
      }

      // 终局：跑到目标距离
      if (s.phase === 'playing' && s.clock >= s.duration) {
        this._win();
      }
    },

    // ---- 输入：横移（dir: -1 左 / +1 右）----
    move(dir) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.lanes <= 1) return { ok: false, reason: 'singleRail' };
      const next = Math.max(0, Math.min(s.lanes - 1, s.playerLane + (dir < 0 ? -1 : 1)));
      if (next === s.playerLane) return { ok: false, reason: 'edge' };
      s.playerLane = next;
      this._emit({ type: 'laneChange', lane: next });
      return { ok: true, lane: next };
    },

    // ---- 输入：跳跃 ----
    jump() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (s.playerJumping) return { ok: false, reason: 'airborne' };
      s.playerJumping = true;
      s.jumpT = GAME.JUMP_DURATION;
      this._emit({ type: 'jump' });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        score: s.score,
        combo: s.combo,
        maxCombo: s.maxCombo,
        distance: s.distance,
        duration: s.duration,
        progress: Math.min(1, s.clock / s.duration),
        lanes: s.lanes,
        playerLane: s.playerLane,
        playerJumping: s.playerJumping,
        bpm: s.bpm,
        stars: s.stars,
        perfects: s.perfects,
        padsTotal: s.padsTotal,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _resolve(idx) {
      const s = this.state;
      const o = s.obstacles[idx];
      if (o.resolved) return;
      o.resolved = true;

      if (o.kind === 'hazard') {
        this._emit({ type: 'hazard', lane: o.lane, t: o.t });
        if (s.playerLane === o.lane && !s.playerJumping) {
          o.hit = true;
          this._emit({ type: 'crash', lane: o.lane });
          this._lose('crash');
          return;
        }
        // 躲过：跳跃跨过 或 相邻轨擦过
        if (s.playerLane === o.lane && s.playerJumping) {
          this._emit({ type: 'nearMiss', lane: o.lane, by: 'jump' });
        } else if (s.lanes > 1 && Math.abs(s.playerLane - o.lane) === 1) {
          this._emit({ type: 'nearMiss', lane: o.lane, by: 'lane' });
        }
        return;
      }

      // ---- 节拍点 ----
      if (o.kind === 'pad') {
        const onLane = s.playerLane === o.lane;
        if (onLane) {
          const valid = o.jump ? s.playerJumping : !s.playerJumping;
          if (valid) {
            o.hit = true;
            const mult = o.jump ? GAME.JUMP_PAD_MULT : 1;
            const gain = GAME.PAD_SCORE * mult + s.combo * GAME.COMBO_BONUS;
            s.score += gain;
            s.combo += 1;
            s.perfects += 1;
            s.maxCombo = Math.max(s.maxCombo, s.combo);
            this._emit({ type: 'padHit', lane: o.lane, combo: s.combo, gain, jump: !!o.jump });
            if (GAME.PERFECT_CHAIN.includes(s.combo)) {
              s.score += GAME.PERFECT_BONUS;
              this._emit({ type: 'perfect', combo: s.combo, bonus: GAME.PERFECT_BONUS });
            }
          } else {
            s.combo = 0;
            this._emit({ type: 'padMiss', lane: o.lane, reason: o.jump ? 'notJumping' : 'airborne' });
          }
        }
        // 不在该轨 = 让拍，无事件无惩罚
      }
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      const hitRate = s.padsTotal > 0 ? s.perfects / s.padsTotal : 1;
      const stars = 1 + (s.maxCombo >= this._level.targetCombo ? 1 : 0) + (hitRate >= GAME.STAR_HIT_RATIO ? 1 : 0);
      s.stars = stars;
      s.result = { won: true, stars, score: s.score, distance: s.distance, maxCombo: s.maxCombo };
      this._emit({ type: 'win', stars, score: s.score, maxCombo: s.maxCombo });
    },

    _lose(reason) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, score: s.score, distance: s.distance, maxCombo: s.maxCombo };
      this._emit({ type: 'lose', reason });
    },
  };

  return run;
}

// ------------------------------------------------------------------ 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}
