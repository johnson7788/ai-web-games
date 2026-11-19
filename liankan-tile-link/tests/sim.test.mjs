import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS, SYMBOLS } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

function skipMemorize(run) {
  let guard = 2000;
  while (run.state.phase === 'memorize' && guard-- > 0) run.step(0.05);
  return run.state.phase;
}

test('创建对局：记忆阶段所有牌正面朝上', () => {
  const run = createRun(0, { mode: 'practice', seed: 1 });
  assert.equal(run.state.phase, 'memorize');
  assert.ok(run.state.cards.every((c) => c.revealed === true));
  assert.equal(run.state.cards.length, LEVELS[0].symbols.length * LEVELS[0].groupOf);
});

test('记忆倒计时结束进入翻牌阶段，牌全部翻回背面', () => {
  const run = createRun(0, { mode: 'practice', seed: 2 });
  skipMemorize(run);
  assert.equal(run.state.phase, 'playing');
  assert.ok(run.state.cards.every((c) => c.revealed === false));
});

test('每种符号恰好出现 groupOf 次', () => {
  const run = createRun(5, { mode: 'practice', seed: 3 });
  const counts = {};
  for (const c of run.state.cards) counts[c.name] = (counts[c.name] || 0) + 1;
  for (const sym of LEVELS[5].symbols) assert.equal(counts[sym], LEVELS[5].groupOf);
});

test('mulberry32 可复现（同 seed 同序列）', () => {
  const a = mulberry32(7);
  const b = mulberry32(7);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('翻一张牌：revealed 变 true，selected 记录', () => {
  const run = createRun(0, { mode: 'practice', seed: 4 });
  skipMemorize(run);
  const card = run.state.cards.find((c) => !c.matched);
  const res = run.showCard(card.id);
  assert.equal(res.ok, true);
  assert.equal(card.revealed, true);
  assert.deepEqual(run.state.selected, [card.id]);
});

test('翻两张相同牌即配对成功，matchedCount 增加', () => {
  const run = createRun(0, { mode: 'practice', seed: 5 });
  skipMemorize(run);
  const byName = {};
  for (const c of run.state.cards) (byName[c.name] = byName[c.name] || []).push(c.id);
  const name = Object.keys(byName).find((n) => byName[n].length >= 2);
  run.showCard(byName[name][0]);
  run.showCard(byName[name][1]);
  assert.equal(run.state.matchedCount, 2);
  assert.ok(run.state.cards[byName[name][0]].matched);
  assert.ok(run.state.cards[byName[name][1]].matched);
});

test('配错：combo 清零、mismatches 增加、待翻回', () => {
  const run = createRun(0, { mode: 'practice', seed: 6 });
  skipMemorize(run);
  const names = Object.keys(run.state.cards.reduce((m, c) => { m[c.name] = c.id; return m; }, {}));
  run.state.combo = 3;
  const a = run.state.cards.find((c) => c.name === names[0] && !c.matched);
  const b = run.state.cards.find((c) => c.name === names[1] && !c.matched);
  run.showCard(a.id);
  run.showCard(b.id);
  assert.equal(run.state.combo, 0);
  assert.equal(run.state.mismatches, 1);
  assert.ok(run.state.pendingUnreveal.length >= 2);
});

test('配错锁到期后牌翻回背面', () => {
  const run = createRun(0, { mode: 'practice', seed: 7 });
  skipMemorize(run);
  const names = Object.keys(run.state.cards.reduce((m, c) => { m[c.name] = c.id; return m; }, {}));
  const a = run.state.cards.find((c) => c.name === names[0] && !c.matched);
  const b = run.state.cards.find((c) => c.name === names[1] && !c.matched);
  run.showCard(a.id);
  run.showCard(b.id);
  while (run.state.pendingUnreveal.length) run.step(0.05);
  assert.equal(a.revealed, false);
  assert.equal(b.revealed, false);
});

test('计时模式：配对成功奖励时间', () => {
  const run = createRun(0, { mode: 'timed', seed: 8 });
  skipMemorize(run);
  const before = run.state.timeLeft;
  const byName = {};
  for (const c of run.state.cards) (byName[c.name] = byName[c.name] || []).push(c.id);
  const name = Object.keys(byName).find((n) => byName[n].length >= 2);
  run.showCard(byName[name][0]);
  run.showCard(byName[name][1]);
  assert.ok(run.state.timeLeft > before);
});

test('连击：连续配对 combo 递增', () => {
  const run = createRun(0, { mode: 'practice', seed: 9 });
  skipMemorize(run);
  const byName = {};
  for (const c of run.state.cards) (byName[c.name] = byName[c.name] || []).push(c.id);
  const names = Object.keys(byName);
  run.showCard(byName[names[0]][0]);
  run.showCard(byName[names[0]][1]);
  run.state.lockedUntil = 0;
  run.showCard(byName[names[1]][0]);
  run.showCard(byName[names[1]][1]);
  assert.ok(run.state.combo >= 2);
});

test('窥视道具：消耗充能并生效', () => {
  const run = createRun(0, { mode: 'practice', seed: 10 });
  skipMemorize(run);
  const charges = run.state.peekCharges;
  assert.ok(charges >= 1);
  const res = run.usePeek();
  assert.equal(res.ok, true);
  assert.equal(run.state.peekCharges, charges - 1);
});

test('清空整板判胜并结算星级', () => {
  const run = createRun(0, { mode: 'practice', seed: 11 });
  skipMemorize(run);
  let guard = 4000;
  while (run.state.phase === 'playing' && guard-- > 0) {
    if (run.state.simTime < run.state.lockedUntil) { run.step(0.05); continue; }
    const byName = {};
    for (const c of run.state.cards) if (!c.matched) (byName[c.name] = byName[c.name] || []).push(c.id);
    const name = Object.keys(byName).find((n) => byName[n].length >= run.state.groupOf);
    if (!name) { run.step(0.05); continue; }
    for (const id of byName[name]) run.showCard(id);
    run.step(0.4);
  }
  assert.equal(run.state.phase, 'won');
  assert.equal(run.state.matchedCount, run.state.cards.length);
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
});

test('计时模式：超时判负', () => {
  const run = createRun(0, { mode: 'timed', seed: 12 });
  skipMemorize(run);
  let guard = 5000;
  while (run.state.phase === 'playing' && guard-- > 0) run.step(0.05);
  assert.equal(run.state.phase, 'lost');
});

test('练习模式完美通关三星', () => {
  const run = createRun(0, { mode: 'practice', seed: 13 });
  skipMemorize(run);
  let guard = 4000;
  while (run.state.phase === 'playing' && guard-- > 0) {
    if (run.state.simTime < run.state.lockedUntil) { run.step(0.05); continue; }
    const byName = {};
    for (const c of run.state.cards) if (!c.matched) (byName[c.name] = byName[c.name] || []).push(c.id);
    const name = Object.keys(byName).find((n) => byName[n].length >= run.state.groupOf);
    if (!name) { run.step(0.05); continue; }
    for (const id of byName[name]) run.showCard(id);
    run.step(0.4);
  }
  assert.equal(run.state.mismatches, 0);
  assert.equal(run.state.stars, 3);
});

test('三张一组关卡：groupOf 为 3 且牌数正确', () => {
  const run = createRun(10, { mode: 'practice', seed: 14 });
  assert.equal(run.state.groupOf, 3);
  assert.equal(run.state.cards.length, LEVELS[10].symbols.length * 3);
});
