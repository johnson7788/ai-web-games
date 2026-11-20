// STAR SLAYER · 模拟/玩法核心（纯逻辑，零依赖，可 node 直测）
// 契约：docs/star-slayer/README.md（事件名 / 接口签名一字不差）
// 输入 input: { mx, my, fire, skill, sync }（mx/my ∈ [-1,1] 归一化，fire 按住，skill/sync 边沿触发）
import { WORLD } from '../../config/game.config.js';
import {
  STEP, PLAYER, CORE, SYNC, OVERLOAD, ENEMY, STRIKER, BOSS, HURT, DAMAGE, clamp, dist, normMove,
} from '../../config/gameplay.js';
import { WAVE_COUNT, waveAt, buildSpawnQueue, ENEMY_TYPES, hpMult, SCENES } from '../../config/levels.js';
import { drawChoices } from '../../config/cards.js';
import { mulberry32, randInt } from './rng.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const M = WORLD.MARGIN;
const ATOP = WORLD.ARENA_TOP || 0;

// ---------- 创建 run ----------
export function createRun({ seed = 0, startWave: startAt = 1 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',       // playing | dead | won
    time: 0,
    wave: 0,
    cardOffer: false,
    cardChoices: [],
    cards: {},              // cardId -> true（已持有）
    mods: { fireIntervalMul: 1, dmgMul: 1, speedMul: 1 },
    player: {
      x: W / 2, y: H / 2, r: PLAYER.R,
      hp: PLAYER.HP, maxHp: PLAYER.HP,
      armor: PLAYER.MAX_ARMOR, maxArmor: PLAYER.MAX_ARMOR,
      aim: -Math.PI / 2, fireCd: 0, hurtCd: -Infinity, armorRegenDelay: -Infinity,
      webT: 0, firing: false,
    },
    core: { x: W / 2, y: H / 2 + 60, r: CORE.R, online: true, offlineUntil: -Infinity },
    bullets: [],        // 玩家子弹
    enemyBullets: [],   // 敌方子弹
    enemies: [],
    spawnQueue: [],
    spawnTimer: 0,
    copyQueue: [],      // 光核复制队列 {at, dirx, diry, dmg}
    echoQueue: [],      // 相位残影 {at, x, y}
    syncCd: 0,
    stats: { kills: 0, shots: 0, waveReached: 0 },
    events: [],
    nextId: 1,
  };

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.chooseCard = (i) => chooseCard(run, i);

  startWave(run, Math.max(1, startAt));
  return run;
}

// 兼容旧骨架入口
export function createSim() {
  return createRun({ seed: 0 });
}

// ---------- 主 step ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;

  // 波间选卡时暂停刷敌/战斗推进（选卡由 run.chooseCard 直接驱动）
  if (run.cardOffer) {
    // 只推进时间与冷却显示，不产生战斗
    run.time += STEP;
    return;
  }

  const dt = STEP;
  run.time += dt;

  updatePlayer(run, input, dt);     // 1 移动 + 开火 + 光核复制 + 技能
  updateCore(run, dt);              // 2 光核跟随 / 离线计时
  updateCopies(run);                // 3 延迟复制攻击
  updateEchoes(run);                // 4 相位残影
  updateBullets(run, dt);           // 5 玩家子弹
  updateEnemyBullets(run, dt);      // 6 敌方子弹
  updateEnemies(run, dt);           // 7 敌人 AI + 接触伤害
  spawnUpTo(run, dt);               // 8 波次生成
  regenArmor(run, dt);              // 9 护甲回复
  checkWaveClear(run);              // 10 波次结算
  updateAim(run);                   // 11 自动瞄准朝向
}

// ---------- 玩家：移动 / 开火 / 技能 ----------
function updatePlayer(run, input, dt) {
  const p = run.player;
  const move = normMove(input.mx, input.my);
  const web = p.webT > 0;
  const speed = PLAYER.SPEED * run.mods.speedMul * (input.fire ? PLAYER.FIRE_SLOW : 1);
  if (!web) {
    p.x += move.x * speed * dt;
    p.y += move.y * speed * dt;
  }
  p.x = clamp(p.x, M + p.r, W - M - p.r);
  p.y = clamp(p.y, ATOP + p.r, H - M - p.r);
  p.webT = Math.max(0, p.webT - dt);
  p.fireCd = Math.max(0, p.fireCd - dt);
  run.syncCd = Math.max(0, run.syncCd - dt);
  p.firing = !!input.fire;

  // 开火（按住连发）
  if (input.fire && p.fireCd <= 0) {
    p.fireCd = PLAYER.FIRE_INTERVAL * run.mods.fireIntervalMul;
    const aim = nearestEnemyAngle(run, p);
    p.aim = aim;
    const dirx = Math.cos(aim);
    const diry = Math.sin(aim);
    const dmg = PLAYER.BULLET_DMG * run.mods.dmgMul;
    spawnPlayerBullet(run, p.x, p.y, dirx, diry, dmg, false);
    run.stats.shots += 1;
    emit(run, 'shot', { x: p.x, y: p.y, dirx, diry });
    // 光核复制：0.5s 后沿同一方向延迟打出（打提前量的来源）
    run.copyQueue.push({ at: run.time + CORE.COPY_DELAY, dirx, diry, dmg: CORE.COPY_DMG * run.mods.dmgMul });
  }

  // 技能：超载协议（K）
  if (input.skill) tryOverload(run);

  // 同步位移（L）
  if (input.sync) trySync(run);
}

function spawnPlayerBullet(run, x, y, dirx, diry, dmg, fromCore) {
  const b = {
    id: run.nextId++,
    x, y,
    vx: dirx * PLAYER.BULLET_SPEED,
    vy: diry * PLAYER.BULLET_SPEED,
    r: PLAYER.BULLET_R,
    dmg,
    pierce: run.cards.pierce ? 1 : 0,
    ricocheted: false,
    lastHitId: -1,
    fromCore: !!fromCore,
  };
  run.bullets.push(b);
  return b;
}

// ---------- 光核 ----------
function updateCore(run, dt) {
  const c = run.core;
  if (!c.online && run.time >= c.offlineUntil) {
    c.online = true;
    emit(run, 'coreOnline', { x: c.x, y: c.y });
  }
  const p = run.player;
  const tx = p.x - Math.cos(p.aim) * CORE.TRAIL_DIST;
  const ty = p.y - Math.sin(p.aim) * CORE.TRAIL_DIST;
  const k = Math.min(1, CORE.FOLLOW_LERP * dt);
  c.x += (tx - c.x) * k;
  c.y += (ty - c.y) * k;
}

function updateCopies(run) {
  if (!run.copyQueue.length) return;
  const due = [];
  const rest = [];
  for (const job of run.copyQueue) {
    if (job.at <= run.time) due.push(job);
    else rest.push(job);
  }
  run.copyQueue = rest;
  if (!run.core.online) return; // 离线期间不复制
  for (const job of due) {
    const shots = run.cards.twinCore ? 2 : 1;
    for (let i = 0; i < shots; i += 1) {
      const spread = shots === 1 ? 0 : (i === 0 ? -0.10 : 0.10);
      const ang = Math.atan2(job.diry, job.dirx) + spread;
      spawnPlayerBullet(run, run.core.x, run.core.y, Math.cos(ang), Math.sin(ang), job.dmg, true);
    }
    emit(run, 'coreCopy', { x: run.core.x, y: run.core.y, shots });
  }
}

// ---------- 相位同步（L） ----------
function trySync(run) {
  if (!run.core.online) {
    emit(run, 'syncNo', {});
    return;
  }
  if (run.syncCd > 0) return;
  const p = run.player;
  const px = p.x, py = p.y;
  p.x = run.core.x; p.y = run.core.y;
  run.core.x = px; run.core.y = py;
  run.syncCd = SYNC.COOLDOWN;
  p.hurtCd = Math.max(p.hurtCd, run.time + SYNC.INVULN);
  emit(run, 'phaseSync', { x: p.x, y: p.y, fromX: px, fromY: py });
  // 冲击波伤害
  for (const e of run.enemies) {
    if (dist(e, p) <= SYNC.SHOCK_R + e.r) {
      damageEnemy(run, e, SYNC.SHOCK_DMG);
      emit(run, 'hit', { x: e.x, y: e.y, dmg: SYNC.SHOCK_DMG, enemyType: e.type });
    }
  }
  if (run.cards.echoStrike) {
    run.echoQueue.push({ at: run.time + 0.3, x: px, y: py });
  }
}

function updateEchoes(run) {
  if (!run.echoQueue.length) return;
  const due = [];
  const rest = [];
  for (const e of run.echoQueue) {
    if (e.at <= run.time) due.push(e);
    else rest.push(e);
  }
  run.echoQueue = rest;
  for (const e of due) {
    for (const en of run.enemies) {
      if (dist(en, e) <= 120 + en.r) {
        damageEnemy(run, en, 26);
      }
    }
    emit(run, 'echoStrike', { x: e.x, y: e.y });
  }
}

// ---------- 超载协议（K） ----------
function tryOverload(run) {
  const thr = run.cards.overloadSpike ? 0.45 : OVERLOAD.HP_THRESHOLD;
  if (!run.core.online) {
    emit(run, 'overloadNo', {});
    return;
  }
  if (run.player.hp / run.player.maxHp >= thr) {
    emit(run, 'overloadNo', {});
    return;
  }
  const offlineSec = run.cards.coldCore ? OVERLOAD.OFFLINE_SEC / 2 : OVERLOAD.OFFLINE_SEC;
  run.core.online = false;
  run.core.offlineUntil = run.time + offlineSec;
  emit(run, 'overload', { x: run.core.x, y: run.core.y });
  emit(run, 'coreOffline', { offlineSec });
  // 清屏：所有敌人承受巨量伤害
  for (const e of [...run.enemies]) {
    damageEnemy(run, e, OVERLOAD.CLEAR_DMG);
  }
}

// ---------- 敌人 / 子弹 ----------
function spawnEnemy(run, type) {
  const base = ENEMY_TYPES[type];
  const hp = type === 'boss'
    ? Math.round(base.hp * (1 + (run.wave - 1) * BOSS.HP_STEP))
    : Math.round(base.hp * hpMult(run.wave));
  // 出生点：活动区边缘内侧（顶部从 HUD 保留区下方进入，永不压 HUD）
  const r = base.r;
  const side = randInt(run.rng, 0, 3);
  let x, y;
  if (side === 0) { x = randInt(run.rng, M + r, W - M - r); y = ATOP + r + 4; }
  else if (side === 1) { x = randInt(run.rng, M + r, W - M - r); y = H - r - 4; }
  else if (side === 2) { x = r + 4; y = randInt(run.rng, ATOP + r + 4, H - r - 4); }
  else { x = W - r - 4; y = randInt(run.rng, ATOP + r + 4, H - r - 4); }

  const e = {
    id: run.nextId++,
    type,
    x, y, r: base.r, hp, maxHp: hp,
    speed: base.speed,
    touchDmg: base.touchDmg,
    color: base.color,
    score: base.score,
    // 行为状态
    dashCd: randInt(run.rng, 12, 30) / 10,
    dashT: 0, dashDirx: 0, dashDiry: 0,
    fireCd: randInt(run.rng, 10, 22) / 10,
    spawnT: 0,
  };
  run.enemies.push(e);
  if (type === 'boss') emit(run, 'bossSpawn', { wave: run.wave, hp });
  return e;
}

function spawnUpTo(run, dt) {
  if (!run.spawnQueue.length) return;
  run.spawnTimer += dt;
  while (run.spawnQueue.length && run.spawnQueue[0].delay <= run.spawnTimer) {
    const spec = run.spawnQueue.shift();
    spawnEnemy(run, spec.type);
  }
}

function updateBullets(run, dt) {
  const keep = [];
  for (const b of run.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) continue;
    let remove = false;
    for (const e of run.enemies) {
      if (e.hp <= 0) continue;
      if (dist(b, e) <= e.r + b.r) {
        remove = hitEnemy(run, b, e);
        if (remove) break;
      }
    }
    if (!remove) keep.push(b);
  }
  run.bullets = keep;
}

function hitEnemy(run, b, e) {
  if (b.lastHitId === e.id) return false;
  damageEnemy(run, e, b.dmg);
  emit(run, 'hit', { x: e.x, y: e.y, dmg: b.dmg, enemyType: e.type });
  if (e.hp <= 0) {
    // 击杀：反弹或移除子弹
    if (run.cards.ricochet && !b.ricocheted) {
      const next = nearestEnemyExcept(run, e, b.x, b.y);
      if (next) {
        const ang = Math.atan2(next.y - b.y, next.x - b.x);
        b.vx = Math.cos(ang) * PLAYER.BULLET_SPEED;
        b.vy = Math.sin(ang) * PLAYER.BULLET_SPEED;
        b.ricocheted = true;
        b.lastHitId = next.id;
        return false;
      }
    }
    return true;
  }
  if (b.pierce > 0) {
    b.pierce -= 1;
    b.lastHitId = e.id;
    return false;
  }
  return true;
}

function updateEnemyBullets(run, dt) {
  const keep = [];
  for (const b of run.enemyBullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < -40 || b.x > W + 40 || b.y < -40 || b.y > H + 40) continue;
    if (dist(b, run.player) <= run.player.r + b.r) {
      damagePlayer(run, b.dmg);
      continue;
    }
    keep.push(b);
  }
  run.enemyBullets = keep;
}

function updateEnemies(run, dt) {
  for (const e of run.enemies) {
    if (e.hp <= 0) continue;
    switch (e.type) {
      case 'raider': aiRaider(run, e, dt); break;
      case 'striker': aiStriker(run, e, dt); break;
      case 'weaver': aiWeaver(run, e, dt); break;
      case 'shuttle': aiShuttle(run, e, dt); break;
      case 'turret': aiTurret(run, e, dt); break;
      case 'boss': aiBoss(run, e, dt); break;
      default: break;
    }
  }
  run.enemies = run.enemies.filter((e) => e.hp > 0);
}

function seek(e, tx, ty, speed, dt) {
  const d = Math.hypot(tx - e.x, ty - e.y) || 1;
  e.x += ((tx - e.x) / d) * speed * dt;
  e.y += ((ty - e.y) / d) * speed * dt;
}

function aiRaider(run, e, dt) {
  seek(e, run.player.x, run.player.y, e.speed, dt);
  if (dist(e, run.player) <= e.r + run.player.r + 2) {
    damagePlayer(run, e.touchDmg);
    e.hp = 0;
    emit(run, 'enemyDetonate', { x: e.x, y: e.y });
  }
}

function aiStriker(run, e, dt) {
  if (e.dashT > 0) {
    e.x += e.dashDirx * e.speed * STRIKER.DASH_MULT * dt;
    e.y += e.dashDiry * e.speed * STRIKER.DASH_MULT * dt;
    e.dashT -= dt;
  } else {
    e.dashCd -= dt;
    seek(e, run.player.x, run.player.y, e.speed, dt);
    if (e.dashCd <= 0 && dist(e, run.player) < STRIKER.DASH_RANGE) {
      const d = Math.hypot(run.player.x - e.x, run.player.y - e.y) || 1;
      e.dashDirx = (run.player.x - e.x) / d;
      e.dashDiry = (run.player.y - e.y) / d;
      e.dashT = STRIKER.DASH_TIME;
      e.dashCd = STRIKER.DASH_COOLDOWN;
      emit(run, 'enemyDash', { x: e.x, y: e.y });
    }
  }
  if (dist(e, run.player) <= e.r + run.player.r + 2) {
    damagePlayer(run, e.touchDmg);
    e.hp = 0;
  }
}

function aiWeaver(run, e, dt) {
  seek(e, run.player.x, run.player.y, e.speed, dt);
  if (dist(e, run.player) <= e.r + run.player.r + 2) {
    damagePlayer(run, e.touchDmg);
    run.player.webT = 1.5;
    e.hp = 0;
    emit(run, 'webTrap', { x: e.x, y: e.y });
  }
}

function aiShuttle(run, e, dt) {
  // 出生即锁定一个方向，直线贯穿场地
  if (!e._dir) {
    const ang = Math.atan2(run.player.y - e.y, run.player.x - e.x);
    e._dir = { x: Math.cos(ang), y: Math.sin(ang) };
  }
  e.x += e._dir.x * e.speed * dt;
  e.y += e._dir.y * e.speed * dt;
  if (e.x < -60 || e.x > W + 60 || e.y < -60 || e.y > H + 60) {
    e.hp = 0; // 飞出场地即消失
    return;
  }
  if (dist(e, run.player) <= e.r + run.player.r + 2) {
    damagePlayer(run, e.touchDmg);
    e.hp = 0;
  }
}

function aiTurret(run, e, dt) {
  const d = dist(e, run.player);
  if (d < 240) seek(e, run.player.x, run.player.y, -e.speed, dt);
  else if (d > 380) seek(e, run.player.x, run.player.y, e.speed, dt);
  e.fireCd -= dt;
  if (e.fireCd <= 0 && d < 620) {
    e.fireCd = ENEMY_TYPES.turret.fireGap;
    const ang = Math.atan2(run.player.y - e.y, run.player.x - e.x);
    run.enemyBullets.push({
      id: run.nextId++,
      x: e.x, y: e.y,
      vx: Math.cos(ang) * ENEMY.BULLET_SPEED,
      vy: Math.sin(ang) * ENEMY.BULLET_SPEED,
      r: ENEMY.BULLET_R,
      dmg: ENEMY_TYPES.turret.bulletDmg,
    });
    emit(run, 'enemyShot', { x: e.x, y: e.y });
  }
}

function aiBoss(run, e, dt) {
  seek(e, run.player.x, run.player.y, BOSS.DRIFT, dt);
  e.fireCd -= dt;
  if (e.fireCd <= 0) {
    e.fireCd = BOSS.ATTACK_GAP;
    if (run.rng() < 0.5) bossLaser(run, e);
    else bossBombs(run, e);
  }
}

function bossLaser(run, e) {
  const base = Math.atan2(run.player.y - e.y, run.player.x - e.x);
  const arc = (BOSS.LASER_ARC * Math.PI) / 180;
  for (let i = 0; i < BOSS.LASER_COUNT; i += 1) {
    const ang = base - arc / 2 + (arc * i) / (BOSS.LASER_COUNT - 1);
    run.enemyBullets.push({
      id: run.nextId++,
      x: e.x, y: e.y,
      vx: Math.cos(ang) * BOSS.LASER_SPEED,
      vy: Math.sin(ang) * BOSS.LASER_SPEED,
      r: 7, dmg: BOSS.LASER_DMG,
    });
  }
  emit(run, 'bossLaser', { x: e.x, y: e.y });
}

function bossBombs(run, e) {
  for (let i = 0; i < 3; i += 1) {
    const ang = Math.atan2(run.player.y - e.y, run.player.x - e.x) + (run.rng() - 0.5) * 1.2;
    const sp = 240 + run.rng() * 120;
    run.enemyBullets.push({
      id: run.nextId++,
      x: e.x, y: e.y,
      vx: Math.cos(ang) * sp,
      vy: Math.sin(ang) * sp,
      r: 8, dmg: BOSS.BOMB_DMG,
    });
  }
  emit(run, 'bossBomb', { x: e.x, y: e.y });
}

// ---------- 伤害 / 击杀 ----------
function damageEnemy(run, e, dmg) {
  if (e.hp <= 0) return;
  e.hp -= dmg;
  if (e.type === 'boss') emit(run, 'bossHit', { hp: Math.max(0, e.hp) });
  if (e.hp <= 0) killEnemy(run, e);
}

function killEnemy(run, e) {
  e.hp = Math.min(0, e.hp);
  run.stats.kills += 1;
  emit(run, 'kill', { x: e.x, y: e.y, enemyType: e.type, score: e.score });
  if (run.cards.killHeal) {
    run.player.armor = clamp(run.player.armor + 2, 0, run.player.maxArmor);
  }
  if (e.type === 'boss') {
    emit(run, 'bossBreak', { x: e.x, y: e.y });
    // 死亡分裂成突袭者
    for (let i = 0; i < BOSS.SPLIT_COUNT; i += 1) {
      const raider = ENEMY_TYPES.raider;
      run.enemies.push({
        id: run.nextId++,
        type: 'raider',
        x: e.x + (run.rng() - 0.5) * 60,
        y: e.y + (run.rng() - 0.5) * 60,
        r: raider.r, hp: Math.round(raider.hp * hpMult(run.wave)), maxHp: 1,
        speed: raider.speed, touchDmg: raider.touchDmg, color: raider.color, score: raider.score,
        dashCd: 0, dashT: 0, dashDirx: 0, dashDiry: 0, fireCd: 0, spawnT: 0,
      });
    }
  }
}

function damagePlayer(run, dmg) {
  const p = run.player;
  if (run.time < p.hurtCd) return; // 无敌窗口
  p.hurtCd = run.time + HURT.INVULN;
  p.armorRegenDelay = run.time + (run.cards.armorRegen ? 2 : PLAYER.ARMOR_REGEN_DELAY);
  let remaining = dmg;
  const absorbed = Math.min(p.armor, remaining * DAMAGE.ARMOR_ABSORB);
  p.armor -= absorbed;
  remaining -= absorbed;
  p.hp -= remaining;
  emit(run, 'playerHurt', { dmg, hp: Math.max(0, p.hp), armor: Math.max(0, p.armor) });
  if (p.hp <= 0) die(run);
}

function regenArmor(run, dt) {
  const p = run.player;
  if (p.armor < p.maxArmor && run.time >= p.armorRegenDelay && p.hp > 0) {
    p.armor = clamp(p.armor + PLAYER.ARMOR_REGEN * dt, 0, p.maxArmor);
  }
}

function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { wave: run.wave, kills: run.stats.kills });
}

// ---------- 波次 ----------
function startWave(run, n) {
  if (n > WAVE_COUNT) return;
  run.wave = n;
  run.spawnQueue = buildSpawnQueue(n);
  run.spawnTimer = 0;
  run.stats.waveReached = Math.max(run.stats.waveReached, n);
  emit(run, 'waveStart', { wave: n, scene: waveAt(n).scene, boss: !!waveAt(n).boss });
}

function checkWaveClear(run) {
  if (run.cardOffer || run.phase !== 'playing') return;
  if (run.spawnQueue.length > 0 || run.enemies.length > 0) return;
  if (run.wave >= WAVE_COUNT) {
    run.phase = 'won';
    emit(run, 'win', { wave: run.wave, kills: run.stats.kills });
    return;
  }
  emit(run, 'waveClear', { wave: run.wave });
  run.cardOffer = true;
  run.cardChoices = drawChoices(run, run.rng);
  emit(run, 'cardOffer', { ids: run.cardChoices.map((c) => c.id) });
}

function chooseCard(run, i) {
  if (!run.cardOffer || run.phase !== 'playing') return false;
  const card = run.cardChoices[i];
  if (!card) return false;
  card.apply(run);
  run.cards[card.id] = true;
  run.cardOffer = false;
  emit(run, 'cardPick', { id: card.id, kind: card.kind });
  emit(run, 'upgrade', { id: card.id });
  startWave(run, run.wave + 1);
  return true;
}

// ---------- 朝向 / 目标 ----------
function nearestEnemy(run, ex, ey) {
  let best = null;
  let bestD = Infinity;
  for (const e of run.enemies) {
    if (e.hp <= 0) continue;
    const d = Math.hypot(e.x - ex, e.y - ey);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function nearestEnemyAngle(run, p) {
  const e = nearestEnemy(run, p.x, p.y);
  if (e) return Math.atan2(e.y - p.y, e.x - p.x);
  return p.aim;
}

function nearestEnemyExcept(run, except, x, y) {
  let best = null;
  let bestD = Infinity;
  for (const e of run.enemies) {
    if (e.hp <= 0 || e.id === except.id) continue;
    const d = Math.hypot(e.x - x, e.y - y);
    if (d < bestD) { bestD = d; best = e; }
  }
  return best;
}

function updateAim(run) {
  const p = run.player;
  const e = nearestEnemy(run, p.x, p.y);
  if (e) p.aim = Math.atan2(e.y - p.y, e.x - p.x);
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const boss = run.enemies.find((e) => e.type === 'boss' && e.hp > 0);
  const thr = run.cards.overloadSpike ? 0.45 : OVERLOAD.HP_THRESHOLD;
  return {
    wave: run.wave,
    scene: run.wave > 0 ? waveAt(run.wave).scene : 0,
    hp: Math.max(0, run.player.hp),
    maxHp: run.player.maxHp,
    armor: Math.max(0, run.player.armor),
    maxArmor: run.player.maxArmor,
    kills: run.stats.kills,
    hostiles: run.enemies.filter((e) => e.hp > 0).length,
    coreOnline: run.core.online,
    coreOfflineSec: run.core.online ? 0 : Math.max(0, run.core.offlineUntil - run.time),
    overloadReady: run.core.online && run.player.hp / run.player.maxHp < thr,
    syncReady: run.core.online && run.syncCd <= 0,
    bossHp: boss ? Math.max(0, boss.hp) : 0,
    bossMax: boss ? boss.maxHp : 0,
    cardOffer: run.cardOffer,
    cardChoices: run.cardChoices.map((c) => ({ id: c.id, kind: c.kind })),
    phase: run.phase,
    waveReached: run.stats.waveReached,
    aim: run.player.aim,
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

// 供渲染/调试读取世界常量
export { WORLD };
