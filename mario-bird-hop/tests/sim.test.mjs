import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT } from '../config/levels.js';
import { LAYOUT } from '../config/game.config.js';

const TILE = LAYOUT.TILE;

function placeOnGround(run, col) {
  run.state.player.x = col * TILE + (TILE - 30) / 2;
  run.state.player.y = 13 * TILE - 40;
  run.state.player.vx = 0;
  run.state.player.vy = 0;
  run.state.player.onGround = true;
}

test('关卡数量：至少 3 关，每关终点旗存在', () => {
  assert.ok(LEVEL_COUNT >= 3, '应至少 3 关');
  for (const lv of LEVELS) assert.ok(lv.flag, '每关都有终点旗');
});

test('起跳：第一帧按跳后 vy 向上', () => {
  const run = createRun(0);
  run.step({ left: false, right: false, jump: true });
  assert.ok(run.state.player.vy < 0, 'vy 应为负（向上）');
  assert.ok(!run.state.player.onGround, '应离开地面');
});

test('落地：连续推进后落回地面', () => {
  const run = createRun(0);
  run.step({ left: false, right: false, jump: true });
  for (let i = 0; i < 180; i += 1) run.step({ left: false, right: false, jump: false });
  assert.ok(run.state.player.onGround, '应回到地面');
});

test('移动：按右向右、按左向左', () => {
  const run = createRun(0);
  const x0 = run.state.player.x;
  for (let i = 0; i < 10; i += 1) run.step({ left: false, right: true, jump: false });
  assert.ok(run.state.player.x > x0, '向右应增加 x');
  const x1 = run.state.player.x;
  for (let i = 0; i < 10; i += 1) run.step({ left: true, right: false, jump: false });
  assert.ok(run.state.player.x < x1, '向左应减少 x');
});

test('顶箱子：从下方顶破箱子得金币', () => {
  const run = createRun(0);
  // L1 箱子在 [9,8]
  placeOnGround(run, 8);
  run.step({ left: false, right: false, jump: true });
  for (let i = 0; i < 40; i += 1) run.step({ left: false, right: false, jump: false });
  const box = run.state.boxes.find((b) => b.id === 'box-9-8');
  assert.ok(box && !box.alive, '箱子应被顶破');
  assert.ok(run.state.coinCount > 0, '应获得金币');
});

test('金币收集：走过金币增加分数与金币数', () => {
  const run = createRun(0);
  const coin = run.state.coins.find((c) => !c.taken);
  run.state.player.x = coin.x - 15;
  run.state.player.y = 13 * TILE - 40;
  run.step({});
  assert.ok(coin.taken, '金币应被收集');
  assert.equal(run.state.coinCount, 1);
  assert.equal(run.state.score, 10);
});

test('连击：连续收集金币触发连击', () => {
  const run = createRun(0);
  const [c1, c2] = run.state.coins;
  run.state.player.x = c1.x - 15;
  run.state.player.y = 13 * TILE - 40;
  run.step({});
  run.state.player.x = c2.x - 15;
  run.state.player.y = 13 * TILE - 40;
  run.step({});
  assert.ok(run.state.combo >= 2, '连续金币应触发连击');
});

test('掉坑：落出关卡判定失败', () => {
  const run = createRun(0);
  run.state.player.x = 22 * TILE; // L1 第 22 列是坑
  run.state.player.y = 12 * TILE;
  for (let i = 0; i < 90; i += 1) run.step({});
  assert.equal(run.state.phase, 'lost');
});

test('踩敌：从上方踩中怪物击杀并得分', () => {
  const run = createRun(0);
  const m = run.state.monsters.find((x) => x.alive);
  run.state.player.x = m.x;
  run.state.player.y = m.y - 40;
  run.state.player.vy = 200;
  run.step({});
  assert.ok(!m.alive, '怪物应被踩死');
  assert.ok(run.state.score >= 50, '踩敌应得分');
});

test('护盾：吸收一次致命伤害不死亡', () => {
  const run = createRun(1); // L2 有尖刺
  run.state.player.shield = true;
  // L2 尖刺在 [12,8]
  run.state.player.x = 8 * TILE + 4;
  run.state.player.y = 12 * TILE;
  run.step({});
  assert.equal(run.state.player.shield, false, '护盾应被消耗');
  assert.equal(run.state.phase, 'playing', '护盾吸收后仍存活');
});

test('尖刺：无护盾碰到尖刺死亡', () => {
  const run = createRun(1);
  run.state.player.x = 8 * TILE + 4;
  run.state.player.y = 12 * TILE;
  run.step({});
  assert.equal(run.state.phase, 'lost', '尖刺应致命');
});

test('过关：抵达终点旗胜利并结算星级', () => {
  const run = createRun(0);
  const f = run.state.flagRect;
  run.state.player.x = f.x + 4;
  run.state.player.y = 12 * TILE;
  run.step({});
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.starsEarned >= 1, '过关至少 1 星');
});
