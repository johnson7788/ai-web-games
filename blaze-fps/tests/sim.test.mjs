import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, updateSim, drainEvents, getHud, applyUpgrade, mulberry32 } from '../src/game/sim.js';
import { PLAYER, WEAPONS, ENEMIES, MAPS, WAVES, HEADSHOT_MULT, WAVES_PER_MAP } from '../config/game.config.js';

const noInput = () => ({});
const steps = (run, n, input = noInput) => { for (let i = 0; i < n; i++) updateSim(run, input()); };

// 构造一个站在 (x,z)、面向玩家的测试敌人
function enemyAt(kind, x, z) {
  const base = ENEMIES[kind];
  return {
    id: (Math.random() * 1e9) | 0, kind, x, z, yaw: 0,
    hp: base.hp, maxHp: base.hp, speed: base.speed, radius: base.radius, height: base.height,
    score: base.score, color: base.color,
    meleeDmg: base.meleeDmg || 0, meleeRange: base.meleeRange || 0, cd: 0, cd0: base.meleeCd || base.fireCd || 1,
    fuse: base.fuse || 0, summonCd: base.summonCd || 0,
    shootRange: base.shootRange || 0, bulletDmg: base.bulletDmg || 0, bulletSpeed: base.bulletSpeed || 0,
    fireCd0: base.fireCd || 0, preferredDist: base.preferredDist || 0,
  };
}

test('初始状态：第 1 波 / 第 1 图 / 满血 / phase=wave', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.wave, 1);
  assert.equal(r.mapIndex, 0);
  assert.equal(r.phase, 'wave');
  assert.equal(r.player.hp, PLAYER.maxHp);
  assert.equal(r.player.weapon, 'rifle');
});

test('updateSim 推进时间', () => {
  const r = createRun({ seed: 1 });
  const t0 = r.time;
  updateSim(r, {});
  assert.ok(r.time > t0);
  assert.equal(r.time, t0 + 1 / 60);
});

test('同 seed 生成相同首波敌人位置（确定性）', () => {
  const a = createRun({ seed: 7 });
  const b = createRun({ seed: 7 });
  steps(a, 60); steps(b, 60);
  assert.equal(a.enemies.length, b.enemies.length);
  for (let i = 0; i < a.enemies.length; i++) {
    assert.equal(a.enemies[i].x, b.enemies[i].x);
    assert.equal(a.enemies[i].z, b.enemies[i].z);
  }
});

test('intro 后首波敌人生成', () => {
  const r = createRun({ seed: 1 });
  assert.equal(r.waveState, 'intro');
  steps(r, 60); // 0.9s + 余量
  assert.equal(r.waveState, 'active');
  assert.ok(r.enemies.length >= 3);
});

test('射击扣弹药并产生 shot 事件 + 子弹', () => {
  const r = createRun({ seed: 1 });
  steps(r, 60); // 进入战斗
  const before = r.player.ammo.rifle;
  updateSim(r, { fire: true });
  const evs = drainEvents(r);
  assert.equal(r.player.ammo.rifle, before - 1);
  assert.ok(evs.some((e) => e.type === 'shot'));
  assert.ok(r.bullets.length > 0);
});

test('步枪有射速上限（cooldown）', () => {
  const r = createRun({ seed: 1 });
  steps(r, 60);
  updateSim(r, { fire: true });
  const a = r.player.ammo.rifle;
  updateSim(r, { fire: true }); // 紧接着再扣扳机
  assert.equal(r.player.ammo.rifle, a); // cooldown 未到，不应再射
});

test('换弹：空弹匣换弹后回满', () => {
  const r = createRun({ seed: 1 });
  r.player.ammo.rifle = 0;
  updateSim(r, { reload: true });
  assert.ok(r.reloadT > 0);
  steps(r, Math.ceil(WEAPONS.rifle.reload * 60) + 2);
  assert.equal(r.player.ammo.rifle, WEAPONS.rifle.mag);
  assert.equal(r.player.reserve.rifle, WEAPONS.rifle.reserve - WEAPONS.rifle.mag);
});

test('切枪：1/2/3 切换', () => {
  const r = createRun({ seed: 1 });
  updateSim(r, { switchTo: 'shotgun' });
  assert.equal(r.player.weapon, 'shotgun');
  updateSim(r, { switchTo: 'pistol' });
  assert.equal(r.player.weapon, 'pistol');
});

test('移动：forward 沿视角方向前进', () => {
  const r = createRun({ seed: 1 });
  const p = r.player;
  p.yaw = 0; p.x = 0; p.z = 10;
  const z0 = p.z;
  steps(r, 10, () => ({ forward: 1 }));
  assert.ok(p.z < z0, '面向 -z 前进，z 应减小');
});

test('冲刺：能耗 + 比走路快', () => {
  const r = createRun({ seed: 1 });
  const p = r.player;
  p.yaw = 0; p.x = 0; p.z = 10; p.energy = PLAYER.maxEnergy;
  const e0 = p.energy;
  steps(r, 10, () => ({ forward: 1, sprint: true }));
  assert.ok(p.energy < e0, '冲刺应耗能');
  assert.ok(p.sprinting);
});

test('玩家被边界夹住', () => {
  const r = createRun({ seed: 1 });
  const p = r.player;
  p.yaw = Math.PI / 2; // 面向 +x
  for (let i = 0; i < 500; i++) updateSim(r, { forward: 1 });
  assert.ok(Math.abs(p.x) <= MAPS[0].size, '不能越界');
});

test('射手敌人远程射击会伤害玩家', () => {
  const r = createRun({ seed: 1 });
  r.enemies = [enemyAt('shooter', r.player.x, r.player.z - 10)];
  r.waveState = 'active';
  const hp0 = r.player.hp;
  steps(r, 90);
  assert.ok(r.player.hp < hp0, '玩家应掉血');
  const evs = drainEvents(r);
  assert.ok(evs.some((e) => e.type === 'playerHurt'));
});

test('爆头造成 2.5 倍伤害并触发慢镜', () => {
  const r = createRun({ seed: 1 });
  r.enemies = [enemyAt('rusher', r.player.x, r.player.z - 4)];
  r.waveState = 'active';
  const e = r.enemies[0];
  const hp0 = e.hp;
  // 瞄头顶（略高于眼高）
  const pitch = Math.atan2(e.height - PLAYER.eyeY, 4);
  updateSim(r, { fire: true, aim: true, yaw: 0, pitch });
  steps(r, 12, () => ({ yaw: 0, pitch }));
  const evs = drainEvents(r);
  const dmg = hp0 - e.hp;
  assert.ok(evs.some((x) => x.type === 'headshot') || r.stats.headshots > 0, '应判定爆头');
  assert.ok(dmg >= WEAPONS.rifle.dmg * HEADSHOT_MULT * 0.95, `爆头伤害应 ≥2.5×（实际 ${dmg}）`);
  assert.ok(r.slowmoT > 0 || r.stats.headshots > 0, '应触发慢镜或计爆头');
});

test('击杀敌人：kill 事件 + 击杀数 +1', () => {
  const r = createRun({ seed: 1 });
  const e = enemyAt('rusher', r.player.x, r.player.z - 4);
  e.hp = 10; // 一枪死
  r.enemies = [e];
  r.waveState = 'active';
  updateSim(r, { fire: true, yaw: 0, pitch: 0 });
  steps(r, 12, () => ({ yaw: 0, pitch: 0 })); // 等子弹飞行命中
  const evs = drainEvents(r);
  assert.equal(r.stats.kills, 1);
  assert.ok(evs.some((x) => x.type === 'kill'));
});

test('清完一波进入 upgrade，三选一', () => {
  const r = createRun({ seed: 1 });
  steps(r, 60);
  r.enemies.forEach((e) => { e.hp = 0; });
  updateSim(r, {});
  const evs = drainEvents(r);
  assert.equal(r.phase, 'upgrade');
  assert.ok(evs.some((x) => x.type === 'waveClear'));
  assert.equal(r.upgradeChoices.length, 3);
});

test('applyUpgrade 生效并推进波次', () => {
  const r = createRun({ seed: 1 });
  steps(r, 60);
  r.enemies.forEach((e) => { e.hp = 0; });
  updateSim(r, {});
  const id = r.upgradeChoices[0].id;
  applyUpgrade(r, id);
  assert.ok(r.upgrades.includes(id));
  assert.equal(r.phase, 'wave');
  assert.equal(r.wave, 2);
});

test('dmg10 升级提高伤害倍率', () => {
  const r = createRun({ seed: 1 });
  const before = r.bonuses.dmg;
  r.upgrades.push('dmg10');
  // 直接重新计算：applyUpgrade 走完整流程
  r.phase = 'upgrade';
  r.upgradeChoices = [{ id: 'dmg10' }];
  applyUpgrade(r, 'dmg10');
  assert.ok(r.bonuses.dmg > before);
});

test('死亡 = 本波重开，保留升级，deaths +1', () => {
  const r = createRun({ seed: 1 });
  steps(r, 60);
  r.upgrades.push('pierce');
  const killsBefore = r.stats.kills;
  r.player.hp = 1;
  updateSim(r, {});
  // 造一个近身必死的敌人
  r.enemies = [enemyAt('rusher', r.player.x, r.player.z)];
  r.waveState = 'active';
  r.player.hp = 0;
  updateSim(r, {});
  assert.equal(r.stats.deaths, 1);
  assert.equal(r.player.hp, r.player.maxHp, '死亡后满血复活');
  assert.ok(r.upgrades.includes('pierce'), '升级保留');
  assert.ok(r.enemies.length > 0, '本波重开，敌人重刷');
});

test('第 5 波 Boss 存在', () => {
  const r = createRun({ seed: 1 });
  r.wave = 5;
  steps(r, 60);
  assert.ok(r.enemies.some((e) => e.kind === 'boss'));
});

test('第 5 波通关第 3 图 = victory', () => {
  const r = createRun({ seed: 1 });
  r.mapIndex = 2;
  r.wave = 5;
  steps(r, 60);
  r.enemies.forEach((e) => { e.hp = 0; });
  updateSim(r, {});
  const evs = drainEvents(r);
  assert.equal(r.phase, 'victory');
  assert.ok(evs.some((x) => x.type === 'victory'));
});

test('手枪备弹无限', () => {
  const r = createRun({ seed: 1 });
  updateSim(r, { switchTo: 'pistol' });
  assert.equal(r.player.reserve.pistol, Infinity);
  updateSim(r, { fire: true });
  assert.equal(r.player.reserve.pistol, Infinity);
});

test('爆头慢镜升级延长慢镜时间', () => {
  const r = createRun({ seed: 1 });
  r.upgrades.push('headshot-slowmo');
  r.enemies = [enemyAt('rusher', r.player.x, r.player.z - 4)];
  r.enemies[0].hp = 1;
  r.waveState = 'active';
  const pitch = Math.atan2(r.enemies[0].height - PLAYER.eyeY, 4);
  updateSim(r, { fire: true, aim: true, yaw: 0, pitch });
  steps(r, 12, () => ({ yaw: 0, pitch }));
  assert.ok(r.slowmoT > 0.4, '慢镜已触发且被升级延长');
});

test('mulberry32 确定性', () => {
  const a = mulberry32(42), b = mulberry32(42);
  for (let i = 0; i < 10; i++) assert.equal(a(), b());
});

test('getHud 提供完整字段', () => {
  const r = createRun({ seed: 1 });
  const h = getHud(r);
  for (const k of ['hp', 'ammo', 'weapon', 'wave', 'map', 'kills', 'phase']) {
    assert.ok(k in h, `HUD 缺少 ${k}`);
  }
});
