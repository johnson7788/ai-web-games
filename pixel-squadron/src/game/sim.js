// PIXEL SQUADRON · 模拟层（纯逻辑，零 DOM/window/Date.now/canvas）
// 职责：玩家/敌机/敌弹/岩石/子弹的运动与碰撞、连击、星级结算、事件表。
// 依赖：config/levels.js（LEVELS/LEVEL_COUNT）+ config/game.config.js（WORLD/GAME）。
// 随机：注入 seed 的 mulberry32，可复现。
import { LEVELS } from '../../config/levels.js';
import { WORLD, GAME } from '../../config/game.config.js';

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
const dist2 = (a, b) => (a.x - b.x) * (a.x - b.x) + (a.y - b.y) * (a.y - b.y);
const hit = (a, b, rr) => dist2(a, b) <= rr * rr;

export function createRun(levelIndex = 0, opts = {}) {
  const level = LEVELS[levelIndex] ?? LEVELS[0];
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const state = {
    level: level.index,
    phase: 'playing',           // 'playing' | 'won' | 'lost'
    time: 0,
    player: {
      x: WORLD.WIDTH / 2,
      y: level.playerY ?? 640,
      hp: level.playerHp,
      maxHp: level.playerHp,
      moveDir: 0,
      fireCd: 0,
      invuln: 0,
    },
    bullets: [],                // 玩家子弹 {x,y,r}
    enemyBullets: [],           // 敌弹 {x,y,vx,vy,r}
    enemies: [],                // 敌机 {id,x,y,baseX,moveT,hp,maxHp,type,fireCd,r}
    asteroids: [],              // 岩石 {id,x,y,vy,size,hp,r,spin,spinV}
    score: 0,
    kills: 0,
    killGoal: level.killGoal,
    combo: 1,
    comboPeak: 1,
    comboTimer: 0,
    spawnCd: level.spawnDelay,
    spawned: 0,
    asteroidCd: level.asteroidInterval || 0,
    stars: 0,
    result: null,
  };

  let nextId = 1;
  const events = [];
  const emit = (e) => events.push(e);

  const run = {
    state,
    _level: level,
    _rng: rng,

    // ---- 时间推进 ----
    step(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      dt = Number(dt);
      if (!Number.isFinite(dt) || dt <= 0) return;
      if (dt > 0.1) dt = 0.1; // 防大跳帧

      s.time += dt;
      this._stepPlayer(dt);
      this._stepBullets(dt);
      this._stepEnemyBullets(dt);
      this._stepEnemies(dt);
      this._stepAsteroids(dt);
      this._spawn(dt);
      this._collide();
      this._decayCombo(dt);
    },

    // ---- 输入：水平移动方向（-1 左 / 0 停 / 1 右）----
    setMove(dir) {
      const d = dir < 0 ? -1 : dir > 0 ? 1 : 0;
      const changed = this.state.player.moveDir !== d;
      this.state.player.moveDir = d;
      return { ok: true, changed };
    },

    getHud() {
      const s = this.state;
      return {
        level: s.level,
        phase: s.phase,
        time: s.time,
        score: s.score,
        kills: s.kills,
        killGoal: s.killGoal,
        hp: s.player.hp,
        maxHp: s.player.maxHp,
        combo: s.combo,
        comboPeak: s.comboPeak,
        stars: s.stars,
      };
    },

    drainEvents() {
      const ev = events.splice(0, events.length);
      return ev;
    },

    // ---- 调试：直接结算（供 verify / 截图走结算屏 UI）----
    forceWin() {
      if (this.state.phase === 'won') return;
      this._win();
    },
    forceLose(reason = 'destroyed') {
      if (this.state.phase === 'lost') return;
      this._lose(reason);
    },

    // ---------------- 内部 ----------------
    _stepPlayer(dt) {
      const p = this.state.player;
      if (p.invuln > 0) p.invuln = Math.max(0, p.invuln - dt);
      p.x = clamp(p.x + p.moveDir * level.playerSpeed * dt, 34, WORLD.WIDTH - 34);
      p.fireCd -= dt;
      if (p.fireCd <= 0) {
        p.fireCd = level.fireDelay;
        this.state.bullets.push({ x: p.x, y: p.y - 26, r: 7 });
        emit({ type: 'shot', x: p.x });
      }
    },

    _stepBullets(dt) {
      const s = this.state;
      for (const b of s.bullets) b.y -= level.bulletSpeed * dt;
      s.bullets = s.bullets.filter((b) => b.y > -40);
    },

    _stepEnemyBullets(dt) {
      const s = this.state;
      for (const b of s.enemyBullets) {
        b.x += b.vx * dt;
        b.y += b.vy * dt;
      }
      s.enemyBullets = s.enemyBullets.filter((b) => b.y < WORLD.HEIGHT + 40 && b.y > -40);
    },

    _stepEnemies(dt) {
      const s = this.state;
      for (const e of s.enemies) {
        e.moveT += dt;
        e.y += level.enemySpeed * dt;
        e.x = clamp(e.baseX + Math.sin(e.moveT * level.zigzagFreq) * level.zigzagAmp, 30, WORLD.WIDTH - 30);
        e.fireCd -= dt;
        if (e.fireCd <= 0 && e.y > 40 && e.y < 520) {
          e.fireCd = level.enemyFireDelay;
          this._enemyFire(e);
        }
      }
      const escaped = s.enemies.some((e) => e.y > WORLD.HEIGHT + 30);
      s.enemies = s.enemies.filter((e) => e.y <= WORLD.HEIGHT + 30);
      if (escaped) this._lose('escape');
    },

    _enemyFire(e) {
      const s = this.state;
      const speed = level.enemyBulletSpeed;
      if (e.type === 'boss') {
        for (const vx of [-120, 0, 120]) {
          s.enemyBullets.push({ x: e.x, y: e.y + 20, vx, vy: speed * 0.8, r: 6 });
        }
      } else {
        s.enemyBullets.push({ x: e.x, y: e.y + 16, vx: 0, vy: speed, r: 6 });
      }
      emit({ type: 'enemyShot', x: e.x });
    },

    _stepAsteroids(dt) {
      const s = this.state;
      for (const a of s.asteroids) {
        a.y += a.vy * dt;
        a.spin += a.spinV * dt;
      }
      s.asteroids = s.asteroids.filter((a) => a.y < WORLD.HEIGHT + 60);
    },

    _spawn(dt) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      // 敌机
      if (s.spawned < level.killGoal && s.enemies.length < level.maxEnemies) {
        s.spawnCd -= dt;
        if (s.spawnCd <= 0) {
          s.spawnCd = level.spawnDelay;
          this._spawnEnemy();
        }
      }
      // 岩石
      if (level.asteroidInterval > 0) {
        s.asteroidCd -= dt;
        if (s.asteroidCd <= 0 && s.asteroids.length < level.asteroidMax) {
          s.asteroidCd = level.asteroidInterval;
          this._spawnAsteroid(2);
        }
      }
    },

    _spawnEnemy() {
      const s = this.state;
      const isBoss = level.boss && s.spawned === level.killGoal - 1;
      const amp = level.zigzagAmp;
      const baseX = 40 + amp + this._rng() * (WORLD.WIDTH - 80 - 2 * amp);
      const hp = isBoss ? 18 + level.index * 3 : level.enemyHp;
      const r = isBoss ? level.enemyRadius * 2 : level.enemyRadius;
      s.enemies.push({
        id: nextId++,
        x: baseX,
        y: 60,
        baseX,
        moveT: this._rng() * Math.PI * 2,
        hp,
        maxHp: hp,
        type: isBoss ? 'boss' : 'grunt',
        fireCd: isBoss ? 1.2 : level.enemyFireDelay * 0.6,
        r,
      });
      s.spawned += 1;
      emit({ type: isBoss ? 'bossSpawn' : 'spawn', x: baseX });
    },

    _spawnAsteroid(size, x = null, y = 60) {
      const s = this.state;
      const ax = x == null ? 40 + this._rng() * (WORLD.WIDTH - 80) : clamp(x + (this._rng() - 0.5) * 26, 30, WORLD.WIDTH - 30);
      const r = size === 2 ? level.asteroidRadius : size === 1 ? Math.round(level.asteroidRadius * 0.7) : Math.round(level.asteroidRadius * 0.5);
      const hp = size === 2 ? level.asteroidHp * 2 : size === 1 ? 2 : 1;
      s.asteroids.push({
        id: nextId++,
        x: ax,
        y,
        vy: level.asteroidSpeed * (x == null ? 1 : 0.9 + this._rng() * 0.2),
        size,
        hp,
        r,
        spin: this._rng() * Math.PI * 2,
        spinV: (this._rng() - 0.5) * 2.4,
      });
      if (x == null) emit({ type: 'asteroidSpawn', x: ax, size });
    },

    _collide() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      const p = s.player;
      const playerR = 16;

      // 玩家子弹 vs 敌机 / 岩石
      for (const b of s.bullets) {
        for (const e of s.enemies) {
          if (hit(b, e, b.r + e.r)) {
            b.dead = true;
            e.hp -= 1;
            emit({ type: 'hit', x: e.x });
            if (e.hp <= 0) this._killEnemy(e);
            break;
          }
        }
        if (b.dead) continue;
        if (s.phase !== 'playing') continue;
        for (const a of s.asteroids) {
          if (hit(b, a, b.r + a.r)) {
            b.dead = true;
            this._damageAsteroid(a);
            break;
          }
        }
      }
      s.bullets = s.bullets.filter((b) => !b.dead);

      // 玩家受击（仅非无敌时判定）
      if (p.invuln <= 0 && s.phase === 'playing') {
        for (const b of s.enemyBullets) {
          if (hit(b, p, b.r + playerR)) {
            b.dead = true;
            this._damagePlayer(1);
            if (s.phase !== 'playing') break;
          }
        }
        if (s.phase === 'playing') {
          for (const e of s.enemies) {
            if (hit(e, p, e.r + playerR)) {
              e.dead = true;
              this._damagePlayer(2);
              if (s.phase !== 'playing') break;
            }
          }
        }
        if (s.phase === 'playing') {
          for (const a of s.asteroids) {
            if (hit(a, p, a.r + playerR)) {
              a.dead = true;
              this._damagePlayer(1);
              if (s.phase !== 'playing') break;
            }
          }
        }
      }

      // 清理已死实体（子弹击杀的敌机/岩石也要在这里移除）
      s.enemyBullets = s.enemyBullets.filter((b) => !b.dead);
      s.enemies = s.enemies.filter((e) => !e.dead);
      s.asteroids = s.asteroids.filter((a) => !a.dead);
    },

    _killEnemy(e) {
      const s = this.state;
      e.dead = true;
      s.kills += 1;
      s.combo = Math.min(s.combo + 1, GAME.COMBO_MAX);
      s.comboPeak = Math.max(s.comboPeak, s.combo);
      s.comboTimer = GAME.COMBO_WINDOW;
      s.score += 10 * s.combo;
      emit({ type: 'kill', x: e.x, y: e.y, combo: s.combo });
      emit({ type: 'combo', combo: s.combo });
      if (s.kills >= s.killGoal) this._win();
    },

    _damageAsteroid(a) {
      const s = this.state;
      a.hp -= 1;
      emit({ type: 'asteroidHit', x: a.x, y: a.y });
      if (a.hp <= 0) {
        a.dead = true;
        s.score += 2;
        if (a.size > 0) {
          emit({ type: 'asteroidSplit', x: a.x, y: a.y });
          for (let i = 0; i < 2; i += 1) this._spawnAsteroid(a.size - 1, a.x, a.y);
        } else {
          emit({ type: 'asteroidDestroyed', x: a.x, y: a.y });
        }
      }
    },

    _damagePlayer(amount) {
      const s = this.state;
      const p = s.player;
      if (p.invuln > 0) return;
      p.hp -= amount;
      p.invuln = GAME.PLAYER_INVULN;
      s.combo = 1;
      s.comboTimer = 0;
      emit({ type: 'playerHit', hp: p.hp });
      if (p.hp <= 0) this._lose('destroyed');
    },

    _decayCombo(dt) {
      const s = this.state;
      if (s.combo > 1 && s.comboTimer > 0) {
        s.comboTimer -= dt;
        if (s.comboTimer <= 0) s.combo = 1;
      }
    },

    _win() {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'won';
      const stars = 1
        + (s.comboPeak >= (level.starCombo ?? GAME.STAR_COMBO_DEFAULT) ? 1 : 0)
        + (s.player.hp >= s.player.maxHp * GAME.STAR_HP_RATIO ? 1 : 0);
      s.stars = stars;
      s.result = { won: true, stars, score: s.score, kills: s.kills, comboPeak: s.comboPeak, time: s.time };
      emit({ type: 'win', stars, score: s.score });
    },

    _lose(reason) {
      const s = this.state;
      if (s.phase !== 'playing') return;
      s.phase = 'lost';
      s.result = { won: false, stars: 0, score: s.score, kills: s.kills, comboPeak: s.comboPeak, time: s.time, reason };
      emit({ type: 'lose', reason });
    },
  };

  emit({ type: 'levelStart', level: level.index });
  return run;
}

// ------------------------------------------------------------------ 兼容骨架别名
export function createSim() {
  return createRun(0, { seed: 1 });
}
