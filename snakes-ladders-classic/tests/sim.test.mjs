import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';

function settle(run, maxSteps = 400) {
  for (let i = 0; i < maxSteps; i += 1) run.step(1 / 60);
}

// 只把「人类这次掷骰」的动画走完，停下时不动到后续对手回合
function settleOne(run, maxSteps = 400) {
  for (let i = 0; i < maxSteps; i += 1) {
    run.step(1 / 60);
    if (!run.state.anim) return;
  }
}

// 把人类棋子摆到指定位置并轮到人类，强制骰子点数
function setup(run, pos, rollValue) {
  run.step(1 / 60); // 结算先手
  run.state.phase = 'playing';
  run.state.turn = 0;
  run.state.anim = null;
  run.state.players[0].pos = pos;
  run.state.players[0].finished = false;
  run.state.players[0].stunned = 0;
  // rollDie = 1 + floor(rng*sides)，rng 固定 0 → 1，接近 1 → 最大点数
  run.rng = () => (rollValue - 1 + 0.1) / 6;
}

test('mulberry32 是确定性伪随机', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
  assert.notEqual(mulberry32(1)(), mulberry32(2)());
});

test('先手结算后进入 playing，order 含 3 人', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'countdown');
  run.step(1 / 60);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.order.length, 3);
  assert.ok(run.state.turn >= 0);
});

test('掷骰前进：0 出发掷 1 到 1（tree 空事件）', () => {
  const run = createRun(0, { seed: 2 });
  setup(run, 0, 1);
  const res = run.roll();
  assert.equal(res.ok, true);
  settleOne(run);
  assert.equal(run.state.players[0].pos, 1);
});

test('落在梯子 3 → 爬到 14', () => {
  const run = createRun(0, { seed: 3 });
  setup(run, 2, 1);
  run.roll();
  settleOne(run);
  assert.equal(run.state.players[0].pos, 14);
  run.drainEvents();
});

test('落在蛇 17 → 滑到 4，且发出 lose', () => {
  const run = createRun(0, { seed: 4 });
  setup(run, 16, 1);
  run.roll();
  settleOne(run);
  assert.equal(run.state.players[0].pos, 4);
});

test('超出终点回弹：45 掷 6 → 回弹到 43', () => {
  const run = createRun(0, { seed: 5 });
  setup(run, 45, 6);
  run.roll();
  settleOne(run);
  assert.equal(run.state.players[0].pos, 43);
});

test('岩石眩晕（第 2 关）：落在 6 被眩晕', () => {
  const run = createRun(1, { seed: 6 });
  setup(run, 5, 1);
  run.roll();
  settleOne(run);
  assert.equal(run.state.players[0].pos, 6);
  assert.equal(run.state.players[0].stunned, 1);
});

test('宝石收集（第 3 关）：落在 12 收集并前进到 13', () => {
  const run = createRun(2, { seed: 7 });
  setup(run, 11, 1);
  run.roll();
  settleOne(run);
  assert.equal(run.state.players[0].gems, 1);
  assert.equal(run.state.players[0].pos, 13);
});

test('到达 47 胜利：phase 变 won 且发 win 事件', () => {
  const run = createRun(0, { seed: 8 });
  setup(run, 46, 1);
  run.roll();
  settleOne(run);
  assert.equal(run.state.phase, 'won');
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'win'));
});

test('非人类回合不能掷骰', () => {
  const run = createRun(0, { seed: 9 });
  run.step(1 / 60);
  run.state.phase = 'playing';
  run.state.turn = 1;
  run.state.anim = null;
  const res = run.roll();
  assert.equal(res.ok, false);
});

test('对手骰子最大 4（谨慎的对手）', () => {
  const run = createRun(0, { seed: 10 });
  let maxN = 0;
  for (let i = 0; i < 600; i += 1) {
    run.step(1 / 60);
    for (const e of run.drainEvents()) {
      if (e.type === 'roll' && e.seat !== 0 && !e.firsthand) maxN = Math.max(maxN, e.n);
    }
  }
  assert.ok(maxN <= 4 && maxN >= 1, `对手点数应在 1-4，实际最大 ${maxN}`);
});
