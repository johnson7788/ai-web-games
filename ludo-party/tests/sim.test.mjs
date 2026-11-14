import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, rollDice, moveToken, movableTokens, trackPos, aiStep, aiChoose, getHud, PLAYER_COUNT,
} from '../src/game/sim.js';
import { PLAYERS, RULES, CONFIG } from '../config/game.config.js';

const setDice = (run, d) => { run.rng = () => (d - 1) / 6 + 0.001; };

test('初始化：2 玩家各 4 子在基地、回合 0、roll 阶段', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.players.length, PLAYER_COUNT);
  assert.ok(run.players.every((p) => p.tokens.length === 4 && p.tokens.every((t) => t === -1)));
  assert.equal(run.turn, 0);
  assert.equal(run.phase, 'roll');
});

test('非 6 且全在基地：无可移动 → 换回合', () => {
  const run = createRun({ seed: 1 });
  setDice(run, 3);
  const r = rollDice(run);
  assert.equal(r.dice, 3);
  assert.equal(r.movable.length, 0);
  assert.equal(run.turn, 1);
});

test('掷 6 起飞：棋子进入跑道 0', () => {
  const run = createRun({ seed: 1 });
  setDice(run, 6);
  rollDice(run);
  assert.equal(run.movable.length, 4);
  moveToken(run, 0);
  assert.equal(run.players[0].tokens[0], 0);
});

test('移动：按骰子前进', () => {
  const run = createRun({ seed: 1 });
  run.players[0].tokens[0] = 0;
  setDice(run, 3);
  rollDice(run);
  moveToken(run, 0);
  assert.equal(run.players[0].tokens[0], 3);
  assert.equal(run.turn, 1, '非 6 换回合');
});

test('撞回：落在对手棋子上将其送回基地', () => {
  const run = createRun({ seed: 1 });
  run.players[0].tokens[0] = 2;   // 移到 5（abs 5）
  run.players[1].tokens[0] = 31;  // (26+31)%52 = 5
  setDice(run, 3);
  rollDice(run);
  const r = moveToken(run, 0);
  assert.equal(r.captured, true);
  assert.equal(run.players[1].tokens[0], -1);
});

test('到家：progress 57 完成', () => {
  const run = createRun({ seed: 1 });
  run.players[0].tokens[0] = 56;
  setDice(run, 1);
  rollDice(run);
  moveToken(run, 0);
  assert.equal(run.players[0].tokens[0], RULES.finish);
});

test('四子全到 → 获胜', () => {
  const run = createRun({ seed: 1 });
  run.players[0].tokens = [57, 57, 57, 56];
  setDice(run, 1);
  rollDice(run);
  const r = moveToken(run, 3);
  assert.equal(r.win, true);
  assert.equal(run.phase, 'over');
  assert.equal(run.winner, 0);
});

test('掷 6 获得额外回合', () => {
  const run = createRun({ seed: 1 });
  setDice(run, 6);
  rollDice(run);
  moveToken(run, 0);
  assert.equal(run.turn, 0, '仍在自己回合');
  assert.equal(run.phase, 'roll');
});

test('AI 会选择合法走法', () => {
  const run = createRun({ seed: 1 });
  run.turn = 1;
  run.players[1].tokens[0] = 0;
  setDice(run, 4);
  rollDice(run);
  const choice = aiChoose(run);
  assert.ok(run.movable.includes(choice));
});

test('AI 自对弈可结束，无死循环', () => {
  const run = createRun({ seed: 7 });
  let guard = 0;
  while (run.phase !== 'over' && guard < 5000) {
    aiStep(run);
    guard += 1;
  }
  assert.equal(run.phase, 'over');
  assert.ok(run.winner === 0 || run.winner === 1);
});

test('配置默认值：2 玩家 / 52 跑道 / en+zh', () => {
  assert.equal(PLAYER_COUNT, 2);
  assert.equal(RULES.trackLen, 52);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).tokens.length, 2);
});