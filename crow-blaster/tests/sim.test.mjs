import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import {
  LAUNCHER, BOLT, COMBO, GHOST_PENALTY, GOLDEN_AMMO_BONUS,
  CROWS, clampAim, comboMult, scoreFor, starsFor,
} from '../config/gameplay.js';
import { LEVEL_COUNT } from '../config/levels.js';

function types(evs) {
  return evs.map((e) => e.type);
}

function injectCrow(run, kind, x, y) {
  const c = CROWS[kind];
  const crow = {
    kind, x, y, vx: 0, vy: 0, r: c.r, hp: c.hp, maxHp: c.hp, points: c.score,
    dead: false, bornAt: run.time, wobble: 0,
  };
  run.crows.push(crow);
  return crow;
}

// 在乌鸦位置注入一枚静止能量弹并推进一帧，模拟命中
function hitCrow(run, kind, x, y) {
  injectCrow(run, kind, x, y);
  run.bolts.push({ x, y, vx: 0, vy: 0, r: BOLT.R, life: 1, dead: false });
  run.step({});
  return run.drainEvents();
}

test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.level, 1);
  assert.equal(run.score, 0);
  assert.equal(run.combo, 0);
  assert.equal(run.aim, 0);
  assert.ok(run.ammo > 0);
  assert.equal(run.crowsRemaining, 4);
  assert.ok(types(run.drainEvents()).includes('levelStart'));
});

test('getHud 契约字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  for (const k of ['phase', 'score', 'level', 'levelName', 'timeLeft', 'ammo', 'crowsRemaining', 'combo', 'aim', 'stars']) {
    assert.ok(k in hud, `缺字段 ${k}`);
  }
  assert.equal(hud.levelName, 'level.1');
  assert.equal(hud.crowsRemaining, 4);
});

test('同 seed 同输入 → 同结果（确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  for (let i = 0; i < 120; i += 1) {
    a.step({ aim: i % 2 ? 10 : -10, shoot: i % 30 === 0 });
    b.step({ aim: i % 2 ? 10 : -10, shoot: i % 30 === 0 });
  }
  assert.equal(a.time, b.time);
  assert.equal(a.crows.length, b.crows.length);
  assert.equal(a.pending.length, b.pending.length);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

test('发射消耗 1 发弹药并发 shot 事件', () => {
  const run = createRun({ seed: 3 });
  const before = run.ammo;
  run.step({ aim: 0, shoot: true });
  const evs = run.drainEvents();
  assert.equal(run.ammo, before - 1);
  assert.ok(types(evs).includes('shot'));
  assert.equal(run.bolts.length, 1);
});

test('冷却期内二次发射被拒绝', () => {
  const run = createRun({ seed: 4 });
  run.step({ aim: 0, shoot: true });
  const ammo = run.ammo;
  run.step({ aim: 0, shoot: true }); // 冷却中
  assert.equal(run.ammo, ammo, '冷却期内不应再扣弹药');
  assert.equal(run.bolts.length, 1, '冷却期内不应再生成能量弹');
});

test('瞄准角度被 clamp 到 ±60°', () => {
  assert.equal(clampAim(999), 60);
  assert.equal(clampAim(-999), -60);
  assert.equal(clampAim(30), 30);
  const run = createRun({ seed: 5 });
  run.step({ aim: 999, shoot: false });
  assert.equal(run.aim, 60);
});

test('命中普通乌鸦：hit + kill 事件，得分并连击 +1', () => {
  const run = createRun({ seed: 6 });
  const before = run.score;
  const evs = hitCrow(run, 'scout', 600, 200);
  assert.ok(types(evs).includes('hit'));
  assert.ok(types(evs).includes('kill'));
  assert.equal(run.combo, 1);
  assert.ok(run.score > before);
});

test('装甲乌鸦需 3 次命中才击杀', () => {
  const run = createRun({ seed: 7 });
  injectCrow(run, 'tank', 600, 200);
  for (let i = 0; i < 3; i += 1) {
    run.bolts.push({ x: 600, y: 200, vx: 0, vy: 0, r: BOLT.R, life: 1, dead: false });
    run.step({});
  }
  const evs = run.drainEvents();
  assert.equal(types(evs).filter((t) => t === 'tankHit').length, 3);
  assert.ok(types(evs).includes('kill'));
  assert.equal(run.crows[0].dead, true);
});

test('金鸦命中奖励弹药并发 goldenHit', () => {
  const run = createRun({ seed: 8 });
  const before = run.ammo;
  const evs = hitCrow(run, 'golden', 600, 200);
  assert.ok(types(evs).includes('goldenHit'));
  assert.ok(types(evs).includes('kill'));
  assert.equal(run.ammo, before + GOLDEN_AMMO_BONUS);
  assert.equal(run.stats.goldenHits, 1);
});

test('鬼鸦命中扣分且清空连击', () => {
  const run = createRun({ seed: 9 });
  run.combo = 5;
  const before = run.score;
  const evs = hitCrow(run, 'ghost', 600, 200);
  assert.ok(types(evs).includes('ghostHit'));
  assert.equal(run.combo, 0);
  assert.equal(run.score, Math.max(0, before - GHOST_PENALTY));
});

test('能量弹脱靶：miss 事件并清空连击', () => {
  const run = createRun({ seed: 10 });
  run.pending = [];
  run.crows = [];
  run.combo = 3;
  run.step({ aim: 0, shoot: true }); // 朝正上方发射，无乌鸦
  for (let i = 0; i < 400 && run.bolts.length; i += 1) run.step({});
  assert.equal(run.bolts.length, 0);
  assert.equal(run.combo, 0);
});

test('连击乘数公式封顶 ×3', () => {
  assert.equal(comboMult(0), 1);
  assert.equal(comboMult(20), COMBO.MULT_CAP);
  assert.ok(comboMult(5) > comboMult(2));
});

test('scoreFor：鬼鸦恒定负分，不受连击放大', () => {
  assert.equal(scoreFor('ghost', 1), -GHOST_PENALTY);
  assert.equal(scoreFor('ghost', 10), -GHOST_PENALTY);
  assert.ok(scoreFor('scout', 5) > scoreFor('scout', 1));
});

test('starsFor：命中率分档', () => {
  assert.equal(starsFor(0.9), 3);
  assert.equal(starsFor(0.5), 2);
  assert.equal(starsFor(0.1), 1);
});

test('击杀全部乌鸦 → levelClear 进入下一关', () => {
  const run = createRun({ seed: 11 });
  run.crowsRemaining = 0;
  run.levelShots = 10;
  run.levelHits = 8;
  run.step({});
  const evs = run.drainEvents();
  assert.ok(types(evs).includes('levelClear'));
  assert.equal(run.level, 2);
  assert.ok(run.stars > 0);
});

test('时间到未清空乌鸦 → 失败', () => {
  const run = createRun({ seed: 12 });
  run.crowsRemaining = 3;
  run.levelTime = run.timeLimit;
  run.step({});
  assert.equal(run.phase, 'dead');
  assert.ok(types(run.drainEvents()).includes('levelFail'));
});

test('最后一关清空 → gameWin 通关', () => {
  const run = createRun({ seed: 13, startLevel: LEVEL_COUNT });
  run.crowsRemaining = 0;
  run.levelShots = 10;
  run.levelHits = 10;
  run.step({});
  assert.equal(run.phase, 'won');
  assert.ok(types(run.drainEvents()).includes('gameWin'));
});

test('LEVEL_COUNT 为 5', () => {
  assert.equal(LEVEL_COUNT, 5);
});
