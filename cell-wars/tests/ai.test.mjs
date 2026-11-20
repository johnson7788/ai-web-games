import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OWNER } from '../config/gameplay.js';
import { createBoard, setCell } from '../src/game/board.js';
import { bestInfect, bestPhage, bestNutrient, aiFlags, evaluateInfect, cloneBoard } from '../src/game/ai.js';
import { mulberry32 } from '../src/game/rng.js';

test('evaluateInfect 返回占领格数', () => {
  const b = createBoard(5);
  setCell(b, 1, 1, OWNER.PLAYER, 1);
  const r = evaluateInfect(b, 5, 1, 2, OWNER.PLAYER, 0);
  assert.equal(r.gain, 1);
  assert.equal(r.power, 1);
});

test('bestInfect 挑占领最多的前沿', () => {
  const b = createBoard(5);
  setCell(b, 1, 1, OWNER.PLAYER, 1);
  setCell(b, 1, 2, OWNER.PLAYER, 1);
  setCell(b, 2, 1, OWNER.PLAYER, 1);
  // (2,2) 有 2 个己方邻 → power2 更优
  const best = bestInfect(b, 5, OWNER.PLAYER, null, {});
  assert.ok(best);
  assert.ok(best.gain >= 1);
});

test('bestPhage 找敌方最多的 2×2', () => {
  const b = createBoard(6);
  for (let r = 2; r < 4; r += 1) for (let c = 2; c < 4; c += 1) setCell(b, r, c, OWNER.ENEMY, 1);
  const ph = bestPhage(b, 6, OWNER.ENEMY, 2);
  assert.equal(ph.count, 4);
  assert.equal(ph.r, 2);
  assert.equal(ph.c, 2);
});

test('bestNutrient 覆盖最多前沿格', () => {
  const b = createBoard(5);
  setCell(b, 0, 0, OWNER.PLAYER, 1);
  const n = bestNutrient(b, 5, OWNER.PLAYER);
  assert.ok(n);
  assert.ok(n.cover >= 2);
});

test('aiFlags 按强度解锁能力', () => {
  assert.deepEqual(aiFlags(0.2), { lookahead: false, nutrient: false, phage: false });
  assert.equal(aiFlags(0.5).lookahead, true);
  assert.equal(aiFlags(0.6).nutrient, true);
  assert.equal(aiFlags(0.7).phage, true);
});

test('cloneBoard 深拷贝不共享', () => {
  const b = createBoard(3);
  setCell(b, 0, 0, OWNER.PLAYER, 1);
  const c = cloneBoard(b);
  c[0][0].o = OWNER.ENEMY;
  assert.equal(b[0][0].o, OWNER.PLAYER);
});
