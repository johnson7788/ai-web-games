// CORGI DASH · 纯逻辑测试（node --test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WORLD, PLAYER, SPEED, WHISTLE, STEP, speedAt, scoreMult, sheepLossFor } from '../config/gameplay.js';
import { segmentAt, SEGMENT_COUNT } from '../config/segments.js';
import { mulberry32 } from '../src/game/rng.js';

function fence(run, worldX, opts = {}) {
  const o = { id: run.nextId++, kind: 'fence', x: worldX, y: WORLD.GROUND_Y - 72, w: 50, h: 72, passed: false, cleared: false, ...opts };
  run.obstacles.push(o);
  return o;
}

function drainTypes(run) {
  return run.drainEvents().map((e) => e.type);
}

function steps(run, n, input, each) {
  for (let i = 0; i < n; i += 1) {
    run.step(input);
    if (each) each(run);
  }
}

test('createRun：开局 playing，距离 0，第 1 段', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.distance, 0);
  assert.equal(r.segment, 1);
  assert.equal(typeof r.step, 'function');
  assert.equal(typeof r.getHud, 'function');
});

test('自动横跑：无输入距离持续增长', () => {
  const r = createRun({ seed: 2 });
  const d0 = r.distance;
  steps(r, 30);
  assert.ok(r.distance > d0 + 1, '30 步后距离应增长');
});

test('跳跃：jumpPressed 触发 jump 事件并离地', () => {
  const r = createRun({ seed: 3 });
  r.step({ jumpPressed: true, jump: true });
  assert.ok(r.player.vy < 0, '起跳 vy 为负');
  assert.ok(r.player.airborne, '应离开地面');
  assert.ok(drainTypes(r).includes('jump'));
});

test('落地：跳起后多步会落回地面', () => {
  const r = createRun({ seed: 4 });
  r.step({ jumpPressed: true, jump: true });
  steps(r, 120, { jump: false });
  assert.ok(r.player.onGround, '应回到地面');
  assert.equal(r.player.y, WORLD.GROUND_Y - PLAYER.H);
});

test('二段跳：空中可再跳一次', () => {
  const r = createRun({ seed: 5 });
  r.step({ jumpPressed: true, jump: true });
  steps(r, 8, { jump: false });
  const vy1 = r.player.vy;
  r.step({ jumpPressed: true, jump: true });
  assert.ok(r.player.vy < 0, '二段跳后 vy 应再次为负');
  assert.ok(r.player.airborne);
});

test('长按变高：按住跳比点按跳得更高', () => {
  const apexAfter = (hold) => {
    const r = createRun({ seed: 6 });
    r.step({ jumpPressed: true, jump: hold });
    let apex = 0;
    for (let i = 0; i < 120; i += 1) {
      r.step({ jump: hold });
      apex = Math.max(apex, WORLD.GROUND_Y - PLAYER.H - r.player.y);
    }
    return apex;
  };
  const tapApex = apexAfter(false);
  const holdApex = apexAfter(true);
  assert.ok(holdApex > tapApex, `长按 ${holdApex.toFixed(1)} 应高于点按 ${tapApex.toFixed(1)}`);
});

test('障碍碰撞判负：无羊时撞栅栏死亡', () => {
  const r = createRun({ seed: 7 });
  fence(r, r.scrollX + WORLD.PLAYER_X - 10);
  r.step({});
  assert.equal(r.phase, 'dead');
  assert.ok(drainTypes(r).includes('death'));
});

test('有羊撞障碍：损失羊而非死亡', () => {
  const r = createRun({ seed: 8 });
  r.flock = 4;
  fence(r, r.scrollX + WORLD.PLAYER_X - 10);
  r.step({});
  assert.equal(r.phase, 'playing');
  assert.ok(r.flock < 4);
  assert.ok(drainTypes(r).includes('sheepLose'));
});

test('口哨散开：撞障碍不死羊', () => {
  const r = createRun({ seed: 9 });
  r.flock = 4;
  r.scattered = 1.0;
  fence(r, r.scrollX + WORLD.PLAYER_X - 10);
  r.step({});
  assert.equal(r.phase, 'playing');
  assert.equal(r.flock, 4);
  assert.ok(drainTypes(r).includes('sheepScatter'));
});

test('拾取羊：跑过羊群 flock+1 且发 sheepGain', () => {
  const r = createRun({ seed: 10 });
  r.pickups.push({ id: r.nextId++, kind: 'sheep', x: r.scrollX + WORLD.PLAYER_X, y: WORLD.GROUND_Y - 38, w: 34, h: 34, taken: false });
  r.step({});
  assert.equal(r.flock, 1);
  assert.ok(drainTypes(r).includes('sheepGain'));
});

test('分数倍率随羊群增长', () => {
  assert.equal(scoreMult(0), 1);
  assert.ok(scoreMult(10) > scoreMult(1));
});

test('撞障碍损失羊数：至少 1，最多一半向上取整', () => {
  assert.equal(sheepLossFor(0), 0);
  assert.equal(sheepLossFor(1), 1);
  assert.equal(sheepLossFor(4), 2);
  assert.equal(sheepLossFor(5), 3);
});

test('速度渐增并封顶', () => {
  assert.ok(speedAt(100) > speedAt(0));
  assert.equal(speedAt(100000), SPEED.MAX);
});

test('12 段推进结构 + segmentAt 边界', () => {
  assert.equal(SEGMENT_COUNT, 12);
  assert.equal(segmentAt(0), 1);
  assert.equal(segmentAt(400), 2);
  assert.equal(segmentAt(4799), 12);
});

test('段推进：跨过段终点发 segmentEnter', () => {
  const r = createRun({ seed: 11 });
  r.scrollX = 400 * WORLD.PX_PER_METER - 1;
  r.distance = r.scrollX / WORLD.PX_PER_METER;
  r.step({});
  assert.equal(r.segment, 2);
  assert.ok(drainTypes(r).includes('segmentEnter'));
});

test('口哨冷却 8s：冷却期内不能连续吹', () => {
  const r = createRun({ seed: 12 });
  r.step({ whistle: true });
  assert.equal(r.whistleCd, WHISTLE.COOLDOWN);
  assert.ok(drainTypes(r).includes('whistle'));
  // 冷却中再吹无效
  r.step({ whistle: true });
  assert.ok(r.whistleCd < WHISTLE.COOLDOWN);
  assert.ok(!drainTypes(r).includes('whistle'));
});

test('口哨冷却结束发 whistleReady', () => {
  const r = createRun({ seed: 13 });
  r.flock = 999; // 给足羊群缓冲，隔离「口哨冷却」与「撞障碍死亡」两个关注点
  r.step({ whistle: true });
  drainTypes(r);
  steps(r, Math.ceil(WHISTLE.COOLDOWN / STEP) + 2);
  assert.equal(r.whistleCd, 0);
  assert.ok(drainTypes(r).includes('whistleReady'));
});

test('完美跳：擦顶 ≤10px 发 perfectLand', () => {
  const r = createRun({ seed: 14 });
  const p = r.player;
  p.onGround = false;
  p.airborne = true;
  p.vy = 0;
  p.y = (WORLD.GROUND_Y - 72) - PLAYER.H - 5; // 脚底比栅栏顶高 5px
  const o = fence(r, r.scrollX + (WORLD.PLAYER_X - PLAYER.W / 2) - 50 + 2);
  r.step({});
  const evs = drainTypes(r);
  assert.ok(evs.includes('perfectLand'), `应发 perfectLand，实际 ${JSON.stringify(evs)}`);
  assert.equal(r.perfectStreak, 1);
});

test('连续两次完美跳触发牧羊冲鸭 sheepSurge', () => {
  const r = createRun({ seed: 15 });
  r.flock = 3;
  for (let i = 0; i < 2; i += 1) {
    const p = r.player;
    p.onGround = false;
    p.airborne = true;
    p.vy = 0;
    p.y = (WORLD.GROUND_Y - 72) - PLAYER.H - 5;
    fence(r, r.scrollX + (WORLD.PLAYER_X - PLAYER.W / 2) - 50 + 2);
    r.step({});
  }
  assert.ok(drainTypes(r).includes('sheepSurge'));
});

test('非完美跳过会清空连击', () => {
  const r = createRun({ seed: 16 });
  r.perfectStreak = 3;
  const p = r.player;
  p.onGround = false;
  p.airborne = true;
  p.vy = 0;
  p.y = (WORLD.GROUND_Y - 72) - PLAYER.H - 60; // 太高，擦顶 >10px
  fence(r, r.scrollX + (WORLD.PLAYER_X - PLAYER.W / 2) - 50 + 2);
  r.step({});
  assert.equal(r.perfectStreak, 0);
});

test('事件 drain 后清空', () => {
  const r = createRun({ seed: 17 });
  r.step({ jumpPressed: true, jump: true });
  assert.ok(r.drainEvents().length > 0);
  assert.equal(r.drainEvents().length, 0);
});

test('羊群上限封顶', () => {
  const r = createRun({ seed: 18 });
  r.flock = 30;
  r.pickups.push({ id: r.nextId++, kind: 'sheep', x: r.scrollX + WORLD.PLAYER_X, y: WORLD.GROUND_Y - 38, w: 34, h: 34, taken: false });
  r.step({});
  assert.ok(r.flock <= 30);
});

test('确定性：同 seed 前 60 步距离一致', () => {
  const a = createRun({ seed: 99 });
  const b = createRun({ seed: 99 });
  steps(a, 60);
  steps(b, 60);
  assert.equal(a.distance, b.distance);
});

test('rng 确定性：mulberry32 同 seed 同序列', () => {
  const x = mulberry32(5);
  const y = mulberry32(5);
  assert.equal(x(), y());
  assert.equal(x(), y());
});
