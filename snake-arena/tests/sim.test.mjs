import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { SNAKE, GROWTH, BOOST, PULSE } from '../config/gameplay.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

// 重排整条蛇（测试用白盒）：头 + 身体按 heading 均匀铺开
function setSnake(s, headX, headY, heading) {
  s.heading = heading;
  const dx = Math.cos(heading);
  const dy = Math.sin(heading);
  for (let i = 0; i < s.segments.length; i += 1) {
    s.segments[i] = { x: headX - dx * i * SNAKE.SEGMENT_SPACING, y: headY - dy * i * SNAKE.SEGMENT_SPACING };
  }
}

function types(events) {
  return events.map((e) => e.type);
}

test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.round, 1);
  assert.equal(run.player.segments.length, SNAKE.START_SEGMENTS);
  assert.equal(run.snakes.length, 1 + 4, '第 1 场 4 条 AI');
  assert.equal(run.foods.length, 38, '第 1 场食物密度 38');
  assert.ok(run.drainEvents().some((e) => e.type === 'roundStart'));
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  assert.equal(hud.round, 1);
  assert.equal(hud.theme, 'core');
  assert.equal(hud.length, SNAKE.START_SEGMENTS);
  assert.equal(hud.phase, 'playing');
  assert.equal(typeof hud.rank, 'number');
  assert.equal(typeof hud.roundTime, 'number');
  assert.equal(typeof hud.pulseReady, 'boolean');
  assert.equal(typeof hud.boostReady, 'boolean');
});

test('同 seed 同输入 → 同结果（确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  stepN(a, 120, { steerAngle: 0, boost: false, pulse: false });
  stepN(b, 120, { steerAngle: 0, boost: false, pulse: false });
  assert.equal(a.player.segments[0].x, b.player.segments[0].x);
  assert.equal(a.player.segments[0].y, b.player.segments[0].y);
  assert.equal(a.player.heading, b.player.heading);
  assert.equal(a.foods.length, b.foods.length);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

test('转向：steerAngle 把蛇头航向拉向目标角', () => {
  const run = createRun({ seed: 3 });
  const before = run.player.heading;
  stepN(run, 10, { steerAngle: Math.PI / 2 });
  assert.ok(run.player.heading > before, '应向 PI/2 旋转');
  assert.ok(run.player.heading <= Math.PI / 2 + 0.001);
});

test('吃数据点：重量累计到阈值变长', () => {
  const run = createRun({ seed: 4 });
  const head = run.player.segments[0];
  const before = run.player.segments.length;
  run.foods.push({ id: run.nextId++, x: head.x + 1, y: head.y, kind: 'data', weight: GROWTH.FOOD_WEIGHT, vx: 0, vy: 0 });
  run.step({});
  assert.equal(run.player.segments.length, before, '1 颗不足 1 节');
  run.foods.push({ id: run.nextId++, x: head.x + 1, y: head.y, kind: 'data', weight: GROWTH.FOOD_WEIGHT, vx: 0, vy: 0 });
  run.step({});
  assert.equal(run.player.segments.length, before + 1, '2 颗 = 1 节');
  assert.ok(types(run.drainEvents()).includes('grow'));
});

test('超频：加速掉长度 + 掉光屑（第 2 场）', () => {
  const run = createRun({ seed: 5 });
  run.round = 2;
  run.foods = [];
  const before = run.player.segments.length;
  stepN(run, 40, { steerAngle: 0, boost: true, pulse: false });
  assert.ok(run.player.segments.length < before, '超频应掉节');
  assert.ok(run.drainEvents().some((e) => e.type === 'shardDrop'));
  assert.ok(run.foods.some((f) => f.kind === 'shard'));
});

test('超频第 1 场可用 / 长度过低不可启动', () => {
  const run = createRun({ seed: 6 });
  // 第 1 场即可超频（P0 核心动词，与首次引导第 3 步对齐）
  stepN(run, 3, { boost: true });
  assert.ok(types(run.drainEvents()).includes('boostStart'), '第 1 场超频应可启动');

  const low = createRun({ seed: 61 });
  low.player.segments.length = BOOST.MIN_SEGMENTS; // 长度不足（<=MIN 不可超频）
  stepN(low, 3, { boost: true });
  assert.ok(!types(low.drainEvents()).includes('boostStart'), '长度过低超频锁定');
});

test('电磁脉冲：震晕附近敌蛇 + 冷却（第 3 场）', () => {
  const run = createRun({ seed: 7 });
  run.round = 3;
  while (run.player.segments.length <= PULSE.MIN_SEGMENTS) {
    run.player.segments.push({ x: 0, y: 0 });
  }
  const ai = run.snakes[1];
  const ph = run.player.segments[0];
  ai.segments[0].x = ph.x + 60;
  ai.segments[0].y = ph.y;
  run.step({ pulse: true });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'pulse'));
  assert.ok(evs.some((e) => e.type === 'stun'));
  assert.ok(run.player.pulseCooldown > 0);
  assert.ok(ai.stunned > 0);
});

test('电磁脉冲第 2 场未解锁', () => {
  const run = createRun({ seed: 8 });
  run.round = 2;
  while (run.player.segments.length <= PULSE.MIN_SEGMENTS) run.player.segments.push({ x: 0, y: 0 });
  run.step({ pulse: true });
  assert.ok(!types(run.drainEvents()).includes('pulse'));
});

test('头对头：更长的一方存活并击杀', () => {
  const run = createRun({ seed: 9 });
  run.player.invuln = 0;
  const ai = run.snakes[1];
  ai.invuln = 0;
  const ph = run.player.segments[0];
  while (run.player.segments.length <= ai.segments.length) run.player.segments.push({ x: ph.x, y: ph.y });
  ai.heading = run.player.heading;
  ai.segments[0].x = ph.x + 5;
  ai.segments[0].y = ph.y;
  run.step({});
  assert.equal(ai.alive, false, '更短的 AI 应被击杀');
  assert.ok(types(run.drainEvents()).includes('kill'));
});

test('头撞敌身：玩家死亡（AI 拿击杀）', () => {
  const run = createRun({ seed: 10 });
  run.player.invuln = 0;
  const ai = run.snakes[1];
  ai.invuln = 0;
  const ph = run.player.segments[0];
  setSnake(ai, ph.x + 40, ph.y, run.player.heading);
  run.step({});
  assert.equal(run.phase, 'dead', '玩家撞 AI 身体应死');
  assert.ok(types(run.drainEvents()).includes('death'));
});

test('撞墙即死', () => {
  const run = createRun({ seed: 11 });
  run.player.invuln = 0;
  stepN(run, 400, {});
  assert.equal(run.phase, 'dead');
});

test('AI 死后延时重生', () => {
  const run = createRun({ seed: 12 });
  run.player.invuln = 0;
  const ai = run.snakes[1];
  ai.invuln = 0;
  const ph = run.player.segments[0];
  while (run.player.segments.length <= ai.segments.length) run.player.segments.push({ x: ph.x, y: ph.y });
  ai.heading = run.player.heading;
  ai.segments[0].x = ph.x + 5;
  ai.segments[0].y = ph.y;
  run.step({});
  assert.equal(ai.alive, false);
  run.time += 3;
  run.step({});
  assert.equal(ai.alive, true, '3s 后应重生');
});

test('90s 存活 → 进入 choosing 并出 3 个升级', () => {
  const run = createRun({ seed: 13 });
  run.roundTime = 0.01;
  run.step({});
  assert.equal(run.phase, 'choosing');
  assert.equal(run.upgradeOffers.length, 3);
});

test('chooseUpgrade 应用升级并进入下一场', () => {
  const run = createRun({ seed: 14 });
  run.roundTime = 0.01;
  run.step({});
  const id = run.upgradeOffers[0];
  run.chooseUpgrade(0);
  assert.equal(run.phase, 'playing');
  assert.equal(run.round, 2);
  assert.ok(types(run.drainEvents()).includes('roundStart'));
});

test('里程碑：每 +5 节发一次 milestone', () => {
  const run = createRun({ seed: 15 });
  run.player.weight = GROWTH.WEIGHT_PER_SEGMENT * 5;
  const head = run.player.segments[0];
  run.foods.push({ id: run.nextId++, x: head.x + 1, y: head.y, kind: 'data', weight: GROWTH.FOOD_WEIGHT, vx: 0, vy: 0 });
  run.step({});
  assert.ok(types(run.drainEvents()).includes('milestone'));
});

test('磁吸升级：半径内食物被拉向蛇头', () => {
  const run = createRun({ seed: 16 });
  run.upgrades.magnetRadius = 130;
  const head = run.player.segments[0];
  const f = { id: run.nextId++, x: head.x + 100, y: head.y, kind: 'data', weight: GROWTH.FOOD_WEIGHT, vx: 0, vy: 0 };
  run.foods.push(f);
  run.step({});
  assert.ok(f.x < head.x + 100, '食物应被拉近');
});

test('overclock 升级：超频不再掉光屑（仍掉长度）', () => {
  const run = createRun({ seed: 17 });
  run.round = 2;
  run.upgrades.overclock = true;
  run.foods = [];
  const before = run.player.segments.length;
  stepN(run, 40, { steerAngle: 0, boost: true, pulse: false });
  assert.ok(run.player.segments.length < before);
  assert.ok(!run.foods.some((f) => f.kind === 'shard'));
});

test('击杀让玩家击杀数 +1', () => {
  const run = createRun({ seed: 18 });
  run.player.invuln = 0;
  const ai = run.snakes[1];
  ai.invuln = 0;
  const ph = run.player.segments[0];
  while (run.player.segments.length <= ai.segments.length) run.player.segments.push({ x: ph.x, y: ph.y });
  ai.heading = run.player.heading;
  ai.segments[0].x = ph.x + 5;
  ai.segments[0].y = ph.y;
  const killsBefore = run.stats.kills;
  run.step({});
  assert.equal(run.stats.kills, killsBefore + 1);
});

test('玩家死后 step 无副作用', () => {
  const run = createRun({ seed: 19 });
  run.player.invuln = 0;
  stepN(run, 400, {});
  assert.equal(run.phase, 'dead');
  const t = run.time;
  run.step({});
  assert.equal(run.time, t, '死后时间不再推进');
});
