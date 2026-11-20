import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { speedAt, SPEED, BALLOON } from '../config/gameplay.js';

function clean(run) {
  // 手动拨距离时同步清理生成状态，避免「距离跳变后身后冒出障碍」误判
  run.nextSpawnZ = run.distance + 8;
  run.obstacles = [];
  run.pickups = [];
}

test('初始状态：playing / 中道 / 0 里程', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.lane, 1);
  assert.equal(r.distance, 0);
});

test('换道：dir=1 到右道，dir=-1 回左道', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.laneChangeCd = 0;
  r.step({ dir: 1 });
  assert.equal(r.lane, 2);
  r.laneChangeCd = 0;
  r.step({ dir: -1 });
  assert.equal(r.lane, 1);
});

test('换道有冷却：连续两次反向换道只生效第一次', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.step({ dir: 1 });
  assert.equal(r.lane, 2);
  r.step({ dir: -1 }); // cd 未走完
  assert.equal(r.lane, 2);
});

test('停步时里程不增长', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  const d0 = r.distance;
  for (let i = 0; i < 30; i += 1) r.step({ stop: true });
  assert.equal(r.distance, d0);
});

test('不操作时自动前进（无死时间基线）', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.step({});
  assert.ok(r.distance > 0);
});

test('速度随里程单调递增', () => {
  let prev = speedAt(0);
  for (let m = 1; m <= 100; m += 5) {
    const s = speedAt(m);
    assert.ok(s >= prev);
    prev = s;
  }
  assert.equal(speedAt(100000), SPEED.MAX);
});

test('里程里程碑事件', () => {
  const r = createRun({ seed: 1 });
  r.distance = 9.9;
  clean(r);
  r.step({});
  r.step({});
  const types = r.drainEvents().map((e) => e.type);
  assert.ok(types.includes('milestone'));
});

test('到达新站发 stationEnter 并推进 stationReached', () => {
  const r = createRun({ seed: 1 });
  r.distance = 119.9;
  r.stationReached = 2;
  clean(r);
  r.step({});
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'stationEnter' && e.station === 3));
  assert.equal(r.stationReached, 3);
});

test('捡宝石：gem 计数与事件', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.pickups.push({ kind: 'gem', lane: r.lane, z: 0.1, resolved: false, dead: false });
  r.step({});
  assert.equal(r.gems, 1);
  assert.ok(r.drainEvents().some((e) => e.type === 'gem'));
});

test('捡气球：叠加上限 2', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  for (let i = 0; i < 4; i += 1) {
    r.pickups.push({ kind: 'balloon', lane: r.lane, z: 0.1, resolved: false, dead: false });
    r.laneChangeCd = 0;
    r.step({});
  }
  assert.equal(r.balloons, BALLOON.MAX);
});

test('无气球碰撞：判负死亡', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.obstacles.push({ kind: 'car', lane: r.lane, z: 0.1, resolved: false, dead: false });
  r.step({});
  assert.equal(r.phase, 'dead');
  const types = r.drainEvents().map((e) => e.type);
  assert.ok(types.includes('hit'));
  assert.ok(types.includes('death'));
});

test('有气球碰撞：气球抵一次，不死亡', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.balloons = 1;
  r.obstacles.push({ kind: 'car', lane: r.lane, z: 0.1, resolved: false, dead: false });
  r.step({});
  assert.equal(r.phase, 'playing');
  assert.equal(r.balloons, 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'balloonSave'));
});

test('邻道擦肩：nearMiss 事件，不死亡', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  const adj = r.lane === 0 ? 1 : 0;
  r.obstacles.push({ kind: 'car', lane: adj, z: 0.1, resolved: false, dead: false });
  r.step({});
  assert.equal(r.phase, 'playing');
  assert.ok(r.drainEvents().some((e) => e.type === 'nearMiss'));
});

test('红灯闸机：停满 1s 转绿并 gateOpen', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.obstacles.push({ kind: 'gate', lane: null, z: 5, state: 'red', progress: 0, resolved: false, dead: false });
  for (let i = 0; i < 70; i += 1) r.step({ stop: true });
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'gateOpen'));
  assert.equal(r.obstacles[0].state, 'green');
});

test('红灯闸机不停：直接判负', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.obstacles.push({ kind: 'gate', lane: null, z: 0.1, state: 'red', progress: 0, resolved: false, dead: false });
  r.step({});
  assert.equal(r.phase, 'dead');
});

test('绿灯闸机直冲：gatePass，不死亡', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.obstacles.push({ kind: 'gate', lane: null, z: 0.1, state: 'green', progress: 0, resolved: false, dead: false });
  r.step({});
  assert.equal(r.phase, 'playing');
  assert.ok(r.drainEvents().some((e) => e.type === 'gatePass'));
});

test('丝滑换乘：0.5s 内连续换道 3 次触发', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.laneChangeCd = 0;
  r.step({ dir: 1 });   // 1→2
  r.laneChangeCd = 0;
  r.step({ dir: -1 });  // 2→1
  r.laneChangeCd = 0;
  r.step({ dir: 1 });   // 1→2，第三次
  assert.equal(r.smoothTransfers, 1);
  assert.ok(r.drainEvents().some((e) => e.type === 'smoothTransfer'));
});

test('复活一次：死后可复活并进入无敌', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.obstacles.push({ kind: 'car', lane: r.lane, z: 0.1, resolved: false, dead: false });
  r.step({});
  assert.equal(r.phase, 'dead');
  assert.ok(r.reviveAvailable());
  assert.ok(r.revive());
  assert.equal(r.phase, 'playing');
  assert.equal(r.revived, true);
  assert.ok(!r.reviveAvailable());
  assert.ok(r.invulnUntil > r.time);
});

test('复活后短暂无敌：碰撞不判负', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.obstacles.push({ kind: 'car', lane: r.lane, z: 0.1, resolved: false, dead: false });
  r.step({});
  r.revive();
  r.obstacles.push({ kind: 'car', lane: r.lane, z: 0.1, resolved: false, dead: false });
  r.step({});
  assert.equal(r.phase, 'playing');
});

test('drainEvents 清空队列', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  r.pickups.push({ kind: 'gem', lane: r.lane, z: 0.1, resolved: false, dead: false });
  r.step({});
  assert.ok(r.drainEvents().length > 0);
  assert.equal(r.drainEvents().length, 0);
});

test('getHud 返回里程/宝石/气球/站', () => {
  const r = createRun({ seed: 1 });
  clean(r);
  const h = r.getHud();
  assert.ok('distance' in h && 'gems' in h && 'balloons' in h && 'station' in h);
});
