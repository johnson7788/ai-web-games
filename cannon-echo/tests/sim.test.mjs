// CANNON ECHO · 纯逻辑测试（node --test）
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { WORLD } from '../config/game.config.js';
import { HEAT, ECHO, DEFENSE, TARGET, WAVE, targetHp } from '../config/gameplay.js';
import { WAVE_COUNT } from '../config/levels.js';

function eventsOf(run) { return run.drainEvents(); }

function pushBullet(run, x, y, vx, vy, opts = {}) {
  run.bullets.push({
    id: run.nextId++,
    x, y, vx, vy,
    damage: opts.damage ?? 50,
    bounces: opts.bounces ?? 0,
    pierceLeft: opts.pierce ?? 0,
    life: 4,
    targetsHit: [],
    roared: false,
  });
}

function pushTarget(run, type, x, y, opts = {}) {
  const def = TARGET[type];
  run.targets.push({
    id: run.nextId++,
    type,
    x, y,
    w: TARGET.W, h: TARGET.H,
    hp: opts.hp ?? def.hp,
    maxHp: opts.hp ?? def.hp,
    vy: def.vy,
    score: def.score,
    crash: def.crash,
    shield: def.shield,
    armor: def.armor,
    hitFlash: -Infinity,
    slowUntil: null,
    slowMult: 1,
    dead: false,
  });
}

test('createRun：开局 1 波、满血、playing', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.phase, 'playing');
  assert.equal(r.wave, 1);
  assert.equal(r.hp, 100);
  assert.ok(r.targets.length > 0);
  assert.equal(r.getHud().wave, 1);
});

test('确定性：同 seed 同结果', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  assert.deepEqual(a.targets.map((t) => t.x), b.targets.map((t) => t.x));
});

test('瞄准：炮口角度被钳制到最大仰角', () => {
  const r = createRun({ seed: 1 });
  r.step({ aimX: 2000, aimY: 0, fire: false });
  assert.ok(Math.abs(r.angle) <= Math.PI / 2);
});

test('射击：发射产生炮弹并发出 shot 事件', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  r.step({ aimX: 640, aimY: 0, fire: true });
  assert.equal(r.bullets.length, 1);
  const evs = eventsOf(r);
  assert.ok(evs.some((e) => e.type === 'shot'));
});

test('射速：冷却期内不连续发射', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  r.step({ aimX: 640, aimY: 0, fire: true });
  const n0 = r.bullets.length;
  r.step({ aimX: 640, aimY: 0, fire: true });
  assert.equal(r.bullets.length, n0);
});

test('过热：热量满触发锁管，锁管期间不发射', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  r.heat = HEAT.MAX - 5;
  r.cooldown = 0;
  r.step({ aimX: 640, aimY: 0, fire: true });
  assert.equal(r.overheated, true);
  const evs = eventsOf(r);
  assert.ok(evs.some((e) => e.type === 'overheat'));
  const n = r.bullets.length;
  r.step({ aimX: 640, aimY: 0, fire: true });
  assert.equal(r.bullets.length, n);
});

test('回声：崖壁反弹反转水平速度并衰减伤害', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  pushBullet(r, WORLD.WALL_R - 5, 300, 100, -100, { damage: 100 });
  r.step({ fire: false });
  assert.ok(r.bullets.length === 0 || r.bullets[0].vx < 0);
  if (r.bullets.length) assert.equal(r.bullets[0].bounces, 1);
  const evs = eventsOf(r);
  assert.ok(evs.some((e) => e.type === 'echoBounce'));
});

test('护盾：直射被挡（0 伤害），目标不掉血', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  pushTarget(r, 'shielded', 640, 300, { hp: 100 });
  pushBullet(r, 640, 320, 0, -500, { damage: 100, bounces: 0 });
  r.step({ fire: false });
  assert.equal(r.targets[0].hp, 100);
  const evs = eventsOf(r);
  assert.ok(evs.some((e) => e.type === 'hit' && e.damage === 0));
});

test('护盾：回声弹（bounces>=1）全额伤害并击碎', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  pushTarget(r, 'shielded', 640, 300, { hp: 100 });
  pushBullet(r, 640, 320, 0, -500, { damage: 100, bounces: 1 });
  r.step({ fire: false });
  assert.equal(r.targets.length, 0);
  assert.ok(r.stats.score > 0);
});

test('装甲：直射只造成 25% 伤害', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  pushTarget(r, 'armored', 640, 300, { hp: 100 });
  pushBullet(r, 640, 320, 0, -500, { damage: 100, bounces: 0 });
  r.step({ fire: false });
  assert.equal(r.targets[0].hp, 100 - 100 * DEFENSE.ARMOR_DIRECT_MULT);
});

test('击碎：目标 hp 归零 → break 事件 + 得分', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  pushTarget(r, 'crate', 640, 300, { hp: 10 });
  pushBullet(r, 640, 320, 0, -500, { damage: 100 });
  r.step({ fire: false });
  assert.equal(r.targets.length, 0);
  assert.ok(r.stats.score > 0);
  const evs = eventsOf(r);
  assert.ok(evs.some((e) => e.type === 'break'));
});

test('撞击：目标越线扣要塞耐久', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  pushTarget(r, 'crate', 640, WORLD.FORTRESS_Y - 10, { hp: 100 });
  const hp0 = r.hp;
  r.step({ fire: false });
  assert.ok(r.hp < hp0);
  const evs = eventsOf(r);
  assert.ok(evs.some((e) => e.type === 'crash'));
});

test('死亡：耐久归零 → dead + death 事件', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  r.hp = 1;
  pushTarget(r, 'crate', 640, WORLD.FORTRESS_Y - 10, { hp: 100 });
  r.step({ fire: false });
  assert.equal(r.phase, 'dead');
});

test('波次推进：清空目标后进入升级选择', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  r.step({ fire: false });
  assert.equal(r.phase, 'upgrade');
  assert.equal(r.upgradeChoices.length, 3);
});

test('升级：选择后应用并进入下一波', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  r.step({ fire: false });
  assert.equal(r.phase, 'upgrade');
  const id = r.upgradeChoices[0];
  r.chooseUpgrade(id);
  assert.equal(r.phase, 'playing');
  assert.equal(r.wave, 2);
  assert.ok(r.takenUpgrades.has(id));
});

test('胜利：最后一波清空 → won', () => {
  const r = createRun({ seed: 1 });
  r.wave = WAVE_COUNT;
  r.targets = [];
  r.step({ fire: false });
  assert.equal(r.phase, 'won');
  const evs = eventsOf(r);
  assert.ok(evs.some((e) => e.type === 'win'));
});

test('穿透升级：一发炮弹穿过两个目标', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  pushTarget(r, 'crate', 640, 300, { hp: 10 });
  pushTarget(r, 'crate', 640, 200, { hp: 10 });
  pushBullet(r, 640, 320, 0, -500, { damage: 100, pierce: 1 });
  for (let i = 0; i < 15; i += 1) {
    r.step({ fire: false });
    eventsOf(r);
  }
  assert.equal(r.targets.length, 0);
});

test('一箭三雕：单弹命中 3 目标触发 echoRoar', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  pushTarget(r, 'crate', 640, 300, { hp: 10 });
  pushTarget(r, 'crate', 640, 240, { hp: 10 });
  pushTarget(r, 'crate', 640, 180, { hp: 10 });
  pushBullet(r, 640, 320, 0, -500, { damage: 100, pierce: 5 });
  let roar = false;
  for (let i = 0; i < 25; i += 1) {
    r.step({ fire: false });
    const evs = eventsOf(r);
    if (evs.some((e) => e.type === 'echoRoar')) roar = true;
  }
  assert.ok(roar);
});

test('里程碑：得分每 1000 发 milestone', () => {
  const r = createRun({ seed: 1 });
  r.targets = [];
  r.stats.score = 990;
  pushTarget(r, 'crate', 640, 300, { hp: 10 });
  pushBullet(r, 640, 320, 0, -500, { damage: 100 });
  r.step({ fire: false });
  const evs = eventsOf(r);
  assert.ok(evs.some((e) => e.type === 'milestone'));
});

test('HUD：getHud 返回得分/波次/耐久/热量字段', () => {
  const r = createRun({ seed: 1 });
  const h = r.getHud();
  assert.ok('score' in h && 'wave' in h && 'hp' in h && 'heat' in h && 'level' in h);
});

test('波次放大：目标 hp 随波次增长', () => {
  assert.ok(targetHp('crate', 10) > targetHp('crate', 1));
});
