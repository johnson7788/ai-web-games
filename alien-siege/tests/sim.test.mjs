import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, step } from '../src/game/sim.js';
import { ENEMIES, PLAYER, WEAPONS, WAVE } from '../config/gameplay.js';

function mkEnemy(run, type, x, y, over = {}) {
  const s = ENEMIES[type];
  return {
    id: run.nextId++, type, x, y,
    hp: s.hp, maxHp: s.hp, speed: s.speed, radius: s.radius,
    damage: s.damage, attackRange: s.attackRange, attackCooldown: s.attackCooldown,
    drift: s.drift, score: s.score, spawnMinions: !!s.spawnMinions,
    attackCd: 0, driftPhase: 0, spawnCd: 0, marked: false, markedUntil: 0,
    ...over,
  };
}

function tick(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) {
    if (run.phase !== 'playing') break;
    run.step(input);
    run.drainEvents();
  }
}

test('createRun：初始 phase=playing，hp=100，wave=0', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.player.hp, PLAYER.HP);
  assert.equal(run.wave, 0);
  assert.equal(run.player.weapon, 'pistol');
});

test('step 推进时间', () => {
  const run = createRun({ seed: 1 });
  tick(run, 60);
  assert.ok(Math.abs(run.time - 1) < 0.001, `time=${run.time}`);
});

test('第一波在 FIRST_DELAY 后生成 3 只爬行者并发出 waveStart', () => {
  const run = createRun({ seed: 1 });
  const ticks = Math.ceil(WAVE.FIRST_DELAY / (1 / 60)) + 2;
  let sawWaveStart = false;
  for (let i = 0; i < ticks; i += 1) {
    run.step({});
    for (const ev of run.drainEvents()) if (ev.type === 'waveStart') sawWaveStart = true;
  }
  assert.equal(run.wave, 1);
  assert.equal(run.enemies.length, 3);
  assert.equal(sawWaveStart, true);
});

test('射击命中正前方敌人（减血 + hit 事件）', () => {
  const run = createRun({ seed: 1 });
  run.wave = 1;
  run.waveState = 'active';
  run.player.angle = 0;
  run.enemies.push(mkEnemy(run, 'crawler', run.player.x + 2, run.player.y));
  const hpBefore = run.enemies[0].hp;
  const evs = [];
  run.step({ shoot: true });
  for (const ev of run.drainEvents()) evs.push(ev.type);
  assert.ok(run.enemies[0].hp < hpBefore, '敌人应掉血');
  assert.ok(evs.includes('shoot') && evs.includes('hit'), evs.join(','));
});

test('击杀敌人：hp 归零发 kill 事件并计数', () => {
  const run = createRun({ seed: 1 });
  run.wave = 1;
  run.waveState = 'active';
  run.player.angle = 0;
  run.enemies.push(mkEnemy(run, 'crawler', run.player.x + 2, run.player.y, { hp: 1 }));
  run.step({ shoot: true });
  const evs = run.drainEvents();
  assert.equal(run.stats.kills, 1);
  assert.equal(run.enemies.length, 0);
  assert.ok(evs.some((e) => e.type === 'kill'));
});

test('镭射标记：按 E 标记准星内敌人（1.5 倍伤害）', () => {
  const run = createRun({ seed: 1 });
  run.wave = 1;
  run.waveState = 'active';
  run.player.angle = 0;
  const e = mkEnemy(run, 'crawler', run.player.x + 2, run.player.y, { hp: 30 });
  run.enemies.push(e);
  run.step({ mark: true });
  const evs = run.drainEvents();
  assert.equal(e.marked, true);
  assert.ok(evs.some((ev) => ev.type === 'mark'));
  // 标记后伤害 ×1.5：pistol 12 → 18
  const before = e.hp;
  run.step({ shoot: true });
  run.drainEvents();
  assert.equal(e.hp, before - Math.round(WEAPONS.pistol.damage * PLAYER.MARK_MULT));
});

test('护盾：按住 Q 激活并持续耗能', () => {
  const run = createRun({ seed: 1 });
  run.wave = 1;
  run.waveState = 'active';
  const e0 = run.player.shieldEnergy;
  tick(run, 10, { shield: true });
  assert.equal(run.player.shieldActive, true);
  assert.ok(run.player.shieldEnergy < e0);
});

test('护盾吸收伤害：开盾时被攻击不掉血', () => {
  const run = createRun({ seed: 1 });
  run.wave = 1;
  run.waveState = 'active';
  run.player.shieldActive = true;
  run.player.shieldEnergy = 100;
  run.enemies.push(mkEnemy(run, 'crawler', run.player.x + 0.5, run.player.y, { attackRange: 2 }));
  const hp = run.player.hp;
  tick(run, 5, { shield: true });
  assert.equal(run.player.hp, hp, '开盾不掉血');
});

test('护盾耗尽破裂：emit shieldBreak', () => {
  const run = createRun({ seed: 1 });
  run.wave = 1;
  run.waveState = 'active';
  run.player.shieldActive = true;
  run.player.shieldEnergy = 1;
  run.enemies.push(mkEnemy(run, 'crawler', run.player.x + 0.5, run.player.y, { attackRange: 2 }));
  let saw = false;
  for (let i = 0; i < 10; i += 1) {
    run.step({ shield: true });
    for (const ev of run.drainEvents()) if (ev.type === 'shieldBreak') saw = true;
  }
  assert.equal(run.player.shieldActive, false);
  assert.equal(saw, true);
});

test('打空自动换弹并 emit reload/reloadDone', () => {
  const run = createRun({ seed: 1 });
  run.wave = 1;
  run.waveState = 'active';
  run.player.ammo = 1;
  run.step({ shoot: true });
  const evs = run.drainEvents();
  assert.equal(run.player.reloading, true);
  assert.ok(evs.some((e) => e.type === 'reload'));
  // 换弹完成后 ammo 回满
  const ticks = Math.ceil(WEAPONS.pistol.reloadSec / (1 / 60)) + 2;
  tick(run, ticks);
  assert.equal(run.player.ammo, WEAPONS.pistol.magSize);
});

test('第 3 波解锁步枪', () => {
  const run = createRun({ seed: 1 });
  run.wave = 2;
  run.waveState = 'clear';
  run.spawnTimer = 0;
  run.step({});
  const evs = run.drainEvents();
  assert.equal(run.wave, 3);
  assert.equal(run.player.weapon, 'rifle');
  assert.ok(evs.some((e) => e.type === 'weaponUnlock'));
});

test('场景切换：第 5 波切到反应场并发 sceneEnter', () => {
  const run = createRun({ seed: 1 });
  run.wave = 4;
  run.waveState = 'clear';
  run.spawnTimer = 0;
  run.step({});
  const evs = run.drainEvents();
  assert.equal(run.scene, 2);
  assert.ok(evs.some((e) => e.type === 'sceneEnter'));
});

test('死亡：hp 归零 phase=dead 并 emit death', () => {
  const run = createRun({ seed: 1 });
  run.wave = 1;
  run.waveState = 'active';
  run.player.hp = 1;
  run.player.shieldActive = false;
  run.enemies.push(mkEnemy(run, 'crawler', run.player.x + 0.5, run.player.y, { attackRange: 2 }));
  let died = false;
  for (let i = 0; i < 120; i += 1) {
    run.step({});
    for (const ev of run.drainEvents()) if (ev.type === 'death') died = true;
    if (run.phase === 'dead') break;
  }
  assert.equal(run.phase, 'dead');
  assert.equal(died, true);
});

test('通关：第 12 波清空后 phase=win 并 emit win', () => {
  const run = createRun({ seed: 1 });
  run.wave = 12;
  run.waveState = 'active';
  run.enemies = [];
  run.step({});
  const evs = run.drainEvents();
  assert.equal(run.phase, 'win');
  assert.ok(evs.some((e) => e.type === 'win'));
});

test('心跳里程碑：每秒至少一次 milestone 事件', () => {
  const run = createRun({ seed: 1 });
  let count = 0;
  for (let i = 0; i < 120; i += 1) {
    run.step({});
    for (const ev of run.drainEvents()) if (ev.type === 'milestone') count += 1;
  }
  assert.ok(count >= 1, `milestone=${count}`);
});

test('drainEvents 清空队列', () => {
  const run = createRun({ seed: 1 });
  run.wave = 1;
  run.waveState = 'active';
  run.step({ shoot: true });
  assert.ok(run.drainEvents().length > 0);
  assert.equal(run.drainEvents().length, 0);
});
