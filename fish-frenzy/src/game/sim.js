// FISH FRENZY · M1 模拟/玩法核心（纯逻辑，零依赖）
// 契约：docs/analysis.md（事件名 / 接口签名一字不差）
// 金币余额 = 血量；每场限时 + 营收目标；网弹按捕获率判定。
import {
  WORLD, STEP, ECONOMY, CANNON, BULLET, NET, ELECTRIC, FORECAST, BOSS, captureRate,
} from '../../config/gameplay.js';
import { STAGES, STAGE_COUNT, stageAt, clampStage } from '../../config/levels.js';
import { fishById } from '../../config/fishes.js';
import { pathById } from '../../config/paths.js';
import { mulberry32, randInt, pick, pickWeighted } from './rng.js';
import { spawnGroup, spawnBoss, stepFish, fishOffScreen } from './spawner.js';

// ---------- 创建 run ----------
export function createRun({ seed = 0, startStage = 1 } = {}) {
  const rng = mulberry32(seed);
  const stage = clampStage(startStage);
  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',
    time: 0,
    stage,
    stageTime: stageAt(stage).durationSec,
    stageRevenue: 0,
    coins: ECONOMY.START_COINS,
    cannon: { angle: -Math.PI / 2, aimX: WORLD.WIDTH / 2, aimY: 240, tier: 1 },
    fish: [],
    bullets: [],
    electricCharge: 0,
    fireCooldown: 0,
    forecast: null,          // { pathId, secsLeft }
    pendingForecast: null,   // { pathId, at }
    nextGroupAt: 1.0,
    nextForecastAt: 4.0,
    nextBossAt: BOSS.FIRST_AT,
    nextId: 1,
    events: [],
    stats: { maxStageReached: stage, totalRevenue: 0, catches: 0, won: false },
    _lastMilestone: 0,
    _lastAimX: null,
    _lastAimY: null,
    _lastAimEmit: -Infinity,
    _lastNearMiss: -Infinity,
    _forecastSeq: 0,
  };

  emit(run, 'stageStart', { stage, scene: stageAt(stage).scene });

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  return run;
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  updateCannon(run, input, dt);
  updateFire(run, input, dt);
  updateElectric(run, input, dt);
  updateForecast(run, dt);
  spawnUpTo(run);
  moveFish(run, dt);
  moveBullets(run, dt);
  updateStage(run, dt);
  cull(run);
}

// ---------- 炮台：瞄准 / 档位 / 发射 ----------
function updateCannon(run, input, dt) {
  if (input.aimX != null && input.aimY != null) {
    run.cannon.aimX = Math.max(0, Math.min(WORLD.WIDTH, input.aimX));
    run.cannon.aimY = Math.max(20, Math.min(WORLD.CANNON_Y - 30, input.aimY));
  }
  run.cannon.angle = Math.atan2(run.cannon.aimY - WORLD.CANNON_Y, run.cannon.aimX - WORLD.CANNON_X);

  // aim 事件（教程第 1 步 + 反馈密度）：瞄准点移动 >24px 且节流 0.25s
  const moved = run._lastAimX == null
    || Math.hypot(run.cannon.aimX - run._lastAimX, run.cannon.aimY - run._lastAimY) > CANNON.AIM_EMIT_PX;
  if (moved && run.time - run._lastAimEmit >= CANNON.AIM_EMIT_SEC) {
    emit(run, 'aim', { x: run.cannon.aimX, y: run.cannon.aimY });
    run._lastAimX = run.cannon.aimX;
    run._lastAimY = run.cannon.aimY;
    run._lastAimEmit = run.time;
  }

  // 档位切换
  if (input.tier != null) {
    const n = Number(input.tier);
    if (Number.isFinite(n)) {
      const tier = Math.max(CANNON.TIER_MIN, Math.min(CANNON.TIER_MAX, Math.floor(n)));
      if (tier !== run.cannon.tier) {
        run.cannon.tier = tier;
        emit(run, 'tierChange', { tier });
      }
    }
  }
}

function updateFire(run, input, dt) {
  if (run.fireCooldown > 0) run.fireCooldown -= dt;
  if (!input.fire) return;
  if (run.fireCooldown > 0) return;
  if (run.coins < 1) return;

  // 有效炮档 = min(当前档, 金币)；金币不足按能付得起的档打
  const tier = Math.max(1, Math.min(run.cannon.tier, Math.floor(run.coins)));
  run.coins -= tier;
  run.fireCooldown = BULLET.FIRE_COOLDOWN;

  const b = {
    id: run.nextId++,
    x: WORLD.CANNON_X,
    y: WORLD.CANNON_Y,
    tx: run.cannon.aimX,
    ty: run.cannon.aimY,
    tier,
    speed: BULLET.SPEED,
    electric: false,
  };
  run.bullets.push(b);
  emit(run, 'shot', { tier, x: b.tx, y: b.ty });
}

function updateElectric(run, input, dt) {
  // 充能（60s 一次）
  const prevFull = run.electricCharge >= 1;
  run.electricCharge = Math.min(1, run.electricCharge + dt / ELECTRIC.CHARGE_SEC);
  if (!prevFull && run.electricCharge >= 1) {
    emit(run, 'electricReady', {});
  }
  if (!input.electric || run.electricCharge < 1) return;

  run.electricCharge = 0;
  emit(run, 'electricFire', { x: run.cannon.aimX, y: run.cannon.aimY });
  resolveBurst(run, run.cannon.aimX, run.cannon.aimY, run.cannon.tier, true);
}

// ---------- 鱼汛预报（原创 twist：提前 5s 预告路线） ----------
function updateForecast(run, dt) {
  if (run.forecast) {
    run.forecast.secsLeft -= dt;
    if (run.forecast.secsLeft <= 0) run.forecast = null;
  }

  // 定期发布预报（预告一条额外大编队的路线）
  if (run.time >= run.nextForecastAt) {
    const stage = stageAt(run.stage);
    const pathId = pick(run.rng, stage.paths);
    emit(run, 'forecast', { path: pathId, secs: FORECAST.LEAD_SEC });
    run.forecast = { pathId, secsLeft: FORECAST.LEAD_SEC };
    run.pendingForecast = { pathId, at: run.time + FORECAST.LEAD_SEC };
    run.nextForecastAt = run.time + randInt(run.rng, FORECAST.INTERVAL_MIN * 10, FORECAST.INTERVAL_MAX * 10) / 10;
  }

  // 预报到点：在预告路线上出一大编队
  if (run.pendingForecast && run.time >= run.pendingForecast.at) {
    const stage = stageAt(run.stage);
    const { fish } = spawnGroupOnPath(run.rng, stage, run.nextId, run.pendingForecast.pathId, true);
    for (const f of fish) run.fish.push(f);
    run.nextId += fish.length;
    run.pendingForecast = null;
    emit(run, 'spawn', { count: fish.length, forecasted: true });
  }
}

function spawnUpTo(run) {
  const stage = stageAt(run.stage);
  // 常规编队
  if (run.time >= run.nextGroupAt) {
    const { fish, nextId } = spawnGroup(run.rng, stage, run.nextId);
    for (const f of fish) run.fish.push(f);
    run.nextId = nextId;
    run.nextGroupAt = run.time + stage.spawnInterval;
    emit(run, 'spawn', { count: fish.length, forecasted: false });
  }
  // Boss 场周期性出 Boss
  if (stage.boss && run.time >= run.nextBossAt) {
    const { fish, nextId } = spawnBoss(run.rng, run.nextId);
    for (const f of fish) run.fish.push(f);
    run.nextId = nextId;
    run.nextBossAt = run.time + BOSS.INTERVAL;
    emit(run, 'bossSpawn', { species: fish[0].species });
  }
}

// 在指定路径上生成编队（预报专用，dense=true 时规模更大）
function spawnGroupOnPath(rng, stage, nextId, pathId, dense = false) {
  const roster = stage.roster;
  const weights = roster.map((id) => fishById(id).weight);
  const speciesId = pickWeighted(rng, roster, weights);
  const size = dense ? 4 : 2;
  const fish = [];
  for (let i = 0; i < size; i += 1) {
    const f = makeFishInline(rng, speciesId, pathId, i * 0.3);
    f.id = nextId++;
    fish.push(f);
  }
  return { fish, pathId, speciesId, nextId };
}

// 内联 makeFish（与 spawner 的 makeFish 同构，独立以便预报直用）
function makeFishInline(rng, speciesId, pathId, delay) {
  const sp = fishById(speciesId);
  const path = pathById(pathId).points;
  return {
    species: sp.id, hp: sp.hp, value: sp.value, radius: sp.radius, speed: sp.speed,
    boss: sp.boss, x: path[0][0], y: path[0][1], pathId, path, seg: 0, travel: 0,
    phase: rng() * Math.PI * 2, sway: 0, delay, alive: true,
  };
}

// ---------- 鱼游动 ----------
function moveFish(run, dt) {
  for (const f of run.fish) {
    if (!f.alive) continue;
    if (f.delay > 0) { f.delay -= dt; continue; }
    stepFish(f, dt);
  }
}

// ---------- 网弹飞行 ----------
function moveBullets(run, dt) {
  const remaining = [];
  for (const b of run.bullets) {
    const dx = b.tx - b.x;
    const dy = b.ty - b.y;
    const d = Math.hypot(dx, dy);
    const stepLen = b.speed * dt;

    // 飞行中撞鱼 → 在鱼的位置放网（原版 onCollisionEnter 语义）
    let hitX = null;
    let hitY = null;
    for (const f of run.fish) {
      if (!f.alive) continue;
      if (Math.hypot(f.x - b.x, f.y - b.y) <= f.radius + BULLET.HIT_RADIUS) {
        hitX = f.x;
        hitY = f.y;
        break;
      }
    }

    if (hitX != null) {
      resolveBurst(run, hitX, hitY, b.tier, b.electric);
    } else if (d <= stepLen) {
      resolveBurst(run, b.tx, b.ty, b.tier, b.electric);
    } else {
      b.x += (dx / d) * stepLen;
      b.y += (dy / d) * stepLen;
      remaining.push(b);
    }
  }
  run.bullets = remaining;
}

// ---------- 捕获判定（网爆） ----------
function resolveBurst(run, x, y, tier, electric) {
  const radius = electric ? ELECTRIC.RADIUS : NET.RADIUS;
  let hits = 0;
  for (const f of run.fish) {
    if (!f.alive) continue;
    const d = Math.hypot(f.x - x, f.y - y);
    const inNet = d <= radius + f.radius;
    if (inNet) {
      const p = electric ? ELECTRIC.CAPTURE : captureRate(tier, f.hp);
      if (run.rng() < p) {
        capture(run, f, tier);
        hits += 1;
      } else {
        emit(run, 'netMiss', { species: f.species, x: f.x, y: f.y });
      }
    } else if (!electric && d <= radius + f.radius + NET.NEAR_PAD && run.time - run._lastNearMiss >= NET.NEAR_THROTTLE) {
      run._lastNearMiss = run.time;
      emit(run, 'nearMiss', { species: f.species, x: f.x, y: f.y });
    }
  }
  emit(run, 'netBurst', { x, y, tier, electric, hits });
}

function capture(run, f, tier) {
  const value = f.value * tier;
  run.coins += value;
  run.stageRevenue += value;
  run.stats.totalRevenue += value;
  run.stats.catches += 1;
  f.alive = false;
  emit(run, 'catch', { species: f.species, value, coins: run.coins, x: f.x, y: f.y });

  // 金币里程碑（每 +100 一次可感知反馈）
  const mile = Math.floor(run.coins / ECONOMY.COIN_MILESTONE);
  if (mile > run._lastMilestone) {
    run._lastMilestone = mile;
    emit(run, 'coinMilestone', { coins: run.coins });
  }
}

// ---------- 关卡推进 / 胜负 ----------
function updateStage(run, dt) {
  if (run.coins < 1) {
    die(run, 'broke');
    return;
  }
  // 营收达标立即晋级（限时是判负条件，不是等待条件）
  if (run.stageRevenue >= stageAt(run.stage).revenueTarget) {
    advanceStage(run);
    return;
  }
  run.stageTime -= dt;
  if (run.stageTime <= 0) {
    die(run, 'timeout');
  }
}

function advanceStage(run) {
  if (run.stage >= STAGE_COUNT) {
    run.stats.won = true;
    run.stats.maxStageReached = STAGE_COUNT;
    run.phase = 'won';
    emit(run, 'win', {});
    return;
  }
  emit(run, 'stageClear', { stage: run.stage, revenue: run.stageRevenue, target: stageAt(run.stage).revenueTarget });
  run.stage += 1;
  run.stats.maxStageReached = Math.max(run.stats.maxStageReached, run.stage);
  run.stageTime = stageAt(run.stage).durationSec;
  run.stageRevenue = 0;
  run.fish = [];
  run.bullets = [];
  run.forecast = null;
  run.pendingForecast = null;
  run.nextGroupAt = run.time + 1.0;
  run.nextForecastAt = run.time + 3.0;
  emit(run, 'stageStart', { stage: run.stage, scene: stageAt(run.stage).scene });
}

function die(run, reason) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { reason });
}

// ---------- 清理 ----------
function cull(run) {
  run.fish = run.fish.filter((f) => f.alive && !fishOffScreen(f));
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const stage = stageAt(run.stage);
  return {
    coins: run.coins,
    tier: run.cannon.tier,
    stage: run.stage,
    scene: stage.scene,
    stageRevenue: run.stageRevenue,
    revenueTarget: stage.revenueTarget,
    stageTime: run.stageTime,
    electric: run.electricCharge,
    forecastPath: run.forecast ? run.forecast.pathId : null,
    forecastSec: run.forecast ? run.forecast.secsLeft : 0,
    bossActive: run.fish.some((f) => f.alive && f.boss),
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
