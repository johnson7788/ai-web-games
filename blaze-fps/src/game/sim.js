// src/game/sim.js — 纯逻辑模拟（不碰 DOM/window/localStorage/Date.now，随机用 seed）
// 玩法：3 图 × 5 波，3 枪 12 升级，射线命中判定（无物理引擎），后坐力 + 爆头慢镜。
// 契约：createRun(opts) -> run；updateSim(run, input)；drainEvents(run)；getHud(run)；
//       applyUpgrade(run, id)。事件总线：sim 发事件，render/audio/ui 各自消费。
import {
  STEP, PLAYER, WEAPONS, WEAPON_ORDER, ENEMIES, WAVES, MAPS, MAPS_PER_RUN, WAVES_PER_MAP,
  HP_SCALE, COUNT_SCALE, HEADSHOT_MULT, SLOWMO, HEAD_H, UPGRADES,
} from '../../config/game.config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// 确定性伪随机（与 base3d.mulberry32 同算法；此处内联以保持 sim 零 THREE 依赖）
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hasUpgrade(run, id) {
  return run.upgrades.includes(id);
}

function evt(run, type, data = {}) {
  run.events.push({ type, ...data, t: run.time });
}

function aimDir(yaw, pitch) {
  const cp = Math.cos(pitch);
  return { x: -Math.sin(yaw) * cp, y: Math.sin(pitch), z: -Math.cos(yaw) * cp };
}

// 线段 vs 竖直圆柱（只算水平 xz；返回 [0,1] 内最近 t 或 null）
function segCylinder(o, D, ex, ez, r) {
  const ox = o.x - ex, oz = o.z - ez;
  const a = D.x * D.x + D.z * D.z;
  if (a < 1e-12) return null;
  const b = 2 * (ox * D.x + oz * D.z);
  const c = ox * ox + oz * oz - r * r;
  let disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  disc = Math.sqrt(disc);
  let best = null;
  for (const t of [(-b - disc) / (2 * a), (-b + disc) / (2 * a)]) {
    if (t >= 0 && t <= 1 && (best === null || t < best)) best = t;
  }
  return best;
}

// 线段 vs AABB（slab 法；返回进入 t 或 null）
function segAABB(o, D, box) {
  let tmin = 0, tmax = 1;
  for (const axis of ['x', 'y', 'z']) {
    const od = o[axis], dd = D[axis];
    const lo = box[axis + '1'], hi = box[axis + '2'];
    if (Math.abs(dd) < 1e-12) {
      if (od < lo || od > hi) return null;
    } else {
      let t1 = (lo - od) / dd, t2 = (hi - od) / dd;
      if (t1 > t2) { const tmp = t1; t1 = t2; t2 = tmp; }
      tmin = Math.max(tmin, t1);
      tmax = Math.min(tmax, t2);
      if (tmin > tmax) return null;
    }
  }
  return tmin > 0 ? tmin : null;
}

// 圆 vs AABB 推挤（返回修正后坐标或 null）
function circleAABB(px, pz, r, ob) {
  const hx = ob.w / 2, hz = ob.d / 2;
  const cx = clamp(px, ob.x - hx, ob.x + hx);
  const cz = clamp(pz, ob.z - hz, ob.z + hz);
  let dx = px - cx, dz = pz - cz;
  const d2 = dx * dx + dz * dz;
  if (d2 >= r * r) return null;
  if (d2 > 1e-9) {
    const d = Math.sqrt(d2); dx /= d; dz /= d;
  } else {
    const ox1 = (ob.x + hx) - px, ox2 = px - (ob.x - hx);
    const oz1 = (ob.z + hz) - pz, oz2 = pz - (ob.z - hz);
    const m = Math.min(ox1, ox2, oz1, oz2);
    if (m === ox1) { dx = 1; dz = 0; } else if (m === ox2) { dx = -1; dz = 0; }
    else if (m === oz1) { dx = 0; dz = 1; } else { dx = 0; dz = -1; }
  }
  return { x: cx + dx * r, z: cz + dz * r };
}

function collideCircle(run, x, z, r) {
  let px = x, pz = z;
  const sz = MAPS[run.mapIndex].size - r;
  px = clamp(px, -sz, sz);
  pz = clamp(pz, -sz, sz);
  for (const ob of MAPS[run.mapIndex].obstacles) {
    const res = circleAABB(px, pz, r, ob);
    if (res) { px = res.x; pz = res.z; }
  }
  return { x: px, z: pz };
}

// ---------------------------------------------------------------- 构造
export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const run = {
    seed,
    rng: mulberry32(seed),
    phase: 'wave',          // wave | upgrade | victory
    waveState: 'intro',     // intro | active | clear
    introT: 0.9,
    time: 0,
    timeScale: 1,
    slowmoT: 0,
    mapIndex: 0,
    wave: 1,
    player: {
      x: 0, z: MAPS[0].size - 3, yaw: 0, pitch: 0,
      hp: PLAYER.maxHp, maxHp: PLAYER.maxHp,
      weapon: 'rifle',
      ammo: { rifle: WEAPONS.rifle.mag, shotgun: WEAPONS.shotgun.mag, pistol: WEAPONS.pistol.mag },
      reserve: { rifle: WEAPONS.rifle.reserve, shotgun: WEAPONS.shotgun.reserve, pistol: Infinity },
      energy: PLAYER.maxEnergy,
      sprinting: false,
    },
    enemies: [],
    bullets: [],
    enemyBullets: [],
    upgrades: [],
    bonuses: { dmg: 1, reserve: 1, reload: 1, speed: 1, sprintRegen: 1, maxHp: 0 },
    stats: { kills: 0, shots: 0, hits: 0, headshots: 0, deaths: 0 },
    score: 0,
    events: [],
    cooldown: 0, reloadT: 0, recoil: 0, muzzle: 0, hurt: 0,
    lastDamage: -99,
    aiming: false,
    upgradeChoices: [], upgradeT: 0,
  };
  return run;
}

function refillReserve(run) {
  const p = run.player;
  p.reserve.rifle = Math.round(WEAPONS.rifle.reserve * run.bonuses.reserve);
  p.reserve.shotgun = Math.round(WEAPONS.shotgun.reserve * run.bonuses.reserve);
}

function refillAmmo(run) {
  const p = run.player;
  p.ammo = { rifle: WEAPONS.rifle.mag, shotgun: WEAPONS.shotgun.mag, pistol: WEAPONS.pistol.mag };
  refillReserve(run);
}

// ---------------------------------------------------------------- 敌人/波次
function makeEnemy(run, kind, x, z, hpScale) {
  const base = ENEMIES[kind];
  return {
    id: (run.rng() * 1e9) | 0,
    kind,
    x, z,
    yaw: 0,
    hp: Math.round(base.hp * hpScale),
    maxHp: Math.round(base.hp * hpScale),
    speed: base.speed,
    radius: base.radius,
    height: base.height,
    score: base.score,
    color: base.color,
    meleeDmg: base.meleeDmg || 0,
    meleeRange: base.meleeRange || 0,
    cd: 0,
    cd0: base.meleeCd || base.fireCd || 1,
    fuse: base.fuse || 0,
    summonCd: base.summonCd || 0,
    shootRange: base.shootRange || 0,
    bulletDmg: base.bulletDmg || 0,
    bulletSpeed: base.bulletSpeed || 0,
    fireCd0: base.fireCd || 0,
    preferredDist: base.preferredDist || 0,
  };
}

function spawnWave(run) {
  run.enemies = [];
  const map = MAPS[run.mapIndex];
  const waveDef = WAVES[run.wave - 1];
  const hpScale = HP_SCALE[run.mapIndex];
  const cntScale = COUNT_SCALE[run.mapIndex];
  const p = run.player;
  for (const [kind, baseCount] of Object.entries(waveDef)) {
    let count = Math.max(1, Math.round(baseCount * cntScale));
    if (kind === 'boss') count = 1;
    for (let i = 0; i < count; i++) {
      const ang = run.rng() * Math.PI * 2;
      const dist = 9 + run.rng() * 4;
      let x = p.x + Math.cos(ang) * dist;
      let z = p.z + Math.sin(ang) * dist;
      const c = collideCircle(run, x, z, ENEMIES[kind].radius);
      run.enemies.push(makeEnemy(run, kind, c.x, c.z, hpScale));
    }
  }
  if (waveDef.boss) evt(run, 'bossSpawn', { map: run.mapIndex });
}

function respawnWave(run) {
  const p = run.player;
  p.hp = p.maxHp;
  p.energy = PLAYER.maxEnergy;
  refillAmmo(run);
  spawnWave(run);
  run.waveState = 'active';
  run.phase = 'wave';
}

function enterMap(run) {
  const p = run.player;
  p.x = 0; p.z = MAPS[run.mapIndex].size - 3;
  p.yaw = 0; p.pitch = 0;
  refillAmmo(run);
}

// ---------------------------------------------------------------- 升级
function rollUpgrades(run) {
  const taken = new Set(run.upgrades);
  const fresh = UPGRADES.filter((u) => !taken.has(u.id));
  const pool = fresh.length >= 3 ? fresh : UPGRADES;
  const arr = [...pool];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = (run.rng() * (i + 1)) | 0;
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  run.upgradeChoices = arr.slice(0, 3);
}

export function applyUpgrade(run, id) {
  const u = UPGRADES.find((x) => x.id === id);
  if (!u || run.phase !== 'upgrade') return false;
  run.upgrades.push(id);
  const p = run.player;
  if (u.mul) {
    if (u.mul.dmg) run.bonuses.dmg *= u.mul.dmg;
    if (u.mul.reserve) { run.bonuses.reserve *= u.mul.reserve; refillReserve(run); }
    if (u.mul.reload) run.bonuses.reload *= u.mul.reload;
    if (u.mul.speed) run.bonuses.speed *= u.mul.speed;
    if (u.mul.sprintRegen) run.bonuses.sprintRegen *= u.mul.sprintRegen;
  }
  if (u.add) {
    if (u.add.maxHp) {
      run.bonuses.maxHp += u.add.maxHp;
      p.maxHp = PLAYER.maxHp + run.bonuses.maxHp;
      p.hp = Math.min(p.maxHp, p.hp + u.add.maxHp);
    }
  }
  evt(run, 'upgradeTaken', { id });
  run.upgradeChoices = [];
  if (run.wave < WAVES_PER_MAP) run.wave += 1;
  else { run.mapIndex += 1; run.wave = 1; enterMap(run); }
  run.phase = 'wave';
  run.waveState = 'intro';
  run.introT = 0.9;
  evt(run, 'waveIntro', { wave: run.wave, map: run.mapIndex });
  return true;
}

function onWaveCleared(run) {
  if (run.wave === WAVES_PER_MAP && run.mapIndex === MAPS_PER_RUN - 1) {
    run.phase = 'victory';
    evt(run, 'victory');
    return;
  }
  rollUpgrades(run);
  run.phase = 'upgrade';
  run.upgradeT = 10;
  evt(run, 'upgrade', { choices: run.upgradeChoices.map((c) => c.id) });
}

// ---------------------------------------------------------------- 伤害
function damagePlayer(run, amount) {
  const p = run.player;
  p.hp -= amount;
  run.lastDamage = run.time;
  run.hurt = 0.25;
  evt(run, 'playerHurt', { dmg: Math.round(amount) });
}

function triggerSlowmo(run) {
  const mult = hasUpgrade(run, 'headshot-slowmo') ? 1.9 : 1;
  run.slowmoT = SLOWMO.duration * mult;
  run.timeScale = SLOWMO.timeScale;
  evt(run, 'slowmo');
}

function killEnemy(run, e, headshot = false) {
  e.hp = 0;
  run.stats.kills += 1;
  run.score += e.score;
  if (hasUpgrade(run, 'vampire')) {
    run.player.hp = Math.min(run.player.maxHp, run.player.hp + 6);
  }
  evt(run, 'kill', { x: e.x, y: e.height, z: e.z, kind: e.kind });
  if (headshot) {
    evt(run, 'headshot', { x: e.x, y: e.height, z: e.z, kind: e.kind });
    triggerSlowmo(run);
  }
}

function applyBulletHit(run, e, dmg, headshot) {
  run.stats.hits += 1;
  if (headshot) run.stats.headshots += 1;
  e.hp -= dmg;
  evt(run, 'hit', { x: e.x, y: e.height / 2, z: e.z, dmg: Math.round(dmg), target: e.kind });
  if (e.hp <= 0) killEnemy(run, e, headshot);
}

function damageEnemy(run, e, dmg) {
  e.hp -= dmg;
  if (e.hp <= 0) killEnemy(run, e, false);
}

function explodeAt(run, x, z, radius, dmg, selfId) {
  evt(run, 'explosion', { x, z });
  for (const e of run.enemies) {
    if (e.hp <= 0 || e.id === selfId) continue;
    const d = Math.hypot(e.x - x, e.z - z);
    if (d < radius) damageEnemy(run, e, dmg * (1 - (d / radius) * 0.5));
  }
  const dp = Math.hypot(run.player.x - x, run.player.z - z);
  if (dp < radius) damagePlayer(run, dmg * (1 - (dp / radius) * 0.5));
}

// ---------------------------------------------------------------- 射击/换弹
function fire(run, input) {
  const p = run.player;
  const w = WEAPONS[p.weapon];
  const dir = aimDir(p.yaw, p.pitch);
  const spread = input.aim ? w.aimSpread : w.spread;
  const n = w.pellets;
  for (let i = 0; i < n; i++) {
    const jx = (run.rng() * 2 - 1) * spread;
    const jy = (run.rng() * 2 - 1) * spread;
    const dx = dir.x + jx, dy = dir.y + jy, dz = dir.z;
    const dl = Math.hypot(dx, dy, dz) || 1;
    run.bullets.push({
      x: p.x, y: PLAYER.eyeY, z: p.z,
      dx: dx / dl, dy: dy / dl, dz: dz / dl,
      dmg: w.dmg * run.bonuses.dmg,
      speed: w.bulletSpeed,
      life: 2.4,
      pierce: hasUpgrade(run, 'pierce') ? 2 : 0,
      aoe: hasUpgrade(run, 'explosive-rounds'),
      ricochet: hasUpgrade(run, 'ricochet'),
    });
  }
  p.ammo[p.weapon] -= 1;
  run.cooldown = 1 / w.rate;
  run.recoil = Math.min(0.2, run.recoil + w.recoil);
  run.muzzle = 0.06;
  run.stats.shots += n;
  evt(run, 'shot', { weapon: p.weapon });
}

function startReload(run) {
  const p = run.player;
  const w = WEAPONS[p.weapon];
  if (p.ammo[p.weapon] >= w.mag) return;
  if (p.reserve[p.weapon] <= 0) { evt(run, 'outOfAmmo'); return; }
  run.reloadT = w.reload * run.bonuses.reload;
  evt(run, 'reload', { weapon: p.weapon });
}

function finishReload(run) {
  const p = run.player;
  const w = WEAPONS[p.weapon];
  const need = w.mag - p.ammo[p.weapon];
  const take = Math.min(need, p.reserve[p.weapon]);
  p.ammo[p.weapon] += take;
  if (p.reserve[p.weapon] !== Infinity) p.reserve[p.weapon] -= take;
}

// ---------------------------------------------------------------- 更新
function updateBullets(run, dt) {
  const bullets = run.bullets;
  const obstacles = MAPS[run.mapIndex].obstacles;
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    const step = { x: b.dx * b.speed * dt, y: b.dy * b.speed * dt, z: b.dz * b.speed * dt };
    const from = { x: b.x, y: b.y, z: b.z };

    let best = null, bestEnemy = null;
    for (const e of run.enemies) {
      if (e.hp <= 0) continue;
      const t = segCylinder(from, step, e.x, e.z, e.radius);
      if (t != null && (best === null || t < best)) { best = t; bestEnemy = e; }
    }
    let wallT = null;
    for (const ob of obstacles) {
      const t = segAABB(from, step, { x1: ob.x - ob.w / 2, x2: ob.x + ob.w / 2, y1: 0, y2: ob.h, z1: ob.z - ob.d / 2, z2: ob.z + ob.d / 2 });
      if (t != null && (wallT === null || t < wallT)) wallT = t;
    }

    if (wallT != null && (best === null || wallT < best)) {
      evt(run, 'impact', { x: from.x + step.x * wallT, y: from.y + step.y * wallT, z: from.z + step.z * wallT });
      bullets.splice(i, 1);
      continue;
    }

    if (best != null) {
      const hitY = from.y + step.y * best;
      const headshot = hitY > bestEnemy.height - HEAD_H;
      const dmg = b.dmg * (headshot ? HEADSHOT_MULT : 1);
      applyBulletHit(run, bestEnemy, dmg, headshot);
      if (b.aoe) explodeAt(run, bestEnemy.x, bestEnemy.z, 3.6, b.dmg * 0.6, bestEnemy.id);
      if (b.ricochet) {
        let nx = null, bd = 1e9;
        for (const o of run.enemies) {
          if (o !== bestEnemy && o.hp > 0) { const d = Math.hypot(o.x - bestEnemy.x, o.z - bestEnemy.z); if (d < bd) { bd = d; nx = o; } }
        }
        if (nx) {
          const ddx = nx.x - bestEnemy.x, ddz = nx.z - bestEnemy.z;
          const dl = Math.hypot(ddx, ddz) || 1;
          b.dx = ddx / dl; b.dy = 0; b.dz = ddz / dl;
          b.ricochet = false;
          b.x = from.x + step.x * best; b.y = from.y + step.y * best; b.z = from.z + step.z * best;
          continue;
        }
      }
      if (b.pierce > 0) {
        b.pierce -= 1;
        b.x = from.x + step.x * best; b.y = from.y + step.y * best; b.z = from.z + step.z * best;
        continue;
      }
      bullets.splice(i, 1);
      continue;
    }

    b.x += step.x; b.y += step.y; b.z += step.z;
    b.life -= dt;
    const sz = MAPS[run.mapIndex].size;
    if (b.life <= 0 || Math.abs(b.x) > sz || Math.abs(b.z) > sz || b.y < 0) bullets.splice(i, 1);
  }
}

function fireEnemyBullet(run, e) {
  const p = run.player;
  const dx = p.x - e.x, dz = p.z - e.z;
  const dl = Math.hypot(dx, dz) || 1;
  const spread = 0.07;
  const ax = dx / dl + (run.rng() * 2 - 1) * spread;
  const az = dz / dl + (run.rng() * 2 - 1) * spread;
  const al = Math.hypot(ax, az) || 1;
  run.enemyBullets.push({
    x: e.x, y: e.height * 0.62, z: e.z,
    dx: ax / al, dy: 0, dz: az / al,
    dmg: e.bulletDmg, speed: e.bulletSpeed, life: 2.6,
  });
  evt(run, 'enemyShot', { x: e.x, z: e.z });
}

function updateEnemyBullets(run, dt) {
  const arr = run.enemyBullets;
  const obstacles = MAPS[run.mapIndex].obstacles;
  const p = run.player;
  for (let i = arr.length - 1; i >= 0; i--) {
    const b = arr[i];
    const step = { x: b.dx * b.speed * dt, y: 0, z: b.dz * b.speed * dt };
    const from = { x: b.x, y: b.y, z: b.z };
    const tp = segCylinder(from, step, p.x, p.z, PLAYER.radius + 0.15);
    let wallT = null;
    for (const ob of obstacles) {
      const t = segAABB(from, step, { x1: ob.x - ob.w / 2, x2: ob.x + ob.w / 2, y1: 0, y2: ob.h, z1: ob.z - ob.d / 2, z2: ob.z + ob.d / 2 });
      if (t != null && (wallT === null || t < wallT)) wallT = t;
    }
    if (tp != null && (wallT === null || tp < wallT)) {
      damagePlayer(run, b.dmg);
      arr.splice(i, 1);
      continue;
    }
    if (wallT != null) { arr.splice(i, 1); continue; }
    b.x += step.x; b.z += step.z;
    b.life -= dt;
    const sz = MAPS[run.mapIndex].size;
    if (b.life <= 0 || Math.abs(b.x) > sz || Math.abs(b.z) > sz) arr.splice(i, 1);
  }
}

function updateEnemy(run, e, dt) {
  const p = run.player;
  const dx = p.x - e.x, dz = p.z - e.z;
  const dist = Math.hypot(dx, dz) || 1;
  e.yaw = Math.atan2(-dx, -dz);
  if (e.cd > 0) e.cd -= dt;

  const kind = e.kind;
  if (kind === 'rusher') {
    const spd = e.speed;
    e.x += (dx / dist) * spd * dt;
    e.z += (dz / dist) * spd * dt;
    if (dist < e.meleeRange && e.cd <= 0) {
      e.cd = e.cd0;
      damagePlayer(run, e.meleeDmg);
      evt(run, 'melee', { x: e.x, z: e.z });
    }
  } else if (kind === 'shooter') {
    if (dist > e.preferredDist) { e.x += (dx / dist) * e.speed * dt; e.z += (dz / dist) * e.speed * dt; }
    else if (dist < e.preferredDist - 2.5) { e.x -= (dx / dist) * e.speed * dt; e.z -= (dz / dist) * e.speed * dt; }
    if (e.cd <= 0 && dist < e.shootRange) {
      e.cd = e.fireCd0;
      fireEnemyBullet(run, e);
    }
  } else if (kind === 'exploder') {
    e.x += (dx / dist) * e.speed * dt;
    e.z += (dz / dist) * e.speed * dt;
    if (dist < 2.4) e.fuse -= dt; else e.fuse = ENEMIES.exploder.fuse;
    if (e.fuse <= 0) {
      explodeAt(run, e.x, e.z, ENEMIES.exploder.blastRadius, ENEMIES.exploder.blastDmg, e.id);
      e.hp = 0;
      evt(run, 'exploderDie', { x: e.x, z: e.z });
    }
  } else if (kind === 'boss') {
    e.x += (dx / dist) * e.speed * dt;
    e.z += (dz / dist) * e.speed * dt;
    if (dist < e.meleeRange && e.cd <= 0) {
      e.cd = e.cd0;
      damagePlayer(run, e.meleeDmg);
      evt(run, 'melee', { x: e.x, z: e.z });
    }
    e.summonCd -= dt;
    if (e.summonCd <= 0) {
      e.summonCd = ENEMIES.boss.summonCd;
      for (let k = 0; k < 2; k++) {
        const ang = run.rng() * Math.PI * 2;
        const c = collideCircle(run, e.x + Math.cos(ang) * 2, e.z + Math.sin(ang) * 2, ENEMIES.rusher.radius);
        run.enemies.push(makeEnemy(run, 'rusher', c.x, c.z, HP_SCALE[run.mapIndex]));
      }
      evt(run, 'bossSummon');
    }
  }

  // 撞墙/掩体修正
  const c = collideCircle(run, e.x, e.z, e.radius);
  e.x = c.x; e.z = c.z;
}

function separate(enemies) {
  for (let i = 0; i < enemies.length; i++) {
    for (let j = i + 1; j < enemies.length; j++) {
      const a = enemies[i], b = enemies[j];
      if (a.hp <= 0 || b.hp <= 0) continue;
      const dx = b.x - a.x, dz = b.z - a.z;
      const d = Math.hypot(dx, dz);
      const min = a.radius + b.radius;
      if (d > 0 && d < min) {
        const push = (min - d) / 2;
        const nx = dx / d, nz = dz / d;
        a.x -= nx * push; a.z -= nz * push;
        b.x += nx * push; b.z += nz * push;
      }
    }
  }
}

export function updateSim(run, input = {}) {
  const p = run.player;
  const dt = STEP * run.timeScale;
  run.time += STEP;
  run.slowmoT = Math.max(0, run.slowmoT - STEP);
  if (run.slowmoT <= 0) run.timeScale = 1;

  run.recoil = Math.max(0, run.recoil - STEP * 0.7);
  run.muzzle = Math.max(0, run.muzzle - STEP);
  run.hurt = Math.max(0, run.hurt - STEP);

  if (run.phase === 'upgrade') {
    run.upgradeT -= STEP;
    if (run.upgradeT <= 0 && run.upgradeChoices.length) applyUpgrade(run, run.upgradeChoices[0].id);
    return;
  }
  if (run.phase === 'victory') return;

  // 视角
  if (Number.isFinite(input.yaw)) p.yaw = input.yaw;
  if (Number.isFinite(input.pitch)) p.pitch = clamp(input.pitch, PLAYER.pitchMin, PLAYER.pitchMax);
  run.aiming = !!input.aim;

  // 冲刺/体力
  p.sprinting = !!input.sprint && p.energy > 0 && (input.forward !== 0 || input.strafe !== 0);
  if (p.sprinting) p.energy = Math.max(0, p.energy - PLAYER.sprintDrain * STEP);
  else p.energy = Math.min(PLAYER.maxEnergy, p.energy + PLAYER.sprintRegen * run.bonuses.sprintRegen * STEP);

  // 移动
  const spd = (p.sprinting ? PLAYER.sprintSpeed : PLAYER.walkSpeed) * run.bonuses.speed;
  let f = clamp(input.forward || 0, -1, 1);
  let s = clamp(input.strafe || 0, -1, 1);
  const len = Math.hypot(f, s);
  if (len > 1) { f /= len; s /= len; }
  const sin = Math.sin(p.yaw), cos = Math.cos(p.yaw);
  p.x += (s * cos - f * sin) * spd * dt;
  p.z += (-f * cos - s * sin) * spd * dt;
  const pc = collideCircle(run, p.x, p.z, PLAYER.radius);
  p.x = pc.x; p.z = pc.z;

  // 冲刺冲击升级
  if (hasUpgrade(run, 'dash-blast') && p.sprinting) {
    for (const e of run.enemies) {
      if (e.hp > 0 && Math.hypot(e.x - p.x, e.z - p.z) < e.radius + PLAYER.radius + 0.4) {
        damageEnemy(run, e, 24);
        evt(run, 'dashBlast', { x: e.x, z: e.z });
      }
    }
  }

  // 切枪 / 换弹
  if (input.switchTo && WEAPONS[input.switchTo] && input.switchTo !== p.weapon) {
    p.weapon = input.switchTo;
    run.cooldown = Math.max(run.cooldown, 0.28);
    run.reloadT = 0;
    evt(run, 'weapon', { weapon: p.weapon });
  }
  if (run.reloadT > 0) {
    run.reloadT -= STEP;
    if (run.reloadT <= 0) finishReload(run);
  } else if (input.reload) {
    startReload(run);
  }
  run.cooldown = Math.max(0, run.cooldown - STEP);

  // 射击
  if (input.fire && run.cooldown <= 0 && run.reloadT <= 0) {
    if (p.ammo[p.weapon] > 0) fire(run, input);
    else { run.cooldown = 0.3; evt(run, 'outOfAmmo'); }
  }

  // 子弹 / 敌弹
  updateBullets(run, dt);
  updateEnemyBullets(run, dt);

  // 波次
  if (run.waveState === 'intro') {
    run.introT -= STEP;
    if (run.introT <= 0) {
      spawnWave(run);
      run.waveState = 'active';
      evt(run, 'waveStart', { wave: run.wave, map: run.mapIndex });
    }
  } else if (run.waveState === 'active') {
    for (const e of run.enemies) if (e.hp > 0) updateEnemy(run, e, dt);
    separate(run.enemies);
    if (run.enemies.length > 0 && run.enemies.every((e) => e.hp <= 0)) {
      run.waveState = 'clear';
      run.score += run.wave * 50;
      evt(run, 'waveClear', { wave: run.wave, map: run.mapIndex });
      onWaveCleared(run);
    }
  }

  // 脱战回血
  if (run.time - run.lastDamage > PLAYER.regenDelay && p.hp < p.maxHp) {
    p.hp = Math.min(p.maxHp, p.hp + PLAYER.regenPerSec * STEP);
  }

  // 死亡 = 本波重开（保留升级）
  if (p.hp <= 0) {
    run.stats.deaths += 1;
    evt(run, 'dead');
    respawnWave(run);
  }
}

export function drainEvents(run) {
  const e = run.events;
  run.events = [];
  return e;
}

export function getHud(run) {
  const p = run.player;
  const w = WEAPONS[p.weapon];
  return {
    hp: Math.max(0, Math.ceil(p.hp)),
    maxHp: p.maxHp,
    energy: p.energy,
    weapon: p.weapon,
    ammo: p.ammo[p.weapon],
    magSize: w.mag,
    reserve: p.reserve[p.weapon],
    wave: run.wave,
    map: run.mapIndex,
    mapId: MAPS[run.mapIndex].id,
    kills: run.stats.kills,
    score: run.score,
    time: run.time,
    phase: run.phase,
    waveState: run.waveState,
    introT: run.introT,
    reloadT: run.reloadT,
    reloading: run.reloadT > 0,
    cooldown: run.cooldown,
    recoil: run.recoil,
    muzzle: run.muzzle,
    hurt: run.hurt,
    slowmoT: run.slowmoT,
    sprinting: p.sprinting,
    aiming: run.aiming,
    upgradeChoices: run.upgradeChoices,
    upgradeT: run.upgradeT,
    shots: run.stats.shots,
    hits: run.stats.hits,
    headshots: run.stats.headshots,
    deaths: run.stats.deaths,
  };
}

export const createSim = createRun;
