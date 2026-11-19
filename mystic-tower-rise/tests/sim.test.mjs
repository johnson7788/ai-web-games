import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, simulateFight, parseFloor } from '../src/game/sim.js';
import { autoPlay } from '../src/game/bot.js';
import { MONSTERS, GAME } from '../config/maps.js';

test('战斗公式：英雄能打赢史莱姆', () => {
  const hero = { hp: 400, atk: 13, def: 10 };
  const r = simulateFight(hero, MONSTERS['1']);
  assert.equal(r.win, true);
  assert.ok(r.hpAfter > 0);
  assert.ok(r.dmg >= 0);
});

test('战斗公式：攻击低于防御则无法破防', () => {
  const hero = { hp: 400, atk: 3, def: 10 };
  const r = simulateFight(hero, MONSTERS['3']);
  assert.equal(r.win, false);
  assert.equal(r.cannot, true);
});

test('战斗公式：怪物攻击低于英雄防御 → 完美击杀', () => {
  const hero = { hp: 400, atk: 100, def: 100 };
  const r = simulateFight(hero, MONSTERS['1']);
  assert.equal(r.win, true);
  assert.equal(r.perfect, true);
  assert.equal(r.dmg, 0);
});

test('地图解析：第 1 层 11×11，含起始与上楼楼梯', () => {
  const f = parseFloor(['###########', '#P........#', '#.........#', '#.........#', '#.........#', '#....Y....#', '#.........#', '#.........#', '#.........#', '#........^#', '###########']);
  assert.equal(f.cols, 11);
  assert.equal(f.rows, 11);
  assert.equal(f.grid[1][1].start, true);
  assert.equal(f.grid[9][9].kind, 'stair');
  assert.equal(f.grid[9][9].dir, 'up');
});

test('拾取宝石提升攻击力', () => {
  const run = createRun({ seed: 1 });
  run.moveTo(4, 1); // 攻击宝石
  assert.equal(run.state.hero.atk, 13);
});

test('拾取黄钥匙', () => {
  const run = createRun({ seed: 1 });
  run.moveTo(6, 1);
  assert.equal(run.state.keys.yellow, 1);
});

test('开门消耗钥匙', () => {
  const run = createRun({ seed: 1 });
  run.moveTo(6, 1);
  run.moveTo(5, 5);
  assert.equal(run.state.keys.yellow, 0);
  assert.equal(run.state.floors[0].grid[5][5].kind, 'floor');
});

test('击杀怪物获得金币并移除怪物', () => {
  const run = createRun({ seed: 1 });
  run.moveTo(6, 1);
  run.moveTo(5, 5);
  run.moveTo(4, 6); // 史莱姆
  assert.equal(run.state.floors[0].grid[6][4].kind, 'floor');
  assert.ok(run.state.hero.gold > 0);
  assert.equal(run.state.kills, 1);
});

test('尖刺造成伤害', () => {
  const run = createRun({ seed: 1 });
  run.moveTo(3, 9);
  assert.equal(run.state.hero.hp, 400 - GAME.SPIKE_DAMAGE);
});

test('尖刺致死触发失败', () => {
  const run = createRun({ seed: 1 });
  run.state.hero.hp = 50;
  run.moveTo(3, 9);
  assert.equal(run.state.phase, 'dead');
});

test('楼梯切换楼层', () => {
  const run = createRun({ seed: 1 });
  run.state.keys.yellow = 1;
  run.moveTo(5, 5);
  run.moveTo(9, 9);
  assert.equal(run.state.floor, 2);
  assert.equal(run.state.pos.x, 1);
  assert.equal(run.state.pos.y, 1);
});

test('磁能镐破水晶提升攻防', () => {
  const run = createRun({ seed: 1 });
  run.state.floor = 4;
  run.state.pos = { x: 3, y: 4 };
  run.state.pick = 2;
  const atk = run.state.hero.atk;
  const def = run.state.hero.def;
  run.moveTo(4, 4);
  assert.equal(run.state.pick, 1);
  assert.equal(run.state.hero.atk, atk + GAME.CRYSTAL_BONUS_ATK);
  assert.equal(run.state.hero.def, def + GAME.CRYSTAL_BONUS_DEF);
});

test('传送星门成对互传', () => {
  const run = createRun({ seed: 1 });
  run.state.floor = 3;
  run.state.pos = { x: 1, y: 1 };
  run.moveTo(9, 1);
  assert.equal(run.state.pos.x, 1);
  assert.equal(run.state.pos.y, 9);
});

test('商店购买提升防御并扣钱', () => {
  const run = createRun({ seed: 1 });
  run.state.floor = 3;
  run.state.pos = { x: 1, y: 1 };
  run.state.hero.gold = 100;
  run.moveTo(4, 4);
  const def = run.state.hero.def;
  const res = run.buy('def');
  assert.equal(res.ok, true);
  assert.equal(run.state.hero.def, def + GAME.SHOP.def);
  assert.equal(run.state.hero.gold, 80);
});

test('贪心策略能通关（首领被击败）', () => {
  const run = createRun({ seed: 3 });
  const res = autoPlay(run, 3000);
  assert.equal(run.state.phase, 'won');
  assert.ok(res.steps > 0);
});
