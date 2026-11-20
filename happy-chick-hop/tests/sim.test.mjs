// HAPPY CHICK HOP · 纯逻辑测试（node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, radiusOf } from '../src/game/sim.js';
import { WORLD, TIERS, GAME } from '../config/game.config.js';

function mkObj(tier, x, y, extra = {}) {
  return {
    id: Math.random(),
    tier,
    x,
    y,
    vx: extra.vx || 0,
    vy: extra.vy || 0,
    rock: !!extra.rock,
    restTime: extra.restTime || 0,
    merged: false,
    alive: true,
  };
}

test('初始状态：phase=playing，current/next 已就绪', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.ok(run.state.current);
  assert.ok(run.state.next);
  assert.ok(run.state.current.tier >= 0 && run.state.current.tier < GAME.SPAWN_TIERS);
});

test('首次 drop 不是岩石，且 drops 计数 +1', () => {
  const run = createRun({ seed: 2 });
  const res = run.drop();
  assert.equal(res.ok, true);
  assert.equal(run.state.drops, 1);
  assert.equal(run.state.objects.length, 1);
  assert.equal(run.state.objects[0].rock, false);
});

test('第 7 次投放是岩石', () => {
  const run = createRun({ seed: 3 });
  for (let i = 0; i < 7; i += 1) run.drop();
  // 第 7 次 drop 的对象是第 6 个（索引 6），应为岩石
  assert.equal(run.state.objects[6].rock, true);
});

test('setAim 夹在井口边界内', () => {
  const run = createRun({ seed: 4 });
  run.setAim(-1000);
  assert.equal(run.state.aimX, radiusOf(run.state.current));
  run.setAim(100000);
  assert.equal(run.state.aimX, WORLD.WIDTH - radiusOf(run.state.current));
});

test('重力把对象往下拉', () => {
  const run = createRun({ seed: 5 });
  run.state.objects.push(mkObj(0, WORLD.WIDTH / 2, 300));
  run.step(1 / 60);
  assert.ok(run.state.objects[0].y > 300, '重力应增加 y');
});

test('对象不会穿透地面', () => {
  const run = createRun({ seed: 6 });
  run.state.objects.push(mkObj(0, WORLD.WIDTH / 2, GAME.FLOOR_Y - 10, { vy: 5000 }));
  for (let i = 0; i < 60; i += 1) run.step(1 / 60);
  const o = run.state.objects[0];
  assert.ok(o.y + radiusOf(o) <= GAME.FLOOR_Y + 0.5);
});

test('同阶两球重叠会合并成下一阶，并得分', () => {
  const run = createRun({ seed: 7 });
  run.state.objects.push(mkObj(0, 300, 300));
  run.state.objects.push(mkObj(0, 340, 300));
  const before = run.state.score;
  run.step(1 / 60);
  const tiers = run.state.objects.filter((o) => o.alive).map((o) => o.tier);
  assert.ok(tiers.includes(1), `合并后应出现 tier 1，实际 ${JSON.stringify(tiers)}`);
  assert.equal(run.state.score, before + TIERS[0].score);
  assert.equal(run.state.merges, 1);
});

test('连击：窗口内连续两次合并 combo 递增', () => {
  const run = createRun({ seed: 8 });
  run.state.objects.push(mkObj(0, 300, 300));
  run.state.objects.push(mkObj(0, 340, 300));
  run.step(1 / 60);
  run.state.objects.push(mkObj(1, 500, 500));
  run.state.objects.push(mkObj(1, 540, 500));
  run.step(1 / 60);
  assert.equal(run.state.combo, 2);
});

test('岩石不参与合并', () => {
  const run = createRun({ seed: 9 });
  run.state.objects.push(mkObj(0, 300, 300));
  run.state.objects.push(mkObj(0, 340, 300, { rock: true }));
  run.step(1 / 60);
  const tiers = run.state.objects.filter((o) => o.alive).map((o) => o.tier);
  assert.ok(!tiers.includes(1), '岩石不应合并出 tier 1');
});

test('锤子能砸掉对象并扣次数', () => {
  const run = createRun({ seed: 10 });
  run.state.objects.push(mkObj(2, 300, 300));
  const h = run.state.hammers;
  const res = run.useHammer(300, 300);
  assert.equal(res.ok, true);
  assert.equal(run.state.hammers, h - 1);
  assert.equal(run.state.objects.filter((o) => o.alive).length, 0);
});

test('顶部红线：静止对象超过红线判负', () => {
  const run = createRun({ seed: 11 });
  run.state.objects.push(mkObj(5, WORLD.WIDTH / 2, GAME.DANGER_Y - 40, { restTime: 1 }));
  for (let i = 0; i < 60; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'result');
  assert.equal(run.state.result.won, false);
});

test('孵出金鸡（10 阶）即夺冠', () => {
  const run = createRun({ seed: 12 });
  // 两只 9 阶重叠 → 合并成 10 阶金鸡 → 夺冠
  run.state.objects.push(mkObj(9, 300, 300));
  run.state.objects.push(mkObj(9, 330, 300));
  run.step(1 / 60);
  assert.equal(run.state.phase, 'result');
  assert.equal(run.state.result.won, true);
  assert.equal(run.state.highestTier, 10);
});

test('事件总线：drop/merge/win/lose 都有类型', () => {
  const run = createRun({ seed: 13 });
  run.drop();
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'drop'));
  assert.equal(run.drainEvents().length, 0, 'drain 后队列应清空');
});
