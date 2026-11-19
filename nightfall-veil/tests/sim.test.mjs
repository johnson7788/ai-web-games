import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, genEquation, computeStars, mulberry32 } from '../src/game/sim.js';
import { LEVELS } from '../config/levels.js';

function toPlaying(run) {
  run.state.phase = 'playing';
  run.state.subjects = [];
  run.state._lastCeil = Math.ceil(run.state.timeLeft);
}

test('createRun 初始为 countdown，且 level 为 1 基', () => {
  const run = createRun(0, { seed: 7 });
  assert.equal(run.state.phase, 'countdown');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.timeLeft, LEVELS[0].timeLimit);
});

test('倒计时结束后进入 playing 并发 start 事件', () => {
  const run = createRun(0, { seed: 1 });
  run.state.subjects = [];
  for (let i = 0; i < 120; i += 1) run.step(1 / 60);
  assert.equal(run.state.phase, 'playing');
  const types = run.drainEvents().map((e) => e.type);
  assert.ok(types.includes('start'), '应包含 start 事件');
});

test('mulberry32 同一 seed 可复现', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  for (let i = 0; i < 20; i += 1) assert.equal(a(), b());
});

test('genEquation 生成合法算式：结果非负且与字符串求值一致', () => {
  const rng = mulberry32(1234);
  const types = [[2, 1, 0.5], [3, 1, 0.5]];
  for (let i = 0; i < 200; i += 1) {
    const { subject, result } = genEquation(types, rng);
    assert.match(subject, /^\d+([+-]\d+)+$/);
    assert.equal(eval(subject), result); // 仅含数字与 +/-，安全
    assert.ok(result >= 0);
  }
});

test('answer 正确：消除匹配符文，rightCount+1，发 correct 事件', () => {
  const run = createRun(0, { seed: 3 });
  toPlaying(run);
  run.state.subjects.push({ id: 1, subject: '3+2', result: 5, x: 100, y: 100, golden: false });
  const res = run.answer(5);
  assert.equal(res.matched, true);
  assert.equal(run.state.rightCount, 1);
  assert.equal(run.state.subjects.length, 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'correct'));
});

test('answer 错误：errorCount+1，断连击，发 error 事件', () => {
  const run = createRun(0, { seed: 3 });
  toPlaying(run);
  run.state.combo = 3;
  const res = run.answer(99);
  assert.equal(res.matched, false);
  assert.equal(run.state.errorCount, 1);
  assert.equal(run.state.combo, 0);
  assert.ok(run.drainEvents().some((e) => e.type === 'error'));
});

test('连击：连续答对 combo 递增并发 combo 事件', () => {
  const run = createRun(0, { seed: 3 });
  toPlaying(run);
  run.state.subjects.push({ id: 1, subject: '3+2', result: 5, x: 100, y: 100, golden: false });
  run.answer(5);
  run.state.subjects.push({ id: 2, subject: '2+3', result: 5, x: 200, y: 100, golden: false });
  run.answer(5);
  assert.equal(run.state.combo, 2);
  assert.equal(run.state.maxCombo, 2);
  assert.ok(run.drainEvents().some((e) => e.type === 'combo' && e.combo === 2));
});

test('金色符文：答对 bonusCount+1 并发 bonus 事件', () => {
  const run = createRun(0, { seed: 3 });
  toPlaying(run);
  run.state.subjects.push({ id: 1, subject: '4+2', result: 6, x: 100, y: 100, golden: true });
  run.answer(6);
  assert.equal(run.state.bonusCount, 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'bonus'));
});

test('遗漏：越过结界线 missCount+1，maxMissCount=0 时立即失败', () => {
  const run = createRun(0, { seed: 3 });
  toPlaying(run);
  run.state.subjects.push({ id: 1, subject: '9+9', result: 18, x: 100, y: 559, golden: false });
  run.step(1 / 60);
  assert.equal(run.state.phase, 'lost');
  assert.ok(run.drainEvents().some((e) => e.type === 'lose'));
});

test('撑过时限：timeLeft 归零后获胜并发 win 事件', () => {
  const run = createRun(0, { seed: 3 });
  toPlaying(run);
  run.state.timeLeft = 0.01;
  run.step(0.1);
  assert.equal(run.state.phase, 'won');
  assert.ok(run.drainEvents().some((e) => e.type === 'win'));
});

test('星级：零遗漏零误输 = 3 星，有误输降为 2 星', () => {
  assert.equal(computeStars({ missCount: 0, errorCount: 0 }), 3);
  assert.equal(computeStars({ missCount: 0, errorCount: 1 }), 2);
  assert.equal(computeStars({ missCount: 1, errorCount: 0 }), 2);
  assert.equal(computeStars({ missCount: 1, errorCount: 1 }), 1);
});

test('submit 空输入为 no-op，非空输入按 parseInt 判定', () => {
  const run = createRun(0, { seed: 3 });
  toPlaying(run);
  assert.equal(run.submit().ok, false);
  run.state.subjects.push({ id: 1, subject: '2+2', result: 4, x: 100, y: 100, golden: false });
  run.typeDigit('4');
  const res = run.submit();
  assert.equal(res.matched, true);
  assert.equal(run.state.rightCount, 1);
});

test('typeDigit 最多 10 位，backspace 逐位删除', () => {
  const run = createRun(0, { seed: 3 });
  toPlaying(run);
  for (const d of ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0', '1']) run.typeDigit(d);
  assert.equal(run.state.input.length, 10);
  run.backspace();
  assert.equal(run.state.input, '123456789');
});

test('createRun 越界关卡被夹到 [0, LEVEL_COUNT-1]', () => {
  const run = createRun(999, { seed: 3 });
  assert.equal(run.state.level, LEVELS.length);
  const run2 = createRun(-5, { seed: 3 });
  assert.equal(run2.state.level, 1);
});
