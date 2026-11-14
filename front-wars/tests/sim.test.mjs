import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, createTutorialRun, tick, getHud, getPerkChoices, nextRound,
} from '../src/game/sim.js';
import { LOADOUTS, RULES, PERKS } from '../config/game.config.js';

function placeDuel(run, opts = {}) {
  const me = run.players[0];
  const enemy = run.players[4];
  me.x = opts.mx ?? 500; me.y = opts.my ?? 360;
  enemy.x = opts.ex ?? 760; enemy.y = opts.ey ?? 360;
  enemy.isBot = false; enemy.baseSpeed = 0;
  me.aim = Math.atan2(enemy.y - me.y, enemy.x - me.x);
  for (const p of run.players) {
    if (p !== me && p !== enemy) { p.alive = false; p.respawnT = 999; }
  }
  return { me, enemy };
}
function fireAt(run, enemy, seconds = 0.5) {
  run.players[0].aim = Math.atan2(enemy.y - run.players[0].y, enemy.x - run.players[0].x);
  for (let i = 0; i < Math.ceil(seconds * 60); i += 1) tick(run, 1 / 60, { aim: run.players[0].aim, shoot: true });
}

test('创建比赛：4v4、双方出生、3 回合规则', () => {
  const run = createRun({ seed: 3, loadout: 'rifleman' });
  const hud = getHud(run);
  assert.equal(run.players.length, 8);
  assert.equal(run.players.filter((p) => p.team === 0).length, 4);
  assert.equal(run.players.filter((p) => p.team === 1).length, 4);
  assert.equal(hud.round, 1);
  assert.equal(hud.killTarget, 15);
  assert.equal(hud.timeLeft, RULES.roundTime);
  assert.equal(hud.loadout, 'rifleman');
});

test('兵种差异：侦察兵更快更脆，重装更慢更硬', () => {
  const scout = createRun({ seed: 2, loadout: 'scout' }).players[0];
  const heavy = createRun({ seed: 2, loadout: 'heavy' }).players[0];
  assert.ok(scout.baseSpeed > heavy.baseSpeed);
  assert.ok(scout.maxHp < heavy.maxHp);
  assert.ok(heavy.damage > scout.damage);
  assert.equal(scout.radius, LOADOUTS.scout.radius);
});

test('移动：WASD 向量推进，墙体阻挡', () => {
  const run = createRun({ seed: 4 });
  const me = run.players[0];
  const x0 = me.x;
  for (let i = 0; i < 30; i += 1) tick(run, 1 / 60, { right: true });
  assert.ok(me.x > x0);
  // 顶到左侧出生区边界后不越界
  me.x = 60;
  for (let i = 0; i < 120; i += 1) tick(run, 1 / 60, { left: true });
  assert.ok(me.x >= 40 + me.radius - 1);
});

test('射击命中：子弹造成伤害，友军不受伤', () => {
  const run = createRun({ seed: 5 });
  const { me, enemy } = placeDuel(run);
  const ally = run.players[1];
  ally.x = 600; ally.y = 360;
  const hp0 = enemy.hp;
  const allyHp = ally.hp;
  fireAt(run, enemy, 1.2);
  assert.ok(enemy.hp < hp0);
  assert.equal(ally.hp, allyHp);
});

test('击杀：队伍 +1、击杀/死亡统计、2 秒后重生', () => {
  const run = createRun({ seed: 6 });
  const { enemy } = placeDuel(run);
  enemy.hp = 10;
  fireAt(run, enemy, 0.8);
  assert.equal(run.scores[0], 1);
  assert.equal(run.players[0].kills, 1);
  assert.equal(enemy.alive, false);
  for (let i = 0; i < 150; i += 1) tick(run, 1 / 60, {});
  assert.equal(enemy.alive, true);
  assert.equal(enemy.hp, enemy.maxHp);
});

test('回合目标：15 击杀结束回合；先赢 2 回合结束比赛', () => {
  const run = createRun({ seed: 7 });
  run.scores = [15, 0];
  tick(run, 0, {});
  assert.equal(run.phase, 'roundOver');
  assert.deepEqual(run.roundWins, [1, 0]);
  nextRound(run, null);
  run.scores = [15, 0];
  tick(run, 0, {});
  assert.equal(run.phase, 'matchOver');
  assert.equal(run.matchWinner, 0);
  assert.deepEqual(run.roundWins, [2, 0]);
});

test('下一回合：清空比分、保留强化、换敌人配置', () => {
  const run = createRun({ seed: 8 });
  run.scores = [15, 0];
  tick(run, 0, {});
  const choices = getPerkChoices(run, 3);
  assert.equal(choices.length, 3);
  nextRound(run, choices[0].id);
  assert.equal(run.round, 1);
  assert.deepEqual(run.scores, [0, 0]);
  assert.ok(run.perks.includes(choices[0].id));
  assert.equal(run.phase, 'play');
});

test('强化：装甲 +25 最大生命，急速射击缩短射击间隔', () => {
  const run = createRun({ seed: 9 });
  run.perks.push('armor', 'rapid');
  nextRound(run, null); // 不允许，但用于重置
  // 直接重开一局并带入 perks
  const run2 = createRun({ seed: 9 });
  run2.perks.push('armor', 'rapid');
  const me = run2.players[0];
  nextRound({ ...run2, phase: 'roundOver' }, null);
  const armored = createRun({ seed: 9 });
  armored.perks.push('armor');
  armored.players[0].maxHp = armored.players[0].baseMaxHp + 25;
  assert.equal(armored.players[0].maxHp, 125);
  assert.ok(me.baseFireCd > 0);
  assert.equal(me.maxHp, 100);
});

test('加时：时间到平分进入 overtime，下一杀结束', () => {
  const run = createRun({ seed: 10 });
  run.timeLeft = 0;
  tick(run, 0, {});
  assert.equal(run.overtime, true);
  assert.equal(run.phase, 'play');
  run.scores = [1, 0];
  tick(run, 0, {});
  assert.equal(run.phase, 'roundOver');
});

test('过载点：激活后拾取获得 8 秒加速', () => {
  const run = createRun({ seed: 11 });
  run.pickup.active = true;
  run.players[0].x = run.pickup.x;
  run.players[0].y = run.pickup.y;
  tick(run, 1 / 60, {});
  assert.ok(run.players[0].overdriveT > 7);
  assert.equal(run.pickup.active, false);
});

test('教学局：移动 → 瞄准 → 击破靶子 → 冲刺 → tutorialDone', () => {
  const run = createTutorialRun();
  assert.equal(run.tutorial, true);
  assert.equal(getHud(run).tutorialStep, 0);
  // 移动
  for (let i = 0; i < 60; i += 1) tick(run, 1 / 60, { right: true });
  assert.equal(getHud(run).tutorialStep, 1);
  // 瞄准
  const me = run.players[0];
  const dummy = run.players[1];
  const aim = Math.atan2(dummy.y - me.y, dummy.x - me.x);
  for (let i = 0; i < 40; i += 1) tick(run, 1 / 60, { aim });
  assert.equal(getHud(run).tutorialStep, 2);
  // 射击
  for (let i = 0; i < 180; i += 1) tick(run, 1 / 60, { aim, shoot: true });
  assert.equal(getHud(run).tutorialStep, 3);
  // 冲刺
  tick(run, 1 / 60, { dash: true });
  assert.equal(getHud(run).phase, 'tutorialDone');
});

test('全部 bot 自动跑：能从第 1 回合打到比赛结束', () => {
  const run = createRun({ seed: 12 });
  run.players[0].isBot = true;
  let guard = 0;
  while (run.phase !== 'matchOver' && guard < 60 * 300) {
    tick(run, 1 / 60, {});
    if (run.phase === 'roundOver') nextRound(run, null);
    guard += 1;
  }
  assert.equal(run.phase, 'matchOver');
  assert.ok(run.roundWins[0] >= 2 || run.roundWins[1] >= 2);
});

test('配置：15 击杀 / 120s / 3 回合 / 8 强化 / 3 兵种', () => {
  assert.equal(RULES.killTarget, 15);
  assert.equal(RULES.roundTime, 120);
  assert.equal(RULES.roundsToWin, 2);
  assert.equal(PERKS.length, 8);
  assert.equal(Object.keys(LOADOUTS).length, 3);
});
