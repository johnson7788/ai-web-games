import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MAPS, isWall, raycast, circleCollides, hasLineOfSight } from '../src/game/map.js';

test('三套场景网格存在且互不相同', () => {
  assert.equal(MAPS.length, 3);
  assert.notDeepEqual(MAPS[0], MAPS[1]);
  assert.notDeepEqual(MAPS[1], MAPS[2]);
});

test('边界全是墙，中心出生点为空地', () => {
  const g = MAPS[0];
  assert.equal(isWall(g, 0, 0), true);
  assert.equal(isWall(g, 23, 23), true);
  assert.equal(isWall(g, 12.5, 12.5), false);
});

test('中心朝 +x 射线命中右侧短墙（距离约 5.5）', () => {
  const r = raycast(MAPS[0], 12.5, 12.5, 1, 0);
  assert.equal(r.hit, true);
  assert.ok(r.dist > 4 && r.dist < 7, `dist=${r.dist}`);
});

test('越界坐标视为墙', () => {
  assert.equal(isWall(MAPS[0], -1, 5), true);
  assert.equal(isWall(MAPS[0], 5, 99), true);
});

test('圆形碰撞：圆心在空地但贴墙时判为碰撞', () => {
  assert.equal(circleCollides(MAPS[0], 12.5, 12.5, 0.28), false);
  assert.equal(circleCollides(MAPS[0], 1.1, 5, 0.28), true); // 紧贴左边界墙
});

test('视线：无墙遮挡时通，穿墙时断', () => {
  assert.equal(hasLineOfSight(MAPS[0], 12.5, 12.5, 10, 12.5), true);
  // 从中心到边界外一格（穿边界墙）应被挡
  assert.equal(hasLineOfSight(MAPS[0], 12.5, 12.5, 12.5, 0), false);
});
