import test from 'node:test';
import assert from 'node:assert/strict';
import { parseLevel } from '../src/game/level.js';
import { Player } from '../src/game/player.js';
import { P } from '../config/game.config.js';

function makeLevel(w = 40, ground = () => true) {
  const rows = ['.'.repeat(w), '.'.repeat(w), '.'.repeat(w)];
  let g = '';
  for (let x = 0; x < w; x++) g += ground(x) ? '#' : '.';
  rows.push(g);
  const put = (r, x, ch) => { rows[r] = rows[r].slice(0, x) + ch + rows[r].slice(x + 1); };
  put(2, 2, 'P');
  put(2, w - 2, 'F');
  return parseLevel({ id: 't', name: {}, theme: 'wood', timeLimit: 60, entities: [], terrain: rows });
}

const lv = makeLevel(40);
const GROUND_Y = 1 + 0.475;

function groundedAt(x = 5.5, level = lv) {
  const p = new Player(level.spawn);
  p.body.x = x;
  p.body.y = GROUND_Y;
  for (let i = 0; i < 6; i++) p.update({}, level, 1 / 60);
  return p;
}

test('按住右加速到走速上限，松开后滑步停下', () => {
  const p = groundedAt();
  for (let i = 0; i < 120; i++) p.update({ right: true }, lv, 1 / 60);
  assert.ok(Math.abs(p.body.vx - P.walkMax) < 0.05, `vx=${p.body.vx}`);
  const x0 = p.body.x;
  for (let i = 0; i < 120; i++) p.update({}, lv, 1 / 60);
  assert.equal(p.body.vx, 0);
  assert.ok(p.body.x - x0 > 0.3, `滑步 ${p.body.x - x0}`);
});

test('按住跑比走更快', () => {
  const p = groundedAt();
  for (let i = 0; i < 120; i++) p.update({ right: true, run: true }, lv, 1 / 60);
  assert.ok(Math.abs(p.body.vx - P.runMax) < 0.05);
});

function jumpHeight(hold) {
  const p = groundedAt();
  const y0 = p.body.y;
  let maxY = y0;
  for (let i = 0; i < 120; i++) {
    p.update({ jumpPressed: i === 0, jumpHeld: hold || i === 0 }, lv, 1 / 60);
    maxY = Math.max(maxY, p.body.y);
  }
  return maxY - y0;
}

test('按住跳比点跳高 ≥ 1.2 格（可变跳跃）', () => {
  const hold = jumpHeight(true);
  const tap = jumpHeight(false);
  assert.ok(hold > 3.5, `满跳 ${hold}`);
  assert.ok(tap > 1.0, `最小跳 ${tap}`);
  assert.ok(hold - tap > 1.2, `差 ${hold - tap}`);
});

test('能跳过 3 格宽的坑', () => {
  const pit = makeLevel(40, (x) => x < 10 || x > 12);
  const p = groundedAt(7.5, pit);
  let cleared = false;
  let pressed = false;
  for (let i = 0; i < 180; i++) {
    const nearEdge = p.body.grounded && p.body.x > 8.2;
    p.update({
      right: true, run: true,
      jumpPressed: nearEdge && !pressed,
      jumpHeld: nearEdge || pressed,
    }, pit, 1 / 60);
    if (nearEdge) pressed = true;
    if (p.body.x > 13 && p.body.grounded) { cleared = true; break; }
  }
  assert.ok(cleared, `x=${p.body.x.toFixed(2)} y=${p.body.y.toFixed(2)}`);
});

test('土狼时间：离地 2 帧内还能跳，12 帧后不能', () => {
  const ledge = makeLevel(40, (x) => x < 4);
  const tryJump = (wait) => {
    const p = groundedAt(3.4, ledge);
    let left = false;
    for (let i = 0; i < 200 && !left; i++) {
      p.update({ right: true }, ledge, 1 / 60);
      if (!p.body.grounded) left = true;
    }
    for (let i = 0; i < wait; i++) p.update({ right: true }, ledge, 1 / 60);
    p.update({ right: true, jumpPressed: true, jumpHeld: true }, ledge, 1 / 60);
    return p.body.vy;
  };
  assert.ok(tryJump(1) > 0, '土狼窗口内应能起跳');
  assert.ok(tryJump(20) < 0, '窗口外不应起跳');
});

test('跳跃缓冲：落地前按下也能起跳', () => {
  const p = groundedAt(5.5);
  p.body.y = 3.5;
  p.body.vy = 0;
  let fired = false;
  for (let i = 0; i < 60; i++) {
    p.update({ jumpPressed: i === 12, jumpHeld: true }, lv, 1 / 60);
    if (i > 12 && p.body.vy > 0) fired = true;
  }
  assert.ok(fired, '落地缓冲未触发');
});

test('掉出地图判定死亡', () => {
  const p = groundedAt(5.5);
  p.body.y = -5;
  p.update({}, lv, 1 / 60);
  assert.equal(p.dead, true);
});
