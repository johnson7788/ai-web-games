// tests/sim.test.mjs — 纯逻辑测试（node --test，不碰 DOM/window/localStorage）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { buildItem } from '../src/game/spawner.js';
import { mulberry32 } from '../src/game/rng.js';
import { WORLD, PLAYER, laneAt, gradeFor, clamp } from '../config/gameplay.js';
import { WAVES, waveAt } from '../config/levels.js';

function pushItem(run, over = {}) {
  const item = {
    id: run.nextId++,
    x: over.x ?? run.player.x,
    y: over.y ?? (WORLD.GROUND_Y - 30),
    vy: over.vy ?? 0,
    vx: 0,
    r: over.r ?? 13,
    kind: over.kind ?? 'bottle',
    def: { kind: 'small' },
    dmg: over.dmg ?? 1,
    isBig: !!over.isBig,
    isDrone: !!over.isDrone,
    tracking: !!over.tracking,
    startAt: 0,
    active: true,
    landed: false,
  };
  run.items.push(item);
  return item;
}

test('laneAt：左/中/右三列风向', () => {
  assert.equal(laneAt(100).dir, -1);
  assert.equal(laneAt(640).dir, 0);
  assert.equal(laneAt(1000).dir, 1);
});

test('gradeFor：风格分映射评级', () => {
  assert.equal(gradeFor(0), 'D');
  assert.equal(gradeFor(10), 'C');
  assert.equal(gradeFor(25), 'B');
  assert.equal(gradeFor(45), 'A');
  assert.equal(gradeFor(70), 'S');
});

test('clamp / 边界', () => {
  assert.equal(clamp(5, 0, 10), 5);
  assert.equal(clamp(-1, 0, 10), 0);
  assert.equal(clamp(11, 0, 10), 10);
});

test('createRun 初始状态', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.player.hp, 3);
  assert.equal(run.player.shield, 3);
  assert.equal(run.waveIndex, 1);
});

test('step：向右转向移动玩家', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  run.player.invulnUntil = Infinity;
  const x0 = run.player.x;
  for (let i = 0; i < 30; i += 1) run.step({ steerX: 900, block: false });
  assert.ok(run.player.x > x0);
});

test('step：玩家被钳制在边界内', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  run.player.invulnUntil = Infinity;
  for (let i = 0; i < 120; i += 1) run.step({ steerX: 2000, block: false });
  assert.ok(run.player.x <= WORLD.WIDTH - PLAYER.W / 2 + 1e-6);
  for (let i = 0; i < 240; i += 1) run.step({ steerX: -2000, block: false });
  assert.ok(run.player.x >= PLAYER.W / 2 - 1e-6);
});

test('风带：右列无转向也会被推向右', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  run.player.invulnUntil = Infinity;
  run.player.x = 900;
  const x0 = run.player.x;
  run.step({ steerX: null, block: false });
  assert.ok(run.player.x > x0);
});

test('盾再生：盾耗尽后随时间恢复', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  run.player.invulnUntil = Infinity;
  run.player.shield = 0;
  for (let i = 0; i < 60 * 7; i += 1) run.step({ steerX: 640, block: false });
  assert.ok(run.player.shield >= 1);
});

test('伞挡小物：扣 1 盾 + blockSmall', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  pushItem(run, { y: 575, r: 13, kind: 'bottle', isBig: false });
  run.step({ steerX: run.player.x, block: true });
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'blockSmall'));
  assert.equal(run.player.shield, 2);
});

test('伞挡大物：盾清零 + blockBig + umbrellaBreak', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  pushItem(run, { y: 575, r: 34, kind: 'fridge', isBig: true, dmg: 2 });
  run.step({ steerX: run.player.x, block: true });
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'blockBig'));
  assert.ok(events.some((e) => e.type === 'umbrellaBreak'));
  assert.equal(run.player.shield, 0);
  assert.equal(run.player.hp, 3);
});

test('被砸：不举伞扣血 + hit', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  pushItem(run, { y: 610, r: 13, kind: 'bottle', isBig: false, dmg: 1 });
  run.step({ steerX: run.player.x, block: false });
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'hit'));
  assert.equal(run.player.hp, 2);
});

test('死亡：血量归零 → dead + death', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  run.player.hp = 1;
  run.player.invulnUntil = -Infinity;
  pushItem(run, { y: 610, r: 13, kind: 'bottle', dmg: 1 });
  run.step({ steerX: run.player.x, block: false });
  assert.equal(run.phase, 'dead');
  assert.ok(run.drainEvents().some((e) => e.type === 'death'));
});

test('near-miss 连续两次 → ripple（慢动作涟漪）', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  run.player.x = 640;
  const bodyLeft = run.player.x - PLAYER.W / 2;
  // 两个擦身物（gap 10px < 20px），同 tick 落地
  pushItem(run, { x: bodyLeft - 13 - 10, y: WORLD.GROUND_Y + 14, r: 13, kind: 'bottle' });
  pushItem(run, { x: bodyLeft - 13 - 10, y: WORLD.GROUND_Y + 14, r: 13, kind: 'cup' });
  run.step({ steerX: run.player.x, block: false });
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'nearMiss'));
  assert.ok(events.some((e) => e.type === 'ripple'));
  assert.ok(run.rippleUntil > run.time);
});

test('波次推进：wave 1 结束 → waveEnter wave 2', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  run.player.invulnUntil = Infinity;
  run.waveTime = waveAt(1).durationSec - 0.01;
  run.step({ steerX: run.player.x, block: false });
  const events = run.drainEvents();
  assert.ok(events.some((e) => e.type === 'waveEnter' && e.wave === 2));
  assert.equal(run.waveIndex, 2);
});

test('通关：撑过全部 12 波 → won + win', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  run.player.invulnUntil = Infinity;
  run.waveIndex = 12;
  run.waveTime = waveAt(12).durationSec - 0.01;
  run.step({ steerX: run.player.x, block: false });
  assert.equal(run.phase, 'won');
  assert.ok(run.drainEvents().some((e) => e.type === 'win'));
});

test('spawner.buildItem：active=false / 类型来自波次 / 落点在界内', () => {
  const rng = mulberry32(42);
  const wave = WAVES[1]; // bottle/cup/can
  const item = buildItem(rng, wave, 640, 7);
  assert.equal(item.active, false);
  assert.ok(wave.kinds.includes(item.kind));
  assert.ok(item.x >= WORLD.SPAWN_MARGIN && item.x <= WORLD.WIDTH - WORLD.SPAWN_MARGIN);
  assert.ok(item.vy > 0);
});

test('spawner.buildItem：drone 波次必为追踪', () => {
  const rng = mulberry32(7);
  const wave = WAVES[4]; // 追踪无人机
  const item = buildItem(rng, wave, 640, 9);
  assert.equal(item.isDrone, true);
  assert.equal(item.tracking, true);
});

test('追踪无人机横向趋近玩家', () => {
  const run = createRun({ seed: 1 });
  run.items = [];
  run.player.invulnUntil = Infinity;
  run.player.x = 900;
  const drone = pushItem(run, { x: 300, y: 100, r: 16, kind: 'drone', isDrone: true, tracking: true, vy: 0 });
  for (let i = 0; i < 60; i += 1) run.step({ steerX: 900, block: false });
  assert.ok(Math.abs(drone.x - run.player.x) < Math.abs(300 - 900));
});
