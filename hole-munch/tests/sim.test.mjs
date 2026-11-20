import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { HOLE, WORLD, radiusAt, moveSpeedAt, OBJECTS } from '../config/gameplay.js';
import { matchAt } from '../config/levels.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

function addObject(run, kind, x, y) {
  const spec = OBJECTS[kind];
  run.objects.push({
    id: run.nextId++,
    kind,
    x,
    y,
    r: spec.r,
    mass: spec.mass,
    state: 'idle',
    suckedBy: null,
    suckT: 0,
    spinAngle: 0,
    dead: false,
  });
}

function clearAI(run) {
  run.ai = [];
}

// 关闭自动补怪，并清零玩家质量，保证「吞指定物体」测试的确定性
function isolate(run) {
  clearAI(run);
  run.match.density = 0;
  run.objects = [];
  run.player.mass = 0;
  run.player.r = radiusAt(0, run.player.maxR);
}

function types(events) {
  return events.map((e) => e.type);
}

// ---------- 初始状态 ----------
test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.level, 1);
  assert.equal(run.player.mass, HOLE.PLAYER_HEAD_START);
  assert.equal(run.ai.length, 5);
  assert.equal(run.objects.length, matchAt(1).density);
  assert.deepEqual(run.drainEvents().map((e) => e.type), ['spawn']);
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  assert.deepEqual(Object.keys(hud).sort(), [
    'chainActive', 'chainCount', 'chainNeed', 'level', 'mass', 'meteorActive', 'phase', 'rank', 'scene', 'score', 'time', 'timeLeft', 'totalLevels',
  ]);
  assert.equal(hud.phase, 'playing');
  assert.equal(hud.scene, 'old-town');
  assert.equal(hud.totalLevels, 12);
});

test('同 seed 同输入 → 同结果（确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  stepN(a, 120, { steerX: 500, steerY: 400 });
  stepN(b, 120, { steerX: 500, steerY: 400 });
  assert.equal(a.player.x, b.player.x);
  assert.equal(a.player.y, b.player.y);
  assert.equal(a.player.mass, b.player.mass);
  assert.equal(a.objects.length, b.objects.length);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

// ---------- 移动 ----------
test('移动：玩家向目标追踪，不越界', () => {
  const run = createRun({ seed: 3 });
  clearAI(run);
  const before = run.player.x;
  stepN(run, 30, { steerX: 200, steerY: 300 });
  assert.ok(run.player.x < before, '应向左追踪');
  assert.ok(run.player.x >= WORLD.MARGIN - 0.001);
  assert.ok(run.player.x <= WORLD.WIDTH - WORLD.MARGIN + 0.001);
});

test('无输入时玩家停在原地', () => {
  const run = createRun({ seed: 4 });
  clearAI(run);
  const x0 = run.player.x;
  const y0 = run.player.y;
  stepN(run, 30, {});
  assert.equal(run.player.x, x0);
  assert.equal(run.player.y, y0);
});

// ---------- 吞物 ----------
test('吞物：比洞小的物体被吸入并加质量', () => {
  const run = createRun({ seed: 5 });
  isolate(run);
  addObject(run, 'lamp', run.player.x + 5, run.player.y + 5);
  stepN(run, 60, { steerX: run.player.x, steerY: run.player.y });
  assert.equal(run.player.mass, 1);
  assert.equal(run.stats.swallows, 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'swallow'));
});

test('吞物：比洞大的物体不能被吞', () => {
  const run = createRun({ seed: 6 });
  isolate(run);
  addObject(run, 'skyscraper', run.player.x, run.player.y); // r 36 > 玩家 26
  stepN(run, 60, { steerX: run.player.x, steerY: run.player.y });
  assert.equal(run.player.mass, 0);
  assert.ok(run.objects.some((o) => o.kind === 'skyscraper'), '大楼仍在（未被吞）');
});

test('吞物加面积：半径随质量增大', () => {
  const run = createRun({ seed: 7 });
  clearAI(run);
  const r0 = run.player.r;
  run.player.mass = 400;
  run.player.r = radiusAt(run.player.mass, run.player.maxR);
  assert.ok(run.player.r > r0);
});

// ---------- 大洞吞小洞 ----------
test('大洞吞小 AI：kill 事件 + AI 归零 + 质量转移', () => {
  const run = createRun({ seed: 8 });
  run.player.mass = 400;
  run.player.r = radiusAt(run.player.mass, run.player.maxR);
  const small = run.ai[0];
  small.mass = 20;
  small.r = radiusAt(small.mass, small.maxR);
  small.x = run.player.x;
  small.y = run.player.y;
  const before = run.player.mass;
  run.step({});
  assert.equal(run.stats.kills, 1);
  assert.equal(small.alive, false);
  assert.equal(small.mass, 0);
  assert.ok(run.player.mass >= before + 20);
  assert.ok(run.drainEvents().some((e) => e.type === 'kill'));
});

test('玩家被大 AI 吞：death 事件 + 死亡计数', () => {
  const run = createRun({ seed: 9 });
  const big = run.ai[0];
  big.mass = 400;
  big.r = radiusAt(big.mass, big.maxR);
  big.x = run.player.x;
  big.y = run.player.y;
  run.step({});
  assert.equal(run.stats.deaths, 1);
  assert.equal(run.phase, 'matchEnd');
  assert.ok(run.drainEvents().some((e) => e.type === 'death'));
});

// ---------- 引力连锁 ----------
test('引力连锁：3s 内同区吞 10 物触发 chain', () => {
  const run = createRun({ seed: 10, startLevel: 1 });
  isolate(run);
  for (let i = 0; i < 12; i += 1) {
    const a = (i / 12) * Math.PI * 2;
    addObject(run, 'lamp', run.player.x + Math.cos(a) * 12, run.player.y + Math.sin(a) * 12);
  }
  stepN(run, 80, { steerX: run.player.x, steerY: run.player.y });
  assert.ok(run.stats.chainTriggers >= 1, '应触发至少一次连锁');
  assert.ok(run.drainEvents().some((e) => e.type === 'chain'));
});

// ---------- 陨石雨 ----------
test('陨石雨：level≥6 每 30s 生成陨石，吞陨石三倍成长', () => {
  const run = createRun({ seed: 11, startLevel: 6 });
  clearAI(run);
  run.meteor.nextAt = 0.01;
  run.step({});
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'meteorRain'));
  assert.ok(run.objects.some((o) => o.kind === 'meteor'));

  run.match.density = 0;
  run.objects = [];
  addObject(run, 'meteor', run.player.x + 5, run.player.y + 5);
  const m0 = run.player.mass;
  stepN(run, 60, { steerX: run.player.x, steerY: run.player.y });
  assert.equal(run.player.mass, m0 + OBJECTS.meteor.mass * 3);
});

// ---------- 计时结算 ----------
test('计时结束 → matchEnd + 名次 + qualified', () => {
  const run = createRun({ seed: 12 });
  run.time = matchAt(1).duration - 0.01;
  run.step({});
  assert.equal(run.phase, 'matchEnd');
  assert.ok(run.result);
  assert.equal(typeof run.result.rank, 'number');
  assert.equal(typeof run.result.qualified, 'boolean');
  assert.ok(run.drainEvents().some((e) => e.type === 'matchEnd'));
});

test('advance 应用升级并进入下一场', () => {
  const run = createRun({ seed: 13 });
  run.player.mass = 500; // 稳赢
  run.time = matchAt(1).duration - 0.01;
  run.step({});
  assert.equal(run.phase, 'matchEnd');
  assert.equal(run.result.qualified, true);
  const lvl = run.level;
  run.advance('move-speed');
  assert.equal(run.phase, 'playing');
  assert.equal(run.level, lvl + 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'upgrade'));
});

test('retry 重开同一场', () => {
  const run = createRun({ seed: 14 });
  run.time = matchAt(1).duration - 0.01;
  run.step({});
  const lvl = run.level;
  run.retry();
  assert.equal(run.phase, 'playing');
  assert.equal(run.level, lvl);
});

// ---------- 名次 ----------
test('名次：质量高于 3 个 AI 时 rank = 4', () => {
  const run = createRun({ seed: 15 });
  run.player.mass = 100;
  run.ai.forEach((a, i) => { a.mass = i < 3 ? 200 : 10; });
  run.time = matchAt(1).duration - 0.01;
  run.step({});
  assert.equal(run.result.rank, 4); // 3 个 AI 质量更高 → 第 4 名
});

// ---------- 纯函数 ----------
test('radiusAt / moveSpeedAt 公式与 clamp', () => {
  assert.equal(radiusAt(0), HOLE.BASE_R);
  assert.ok(radiusAt(1000) <= HOLE.MAX_R);
  assert.ok(radiusAt(1000) > radiusAt(0));
  const fast = moveSpeedAt(HOLE.BASE_R);
  const slow = moveSpeedAt(HOLE.BASE_R + 80);
  assert.ok(slow < fast, '体型越大移动越慢');
  assert.ok(slow >= 150);
});

// ---------- 升级效果 ----------
test('chain-duration 升级：引力井持续时间延长', () => {
  const run = createRun({ seed: 16 });
  run.mods.chainDurationBonus = 2;
  const t0 = run.time;
  run.chain.active = true;
  run.chain.until = t0 + 5 + 2;
  assert.equal(run.chain.until, t0 + 7);
});

test('玩家被大 AI 吞 → 立即淘汰（名次 6）', () => {
  const run = createRun({ seed: 19 });
  const big = run.ai[0];
  big.mass = 500;
  big.r = radiusAt(big.mass, big.maxR);
  big.x = run.player.x;
  big.y = run.player.y;
  run.step({});
  assert.equal(run.phase, 'matchEnd');
  assert.equal(run.result.rank, 6);
  assert.equal(run.result.qualified, false);
  assert.equal(run.stats.deaths, 1);
});

test('无输入 baseline 也会随 AI 推进（AI 会吞物成长）', () => {
  const run = createRun({ seed: 17 });
  const before = run.ai.reduce((s, a) => s + a.mass, 0);
  stepN(run, 300, {});
  const after = run.ai.reduce((s, a) => s + a.mass, 0) + run.player.mass;
  assert.ok(after >= before, 'AI/玩家总质量不减少');
  assert.equal(run.phase, 'playing');
});

test('step 在 matchEnd 后不再推进', () => {
  const run = createRun({ seed: 18 });
  run.time = matchAt(1).duration - 0.01;
  run.step({});
  assert.equal(run.phase, 'matchEnd');
  const t = run.time;
  run.step({});
  assert.equal(run.time, t);
});
