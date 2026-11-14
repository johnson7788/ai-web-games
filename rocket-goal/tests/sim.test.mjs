import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tick, getHud, makeRng } from '../src/game/sim.js';
import { ARENA, CAR, BALL, RULES } from '../config/game.config.js';

const CY = (ARENA.y0 + ARENA.y1) / 2;
const step = (run, n, input = {}) => { for (let i = 0; i < n; i++) tick(run, 1 / 60, input); };
const toPlay = (run) => { step(run, Math.ceil(RULES.kickoffPause * 60) + 2, {}); };

test('创建：两辆车，开球阶段，球在中点', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.cars.length, 2);
  assert.equal(run.phase, 'kickoff');
  assert.deepEqual(run.scores, [0, 0]);
  assert.equal(run.ball.x, 640);
});

test('开球暂停后进入 play', () => {
  const run = createRun({ seed: 1 });
  toPlay(run);
  assert.equal(run.phase, 'play');
});

test('加速：油门使车前进', () => {
  const run = createRun({ seed: 1 });
  toPlay(run);
  const x0 = run.cars[0].x;
  step(run, 40, { up: true });
  assert.ok(run.cars[0].speed > 60);
  assert.ok(run.cars[0].x > x0);
});

test('转向：行进中转向改变朝向', () => {
  const run = createRun({ seed: 1 });
  toPlay(run);
  step(run, 30, { up: true });
  const h0 = run.cars[0].heading;
  step(run, 30, { up: true, right: true });
  assert.ok(run.cars[0].heading > h0);
});

test('加速 boost：消耗能量并提速', () => {
  const run = createRun({ seed: 1 });
  toPlay(run);
  run.cars[0].boost = 1;
  step(run, 30, { up: true, boost: true });
  assert.ok(run.cars[0].boost < 1);
  assert.ok(run.cars[0].speed > 200);
});

test('撞球：车把球撞飞', () => {
  const run = createRun({ seed: 1 });
  toPlay(run);
  const c = run.cars[0];
  c.x = 600; c.y = CY; c.heading = 0; c.speed = 320;
  run.cars[1].x = 150;
  run.ball.x = 645; run.ball.y = CY; run.ball.vx = 0; run.ball.vy = 0;
  tick(run, 1 / 60, {});
  assert.ok(run.ball.vx > 50);
});

test('进球：球入右门蓝方得分', () => {
  const run = createRun({ seed: 1 });
  toPlay(run);
  run.cars[0].x = 150; run.cars[1].x = 150;
  run.ball.x = ARENA.x1 - 30; run.ball.y = CY; run.ball.vx = 600; run.ball.vy = 0;
  step(run, 12, {});
  assert.equal(run.scores[0], 1);
  assert.equal(run.phase, 'goal');
});

test('胜利：先达 5 球获胜', () => {
  const run = createRun({ seed: 1 });
  toPlay(run);
  run.scores[0] = RULES.winScore - 1;
  run.cars[0].x = 150; run.cars[1].x = 150;
  run.ball.x = ARENA.x1 - 30; run.ball.y = CY; run.ball.vx = 600; run.ball.vy = 0;
  step(run, 12, {});
  step(run, Math.ceil(RULES.goalPause * 60) + 2, {});
  assert.equal(run.phase, 'over');
  assert.equal(run.winner, 0);
});

test('Bot 自跑：双 bot 能进球直至终局', () => {
  const run = createRun({ seed: 3 });
  run.cars[0].isBot = true;
  let guard = 0;
  while (run.phase !== 'over' && guard < 60 * 240) { tick(run, 1 / 60, {}); guard++; }
  assert.ok(run.scores[0] + run.scores[1] > 0);
  assert.equal(run.phase, 'over');
});

test('RNG：同种子可复现', () => {
  const a = makeRng(17), b = makeRng(17);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});