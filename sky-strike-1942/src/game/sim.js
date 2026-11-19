// SKY STRIKE 1942 · 纯逻辑仿真（无 DOM，Node 可测）
// 玩法：拖拽驾驶战机 → 机炮自动开火 → 击落敌机攒 combo → 躲岩石/敌弹 → 拾取道具 → 三星结算。
// 波次：3 关连续推进（act1→act2→act3），生命共享，生命归零即失败。
import { ENEMY_TYPES, LEVELS } from '../../config/levels.js';

export const WORLD = { WIDTH: 1280, HEIGHT: 720 };
export const STEP = 1 / 60;

const HERO = { w: 46, h: 54, speed: 460, fireInterval: 0.16, lives: 3, invuln: 1.4 };
const HERO_Y_MIN = 300;
const HERO_Y_MAX = WORLD.HEIGHT - 110;
const BULLET_SPEED = 760;
const ENEMY_BULLET_SPEED = 300;
const ROCK_HP = 4;
const ROCK_FALL = 122;
const COMBO_WINDOW = 2.6;
const POWER_FALL = 92;
const MAX_PARTICLES = 220;

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const overlap = (a, b) =>
  Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;

function computeStars(score) {
  return score >= 1200 ? 3 : score >= 600 ? 2 : 1;
}

function heroHitbox(hero) {
  return { x: hero.x, y: hero.y, w: HERO.w * 0.62, h: HERO.h * 0.72 };
}

export function createRun(levelIndex = 0, opts = {}) {
  const seed = opts.seed == null ? 1 : opts.seed;
  const rng = mulberry32(seed);
  const idx = clamp(levelIndex | 0, 0, LEVELS.length - 1);
  const level = LEVELS[idx];

  const state = {
    levelIndex: idx,
    level: idx + 1,
    phase: 'playing', // playing | won | lost
    score: 0,
    combo: 0,
    comboTimer: 0,
    lives: HERO.lives,
    kills: 0,
    killTarget: level.killTarget,
    elapsed: 0,
    spawnTimer: 0.7,
    rockTimer: level.rockInterval || 999,
    invuln: 0,
    spread: 0,
    shield: false,
    shake: 0,
    stars: 0,
    hero: { x: WORLD.WIDTH / 2, y: HERO_Y_MAX, targetX: WORLD.WIDTH / 2, targetY: HERO_Y_MAX },
    bullets: [],
    enemyBullets: [],
    enemies: [],
    rocks: [],
    powerups: [],
    particles: [],
    eventQueue: [],
  };

  const emit = (type, payload = {}) => state.eventQueue.push({ type, ...payload });

  function currentLevel() {
    return LEVELS[state.levelIndex] || LEVELS[LEVELS.length - 1];
  }

  function burst(x, y, color, n, speed = 160) {
    for (let i = 0; i < n; i += 1) {
      if (state.particles.length >= MAX_PARTICLES) break;
      const a = rng() * Math.PI * 2;
      const s = speed * (0.4 + rng() * 0.8);
      state.particles.push({
        x, y,
        vx: Math.cos(a) * s,
        vy: Math.sin(a) * s,
        life: 0.35 + rng() * 0.35,
        maxLife: 0.7,
        color,
        size: 2 + rng() * 3,
      });
    }
  }

  function fireBullet() {
    const h = state.hero;
    const n = state.spread > 0 ? 3 : 1;
    const offsets = n === 1 ? [0] : [-14, 0, 14];
    for (const ox of offsets) {
      state.bullets.push({ x: h.x + ox, y: h.y - HERO.h / 2 - 6, w: 6, h: 16, vy: -BULLET_SPEED, vx: ox !== 0 ? ox * 6 : 0 });
    }
    emit('shot');
  }

  function spawnEnemy(type) {
    const def = ENEMY_TYPES[type];
    const x = clamp(60 + rng() * (WORLD.WIDTH - 120), 40, WORLD.WIDTH - 40);
    const enemy = {
      type,
      x,
      y: 60,
      w: def.w,
      h: def.h,
      hp: def.hp,
      maxHp: def.hp,
      speed: def.speed * (0.85 + rng() * 0.3),
      score: def.score,
      vx: (rng() < 0.5 ? -1 : 1) * (45 + rng() * 45),
      phase: rng() * Math.PI * 2,
      spawnX: x,
      fireTimer: 1.4 + rng() * 1.2,
    };
    state.enemies.push(enemy);
    emit('spawn', { kind: type });
    return enemy;
  }

  function spawnRock() {
    const size = 44 + rng() * 18;
    const rock = {
      x: 50 + rng() * (WORLD.WIDTH - 100),
      y: 60,
      w: size,
      h: size,
      hp: ROCK_HP,
      maxHp: ROCK_HP,
      rot: rng() * Math.PI * 2,
      spin: (rng() < 0.5 ? -1 : 1) * (0.6 + rng() * 1.2),
    };
    state.rocks.push(rock);
    emit('rock', {});
  }

  function spawnPowerup(x, y) {
    const roll = rng();
    const type = roll < 0.4 ? 'spread' : roll < 0.72 ? 'shield' : 'bomb';
    state.powerups.push({ type, x, y, w: 34, h: 34 });
    emit('powerupSpawn', { kind: type });
  }

  function destroyEnemy(enemy, byBomb = false) {
    const idx = state.enemies.indexOf(enemy);
    if (idx >= 0) state.enemies.splice(idx, 1);
    state.combo += 1;
    state.comboTimer = COMBO_WINDOW;
    const def = ENEMY_TYPES[enemy.type];
    const gain = Math.round(def.score * (1 + 0.25 * (state.combo - 1)));
    state.score += byBomb ? Math.round(def.score * 0.5) : gain;
    state.kills += 1;
    burst(enemy.x, enemy.y, def.color, byBomb ? 14 : 10);
    emit('kill', { kind: enemy.type, combo: state.combo, score: state.score });
    if (state.combo % 5 === 0) emit('combo', { combo: state.combo });
    if (!byBomb && rng() < currentLevel().powerDrop) spawnPowerup(enemy.x, enemy.y);
  }

  function destroyRock(rock, byBomb = false) {
    const idx = state.rocks.indexOf(rock);
    if (idx >= 0) state.rocks.splice(idx, 1);
    if (!byBomb) state.score += 20;
    burst(rock.x, rock.y, '#b9f6ff', 12, 120);
    emit('rockBreak', { score: state.score });
  }

  function heroHit() {
    if (state.invuln > 0) return;
    if (state.shield) {
      state.shield = false;
      state.invuln = HERO.invuln;
      state.shake = 6;
      burst(state.hero.x, state.hero.y, '#7dffb8', 16, 130);
      emit('shieldBreak');
      return;
    }
    state.lives -= 1;
    state.combo = 0;
    state.comboTimer = 0;
    state.invuln = HERO.invuln;
    state.shake = 9;
    burst(state.hero.x, state.hero.y, '#ff6a4e', 20, 170);
    emit('playerHit', { lives: state.lives });
    if (state.lives <= 0) {
      state.phase = 'lost';
      state.stars = 0;
      emit('lose', { score: state.score });
    }
  }

  function applyPowerup(p) {
    const idx = state.powerups.indexOf(p);
    if (idx >= 0) state.powerups.splice(idx, 1);
    if (p.type === 'spread') {
      state.spread = 8;
      emit('powerup', { kind: 'spread' });
    } else if (p.type === 'shield') {
      state.shield = true;
      emit('powerup', { kind: 'shield' });
    } else if (p.type === 'bomb') {
      const enemies = [...state.enemies];
      for (const e of enemies) destroyEnemy(e, true);
      const rocks = [...state.rocks];
      for (const r of rocks) destroyRock(r, true);
      state.enemyBullets.length = 0;
      state.shake = 14;
      burst(state.hero.x, state.hero.y, '#ffe14b', 40, 320);
      emit('powerup', { kind: 'bomb' });
    }
  }

  function advanceLevel() {
    if (state.levelIndex >= LEVELS.length - 1) {
      state.phase = 'won';
      state.stars = computeStars(state.score);
      emit('win', { score: state.score, stars: state.stars });
      return;
    }
    state.levelIndex += 1;
    state.level = state.levelIndex + 1;
    state.kills = 0;
    state.killTarget = currentLevel().killTarget;
    state.rockTimer = currentLevel().rockInterval || 999;
    state.shake = 6;
    emit('levelUp', { level: state.level });
  }

  // ---------- 逐步推进 ----------
  function step(dt) {
    if (state.phase !== 'playing') return;
    dt = Math.min(0.1, dt);
    state.elapsed += dt;

    // 计时器
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) state.combo = 0;
    }
    if (state.invuln > 0) state.invuln -= dt;
    if (state.spread > 0) state.spread -= dt;
    if (state.shake > 0) state.shake = Math.max(0, state.shake - dt * 30);

    // 英雄移动
    const h = state.hero;
    const dx = h.targetX - h.x;
    const dy = h.targetY - h.y;
    const d = Math.hypot(dx, dy);
    if (d > 2) {
      const mv = Math.min(d, HERO.speed * dt);
      h.x += (dx / d) * mv;
      h.y += (dy / d) * mv;
    }

    // 自动开火
    state._fireCd = (state._fireCd || 0) - dt;
    if (state._fireCd <= 0) {
      fireBullet();
      state._fireCd = HERO.fireInterval;
    }

    // 玩家子弹
    for (const b of state.bullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    state.bullets = state.bullets.filter((b) => b.y > -40 && b.x > -20 && b.x < WORLD.WIDTH + 20);

    // 敌机生成
    state.spawnTimer -= dt;
    const lv = currentLevel();
    if (state.spawnTimer <= 0 && state.enemies.length < lv.maxEnemies) {
      const types = lv.types;
      spawnEnemy(types[Math.floor(rng() * types.length)]);
      state.spawnTimer = lv.spawnInterval * (0.8 + rng() * 0.4);
    }

    // 敌机移动 + 敌弹
    for (const e of state.enemies) {
      const def = ENEMY_TYPES[e.type];
      if (e.type === 1) {
        e.y += e.speed * dt;
      } else if (e.type === 2) {
        e.y += e.speed * dt;
        e.x += e.vx * dt;
      } else if (e.type === 3) {
        e.y += e.speed * dt;
        e.x = e.spawnX + Math.sin(state.elapsed * 3.5 + e.phase) * 130;
      } else if (e.type === 4) {
        e.y += e.speed * dt;
        e.x += Math.sin(state.elapsed * 2.2 + e.phase) * 26 * dt * 3;
        if (lv.enemyFire) {
          e.fireTimer -= dt;
          if (e.fireTimer <= 0) {
            const aim = clamp((h.x - e.x) / Math.max(40, WORLD.HEIGHT - e.y), -0.5, 0.5);
            state.enemyBullets.push({ x: e.x, y: e.y + def.h / 2, w: 7, h: 14, vx: aim * ENEMY_BULLET_SPEED * 0.5, vy: ENEMY_BULLET_SPEED });
            e.fireTimer = 1.7 + rng() * 1.2;
            emit('enemyShot');
          }
        }
      } else if (e.type === 5) {
        e.y += e.speed * dt;
        e.x += clamp(h.x - e.x, -1, 1) * 2.4 * dt * 80;
      }
      e.x = clamp(e.x, 22, WORLD.WIDTH - 22);
    }
    state.enemies = state.enemies.filter((e) => e.y < WORLD.HEIGHT + 70);

    // 岩石生成与移动
    if (lv.rocks) {
      state.rockTimer -= dt;
      if (state.rockTimer <= 0 && state.rocks.length < lv.maxRocks) {
        spawnRock();
        state.rockTimer = lv.rockInterval * (0.85 + rng() * 0.3);
      }
    }
    for (const r of state.rocks) {
      r.y += ROCK_FALL * dt;
      r.rot += r.spin * dt;
    }
    state.rocks = state.rocks.filter((r) => r.y < WORLD.HEIGHT + 70);

    // 敌弹移动
    for (const b of state.enemyBullets) {
      b.x += b.vx * dt;
      b.y += b.vy * dt;
    }
    state.enemyBullets = state.enemyBullets.filter((b) => b.y < WORLD.HEIGHT + 40 && b.y > -40 && b.x > -20 && b.x < WORLD.WIDTH + 20);

    // 道具移动
    for (const p of state.powerups) p.y += POWER_FALL * dt;
    state.powerups = state.powerups.filter((p) => p.y < WORLD.HEIGHT + 40);

    // 玩家子弹命中
    const hb = heroHitbox(h);
    for (const b of state.bullets) {
      if (b.dead) continue;
      for (const e of state.enemies) {
        if (overlap(b, e)) {
          b.dead = true;
          e.hp -= 1;
          burst(b.x, b.y, '#cfefff', 4, 90);
          emit('hit', { kind: e.type });
          if (e.hp <= 0) destroyEnemy(e);
          break;
        }
      }
      if (!b.dead) {
        for (const r of state.rocks) {
          if (overlap(b, r)) {
            b.dead = true;
            r.hp -= 1;
            burst(b.x, b.y, '#b9f6ff', 3, 80);
            if (r.hp <= 0) destroyRock(r);
            break;
          }
        }
      }
    }
    state.bullets = state.bullets.filter((b) => !b.dead);

    // 敌机/敌弹/岩石命中英雄
    for (const e of state.enemies) {
      if (overlap(hb, e)) {
        destroyEnemy(e, true);
        heroHit();
        break;
      }
    }
    if (state.phase === 'playing') {
      for (const b of state.enemyBullets) {
        if (overlap(hb, b)) {
          b.dead = true;
          heroHit();
          break;
        }
      }
      state.enemyBullets = state.enemyBullets.filter((b) => !b.dead);
    }
    if (state.phase === 'playing') {
      for (const r of state.rocks) {
        if (overlap(hb, r)) {
          destroyRock(r);
          heroHit();
          break;
        }
      }
    }

    // 道具拾取
    for (const p of state.powerups) {
      if (overlap(heroHitbox(h), p)) {
        applyPowerup(p);
        break;
      }
    }

    // 波次推进
    if (state.phase === 'playing' && state.kills >= state.killTarget) {
      advanceLevel();
    }

    // 粒子衰减
    for (const pt of state.particles) {
      pt.life -= dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
    state.particles = state.particles.filter((pt) => pt.life > 0);
  }

  const run = {
    state,
    step,
    setTarget(x, y) {
      if (state.phase !== 'playing') return { ok: false };
      state.hero.targetX = clamp(x, HERO.w / 2, WORLD.WIDTH - HERO.w / 2);
      state.hero.targetY = clamp(y, HERO_Y_MIN, HERO_Y_MAX);
      return { ok: true };
    },
    drainEvents() {
      const e = state.eventQueue;
      state.eventQueue = [];
      return e;
    },
    getHud() {
      return {
        score: state.score,
        combo: state.combo,
        lives: state.lives,
        level: state.level,
        kills: state.kills,
        killTarget: state.killTarget,
        time: state.elapsed,
        stars: state.stars,
        spread: state.spread,
        shield: state.shield,
      };
    },
    // 调试辅助（截图/验收）
    _spawnEnemy: spawnEnemy,
    _spawnRock: spawnRock,
    _spawnPowerup: spawnPowerup,
  };

  return run;
}
