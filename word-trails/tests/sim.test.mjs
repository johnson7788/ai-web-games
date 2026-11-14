import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, submitWord, useHint, shuffleRing, isComplete, computeStars, getHud, drainEvents, LEVEL_COUNT,
} from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';
import { RULES, CONFIG } from '../config/game.config.js';

function formable(word, letters) {
  const pool = {};
  for (const ch of letters) pool[ch] = (pool[ch] || 0) + 1;
  for (const ch of word) {
    if (!pool[ch]) return false;
    pool[ch] -= 1;
  }
  return true;
}

test('初始化：字母/排序词表/空进度/playing', () => {
  const run = createRun({ levelIndex: 0 });
  assert.deepEqual(run.letters, ['C', 'A', 'T']);
  assert.deepEqual(run.words, ['AT', 'ACT', 'CAT'], '按长度升序');
  assert.equal(run.found.size, 0);
  assert.equal(run.phase, 'playing');
});

test('拼对目标词：揭示并按字母计分', () => {
  const run = createRun({ levelIndex: 0 });
  const r = submitWord(run, 'cat'); // 大小写不敏感
  assert.equal(r.ok, true);
  assert.equal(r.kind, 'found');
  assert.ok(run.found.has('CAT'));
  assert.equal(r.gained, 3 * RULES.scorePerLetter, '3 字母 ×10');
  assert.equal(run.score, r.gained);
});

test('拼错（非目标词）：invalid 且连击归零', () => {
  const run = createRun({ levelIndex: 0 });
  submitWord(run, 'CAT');
  assert.equal(run.streak, 1);
  const r = submitWord(run, 'DOG');
  assert.equal(r.ok, false);
  assert.equal(r.kind, 'invalid');
  assert.equal(run.streak, 0, '错词重置连击');
});

test('重复词：already 不加分', () => {
  const run = createRun({ levelIndex: 0 });
  submitWord(run, 'CAT');
  const before = run.score;
  const r = submitWord(run, 'CAT');
  assert.equal(r.kind, 'already');
  assert.equal(run.score, before, '不重复加分');
});

test('太短：低于最小长度判 short', () => {
  const run = createRun({ levelIndex: 0 });
  const r = submitWord(run, 'C');
  assert.equal(r.kind, 'short');
  assert.equal(run.found.size, 0);
});

test('连击奖励：连续拼对得分递增', () => {
  const run = createRun({ levelIndex: 1 }); // EAT TEA ATE AT
  const a = submitWord(run, 'EAT');
  const b = submitWord(run, 'TEA');
  assert.equal(run.streak, 2);
  assert.equal(b.gained, 3 * RULES.scorePerLetter + RULES.streakBonus * 1, '第二词含连击奖励');
  assert.ok(b.gained > a.gained);
});

test('全部找到 → complete + clear 事件 + 星级', () => {
  const run = createRun({ levelIndex: 0 });
  for (const w of run.words) submitWord(run, w);
  assert.equal(isComplete(run), true);
  assert.equal(run.phase, 'complete');
  const ev = drainEvents(run);
  assert.ok(ev.some((e) => e.type === 'clear'), '有 clear 事件');
});

test('提示：揭示字母、扣次数、用尽返回 null', () => {
  const run = createRun({ levelIndex: 4 });
  for (let i = 0; i < RULES.hintLimit; i += 1) {
    const h = useHint(run);
    assert.ok(h, `第 ${i + 1} 次提示有效`);
    assert.ok(run.revealed.has(`${h.wordIdx}:${h.pos}`));
  }
  assert.equal(useHint(run), null, '提示用尽');
  assert.equal(run.hintsUsed, RULES.hintLimit);
});

test('重排：字母多重集不变', () => {
  const run = createRun({ levelIndex: 4, seed: 3 });
  const before = [...run.ring].sort().join('');
  shuffleRing(run);
  const after = [...run.ring].sort().join('');
  assert.equal(after, before, '重排不改变字母');
});

test('星级：0 提示三星 / 1 提示两星 / ≥2 一星', () => {
  assert.equal(computeStars(0), 3);
  assert.equal(computeStars(1), 2);
  assert.equal(computeStars(2), 1);
  assert.equal(computeStars(5), 1);
});

test('内容正确性：每关每个目标词都能由该关字母拼出', () => {
  for (const level of LEVELS) {
    for (const w of level.words) {
      assert.ok(formable(w, level.letters), `${level.letters} 应能拼出 ${w}`);
      assert.ok(w.length >= RULES.minWordLen, `${w} 长度达标`);
    }
  }
});

test('可复现：同 seed 重排结果一致', () => {
  const a = createRun({ levelIndex: 5, seed: 9 });
  const b = createRun({ levelIndex: 5, seed: 9 });
  shuffleRing(a);
  shuffleRing(b);
  assert.deepEqual(a.ring, b.ring);
});

test('配置默认值：关卡数 / en+zh / 计分常量', () => {
  assert.equal(LEVEL_COUNT, LEVELS.length);
  assert.ok(LEVEL_COUNT >= 12, '至少 12 关');
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(RULES.scorePerLetter, 10);
  assert.equal(getHud(createRun({ levelIndex: 0 })).total, 3);
});