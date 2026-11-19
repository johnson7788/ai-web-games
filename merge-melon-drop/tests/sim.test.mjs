import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, STEP, computeStars } from '../src/game/sim.js';
import { WORLD, TIERS, MAX_TIER, ROCK, SEQUENCE_FIXED } from '../config/game.config.js';

let BODY_ID = 100000;
function body(tier, x, y, kind = 'fruit') {
  const r = kind === 'rock' ? ROCK.RADIUS : TIERS[tier].r;
  return {
    id: BODY_ID++,
    kind, tier, x, y, vx: 0, vy: 0, r,
    touched: true, overLineT: 0, warned: false, mergeCd: 0, landPlayed: true,
  };
}

function stepN(run, n = 1) {
  for (let i = 0; i < n; i += 1) run.step(STEP);
}

test('PRNG：同 seed 完全可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 10; i += 1) assert.equal(a(), b());
});

test('落球队列：前 6 球固定 [0,0,1,2,2,3]', () => {
  const run = createRun({ seed: 7 });
  assert.deepEqual(run._queue.slice(0, 6), SEQUENCE_FIXED);
});

test('落球队列：第 8 球（索引 7）是岩石', () => {
  const run = createRun({ seed: 7 });
  assert.equal(run._queue[7], -1);
});

test('初始持球为 0，下一球预览为 0', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.heldTier, 0);
  assert.equal(run.state.nextTier, 0);
  assert.equal(run.state.phase, 'playing');
});

test('落球：drop 后生成球体并推进队列', () => {
  const run = createRun({ seed: 1 });
  run.setAim((WORLD.WALL_L + WORLD.WALL_R) / 2);
  const r = run.drop();
  assert.equal(r.ok, true);
  assert.equal(run.state.bodies.length, 1);
  assert.equal(run.state.bodies[0].tier, 0);
  assert.equal(run.state.dropCount, 1);
  assert.equal(run.state.heldTier, 0);
  assert.equal(run.state.nextTier, 0); // 队列 [0,0,1,2,2,3]：首球后仍持 0，下一球仍 0
});

test('同阶合成：两个 0 阶 → 1 阶，+1 分', () => {
  const run = createRun({ seed: 1 });
  run.state.bodies = [
    body(0, WORLD.WALL_L + 40, WORLD.FLOOR_Y - 20),
    body(0, WORLD.WALL_L + 50, WORLD.FLOOR_Y - 20),
  ];
  stepN(run, 1);
  assert.equal(run.state.merges, 1);
  assert.equal(run.state.score, 1);
  assert.equal(run.state.maxTier, 1);
  assert.equal(run.state.bodies.length, 1);
  assert.equal(run.state.bodies[0].tier, 1);
});

test('9+9 合成星爆瓜：+10 基础 +50 奖励，事件 watermelon', () => {
  const run = createRun({ seed: 1 });
  run.state.bodies = [
    body(9, WORLD.WALL_L + 100, WORLD.FLOOR_Y - 120),
    body(9, WORLD.WALL_L + 130, WORLD.FLOOR_Y - 120),
  ];
  stepN(run, 1);
  assert.equal(run.state.maxTier, MAX_TIER);
  assert.equal(run.state.score, 60);
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'watermelon'));
});

test('两个星爆瓜不再合成', () => {
  const run = createRun({ seed: 1 });
  run.state.bodies = [
    body(MAX_TIER, WORLD.WALL_L + 140, WORLD.FLOOR_Y - 150),
    body(MAX_TIER, WORLD.WALL_L + 160, WORLD.FLOOR_Y - 150),
  ];
  stepN(run, 3);
  assert.equal(run.state.merges, 0);
  assert.equal(run.state.bodies.length, 2);
});

test('岩石不与水果合成', () => {
  const run = createRun({ seed: 1 });
  run.state.bodies = [
    body(0, WORLD.WALL_L + 40, WORLD.FLOOR_Y - 30),
    body(-1, WORLD.WALL_L + 50, WORLD.FLOOR_Y - 30, 'rock'),
  ];
  stepN(run, 3);
  assert.equal(run.state.merges, 0);
  assert.equal(run.state.bodies.length, 2);
});

test('岩石被 ≥2 阶水果砸落压碎，+5 分', () => {
  const run = createRun({ seed: 1 });
  const rock = body(-1, WORLD.WALL_L + 200, WORLD.FLOOR_Y - 60, 'rock');
  const fruit = body(2, WORLD.WALL_L + 200, WORLD.FLOOR_Y - 120);
  fruit.vy = 600;
  rock.touched = false;
  run.state.bodies = [rock, fruit];
  stepN(run, 1);
  assert.equal(run.state.bodies.filter((b) => b.kind === 'rock').length, 0);
  assert.equal(run.state.score, ROCK.SCORE);
  assert.ok(run.drainEvents().some((e) => e.type === 'rock_crush'));
});

test('岩石不被 0 阶水果压碎', () => {
  const run = createRun({ seed: 1 });
  const rock = body(-1, WORLD.WALL_L + 200, WORLD.FLOOR_Y - 60, 'rock');
  const fruit = body(0, WORLD.WALL_L + 200, WORLD.FLOOR_Y - 100);
  fruit.vy = 600;
  run.state.bodies = [rock, fruit];
  stepN(run, 1);
  assert.equal(run.state.bodies.filter((b) => b.kind === 'rock').length, 1);
});

test('连击：1.5s 内两次合成 → combo=2 且额外加分', () => {
  const run = createRun({ seed: 1 });
  run.state.bodies = [
    body(0, WORLD.WALL_L + 40, WORLD.FLOOR_Y - 20),
    body(0, WORLD.WALL_L + 50, WORLD.FLOOR_Y - 20),
  ];
  stepN(run, 1);
  assert.equal(run.state.combo, 1);
  assert.equal(run.state.score, 1);
  // 第二对（同帧内），仍处在连击窗口
  run.state.bodies.push(
    body(0, WORLD.WALL_L + 300, WORLD.FLOOR_Y - 20),
    body(0, WORLD.WALL_L + 310, WORLD.FLOOR_Y - 20),
  );
  stepN(run, 1);
  assert.equal(run.state.combo, 2);
  // 第一次 +1，第二次 +1 基础 +1 连击奖励 = 3
  assert.equal(run.state.score, 3);
});

test('星级：按最高阶/分数结算', () => {
  assert.equal(computeStars(0, -1), 0);
  assert.equal(computeStars(10, 0), 0);
  assert.equal(computeStars(40, 0), 1);
  assert.equal(computeStars(10, 1), 1);
  assert.equal(computeStars(200, 3), 2);
  assert.equal(computeStars(0, 5), 2);
  assert.equal(computeStars(600, 4), 3);
  assert.equal(computeStars(0, 8), 3);
});

test('推进里程碑：合成到 3 阶 → level 2，5 阶 → level 3', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.levelsReached, 1);
  run.state.bodies = [body(2, WORLD.WALL_L + 60, WORLD.FLOOR_Y - 30), body(2, WORLD.WALL_L + 80, WORLD.FLOOR_Y - 30)];
  stepN(run, 1);
  assert.equal(run.state.levelsReached, 2); // 合成出 3 阶
  run.state.bodies = [body(4, WORLD.WALL_L + 60, WORLD.FLOOR_Y - 40), body(4, WORLD.WALL_L + 80, WORLD.FLOOR_Y - 40)];
  stepN(run, 1);
  assert.equal(run.state.levelsReached, 3); // 合成出 5 阶
});

test('越线判负：球顶越过警示线停留 3s 触发 gameover', () => {
  const run = createRun({ seed: 1 });
  const b = body(0, WORLD.WALL_L + 60, WORLD.DASH_Y - 100); // 顶部 y-r 远低于 DASH_Y
  b.touched = true;
  b.overLineT = 2.99; // 已快满 3s，下一步越过
  run.state.bodies = [b];
  stepN(run, 1);
  assert.equal(run.state.phase, 'over');
  assert.ok(run.drainEvents().some((e) => e.type === 'gameover'));
});

test('墙壁夹持：落球不越出容器左右壁', () => {
  const run = createRun({ seed: 1 });
  run.state.bodies = [body(5, WORLD.WALL_L + 5, WORLD.FLOOR_Y - 80)];
  stepN(run, 10);
  for (const b of run.state.bodies) {
    assert.ok(b.x - b.r >= WORLD.WALL_L - 0.001, '左壁越界');
    assert.ok(b.x + b.r <= WORLD.WALL_R + 0.001, '右壁越界');
  }
});

test('setAim 夹持范围随持球半径变化', () => {
  const run = createRun({ seed: 1 });
  run.setAim(-99999);
  assert.equal(run.state.heldX, WORLD.WALL_L + TIERS[0].r);
  run.setAim(99999);
  assert.equal(run.state.heldX, WORLD.WALL_R - TIERS[0].r);
});

test('drainEvents 消费后清空', () => {
  const run = createRun({ seed: 1 });
  run.drop();
  const first = run.drainEvents();
  assert.ok(first.length > 0);
  assert.equal(run.drainEvents().length, 0);
});

test('step 在 gameover 后不再推进', () => {
  const run = createRun({ seed: 1 });
  const b = body(0, WORLD.WALL_L + 60, WORLD.DASH_Y - 100);
  b.touched = true;
  b.overLineT = 2.99;
  run.state.bodies = [b];
  stepN(run, 1);
  assert.equal(run.state.phase, 'over');
  const t = run.state.time;
  stepN(run, 10);
  assert.equal(run.state.time, t);
});
