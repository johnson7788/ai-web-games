import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, ROCK } from '../src/game/sim.js';
import { CELL, COLS, WORLD } from '../config/game.config.js';
import { LEVELS } from '../config/levels.js';

test('创建 run：初始为 playing，钻核在起点口袋静止', () => {
  const run = createRun(0);
  assert.equal(run.state.phase, 'playing');
  const o = run.state.orb;
  assert.ok(Math.abs(o.vx) < 1 && Math.abs(o.vy) < 1, '钻核应静止');
  assert.ok(o.y > run.state.level.startY, '钻核应落到口袋底部');
});

test('挖土：返回 ok 并减少土壤格', () => {
  const run = createRun(0);
  const res = run.carve(640, 300);
  assert.equal(res.ok, true);
  assert.ok(res.removed > 0, '应挖掉至少 1 格');
  assert.ok(run.state.carvedCells > 0, '已挖格数应增加');
});

test('挖岩石：hitRock 为真且岩石不被移除', () => {
  const run = createRun(2);
  const rock = run.state.level.rocks[0];
  const res = run.carve(rock.x, rock.y);
  assert.equal(res.hitRock, true);
  assert.equal(res.removed, 0);
  const idx = Math.floor(rock.y / CELL) * COLS + Math.floor(rock.x / CELL);
  assert.equal(run.state.grid[idx], ROCK, '岩石格应保持不变');
});

test('step：时间按固定步长推进', () => {
  const run = createRun(0);
  run.step(1 / 60);
  assert.ok(run.state.time > 0);
});

test('直挖通道：钻核坠入传送门获胜并吃到宝石', () => {
  const run = createRun(0);
  for (let y = 130; y <= 604; y += 12) {
    run.carve(640, y);
    run.carve(615, y);
    run.carve(665, y);
  }
  for (let i = 0; i < 60 * 12; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1, '至少 1 星');
  assert.ok(run.state.gemsCollected >= 1, '应吃到至少 1 颗宝石');
  assert.ok(run.state.score > 0, '得分应大于 0');
});

test('noinput：倒计时归零判负 timeOut', () => {
  const run = createRun(0);
  const frames = Math.ceil(run.state.level.time * 60) + 10;
  for (let i = 0; i < frames; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.loseReason, 'timeOut');
});

test('挖穿底部：钻核坠出场地判负 fellOut', () => {
  const run = createRun(0);
  for (let y = 130; y <= 720; y += 10) run.carve(100, y);
  run.state.orb.x = 100;
  run.state.orb.y = 200;
  run.state.orb.vx = 0;
  run.state.orb.vy = 0;
  for (let i = 0; i < 60 * 3; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.loseReason, 'fellOut');
});

test('关卡与边界：4 关存在且钻核半径在场地内', () => {
  assert.equal(LEVELS.length, 4);
  const run = createRun(3);
  const o = run.state.orb;
  assert.ok(o.x > 0 && o.x < WORLD.WIDTH);
});

test('事件流：初始只发 start，carve 后发 carve', () => {
  const run = createRun(0);
  const first = run.drainEvents();
  assert.equal(first.length, 1);
  assert.equal(first[0].type, 'start');
  run.carve(640, 300);
  const ev = run.drainEvents();
  assert.ok(ev.some((e) => e.type === 'carve'), '应产生 carve 事件');
});

test('连击与星级：直挖吃到多颗宝石后连击与星级成立', () => {
  const run = createRun(0);
  for (let y = 130; y <= 604; y += 12) {
    run.carve(640, y);
    run.carve(615, y);
    run.carve(665, y);
  }
  for (let i = 0; i < 60 * 12; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.combo >= 1, '连击应 ≥1');
  assert.ok(run.state.stars >= 2, 'L1 吃 2/3 宝石应 2 星');
});

test('挖开脚下：钻核在重力下开始下坠', () => {
  const run = createRun(0);
  const y0 = run.state.orb.y;
  for (let y = run.state.orb.y; y <= run.state.orb.y + 120; y += 10) run.carve(run.state.orb.x, y);
  for (let i = 0; i < 30; i += 1) run.step(1 / 60);
  assert.ok(run.state.orb.y > y0, '钻核应向下移动');
});
