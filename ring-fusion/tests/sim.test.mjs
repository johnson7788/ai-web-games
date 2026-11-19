import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun,
  EMPTY,
  STONE,
  canPlace,
  computeRemovals,
  applyRemovals,
  POINTS,
  SLOTS,
  LEVELS,
} from '../src/game/sim.js';

function emptyRun(seed = 1) {
  return createRun({ mode: 'classic', levelIndex: 0, seed });
}

test('初始化：9 环点 × 3 槽 + 3 手牌 + playing', () => {
  const run = emptyRun();
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.points.length, POINTS);
  assert.equal(run.state.hand.length, 3);
  assert.ok(run.state.points.every((p) => p.length === SLOTS));
  assert.ok(run.state.hand.some((t) => t.some((v) => v !== EMPTY)));
});

test('canPlace：空槽可放，占槽不可放', () => {
  const tile = [0, EMPTY, EMPTY];
  assert.equal(canPlace(tile, [EMPTY, EMPTY, EMPTY]), true);
  assert.equal(canPlace(tile, [1, EMPTY, EMPTY]), false);
  assert.equal(canPlace([0, EMPTY, 2], [EMPTY, 1, EMPTY]), true);
});

test('放置：把环写进目标点并清空手牌', () => {
  const run = emptyRun();
  run.state.hand[0] = [2, EMPTY, EMPTY];
  const res = run.place(0, 0);
  assert.equal(res.ok, true);
  assert.equal(run.state.points[0][0], 2);
  assert.deepEqual(run.state.hand[0], [EMPTY, EMPTY, EMPTY]);
});

test('放置失败：目标槽已占用', () => {
  const run = emptyRun();
  run.state.points[4][1] = 1;
  run.state.hand[0] = [EMPTY, 3, EMPTY];
  const res = run.place(0, 4);
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'occupied');
});

test('单点三环同色：放置后整点消除', () => {
  const run = emptyRun();
  run.state.points[0] = [5, 5, EMPTY];
  run.state.hand[0] = [EMPTY, EMPTY, 5];
  const res = run.place(0, 0);
  assert.equal(res.ok, true);
  assert.ok(res.removed >= 3, `removed=${res.removed}`);
  assert.deepEqual(run.state.points[0], [EMPTY, EMPTY, EMPTY]);
  assert.equal(run.state.combo, 1);
});

test('横线三消：三环点各含同色即消', () => {
  const run = emptyRun();
  run.state.points[0] = [0, EMPTY, EMPTY];
  run.state.points[1] = [0, EMPTY, EMPTY];
  run.state.points[2] = [EMPTY, EMPTY, EMPTY];
  run.state.hand[0] = [0, EMPTY, EMPTY];
  const res = run.place(0, 2);
  assert.equal(res.ok, true);
  assert.ok(res.removed >= 3, `removed=${res.removed}`);
  assert.equal(run.state.points[0][0], EMPTY);
  assert.equal(run.state.points[1][0], EMPTY);
  assert.equal(run.state.points[2][0], EMPTY);
});

test('连击：连续消环 combo 递增，落空归零', () => {
  const run = emptyRun();
  run.state.points[0] = [0, 0, EMPTY];
  run.state.hand[0] = [EMPTY, EMPTY, 0];
  run.place(0, 0);
  assert.equal(run.state.combo, 1);
  run.state.points[3] = [1, 1, EMPTY];
  run.state.hand[1] = [EMPTY, EMPTY, 1];
  run.place(1, 3);
  assert.equal(run.state.combo, 2);
  // 落空：放置不触发消除
  run.state.points[6] = [EMPTY, EMPTY, EMPTY];
  run.state.hand[2] = [2, EMPTY, EMPTY];
  run.place(2, 6);
  assert.equal(run.state.combo, 0);
});

test('岩石：占槽不可放，随消行震碎', () => {
  const run = emptyRun();
  run.state.points[0] = [STONE, EMPTY, EMPTY];
  run.state.hand[0] = [0, EMPTY, EMPTY];
  assert.equal(run.place(0, 0).ok, false);
  // 震碎：point0 槽位0 是岩石，槽位1 有同色环；row0 三环点各含 1 色即消行
  run.state.points[0] = [STONE, 1, EMPTY];
  run.state.points[1] = [1, EMPTY, EMPTY];
  run.state.points[2] = [EMPTY, EMPTY, EMPTY];
  run.state.hand[0] = [EMPTY, EMPTY, 1];
  const res = run.place(0, 2);
  assert.equal(res.ok, true);
  assert.equal(run.state.points[0][0], EMPTY); // 岩石被震碎
  assert.ok(res.shattered >= 1);
});

test('爆发：充能后一键清点', () => {
  const run = emptyRun();
  run.state.burstReady = true;
  run.state.points[5] = [0, 1, STONE];
  const res = run.burst(5);
  assert.equal(res.ok, true);
  assert.deepEqual(run.state.points[5], [EMPTY, EMPTY, EMPTY]);
});

test('胜利：cleared 达到 target', () => {
  const run = emptyRun();
  run.state.cleared = run.state.target - 1;
  run.state.points[0] = [0, 0, EMPTY];
  run.state.hand[0] = [EMPTY, EMPTY, 0];
  run.place(0, 0);
  assert.equal(run.state.phase, 'won');
});

test('失败：棋盘堵死', () => {
  const run = emptyRun();
  // 用超出 colors 的图标值填满（不会触发任何消除），仅留一个空槽
  for (let p = 0; p < POINTS; p += 1) {
    run.state.points[p] = [p, p + 9, p + 18];
  }
  run.state.points[8] = [8, 17, EMPTY];
  run.state.hand[0] = [EMPTY, EMPTY, 0];
  run.place(0, 8); // 填满最后空槽 → 触发 checkLose
  assert.equal(run.state.phase, 'lost');
});

test('限时模式：时间递减并超时判负', () => {
  const run = createRun({ mode: 'time', levelIndex: 0, seed: 1 });
  const t0 = run.state.timeLeft;
  run.step(1 / 60);
  assert.ok(run.state.timeLeft < t0);
  run.state.timeLeft = 0.01;
  run.step(0.02);
  assert.equal(run.state.phase, 'lost');
});

test('computeRemovals/applyRemovals：纯函数消除计数正确', () => {
  const points = [
    [0, EMPTY, EMPTY], [0, EMPTY, EMPTY], [0, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY], [EMPTY, EMPTY, EMPTY], [EMPTY, EMPTY, EMPTY],
    [EMPTY, EMPTY, EMPTY], [EMPTY, EMPTY, EMPTY], [EMPTY, EMPTY, EMPTY],
  ];
  const removals = computeRemovals(points, 0, 3);
  const { removed } = applyRemovals(points, removals);
  assert.ok(removed >= 3, `removed=${removed}`);
});

test('确定性：同 seed 初始手牌一致', () => {
  const a = emptyRun(42);
  const b = emptyRun(42);
  assert.deepEqual(a.state.hand, b.state.hand);
  assert.deepEqual(a.state.points, b.state.points);
});

test('颜色随分数增长且封顶 8', () => {
  const run = emptyRun();
  assert.equal(run.state.colors, LEVELS[0].baseColors);
  run.state.score = 200;
  run.state.points[0] = [EMPTY, EMPTY, EMPTY];
  run.state.hand[0] = [1, EMPTY, EMPTY];
  run.place(0, 0); // 落空放置，仍会刷新 colors
  assert.equal(run.state.colors, 8);
});
