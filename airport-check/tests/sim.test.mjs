import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, generatePassenger, decide, advance, nextShift, violationChance, getHud,
} from '../src/game/sim.js';
import { RULES, CONFIG, TODAY } from '../config/game.config.js';

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const cleanP = { clean: true, violations: [] };
const badP = { clean: false, violations: ['contraband'] };

test('初始化：班次 1、0 失误、有旅客、playing', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.shift, 1);
  assert.equal(run.strikes, 0);
  assert.ok(run.passenger && run.passenger.passport);
  assert.equal(run.phase, 'playing');
});

test('生成：合规旅客姓名一致/未过期/无违禁', () => {
  // 找一个合规旅客（seed 扫描）
  let clean = null;
  for (let s = 1; s < 200 && !clean; s += 1) {
    const p = generatePassenger(rng(s), 1);
    if (p.clean) clean = p;
  }
  assert.ok(clean, '应能生成合规旅客');
  assert.equal(clean.passport.name, clean.boarding.name, '姓名一致');
  assert.ok(clean.passport.expiry > TODAY, '未过期');
  assert.equal(clean.luggage.contraband, false, '无违禁');
  assert.deepEqual(clean.violations, []);
});

test('生成：同 seed 可复现', () => {
  const a = generatePassenger(rng(42), 1);
  const b = generatePassenger(rng(42), 1);
  assert.deepEqual(a, b);
});

test('判定：合规放行 → 正确得分', () => {
  const run = createRun({ seed: 1 });
  run.passenger = cleanP;
  const r = decide(run, true);
  assert.equal(r.correct, true);
  assert.equal(run.score, RULES.scorePerCorrect);
  assert.equal(run.strikes, 0);
});

test('判定：违规拒绝 → 正确', () => {
  const run = createRun({ seed: 1 });
  run.passenger = badP;
  const r = decide(run, false);
  assert.equal(r.correct, true);
});

test('判定：违规放行 / 合规拒绝 → 失误', () => {
  const run = createRun({ seed: 1 });
  run.passenger = badP;
  assert.equal(decide(run, true).correct, false);
  assert.equal(run.strikes, 1);
  run.passenger = cleanP;
  assert.equal(decide(run, false).correct, false);
  assert.equal(run.strikes, 2);
});

test('三次失误 → over', () => {
  const run = createRun({ seed: 1 });
  run.passenger = badP;
  decide(run, true);
  decide(run, true);
  const r = decide(run, true);
  assert.equal(r.gameOver, true);
  assert.equal(run.phase, 'over');
  assert.equal(run.strikes, RULES.maxStrikes);
});

test('满班次正确 → clear，下一班难度更高', () => {
  const run = createRun({ seed: 1 });
  run.passenger = cleanP;
  for (let i = 0; i < RULES.shiftSize; i += 1) decide(run, true);
  assert.equal(run.phase, 'clear');
  nextShift(run);
  assert.equal(run.shift, 2);
  assert.equal(run.processed, 0);
  assert.equal(run.phase, 'playing');
  assert.ok(violationChance(2) > violationChance(1), '难度递增');
});

test('难度封顶：违规概率不超过上限', () => {
  assert.ok(violationChance(100) <= RULES.maxViolationChance);
  assert.equal(violationChance(100), RULES.maxViolationChance);
});

test('advance 仅在 playing 时换旅客', () => {
  const run = createRun({ seed: 1 });
  const before = run.passenger;
  advance(run);
  assert.notEqual(run.passenger, before, 'playing 时换旅客');
  run.phase = 'over';
  const frozen = run.passenger;
  advance(run);
  assert.equal(run.passenger, frozen, 'over 时不换');
});

test('配置默认值：3 失误 / en+zh / 班次 8 人', () => {
  assert.equal(RULES.maxStrikes, 3);
  assert.equal(RULES.shiftSize, 8);
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.equal(getHud(createRun({ seed: 1 })).shift, 1);
});