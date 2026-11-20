// Sand Serpent · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：网格蛇、定时步进、方向队列、吃食变长/得分、撞墙/仙人掌/硬地/自身判负、
//       蝎子横逃、加速带、沙暴计时、食物刷新、长度里程碑、事件表。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（GAME/FOOD）。
// 随机：注入 seed 的 mulberry32，可复现。

import { LEVELS } from '../../config/levels.js';
import { GAME, FOOD } from '../../config/game.config.js';

// ------------------------------------------------------------------ 方向
export const DIRS = {
  up: { dr: -1, dc: 0 },
  down: { dr: 1, dc: 0 },
  left: { dr: 0, dc: -1 },
  right: { dr: 0, dc: 1 },
};

export function dirName(d) {
  if (!d) return 'right';
  if (d.dr === -1) return 'up';
  if (d.dr === 1) return 'down';
  if (d.dc === -1) return 'left';
  return 'right';
}

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

const DANGER = new Set(['wall', 'cactus', 'hard']);

// ------------------------------------------------------------------ createRun
export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const grid = buildGrid(level);
  const startDir = DIRS[level.start.dir] || DIRS.right;
  const snake = [];
  for (let i = 0; i < GAME.START_LENGTH; i += 1) {
    snake.push({ r: level.start.r - startDir.dr * i, c: level.start.c - startDir.dc * i });
  }

  const startProg = GAME.START_LENGTH / level.goalLength;
  const milestones = new Set([0.25, 0.5, 0.75].filter((th) => th <= startProg));

  const state = {
    level: level.index,
    phase: 'playing',           // 'playing' | 'won' | 'lost'
    rows: level.rows,
    cols: level.cols,
    grid,
    snake,
    dir: { ...startDir },
    dirName: dirName(startDir),
    score: 0,
    length: GAME.START_LENGTH,
    goalLength: level.goalLength,
    food: [],
    interval: level.interval,
    boostLeft: 0,
    sandActive: false,
    sceneKey: level.scene,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _acc: 0,
    dir: { ...startDir },
    _dirQueue: [],
    _pendingGrowth: 0,
    _boostLeft: 0,
    _moveCounter: 0,
    _nearMissCd: 0,
    _milestones: milestones,
    _sandActive: false,
    _sandClock: 0,

    // ---- 时间推进（main 每帧调用；内部累加器按 stepInterval 触发移动）----
    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;

      this._clock += dt;

      if (this._level.sandstorm) {
        this._sandClock += dt;
        if (this._sandActive) {
          if (this._sandClock >= GAME.SANDSTORM_DURATION) {
            this._sandActive = false;
            this._sandClock = 0;
            s.sandActive = false;
          }
        } else if (this._sandClock >= GAME.SANDSTORM_EVERY) {
          this._sandActive = true;
          this._sandClock = 0;
          s.sandActive = true;
          this._emit({ type: 'sandstorm' });
        }
      }

      this._acc += dt;
      let guard = 0;
      while (this._acc >= this._currentInterval() && guard++ < 6) {
        this._acc -= this._currentInterval();
        this._moveTick();
        if (s.phase !== 'playing') { this._acc = 0; break; }
      }
    },

    // ---- 单步移动（selfplay / 测试用）----
    moveOnce() {
      if (this.state.phase !== 'playing') return { ok: false, reason: 'phase' };
      this._moveTick();
      return { ok: true };
    },

    // ---- 输入：方向字符串或 {dr,dc}，入队（至多 3 步缓冲）----
    input(dir) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const d = typeof dir === 'string' ? DIRS[dir] : dir;
      if (!d || typeof d.dr !== 'number' || typeof d.dc !== 'number') return { ok: false, reason: 'badDir' };
      const cur = this.dir;
      if (d.dr === cur.dr && d.dc === cur.dc) return { ok: false, reason: 'same' };
      if (d.dr === -cur.dr && d.dc === -cur.dc) return { ok: false, reason: 'reverse' };
      if (this._dirQueue.length >= 3) return { ok: false, reason: 'full' };
      const last = this._dirQueue[this._dirQueue.length - 1];
      if (last && last.dr === d.dr && last.dc === d.dc) return { ok: false, reason: 'same' };
      this._dirQueue.push({ dr: d.dr, dc: d.dc });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        length: s.length,
        goalLength: s.goalLength,
        score: s.score,
        phase: s.phase,
        foodCount: s.food.length,
        boost: this._boostLeft > 0,
        sandActive: s.sandActive,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _currentInterval() {
      return this._boostLeft > 0 ? GAME.BOOST_INTERVAL : this._level.interval;
    },

    _emit(e) { this._events.push(e); },

    _moveTick() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      this._moveCounter += 1;
      if (this._nearMissCd > 0) this._nearMissCd -= 1;

      // 消费方向队列（跳过反向/同向）
      let dir = this.dir;
      while (this._dirQueue.length) {
        const cand = this._dirQueue.shift();
        if (cand.dr === -dir.dr && cand.dc === -dir.dc) continue;
        if (cand.dr === dir.dr && cand.dc === dir.dc) continue;
        dir = cand;
        this._emit({ type: 'turn', dir: dirName(dir) });
        break;
      }
      this.dir = dir;
      s.dir = { ...dir };
      s.dirName = dirName(dir);

      const head = s.snake[0];
      let nr = head.r + dir.dr;
      let nc = head.c + dir.dc;
      let wrapped = false;

      if (this._level.wrap) {
        if (nr < 0) { nr = s.rows - 1; wrapped = true; }
        else if (nr >= s.rows) { nr = 0; wrapped = true; }
        if (nc < 0) { nc = s.cols - 1; wrapped = true; }
        else if (nc >= s.cols) { nc = 0; wrapped = true; }
      }

      if (nr < 0 || nr >= s.rows || nc < 0 || nc >= s.cols) {
        this._lose('wall', nr, nc);
        return;
      }

      const cell = s.grid[nr][nc];
      if (DANGER.has(cell.kind)) {
        this._lose(cell.kind, nr, nc);
        return;
      }

      // 自身碰撞（未增长时尾巴会移开，不判负）
      const growing = this._pendingGrowth > 0;
      const bodyEnd = growing ? s.snake.length : s.snake.length - 1;
      for (let i = 0; i < bodyEnd; i += 1) {
        if (s.snake[i].r === nr && s.snake[i].c === nc) {
          this._lose('self', nr, nc);
          return;
        }
      }

      this._checkNearMiss(nr, nc);

      s.snake.unshift({ r: nr, c: nc });

      if (cell.kind === 'boost') {
        this._boostLeft = GAME.BOOST_STEPS;
        s.boostLeft = this._boostLeft;
        this._emit({ type: 'boost', r: nr, c: nc });
      }

      const foodIdx = s.food.findIndex((f) => f.r === nr && f.c === nc);
      if (foodIdx >= 0) {
        const f = s.food.splice(foodIdx, 1)[0];
        this._eat(f);
        this._spawnFood();
        this._checkMilestone();
        if (s.length >= s.goalLength) {
          this._win();
          return;
        }
      }

      // 尾巴处理（增长期间保留尾巴）
      if (this._pendingGrowth > 0) {
        this._pendingGrowth -= 1;
      } else {
        s.snake.pop();
      }

      if (this._boostLeft > 0) {
        this._boostLeft -= 1;
        s.boostLeft = this._boostLeft;
      }

      if (this._level.scorpion && this._moveCounter % GAME.SCORPION_STEP_EVERY === 0) {
        this._moveScorpions();
      }

      this._emit({ type: 'move', head: { r: nr, c: nc }, length: s.snake.length });
      if (wrapped) this._emit({ type: 'wrap', r: nr, c: nc });
    },

    _eat(f) {
      const s = this.state;
      const cfg = FOOD[f.type] || FOOD.beetle;
      s.score += cfg.value;
      s.length += cfg.grow;
      this._pendingGrowth += cfg.grow;
      this._emit({ type: 'eat', kind: f.type, value: cfg.value, length: s.length, score: s.score });
      this._emit({ type: 'grow', length: s.length, score: s.score });
      if (f.type === 'thorn') this._emit({ type: 'tailDrop', length: s.length });
    },

    _rollFoodType() {
      const lv = this._level;
      if (lv.thorn) {
        const r = this._rng();
        if (r < 0.45) return 'beetle';
        if (r < 0.8) return 'scorpion';
        return 'thorn';
      }
      if (lv.scorpion) {
        return this._rng() < 0.6 ? 'beetle' : 'scorpion';
      }
      return 'beetle';
    },

    _randomEmptyCell() {
      const s = this.state;
      const occupied = new Set(s.snake.map((p) => `${p.r},${p.c}`));
      for (const f of s.food) occupied.add(`${f.r},${f.c}`);
      const cells = [];
      for (let r = 0; r < s.rows; r += 1) {
        for (let c = 0; c < s.cols; c += 1) {
          if (s.grid[r][c].kind === 'empty' && !occupied.has(`${r},${c}`)) cells.push({ r, c });
        }
      }
      if (!cells.length) return null;
      return cells[Math.floor(this._rng() * cells.length)];
    },

    _spawnFood() {
      const s = this.state;
      let guard = 0;
      while (s.food.length < this._level.foodCount && guard++ < 40) {
        const cell = this._randomEmptyCell();
        if (!cell) break;
        const type = this._rollFoodType();
        s.food.push({ r: cell.r, c: cell.c, type });
        this._emit({ type: 'spawn', kind: type, r: cell.r, c: cell.c });
      }
    },

    _cellFreeForFood(r, c) {
      const s = this.state;
      if (r < 0 || r >= s.rows || c < 0 || c >= s.cols) return false;
      if (s.grid[r][c].kind !== 'empty') return false;
      for (const p of s.snake) if (p.r === r && p.c === c) return false;
      for (const f of s.food) if (f.r === r && f.c === c) return false;
      return true;
    },

    _moveScorpions() {
      const s = this.state;
      const head = s.snake[0];
      for (const f of s.food) {
        if (f.type !== 'scorpion') continue;
        let dc = head.c < f.c ? 1 : (head.c > f.c ? -1 : (this._rng() < 0.5 ? 1 : -1));
        let nc = f.c + dc;
        if (!this._cellFreeForFood(f.r, nc)) {
          dc = -dc;
          nc = f.c + dc;
          if (!this._cellFreeForFood(f.r, nc)) continue;
        }
        f.c = nc;
        this._emit({ type: 'scorpionEscape', r: f.r, c: f.c });
      }
    },

    _checkNearMiss(r, c) {
      if (this._nearMissCd > 0) return;
      const s = this.state;
      const around = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
      for (const [rr, cc] of around) {
        if (rr < 0 || rr >= s.rows || cc < 0 || cc >= s.cols) continue;
        if (DANGER.has(s.grid[rr][cc].kind)) {
          this._nearMissCd = 15;
          this._emit({ type: 'nearMiss', r, c, danger: s.grid[rr][cc].kind });
          return;
        }
      }
    },

    _checkMilestone() {
      const s = this.state;
      const prog = s.length / s.goalLength;
      for (const th of [0.25, 0.5, 0.75]) {
        if (!this._milestones.has(th) && prog >= th) {
          this._milestones.add(th);
          this._emit({ type: 'milestone', pct: Math.round(th * 100), length: s.length });
        }
      }
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.result = { won: true, score: s.score, length: s.length, goalLength: s.goalLength, reason: null };
      this._emit({ type: 'win', score: s.score, length: s.length, goalLength: s.goalLength });
    },

    _lose(reason, r, c) {
      const s = this.state;
      s.phase = 'lost';
      s.result = { won: false, score: s.score, length: s.length, goalLength: s.goalLength, reason };
      this._emit({ type: 'lose', reason, r: r ?? null, c: c ?? null });
    },
  };

  // 初始食物 + 开局事件
  run._spawnFood();
  run._emit({ type: 'start', level: level.index });

  return run;
}

function buildGrid(level) {
  const grid = [];
  for (let r = 0; r < level.rows; r += 1) {
    grid[r] = [];
    for (let c = 0; c < level.cols; c += 1) {
      let kind = 'empty';
      if (level.walls && (r === 0 || r === level.rows - 1 || c === 0 || c === level.cols - 1)) kind = 'wall';
      grid[r][c] = { kind };
    }
  }
  for (const [r, c] of level.cacti) grid[r][c].kind = 'cactus';
  for (const [r, c] of level.hard) grid[r][c].kind = 'hard';
  for (const [r, c] of level.boosts) grid[r][c].kind = 'boost';
  return grid;
}
