// 纯逻辑：路径行进 + 塔瞄准/开火 + 弹道 + 波次 + 金币/生命。
// 不碰 DOM / window / localStorage / Date.now；固定步长 tick(dt)。
import { RULES, TOWERS, ENEMIES, WAVES } from '../../config/game.config.js';
import { SPOTS, PATH_LENGTH, pointAt } from '../../config/map.js';

const towerById = Object.fromEntries(TOWERS.map((t) => [t.id, t]));
const enemyById = Object.fromEntries(ENEMIES.map((e) => [e.id, e]));
let uid = 0;

export function createRun() {
  return {
    gold: RULES.startGold,
    lives: RULES.startLives,
    waveIndex: 0,
    inWave: false,
    waveTimer: RULES.waveDelay,
    spawnQueue: [],
    spawnTimer: 0,
    towers: [],
    enemies: [],
    projectiles: [],
    kills: 0,
    phase: 'playing', // playing | won | lost
    events: [],
  };
}

export function towerStats(tower) {
  const base = towerById[tower.type];
  const lv = tower.level - 1;
  return {
    ...base,
    damage: base.damage * Math.pow(RULES.upgradeDamageMult, lv),
    range: base.range * Math.pow(RULES.upgradeRangeMult, lv),
  };
}

export function upgradeCost(tower) {
  const base = towerById[tower.type];
  return Math.floor(base.cost * RULES.upgradeCostFactor * tower.level);
}

export function towerAtSpot(run, spotIndex) {
  return run.towers.find((t) => t.spotIndex === spotIndex) || null;
}

export function placeTower(run, spotIndex, typeId) {
  if (run.phase !== 'playing') return { ok: false };
  if (towerAtSpot(run, spotIndex)) return { ok: false, reason: 'occupied' };
  const base = towerById[typeId];
  if (!base || run.gold < base.cost) return { ok: false, reason: 'gold' };
  run.gold -= base.cost;
  const spot = SPOTS[spotIndex];
  uid += 1;
  const tower = { id: uid, spotIndex, type: typeId, x: spot.x, y: spot.y, level: 1, cooldown: 0 };
  run.towers.push(tower);
  run.events.push({ type: 'build', towerId: tower.id, typeId });
  return { ok: true, tower };
}

export function upgradeTower(run, towerId) {
  const t = run.towers.find((x) => x.id === towerId);
  if (!t || run.phase !== 'playing') return { ok: false };
  if (t.level >= RULES.maxTowerLevel) return { ok: false, reason: 'max' };
  const cost = upgradeCost(t);
  if (run.gold < cost) return { ok: false, reason: 'gold' };
  run.gold -= cost;
  t.level += 1;
  run.events.push({ type: 'upgrade', towerId: t.id, level: t.level });
  return { ok: true, tower: t };
}

export function sellTower(run, towerId) {
  const idx = run.towers.findIndex((x) => x.id === towerId);
  if (idx < 0 || run.phase !== 'playing') return { ok: false };
  const t = run.towers[idx];
  const base = towerById[t.type];
  const invested = base.cost + sumUpgradeCosts(t);
  run.gold += Math.floor(invested * RULES.sellRefund);
  run.towers.splice(idx, 1);
  run.events.push({ type: 'sell', towerId });
  return { ok: true };
}

function sumUpgradeCosts(t) {
  let s = 0;
  const base = towerById[t.type];
  for (let lv = 1; lv < t.level; lv += 1) s += Math.floor(base.cost * RULES.upgradeCostFactor * lv);
  return s;
}

export function sendWave(run) {
  if (run.phase === 'playing' && !run.inWave) run.waveTimer = 0;
}

function buildQueue(wave) {
  const q = [];
  for (const g of wave.groups) {
    for (let i = 0; i < g.count; i += 1) q.push({ type: g.type, interval: g.interval });
  }
  return q;
}

function startWave(run) {
  const wave = WAVES[run.waveIndex];
  run.inWave = true;
  run.spawnQueue = buildQueue(wave);
  run.spawnTimer = 0;
  run.events.push({ type: 'wave', wave: run.waveIndex + 1 });
}

function spawnEnemy(run, type) {
  const base = enemyById[type];
  const wave = WAVES[run.waveIndex];
  uid += 1;
  run.enemies.push({
    id: uid, type,
    hp: base.hp * wave.hpMult,
    maxHp: base.hp * wave.hpMult,
    speed: base.speed,
    dist: 0,
    slow: 0,
    reward: base.reward,
    damage: base.damage,
    color: base.color,
    r: base.r,
  });
}

export function enemyPos(e) {
  return pointAt(e.dist);
}

function fireTower(run, t) {
  const stats = towerStats(t);
  // 目标：射程内沿路径最远的敌人
  let target = null;
  for (const e of run.enemies) {
    const p = enemyPos(e);
    const d = Math.hypot(p.x - t.x, p.y - t.y);
    if (d <= stats.range && (!target || e.dist > target.dist)) target = e;
  }
  if (!target) return;
  uid += 1;
  run.projectiles.push({
    id: uid, x: t.x, y: t.y, targetId: target.id,
    speed: stats.projSpeed, damage: stats.damage,
    splash: stats.splash, slow: stats.slow, color: stats.color,
  });
  t.cooldown = 1 / stats.fireRate;
  run.events.push({ type: 'shot', towerId: t.id });
}

function hitEnemy(run, e, damage, slow) {
  e.hp -= damage;
  if (slow > 0) e.slow = RULES.slowDuration;
  if (e.hp <= 0 && !e.dead) {
    e.dead = true;
    run.gold += e.reward;
    run.kills += 1;
    run.events.push({ type: 'kill', enemyId: e.id, reward: e.reward, x: enemyPos(e).x, y: enemyPos(e).y });
  }
}

export function tick(run, dt) {
  if (run.phase !== 'playing') return;

  // 波次间歇
  if (!run.inWave) {
    run.waveTimer -= dt;
    if (run.waveTimer <= 0) startWave(run);
  }

  // 生成敌人
  if (run.inWave && run.spawnQueue.length > 0) {
    run.spawnTimer -= dt;
    if (run.spawnTimer <= 0) {
      const next = run.spawnQueue.shift();
      spawnEnemy(run, next.type);
      run.spawnTimer = next.interval;
    }
  }

  // 敌人移动
  for (const e of run.enemies) {
    if (e.dead) continue;
    if (e.slow > 0) e.slow -= dt;
    const speed = e.speed * (e.slow > 0 ? 0.5 : 1);
    e.dist += speed * dt;
    if (e.dist >= PATH_LENGTH) {
      e.dead = true;
      e.leaked = true;
      run.lives -= e.damage;
      run.events.push({ type: 'leak', damage: e.damage });
      if (run.lives <= 0) {
        run.lives = 0;
        run.phase = 'lost';
        run.events.push({ type: 'lose', wave: run.waveIndex + 1 });
      }
    }
  }

  // 塔开火
  for (const t of run.towers) {
    t.cooldown -= dt;
    if (t.cooldown <= 0) fireTower(run, t);
  }

  // 弹道
  for (const p of run.projectiles) {
    const target = run.enemies.find((e) => e.id === p.targetId && !e.dead);
    if (!target) { p.dead = true; continue; }
    const tp = enemyPos(target);
    const dx = tp.x - p.x;
    const dy = tp.y - p.y;
    const d = Math.hypot(dx, dy);
    const step = p.speed * dt;
    if (d <= step + target.r) {
      // 命中
      hitEnemy(run, target, p.damage, p.slow);
      if (p.splash > 0) {
        for (const e of run.enemies) {
          if (e === target || e.dead) continue;
          const ep = enemyPos(e);
          if (Math.hypot(ep.x - tp.x, ep.y - tp.y) <= p.splash) hitEnemy(run, e, p.damage * 0.6, p.slow);
        }
        run.events.push({ type: 'splash', x: tp.x, y: tp.y, r: p.splash });
      }
      p.dead = true;
    } else {
      p.x += (dx / d) * step;
      p.y += (dy / d) * step;
    }
  }

  // 清理
  run.enemies = run.enemies.filter((e) => !e.dead);
  run.projectiles = run.projectiles.filter((p) => !p.dead);

  // 波次结束判定
  if (run.inWave && run.spawnQueue.length === 0 && run.enemies.length === 0) {
    run.inWave = false;
    run.waveIndex += 1;
    if (run.waveIndex >= WAVES.length) {
      run.phase = 'won';
      run.events.push({ type: 'win', kills: run.kills });
    } else {
      run.waveTimer = RULES.waveDelay;
      run.events.push({ type: 'waveClear', wave: run.waveIndex });
    }
  }
}

export function getHud(run) {
  return {
    gold: Math.floor(run.gold),
    lives: run.lives,
    wave: Math.min(run.waveIndex + 1, WAVES.length),
    totalWaves: WAVES.length,
    inWave: run.inWave,
    waveTimer: Math.max(0, run.waveTimer),
    kills: run.kills,
    phase: run.phase,
    towers: run.towers.length,
    enemies: run.enemies.length,
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export const WAVE_COUNT = WAVES.length;
export const SPOT_COUNT = SPOTS.length;