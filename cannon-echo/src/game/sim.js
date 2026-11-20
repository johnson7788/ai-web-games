// CANNON ECHO · M1 模拟/玩法核心（纯逻辑，零依赖，可 node --test 直接测）
// 契约：docs/analysis.md（事件名 / 接口签名一字不差）
import { WORLD, STEP } from '../../config/game.config.js';
import {
  CANNON, BULLET, ECHO, HEAT, FORTRESS, TARGET, DEFENSE, WAVE, SCORE, NEAR_MISS, FX,
  clamp, waveMult, targetHp, cannonLevel,
} from '../../config/gameplay.js';
import { WAVES, WAVE_COUNT, sceneAt } from '../../config/levels.js';
import { mulberry32, randInt, pick } from './rng.js';

// 升级池（rule/stat 对应 config/design.json 的 upgrades）
const UPGRADE_IDS = ['ricochet', 'pierce', 'echoChain', 'heatVent', 'frost', 'bossBuster', 'power', 'rate', 'coolant', 'velocity'];

const UPGRADE_DEFS = {
  ricochet: { apply(run) { run.echoBounces += 1; run.echoDecay = Math.min(run.echoDecay, ECHO.DECAY_RICOCHET); } },
  pierce: { apply(run) { run.pierce += 1; } },
  echoChain: { apply(run) { run.echoChain = true; } },
  heatVent: { apply(run) { run.heatVent = true; } },
  frost: { apply(run) { run.frost = true; } },
  bossBuster: { apply(run) { run.bossBuster = true; } },
  power: { apply(run) { run.attackMult *= 1.45; } },
  rate: { apply(run) { run.rateMult *= 1.35; } },
  coolant: { apply(run) { run.coolMult *= 1.45; } },
  velocity: { apply(run) { run.velocityMult *= 1.30; } },
};

// 升级自动选择超时（无输入时也推进，保证 noinput 能走到死亡）
const UPGRADE_TIMEOUT = 6;

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const lv = CANNON.levels[0];

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing', // playing | upgrade | dead | won
    time: 0,
    wave: 1,
    scene: 0,
    hp: FORTRESS.HP,
    maxHp: FORTRESS.MAX_HP,
    level: CANNON.START_LEVEL,
    attack: lv.attack,
    fireInterval: lv.fireInterval,
    cooldown: 0,
    heat: 0,
    fire: false,
    overheated: false,
    overheatLockUntil: -Infinity,
    aimX: WORLD.CANNON_X,
    aimY: 0,
    angle: 0,
    attackMult: 1,
    rateMult: 1,
    coolMult: 1,
    velocityMult: 1,
    echoBounces: ECHO.BASE_BOUNCES,
    echoDecay: ECHO.DECAY,
    pierce: 0,
    echoChain: false,
    heatVent: false,
    frost: false,
    bossBuster: false,
    targets: [],
    bullets: [],
    nextId: 1,
    upgradeChoices: [],
    upgradeTimer: 0,
    takenUpgrades: new Set(),
    nearMissAt: -Infinity,
    lastShot: null,
    stats: { score: 0, maxWave: 1, boxesBroken: 0, echoHits: 0, bestStreak: 0 },
    _milestone: 0,
    _lastAimX: WORLD.CANNON_X,
    _lastAimY: 0,
    events: [],
  };

  spawnWave(run, 1);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.chooseUpgrade = (id) => chooseUpgrade(run, id);
  return run;
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing' && run.phase !== 'upgrade') return;
  const dt = STEP;
  run.time += dt;

  if (run.phase === 'upgrade') {
    run.upgradeTimer += dt;
    if (run.upgradeTimer >= UPGRADE_TIMEOUT) {
      chooseUpgrade(run, run.upgradeChoices[0]);
    }
    return;
  }

  updateAim(run, input);
  run.fire = !!input.fire;
  updateCannon(run, dt);
  updateBullets(run, dt);
  updateTargets(run, dt);
  maybeAdvanceWave(run);
}

// ---------- 瞄准 ----------
function updateAim(run, input) {
  if (input.aimX != null && input.aimY != null) {
    run.aimX = clamp(input.aimX, 0, WORLD.WIDTH);
    run.aimY = clamp(input.aimY, 0, WORLD.HEIGHT);
  }
  const dx = run.aimX - WORLD.CANNON_X;
  const dy = WORLD.CANNON_Y - run.aimY; // 向上为正
  const up = Math.max(dy, 1);
  let theta = Math.atan2(dx, up);
  theta = clamp(theta, -BULLET.MAX_ANGLE, BULLET.MAX_ANGLE);
  run.angle = theta;
}

// ---------- 炮台射击 / 过热 ----------
function updateCannon(run, dt) {
  // 过热锁管计时
  if (run.overheated) {
    if (run.time >= run.overheatLockUntil) {
      run.overheated = false;
      run.heat = 0;
      emit(run, 'overheatLock', {});
    }
  }

  // 不射击时冷却
  if (!run.fire) {
    run.heat = Math.max(0, run.heat - HEAT.COOL * run.coolMult * dt);
  }
  run.cooldown = Math.max(0, run.cooldown - dt);

  if (!run.fire || run.overheated || run.cooldown > 0) return;

  run.fire = false; // 每 tick 一次性触发（main 持续按 fire 会在下一 tick 再次置位）
  run.cooldown = run.fireInterval / run.rateMult;
  run.heat += HEAT.PER_SHOT;

  spawnBullet(run, 0, 0);
  emit(run, 'shot', { x: WORLD.CANNON_X, y: WORLD.CANNON_Y, angle: run.angle });

  if (run.heat >= HEAT.MAX) {
    run.heat = HEAT.MAX;
    run.overheated = true;
    run.overheatLockUntil = run.time + HEAT.LOCK_SEC;
    emit(run, 'overheat', {});
    if (run.heatVent) {
      // 泄压：过热瞬间爆发三向散弹并立即泄压
      spawnBullet(run, -0.5, -20);
      spawnBullet(run, 0.5, -20);
      run.overheated = false;
      run.heat = 0;
      run.overheatLockUntil = -Infinity;
      emit(run, 'overheatLock', { vent: true });
    }
  }
}

// ---------- 生成炮弹 ----------
function spawnBullet(run, angleOffset, vxOffset) {
  const lv = cannonLevel(run.level);
  const speed = BULLET.SPEED * run.velocityMult;
  const angle = run.angle + angleOffset;
  const vx = Math.sin(angle) * speed + vxOffset;
  const vy = -Math.cos(angle) * speed; // 向上为负（屏幕 y 向下为正）
  const damage = lv.attack * run.attackMult;
  run.bullets.push({
    id: run.nextId++,
    x: WORLD.CANNON_X,
    y: WORLD.CANNON_Y - 30,
    vx,
    vy,
    damage,
    bounces: 0,
    pierceLeft: run.pierce,
    life: BULLET.LIFE,
    targetsHit: [],
    roared: false,
  });
}

// ---------- 更新炮弹 ----------
function updateBullets(run, dt) {
  const alive = [];
  for (const b of run.bullets) {
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;

    // 崖壁反弹：回声弹在崖壁处转为水平横扫（vy=0），直觉瞄准「打目标同高的崖壁」
    if (b.x <= WORLD.WALL_L + BULLET.R && b.vx < 0) {
      if (b.bounces < run.echoBounces) {
        b.vx = Math.abs(b.vx);
        b.vy = 0;
        b.bounces += 1;
        b.damage *= run.echoDecay;
        emit(run, 'echoBounce', { x: WORLD.WALL_L, y: b.y, bounces: b.bounces });
      } else {
        continue; // 弹尽，销毁
      }
    } else if (b.x >= WORLD.WALL_R - BULLET.R && b.vx > 0) {
      if (b.bounces < run.echoBounces) {
        b.vx = -Math.abs(b.vx);
        b.vy = 0;
        b.bounces += 1;
        b.damage *= run.echoDecay;
        emit(run, 'echoBounce', { x: WORLD.WALL_R, y: b.y, bounces: b.bounces });
      } else {
        continue;
      }
    }

    if (b.life <= 0 || b.y < -50 || b.y > WORLD.HEIGHT + 50) continue;

    // 命中目标
    const hit = collideBullet(run, b);
    if (hit === 'consumed') continue; // 未穿透，销毁
    alive.push(b);
  }
  run.bullets = alive;
}

// 返回 'consumed'（销毁炮弹）或 null（继续飞行）；穿透命中则继续
function collideBullet(run, b) {
  for (const t of run.targets) {
    if (t.dead) continue;
    const x1 = t.x - t.w / 2 - BULLET.R;
    const x2 = t.x + t.w / 2 + BULLET.R;
    const y1 = t.y - t.h / 2 - BULLET.R;
    const y2 = t.y + t.h / 2 + BULLET.R;
    if (b.x < x1 || b.x > x2 || b.y < y1 || b.y > y2) continue;

    const echoHit = b.bounces >= 1;
    let dmg = b.damage;
    if (t.shield && !echoHit) dmg = 0;
    else if (t.armor && !echoHit) dmg *= DEFENSE.ARMOR_DIRECT_MULT;
    else if (t.armor && run.bossBuster) dmg *= 2.5;

    // 霜冻：直射击中减速
    if (run.frost && !echoHit) {
      t.slowUntil = run.time + 2;
      t.slowMult = 0.5;
    }

    emit(run, 'hit', { x: b.x, y: b.y, targetId: t.id, damage: Math.round(dmg), echo: echoHit });
    if (echoHit) run.stats.echoHits += 1;

    if (dmg > 0) {
      t.hitFlash = run.time;
      t.hp -= dmg;
      if (t.hp <= 0) destroyTarget(run, t, b);
    }

    // 一箭三雕：单弹命中 ≥3 个不同目标
    if (!b.targetsHit.includes(t.id)) {
      b.targetsHit.push(t.id);
      if (b.targetsHit.length >= 3 && !b.roared) {
        b.roared = true;
        run.stats.score += 500;
        emit(run, 'echoRoar', { x: t.x, y: t.y });
        emit(run, 'milestone', { score: run.stats.score });
      }
    }

    if (b.pierceLeft > 0) {
      b.pierceLeft -= 1;
      return null; // 穿透继续飞
    }
    return 'consumed';
  }
  return null;
}

function destroyTarget(run, t, b) {
  t.dead = true;
  const score = Math.round(t.score);
  run.stats.score += score;
  run.stats.boxesBroken += 1;
  if (run.stats.boxesBroken > run.stats.bestStreak) run.stats.bestStreak = run.stats.boxesBroken;
  emit(run, 'break', { x: t.x, y: t.y, targetType: t.type, score, echo: b && b.bounces >= 1 });
  if (t.type === 'boss') {
    emit(run, 'bossBreak', { x: t.x, y: t.y });
  }
  maybeMilestone(run);
}

// ---------- 更新目标（下坠 / 撞要塞） ----------
function updateTargets(run, dt) {
  const alive = [];
  for (const t of run.targets) {
    if (t.dead) continue;
    const slow = t.slowUntil != null && run.time < t.slowUntil ? (t.slowMult ?? 0.5) : 1;
    t.y += t.vy * slow * dt;
    if (t.y + t.h / 2 >= WORLD.FORTRESS_Y) {
      // 撞上要塞
      t.dead = true;
      run.hp -= t.crash;
      emit(run, 'crash', { x: t.x, y: WORLD.FORTRESS_Y, targetType: t.type, damage: t.crash });
      if (run.hp <= 0) {
        run.hp = 0;
        die(run);
        return;
      }
      continue;
    }
    alive.push(t);
  }
  run.targets = alive;
}

// ---------- 波次推进 ----------
function maybeAdvanceWave(run) {
  if (run.targets.length > 0) return;

  if (run.wave >= WAVE_COUNT) {
    // 第 12 波 Boss 已清 → 胜利
    run.phase = 'won';
    emit(run, 'win', { score: run.stats.score });
    return;
  }

  // 波清：先给升级三选一（除最后一波后）
  run.phase = 'upgrade';
  run.upgradeTimer = 0;
  emit(run, 'waveCleared', { wave: run.wave });
  generateUpgradeChoices(run);
}

function generateUpgradeChoices(run) {
  const pool = UPGRADE_IDS.filter((id) => !run.takenUpgrades.has(id));
  const choices = [];
  const tmp = pool.slice();
  while (choices.length < 3 && tmp.length) {
    const i = Math.floor(run.rng() * tmp.length);
    choices.push(tmp.splice(i, 1)[0]);
  }
  run.upgradeChoices = choices;
}

export function chooseUpgrade(run, id) {
  if (run.phase !== 'upgrade') return false;
  if (!run.upgradeChoices.includes(id)) id = run.upgradeChoices[0];
  if (!id) { advanceToNextWave(run); return true; }
  run.takenUpgrades.add(id);
  const def = UPGRADE_DEFS[id];
  if (def) def.apply(run);
  emit(run, 'upgrade', { id });
  advanceToNextWave(run);
  return true;
}

function advanceToNextWave(run) {
  run.wave += 1;
  if (run.wave > run.stats.maxWave) run.stats.maxWave = run.wave;
  run.phase = 'playing';
  spawnWave(run, run.wave);
}

function spawnWave(run, wave) {
  const scene = sceneAt(wave);
  run.scene = scene.index;
  const spec = WAVES[clamp(wave - 1, 0, WAVE_COUNT - 1)];
  spec.targets.forEach((s, i) => {
    const lane = s.lane != null ? s.lane : randInt(run.rng, 0, WAVE.LANES.length - 1);
    const x = WAVE.LANES[clamp(lane, 0, WAVE.LANES.length - 1)];
    const type = s.type;
    const def = TARGET[type] || TARGET.crate;
    run.targets.push({
      id: run.nextId++,
      type,
      x,
      y: WAVE.SPAWN_Y + i * 46 + run.rng() * 24,
      w: TARGET.W,
      h: TARGET.H,
      hp: targetHp(type, wave),
      maxHp: targetHp(type, wave),
      vy: def.vy,
      score: Math.round(def.score * waveMult(wave)),
      crash: def.crash,
      shield: def.shield,
      armor: def.armor,
      hitFlash: -Infinity,
      slowUntil: null,
      slowMult: 1,
      dead: false,
    });
  });
  emit(run, 'waveEnter', { wave, scene: run.scene, name: `scene.${run.scene}` });
}

// ---------- 死亡 ----------
function die(run) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { score: run.stats.score, wave: run.wave });
}

// ---------- 里程碑 ----------
function maybeMilestone(run) {
  const m = Math.floor(run.stats.score / SCORE.MILESTONE);
  if (m > run._milestone) {
    run._milestone = m;
    emit(run, 'milestone', { score: run.stats.score });
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  let bossHp = 0;
  let bossMax = 0;
  for (const t of run.targets) {
    if (t.type === 'boss') {
      bossHp = Math.max(0, Math.round(t.hp));
      bossMax = Math.max(1, Math.round(t.maxHp));
    }
  }
  return {
    score: Math.floor(run.stats.score),
    wave: run.wave,
    maxWave: run.stats.maxWave,
    hp: Math.max(0, Math.round(run.hp)),
    hpMax: run.maxHp,
    heat: Math.round(run.heat),
    heatMax: HEAT.MAX,
    level: run.level,
    overheated: run.overheated,
    bossHp,
    bossMax,
    scene: run.scene,
    sceneName: `scene.${run.scene}`,
    phase: run.phase,
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
