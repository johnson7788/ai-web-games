// tests/sim.test.mjs — OCEAN DASH 纯逻辑测试（node --test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, gapAhead } from '../src/game/sim.js';
import { generateCourse } from '../src/game/spawner.js';
import { mulberry32 } from '../src/game/rng.js';
import { WORLD, PLAYER, BUBBLE, CURRENT, SCHOOL, speedMult, schoolHeight } from '../config/gameplay.js';
import { segmentAt } from '../config/levels.js';

const noinput = { steerY: null, gather: false, jump: false, glide: false };

test('createRun：开局 playing，鱼群数正确', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.fish, PLAYER.START_FISH);
  assert.equal(r.segment, 1);
});

test('自动前进：step 推进 dist', () => {
  const r = createRun({ seed: 1 });
  const d0 = r.dist;
  for (let i = 0; i < 10; i += 1) r.step(noinput);
  assert.ok(r.dist > d0);
});

test('转向：目标 y 下方，玩家 y 向下靠近', () => {
  const r = createRun({ seed: 1 });
  const y0 = r.player.y;
  for (let i = 0; i < 60; i += 1) r.step({ steerY: 600, gather: false, jump: false, glide: false });
  assert.ok(r.player.y > y0, 'y 应增加（向下）');
  assert.ok(r.player.y <= WORLD.WATER_MAX);
});

test('转向：目标 y 上方，玩家 y 向上靠近', () => {
  const r = createRun({ seed: 1 });
  const y0 = r.player.y;
  for (let i = 0; i < 60; i += 1) r.step({ steerY: 200, gather: false, jump: false, glide: false });
  assert.ok(r.player.y < y0, 'y 应减少（向上）');
  assert.ok(r.player.y >= WORLD.WATER_MIN);
});

test('收拢：gather 切换并发 gatherStart/gatherEnd 事件', () => {
  const r = createRun({ seed: 1 });
  r.step({ ...noinput, gather: true });
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'gatherStart'));
  assert.equal(r.gathered, true);
  r.step({ ...noinput, gather: false });
  const evs2 = r.drainEvents();
  assert.ok(evs2.some((e) => e.type === 'gatherEnd'));
});

test('收拢减速：gather 前进更慢', () => {
  const r1 = createRun({ seed: 5 });
  const r2 = createRun({ seed: 5 });
  for (let i = 0; i < 60; i += 1) r1.step({ ...noinput, gather: true });
  for (let i = 0; i < 60; i += 1) r2.step({ ...noinput, gather: false });
  assert.ok(r1.dist < r2.dist, '收拢应更慢');
});

test('跳跃：jump 触发 jump 事件并进入 air', () => {
  const r = createRun({ seed: 1 });
  r.step({ ...noinput, jump: true });
  const evs = r.drainEvents();
  assert.ok(evs.some((e) => e.type === 'jump'));
  assert.equal(r.mode, 'air');
});

test('滑翔：jump + 高出水面 + glide 保持 → 进入 glide', () => {
  const r = createRun({ seed: 1 });
  r.player.y = 210; // 贴近水面起跳
  r.step({ ...noinput, jump: true });
  for (let i = 0; i < 90 && r.mode !== 'glide'; i += 1) {
    r.step({ ...noinput, jump: false, glide: true });
  }
  assert.equal(r.mode, 'glide');
});

test('气泡：吃泡回鱼 + boost', () => {
  const r = createRun({ seed: 1 });
  r.bubbles = [{ id: 1, x: r.dist + 20, y: r.player.y, r: BUBBLE.R }];
  const fish0 = r.fish;
  r.step(noinput);
  assert.ok(r.fish > fish0 || r.stats.bubblesEaten > 0);
  assert.ok(r.boostT > 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'bubbleGain'));
});

test('洋流：穿过洋流带触发 currentBoost', () => {
  const r = createRun({ seed: 1 });
  r.currents = [{ id: 1, x: r.dist + 30, y: WORLD.SURFACE_Y, h: 100, w: CURRENT.W, used: false }];
  r.step(noinput);
  assert.ok(r.boostT > 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'currentBoost'));
});

test('障碍碰撞：掉鱼 + 减速 + 无敌', () => {
  const r = createRun({ seed: 1 });
  const fish0 = r.fish;
  r.obstacles = [{ id: 1, x: r.dist + 4, y: r.player.y - 10, w: 80, h: 40, kind: 'reef' }];
  r.step(noinput);
  assert.ok(r.fish < fish0, '碰撞应掉鱼');
  assert.ok(r.slowT > 0);
  assert.ok(r.drainEvents().some((e) => e.type === 'obstacleHit'));
});

test('死亡：鱼群归零 → dead', () => {
  const r = createRun({ seed: 1 });
  r.fish = 1;
  r.obstacles = [{ id: 1, x: r.dist + 4, y: r.player.y - 10, w: 80, h: 40, kind: 'reef' }];
  r.step(noinput);
  assert.equal(r.phase, 'dead');
});

test('gapAhead：找最宽空档', () => {
  const obstacles = [
    { x: 100, y: 168, w: 100, h: 200 }, // 上垂根占 168..368
    { x: 100, y: 500, w: 100, h: 160 }, // 礁石占 500..660
  ];
  const gap = gapAhead(obstacles, 0, 200);
  assert.equal(gap.y, (368 + 500) / 2);
  assert.equal(gap.h, 500 - 368);
});

test('赛段推进：冲线且名次 ≤2 进入下一段', () => {
  const r = createRun({ seed: 1 });
  r.dist = segmentAt(1).length - 2;
  // AI 都在后面
  for (const ai of r.ai) ai.dist = 0;
  r.step(noinput);
  assert.ok(r.drainEvents().some((e) => e.type === 'segmentClear'));
  assert.equal(r.segment, 2);
});

test('赛段失败：名次 >2 → failed', () => {
  const r = createRun({ seed: 1 });
  r.dist = segmentAt(1).length - 2;
  for (let i = 0; i < 3; i += 1) { r.ai[i].dist = segmentAt(1).length; r.ai[i].finished = true; }
  r.step(noinput);
  assert.equal(r.phase, 'failed');
});

test('里程碑：前进产生 milestone 事件', () => {
  const r = createRun({ seed: 1 });
  const evs = [];
  for (let i = 0; i < 200; i += 1) { r.step(noinput); evs.push(...r.drainEvents()); }
  assert.ok(evs.some((e) => e.type === 'milestone'));
});

test('逆流区：进入 counter 后速度倍率下降', () => {
  const r = createRun({ seed: 1 });
  r.counterZones = [{ x: 0, w: 10000 }];
  r.step(noinput);
  assert.equal(r.counter, true);
  assert.equal(speedMult({ gathered: false, boostT: 0, boostMult: 1, slowT: 0, counter: true, gliding: false }), 0.7);
});

test('schoolHeight：散开比收拢高', () => {
  assert.ok(schoolHeight(8, false) > schoolHeight(8, true));
});

test('speedMult：收拢慢于散开', () => {
  assert.ok(speedMult({ gathered: true, boostT: 0, boostMult: 1, slowT: 0, counter: false, gliding: false })
    < speedMult({ gathered: false, boostT: 0, boostMult: 1, slowT: 0, counter: false, gliding: false }));
});

test('rng 确定性：同 seed 同序列', () => {
  const a = mulberry32(99);
  const b = mulberry32(99);
  for (let i = 0; i < 5; i += 1) assert.equal(a(), b());
});

test('地图生成：12 段都能生成且有障碍', () => {
  for (let i = 1; i <= 12; i += 1) {
    const c = generateCourse(i, mulberry32(i));
    assert.ok(c.obstacles.length > 0, `段 ${i} 应有障碍`);
  }
});
