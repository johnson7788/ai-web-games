import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

test('createRun 初始状态：ready / 第 0 层 / 0 分', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.phase, 'ready');
  assert.equal(run.state.curIndex, 0);
  assert.equal(run.state.score, 0);
  assert.equal(run.state.floors[0].dir, 0);
  assert.equal(run.state.floors[0].x, 0);
});

test('第 1 层横杆方向为 -1 或 +1，nextDir 与之一致', () => {
  const run = createRun({ seed: 2 });
  run.ensureTo(2);
  assert.ok(run.state.floors[1].dir === -1 || run.state.floors[1].dir === 1);
  assert.equal(run.state.nextDir, run.state.floors[1].dir);
});

test('mulberry32 同 seed 产出相同楼层序列', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  a.ensureTo(10);
  b.ensureTo(10);
  for (let i = 1; i <= 10; i += 1) {
    assert.equal(a.state.floors[i].dir, b.state.floors[i].dir);
    assert.equal(a.state.floors[i].x, b.state.floors[i].x);
  }
});

test('首次攀爬把 ready 切到 playing 并正确上攀', () => {
  const run = createRun({ seed: 3 });
  const dir = run.state.nextDir;
  const res = run.climb(dir);
  assert.equal(res.ok, true);
  assert.equal(res.climbed, true);
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.curIndex, 1);
  assert.ok(run.state.score >= 1);
});

test('攀错方向（无护盾）→ 终结，reason 为 fall 或 deco', () => {
  const run = createRun({ seed: 4 });
  const wrong = run.state.nextDir === 1 ? -1 : 1;
  const res = run.climb(wrong);
  assert.equal(res.dead, true);
  assert.equal(run.state.phase, 'end');
  assert.ok(run.state.result.reason === 'fall' || run.state.result.reason === 'deco');
  assert.ok(['fall', 'deco'].includes(res.reason));
});

test('护盾挡下一次失误，之后无盾再错则终结', () => {
  const run = createRun({ seed: 5 });
  run.state.shields = 1;
  const wrong = run.state.nextDir === 1 ? -1 : 1;
  const first = run.climb(wrong);
  assert.equal(first.shielded, true);
  assert.equal(run.state.shields, 0);
  assert.equal(run.state.phase, 'playing');
  const second = run.climb(wrong);
  assert.equal(second.dead, true);
  assert.equal(run.state.phase, 'end');
});

test('连续快速攀爬产生连击与 combo 事件', () => {
  const run = createRun({ seed: 6 });
  run.ensureTo(3);
  run.state.floors[1].dir = 1;
  run.state.floors[2].dir = 1;
  run.state.floors[1].star = false;
  run.state.floors[2].star = false;
  run.state.floors[1].orb = false;
  run.state.floors[2].orb = false;
  run.climb(1);
  run.climb(1);
  const events = run.drainEvents();
  const comboEvents = events.filter((e) => e.type === 'combo');
  assert.equal(run.state.combo, 2);
  assert.ok(comboEvents.length >= 1);
  assert.equal(run.state.score, 1 + 2); // 第 1 层 +1，第 2 层 +2
});

test('收集星星：+分 +计数，攒满 3 星锻造 1 护盾', () => {
  const run = createRun({ seed: 7 });
  run.ensureTo(5);
  for (let i = 1; i <= 4; i += 1) {
    run.state.floors[i].dir = 1;
    run.state.floors[i].star = i <= 3;
  }
  run.climb(1);
  run.climb(1);
  run.climb(1);
  assert.equal(run.state.stars, 3);
  assert.equal(run.state.shields, 1);
  assert.equal(run.state.starMeter, 0);
  assert.ok(run.state.score >= 3 + GAME.STAR_SCORE * 3);
});

test('冰冻道具：冻结塌陷计时，冰解后恢复塌陷', () => {
  const run = createRun({ seed: 8 });
  run.ensureTo(2);
  run.state.floors[1].dir = 1;
  run.state.floors[1].orb = true;
  run.climb(1);
  assert.equal(run.state.freezeT, GAME.FREEZE_SEC);
  assert.equal(run.state.phase, 'playing');
  run.state.removeTimer = 0;
  run.step(0.5);
  assert.equal(run.state.removeTopIndex, 0); // 冰冻期间不塌
  assert.ok(run.state.freezeT < GAME.FREEZE_SEC);
});

test('底部塌陷追上玩家 → collapse 终结', () => {
  const run = createRun({ seed: 9 });
  run.state.phase = 'playing';
  run.state.removeTimer = 0;
  run.state.removeInterval = 0.001;
  run.step(1 / 60);
  assert.equal(run.state.phase, 'end');
  assert.equal(run.state.result.reason, 'collapse');
});

test('塌陷移除最底层发出 floorRemoved 事件，且间隔递减', () => {
  const run = createRun({ seed: 11 });
  run.ensureTo(2);
  run.state.floors[1].dir = 1;
  run.climb(1); // 爬到第 1 层，避免移除第 0 层时误伤
  run.drainEvents();
  run.state.removeInterval = 1.0;
  run.state.removeTimer = 0;
  run.step(1 / 60);
  assert.equal(run.state.removeTopIndex, 1);
  assert.equal(run.state.phase, 'playing');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'floorRemoved'));
  assert.ok(Math.abs(run.state.removeInterval - (1.0 - GAME.COLLAPSE_STEP_MS / 1000)) < 1e-9);
});
