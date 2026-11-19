import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, updateRun, mulberry32 } from '../src/game/sim.js';
import { WORLD, PLAYER } from '../config/game.config.js';

const INPUT = { left: false, right: false, jump: false };

function step(run, n = 1, input = {}) {
  for (let i = 0; i < n; i += 1) {
    run.input = { ...INPUT, ...input };
    run.step(1 / 60);
  }
}

test('起跳：按跳跃后 vy < 0 且离开地面', () => {
  const run = createRun(0);
  run.input = { left: false, right: false, jump: true };
  run.step(1 / 60);
  assert.ok(run.state.player.vy < 0, 'vy 应为负（向上）');
  assert.ok(!run.state.player.onGround, '应离开地面');
});

test('落地：跳起后多次更新会回到地面', () => {
  const run = createRun(0);
  step(run, 1, { jump: true });
  step(run, 70);
  assert.ok(run.state.player.onGround, '应回到地面');
  assert.equal(run.state.player.y, WORLD.GROUND_Y - PLAYER.H);
});

test('二段跳：空中可再跳一次（jumps 达到 2）', () => {
  const run = createRun(0);
  step(run, 1, { jump: true });
  step(run, 12);
  const before = run.state.player.jumps;
  step(run, 1, { jump: true });
  assert.equal(before, 1, '第一次跳后 jumps 应为 1');
  assert.equal(run.state.player.jumps, 2, '二段跳后 jumps 应为 2');
});

test('移动：按住右方向向右移动', () => {
  const run = createRun(0);
  const startX = run.state.player.x;
  step(run, 10, { right: true });
  assert.ok(run.state.player.x > startX, 'x 应增加');
});

test('边界：不能超出左边界', () => {
  const run = createRun(0);
  run.state.player.x = 0;
  step(run, 10, { left: true });
  assert.ok(run.state.player.x >= 0, 'x 不能小于 0');
});

test('岩块是实心：撞上会被阻挡（不被杀死）', () => {
  const run = createRun(0);
  // L1 第一个岩块在 x=700
  run.state.player.x = 700 - PLAYER.W - 2;
  step(run, 30, { right: true });
  assert.equal(run.state.phase, 'playing', '撞岩块不应死亡');
  assert.ok(run.state.player.x <= 700 - PLAYER.W + 1, '应被岩块左侧挡住');
});

test('尖刺致死：撞上激光栅即死', () => {
  const run = createRun(0);
  // 直接把人放到尖刺上
  run.state.player.x = 2050;
  run.state.player.y = WORLD.GROUND_Y - PLAYER.H;
  step(run, 1);
  assert.equal(run.state.phase, 'lost', '应死亡');
});

test('踩踏击杀：从上方落到机器人头上敌人死亡', () => {
  const run = createRun(0);
  // L1 敌人在 x=240 巡逻；把玩家放到其上方并下落
  const e = run.entities.enemies[0];
  run.state.player.x = e.x + 2;
  run.state.player.y = e.y - PLAYER.H - 20;
  run.state.player.vy = 300;
  run.state.player.onGround = false;
  step(run, 20);
  assert.ok(e.dead, '敌人应被踩死');
  assert.equal(run.state.phase, 'playing', '玩家不应死亡');
});

test('敌人侧碰致死：地面接触机器人即死', () => {
  const run = createRun(0);
  const e = run.entities.enemies[0];
  run.state.player.x = e.x - PLAYER.W - 2;
  run.state.player.y = WORLD.GROUND_Y - PLAYER.H;
  step(run, 30, { right: true });
  assert.equal(run.state.phase, 'lost', '应被机器人撞死');
});

test('收集星星：碰到奖励星 stars 增加并记分', () => {
  const run = createRun(0);
  const st = run.entities.stars[0];
  run.state.player.x = st.x - PLAYER.W / 2;
  run.state.player.y = st.y - PLAYER.H / 2;
  const before = run.state.stars;
  step(run, 2);
  assert.ok(run.state.stars > before, 'stars 应增加');
  assert.ok(run.state.score > 0, 'score 应增加');
});

test('胜利：到达终点旗进入 won 并结算星级', () => {
  const run = createRun(0);
  run.state.player.x = run.state.goalX - PLAYER.W - 2;
  step(run, 5, { right: true });
  assert.equal(run.state.phase, 'won', '应获胜');
  const ev = run.drainEvents().find((e) => e.type === 'win');
  assert.ok(ev, '应有 win 事件');
  assert.ok(ev.stars >= 1 && ev.stars <= 3, '星级应在 1~3');
});

test('加速垫：穿过获得无敌帧', () => {
  const run = createRun(2);
  const b = run.entities.boosters[0];
  run.state.player.x = b.x - PLAYER.W - 2;
  step(run, 10, { right: true });
  assert.ok(run.state.player.invT > 0, '应有无敌帧');
});

test('noinput：站着不动会被巡逻机器人击杀', () => {
  const run = createRun(0);
  step(run, 120);
  assert.equal(run.state.phase, 'lost', 'idle 玩家应被巡逻机器人击杀');
});

test('mulberry32：同 seed 序列确定', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b(), '同 seed 首值一致');
  assert.equal(a(), b(), '同 seed 次值一致');
});

test('事件流：drainEvents 一次性取走并清空', () => {
  const run = createRun(0);
  const first = run.drainEvents();
  assert.ok(first.length > 0, '首帧应有 start 事件');
  assert.equal(run.drainEvents().length, 0, '取走后应为空');
});
