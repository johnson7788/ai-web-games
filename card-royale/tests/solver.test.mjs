import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { findWin } from '../src/game/solver.js';
import { LEVELS } from '../config/levels.js';

// 可解性：每关 1000 种子，求解器成功率 ≥95%（实际设计目标 100%）。
test('可解性：12 关 × 1000 种子 ≥95%', { timeout: 60000 }, () => {
  const N = 1000;
  const minRate = 0.95;
  for (let lv = 0; lv < LEVELS.length; lv += 1) {
    let ok = 0;
    for (let s = 1; s <= N; s += 1) {
      const run = createRun(lv, { seed: s });
      if (findWin(run.snapshot())) ok += 1;
    }
    const rate = ok / N;
    assert.ok(rate >= minRate, `L${lv + 1} 可解率 ${(rate * 100).toFixed(1)}% < 95%`);
  }
});
