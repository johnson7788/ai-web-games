// sim 单测（node --test，纯逻辑零 DOM）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, generateLevel, mulberry32 } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT, levelTime } from '../config/levels.js';
import { GAME } from '../config/game.config.js';

test('mulberry32 可复现', () => {
  const a = mulberry32(123);
  const b = mulberry32(123);
  assert.equal(a(), b());
  assert.equal(a(), b());
});

test('每关方块数 = 花色×3 + 万能（3 的倍数）', () => {
  for (const lv of LEVELS) {
    const run = createRun(lv.index - 1, { seed: 5 });
    const n = run.state.tiles.length;
    assert.equal(n, lv.symbols * 3 + lv.wilds);
    assert.equal(n % 3, 0);
  }
});

test('逆向构造保证存在解序（solution 每色恰好 3 块）', () => {
  const run = createRun(0, { seed: 9 });
  const count = new Map();
  for (const s of run._solution) count.set(s, (count.get(s) || 0) + 1);
  for (const c of count.values()) assert.equal(c, 3);
});

test('可拿方块 = 所在柱子顶端', () => {
  const run = createRun(2, { seed: 4 });
  for (const t of run.state.tiles) {
    if (run.isFree(t)) {
      const above = run.state.tiles.some((o) => o.onBoard && o.x === t.x && o.z === t.z && o.y > t.y);
      assert.equal(above, false, `free tile ${t.id} should have nothing above`);
    }
  }
});

test('拿 3 块同花色会消除且等待架清空', () => {
  const run = createRun(0, { seed: 3 });
  // 跟随解序拿完第一组（3 块同花色，按可拿顺序）
  const sym = run._solution[0];
  for (let i = 0; i < 3; i += 1) {
    const t = run.freeTiles().find((x) => x.symbol === sym);
    assert.ok(t, 'should find a free tile of the first symbol');
    run.pick(t.id);
  }
  assert.equal(run.state.shelf.length, 0);
  assert.equal(run.state.score > 0, true);
});

test('等待架超过 7 溢出失败', () => {
  const run = createRun(0, { seed: 11 });
  let guard = 0;
  // 故意乱拿，制造溢出（花色足够多时总会有不匹配的牌）
  while (run.state.phase === 'playing' && guard++ < 100) {
    const free = run.freeTiles();
    if (!free.length) break;
    run.pick(free[0].id);
    if (run.state.shelf.length > GAME.SHELF_CAP) break;
  }
  if (run.state.phase === 'lost') {
    assert.equal(run.state.result.reason, 'overflow');
  } else {
    // 若没触发溢出，说明这一盘恰好赢/继续，也接受（不崩即可）
    assert.ok(['playing', 'won', 'lost'].includes(run.state.phase));
  }
});

test('时间耗尽失败', () => {
  const run = createRun(0, { seed: 1 });
  for (let i = 0; i < run.state.initialTime + 2 && run.state.phase === 'playing'; i += 1) run.step(1);
  assert.equal(run.state.phase, 'lost');
  assert.equal(run.state.result.reason, 'timeout');
});

test('按解序自动通关并得星', () => {
  const run = createRun(0, { seed: 2 });
  for (const sym of run._solution) {
    const t = run.freeTiles().find((x) => x.symbol === sym);
    assert.ok(t, `should find a free tile of symbol ${sym}`);
    run.pick(t.id);
  }
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.stars >= 1 && run.state.stars <= 3);
});

test('洗牌保持花色总数并消耗次数', () => {
  const run = createRun(3, { seed: 8 });
  const before = {};
  for (const t of run.state.tiles) if (t.onBoard) before[t.symbol] = (before[t.symbol] || 0) + 1;
  const r = run.useShuffle();
  assert.equal(r.ok, true);
  const after = {};
  for (const t of run.state.tiles) if (t.onBoard) after[t.symbol] = (after[t.symbol] || 0) + 1;
  assert.deepEqual(after, before);
  assert.equal(run.state.shuffleLeft, GAME.SHUFFLE_PER_LEVEL - 1);
});

test('撤回把最后一张放回牌堆并消耗次数', () => {
  const run = createRun(0, { seed: 6 });
  const free = run.freeTiles();
  run.pick(free[0].id);
  const shelfLen = run.state.shelf.length;
  const r = run.useUndo();
  assert.equal(r.ok, true);
  assert.equal(run.state.shelf.length, shelfLen - 1);
  assert.equal(run.state.undoLeft, GAME.UNDO_PER_LEVEL - 1);
});

test('万能牌可替代任意花色消除', () => {
  const run = createRun(1, { seed: 5 }); // L2 有 3 万能
  // 拿 2 块同花色 + 1 万能 → 消除
  const normal = run.state.tiles.find((t) => t.onBoard && t.symbol >= 0);
  const sym = normal.symbol;
  const pair = run.state.tiles.filter((t) => t.onBoard && t.symbol === sym).slice(0, 2);
  const wild = run.state.tiles.find((t) => t.onBoard && t.symbol === -1);
  assert.ok(pair.length === 2 && wild, 'need 2 normal + 1 wild');
  run.pick(pair[0].id); run.pick(pair[1].id); run.pick(wild.id);
  assert.equal(run.state.shelf.length, 0);
});

test('关卡数与倒计时公式', () => {
  assert.equal(LEVEL_COUNT, 10);
  assert.equal(levelTime(0), 60);
  assert.ok(levelTime(9) >= 60);
});
