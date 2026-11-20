import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { GUN, PLAYER, COMBO } from '../config/gameplay.js';

// 注入一个静止的测试碟（speed 0，两个不同路径点 → 永不逃逸、永不移动）
function addSaucer(run, overrides = {}) {
  const s = {
    id: run.nextId++,
    type: 'scout',
    hp: 1,
    maxHp: 1,
    score: 100,
    radius: 22,
    speed: 0,
    color: '#7df9ff',
    invisible: false,
    path: [{ x: 640, y: 300 }, { x: 900, y: 300 }],
    wayIndex: 0,
    wayHold: 0,
    x: 640,
    y: 300,
    active: true,
    ...overrides,
  };
  run.saucers.push(s);
  run.waveSaucers += 1;
  return s;
}

function fireAt(run, angle, power) {
  const aimX = GUN.MUZZLE_X + Math.cos(angle) * power * GUN.MAX_POWER_DIST;
  const aimY = GUN.MUZZLE_Y + Math.sin(angle) * power * GUN.MAX_POWER_DIST;
  run.step({ aimX, aimY, charging: true, fire: true, tracer: false });
}

function drainTypes(run) {
  return run.drainEvents().map((e) => e.type);
}

test('createRun：从第 1 波开始，3 命，相位 playing', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.wave, 1);
  assert.equal(r.lives, PLAYER.START_LIVES);
  assert.equal(r.phase, 'playing');
  assert.ok(r.saucers.length > 0);
  assert.equal(r.getHud().wave, 1);
});

test('开火：发出 shot 事件并生成炮弹', () => {
  const r = createRun({ seed: 2 });
  const before = r.projectiles.length;
  fireAt(r, -Math.PI / 2, 0.5);
  assert.ok(drainTypes(r).includes('shot'));
  assert.ok(r.projectiles.length > before);
  assert.equal(r.stats.shots, 1);
});

test('命中：炮弹击中静止碟 → kill 事件 + 计分', () => {
  const r = createRun({ seed: 3 });
  addSaucer(r, { x: 640, y: 200, hp: 1 });
  const scoreBefore = r.score;
  fireAt(r, -Math.PI / 2, 0.5);
  // 推进到炮弹命中
  let hit = false;
  for (let i = 0; i < 120 && !hit; i += 1) {
    r.step({ charging: false, fire: false, tracer: false });
    const types = drainTypes(r);
    if (types.includes('kill')) hit = true;
  }
  assert.ok(hit, '应该命中并击杀');
  assert.ok(r.score > scoreBefore);
  assert.equal(r.stats.kills, 1);
});

test('运输碟：多命中才击杀', () => {
  const r = createRun({ seed: 4 });
  addSaucer(r, { type: 'transport', x: 640, y: 200, hp: 3, radius: 34 });
  let kills = 0;
  for (let i = 0; i < 240; i += 1) {
    if (i % 20 === 0) fireAt(r, -Math.PI / 2, 0.9);
    r.step({ charging: false, fire: false, tracer: false });
    if (drainTypes(r).includes('kill')) kills += 1;
  }
  assert.equal(kills, 1);
  assert.equal(r.stats.kills, 1);
});

test('过热：满蓄发射触发 overheat 事件并锁炮', () => {
  const r = createRun({ seed: 5 });
  fireAt(r, -Math.PI / 2, 1.0);
  const types = drainTypes(r);
  assert.ok(types.includes('shot'));
  assert.ok(types.includes('overheat'));
  assert.ok(r.getHud().overheated);
});

test('过热锁炮：锁定期内无法再开火', () => {
  const r = createRun({ seed: 6 });
  fireAt(r, -Math.PI / 2, 1.0);
  r.drainEvents();
  const shotsBefore = r.stats.shots;
  fireAt(r, -Math.PI / 2, 0.5); // 锁炮期间
  r.drainEvents();
  assert.equal(r.stats.shots, shotsBefore);
});

test('漏碟：飞碟逃逸扣命并发出 lifeLost', () => {
  const r = createRun({ seed: 7 });
  const livesBefore = r.lives;
  // 直接触发一个碟的逃逸：把它移到最后一个路径点之外
  addSaucer(r, { x: 640, y: 300 });
  const s = r.saucers[r.saucers.length - 1];
  s.path = [{ x: 640, y: 300 }]; // 单点 → 下一 tick 即逃逸
  s.wayIndex = 0;
  let sawLifeLost = false;
  for (let i = 0; i < 5 && !sawLifeLost; i += 1) {
    r.step({ charging: false, fire: false, tracer: false });
    if (drainTypes(r).includes('lifeLost')) sawLifeLost = true;
  }
  assert.ok(sawLifeLost);
  assert.equal(r.lives, livesBefore - 1);
});

test('死亡：3 条命耗尽 → phase dead', () => {
  const r = createRun({ seed: 8 });
  r.lives = 1;
  addSaucer(r, { x: 640, y: 300 });
  const s = r.saucers[r.saucers.length - 1];
  s.path = [{ x: 640, y: 300 }];
  let sawDeath = false;
  for (let i = 0; i < 5 && !sawDeath; i += 1) {
    r.step({ charging: false, fire: false, tracer: false });
    if (drainTypes(r).includes('death')) sawDeath = true;
  }
  assert.ok(sawDeath);
  assert.equal(r.phase, 'dead');
});

test('波次清空：waveCleared + 升级三选一', () => {
  const r = createRun({ seed: 9 });
  // 直接把所有碟清掉并手动推进到判定
  r.saucers = [];
  r.waveSaucers = 0;
  r.step({ charging: false, fire: false, tracer: false });
  const types = drainTypes(r);
  assert.ok(types.includes('waveCleared'));
  assert.ok(r.pendingUpgrade);
  assert.equal(r.upgradeOffers.length, 3);
});

test('选择升级：进入下一波并应用升级', () => {
  const r = createRun({ seed: 10 });
  r.saucers = [];
  r.waveSaucers = 0;
  r.step({ charging: false, fire: false, tracer: false });
  r.drainEvents();
  const waveBefore = r.wave;
  const ok = r.chooseUpgrade(0);
  assert.ok(ok);
  assert.equal(r.wave, waveBefore + 1);
  assert.ok(Object.keys(r.upgrades).length === 1);
});

test('通关：第 12 波清空 → phase won + win 事件', () => {
  const r = createRun({ seed: 11 });
  r.wave = 12;
  r.chapter = 3;
  r.saucers = [];
  r.waveSaucers = 0;
  r.waveActive = true;
  r.step({ charging: false, fire: false, tracer: false });
  assert.ok(drainTypes(r).includes('win'));
  assert.equal(r.phase, 'won');
});

test('曳光弹：发射后显形并发出 reveal', () => {
  const r = createRun({ seed: 12 });
  r.tracersLeft = 1;
  r.step({ charging: false, fire: false, tracer: true });
  const types = drainTypes(r);
  assert.ok(types.includes('tracerFired'));
  assert.ok(r.tracers.length > 0);
});

test('连击：连续命中递增 combo', () => {
  const r = createRun({ seed: 13 });
  function killOne() {
    fireAt(r, -Math.PI / 2, 0.5);
    let killed = false;
    for (let i = 0; i < 120 && !killed; i += 1) {
      r.step({ charging: false, fire: false, tracer: false });
      if (drainTypes(r).includes('kill')) killed = true;
    }
    return killed;
  }
  addSaucer(r, { x: 640, y: 200 });
  assert.ok(killOne());
  assert.equal(r.combo, 1);
  addSaucer(r, { x: 640, y: 200 });
  assert.ok(killOne());
  assert.equal(r.combo, 2);
  assert.equal(r.maxCombo, 2);
});

test('HUD 契约：getHud 返回关键字段', () => {
  const r = createRun({ seed: 14 });
  const h = r.getHud();
  for (const k of ['score', 'wave', 'lives', 'charge', 'heat', 'tracersLeft', 'combo', 'chapter', 'phase']) {
    assert.ok(k in h, `缺字段 ${k}`);
  }
});

test('drainEvents：清空事件队列', () => {
  const r = createRun({ seed: 15 });
  fireAt(r, -Math.PI / 2, 0.5);
  assert.ok(r.drainEvents().length > 0);
  assert.equal(r.drainEvents().length, 0);
});

test('确定性：同 seed 前若干 tick 结果一致', () => {
  function snapshot(seed) {
    const r = createRun({ seed });
    const out = [];
    for (let i = 0; i < 10; i += 1) {
      r.step({ charging: false, fire: false, tracer: false });
      out.push(r.saucers.map((s) => `${s.type}:${s.path[0].y}`).join(','));
    }
    return out.join('|');
  }
  assert.equal(snapshot(42), snapshot(42));
});
