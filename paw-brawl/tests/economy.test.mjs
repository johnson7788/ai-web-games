import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateCoins, canStart, CHARACTER_PRICES, unlockCharacter } from '../src/core/economy.js';

const baseSave = () => ({
  v: 1,
  coins: 0,
  unlocked: ['shiba', 'cat', 'rabbit', 'panda'],
  lastChar: 'shiba',
  wins: 0,
  matches: 0,
  kos: 0,
  bestRank: 0,
  settings: { sfx: true, music: true, quality: 'auto' },
});

test('角色解锁价格符合设计', () => {
  assert.deepEqual(CHARACTER_PRICES, { bear: 300, fox: 600, frog: 900, duck: 1200 });
});

test('冠军首胜包含名次、KO、首胜和冠军全部金币', () => {
  assert.deepEqual(calculateCoins({ rank: 1, kos: 2, wins: 0 }), {
    total: 300,
    breakdown: { rank: 120, kos: 30, firstWin: 100, champion: 50 },
  });
});

test('非首胜冠军只有名次、KO 和冠军奖励', () => {
  assert.deepEqual(calculateCoins({ rank: 1, kos: 0, wins: 3 }), {
    total: 170,
    breakdown: { rank: 120, kos: 0, firstWin: 0, champion: 50 },
  });
});

test('第二、第三及其他名次使用各自奖励且没有首胜或冠军奖励', () => {
  assert.deepEqual(calculateCoins({ rank: 2, kos: 1, wins: 0 }), {
    total: 95,
    breakdown: { rank: 80, kos: 15, firstWin: 0, champion: 0 },
  });
  assert.deepEqual(calculateCoins({ rank: 3, kos: 0, wins: 0 }).total, 50);
  assert.deepEqual(calculateCoins({ rank: 4, kos: 0, wins: 0 }).total, 25);
  assert.deepEqual(calculateCoins({ rank: 8, kos: 4, wins: 2 }).total, 85);
});

test('解锁成功扣钱、追加角色且不修改原存档', () => {
  const save = { ...baseSave(), coins: 600 };
  const before = structuredClone(save);
  const unlocked = unlockCharacter(save, 'bear');
  assert.notStrictEqual(unlocked, save);
  assert.equal(unlocked.coins, 300);
  assert.deepEqual(unlocked.unlocked, ['shiba', 'cat', 'rabbit', 'panda', 'bear']);
  assert.deepEqual(save, before);
});

test('金币不足、已解锁和未知角色均不扣钱也不改存档', () => {
  const poor = { ...baseSave(), coins: 299 };
  assert.strictEqual(unlockCharacter(poor, 'bear'), poor);
  assert.equal(poor.coins, 299);

  const rich = { ...baseSave(), coins: 2000 };
  assert.strictEqual(unlockCharacter(rich, 'shiba'), rich);
  assert.strictEqual(unlockCharacter(rich, 'dragon'), rich);
  assert.equal(rich.coins, 2000);
  assert.deepEqual(rich.unlocked, ['shiba', 'cat', 'rabbit', 'panda']);
});

test('初始角色可开始，锁定角色不能开始，解锁后可开始', () => {
  const save = { ...baseSave(), coins: 600 };
  assert.equal(canStart(save, 'shiba'), true);
  assert.equal(canStart(save, 'fox'), false);
  const unlocked = unlockCharacter(save, 'fox');
  assert.equal(unlocked.coins, 0);
  assert.equal(canStart(unlocked, 'fox'), true);
  assert.equal(canStart(save, 'fox'), false);
});
