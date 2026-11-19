import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, createSim, mulberry32 } from '../src/game/sim.js';
import { solveRun, greedyAngle } from '../src/game/level.js';
import { DANGER_Y, COMBO_MAX, AIM } from '../config/game.config.js';

test('冒烟：createRun → aim → fire → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  r.aim(30);
  r.fire();
  r.step(1 / 60);
  const h = r.getHud();
  assert.equal(h.level, 1);
  assert.equal(h.phase, 'flying');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('state 形状：level/phase/bricks/ballCount/clearableCount', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.phase, 'aim');
  assert.ok(Array.isArray(s.bricks) && s.bricks.length > 0);
  assert.ok(s.ballCount > 0);
  assert.ok(s.clearableCount > 0);
  assert.equal(s.clearableCount, s.bricks.filter((b) => b.clearable).length);
});

test('aim 夹取范围：±80 度', () => {
  const r = createRun(0, { seed: 1 });
  r.aim(999);
  assert.equal(r.state.cannonAngle, AIM.MAX);
  r.aim(-999);
  assert.equal(r.state.cannonAngle, AIM.MIN);
  r.aim(30);
  assert.equal(r.state.cannonAngle, 30);
});

test('fire：进入 flying 并记录 volley 与整束球', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.fire().ok, true);
  assert.equal(r.state.phase, 'flying');
  assert.equal(r.state.volleys, 1);
  assert.equal(r.state.launchQueue, r.state.ballCount);
  assert.ok(r.drainEvents().some((e) => e.type === 'fire'));
});

test('fire 非 aim 状态拒绝', () => {
  const r = createRun(0, { seed: 1 });
  r.fire();
  assert.deepEqual(r.fire(), { ok: false, reason: 'notAiming' });
});

test('连发：step 推进会产生 launch 事件与球', () => {
  const r = createRun(0, { seed: 1 });
  r.fire();
  r.step(0.2);
  assert.ok(r.state.balls.length > 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'launch'));
});

test('球撞数字砖减耐久并得分', () => {
  const r = createRun(0, { seed: 1 });
  const brick = r.state.bricks.find((b) => b.type === 'num' && b.hp >= 2);
  const before = brick.hp;
  const score = r.state.score;
  r._damageBrick(brick);
  assert.equal(brick.hp, before - 1);
  assert.ok(r.state.score > score);
  assert.ok(r.drainEvents().some((e) => e.type === 'hit'));
});

test('摧毁砖：dead + clearableCount 减 + combo 增 + break 事件', () => {
  const r = createRun(0, { seed: 1 });
  const brick = r.state.bricks.find((b) => b.clearable && !b.dead);
  const before = r.state.clearableCount;
  r._breakBrick(brick);
  assert.equal(brick.dead, true);
  assert.equal(r.state.clearableCount, before - 1);
  assert.ok(r.state.combo >= 1);
  assert.ok(r.drainEvents().some((e) => e.type === 'break'));
});

test('连击封顶 COMBO_MAX 且断连归零', () => {
  const r = createRun(0, { seed: 1 });
  for (let i = 0; i < COMBO_MAX + 3; i += 1) {
    const b = r.state.bricks.find((x) => x.clearable && !x.dead);
    r._breakBrick(b);
  }
  assert.equal(r.state.combo, COMBO_MAX);
  r._onBallConsumed({ hasHit: false });
  assert.equal(r.state.combo, 0);
});

test('岩石固定：下坠时位置不变，普通砖下移', () => {
  const r = createRun(1, { seed: 1 });
  const rock = r.state.bricks.find((b) => b.type === 'rock');
  const num = r.state.bricks.find((b) => b.type === 'num' && !b.dead);
  const ry = rock.y;
  const ny = num.y;
  r._descend();
  assert.equal(rock.y, ry);
  assert.ok(num.y > ny);
  assert.equal(r.state.phase, 'aim');
});

test('危险线：下坠到底越过 DANGER_Y → lost', () => {
  const r = createRun(0, { seed: 1 });
  const b = r.state.bricks.find((x) => x.descendable && !x.dead);
  b.y = DANGER_Y - 1;
  r._descend();
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'wall');
});

test('贪心求解 L1 → won + 星星 + win/break 事件', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(solveRun(r), 'won');
  assert.equal(r.state.phase, 'won');
  assert.ok(r.state.stars >= 1 && r.state.stars <= 3);
  const ev = r.drainEvents();
  assert.ok(ev.some((e) => e.type === 'win'));
  assert.ok(ev.some((e) => e.type === 'break'));
});

test('greedyAngle 返回有限值且在范围内', () => {
  const r = createRun(0, { seed: 1 });
  const a = greedyAngle(r.state);
  assert.ok(Number.isFinite(a));
  assert.ok(a >= AIM.MIN && a <= AIM.MAX);
});

test('createSim 兼容别名可创建', () => {
  const s = createSim();
  assert.equal(s.state.level, 1);
  assert.ok(Array.isArray(s.state.bricks));
});

test('mulberry32 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
});
