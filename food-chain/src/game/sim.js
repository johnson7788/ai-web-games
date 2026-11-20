// FOOD CHAIN · M1 模拟/玩法核心（纯逻辑，零依赖）
// 契约：createRun({seed}) → { step(input), getHud(), drainEvents(), phase, ... }
// 事件名（音频/渲染/UI 各消费）：eatFood / eatPrey / eatToxic / lightChain / evolve /
//   devolve / nearMiss / symbioseStart / symbioseProgress / stingGain / stingUse /
//   death / win / milestone / danger
import {
  WORLD, STEP, PLAYER, FOOD, FISH, TOXIC, SYMBIOSE, NEAR_MISS, CURRENT, SCORE,
  clamp, playerSpeedAt,
} from '../../config/gameplay.js';
import { stageAt, stageDef, radiusAt, FINAL_STAGE, nextMassTarget, zoneAtStage } from '../../config/stages.js';
import { mulberry32 } from './rng.js';
import { makeFood, makeFish, makeJelly, spawnFishAwayFromPlayer } from './spawner.js';

const M = WORLD.MARGIN;

// ---------- 创建 run ----------
export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',           // playing | dead | won
    time: 0,
    player: {
      x: WORLD.WIDTH / 2,
      y: WORLD.HEIGHT / 2,
      vx: 0,
      vy: 0,
      mass: PLAYER.MASS_START,
      stage: 0,
      r: radiusAt(0),
      stingUntil: -Infinity,
      invulnUntil: -Infinity,
      toxicSenseUntil: -Infinity,
      symbioseJellyId: null,
      symbioseProgress: 0,
      _symbiosePulseAt: 0,
      _milestoneAt: 0,
    },
    foods: [],
    fish: [],
    jellies: [],
    nextId: 1,
    stats: {
      stage: 0,
      maxStage: 0,
      maxMass: 0,
      score: 0,
      eaten: 0,
      evolved: 0,
      lightChains: 0,
      stingUses: 0,
      nearMisses: 0,
    },
    events: [],
    _nearMissAt: -Infinity,
    _dangerAt: -Infinity,
  };

  // 初始填充
  for (let i = 0; i < FOOD.COUNT; i += 1) run.foods.push(makeFood(rng, run.nextId++));
  for (let i = 0; i < FISH.COUNT; i += 1) {
    run.fish.push(spawnFishAwayFromPlayer(rng, run.nextId++, 0, run.player.x, run.player.y, 180));
  }

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
  const p = run.player;

  updatePlayer(run, input, dt);            // 1 移动（含暗流）
  updateFish(run, dt);                     // 2 鱼 AI
  updateFood(run, dt);                     // 3 食物漂移
  updateJellies(run, dt);                  // 4 水母漂移
  maintain(run);                           // 5 补充实体
  handlePlayerFishCollisions(run);         // 6 吞噬 / 致死 / 擦肩
  handleFoodPickup(run);                   // 7 吃食物
  handleSymbiose(run, dt);                 // 8 共生蓄能
  updateStage(run);                        // 9 阶段推进（evolve/devolve/win）
  heartbeat(run, dt);                      // 10 细粒度里程碑（遥测密度）

  if (run.phase === 'playing') {
    run.stats.maxMass = Math.max(run.stats.maxMass, p.mass);
    run.stats.maxStage = Math.max(run.stats.maxStage, p.stage);
  }
}

// ---------- 玩家移动（缓动追踪目标 + 暗流）----------
function updatePlayer(run, input, dt) {
  const p = run.player;
  const speed = playerSpeedAt(p.stage);

  if (input.steerX == null || input.steerY == null) {
    // 无输入：惯性衰减（noinput 不会乱动）
    p.vx *= 0.88;
    p.vy *= 0.88;
  } else {
    const tx = clamp(input.steerX, 0, WORLD.WIDTH);
    const ty = clamp(input.steerY, 0, WORLD.HEIGHT);
    p.vx = clamp((tx - p.x) * PLAYER.LERP, -speed, speed);
    p.vy = clamp((ty - p.y) * PLAYER.LERP, -speed, speed);
  }

  // 暗流区（热泉带）：横推
  if (inCurrent(p)) {
    p.vx += CURRENT.VX * dt * 2.2;
  }

  p.x = clamp(p.x + p.vx * dt, M + p.r, WORLD.WIDTH - M - p.r);
  p.y = clamp(p.y + p.vy * dt, M + p.r, WORLD.HEIGHT - M - p.r);
}

function inCurrent(e) {
  return e.y >= CURRENT.Y1 && e.y <= CURRENT.Y2;
}

// ---------- 鱼 AI：追猎（更大）/ 逃逸（更小）/ 漫游 ----------
function updateFish(run, dt) {
  const p = run.player;
  for (const f of run.fish) {
    const dx = p.x - f.x;
    const dy = p.y - f.y;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;

    // 鱼速：越小越快（猎物能逃）
    const speed = Math.max(95, FISH.BASE_SPEED * (1.18 - f.stage * 0.045));
    const bigger = f.r > p.r;

    if (bigger && dist < FISH.CHASE_RANGE) {
      // 更大：追猎玩家（noinput 也必然被追上）
      f.vx += (ux * speed - f.vx) * 3 * dt;
      f.vy += (uy * speed - f.vy) * 3 * dt;
      if (run.time - run._dangerAt > 0.8) {
        run._dangerAt = run.time;
        emit(run, 'danger', { x: f.x, y: f.y, stage: f.stage });
      }
    } else if (!bigger && dist < FISH.FLEE_RANGE) {
      // 更小：逃逸
      f.vx += (-ux * speed - f.vx) * 3 * dt;
      f.vy += (-uy * speed - f.vy) * 3 * dt;
    } else {
      // 漫游
      f.wanderTimer -= dt;
      if (f.wanderTimer <= 0) {
        f.wanderTimer = FISH.WANDER_CHANGE;
        f.wanderAngle = run.rng() * Math.PI * 2;
      }
      f.vx += (Math.cos(f.wanderAngle) * speed * 0.5 - f.vx) * 2 * dt;
      f.vy += (Math.sin(f.wanderAngle) * speed * 0.5 - f.vy) * 2 * dt;
    }

    if (inCurrent(f)) f.vx += CURRENT.VX * dt * 2.2;

    f.x = clamp(f.x + f.vx * dt, M + f.r, WORLD.WIDTH - M - f.r);
    f.y = clamp(f.y + f.vy * dt, M + f.r, WORLD.HEIGHT - M - f.r);
  }
}

// ---------- 食物漂移 ----------
function updateFood(run, dt) {
  for (const fd of run.foods) {
    fd.x += fd.vx * dt;
    fd.y += fd.vy * dt;
    if (fd.x < M + fd.r || fd.x > WORLD.WIDTH - M - fd.r) fd.vx *= -1;
    if (fd.y < M + fd.r || fd.y > WORLD.HEIGHT - M - fd.r) fd.vy *= -1;
    fd.x = clamp(fd.x, M + fd.r, WORLD.WIDTH - M - fd.r);
    fd.y = clamp(fd.y, M + fd.r, WORLD.HEIGHT - M - fd.r);
  }
}

// ---------- 水母漂移 ----------
function updateJellies(run, dt) {
  for (const j of run.jellies) {
    j.phase += dt * 0.8;
    j.x += j.vx * dt;
    j.y += j.vy * dt;
    if (j.x < M + j.r || j.x > WORLD.WIDTH - M - j.r) j.vx *= -1;
    if (j.y < M + j.r || j.y > WORLD.HEIGHT - M - j.r) j.vy *= -1;
    j.x = clamp(j.x, M + j.r, WORLD.WIDTH - M - j.r);
    j.y = clamp(j.y, M + j.r, WORLD.HEIGHT - M - j.r);
  }
}

// ---------- 补充实体 ----------
function maintain(run) {
  const p = run.player;
  const eco = stageDef(p.stage).ecology;

  while (run.foods.length < FOOD.COUNT) {
    run.foods.push(makeFood(run.rng, run.nextId++));
  }
  while (run.fish.length < FISH.COUNT) {
    run.fish.push(spawnFishAwayFromPlayer(run.rng, run.nextId++, p.stage, p.x, p.y, 170));
  }
  const jellyTarget = eco.jellyRate > 0 ? 2 : 0;
  while (run.jellies.length < jellyTarget) {
    run.jellies.push(makeJelly(run.rng, run.nextId++));
  }
  if (run.jellies.length > jellyTarget) {
    run.jellies.length = jellyTarget;
  }
}

// ---------- 玩家 vs 鱼：吞噬 / 致死 / 擦肩 ----------
function handlePlayerFishCollisions(run) {
  const p = run.player;
  const sting = p.stingUntil > run.time;
  const eatMaxR = p.r * (sting ? SYMBIOSE.STING_RATIO : FISH.EAT_RATIO);

  const remaining = [];
  for (const f of run.fish) {
    const dist = Math.hypot(f.x - p.x, f.y - p.y);
    const deadly = f.r > eatMaxR;

    if (deadly) {
      const deathDist = (p.r + f.r) * FISH.DEATH_DIST_MUL;
      if (dist < deathDist) {
        if (run.time < p.invulnUntil) {
          remaining.push(f); // 光链无敌：短时间免死
          continue;
        }
        die(run, f);
        return;
      }
      maybeNearMiss(run, f, dist, deathDist);
      remaining.push(f);
    } else {
      const eatDist = p.r + f.r * FISH.EAT_DIST_MUL;
      if (dist < eatDist) {
        eatFish(run, f, sting);
      } else {
        remaining.push(f);
      }
    }
  }
  run.fish = remaining;
}

function eatFish(run, f, sting) {
  const p = run.player;

  if (f.toxic) {
    // 毒刺鱼：能吃≠该吃，掉体型
    p.mass = Math.max(0, p.mass - TOXIC.MASS_LOSS);
    emit(run, 'eatToxic', { x: f.x, y: f.y, massLoss: TOXIC.MASS_LOSS, stage: f.stage });
    // 吃错后短暂标记：3s 内毒刺鱼高亮（toxicSense 规则）
    p.toxicSenseUntil = run.time + 3;
    return;
  }

  // 普通吞噬
  const sameLevel = f.stage === p.stage && !f.toxic;
  let massGain = (f.stage + 1) * 4;
  if (sameLevel) massGain = Math.round(massGain * 1.5);

  // 毒刺吞大一级（stingUse）
  const ateBigger = f.r > p.r * FISH.EAT_RATIO;

  p.mass += massGain;
  run.stats.eaten += 1;
  run.stats.score += massGain * SCORE.PREY_PER_MASS;

  if (sameLevel) {
    run.stats.lightChains += 1;
    run.stats.score += SCORE.LIGHT_CHAIN;
    p.invulnUntil = run.time + 0.6; // 光链进化：短无敌
    emit(run, 'lightChain', { x: f.x, y: f.y, stage: f.stage });
  } else {
    emit(run, 'eatPrey', { x: f.x, y: f.y, stage: f.stage, mass: massGain });
  }

  if (ateBigger && sting) {
    run.stats.stingUses += 1;
    run.stats.score += SCORE.STING_USE;
    p.stingUntil = -Infinity; // 毒刺用掉
    emit(run, 'stingUse', { x: f.x, y: f.y, stage: f.stage });
  }
}

function maybeNearMiss(run, f, dist, deathDist) {
  if (run.time - run._nearMissAt < NEAR_MISS.THROTTLE) return;
  if (dist < deathDist + NEAR_MISS.GAP) {
    run._nearMissAt = run.time;
    run.stats.nearMisses += 1;
    run.player.mass += NEAR_MISS.BONUS_MASS; // 差一点：风险换小奖励
    run.stats.score += NEAR_MISS.BONUS_MASS * SCORE.PREY_PER_MASS;
    emit(run, 'nearMiss', { x: run.player.x, y: run.player.y, gap: Math.round(dist - deathDist) });
  }
}

function die(run, killer) {
  if (run.phase !== 'playing') return;
  run.phase = 'dead';
  emit(run, 'death', { x: run.player.x, y: run.player.y, killerStage: killer ? killer.stage : null });
}

// ---------- 吃食物 ----------
function handleFoodPickup(run) {
  const p = run.player;
  const remaining = [];
  for (const fd of run.foods) {
    const dist = Math.hypot(fd.x - p.x, fd.y - p.y);
    if (dist < p.r + fd.r) {
      p.mass += FOOD.MASS;
      run.stats.score += SCORE.FOOD;
      emit(run, 'eatFood', { x: fd.x, y: fd.y });
    } else {
      remaining.push(fd);
    }
  }
  run.foods = remaining;
}

// ---------- 共生：贴水母 3s 换护体毒刺 ----------
function handleSymbiose(run, dt) {
  const p = run.player;
  if (p.symbioseJellyId != null) {
    const j = run.jellies.find((x) => x.id === p.symbioseJellyId);
    if (!j) { p.symbioseJellyId = null; p.symbioseProgress = 0; return; }
    const dist = Math.hypot(j.x - p.x, j.y - p.y);
    if (dist > SYMBIOSE.RADIUS + p.r) {
      p.symbioseJellyId = null;
      p.symbioseProgress = 0;
      return;
    }
    p.symbioseProgress += dt;
    if (run.time - p._symbiosePulseAt >= SYMBIOSE.PROGRESS_PULSE) {
      p._symbiosePulseAt = run.time;
      emit(run, 'symbioseProgress', { progress: p.symbioseProgress, needed: SYMBIOSE.SEC });
    }
    if (p.symbioseProgress + 1e-9 >= SYMBIOSE.SEC) {
      p.stingUntil = run.time + SYMBIOSE.STING_SEC;
      p.symbioseJellyId = null;
      p.symbioseProgress = 0;
      emit(run, 'stingGain', { x: p.x, y: p.y, sec: SYMBIOSE.STING_SEC });
    }
    return;
  }

  // 寻找可进入共生的水母
  for (const j of run.jellies) {
    const dist = Math.hypot(j.x - p.x, j.y - p.y);
    if (dist < SYMBIOSE.RADIUS + p.r) {
      p.symbioseJellyId = j.id;
      p.symbioseProgress = 0;
      p._symbiosePulseAt = run.time;
      emit(run, 'symbioseStart', { x: j.x, y: j.y });
      break;
    }
  }
}

// ---------- 阶段推进 / 胜利 ----------
function updateStage(run) {
  const p = run.player;
  const s = stageAt(p.mass);
  if (s > p.stage) {
    emit(run, 'evolve', { from: p.stage, to: s });
    run.stats.evolved += 1;
    run.stats.score += SCORE.EVOLVE;
  } else if (s < p.stage) {
    emit(run, 'devolve', { from: p.stage, to: s });
  }
  p.stage = s;
  p.r = radiusAt(s);
  if (p.stage >= FINAL_STAGE && run.phase === 'playing') {
    run.phase = 'won';
    run.stats.maxStage = FINAL_STAGE;
    emit(run, 'win', { stage: p.stage, mass: Math.round(p.mass) });
  }
}

// ---------- 细粒度里程碑（心跳，保证事件密度）----------
function heartbeat(run, dt) {
  const p = run.player;
  if (run.time - p._milestoneAt >= 1.0) {
    p._milestoneAt = run.time;
    emit(run, 'milestone', { mass: Math.round(p.mass), stage: p.stage, score: run.stats.score });
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  const p = run.player;
  const sting = p.stingUntil > run.time;
  const zone = zoneAtStage(p.stage);
  return {
    stage: p.stage,
    mass: p.mass,
    score: run.stats.score,
    zone,
    zoneName: `zone.${zone}`,
    stingActive: sting,
    stingLeft: sting ? Math.max(0, p.stingUntil - run.time) : 0,
    stingMax: SYMBIOSE.STING_SEC,
    growTo: nextMassTarget(p.mass),
    growLeft: Math.max(0, nextMassTarget(p.mass) - p.mass),
    radius: p.r,
    phase: run.phase,
    final: p.stage >= FINAL_STAGE,
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
