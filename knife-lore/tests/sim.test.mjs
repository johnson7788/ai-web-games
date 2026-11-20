import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, computeSafeArc } from '../src/game/sim.js';
import { STEP, KNIFE, POST, normalizeDeg, angDist } from '../config/gameplay.js';
import { LEVELS, LEVEL_COUNT, levelAt } from '../config/levels.js';

// ---------- 工具 ----------
function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

function throwAndLand(run, input = { throw: true }) {
  run.step(input);
  for (let i = 0; i < 40 && run.flying; i += 1) run.step({});
  return run.drainEvents();
}

function types(events) {
  return events.map((e) => e.type);
}

// ---------- 契约 / 初始状态 ----------
test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1, levelIndex: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.level.index, 1);
  assert.equal(run.knivesRemaining, 5);
  assert.equal(run.score, 0);
  assert.equal(run.stuck.length, 0);
  assert.equal(run.posts.length, 1);
  assert.equal(run.zantieCharges, 0);
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2, levelIndex: 2 });
  const hud = run.getHud();
  assert.deepEqual(Object.keys(hud).sort(), [
    'knives', 'knivesRemaining', 'level', 'pack', 'phase', 'safeArc', 'score', 'zantieActive', 'zantieCharges',
  ]);
  assert.equal(hud.level, 2);
  assert.equal(hud.pack, 'bamboo');
  assert.equal(hud.knives, 6);
});

test('同 seed 同输入 → 同结果（随机种子确定性）', () => {
  const a = createRun({ seed: 42, levelIndex: 1 });
  const b = createRun({ seed: 42, levelIndex: 1 });
  stepN(a, 120, { throw: false });
  stepN(b, 120, { throw: false });
  assert.equal(a.posts[0].angle, b.posts[0].angle);
  assert.equal(a.time, b.time);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

// ---------- 掷刀 / 插刀 ----------
test('掷刀：spawn flying + throw 事件，一次只一把', () => {
  const run = createRun({ seed: 3, levelIndex: 1 });
  run.step({ throw: true });
  assert.ok(run.flying);
  assert.equal(run.flying.postIndex, 0);
  assert.ok(types(run.drainEvents()).includes('throw'));

  run.step({ throw: true }); // 飞行中再掷被忽略
  assert.equal(run.stuck.length, 0);
  assert.equal(run.flying.progress > 0, true);
});

test('插刀：飞行到站后 stuck + knifeStick 事件', () => {
  const run = createRun({ seed: 4, levelIndex: 1 });
  const evs = throwAndLand(run);
  assert.equal(run.stuck.length, 1);
  assert.equal(run.knivesThrown, 1);
  assert.equal(run.knivesRemaining, 4);
  assert.equal(run.score, KNIFE.SCORE);
  assert.ok(types(evs).includes('knifeStick'));
  assert.ok(types(evs).includes('throw'));
});

test('崩刀：撞到已插刀 → phase failed + knifeBreak + death', () => {
  const run = createRun({ seed: 5, levelIndex: 1 });
  run.posts[0].speedDeg = 0; // 冻结旋转，制造确定碰撞
  throwAndLand(run); // 第一刀插在桩底
  const stuckAngle = run.stuck[0].localAngle;
  run.stuck.push({ id: 999, localAngle: stuckAngle, postIndex: 0 }); // 同角度已插刀
  const before = run.stuck.length;
  const evs = throwAndLand(run);
  assert.equal(run.phase, 'failed');
  assert.equal(run.stuck.length, before);
  assert.ok(types(evs).includes('knifeBreak'));
});

test('过关：集满刀数 → phase cleared + levelCleared', () => {
  const run = createRun({ seed: 6, levelIndex: 1 });
  let evs = [];
  for (let i = 0; i < 5; i += 1) evs = throwAndLand(run);
  assert.equal(run.phase, 'cleared');
  assert.equal(run.knivesRemaining, 0);
  assert.ok(types(evs).includes('levelCleared'));
  assert.ok(run.score >= 5 * KNIFE.SCORE + 25);
});

test('通关：第 12 关集满 → phase won + gameWon', () => {
  const run = createRun({ seed: 7, levelIndex: 12 });
  let evs = [];
  for (let i = 0; i < 12; i += 1) {
    run.zantieActive = true; // 每刀必中安全，保证可通关
    evs = throwAndLand(run);
  }
  assert.equal(run.phase, 'won');
  assert.ok(types(evs).includes('gameWon'));
});

// ---------- 旋转 / 脉冲 / 反转 / 移动 ----------
test('桩旋转：角度按 speedDeg 推进', () => {
  const run = createRun({ seed: 8, levelIndex: 1 });
  stepN(run, 60); // 1s
  assert.ok(Math.abs(normalizeDeg(run.posts[0].angle) - 60) < 0.5, `angle=${run.posts[0].angle}`);
});

test('反转：dir 每 every 秒翻转', () => {
  const run = createRun({ seed: 9, levelIndex: 3 }); // reversal every 2.8s
  assert.equal(run.posts[0].dir, -1);
  stepN(run, Math.round(2.8 / STEP) + 2);
  assert.equal(run.posts[0].dir, 1);
});

test('脉冲：pulse 窗口内速度倍率生效', () => {
  const run = createRun({ seed: 10, levelIndex: 2 }); // pulse boost 1.8
  stepN(run, 2); // 进入 pulse 窗口（time < dur）
  const a = run.posts[0].angle;
  stepN(run, 10);
  const delta = Math.abs(normalizeDeg(run.posts[0].angle - a));
  // 60 tick 无脉冲应走 82*1s；这里 12 tick 带 boost 应明显快
  assert.ok(delta > 10, `delta=${delta}`);
});

test('移动桩：x 随正弦漂移', () => {
  const run = createRun({ seed: 11, levelIndex: 9 });
  const x0 = run.posts[0].x;
  stepN(run, 30);
  assert.notEqual(run.posts[0].x, x0);
});

// ---------- 双桩 / 对称加成 ----------
test('双桩：掷刀交替命中两桩', () => {
  const run = createRun({ seed: 12, levelIndex: 5 });
  assert.equal(run.posts.length, 2);
  throwAndLand(run);
  assert.equal(run.stuck[0].postIndex, 0);
  throwAndLand(run);
  assert.equal(run.stuck[1].postIndex, 1);
});

test('对称加成：两桩局部角度差 ≤15° 额外分', () => {
  const run = createRun({ seed: 13, levelIndex: 5 });
  // 冻结旋转，让两桩同角度，制造确定对称
  run.posts[0].speedDeg = 0;
  run.posts[1].speedDeg = 0;
  run.posts[1].angle = run.posts[0].angle;
  throwAndLand(run); // 第一刀插左桩
  const evs = throwAndLand(run); // 第二刀插右桩，同局部角 → 对称加成
  assert.ok(types(evs).includes('symBonus'));
  assert.equal(run.stats.symBonuses, 1);
});

// ---------- 斩铁 ----------
test('斩铁：第 3 关解锁 1 次，使用后吸附到安全空档', () => {
  const run = createRun({ seed: 14, levelIndex: 3 });
  assert.equal(run.zantieCharges, 1);
  assert.equal(run.useZantie(), true);
  assert.equal(run.zantieCharges, 0);
  assert.equal(run.zantieActive, true);
  // 斩铁掷刀必然安全插入
  throwAndLand(run);
  assert.equal(run.stuck.length, 1);
  assert.equal(run.zantieActive, false);
});

test('斩铁：无 charge 时 useZantie 返回 false', () => {
  const run = createRun({ seed: 15, levelIndex: 1 });
  assert.equal(run.zantieCharges, 0);
  assert.equal(run.useZantie(), false);
});

// ---------- 安全空档 ----------
test('computeSafeArc：无刀时 360°', () => {
  const run = createRun({ seed: 16, levelIndex: 1 });
  const arc = computeSafeArc(run, run.posts[0]);
  assert.equal(arc.width, 360);
  assert.equal(arc.center, 0);
});

test('computeSafeArc：有刀时找最大空档中心', () => {
  const run = createRun({ seed: 17, levelIndex: 1 });
  run.stuck.push({ id: 1, localAngle: 0, postIndex: 0 });
  run.stuck.push({ id: 2, localAngle: 90, postIndex: 0 });
  const arc = computeSafeArc(run, run.posts[0]);
  assert.equal(arc.width, 270);
  assert.equal(normalizeDeg(arc.center), -135);
});

// ---------- 角度工具 ----------
test('normalizeDeg 归一到 (-180,180]', () => {
  assert.equal(normalizeDeg(0), 0);
  assert.equal(normalizeDeg(190), -170);
  assert.equal(normalizeDeg(-190), 170);
});

test('angDist 最小夹角', () => {
  assert.equal(angDist(10, 20), 10);
  assert.equal(angDist(170, -170), 20);
});

// ---------- 关卡配置 ----------
test('关卡配置：12 关、刀数 5→12 递增、三场景包完整', () => {
  assert.equal(LEVEL_COUNT, 12);
  assert.equal(levelAt(1).knives, 5);
  assert.equal(levelAt(12).knives, 12);
  const packs = new Set(LEVELS.map((l) => l.pack));
  assert.deepEqual([...packs].sort(), ['bamboo', 'dusk', 'snow']);
});

test('每关都有新元素且互不重复', () => {
  const elements = LEVELS.map((l) => {
    const e = [];
    if (l.shape === 'square') e.push('square');
    if (l.shape === 'dual') e.push('dual');
    if (l.shape === 'moving') e.push('moving');
    if (l.pulse) e.push('pulse');
    if (l.reversal) e.push('reversal');
    return e.join('+') || 'circle-basic';
  });
  // 第 1 关基础圆桩，其余均不同组合（至少确保 12 关组合互不重复）
  assert.equal(new Set(elements).size, elements.length);
});
