import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { COLOR, COMBO } from '../config/gameplay.js';

function makeRun(seed = 1) {
  return createRun({ seed });
}

function makeRing(colors) {
  return {
    id: 1000,
    worldY: 1,
    band: 1,
    cellsCount: colors.length,
    targetCells: 1,
    cellW: WORLD.WIDTH / colors.length,
    colors,
    whiteProb: 0,
    woodProb: 0,
    xOffset: 0,
    moving: false,
    moveSpeed: 0,
    movePhase: 0,
    swap: false,
    swapEvery: 0,
    swapTimer: 0,
    resolved: false,
  };
}

function resetRing(run, colors) {
  run.rings = [makeRing(colors)];
  run.spawn.nextY = run.depth + 100000; // 阻止 step 再生成新环干扰
}

function drainAll(run) {
  const ev = run.drainEvents();
  return ev;
}

test('创建 run：phase=playing，ball 初始居中，band=1', () => {
  const r = makeRun();
  assert.equal(r.phase, 'playing');
  assert.equal(r.ball.x, 640);
  assert.equal(r.band, 1);
  assert.equal(r.dye, 0);
  assert.equal(r.score, 0);
});

test('转向：steerX 让 ball.x 逼近目标', () => {
  const r = makeRun();
  r.spawn.nextY = 1000000;
  r.rings = [];
  for (let i = 0; i < 30; i += 1) r.step({ steerX: 200 });
  assert.ok(r.ball.x < 640, `ball.x 应向左移动，实际 ${r.ball.x}`);
  assert.ok(r.ball.x >= 200 - 5);
});

test('边界：ball.x 不越出左右界', () => {
  const r = makeRun();
  r.spawn.nextY = 1000000;
  r.rings = [];
  for (let i = 0; i < 200; i += 1) r.step({ steerX: 0 });
  assert.ok(r.ball.x >= 0);
  for (let i = 0; i < 200; i += 1) r.step({ steerX: 1280 });
  assert.ok(r.ball.x <= WORLD.WIDTH);
});

test('同色环：穿过同色格得分并触发 ringClear', () => {
  const r = makeRun();
  resetRing(r, [0, 1]); // dye=0，格0 同色
  r.step({ steerX: 320 });
  const ev = drainAll(r);
  assert.equal(r.ringsCleared, 1);
  assert.equal(r.score, 1);
  assert.ok(ev.some((e) => e.type === 'ringClear' && e.kind === 'match'));
  assert.equal(r.phase, 'playing');
});

test('异色环：穿过异色格死亡', () => {
  const r = makeRun();
  resetRing(r, [1, 2]); // dye=0，格0 异色
  r.step({ steerX: 320 });
  const ev = drainAll(r);
  assert.equal(r.phase, 'dead');
  assert.ok(ev.some((e) => e.type === 'death'));
});

test('白环：万能安全并随机换色', () => {
  const r = makeRun();
  resetRing(r, [COLOR.WHITE, 0]);
  r.step({ steerX: 320 });
  const ev = drainAll(r);
  assert.equal(r.phase, 'playing');
  assert.equal(r.score, 1);
  assert.notEqual(r.dye, 0, '白环应换掉原色');
  assert.ok(r.dye >= 0 && r.dye < COLOR.COUNT);
  assert.ok(ev.some((e) => e.type === 'dyeShift'));
});

test('木环：跳板救急不得分不换色', () => {
  const r = makeRun();
  resetRing(r, [COLOR.WOOD, 0]);
  r.step({ steerX: 320 });
  const ev = drainAll(r);
  assert.equal(r.phase, 'playing');
  assert.equal(r.score, 0);
  assert.equal(r.dye, 0);
  assert.equal(r.woodSaves, 1);
  assert.ok(ev.some((e) => e.type === 'ringBounce'));
});

test('连吃 5 同色触发彩虹糖雨', () => {
  const r = makeRun();
  const events = [];
  for (let k = 0; k < 5; k += 1) {
    resetRing(r, [0, 1]);
    r.step({ steerX: 320 });
    events.push(...drainAll(r));
  }
  assert.equal(r.stats.rainbowCount, 1);
  assert.ok(events.some((e) => e.type === 'rainbow'));
  assert.equal(r.score, 8); // 5×1 + 彩虹奖励 3
});

test('带推进：每 5 环进一带并轮转颜色', () => {
  const r = makeRun();
  const events = [];
  for (let k = 0; k < 6; k += 1) {
    resetRing(r, [r.dye, (r.dye + 1) % COLOR.COUNT]);
    r.step({ steerX: 320 });
    events.push(...drainAll(r));
  }
  assert.equal(r.band, 2);
  assert.ok(events.some((e) => e.type === 'bandEnter' && e.band === 2));
  assert.ok(events.some((e) => e.type === 'dyeShift'));
});

test('连击窗口超时重置 combo', () => {
  const r = makeRun();
  resetRing(r, [0, 1]);
  r.step({ steerX: 320 });
  drainAll(r);
  assert.equal(r.combo, 1);
  // 清空环，快进 7 秒（> COMBO.WINDOW=6s）
  r.rings = [];
  r.spawn.nextY = 1000000;
  for (let i = 0; i < 60 * 7; i += 1) r.step({ steerX: 320 });
  const ev = drainAll(r);
  assert.equal(r.combo, 0);
  assert.ok(ev.some((e) => e.type === 'comboBreak'));
});

test('getHud 返回关键字段', () => {
  const r = makeRun();
  const hud = r.getHud();
  assert.ok('score' in hud);
  assert.ok('band' in hud);
  assert.ok('combo' in hud);
  assert.ok('dye' in hud);
  assert.ok('sameStreak' in hud);
  assert.ok('nextBandRings' in hud);
});

test('drainEvents 会清空事件队列', () => {
  const r = makeRun();
  resetRing(r, [0, 1]);
  r.step({ steerX: 320 });
  const first = r.drainEvents();
  assert.ok(first.length > 0);
  assert.equal(r.drainEvents().length, 0);
});

test('depth 随 step 递增（世界向下滚动）', () => {
  const r = makeRun();
  r.rings = [];
  r.spawn.nextY = 1000000;
  const d0 = r.depth;
  for (let i = 0; i < 60; i += 1) r.step({ steerX: 640 });
  assert.ok(r.depth > d0);
});

test('无输入（steerX=null）球不移动', () => {
  const r = makeRun();
  r.rings = [];
  r.spawn.nextY = 1000000;
  const x0 = r.ball.x;
  for (let i = 0; i < 30; i += 1) r.step({ steerX: null });
  assert.equal(r.ball.x, x0);
});
