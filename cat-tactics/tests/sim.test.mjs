import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, SLOT_COUNT, MAX_RUNNING, LEVEL_MAX, MISSIONS } from '../src/game/sim.js';
import { GAME, coinPerSec, recycleValue } from '../config/game.config.js';

test('初始状态：12 车位、默认金币、任务 1', () => {
  const r = createRun();
  assert.equal(r.state.slots.length, SLOT_COUNT);
  assert.equal(r.state.coins, GAME.START_COINS);
  assert.equal(r.state.mission, 1);
  assert.equal(r.state.phase, 'playing');
});

test('招募：扣钱、生成 0 级猫、招募价上涨', () => {
  const r = createRun();
  const cost0 = r.state.recruitCost;
  const res = r.buy();
  assert.equal(res.ok, true);
  assert.ok(r.state.slots[res.slot].level === 0);
  assert.equal(r.state.coins, GAME.START_COINS - cost0);
  assert.ok(r.state.recruitCost > cost0);
});

test('金币不足时招募失败', () => {
  const r = createRun();
  r.state.coins = 0;
  assert.equal(r.buy().ok, false);
});

test('车位满时招募失败', () => {
  const r = createRun();
  r.state.coins = 1e9;
  for (let i = 0; i < SLOT_COUNT; i += 1) r.buy();
  assert.equal(r.buy().ok, false);
});

test('合并：两只同阶猫 → 更高一级，腾出车位', () => {
  const r = createRun();
  r.buy();
  r.buy();
  const idx = [];
  r.state.slots.forEach((c, i) => { if (c) idx.push(i); });
  const res = r.merge(idx[0], idx[1]);
  assert.equal(res.ok, true);
  assert.equal(r.state.slots[idx[0]], null);
  assert.equal(r.state.slots[idx[1]].level, 1);
  assert.equal(r.state.totalMerges, 1);
  assert.equal(r.state.maxLevel, 1);
});

test('不同阶 / 运行中不能合并', () => {
  const r = createRun();
  r.buy();
  r.buy();
  r.buy();
  const idx = [];
  r.state.slots.forEach((c, i) => { if (c) idx.push(i); });
  r.merge(idx[0], idx[1]); // 0+0 -> 1（占 idx[1]）
  assert.equal(r.merge(idx[1], idx[2]).ok, false); // 1 与 0 不同阶
});

test('巡逻：部署后产出金币事件且累计收入', () => {
  const r = createRun();
  r.buy();
  const idx = r.state.slots.findIndex((c) => c);
  r.deploy(idx);
  assert.equal(r.state.runningCount, 1);
  assert.ok(r.state.incomePerSec > 0);
  for (let i = 0; i < 120; i += 1) r.step(1 / 60);
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'coin'), '应有 coin 事件');
  assert.ok(r.state.totalEarned > 0, '累计收入应为正');
});

test('巡逻上限 10', () => {
  const r = createRun();
  r.state.coins = 1e9;
  for (let i = 0; i < MAX_RUNNING; i += 1) r.buy();
  const idx = [];
  r.state.slots.forEach((c, i) => { if (c) idx.push(i); });
  for (const i of idx) r.deploy(i);
  assert.equal(r.state.runningCount, MAX_RUNNING);
  r.buy();
  const last = r.state.slots.findIndex((c, i) => c && !c.running);
  assert.equal(r.deploy(last).ok, false);
});

test('回收：卖掉猫返还金币并计入累计', () => {
  const r = createRun();
  r.buy();
  const idx = r.state.slots.findIndex((c) => c);
  const before = r.state.coins;
  const res = r.recycle(idx);
  assert.equal(res.ok, true);
  assert.equal(r.state.slots[idx], null);
  assert.ok(r.state.coins > before);
  assert.ok(r.state.totalEarned >= res.value);
});

test('加速：扣金币、10 秒后结束', () => {
  const r = createRun();
  const res = r.boost();
  assert.equal(res.ok, true);
  assert.equal(r.state.boostLeft, GAME.BOOST_DURATION);
  for (let i = 0; i < 60 * GAME.BOOST_DURATION + 5; i += 1) r.step(1 / 60);
  assert.ok(r.state.boostLeft <= 0);
});

test('连击：3 秒内连续合并给额外金币', () => {
  const r = createRun();
  r.state.coins = 1e9;
  for (let i = 0; i < 4; i += 1) r.buy();
  const idx = [];
  r.state.slots.forEach((c, i) => { if (c) idx.push(i); });
  r.merge(idx[0], idx[1]); // 连击 1
  const coinsBefore = r.state.coins;
  r.merge(idx[2], idx[3]); // 连击 2 → 额外金币
  assert.ok(r.state.combo >= 2);
  assert.ok(r.state.coins > coinsBefore, '连击应给额外金币');
});

test('任务推进：累计收入达标进入任务 2', () => {
  const r = createRun();
  r.state.totalEarned = MISSIONS[0].target;
  r.step(0);
  assert.equal(r.state.mission, 2);
});

test('终局：达成第 3 关目标后 won', () => {
  const r = createRun();
  r.state.totalEarned = 1e9;
  let guard = 0;
  while (r.state.phase === 'playing' && guard < 10) { r.step(0); guard += 1; }
  assert.equal(r.state.phase, 'won');
});

test('超时：不操作会在时限后 lose', () => {
  const r = createRun();
  let guard = 0;
  while (r.state.phase === 'playing' && guard < 20000) { r.step(1 / 60); guard += 1; }
  assert.equal(r.state.phase, 'lost');
});

test('收益表：coinPerSec 逐级翻倍、回收值随等级增长', () => {
  assert.equal(coinPerSec(0), 5);
  assert.equal(coinPerSec(1), 10);
  assert.equal(coinPerSec(3), 40);
  assert.ok(recycleValue(2) > recycleValue(1));
  assert.equal(recycleValue(0), GAME.RECYCLE_BASE);
});

test('星级：任务按时间给 1–3 星且累计', () => {
  const r = createRun();
  r.state.totalEarned = MISSIONS[0].target;
  r.state.missionTime = MISSIONS[0].timeLimit * 0.4; // 快速 → 3 星
  r.step(0);
  assert.equal(r.state.missionStars[0], 3);
  assert.equal(r.state.stars, 3);
});
