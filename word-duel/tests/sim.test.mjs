import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, findBestWord, canForm, indicesForWord, HEAL_WORDS } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME } from '../config/game.config.js';
import { WORD_SET } from '../config/words.js';

// 白盒辅助：把手牌设为指定字母（测试用）
function setHand(run, letters) {
  run.state.hand = letters.map((ch) => ({ ch, selected: false }));
  run.state.selection = [];
  run.state.word = '';
}

function selectByChars(run, chars) {
  for (const ch of chars) {
    const i = run.state.hand.findIndex((t) => !t.selected && t.ch === ch);
    assert.ok(i >= 0, `找不到字母 ${ch}`);
    run.selectLetter(i);
  }
}

test('createRun：初始 phase=playing、turn=1、手牌 9 张', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.turn, 1);
  assert.equal(run.state.hand.length, GAME.HAND_SIZE);
  assert.equal(run.state.playerHp, GAME.PLAYER_MAX_HP);
});

test('同一 seed 可复现（手牌一致）', () => {
  const a = createRun(0, { seed: 7 }).state.hand.map((t) => t.ch).join('');
  const b = createRun(0, { seed: 7 }).state.hand.map((t) => t.ch).join('');
  assert.equal(a, b);
});

test('发牌必含至少一个可拼词典词', () => {
  for (let seed = 1; seed <= 30; seed += 1) {
    const run = createRun(0, { seed });
    const letters = run.state.hand.map((t) => t.ch);
    const w = findBestWord(letters);
    assert.ok(w, `seed=${seed} 无可拼词`);
    assert.ok(WORD_SET.has(w));
  }
});

test('canForm / indicesForWord：能正确判断与定位', () => {
  assert.equal(canForm('cat', 'tacx'), true);
  assert.equal(canForm('cats', 'tac'), false);
  const idx = indicesForWord(['c', 'a', 't', 'a', 'x'], 'cat');
  assert.ok(idx);
  assert.equal(idx.map((i) => ['c', 'a', 't', 'a', 'x'][i]).join(''), 'cat');
});

test('selectLetter：toggle 选字并更新 word', () => {
  const run = createRun(0, { seed: 1 });
  setHand(run, ['c', 'a', 't', 'x', 'y', 'z', 'q', 'w', 'e']);
  run.selectLetter(0);
  run.selectLetter(1);
  run.selectLetter(2);
  assert.equal(run.state.word, 'cat');
  run.selectLetter(1); // 再点取消
  assert.equal(run.state.word, 'ct');
});

test('deselectLast：退格取消最后一个字母', () => {
  const run = createRun(0, { seed: 1 });
  setHand(run, ['c', 'a', 't', 'x', 'y', 'z', 'q', 'w', 'e']);
  run.selectLetter(0);
  run.selectLetter(1);
  run.deselectLast();
  assert.equal(run.state.word, 'c');
});

test('submitWord 合法词：扣敌血并推进回合', () => {
  const run = createRun(0, { seed: 1 });
  setHand(run, ['c', 'a', 't', 'x', 'y', 'z', 'q', 'w', 'e']);
  run.selectLetter(0);
  run.selectLetter(1);
  run.selectLetter(2);
  const hp0 = run.state.enemyHp;
  const res = run.submitWord();
  assert.equal(res.valid, true);
  assert.ok(run.state.enemyHp < hp0, '敌人应掉血');
  assert.ok(run.state.turn >= 2, '应进入下一回合');
});

test('submitWord 空词：拒绝', () => {
  const run = createRun(0, { seed: 1 });
  const res = run.submitWord();
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'empty');
});

test('submitWord 非法词：miss 并吃反伤', () => {
  const run = createRun(0, { seed: 1 });
  setHand(run, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  run.selectLetter(0); run.selectLetter(1); run.selectLetter(2); // "abc" 非词
  const hp0 = run.state.playerHp;
  run.submitWord();
  assert.ok(run.state.playerHp < hp0, '应吃反伤');
});

test('雷系（L4）答错双倍反伤', () => {
  const run = createRun(3, { seed: 1 }); // index 3 = L4 thunder
  assert.equal(run._level.doubleCounter, true);
  setHand(run, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  run.selectLetter(0); run.selectLetter(1); run.selectLetter(2);
  const hp0 = run.state.playerHp;
  run.submitWord();
  // 拼错 = 双倍反伤(9*2) + 随后敌人正常回合攻击(9) = 27
  const taken = hp0 - run.state.playerHp;
  assert.equal(taken, run._level.enemyDamage * 3);
});

test('词长门槛（L6）：<4 字母无效且提示太短', () => {
  const run = createRun(5, { seed: 1 }); // index 5 = L6 minWordLen 4
  setHand(run, ['c', 'a', 't', 'x', 'y', 'z', 'q', 'w', 'e']);
  run.selectLetter(0); run.selectLetter(1); run.selectLetter(2); // "cat" 合法词但 <4
  const hp0 = run.state.enemyHp;
  run.submitWord();
  assert.equal(run.state.enemyHp, hp0, '短词不应造成伤害');
  assert.ok(run.state.playerHp < GAME.PLAYER_MAX_HP, '应被反伤');
});

test('护盾（L7）：先吸收伤害再破盾', () => {
  const run = createRun(6, { seed: 1 }); // index 6 = L7 shield 40
  assert.ok(run.state.enemyShield > 0);
  setHand(run, ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i']);
  // 找一个长词打盾
  const letters = run.state.hand.map((t) => t.ch);
  const w = findBestWord(letters);
  const idx = indicesForWord(letters, w);
  idx.forEach((i) => run.selectLetter(i));
  const hp0 = run.state.enemyHp;
  run.submitWord();
  assert.ok(run.state.enemyShield <= 0 || run.state.enemyHp < hp0, '护盾应被削减或本体掉血');
});

test('heal 词（L8）：回血而非攻击', () => {
  const run = createRun(7, { seed: 1 }); // index 7 = L8 healWords
  run.state.playerHp = 50;
  setHand(run, ['h', 'e', 'a', 'l', 'x', 'y', 'z', 'q', 'w']);
  run.selectLetter(0); run.selectLetter(1); run.selectLetter(2); run.selectLetter(3); // "heal"
  const hp0 = run.state.playerHp;
  const ehp = run.state.enemyHp;
  run.submitWord();
  assert.ok(run.state.playerHp > hp0, '应回血');
  assert.equal(run.state.enemyHp, ehp, 'heal 不应伤害敌人');
});

test('swap：换牌并结束回合', () => {
  const run = createRun(0, { seed: 1 });
  const turn0 = run.state.turn;
  const res = run.swap();
  assert.equal(res.ok, true);
  assert.equal(run.state.hand.length, GAME.HAND_SIZE);
  assert.ok(run.state.turn > turn0, '换牌应结束回合');
});

test('autoSpell：能拼出合法词并命中', () => {
  const run = createRun(0, { seed: 42 });
  const hp0 = run.state.enemyHp;
  const res = run.autoSpell();
  assert.equal(res.ok, true);
  assert.ok(WORD_SET.has(res.word));
  assert.ok(run.state.enemyHp < hp0);
});

test('胜利：敌人 HP 归零 → phase won', () => {
  const run = createRun(0, { seed: 1 });
  let guard = 0;
  while (run.state.phase === 'playing' && guard++ < 200) run.autoSpell();
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.result.won, true);
});

test('失败：玩家 HP 归零 → phase lost', () => {
  const run = createRun(0, { seed: 1 });
  run.state.playerHp = 3;
  run._damagePlayer(10, {});
  assert.equal(run.state.phase, 'lost');
});

test('事件表：多种事件被发出（种类 ≥6）', () => {
  const run = createRun(0, { seed: 42 });
  let guard = 0;
  while (run.state.phase === 'playing' && guard++ < 200) run.autoSpell();
  const types = new Set(run._events.map((e) => e.type));
  assert.ok(types.size >= 6, `事件种类 ${types.size}`);
  assert.ok(types.has('win'));
});

test('HEAL_WORDS 均为词典词', () => {
  for (const w of HEAL_WORDS) assert.ok(WORD_SET.has(w), `${w} 不在词库`);
});
