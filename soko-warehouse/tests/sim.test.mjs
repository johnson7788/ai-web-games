import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { solveLevel } from '../src/game/level.js';
import { LEVELS } from '../config/levels.js';

test('冒烟：createRun → 状态形状完整', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'playing');
  assert.ok(s.rows > 0 && s.cols > 0);
  assert.ok(Array.isArray(s.boxes));
  assert.ok(s.player && typeof s.player.r === 'number');
  assert.equal(typeof s.moveLimit, 'number');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('L1 解法回放 → 通关 3 星', () => {
  const r = createRun(0, { seed: 1 });
  const sol = solveLevel(LEVELS[0]);
  assert.ok(sol, 'L1 应有解');
  for (const m of sol.moves) assert.equal(r.move(m).ok, true);
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.stars, 3);
  assert.equal(r.state.moves, 2);
});

test('走路：空地移动成功，moves 递增', () => {
  const r = createRun(0, { seed: 1 });
  const before = r.state.moves;
  const res = r.move('right');
  assert.equal(res.ok, true);
  assert.equal(r.state.moves, before + 1);
  assert.deepEqual(r.state.player, { r: 2, c: 3 });
});

test('撞墙：墙方向移动被拒', () => {
  const r = createRun(0, { seed: 1 });
  // L1 玩家 (2,2)：向上两步到边界墙 (0,2)
  assert.equal(r.move('up').ok, true);  // (1,2)
  assert.equal(r.move('up').ok, false); // (0,2) 是墙
});

test('推箱：把箱子推进目标格并触发 target 事件', () => {
  const r = createRun(0, { seed: 1 });
  r.move('right'); // 走到 (2,3)
  const res = r.move('right'); // 推箱到 (2,5)
  assert.equal(res.ok, true);
  assert.equal(r.state.boxes[0].c, 5);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'push'));
  assert.ok(ev.some((e) => e.type === 'target'));
  assert.equal(r.state.phase, 'won');
});

test('岩石：不可进入（move 撞岩石被拒）', () => {
  const r = createRun(1, { seed: 1 }); // L2 有岩石 (3,4)
  r.move('down');  // (3,2)
  r.move('right'); // (3,3)
  const res = r.move('right'); // (3,4) 是岩石
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'blocked');
});

test('步数超限：moves > moveLimit → lose', () => {
  const r = createRun(0, { seed: 1 });
  let guard = 0;
  while (r.state.phase === 'playing' && guard < 200) {
    r.move(guard % 2 === 0 ? 'down' : 'up');
    guard += 1;
  }
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.won, false);
});

test('回退：撤销一步恢复玩家位置，undoLeft 递减', () => {
  const r = createRun(0, { seed: 1 });
  const p0 = { ...r.state.player };
  r.move('right');
  const res = r.undo();
  assert.equal(res.ok, true);
  assert.deepEqual(r.state.player, p0);
  assert.equal(r.state.undoLeft, 2);
});

test('回退上限：用完后返回 noUndo', () => {
  const r = createRun(0, { seed: 1 });
  r.state.undoLeft = 0;
  assert.deepEqual(r.undo(), { ok: false, reason: 'noUndo' });
});

test('连击：连续推箱 combo 递增，走路归零', () => {
  const r = createRun(1, { seed: 1 }); // L2 有多箱
  const sol = solveLevel(LEVELS[1]);
  let sawCombo = false;
  for (const m of sol.moves) {
    const before = r.state.combo;
    const res = r.move(m);
    if (res.ok) {
      const evs = r.drainEvents();
      if (evs.some((e) => e.type === 'combo')) sawCombo = true;
      if (before > 0 && !evs.some((e) => e.type === 'push')) assert.equal(r.state.combo, 0);
    }
  }
  assert.ok(sawCombo, 'L2 解法应包含连击');
  assert.ok(r.state.maxCombo >= 2);
});

test('mulberry32：可复现、范围 [0,1)', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 100; i += 1) {
    const x = a();
    assert.equal(x, b());
    assert.ok(x >= 0 && x < 1);
  }
});

test('getHud：返回 HUD 所需字段', () => {
  const r = createRun(0, { seed: 1 });
  const h = r.getHud();
  assert.equal(h.level, 1);
  assert.equal(h.moveLimit, 12);
  assert.equal(typeof h.boxesOnTarget, 'number');
  assert.equal(typeof h.undoLeft, 'number');
});

test('restart：重置到本关初始状态', () => {
  const r = createRun(0, { seed: 1 });
  r.move('right');
  r.restart();
  assert.equal(r.state.moves, 0);
  assert.equal(r.state.phase, 'playing');
  assert.deepEqual(r.state.player, { r: 2, c: 2 });
});
