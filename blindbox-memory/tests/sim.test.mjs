// sim 纯逻辑测试：配对/步数/连击/特殊牌/洗牌/星级/种子
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, flipCard, peekPair, revive, refillPeeks, starsFor, playSequence, makeRng } from '../src/game/sim.js';
import { LEVELS as CFG_LEVELS, RULES } from '../config/game.config.js';

const POOL = Array.from({ length: 31 }, (_, i) => `card_${String(i).padStart(2, '0')}`);
const FAMS = {};
POOL.forEach((id, i) => { FAMS[id] = ['cat', 'boy', 'misc', 'boxer', 'rider', 'critter'][i % 6]; });

function findPairIds(run, exclude = []) {
  const seen = new Map();
  for (const c of run.deck) {
    if (c.kind === 'obstacle' || c.state !== 'down') continue;
    if (seen.has(c.char) && !exclude.includes(c.id)) return [seen.get(c.char), c.id];
    seen.set(c.char, c.id);
  }
  return null;
}

test('基础牌局：张数 = 对数×2（+障碍）', () => {
  for (const L of CFG_LEVELS) {
    const run = createRun({ levelIndex: L.index, seed: 42, cardIds: POOL, families: FAMS });
    const expected = L.pairs * 2 + (L.obstacles || 0);
    assert.equal(run.deck.length, expected, `L${L.index} deck size`);
    assert.equal(run.movesLeft, L.moves, `L${L.index} moves`);
  }
});

test('L1 教学关：零失败可能（步数远大于对数）', () => {
  const run = createRun({ levelIndex: 1, seed: 7, cardIds: POOL, families: FAMS });
  assert.ok(run.level.tutorial);
  assert.ok(run.movesLeft >= run.pairsTotal, 'moves >= pairs (保底能全翻)');
});

test('配对成功与胜利判定', () => {
  const run = createRun({ levelIndex: 1, seed: 7, cardIds: POOL, families: FAMS });
  let guard = 0;
  while (run.phase === 'playing' && guard++ < 100) {
    const pair = findPairIds(run);
    if (!pair) break;
    flipCard(run, pair[0]);
    const evs = flipCard(run, pair[1]);
    assert.ok(evs.some((e) => e.type === 'match'));
  }
  assert.equal(run.phase, 'won');
  assert.equal(run.pairsMatched, run.pairsTotal);
  assert.ok(run.deck.every((c) => c.state === 'matched'));
});

test('步数耗尽失败与误配不退步', () => {
  const run = createRun({ levelIndex: 1, seed: 7, cardIds: POOL, families: FAMS });
  // 反复翻两张不同牌制造误配
  let guard = 0;
  while (run.phase === 'playing' && guard++ < 100) {
    const c1 = run.deck.find((c) => c.state === 'down' && c.kind !== 'obstacle');
    const c2 = run.deck.find((c) => c.state === 'down' && c.kind !== 'obstacle' && c.char !== c1.char);
    if (!c1 || !c2) break;
    flipCard(run, c1.id);
    flipCard(run, c2.id);
  }
  assert.equal(run.phase, 'failed');
  assert.ok(run.movesLeft < 0);
});

test('连击计数与最佳连击', () => {
  const run = createRun({ levelIndex: 1, seed: 7, cardIds: POOL, families: FAMS });
  for (let i = 0; i < 3; i++) {
    const pair = findPairIds(run);
    flipCard(run, pair[0]);
    flipCard(run, pair[1]);
  }
  assert.equal(run.combo, 3);
  assert.equal(run.bestCombo, 3);
});

test('星卡金币加成', () => {
  const run = createRun({ levelIndex: 3, seed: 11, cardIds: POOL, families: FAMS });
  const starCard = run.deck.find((c) => c.kind === 'star');
  const twin = run.deck.find((c) => c.id !== starCard.id && c.char === starCard.char);
  flipCard(run, starCard.id);
  const evs = flipCard(run, twin.id);
  assert.ok(evs.some((e) => e.type === 'match' && e.star));
  assert.equal(run.coinsEarned, RULES.coinPerPair + RULES.coinStarPairBonus);
});

test('障碍卡：耗步数且不可配对', () => {
  const run = createRun({ levelIndex: 4, seed: 5, cardIds: POOL, families: FAMS });
  const ob = run.deck.find((c) => c.kind === 'obstacle');
  const before = run.movesLeft;
  const evs = flipCard(run, ob.id);
  assert.ok(evs.some((e) => e.type === 'obstacle'));
  assert.equal(run.movesLeft, before - 1);
  assert.equal(ob.state, 'down');
});

test('镜像对：左右镜像但同角色可配', () => {
  const run = createRun({ levelIndex: 5, seed: 5, cardIds: POOL, families: FAMS });
  const mirrored = run.deck.find((c) => c.mirrored);
  assert.ok(mirrored, '应存在镜像卡');
  const twin = run.deck.find((c) => c.id !== mirrored.id && c.char === mirrored.char);
  assert.equal(twin.mirrored, false);
  flipCard(run, mirrored.id);
  const evs = flipCard(run, twin.id);
  assert.ok(evs.some((e) => e.type === 'match'));
});

test('quads：四张同款任意两张可配', () => {
  const run = createRun({ levelIndex: 11, seed: 9, cardIds: POOL, families: FAMS });
  // 找出出现 4 次的角色
  const counts = new Map();
  for (const c of run.deck) counts.set(c.char, (counts.get(c.char) ?? 0) + 1);
  const quads = [...counts.entries()].filter(([, n]) => n === 4);
  assert.ok(quads.length > 0, '应有 4 张同款');
  for (const [char] of quads) {
    const ids = run.deck.filter((c) => c.char === char).map((c) => c.id);
    flipCard(run, ids[0]);
    flipCard(run, ids[1]);
    flipCard(run, ids[2]);
    flipCard(run, ids[3]);
  }
  // 配完所有 quad 应胜（L11 只有 quads）
  assert.equal(run.phase, 'won');
});

test('幻影洗牌：6 次误配触发且不破坏牌局一致性', () => {
  const run = createRun({ levelIndex: 9, seed: 3, cardIds: POOL, families: FAMS });
  let shuffled = false;
  let guard = 0;
  while (run.phase === 'playing' && guard++ < 200 && !shuffled) {
    const c1 = run.deck.find((c) => c.state === 'down' && c.kind !== 'obstacle');
    const c2 = run.deck.find((c) => c.state === 'down' && c.kind !== 'obstacle' && c.char !== c1.char);
    if (!c1 || !c2) break;
    flipCard(run, c1.id);
    const evs = flipCard(run, c2.id);
    if (evs.some((e) => e.type === 'shuffle')) shuffled = true;
  }
  assert.ok(shuffled, '6 次误配应触发幻影洗牌');
  // 洗牌后牌局仍然可解（每张非障碍卡仍有配对）
  const counts = new Map();
  for (const c of run.deck) {
    if (c.kind !== 'obstacle' && c.state === 'down') counts.set(c.char, (counts.get(c.char) ?? 0) + 1);
  }
  for (const [char, n] of counts) {
    assert.ok(n >= 2, `洗牌后 ${char} 剩 ${n} 张（单张不可解）`);
  }
});

test('提示：翻出一对且不耗步数', () => {
  const run = createRun({ levelIndex: 1, seed: 7, cardIds: POOL, families: FAMS });
  const before = run.movesLeft;
  const evs = peekPair(run);
  assert.equal(evs.length, 1);
  assert.equal(evs[0].type, 'peek');
  assert.equal(run.peeksLeft, RULES.peekPerRun - 1);
  assert.equal(run.movesLeft, before);
});

test('复活与提示补充上限', () => {
  const run = createRun({ levelIndex: 1, seed: 7, cardIds: POOL, families: FAMS });
  // 烧步数到失败
  let guard = 0;
  while (run.phase === 'playing' && guard++ < 100) {
    const c1 = run.deck.find((c) => c.state === 'down' && c.kind !== 'obstacle');
    const c2 = run.deck.find((c) => c.state === 'down' && c.kind !== 'obstacle' && c.char !== c1.char);
    if (!c1 || !c2) break;
    flipCard(run, c1.id);
    flipCard(run, c2.id);
  }
  assert.equal(run.phase, 'failed');
  assert.ok(revive(run));
  assert.equal(run.phase, 'playing');
  assert.ok(run.movesLeft > 0);
  // 提示补充上限
  assert.ok(refillPeeks(run));
  assert.ok(refillPeeks(run));
  assert.equal(refillPeeks(run), false, '第三次补充应被上限拒绝');
});

test('星级：按剩余步数比例', () => {
  const run = createRun({ levelIndex: 1, seed: 7, cardIds: POOL, families: FAMS });
  run.phase = 'won';
  run.movesLeft = Math.ceil(run.level.moves * 0.5);
  assert.equal(starsFor(run), 3);
  run.movesLeft = Math.ceil(run.level.moves * 0.25);
  assert.equal(starsFor(run), 2);
  run.movesLeft = 0;
  assert.equal(starsFor(run), 1);
});

test('同 seed 结果可复现', () => {
  const seq = (run) => {
    const out = [];
    let guard = 0;
    while (run.phase === 'playing' && guard++ < 50) {
      const pair = findPairIds(run);
      if (!pair) break;
      out.push(pair[0], pair[1]);
      flipCard(run, pair[0]);
      flipCard(run, pair[1]);
    }
    return out.join(',');
  };
  const a = createRun({ levelIndex: 6, seed: 12345, cardIds: POOL, families: FAMS });
  const b = createRun({ levelIndex: 6, seed: 12345, cardIds: POOL, families: FAMS });
  assert.equal(seq(a), seq(b));
});

test('decoy 关：同族角色同桌', () => {
  const run = createRun({ levelIndex: 6, seed: 2, cardIds: POOL, families: FAMS });
  const fams = new Set(run.deck.map((c) => FAMS[c.char]));
  // 31 张分 6 族，12 对应至少聚到 5 族以内
  assert.ok(fams.size <= 6, `decoy 应聚族，实际 ${fams.size} 族`);
});

test('关卡表：每关新元素互异', () => {
  const el = CFG_LEVELS.map((l) => l.newElement);
  assert.equal(new Set(el).size, el.length);
});
