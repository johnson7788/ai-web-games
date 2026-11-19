import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, LEVELS, LEVEL_COUNT } from '../src/game/sim.js';
import { opposite, exitOf, tileFor, E, W, N, S } from '../src/game/track.js';

function simulate(run, maxSeconds) {
  const events = [];
  const cap = Math.ceil((maxSeconds || run.state.timeLimit + 5) * 60);
  let steps = 0;
  while (run.state.phase === 'playing' && steps < cap) {
    run.step(1 / 60);
    events.push(...run.drainEvents());
    steps += 1;
  }
  return events;
}

function solveAll(run) {
  for (const sw of run.state.switches) {
    const cell = run.state.grid[sw.r][sw.c];
    cell.stateIndex = cell.states.length - 1; // 拨到正确态
  }
}

test('方向几何：opposite 两两相对', () => {
  assert.equal(opposite(N), S);
  assert.equal(opposite(E), W);
  assert.equal(opposite(opposite(E)), E);
});

test('瓦片几何：直线/弯道连通正确', () => {
  const h = tileFor(W, E);
  assert.equal(h.kind, 'straight');
  assert.equal(exitOf(h, W), E);
  assert.equal(exitOf(h, E), W);
  const corner = tileFor(W, S);
  assert.equal(corner.kind, 'curve');
  assert.equal(exitOf(corner, W), S);
});

test('createRun 初始状态：playing、0 分、满时间', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.score, 0);
  assert.equal(run.state.timeLeft, LEVELS[0].timeLimit);
  assert.ok(run.state.trains.length >= 2);
});

test('toggleSwitch 翻转道岔并发出 switch 事件', () => {
  const run = createRun(0, { seed: 1 });
  const before = run.state.grid[run.state.switches[0].r][run.state.switches[0].c].stateIndex;
  const res = run.toggleSwitch(0);
  const after = run.state.grid[run.state.switches[0].r][run.state.switches[0].c].stateIndex;
  assert.equal(res.ok, true);
  assert.notEqual(after, before);
  const events = run.drainEvents();
  assert.equal(events[0].type, 'switch');
});

test('toggleSwitch 越界返回 ok:false', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.toggleSwitch(999).ok, false);
});

test('useFrost 消耗一次充能并进入减速', () => {
  const run = createRun(0, { seed: 1 });
  const charges = run.state.frost.charges;
  const res = run.useFrost();
  assert.equal(res.ok, true);
  assert.equal(run.state.frost.charges, charges - 1);
  assert.ok(run.state.frost.active > 0);
});

test('默认错路配置下 noinput 会脱轨并超时失败', () => {
  const run = createRun(0, { seed: 3 });
  const events = simulate(run, run.state.timeLimit + 5);
  assert.equal(run.state.phase, 'lost');
  assert.ok(events.some((e) => e.type === 'boom' || e.type === 'rockCrash'));
  assert.ok(events.some((e) => e.type === 'lose'));
});

test('拨到正确配置后第 1 关能过关（win）', () => {
  const run = createRun(0, { seed: 7 });
  solveAll(run);
  const events = simulate(run, LEVELS[0].timeLimit + 5);
  assert.equal(run.state.phase, 'won');
  assert.ok(events.some((e) => e.type === 'pickup'));
  assert.ok(events.some((e) => e.type === 'deliver'));
  assert.ok(events.some((e) => e.type === 'win'));
});

test('过关星级：无失误 3 星', () => {
  const run = createRun(0, { seed: 7 });
  solveAll(run);
  simulate(run, LEVELS[0].timeLimit + 5);
  assert.equal(run.state.stars, 3);
});

test('列车会沿轨道移动（cross 事件）', () => {
  const run = createRun(0, { seed: 7 });
  solveAll(run);
  const events = simulate(run, 3);
  assert.ok(events.some((e) => e.type === 'cross'));
});

test('mulberry32 是确定性 PRNG', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.equal(a(), b());
});

test('LEVEL_COUNT 至少 3 关', () => {
  assert.ok(LEVEL_COUNT >= 3);
});
