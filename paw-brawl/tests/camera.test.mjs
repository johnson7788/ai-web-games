import test from 'node:test';
import assert from 'node:assert/strict';
import { autoFrame } from '../src/game/camera.js';
import { CONFIG } from '../config/game.config.js';
import { CLOUD_RING } from '../config/arenas.js';

const fighter = (x, z, state = 'idle') => ({
  pos: { x, y: 0, z }, radius: CONFIG.physics.fighterRadius, height: CONFIG.physics.fighterHeight, state,
});

const frame = (fighters, view = null) => autoFrame({
  fighters, arena: CLOUD_RING, time: 0, aspect: 16 / 9, view,
});

test('M6.6 跟随与观战距离覆盖放大后的地图', () => {
  assert.deepEqual([
    CONFIG.camera.followBaseDistance,
    CONFIG.camera.followMaxDistance,
    CONFIG.camera.nearbyRadius,
    CONFIG.camera.minDistance,
    CONFIG.camera.maxDistance,
  ], [15.6, 23, 9, 24, 40]);
});

test('单个角色的取景距离不大于八人，且位于 clamp 内', () => {
  const one = frame([fighter(0, 0)]);
  const eight = frame([
    fighter(-8, -8), fighter(-8, 8), fighter(8, -8), fighter(8, 8),
    fighter(-4, -8), fighter(-4, 8), fighter(4, -8), fighter(4, 8),
  ]);
  assert.ok(one.distance <= eight.distance);
  for (const result of [one, eight]) {
    assert.ok(result.distance >= CONFIG.camera.minDistance);
    assert.ok(result.distance <= CONFIG.camera.maxDistance);
  }
});

test('超宽分布也不会超过最大距离', () => {
  const result = frame([fighter(-100, 0), fighter(100, 0)]);
  assert.equal(result.distance, CONFIG.camera.maxDistance);
});

test('指数平滑返回新对象且不修改 view', () => {
  const previous = { target: { x: 0, y: 0, z: 0 }, distance: CONFIG.camera.minDistance, dt: 1 / 60 };
  const snapshot = structuredClone(previous);
  const result = frame([fighter(-8, -8), fighter(8, 8)], previous);
  assert.deepEqual(previous, snapshot);
  assert.notEqual(result, previous);
  assert.notEqual(result.target, previous.target);
  assert.ok(result.distance > previous.distance);
  assert.ok(result.distance < CONFIG.camera.maxDistance);
});

test('falling 与 eliminated 不拉远镜头，方位角按配置摆动', () => {
  const result = autoFrame({
    fighters: [fighter(0, 0), fighter(30, 30, 'falling'), fighter(50, 50, 'eliminated')],
    arena: CLOUD_RING,
    time: 3,
    aspect: 16 / 9,
  });
  assert.equal(result.distance, CONFIG.camera.minDistance);
  assert.equal(result.azimuth, CONFIG.camera.azimuthBase + Math.sin(3 * CONFIG.camera.azimuthSpeed) * CONFIG.camera.azimuthSwing);
  assert.equal(result.elevation, CONFIG.camera.elevation);
});

test('玩家存活时附近角色质心权重降为 0.18', () => {
  const player = { ...fighter(0, 0), isPlayer: true };
  const result = frame([player, fighter(4, 0)]);
  assert.equal(CONFIG.camera.playerWeight, 0.82);
  assert.equal(CONFIG.camera.nearbyWeight, 0.18);
  assert.ok(Math.abs(result.target.x - 0.72) < 1e-9);
});

test('玩家淘汰 focus 跟随负高度并应用 0.85 距离缩放', () => {
  const player = { ...fighter(0, 0, 'eliminated'), isPlayer: true };
  player.pos.y = -6;
  const result = autoFrame({
    fighters: [player, fighter(3, 0)], arena: CLOUD_RING, time: 0, aspect: 16 / 9,
    focus: player, distanceScale: 0.85,
  });
  assert.equal(result.target.y, player.pos.y + CONFIG.camera.followTargetHeight);
  assert.equal(result.distance, CONFIG.camera.followBaseDistance * 0.82 * 0.85);
});
