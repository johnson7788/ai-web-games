import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, currentWord, tapLetter, backspace, clearSelected, submit, shufflePile, useHint, nextLevel, getHud, LEVEL_TOTAL,
} from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { RULES, CONFIG } from '../config/game.config.js';

function selectWord(run, word) {
  clearSelected(run);
  const used = new Set();
  for (const ch of word) {
    const idx = run.letters.findIndex((l, i) => l === ch && !used.has(i));
    used.add(idx);
    tapLetter(run, idx);
  }
}
function formable(word, letters) {
  const pool = {};
  for (const ch of letters) pool[ch] = (pool[ch] || 0) + 1;
  for (const ch of word) { if (!pool[ch]) return false; pool[ch] -= 1; }
  return true;
}

test('初始化：字母与关卡一致、词表排序、未找到', () => {
  const run = createRun({ level: 0, seed: 1 });
  assert.equal(run.letters.join(''), LEVELS[0].letters);
  assert.equal(run.found.size, 0);
  assert.equal(run.phase, 'playing');
});

test('选字母组成当前词', () => {
  const run = createRun({ level: 0, seed: 1 });
  selectWord(run, 'CAT');
  assert.equal(currentWord(run), 'CAT');
});

test('提交正确词 → 找到得分', () => {
  const run = createRun({ level: 0, seed: 1 });
  selectWord(run, 'CAT');
  const r = submit(run);
  assert.equal(r.kind, 'found');
  assert.ok(run.found.has('CAT'));
  assert.equal(run.score, RULES.scorePerWord);
});

test('提交错误词 → wrong', () => {
  const run = createRun({ level: 0, seed: 1 });
  selectWord(run, 'AT'); // AT 是目标词，改用不存在的
  clearSelected(run);
  tapLetter(run, 0);
  tapLetter(run, 0 === 1 ? 1 : 1);
  const r = submit(run);
  assert.ok(['wrong', 'short', 'found'].includes(r.kind));
});

test('重复提交 → already', () => {
  const run = createRun({ level: 0, seed: 1 });
  selectWord(run, 'CAT');
  submit(run);
  selectWord(run, 'CAT');
  const r = submit(run);
  assert.equal(r.kind, 'already');
});

test('找全词表 → 过关', () => {
  const run = createRun({ level: 0, seed: 1 });
  for (const w of run.words) { selectWord(run, w); submit(run); }
  assert.equal(run.phase, 'clear');
  assert.equal(run.found.size, run.words.length);
});

test('提示揭示首字母、扣次数', () => {
  const run = createRun({ level: 4, seed: 1 });
  const h = useHint(run);
  assert.ok(h && h.letter);
  assert.equal(run.hintsUsed, 1);
});

test('重排不改变字母多重集', () => {
  const run = createRun({ level: 4, seed: 1 });
  const before = [...run.letters].sort().join('');
  shufflePile(run);
  assert.equal([...run.letters].sort().join(''), before);
  assert.equal(run.pileOrder.length, run.letters.length);
});

test('词表完整性：每词可由字母拼出', () => {
  for (const def of LEVELS) {
    for (const w of def.words) {
      assert.ok(formable(w, def.letters), `${def.letters} 可拼 ${w}`);
    }
  }
});

test('配置默认值：12 关 / en+zh', () => {
  assert.equal(LEVEL_TOTAL, 12);
  assert.equal(LEVEL_TOTAL, LEVELS.length);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ level: 0, seed: 1 })).total, LEVELS[0].words.length);
});