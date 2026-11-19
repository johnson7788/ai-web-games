import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { createRun } from '../src/game/sim.js';

test('关卡表：6 关、index 连续、名称双语', () => {
  assert.equal(LEVEL_COUNT, 6);
  assert.equal(LEVELS.length, 6);
  LEVELS.forEach((lv, i) => {
    assert.equal(lv.index, i + 1);
    assert.ok(lv.name.en && lv.name.zh, `L${lv.index} 缺双语名`);
    assert.ok(lv.ammo > 0);
    assert.ok(lv.timeLimit > 0);
  });
});

test('关卡表：星级阈值单调合法', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.tripleStar <= lv.doubleStar, `L${lv.index} triple>double`);
    assert.ok(lv.doubleStar <= lv.singleStar, `L${lv.index} double>single`);
    assert.ok(lv.singleStar < lv.ammo, `L${lv.index} single>=ammo`);
  }
});

test('关卡表：每关都有敌人，核心在身体范围内', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.enemies.length >= 1, `L${lv.index} 无敌人`);
    for (const e of lv.enemies) {
      assert.ok(Math.abs(e.core.dx) <= e.w / 2, `L${lv.index} core.dx 越界`);
      assert.ok(Math.abs(e.core.dy) <= e.h / 2, `L${lv.index} core.dy 越界`);
      assert.ok(e.core.r > 0);
      assert.ok(e.hp >= 1);
    }
  }
});

test('关卡表：障碍/人质在竞技场内', () => {
  for (const lv of LEVELS) {
    for (const b of lv.barriers) {
      assert.ok(['crate', 'tnt', 'glass'].includes(b.type), `L${lv.index} 未知障碍`);
      assert.ok(b.cx > 200 && b.cx < 1280 && b.w > 0 && b.h > 0, `L${lv.index} 障碍越界`);
    }
    if (lv.captive) {
      assert.ok(lv.captive.cx > 200 && lv.captive.cx < 1280, `L${lv.index} 人质越界`);
    }
  }
});

test('关卡表：newElement 每关唯一非空', () => {
  const elements = LEVELS.map((l) => l.newElement);
  assert.ok(elements.every((e) => typeof e === 'string' && e.trim()));
  assert.equal(new Set(elements).size, elements.length);
});

// 贪心求解器（清障碍 → 打敌人核心），验证每一关都能通关
function greedyWins(levelIndex) {
  const run = createRun(levelIndex, { seed: 1 });
  let guard = 6000;
  while (guard-- > 0 && run.state.phase === 'playing') {
    if (run.state.boulders.length === 0) {
      const bar = run.state.barriers.find((b) => b.alive);
      let t = null;
      if (bar) t = { x: bar.cx, y: bar.cy };
      else {
        const e = run.state.enemies.find((x) => x.alive);
        if (e) t = { x: e.cx + e.core.dx, y: e.cy + e.core.dy };
      }
      if (t) {
        run.aim(t.x, t.y);
        run.throw();
      }
    }
    run.step(1 / 60);
  }
  return run.state.phase === 'won';
}

test('可解性：贪心能通关全部 6 关', () => {
  for (let i = 0; i < LEVEL_COUNT; i += 1) {
    assert.equal(greedyWins(i), true, `L${i + 1} 贪心未通关`);
  }
});

test('L1：单敌人、无障碍、无俘虏（教学关）', () => {
  const lv = LEVELS[0];
  assert.equal(lv.enemies.length, 1);
  assert.equal(lv.barriers.length, 0);
  assert.equal(lv.captive, null);
  assert.equal(lv.ammo, 5);
});

test('L6：包含 BOSS（hp=3）', () => {
  const lv = LEVELS[5];
  assert.ok(lv.enemies.some((e) => e.boss && e.hp === 3));
});
