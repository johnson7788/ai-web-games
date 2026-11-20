import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { EGG, ROWS, LEVEL, WORLD, SHOOT } from '../config/gameplay.js';

// ---------- 测试工具 ----------
function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

function types(events) {
  return events.map((e) => e.type);
}

// 注入一个面团到指定位置（白盒：直接操作 run.doughs）
function injectDough(run, { row = 6, value = 1, armored = false, moving = false, atDistance, rackId } = {}) {
  const d = {
    id: run.nextId++,
    rackId: rackId ?? run.nextId++,
    row,
    baseY: ROWS.Y[row - 1],
    value,
    initial: value,
    armored,
    moving,
    phase: 0,
    atDistance: atDistance ?? run.distance, // screenX = EGG_X
  };
  run.doughs.push(d);
  run.racks.set(d.rackId, 1);
  return d;
}

// ---------- 契约 / 初始状态 ----------
test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.egg.ammo, EGG.AMMO_START);
  assert.equal(run.egg.shell, 1);
  assert.equal(run.egg.y, EGG.REST_Y);
  assert.equal(run.level, 1);
  assert.equal(run.score, 0);
  assert.deepEqual(run.drainEvents(), []);
});

test('getHud 字段齐全', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  for (const k of ['phase', 'score', 'ammo', 'combo', 'maxCombo', 'level', 'scene', 'levelName', 'shell', 'yolkReady', 'charging', 'charge', 'distance', 'totalLevels']) {
    assert.ok(k in hud, `缺字段 ${k}`);
  }
  assert.equal(hud.levelName, 'level.1');
});

test('同 seed 同输入 → 同结果（确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  stepN(a, 120, {});
  stepN(b, 120, {});
  assert.equal(a.distance, b.distance);
  assert.equal(a.score, b.score);
  assert.equal(a.egg.ammo, b.egg.ammo);
  assert.equal(a.doughs.length, b.doughs.length);
});

// ---------- 滚动 / 关卡 ----------
test('无输入也会自动前进（distance 增长）', () => {
  const run = createRun({ seed: 3 });
  const d0 = run.distance;
  stepN(run, 60);
  assert.ok(run.distance > d0 + 100);
});

test('distance 越过关卡边界 → levelEnter 且场景切换', () => {
  const run = createRun({ seed: 4 });
  run.distance = LEVEL.DIST - 5;
  stepN(run, 20);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'levelEnter' && e.level === 2));
});

test('到第 12 关尽头 → win', () => {
  const run = createRun({ seed: 5 });
  run.distance = LEVEL.COUNT * LEVEL.DIST - 5;
  stepN(run, 30);
  assert.equal(run.phase, 'won');
  assert.ok(run.drainEvents().some((e) => e.type === 'win'));
});

// ---------- 射击 ----------
test('自动射击：同排有目标才开火（跳过空隙省弹药）', () => {
  const run = createRun({ seed: 6 });
  const ammo0 = run.egg.ammo;
  // 同排前方有目标 → 自动开火
  injectDough(run, { row: 6, value: 4, atDistance: run.distance + 260 });
  stepN(run, 40);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shoot'));
  assert.ok(run.egg.ammo < ammo0);

  // 无目标时不再开火
  const run2 = createRun({ seed: 60 });
  const ammo2 = run2.egg.ammo;
  stepN(run2, 60);
  assert.equal(run2.egg.ammo, ammo2, '无目标不耗弹药');
});

test('手动加射：立即发射（受冷却限制）', () => {
  const run = createRun({ seed: 7 });
  run.step({ shoot: true });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shoot'));
  assert.equal(run.egg.ammo, EGG.AMMO_START - 1);
});

// ---------- 跳跃 ----------
test('蓄力后松开 → jump 事件 + 蛋离地', () => {
  const run = createRun({ seed: 8 });
  stepN(run, 30, { charge: true });
  run.step({ charge: false });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'jump'));
  assert.equal(run.egg.onGround, false);
  stepN(run, 5);
  assert.ok(run.egg.y < EGG.REST_Y);
});

test('重力让跳跃的蛋最终落回地面', () => {
  const run = createRun({ seed: 9 });
  stepN(run, 30, { charge: true });
  run.step({ charge: false });
  run.drainEvents();
  stepN(run, 200);
  assert.equal(run.egg.onGround, true);
  assert.equal(run.egg.y, EGG.REST_Y);
});

// ---------- 子弹命中 / 破团 ----------
test('子弹命中数字团 → doughHit 且耐久下降', () => {
  const run = createRun({ seed: 10 });
  const d = injectDough(run, { row: 6, value: 4, atDistance: run.distance + 180 });
  stepN(run, 40);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'doughHit'));
  assert.ok(d.value < 4 && d.value >= 1, `耐久应下降但未破：${d.value}`);
});

test('耐久归零 → doughBreak + comboUp + 加分', () => {
  const run = createRun({ seed: 11 });
  const d = injectDough(run, { row: 6, value: 1, atDistance: run.distance + 180 });
  stepN(run, 40);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'doughBreak'));
  assert.ok(evs.some((e) => e.type === 'comboUp'));
  assert.ok(!run.doughs.some((x) => x.id === d.id), '被打破的团应移除');
  assert.ok(run.score >= 1);
});

test('护甲团弹开普通弹（armorDeflect，不掉耐久）', () => {
  const run = createRun({ seed: 12 });
  const d = injectDough(run, { row: 6, value: 2, armored: true, atDistance: run.distance + 180 });
  stepN(run, 40);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'armorDeflect'));
  assert.equal(d.value, 2);
});

// ---------- 连击 / 蛋黄 ----------
test('连击窗口超时 → comboBreak', () => {
  const run = createRun({ seed: 13 });
  run.combo = 2;
  run.lastBreak = run.time;
  run.time += 3.0;
  run.step({});
  assert.ok(run.drainEvents().some((e) => e.type === 'comboBreak'));
  assert.equal(run.combo, 0);
});

test('连击到 5 → yolkReady；手动发射变蛋黄弹并 reset 连击', () => {
  const run = createRun({ seed: 14 });
  // 白盒：直接制造 5 连击
  run.combo = 5;
  run.yolkReady = true;
  run.step({ shoot: true });
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shoot' && e.yolk === true));
  assert.equal(run.yolkReady, false);
  assert.equal(run.combo, 0);
});

test('蛋黄弹命中 → yolkFired 并对半径内多团造成伤害（含护甲团）', () => {
  const run = createRun({ seed: 15 });
  run.yolkReady = true;
  const a = injectDough(run, { row: 6, value: 1, armored: true, atDistance: run.distance + 140 });
  const b = injectDough(run, { row: 6, value: 1, atDistance: run.distance + 180 });
  run.step({ shoot: true });
  const evs = run.drainEvents();
  const fired = evs.find((e) => e.type === 'yolkFired');
  assert.ok(fired, '应发 yolkFired');
  assert.equal(fired.hit, 2, '半径内两团都被溅射到');
  assert.ok(!run.doughs.some((d) => d.id === a.id || d.id === b.id), '护甲团也被蛋黄溅射清除');
});

// ---------- 蛋壳护甲 ----------
test('碰撞有壳 → shellBreak，团散，短暂无敌，不死亡', () => {
  const run = createRun({ seed: 16 });
  const d = injectDough(run, { row: 6, value: 9, atDistance: run.distance });
  run.step({});
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shellBreak'));
  assert.equal(run.egg.shell, 0);
  assert.equal(run.phase, 'playing');
  assert.ok(!run.doughs.some((x) => x.id === d.id), '被撞的团应消散');
});

test('碰撞无壳 → death', () => {
  const run = createRun({ seed: 17 });
  run.egg.shell = 0;
  injectDough(run, { row: 6, value: 9, atDistance: run.distance });
  run.step({});
  assert.equal(run.phase, 'dead');
  assert.ok(run.drainEvents().some((e) => e.type === 'death'));
});

test('壳碎后 10s 长回 → shellRegrow', () => {
  const run = createRun({ seed: 18 });
  injectDough(run, { row: 6, value: 9, atDistance: run.distance });
  run.step({});
  run.drainEvents();
  assert.equal(run.egg.shell, 0);
  run.time += 10.5;
  run.step({});
  assert.equal(run.egg.shell, 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'shellRegrow'));
});

// ---------- 整排清空 ----------
test('清完一整排 → rackClear + 额外加分', () => {
  const run = createRun({ seed: 19 });
  const rackId = run.nextId++;
  injectDough(run, { row: 6, value: 1, atDistance: run.distance + 60, rackId });
  const s0 = run.score;
  stepN(run, 40);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'rackClear'));
  assert.ok(run.score > s0);
});

// ---------- 道具 ----------
test('拾取道具 → propGain 且效果生效', () => {
  const run = createRun({ seed: 20 });
  run.props.push({ id: run.nextId++, kind: 'ammo', atDistance: run.distance, row: 6, y: ROWS.Y[5] });
  const ammo0 = run.egg.ammo;
  run.step({});
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'propGain' && e.kind === 'ammo'));
  assert.ok(run.egg.ammo > ammo0);
});

// ---------- 跳关（调试） ----------
test('jumpLevel 重置场景与蛋，并进入目标关', () => {
  const run = createRun({ seed: 21 });
  run.jumpLevel(5);
  assert.equal(run.level, 5);
  assert.equal(run.scene, 'dessert');
  assert.equal(run.egg.y, EGG.REST_Y);
  assert.equal(run.egg.shell, 1);
});

// ---------- 场景切换 ----------
test('关卡 5 与 9 切场景包', () => {
  const run = createRun({ seed: 22 });
  run.jumpLevel(4);
  assert.equal(run.scene, 'kitchen');
  run.jumpLevel(5);
  assert.equal(run.scene, 'dessert');
  run.jumpLevel(9);
  assert.equal(run.scene, 'canteen');
});
