import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, currentFlag, selectColor, paintBand, check, clearFlag, nextFlag, getHud, FLAG_COUNT,
} from '../src/game/sim.js';
import { FLAGS } from '../config/flags.js';
import { PALETTE, COLOR_KEYS, RULES, CONFIG } from '../config/game.config.js';

function paintCorrect(run) {
  const flag = currentFlag(run);
  flag.colors.forEach((color, i) => {
    selectColor(run, color);
    paintBand(run, i);
  });
}

test('初始化：色带未涂、playing、顺序为排列', () => {
  const run = createRun({ seed: 1 });
  const flag = currentFlag(run);
  assert.equal(run.painted.length, flag.colors.length);
  assert.ok(run.painted.every((x) => x === null));
  assert.equal(run.phase, 'playing');
  assert.deepEqual([...run.order].sort((a, b) => a - b), FLAGS.map((_, i) => i));
});

test('涂色：paintBand 设置颜色', () => {
  const run = createRun({ seed: 1 });
  selectColor(run, 'red');
  paintBand(run, 0);
  assert.equal(run.painted[0], 'red');
});

test('检查正确：全对 → 得分 + solved', () => {
  const run = createRun({ seed: 1 });
  paintCorrect(run);
  const r = check(run);
  assert.equal(r.correct, true);
  assert.equal(run.phase, 'correct');
  assert.equal(run.score, RULES.scorePerFlag);
  assert.equal(run.solved, 1);
});

test('检查错误：标记错误色带', () => {
  const run = createRun({ seed: 1 });
  const flag = currentFlag(run);
  // 全部涂成与正确答案不同的颜色
  const wrongColor = COLOR_KEYS.find((c) => c !== flag.colors[0]);
  flag.colors.forEach((_, i) => { selectColor(run, wrongColor); paintBand(run, i); });
  const r = check(run);
  assert.equal(r.correct, false);
  assert.ok(r.wrong.length >= 1);
  assert.equal(run.phase, 'playing');
});

test('清空：重置色带', () => {
  const run = createRun({ seed: 1 });
  selectColor(run, 'red');
  paintBand(run, 0);
  clearFlag(run);
  assert.ok(run.painted.every((x) => x === null));
});

test('下一面：推进顺序并重置', () => {
  const run = createRun({ seed: 1 });
  const first = run.order[0];
  paintCorrect(run);
  check(run);
  nextFlag(run);
  assert.equal(run.orderPos, 1);
  assert.notEqual(run.order[1], first);
  assert.equal(run.phase, 'playing');
  assert.ok(run.painted.every((x) => x === null));
});

test('涂完所有国旗 → done', () => {
  const run = createRun({ seed: 1 });
  for (let i = 0; i < FLAG_COUNT; i += 1) {
    paintCorrect(run);
    check(run);
    nextFlag(run);
  }
  assert.equal(run.phase, 'done');
  assert.equal(run.solved, FLAG_COUNT);
});

test('国旗库完整性：颜色合法、方向合法', () => {
  for (const flag of FLAGS) {
    assert.ok(['v', 'h'].includes(flag.orient), `${flag.country.en} 方向合法`);
    assert.ok(flag.colors.length >= 2);
    for (const c of flag.colors) assert.ok(PALETTE[c], `${flag.country.en} 颜色 ${c} 合法`);
  }
});

test('配置默认值：16 面 / en+zh', () => {
  assert.equal(FLAG_COUNT, 16);
  assert.equal(FLAG_COUNT, FLAGS.length);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).phase, 'playing');
});