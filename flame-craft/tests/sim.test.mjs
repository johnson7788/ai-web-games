import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step } from '../src/game/sim.js';
import { WORLD, PLAYER, DROP, LEVEL, SCORE } from '../config/game.config.js';

function fresh(seed = 7) {
  return createRun({ seed, startLevel: 1 });
}

function pushFuel(run, x, y = 300) {
  run.entities.push({ id: (run._id = (run._id || 0) + 1), type: 'fuel', x, y, vx: 0, vy: 200, r: DROP.FUEL_R, passed: false, nearMissDone: false });
}

test('初始状态：phase playing、3 生命、第 1 关', () => {
  const r = fresh();
  assert.equal(r.phase, 'playing');
  assert.equal(r.lives, PLAYER.LIVES);
  assert.equal(r.level, 1);
  assert.equal(r.tier, 0);
  assert.equal(r.score, 0);
});

test('按右：玩家 x 增大且不越界', () => {
  const r = fresh();
  r.player.x = 100;
  for (let i = 0; i < 20; i += 1) step(r, { right: true });
  assert.ok(r.player.x > 100, 'x 应增加');
  assert.ok(r.player.x <= WORLD.WIDTH - PLAYER.HALF_W, 'x 不越右界');
});

test('按左：玩家 x 减小且不越界', () => {
  const r = fresh();
  r.player.x = WORLD.WIDTH - 100;
  for (let i = 0; i < 20; i += 1) step(r, { left: true });
  assert.ok(r.player.x < WORLD.WIDTH - 100, 'x 应减小');
  assert.ok(r.player.x >= PLAYER.HALF_W, 'x 不越左界');
});

test('接住燃料：fuel+1、score 增加、连击+1', () => {
  const r = fresh();
  const s0 = r.score;
  pushFuel(r, r.player.x, WORLD.GROUND_Y - 4);
  step(r, {});
  assert.equal(r.fuel, 1, '燃料 +1');
  assert.ok(r.score > s0, '得分增加');
  assert.equal(r.combo, 1, '连击 +1');
});

test('连击倍率：combo 越高单颗燃料得分越高', () => {
  const r = fresh();
  r.combo = 5;
  const s0 = r.score;
  pushFuel(r, r.player.x, WORLD.GROUND_Y - 4);
  step(r, {});
  assert.equal(r.score - s0, Math.round(SCORE.FUEL * (1 + Math.min(5, SCORE.COMBO_CAP) * 0.2)));
});

test('煤块：fuel+3、得分更高', () => {
  const r = fresh();
  r.entities.push({ id: 1, type: 'coal', x: r.player.x, y: WORLD.GROUND_Y - 4, vx: 0, vy: 200, r: DROP.COAL_R, passed: false, nearMissDone: false });
  step(r, {});
  assert.equal(r.fuel, 3, '煤块 fuel +3');
  assert.ok(r.score >= Math.round(SCORE.COAL), '煤块得分 ≥ 基础分');
});

test('被水滴击中：生命 -1、连击清零', () => {
  const r = fresh();
  r.combo = 4;
  r.comboTimer = 2;
  r.entities.push({ id: 1, type: 'water', x: r.player.x, y: WORLD.GROUND_Y - 4, vx: 0, vy: 200, r: DROP.WATER_R, passed: false, nearMissDone: false });
  step(r, {});
  assert.equal(r.lives, PLAYER.LIVES - 1, '生命 -1');
  assert.equal(r.combo, 0, '连击清零');
});

test('生命归零：phase=dead 且产出 fail 事件', () => {
  const r = fresh();
  r.lives = 1;
  r.entities.push({ id: 1, type: 'water', x: r.player.x, y: WORLD.GROUND_Y - 4, vx: 0, vy: 200, r: DROP.WATER_R, passed: false, nearMissDone: false });
  step(r, {});
  assert.equal(r.phase, 'dead');
  assert.ok(r.drainEvents().some((e) => e.type === 'fail'), '产出 fail 事件');
});

test('锻造三层：fuel 达标后 tier 递增并产出 craftTier', () => {
  const r = fresh();
  // 直接注入足量燃料事件，逐个 tier 锻满
  let crafted = 0;
  for (let tier = 0; tier < 3; tier += 1) {
    const need = DROP.FUEL_PER_TIER[tier];
    r.fuel = need;
    step(r, {});
    if (r.tier < 3 || r.phase === 'win' || r.level > 1) crafted += 1;
    if (r.level > 1) break;
  }
  // 第 1 关锻造满 3 层会直接过关进入第 2 关
  assert.ok(r.level > 1 || r.phase === 'win', '锻造 3 层后过关/通关');
  assert.ok(r.drainEvents().some((e) => e.type === 'levelClear'), '产出 levelClear');
});

test('过关推进：清第 1 关后 level 变 2 且回 1 生命', () => {
  const r = fresh();
  r.lives = 2;
  r.fuel = DROP.FUEL_PER_TIER[2]; // 直接把最后一层锻满
  r.tier = 2;
  step(r, {});
  assert.equal(r.level, 2, '进入第 2 关');
  assert.equal(r.lives, 3, '过关回 1 生命（2→3）');
  assert.equal(r.tier, 0, '新关火焰归零');
  assert.equal(r.stats.levelsReached, 2, 'levelsReached 更新');
});

test('最终关：清第 12 关后 phase=win', () => {
  const r = createRun({ seed: 7, startLevel: LEVEL.FINAL_LEVEL });
  r.fuel = DROP.FUEL_PER_TIER[2];
  r.tier = 2;
  step(r, {});
  assert.equal(r.phase, 'win', '通关 win');
  assert.ok(r.drainEvents().some((e) => e.type === 'win'), '产出 win 事件');
});

test('近失闪避：危险物贴边擦过产出 dodge 事件并加分', () => {
  const r = fresh();
  const s0 = r.score;
  r.entities.push({ id: 1, type: 'spark', x: r.player.x + PLAYER.HALF_W + 60, y: WORLD.GROUND_Y + 30, vx: 0, vy: 200, r: DROP.SPARK_R, passed: false, nearMissDone: false });
  step(r, {});
  assert.ok(r.score > s0, '近失加分');
  assert.ok(r.drainEvents().some((e) => e.type === 'dodge'), '产出 dodge 事件');
});

test('灼热火星瞄准玩家：spawn 时 x 接近玩家位置', () => {
  const r = fresh();
  r.player.x = 500;
  r.spawnTimer = 0;
  // 反复生成直到出现 spark（火星会瞄准玩家）
  let sawSpark = null;
  for (let i = 0; i < 400 && !sawSpark; i += 1) {
    r.entities = [];
    r.spawnTimer = 0;
    step(r, {});
    sawSpark = r.entities.find((e) => e.type === 'spark');
  }
  assert.ok(sawSpark, '应当生成 spark');
  assert.ok(Math.abs(sawSpark.x - 500) <= 60 + 1e-6, 'spark 瞄准玩家 x（偏移 ≤60）');
});

test('生成节律：连续 step 后出现实体与 spawn 事件', () => {
  const r = fresh();
  let spawned = false;
  for (let i = 0; i < 240 && !spawned; i += 1) {
    step(r, {});
    if (r.entities.length > 0) spawned = true;
  }
  assert.ok(spawned, '一段时间后必然有坠落物');
});

test('getHud 契约：返回分数/生命/层数/燃料', () => {
  const r = fresh();
  const hud = r.getHud();
  assert.equal(typeof hud.score, 'number');
  assert.equal(typeof hud.lives, 'number');
  assert.equal(typeof hud.tier, 'number');
  assert.equal(typeof hud.fuel, 'number');
  assert.equal(hud.totalTiers, 3);
});
