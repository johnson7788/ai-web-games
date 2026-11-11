import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveServerUrl } from '../config/net.config.js';
import { SnapshotBuffer } from '../src/online/net.js';
import { createOnlineView, interpolateSnapshot, toViewFighter } from '../src/online/view.js';
import { CLOUD_RING } from '../config/arenas.js';

const snapshot = (x = 0, tick = 1) => ({
  tick,
  phase: 'fight',
  round: 1,
  timeLeft: 60,
  arena: { id: 'cloud-ring', radius: 11.5, width: 23, depth: 23 },
  fighters: [{
    id: 'f0', charId: 'shiba', team: 0, x, y: 0, z: 0, facing: 0,
    state: 'idle', onGround: true, anim: {}, eliminated: false,
  }],
  items: [],
});

test('联机 URL 遵守本地、HTTPS 与 query 覆盖规则', () => {
  assert.equal(resolveServerUrl('', { protocol: 'http:' }), 'ws://127.0.0.1:8601/ws');
  assert.equal(resolveServerUrl('', { protocol: 'https:' }), 'wss://commonly-sydney-connection-jon.trycloudflare.com/ws');
  assert.equal(resolveServerUrl('?server=ws://127.0.0.1:8601/ws', { protocol: 'http:' }), 'ws://127.0.0.1:8601/ws');
  assert.equal(resolveServerUrl('?server=ws://127.0.0.1:8601/ws', { protocol: 'https:' }), 'wss://127.0.0.1:8601/ws');
});

test('快照缓冲按 100ms 延迟插值并保留默认视图字段', () => {
  const buffer = new SnapshotBuffer(100);
  buffer.push(snapshot(0, 1), 1000);
  buffer.push(snapshot(2, 2), 1100);
  const frame = buffer.sample(1150);
  assert.equal(frame.alpha, 0.5);
  const result = interpolateSnapshot(frame.from, frame.to, frame.alpha, 'p0', 1.5);
  assert.equal(result.fighters[0].pos.x, 1);
  assert.equal(result.fighters[0].isPlayer, true);
  assert.equal(result.fighters[0].radius > 0, true);
  assert.equal(result.fighters[0].anim.breathe, 1.5);
  assert.equal(toViewFighter(snapshot().fighters[0], 'f1', 0).isPlayer, false);
});

test('本地预测立即响应移动，服务器大幅误差直接回正', () => {
  const view = createOnlineView('p0');
  view.reconcile(snapshot(0, 1));
  const buffer = new SnapshotBuffer(100);
  buffer.push(snapshot(0, 1), 1000);
  const moved = view.sample({ buffer, now: 1100, dt: 1 / 30, intent: { mx: 1, mz: 0 }, arena: CLOUD_RING, phase: 'fight', elapsed: 1 });
  assert.ok(moved.fighters[0].pos.x > 0);
  view.reconcile(snapshot(2, 2));
  const corrected = view.sample({ buffer, now: 1100, dt: 0, intent: {}, arena: CLOUD_RING, phase: 'fight', elapsed: 1 });
  assert.equal(corrected.fighters[0].pos.x, 2);
});

test('淘汰与击飞状态完全采用服务器插值，不叠加本地预测', () => {
  const falling = snapshot(0, 1);
  falling.fighters[0] = { ...falling.fighters[0], y: -10, state: 'eliminated', eliminated: true, onGround: false };
  const later = snapshot(0, 2);
  later.fighters[0] = { ...later.fighters[0], y: -12, state: 'eliminated', eliminated: true, onGround: false };
  const view = createOnlineView('p0');
  view.reconcile(later);
  const buffer = new SnapshotBuffer(100);
  buffer.push(falling, 1000);
  buffer.push(later, 1100);
  const result = view.sample({ buffer, now: 1150, dt: 1 / 60, intent: { mx: 1 }, arena: CLOUD_RING, phase: 'fight', elapsed: 1 });
  assert.equal(result.fighters[0].pos.y, -11);
});
