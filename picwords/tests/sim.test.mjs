import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, currentWord, tapTile, tapSlot, clearSlots, useHint, nextLevel, getHud, LEVEL_COUNT } from '../src/game/sim.js';
import { PICTURES } from '../config/pictures.js';
import { RULES, CONFIG } from '../config/game.config.js';

function solve(run) {
  for (const letter of run.word) {
    const idx = run.tiles.findIndex((t) => !t.used && t.letter === letter);
    tapTile(run, idx);
  }
}

test('初始化：单词与图一致、字母块=词长+额外、槽空', () => {
  const run = createRun({ level: 0, seed: 1 });
  assert.equal(run.word, PICTURES[0].word);
  assert.equal(run.tiles.length, run.word.length + RULES.extraLetters);
  assert.ok(run.slots.every((s) => s === null));
});

test('字母块包含单词全部字母（多重集）', () => {
  const run = createRun({ level: 14, seed: 1 }); // ELEPHANT
  const pool = {};
  for (const t of run.tiles) pool[t.letter] = (pool[t.letter] || 0) + 1;
  for (const ch of run.word) {
    assert.ok(pool[ch] > 0, `含字母 ${ch}`);
    pool[ch] -= 1;
  }
});

test('点字母块：填入空槽并标记已用', () => {
  const run = createRun({ level: 0, seed: 1 });
  tapTile(run, 0);
  assert.equal(run.slots[0], 0);
  assert.equal(run.tiles[0].used, true);
});

test('点已填槽：移除字母', () => {
  const run = createRun({ level: 0, seed: 1 });
  tapTile(run, 0);
  tapSlot(run, 0);
  assert.equal(run.slots[0], null);
  assert.equal(run.tiles[0].used, false);
});

test('拼对单词 → 完成得分', () => {
  const run = createRun({ level: 0, seed: 1 });
  solve(run);
  assert.equal(run.phase, 'clear');
  assert.equal(run.score, RULES.scorePerWord);
  assert.equal(currentWord(run), run.word);
});

test('拼错 → 未完成', () => {
  const run = createRun({ level: 0, seed: 1 });
  // 故意填错顺序
  const wrongTiles = run.tiles.slice(0, run.word.length);
  wrongTiles.forEach((t, i) => tapTile(run, run.tiles.indexOf(t)));
  if (currentWord(run) !== run.word) {
    assert.equal(run.phase, 'playing');
  }
});

test('提示：填入正确字母、扣次数', () => {
  const run = createRun({ level: 0, seed: 1 });
  const h = useHint(run);
  assert.ok(h);
  assert.equal(run.tiles[run.slots[h.slot]].letter, run.word[h.slot]);
  assert.equal(run.hintsUsed, 1);
});

test('清空：重置所有槽', () => {
  const run = createRun({ level: 0, seed: 1 });
  tapTile(run, 0);
  tapTile(run, 1);
  clearSlots(run);
  assert.ok(run.slots.every((s) => s === null));
  assert.ok(run.tiles.every((t) => !t.used));
});

test('下一关：推进并保留分数', () => {
  const run = createRun({ level: 0, seed: 1 });
  run.score = 100;
  nextLevel(run);
  assert.equal(run.level, 1);
  assert.equal(run.score, 100);
  assert.equal(run.phase, 'playing');
});

test('配置默认值：16 图 / en+zh', () => {
  assert.equal(LEVEL_COUNT, 16);
  assert.equal(LEVEL_COUNT, PICTURES.length);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ level: 0, seed: 1 })).wordLen, PICTURES[0].word.length);
});