// 赤色要塞 · M1 完整模拟层
// 纯逻辑，不碰 DOM/window/localStorage/Date.now/performance。
// 随机全部走 seeded RNG。
import { WORLD, CAMERA, PLAYER, WEAPON, POW } from '../../config/game.config.js';
import { STAGES, stageAt } from '../../config/levels.js';
import { ENEMY_TYPES, ENEMY_BULLET } from '../../config/enemies.js';
import { UPGRADES } from '../../config/upgrades.js';
import { generateMap, isWalkable, findWalkableInRect, destroySandbag } from './level.js';
import { mulberry32, rngInt, rngWeighted } from './rng.js';

const TILE = WORLD.TILE;
const DT = WORLD.STEP;

// ─── emptyMods ───
export function emptyMods() {
  return {
    pierce: 0, extraBullets: 0, grenadeRadius: 0, grenadeDmg: 0,
    speedMul: 0, maxHp: 0, maxGrenades: 0, fullHealOnStage: 0,
    pickupMul: 0, autoCollect: 0, mgCdMul: 0, grenadeCdMul: 0,
    mgRate: 0,
  };
}

// ─── Math helpers ───
function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }
function dist2(ax, ay, bx, by) { const dx = ax - bx, dy = ay - by; return dx * dx + dy * dy; }
function dist(ax, ay, bx, by) { return Math.sqrt(dist2(ax, ay, bx, by)); }
function lerp(a, b, t) { return a + (b - a) * t; }
function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// ─── Entity factories ───
function makeBullet(run, x, y, angle, owner, weapon, dmg, speed, life) {
  return {
    id: run.nextId++, kind: 'bullet', type: weapon, owner,
    x, y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
    r: weapon === 'mg' ? WEAPON.MG.R : ENEMY_BULLET.r,
    angle, dmg, speed, life, maxLife: life, t: 0,
    hp: 1, maxHp: 1, state: 'fly', dead: false,
    pierce: 0, hitList: [],
  };
}

function makeGrenade(run, x, y, landX, landY, mods) {
  return {
    id: run.nextId++, kind: 'grenade', type: 'grenade', owner: 'player',
    x, y, startX: x, startY: y, landX, landY,
    vx: 0, vy: 0, r: WEAPON.GRENADE.R, z: 0,
    hp: 1, maxHp: 1, angle: 0, t: 0,
    life: WEAPON.GRENADE.FLIGHT,
    state: 'fly', dead: false,
    radius: WEAPON.GRENADE.RADIUS * (1 + (mods.grenadeRadius || 0)),
    dmg: WEAPON.GRENADE.DMG + (mods.grenadeDmg || 0),
  };
}

function makeEnemy(run, type, x, y, stage) {
  const def = ENEMY_TYPES[type];
  if (!def) return null;
  const hpMul = stage.scale.hp || 1;
  const fireMul = stage.scale.fire || 1;
  return {
    id: run.nextId++, kind: 'enemy', type,
    x, y, vx: 0, vy: 0, r: def.r,
    hp: Math.ceil(def.hp * hpMul), maxHp: Math.ceil(def.hp * hpMul),
    angle: Math.PI / 2, t: 0, life: 0,
    owner: 'enemy', dmg: def.dmg || 1, speed: def.speed,
    state: 'idle', dead: false,
    ai: {
      fireCd: def.fireCd / fireMul + run.rng() * 0.5,
      moveState: 'approach',
      burstLeft: 0, burstCd: 0,
      mortarFuse: 0, mortarTargetX: 0, mortarTargetY: 0,
      summonCd: 5,
      strafeDir: run.rng() > 0.5 ? 1 : -1,
      strafeCd: 0,
    },
  };
}

function makePow(run, x, y) {
  return {
    id: run.nextId++, kind: 'pow', type: 'pow',
    x, y, vx: 0, vy: 0, r: POW.R,
    hp: POW.HP, maxHp: POW.HP,
    angle: 0, t: run.rng() * Math.PI * 2, life: 0,
    owner: 'neutral', state: 'idle', dead: false,
    trailIdx: 0,
  };
}

// ─── Map collision ───
// 圆形 vs 瓦片：检查 AABB 覆盖到的每个阻挡格，做 circle-AABB 距离判定。
// 取代旧的「4 点采样 + 边缘吸附」，后者会把车吸进水里且永久卡死。
function blockedAt(map, x, y, r) {
  if (x - r < 0 || y - r < 0 || x + r > WORLD.W || y + r > map.levelH) return true;
  const minTx = Math.floor((x - r) / TILE);
  const maxTx = Math.floor((x + r) / TILE);
  const minTy = Math.floor((y - r) / TILE);
  const maxTy = Math.floor((y + r) / TILE);
  for (let ty = minTy; ty <= maxTy; ty += 1) {
    for (let tx = minTx; tx <= maxTx; tx += 1) {
      if (isWalkable(map, tx * TILE, ty * TILE)) continue;
      const nx = clamp(x, tx * TILE, tx * TILE + TILE);
      const ny = clamp(y, ty * TILE, ty * TILE + TILE);
      const dx = x - nx;
      const dy = y - ny;
      if (dx * dx + dy * dy < r * r) return true;
    }
  }
  return false;
}

// ─── Player update ───
function updatePlayer(run, input) {
  const p = run.player;
  if (!p.alive) return;
  const maxSpeed = PLAYER.MAX_SPEED * (1 + (run.mods.speedMul || 0));

  p.vx += (input.mx || 0) * PLAYER.ACCEL * DT;
  p.vy += (input.my || 0) * PLAYER.ACCEL * DT;
  const friction = Math.min(1, PLAYER.FRICTION * DT);
  p.vx -= p.vx * friction;
  p.vy -= p.vy * friction;

  const sp = Math.hypot(p.vx, p.vy);
  if (sp > maxSpeed) {
    p.vx = (p.vx / sp) * maxSpeed;
    p.vy = (p.vy / sp) * maxSpeed;
  }

  if (sp > 10) {
    const want = Math.atan2(p.vy, p.vx);
    p.hullAngle += clamp(angleDiff(p.hullAngle, want), -8 * DT, 8 * DT);
  }

  if (input.aimX != null) {
    const want = Math.atan2(input.aimY - p.y, input.aimX - p.x);
    const maxTurn = PLAYER.TURRET_TURN * DT;
    p.angle += clamp(angleDiff(p.angle, want), -maxTurn, maxTurn);
  }

  const nx = p.x + p.vx * DT;
  const ny = p.y + p.vy * DT;
  const stuck = blockedAt(run.map, p.x, p.y, p.r); // 兜底：万一已在阻挡格内，允许移动逃出
  if (stuck || !blockedAt(run.map, nx, p.y, p.r)) p.x = nx;
  else p.vx = 0;
  if (stuck || !blockedAt(run.map, p.x, ny, p.r)) p.y = ny;
  else p.vy = 0;

  run.cameraY = Math.max(0, Math.min(run.cameraY, p.y - CAMERA.FOLLOW_Y));
  p.x = clamp(p.x, CAMERA.MIN_X, CAMERA.MAX_X);
  p.y = clamp(p.y, run.cameraY + CAMERA.MIN_SCREEN_Y, run.cameraY + CAMERA.MAX_SCREEN_Y);

  if (p.invuln > 0) p.invuln -= DT;
  if (p.fireCd > 0) p.fireCd -= DT;
  if (p.grenadeCd > 0) p.grenadeCd -= DT;

  run.breadcrumbs.push(p.x, p.y);
  if (run.breadcrumbs.length > 1200) run.breadcrumbs.splice(0, 2);

  if (input.fire && p.fireCd <= 0) {
    fireMG(run);
    const cdMul = Math.max(0.3, 1 + (run.mods.mgCdMul || 0) - (run.mods.mgRate || 0));
    p.fireCd = WEAPON.MG.CD * cdMul;
  }

  if (input.grenade && p.grenadeCd <= 0 && p.grenades > 0) {
    fireGrenade(run, input);
    p.grenadeCd = WEAPON.GRENADE.CD * Math.max(0.3, 1 + (run.mods.grenadeCdMul || 0));
    p.grenades -= 1;
  }
}

function fireMG(run) {
  const p = run.player;
  const baseAngle = p.angle;
  const extra = run.mods.extraBullets || 0;
  spawnMGBullet(run, p.x, p.y, baseAngle);
  for (let i = 0; i < extra; i += 2) {
    const offset = ((i / 2) + 1) * 0.174;
    spawnMGBullet(run, p.x, p.y, baseAngle + offset);
    spawnMGBullet(run, p.x, p.y, baseAngle - offset);
  }
  run.stats.shots += 1 + extra;
  run.events.push({ type: 'shot', x: p.x, y: p.y, angle: baseAngle, weapon: 'mg' });
}

function spawnMGBullet(run, x, y, angle) {
  const jitter = (run.rng() - 0.5) * WEAPON.MG.SPREAD * 2;
  const b = makeBullet(run,
    x + Math.cos(angle) * 20, y + Math.sin(angle) * 20,
    angle + jitter, 'player', 'mg',
    WEAPON.MG.DMG, WEAPON.MG.SPEED, WEAPON.MG.LIFE
  );
  b.pierce = run.mods.pierce || 0;
  run.entities.push(b);
}

function fireGrenade(run, input) {
  const p = run.player;
  const dx = input.aimX - p.x;
  const dy = input.aimY - p.y;
  const d = Math.hypot(dx, dy);
  const range = Math.min(d, WEAPON.GRENADE.RANGE);
  const nx = d > 0 ? dx / d : 0;
  const ny = d > 0 ? dy / d : -1;
  const g = makeGrenade(run, p.x, p.y, p.x + nx * range, p.y + ny * range, run.mods);
  run.entities.push(g);
  run.events.push({ type: 'shot', x: p.x, y: p.y, angle: Math.atan2(ny, nx), weapon: 'grenade' });
}

// ─── Explosion ───
function explodeAt(run, cx, cy, radius, centerDmg, kind) {
  const minDmg = WEAPON.GRENADE.MIN_DMG;
  for (const e of run.entities) {
    if (e.dead) continue;
    if (e.kind === 'enemy') {
      const d = dist(cx, cy, e.x, e.y);
      if (d < radius + e.r) {
        const falloff = 1 - clamp(d / radius, 0, 1);
        damageEntity(run, e, Math.max(minDmg, centerDmg * falloff));
      }
    }
    if (e.kind === 'bullet' && e.owner === 'enemy') {
      if (dist(cx, cy, e.x, e.y) < radius) e.dead = true;
    }
  }
  if (run.boss && run.boss.active && run.boss.type === 'boss') {
    for (const node of run.boss.nodes) {
      if (!node.alive) continue;
      const d = dist(cx, cy, node.x, node.y);
      if (d < radius + 30) {
        const falloff = 1 - clamp(d / radius, 0, 1);
        damageBossNode(run, node, Math.max(minDmg, centerDmg * falloff));
      }
    }
    if (run.boss.shield <= 0 && run.boss.core) {
      const d = dist(cx, cy, run.boss.core.x, run.boss.core.y);
      if (d < radius + run.boss.core.r) {
        const falloff = 1 - clamp(d / radius, 0, 1);
        damageBossCore(run, Math.max(minDmg, centerDmg * falloff));
      }
    }
  }
  const tx0 = Math.floor((cx - radius) / TILE);
  const tx1 = Math.ceil((cx + radius) / TILE);
  const ty0 = Math.floor((cy - radius) / TILE);
  const ty1 = Math.ceil((cy + radius) / TILE);
  for (let ty = ty0; ty <= ty1; ty++) {
    for (let tx = tx0; tx <= tx1; tx++) {
      if (dist(cx, cy, tx * TILE + TILE / 2, ty * TILE + TILE / 2) < radius) {
        destroySandbag(run.map, tx, ty);
      }
    }
  }
  run.events.push({ type: 'explode', x: cx, y: cy, radius, kind });
  run.events.push({ type: 'shock', power: clamp(radius / 200, 0.2, 1.0) });
}

// ─── Damage ───
function damageEntity(run, e, dmg) {
  if (e.dead) return;
  e.hp -= dmg;
  run.stats.hits += 1;
  run.events.push({ type: 'hit', x: e.x, y: e.y, dmg, targetId: e.id, kind: e.kind });
  if (e.hp <= 0) {
    e.dead = true;
    e.state = 'dead';
    if (e.kind === 'enemy') {
      const score = ENEMY_TYPES[e.type]?.score || 0;
      run.stats.kills += 1;
      run.stats.score += score;
      run.events.push({ type: 'kill', x: e.x, y: e.y, etype: e.type, score, big: score >= 300 });
    } else if (e.kind === 'pow') {
      run.events.push({ type: 'powDown', x: e.x, y: e.y });
    }
  }
}

function damageBossNode(run, node, dmg) {
  node.hp -= dmg;
  run.stats.hits += 1;
  if (node.hp <= 0 && node.alive) {
    node.alive = false;
    node.hp = 0;
    const left = run.boss.nodes.filter(n => n.alive).length;
    run.stats.score += 200;
    run.events.push({ type: 'bossNodeDown', x: node.x, y: node.y, left });
    run.events.push({ type: 'shock', power: 0.6 });
    if (left === 0) {
      run.boss.shield = 0;
      run.boss.phase = 2;
      run.events.push({ type: 'bossPhase', phase: 2 });
    }
  }
}

function damageBossCore(run, dmg) {
  if (!run.boss || run.boss.shield > 0) return;
  run.boss.core.hp -= dmg;
  run.boss.hp = run.boss.core.hp;
  run.stats.hits += 1;
  if (run.boss.core.hp <= 0) {
    run.boss.core.hp = 0;
    run.boss.hp = 0;
    run.boss.active = false;
    run.stats.score += ENEMY_TYPES.boss.score;
    run.events.push({ type: 'bossDead', x: run.boss.core.x, y: run.boss.core.y });
    run.events.push({ type: 'shock', power: 1.0 });
    run.events.push({ type: 'stageClear' });
    run.state = 'clear';
  }
}

function damagePlayer(run, dmg) {
  const p = run.player;
  if (!p.alive || p.invuln > 0) return;
  p.hp -= dmg;
  run.stats.damageTaken += dmg;
  p.invuln = PLAYER.INVULN;
  run.events.push({ type: 'playerHit', x: p.x, y: p.y, hp: p.hp, dmg });
  run.events.push({ type: 'shock', power: 0.3 });
  if (p.hp <= 2) run.events.push({ type: 'ui', kind: 'lowHp' });
  if (p.hp <= 0) {
    p.hp = 0;
    p.alive = false;
    run.events.push({ type: 'playerDead', x: p.x, y: p.y });
    run.state = 'dead';
  }
}

// ─── Enemy AI ───
function updateEnemies(run) {
  const p = run.player;
  for (const e of run.entities) {
    if (e.dead || e.kind !== 'enemy') continue;
    e.t += DT;
    e.life += DT;
    const def = ENEMY_TYPES[e.type];
    if (!def) continue;
    const d = dist(e.x, e.y, p.x, p.y);
    const aimAngle = Math.atan2(p.y - e.y, p.x - e.x);

    switch (e.type) {
      case 'rifle':
      case 'rocket': updateInfantry(run, e, def, d, aimAngle); break;
      case 'tank': updateTank(run, e, def, d, aimAngle); break;
      case 'turret': updateTurret(run, e, def, d, aimAngle); break;
      case 'mortar': updateMortar(run, e, def, d, aimAngle); break;
      case 'mine': updateMine(run, e, def, d); break;
      case 'tankboss': updateTankBoss(run, e, def, d, aimAngle); break;
    }

    if (e.y > run.cameraY + WORLD.H + 900) e.dead = true;
  }
}

function moveEnemy(run, e) {
  const nx = e.x + e.vx * DT;
  const ny = e.y + e.vy * DT;
  if (isWalkable(run.map, nx, e.y)) e.x = nx; else e.vx = 0;
  if (isWalkable(run.map, e.x, ny)) e.y = ny; else e.vy = 0;
  e.x = clamp(e.x, TILE, WORLD.W - TILE);
  e.y = clamp(e.y, TILE, run.map.levelH - TILE);
}

function enemyFire(run, e, angle, def, weapon) {
  const b = makeBullet(run,
    e.x + Math.cos(angle) * (e.r + 4),
    e.y + Math.sin(angle) * (e.r + 4),
    angle, 'enemy', weapon || 'mg',
    def.dmg || 1, def.bulletSpeed, ENEMY_BULLET.life
  );
  run.entities.push(b);
  run.events.push({ type: 'shot', x: e.x, y: e.y, angle, weapon: weapon || 'mg' });
}

function updateInfantry(run, e, def, d, aimAngle) {
  const p = run.player;
  const keepDist = def.keep || 0;

  if (d > def.range * 0.8) e.ai.moveState = 'approach';
  else if (d < keepDist) e.ai.moveState = 'retreat';
  else e.ai.moveState = 'aim';

  if (e.ai.moveState === 'approach') {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.vx = Math.cos(a) * def.speed;
    e.vy = Math.sin(a) * def.speed;
  } else if (e.ai.moveState === 'retreat') {
    const a = Math.atan2(e.y - p.y, e.x - p.x);
    e.vx = Math.cos(a) * def.speed * 0.5;
    e.vy = Math.sin(a) * def.speed * 0.5;
  } else {
    e.ai.strafeCd -= DT;
    if (e.ai.strafeCd <= 0) { e.ai.strafeDir *= -1; e.ai.strafeCd = 1 + run.rng(); }
    const sa = aimAngle + Math.PI / 2 * e.ai.strafeDir;
    e.vx = Math.cos(sa) * def.speed * 0.3;
    e.vy = Math.sin(sa) * def.speed * 0.3;
  }

  moveEnemy(run, e);
  e.angle = aimAngle;

  e.ai.fireCd -= DT;
  if (e.ai.fireCd <= 0 && d < def.range && e.ai.moveState !== 'retreat') {
    const jitter = (run.rng() - 0.5) * def.aimJitter * 2;
    enemyFire(run, e, aimAngle + jitter, def);
    e.ai.fireCd = def.fireCd;
  }
}

function updateTank(run, e, def, d, aimAngle) {
  const p = run.player;
  if (d > def.keep) {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.vx = Math.cos(a) * def.speed;
    e.vy = Math.sin(a) * def.speed;
  } else {
    e.vx *= 0.9; e.vy *= 0.9;
  }
  moveEnemy(run, e);

  const td = angleDiff(e.angle, aimAngle);
  e.angle += clamp(td, -3 * DT, 3 * DT);

  e.ai.fireCd -= DT;
  if (e.ai.fireCd <= 0 && d < def.range && Math.abs(td) < 0.3) {
    const jitter = (run.rng() - 0.5) * def.aimJitter * 2;
    enemyFire(run, e, aimAngle + jitter, def, 'cannon');
    e.ai.fireCd = def.fireCd;
  }
}

function updateTurret(run, e, def, d, aimAngle) {
  const td = angleDiff(e.angle, aimAngle);
  e.angle += clamp(td, -4 * DT, 4 * DT);

  e.ai.fireCd -= DT;
  if (e.ai.fireCd <= 0 && d < def.range && Math.abs(td) < 0.5) {
    const jitter = (run.rng() - 0.5) * def.aimJitter * 2;
    enemyFire(run, e, aimAngle + jitter, def);
    e.ai.fireCd = def.fireCd;
  }
}

function updateMortar(run, e, def, d, aimAngle) {
  const p = run.player;
  if (e.ai.mortarFuse > 0) {
    e.ai.mortarFuse -= DT;
    if (e.ai.mortarFuse <= 0) {
      const mx = e.ai.mortarTargetX, my = e.ai.mortarTargetY;
      const a = Math.atan2(my - e.y, mx - e.x);
      const b = makeBullet(run, e.x, e.y, a, 'enemy', 'mortar', def.dmg, 200, 2.5);
      b.landX = mx; b.landY = my; b.startX = e.x; b.startY = e.y;
      b.mortarTarget = true;
      run.entities.push(b);
      run.events.push({ type: 'shot', x: e.x, y: e.y, angle: a, weapon: 'mortar' });
    }
    return;
  }
  e.angle = aimAngle;
  e.ai.fireCd -= DT;
  if (e.ai.fireCd <= 0 && d < def.range) {
    e.ai.mortarFuse = def.fuse;
    e.ai.mortarTargetX = p.x;
    e.ai.mortarTargetY = p.y;
    e.ai.fireCd = def.fireCd;
  }
}

function updateMine(run, e, def, d) {
  if (d < def.trigger) {
    e.dead = true;
    explodeAt(run, e.x, e.y, def.radius, def.dmg, 'mine');
    if (d < def.radius) damagePlayer(run, def.dmg);
  }
}

function updateTankBoss(run, e, def, d, aimAngle) {
  const p = run.player;
  if (d > def.keep) {
    const a = Math.atan2(p.y - e.y, p.x - e.x);
    e.vx = Math.cos(a) * def.speed;
    e.vy = Math.sin(a) * def.speed;
  } else {
    e.vx *= 0.9; e.vy *= 0.9;
  }
  moveEnemy(run, e);
  e.angle = aimAngle;

  // Burst fire (3 rounds, no setTimeout — use burstCd/burstLeft)
  e.ai.burstCd -= DT;
  if (e.ai.burstLeft > 0 && e.ai.burstCd <= 0) {
    const jitter = (run.rng() - 0.5) * def.aimJitter * 2;
    enemyFire(run, e, aimAngle + jitter, def, 'cannon');
    e.ai.burstLeft -= 1;
    e.ai.burstCd = 0.15;
  }

  e.ai.fireCd -= DT;
  if (e.ai.fireCd <= 0 && d < def.range && e.ai.burstLeft <= 0) {
    e.ai.burstLeft = def.burst;
    e.ai.burstCd = 0;
    e.ai.fireCd = def.fireCd;
  }

  // Summon infantry
  e.ai.summonCd -= DT;
  if (e.ai.summonCd <= 0) {
    const count = run.entities.filter(en => en.kind === 'enemy' && en.type === 'rifle' && !en.dead).length;
    if (count < 6) {
      for (let i = 0; i < 2; i++) {
        const sx = e.x + (run.rng() - 0.5) *200;
        const sy = e.y + 50 + run.rng() * 100;
        const inf = makeEnemy(run, 'rifle', sx, sy, run.stage);
        if (inf) run.entities.push(inf);
      }
    }
    e.ai.summonCd = 5;
  }
}

// ─── Bullet update ───
function updateBullets(run) {
  for (const b of run.entities) {
    if (b.dead || b.kind !== 'bullet') continue;
    b.t += DT;
    if (b.t >= b.life) { b.dead = true; continue; }

    b.x += b.vx * DT;
    b.y += b.vy * DT;

    if (b.x < 0 || b.x > WORLD.W || b.y < 0 || b.y > run.map.levelH) { b.dead = true; continue; }

    const tx = Math.floor(b.x / TILE);
    const ty = Math.floor(b.y / TILE);
    if (tx >= 0 && tx < run.map.cols && ty >= 0 && ty < run.map.rows) {
      if (run.map.solid[ty * run.map.cols + tx] === 1) {
        b.dead = true;
        run.events.push({ type: 'hit', x: b.x, y: b.y, dmg: 0, targetId: 0, kind: 'wall' });
        continue;
      }
    }

    if (b.owner === 'player') {
      for (const e of run.entities) {
        if (e.dead || e.kind !== 'enemy') continue;
        if (b.hitList.includes(e.id)) continue;
        if (dist2(b.x, b.y, e.x, e.y) < (b.r + e.r) * (b.r + e.r)) {
          damageEntity(run, e, b.dmg);
          b.hitList.push(e.id);
          if (b.pierce <= 0) { b.dead = true; break; }
          b.pierce -= 1;
        }
      }
      // 要塞核心：机枪必须能打炮节点/核心（否则 Boss 只能靠手雷，实际不可通关）
      if (!b.dead && run.boss && run.boss.active && run.boss.type === 'boss') {
        for (const node of run.boss.nodes) {
          if (!node.alive) continue;
          const key = `n${node.id}`;
          if (b.hitList.includes(key)) continue;
          if (dist2(b.x, b.y, node.x, node.y) < (b.r + 26) * (b.r + 26)) {
            damageBossNode(run, node, b.dmg);
            b.hitList.push(key);
            if (b.pierce <= 0) { b.dead = true; break; }
            b.pierce -= 1;
          }
        }
        if (!b.dead && run.boss.shield <= 0 && run.boss.core) {
          const core = run.boss.core;
          if (dist2(b.x, b.y, core.x, core.y) < (b.r + core.r) * (b.r + core.r)) {
            damageBossCore(run, b.dmg);
            b.dead = true;
          }
        }
      }
    } else {
      const p = run.player;
      if (p.alive && p.invuln <= 0 && dist2(b.x, b.y, p.x, p.y) < (b.r + p.r) * (b.r + p.r)) {
        damagePlayer(run, b.dmg);
        b.dead = true;
        continue;
      }
      for (const pw of run.entities) {
        if (pw.dead || pw.kind !== 'pow' || pw.state !== 'follow') continue;
        if (dist2(b.x, b.y, pw.x, pw.y) < (b.r + pw.r) * (b.r + pw.r)) {
          damageEntity(run, pw, b.dmg);
          b.dead = true;
          break;
        }
      }
    }
  }
}

// ─── Grenade update ───
function updateGrenades(run) {
  for (const g of run.entities) {
    if (g.dead || g.kind !== 'grenade') continue;
    g.t += DT;
    const progress = g.t / g.life;
    if (progress >= 1) {
      explodeAt(run, g.landX, g.landY, g.radius, g.dmg, 'grenade');
      g.dead = true;
      continue;
    }
    g.x = lerp(g.startX, g.landX, progress);
    g.y = lerp(g.startY, g.landY, progress);
    g.z = Math.sin(progress * Math.PI);
  }
}

// ─── POW update ───
function updatePOWs(run) {
  const p = run.player;
  for (const pw of run.entities) {
    if (pw.dead || pw.kind !== 'pow') continue;
    pw.t += DT;

    if (pw.state === 'idle') {
      const pickupR = PLAYER.PICKUP_R * (1 + (run.mods.pickupMul || 0));
      const d = dist(pw.x, pw.y, p.x, p.y);
      if (d < pickupR && p.pow < p.maxPow) {
        pw.state = 'follow';
        pw.trailIdx = Math.max(0, run.breadcrumbs.length / 2 - 10);
        p.pow += 1;
        run.stats.rescued += 1;
        run.events.push({ type: 'powPickup', x: pw.x, y: pw.y, count: 1 });
      } else if (run.mods.autoCollect && d < pickupR * 1.8) {
        const a = Math.atan2(p.y - pw.y, p.x - pw.x);
        pw.x += Math.cos(a) * 120 * DT;
        pw.y += Math.sin(a) * 120 * DT;
      }
    } else if (pw.state === 'follow') {
      const idx = Math.floor(pw.trailIdx) * 2;
      if (idx >= 0 && idx < run.breadcrumbs.length - 1) {
        const targetX = run.breadcrumbs[idx];
        const targetY = run.breadcrumbs[idx + 1];
        const d = dist(pw.x, pw.y, targetX, targetY);
        if (d > POW.GAP) {
          const a = Math.atan2(targetY - pw.y, targetX - pw.x);
          const speed = PLAYER.MAX_SPEED * (1 + (run.mods.speedMul || 0)) * POW.SPEED_MUL;
          pw.x += Math.cos(a) * speed * DT;
          pw.y += Math.sin(a) * speed * DT;
        } else {
          pw.trailIdx += 1;
        }
      }
    }
  }

  // Delivery
  if (p.pow > 0) {
    for (const zone of run.zones) {
      if (zone.type !== 'helipad') continue;
      if (p.x >= zone.x && p.x <= zone.x + zone.w &&
          p.y >= zone.y && p.y <= zone.y + zone.h) {
        run.deliverCd -= DT;
        if (run.deliverCd <= 0 && p.pow > 0) {
          p.pow -= 1;
          run.stats.delivered += 1;
          run.stats.score += POW.SCORE;
          p.grenades = Math.min(p.maxGrenades, p.grenades + POW.GRENADE);
          p.hp = Math.min(p.maxHp, p.hp + POW.HEAL);
          run.events.push({ type: 'deliver', x: p.x, y: p.y, count: 1, delivered: run.stats.delivered });
          checkMilestones(run);
          run.deliverCd = POW.DELIVER_CD;
        }
        break;
      }
    }
  }
}

function checkMilestones(run) {
  if (run.stats.delivered >= POW.GOAL_RATE && !run.milestones.rate) {
    run.milestones.rate = true;
    run.mods.mgRate = (run.mods.mgRate || 0) + 0.15;
    run.events.push({ type: 'deliverMilestone', kind: 'rate', delivered: run.stats.delivered });
  }
  if (run.stats.delivered >= POW.GOAL_AIRSTRIKE && !run.milestones.airstrike) {
    run.milestones.airstrike = true;
    triggerAirstrike(run);
    run.events.push({ type: 'deliverMilestone', kind: 'airstrike', delivered: run.stats.delivered });
  }
}

// ─── Airstrike (deferred bombs, no setTimeout) ───
function triggerAirstrike(run) {
  const p = run.player;
  run.events.push({ type: 'airstrike', x: p.x, y: p.y - 320 });
  run.events.push({ type: 'heliIn', x: p.x, y: p.y - 400 });
  // Queue 9 bombs (3 waves × 3 bombs)
  run.deferred = run.deferred || [];
  for (let wave = 0; wave < 3; wave++) {
    for (let i = 0; i < 3; i++) {
      const tx = p.x + (i - 1) * 180 + (run.rng() - 0.5) * 60;
      const ty = p.y - 200 - wave * 200 + (run.rng() - 0.5) * 60;
      run.deferred.push({
        time: run.time + wave * 0.25 + i * 0.08,
        fn: 'airstrikeBomb',
        args: { cx: tx, cy: ty },
      });
    }
  }
}

function processDeferred(run) {
  if (!run.deferred || run.deferred.length === 0) return;
  const remaining = [];
  for (const d of run.deferred) {
    if (run.time >= d.time && run.state === 'fight') {
      if (d.fn === 'airstrikeBomb') {
        explodeAt(run, d.args.cx, d.args.cy, 130, 6, 'airstrike');
      }
    } else {
      remaining.push(d);
    }
  }
  run.deferred = remaining;
}

// ─── Boss update ───
function updateBoss(run) {
  if (!run.boss || !run.boss.active) return;
  const boss = run.boss;
  const p = run.player;
  const def = ENEMY_TYPES.boss;

  boss.t += DT;

  if (boss.type === 'tankboss') return; // handled in updateEnemies

  for (const node of boss.nodes) {
    if (!node.alive) continue;
    node.angle = Math.atan2(p.y - node.y, p.x - node.x);
    node.fireCd -= DT;
    if (node.fireCd <= 0) {
      const b = makeBullet(run, node.x, node.y, node.angle, 'enemy', 'cannon', def.dmg, def.bulletSpeed, ENEMY_BULLET.life);
      run.entities.push(b);
      node.fireCd = def.fireCd;
      run.events.push({ type: 'shot', x: node.x, y: node.y, angle: node.angle, weapon: 'cannon' });
    }
  }

  if (boss.phase >= 2 && boss.core) {
    boss.core.fireCd -= DT;
    if (boss.core.fireCd <= 0) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const b = makeBullet(run, boss.core.x, boss.core.y, a, 'enemy', 'cannon', def.dmg, def.bulletSpeed * 0.8, ENEMY_BULLET.life);
        run.entities.push(b);
      }
      boss.core.fireCd = def.fireCd * 1.5;
      run.events.push({ type: 'shot', x: boss.core.x, y: boss.core.y, angle: 0, weapon: 'cannon' });
    }
  }

  boss.spawnCd -= DT;
  if (boss.spawnCd <= 0) {
    const cnt = run.entities.filter(e => e.kind === 'enemy' && e.type === 'rifle' && !e.dead).length;
    if (cnt < 6) {
      for (let i = 0; i < 2; i++) {
        const side = i === 0 ? -1 : 1;
        const sx = boss.core.x + side * 200;
        const sy = boss.core.y + 100;
        const inf = makeEnemy(run, 'rifle', sx, sy, run.stage);
        if (inf) run.entities.push(inf);
      }
    }
    boss.spawnCd = def.spawnCd || 8;
  }
}

// ─── Wave spawning ───
function updateWaves(run) {
  const stage = run.stage;
  if (!stage.wave) return;
  const { every, from, to, size } = stage.wave;
  while (run.nextWaveRow >= to && run.cameraY <= run.nextWaveRow * TILE) {
    const count = Math.round(rngInt(run.rng, size[0], size[1]) * (stage.scale.count || 1));
    spawnWave(run, count);
    run.nextWaveRow -= every;
  }
}

function spawnWave(run, count) {
  const stage = run.stage;
  const mix = stage.enemyMix;
  const types = Object.keys(mix);
  const weights = types.map(t => mix[t]);
  const p = run.player;
  const spawnY = Math.max(TILE, run.cameraY - 40);
  let spawned = 0;
  let attempts = 0;

  while (spawned < count && attempts < count * 5) {
    attempts++;
    const typeIdx = rngWeighted(run.rng, weights);
    const type = types[typeIdx];
    const x = TILE * 2 + run.rng() * (WORLD.W - TILE * 4);
    const y = spawnY + run.rng() * 80;

    if (!isWalkable(run.map, x, y)) continue;
    if (dist(x, y, p.x, p.y) < 220) continue;

    let tooClose = false;
    for (const e of run.entities) {
      if (e.kind === 'enemy' && !e.dead && dist(x, y, e.x, e.y) < 30) {
        tooClose = true; break;
      }
    }
    if (tooClose) continue;

    const onScreen = run.entities.filter(e => e.kind === 'enemy' && !e.dead).length;
    if (onScreen >= 18) break;

    const enemy = makeEnemy(run, type, x, y, stage);
    if (enemy) { run.entities.push(enemy); spawned++; }
  }
}

// ─── Stage clear ───
function checkStageClear(run) {
  const stage = run.stage;
  const p = run.player;

  if (stage.boss) {
    if (stage.boss.type === 'tankboss') {
      const tb = run.entities.find(e => e.kind === 'enemy' && e.type === 'tankboss');
      if ((!tb || tb.dead) && run.cameraY <= 0 && p.y < 200) {
        run.state = 'clear';
        run.events.push({ type: 'stageClear' });
      }
    }
    return;
  }

  if (run.cameraY <= 0 && p.y < 140) {
    run.state = 'clear';
    run.events.push({ type: 'stageClear' });
  }
}

// ─── Boss activation ───
function checkBossAwake(run) {
  const stage = run.stage;
  if (!stage.boss || run.boss) return;
  if (run.cameraY < 12 * TILE) {
    if (stage.boss.type === 'tankboss') {
      const boss = makeEnemy(run, 'tankboss', WORLD.W / 2, 8 * TILE + 100, stage);
      if (boss) {
        run.entities.push(boss);
        run.boss = { active: true, type: 'tankboss', entity: boss, hp: boss.hp, maxHp: boss.maxHp, shield: 0, phase: 1, x: boss.x, y: boss.y };
      }
    } else if (stage.boss.type === 'boss') {
      const def = ENEMY_TYPES.boss;
      const cx = WORLD.W / 2;
      const cy = 4 * TILE + def.h / 2;
      run.boss = {
        active: true, type: 'boss',
        x: cx, y: cy, w: def.w, h: def.h,
        hp: def.coreHp, maxHp: def.coreHp,
        shield: 1, phase: 1, t: 0, spawnCd: 5,
        nodes: [
          { id: 0, x: cx - def.w / 2 + 40, y: cy - def.h / 2 + 40, hp: def.nodeHp, maxHp: def.nodeHp, alive: true, angle: 0, fireCd: def.fireCd },
          { id: 1, x: cx + def.w / 2 - 40, y: cy - def.h / 2 + 40, hp: def.nodeHp, maxHp: def.nodeHp, alive: true, angle: 0, fireCd: def.fireCd },
          { id: 2, x: cx - def.w / 2 + 40, y: cy + def.h / 2 - 40, hp: def.nodeHp, maxHp: def.nodeHp, alive: true, angle: 0, fireCd: def.fireCd },
          { id: 3, x: cx + def.w / 2 - 40, y: cy + def.h / 2 - 40, hp: def.nodeHp, maxHp: def.nodeHp, alive: true, angle: 0, fireCd: def.fireCd },
        ],
        core: { x: cx, y: cy, r: 40, hp: def.coreHp, maxHp: def.coreHp, fireCd: def.fireCd },
      };
      // 最终决战前的补给空投：修满装甲、补满手雷（不是作弊，是对所有玩家一致的规则）
      run.player.hp = run.player.maxHp;
      run.player.grenades = run.player.maxGrenades;
      run.events.push({ type: 'resupply', x: run.player.x, y: run.player.y });
    }
    run.events.push({ type: 'bossAwake', x: run.boss.x || WORLD.W / 2, y: run.boss.y || 8 * TILE });
    run.events.push({ type: 'shock', power: 0.7 });
  }
}

// ─── createRun ───
export function createRun(opts = {}) {
  const stageIndex = opts.stageIndex ?? 0;
  const stage = stageAt(stageIndex);
  const seed = opts.seed ?? stage.seed;
  const difficulty = opts.difficulty || 'normal';
  const mods = { ...emptyMods(), ...(opts.mods || {}) };
  const maxHp = PLAYER.MAX_HP + mods.maxHp;
  const maxGrenades = PLAYER.MAX_GRENADES + mods.maxGrenades;

  const map = generateMap(stage);
  const levelH = map.levelH;
  const rng = mulberry32(seed + 1);

  const run = {
    stageIndex, stage, seed, difficulty,
    levelH, cameraY: Math.max(0, levelH - WORLD.H),
    time: 0, state: 'fight',
    map, zones: [], entities: [], boss: null,
    events: [], deferred: [],
    stats: { kills: 0, shots: 0, hits: 0, rescued: 0, delivered: 0, damageTaken: 0, time: 0, score: 0 },
    mods, picked: opts.picked || {},
    rng, nextId: 1,
    breadcrumbs: [],
    deliverCd: 0,
    milestones: { rate: false, airstrike: false },
    nextWaveRow: stage.wave ? stage.wave.from : 0,
    player: {
      x: PLAYER.START_X, y: levelH - PLAYER.START_OFFSET_Y,
      vx: 0, vy: 0,
      angle: -Math.PI / 2, hullAngle: -Math.PI / 2,
      hp: maxHp, maxHp, r: PLAYER.R, invuln: 0,
      grenades: maxGrenades, maxGrenades,
      pow: 0, maxPow: PLAYER.POW_CAP,
      fireCd: 0, grenadeCd: 0, alive: true,
    },
  };

  for (const pad of stage.helipads) {
    run.zones.push({
      type: 'helipad', row: pad.row,
      x: WORLD.W / 2 - 128, y: pad.row * TILE - 80,
      w: 256, h: 160,
    });
  }
  for (const camp of stage.camps) {
    const campX = WORLD.W / 2 - 256;
    run.zones.push({
      type: 'camp', row: camp.row,
      x: campX, y: camp.row * TILE - 80,
      w: 512, h: 160,
    });
    for (let i = 0; i < camp.pows; i++) {
      const pos = findWalkableInRect(run.map, campX, camp.row * TILE - 60, 512, 120, rng);
      run.entities.push(makePow(run, pos.x, pos.y));
    }
  }

  run.step = (input = {}) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => { const o = run.events; run.events = []; return o; };
  run.getUpgradeChoices = (n = 3) => {
    const pool = UPGRADES.filter(u => (run.picked[u.id] || 0) < u.max);
    return pool.slice(0, n).map(u => u.id);
  };
  run.applyUpgrade = (id) => {
    const def = UPGRADES.find(u => u.id === id);
    if (!def) return false;
    run.picked[id] = (run.picked[id] || 0) + 1;
    for (const [k, v] of Object.entries(def.effects)) {
      run.mods[k] = (run.mods[k] || 0) + v;
    }
    if (def.effects.maxHp) {
      run.player.maxHp += def.effects.maxHp;
      run.player.hp = Math.min(run.player.maxHp, run.player.hp + (def.effects.heal || 0));
    }
    if (def.effects.maxGrenades) run.player.maxGrenades += def.effects.maxGrenades;
    return true;
  };

  run.debug = {
    spawnPow(n = 3) {
      for (let i = 0; i < n; i++) {
        run.entities.push(makePow(run, run.player.x + 40 * (i + 1), run.player.y - 40));
      }
    },
    airstrike() { triggerAirstrike(run); },
    damageBoss(n = 20) {
      if (run.boss && run.boss.type === 'boss') {
        if (run.boss.shield > 0) {
          for (const node of run.boss.nodes) {
            if (node.alive) { damageBossNode(run, node, n); break; }
          }
        } else {
          damageBossCore(run, n);
        }
      } else if (run.boss && run.boss.entity) {
        damageEntity(run, run.boss.entity, n);
      }
    },
    setPlayerHp(n) { run.player.hp = clamp(n, 1, run.player.maxHp); },
    teleport(y) {
      run.player.y = clamp(y, 80, run.levelH - 80);
      run.cameraY = clamp(run.player.y - CAMERA.FOLLOW_Y, 0, run.levelH - WORLD.H);
    },
  };

  return run;
}

// ─── step ───
function step(run, input) {
  if (run.state !== 'fight') return;
  run.time += DT;
  run.stats.time = run.time;

  updatePlayer(run, input);
  updateBullets(run);
  updateGrenades(run);
  updateEnemies(run);
  updatePOWs(run);
  updateBoss(run);
  updateWaves(run);
  checkBossAwake(run);
  processDeferred(run);
  checkStageClear(run);

  run.entities = run.entities.filter(e => !e.dead);
}

// ─── getHud ───
function getHud(run) {
  const p = run.player;
  return {
    hp: p.hp, maxHp: p.maxHp, lives: PLAYER.LIVES,
    grenades: p.grenades, maxGrenades: p.maxGrenades,
    pow: p.pow, powCap: p.maxPow,
    delivered: run.stats.delivered, deliverGoal: POW.GOAL_AIRSTRIKE,
    score: run.stats.score, stage: run.stageIndex,
    stageNameKey: run.stage.nameKey,
    progress: 1 - run.cameraY / Math.max(1, run.levelH - WORLD.H),
    time: run.time,
    boss: run.boss ? {
      hp: run.boss.hp || 0, maxHp: run.boss.maxHp || 0,
      shield: run.boss.shield || 0,
      active: run.boss.active, phase: run.boss.phase || 1,
    } : null,
  };
}
