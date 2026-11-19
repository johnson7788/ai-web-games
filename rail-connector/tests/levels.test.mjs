import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, LEVELS, LEVEL_COUNT } from '../src/game/sim.js';

const isTrack = (cell) => cell && (cell.type === 'straight' || cell.type === 'curve' || cell.type === 'switch');

function solveAll(run) {
  for (const sw of run.state.switches) {
    const cell = run.state.grid[sw.r][sw.c];
    cell.stateIndex = cell.states.length - 1;
  }
}

function simulate(run, maxSeconds) {
  const cap = Math.ceil((maxSeconds || run.state.timeLimit + 5) * 60);
  let steps = 0;
  while (run.state.phase === 'playing' && steps < cap) {
    run.step(1 / 60);
    run.drainEvents();
    steps += 1;
  }
}

test('每关都有红蓝两条列车且落在轨道上', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const lv = LEVELS[i];
    const colors = new Set(lv.trains.map((t) => t.color));
    assert.deepEqual([...colors].sort(), ['blue', 'red'], `level ${i} 缺车`);
    for (const t of lv.trains) {
      assert.ok(isTrack(lv.grid[t.r][t.c]), `level ${i} 列车不在轨道上`);
    }
  }
});

test('每关的核心与终端都落在轨道上且颜色成对', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const lv = LEVELS[i];
    for (const c of [...lv.cargos, ...lv.terminals]) {
      assert.ok(isTrack(lv.grid[c.r][c.c]), `level ${i} 站点不在轨道上`);
    }
    assert.equal(lv.cargos.filter((c) => c.color === 'red').length, 1);
    assert.equal(lv.terminals.filter((c) => c.color === 'red').length, 1);
    assert.equal(lv.cargos.filter((c) => c.color === 'blue').length, 1);
    assert.equal(lv.terminals.filter((c) => c.color === 'blue').length, 1);
  }
});

test('每关拨到正确配置后都能过关（可解性）', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    const run = createRun(i, { seed: 11 });
    solveAll(run);
    simulate(run, LEVELS[i].timeLimit + 5);
    assert.equal(run.state.phase, 'won', `level ${i} 拨正确配置后未过关`);
  }
});

test('每关至少有一个道岔', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    assert.ok(LEVELS[i].switches.length >= 1, `level ${i} 没有道岔`);
  }
});
