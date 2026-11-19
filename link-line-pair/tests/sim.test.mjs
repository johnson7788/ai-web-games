import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { WORLD, PLAY } from '../config/game.config.js';

function solveRun(run) {
  const byKey = new Map(run.state.dots.map((d) => [d.key, d.id]));
  const order = run.state.nodes.map((n) => byKey.get(`${n.c},${n.r}`));
  for (const id of order) run.tapDot(id);
  return order;
}

test('LEVELS 非空且每关路径合法（无退化段、坐标在网格内）', () => {
  assert.ok(LEVEL_COUNT >= 3, '至少 3 关');
  for (const lv of LEVELS) {
    assert.ok(lv.nodes.length >= 3, '路径至少 3 个点');
    for (let i = 0; i < lv.nodes.length - 1; i += 1) {
      const a = lv.nodes[i];
      const b = lv.nodes[i + 1];
      assert.notDeepEqual(a, b, '相邻节点不能重复（无零长度段）');
      for (const p of [a, b]) {
        assert.ok(p[0] >= 0 && p[0] < WORLD.COLS && p[1] >= 0 && p[1] < WORLD.ROWS, '坐标在 11×9 网格内');
      }
    }
    for (const r of lv.rocks) {
      assert.ok(r[0] >= 0 && r[0] < WORLD.COLS && r[1] >= 0 && r[1] < WORLD.ROWS, '岩石坐标在网格内');
    }
  }
});

test('createRun：初始化星点/段数/状态正确', () => {
  const run = createRun(0);
  assert.equal(run.state.phase, 'playing');
  assert.ok(run.state.dots.length > 0, '有星点');
  assert.equal(run.state.segCount, run.state.nodes.length - 1, '段数 = 路径点数 - 1');
  assert.equal(run.state.lives, PLAY.MAX_LIVES);
  assert.equal(run.state.doneCount, 0);
});

test('点选→连相邻点：done 递增并发出 connect 事件', () => {
  const run = createRun(0);
  const s = run.state.segments[0];
  run.tapDot(s.a);            // 选中
  assert.equal(run.state.sel, s.a);
  const res = run.tapDot(s.b); // 连第一段
  assert.ok(res.connected, '连接成功');
  assert.equal(run.state.doneCount, 1);
  const events = run.drainEvents().map((e) => e.type);
  assert.ok(events.includes('select'), '有 select');
  assert.ok(events.includes('connect'), '有 connect');
});

test('按路径顺序连完：获胜并给星', () => {
  const run = createRun(0);
  solveRun(run);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('win'), '有 win');
});

test('完美通关（无失误、快速）= 3 星', () => {
  const run = createRun(0);
  solveRun(run);
  assert.equal(run.state.stars, 3, '0 失误且用时内 → 3 星');
});

function wrongDot(run, sel) {
  for (const d of run.state.dots) {
    if (d.id === sel) continue;
    const adjacent = run.state.segments.some((s) => (s.a === sel && s.b === d.id) || (s.a === d.id && s.b === sel));
    if (!adjacent) return d.id;
  }
  return null;
}

test('连错星点扣 1 命并打断连击', () => {
  const run = createRun(1); // L2 开放折线：存在不相邻星点
  const s = run.state.segments[0];
  run.tapDot(s.a);
  const wrong = wrongDot(run, s.a);
  assert.notEqual(wrong, null, '存在不相邻星点');
  const before = run.state.lives;
  const res = run.tapDot(wrong);
  assert.equal(res.ok, false);
  assert.equal(res.miss, true);
  assert.equal(run.state.lives, before - 1, '扣 1 命');
});

test('踩岩石扣命并触发 rock 事件', () => {
  const run = createRun(2); // L3 有岩石
  assert.ok(run.state.rocks.length > 0, 'L3 有岩石');
  const before = run.state.lives;
  run.tapRock(0);
  assert.equal(run.state.lives, before - 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'rock'));
});

test('失误 3 次 → 失败（lives 耗尽）', () => {
  const run = createRun(1);
  const s = run.state.segments[0];
  run.tapDot(s.a);
  const wrong = wrongDot(run, s.a);
  assert.notEqual(wrong, null, '存在不相邻星点');
  for (let i = 0; i < 3; i += 1) run.tapDot(wrong);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.loseReason, 'lives');
});

test('撤销撤回最后一笔并消耗次数', () => {
  const run = createRun(0);
  const s = run.state.segments[0];
  run.tapDot(s.a);
  run.tapDot(s.b);
  const done = run.state.doneCount;
  const undoLeft = run.state.undoLeft;
  const res = run.undo();
  assert.ok(res.ok);
  assert.equal(run.state.doneCount, done - 1);
  assert.equal(run.state.undoLeft, undoLeft - 1);
});

test('提示消耗次数并生成剩余路径', () => {
  const run = createRun(0);
  const before = run.state.hintLeft;
  const res = run.hint();
  assert.ok(res.ok);
  assert.equal(run.state.hintLeft, before - 1);
  assert.ok(Array.isArray(run.state.hintTrail) && run.state.hintTrail.length > 0);
});

test('倒计时归零 → 超时失败', () => {
  const run = createRun(0);
  run.step(run.state.timeLimit + 1);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.loseReason, 'timeOut');
});

test('连续快速连接触发连击', () => {
  const run = createRun(0);
  const n = run.state.nodes;
  const byKey = new Map(run.state.dots.map((d) => [d.key, d.id]));
  const order = n.map((x) => byKey.get(`${x.c},${x.r}`));
  run.tapDot(order[0]);
  run.tapDot(order[1]);
  assert.equal(run.state.combo, 1);
  run.tapDot(order[2]);
  assert.ok(run.state.combo >= 2, '第二次连续连接 combo ≥ 2');
});
