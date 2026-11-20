import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { P } from '../config/gameplay.js';

function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

test('跳跃：按下跳 vy < 0 且离开地面', () => {
  const run = createRun({ seed: 1 });
  run.time = 0.3; // 避开鼓点
  run.step({ left: false, right: false, jump: true });
  assert.ok(run.player.vy < 0, 'vy 应为负（向上）');
  assert.equal(run.player.onGround, false, '应离开地面');
});

test('二段跳：空中再次跳 jumps === 2', () => {
  const run = createRun({ seed: 1 });
  run.time = 0.3;
  run.step({ left: false, right: false, jump: true });
  stepN(run, 12);
  run.step({ left: false, right: false, jump: true });
  assert.equal(run.player.jumps, 2, '应已二段跳');
  assert.ok(run.player.vy < 0, '二段跳应向上');
});

test('落地：跳起后最终落回地面', () => {
  const run = createRun({ seed: 1 });
  run.time = 0.3;
  run.step({ left: false, right: false, jump: true });
  stepN(run, 120);
  assert.equal(run.player.onGround, true, '应回到地面');
});

test('移动：向右输入 x 增加', () => {
  const run = createRun({ seed: 1 });
  const x0 = run.player.x;
  stepN(run, 12, { left: false, right: true, jump: false });
  assert.ok(run.player.x > x0, 'x 应增加');
});

test('边界：不能超出左边界', () => {
  const run = createRun({ seed: 1 });
  run.player.x = 0;
  stepN(run, 10, { left: true, right: false, jump: false });
  assert.ok(run.player.x >= 0, 'x 不能小于 0');
});

test('鼓点跳：节拍上起跳高度更高', () => {
  const onBeat = createRun({ seed: 1 });
  onBeat.time = 0.0; // 节拍起点
  onBeat.step({ left: false, right: false, jump: true });
  const offBeat = createRun({ seed: 1 });
  offBeat.time = 0.3;
  offBeat.step({ left: false, right: false, jump: true });
  assert.ok(onBeat.player.vy < offBeat.player.vy, '鼓点跳应更高（vy 更负）');
  assert.ok(onBeat.drainEvents().some((e) => e.type === 'beatJump'), '应发出 beatJump 事件');
});

test('收集金币：stats.coins 增加', () => {
  const run = createRun({ seed: 1 });
  const c = run.coins[0];
  run.player.x = c.x - run.player.w / 2;
  run.player.y = c.y - run.player.h / 2;
  const before = run.stats.coins;
  run.step({});
  assert.equal(run.stats.coins, before + 1, '金币数应 +1');
});

test('收集星星：levelStars 增加', () => {
  const run = createRun({ seed: 1 });
  const s = run.stars[0];
  run.player.x = s.x - run.player.w / 2;
  run.player.y = s.y - run.player.h / 2;
  run.step({});
  assert.ok(run.levelStars >= 1, '本关星星数应增加');
});

test('踩敌：从上方踩下敌人被击败并回弹', () => {
  const run = createRun({ seed: 1 });
  const e = run.enemies[0];
  run.player.x = e.x;
  run.player.y = e.y - run.player.h + 6; // 脚底已压入敌人头顶
  run.player.vy = 100;
  run.step({});
  assert.equal(run.enemies.length, 0, '敌人应被击败');
  assert.ok(run.player.vy < 0, '踩敌应回弹');
});

test('受伤：碰到敌人侧面扣血并计数死亡', () => {
  const run = createRun({ seed: 1 });
  run.player.hp = 1;
  run.player.invulnUntil = 0;
  const e = run.enemies[0];
  run.player.x = e.x + 10;
  run.player.y = 600 - run.player.h; // 与敌人同在地面
  run.step({});
  assert.ok(run.stats.deaths >= 1, '应计一次死亡');
  assert.equal(run.player.hp, P.HP, '重生后血量回满');
});

test('过关：到达旗帜进入下一关', () => {
  const run = createRun({ seed: 1 });
  run.player.x = run.level.goal.x - run.player.w;
  run.player.y = 500;
  run.step({});
  assert.equal(run.levelIndex, 2, '应进入第 2 关');
});

test('里程碑：前进 60px 发里程碑事件', () => {
  const run = createRun({ seed: 1 });
  run.player.x = 0;
  run._milestoneX = 0;
  stepN(run, 20, { left: false, right: true, jump: false });
  assert.ok(run.drainEvents().some((e) => e.type === 'milestone'), '应有里程碑事件');
});

test('敌人行为树：视野内追击、视野外巡逻', () => {
  const run = createRun({ seed: 1 });
  const e = run.enemies[0];
  run.player.x = e.x + 20; // 视野内
  run.step({});
  assert.equal(e.state, 'chase', '视野内应追击');
  run.player.x = e.x + 2000; // 视野外
  run.step({});
  assert.equal(e.state, 'patrol', '视野外应巡逻');
});

test('第 5 关存在实体墙（可蹬墙跳）', () => {
  const run = createRun({ seed: 1, level: 5 });
  assert.ok(run.level.platforms.some((s) => s.type === 'solid'), '第 5 关应有 solid 墙');
});

test('最终关通关后 phase 为 won', () => {
  const run = createRun({ seed: 1, level: 12 });
  run.player.x = run.level.goal.x - run.player.w;
  run.player.y = 500;
  run.step({});
  assert.equal(run.phase, 'won', '第 12 关通关应 won');
});
