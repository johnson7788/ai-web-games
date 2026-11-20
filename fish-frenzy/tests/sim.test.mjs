import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WORLD, ECONOMY, CANNON, captureRate, expectedValue } from '../config/gameplay.js';
import { STAGE_COUNT } from '../config/levels.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

function types(events) {
  return events.map((e) => e.type);
}

function injectFish(run, { x = 640, y = 300, hp = 1, value = 3, radius = 20, species = 4, boss = false } = {}) {
  const f = {
    id: run.nextId++, species, hp, value, radius, speed: 40, boss,
    x, y, pathId: 0, path: null, seg: 0, travel: 0, phase: 0, sway: 0, delay: 0, alive: true,
  };
  run.fish.push(f);
  return f;
}

// ---------- 契约 / 初始状态 ----------
test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.coins, ECONOMY.START_COINS);
  assert.equal(run.stage, 1);
  assert.equal(run.cannon.tier, 1);
  assert.equal(run.stats.maxStageReached, 1);
  assert.deepEqual(run.drainEvents().map((e) => e.type), ['stageStart']);
  assert.deepEqual(run.drainEvents(), []);
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  assert.deepEqual(Object.keys(hud).sort(), [
    'bossActive', 'coins', 'electric', 'forecastPath', 'forecastSec', 'phase',
    'revenueTarget', 'scene', 'stage', 'stageRevenue', 'stageTime', 'tier',
  ]);
  assert.equal(hud.phase, 'playing');
  assert.equal(hud.coins, ECONOMY.START_COINS);
  assert.equal(hud.stage, 1);
});

test('同 seed 同输入 → 同结果（随机种子确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  stepN(a, 120, { aimX: 500, aimY: 200, fire: true, tier: 2 });
  stepN(b, 120, { aimX: 500, aimY: 200, fire: true, tier: 2 });
  assert.equal(a.coins, b.coins);
  assert.equal(a.stage, b.stage);
  assert.equal(a.fish.length, b.fish.length);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

test('captureRate：档位/血量 clamp 到 [0.05, 0.95]', () => {
  assert.equal(captureRate(1, 2), 0.5);
  assert.equal(captureRate(7, 1), 0.95);
  assert.equal(captureRate(1, 100), 0.05);
  assert.ok(captureRate(3, 8) > 0.3 && captureRate(3, 8) < 0.4);
  assert.equal(expectedValue(10, 2, 5), 10 * 0.4);
});

// ---------- 炮台 / 档位 ----------
test('aim 事件：瞄准点移动触发', () => {
  const run = createRun({ seed: 3 });
  run.step({ aimX: 640, aimY: 200, fire: false, tier: 1 });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'aim'));
});

test('tierChange：档位切换发事件', () => {
  const run = createRun({ seed: 4 });
  run.step({ tier: 5 });
  assert.equal(run.cannon.tier, 5);
  assert.ok(run.drainEvents().some((e) => e.type === 'tierChange' && e.tier === 5));
});

test('档位 clamp 到 1..7', () => {
  const run = createRun({ seed: 5 });
  run.step({ tier: 99 });
  assert.equal(run.cannon.tier, 7);
  run.step({ tier: -5 });
  assert.equal(run.cannon.tier, 1);
});

// ---------- 发射 / 金币 ----------
test('发射扣金币 + 发 shot + 生成子弹', () => {
  const run = createRun({ seed: 6 });
  run.step({ aimX: 640, aimY: 200, fire: true, tier: 3 });
  assert.equal(run.cannon.tier, 3);
  assert.equal(run.coins, ECONOMY.START_COINS - 3);
  assert.equal(run.bullets.length, 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'shot' && e.tier === 3));
});

test('金币不足 1 时无法发射', () => {
  const run = createRun({ seed: 7 });
  run.coins = 0;
  run.step({ aimX: 640, aimY: 200, fire: true, tier: 1 });
  assert.equal(run.bullets.length, 0);
});

test('网弹到点必发 netBurst（无论是否捕获）', () => {
  const run = createRun({ seed: 8 });
  run.step({ aimX: 640, aimY: 300, fire: true, tier: 1 });
  stepN(run, 60);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'netBurst'));
});

test('捕获：命中概率捕获，捕获后金币增加', () => {
  const run = createRun({ seed: 9 });
  injectFish(run, { x: 640, y: 300, hp: 1, value: 3 });
  let caught = false;
  for (let i = 0; i < 40 && !caught; i += 1) {
    run.step({ aimX: 640, aimY: 300, fire: true, tier: 1 });
    if (run.drainEvents().some((e) => e.type === 'catch')) caught = true;
  }
  assert.ok(caught, '40 发内应捕获（p=0.95）');
  assert.ok(run.stats.catches >= 1);
  assert.ok(run.stats.totalRevenue >= 3);
});

// ---------- 关卡推进 / 胜负 ----------
test('营收达标 → 晋级 stageClear + stage+1', () => {
  const run = createRun({ seed: 10 });
  run.stageRevenue = 120; // 达到第 1 场目标
  run.stageTime = 0.01;
  run.step({});
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'stageClear' && e.stage === 1));
  assert.equal(run.stage, 2);
  assert.equal(run.stageRevenue, 0);
});

test('超时且未达标 → death(timeout)', () => {
  const run = createRun({ seed: 11 });
  run.stageRevenue = 0;
  run.stageTime = 0.01;
  run.step({});
  assert.equal(run.phase, 'dead');
  assert.ok(run.drainEvents().some((e) => e.type === 'death' && e.reason === 'timeout'));
});

test('金币打空 → death(broke)', () => {
  const run = createRun({ seed: 12 });
  run.coins = 0;
  run.step({});
  assert.equal(run.phase, 'dead');
  assert.ok(run.drainEvents().some((e) => e.type === 'death' && e.reason === 'broke'));
});

test('第 12 场达标 → win + won=true', () => {
  const run = createRun({ seed: 13, startStage: STAGE_COUNT });
  run.stageRevenue = 99999;
  run.stageTime = 0.01;
  run.step({});
  assert.equal(run.phase, 'won');
  assert.equal(run.stats.won, true);
  assert.ok(run.drainEvents().some((e) => e.type === 'win'));
});

// ---------- 鱼汛预报 / 电击网 / Boss ----------
test('鱼汛预报：定期发 forecast，到点额外出编队', () => {
  const run = createRun({ seed: 14 });
  let forecastSeen = false;
  for (let i = 0; i < 60 * 12; i += 1) {
    run.step({});
    if (run.drainEvents().some((e) => e.type === 'forecast')) forecastSeen = true;
  }
  assert.ok(forecastSeen, '12 秒内应有预报');
});

test('电击网：60s 充能发 electricReady，可群捕', () => {
  const run = createRun({ seed: 15 });
  run.stageTime = 9999; // 避免第 1 场 45s 超时提前判负
  let ready = false;
  for (let i = 0; i < 60 * 61; i += 1) {
    run.step({});
    if (run.drainEvents().some((e) => e.type === 'electricReady')) { ready = true; break; }
  }
  assert.ok(ready, '60s 内应充能完成');
  assert.equal(run.electricCharge, 1);
  injectFish(run, { x: 640, y: 300, hp: 1 });
  run.step({ aimX: 640, aimY: 300, electric: true });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'electricFire'));
  assert.equal(run.electricCharge, 0);
});

test('Boss 场周期性出 Boss + bossSpawn 事件', () => {
  const run = createRun({ seed: 16, startStage: 4 });
  let bossSeen = false;
  for (let i = 0; i < 60 * 8; i += 1) {
    run.step({});
    if (run.drainEvents().some((e) => e.type === 'bossSpawn')) { bossSeen = true; break; }
  }
  assert.ok(bossSeen, 'Boss 场 8 秒内应出 Boss');
});

// ---------- 鱼游动 / 清理 ----------
test('鱼沿路径游动', () => {
  const run = createRun({ seed: 17 });
  const f = injectFish(run, { x: 0, y: 300 });
  f.path = [[0, 300], [100, 300]];
  f.seg = 0;
  f.speed = 100;
  stepN(run, 40); // 0.667s → 约 66px，未到终点但已移动
  assert.ok(f.x > 0, '鱼应移动');
});

test('无输入基线：鱼自动生成、计时推进，最终超时判负', () => {
  const run = createRun({ seed: 18 });
  stepN(run, 60 * 60);
  assert.ok(run.time >= 44, '时间应推进到第 1 场时限附近');
  assert.equal(run.phase, 'dead');
  assert.equal(run.stats.maxStageReached, 1);
});
