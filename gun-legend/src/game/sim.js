// GUN LEGEND · M1 模拟/玩法核心（纯逻辑，零依赖，无 DOM/window/localStorage/Date.now）
// 契约：docs/report.md 事件表 / 接口签名。
// 世界：1280×720，玩家固定在 (PLAYER.X, PLAYER.Y)，翻滚做横向位移；敌人从上方波次推进。
import {
  WORLD, PLAYER, AIM, BULLET, RELOAD, DOVE, COMBO, NEAR_MISS, WAVE, ROUND,
  clamp, comboMult, weaponById, enemyById,
} from '../../config/gameplay.js';
import { ROUNDS, ROUND_COUNT, sceneForRound, sceneById } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, startRound = 1 } = {}) {
  const rng = mulberry32(seed);
  const round = clamp(startRound, 1, ROUND_COUNT);
  const weapon = weaponById(ROUNDS[round - 1].weapon);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    round,
    scene: ROUNDS[round - 1].scene,
    weapon,
    player: {
      x: PLAYER.X,
      y: PLAYER.Y,
      radius: PLAYER.RADIUS,
      hp: PLAYER.HP,
      maxHp: PLAYER.MAX_HP,
      rollCd: 0,
      rolling: false,
      rollUntil: -Infinity,
      invulnUntil: -Infinity,
      rollStartX: PLAYER.X,
      rollTargetX: PLAYER.X,
      rollDir: 1,
    },
    aim: { x: AIM.DEFAULT_X, y: AIM.DEFAULT_Y },
    guns: { left: weapon.magSize, right: weapon.magSize, active: 0 },
    reloading: false,
    reloadStartAt: 0,
    reloadDuration: weapon.reloadSec,
    fireCd: 0,
    combo: 0,
    maxCombo: 0,
    lastKill: -Infinity,
    score: 0,
    doveUntil: -Infinity,
    enemies: [],
    bullets: [],
    enemyBullets: [],
    grenades: [],
    wave: { timer: WAVE.FIRST_DELAY, spawned: 0, waiting: true },
    roundClearing: false,
    roundClearUntil: -Infinity,
    stats: { roundReached: round, maxCombo: 0, score: 0, kills: 0 },
    events: [],
    prevInput: { fire: false, roll: false, reload: false },
    _id: 1,
    _lastHeartbeat: 0,
    _lastMilestone: 0,
  };

  emit(run, 'roundStart', { round: run.round });
  emit(run, 'sceneEnter', { scene: run.scene, name: sceneById(run.scene).nameKey });
  emit(run, 'weaponUnlock', { weapon: weapon.id, name: weapon.nameKey });

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// 兼容旧骨架
export function createSim() {
  return createRun({ seed: 0 });
}
export function updateSim(run, input = {}) {
  run.step(input);
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = 1 / 60;
  run.time += dt;

  updateAim(run, input);
  updateRoll(run, input);
  updateReload(run, input);
  updateFire(run, input);
  updatePlayer(run, dt);
  updateWaves(run, dt);
  updateEnemies(run, dt);
  updateGrenades(run, dt);
  updateEnemyBullets(run, dt);
  updateBullets(run, dt);
  updateCombo(run, dt);
  heartbeat(run);
  cull(run);
  syncStats(run);

  run.prevInput.fire = !!input.fire;
  run.prevInput.roll = !!input.roll;
  run.prevInput.reload = !!input.reload;
}

// ---------- 瞄准 ----------
function updateAim(run, input) {
  if (input.aimX != null && input.aimY != null) {
    run.aim.x = clamp(input.aimX, 0, WORLD.WIDTH);
    run.aim.y = clamp(input.aimY, 0, WORLD.HEIGHT);
  }
}

// ---------- 翻滚（Shift / 触屏按钮；rising edge） ----------
function updateRoll(run, input) {
  const p = run.player;
  const edge = !!input.roll && !run.prevInput.roll;
  if (edge && !p.rolling && p.rollCd <= 0 && run.time >= p.rollUntil) {
    p.rolling = true;
    p.rollUntil = run.time + PLAYER.ROLL_TIME;
    p.invulnUntil = run.time + PLAYER.ROLL_INVULN;
    p.rollCd = PLAYER.ROLL_CD;
    p.rollStartX = p.x;
    p.rollDir = run.aim.x >= p.x ? 1 : -1;
    p.rollTargetX = clamp(p.x + p.rollDir * PLAYER.ROLL_DIST, PLAYER.ROLL_MIN_X, PLAYER.ROLL_MAX_X);
    emit(run, 'rollStart', { dir: p.rollDir });
  }
}

function updatePlayer(run, dt) {
  const p = run.player;
  if (p.rollCd > 0) p.rollCd = Math.max(0, p.rollCd - dt);
  if (p.rolling) {
    if (run.time >= p.rollUntil) {
      p.x = p.rollTargetX;
      p.rolling = false;
      emit(run, 'rollEnd', {});
    } else {
      const t = (run.time - (p.rollUntil - PLAYER.ROLL_TIME)) / PLAYER.ROLL_TIME;
      p.x = p.rollStartX + (p.rollTargetX - p.rollStartX) * (t < 0 ? 0 : t > 1 ? 1 : t);
    }
  }
}

// ---------- 开火（长按连发；双枪轮流，一把打空自动切另一把） ----------
function updateFire(run, input) {
  run.fireCd = Math.max(0, run.fireCd - 1 / 60);
  if (!input.fire || run.reloading || run.fireCd > 0) return;

  const g = run.guns;
  // 双枪都空 → 触发白鸽时刻（免费满膛，不进入普通换弹）
  if (g.left <= 0 && g.right <= 0) {
    triggerDove(run);
    return;
  }
  // 当前枪空 → 无缝换到另一把
  if (g[g.active === 0 ? 'left' : 'right'] <= 0) {
    g.active = g.active === 0 ? 1 : 0;
  }
  const side = g.active === 0 ? 'left' : 'right';
  if (g[side] <= 0) return;

  fireShot(run, side);
  run.fireCd = run.weapon.fireInterval;

  // 打完这把后：若这把空了且另一把还有，无缝换枪
  if (g[side] <= 0 && g[side === 'left' ? 'right' : 'left'] > 0) {
    g.active = g.active === 0 ? 1 : 0;
    emit(run, 'gunSwitch', {});
  } else if (g.left <= 0 && g.right <= 0) {
    // 两把同时清空 → 白鸽时刻
    triggerDove(run);
  }
}

function fireShot(run, side) {
  const w = run.weapon;
  const g = run.guns;
  g[side] -= 1;
  const base = Math.atan2(run.aim.y - run.player.y, run.aim.x - run.player.x);
  const pellets = w.pellets || 1;
  for (let i = 0; i < pellets; i += 1) {
    let ang = base;
    if (pellets > 1) {
      ang = base + (i - (pellets - 1) / 2) * ((w.spreadRad * 2) / Math.max(1, pellets - 1));
    } else {
      ang = base + (run.rng() - 0.5) * w.spreadRad * 2;
    }
    run.bullets.push({
      id: run._id++,
      x: run.player.x,
      y: run.player.y,
      vx: Math.cos(ang) * w.bulletSpeed,
      vy: Math.sin(ang) * w.bulletSpeed,
      damage: w.damage,
      radius: BULLET.RADIUS,
      life: AIM.RANGE / w.bulletSpeed,
    });
  }
  emit(run, 'shot', { x: run.player.x, y: run.player.y, angle: base });
}

// ---------- 白鸽时刻 ----------
function triggerDove(run) {
  run.doveUntil = run.time + DOVE.SLOWMO_SEC;
  run.combo += DOVE.COMBO_BONUS;
  run.lastKill = run.time; // 白鸽连杀从此刻起算，避免同帧被连击窗口清掉
  if (run.combo > run.maxCombo) run.maxCombo = run.combo;
  run.score += DOVE.SCORE_BONUS;
  run.guns.left = run.weapon.magSize;
  run.guns.right = run.weapon.magSize;
  run.guns.active = 0;
  run.reloading = false;
  emit(run, 'dove', {});
  emit(run, 'comboUp', { combo: run.combo, mult: comboMult(run.combo) });
}

// ---------- 换弹（R）与换弹舞（换弹时点击） ----------
function updateReload(run, input) {
  const edge = !!input.reload && !run.prevInput.reload;
  const w = run.weapon;

  if (edge && !run.reloading) {
    // 手动换弹：随时可换，填满双枪
    run.reloading = true;
    run.reloadStartAt = run.time;
    run.reloadDuration = w.reloadSec;
    emit(run, 'reloadStart', {});
    return;
  }

  if (!run.reloading) return;

  // 换弹舞：换弹期间的“点击”是开火键，不是换弹键
  const fireEdge = !!input.fire && !run.prevInput.fire;
  if (fireEdge) {
    const progress = (run.time - run.reloadStartAt) / run.reloadDuration;
    if (progress >= 1 - RELOAD.DANCE_FRACTION) {
      // sweet spot：立即完成；本次点击被换弹舞消耗，不再额外开火
      finishReload(run);
      run.fireCd = run.weapon.fireInterval;
      emit(run, 'reloadDance', {});
      return;
    }
    // 乱点：打空弹匣，重新计时
    run.guns.left = 0;
    run.guns.right = 0;
    run.reloadStartAt = run.time;
    emit(run, 'reloadFail', {});
    return;
  }

  if (run.time - run.reloadStartAt >= run.reloadDuration) {
    finishReload(run);
  }
}

function finishReload(run) {
  run.reloading = false;
  run.guns.left = run.weapon.magSize;
  run.guns.right = run.weapon.magSize;
  run.guns.active = 0;
  emit(run, 'reloadDone', {});
}

// ---------- 波次 / 关卡推进 ----------
function updateWaves(run, dt) {
  const waves = ROUNDS[run.round - 1].waves;

  if (run.roundClearing) {
    if (run.time >= run.roundClearUntil) {
      advanceRound(run);
    }
    return;
  }

  if (run.wave.waiting) {
    run.wave.timer -= dt;
    if (run.wave.timer <= 0) {
      spawnWave(run, waves[run.wave.spawned]);
      run.wave.spawned += 1;
      run.wave.waiting = false;
      emit(run, 'waveStart', { wave: run.wave.spawned, total: waves.length });
    }
    return;
  }

  // 当前波清空
  if (run.enemies.length === 0) {
    if (run.wave.spawned < waves.length) {
      emit(run, 'waveCleared', { wave: run.wave.spawned });
      run.wave = { timer: WAVE.CLEAR_DELAY, spawned: run.wave.spawned, waiting: true };
    } else {
      // 过关
      emit(run, 'roundCleared', { round: run.round });
      run.roundClearing = true;
      run.roundClearUntil = run.time + ROUND.CLEAR_DELAY;
    }
  }
}

function spawnWave(run, wave) {
  const list = wave || [];
  for (const type of list) {
    spawnEnemy(run, type);
  }
}

function spawnEnemy(run, type) {
  const spec = enemyById(type);
  const x = randInt(run.rng, 70, WORLD.WIDTH - 70);
  const y = 170 + randInt(run.rng, 0, 30); // 从 HUD 下方进入，避免与顶部 HUD 重叠
  run.enemies.push({
    id: run._id++,
    type,
    x,
    y,
    hp: spec.hp,
    radius: spec.radius,
    speed: spec.speed,
    holdRange: spec.holdRange ?? (spec.meleeRange ?? 40),
    meleeRange: spec.meleeRange ?? 0,
    meleeDamage: spec.meleeDamage ?? 0,
    meleeInterval: spec.meleeInterval ?? 1,
    meleeTimer: 0,
    fireInterval: spec.fireInterval ?? 999,
    fireTimer: spec.fireInterval ? 0.6 + run.rng() * 0.5 : 999,
    bulletSpeed: spec.bulletSpeed ?? 0,
    bulletDamage: spec.bulletDamage ?? 0,
    volley: spec.volley ?? 1,
    throwInterval: spec.throwInterval ?? 999,
    throwTimer: spec.throwInterval ? 1.0 + run.rng() * 0.8 : 999,
    grenadeSpeed: spec.grenadeSpeed ?? 0,
    fuseSec: spec.fuseSec ?? 0,
    explosionRadius: spec.explosionRadius ?? 0,
    explosionDamage: spec.explosionDamage ?? 0,
    score: spec.score,
  });
}

function advanceRound(run) {
  if (run.round >= ROUND_COUNT) {
    run.phase = 'won';
    emit(run, 'victory', {});
    return;
  }
  run.round += 1;
  run.roundClearing = false;
  run.wave = { timer: WAVE.FIRST_DELAY, spawned: 0, waiting: true };
  const prevScene = run.scene;
  const prevWeapon = run.weapon.id;
  const weapon = weaponById(ROUNDS[run.round - 1].weapon);
  const scene = ROUNDS[run.round - 1].scene;
  run.weapon = weapon;
  run.scene = scene;
  run.guns.left = weapon.magSize;
  run.guns.right = weapon.magSize;
  run.guns.active = 0;
  run.reloading = false;
  run.fireCd = 0;
  run.player.hp = Math.min(run.player.maxHp, run.player.hp + PLAYER.HEAL_PER_ROUND);
  if (scene !== prevScene) emit(run, 'sceneEnter', { scene, name: sceneById(scene).nameKey });
  if (weapon.id !== prevWeapon) emit(run, 'weaponUnlock', { weapon: weapon.id, name: weapon.nameKey });
  emit(run, 'roundEnter', { round: run.round });
  emit(run, 'roundStart', { round: run.round });
}

// ---------- 敌人 AI ----------
function updateEnemies(run, dt) {
  const p = run.player;
  for (const e of run.enemies) {
    const dx = p.x - e.x;
    const dy = p.y - e.y;
    const d = Math.hypot(dx, dy) || 1;

    // 移动（接近玩家，直到 holdRange）
    if (d > e.holdRange) {
      const step = Math.min(e.speed * dt, d - e.holdRange);
      e.x += (dx / d) * step;
      e.y += (dy / d) * step;
    }

    // 近战（刀手）
    if (e.meleeRange > 0 && d <= e.meleeRange + e.radius) {
      e.meleeTimer -= dt;
      if (e.meleeTimer <= 0) {
        e.meleeTimer = e.meleeInterval;
        damagePlayer(run, e.meleeDamage, 'melee');
      }
    }

    // 远程射击（枪手/精英/Boss）
    if (e.fireInterval < 999) {
      e.fireTimer -= dt;
      if (e.fireTimer <= 0) {
        e.fireTimer = e.fireInterval + (run.rng() - 0.5) * 0.3;
        const n = e.volley || 1;
        for (let i = 0; i < n; i += 1) {
          const ang = Math.atan2(p.y - e.y, p.x - e.x) + (n > 1 ? (i - (n - 1) / 2) * 0.12 : 0);
          run.enemyBullets.push({
            id: run._id++,
            x: e.x,
            y: e.y,
            vx: Math.cos(ang) * e.bulletSpeed,
            vy: Math.sin(ang) * e.bulletSpeed,
            damage: e.bulletDamage,
            radius: 5,
            life: 4,
          });
        }
        emit(run, 'enemyShot', { x: e.x, y: e.y });
      }
    }

    // 投弹手：抛手雷
    if (e.throwInterval < 999) {
      e.throwTimer -= dt;
      if (e.throwTimer <= 0) {
        e.throwTimer = e.throwInterval + (run.rng() - 0.5) * 0.4;
        run.grenades.push({
          id: run._id++,
          x: e.x,
          y: e.y,
          tx: p.x,
          ty: p.y,
          speed: e.grenadeSpeed,
          fuse: e.fuseSec,
          radius: e.explosionRadius,
          damage: e.explosionDamage,
        });
        emit(run, 'grenadeThrown', { x: e.x, y: e.y });
      }
    }
  }
}

function damagePlayer(run, amount, kind) {
  if (run.time < run.player.invulnUntil) {
    emit(run, 'nearMiss', { x: run.player.x, y: run.player.y });
    return;
  }
  run.player.hp -= amount;
  emit(run, 'playerHit', { amount, kind });
  if (run.player.hp <= 0) {
    run.player.hp = 0;
    die(run);
  }
}

// ---------- 敌人子弹 ----------
function updateEnemyBullets(run, dt) {
  const p = run.player;
  const remaining = [];
  for (const b of run.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -40 || b.x > WORLD.WIDTH + 40 || b.y < -40 || b.y > WORLD.HEIGHT + 40) {
      continue;
    }
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d < p.radius + b.radius + (run.time < p.invulnUntil ? NEAR_MISS.GAP : 0)) {
      damagePlayer(run, b.damage, 'bullet');
      continue; // 命中即消失（无敌时算擦身）
    }
    remaining.push(b);
  }
  run.enemyBullets = remaining;
}

// ---------- 手雷 ----------
function updateGrenades(run, dt) {
  const p = run.player;
  const remaining = [];
  for (const g of run.grenades) {
    const dx = g.tx - g.x;
    const dy = g.ty - g.y;
    const d = Math.hypot(dx, dy);
    g.fuse -= dt;
    if (d > 8 && g.fuse > 0) {
      const step = Math.min(g.speed * dt, d);
      g.x += (dx / (d || 1)) * step;
      g.y += (dy / (d || 1)) * step;
    }
    if (g.fuse <= 0 || d <= 8) {
      emit(run, 'explosion', { x: g.tx, y: g.ty, radius: g.radius });
      if (Math.hypot(p.x - g.tx, p.y - g.ty) < g.radius + p.radius) {
        damagePlayer(run, g.damage, 'grenade');
      }
      continue;
    }
    remaining.push(g);
  }
  run.grenades = remaining;
}

// ---------- 玩家子弹 ----------
function updateBullets(run, dt) {
  const remaining = [];
  for (const b of run.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -40 || b.x > WORLD.WIDTH + 40 || b.y < -40 || b.y > WORLD.HEIGHT + 40) {
      continue;
    }
    let hit = false;
    for (const e of run.enemies) {
      if (e.hp <= 0) continue;
      if (Math.hypot(e.x - b.x, e.y - b.y) < e.radius + b.radius) {
        e.hp -= b.damage;
        emit(run, 'hit', { x: e.x, y: e.y, enemy: e.type });
        hit = true;
        if (e.hp <= 0) {
          killEnemy(run, e);
        }
        break;
      }
    }
    if (!hit) remaining.push(b);
  }
  run.bullets = remaining;
}

function killEnemy(run, e) {
  e.hp = 0;
  run.stats.kills += 1;
  run.combo = (run.time - run.lastKill <= COMBO.WINDOW) ? run.combo + 1 : 1;
  run.lastKill = run.time;
  if (run.combo > run.maxCombo) run.maxCombo = run.combo;
  const gained = Math.round(e.score * comboMult(run.combo));
  run.score += gained;
  emit(run, 'kill', { x: e.x, y: e.y, enemy: e.type, combo: run.combo, score: gained });
  emit(run, 'comboUp', { combo: run.combo, mult: comboMult(run.combo) });
}

// ---------- 连击超时 ----------
function updateCombo(run, dt) {
  if (run.combo > 0 && run.time - run.lastKill > COMBO.WINDOW) {
    run.combo = 0;
    run.lastKill = -Infinity;
    emit(run, 'comboBreak', {});
  }
}

// ---------- 心跳 / 分数里程碑（保证反馈密度） ----------
function heartbeat(run) {
  const sec = Math.floor(run.time);
  if (sec > run._lastHeartbeat) {
    run._lastHeartbeat = sec;
    emit(run, 'milestone', { sec });
  }
  const scoreMile = Math.floor(run.score / 500);
  if (scoreMile > run._lastMilestone) {
    run._lastMilestone = scoreMile;
    emit(run, 'scoreMilestone', { score: run.score });
  }
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  run.player.rolling = false;
  emit(run, 'death', {});
}

// ---------- 清理 ----------
function cull(run) {
  run.enemies = run.enemies.filter((e) => e.hp > 0 && e.y < WORLD.HEIGHT + 120);
}

function syncStats(run) {
  run.stats.score = run.score;
  run.stats.maxCombo = run.maxCombo;
  if (run.round > run.stats.roundReached) run.stats.roundReached = run.round;
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const p = run.player;
  const reloadProgress = run.reloading
    ? clamp((run.time - run.reloadStartAt) / run.reloadDuration, 0, 1)
    : 0;
  return {
    phase: run.phase,
    round: run.round,
    scene: run.scene,
    sceneName: sceneById(run.scene).nameKey,
    weapon: run.weapon.nameKey,
    weaponId: run.weapon.id,
    hp: Math.max(0, Math.round(p.hp)),
    maxHp: p.maxHp,
    ammoL: run.guns.left,
    ammoR: run.guns.right,
    magSize: run.weapon.magSize,
    reloading: run.reloading,
    reloadProgress,
    combo: run.combo,
    maxCombo: run.maxCombo,
    score: run.score,
    enemies: run.enemies.length,
    rollCd: p.rollCd,
    rollReady: p.rollCd <= 0,
    rolling: p.rolling,
    invuln: run.time < p.invulnUntil,
    doveActive: run.time < run.doveUntil,
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
