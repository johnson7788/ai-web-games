import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel, lintLevel, T } from '../src/game/level.js';
import level01 from '../config/levels/level-01.js';

const DEF = {
  id: 't', name: { en: 'Test', zh: '测试' }, theme: 'wood', timeLimit: 60,
  terrain: ['........', '..o.....', '.P....F.', '########'],
  entities: [],
};

test('尺寸与坐标：行从上到下，ty=0 在最下面', () => {
  const lv = parseLevel(DEF);
  assert.equal(lv.w, 8);
  assert.equal(lv.h, 4);
  assert.deepEqual(lv.spawn, { x: 1.5, y: 1.5 });
  assert.equal(lv.goal.x, 6.5);
  assert.equal(lv.goal.y, 1.5);
});

test('实体字符从网格清空，金币变成实体', () => {
  const lv = parseLevel(DEF);
  assert.equal(lv.isSolid(2, 2), false);
  assert.equal(lv.pickups.length, 1);
  assert.deepEqual([lv.pickups[0].x, lv.pickups[0].y], [2.5, 2.5]);
});

test('地面是实体，校验失败要抛错', () => {
  const lv = parseLevel(DEF);
  assert.equal(lv.isSolid(0, 0), true);
  assert.equal(lv.isSolid(0, 3), false);
  assert.throws(() => parseLevel({ ...DEF, terrain: ['....', '####'] }), /出生点/);
  assert.throws(() => parseLevel({ ...DEF, terrain: ['.....', '####', '####'] }), /等宽/);
});

test('setTile 之后碰撞要跟着变（木箱打碎/问号变硬）', () => {
  const lv = parseLevel(DEF);
  assert.equal(lv.isSolid(0, 0), true);
  lv.setTile(0, 0, T.EMPTY);
  assert.equal(lv.isSolid(0, 0), false);
  lv.setTile(0, 0, T.HARD);
  assert.equal(lv.isSolid(0, 0), true);
});

test('真实关卡 1-1 能解析且通过 lint', () => {
  const lv = parseLevel(level01);
  assert.equal(lv.w, 100);
  assert.equal(lv.h, 16);
  assert.ok(lv.pickups.length >= 15);
  assert.equal(lv.checkpoints.length, 1);
  assert.deepEqual(lintLevel(lv), []);
});
