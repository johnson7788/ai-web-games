import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim } from '../src/game/sim.js';
import { dollByLevel, MAX_LEVEL } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

test('初始状态：12 格、页签 0 解锁、金币 60', () => {
  const run = createSim({ seed: 1 });
  assert.equal(run.state.tabs[0].slots.length, 12);
  assert.deepEqual(run.state.unlockTabs, [true, false, false]);
  assert.equal(run.state.gold, 60);
  assert.equal(run.state.stage, 1);
});

test('购买：扣金币并生成 1 级玩偶', () => {
  const run = createSim({ seed: 1 });
  const cost = dollByLevel(1).cost;
  const before = run.state.gold;
  const r = run.buy();
  assert.equal(r.ok, true);
  assert.equal(run.state.gold, before - cost);
  assert.equal(run.state.tabs[0].slots[0].doll, 1);
});

test('购买：金币不足返回失败', () => {
  const run = createSim({ seed: 1 });
  run.state.gold = 0;
  assert.equal(run.buy().ok, false);
});

test('合成：两个同等级 → 下一级并给奖励', () => {
  const run = createSim({ seed: 1 });
  run.state.tabs[0].slots[0].doll = 1;
  run.state.tabs[0].slots[1].doll = 1;
  const goldBefore = run.state.gold;
  const r = run.drag(0, 1);
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'merge');
  assert.equal(run.state.tabs[0].slots[1].doll, 2);
  assert.equal(run.state.tabs[0].slots[0].doll, 0);
  assert.equal(run.state.gold, goldBefore + dollByLevel(2).mergeBonus);
});

test('拖到不同等级：交换位置', () => {
  const run = createSim({ seed: 1 });
  run.state.tabs[0].slots[0].doll = 1;
  run.state.tabs[0].slots[1].doll = 3;
  const r = run.drag(0, 1);
  assert.equal(r.kind, 'swap');
  assert.equal(run.state.tabs[0].slots[0].doll, 3);
  assert.equal(run.state.tabs[0].slots[1].doll, 1);
});

test('拖到空格：移动', () => {
  const run = createSim({ seed: 1 });
  run.state.tabs[0].slots[0].doll = 4;
  const r = run.drag(0, 5);
  assert.equal(r.kind, 'move');
  assert.equal(run.state.tabs[0].slots[5].doll, 4);
  assert.equal(run.state.tabs[0].slots[0].doll, 0);
});

test('最高等级禁止合成', () => {
  const run = createSim({ seed: 1 });
  run.state.tabs[0].slots[0].doll = MAX_LEVEL;
  run.state.tabs[0].slots[1].doll = MAX_LEVEL;
  const r = run.drag(0, 1);
  assert.equal(r.ok, false);
  assert.equal(r.reason, 'max');
});

test('生产：推进 2s 后金币增加', () => {
  const run = createSim({ seed: 1 });
  run.state.tabs[0].slots[0].doll = 1; // prod=3 / 2s
  const before = run.state.gold;
  run.step(2.0);
  assert.ok(run.state.gold > before);
});

test('出售：回收金币并清空格', () => {
  const run = createSim({ seed: 1 });
  run.state.tabs[0].slots[0].doll = 2;
  const before = run.state.gold;
  const r = run.sell(0);
  assert.equal(r.ok, true);
  assert.equal(run.state.gold, before + dollByLevel(2).sell);
  assert.equal(run.state.tabs[0].slots[0].doll, 0);
});

test('岩块：生成后点击击碎给奖励', () => {
  const run = createSim({ seed: 7 });
  run.step(GAME.ROCK_INTERVAL + 0.01);
  const slot = run.state.tabs[0].slots.findIndex((s) => s.rock);
  assert.ok(slot >= 0, '应该有岩块生成');
  const before = run.state.gold;
  const r = run.tapRock(slot);
  assert.equal(r.ok, true);
  assert.equal(run.state.gold, before + GAME.ROCK_REWARD);
});

test('阶段：合成到 3 级通关阶段 1 并发奖励', () => {
  const run = createSim({ seed: 1 });
  run.state.tabs[0].slots[0].doll = 2;
  run.state.tabs[0].slots[1].doll = 2;
  run.drag(0, 1); // → L3
  assert.ok(run.state.stage >= 2);
  assert.ok(run.state.gold >= 100, '阶段奖励应已发放');
});

test('页签：未解锁拒绝切换，解锁后可切换', () => {
  const run = createSim({ seed: 1 });
  assert.equal(run.switchTab(1).ok, false);
  run.state.unlockTabs[1] = true;
  const r = run.switchTab(1);
  assert.equal(r.ok, true);
  assert.equal(run.state.tab, 1);
});

test('连击：窗口内连续合成递增', () => {
  const run = createSim({ seed: 1 });
  // 摆两对 L1
  run.state.tabs[0].slots[0].doll = 1;
  run.state.tabs[0].slots[1].doll = 1;
  run.state.tabs[0].slots[2].doll = 1;
  run.state.tabs[0].slots[3].doll = 1;
  run.drag(0, 1);
  assert.equal(run.state.combo, 1);
  run.drag(2, 3);
  assert.equal(run.state.combo, 2);
});

test('drainEvents 清空事件队列', () => {
  const run = createSim({ seed: 1 });
  run.buy();
  const evts = run.drainEvents();
  assert.ok(evts.length >= 1);
  assert.equal(run.state.events.length, 0);
});

test('同种子确定可复现', () => {
  const a = createSim({ seed: 42 });
  const b = createSim({ seed: 42 });
  a.buy();
  b.buy();
  assert.equal(a.state.gold, b.state.gold);
  assert.deepEqual(a.state.tabs[0].slots[0], b.state.tabs[0].slots[0]);
});
