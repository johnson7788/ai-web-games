// ASSAULT DUO 3D · 纯逻辑 sim（无 DOM / 无音频 / 无渲染，可被 node --test 与 selfplay 直接驱动）
// 玩法：横版双人突击。玩家 NOVA（手动移动/跳跃/开火/切枪/合体爆破）+ AI 搭档 JET（自动索敌开火）。
// 敌人从右侧成波来袭；清空一波波的敌人 → 过关；玩家 HP 归零 → 失败。
import {
  WORLD, PLAYER, COMPANION, WEAPONS, ENEMY_TYPES, LEVELS,
  COMBO, DUO, PICKUP,
} from '../../config/game.config.js';

const STEP = 1 / 60;

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dist(ax, ay, bx, by) {
  return Math.hypot(ax - bx, ay - by);
}

export function totalEnemiesOf(level) {
  return level.waves.reduce((n, w) => n + w.enemies.length, 0);
}

export function createRun(levelIndex = 0, opts = {}) {
  const seed = opts.seed ?? ((Math.random() * 1e9) | 0);
  const rng = mulberry32(seed);
  const level = LEVELS[Math.max(0, Math.min(LEVELS.length - 1, levelIndex))];

  const state = {
    phase: 'playing', // playing | won | lost
    levelIndex: level.index - 1,
    level,
    t: 0,
    score: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    comboLevel: 0,
    duoMeter: 0,
    duoReady: false,
    kills: 0,
    totalEnemies: totalEnemiesOf(level),
    remaining: totalEnemiesOf(level),
    player: {
      x: 130,
      y: WORLD.GROUND_Y - PLAYER.HEIGHT,
      vx: 0,
      vy: 0,
      onGround: true,
      airJumps: 0,
      hp: PLAYER.MAX_HP,
      maxHp: PLAYER.MAX_HP,
      weapon: 0,
      fireCd: 0,
      invuln: 0,
      facing: 1,
      wasAirborne: false,
      lastFireAt: -1,
    },
    companion: { x: 130 + COMPANION.OFFSET_X, y: WORLD.GROUND_Y - PLAYER.HEIGHT + COMPANION.HOVER_Y, cd: 0 },
    enemies: [],
    bullets: [],
    enemyBullets: [],
    pickups: [],
    fx: [],
    wave: 0,
    spawnList: [],
  };

  // 拍平波次为按时间排序的生成队列
  for (const w of level.waves) {
    state.spawnList.push({
      t: w.t,
      x: w.x,
      done: false,
      types: w.enemies.slice(),
    });
  }
  state.spawnList.sort((a, b) => a.t - b.t);

  const input = {
    left: false,
    right: false,
    jump: false, // 边沿触发（main 置位，step 消费后清除）
    fire: false,
    switchWeapon: false,
    blast: false,
  };

  const run = {
    state,
    input,
    rng,
    seed,
    events: [],

    _emit(type, payload = {}) {
      this.events.push({ type, ...payload });
    },

    step(dt = STEP) {
      update(run, dt);
    },

    drainEvents() {
      const e = this.events;
      this.events = [];
      return e;
    },

    setInput(p) {
      Object.assign(input, p);
      return { ok: true };
    },

    switchWeapon() {
      const p = state.player;
      p.weapon = (p.weapon + 1) % WEAPONS.length;
      this._emit('weapon', { weapon: p.weapon });
      return { ok: true };
    },

    triggerBlast() {
      if (state.phase !== 'playing' || !state.duoReady) return { ok: false };
      state.duoReady = false;
      state.duoMeter = 0;
      const p = state.player;
      this._emit('duo', { x: p.x, y: p.y });
      state.fx.push({ type: 'blast', x: p.x, y: p.y, life: 0.5, maxLife: 0.5, radius: DUO.BLAST_RADIUS });
      damageRadius(run, p.x, p.y, DUO.BLAST_RADIUS, DUO.BLAST_DAMAGE, 'player');
      return { ok: true };
    },

    getHud() {
      const p = state.player;
      return {
        phase: state.phase,
        level: state.levelIndex + 1,
        score: state.score,
        combo: state.combo,
        comboLevel: state.comboLevel,
        duoMeter: state.duoMeter,
        duoReady: state.duoReady,
        hp: p.hp,
        maxHp: p.maxHp,
        remaining: state.remaining,
        total: state.totalEnemies,
        weapon: p.weapon,
        wave: state.wave,
        kills: state.kills,
      };
    },
  };

  return run;
}

// ---------- 内部更新 ----------

function clamp(v, a, b) {
  return v < a ? a : v > b ? b : v;
}

function nearestEnemy(state, fromX, fromY, maxRange) {
  let best = null;
  let bestD = maxRange;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(fromX, fromY, e.x, e.y);
    if (d <= bestD) { bestD = d; best = e; }
  }
  return best;
}

function spawnWave(run, w) {
  if (w.done) return;
  w.done = true;
  run.state.wave += 1;
  run._emit('wave', { wave: run.state.wave, count: w.types.length });
  let i = 0;
  for (const typeKey of w.types) {
    const t = ENEMY_TYPES[typeKey];
    if (!t) continue;
    const y = WORLD.GROUND_Y - 26;
    run.state.enemies.push({
      type: typeKey,
      x: clamp(w.x + i * 30 + (run.rng() * 20 - 10), WORLD.LEFT_WALL + 40, WORLD.RIGHT_WALL - 40),
      y,
      hp: t.hp,
      maxHp: t.hp,
      attack: t.attack,
      speed: t.speed,
      meleeRange: t.meleeRange,
      attackCd: t.attackCd,
      attackTimer: run.rng() * 0.4,
      ranged: t.ranged,
      range: t.range,
      bulletSpeed: t.bulletSpeed,
      radius: t.radius,
      score: t.score,
      shield: t.shield,
      boss: t.boss,
      hitFlash: 0,
    });
    i += 1;
  }
}

function updateRemaining(state) {
  const pending = state.spawnList.reduce((n, w) => n + (w.done ? 0 : w.types.length), 0);
  state.remaining = state.enemies.filter((e) => e.hp > 0).length + pending;
}

function damageEnemy(run, enemy, amount, from) {
  if (enemy.hp <= 0) return;
  const comboMult = 1 + run.state.comboLevel * COMBO.DAMAGE_BONUS;
  const dmg = Math.round(amount * comboMult);
  enemy.hp -= dmg;
  enemy.hitFlash = 0.08;
  run._emit('hit', { x: enemy.x, y: enemy.y, dmg });
  run.state.fx.push({ type: 'spark', x: enemy.x, y: enemy.y, life: 0.25, maxLife: 0.25 });
  if (enemy.hp <= 0) {
    killEnemy(run, enemy, from);
  }
}

function killEnemy(run, enemy, from) {
  enemy.hp = 0;
  const s = run.state;
  s.kills += 1;
  s.combo += 1;
  s.comboTimer = COMBO.WINDOW;
  if (s.combo > s.bestCombo) s.bestCombo = s.combo;
  if (s.combo % COMBO.STEP === 0 && s.comboLevel < Math.floor(COMBO.MAX / COMBO.STEP)) {
    s.comboLevel += 1;
    run._emit('combo', { combo: s.comboLevel });
  }
  const gained = Math.round(enemy.score * (1 + s.comboLevel * 0.5));
  s.score += gained;
  s.duoMeter = Math.min(DUO.METER_MAX, s.duoMeter + DUO.KILL_GAIN);
  if (s.duoMeter >= DUO.METER_MAX) s.duoReady = true;
  run._emit('kill', { x: enemy.x, y: enemy.y, enemyType: enemy.type, score: gained });
  run.state.fx.push({ type: 'explode', x: enemy.x, y: enemy.y, life: 0.35, maxLife: 0.35, radius: enemy.radius + 14 });
  // 掉落能量球
  if (run.rng() < PICKUP.DROP_CHANCE) {
    run.state.pickups.push({ x: enemy.x, y: enemy.y - 30, life: PICKUP.LIFETIME });
  }
}

function damageRadius(run, cx, cy, radius, amount, from) {
  for (const e of run.state.enemies) {
    if (e.hp <= 0) continue;
    if (dist(cx, cy, e.x, e.y) <= radius + e.radius) {
      damageEnemy(run, e, amount, from);
    }
  }
}

function firePlayerBullet(run, aim) {
  const p = run.state.player;
  const w = WEAPONS[p.weapon];
  const muzzleX = p.x + p.facing * (PLAYER.WIDTH / 2 + 4);
  const muzzleY = p.y + 18;
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    let ang = aim;
    if (pellets > 1) {
      const off = (i - (pellets - 1) / 2) * w.spread;
      ang += off;
    }
    run.state.bullets.push({
      x: muzzleX,
      y: muzzleY,
      vx: Math.cos(ang) * w.speed,
      vy: Math.sin(ang) * w.speed,
      speed: w.speed,
      damage: w.damage,
      pierce: w.pierce,
      radius: w.radius || 0,
      range: w.range,
      from: 'player',
      weapon: w.id,
    });
  }
  p.fireCd = w.cooldown;
  p.lastFireAt = run.state.t;
  run._emit('shoot', { x: muzzleX, y: muzzleY, weapon: w.id });
  run.state.fx.push({ type: 'muzzle', x: muzzleX, y: muzzleY, life: 0.08, maxLife: 0.08 });
}

function fireCompanionBullet(run, target) {
  const c = run.state.companion;
  const ang = Math.atan2(target.y - c.y, target.x - c.x);
  const mx = c.x + 14;
  const my = c.y;
  run.state.bullets.push({
    x: mx,
    y: my,
    vx: Math.cos(ang) * COMPANION.BULLET_SPEED,
    vy: Math.sin(ang) * COMPANION.BULLET_SPEED,
    speed: COMPANION.BULLET_SPEED,
    damage: COMPANION.DAMAGE,
    pierce: 0,
    radius: 0,
    range: COMPANION.RANGE,
    from: 'player',
    weapon: -1,
  });
  c.cd = COMPANION.COOLDOWN;
  run._emit('shoot', { x: mx, y: my, weapon: -1 });
}

function fireEnemyBullet(run, e) {
  const p = run.state.player;
  const ang = Math.atan2(p.y - e.y, p.x - e.x);
  run.state.enemyBullets.push({
    x: e.x,
    y: e.y - 6,
    vx: Math.cos(ang) * e.bulletSpeed,
    vy: Math.sin(ang) * e.bulletSpeed,
    speed: e.bulletSpeed,
    damage: e.attack,
    range: e.range + 220,
  });
  run._emit('enemyShoot', { x: e.x, y: e.y });
}

function updatePlayer(run, dt) {
  const p = run.state.player;
  const inp = run.input;

  // 水平移动
  if (inp.left && !inp.right) {
    p.vx = -PLAYER.SPEED;
    p.facing = -1;
  } else if (inp.right && !inp.left) {
    p.vx = PLAYER.SPEED;
    p.facing = 1;
  } else {
    p.vx = 0;
  }

  // 二段跳（边沿）
  if (inp.jump) {
    if (p.onGround) {
      p.vy = -PLAYER.JUMP_V;
      p.onGround = false;
      p.airJumps = 1;
      run._emit('jump', { x: p.x, y: p.y, double: false });
      run.state.fx.push({ type: 'dust', x: p.x, y: WORLD.GROUND_Y, life: 0.3, maxLife: 0.3 });
    } else if (p.airJumps > 0) {
      p.vy = -PLAYER.JUMP_V;
      p.airJumps -= 1;
      run._emit('jump', { x: p.x, y: p.y, double: true });
    }
  }

  // 重力与积分
  p.vy += WORLD.GRAVITY * dt;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  const floorY = WORLD.GROUND_Y - PLAYER.HEIGHT;
  if (p.y >= floorY) {
    const wasAir = p.wasAirborne;
    p.y = floorY;
    p.vy = 0;
    p.onGround = true;
    p.airJumps = 0;
    if (wasAir) run._emit('land', { x: p.x, y: floorY });
    p.wasAirborne = false;
  } else {
    p.wasAirborne = true;
  }

  p.x = clamp(p.x, WORLD.LEFT_WALL, WORLD.RIGHT_WALL - PLAYER.WIDTH);
  if (p.invuln > 0) p.invuln -= dt;
  if (p.fireCd > 0) p.fireCd -= dt;

  // 切枪
  if (inp.switchWeapon) {
    run.switchWeapon();
  }

  // 开火（按住；自动索敌最近的敌人）
  if (inp.fire && p.fireCd <= 0) {
    const target = nearestEnemy(run.state, p.x + p.facing * 20, p.y, PLAYER.FIRE_RANGE);
    if (target) {
      const ang = Math.atan2(target.y - p.y, target.x - p.x);
      firePlayerBullet(run, ang);
    }
  }

  // 合体爆破
  if (inp.blast) {
    run.triggerBlast();
  }
}

function updateCompanion(run, dt) {
  const p = run.state.player;
  const c = run.state.companion;
  c.x = p.x + COMPANION.OFFSET_X;
  c.y = p.y + COMPANION.HOVER_Y;
  if (c.cd > 0) c.cd -= dt;
  // DUO link：JET 只在你参战（近 2 秒内开过火）时才协同开火。
  if (run.state.t - p.lastFireAt > 2.0) return;
  if (c.cd <= 0) {
    const target = nearestEnemy(run.state, c.x, c.y, COMPANION.RANGE);
    if (target) fireCompanionBullet(run, target);
  }
}

function updateEnemies(run, dt) {
  const p = run.state.player;
  for (const e of run.state.enemies) {
    if (e.hp <= 0) continue;
    if (e.hitFlash > 0) e.hitFlash -= dt;
    // 向玩家推进（近战贴脸；远程到射程内停下）
    const dx = p.x - e.x;
    if (e.ranged) {
      if (Math.abs(dx) > e.range) {
        e.x += Math.sign(dx) * e.speed * dt;
      }
    } else {
      if (Math.abs(dx) > e.meleeRange) {
        e.x += Math.sign(dx) * e.speed * dt;
      }
    }
    e.x = clamp(e.x, WORLD.LEFT_WALL, WORLD.RIGHT_WALL);

    e.attackTimer += dt;
    if (e.ranged) {
      const d = dist(e.x, e.y, p.x, p.y);
      if (d <= e.range && e.attackTimer >= e.attackCd) {
        e.attackTimer = 0;
        fireEnemyBullet(run, e);
      }
    } else {
      const d = Math.abs(e.x - p.x);
      const playerGrounded = p.y >= WORLD.GROUND_Y - PLAYER.HEIGHT - 1;
      if (d <= e.meleeRange && playerGrounded && e.attackTimer >= e.attackCd) {
        e.attackTimer = 0;
        hurtPlayer(run, e.attack);
      }
    }
  }
  // 清掉死亡敌人
  run.state.enemies = run.state.enemies.filter((e) => e.hp > 0);
}

function hurtPlayer(run, amount) {
  const p = run.state.player;
  if (p.invuln > 0 || run.state.phase !== 'playing') return;
  p.hp -= amount;
  p.invuln = PLAYER.INVULN;
  run._emit('hurt', { x: p.x, y: p.y, hp: p.hp });
  run.state.fx.push({ type: 'hitflash', x: p.x, y: p.y, life: 0.2, maxLife: 0.2 });
  if (p.hp <= 0) {
    p.hp = 0;
    run.state.phase = 'lost';
    run._emit('lose', { x: p.x, y: p.y });
  }
}

function updateBullets(run, dt) {
  const s = run.state;
  // 玩家/搭档子弹
  for (let i = s.bullets.length - 1; i >= 0; i -= 1) {
    const b = s.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.range -= b.speed * dt;
    let dead = b.range <= 0 || b.x < -40 || b.x > WORLD.WIDTH + 40 || b.y < -40 || b.y > WORLD.HEIGHT + 40;

    // 火箭：射程耗尽也爆炸
    if (b.radius > 0 && (dead || b.range <= 0)) {
      explodeRocket(run, b);
      s.bullets.splice(i, 1);
      continue;
    }

    for (const e of s.enemies) {
      if (e.hp <= 0) continue;
      if (dist(b.x, b.y, e.x, e.y) <= e.radius + 6) {
        if (b.radius > 0) {
          explodeRocket(run, b);
          dead = true;
          break;
        }
        damageEnemy(run, e, b.damage, 'player');
        if (b.pierce > 0) {
          b.pierce -= 1;
        } else {
          dead = true;
          break;
        }
      }
    }
    if (dead) s.bullets.splice(i, 1);
  }

  // 敌人子弹
  for (let i = s.enemyBullets.length - 1; i >= 0; i -= 1) {
    const b = s.enemyBullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.range -= b.speed * dt;
    const p = s.player;
    let dead = b.range <= 0 || b.x < -40 || b.x > WORLD.WIDTH + 40 || b.y < -40 || b.y > WORLD.HEIGHT + 40;
    if (!dead && dist(b.x, b.y, p.x + PLAYER.WIDTH / 2, p.y + PLAYER.HEIGHT / 2) <= PLAYER.WIDTH / 2 + 5) {
      hurtPlayer(run, b.damage);
      dead = true;
    }
    if (dead) s.enemyBullets.splice(i, 1);
  }
}

function explodeRocket(run, b) {
  run.state.fx.push({ type: 'blast', x: b.x, y: b.y, life: 0.4, maxLife: 0.4, radius: b.radius });
  damageRadius(run, b.x, b.y, b.radius, b.damage, 'player');
}

function updatePickups(run, dt) {
  const p = run.state.player;
  for (let i = run.state.pickups.length - 1; i >= 0; i -= 1) {
    const pk = run.state.pickups[i];
    pk.life -= dt;
    let dead = pk.life <= 0;
    if (!dead && dist(pk.x, pk.y, p.x + PLAYER.WIDTH / 2, p.y + PLAYER.HEIGHT / 2) <= PICKUP.RADIUS + 26) {
      run.state.duoMeter = Math.min(DUO.METER_MAX, run.state.duoMeter + DUO.PICKUP_GAIN);
      if (run.state.duoMeter >= DUO.METER_MAX) run.state.duoReady = true;
      run._emit('pickup', { x: pk.x, y: pk.y });
      dead = true;
    }
    if (dead) run.state.pickups.splice(i, 1);
  }
}

function updateFx(run, dt) {
  for (let i = run.state.fx.length - 1; i >= 0; i -= 1) {
    run.state.fx[i].life -= dt;
    if (run.state.fx[i].life <= 0) run.state.fx.splice(i, 1);
  }
  // 粒子上限兜底
  if (run.state.fx.length > 320) run.state.fx.splice(0, run.state.fx.length - 320);
}

function update(run, dt) {
  const s = run.state;
  if (s.phase !== 'playing') return;

  s.t += dt;

  // 波次生成
  for (const w of s.spawnList) {
    if (!w.done && s.t >= w.t) spawnWave(run, w);
  }

  updatePlayer(run, dt);
  updateCompanion(run, dt);
  updateEnemies(run, dt);
  updateBullets(run, dt);
  updatePickups(run, dt);
  updateFx(run, dt);

  // 连击衰减
  if (s.comboTimer > 0) {
    s.comboTimer -= dt;
    if (s.comboTimer <= 0 && s.combo > 0) {
      s.combo = 0;
      s.comboLevel = 0;
    }
  }

  updateRemaining(s);

  // 胜负判定
  const allSpawned = s.spawnList.every((w) => w.done);
  if (allSpawned && s.enemies.length === 0) {
    s.phase = 'won';
    s.remaining = 0;
    run._emit('win', { level: s.levelIndex + 1, score: s.score });
  }

  // 清除边沿输入
  run.input.jump = false;
  run.input.switchWeapon = false;
  run.input.blast = false;
}
