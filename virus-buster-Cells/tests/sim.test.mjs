import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, mulberry32, WORLD, STEP } from '../src/game/sim.js';
import { levelWaves, crystalCount, levelTotalHp } from '../config/levels.js';

test('PRNG 确定性：同种子产出相同序列', () => {
  const a = mulberry32(42);
  const b = mulberry32(42);
  const seqA = [a(), a(), a()];
  const seqB = [b(), b(), b()];
  assert.deepEqual(seqA, seqB);
});

test('开局：phase=playing，level=1，飞船居中且存活', () => {
  const run = createRun(0, { seed: 1 });
  assert.equal(run.state.phase, 'playing');
  assert.equal(run.state.level, 1);
  assert.equal(run.state.ship.alive, true);
  assert.equal(run.state.ship.x, WORLD.WIDTH / 2);
});

test('step 推进时间', () => {
  const run = createRun(0, { seed: 1 });
  run.step(STEP);
  assert.ok(run.state.time > 0);
});

test('开火会产生子弹与 shot 事件', () => {
  const run = createRun(0, { seed: 1 });
  run.setInput(WORLD.WIDTH / 2, true);
  for (let i = 0; i < 20; i += 1) run.step(STEP);
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'shot'), '应有 shot 事件');
  assert.ok(run.state.bullets.length > 0, '应有子弹');
});

test('关卡 1 为三波，含 BOSS；晶体为 0', () => {
  assert.equal(levelWaves(1).length, 3);
  assert.ok(levelWaves(1)[2].some((hp) => hp >= 20), '第三波有 BOSS');
  assert.equal(crystalCount(1), 0);
  assert.equal(levelTotalHp(1), 78);
});

test('关卡 2 起出现晶体', () => {
  assert.ok(crystalCount(2) > 0);
  const run = createRun(1, { seed: 2 });
  assert.ok(run.state.crystals.length > 0);
});

test('子弹命中病毒：血量 -1，damageDealt +1，产生 hit 事件', () => {
  const run = createRun(0, { seed: 3, upgrades: { firePower: 1, fireRate: 1, goldValue: 1, shield: 0, nukeStart: 0 } });
  // 直接构造一只在飞船正上方的病毒，确保被击中
  run.state.germs = [{ id: 999, hp: 3, maxHp: 3, r: 17, x: WORLD.WIDTH / 2, y: run.state.ship.y - 60, vx: 0, vy: 0, flash: 0, boss: false, dead: false }];
  run.setInput(WORLD.WIDTH / 2, true);
  let hit = false;
  for (let i = 0; i < 60; i += 1) {
    run.step(STEP);
    if (run.drainEvents().some((e) => e.type === 'hit')) { hit = true; break; }
  }
  assert.ok(hit, '应命中');
  assert.ok(run.state.damageDealt > 0);
});

test('击杀病毒：掉金币、连击 +1、kill/coin 事件', () => {
  const run = createRun(0, { seed: 4 });
  const g = { id: 1, hp: 1, maxHp: 6, r: 21, x: WORLD.WIDTH / 2, y: run.state.ship.y - 60, vx: 0, vy: 0, flash: 0, boss: false, dead: false };
  run.state.germs = [g];
  run.setInput(WORLD.WIDTH / 2, true);
  const types = [];
  for (let i = 0; i < 120; i += 1) {
    run.step(STEP);
    for (const e of run.drainEvents()) types.push(e.type);
    if (types.includes('kill')) break;
  }
  assert.ok(types.includes('kill'), '应有 kill 事件');
  assert.ok(types.includes('coin'), '应有 coin 事件');
  assert.ok(run.state.gold > 0, '应掉落金币');
  assert.equal(run.state.combo, 1);
});

test('死亡：病毒撞击飞船 → lose 事件 + deaths=1 + 复活倒计时', () => {
  const run = createRun(0, { seed: 5 });
  run.state.germs = [{ id: 1, hp: 1, maxHp: 1, r: 20, x: run.state.ship.x, y: run.state.ship.y, vx: 0, vy: 0, flash: 0, boss: false, dead: false }];
  let lose = false;
  for (let i = 0; i < 5; i += 1) {
    run.step(STEP);
    if (run.drainEvents().some((e) => e.type === 'lose')) { lose = true; break; }
  }
  assert.ok(lose, '应有 lose 事件');
  assert.equal(run.state.deaths, 1);
  assert.equal(run.state.ship.alive, false);
  assert.ok(run.state.deadTimer > 0);
});

test('复活：倒计时结束后飞船复活并短暂无敌', () => {
  const run = createRun(0, { seed: 6 });
  run.state.ship.alive = false;
  run.state.deadTimer = 0.1;
  let revived = false;
  for (let i = 0; i < 60; i += 1) {
    run.step(STEP);
    if (run.drainEvents().some((e) => e.type === 'revive')) { revived = true; break; }
  }
  assert.ok(revived, '应复活');
  assert.equal(run.state.ship.alive, true);
  assert.ok(run.state.ship.invulnT > 0);
});

test('护盾吸收一次撞击而不死亡', () => {
  const run = createRun(0, { seed: 7, upgrades: { firePower: 1, fireRate: 1, goldValue: 1, shield: 1, nukeStart: 0 } });
  run.state.germs = [{ id: 1, hp: 1, maxHp: 1, r: 20, x: run.state.ship.x, y: run.state.ship.y, vx: 0, vy: 0, flash: 0, boss: false, dead: false }];
  let shielded = false;
  for (let i = 0; i < 5; i += 1) {
    run.step(STEP);
    if (run.drainEvents().some((e) => e.type === 'shield')) { shielded = true; break; }
  }
  assert.ok(shielded, '应触发护盾');
  assert.equal(run.state.ship.alive, true);
  assert.equal(run.state.deaths, 0);
  assert.equal(run.state.shield, 0);
});

test('过关：清空全部病毒后 phase=won 且发出 win 事件', () => {
  const run = createRun(0, { seed: 8, upgrades: { firePower: 6, fireRate: 5, goldValue: 1, shield: 0, nukeStart: 0 } });
  run.setInput(WORLD.WIDTH / 2, true);
  let won = false;
  // 追踪最低病毒射击，最多 45s
  for (let i = 0; i < 60 * 45; i += 1) {
    const lowest = run.state.germs.reduce((m, g) => (m === null || g.y > m.y ? g : m), null);
    if (lowest) run.setInput(lowest.x, true);
    run.step(STEP);
    if (run.drainEvents().some((e) => e.type === 'win')) { won = true; break; }
  }
  assert.ok(won, '应在 45s 内过关');
  assert.equal(run.state.phase, 'won');
  assert.ok(run.state.result.stars >= 1 && run.state.result.stars <= 3);
});

test('下一关：won 后 nextLevel 进入 level 2', () => {
  const run = createRun(0, { seed: 9 });
  run.state.phase = 'won';
  assert.equal(run.nextLevel(), true);
  assert.equal(run.state.level, 2);
  assert.equal(run.state.phase, 'playing');
});

test('getHud 返回进度/等级/金币字段', () => {
  const run = createRun(0, { seed: 10 });
  const h = run.getHud();
  assert.equal(h.level, 1);
  assert.equal(typeof h.hpPct, 'number');
  assert.equal(typeof h.gold, 'number');
  assert.equal(h.waveCount, 3);
});
