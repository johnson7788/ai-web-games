// BRICK BUSTER POP · 模拟层（纯逻辑，零 DOM / window / Date.now / canvas）
// 玩法：瞄准炮台发射一束光球，光球反弹削砖，砖墙每轮下坠逼近；清空可清砖过关。
// 契约：createRun(levelIndex, opts) → { state, step, aim, fire, getHud, drainEvents }。
// 随机：seed 注入 mulberry32（本模拟无随机元素，仅供 selfplay 变策略用）。
import { LEVELS } from '../../config/levels.js';
import { buildBricks } from './level.js';
import {
  WORLD, GRID, CANNON, BALL, AIM, DANGER_Y, COMBO_MAX, SCORING, AUTO_FIRE_SEC,
} from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const bricks = buildBricks(level);

  const state = {
    level: level.index,
    levelName: level.name,
    scene: level.scene,
    phase: 'aim', // 'aim' | 'flying' | 'won' | 'lost'
    bricks,
    clearableCount: bricks.filter((b) => b.clearable).length,
    score: 0,
    combo: 0,
    maxCombo: 0,
    ballCount: level.balls,
    pendingAdd: 0,
    volleys: 0,
    cannonAngle: 0,
    aimIdle: 0,
    launchQueue: 0,
    launchTimer: 0,
    balls: [],
    stars: 0,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _rng: mulberry32(seed),
    _events: [],
    _clock: 0,
    autoFire: true,

    step(dt) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;

      if (s.phase === 'aim') {
        if (this.autoFire !== false) {
          s.aimIdle += dt;
          if (s.aimIdle >= AUTO_FIRE_SEC) this._autoFire();
        }
      } else if (s.phase === 'flying') {
        // 连发整束球
        if (s.launchQueue > 0) {
          s.launchTimer -= dt;
          while (s.launchQueue > 0 && s.launchTimer <= 0) {
            this._spawnBall();
            s.launchQueue -= 1;
            s.launchTimer += BALL.LAUNCH_INTERVAL;
          }
        }
        for (const b of s.balls) {
          if (s.phase !== 'flying') break;
          this._moveBall(b, dt);
        }
        s.balls = s.balls.filter((b) => !b.dead);
        if (s.launchQueue === 0 && s.balls.length === 0) this._settle();
      }
    },

    aim(angle) {
      const s = this.state;
      if (s.phase === 'won' || s.phase === 'lost') return { ok: false, reason: 'phase' };
      s.cannonAngle = clamp(Number(angle) || 0, AIM.MIN, AIM.MAX);
      s.aimIdle = 0;
      return { ok: true, angle: s.cannonAngle };
    },

    fire() {
      const s = this.state;
      if (s.phase !== 'aim') return { ok: false, reason: 'notAiming' };
      if (s.clearableCount <= 0) return { ok: false, reason: 'done' };
      s.phase = 'flying';
      s.aimIdle = 0;
      s.volleys += 1;
      s.launchQueue = s.ballCount;
      s.launchTimer = 0;
      this._emit({ type: 'fire', volley: s.volleys, balls: s.ballCount, angle: s.cannonAngle });
      return { ok: true };
    },

    _autoFire() {
      const s = this.state;
      if (s.phase !== 'aim' || s.clearableCount <= 0) return;
      s.cannonAngle = 0;
      this.fire();
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        score: s.score,
        combo: s.combo,
        maxCombo: s.maxCombo,
        ballCount: s.ballCount,
        clearableCount: s.clearableCount,
        volleys: s.volleys,
        angle: s.cannonAngle,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // ---------------- 内部 ----------------
    _emit(e) { this._events.push(e); },

    _comboFactor() { return this.state.combo + 1; },

    _spawnBall() {
      const s = this.state;
      const spread = (this._rng() * 2 - 1) * BALL.SPREAD;
      const ang = ((s.cannonAngle + spread) * Math.PI) / 180;
      s.balls.push({
        x: CANNON.X,
        y: CANNON.Y - 22,
        vx: Math.sin(ang) * BALL.SPEED,
        vy: -Math.cos(ang) * BALL.SPEED,
        hasHit: false,
        hits: 0,
        life: BALL.MAX_LIFE,
        dead: false,
      });
      this._emit({ type: 'launch' });
    },

    _moveBall(b, dt) {
      const s = this.state;
      b.x += b.vx * dt;
      b.y += b.vy * dt;
      b.life -= dt;
      if (b.life <= 0) {
        b.dead = true;
        this._onBallConsumed(b);
        return;
      }

      // 左右墙反弹
      if (b.x < BALL.R) { b.x = BALL.R; b.vx = Math.abs(b.vx); }
      else if (b.x > WORLD.WIDTH - BALL.R) { b.x = WORLD.WIDTH - BALL.R; b.vx = -Math.abs(b.vx); }
      // 顶墙反弹
      if (b.y < BALL.R) { b.y = BALL.R; b.vy = Math.abs(b.vy); }

      // 底部（落回发射台下方）→ 本颗球消耗
      if (b.y > WORLD.HEIGHT + BALL.R) {
        b.dead = true;
        this._onBallConsumed(b);
        return;
      }

      // 砖块碰撞
      for (const brick of s.bricks) {
        if (s.phase !== 'flying') return;
        if (brick.dead) continue;
        if (this._circleRect(b, brick)) this._onHit(brick, b);
      }
    },

    _circleRect(b, brick) {
      const cx = clamp(b.x, brick.x, brick.x + brick.w);
      const cy = clamp(b.y, brick.y, brick.y + brick.h);
      const dx = b.x - cx;
      const dy = b.y - cy;
      const d2 = dx * dx + dy * dy;
      const r = BALL.R;
      if (d2 >= r * r) return false;
      let nx;
      let ny;
      if (d2 > 1e-6) {
        const d = Math.sqrt(d2);
        nx = dx / d;
        ny = dy / d;
      } else {
        nx = 0;
        ny = -1;
      }
      b.x = cx + nx * (r + 0.01);
      b.y = cy + ny * (r + 0.01);
      const dot = b.vx * nx + b.vy * ny;
      if (dot < 0) {
        b.vx -= 2 * dot * nx;
        b.vy -= 2 * dot * ny;
      }
      return true;
    },

    _onHit(brick, b) {
      const s = this.state;
      b.hasHit = true;
      b.hits += 1;
      switch (brick.type) {
        case 'num':
          this._damageBrick(brick);
          break;
        case 'rock':
          s.score += SCORING.ROCK;
          this._emit({ type: 'rockHit', r: brick.r, c: brick.c });
          break;
        case 'h':
          this._breakBrick(brick);
          this._clearLine('h', brick.r, brick.c);
          break;
        case 'v':
          this._breakBrick(brick);
          this._clearLine('v', brick.r, brick.c);
          break;
        case 'b':
          this._breakBrick(brick);
          this._clearBomb(brick.r, brick.c);
          break;
        case 'plus':
          this._breakBrick(brick);
          s.pendingAdd += 1;
          this._emit({ type: 'plusBall', r: brick.r, c: brick.c });
          break;
        case 'scatter':
          this._breakBrick(brick);
          this._scatter(b);
          this._emit({ type: 'scatter', r: brick.r, c: brick.c });
          break;
        default:
          break;
      }
      if (s.clearableCount <= 0 && s.phase === 'flying') this._win();
    },

    _damageBrick(brick) {
      const s = this.state;
      brick.hp -= 1;
      s.score += SCORING.HIT * this._comboFactor();
      this._emit({ type: 'hit', r: brick.r, c: brick.c, hp: brick.hp });
      if (brick.hp <= 0) this._breakBrick(brick);
    },

    _breakBrick(brick) {
      if (brick.dead) return;
      const s = this.state;
      brick.dead = true;
      brick.hp = 0;
      s.clearableCount -= 1;
      s.score += SCORING.BREAK * this._comboFactor();
      s.combo = Math.min(COMBO_MAX, s.combo + 1);
      if (s.combo > s.maxCombo) s.maxCombo = s.combo;
      this._emit({ type: 'break', r: brick.r, c: brick.c, combo: s.combo });
      this._emit({ type: 'combo', combo: s.combo });
    },

    _clearLine(dir, r, c) {
      const s = this.state;
      const targets = s.bricks.filter((b) => !b.dead && b.clearable && (dir === 'h' ? b.r === r : b.c === c));
      s.score += SCORING.LINE;
      this._emit({ type: 'lineClear', dir, r, c, count: targets.length });
      for (const b of targets) if (!b.dead) this._breakBrick(b);
    },

    _clearBomb(r, c) {
      const s = this.state;
      const targets = s.bricks.filter((b) => !b.dead && b.clearable && Math.abs(b.r - r) <= 1 && Math.abs(b.c - c) <= 1);
      s.score += SCORING.BOMB;
      this._emit({ type: 'bomb', r, c, count: targets.length });
      for (const b of targets) if (!b.dead) this._breakBrick(b);
    },

    _scatter(b) {
      if (this.state.balls.length < BALL.MAX_IN_FLIGHT) {
        this.state.balls.push({
          x: b.x,
          y: b.y,
          vx: -b.vx,
          vy: b.vy,
          hasHit: true,
          hits: b.hits,
          dead: false,
        });
      }
    },

    _onBallConsumed(b) {
      if (!b.hasHit) this.state.combo = 0; // 整颗球落空 → 断连
    },

    _settle() {
      const s = this.state;
      if (s.pendingAdd > 0) {
        s.ballCount += s.pendingAdd;
        s.pendingAdd = 0;
      }
      if (s.clearableCount <= 0) {
        this._win();
        return;
      }
      this._descend();
    },

    _descend() {
      const s = this.state;
      let lose = false;
      for (const b of s.bricks) {
        if (b.dead || !b.descendable) continue;
        b.r += 1;
        b.y += GRID.CELL_H + GRID.GAP;
        if (b.y + b.h >= DANGER_Y) lose = true;
      }
      this._emit({ type: 'descend' });
      if (lose) this._lose();
      else s.phase = 'aim';
    },

    _calcStars() {
      const par = this._level.par ?? 2;
      if (this.state.volleys <= par) return 3;
      if (this.state.volleys <= par + 1) return 2;
      return 1;
    },

    _win() {
      const s = this.state;
      s.phase = 'won';
      s.stars = this._calcStars();
      s.result = { won: true, stars: s.stars, score: s.score, volleys: s.volleys };
      this._emit({ type: 'win', stars: s.stars, score: s.score, volleys: s.volleys });
    },

    _lose() {
      const s = this.state;
      s.phase = 'lost';
      s.stars = 0;
      s.result = { won: false, score: s.score, volleys: s.volleys, reason: 'wall' };
      this._emit({ type: 'lose', reason: 'wall', score: s.score });
    },
  };

  return run;
}

// 兼容骨架别名（老骨架 main 会调用）
export function createSim() {
  return createRun(0, { seed: 1 });
}

export function updateSim(sim, _input) {
  sim.step(1 / 60);
  return sim;
}
