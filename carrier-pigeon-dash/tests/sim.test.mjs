import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, starsForScore, levelForScore, mulberry32 } from '../src/game/sim.js';
import { WORLD, PLAYER, TOWER, MAIL_PER_DELIVERY, DELIVERY_BONUS } from '../config/game.config.js';

test('初始处于 ready 态，信鸽在中央悬浮', () => {
  const run = createRun();
  assert.equal(run.state.phase, 'ready');
  assert.equal(run.state.score, 0);
  assert.ok(run.bird.y > 0 && run.bird.y < WORLD.GROUND_Y);
});

test('ready 态 flap 会直接起飞并给出向上速度', () => {
  const run = createRun();
  const res = run.flap();
  assert.equal(res.ok, true);
  assert.equal(run.state.phase, 'playing');
  assert.ok(run.bird.vy < 0, 'vy 应为负（向上）');
});

test('重力会把信鸽往下拉', () => {
  const run = createRun();
  run.start();
  run.bird.vy = 0;
  run.step(1 / 60);
  assert.ok(run.bird.vy > 0, '一步后 vy 应转为向下');
});

test('上升被钳制在 TOP_CLAMP，不进入 HUD 条', () => {
  const run = createRun();
  run.start();
  run.bird.y = PLAYER.TOP_CLAMP - 5;
  run.bird.vy = -500;
  run.step(1 / 60);
  assert.equal(run.bird.y, PLAYER.TOP_CLAMP);
});

test('noinput：起飞后不拍翼最终坠地死亡', () => {
  const run = createRun();
  run.start();
  for (let i = 0; i < 60 * 5; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'dead');
  assert.ok(run.state.deaths >= 1);
});

test('起飞后会生成塔阵', () => {
  const run = createRun();
  run.start();
  run.step(1 / 60);
  assert.ok(run.towers.length >= 1, '应至少生成一座塔');
});

test('通过一座塔得 1 分并累计连击', () => {
  const run = createRun();
  run.start();
  run.bird.y = 320;
  run.towers = [{ x: PLAYER.X - PLAYER.R - TOWER.W - 5, gapY: 320, gap: 360, passed: false }];
  run.rocks = [];
  run.tokens = [];
  run.step(1 / 60);
  assert.equal(run.state.score, 1);
  assert.equal(run.state.combo, 1);
});

test('撞上塔的下半段会死亡', () => {
  const run = createRun();
  run.start();
  run.bird.y = 320;
  run.towers = [{ x: PLAYER.X, gapY: 100, gap: 120, passed: false }]; // 缺口远在上方
  run.rocks = [];
  run.tokens = [];
  run.step(1 / 60);
  assert.equal(run.state.phase, 'dead');
});

test('撞地面会死亡', () => {
  const run = createRun();
  run.start();
  run.bird.y = WORLD.GROUND_Y - 2;
  run.bird.vy = 0;
  run.towers = [];
  run.rocks = [];
  run.tokens = [];
  run.step(1 / 60);
  assert.equal(run.state.phase, 'dead');
});

test('穿过带信封的缺口会增加邮件计数', () => {
  const run = createRun();
  run.start();
  run.bird.y = 320;
  run.towers = [{ x: PLAYER.X - PLAYER.R - TOWER.W - 5, gapY: 320, gap: 360, passed: false, token: { y: 320, collected: false } }];
  run.rocks = [];
  run.step(1 / 60);
  assert.equal(run.state.mail, 1);
  assert.equal(run.state.score, 1);
});

test('接满邮件触发配送奖励', () => {
  const run = createRun();
  run.start();
  run.bird.y = 320;
  run.towers = [];
  run.rocks = [];
  for (let i = 0; i < MAIL_PER_DELIVERY; i += 1) {
    run.towers.push({ x: 100, gapY: 320, gap: 360, passed: false, token: { y: 320, collected: false } });
  }
  run.step(1 / 60);
  assert.equal(run.state.mail, MAIL_PER_DELIVERY);
  assert.equal(run.state.deliveries, 1);
  assert.ok(run.state.score >= DELIVERY_BONUS);
});

test('死亡后 step 不再推进', () => {
  const run = createRun();
  run.start();
  run.die('force');
  const t0 = run.state.time;
  run.step(1 / 60);
  assert.equal(run.state.time, t0);
});

test('drainEvents 会清空事件队列', () => {
  const run = createRun();
  run.start();
  run.flap();
  const evs = run.drainEvents();
  assert.ok(evs.length >= 1);
  assert.equal(run.drainEvents().length, 0);
});

test('星级与分数门槛一致', () => {
  assert.equal(starsForScore(4), 0);
  assert.equal(starsForScore(5), 1);
  assert.equal(starsForScore(15), 2);
  assert.equal(starsForScore(25), 3);
});

test('难度分区随分数递增', () => {
  assert.equal(levelForScore(0), 0);
  assert.equal(levelForScore(9), 1);
  assert.equal(levelForScore(19), 2);
  assert.equal(levelForScore(34), 3);
  assert.equal(levelForScore(99), 4);
});

test('同 seed 生成完全一致的对局', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  a.start();
  b.start();
  for (let i = 0; i < 60; i += 1) { a.step(1 / 60); b.step(1 / 60); }
  assert.equal(a.towers.length, b.towers.length);
  assert.equal(a.towers[0].gapY, b.towers[0].gapY);
  assert.equal(a.state.score, b.state.score);
});

test('mulberry32 是确定性的', () => {
  const r1 = mulberry32(7);
  const r2 = mulberry32(7);
  assert.equal(r1(), r2());
});
