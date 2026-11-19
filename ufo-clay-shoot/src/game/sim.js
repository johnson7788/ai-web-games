// UFO CLAY SHOOT · 纯逻辑 sim（零 DOM，可被 node --test 与 tools/selfplay.mjs 直接驱动）
// P0 玩法规则 1:1 移植自参考源码（数值见 config/game.config.js 注释），主题换皮 + 新机制：
//   · 连击 combo：连续击落黏土飞碟叠加倍率，漏掉（飞碟逃出底部）或死亡重置
//   · 星级：结算按存活时间评 1–3 星
//   · 三连发道具：拾取后 8s 内一次三发
import {
  WORLD, STEP, PLAYER, LASER, ENEMIES, ASTEROID, COIN, AMMO, POWERUP,
  ENEMY_SPAWN, COMBO, STAR_THRESHOLDS, WAVE_SEC,
} from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function sign(rng) { return rng() < 0.5 ? -1 : 1; }

export function createRun(opts = {}) {
  const seed = (opts.seed == null ? 1 : opts.seed) | 0;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing',            // playing | over
    time: 0,
    wave: 1,
    score: 0,
    combo: 0,
    bestCombo: 0,
    comboTimer: 0,
    kills: 0,
    ammo: PLAYER.AMMO_START,
    hp: PLAYER.MAX_HP,
    coinCount: 0,
    invincible: false,
    invTimer: 0,
    triple: 0,
    alive: true,
    player: { x: WORLD.WIDTH / 2, y: PLAYER.Y_BASE, vx: 0, vy: 0 },
    lasers: [],                  // { x, y, vx, vy }
    enemyLasers: [],             // { x, y, vx, vy }
    enemies: [],                 // { x, y, xSpeed, dir, type, hp, fireTimer, burst, burstCount, burstTimer, canFire }
    asteroids: [],               // { x, y, vx, vy, rot, dir }
    coins: [],                   // { x, y }
    ammoBoxes: [],               // { x, y }
    powerups: [],                // { x, y }
    spawnTimers: {
      enemy: ENEMY_SPAWN.RATE_START,
      asteroid: 0.6,
      coin: 0.4,
      ammo: 3.2,
      powerup: 7.0,
    },
  };

  const events = [];
  const input = { left: false, right: false, up: false, down: false };
  let fireCooldown = 0;

  function enemySpawnInterval() {
    const k = clamp(state.time / ENEMY_SPAWN.RAMP_OVER, 0, 1);
    return ENEMY_SPAWN.RATE_START + (ENEMY_SPAWN.RATE_MIN - ENEMY_SPAWN.RATE_START) * k;
  }

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function randomX(margin = 60) {
    return margin + rng() * (WORLD.WIDTH - margin * 2);
  }

  // ---------- spawn ----------
  function spawnEnemy() {
    const r = rng();
    // 难度递进：第 1 波只出小/中飞碟，第 2 波起引入大飞碟扇形弹幕（新机制逐波解锁）
    let type;
    if (state.wave <= 1) {
      type = r < 0.6 ? 'small' : 'medium';
    } else {
      type = r < 0.42 ? 'small' : r < 0.77 ? 'medium' : 'big';
    }
    const cfg = ENEMIES[type];
    state.enemies.push({
      x: randomX(90),
      y: WORLD.PLAY_TOP + 10,
      xSpeed: 0,
      dir: rng() < 0.5 ? -1 : 1,
      type,
      hp: cfg.hp,
      fireTimer: cfg.FIRE_RATE * (0.5 + rng() * 0.7),
      burst: false,
      burstCount: 0,
      burstTimer: 0,
      canFire: true,
    });
    emit('spawn', { kind: 'enemy', enemy: type });
  }

  function spawnAsteroid() {
    state.asteroids.push({
      x: randomX(70) * 0.77 + WORLD.WIDTH * 0.115,
      y: WORLD.PLAY_TOP - 20,
      vx: (20 + rng() * 20) * sign(rng),
      vy: 50 + rng() * 220,
      rot: rng() * Math.PI * 2,
      dir: rng() < 0.5 ? -1 : 1,
    });
    emit('spawn', { kind: 'asteroid' });
  }

  function spawnCoin() {
    state.coins.push({ x: randomX(50), y: WORLD.PLAY_TOP - 16 });
    emit('spawn', { kind: 'coin' });
  }

  function spawnAmmo() {
    state.ammoBoxes.push({ x: randomX(60), y: WORLD.PLAY_TOP - 16 });
    emit('spawn', { kind: 'ammo' });
  }

  function spawnPowerup() {
    state.powerups.push({ x: randomX(60), y: WORLD.PLAY_TOP - 16 });
    emit('spawn', { kind: 'powerup' });
  }

  // ---------- player ----------
  function movePlayer(dt) {
    const p = state.player;
    if (input.left) p.vx -= PLAYER.X_ACCELERATION * dt;
    else if (input.right) p.vx += PLAYER.X_ACCELERATION * dt;
    if (input.up) p.vy -= PLAYER.Y_ACCELERATION * dt;
    else if (input.down) p.vy += PLAYER.Y_ACCELERATION * dt;
    p.x += p.vx * dt;
    p.vx *= PLAYER.DAMP;
    p.y += p.vy * dt;
    p.vy *= PLAYER.DAMP;
    if (p.x < PLAYER.LEFT_BOUND) { p.x = PLAYER.LEFT_BOUND; p.vx = 0; }
    if (p.x > PLAYER.RIGHT_BOUND) { p.x = PLAYER.RIGHT_BOUND; p.vx = 0; }
    if (p.y < PLAYER.TOP_BOUND) { p.y = PLAYER.TOP_BOUND; p.vy = 0; }
    if (p.y > PLAYER.BOTTOM_BOUND) { p.y = PLAYER.BOTTOM_BOUND; p.vy = 0; }
  }

  function fire() {
    if (state.phase !== 'playing' || !state.alive) return { ok: false };
    if (fireCooldown > 0) return { ok: false };
    if (state.ammo <= 0) { emit('noAmmo'); return { ok: false }; }
    state.ammo -= 1;
    fireCooldown = LASER.COOLDOWN;
    const p = state.player;
    const shots = state.triple > 0 ? 3 : 1;
    const spreads = shots === 1 ? [0] : [-0.18, 0, 0.18];
    for (const s of spreads) {
      state.lasers.push({
        x: p.x,
        y: p.y - PLAYER.HEIGHT * 0.5,
        vx: Math.sin(s) * LASER.SPEED,
        vy: -Math.cos(s) * LASER.SPEED,
      });
    }
    emit('shot');
    return { ok: true };
  }

  function killPlayer() {
    if (!state.alive) return;
    state.alive = false;
    state.phase = 'over';
    state.combo = 0;
    state.comboTimer = 0;
    emit('lose', { time: state.time, score: Math.floor(state.score), wave: state.wave, kills: state.kills });
  }

  function hurtPlayer() {
    if (!state.alive || state.invincible) return;
    state.hp -= 1;
    if (state.hp <= 0) {
      killPlayer();
    } else {
      state.invincible = true;
      state.invTimer = PLAYER.POST_HIT_GRACE;
      emit('hurt', { hp: state.hp });
    }
  }

  // ---------- enemies ----------
  function fireEnemyLaser(e, xOffset, angleDeg) {
    const dx = state.player.x - e.x;
    const dy = state.player.y - e.y;
    const base = Math.atan2(dy, dx);
    const cfg = ENEMIES[e.type];
    const ang = base + (angleDeg || 0) * Math.PI / 180;
    state.enemyLasers.push({
      x: e.x + xOffset,
      y: e.y + cfg.h * 0.5,
      vx: Math.cos(ang) * cfg.LASER_SPEED,
      vy: Math.sin(ang) * cfg.LASER_SPEED,
    });
  }

  function updateEnemies(dt) {
    const halfW = WORLD.WIDTH / 2;
    const lo = halfW - 0.65 * halfW;
    const hi = halfW + 0.65 * halfW;
    for (const e of state.enemies) {
      const cfg = ENEMIES[e.type];
      if (e.x <= lo) e.dir = 1;
      else if (e.x >= hi) e.dir = -1;
      e.xSpeed += e.dir * cfg.X_ACCELERATION * dt;
      e.xSpeed *= 0.95;
      e.x += e.xSpeed * dt;
      e.y -= cfg.Y_SPEED * dt; // Y_SPEED 为负 → y 增加（下移）

      if (e.y > PLAYER.Y_BASE) e.canFire = false;

      if (e.canFire) {
        e.fireTimer -= dt;
        if (e.fireTimer <= 0) {
          e.fireTimer = cfg.FIRE_RATE;
          if (cfg.FAN_BULLETS) {
            for (let i = 0; i < cfg.FAN_BULLETS; i += 1) {
              fireEnemyLaser(e, cfg.FAN_OFFSET + i * 10, cfg.FAN_OFFSET + i * cfg.FAN_SPREAD);
            }
          } else {
            e.burst = true; e.burstCount = 0; e.burstTimer = 0;
          }
        }
        if (e.burst) {
          e.burstTimer += dt;
          if (e.burstTimer >= cfg.LASER_INTERVAL && e.burstCount < cfg.BULLET_BURST) {
            e.burstTimer = 0; e.burstCount += 1;
            if (e.type === 'medium') {
              fireEnemyLaser(e, -5, 0);
              fireEnemyLaser(e, 5, 0);
            } else {
              fireEnemyLaser(e, 0, 0);
            }
          } else if (e.burstCount >= cfg.BULLET_BURST) {
            e.burst = false;
          }
        }
      }
    }
  }

  function destroyEnemy(e) {
    e.hp -= 1;
    if (e.hp <= 0) {
      const idx = state.enemies.indexOf(e);
      if (idx >= 0) state.enemies.splice(idx, 1);
      state.combo += 1;
      state.bestCombo = Math.max(state.bestCombo, state.combo);
      state.comboTimer = COMBO.WINDOW;
      const cfg = ENEMIES[e.type];
      const mult = 1 + 0.2 * Math.min(state.combo - 1, COMBO.MAX_BONUS);
      state.score += cfg.score * mult;
      state.kills += 1;
      emit('kill', { kind: 'enemy', enemy: e.type, combo: state.combo, x: e.x, y: e.y });
    } else {
      emit('hit', { kind: 'enemy', enemy: e.type });
    }
  }

  // ---------- asteroids / pickups ----------
  function updateAsteroids(dt) {
    for (const a of state.asteroids) {
      a.rot += ASTEROID.ROT_SPEED * dt * a.dir;
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      const left = ASTEROID.R;
      const right = WORLD.WIDTH - ASTEROID.R;
      if (a.x <= left) { a.x = left; a.vx = Math.abs(a.vx); }
      else if (a.x >= right) { a.x = right; a.vx = -Math.abs(a.vx); }
    }
  }

  function updatePickups(dt) {
    const p = state.player;
    for (const c of state.coins) {
      c.y += COIN.SPEED * dt;
      if (Math.abs(c.x - p.x) < PLAYER.WIDTH * 0.5 + COIN.R && Math.abs(c.y - p.y) < PLAYER.HEIGHT * 0.5 + COIN.R) {
        collectCoin(c);
      }
    }
    for (const b of state.ammoBoxes) {
      b.y += AMMO.SPEED * dt;
      if (Math.abs(b.x - p.x) < PLAYER.WIDTH * 0.5 + AMMO.R && Math.abs(b.y - p.y) < PLAYER.HEIGHT * 0.5 + AMMO.R) {
        collectAmmo(b);
      }
    }
    for (const w of state.powerups) {
      w.y += POWERUP.SPEED * dt;
      if (Math.abs(w.x - p.x) < PLAYER.WIDTH * 0.5 + POWERUP.R && Math.abs(w.y - p.y) < PLAYER.HEIGHT * 0.5 + POWERUP.R) {
        collectPower(w);
      }
    }
  }

  function collectCoin(c) {
    const i = state.coins.indexOf(c);
    if (i >= 0) state.coins.splice(i, 1);
    state.coinCount += 1;
    state.score += COIN.score;
    emit('pickupCoin', { coins: state.coinCount });
    if (state.coinCount >= COIN.INVINCIBLE_AT) {
      state.coinCount = 0;
      state.invincible = true;
      state.invTimer = COIN.INVINCIBLE_DURATION;
      emit('invincible');
    }
  }

  function collectAmmo(b) {
    const i = state.ammoBoxes.indexOf(b);
    if (i >= 0) state.ammoBoxes.splice(i, 1);
    state.ammo += AMMO.PER_BOX;
    emit('pickupAmmo', { ammo: state.ammo });
  }

  function collectPower(w) {
    const i = state.powerups.indexOf(w);
    if (i >= 0) state.powerups.splice(i, 1);
    state.triple = POWERUP.DURATION;
    emit('pickupPower', { triple: state.triple });
  }

  // ---------- lasers ----------
  function updateLasers(dt) {
    for (const l of state.lasers) {
      l.x += l.vx * dt;
      l.y += l.vy * dt;
    }
  }

  function updateEnemyLasers(dt) {
    for (const l of state.enemyLasers) {
      l.x += l.vx * dt;
      l.y += l.vy * dt;
    }
  }

  // ---------- collision ----------
  function overlap(x1, y1, w1, h1, x2, y2, w2, h2) {
    return Math.abs(x1 - x2) < (w1 + w2) / 2 && Math.abs(y1 - y2) < (h1 + h2) / 2;
  }
  function circleRect(cx, cy, r, rx, ry, rw, rh) {
    const dx = Math.abs(cx - rx);
    const dy = Math.abs(cy - ry);
    if (dx > rw / 2 + r || dy > rh / 2 + r) return false;
    if (dx <= rw / 2 || dy <= rh / 2) return true;
    const d = (dx - rw / 2) ** 2 + (dy - rh / 2) ** 2;
    return d <= r * r;
  }

  function resolveCollisions() {
    const p = state.player;

    // player laser vs enemies
    for (let li = state.lasers.length - 1; li >= 0; li -= 1) {
      const l = state.lasers[li];
      let used = false;
      for (const e of state.enemies) {
        const cfg = ENEMIES[e.type];
        if (overlap(l.x, l.y, LASER.W, LASER.H, e.x, e.y, cfg.w, cfg.h)) {
          destroyEnemy(e);
          used = true;
          break;
        }
      }
      if (used) { state.lasers.splice(li, 1); continue; }
      for (const a of state.asteroids) {
        if (circleRect(a.x, a.y, ASTEROID.R, l.x, l.y, LASER.W, LASER.H)) {
          const ai = state.asteroids.indexOf(a);
          if (ai >= 0) state.asteroids.splice(ai, 1);
          state.score += ASTEROID.score;
          state.kills += 1;
          emit('kill', { kind: 'asteroid', x: a.x, y: a.y });
          used = true;
          break;
        }
      }
      if (used) state.lasers.splice(li, 1);
    }

    if (!state.alive) return;

    // enemy laser vs player
    for (let li = state.enemyLasers.length - 1; li >= 0; li -= 1) {
      const l = state.enemyLasers[li];
      if (overlap(l.x, l.y, 8, 14, p.x, p.y, PLAYER.WIDTH, PLAYER.HEIGHT)) {
        state.enemyLasers.splice(li, 1);
        if (!state.invincible) { hurtPlayer(); if (!state.alive) return; }
      }
    }

    // enemy body vs player
    for (let ei = state.enemies.length - 1; ei >= 0; ei -= 1) {
      const e = state.enemies[ei];
      const cfg = ENEMIES[e.type];
      if (overlap(p.x, p.y, PLAYER.WIDTH, PLAYER.HEIGHT, e.x, e.y, cfg.w, cfg.h)) {
        if (state.invincible) {
          state.enemies.splice(ei, 1);
          state.kills += 1;
          state.combo += 1;
          state.comboTimer = COMBO.WINDOW;
          state.score += cfg.score;
          emit('kill', { kind: 'enemy', enemy: e.type, combo: state.combo, x: e.x, y: e.y });
        } else {
          hurtPlayer();
          if (!state.alive) return;
        }
      }
    }

    // asteroid body vs player
    for (let ai = state.asteroids.length - 1; ai >= 0; ai -= 1) {
      const a = state.asteroids[ai];
      if (circleRect(a.x, a.y, ASTEROID.R, p.x, p.y, PLAYER.WIDTH, PLAYER.HEIGHT)) {
        if (state.invincible) {
          state.asteroids.splice(ai, 1);
          state.score += ASTEROID.score;
          state.kills += 1;
          emit('kill', { kind: 'asteroid', x: a.x, y: a.y });
        } else {
          hurtPlayer();
          if (!state.alive) return;
        }
      }
    }
  }

  // ---------- cleanup / wave ----------
  function cleanup() {
    state.lasers = state.lasers.filter((l) => l.y > -60 && l.x > -60 && l.x < WORLD.WIDTH + 60);
    state.enemyLasers = state.enemyLasers.filter((l) =>
      l.y > -60 && l.y < WORLD.HEIGHT + 60 && l.x > -60 && l.x < WORLD.WIDTH + 60);
    for (let i = state.enemies.length - 1; i >= 0; i -= 1) {
      const e = state.enemies[i];
      if (e.y > WORLD.HEIGHT + 60) {
        state.enemies.splice(i, 1);
        state.combo = 0;
        state.comboTimer = 0;
        emit('escape');
      }
    }
    state.asteroids = state.asteroids.filter((a) => a.y < WORLD.HEIGHT + 60);
    state.coins = state.coins.filter((c) => c.y < WORLD.HEIGHT + 40);
    state.ammoBoxes = state.ammoBoxes.filter((b) => b.y < WORLD.HEIGHT + 40);
    state.powerups = state.powerups.filter((w) => w.y < WORLD.HEIGHT + 40);
  }

  function updateSpawns(dt) {
    const t = state.spawnTimers;
    t.enemy -= dt;
    if (t.enemy <= 0) { spawnEnemy(); t.enemy = enemySpawnInterval(); }
    t.asteroid -= dt;
    if (t.asteroid <= 0) { spawnAsteroid(); t.asteroid = ASTEROID.SPAWN_RATE; }
    t.coin -= dt;
    if (t.coin <= 0) { spawnCoin(); t.coin = COIN.SPAWN_RATE; }
    t.ammo -= dt;
    if (t.ammo <= 0) { spawnAmmo(); t.ammo = AMMO.SPAWN_RATE; }
    t.powerup -= dt;
    if (t.powerup <= 0) { spawnPowerup(); t.powerup = POWERUP.SPAWN_RATE; }
  }

  function step(dt) {
    if (state.phase !== 'playing') return;
    state.time += dt;
    fireCooldown = Math.max(0, fireCooldown - dt);
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer <= 0) state.combo = 0;
    if (state.triple > 0) state.triple = Math.max(0, state.triple - dt);
    if (state.invincible) {
      state.invTimer -= dt;
      if (state.invTimer <= 0) { state.invincible = false; emit('invincibleEnd'); }
    }

    movePlayer(dt);
    updateSpawns(dt);
    updateEnemies(dt);
    updateAsteroids(dt);
    updatePickups(dt);
    updateLasers(dt);
    updateEnemyLasers(dt);
    resolveCollisions();
    cleanup();

    state.score += 5 * dt; // 存活时间分
    state.wave = Math.floor(state.time / WAVE_SEC) + 1;
  }

  function stars() {
    let s = 0;
    for (let i = 0; i < STAR_THRESHOLDS.length; i += 1) {
      if (state.time >= STAR_THRESHOLDS[i]) s = i;
    }
    return s;
  }

  return {
    state,
    input,
    rng,
    step,
    fire,
    drainEvents() { return events.splice(0); },
    stars,
  };
}

export { STEP };
