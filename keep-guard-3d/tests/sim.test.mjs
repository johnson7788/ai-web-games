import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createSim, updateSim, getHud, drainEvents, buildTower, upgradeTower, sellTower,
  earlyStart, canPlaceAt, previewPath,
} from '../src/game/sim.js';
import { MAP, TOWERS, WALL, ECON, WAVES, cellWorld } from '../config/game.config.js';

const stepN = (run, n) => { for (let i = 0; i < n; i++) updateSim(run, {}); };

test('BFS 默认路径蛇形且起于出生点止于核心', () => {
  const run = createSim();
  assert.ok(run.path.length > 18, `路径应蛇形（实际 ${run.path.length}）`);
  assert.deepEqual(run.path[0], { c: MAP.spawn.c, r: MAP.spawn.r });
  assert.deepEqual(run.path[run.path.length - 1], { c: MAP.core.c, r: MAP.core.r });
});

test('建塔扣金币并把格加入 blocked', () => {
  const run = createSim();
  const g0 = run.gold;
  const ok = buildTower(run, 'arrow', 1, 1);
  assert.ok(ok);
  assert.equal(run.gold, g0 - TOWERS.arrow.cost);
  assert.ok(run.towers['1,1']);
  assert.ok(run.blocked.has('1,1'));
});

test('堵死连接口被拒绝（不允许完全堵路）', () => {
  const run = createSim();
  assert.equal(buildTower(run, 'arrow', 3, 3), false, '堵 (3,3) 应失败');
  assert.equal(buildTower(run, 'arrow', 12, 7), false, '堵 (12,7) 应失败');
  assert.equal(Object.keys(run.towers).length, 0);
});

test('土墙改道：放墙后红线改变', () => {
  const run = createSim();
  assert.ok(buildTower(run, 'wall', 1, 1));
  assert.ok(run.path.length > 0, '路径仍需连通');
  assert.ok(!run.path.some((p) => p.c === 1 && p.r === 1), '被堵格不应再出现在路径上');
});

test('售塔折价 50% 并释放格', () => {
  const run = createSim();
  buildTower(run, 'arrow', 2, 2);
  const g1 = run.gold;
  assert.ok(sellTower(run, 2, 2));
  assert.equal(run.gold, g1 + Math.floor(TOWERS.arrow.cost * ECON.sellPct));
  assert.ok(!run.towers['2,2']);
  assert.ok(!run.blocked.has('2,2'));
});

test('升级扣费、等级 +1，超过 3 级失败', () => {
  const run = createSim();
  run.gold = 1000;
  buildTower(run, 'arrow', 2, 2);
  assert.ok(upgradeTower(run, 2, 2));
  assert.equal(run.towers['2,2'].level, 2);
  upgradeTower(run, 2, 2);
  assert.equal(run.towers['2,2'].level, 3);
  assert.equal(upgradeTower(run, 2, 2), false, '3 级后不能再升');
});

test('提前开战进入 combat 并给奖励金', () => {
  const run = createSim();
  const g0 = run.gold;
  const bonus = Math.round(run.buildTimeLeft * ECON.earlyStartPerSec);
  assert.ok(earlyStart(run));
  assert.equal(run.phase, 'combat');
  assert.ok(run.gold >= g0 + bonus - 1, '应有提前开战奖励');
});

test('敌人沿路径向核心推进', () => {
  const run = createSim();
  earlyStart(run);
  stepN(run, 2);
  assert.ok(run.enemies.length >= 1, '第一只敌人应已刷出');
  const e0 = run.enemies[0];
  const x0 = e0.x, z0 = e0.z;
  stepN(run, 60);
  const e = run.enemies[0] || e0;
  const core = cellWorld(MAP.core.c, MAP.core.r);
  const d0 = Math.hypot(x0 - core.x, z0 - core.z);
  const d1 = Math.hypot(e.x - core.x, e.z - core.z);
  assert.ok(d1 < d0, '敌人应离核心更近');
});

test('敌人到核心扣核心血', () => {
  const run = createSim();
  run.gold = 0;
  // 直接放一个贴近核心的敌人（绕过路径）
  const core = cellWorld(MAP.core.c, MAP.core.r);
  run.enemies.push({ id: 99, type: 'infantry', spec: { speed: 1.5, dmg: 1, flying: false, breaker: false, radius: 0.28 }, hp: 10, maxHp: 10, x: core.x - 0.3, z: core.z, nodeIdx: 999, flying: false, slowT: 0, slowPct: 0, atkCd: 0, dead: false });
  run.phase = 'combat';
  stepN(run, 30);
  assert.ok(run.coreHp < ECON.coreHp, '核心血应下降');
});

test('箭塔击杀敌人、得金币、发 kill 事件', () => {
  const run = createSim();
  run.gold = 1000;
  buildTower(run, 'arrow', 1, 1); // 紧邻出生点
  earlyStart(run);
  stepN(run, 600);
  assert.ok(run.kills > 0, '应有击杀');
  const evs = drainEvents(run);
  assert.ok(evs.some((e) => e.type === 'kill'));
});

test('炮塔 AOE 一次命中多个敌人', () => {
  const run = createSim();
  run.gold = 1000;
  buildTower(run, 'cannon', 1, 1);
  // 在炮塔射程内放两只敌人
  run.enemies.push(
    { id: 50, type: 'infantry', spec: { hp: 40, speed: 1, dmg: 1, flying: false, breaker: false, radius: 0.28, armor: 0 }, hp: 40, maxHp: 40, x: -6.2, z: -4.5, nodeIdx: 0, flying: false, slowT: 0, slowPct: 0, atkCd: 0, dead: false },
    { id: 51, type: 'infantry', spec: { hp: 40, speed: 1, dmg: 1, flying: false, breaker: false, radius: 0.28, armor: 0 }, hp: 40, maxHp: 40, x: -6.0, z: -4.3, nodeIdx: 0, flying: false, slowT: 0, slowPct: 0, atkCd: 0, dead: false },
  );
  run.phase = 'combat';
  stepN(run, 120);
  const bothHurt = run.enemies.every((e) => e.hp < 40);
  assert.ok(bothHurt || run.enemies.length === 0, 'AOE 应同时伤到范围内敌人');
});

test('冰塔给敌人上减速（slowT>0）', () => {
  const run = createSim();
  run.gold = 1000;
  buildTower(run, 'ice', 1, 1);
  run.enemies.push({ id: 60, type: 'infantry', spec: { hp: 40, speed: 1, dmg: 1, flying: false, breaker: false, radius: 0.28, armor: 0 }, hp: 40, maxHp: 40, x: -6.5, z: -4.5, nodeIdx: 0, flying: false, slowT: 0, slowPct: 0, atkCd: 0, dead: false });
  run.phase = 'combat';
  stepN(run, 5);
  assert.ok(run.enemies[0] && run.enemies[0].slowT > 0, '应被减速');
});

test('破墙兵优先攻击相邻土墙', () => {
  const run = createSim();
  run.gold = 1000;
  buildTower(run, 'wall', 5, 5);
  run.enemies.push({ id: 70, type: 'breaker', spec: { hp: 85, speed: 1.1, dmg: 1, flying: false, breaker: true, radius: 0.34, armor: 0 }, hp: 85, maxHp: 85, x: -2.5, z: -0.5, nodeIdx: 0, flying: false, slowT: 0, slowPct: 0, atkCd: 0, dead: false });
  run.phase = 'combat';
  stepN(run, 40);
  assert.ok(run.walls['5,5'].hp < WALL.hp, '墙应被破墙兵打掉血');
});

test('飞行兵无视路径直线飞向核心', () => {
  const run = createSim();
  run.enemies.push({ id: 80, type: 'flyer', spec: { hp: 30, speed: 2.1, dmg: 1, flying: true, breaker: false, radius: 0.24, armor: 0 }, hp: 30, maxHp: 30, x: -7.5, z: -4.5, nodeIdx: 0, flying: true, slowT: 0, slowPct: 0, atkCd: 0, dead: false });
  run.phase = 'combat';
  const core = cellWorld(MAP.core.c, MAP.core.r);
  const d0 = Math.hypot(-7.5 - core.x, -4.5 - core.z);
  stepN(run, 60);
  const e = run.enemies[0];
  assert.ok(e && Math.hypot(e.x - core.x, e.z - core.z) < d0, '飞行兵应逼近核心');
});

test('第 10 波清空后胜利', () => {
  const run = createSim();
  run.wave = WAVES.length;
  run.phase = 'combat';
  run.spawnQueue = [];
  run.enemies = [];
  run._spawnT = 0;
  stepN(run, 2);
  assert.equal(run.phase, 'won');
  const evs = drainEvents(run);
  assert.ok(evs.some((e) => e.type === 'win'));
});

test('核心血量归零则失败', () => {
  const run = createSim();
  run.coreHp = 1;
  const core = cellWorld(MAP.core.c, MAP.core.r);
  run.enemies.push({ id: 90, type: 'boss', spec: { hp: 650, speed: 0.75, dmg: 6, flying: false, breaker: false, radius: 0.6, armor: 6 }, hp: 650, maxHp: 650, x: core.x - 0.2, z: core.z, nodeIdx: 999, flying: false, slowT: 0, slowPct: 0, atkCd: 0, dead: false });
  run.phase = 'combat';
  stepN(run, 5);
  assert.equal(run.phase, 'lost');
});

test('利息：开战按存款 10% 计息', () => {
  const run = createSim();
  run.gold = 200;
  const g0 = run.gold;
  earlyStart(run);
  const interest = Math.min(ECON.interestCap, Math.floor(g0 * ECON.interestRate));
  assert.ok(run.gold >= g0 + interest - 1, '开战应给利息');
});

test('seed 相同 → 行为可复现（前 N 步敌人位置一致）', () => {
  const a = createSim({ seed: 7 });
  const b = createSim({ seed: 7 });
  earlyStart(a); earlyStart(b);
  stepN(a, 90); stepN(b, 90);
  const ea = a.enemies[0], eb = b.enemies[0];
  assert.equal(a.kills, b.kills);
  if (ea && eb) { assert.ok(Math.abs(ea.x - eb.x) < 1e-9); assert.ok(Math.abs(ea.z - eb.z) < 1e-9); }
});

test('smoke：createRun + startWave + step + getHud + drainEvents 不崩', () => {
  const r = createSim({ seed: 3 });
  r.startWave();
  r.step({});
  const hud = r.getHud();
  assert.equal(typeof hud.gold, 'number');
  assert.ok(Array.isArray(r.drainEvents()));
});

test('canPlaceAt / previewPath 反映塔位与改路', () => {
  const run = createSim();
  run.gold = 1000;
  assert.equal(canPlaceAt(run, 'arrow', MAP.spawn.c, MAP.spawn.r), false, '出生点不可建');
  assert.equal(canPlaceAt(run, 'arrow', 2, 2), true);
  const prev = previewPath(run, 2, 2);
  assert.ok(Array.isArray(prev));
});
