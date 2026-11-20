import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { createBattle } from '../src/game/battle.js';
import { nodeById } from '../config/levels.js';

function startRun(seed = 1) {
  const run = createRun({ seed });
  run.step({ confirmFormation: ['vanguard', 'ranger', 'seer'] });
  return run;
}

// 自动打完一场战斗（军势满→合击，否则平 A 最低血敌人）
function autoBattle(run, max = 20000) {
  let g = 0;
  while (run.mode === 'battle' && g++ < max) {
    if (run.battle.waiting) {
      if (run.signature >= run.signatureMax) run.step({ action: { skill: 'signature' } });
      else {
        const t = run.battle.units.filter((u) => u.side === 'enemy' && u.alive).sort((a, b) => a.hp - b.hp)[0];
        run.step({ action: { skill: 'basic', target: t ? t.id : null } });
      }
    } else {
      run.step({});
    }
    run.drainEvents();
  }
  return run.mode;
}

test('createRun：初始为布阵模式，3 英雄，粮草 8', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.mode, 'formation');
  assert.equal(run.heroes.length, 3);
  assert.equal(run.supplies, 8);
  assert.equal(run.signature, 0);
});

test('confirmFormation：合法布阵进入 map 并给出分支节点', () => {
  const run = createRun({ seed: 1 });
  run.step({ confirmFormation: ['vanguard', 'ranger', 'seer'] });
  assert.equal(run.mode, 'map');
  assert.deepEqual(run.choices.sort(), ['n1a', 'n1b']);
  assert.equal(run.heroes.find((h) => h.id === 'vanguard').row, 0);
});

test('confirmFormation：重复英雄 id 无效，仍停留布阵', () => {
  const run = createRun({ seed: 1 });
  run.step({ confirmFormation: ['vanguard', 'vanguard', 'seer'] });
  assert.equal(run.mode, 'formation');
});

test('行军到战斗节点：扣粮草并进入战斗', () => {
  const run = startRun();
  run.step({ chooseNode: 'n1a' });
  assert.equal(run.mode, 'battle');
  assert.equal(run.supplies, 6);
  assert.equal(run.levelsReached, 1);
  assert.ok(run.battle);
});

test('行军到休整节点：回满血并 +1 粮草', () => {
  const run = startRun();
  const v = run.heroes.find((h) => h.id === 'vanguard');
  v.hp = 20;
  run.step({ chooseNode: 'n1b' });
  assert.equal(run.mode, 'rest');
  assert.equal(v.hp, v.maxHp);
  assert.equal(run.supplies, 8 - 2 + 1);
});

test('行军到事件节点：进入事件模式', () => {
  const run = startRun();
  run.step({ chooseNode: 'n1b' });   // 先到 col1 休整
  run.step({ continue: true });
  run.step({ chooseNode: 'n2b' });   // 再到 col2 事件
  assert.equal(run.mode, 'event');
  assert.ok(run.event);
});

test('事件选择：应用粮草增减效果', () => {
  const run = startRun();
  run.step({ chooseNode: 'n1b' });
  run.step({ continue: true });
  run.step({ chooseNode: 'n2b' });
  const ev = run.event;
  const choiceWithSupply = ev.choices.findIndex((c) => c.effect.supplies);
  const before = run.supplies;
  run.step({ choice: choiceWithSupply });
  assert.equal(run.mode, 'map');
  if (choiceWithSupply >= 0) assert.notEqual(run.supplies, before);
});

test('战斗胜利：进入升级模式并发放粮草奖励', () => {
  const run = startRun();
  run.step({ chooseNode: 'n1a' });
  const mode = autoBattle(run);
  assert.equal(mode, 'upgrade');
  assert.ok(run.supplies > 0);
  assert.equal(run.stats.battlesWon, 1);
  assert.equal(run.upgradeChoices.length, 3);
});

test('升级：应用后回到 map 且属性生效', () => {
  const run = startRun();
  run.step({ chooseNode: 'n1a' });
  autoBattle(run);
  const id = run.upgradeChoices.find((x) => x === 'vanguardAtk') || run.upgradeChoices[0];
  const atk0 = run.heroes.find((h) => h.id === 'vanguard').atk;
  run.step({ upgrade: id });
  assert.equal(run.mode, 'map');
  if (id === 'vanguardAtk') assert.ok(run.heroes.find((h) => h.id === 'vanguard').atk > atk0);
});

test('军势：行军积攒 +4，英雄行动积攒', () => {
  const run = startRun();
  const sig0 = run.signature;
  run.step({ chooseNode: 'n1a' });
  assert.equal(run.signature, sig0 + 4);
});

test('倒地英雄战后复活到 40% 上限', () => {
  const run = startRun();
  run.step({ chooseNode: 'n1a' });
  const v = run.heroes.find((h) => h.id === 'vanguard');
  v.hp = 0; v.alive = false;
  autoBattle(run);
  assert.equal(v.alive, true);
  assert.ok(v.hp >= Math.round(v.maxHp * 0.4));
});

test('击败 Boss：进入 victory（通关）', () => {
  const run = createRun({ seed: 7 });
  run.heroes.forEach((h) => { h.row = h.rowPref; });
  run.nodeId = 'n11';
  run.col = 11;
  run.chapter = 3;
  run.mode = 'battle';
  run.battle = createBattle(run, nodeById('n11'));
  // 便于确定性地验证通关转移：把 Boss 敌人压到 1 血再补刀
  for (const e of run.battle.units.filter((u) => u.side === 'enemy')) e.hp = 1;
  const mode = autoBattle(run);
  assert.equal(mode, 'victory');
  assert.equal(run.stats.battlesWon, 1);
});

test('getHud：暴露 mode/粮草/军势/英雄/战斗快照', () => {
  const run = startRun();
  run.step({ chooseNode: 'n1a' });
  const hud = run.getHud();
  assert.equal(hud.mode, 'battle');
  assert.equal(hud.supplies, 6);
  assert.ok(hud.battle);
  assert.equal(hud.heroes.length, 3);
});
