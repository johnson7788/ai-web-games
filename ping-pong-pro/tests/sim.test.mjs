import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tick, getHud, WIN_SCORE } from '../src/game/sim.js';
import { TABLE, PADDLE, RULES, CONFIG } from '../config/game.config.js';

const CX = TABLE.X + TABLE.W / 2;

test('初始化：比分 0、serve 阶段、球在中心', () => {
  const run = createRun({ seed: 1 });
  assert.deepEqual(run.scores, [0, 0]);
  assert.equal(run.phase, 'serve');
  assert.equal(run.ball.x, CX);
});

test('发球：延迟后球开始运动', () => {
  const run = createRun({ seed: 1 });
  tick(run, RULES.serveDelay + 0.1, {});
  assert.equal(run.phase, 'play');
  assert.ok(run.ball.vy !== 0);
});

test('玩家球拍随输入移动并受限', () => {
  const run = createRun({ seed: 1 });
  const x0 = run.player.x;
  tick(run, 0.1, { move: 1 });
  assert.ok(run.player.x > x0);
  tick(run, 5, { move: 1 });
  assert.ok(run.player.x <= TABLE.X + TABLE.W - PADDLE.W / 2 + 0.01);
});

test('targetX 直接定位球拍', () => {
  const run = createRun({ seed: 1 });
  tick(run, 0.016, { targetX: TABLE.X + 100 });
  assert.ok(Math.abs(run.player.x - (TABLE.X + 100)) < 1);
});

test('球碰左右墙反弹', () => {
  const run = createRun({ seed: 1 });
  run.phase = 'play';
  run.ball.x = TABLE.X + 13;
  run.ball.y = TABLE.Y + TABLE.H / 2;
  run.ball.vx = -300;
  run.ball.vy = 0;
  tick(run, 0.016, {});
  assert.ok(run.ball.vx > 0, '左墙反弹向右');
});

test('球拍击球：球向上反弹', () => {
  const run = createRun({ seed: 1 });
  run.phase = 'play';
  run.player.x = CX;
  run.ball.x = CX;
  run.ball.y = PADDLE.PLAYER_Y - 13;
  run.ball.vx = 0;
  run.ball.vy = 300;
  tick(run, 0.016, {});
  assert.ok(run.ball.vy < 0, '击球后向上');
});

test('漏球得分：球过底线 → AI 得分', () => {
  const run = createRun({ seed: 1 });
  run.phase = 'play';
  run.ball.x = CX;
  run.ball.y = TABLE.Y + TABLE.H + 30;
  run.ball.vx = 0;
  run.ball.vy = 300;
  tick(run, 0.016, {});
  assert.equal(run.scores[1], 1);
});

test('达到 7 分获胜', () => {
  const run = createRun({ seed: 1 });
  run.scores[0] = WIN_SCORE - 1;
  run.phase = 'play';
  run.ball.x = CX;
  run.ball.y = TABLE.Y - 30;
  run.ball.vx = 0;
  run.ball.vy = -300;
  tick(run, 0.016, {});
  assert.equal(run.phase, 'over');
  assert.equal(run.winner, 0);
});

test('AI 球拍会移动', () => {
  const run = createRun({ seed: 1 });
  run.phase = 'play';
  run.ball.x = TABLE.X + 100;
  run.ball.y = TABLE.Y + 100;
  run.ball.vy = -200;
  const ax0 = run.ai.x;
  for (let i = 0; i < 30; i += 1) tick(run, 0.016, {});
  assert.ok(Math.abs(run.ai.x - ax0) > 1, 'AI 有移动');
});

test('配置默认值：7 分制 / en+zh', () => {
  assert.equal(WIN_SCORE, 7);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).winScore, 7);
});