import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, createSim, peekRow } from '../src/game/sim.js';
import { RULES } from '../config/game.config.js';

const safe = { barrier: 0, items: ['none', 'none'] };

test('初始状态：playing / 存活 / 高度 / 0 分', () => {
  const run = createRun(1);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.alive, true);
  assert.equal(run.state.height, RULES.START_HEIGHT);
  assert.equal(run.state.score, 0);
});

test('向左爬：换道到 0 且 score+1', () => {
  const run = createRun(1);
  run.move(0);
  assert.equal(run.state.lane, 0);
  assert.equal(run.state.score, 1);
  assert.equal(run.state.height, RULES.START_HEIGHT + 1);
});

test('向右爬：换道到 1', () => {
  const run = createRun(1);
  run.move(1);
  assert.equal(run.state.lane, 1);
  assert.equal(run.state.score, 1);
});

test('海水上涨：tick 会降低高度', () => {
  const run = createRun(1);
  const h0 = run.state.height;
  run.tick(1 / 60);
  assert.ok(run.state.height < h0, '高度应该下降');
});

test('不输入会坠海死亡（cause=water）', () => {
  const run = createRun(1);
  let guard = 0;
  while (run.state.alive && guard < 60 * 10) { run.tick(1 / 60); guard += 1; }
  assert.equal(run.state.alive, false);
  assert.equal(run.state.phase, 'dead');
  assert.equal(run.state.cause, 'water');
});

test('撞到当前赛道木板死亡（cause=barrier）', () => {
  const run = createRun(1);
  run.state.rows.set(1, { barrier: -1, items: ['none', 'none'] });
  run.move(0); // 左赛道撞左木板
  assert.equal(run.state.alive, false);
  assert.equal(run.state.cause, 'barrier');
});

test('木板在另一赛道时不死亡（dodge）', () => {
  const run = createRun(1);
  run.state.rows.set(1, { barrier: -1, items: ['none', 'none'] });
  run.move(1); // 右赛道躲开左木板
  assert.equal(run.state.alive, true);
  assert.equal(run.state.score, 1);
});

test('收集当前赛道金币', () => {
  const run = createRun(1);
  run.state.rows.set(1, { barrier: 0, items: ['coin', 'none'] });
  run.move(0);
  assert.equal(run.state.coins, 1);
});

test('护盾抵挡一次撞击并存活', () => {
  const run = createRun(1);
  run.state.shieldCharges = 1;
  run.state.rows.set(1, { barrier: -1, items: ['none', 'none'] });
  run.move(0);
  assert.equal(run.state.alive, true);
  assert.equal(run.state.shieldCharges, 0);
});

test('连击累积并记录 maxCombo', () => {
  const run = createRun(1);
  for (let i = 1; i <= 3; i += 1) run.state.rows.set(i, safe);
  run.move(0); run.move(1); run.move(0);
  assert.equal(run.state.combo, 3);
  assert.equal(run.state.maxCombo, 3);
});

test('磁铁吸取两侧金币与星星', () => {
  const run = createRun(1);
  run.state.items.magnet = 10;
  run.state.rows.set(1, { barrier: 0, items: ['coin', 'star'] });
  run.move(0);
  assert.equal(run.state.coins, 1 + 3); // coin +1, star +3
  assert.equal(run.state.starGems, 1);
});

test('每 30 分速度上一档', () => {
  const run = createRun(1);
  run.state.score = 29;
  run.state.rows.set(30, safe);
  const s0 = run.sinkRate();
  run.move(0);
  assert.equal(run.state.tier, 2);
  assert.ok(run.sinkRate() > s0, '上档后下坠更快');
});

test('复活一次有效，第二次无效', () => {
  const run = createRun(1);
  run.state.height = 0;
  run.tick(0);
  assert.equal(run.state.alive, false);
  const first = run.revive();
  assert.equal(first.ok, true);
  assert.equal(run.state.alive, true);
  run.state.height = 0; run.tick(0);
  const second = run.revive();
  assert.equal(second.ok, false);
});

test('同一种子生成的行完全一致（确定性）', () => {
  const a = createRun(42);
  const b = createRun(42);
  for (let r = 1; r <= 12; r += 1) {
    assert.deepEqual(a.peek(r), b.peek(r));
  }
});

test('安全前两行无木板', () => {
  const run = createRun(1);
  assert.equal(run.peek(1).barrier, 0);
  assert.equal(run.peek(2).barrier, 0);
});

test('peekRow 导出与 run.peek 一致', () => {
  const run = createRun(7);
  assert.deepEqual(peekRow(run.state, 4), run.peek(4));
});
