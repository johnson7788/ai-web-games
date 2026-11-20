import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { generateBoard, validateSolution, solveBoard, tileIsFree } from '../src/game/board.js';

test('12 关结构：slotCap 7→6、品类 6→12、层数 3→5 三轴递进', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.ok(LEVELS.every((l) => l.slotCap === 7 || l.slotCap === 6));
  assert.ok(LEVELS[0].types === 6);
  assert.ok(LEVELS[LEVEL_COUNT - 1].types === 12);
  assert.ok(LEVELS.every((l) => l.layers >= 2 && l.layers <= 5));
});

test('生成器：总数 = totalTiles，且每类都是 3 的倍数', () => {
  for (const lv of LEVELS) {
    const b = generateBoard(lv, lv.index);
    let total = 0;
    const counts = new Map();
    for (const s of b.stacks) for (const t of s.tiles) {
      total += 1;
      counts.set(t.type, (counts.get(t.type) || 0) + 1);
    }
    assert.equal(total, lv.totalTiles, `L${lv.index} 总数`);
    for (const [, c] of counts) assert.equal(c % 3, 0, `L${lv.index} 每类 3 的倍数`);
  }
});

test('生成器：同 seed 可复现', () => {
  const a = generateBoard(LEVELS[0], 7);
  const b = generateBoard(LEVELS[0], 7);
  assert.deepEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
});

test('可解性：全部 12 关存在不依赖道具的解（线性校验）', () => {
  for (const lv of LEVELS) {
    const b = generateBoard(lv, lv.index);
    assert.ok(validateSolution(b.stacks, b.solution, lv.slotCap), `L${lv.index} 可解`);
  }
});

test('回溯求解器：多个代表性关卡可独立求到解', () => {
  for (const idx of [0, 1, 2, 3, 4, 5, 6, 10, 11]) {
    const lv = LEVELS[idx];
    const b = generateBoard(lv, lv.index);
    const r = solveBoard(b.stacks, lv.slotCap, 2000000);
    assert.equal(r.solvable, true, `L${lv.index} solver`);
    assert.equal(r.moves.length, lv.totalTiles, `L${lv.index} 解长度`);
  }
});

test('假锁层：锁定顶牌在锚点未清空前不可点，清空后可点', () => {
  const lv = LEVELS.find((l) => l.feature === 'lock');
  const b = generateBoard(lv, lv.index);
  const locked = b.stacks.find((s) => s.tiles.length && s.tiles[s.tiles.length - 1].lockAnchor != null);
  assert.ok(locked, '存在锁定顶牌');
  assert.equal(tileIsFree(b.stacks, locked.id), false);
  // 清空锚点堆
  b.stacks[locked.tiles[locked.tiles.length - 1].lockAnchor].tiles = [];
  assert.equal(tileIsFree(b.stacks, locked.id), true);
});

test('压顶大层：每堆顶部各有一张「顶盖」牌', () => {
  const lv = LEVELS.find((l) => l.feature === 'cap');
  const b = generateBoard(lv, lv.index);
  const topCount = b.stacks.filter((s) => s.tiles.length).length;
  assert.ok(topCount >= lv.cols * lv.rows * 0.8);
});

test('三章换景：晨光/午后/灯会 各 4 关', () => {
  const scenes = LEVELS.map((l) => l.scene);
  assert.deepEqual(scenes.slice(0, 4).every((s) => s === 'dawn-market'), true);
  assert.deepEqual(scenes.slice(4, 8).every((s) => s === 'afternoon-market'), true);
  assert.deepEqual(scenes.slice(8, 12).every((s) => s === 'night-market'), true);
});
