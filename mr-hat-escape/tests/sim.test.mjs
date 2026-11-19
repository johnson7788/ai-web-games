import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { PLAYER } from '../config/game.config.js';

const IDLE = { left: false, right: false, jump: false, hold: false, pointerX: 0, pointerY: 0, pointerDown: false };

test('跳起：按跳后 vy < 0 且离地', () => {
  const r = createRun(0);
  r.step(1 / 60, { ...IDLE, jump: true });
  assert.ok(r.state.player.vy < 0, 'vy 应为负');
  assert.ok(!r.state.player.onGround, '应离地');
});

test('落地：跳起后多次更新回到地面', () => {
  const r = createRun(0);
  r.step(1 / 60, { ...IDLE, jump: true });
  for (let i = 0; i < 200; i += 1) r.step(1 / 60, IDLE);
  assert.ok(r.state.player.onGround, '应落地');
  assert.equal(Math.round(r.state.player.y), 576, '应回到地面高度');
});

test('移动：按右向右，按左向左', () => {
  const r = createRun(0);
  const x0 = r.state.player.x;
  for (let i = 0; i < 10; i += 1) r.step(1 / 60, { ...IDLE, right: true });
  assert.ok(r.state.player.x > x0, '右移增加 x');
  const x1 = r.state.player.x;
  for (let i = 0; i < 10; i += 1) r.step(1 / 60, { ...IDLE, left: true });
  assert.ok(r.state.player.x < x1, '左移减少 x');
});

test('边界：不能穿出左边界', () => {
  const r = createRun(0);
  r.state.player.x = 0;
  for (let i = 0; i < 20; i += 1) r.step(1 / 60, { ...IDLE, left: true });
  assert.ok(r.state.player.x >= 0, 'x 不能小于 0');
});

test('钥匙：碰到钥匙后 keyCollected/doorOpen 为真并发出 key/doorOpen 事件', () => {
  const r = createRun(0);
  const k = r.state.key;
  r.state.player.x = k.x - 4;
  r.state.player.y = k.y - 4;
  r.step(1 / 60, IDLE);
  const types = r.drainEvents().map((e) => e.type);
  assert.ok(r.state.keyCollected, '应捡到钥匙');
  assert.ok(r.state.doorOpen, '门应打开');
  assert.ok(types.includes('key'), '应有 key 事件');
  assert.ok(types.includes('doorOpen'), '应有 doorOpen 事件');
});

test('过关：门开后走进门 → phase=won 并发 win', () => {
  const r = createRun(0);
  r.state.doorOpen = true;
  r.state.player.x = r.state.door.x - PLAYER.W - 2;
  r.state.player.y = r.state.door.y;
  r.step(1 / 60, { ...IDLE, right: true });
  assert.equal(r.state.phase, 'won', '应过关');
  assert.ok(r.drainEvents().some((e) => e.type === 'win'), '应有 win 事件');
});

test('尖刺死亡：碰到尖刺死亡并发出 lose', () => {
  const r = createRun(0);
  const sp = r.state.spikes[0];
  r.state.player.x = sp.x + 8;
  r.state.player.y = sp.y - 10;
  r.step(1 / 60, IDLE);
  assert.equal(r.state.deaths, 1, '死亡计数 +1');
  assert.ok(r.drainEvents().some((e) => e.type === 'lose'), '应有 lose 事件');
  assert.equal(r.state.phase, 'playing', '死亡后原地重生，仍在 playing');
});

test('星星：碰到星星收集 + 发 star 事件', () => {
  const r = createRun(0);
  const st = r.state.stars[0];
  r.state.player.x = st.x - 6;
  r.state.player.y = st.y - 6;
  r.step(1 / 60, IDLE);
  assert.equal(r.state.starsCollected, 1, '收集 1 颗星');
  assert.ok(r.drainEvents().some((e) => e.type === 'star'), '应有 star 事件');
});

test('连击：短时间内连吃两星触发 combo', () => {
  const r = createRun(0);
  const [a, b] = r.state.stars;
  r.state.player.x = a.x - 6; r.state.player.y = a.y - 6;
  r.step(1 / 60, IDLE);
  r.state.player.x = b.x - 6; r.state.player.y = b.y - 6;
  r.step(1 / 60, IDLE);
  assert.ok(r.state.combo >= 2, '连击数应 ≥2');
  assert.ok(r.drainEvents().some((e) => e.type === 'combo'), '应有 combo 事件');
});

test('锯片死亡：碰到锯片死亡', () => {
  const r = createRun(3); // L4 Blade Run
  const b = r.state.blades[0];
  r.state.player.x = b.x - PLAYER.W / 2;
  r.state.player.y = b.y - PLAYER.H / 2;
  r.step(1 / 60, IDLE);
  assert.equal(r.state.deaths, 1, '锯片致死');
});

test('木箱：推动木箱会横向移动', () => {
  const r = createRun(4); // L5 Crate Stack
  const c = r.state.crates[0];
  const x0 = c.x;
  r.state.player.x = c.x - PLAYER.W - 2;
  r.state.player.y = 576; // 站在地面上，与木箱垂直重叠
  for (let i = 0; i < 20; i += 1) r.step(1 / 60, { ...IDLE, right: true });
  assert.ok(c.x > x0, '木箱应被推动');
});

test('关卡数据：11 关，每关有门且星星总数 > 0', () => {
  assert.equal(LEVEL_COUNT, 11);
  for (const lv of LEVELS) {
    assert.ok(lv.door, `${lv.name} 有门`);
    assert.ok(lv.stars.length >= 1, `${lv.name} 有星星`);
  }
});

test('事件类型完整：drainEvents 的事件名都是字符串', () => {
  const r = createRun(0);
  r.step(1 / 60, { ...IDLE, jump: true });
  const evs = r.drainEvents();
  assert.ok(evs.length > 0, '有事件');
  for (const e of evs) assert.equal(typeof e.type, 'string', '事件 type 是字符串');
});
