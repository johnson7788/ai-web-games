import test from 'node:test';
import assert from 'node:assert/strict';
import { createRun, tick, getHud, makeRng } from '../src/game/sim.js';
import { PLAYER, BULLET, RULES, GROUND_Y, PLATFORMS } from '../config/game.config.js';

const step = (run, n, input = {}) => { for (let i = 0; i < n; i++) tick(run, 1 / 60, input); };
const isolate = (run) => { for (const p of run.players) if (p.id !== 0 && p.id !== 1) p.alive = false; run.players[1].isBot = false; };

test('创建：1 人类 + 3 bot，比分 0', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.players.length, 1 + RULES.botCount);
  assert.equal(run.players[0].isBot, false);
  assert.deepEqual(run.scores, [0, 0]);
});

test('移动：右移使玩家位移', () => {
  const run = createRun({ seed: 1 });
  const x0 = run.players[0].x;
  step(run, 20, { right: true });
  assert.ok(run.players[0].x > x0);
});

test('跳跃：起跳离地，可二段跳', () => {
  const run = createRun({ seed: 1 });
  step(run, 2, { jump: true });
  assert.ok(run.players[0].y < GROUND_Y);
  assert.equal(run.players[0].jumps, 1);
  step(run, 2, { jump: false });
  step(run, 2, { jump: true });
  assert.equal(run.players[0].jumps, 2);
});

test('重力：跳起后落回地面', () => {
  const run = createRun({ seed: 1 });
  step(run, 3, { jump: true });
  step(run, 90, {});
  assert.equal(run.players[0].y, GROUND_Y);
  assert.equal(run.players[0].onGround, true);
});

test('平台：从上方落到平台上', () => {
  const run = createRun({ seed: 1 });
  const p = run.players[0];
  p.x = 600; p.y = 400; p.vy = 0;
  step(run, 30, {});
  assert.equal(p.y, 440);
  assert.equal(p.onGround, true);
});

test('射击：开火生成子弹', () => {
  const run = createRun({ seed: 1 });
  isolate(run);
  step(run, 2, { shoot: true, aim: 0 });
  assert.ok(run.bullets.some((b) => b.owner === 0));
});

test('命中：子弹击中敌人掉血', () => {
  const run = createRun({ seed: 1 });
  isolate(run);
  const e = run.players[1];
  e.x = 640; e.y = GROUND_Y; e.hp = PLAYER.HP;
  const cy = e.y - PLAYER.H / 2;
  run.bullets.push({ x: 625, y: cy, vx: BULLET.SPEED, vy: 0, team: 0, owner: 0, life: 1 });
  tick(run, 1 / 60, {});
  assert.equal(e.hp, PLAYER.HP - BULLET.DMG);
});

test('击杀：敌人阵亡我方记分', () => {
  const run = createRun({ seed: 1 });
  isolate(run);
  const e = run.players[1];
  e.x = 640; e.y = GROUND_Y; e.hp = BULLET.DMG;
  const cy = e.y - PLAYER.H / 2;
  run.bullets.push({ x: 625, y: cy, vx: BULLET.SPEED, vy: 0, team: 0, owner: 0, life: 1 });
  tick(run, 1 / 60, {});
  assert.equal(e.alive, false);
  assert.equal(run.scores[0], 1);
});

test('胜利：先达击杀目标获胜', () => {
  const run = createRun({ seed: 1 });
  run.scores[0] = RULES.killTarget;
  tick(run, 1 / 60, {});
  assert.equal(run.phase, 'over');
  assert.equal(run.winner, 0);
});

test('Bot 自跑：能产生击杀直至终局', () => {
  const run = createRun({ seed: 5 });
  let guard = 0;
  while (run.phase !== 'over' && guard < 60 * 200) { tick(run, 1 / 60, {}); guard++; }
  assert.ok(run.scores[0] + run.scores[1] > 0);
  assert.equal(run.phase, 'over');
});

test('RNG：同种子可复现', () => {
  const a = makeRng(19), b = makeRng(19);
  for (let i = 0; i < 5; i++) assert.equal(a(), b());
});