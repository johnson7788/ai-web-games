import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OWNER } from '../config/gameplay.js';
import {
  createBoard, setCell, applyHoles, countTerritory, countAdjacentOwned, isFrontier, listFrontier,
  resolveInfect, resolvePhage, applyAura, createAura, buildBoard, inBounds, neighbors,
} from '../src/game/board.js';
import { mulberry32 } from '../src/game/rng.js';

test('createBoard 生成 size×size 全中立', () => {
  const b = createBoard(7);
  assert.equal(b.length, 7);
  assert.equal(b[6].length, 7);
  assert.ok(b.every((row) => row.every((c) => c.o === OWNER.NEUTRAL && c.d === 0)));
});

test('neighbors 返回 4 邻、越界过滤', () => {
  assert.deepEqual(neighbors(3, 0, 0).sort(), [[0, 1], [1, 0]].sort());
  assert.equal(neighbors(5, 2, 2).length, 4);
  assert.equal(neighbors(5, 4, 4).length, 2);
});

test('applyHoles 把指定格标为空洞', () => {
  const b = createBoard(5);
  applyHoles(b, 5, [[0, 0], [2, 2]]);
  assert.equal(b[0][0].o, OWNER.VOID);
  assert.equal(b[2][2].o, OWNER.VOID);
  assert.equal(b[1][1].o, OWNER.NEUTRAL);
});

test('countTerritory 统计归属', () => {
  const b = createBoard(4);
  setCell(b, 0, 0, OWNER.PLAYER, 1);
  setCell(b, 0, 1, OWNER.PLAYER, 1);
  setCell(b, 3, 3, OWNER.ENEMY, 1);
  assert.equal(countTerritory(b, OWNER.PLAYER), 2);
  assert.equal(countTerritory(b, OWNER.ENEMY), 1);
  assert.equal(countTerritory(b, OWNER.NEUTRAL), 13);
});

test('isFrontier：敌格与己方相邻才可攻击', () => {
  const b = createBoard(4);
  setCell(b, 0, 0, OWNER.PLAYER, 1);
  setCell(b, 0, 1, OWNER.ENEMY, 1); // 相邻 → 前沿
  setCell(b, 3, 3, OWNER.ENEMY, 1); // 不相邻 → 非前沿
  assert.equal(isFrontier(b, 4, 0, 1, OWNER.PLAYER), true);
  assert.equal(isFrontier(b, 4, 3, 3, OWNER.PLAYER), false);
  assert.equal(isFrontier(b, 4, 0, 0, OWNER.PLAYER), false); // 己方格
});

test('resolveInfect：power≥cost 占领中立格并重置 def=1', () => {
  const b = createBoard(5);
  setCell(b, 1, 1, OWNER.PLAYER, 1);
  const res = resolveInfect(b, 5, 1, 2, OWNER.PLAYER, 0);
  assert.equal(res.blocked, false);
  assert.deepEqual(res.captured, [[1, 2]]);
  assert.equal(b[1][2].o, OWNER.PLAYER);
  assert.equal(b[1][2].d, 1);
});

test('resolveInfect：power<cost 失败并削弱敌格防御', () => {
  const b = createBoard(5);
  setCell(b, 1, 1, OWNER.PLAYER, 1);
  setCell(b, 1, 2, OWNER.ENEMY, 1); // cost=2, power=1 → 失败
  const res = resolveInfect(b, 5, 1, 2, OWNER.PLAYER, 0);
  assert.equal(res.blocked, true);
  assert.equal(b[1][2].o, OWNER.ENEMY);
  assert.equal(b[1][2].d, 0); // 削弱到 0
});

test('resolveInfect：连锁蔓延按剩余预算吞并', () => {
  const b = createBoard(5);
  setCell(b, 0, 1, OWNER.PLAYER, 1);
  setCell(b, 1, 0, OWNER.PLAYER, 1);
  setCell(b, 2, 1, OWNER.PLAYER, 1);
  // target (1,1) 中立，power=3 → budget=2，连锁吞 (1,2) 再 (0,2)
  const res = resolveInfect(b, 5, 1, 1, OWNER.PLAYER, 0);
  assert.equal(res.blocked, false);
  assert.ok(res.captured.length >= 3);
  assert.deepEqual(res.captured[0], [1, 1]);
  assert.equal(b[1][1].o, OWNER.PLAYER);
  assert.equal(b[1][2].o, OWNER.PLAYER);
});

test('resolveInfect：营养光环加成计入 power', () => {
  const b = createBoard(5);
  setCell(b, 1, 1, OWNER.PLAYER, 1);
  setCell(b, 1, 2, OWNER.ENEMY, 1); // cost=2；power=1 本应失败，+2 aura 后成功
  const res = resolveInfect(b, 5, 1, 2, OWNER.PLAYER, 2);
  assert.equal(res.blocked, false);
  assert.equal(b[1][2].o, OWNER.PLAYER);
});

test('resolvePhage 清空 2×2 敌格为中立', () => {
  const b = createBoard(6);
  for (let r = 2; r < 4; r += 1) for (let c = 2; c < 4; c += 1) setCell(b, r, c, OWNER.ENEMY, 1);
  const cleared = resolvePhage(b, 6, 2, 2, OWNER.PLAYER, 2);
  assert.equal(cleared.length, 4);
  for (const [r, c] of cleared) assert.equal(b[r][c].o, OWNER.NEUTRAL);
});

test('applyAura 只加目标与 4 邻', () => {
  const aura = createAura(5);
  applyAura(aura, 5, 2, 2, 2);
  assert.equal(aura[2][2], 2);
  assert.equal(aura[1][2], 2);
  assert.equal(aura[3][2], 2);
  assert.equal(aura[2][1], 2);
  assert.equal(aura[2][3], 2);
  assert.equal(aura[0][0], 0);
});

test('buildBoard：左下蓝 4 格、右上红 4 格、堡垒数量正确', () => {
  const rng = mulberry32(42);
  const level = { size: 7, fortressCount: 3, fortressDef: 2, enemyStartDef: 1, holes: [], scatter: 0 };
  const b = buildBoard(level, rng);
  assert.equal(b[6][0].o, OWNER.PLAYER);
  assert.equal(b[5][1].o, OWNER.PLAYER);
  assert.equal(b[0][6].o, OWNER.ENEMY);
  assert.equal(b[1][5].o, OWNER.ENEMY);
  const fort = b.flat().filter((c) => c.o === OWNER.NEUTRAL && c.d > 0);
  assert.equal(fort.length, 3);
});

test('listFrontier 只列出可攻击格（敌格与中立格）', () => {
  const b = createBoard(4);
  setCell(b, 0, 0, OWNER.PLAYER, 1);
  setCell(b, 0, 1, OWNER.ENEMY, 1);
  const f = listFrontier(b, 4, OWNER.PLAYER);
  assert.equal(f.length, 2); // (0,1) 敌格 + (1,0) 中立格
  assert.deepEqual(f.map(([r, c]) => `${r},${c}`).sort(), ['0,1', '1,0']);
});

test('inBounds 边界判断', () => {
  assert.equal(inBounds(5, 0, 0), true);
  assert.equal(inBounds(5, 4, 4), true);
  assert.equal(inBounds(5, 5, 0), false);
  assert.equal(inBounds(5, 0, -1), false);
});
