// src/game/sim.js — FLAME CRAFT 纯逻辑：烬灵横移 + 坠落物收集/躲避 + 三层火焰锻造。
// 无 DOM/无渲染：可被 node --test 与 selfplay 直接驱动。
// 事件对象 {type, ...} 由 step() 产出，drainEvents() 消费；render/audio/ui 据此做反馈。
import { WORLD, STEP, PLAYER, DROP, LEVEL, SCORE } from '../../config/game.config.js';
import { mulberry32 } from './rng.js';

const TIER_COLORS = ['core', 'inner', 'outer'];       // 焰心 / 内焰 / 外焰

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createRun(opts = {}) {
  const seed = (opts.seed ?? 1) >>> 0;
  const rng = mulberry32(seed);

  const run = {
    phase: 'playing',           // playing | dead | win
    level: opts.startLevel ?? 1,
    seed,
    score: 0,
    lives: PLAYER.LIVES,
    tier: 0,                    // 当前锻造层 0..2（0=焰心待锻造，2 完成=过关）
    fuel: 0,                    // 当前 tier 已收集燃料
    combo: 0,                   // 连击计数
    comboTimer: 0,
    comboMax: 0,
    simTime: 0,
    player: { x: WORLD.WIDTH / 2 },
    entities: [],
    events: [],
    spawnTimer: 0.4,            // 首颗略延迟，给玩家一点准备
    rng,
    stats: { levelsReached: opts.startLevel ?? 1, collected: 0, dodges: 0, crafted: 0 },
    // 调试/验收入口：直接注入测试用坠落物
    _debug: {},
  };

  return decorate(run);
}

// step / getHud / drainEvents 是 playbook 契约别名；selfplay 直接 node 调用。
function decorate(run) {
  run.step = (input = {}) => step(run, input);
  run.drainEvents = () => {
    const evs = run.events;
    run.events = [];
    return evs;
  };
  run.getHud = () => ({
    level: run.level,
    score: run.score,
    lives: run.lives,
    tier: run.tier,
    fuel: run.fuel,
    fuelNeeded: fuelNeeded(run),
    combo: run.combo,
    comboMax: run.comboMax,
    phase: run.phase,
    simTime: run.simTime,
    totalTiers: TIER_COLORS.length,
  });
  return run;
}

function fuelNeeded(run) {
  return DROP.FUEL_PER_TIER[Math.min(run.tier, DROP.FUEL_PER_TIER.length - 1)];
}

function spawnInterval(run) {
  return Math.max(LEVEL.SPAWN_MIN, LEVEL.SPAWN_INTERVAL - run.level * 0.035);
}

function fallSpeed(base, run) {
  return base + Math.max(0, run.level - 1) * LEVEL.SPEED_STEP;
}

// 当前层颜色名（供渲染与主题使用）
export function tierColorName(run) {
  return TIER_COLORS[Math.min(run.tier, 2)];
}

function spawnEntity(run) {
  const w = LEVEL.WEIGHTS;
  const hazardStep = Math.max(0, run.level - 1) * LEVEL.HAZARD_STEP;
  const fuelW = Math.max(0.35, w.fuel - hazardStep * 2);
  const coalW = Math.max(0.03, w.coal - hazardStep * 0.2);
  const waterW = w.water + hazardStep;
  const sparkW = w.spark + hazardStep;
  const total = fuelW + coalW + waterW + sparkW;

  const roll = run.rng() * total;
  let type;
  if (roll < fuelW) type = 'fuel';
  else if (roll < fuelW + coalW) type = 'coal';
  else if (roll < fuelW + coalW + waterW) type = 'water';
  else type = 'spark';

  const x = WORLD.MIN_X + run.rng() * (WORLD.MAX_X - WORLD.MIN_X);
  const e = {
    id: (run._id = (run._id || 0) + 1),
    type,
    x,
    y: WORLD.SPAWN_Y,
    vx: 0,
    vy: fallSpeed(baseVy(type), run),
    r: baseR(type),
    passed: false,
    nearMissDone: false,
  };

  // 灼热火星瞄准玩家当前位置（预判闪避的核心威胁）；水滴 50% 略偏玩家，50% 随机雨。
  if (type === 'spark') {
    e.x = clamp(run.player.x + (run.rng() * 80 - 40), WORLD.MIN_X, WORLD.MAX_X);
    e.vy = fallSpeed(DROP.SPARK_VY, run) * 1.05;
  } else if (type === 'water') {
    if (run.rng() < 0.5) e.x = clamp(run.player.x + (run.rng() * 180 - 90), WORLD.MIN_X, WORLD.MAX_X);
  }

  run.entities.push(e);
  run.events.push({ type: type + 'Spawn', x: e.x, y: e.y });
}

function baseVy(type) {
  if (type === 'fuel') return DROP.FUEL_VY;
  if (type === 'coal') return DROP.COAL_VY;
  if (type === 'water') return DROP.WATER_VY;
  return DROP.SPARK_VY;
}
function baseR(type) {
  if (type === 'fuel') return DROP.FUEL_R;
  if (type === 'coal') return DROP.COAL_R;
  if (type === 'water') return DROP.WATER_R;
  return DROP.SPARK_R;
}

function comboMultiplier(run) {
  return 1 + Math.min(run.combo, SCORE.COMBO_CAP) * 0.2;
}

function collect(run, e) {
  const multi = comboMultiplier(run);
  if (e.type === 'fuel') {
    run.fuel += 1;
    run.score += Math.round(SCORE.FUEL * multi);
    run.events.push({ type: 'collect', x: e.x, y: e.y, score: Math.round(SCORE.FUEL * multi), combo: run.combo });
  } else { // coal
    run.fuel += 3;
    run.score += Math.round(SCORE.COAL * multi);
    run.events.push({ type: 'collectCoal', x: e.x, y: e.y, score: Math.round(SCORE.COAL * multi), combo: run.combo });
  }
  run.combo += 1;
  run.comboMax = Math.max(run.comboMax, run.combo);
  run.comboTimer = DROP.COMBO_WINDOW;
  run.stats.collected += 1;
}

function hurt(run, kind) {
  run.lives -= 1;
  run.combo = 0;
  run.comboTimer = 0;
  run.events.push({ type: 'lifeLost', kind, lives: run.lives });
  if (run.lives <= 0) {
    run.phase = 'dead';
    run.events.push({ type: 'fail', score: run.score, level: run.level });
  }
}

function maybeCraft(run) {
  while (run.fuel >= fuelNeeded(run) && run.phase === 'playing') {
    run.fuel -= fuelNeeded(run);
    run.tier += 1;
    run.score += SCORE.CRAFT_TIER;
    run.stats.crafted += 1;
    run.events.push({ type: 'craftTier', tier: run.tier, color: TIER_COLORS[Math.min(run.tier - 1, 2)] });

    if (run.tier >= 3) {
      run.score += SCORE.LEVEL_CLEAR;
      run.events.push({ type: 'levelClear', level: run.level, score: run.score });
      if (run.level >= LEVEL.FINAL_LEVEL) {
        run.phase = 'win';
        run.events.push({ type: 'win', score: run.score, level: run.level });
        return;
      }
      // 进入下一关：重置火焰，回 1 生命，难度递增
      run.level += 1;
      run.stats.levelsReached = Math.max(run.stats.levelsReached, run.level);
      run.tier = 0;
      run.fuel = 0;
      run.lives = Math.min(PLAYER.LIVES_MAX, run.lives + 1);
      run.events.push({ type: 'levelStart', level: run.level });
    }
  }
}

export function step(run, input = {}) {
  if (run.phase !== 'playing') return;

  run.simTime += STEP;

  // 连击窗口衰减
  if (run.comboTimer > 0) {
    run.comboTimer -= STEP;
    if (run.comboTimer <= 0) {
      run.combo = 0;
      run.comboTimer = 0;
    }
  }

  // 玩家横移
  const dir = input.left ? -1 : input.right ? 1 : 0;
  if (dir !== 0) {
    run.player.x = clamp(run.player.x + dir * PLAYER.SPEED * STEP, PLAYER.HALF_W, WORLD.WIDTH - PLAYER.HALF_W);
  }

  // 生成坠落物
  run.spawnTimer -= STEP;
  if (run.spawnTimer <= 0) {
    spawnEntity(run);
    run.spawnTimer = spawnInterval(run) * (0.8 + run.rng() * 0.4);
  }

  // 移动 + 碰撞 + 近失
  const pY = WORLD.GROUND_Y;
  const remaining = [];
  for (const e of run.entities) {
    e.y += e.vy * STEP;
    e.x += e.vx * STEP;

    // 与玩家的圆形碰撞（玩家近似为一个水平条）
    const dx = Math.abs(e.x - run.player.x);
    const touch = dx < (PLAYER.HALF_W + e.r) && e.y + e.r >= pY - 8 && e.y - e.r <= pY + 10;

    if (touch && !e.passed) {
      e.passed = true;
      if (e.type === 'fuel' || e.type === 'coal') {
        collect(run, e);
      } else {
        hurt(run, e.type);
      }
      continue; // 已消费，不再保留
    }

    // 近失：危险物从玩家身边擦过（横向接近但未命中），且尚未判定
    if (!e.nearMissDone && (e.type === 'water' || e.type === 'spark')) {
      if (e.y - e.r >= pY + 10 && dx < PLAYER.HALF_W + e.r + 46) {
        e.nearMissDone = true;
        run.score += SCORE.DODGE;
        run.stats.dodges += 1;
        run.events.push({ type: 'dodge', kind: e.type, x: e.x, y: e.y, score: SCORE.DODGE });
      }
    }

    if (e.y - e.r > WORLD.HEIGHT + 20) continue; // 落出屏幕
    remaining.push(e);
  }
  run.entities = remaining;

  maybeCraft(run);
}
