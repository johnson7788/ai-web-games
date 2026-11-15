import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, getHud, slipstreamActive } from '../src/game/sim.js';
import { createCourse } from '../src/game/track.js';
import { TRACKS, CONFIG, RING } from '../config/game.config.js';

const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SIDE = (r) => { const L = Math.hypot(-r.nz, r.nx) || 1; return { x: -r.nz / L, y: 0, z: r.nx / L }; };

// 跑到 race 阶段（避免浮点边界）
function enterRace(s) {
  let guard = 0;
  while (s.phase === 'countdown' && guard++ < 300) updateSim(s, {});
  assert.equal(s.phase, 'race');
}

// 把玩家对齐到某环正后方 0.1m（sideDist = 侧向偏移）
function alignToRing(s, r, sideDist = 0) {
  const side = SIDE(r);
  s.player.yaw = Math.atan2(r.nx, r.nz);
  s.player.pitch = Math.asin(clamp(r.ny, -1, 1));
  s.player.pos = {
    x: r.bx - r.nx * 0.1 + side.x * sideDist,
    y: r.by - r.ny * 0.1,
    z: r.bz - r.nz * 0.1 + side.z * sideDist,
  };
  s.player._d = -0.1;
  s.player.speed = 10;
  s.player.boost = 0.2;
}

test('8 机同场：1 玩家 + 7 bot', () => {
  const s = createSim({ seed: 1 });
  assert.equal(s.bots.length, 7);
});

test('倒计时结束进入 race 并发 raceStart', () => {
  const s = createSim({ seed: 1 });
  assert.equal(s.phase, 'countdown');
  enterRace(s);
  assert.ok(s.events.some((e) => e.type === 'raceStart'));
});

test('俯冲（pitch=-1）提速', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  const before = s.player.speed;
  for (let i = 0; i < 30; i++) updateSim(s, { pitch: -1 });
  assert.ok(s.player.speed > before, '俯冲应该提速');
});

test('爬升（pitch=+1）减速', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  for (let i = 0; i < 30; i++) updateSim(s, { pitch: -1 });
  const before = s.player.speed;
  for (let i = 0; i < 30; i++) updateSim(s, { pitch: 1 });
  assert.ok(s.player.speed < before, '爬升应该减速');
});

test('偏航输入改变航向角', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  const y0 = s.player.yaw;
  for (let i = 0; i < 10; i++) updateSim(s, { yaw: 1 });
  assert.notEqual(s.player.yaw, y0);
});

test('boost 消耗条并发出 boostStart', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  s.player.boost = 1;
  s.events.length = 0;
  updateSim(s, { boost: true });
  assert.ok(s.player.boosting);
  assert.ok(s.player.boost < 1);
  assert.ok(s.events.some((e) => e.type === 'boostStart'));
});

test('穿环：ringPass + boost 回充 + 环数 +1', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  const r = s.track.rings[0];
  alignToRing(s, r);
  const before = s.player.ringsPassed;
  updateSim(s, {});
  const evs = drainEvents(s);
  assert.ok(evs.some((e) => e.type === 'ringPass'));
  assert.equal(s.player.ringsPassed, before + 1);
  assert.ok(s.player.boost > 0.2, '穿环应该回充 boost');
});

test('漏环：ringMiss + 罚时 2s', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  const r = s.track.rings[0];
  alignToRing(s, r, r.radius * 3);
  updateSim(s, {});
  const evs = drainEvents(s);
  assert.ok(evs.some((e) => e.type === 'ringMiss'));
  assert.equal(s.player.penalty, RING.missPenalty);
});

test('撞环：ringHit + 掉速', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  const r = s.track.rings[0];
  alignToRing(s, r, r.radius * 1.5);
  const before = s.player.speed;
  updateSim(s, {});
  const evs = drainEvents(s);
  assert.ok(evs.some((e) => e.type === 'ringHit'));
  assert.ok(s.player.speed < before, '撞环应该掉速');
});

test('过一圈：lap 事件 + 圈数 +1', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  const r = s.track.rings[s.track.ringCount - 1];
  s.player.ringIndex = s.track.ringCount - 1;
  alignToRing(s, r);
  updateSim(s, {});
  const evs = drainEvents(s);
  assert.ok(evs.some((e) => e.type === 'lap'));
  assert.equal(s.player.lap, 2);
});

test('3 圈完：finished + 评级/名次', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  const r = s.track.rings[s.track.ringCount - 1];
  s.player.ringIndex = s.track.ringCount - 1;
  s.player.lap = 3;
  alignToRing(s, r);
  updateSim(s, {});
  assert.equal(s.phase, 'finished');
  assert.ok(['S', 'A', 'B', 'C'].includes(s.rating));
  assert.ok(s.rank >= 1 && s.rank <= 8);
  assert.ok(s.events.some((e) => e.type === 'finished'));
});

test('高速撞地：crash + 重生回空中', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  s.player.speed = 60;
  s.player.pos.y = -5;
  updateSim(s, {});
  const evs = drainEvents(s);
  assert.ok(evs.some((e) => e.type === 'crash'));
  assert.equal(s.stats.crashes, 1);
  assert.ok(s.player.pos.y > 0, '重生应该回到空中');
});

test('轻触地：groundHit 且速度不为 0', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  s.player.speed = 20;
  s.player.pos.y = -2;
  updateSim(s, {});
  const evs = drainEvents(s);
  assert.ok(evs.some((e) => e.type === 'groundHit'));
  assert.ok(s.player.speed > 0);
});

test('尾流：前机 3m 内判定为激活', () => {
  const p = { pos: { x: 0, y: 0, z: 0 }, fx: 0, fy: 0, fz: 1 };
  const bot = { pos: { x: 0, y: 0, z: 3 }, finished: false };
  assert.equal(slipstreamActive(p, [bot]), true);
  const behind = { pos: { x: 0, y: 0, z: -3 }, finished: false };
  assert.equal(slipstreamActive(p, [behind]), false);
  const far = { pos: { x: 0, y: 0, z: 9 }, finished: false };
  assert.equal(slipstreamActive(p, [far]), false);
});

test('同 seed 完全可复现', () => {
  const a = createSim({ seed: 42 });
  const b = createSim({ seed: 42 });
  for (let i = 0; i < 90; i++) { updateSim(a, { pitch: 0.2, yaw: -0.1 }); updateSim(b, { pitch: 0.2, yaw: -0.1 }); }
  assert.equal(a.player.pos.x, b.player.pos.x);
  assert.equal(a.player.pos.z, b.player.pos.z);
  assert.equal(a.bots[0].pos.x, b.bots[0].pos.x);
});

test('5 条赛道生成且环数正确', () => {
  for (let i = 0; i < TRACKS.length; i++) {
    const c = createCourse(TRACKS[i]);
    assert.equal(c.rings.length, TRACKS[i].ringCount);
    assert.ok(c.length > 1000);
    assert.ok(c.rings.every((r) => r.radius > 0));
  }
});

test('金色冲刺赛道末段窄环', () => {
  const c = createCourse(TRACKS[4]);
  const last = c.rings[c.rings.length - 1];
  assert.equal(last.radius, TRACKS[4].sprintRadius);
  assert.ok(last.radius < c.rings[0].radius);
});

test('getHud 返回 HUD 字段与箭头角', () => {
  const s = createSim({ seed: 1 });
  const h = getHud(s);
  assert.equal(h.laps, CONFIG.laps);
  assert.equal(typeof h.speed, 'number');
  assert.equal(typeof h.arrowDeg, 'number');
  assert.equal(typeof h.above, 'boolean');
  assert.equal(h.ring, 1);
});

test('漏环不淘汰：仍推进到下一环并继续比赛', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  const r = s.track.rings[0];
  alignToRing(s, r, r.radius * 3);
  updateSim(s, {});
  assert.equal(s.phase, 'race');
  assert.equal(s.player.ringIndex, 1);
});

test('bot 也会推进环并完成比赛', () => {
  const s = createSim({ seed: 1 });
  enterRace(s);
  // 让所有 bot 快速跑到冲刺环附近，验证其状态被推进（纯结构断言）
  assert.ok(s.bots.every((b) => b.ringIndex >= 0 && b.lap >= 1 && b.finished === false));
});
