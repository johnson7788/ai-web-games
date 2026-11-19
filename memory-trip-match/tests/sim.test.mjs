import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

const drainAll = (run) => { const e = run.drainEvents(); return e; };
const solveAll = (run) => {
  // 按符号配对正确翻牌（含岩石卡敲裂）
  const bySymbol = new Map();
  for (const c of run.state.cards) {
    if (!bySymbol.has(c.symbol)) bySymbol.set(c.symbol, []);
    bySymbol.get(c.symbol).push(c.id);
  }
  for (const [, ids] of bySymbol) {
    for (const id of ids) {
      let guard = 0;
      while (!run.state.cards[id].revealed && !run.state.cards[id].solved && guard++ < 4) {
        run.flip(id);
      }
    }
  }
};

test('L1：3 对 6 张卡，开局 preview 阶段', () => {
  const run = createRun(0);
  assert.equal(run.state.level, 1);
  assert.equal(run.state.pairs, 3);
  assert.equal(run.state.totalCards, 6);
  assert.equal(run.state.phase, 'preview');
  assert.equal(run.state.cards.length, 6);
});

test('preview 结束后进入 playing', () => {
  const run = createRun(0);
  while (run.state.phase === 'preview') run.step(1 / 60);
  assert.equal(run.state.phase, 'playing');
});

test('翻两张同符号卡：配对成功并保持翻开', () => {
  const run = createRun(0);
  while (run.state.phase === 'preview') run.step(1 / 60);
  const bySymbol = new Map();
  for (const c of run.state.cards) {
    if (!bySymbol.has(c.symbol)) bySymbol.set(c.symbol, []);
    bySymbol.get(c.symbol).push(c.id);
  }
  const [a, b] = bySymbol.values().next().value;
  assert.ok(run.flip(a).ok);
  assert.ok(run.flip(b).ok);
  assert.equal(run.state.cards[a].solved, true);
  assert.equal(run.state.cards[b].solved, true);
  assert.equal(run.state.moves, 1);
  assert.equal(run.state.combo, 1);
});

test('翻错：combo 归零，1.5s 后盖回', () => {
  const run = createRun(0);
  while (run.state.phase === 'preview') run.step(1 / 60);
  const bySymbol = new Map();
  for (const c of run.state.cards) {
    if (!bySymbol.has(c.symbol)) bySymbol.set(c.symbol, []);
    bySymbol.get(c.symbol).push(c.id);
  }
  const ids = [...bySymbol.values()];
  const a = ids[0][0];
  const b = ids[1][0];
  assert.ok(run.flip(a).ok);
  assert.ok(run.flip(b).ok);
  assert.equal(run.state.combo, 0);
  assert.ok(run.state.mismatchLock > 0);
  for (let i = 0; i < GAME.MISMATCH_DELAY * 60 + 2; i += 1) run.step(1 / 60);
  assert.equal(run.state.mismatchLock, 0);
  assert.equal(run.state.cards[a].revealed, false);
  assert.equal(run.state.cards[b].revealed, false);
});

test('通关：phase=won 且评星', () => {
  const run = createRun(0);
  while (run.state.phase === 'preview') run.step(1 / 60);
  solveAll(run);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
  const evs = drainAll(run);
  assert.ok(evs.some((e) => e.type === 'win'));
});

test('岩石卡：先敲裂再翻开', () => {
  const run = createRun(4); // L5 有岩石
  while (run.state.phase === 'preview') run.step(1 / 60);
  const rock = run.state.cards.find((c) => c.kind === 'rock');
  assert.ok(rock, 'L5 应有岩石卡');
  const first = run.flip(rock.id);
  assert.equal(first.ok, true);
  assert.equal(first.cracked, true);
  assert.equal(run.state.cards[rock.id].revealed, false);
  const second = run.flip(rock.id);
  assert.equal(second.ok, true);
  assert.equal(run.state.cards[rock.id].revealed, true);
});

test('步数耗尽判负', () => {
  const run = createRun(0);
  while (run.state.phase === 'preview') run.step(1 / 60);
  run.state.moves = run.state.moveBudget; // 预置到临界
  const bySymbol = new Map();
  for (const c of run.state.cards) {
    if (!bySymbol.has(c.symbol)) bySymbol.set(c.symbol, []);
    bySymbol.get(c.symbol).push(c.id);
  }
  const ids = [...bySymbol.values()];
  run.flip(ids[0][0]);
  run.flip(ids[1][0]); // 翻错 → 步数 +1 → 超预算
  assert.equal(run.state.phase, 'lost');
  const evs = drainAll(run);
  assert.ok(evs.some((e) => e.type === 'lose'));
});

test('hint 扣次数并发事件', () => {
  const run = createRun(0);
  while (run.state.phase === 'preview') run.step(1 / 60);
  assert.equal(run.state.hintsLeft, 2);
  assert.ok(run.hint().ok);
  assert.equal(run.state.hintsLeft, 1);
});

test('mulberry32 同种子可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const x = [a(), a(), a()];
  const y = [b(), b(), b()];
  assert.deepEqual(x, y);
});

test('每关网格容量足以放下全部卡', () => {
  for (const lv of LEVELS) {
    assert.ok(lv.cols * lv.rows >= lv.totalCards, `L${lv.index} 网格容量不足`);
  }
});
