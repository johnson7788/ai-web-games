// src/game/sim.js — 纯逻辑：俯视角 BR（双摇杆移动/射击、缩圈、捡枪/药/甲、15 AI、击杀、最后存活）。
// 不碰 DOM / window / localStorage / Date.now；随机用 seed（mulberry32）。
// 契约：createRun({seed}) → { phase, time, step(input), drainEvents(), getHud(), stats,
//          players, items, obstacles, bullets, gas, rng }
import {
  ARENA, WEAPONS, weaponById, PLAYER, ENEMY, GAS, LOOT, BULLET, MATCHES, clamp, dist,
} from '../../config/gameplay.js';
import { mulberry32, randInt, pick } from './rng.js';

const STEP = 1 / 60;

// ---------- 障碍物（文具/书堆矩形）----------
function makeObstacles(rng) {
  const rects = [];
  // 每场随机 7–10 个文具掩体，避开正中心（玩家出生区）
  const n = randInt(rng, 7, 10);
  const defs = [
    { w: 120, h: 40 },   // 尺子
    { w: 70, h: 70 },    // 橡皮
    { w: 150, h: 46 },   // 书
    { w: 60, h: 110 },   // 铅笔盒
    { w: 100, h: 100 },  // 墨水瓶
  ];
  for (let i = 0; i < n; i += 1) {
    const d = pick(rng, defs);
    const x = ARENA.minX + 60 + rng() * (ARENA.maxX - ARENA.minX - 120);
    const y = ARENA.minY + 60 + rng() * (ARENA.maxY - ARENA.minY - 120);
    // 避开中心出生点
    if (dist(x, y, 640, 360) < 150) continue;
    rects.push({ x: x - d.w / 2, y: y - d.h / 2, w: d.w, h: d.h });
  }
  return rects;
}

// ---------- 实体 ----------
function makeEntity(run, isPlayer, match, idx) {
  const strength = ENEMY.strengthByMatch[Math.min(match, ENEMY.strengthByMatch.length - 1)];
  const base = {
    isPlayer,
    name: isPlayer ? 'YOU' : `TOY-${idx}`,
    x: 0, y: 0, r: isPlayer ? PLAYER.radius : ENEMY.radius,
    hp: isPlayer ? PLAYER.hp : Math.round(ENEMY.hp * strength),
    maxHp: isPlayer ? PLAYER.hp : Math.round(ENEMY.hp * strength),
    weapon: null,
    ammo: 0,
    clip: 0,
    aimAngle: run.rng() * Math.PI * 2,
    moveX: 0, moveY: 0,
    shootCd: 0,
    reloadT: 0,
    alive: true,
    kills: 0,
    armor: 0,          // 0..1 减伤（护甲在背包则生效）
    meds: 0,           // 背包里的医疗包数
    bag: [],           // 'med' | 'armor'，最多 LOOT.bagSlots 格
    lastShotAt: -99,
    alerted: false,
    alertX: 0, alertY: 0, alertT: 0,
    repathT: 0,
    flashCd: 0,
    damageMul: isPlayer ? PLAYER.damageMul : 1,
    speed: isPlayer ? PLAYER.speed : ENEMY.speed,
    protectUntil: isPlayer ? 6 : 0,   // 玩家落地保护 6s（原作无枪时保护，这里固定保护窗口）
    lastDamageAt: -99,
  };
  if (isPlayer) {
    // 开局给一把手枪，保证立刻能玩（原作落地无枪需找，这里给最低档降低入口摩擦）
    base.weapon = 'pistol';
    base.clip = weaponById('pistol').clip;
    base.ammo = base.clip;
  }
  return base;
}

function weaponRange(e) {
  if (!e.weapon) return 400; // 无枪时的感知半径（原作 Enemy.aimToNearest 里 range=400）
  return weaponById(e.weapon).range;
}

// ---------- 生成 ----------
function spawnMatch(run) {
  const rng = run.rng;
  run.obstacles = makeObstacles(rng);
  run.bullets = [];
  run.players = [];
  run.items = [];

  // 玩家出生在安全区中心下方 140px，避开 SAFE ZONE 准星与标签
  const player = makeEntity(run, true, run.match, 0);
  player.x = 640;
  player.y = 500;
  run.players.push(player);

  // 15 名 AI
  const enemyNames = ['RED', 'BLU', 'GRN', 'YLW', 'ORN', 'PUR', 'CYAN', 'PINK', 'BRWN', 'GRY', 'TEAL', 'LIME', 'NAVY', 'GOLD', 'SILV'];
  for (let i = 0; i < 15; i += 1) {
    const e = makeEntity(run, false, run.match, i + 1);
    e.name = enemyNames[i % enemyNames.length];
    // 环形散布在场地边缘
    const ang = (i / 15) * Math.PI * 2 + rng() * 0.4;
    const rad = 300 + rng() * 180;
    e.x = clamp(640 + Math.cos(ang) * rad, ARENA.minX + 40, ARENA.maxX - 40);
    e.y = clamp(360 + Math.sin(ang) * rad, ARENA.minY + 40, ARENA.maxY - 40);
    run.players.push(e);
  }

  // 地面武器
  for (let i = 0; i < LOOT.weaponCount; i += 1) {
    const w = pick(rng, LOOT.weapons);
    run.items.push({
      id: `w${i}`, kind: 'weapon', weaponId: w,
      x: ARENA.minX + 60 + rng() * (ARENA.maxX - ARENA.minX - 120),
      y: ARENA.minY + 60 + rng() * (ARENA.maxY - ARENA.minY - 120),
      alive: true,
    });
  }
  // 玩家出生点附近保底 3 把好枪（避免 15 AI 抢光后玩家无枪可用）
  const starter = ['machine', 'ak', 'kar'];
  starter.forEach((wid, k) => {
    const a = (k / starter.length) * Math.PI * 2 - Math.PI / 2;
    run.items.push({
      id: `s${k}`, kind: 'weapon', weaponId: wid,
      x: clamp(640 + Math.cos(a) * 90, ARENA.minX + 30, ARENA.maxX - 30),
      y: clamp(360 + Math.sin(a) * 90, ARENA.minY + 30, ARENA.maxY - 30),
      alive: true,
    });
  });
  // 医疗包
  for (let i = 0; i < LOOT.medCount; i += 1) {
    run.items.push({
      id: `m${i}`, kind: 'med',
      x: ARENA.minX + 60 + rng() * (ARENA.maxX - ARENA.minX - 120),
      y: ARENA.minY + 60 + rng() * (ARENA.maxY - ARENA.minY - 120),
      alive: true,
    });
  }
  // 护甲
  for (let i = 0; i < LOOT.armorCount; i += 1) {
    run.items.push({
      id: `a${i}`, kind: 'armor',
      x: ARENA.minX + 60 + rng() * (ARENA.maxX - ARENA.minX - 120),
      y: ARENA.minY + 60 + rng() * (ARENA.maxY - ARENA.minY - 120),
      alive: true,
    });
  }

  // 缩圈初始化
  run.gas = {
    cx: 640, cy: 360,
    r: GAS.startRadius,
    state: 'wait',
    timer: GAS.warnSec,
    phase: 0,
    targetR: GAS.phases[0],
    targetCx: 640, targetCy: 360,
    announced: false,
  };
  run.events.push({ type: 'matchStart', match: run.match + 1, alive: run.players.length });
}

// ---------- 几何/碰撞 ----------
function circleRectHit(cx, cy, r, rect) {
  const nx = clamp(cx, rect.x, rect.x + rect.w);
  const ny = clamp(cy, rect.y, rect.y + rect.h);
  return dist(cx, cy, nx, ny) < r;
}

function moveEntity(run, e, dx, dy, speed, dt) {
  if (speed <= 0) { e.moveX = dx; e.moveY = dy; return; }
  const len = Math.hypot(dx, dy) || 1;
  const nx = dx / len;
  const ny = dy / len;
  e.moveX = nx; e.moveY = ny;
  let vx = nx * speed * dt;
  let vy = ny * speed * dt;

  // X 轴移动 + 障碍推挤
  e.x += vx;
  for (const o of run.obstacles) {
    if (circleRectHit(e.x, e.y, e.r, o)) {
      if (vx > 0) e.x = o.x - e.r;
      else if (vx < 0) e.x = o.x + o.w + e.r;
    }
  }
  // Y 轴移动
  e.y += vy;
  for (const o of run.obstacles) {
    if (circleRectHit(e.x, e.y, e.r, o)) {
      if (vy > 0) e.y = o.y - e.r;
      else if (vy < 0) e.y = o.y + o.h + e.r;
    }
  }
  e.x = clamp(e.x, ARENA.minX + e.r, ARENA.maxX - e.r);
  e.y = clamp(e.y, ARENA.minY + e.r, ARENA.maxY - e.r);
}

// ---------- 子弹 ----------
function fireBullet(run, shooter, angle, power, speed, range, pellets, explosive) {
  for (let p = 0; p < pellets; p += 1) {
    const a = angle + (pellets > 1 ? (p - (pellets - 1) / 2) * (Math.PI / 12) : 0);
    run.bullets.push({
      x: shooter.x + Math.cos(a) * (shooter.r + 4),
      y: shooter.y + Math.sin(a) * (shooter.r + 4),
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed,
      owner: shooter,
      ownerIsPlayer: shooter.isPlayer,
      power,
      range,
      traveled: 0,
      explosive: explosive || 0,
      alive: true,
    });
  }
}

function shoot(run, e) {
  if (!e.alive || !e.weapon || e.reloadT > 0 || e.shootCd > 0) return;
  if (e.ammo <= 0) { startReload(run, e); return; }
  const w = weaponById(e.weapon);
  e.shootCd = w.shootDelay;
  e.ammo -= 1;
  e.lastShotAt = run.time;
  const dmg = Math.round(w.power * e.damageMul);
  fireBullet(run, e, e.aimAngle, dmg, w.speed, w.range, w.pellets, w.explosive);
  run.events.push({ type: 'shot', x: e.x, y: e.y, shooter: e.isPlayer ? 'player' : 'ai', weapon: e.weapon });

  // 枪声吸引附近 AI（静步的反面：不射击 = 不暴露）
  const loud = e.isPlayer ? PLAYER.gunLoudRadius : ENEMY.gunLoudRadius;
  for (const other of run.players) {
    if (other === e || !other.alive) continue;
    if (dist(other.x, other.y, e.x, e.y) < loud) {
      other.alerted = true;
      other.alertX = e.x; other.alertY = e.y;
      other.alertT = 1.6;
    }
  }
  if (e.ammo <= 0) startReload(run, e);
}

function startReload(run, e) {
  if (!e.alive || !e.weapon || e.reloadT > 0) return;
  const w = weaponById(e.weapon);
  e.reloadT = w.reloadDelay;
  if (e.isPlayer) run.events.push({ type: 'reload', weapon: e.weapon });
}

function updateBullets(run, dt) {
  for (const b of run.bullets) {
    if (!b.alive) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.traveled += Math.hypot(b.vx, b.vy) * dt;

    // 撞墙
    for (const o of run.obstacles) {
      if (circleRectHit(b.x, b.y, BULLET.radius, o)) { b.alive = false; break; }
    }
    if (!b.alive) continue;
    // 出界
    if (b.x < ARENA.minX || b.x > ARENA.maxX || b.y < ARENA.minY || b.y > ARENA.maxY) { b.alive = false; continue; }

    // 命中实体
    for (const t of run.players) {
      if (!t.alive || t === b.owner) continue;
      if (dist(b.x, b.y, t.x, t.y) < t.r + BULLET.radius + 2) {
        b.alive = false;
        const before = t.hp;
        applyDamage(run, t, b.power, b.owner);
        if (b.ownerIsPlayer) {
          run.events.push({ type: 'hit', x: t.x, y: t.y, dmg: before - t.hp, target: t.name });
          if (before - t.hp > 0 && t.hp > 0 && dist(b.x, b.y, t.x, t.y) < t.r + 30) {
            // nearMiss 已在下面独立判定，这里只记 hit
          }
        }
        // 爆炸伤害
        if (b.explosive) {
          for (const o of run.players) {
            if (o.alive && o !== b.owner && dist(o.x, o.y, b.x, b.y) < b.explosive) {
              const ob = o.hp;
              applyDamage(run, o, b.power, b.owner);
              if (b.ownerIsPlayer) run.events.push({ type: 'hit', x: o.x, y: o.y, dmg: ob - o.hp, target: o.name });
            }
          }
        }
        break;
      }
    }

    // 射程耗尽（火箭筒爆炸）
    if (b.alive && b.traveled >= b.range) {
      b.alive = false;
      if (b.explosive) {
        for (const o of run.players) {
          if (o.alive && o !== b.owner && dist(o.x, o.y, b.x, b.y) < b.explosive) {
            const ob = o.hp;
            applyDamage(run, o, b.power, b.owner);
            if (b.ownerIsPlayer) run.events.push({ type: 'hit', x: o.x, y: o.y, dmg: ob - o.hp, target: o.name });
          }
        }
      }
    }
  }
  run.bullets = run.bullets.filter((b) => b.alive);
}

function applyDamage(run, target, rawDmg, attacker) {
  if (!target.alive) return;
  // 玩家落地保护窗口内免疫伤害
  if (target.isPlayer && target.protectUntil > run.time) return;
  const dmg = target.armor > 0 ? rawDmg * (1 - target.armor) : rawDmg;
  target.lastDamageAt = run.time;
  target.hp -= dmg;
  if (target.hp <= 0) {
    target.hp = 0;
    target.alive = false;
    if (attacker && attacker.alive && attacker !== target) {
      attacker.kills += 1;
      if (attacker.isPlayer) {
        run.stats.kills += 1;
        run.events.push({ type: 'kill', x: target.x, y: target.y, killer: 'player', victim: target.name });
      } else {
        run.events.push({ type: 'kill', x: target.x, y: target.y, killer: attacker.name, victim: target.name });
      }
    } else {
      run.events.push({ type: 'kill', x: target.x, y: target.y, killer: 'gas', victim: target.name });
    }
    // 死亡掉落武器
    if (target.weapon) {
      run.items.push({ id: `dw${target.x.toFixed(0)}${target.y.toFixed(0)}`, kind: 'weapon', weaponId: target.weapon, x: target.x, y: target.y, alive: true });
    }
    checkWin(run);
  }
}

function checkWin(run) {
  const alive = run.players.filter((p) => p.alive);
  if (alive.length === 1 && alive[0].isPlayer) {
    // 玩家赢下本场
    run.stats.wins += 1;
    run.events.push({ type: 'win', match: run.match + 1, kills: run.stats.kills });
    if (run.match + 1 >= MATCHES) {
      run.phase = 'won';
    } else {
      run.match += 1;
      spawnMatch(run);
    }
  } else if (alive.length === 1 && !alive[0].isPlayer) {
    // 只剩一个 AI（几乎不会发生，玩家已死则由 death 路径处理）
    run.phase = 'dead';
  }
}

// ---------- 拾取 ----------
function tryPickup(run, e) {
  for (const it of [...run.items]) {
    if (!it.alive) continue;
    if (dist(e.x, e.y, it.x, it.y) > LOOT.pickupRadius + e.r) continue;
    if (it.kind === 'weapon') {
      it.alive = false;
      // 走过枪即换装（原作弹 GunUI 选择，这里简化为自动换新枪）
      e.weapon = it.weaponId;
      const w = weaponById(it.weaponId);
      e.clip = w.clip;
      e.ammo = w.clip;
      if (e.isPlayer) run.events.push({ type: 'equip', weapon: it.weaponId });
      else run.events.push({ type: 'pickup', who: e.name, item: it.weaponId });
    } else if (it.kind === 'med' || it.kind === 'armor') {
      // 背包 2 格：满了则丢最旧一格到地面，形成「拿医疗丢护甲」取舍
      if (e.bag.length >= LOOT.bagSlots) {
        const dropped = e.bag.shift();
        if (dropped === 'armor') e.armor = 0;
        if (dropped === 'med') e.meds = Math.max(0, e.meds - 1);
        run.items.push({ id: `dr${it.x.toFixed(0)}${it.y.toFixed(0)}`, kind: dropped, x: it.x, y: it.y, alive: true });
      }
      e.bag.push(it.kind);
      if (it.kind === 'armor') e.armor = Math.max(e.armor, LOOT.armorReduce);
      if (it.kind === 'med') e.meds += 1;
      it.alive = false;
      if (e.isPlayer) run.events.push({ type: 'pickup', item: it.kind, bag: e.bag.slice() });
    }
  }
}

function useMed(run, e) {
  if (e.meds <= 0 || e.hp >= e.maxHp) return;
  const idx = e.bag.indexOf('med');
  if (idx >= 0) e.bag.splice(idx, 1);
  e.meds -= 1;
  e.hp = Math.min(e.maxHp, e.hp + LOOT.medHeal);
  run.events.push({ type: 'med', x: e.x, y: e.y, hp: e.hp });
}

// ---------- AI ----------
function nearestOther(run, e, maxDist = Infinity) {
  let best = null;
  let bd = maxDist;
  for (const o of run.players) {
    if (o === e || !o.alive) continue;
    const d = dist(o.x, o.y, e.x, e.y);
    if (d < bd) { bd = d; best = o; }
  }
  return { target: best, d: bd };
}

function nearestItem(run, e, kind, insideGas) {
  let best = null;
  let bd = Infinity;
  for (const it of run.items) {
    if (!it.alive) continue;
    if (kind && it.kind !== kind) continue;
    if (insideGas && dist(it.x, it.y, run.gas.cx, run.gas.cy) > run.gas.r) continue;
    const d = dist(it.x, it.y, e.x, e.y);
    if (d < bd) { bd = d; best = it; }
  }
  return { item: best, d: bd };
}

function updateAi(run, e, dt) {
  if (!e.alive) return;
  e.shootCd = Math.max(0, e.shootCd - dt);
  if (e.reloadT > 0) {
    e.reloadT -= dt;
    if (e.reloadT <= 0) { const w = e.weapon ? weaponById(e.weapon) : null; e.ammo = w ? w.clip : 0; }
  }
  e.alertT = Math.max(0, e.alertT - dt);

  const gas = run.gas;
  const inGas = dist(e.x, e.y, gas.cx, gas.cy) > gas.r;

  let moveX = 0, moveY = 0;
  let wantAim = e.aimAngle;

  // 优先级 1：毒圈外 → 回圈
  if (inGas) {
    const d = dist(e.x, e.y, gas.cx, gas.cy) || 1;
    moveX = (gas.cx - e.x) / d;
    moveY = (gas.cy - e.y) / d;
  } else {
    const threat = nearestOther(run, e, weaponRange(e) * ENEMY.aggroRangeMul);
    const hasGun = !!e.weapon;
    const needMed = e.hp < e.maxHp * 0.4 && e.meds > 0;

    if (needMed) {
      useMed(run, e);
    }

    if (threat.target && hasGun) {
      // 有枪 → 追踪 + 瞄准射击
      const tx = threat.target.x - e.x;
      const ty = threat.target.y - e.y;
      const d = Math.hypot(tx, ty) || 1;
      wantAim = Math.atan2(ty, tx);
      moveX = tx / d;
      moveY = ty / d;
      if (threat.d > 60) { /* 保持距离，避免贴脸 */ }
    } else if (threat.target && !hasGun) {
      // 无枪遇敌 → 逃跑
      const tx = e.x - threat.target.x;
      const ty = e.y - threat.target.y;
      const d = Math.hypot(tx, ty) || 1;
      moveX = tx / d;
      moveY = ty / d;
    } else if (!hasGun) {
      // 找枪
      const g = nearestItem(run, e, 'weapon', true);
      if (g.item) {
        const d = g.d || 1;
        moveX = (g.item.x - e.x) / d;
        moveY = (g.item.y - e.y) / d;
      }
    } else if (e.alerted && e.alertT > 0) {
      // 听到枪声 → 摸过去
      const d = dist(e.x, e.y, e.alertX, e.alertY) || 1;
      moveX = (e.alertX - e.x) / d;
      moveY = (e.alertY - e.y) / d;
    } else if (e.hp < e.maxHp * 0.6 && e.bag.length < LOOT.bagSlots) {
      // 找药/甲
      const m = nearestItem(run, e, 'med', true);
      const a = nearestItem(run, e, 'armor', true);
      const tgt = (!m.item || (a.item && a.d < m.d)) ? a.item : m.item;
      if (tgt) {
        const d = Math.hypot(tgt.x - e.x, tgt.y - e.y) || 1;
        moveX = (tgt.x - e.x) / d;
        moveY = (tgt.y - e.y) / d;
      }
    } else {
      // 巡逻
      e.repathT -= dt;
      if (e.repathT <= 0) {
        e.repathT = 1 + run.rng() * 2;
        const a = run.rng() * Math.PI * 2;
        moveX = Math.cos(a);
        moveY = Math.sin(a);
      } else {
        moveX = e.moveX || Math.cos(e.aimAngle);
        moveY = e.moveY || Math.sin(e.aimAngle);
      }
    }
  }

  // 移动（AI 不享受静步加成）
  const speed = e.isPlayer ? e.speed : e.speed * (e.weapon ? 1 : 1.05);
  moveEntity(run, e, moveX, moveY, speed, dt);

  // 瞄准：有枪就指向目标，无枪跟随移动方向
  if (e.weapon) {
    const th = nearestOther(run, e, weaponRange(e) * ENEMY.aggroRangeMul);
    if (th.target) {
      e.aimAngle = Math.atan2(th.target.y - e.y, th.target.x - e.x);
      if (th.d < weaponRange(e)) shoot(run, e);
    }
  } else {
    e.aimAngle = Math.atan2(e.moveY, e.moveX);
  }

  // 拾取
  tryPickup(run, e);
}

// ---------- 玩家 ----------
function updatePlayer(run, e, input, dt) {
  if (!e.alive) return;
  e.shootCd = Math.max(0, e.shootCd - dt);
  if (e.reloadT > 0) {
    e.reloadT -= dt;
    if (e.reloadT <= 0) { const w = e.weapon ? weaponById(e.weapon) : null; e.ammo = w ? w.clip : 0; run.events.push({ type: 'reloadDone', weapon: e.weapon }); }
  }

  // 静步：不射击（1s 内没开火）时移速 +30%
  const silent = (run.time - e.lastShotAt) > 1.0;
  const speedMul = silent ? PLAYER.stealthSpeedMul : 1.0;
  const mx = clamp(input.moveX ?? 0, -1, 1);
  const my = clamp(input.moveY ?? 0, -1, 1);
  moveEntity(run, e, mx, my, e.speed * speedMul, dt);

  // 瞄准方向
  const ax = input.aimX ?? 0;
  const ay = input.aimY ?? 0;
  if (Math.hypot(ax, ay) > 0.01) {
    e.aimAngle = Math.atan2(ay, ax);
  } else if (Math.hypot(mx, my) > 0.01) {
    e.aimAngle = Math.atan2(my, mx);
  }

  if (input.reload) startReload(run, e);
  if (input.med) useMed(run, e);
  // 低血量自动打药（触屏无 R/+ 按钮，桌面也可受益）
  if (e.hp > 0 && e.hp < 30 && e.meds > 0) useMed(run, e);
  if (input.shoot) shoot(run, e);

  // 脱战回血（原作 recovery：脱离伤害后缓慢恢复）
  if (e.hp < e.maxHp && run.time - e.lastDamageAt > PLAYER.regenDelaySec) {
    e.hp = Math.min(e.maxHp, e.hp + PLAYER.regen * dt);
  }

  // 拾取
  tryPickup(run, e);
}

// ---------- 缩圈 ----------
function updateGas(run, dt) {
  const gas = run.gas;
  const phaseCount = GAS.phases.length;
  if (gas.phase >= phaseCount - 1 && gas.state === 'wait' && gas.timer <= 0) {
    // 最终圈：不再缩
    return;
  }
  if (gas.state === 'wait') {
    gas.timer -= dt;
    if (!gas.announced && gas.timer <= 3.5) {
      gas.announced = true;
      run.events.push({ type: 'gasWarn', targetR: gas.targetR, sec: Math.max(0, gas.timer) });
    }
    if (gas.timer <= 0) {
      gas.state = 'shrink';
      gas.announced = false;
      run.events.push({ type: 'gasShrink', phase: gas.phase, r: Math.round(gas.r) });
    }
  } else if (gas.state === 'shrink') {
    const d = dist(gas.cx, gas.cy, gas.targetCx, gas.targetCy) || 1;
    const move = GAS.shrinkSpeed * dt;
    const rStep = GAS.shrinkSpeed * dt;
    if (gas.r > gas.targetR) {
      gas.r = Math.max(gas.targetR, gas.r - rStep);
    }
    // 圆心向目标圆滑移动
    const k = Math.min(1, move / d);
    gas.cx += (gas.targetCx - gas.cx) * k;
    gas.cy += (gas.targetCy - gas.cy) * k;

    if (gas.r <= gas.targetR + 0.5 && Math.abs(dist(gas.cx, gas.cy, gas.targetCx, gas.targetCy)) < 4) {
      gas.r = gas.targetR;
      gas.cx = gas.targetCx;
      gas.cy = gas.targetCy;
      gas.phase += 1;
      if (gas.phase < phaseCount) {
        gas.state = 'wait';
        gas.timer = GAS.warnSec;
        // 选下一个安全区中心（保证新圈在当前圈内）
        if (gas.phase < phaseCount - 1) {
          const nr = GAS.phases[gas.phase];
          const maxOff = Math.max(0, gas.r - nr);
          const ang = run.rng() * Math.PI * 2;
          const off = run.rng() * maxOff * 0.8;
          gas.targetR = nr;
          gas.targetCx = clamp(gas.cx + Math.cos(ang) * off, ARENA.minX + nr, ARENA.maxX - nr);
          gas.targetCy = clamp(gas.cy + Math.sin(ang) * off, ARENA.minY + nr, ARENA.maxY - nr);
        } else {
          gas.targetR = GAS.phases[gas.phase];
          gas.targetCx = gas.cx;
          gas.targetCy = gas.cy;
          run.events.push({ type: 'final', x: gas.cx, y: gas.cy });
        }
      }
    }
  }
}

// ---------- 毒圈伤害 ----------
function applyGasDamage(run, dt) {
  run._gasTickAcc = (run._gasTickAcc ?? 0) + dt;
  for (const e of run.players) {
    if (!e.alive) continue;
    const d = dist(e.x, e.y, run.gas.cx, run.gas.cy);
    if (d > run.gas.r) {
      applyDamage(run, e, GAS.dps * dt, null);
      if (e.isPlayer && run._gasTickAcc >= GAS.tickInterval) {
        run.events.push({ type: 'gasTick', hp: Math.round(e.hp) });
      }
    }
  }
  if (run._gasTickAcc >= GAS.tickInterval) run._gasTickAcc = 0;
}

// ---------- 主 step ----------
function step(input = {}) {
  const run = this;
  if (run.phase !== 'playing') return;

  const dt = STEP;
  run.time += dt;

  // 玩家
  const player = run.players.find((p) => p.isPlayer);
  if (player && player.alive) {
    updatePlayer(run, player, input, dt);
  }

  // AI
  for (const e of run.players) {
    if (!e.isPlayer) updateAi(run, e, dt);
  }

  // 子弹
  updateBullets(run, dt);

  // 毒圈
  updateGas(run, dt);
  applyGasDamage(run, dt);

  // 心跳事件：保持可感知反馈密度（存活数脉冲）
  if (Math.floor(run.time * 2) !== Math.floor((run.time - dt) * 2)) {
    run.events.push({ type: 'scan', alive: run.players.filter((p) => p.alive).length });
  }

  // 玩家死亡 → 结算
  if (player && !player.alive && run.phase === 'playing') {
    const alive = run.players.filter((p) => p.alive);
    run.stats.rank = alive.length + 1; // 死时名次 = 存活数 + 1
    run.stats.matchReached = run.match + 1;
    if (run.stats.rank < run.stats.bestRank || run.stats.bestRank === 0) {
      run.stats.bestRank = run.stats.rank;
    }
    run.phase = 'dead';
    run.events.push({ type: 'lose', rank: run.stats.rank, match: run.match + 1 });
  }
}

function drainEvents() {
  const run = this;
  const out = run.events;
  run.events = [];
  return out;
}

function getHud() {
  const run = this;
  const player = run.players.find((p) => p.isPlayer);
  const alive = run.players.filter((p) => p.alive).length;
  const w = player && player.weapon ? weaponById(player.weapon) : null;
  const inGas = player && run.gas ? dist(player.x, player.y, run.gas.cx, run.gas.cy) > run.gas.r : false;
  return {
    phase: run.phase,
    match: run.match + 1,
    alive,
    kills: run.stats.kills,
    rank: run.stats.rank,
    bestRank: run.stats.bestRank,
    hp: player ? Math.round(player.hp) : 0,
    maxHp: player ? player.maxHp : 0,
    ammo: player ? player.ammo : 0,
    clip: player ? player.clip : 0,
    weapon: player ? player.weapon : null,
    weaponName: w ? w.id : 'none',
    bag: player ? player.bag.slice() : [],
    meds: player ? player.meds : 0,
    armor: player ? player.armor : 0,
    gasState: run.gas.state,
    gasSec: run.gas.state === 'wait' ? Math.max(0, run.gas.timer) : 0,
    gasRadius: run.gas.r,
    inGas: !!inGas,
  };
}

// 把方法挂到 run 上（createRun 返回后再用 Object.assign 更简单）
export function createRun(opts) {
  const rng = mulberry32(opts?.seed ?? 1);
  const run = {
    rng,
    time: 0,
    phase: 'playing',
    match: 0,
    players: [],
    items: [],
    obstacles: [],
    bullets: [],
    gas: null,
    events: [],
    stats: { kills: 0, rank: 0, matchReached: 1, bestRank: 0, wins: 0 },
  };
  run.spawnMatch = () => spawnMatch(run);
  run.step = step;
  run.drainEvents = drainEvents;
  run.getHud = getHud;
  run.spawnMatch();
  return run;
}
