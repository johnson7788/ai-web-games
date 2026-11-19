import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, predictBattle } from '../src/game/sim.js';
import { GAME } from '../config/game.config.js';

function mkMonster(over = {}) {
  return {
    kind: 'monster', tier: 'normal', name: { en: 'Test', zh: '测试' },
    maxHp: 10, hp: 10, atk: 5, def: 0, exp: 5, gold: 3, miss: 0,
    ...over,
  };
}

test('createRun：0 层基地 + 初始 200/15/10', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.state.floor, 0);
  assert.equal(run.state.player.hp, 200);
  assert.equal(run.state.player.attack, 15);
  assert.equal(run.state.player.defence, 10);
  assert.equal(run.state.player.nextExp, 9);
});

test('predictBattle：弱怪安全，强怪不安全', () => {
  const p = { attack: 15, defence: 10, hp: 200 };
  assert.equal(predictBattle(p, 0, { hp: 10, atk: 5, def: 0 }).safe, true);
  assert.equal(predictBattle(p, 0, { hp: 99999, atk: 50, def: 0 }).safe, false);
  assert.equal(predictBattle(p, 0, { hp: 10, atk: 5, def: 99 }).safe, false); // 打不动
});

test('移动：stepPath 从出生点走到相邻地板', () => {
  const run = createRun({ seed: 1 });
  const start = { ...run.state.pos };
  run.pathTo(3, 4);
  const res = run.stepPath();
  assert.equal(res.moved, true);
  assert.notDeepEqual(run.state.pos, start);
});

test('拾取红晶：攻击 +10', () => {
  const run = createRun({ seed: 1 });
  const before = run.state.player.attack;
  run.state.entities['3,4'] = { kind: 'item', id: 'gem_atk' };
  run.pathTo(3, 4);
  run.stepPath();
  assert.equal(run.state.player.attack, before + GAME.GEM_ATK);
});

test('击杀怪物：得经验与金币并移除实体', () => {
  const run = createRun({ seed: 1 });
  const expBefore = run.state.player.exp;
  const coinsBefore = run.state.bag.coins;
  run.state.entities['3,4'] = mkMonster();
  const res = run.fightMonster(3, 4);
  assert.equal(res.won, true);
  assert.equal(run.state.player.exp, expBefore + 5);
  assert.equal(run.state.bag.coins, coinsBefore + 3);
  assert.equal(run.state.entities['3,4'], undefined);
  assert.equal(run.state.kills, 1);
});

test('升级：经验足够则升到 2 级并回满血', () => {
  const run = createRun({ seed: 1 });
  run.state.player.hp = 10;
  run.state.entities['3,4'] = mkMonster({ exp: 9 });
  run.fightMonster(3, 4);
  assert.equal(run.state.player.level, 2);
  assert.equal(run.state.player.hp, run.state.player.maxHp);
  assert.ok(run.state.player.maxHp > 200);
});

test('药水：小血瓶回 25% 最大生命', () => {
  const run = createRun({ seed: 1 });
  run.state.bag.items.potion_small = 1;
  run.state.player.hp = 100;
  const res = run.usePotion('potion_small');
  assert.equal(res.ok, true);
  assert.equal(run.state.player.hp, 150);
});

test('开门：无钥匙上锁，有钥匙打开', () => {
  const run = createRun({ seed: 1 });
  run.state.entities['3,4'] = { kind: 'door', color: 'yellow' };
  assert.equal(run.openDoor(3, 4).ok, false);
  run.state.bag.items.key_yellow = 1;
  assert.equal(run.openDoor(3, 4).ok, true);
  assert.equal(run.state.entities['3,4'], undefined);
});

test('推石头：推进空地', () => {
  const run = createRun({ seed: 1 });
  run.state.entities['3,4'] = { kind: 'rock' };
  const res = run.pushRock(3, 4);
  assert.equal(res.ok, true);
  assert.equal(run.state.entities['3,5'].kind, 'rock');
  assert.equal(run.state.entities['3,4'], undefined);
});

test('推石头进坑：石头消失、坑填平', () => {
  const run = createRun({ seed: 1 });
  run.state.grid[3][5] = 'pit';
  run.state.entities['3,4'] = { kind: 'rock' };
  const res = run.pushRock(3, 4);
  assert.equal(res.ok, true);
  assert.equal(run.state.grid[3][5], 'floor');
  assert.equal(run.state.entities['3,4'], undefined);
});

test('tapCell：怪物返回 fight 动作，墙返回失败', () => {
  const run = createRun({ seed: 1 });
  run.state.entities['3,4'] = mkMonster();
  assert.equal(run.tapCell(3, 4).action, 'fight');
  assert.equal(run.tapCell(0, 0).ok, false);
});

test('商店购买：扣金币入背包', () => {
  const run = createRun({ seed: 1 });
  run.state.bag.coins = 100;
  const res = run.buy(0);
  assert.equal(res.ok, true);
  assert.equal(run.state.bag.coins, 50);
  assert.equal(run.state.bag.items.potion_small, 1);
});

test('强化剑：攻击 +3 且金币扣减', () => {
  const run = createRun({ seed: 1 });
  run.state.bag.coins = 100;
  const atk = run.state.player.attack;
  const res = run.enhance('sword');
  assert.equal(res.ok, true);
  assert.equal(run.state.player.attack, atk + GAME.ENHANCE_ATT);
  assert.equal(run.state.player.sword.enhance, 1);
  assert.equal(run.state.bag.coins, 70);
});

test('HUD：返回楼层/钥匙/连击快照', () => {
  const run = createRun({ seed: 1 });
  run.state.bag.items.key_yellow = 2;
  run.state.combo = 3;
  const h = run.getHud();
  assert.equal(h.floor, 0);
  assert.equal(h.keys.yellow, 2);
  assert.equal(h.combo, 3);
});

test('任务：接任务后击杀 5 只可得复活核', () => {
  const run = createRun({ seed: 1 });
  const r1 = run.interactNpc('quest');
  assert.equal(r1.text, 'questGive');
  run.state.kills = 5;
  const r2 = run.interactNpc('quest');
  assert.equal(r2.text, 'questDone');
  assert.equal(run.state.bag.items.cross, 3); // 初始 2 + 奖励 1
});

test('死亡：无复活核时进入 lost 并计死亡', () => {
  const run = createRun({ seed: 1 });
  run.state.bag.items.cross = 0;
  run.state.entities['3,4'] = mkMonster({ atk: 99999, hp: 99999, def: 0 });
  run.fightMonster(3, 4);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.deaths, 1);
});
