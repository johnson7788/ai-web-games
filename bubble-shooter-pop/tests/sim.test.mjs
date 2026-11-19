import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, GAME as G } from '../config/game.config.js';

const drain = (r) => r.drainEvents();

test('createRun 初始状态：playing / 第 1 波 / 0 分 / 炮台居中', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.state.phase, 'playing');
  assert.equal(r.state.wave, 1);
  assert.equal(r.state.score, 0);
  assert.equal(r.state.cannon.x, WORLD.WIDTH / 2);
});

test('move 左右控制炮台速度，松开归零', () => {
  const r = createRun({ seed: 1 });
  r.move(-1);
  assert.ok(r.state.cannon.vx < 0);
  r.move(1);
  assert.ok(r.state.cannon.vx > 0);
  r.move(0);
  assert.equal(r.state.cannon.vx, 0);
});

test('steer 直接定位并夹紧左右边界', () => {
  const r = createRun({ seed: 1 });
  r.steer(99999);
  assert.equal(r.state.cannon.x, G.CANNON_MAX_X);
  r.steer(-99999);
  assert.equal(r.state.cannon.x, G.CANNON_MIN_X);
});

test('burst 发射子弹且进入冷却', () => {
  const r = createRun({ seed: 1 });
  const res = r.burst();
  assert.equal(res.ok, true);
  assert.ok(r.state.bullets.length > 0);
  assert.equal(r.burst().ok, false);
});

test('自动射击会持续推进并发出 shot 事件', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < 60; i += 1) r.step(1 / 60);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'shot'));
});

test('spawnBubble 添加一个泡泡', () => {
  const r = createRun({ seed: 1 });
  const res = r.spawnBubble('normal', 640);
  assert.equal(res.ok, true);
  assert.equal(r.state.bubbles.length, 1);
});

test('子弹击中普通泡泡：得分 + 连击 + pop 事件', () => {
  const r = createRun({ seed: 1 });
  r.spawnBubble('normal', 640);
  const b = r.state.bubbles[0];
  b.x = r.state.cannon.x;
  b.y = G.CANNON_Y - 120;
  b.vx = 0;
  let popped = false;
  for (let i = 0; i < 120 && !popped; i += 1) {
    r.step(1 / 60);
    popped = drain(r).some((e) => e.type === 'pop');
  }
  assert.ok(popped);
  assert.ok(r.state.score > 0);
  assert.equal(r.state.combo, 1);
});

test('泡泡逃逸后连击归零并发出 miss', () => {
  const r = createRun({ seed: 1 });
  r.state.combo = 5;
  r.state.bubbles.push({
    id: 999, kind: 'normal', x: 640, y: WORLD.HEIGHT + 100, vx: 0, vy: 100,
    hp: 1, maxHp: 1, value: 1, r: G.BUBBLE_R, color: 1, age: 0, dead: false,
  });
  r.step(1 / 60);
  assert.equal(r.state.combo, 0);
  assert.ok(drain(r).some((e) => e.type === 'miss'));
});

test('击破 8 个泡泡进入下一波', () => {
  const r = createRun({ seed: 1 });
  for (let i = 0; i < 8; i += 1) {
    r.spawnBubble('normal', 640);
    const b = r.state.bubbles[r.state.bubbles.length - 1];
    b.x = r.state.cannon.x;
    b.y = G.CANNON_Y - 120;
    b.vx = 0;
    let guard = 0;
    while (!b.dead && guard++ < 120) r.step(1 / 60);
    drain(r);
  }
  assert.equal(r.state.wave, 2);
});

test('泡泡撞上炮台导致失败并结算星级', () => {
  const r = createRun({ seed: 1 });
  r.spawnBubble('normal', r.state.cannon.x + 50);
  const b = r.state.bubbles[0];
  b.x = r.state.cannon.x + 50;
  b.y = G.CANNON_Y - 12;
  b.vx = 0;
  b.vy = 0;
  r.step(1 / 60);
  assert.equal(r.state.phase, 'over');
  assert.ok(drain(r).some((e) => e.type === 'lose'));
  assert.ok(r.state.stars >= 1);
});

test('黄金泡泡被击破后掉落道具', () => {
  const r = createRun({ seed: 1 });
  r.spawnBubble('gold', 640);
  const b = r.state.bubbles[0];
  b.x = r.state.cannon.x;
  b.y = G.CANNON_Y - 120;
  b.vx = 0;
  let popped = false;
  for (let i = 0; i < 120 && !popped; i += 1) {
    r.step(1 / 60);
    popped = drain(r).some((e) => e.type === 'pop');
  }
  assert.ok(popped);
  assert.ok(r.state.powerups.length > 0);
});

test('炸弹泡泡击破后连锁清除邻近泡泡', () => {
  const r = createRun({ seed: 1 });
  r.spawnBubble('bomb', 640);
  r.spawnBubble('normal', 640);
  const bomb = r.state.bubbles[0];
  const norm = r.state.bubbles[1];
  bomb.x = r.state.cannon.x;
  bomb.y = G.CANNON_Y - 120;
  bomb.vx = 0;
  norm.x = bomb.x + 70;
  norm.y = bomb.y;
  norm.vx = 0;
  let ev = [];
  for (let i = 0; i < 120; i += 1) {
    r.step(1 / 60);
    ev = drain(r);
    if (ev.some((e) => e.type === 'bomb')) break;
  }
  assert.ok(ev.some((e) => e.type === 'bomb'));
  assert.ok(r.state.bubbles.every((b) => b.dead));
});

test('mulberry32 同种子可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});
