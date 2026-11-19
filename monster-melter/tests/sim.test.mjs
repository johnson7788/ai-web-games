import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  CELLS, LINES, SHAPES, axialToWorld, createRun,
} from '../src/game/sim.js';

test('棋盘有 61 个格子', () => {
  assert.equal(CELLS.length, 61);
});

test('27 条消除线，每个格子恰好属于 3 条线', () => {
  assert.equal(LINES.length, 27);
  const cov = new Array(CELLS.length).fill(0);
  for (const line of LINES) {
    assert.ok(line.length >= 5 && line.length <= 9, `线长 ${line.length}`);
    for (const i of line) cov[i] += 1;
  }
  assert.ok(cov.every((c) => c === 3));
});

test('25 种形状，且每个形状格子不重复（单格除外）', () => {
  assert.equal(SHAPES.length, 25);
  for (let s = 0; s < SHAPES.length; s += 1) {
    const pts = SHAPES[s].map(([q, r]) => `${axialToWorld(q, r).x.toFixed(1)},${axialToWorld(q, r).y.toFixed(1)}`);
    assert.equal(new Set(pts).size, pts.length, `shape ${s} 有重复格`);
    assert.equal(SHAPES[s].length, s === 0 ? 1 : 4, `shape ${s} 格子数`);
  }
});

test('第 1 关无岩石，第 3 关有岩石', () => {
  const r1 = createRun(0, { seed: 1 });
  assert.equal(r1.state.board.filter((c) => c.kind === 'rock').length, 0);
  const r3 = createRun(2, { seed: 1 });
  assert.ok(r3.state.board.filter((c) => c.kind === 'rock').length >= 1);
});

test('单格宝石可放置，分数与步数增加', () => {
  const run = createRun(0, { seed: 1 });
  const anchor = run.state.board.findIndex((c) => c.kind === 'empty');
  run.state.trays[0] = { shape: 0, color: 2 };
  const res = run.place(0, anchor);
  assert.equal(res.ok, true);
  assert.equal(run.state.moves, 1);
  assert.equal(run.state.score, 2); // 1 + 1
  assert.equal(run.state.board[anchor].kind, 'gem');
  assert.equal(run.state.board[anchor].color, 2);
});

test('已被占用的格子不能放置', () => {
  const run = createRun(0, { seed: 1 });
  const anchor = run.state.board.findIndex((c) => c.kind === 'empty');
  run.state.board[anchor].kind = 'gem';
  run.state.trays[0] = { shape: 0, color: 1 };
  assert.equal(run.canPlace(0, anchor), false);
  assert.equal(run.place(0, anchor).ok, false);
});

test('空棋盘上每个托盘都能找到放置位置', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < 3; i += 1) {
    assert.equal(typeof run.findPlacement(i), 'number');
  }
});

test('填满整条线会消除并造成伤害', () => {
  const run = createRun(0, { seed: 1 });
  const line = LINES[0];
  for (const i of line) { run.state.board[i].kind = 'gem'; run.state.board[i].color = 2; }
  const hp0 = run.state.monsterHp;
  const empty = run.state.board.findIndex((c) => c.kind === 'empty');
  run.state.trays[0] = { shape: 0, color: 1 };
  run.place(0, empty);
  const damage = hp0 - run.state.monsterHp;
  assert.ok(damage > 0, '怪物应该掉血');
  // 该线应被清空
  for (const i of line) assert.equal(run.state.board[i].kind, 'empty');
});

test('连击：连续两次成线会叠加 combo', () => {
  const run = createRun(0, { seed: 1 });
  const fillAndClear = (line) => {
    for (const i of line) { run.state.board[i].kind = 'gem'; run.state.board[i].color = 1; }
    const empty = run.state.board.findIndex((c) => c.kind === 'empty');
    run.state.trays[0] = { shape: 0, color: 1 };
    run.place(0, empty);
  };
  fillAndClear(LINES[0]);
  assert.equal(run.state.combo, 1);
  fillAndClear(LINES[1]);
  assert.equal(run.state.combo, 2);
});

test('怪兽血量归零即胜利并结算星级', () => {
  const run = createRun(0, { seed: 1 });
  run.state.monsterHp = 4;
  const line = LINES[0];
  for (const i of line) { run.state.board[i].kind = 'gem'; run.state.board[i].color = 2; }
  const empty = run.state.board.findIndex((c) => c.kind === 'empty');
  run.state.trays[0] = { shape: 0, color: 1 };
  run.place(0, empty);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
});

test('棋盘塞满且无放置位置时判负', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < CELLS.length; i += 1) { run.state.board[i].kind = 'gem'; run.state.board[i].color = 1; }
  run.state.trays = [{ shape: 1, color: 1 }, { shape: 1, color: 1 }, { shape: 1, color: 1 }];
  assert.equal(run.findPlacement(0), null);
  run.checkLose();
  assert.equal(run.state.phase, 'lost');
});

test('炸弹会清空周边格子并消耗炸弹', () => {
  const run = createRun(0, { seed: 1 });
  run.state.bombs = 2;
  const res = run.useBomb(30); // 中心格
  assert.equal(res.ok, true);
  assert.equal(run.state.bombs, 1);
  assert.ok(res.targets >= 1);
});

test('关卡越高怪物血量越高', () => {
  const r1 = createRun(0, { seed: 1 });
  const r2 = createRun(1, { seed: 1 });
  assert.ok(r2.state.monsterMaxHp > r1.state.monsterMaxHp);
});
