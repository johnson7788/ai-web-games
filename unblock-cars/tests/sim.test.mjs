// UNBLOCK CARS · sim 单元测试（node --test）
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, solveCars, isSolved } from '../src/game/sim.js';
import { getLevel, LEVEL_COUNT, COLS, ROWS } from '../src/game/levels.js';

test('createRun 返回 6×6 且含主车', () => {
  const run = createRun(0);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.rows, ROWS);
  assert.equal(run.state.cols, COLS);
  const hero = run.state.cars.find((c) => c.hero);
  assert.ok(hero);
  assert.equal(hero.o, 'H');
  assert.equal(hero.len, 2);
});

test('所有关卡可解且 par 与求解器一致', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const level = getLevel(i);
    const sol = solveCars(level.cars, level.rocks);
    assert.ok(sol, `level ${i + 1} 应可解`);
    assert.equal(sol.length, level.par, `level ${i + 1} par 应等于最短步数`);
  }
});

test('getLevel 确定性：同关两次一致', () => {
  const a = getLevel(5);
  const b = getLevel(5);
  assert.equal(a.par, b.par);
  assert.deepEqual(a.cars, b.cars);
  assert.deepEqual(a.rocks, b.rocks);
});

test('第 3 关起有岩石', () => {
  assert.ok(getLevel(2).hasRocks);
  assert.ok(getLevel(2).rocks.length > 0);
  assert.equal(getLevel(0).hasRocks, false);
});

test('moveCar 按求解首步移动并增加步数', () => {
  const run = createRun(0);
  const sol = run.solve();
  assert.ok(sol && sol.length);
  const m = sol[0];
  const car = run.state.cars.find((c) => c.id === m.carId);
  const before = car.o === 'H' ? car.col : car.row;
  const res = run.moveCar(m.carId, m.to);
  assert.ok(res.ok);
  assert.equal(run.state.moves, 1);
  assert.equal(car.o === 'H' ? car.col : car.row, m.to);
  assert.notEqual(before, m.to);
});

test('moveCar 原位不移动被拒绝', () => {
  const run = createRun(0);
  const hero = run.state.cars.find((c) => c.hero);
  const res = run.moveCar(hero.id, hero.col);
  assert.equal(res.ok, false);
  assert.equal(run.state.moves, 0);
});

test('moveCar 会被障碍夹到可达范围', () => {
  const run = createRun(0);
  const hero = run.state.cars.find((c) => c.hero);
  const far = hero.col + 100; // 远超右缘
  const res = run.moveCar(hero.id, far);
  // 要么被夹到可达位置（成功），要么原位（拒绝）；绝不越界
  if (res.ok) assert.ok(hero.col + hero.len <= COLS);
});

test('连击递增且计分', () => {
  const run = createRun(0);
  const hero = run.state.cars.find((c) => c.hero);
  const sol = solveCars(run.state.cars, run.state.rocks);
  assert.ok(sol && sol.length >= 3);
  let score0 = run.state.score;
  let comboSeen = false;
  for (const m of sol) {
    run.moveCar(m.carId, m.to);
    if (run.state.combo >= 2) comboSeen = true;
  }
  assert.ok(comboSeen, '连击应至少触发一次');
  assert.ok(run.state.score > score0);
});

test('undo 回退步数与位置', () => {
  const run = createRun(0);
  const hero = run.state.cars.find((c) => c.hero);
  const col0 = hero.col;
  run.moveCar(hero.id, col0 + 1);
  const moves1 = run.state.moves;
  const res = run.undo();
  assert.ok(res.ok);
  assert.equal(hero.col, col0);
  assert.equal(run.state.moves, moves1 - 1);
});

test('hint 消耗次数并给出提示', () => {
  const run = createRun(0);
  const h0 = run.state.hintsLeft;
  const res = run.hint();
  assert.ok(res.ok);
  assert.equal(run.state.hintsLeft, h0 - 1);
  assert.ok(run.state.hint && typeof run.state.hint.carId === 'number');
});

test('按最优解通关得 3 星并结算', () => {
  const run = createRun(0);
  const sol = solveCars(run.state.cars, run.state.rocks);
  for (const m of sol) run.moveCar(m.carId, m.to);
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.stars, 3);
  assert.equal(run.state.result.won, true);
  assert.ok(isSolved(run.state.cars));
});

test('步数达到上限判负 stalled', () => {
  const run = createRun(0);
  let guard = 0;
  while (run.state.phase === 'playing' && guard < 5000) {
    guard += 1;
    let moved = false;
    for (const car of run.state.cars) {
      if (car.hero) continue; // 不动主车，避免误通关
      for (const dir of ['left', 'right', 'up', 'down']) {
        if (run.nudge(car.id, dir).ok) { moved = true; break; }
      }
      if (moved) break;
    }
    if (!moved) break;
  }
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.result.won, false);
});

test('事件表包含 move 事件且 drain 后清空', () => {
  const run = createRun(0);
  run.drainEvents(); // 清掉 levelStart
  const hero = run.state.cars.find((c) => c.hero);
  run.moveCar(hero.id, hero.col + 1);
  const ev = run.drainEvents();
  assert.ok(ev.some((e) => e.type === 'move'));
  assert.equal(run.drainEvents().length, 0);
});

test('nudge 单步滑动在范围内', () => {
  const run = createRun(0);
  const car = run.state.cars.find((c) => !c.hero && c.o === 'H');
  if (car) {
    const c0 = car.col;
    const res = run.nudge(car.id, 'right');
    if (res.ok) assert.equal(car.col, c0 + 1);
  }
});

test('关卡数量与上限', () => {
  assert.ok(LEVEL_COUNT >= 12);
  const last = getLevel(LEVEL_COUNT - 1);
  assert.equal(last.index, LEVEL_COUNT);
  assert.ok(last.par > 0);
  assert.ok(last.maxMoves > last.par);
});
