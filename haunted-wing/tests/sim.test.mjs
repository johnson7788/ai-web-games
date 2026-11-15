import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, getHud, nearAction, ratingFor } from '../src/game/sim.js';
import { PLAYER, ENTITY, GENERATOR } from '../config/game.config.js';

const step = (run, input, n = 1) => { for (let i = 0; i < n; i++) updateSim(run, input); return drainEvents(run); };
const keySpot = (run, color) => run.map.searchables.find((s) => s.key === color);
const doorOf = (run, id) => run.map.doors.find((d) => d.id === id);
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

test('出生：phase=playing，3 命，100 电量，0 钥匙', () => {
  const r = createSim({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.player.lives, 3);
  assert.equal(r.player.battery, 100);
  assert.equal(Object.values(r.keys).filter(Boolean).length, 0);
});

test('钥匙分配：红蓝金各恰好落在一个可搜索点（seed 确定）', () => {
  for (const seed of [1, 2, 3]) {
    const r = createSim({ seed });
    for (const c of ['red', 'blue', 'gold']) {
      const n = r.map.searchables.filter((s) => s.key === c).length;
      assert.equal(n, 1, `${c} 应恰好 1 个`);
    }
  }
});

test('seed 回归：同 seed 钥匙位置一致', () => {
  const a = createSim({ seed: 7 });
  const b = createSim({ seed: 7 });
  for (const c of ['red', 'blue', 'gold']) {
    assert.equal(keySpot(a, c).id, keySpot(b, c).id);
  }
});

test('移动：向前走 z 增加（yaw=PI 朝 +z）', () => {
  const r = createSim({ seed: 1 });
  const z0 = r.player.z;
  step(r, { forward: 1 }, 30);
  assert.ok(r.player.z > z0);
});

test('碰撞：不能穿墙（西墙）', () => {
  const r = createSim({ seed: 1 });
  r.player.x = 1.0; r.player.z = 7; r.player.yaw = Math.PI / 2; // 朝 -x
  step(r, { forward: 1 }, 120);
  assert.ok(r.player.x > 0.5, 'x 应被西墙挡住');
});

test('手电：开灯耗电，关灯不耗', () => {
  const r = createSim({ seed: 1 });
  r.entity.floor = 2; // 隔离实体，避免干扰
  step(r, { flashlight: true }); // 开灯
  assert.equal(r.player.flashlight, true);
  const b1 = r.player.battery;
  step(r, {}, 60);
  assert.ok(r.player.battery < b1, '开灯应耗电');
  const b2 = r.player.battery;
  step(r, { flashlight: true }); // 关灯
  assert.equal(r.player.flashlight, false);
  step(r, {}, 60);
  assert.equal(r.player.battery, b2, '关灯不应耗电');
});

test('手电：没电不能开', () => {
  const r = createSim({ seed: 1 });
  r.player.battery = 0;
  step(r, { flashlight: true });
  assert.equal(r.player.flashlight, false, '没电不能开');
});

test('手电：电量耗尽自动熄灭', () => {
  const r = createSim({ seed: 1 });
  r.entity.floor = 2;
  r.player.battery = 2;
  step(r, { flashlight: true });
  assert.equal(r.player.flashlight, true);
  step(r, {}, 130);
  assert.equal(r.player.flashlight, false, '耗尽应熄灭');
  assert.equal(r.player.battery, 0);
});

test('搜索抽屉：拿到钥匙', () => {
  const r = createSim({ seed: 1 });
  const s = keySpot(r, 'red');
  r.player.x = s.x; r.player.z = s.z; r.player.floor = s.floor;
  step(r, { interact: true });
  assert.equal(r.keys.red, true);
  assert.equal(r.stats.keys, 1);
});

test('门：有对应钥匙靠近才开，否则不开', () => {
  const r = createSim({ seed: 1 });
  const d = doorOf(r, 'red');
  const cx = d.cells.reduce((s, c) => s + c.x, 0) / d.cells.length;
  const cz = d.cells.reduce((s, c) => s + c.z, 0) / d.cells.length;
  r.player.x = (cx + 0.5) * 2; r.player.z = (cz + 0.5) * 2; r.player.floor = d.floor;
  step(r, {}, 10);
  assert.equal(d.open, false, '无钥匙不开');
  r.keys.red = true;
  step(r, {}, 10);
  assert.equal(d.open, true, '有钥匙自动开');
});

test('楼梯：踩上楼梯换层', () => {
  const r = createSim({ seed: 1 });
  r.keys.red = true; r.keys.blue = true;
  const st = r.map.stairs[1];
  r.player.x = (st.x + 0.5) * 2; r.player.z = (st.z + 0.5) * 2; r.player.floor = 1;
  const f0 = r.player.floor;
  step(r, {}, 5);
  assert.equal(r.player.floor, 2, '应到二层');
  assert.notEqual(f0, r.player.floor);
});

test('出口：无金钥匙不结算，有金钥匙胜利', () => {
  const r = createSim({ seed: 1 });
  const ex = r.map.exit;
  r.player.floor = ex.floor; r.player.x = ex.x; r.player.z = ex.z;
  r.keys.gold = false;
  step(r, {}, 5);
  assert.equal(r.phase, 'playing');
  r.keys.gold = true;
  step(r, {}, 5);
  assert.equal(r.phase, 'won');
});

test('评级：时间越短/命越多评级越高', () => {
  assert.equal(ratingFor(50, 3), 'S');
  assert.equal(ratingFor(100, 2), 'A');
  assert.equal(ratingFor(140, 1), 'B');
  assert.equal(ratingFor(999, 0), 'C');
});

test('被抓：实体贴身追击扣命', () => {
  const r = createSim({ seed: 1 });
  r.entity.x = r.player.x; r.entity.z = r.player.z; r.entity.floor = r.player.floor;
  r.entity.state = 'chase';
  const lives0 = r.player.lives;
  step(r, {}, 60);
  assert.ok(r.player.lives < lives0, '应被扣命');
  assert.ok(r.stats.deaths >= 1);
});

test('3 命尽：phase=dead', () => {
  const r = createSim({ seed: 1 });
  r.player.lives = 1;
  r.entity.x = r.player.x; r.entity.z = r.player.z; r.entity.floor = r.player.floor;
  r.entity.state = 'chase';
  step(r, {}, 120);
  assert.equal(r.phase, 'dead');
});

test('躲柜：E 进柜 hidden=true，巡逻实体不查', () => {
  const r = createSim({ seed: 1 });
  const c = r.map.cabinets[0];
  r.player.x = c.x; r.player.z = c.z; r.player.floor = c.floor;
  step(r, { interact: true });
  assert.equal(r.player.hidden, true);
  // 巡逻实体贴身也不抓
  r.entity.x = r.player.x; r.entity.z = r.player.z; r.entity.state = 'patrol';
  const lives0 = r.player.lives;
  step(r, {}, 60);
  assert.equal(r.player.lives, lives0, '巡逻实体不该查柜');
  step(r, { interact: true });
  assert.equal(r.player.hidden, false);
});

test('发电机：正确顺序修复，错误顺序重置', () => {
  const r = createSim({ seed: 1 });
  const g = r.map.generator[1];
  r.player.x = g.x; r.player.z = g.z; r.player.floor = 1;
  r.generator.seq = [1, 0, 2]; // 拉杆顺序：2号 → 1号 → 3号
  step(r, { lever: 2 });
  assert.equal(r.generator.progress, 1);
  step(r, { lever: 3 }); // 错
  assert.equal(r.generator.progress, 0);
  step(r, { lever: 2 });
  step(r, { lever: 1 });
  step(r, { lever: 3 });
  assert.equal(r.generator.fixed, true);
  assert.ok(r.generator.lightsT > 0);
});

test('签名：~9s 触发 flicker + silhouette', () => {
  const r = createSim({ seed: 1 });
  let flicker = false, silhouette = false;
  for (let i = 0; i < 60 * 12; i++) {
    for (const ev of drainEvents(updateSimAndDrain(r))) {
      if (ev.type === 'flicker') flicker = true;
      if (ev.type === 'silhouette') silhouette = true;
    }
  }
  assert.equal(flicker, true);
  assert.equal(silhouette, true);
  assert.equal(r.signatureDone, true);
});

test('drainEvents：清空队列', () => {
  const r = createSim({ seed: 1 });
  assert.ok(drainEvents(r).length >= 1); // start 事件
  assert.equal(r.events.length, 0);
});

test('getHud：反映状态', () => {
  const r = createSim({ seed: 1 });
  r.keys.red = true;
  const h = getHud(r);
  assert.equal(h.keys.red, true);
  assert.equal(h.lives, 3);
  assert.ok(h.floor === 1);
});

test('noinput 基线：不输入仍在推进，实体巡逻产生事件', () => {
  const r = createSim({ seed: 55 });
  const types = new Set();
  for (let i = 0; i < 60 * 30; i++) {
    for (const ev of drainEvents(updateSimAndDrain(r))) types.add(ev.type);
  }
  assert.ok(types.has('start'));
  assert.ok(r.time > 0);
});

function updateSimAndDrain(r) {
  updateSim(r, {});
  return r;
}
