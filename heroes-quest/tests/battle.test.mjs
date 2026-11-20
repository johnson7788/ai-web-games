import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { createBattle, tickBattle, applyAction, effAtk, effDef, pickEnemyTarget } from '../src/game/battle.js';
import { nodeById } from '../config/levels.js';

function battleRun(nodeId = 'n1a') {
  const run = createRun({ seed: 1 });
  run.heroes.forEach((h) => { h.row = h.rowPref; });
  run.mode = 'battle';
  run.battle = createBattle(run, nodeById(nodeId));
  return run;
}

function untilHeroTurn(run, max = 600) {
  let g = 0;
  while (!run.battle.waiting && g++ < max) {
    tickBattle(run.battle, run, 1 / 60);
    if (run.mode === 'defeat') break;
  }
  return run.battle.waiting;
}

test('createBattle：3 英雄 + 敌方单位数量正确', () => {
  const run = battleRun('n1a');
  const heroes = run.battle.units.filter((u) => u.side === 'hero');
  const enemies = run.battle.units.filter((u) => u.side === 'enemy');
  assert.equal(heroes.length, 3);
  assert.equal(enemies.length, 2); // n1a: grunt × 2
});

test('createBattle：章节难度缩放敌人血量', () => {
  const run1 = battleRun('n5a'); // chapter 2（col5），diff hp 1.35
  const e1 = run1.battle.units.find((u) => u.side === 'enemy');
  assert.ok(e1.hp > 60, '第二章 grunt 血量应被放大');
});

test('速度条：速度最快（ranger）先轮到', () => {
  const run = battleRun('n1a');
  assert.ok(untilHeroTurn(run));
  assert.equal(run.battle.pending, 'ranger');
});

test('阵位：后排承伤更少（effDef）', () => {
  const run = battleRun('n1a');
  const seer = run.heroes.find((h) => h.id === 'seer');
  seer.row = 2;
  assert.equal(Number(effDef(seer, run).toFixed(3)), Number((3 * 0.6).toFixed(3)));
});

test('阵位：中排输出更高（effAtk）', () => {
  const run = battleRun('n1a');
  const ranger = run.heroes.find((h) => h.id === 'ranger');
  ranger.row = 1;
  assert.equal(Number(effAtk(ranger, run).toFixed(3)), Number((16 * 1.1).toFixed(3)));
});

test('基本攻击：对敌人造成伤害', () => {
  const run = battleRun('n1a');
  assert.ok(untilHeroTurn(run));
  const target = run.battle.units.find((u) => u.side === 'enemy' && u.alive);
  const hp0 = target.hp;
  applyAction(run.battle, run, { skill: 'basic', target: target.id });
  assert.ok(target.hp < hp0, '敌人血量应下降');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'heroAttack'));
});

test('治疗技能：恢复友军生命', () => {
  const run = battleRun('n1a');
  const seer = run.heroes.find((h) => h.id === 'seer');
  seer.hp = 10;
  run.battle.pending = 'seer';
  run.battle.waiting = true;
  applyAction(run.battle, run, { skill: 'heal', target: 'seer' });
  assert.ok(seer.hp > 10, '治疗应恢复生命');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'heal'));
});

test('技能 CD：使用后进入冷却且冷却中不可用', () => {
  const run = battleRun('n1a');
  const ranger = run.heroes.find((h) => h.id === 'ranger');
  run.battle.pending = 'ranger';
  run.battle.waiting = true;
  applyAction(run.battle, run, { skill: 'volley' });
  assert.equal(ranger.skillCd.volley, 2);

  // 再次强制轮到他，但 volley 冷却中 → 被拒绝
  run.battle.pending = 'ranger';
  run.battle.waiting = true;
  run.drainEvents();
  const before = run.heroes.filter((h) => h.id !== 'ranger').map((h) => h.hp);
  const ok = applyAction(run.battle, run, { skill: 'volley' });
  assert.equal(ok, false);
  assert.equal(ranger.skillCd.volley, 1, '冷却应在回合开头递减一次');
});

test('远征军势：满能量时全场敌人受伤并清空能量', () => {
  const run = battleRun('n1a');
  run.signature = run.signatureMax;
  assert.ok(untilHeroTurn(run));
  const before = run.battle.units.filter((u) => u.side === 'enemy' && u.alive).length;
  applyAction(run.battle, run, { skill: 'signature' });
  assert.equal(run.signature, 0);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'signature'));
  assert.ok(before >= 1, '应有敌人');
});

test('战斗胜利：全灭敌人 → applyAction 返回 true', () => {
  const run = battleRun('n1a');
  // 只留一个 1 血敌人，补刀应直接获胜
  const enemies = run.battle.units.filter((u) => u.side === 'enemy');
  for (let i = 1; i < enemies.length; i += 1) { enemies[i].hp = 0; enemies[i].alive = false; }
  enemies[0].hp = 1;
  assert.ok(untilHeroTurn(run));
  const target = run.battle.units.find((u) => u.side === 'enemy' && u.alive);
  const ok = applyAction(run.battle, run, { skill: 'basic', target: target.id });
  assert.equal(ok, true);
});

test('嘲讽：guard 给予护盾与嘲讽，敌人优先打嘲讽目标', () => {
  const run = battleRun('n1a');
  const vanguard = run.heroes.find((h) => h.id === 'vanguard');
  run.battle.pending = 'vanguard';
  run.battle.waiting = true;
  applyAction(run.battle, run, { skill: 'guard' });
  assert.ok(vanguard.shield > 0);
  assert.equal(vanguard.tauntTurns, 2);
  assert.equal(pickEnemyTarget(run.battle).id, 'vanguard');
});

test('标记：被标记的敌人受伤更多', () => {
  const run = battleRun('n1a');
  const ranger = run.heroes.find((h) => h.id === 'ranger');
  const target = run.battle.units.find((u) => u.side === 'enemy' && u.alive);
  target.markedTurns = 2;
  run.battle.pending = 'ranger';
  run.battle.waiting = true;
  const hp0 = target.hp;
  applyAction(run.battle, run, { skill: 'basic', target: target.id });
  assert.ok(target.hp < hp0 - 15, '标记后伤害应显著更高');
});

test('敌方行动：敌人回合会对英雄造成伤害', () => {
  const run = battleRun('n1a');
  const vanguard = run.heroes.find((h) => h.id === 'vanguard');
  const hp0 = vanguard.hp;
  // 快速推进时间，让敌人（grunt speed 70 → nextAt 1.43s）行动
  let g = 0;
  while (vanguard.hp >= hp0 && g++ < 400) {
    tickBattle(run.battle, run, 1 / 60);
    if (run.battle.waiting) applyAction(run.battle, run, { skill: 'basic', target: run.battle.units.find((u) => u.side === 'enemy' && u.alive)?.id });
  }
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'enemyAttack'), '应发生敌方攻击');
});

test('失败：三英雄全倒 → 判定 defeat', () => {
  const run = battleRun('n1a');
  for (const h of run.heroes) h.hp = 1;
  // 让敌人不断行动直到英雄全倒
  let g = 0;
  while (run.mode !== 'defeat' && g++ < 3000) {
    tickBattle(run.battle, run, 1 / 60);
    if (run.battle.waiting) {
      const t = run.battle.units.find((u) => u.side === 'enemy' && u.alive);
      if (t) applyAction(run.battle, run, { skill: 'basic', target: t.id });
    }
  }
  assert.equal(run.mode, 'defeat');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'battleLose'));
});
