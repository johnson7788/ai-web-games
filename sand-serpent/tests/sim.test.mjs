import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, DIRS, dirName } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME, FOOD } from '../config/game.config.js';

function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

test('冒烟：createRun → step → input → moveOnce → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.step(1 / 60);
  const ok = r.input('up');
  assert.equal(ok.ok, true);
  r.moveOnce();
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  assert.equal(hud.phase, 'playing');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/rows/cols/grid 尺寸/蛇初始长 3', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.equal(s.rows, 12);
  assert.equal(s.cols, 20);
  assert.equal(s.grid.length, 12);
  assert.equal(s.grid[0].length, 20);
  assert.equal(s.snake.length, GAME.START_LENGTH);
  assert.equal(s.length, GAME.START_LENGTH);
});

test('蛇初始：头在 start，身体向反方向延伸', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  const st = LEVELS[0].start;
  assert.deepEqual([s.snake[0].r, s.snake[0].c], [st.r, st.c]);
  assert.equal(s.snake[1].r, st.r);
  assert.equal(s.snake[1].c, st.c - 1);
  assert.equal(dirName(s.dir), st.dir);
});

test('网格：L1 穿边无墙（边框 empty），L2 有墙（边框 wall）', () => {
  const r1 = createRun(0, { seed: 1 });
  assert.equal(r1.state.grid[0][0].kind, 'empty');
  assert.equal(r1.state.grid[11][19].kind, 'empty');
  const r2 = createRun(1, { seed: 1 });
  assert.equal(r2.state.grid[0][0].kind, 'wall');
  assert.equal(r2.state.grid[6][19].kind, 'wall');
});

test('input：合法转向 ok，反向/同向拒绝', () => {
  const r = createRun(0, { seed: 1 }); // dir right
  assert.equal(r.input('up').ok, true);
  assert.deepEqual(r.input('left'), { ok: false, reason: 'reverse' });
  assert.deepEqual(r.input('right'), { ok: false, reason: 'same' });
});

test('move：转向后头按新方向移动，事件含 turn/move', () => {
  const r = createRun(0, { seed: 1 });
  r.drainEvents();
  r.input('up');
  r.moveOnce();
  const s = r.state;
  assert.equal(s.snake[0].r, 5); // 原 (6,9) 向上
  assert.equal(s.snake[0].c, 9);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'turn'));
  assert.ok(ev.some((e) => e.type === 'move'));
});

test('eat beetle：+1 分 +1 节，事件含 eat/grow', () => {
  const r = createRun(0, { seed: 1 });
  r.drainEvents();
  r.state.food = [{ r: 6, c: 10, type: 'beetle' }];
  r.moveOnce();
  const s = r.state;
  assert.equal(s.score, 1);
  assert.equal(s.length, 4);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'eat' && e.kind === 'beetle'));
  assert.ok(ev.some((e) => e.type === 'grow'));
});

test('eat scorpion：+3 分 +3 节', () => {
  const r = createRun(3, { seed: 1 });
  r.drainEvents();
  r.state.food = [{ r: 6, c: 10, type: 'scorpion' }];
  r.moveOnce();
  assert.equal(r.state.score, 3);
  assert.equal(r.state.length, 6);
});

test('eat thorn：+5 分、净 +4 节、发 tailDrop', () => {
  const r = createRun(8, { seed: 1 }); // L9 thorn
  r.drainEvents();
  r.state.food = [{ r: 6, c: 10, type: 'thorn' }];
  r.moveOnce();
  assert.equal(r.state.score, 5);
  assert.equal(r.state.length, 7); // 3 + 4
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'tailDrop'));
});

test('win：长到目标长度 → won', () => {
  const r = createRun(0, { seed: 1 });
  r.state.goalLength = 4;
  r.state.food = [{ r: 6, c: 10, type: 'beetle' }];
  r.moveOnce();
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.ok(r.drainEvents().some((e) => e.type === 'win'));
});

test('撞墙判负：L2 头撞边框 → lose wall', () => {
  const r = createRun(1, { seed: 1 });
  r.state.snake = [{ r: 6, c: 18 }, { r: 6, c: 17 }, { r: 6, c: 16 }];
  r.dir = DIRS.right;
  r.moveOnce();
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'wall');
});

test('撞仙人掌判负：L3 → lose cactus', () => {
  const r = createRun(2, { seed: 1 });
  r.state.snake = [{ r: 3, c: 6 }, { r: 3, c: 5 }, { r: 3, c: 4 }];
  r.dir = DIRS.right;
  r.moveOnce(); // (3,7) 是仙人掌
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'cactus');
});

test('撞硬地判负：L7 → lose hard', () => {
  const r = createRun(6, { seed: 1 });
  r.state.snake = [{ r: 2, c: 1 }, { r: 2, c: 0 }, { r: 3, c: 0 }];
  r.dir = DIRS.right;
  r.moveOnce(); // (2,2) 是硬地
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'hard');
});

test('撞自身判负：转头咬到自己 → lose self', () => {
  const r = createRun(0, { seed: 1 });
  r.state.snake = [
    { r: 5, c: 5 }, { r: 5, c: 6 }, { r: 5, c: 7 },
    { r: 6, c: 7 }, { r: 6, c: 6 }, { r: 6, c: 5 },
  ];
  r.dir = DIRS.right;
  r.moveOnce(); // (5,6) 是身体
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'self');
});

test('穿边环绕：L1 越过右边界回到左侧', () => {
  const r = createRun(0, { seed: 1 });
  r.state.snake = [{ r: 6, c: 19 }, { r: 6, c: 18 }, { r: 6, c: 17 }];
  r.dir = DIRS.right;
  r.drainEvents();
  r.moveOnce();
  assert.equal(r.state.snake[0].c, 0);
  assert.equal(r.state.snake[0].r, 6);
  assert.ok(r.drainEvents().some((e) => e.type === 'wrap'));
});

test('食物刷新：初始 food 数量 = foodCount，L5 双食', () => {
  const r1 = createRun(0, { seed: 1 });
  assert.equal(r1.state.food.length, 1);
  const r5 = createRun(4, { seed: 1 });
  assert.equal(r5.state.food.length, 2);
});

test('加速带：踩到后 boostLeft>0 并发 boost', () => {
  const r = createRun(5, { seed: 1 }); // L6 boost
  r.state.snake = [{ r: 2, c: 2 }, { r: 2, c: 1 }, { r: 2, c: 0 }];
  r.dir = DIRS.right;
  r.drainEvents();
  r.moveOnce(); // (2,3) 是加速带
  assert.ok(r.state.boostLeft > 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'boost'));
});

test('蝎子横逃：每隔 3 步向远离蛇头方向横移并发事件', () => {
  const r = createRun(3, { seed: 1 }); // L4 scorpion
  r.state.food = [{ r: 5, c: 14, type: 'scorpion' }];
  r.state.snake = [{ r: 5, c: 3 }, { r: 5, c: 2 }, { r: 5, c: 1 }];
  r.dir = DIRS.right;
  r.drainEvents();
  r.moveOnce(); r.moveOnce(); r.moveOnce();
  assert.ok(r.state.food[0].c > 14, '蝎子应向右远离蛇头');
  assert.ok(r.drainEvents().some((e) => e.type === 'scorpionEscape'));
});

test('里程碑事件：长度越过 50%/75% 时发出', () => {
  const r = createRun(1, { seed: 1 }); // goal 8, start 3 → 未过 50%
  r.drainEvents();
  // 吃到长度 5（越过 50% 是 4）
  r.state.food = [{ r: 6, c: 10, type: 'beetle' }];
  r.moveOnce();
  r.state.food = [{ r: 6, c: 11, type: 'beetle' }];
  r.moveOnce();
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'milestone'));
});

test('随机可复现：同 seed 两次 createRun 食物位置一致', () => {
  const a = createRun(0, { seed: 7 });
  const b = createRun(0, { seed: 7 });
  assert.deepEqual(a.state.food, b.state.food);
  assert.equal(mulberry32(42)(), mulberry32(42)());
});

test('食物数值：beetle/scorpion/thorn 与 config 一致', () => {
  assert.deepEqual(FOOD.beetle, { value: 1, grow: 1, label: 'beetle' });
  assert.deepEqual(FOOD.scorpion, { value: 3, grow: 3, label: 'scorpion' });
  assert.deepEqual(FOOD.thorn, { value: 5, grow: 4, label: 'thorn' });
});
