// ELITE GUNSTRIKE · 模拟/玩法核心（纯逻辑，零依赖，无 DOM/window/localStorage/Date.now）
// 世界：1280×720，玩家炮塔固定在 (PLAYER.X, PLAYER.Y)。
// 玩法：拖拽甩出能量弹（带重力 + 反弹），击倒所有敌机过关；误中俘虏立即失败；
//       能量核心被击中会链式爆炸；熔毁倒计时与弹尽同为失败条件；按用弹数评 1-3 星。
import {
  WORLD, PLAYER, AIM, BOLT, ENEMY_BOLT, COMBO, STAR, LEVEL, CORE, CAPTIVE,
  clamp, comboMult, enemyById, obstacleById,
} from '../../config/gameplay.js';
import { LEVELS, LEVEL_COUNT, sceneForLevel, sceneById } from '../../config/levels.js';
import { mulberry32 } from './rng.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, startLevel = 1 } = {}) {
  const rng = mulberry32(seed);
  const level = clamp(startLevel, 1, LEVEL_COUNT);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    level,
    levelCount: LEVEL_COUNT,
    scene: sceneForLevel(level).id,
    player: { x: PLAYER.X, y: PLAYER.Y, radius: PLAYER.RADIUS, hp: PLAYER.HP, maxHp: PLAYER.MAX_HP },
    aim: { x: PLAYER.X, y: PLAYER.Y - 200, active: false },
    launchCd: 0,
    ammo: 0,
    maxAmmo: 0,
    shotsUsed: 0,
    par: { three: 3, two: 4, one: 5 },
    meltdown: 24,
    meltdownMax: 24,
    clearingUntil: null,
    bolts: [],
    enemyBolts: [],
    enemies: [],
    obstacles: [],
    captives: [],
    score: 0,
    combo: 0,
    maxCombo: 0,
    lastKill: -Infinity,
    stars: 0,
    totalStars: 0,
    stats: { levelsReached: level, kills: 0, score: 0, maxCombo: 0, totalStars: 0 },
    events: [],
    prevInput: { fire: false },
    _id: 1,
    _lastHeartbeat: 0,
    _lastMilestone: 0,
    _lastShotAt: -Infinity,
  };

  loadLevel(run, level);
  emit(run, 'levelStart', { level: run.level });
  emit(run, 'sceneEnter', { scene: run.scene, name: sceneById(run.scene).nameKey });

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  // 调试/截图辅助：跳到指定关卡并重新布置场景
  run.loadLevel = (lv) => {
    run.level = clamp(lv, 1, LEVEL_COUNT);
    run.stars = 0;
    loadLevel(run, run.level);
    if (run.level > run.stats.levelsReached) run.stats.levelsReached = run.level;
    emit(run, 'levelStart', { level: run.level });
    emit(run, 'sceneEnter', { scene: run.scene, name: sceneById(run.scene).nameKey });
  };
  return run;
}

// 兼容旧骨架
export function createSim() {
  return createRun({ seed: 0 });
}
export function updateSim(run, input = {}) {
  run.step(input);
}

// ---------- 载入关卡 ----------
function loadLevel(run, level) {
  const def = LEVELS[level - 1];
  run.scene = def.scene;
  run.ammo = def.ammo;
  run.maxAmmo = def.ammo;
  run.shotsUsed = 0;
  run.par = { three: def.par3, two: def.par2, one: def.par1 };
  run.meltdown = def.meltdown;
  run.meltdownMax = def.meltdown;
  run.enemies = (def.enemies || []).map((d) => spawnEnemy(run, d));
  run.obstacles = (def.obstacles || []).map((d) => spawnObstacle(run, d));
  run.captives = (def.captives || []).map((d) => ({ id: run._id++, x: d.x, y: d.y, radius: CAPTIVE.RADIUS, alive: true }));
  run.bolts = [];
  run.enemyBolts = [];
  run.clearingUntil = null;
}

function spawnEnemy(run, d) {
  const spec = enemyById(d.type);
  return {
    id: run._id++,
    type: spec.id,
    x: d.x,
    y: d.y,
    radius: spec.radius,
    hp: spec.hp,
    maxHp: spec.hp,
    fire: !!spec.fire,
    fireInterval: spec.fireInterval || 0,
    fireTimer: spec.fire ? 0.6 + run.rng() * 0.6 : Infinity,
    bulletDamage: spec.bulletDamage || 0,
    score: spec.score,
    alive: true,
  };
}

function spawnObstacle(run, d) {
  const spec = obstacleById(d.type);
  return {
    id: run._id++,
    type: spec.id,
    x: d.x,
    y: d.y,
    w: d.w || 40,
    h: d.h || 40,
    hp: spec.hp,
    maxHp: spec.hp,
    fragile: !!spec.fragile,
    explosive: !!spec.explosive,
    alive: true,
  };
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = 1 / 60;
  run.time += dt;

  updateAim(run, input);
  updatePlayer(run, dt);
  updateEnemies(run, dt);
  updateEnemyBolts(run, dt);
  updateBolts(run, dt);
  cull(run);
  updateMeltdown(run, dt);
  updateCombo(run, dt);
  checkLevelClear(run);
  heartbeat(run);
  syncStats(run);

  run.prevInput.fire = !!input.fire;
}

// ---------- 瞄准 / 发射 ----------
function updateAim(run, input) {
  if (input.aimX != null && input.aimY != null) {
    run.aim.x = clamp(input.aimX, 0, WORLD.WIDTH);
    run.aim.y = clamp(input.aimY, 0, WORLD.HEIGHT);
  }
  const press = !!input.fire && !run.prevInput.fire;
  const release = !input.fire && run.prevInput.fire;

  if (press) {
    run.aim.active = true;
    emit(run, 'aim', { x: run.aim.x, y: run.aim.y });
  }
  if (release && run.aim.active) {
    launch(run);
    run.aim.active = false;
  }
}

function launch(run) {
  if (run.ammo <= 0 || run.clearingUntil != null) return;
  const dx = run.aim.x - run.player.x;
  const dy = run.aim.y - run.player.y;
  const len = Math.hypot(dx, dy);
  if (len < AIM.DEADZONE) return;
  if (run.time - run._lastShotAt < BOLT.LAUNCH_CD) return;

  const nx = dx / len;
  const ny = dy / len;
  run.ammo -= 1;
  run.shotsUsed += 1;
  run._lastShotAt = run.time;

  const muzzleX = run.player.x + nx * (run.player.radius + BOLT.RADIUS + 2);
  const muzzleY = run.player.y + ny * (run.player.radius + BOLT.RADIUS + 2);
  run.bolts.push({
    id: run._id++,
    x: muzzleX,
    y: muzzleY,
    vx: nx * BOLT.SPEED,
    vy: ny * BOLT.SPEED,
    life: BOLT.LIFE,
  });
  emit(run, 'shot', { x: muzzleX, y: muzzleY, angle: Math.atan2(ny, nx) });
}

function updatePlayer(run, dt) {
  run.launchCd = Math.max(0, run.launchCd - dt);
  // 炮塔固定，无位移
}

// ---------- 敌人（炮塔还击） ----------
function updateEnemies(run, dt) {
  for (const e of run.enemies) {
    if (!e.alive || !e.fire) continue;
    e.fireTimer -= dt;
    if (e.fireTimer <= 0) {
      e.fireTimer = e.fireInterval + (run.rng() - 0.5) * 0.3;
      const ang = Math.atan2(run.player.y - e.y, run.player.x - e.x);
      run.enemyBolts.push({
        id: run._id++,
        x: e.x,
        y: e.y,
        vx: Math.cos(ang) * ENEMY_BOLT.SPEED,
        vy: Math.sin(ang) * ENEMY_BOLT.SPEED,
        life: ENEMY_BOLT.LIFE,
        damage: e.bulletDamage,
      });
      emit(run, 'enemyShot', { x: e.x, y: e.y });
    }
  }
}

// ---------- 敌方弹（直线飞向炮塔） ----------
function updateEnemyBolts(run, dt) {
  const p = run.player;
  const remaining = [];
  for (const b of run.enemyBolts) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    if (b.life <= 0 || b.x < -40 || b.x > WORLD.WIDTH + 40 || b.y < -40 || b.y > WORLD.HEIGHT + 40) continue;
    const d = Math.hypot(p.x - b.x, p.y - b.y);
    if (d < p.radius + ENEMY_BOLT.RADIUS) {
      damagePlayer(run, b.damage);
      continue;
    }
    remaining.push(b);
  }
  run.enemyBolts = remaining;
}

// ---------- 玩家弹（重力 + 反弹 + 碰撞） ----------
function speedOf(b) {
  return Math.hypot(b.vx, b.vy);
}

function updateBolts(run, dt) {
  const remaining = [];
  for (const bolt of run.bolts) {
    bolt.vy += BOLT.GRAVITY * dt;
    bolt.x += bolt.vx * dt;
    bolt.y += bolt.vy * dt;
    bolt.life -= dt;
    if (bolt.life <= 0) continue;

    // 撞墙反弹
    const m = BOLT.RADIUS;
    let bounced = false;
    if (bolt.x < m) { bolt.x = m; bolt.vx = -bolt.vx * BOLT.RESTITUTION; bounced = true; }
    else if (bolt.x > WORLD.WIDTH - m) { bolt.x = WORLD.WIDTH - m; bolt.vx = -bolt.vx * BOLT.RESTITUTION; bounced = true; }
    if (bolt.y < m) { bolt.y = m; bolt.vy = -bolt.vy * BOLT.RESTITUTION; bounced = true; }
    else if (bolt.y > WORLD.HEIGHT - m) { bolt.y = WORLD.HEIGHT - m; bolt.vy = -bolt.vy * BOLT.RESTITUTION; bounced = true; }
    if (bounced) {
      emit(run, 'bounce', { x: bolt.x, y: bolt.y });
      if (speedOf(bolt) < BOLT.MIN_SPEED) continue;
    }

    let remove = false;

    // 敌机：命中即消耗
    for (const e of run.enemies) {
      if (!e.alive) continue;
      if (Math.hypot(e.x - bolt.x, e.y - bolt.y) < e.radius + BOLT.RADIUS) {
        if (speedOf(bolt) >= BOLT.HURT_SPEED) hitEnemy(run, e);
        remove = true;
        break;
      }
    }
    if (remove) continue;

    // 俘虏：命中即失败
    for (const c of run.captives) {
      if (!c.alive) continue;
      if (Math.hypot(c.x - bolt.x, c.y - bolt.y) < c.radius + BOLT.RADIUS) {
        hitCaptive(run, c);
        remove = true;
        break;
      }
    }
    if (remove) continue;

    // 障碍物
    for (const o of run.obstacles) {
      if (!o.alive) continue;
      if (!aabbCircleHit(o, bolt)) continue;
      const res = handleObstacle(run, bolt, o);
      if (res === 'consume') remove = true;
      break;
    }
    if (remove) continue;

    if (speedOf(bolt) < BOLT.MIN_SPEED) continue;
    remaining.push(bolt);
  }
  run.bolts = remaining;
}

function aabbCircleHit(o, b) {
  const hw = o.w / 2;
  const hh = o.h / 2;
  const cx = clamp(b.x, o.x - hw, o.x + hw);
  const cy = clamp(b.y, o.y - hh, o.y + hh);
  const dx = b.x - cx;
  const dy = b.y - cy;
  return dx * dx + dy * dy < BOLT.RADIUS * BOLT.RADIUS;
}

function reflectAabb(bolt, o) {
  const hw = o.w / 2;
  const hh = o.h / 2;
  const cx = clamp(bolt.x, o.x - hw, o.x + hw);
  const cy = clamp(bolt.y, o.y - hh, o.y + hh);
  let dx = bolt.x - cx;
  let dy = bolt.y - cy;
  const d2 = dx * dx + dy * dy;
  let nx = 0;
  let ny = -1;
  if (d2 > 1e-6) {
    const d = Math.sqrt(d2);
    nx = dx / d;
    ny = dy / d;
  }
  // 推出碰撞体
  bolt.x = cx + nx * (BOLT.RADIUS + 0.5);
  bolt.y = cy + ny * (BOLT.RADIUS + 0.5);
  const dot = bolt.vx * nx + bolt.vy * ny;
  if (dot < 0) {
    bolt.vx -= (1 + BOLT.OBST_RESTITUTION) * dot * nx;
    bolt.vy -= (1 + BOLT.OBST_RESTITUTION) * dot * ny;
  }
}

function handleObstacle(run, bolt, o) {
  if (o.explosive) {
    o.alive = false;
    emit(run, 'hit', { x: o.x, y: o.y, enemy: 'core' });
    explode(run, o.x, o.y, CORE.RADIUS);
    return 'consume';
  }
  if (o.fragile) {
    o.alive = false;
    emit(run, 'hit', { x: o.x, y: o.y, enemy: 'glass' });
    // 玻璃一碰即碎，弹体穿透（轻微减速）
    bolt.vx *= 0.92;
    bolt.vy *= 0.92;
    return 'pass';
  }
  // 箱/砖：高速撞击造成伤害并反弹；耐久耗尽则弹体穿透
  if (speedOf(bolt) >= BOLT.HURT_SPEED) {
    o.hp -= 1;
    emit(run, 'hit', { x: o.x, y: o.y, enemy: o.type });
    if (o.hp <= 0) {
      o.alive = false;
      return 'pass';
    }
  }
  reflectAabb(bolt, o);
  return 'bounce';
}

function explode(run, x, y, radius) {
  emit(run, 'explosion', { x, y, radius });
  // 范围伤害
  for (const e of run.enemies) {
    if (!e.alive) continue;
    if (Math.hypot(e.x - x, e.y - y) < radius + e.radius) {
      hitEnemy(run, e);
    }
  }
  // 链式引爆相邻核心
  for (const o of run.obstacles) {
    if (!o.alive || !o.explosive) continue;
    if (Math.hypot(o.x - x, o.y - y) < CORE.CHAIN_RADIUS) {
      o.alive = false;
      emit(run, 'chainExplosion', { x: o.x, y: o.y });
      explode(run, o.x, o.y, CORE.RADIUS);
    }
  }
}

// ---------- 伤害 / 击杀 ----------
function hitEnemy(run, e) {
  if (!e.alive) return;
  e.hp -= 1;
  emit(run, 'hit', { x: e.x, y: e.y, enemy: e.type });
  if (e.hp <= 0) {
    e.alive = false;
    killEnemy(run, e);
  }
}

function killEnemy(run, e) {
  run.stats.kills += 1;
  run.combo = (run.time - run.lastKill <= COMBO.WINDOW) ? run.combo + 1 : 1;
  run.lastKill = run.time;
  if (run.combo > run.maxCombo) run.maxCombo = run.combo;
  const gained = Math.round(e.score * comboMult(run.combo));
  run.score += gained;
  emit(run, 'kill', { x: e.x, y: e.y, enemy: e.type, combo: run.combo, score: gained });
  emit(run, 'comboUp', { combo: run.combo, mult: comboMult(run.combo) });
}

function hitCaptive(run, c) {
  c.alive = false;
  emit(run, 'captiveHit', { x: c.x, y: c.y });
  die(run, 'captive');
}

function damagePlayer(run, amount) {
  run.player.hp -= amount;
  emit(run, 'playerHit', { amount });
  if (run.player.hp <= 0) {
    run.player.hp = 0;
    die(run, 'destroyed');
  }
}

function die(run, reason = 'meltdown') {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  run.deathReason = reason;
  emit(run, 'death', { reason });
}

// ---------- 熔毁 / 连击 / 过关 ----------
function updateMeltdown(run, dt) {
  if (run.clearingUntil != null) return;
  run.meltdown -= dt;
  if (run.meltdown <= 0) {
    run.meltdown = 0;
    die(run, 'meltdown');
  }
}

function updateCombo(run, dt) {
  if (run.combo > 0 && run.time - run.lastKill > COMBO.WINDOW) {
    run.combo = 0;
    run.lastKill = -Infinity;
    emit(run, 'comboBreak', {});
  }
}

function checkLevelClear(run) {
  if (run.clearingUntil != null) {
    if (run.time >= run.clearingUntil) {
      run.clearingUntil = null;
      advanceLevel(run);
    }
    return;
  }
  // 弹尽且敌机仍在、且最后一发已落地 → 失败（原版 P0 失败条件）
  if (run.ammo === 0 && run.bolts.length === 0 && run.enemies.length > 0) {
    die(run, 'outOfAmmo');
    return;
  }
  if (run.enemies.length === 0) {
    const stars = run.shotsUsed <= run.par.three ? 3
      : run.shotsUsed <= run.par.two ? 2
      : run.shotsUsed <= run.par.one ? 1 : 1;
    run.stars = stars;
    run.totalStars += stars;
    run.score += stars * STAR.BONUS;
    run.bolts = [];
    run.enemyBolts = [];
    emit(run, 'levelCleared', { level: run.level, stars });
    emit(run, 'stars', { stars });
    run.clearingUntil = run.time + LEVEL.CLEAR_DELAY;
  }
}

function advanceLevel(run) {
  if (run.level >= run.levelCount) {
    run.phase = 'won';
    emit(run, 'victory', { level: run.level });
    return;
  }
  run.level += 1;
  run.player.hp = Math.min(run.player.maxHp, run.player.hp + PLAYER.HEAL_PER_LEVEL);
  loadLevel(run, run.level);
  emit(run, 'levelStart', { level: run.level });
  emit(run, 'sceneEnter', { scene: run.scene, name: sceneById(run.scene).nameKey });
}

// ---------- 心跳 / 清理 / 统计 ----------
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

function cull(run) {
  run.enemies = run.enemies.filter((e) => e.alive);
  run.obstacles = run.obstacles.filter((o) => o.alive);
  run.captives = run.captives.filter((c) => c.alive);
}

function syncStats(run) {
  run.stats.score = run.score;
  run.stats.maxCombo = run.maxCombo;
  run.stats.totalStars = run.totalStars;
  if (run.level > run.stats.levelsReached) run.stats.levelsReached = run.level;
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const p = run.player;
  return {
    phase: run.phase,
    level: run.level,
    scene: run.scene,
    sceneName: sceneById(run.scene).nameKey,
    hp: Math.max(0, Math.round(p.hp)),
    maxHp: p.maxHp,
    ammo: run.ammo,
    score: run.score,
    combo: run.combo,
    maxCombo: run.maxCombo,
    enemies: run.enemies.length,
    meltdown: Math.max(0, run.meltdown),
    meltdownMax: run.meltdownMax,
    stars: run.stars,
    totalStars: run.totalStars,
    aimActive: run.aim.active,
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
