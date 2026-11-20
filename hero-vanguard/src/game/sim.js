// HERO VANGUARD · M1 模拟/玩法核心（纯逻辑，零依赖，不碰 DOM/window/localStorage/Date）
// 契约：docs/report.md（事件名 / 接口签名一字不差）
import {
  WORLD, STEP, BASE, HERO, HEROES, SKILL, ENEMY, UPGRADES, FLOW,
  clamp, sceneForWave,
} from '../../config/gameplay.js';
import { WAVES } from '../../config/levels.js';
import { mulberry32, randInt, shuffle } from './rng.js';

const BASE_Y = 520; // 基地中心 y（轨道站核心）

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'wave', // wave | upgrade | win | dead
    time: 0,
    wave: 1,
    waveMax: WAVES.length,
    gold: 0,
    base: { hp: BASE.MAX_HP, maxHp: BASE.MAX_HP, shield: 0 },
    heroes: HEROES.map((h) => ({
      id: h.id,
      kind: h.kind,
      x: h.kind === 'blade' ? 340 : 520,
      y: h.kind === 'blade' ? 620 : 470,
      atk: h.atk,
      atkBase: h.atk,
      range: h.range,
      rangeBase: h.range,
      atkInterval: h.atkInterval,
      atkIntervalBase: h.atkInterval,
      atkTimer: 0,
      speed: h.speed,
      speedBase: h.speed,
      color: h.color,
      isControlled: h.kind === 'blade', // 默认主控刃
      charging: false,
      chargeTimer: 0,
      facing: -1,
    })),
    enemies: [],
    spawnQueue: [],
    spawnTimer: 0,
    skills: { resonance: 0, shield: 0, swap: 0 }, // 各技能剩余冷却（秒）
    upgrades: {}, // id -> 已选次数
    upgradeChoices: [],
    upgradeTimer: 0,
    pulseTimer: 0,
    nextId: 1,
    stats: { kills: 0, wavesReached: 1, bossKills: 0 },
    events: [],
    _apply: {}, // 生效中的规则型升级标记（渲染/HUD 部分复用）
  };

  startWave(run, 1);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

export function createSim() {
  return createRun({ seed: 0 });
}

// 兼容旧骨架（main 不再用，但保留 updateSim 别名方便测试）
export function updateSim(run, input = {}) {
  run.step({
    moveX: input.left ? -1 : input.right ? 1 : 0,
    moveY: input.up ? -1 : input.down ? 1 : 0,
    swap: !!input.swap,
    j: !!input.j,
    k: !!input.k,
    chooseUpgrade: input.chooseUpgrade ?? null,
  });
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase === 'win' || run.phase === 'dead') return;
  const dt = STEP;
  run.time += dt;

  if (run.phase === 'upgrade') {
    run.upgradeTimer += dt;
    const choice = input.chooseUpgrade;
    if (choice != null) {
      applyUpgrade(run, choice);
      nextWave(run);
    } else if (run.upgradeTimer >= FLOW.UPGRADE_TIMEOUT) {
      // 自动兜底：无选择时随机选第一个，保证 noinput 也能推进（否则卡在升级屏）
      applyUpgrade(run, 0);
      nextWave(run);
    }
    return;
  }

  updateSkills(run, dt);
  if (input.swap) doSwap(run);
  if (input.j) castResonance(run);
  if (input.k) castShield(run);
  spawnEnemies(run, dt);
  updateHeroes(run, input, dt);
  updateEnemies(run, dt);
  handleBaseContact(run);
  updateSiege(run, dt);
  updatePulse(run);
  checkWaveClear(run);
}

// ---------- 波次 ----------
function startWave(run, wave) {
  run.wave = wave;
  run.spawnQueue = [];
  const comp = WAVES[wave - 1].comp;
  for (const c of comp) {
    for (let i = 0; i < c.count; i += 1) run.spawnQueue.push(c.kind);
  }
  run.spawnQueue = shuffle(run.rng, run.spawnQueue);
  run.spawnTimer = 0.3;
  emit(run, 'waveStart', { wave, scene: sceneForWave(wave).key });
  if (wave > run.stats.wavesReached) run.stats.wavesReached = wave;
}

function nextWave(run) {
  if (run.wave >= run.waveMax) {
    run.phase = 'win';
    emit(run, 'win', { wave: run.wave });
    return;
  }
  run.phase = 'wave';
  run.upgradeChoices = [];
  run.upgradeTimer = 0;
  startWave(run, run.wave + 1);
}

function checkWaveClear(run) {
  if (run.phase !== 'wave') return;
  if (run.spawnQueue.length === 0 && run.enemies.length === 0) {
    emit(run, 'waveClear', { wave: run.wave });
    run.phase = 'upgrade';
    run.upgradeTimer = 0;
    run.upgradeChoices = pickUpgrades(run, 3);
    emit(run, 'upgradeOffer', { wave: run.wave, choices: run.upgradeChoices });
  }
}

function pickUpgrades(run, n) {
  const pool = UPGRADES.map((u) => u.id).filter((id) => !(run.upgrades[id] > 0));
  const picked = shuffle(run.rng, pool).slice(0, n);
  // 池不足 3 个时用已有项补位（避免空选择）
  if (picked.length < n) {
    for (const u of UPGRADES) {
      if (picked.length >= n) break;
      if (!picked.includes(u.id)) picked.push(u.id);
    }
  }
  return picked;
}

function applyUpgrade(run, index) {
  const id = run.upgradeChoices[index];
  if (!id) return;
  run.upgrades[id] = (run.upgrades[id] || 0) + 1;
  run._apply[id] = true;
  emit(run, 'upgrade', { id, wave: run.wave });

  const byKind = (kind) => run.heroes.find((h) => h.kind === kind);
  switch (id) {
    case 'bladeAtk': byKind('blade').atk = Math.round(byKind('blade').atkBase * 1.55); break;
    case 'bowAtk': byKind('bow').atk = Math.round(byKind('bow').atkBase * 1.55); break;
    case 'atkSpeed':
      run.heroes.forEach((h) => { h.atkInterval = h.atkIntervalBase * 0.78; });
      break;
    case 'baseMax':
      run.base.maxHp += 30; run.base.hp += 30; break;
    case 'heroSpeed':
      run.heroes.forEach((h) => { h.speed = h.speedBase * 1.18; });
      break;
    default: break; // 规则型：通过 _apply 标记在对应逻辑里生效
  }
}

// ---------- 技能 ----------
function updateSkills(run, dt) {
  for (const k of Object.keys(run.skills)) {
    if (run.skills[k] > 0) run.skills[k] = Math.max(0, run.skills[k] - dt);
  }
}

function controlled(run) {
  return run.heroes.find((h) => h.isControlled);
}
function otherHero(run, hero) {
  return run.heroes.find((h) => h.id !== hero.id);
}

function castResonance(run) {
  if (run.skills.resonance > 0) return;
  const c = controlled(run);
  const o = otherHero(run, c);
  const near = dist(c, o) < SKILL.resonance.nearDist;
  const radiusMult = run._apply.resonanceRange ? 1.5 : 1;
  const radius = SKILL.resonance.radius * (near ? SKILL.resonance.radiusNearMult : 1) * radiusMult;
  const cx = near ? (c.x + o.x) / 2 : c.x;
  const cy = near ? (c.y + o.y) / 2 : c.y;
  run.skills.resonance = SKILL.resonance.cd;
  emit(run, 'resonance', { x: cx, y: cy, radius, near });
  const dmg = SKILL.resonance.damage;
  for (const e of [...run.enemies]) {
    if (dist(e, { x: cx, y: cy }) <= radius + e.radius) {
      damageEnemy(run, e, dmg, 'resonance');
    }
  }
}

function castShield(run) {
  if (run.skills.shield > 0) return;
  const c = controlled(run);
  if (c.charging) return;
  c.charging = true;
  c.chargeTimer = 0;
  run.skills.shield = SKILL.shield.cd;
  emit(run, 'shieldCharge', { hero: c.kind });
}

function doSwap(run) {
  if (run.skills.swap > 0) return;
  const c = controlled(run);
  const o = otherHero(run, c);
  const swapDmg = HERO.SWAP_DAMAGE * (run._apply.swapDamage ? 2 : 1);
  run.skills.swap = HERO.SWAP_CD;
  // 旧英雄冲向新英雄位置：路径伤害（线段两侧 SWAP_RANGE 内的敌人）
  for (const e of [...run.enemies]) {
    if (segDist(e.x, e.y, c.x, c.y, o.x, o.y) <= HERO.SWAP_RANGE + e.radius) {
      damageEnemy(run, e, swapDmg, 'swap');
    }
  }
  c.isControlled = false;
  o.isControlled = true;
  emit(run, 'swap', { from: c.kind, to: o.kind, fromX: c.x, fromY: c.y, toX: o.x, toY: o.y });
}

// ---------- 英雄 ----------
function updateHeroes(run, input, dt) {
  for (const h of run.heroes) {
    if (h.charging) {
      // 站桩充能：不移动不攻击；移动输入取消充能（仅受控英雄）
      if (h.isControlled && (Math.abs(input.moveX || 0) > 0.1 || Math.abs(input.moveY || 0) > 0.1)) {
        h.charging = false;
        h.chargeTimer = 0;
        emit(run, 'shieldCancel', { hero: h.kind });
      } else {
        h.chargeTimer += dt;
        if (run._apply.shieldLink) {
          run.base.hp = clamp(run.base.hp + dt, 0, run.base.maxHp);
        }
        if (h.chargeTimer >= SKILL.shield.channel) {
          h.charging = false;
          h.chargeTimer = 0;
          run.base.shield = clamp(run.base.shield + SKILL.shield.amount, 0, BASE.MAX_SHIELD);
          emit(run, 'shieldGain', { hero: h.kind, amount: SKILL.shield.amount });
        }
      }
      continue;
    }

    // 移动
    if (h.isControlled) {
      const mx = clamp(input.moveX || 0, -1, 1);
      const my = clamp(input.moveY || 0, -1, 1);
      moveHero(run, h, mx, my, dt);
    } else {
      aiMove(run, h, dt);
    }

    // 自动攻击
    h.atkTimer -= dt;
    if (h.atkTimer <= 0) {
      const target = nearestEnemy(run, h);
      if (target) {
        const aiMult = h.isControlled ? 1 : 1.7; // AI 协同比主控更慢，拉开主动/被动差距
        h.atkTimer = h.atkInterval * aiMult * (run._apply.twinLink && otherHero(run, h) && dist(h, otherHero(run, h)) < SKILL.resonance.nearDist ? 0.7 : 1);
        h.facing = target.x >= h.x ? 1 : -1;
        fireAt(run, h, target);
      } else {
        h.atkTimer = Math.max(0.05, h.atkInterval * 0.2); // 无目标时快速重扫
      }
    }
  }
}

function moveHero(run, h, mx, my, dt) {
  if (mx || my) {
    const len = Math.hypot(mx, my) || 1;
    h.x = clamp(h.x + (mx / len) * h.speed * dt, WORLD.PLAY_ZONE_LEFT, WORLD.PLAY_ZONE_RIGHT);
    h.y = clamp(h.y + (my / len) * h.speed * dt, WORLD.PLAY_ZONE_TOP, WORLD.PLAY_ZONE_BOTTOM);
  }
}

function aiMove(run, h, dt) {
  // AI 协同：朝「最接近基地」的敌人拦截；无威胁时回到守卫位
  const threat = nearestToBase(run);
  let tx; let ty;
  if (threat && threat.x < WORLD.PLAY_ZONE_RIGHT - 40) {
    // 拦截在敌人与基地之间，偏前一段
    tx = clamp(threat.x - 90, WORLD.PLAY_ZONE_LEFT, WORLD.PLAY_ZONE_RIGHT);
    ty = clamp(threat.y, WORLD.PLAY_ZONE_TOP, WORLD.PLAY_ZONE_BOTTOM);
  } else {
    tx = h.kind === 'blade' ? 320 : 560;
    ty = h.kind === 'blade' ? 610 : 470;
  }
  const dx = tx - h.x; const dy = ty - h.y;
  const d = Math.hypot(dx, dy);
  if (d > 6) {
    h.x = clamp(h.x + (dx / d) * HERO.AI_SPEED * dt, WORLD.PLAY_ZONE_LEFT, WORLD.PLAY_ZONE_RIGHT);
    h.y = clamp(h.y + (dy / d) * HERO.AI_SPEED * dt, WORLD.PLAY_ZONE_TOP, WORLD.PLAY_ZONE_BOTTOM);
  }
}

function nearestEnemy(run, h) {
  let best = null; let bd = Infinity;
  for (const e of run.enemies) {
    const d = dist(e, h);
    if (d <= h.range + e.radius && d < bd) { bd = d; best = e; }
  }
  return best;
}

function nearestToBase(run) {
  let best = null; let bx = Infinity;
  for (const e of run.enemies) {
    if (e.x < bx) { bx = e.x; best = e; }
  }
  return best;
}

function fireAt(run, h, target) {
  emit(run, 'shot', { hero: h.kind, x: h.x, y: h.y, tx: target.x, ty: target.y, kind: h.kind });
  let dmg = h.atk;
  damageEnemy(run, target, dmg, 'hit');
  // 弓穿透：chainBow 规则
  if (h.kind === 'bow' && run._apply.chainBow) {
    const second = nearestOtherEnemy(run, target);
    if (second) damageEnemy(run, second, Math.round(dmg * 0.6), 'hit');
  }
}

function nearestOtherEnemy(run, exclude) {
  let best = null; let bd = Infinity;
  for (const e of run.enemies) {
    if (e === exclude) continue;
    const d = dist(e, exclude);
    if (d <= 90 && d < bd) { bd = d; best = e; }
  }
  return best;
}

// ---------- 敌人 ----------
function spawnEnemies(run, dt) {
  if (run.spawnQueue.length === 0) return;
  run.spawnTimer -= dt;
  if (run.spawnTimer > 0) return;
  const kind = run.spawnQueue.shift();
  const spec = ENEMY[kind.toUpperCase()];
  const fromTop = kind === 'kamikaze' || kind === 'shield' ? run.rng() < 0.35 : run.rng() < 0.2;
  const e = {
    id: run.nextId++,
    kind,
    hp: spec.hp,
    maxHp: spec.hp,
    shield: spec.shield || 0,
    dmg: spec.dmg,
    speed: spec.speed * (0.85 + run.rng() * 0.3),
    gold: spec.gold,
    radius: spec.radius,
    color: spec.color,
    nearMissFired: false,
    attached: false,
    siegeTimer: 0,
  };
  if (fromTop) {
    e.x = clamp(WORLD.BASE_X + 260 + run.rng() * (WORLD.WIDTH - 420), WORLD.BASE_X + 220, WORLD.WIDTH - 80);
    e.y = -spec.radius - 10;
  } else {
    e.x = WORLD.WIDTH + spec.radius + 10;
    e.y = WORLD.PLAY_ZONE_TOP + 40 + run.rng() * (WORLD.PLAY_ZONE_BOTTOM - WORLD.PLAY_ZONE_TOP - 80);
  }
  run.enemies.push(e);
  if (kind === 'boss') emit(run, 'bossSpawn', { x: e.x, y: e.y, hp: e.hp });
  run.spawnTimer = FLOW.SPAWN_INTERVAL_MIN + run.rng() * (FLOW.SPAWN_INTERVAL_MAX - FLOW.SPAWN_INTERVAL_MIN);
}

function updateEnemies(run, dt) {
  for (const e of [...run.enemies]) {
    if (e.attached) continue; // 攻城单位贴在基地上持续输出，不再移动
    const dx = WORLD.BASE_X - e.x;
    const dy = BASE_Y - e.y;
    const d = Math.hypot(dx, dy) || 1;
    e.x += (dx / d) * e.speed * dt;
    e.y += (dy / d) * e.speed * dt;

    // nearMiss：贴近基地但尚未破防的紧张点
    if (!e.nearMissFired && e.x < WORLD.BASE_X + 165) {
      e.nearMissFired = true;
      emit(run, 'nearMiss', { enemy: e.kind, x: e.x, y: e.y });
    }
  }
}

function handleBaseContact(run) {
  for (const e of [...run.enemies]) {
    if (dist(e, { x: WORLD.BASE_X, y: BASE_Y }) <= WORLD.BASE_R + e.radius) {
      if (e.kind === 'kamikaze') {
        // 自爆：一次性大伤害后消失
        const idx = run.enemies.indexOf(e);
        if (idx >= 0) run.enemies.splice(idx, 1);
        damageBase(run, e.dmg, e.kind);
        emit(run, 'explode', { x: e.x, y: e.y });
      } else if (!e.attached) {
        // 攻城单位：贴在基地上持续输出，直到被英雄击杀
        e.attached = true;
        e.siegeTimer = 0;
        emit(run, 'siege', { enemy: e.kind, x: e.x, y: e.y });
      }
    }
  }
}

function updateSiege(run, dt) {
  for (const e of run.enemies) {
    if (!e.attached) continue;
    e.siegeTimer = (e.siegeTimer || 0) + dt;
    if (e.siegeTimer >= 1.0) {
      e.siegeTimer = 0;
      damageBase(run, e.dmg, e.kind);
    }
  }
}

function damageBase(run, dmg, kind) {
  if (run.base.shield > 0) {
    const absorbed = Math.min(run.base.shield, dmg);
    run.base.shield -= absorbed;
    dmg -= absorbed;
  }
  if (dmg > 0) {
    run.base.hp -= dmg;
  }
  emit(run, 'baseHit', { dmg, kind, hp: Math.max(0, run.base.hp), shield: run.base.shield });
  if (run.base.hp <= 0) {
    run.base.hp = 0;
    run.phase = 'dead';
    emit(run, 'death', { wave: run.wave });
  }
}

function damageEnemy(run, e, dmg, source) {
  if (run.phase === 'dead' || run.phase === 'win') return;
  // 护盾兵：先扣盾
  if (e.shield > 0) {
    const absorbed = Math.min(e.shield, dmg);
    e.shield -= absorbed;
    dmg -= absorbed;
    emit(run, 'hit', { enemy: e.kind, id: e.id, dmg: absorbed, shield: true, source, x: e.x, y: e.y });
  }
  if (dmg > 0) {
    e.hp -= dmg;
    emit(run, 'hit', { enemy: e.kind, id: e.id, dmg, shield: false, source, x: e.x, y: e.y });
  }
  if (e.hp <= 0) {
    const idx = run.enemies.indexOf(e);
    if (idx >= 0) run.enemies.splice(idx, 1);
    run.stats.kills += 1;
    run.gold += e.gold;
    if (e.kind === 'boss') run.stats.bossKills += 1;
    emit(run, 'kill', { enemy: e.kind, x: e.x, y: e.y, gold: e.gold });
    emit(run, 'gold', { amount: e.gold, total: run.gold });
    if (run._apply.vampiric) {
      run.base.hp = clamp(run.base.hp + 1, 0, run.base.maxHp);
      emit(run, 'heal', { amount: 1 });
    }
  }
}

// ---------- 心跳（事件密度兜底：每 1s 一个可感知脉搏） ----------
function updatePulse(run) {
  run.pulseTimer += STEP;
  if (run.pulseTimer >= 1.0) {
    run.pulseTimer = 0;
    emit(run, 'pulse', { wave: run.wave });
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const c = controlled(run);
  const boss = run.enemies.find((e) => e.kind === 'boss');
  return {
    phase: run.phase,
    wave: run.wave,
    waveMax: run.waveMax,
    baseHp: Math.max(0, Math.round(run.base.hp)),
    baseMaxHp: run.base.maxHp,
    baseShield: Math.round(run.base.shield),
    bossHp: boss ? Math.max(0, Math.round(boss.hp + boss.shield)) : 0,
    bossMax: boss ? boss.maxHp + (boss.shield || 0) : 0,
    gold: run.gold,
    kills: run.stats.kills,
    enemiesLeft: run.enemies.length + run.spawnQueue.length,
    sceneKey: sceneForWave(run.wave).key,
    controlledKind: c ? c.kind : null,
    heroes: run.heroes.map((h) => ({
      kind: h.kind, x: h.x, y: h.y, isControlled: h.isControlled, charging: h.charging,
      range: h.range, atk: h.atk,
    })),
    skills: {
      resonance: run.skills.resonance,
      resonanceCd: SKILL.resonance.cd,
      shield: run.skills.shield,
      shieldCd: SKILL.shield.cd,
      swap: run.skills.swap,
      swapCd: HERO.SWAP_CD,
      charging: c ? c.charging : false,
    },
    upgradeChoices: run.upgradeChoices,
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

// ---------- 几何 ----------
function dist(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function segDist(px, py, ax, ay, bx, by) {
  const abx = bx - ax; const aby = by - ay;
  const len2 = abx * abx + aby * aby;
  if (len2 === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * abx + (py - ay) * aby) / len2;
  t = clamp(t, 0, 1);
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}
