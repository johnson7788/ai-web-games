import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, topCard, canPlay, legalMoves, playCard, draw, pass, aiStep, bestColor, getHud, PLAYER_COUNT,
} from '../src/game/sim.js';
import { RULES, CONFIG, COLOR_KEYS } from '../config/game.config.js';

const C = (color, value) => ({ id: Math.random(), color, value });
function setup(hand, top = C('red', '3'), color = 'red') {
  const run = createRun({ seed: 1 });
  run.hands[0] = hand;
  run.discard = [top];
  run.color = color;
  run.turn = 0;
  run.dir = 1;
  run.drawnThisTurn = false;
  run.phase = 'playing';
  return run;
}

test('初始化：3 家各 7 张、翻首张、回合 0', () => {
  const run = createRun({ seed: 5 });
  assert.equal(run.hands.length, PLAYER_COUNT);
  assert.ok(run.hands.every((h) => h.length === RULES.handSize));
  assert.equal(run.discard.length, 1);
  assert.equal(run.turn, 0);
  assert.ok(COLOR_KEYS.includes(run.color));
});

test('canPlay：颜色/数字/万能匹配', () => {
  assert.equal(canPlay(C('red', '9'), 'red', '3'), true, '同色');
  assert.equal(canPlay(C('blue', '3'), 'red', '3'), true, '同数字');
  assert.equal(canPlay(C('wild', 'wild'), 'red', '3'), true, '万能');
  assert.equal(canPlay(C('blue', '9'), 'red', '3'), false, '不匹配');
});

test('普通出牌：移除手牌、换回合、定色', () => {
  const run = setup([C('red', '5'), C('blue', '9')]);
  const r = playCard(run, 0);
  assert.equal(r.ok, true);
  assert.equal(run.hands[0].length, 1);
  assert.equal(run.turn, 1);
  assert.equal(run.color, 'red');
});

test('跳过牌：前进 2 位', () => {
  const run = setup([C('red', 'skip'), C('blue', '9')]);
  playCard(run, 0);
  assert.equal(run.turn, 2, '跳过下家');
});

test('+2：下家摸 2 张并被跳过', () => {
  const run = setup([C('red', 'draw2'), C('blue', '9')]);
  const before = run.hands[1].length;
  playCard(run, 0);
  assert.equal(run.hands[1].length, before + 2);
  assert.equal(run.turn, 2);
});

test('万能牌：必须选色，否则失败', () => {
  const run = setup([C('wild', 'wild'), C('blue', '9')]);
  assert.equal(playCard(run, 0).reason, 'color', '未选色失败');
  const r = playCard(run, 0, 'green');
  assert.equal(r.ok, true);
  assert.equal(run.color, 'green');
});

test('出完手牌 → 获胜', () => {
  const run = setup([C('red', '5')]);
  const r = playCard(run, 0);
  assert.equal(r.winner, 0);
  assert.equal(run.phase, 'over');
});

test('摸牌：不可出则自动结束回合', () => {
  const run = setup([C('blue', '9')], C('red', '3'), 'red');
  // 手牌 blue9 不匹配 red3，摸牌后若仍不匹配则换回合
  const r = draw(run);
  assert.equal(r.ok, true);
  assert.ok(run.hands[0].length >= 2);
});

test('AI 会出合法牌或摸牌', () => {
  const run = createRun({ seed: 9 });
  run.turn = 1;
  const before = run.hands[1].length;
  const act = aiStep(run);
  assert.ok(act && act.player === 1);
  assert.ok(['play', 'draw-play', 'draw-pass'].includes(act.action));
});

test('整局可结束（玩家随机策略 + AI），无死循环', () => {
  const run = createRun({ seed: 2026 });
  let steps = 0;
  while (run.phase === 'playing' && steps < 2000) {
    steps += 1;
    if (run.turn === 0) {
      const legal = legalMoves(run, 0);
      if (legal.length) {
        const c = run.hands[0][legal[0]];
        playCard(run, legal[0], c.color === 'wild' ? bestColor(run.hands[0]) : undefined);
      } else {
        draw(run);
        if (run.drawnThisTurn) pass(run);
      }
    } else {
      aiStep(run);
    }
  }
  assert.equal(run.phase, 'over', '牌局应能结束');
  assert.ok(run.winner != null);
});

test('bestColor 选手牌最多的颜色', () => {
  assert.equal(bestColor([C('red', '1'), C('red', '2'), C('blue', '3')]), 'red');
});

test('配置默认值：3 人 / 7 张 / en+zh', () => {
  assert.equal(RULES.players, 3);
  assert.equal(RULES.handSize, 7);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).counts.length, 3);
});