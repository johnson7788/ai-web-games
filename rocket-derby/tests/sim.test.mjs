import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, getHud, ratingFor } from '../src/game/sim.js';
import { ARENA, MATCH, BALL, CAR, PICKUP, SCORE } from '../config/game.config.js';

const NONE = { throttle: 0, steer: 0, jump: false, boost: false };

function stepN(run, n, input = NONE) {
  for (let i = 0; i < n; i++) updateSim(run, input);
}

test('初始状态：kickoff 阶段、比分 0、第 1 关、四辆车', () => {
  const r = createSim({ seed: 1, level: 1 });
  assert.equal(r.phase, 'kickoff');
  assert.equal(r.scoreP, 0);
  assert.equal(r.scoreO, 0);
  assert.equal(r.level, 1);
  assert.equal(r.cars.length, 4);
  assert.equal(r.player.team, 'p');
  assert.equal(r.opponents.length, 2);
});

test('开球倒计时 3 秒后进入 play', () => {
  const r = createSim({ seed: 2 });
  stepN(r, Math.round(MATCH.KICKOFF_T * 60) + 2);
  assert.equal(r.phase, 'play');
});

test('油门 W：车沿朝向前进（x 增加）', () => {
  const r = createSim({ seed: 3 });
  r.phase = 'play';
  const x0 = r.player.x;
  stepN(r, 20, { throttle: 1, steer: 0, jump: false, boost: false });
  assert.ok(r.player.x > x0, '应向前移动');
  assert.ok(r.player.speed > 0, '速度应为正');
});

test('转向 A/D：heading 改变', () => {
  const r = createSim({ seed: 4 });
  r.phase = 'play';
  const h0 = r.player.heading;
  stepN(r, 20, { throttle: 1, steer: 1, jump: false, boost: false });
  assert.notEqual(r.player.heading, h0);
});

test('跳跃：空格后 y > 0 且离地', () => {
  const r = createSim({ seed: 5 });
  r.phase = 'play';
  updateSim(r, { throttle: 0, steer: 0, jump: true, boost: false });
  assert.ok(r.player.y > 0, '应离地');
  assert.equal(r.player.onGround, false);
});

test('二段跳：空中再跳触发 doubleJumped', () => {
  const r = createSim({ seed: 6 });
  r.phase = 'play';
  updateSim(r, { throttle: 0, steer: 0, jump: true, boost: false }); // 起跳
  stepN(r, 4);
  assert.ok(r.player.y > 0, '应还在空中');
  updateSim(r, { throttle: 0, steer: 0, jump: true, boost: false }); // 二段跳
  assert.equal(r.player.doubleJumped, true);
});

test('boost 消耗能量条', () => {
  const r = createSim({ seed: 7 });
  r.phase = 'play';
  const m0 = r.player.boostMeter;
  stepN(r, 30, { throttle: 0, steer: 0, jump: false, boost: true });
  assert.ok(r.player.boostMeter < m0, 'boost 条应减少');
});

test('撞球：车推进球后球获得速度并发出 hit 事件', () => {
  const r = createSim({ seed: 8 });
  r.phase = 'play';
  r.player.x = 0; r.player.z = 0; r.player.heading = 0; r.player.speed = 10;
  r.ball.x = CAR.R + BALL.R - 0.3; r.ball.z = 0; r.ball.vx = 0; r.ball.vz = 0;
  updateSim(r, { throttle: 1, steer: 0, jump: false, boost: false });
  assert.ok(Math.abs(r.ball.vx) > 5, `球应被击飞，vx=${r.ball.vx}`);
  const evs = drainEvents(r).map((e) => e.type);
  assert.ok(evs.includes('hit'), '应发出 hit 事件');
});

test('进球：球过右门线 → 己方得分 + goal 事件 + 回放', () => {
  const r = createSim({ seed: 9 });
  r.phase = 'play';
  r.ball.x = ARENA.HX - 0.3; r.ball.z = 0; r.ball.vx = 60; r.ball.vz = 0; r.ball.y = 0;
  updateSim(r, NONE);
  assert.equal(r.scoreP, 1);
  assert.equal(r.phase, 'goalReplay');
  const evs = drainEvents(r).map((e) => e.type);
  assert.ok(evs.includes('goal'));
});

test('失球：球过左门线 → 对方得分 + concede', () => {
  const r = createSim({ seed: 10 });
  r.phase = 'play';
  r.ball.x = -ARENA.HX + 0.3; r.ball.z = 0; r.ball.vx = -60; r.ball.vz = 0; r.ball.y = 0;
  updateSim(r, NONE);
  assert.equal(r.scoreO, 1);
  const evs = drainEvents(r).map((e) => e.type);
  assert.ok(evs.includes('concede'));
});

test('球速×100 计入分数，且最佳球速被记录', () => {
  const r = createSim({ seed: 11 });
  r.phase = 'play';
  r.ball.x = ARENA.HX - 0.3; r.ball.z = 0; r.ball.vx = 25; r.ball.vz = 0; r.ball.y = 0;
  updateSim(r, NONE);
  assert.equal(r.scoreP, 1);
  assert.ok(r.score > 0);
  assert.equal(r.score, Math.round(r.bestGoalSpeed * SCORE.SPEED_MUL));
});

test('常规时间领先 → 时间走完判胜', () => {
  const r = createSim({ seed: 12 });
  r.phase = 'play';
  r.scoreP = 2; r.scoreO = 1; r.clock = 0.1;
  stepN(r, 10);
  assert.equal(r.phase, 'end');
  assert.equal(r.result, 'win');
});

test('常规时间落后 → 判负', () => {
  const r = createSim({ seed: 13 });
  r.phase = 'play';
  r.scoreP = 1; r.scoreO = 2; r.clock = 0.1;
  stepN(r, 10);
  assert.equal(r.result, 'lose');
});

test('平局 → 加时金球制', () => {
  const r = createSim({ seed: 14 });
  r.phase = 'play';
  r.scoreP = 1; r.scoreO = 1; r.clock = 0.1;
  stepN(r, 10);
  assert.equal(r.phase, 'overtime');
  const evs = drainEvents(r).map((e) => e.type);
  assert.ok(evs.includes('overtime'));
});

test('加时进球 → 直接结束判胜', () => {
  const r = createSim({ seed: 15 });
  r.phase = 'overtime';
  r.ball.x = ARENA.HX - 0.3; r.ball.z = 0; r.ball.vx = 60; r.ball.vz = 0; r.ball.y = 0;
  updateSim(r, NONE);
  assert.equal(r.phase, 'goalReplay');
  assert.equal(r.goalInOT, true);
  stepN(r, Math.round(MATCH.REPLAY_T * 60) + 2);
  assert.equal(r.phase, 'end');
  assert.equal(r.result, 'win');
});

test('撞车：boost 满速撞对手 → 对手翻车', () => {
  const r = createSim({ seed: 16 });
  r.phase = 'play';
  r.player.x = 0; r.player.z = 0; r.player.heading = 0; r.player.speed = 28; r.player.boostOn = true; r.player.boostMeter = 1;
  r.opponents[0].x = 3; r.opponents[0].z = 0; r.opponents[0].speed = 0; r.opponents[0].boostOn = false;
  stepN(r, 1, { throttle: 0, steer: 0, jump: false, boost: true });
  assert.equal(r.opponents[0].demoed, true, '对手应翻车');
});

test('墙体约束：车不能开出球场', () => {
  const r = createSim({ seed: 17 });
  r.phase = 'play';
  r.player.heading = 0; r.player.speed = 40;
  stepN(r, 300, { throttle: 1, steer: 0, jump: false, boost: false });
  assert.ok(r.player.x <= ARENA.HX - CAR.R + 1e-6);
  assert.ok(r.player.x >= -ARENA.HX + CAR.R - 1e-6);
});

test('第 2 关有拾取点，拾取回充 boost', () => {
  const r = createSim({ seed: 18, level: 2 });
  assert.equal(r.pickups.length, PICKUP.SPOTS.length);
  r.phase = 'play';
  r.player.x = PICKUP.SPOTS[0][0]; r.player.z = PICKUP.SPOTS[0][1];
  r.player.boostMeter = 0.1;
  const before = r.player.boostMeter;
  stepN(r, 1);
  assert.ok(r.player.boostMeter > before, '应回充');
  assert.ok(r.stats.pickups >= 1);
});

test('第 1 关无拾取点', () => {
  const r = createSim({ seed: 19, level: 1 });
  assert.equal(r.pickups.length, 0);
});

test('seed 回归：同种子两步结果一致', () => {
  const a = createSim({ seed: 42 });
  const b = createSim({ seed: 42 });
  a.phase = 'play'; b.phase = 'play';
  const input = { throttle: 1, steer: 0.4, jump: false, boost: true };
  stepN(a, 120, input);
  stepN(b, 120, input);
  assert.equal(a.player.x, b.player.x);
  assert.equal(a.player.z, b.player.z);
  assert.equal(a.ball.x, b.ball.x);
  assert.equal(a.ball.z, b.ball.z);
});

test('等级上限：level 超界被夹到 5', () => {
  const r = createSim({ seed: 20, level: 99 });
  assert.equal(r.level, 5);
});

test('ratingFor 边界：S/A/B/C', () => {
  assert.equal(ratingFor(99999), 'S');
  assert.equal(ratingFor(2200), 'S');
  assert.equal(ratingFor(1500), 'A');
  assert.equal(ratingFor(900), 'B');
  assert.equal(ratingFor(0), 'C');
});

test('getHud 暴露关键字段', () => {
  const r = createSim({ seed: 21 });
  const h = getHud(r);
  assert.equal(h.scoreP, 0);
  assert.equal(h.level, 1);
  assert.equal(typeof h.boost, 'number');
  assert.equal(h.phase, 'kickoff');
});
