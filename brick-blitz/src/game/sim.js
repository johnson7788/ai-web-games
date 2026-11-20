// BRICK BLITZ · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：挡板追踪、陶珠反弹、釉砖耐久、道具掉落、炸窑连锁、三连击「窑火全开」、胜负结算。
// 依赖：config/levels.js（LEVELS）、config/game.config.js（WORLD/GAME/BRICK_KINDS）。
// 随机：注入 seed 的 mulberry32，可复现。

import { WORLD, GAME, BRICK_KINDS } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function next() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---- 砖阵几何 ----
function buildBricks(level) {
  const bricks = [];
  const cols = level.cols;
  const cellW = (WORLD.WIDTH - GAME.BRICK_MARGIN_X * 2) / cols;
  const bw = Math.max(20, cellW - GAME.BRICK_GAP);
  const bh = GAME.BRICK_H;
  let id = 0;
  for (let r = 0; r < level.pattern.length; r += 1) {
    const line = level.pattern[r];
    for (let c = 0; c < cols; c += 1) {
      const ch = line[c] || '.';
      if (ch === '.') continue;
      const spec = BRICK_KINDS[ch] || BRICK_KINDS['1'];
      const x = GAME.BRICK_MARGIN_X + c * cellW + (cellW - bw) / 2;
      const y = GAME.BRICK_TOP + r * (bh + GAME.BRICK_GAP);
      const move = (level.moveCols && level.moveCols.includes(c))
        ? { amp: 26, speed: 1.1 + (c % 3) * 0.3, phase: c * 0.7 }
        : null;
      bricks.push({
        id: id++,
        kind: spec.kind,
        hp: spec.hp,
        maxHp: spec.hp,
        score: spec.score,
        alive: true,
        x, y, bx: x, by: y, w: bw, h: bh,
        cx: x + bw / 2, cy: y + bh / 2,
        rc: { r, c },
        move,
      });
    }
  }
  return bricks;
}

function makeBall(rng, stuck) {
  const speed = GAME.BALL_SPEED;
  const angle = GAME.LAUNCH_ANGLE;
  const dir = rng() < 0.5 ? -1 : 1;
  return {
    x: WORLD.WIDTH / 2,
    y: GAME.PADDLE_Y - GAME.BALL_R,
    vx: Math.sin(angle) * speed * dir,
    vy: -Math.cos(angle) * speed,
    r: GAME.BALL_R,
    stuck: stuck !== false,
    dead: false,
  };
}

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const bricks = buildBricks(level);
  const paddleW = level.paddleW || GAME.PADDLE_W;
  const lives = level.lives ?? GAME.START_LIVES;
  const startBalls = level.startBalls || 1;
  const balls = [];
  for (let i = 0; i < startBalls; i += 1) balls.push(makeBall(rng, true));

  const state = {
    level: level.index,
    scene: level.scene,
    phase: 'playing', // 'playing' | 'won' | 'lost'
    score: 0,
    lives,
    combo: 0,
    kilnFire: 0,
    wideT: 0,
    pierceT: 0,
    paddle: {
      x: WORLD.WIDTH / 2 - paddleW / 2,
      y: GAME.PADDLE_Y,
      w: paddleW,
      h: GAME.PADDLE_H,
      targetX: WORLD.WIDTH / 2 - paddleW / 2,
      baseW: paddleW,
    },
    balls,
    bricks,
    powerUps: [],
    bricksTotal: bricks.length,
    bricksRemaining: bricks.length,
    time: 0,
    result: null,
  };

  const run = {
    state,
    _level: level,
    _rng: rng,
    _events: [],
    _clock: 0,
    _serveT: 0,
    _descendY: 0,

    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 1) dt = 1;
      this._clock += dt;
      s.time += dt;

      // 挡板追踪目标
      const p = s.paddle;
      const dx = p.targetX - p.x;
      const maxStep = GAME.PADDLE_SPEED * dt;
      if (Math.abs(dx) <= maxStep) p.x = p.targetX;
      else p.x += Math.sign(dx) * maxStep;
      p.x = Math.max(0, Math.min(WORLD.WIDTH - p.w, p.x));

      // 计时器
      if (s.kilnFire > 0) {
        s.kilnFire -= dt;
        if (s.kilnFire <= 0) { s.kilnFire = 0; this._emit({ type: 'kilnEnd' }); }
      }
      if (s.wideT > 0) s.wideT -= dt;
      if (s.pierceT > 0) s.pierceT -= dt;
      p.w = s.wideT > 0 ? GAME.PADDLE_W_WIDE : p.baseW;

      // 砖墙运动
      if (this._level.descend) this._descendBricks(dt);
      if (s.phase !== 'playing') return;
      if (this._level.moveCols) this._moveBricks(dt);

      // 陶珠运动
      const speedMul = s.kilnFire > 0 ? GAME.KILN_SPEED_MUL : 1;
      for (const ball of s.balls) {
        if (ball.dead) continue;
        if (ball.stuck) {
          ball.x = p.x + p.w / 2;
          ball.y = p.y - ball.r;
          continue;
        }
        ball.x += ball.vx * speedMul * dt;
        ball.y += ball.vy * speedMul * dt;
        if (ball.y - ball.r > WORLD.HEIGHT) {
          ball.dead = true;
          continue;
        }
        this._collideBall(ball);
      }
      if (s.phase !== 'playing') return;

      this._stepPowerUps(dt);
      this._serve(dt);
      this._checkBalls();
    },

    // 指针/触屏：设置挡板目标 X
    setPaddleTarget(x) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      x = Number(x);
      if (!Number.isFinite(x)) return { ok: false, reason: 'nan' };
      const p = s.paddle;
      p.targetX = Math.max(0, Math.min(WORLD.WIDTH - p.w, x));
      return { ok: true };
    },

    // 键盘：左右微调目标 X
    nudge(dir) {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const p = s.paddle;
      const d = dir > 0 ? 1 : -1;
      p.targetX = Math.max(0, Math.min(WORLD.WIDTH - p.w, p.targetX + d * GAME.KEY_NUDGE));
      return { ok: true };
    },

    // 发射粘在挡板上的陶珠
    launch() {
      const s = this.state;
      if (s.phase !== 'playing') return { ok: false, reason: 'phase' };
      const stuck = s.balls.filter((b) => b.stuck && !b.dead);
      if (!stuck.length) return { ok: false, reason: 'noStuck' };
      stuck.forEach((ball, i) => {
        ball.stuck = false;
        const angle = GAME.LAUNCH_ANGLE + i * 0.28;
        const dir = i % 2 === 0 ? -1 : 1;
        ball.vx = Math.sin(angle) * GAME.BALL_SPEED * dir;
        ball.vy = -Math.cos(angle) * GAME.BALL_SPEED;
      });
      this._serveT = 0;
      this._emit({ type: 'serve', count: stuck.length });
      return { ok: true };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        score: s.score,
        lives: s.lives,
        combo: s.combo,
        kilnFire: s.kilnFire,
        bricksRemaining: s.bricksRemaining,
        bricksTotal: s.bricksTotal,
        balls: s.balls.filter((b) => !b.dead).length,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    // 调试/验收：直接清空剩余砖块到达胜局（tools/fastForward 用）
    debugWin() {
      const s = this.state;
      if (s.phase !== 'playing') return false;
      for (const brick of s.bricks) brick.alive = false;
      s.bricksRemaining = 0;
      this._win();
      return true;
    },

    // ---------- 内部 ----------
    _emit(e) { this._events.push(e); },

    _serve(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      if (s.balls.some((b) => b.stuck && !b.dead)) {
        this._serveT += dt;
        if (this._serveT >= GAME.SERVE_DELAY) this.launch();
      } else {
        this._serveT = 0;
      }
    },

    _moveBricks(dt) {
      const s = this.state;
      for (const brick of s.bricks) {
        if (!brick.alive || !brick.move) continue;
        const off = Math.sin(s.time * brick.move.speed + brick.move.phase) * brick.move.amp;
        brick.x = brick.bx + off;
        brick.cx = brick.x + brick.w / 2;
      }
    },

    _descendBricks(dt) {
      const s = this.state;
      this._descendY += GAME.DESCEND_SPEED * dt;
      for (const brick of s.bricks) {
        if (!brick.alive) continue;
        brick.y = brick.by + this._descendY;
        brick.cy = brick.y + brick.h / 2;
        if (brick.y + brick.h >= GAME.DESCEND_LINE) {
          this._lose('crushed');
          return;
        }
      }
    },

    _stepPowerUps(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      const p = s.paddle;
      for (const pu of s.powerUps) {
        if (!pu.alive) continue;
        pu.y += GAME.POWER_FALL_SPEED * dt;
        if (pu.y > WORLD.HEIGHT + 40) { pu.alive = false; continue; }
        const half = GAME.POWER_SIZE / 2;
        if (pu.y + half >= p.y && pu.y - half <= p.y + p.h && pu.x + half >= p.x && pu.x - half <= p.x + p.w) {
          pu.alive = false;
          this._applyPower(pu.kind);
        }
      }
      s.powerUps = s.powerUps.filter((pu) => pu.alive);
    },

    _applyPower(kind) {
      const s = this.state;
      this._emit({ type: 'powerCatch', kind });
      if (kind === 'wide') {
        s.wideT = GAME.POWER_DURATION;
      } else if (kind === 'multi') {
        this._splitBalls();
      } else if (kind === 'pierce') {
        s.pierceT = GAME.POWER_DURATION;
      } else if (kind === 'fire') {
        s.kilnFire = GAME.KILN_DURATION;
        this._emit({ type: 'kilnFire' });
      } else if (kind === 'life') {
        s.lives = Math.min(s.lives + 1, 5);
        this._emit({ type: 'lifeGain', lives: s.lives });
      }
    },

    _splitBalls() {
      const s = this.state;
      const active = s.balls.filter((b) => !b.dead && !b.stuck);
      if (!active.length) return;
      const src = active[0];
      const spd = Math.max(GAME.BALL_SPEED, Math.hypot(src.vx, src.vy));
      const baseAng = Math.atan2(src.vy, src.vx);
      for (const dA of [-0.5, 0.5]) {
        const a = baseAng + dA;
        s.balls.push({ x: src.x, y: src.y, vx: spd * Math.cos(a), vy: spd * Math.sin(a), r: GAME.BALL_R, stuck: false, dead: false });
      }
      this._emit({ type: 'multiBall', count: s.balls.length });
    },

    _checkBalls() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      const alive = s.balls.filter((b) => !b.dead);
      if (alive.length === 0) {
        this._loseLife();
      } else {
        s.balls = alive;
      }
    },

    _collideBall(ball) {
      const s = this.state;
      const p = s.paddle;

      if (ball.x - ball.r < 0) { ball.x = ball.r; ball.vx = Math.abs(ball.vx); this._emit({ type: 'wallBounce' }); }
      if (ball.x + ball.r > WORLD.WIDTH) { ball.x = WORLD.WIDTH - ball.r; ball.vx = -Math.abs(ball.vx); this._emit({ type: 'wallBounce' }); }
      if (ball.y - ball.r < GAME.TOP_WALL) { ball.y = GAME.TOP_WALL + ball.r; ball.vy = Math.abs(ball.vy); this._emit({ type: 'wallBounce' }); }

      // 挡板反弹（仅下落时）
      if (ball.vy > 0 && ball.y + ball.r >= p.y && ball.y - ball.r <= p.y + p.h && ball.x >= p.x - ball.r && ball.x <= p.x + p.w + ball.r) {
        const hit = Math.max(0, Math.min(1, (ball.x - p.x) / p.w));
        const angleDeg = (hit - 0.5) * GAME.PADDLE_ANGLE_RANGE;
        const rad = (angleDeg * Math.PI) / 180;
        const spd = Math.max(GAME.BALL_SPEED, Math.hypot(ball.vx, ball.vy));
        ball.vx = spd * Math.sin(rad);
        ball.vy = -spd * Math.cos(rad);
        ball.y = p.y - ball.r;
        this._emit({ type: 'paddleBounce' });
      }

      // 砖块碰撞
      for (const brick of s.bricks) {
        if (!brick.alive) continue;
        if (this._ballRectOverlap(ball, brick)) this._brickCollision(ball, brick);
      }
    },

    _ballRectOverlap(ball, brick) {
      const cx = Math.max(brick.x, Math.min(ball.x, brick.x + brick.w));
      const cy = Math.max(brick.y, Math.min(ball.y, brick.y + brick.h));
      const dx = ball.x - cx;
      const dy = ball.y - cy;
      return dx * dx + dy * dy <= ball.r * ball.r;
    },

    _brickCollision(ball, brick) {
      const s = this.state;
      const pierce = s.pierceT > 0;
      if (!pierce) {
        const overlapX = Math.min(ball.x + ball.r, brick.x + brick.w) - Math.max(ball.x - ball.r, brick.x);
        const overlapY = Math.min(ball.y + ball.r, brick.y + brick.h) - Math.max(ball.y - ball.r, brick.y);
        if (overlapX < overlapY) {
          ball.vx = -ball.vx;
          ball.x += Math.sign(ball.vx) * (overlapX + 0.01);
        } else {
          ball.vy = -ball.vy;
          ball.y += Math.sign(ball.vy) * (overlapY + 0.01);
        }
      }
      brick.hp -= 1;
      this._emit({ type: 'brickHit', id: brick.id, kind: brick.kind, hp: brick.hp });
      this._combo();
      if (brick.hp <= 0) this._breakBrick(brick, false);
    },

    _combo() {
      const s = this.state;
      s.combo += 1;
      this._emit({ type: 'comboTick', combo: s.combo });
      if (s.combo >= GAME.KILN_HITS && s.kilnFire <= 0) {
        s.kilnFire = GAME.KILN_DURATION;
        s.combo = 0;
        this._emit({ type: 'kilnFire' });
      }
    },

    _breakBrick(brick, viaBlast) {
      const s = this.state;
      if (!brick.alive) return;
      brick.alive = false;
      s.bricksRemaining -= 1;
      const gain = brick.score * (s.kilnFire > 0 ? 2 : 1);
      s.score += gain;
      this._emit({ type: 'brickBreak', id: brick.id, kind: brick.kind, x: brick.cx, y: brick.cy, score: gain });
      if (brick.kind === 'blast') this._blast(brick);
      if (!viaBlast) this._maybeDrop(brick);
      if (s.bricksRemaining <= 0) this._win();
    },

    _blast(brick) {
      const s = this.state;
      for (const other of s.bricks) {
        if (!other.alive || other === brick) continue;
        // 「邻近」= 网格 3×3 邻域（横/竖/斜相邻一块）
        if (Math.abs(other.rc.r - brick.rc.r) <= 1 && Math.abs(other.rc.c - brick.rc.c) <= 1) {
          other.hp = 0;
          this._breakBrick(other, true);
        }
      }
    },

    _maybeDrop(brick) {
      const s = this.state;
      if (this._rng() >= GAME.POWER_DROP_CHANCE) return;
      const kinds = this._level.powerKinds || ['wide', 'multi', 'pierce', 'fire'];
      const kind = kinds[Math.floor(this._rng() * kinds.length)];
      s.powerUps.push({ kind, x: brick.cx, y: brick.cy, alive: true });
      this._emit({ type: 'powerDrop', kind, x: brick.cx, y: brick.cy });
    },

    _loseLife() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.lives -= 1;
      s.combo = 0;
      s.balls = [];
      this._emit({ type: 'lifeLost', lives: s.lives });
      if (s.lives <= 0) {
        this._lose('noLives');
      } else {
        s.balls = [makeBall(this._rng, true)];
        this._serveT = 0;
      }
    },

    _win() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'won';
      const stars = 1 + (s.lives >= 2 ? 1 : 0) + (s.lives >= 3 ? 1 : 0);
      s.result = { won: true, stars, score: s.score, lives: s.lives };
      this._emit({ type: 'win', stars, score: s.score, lives: s.lives });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'lost';
      s.result = { won: false, score: s.score, lives: s.lives, reason };
      this._emit({ type: 'lose', reason, score: s.score });
    },
  };

  return run;
}
