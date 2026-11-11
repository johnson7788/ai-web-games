// 赤色要塞 · M1 完整测试套件
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun, emptyMods } from '../src/game/sim.js';
import { STAGES } from '../config/levels.js';
import { WORLD, PLAYER, WEAPON, POW } from '../config/game.config.js';
import { generateMap } from '../src/game/level.js';
import { mulberry32 } from '../src/game/rng.js';

// ─── 基础契约 ───

test('createRun 返回 run 与标准 API', () => {
  const run = createRun({ stageIndex: 0, seed: 7 });
  for (const fn of ['step', 'getHud', 'drainEvents', 'getUpgradeChoices', 'applyUpgrade']) {
    assert.equal(typeof run[fn], 'function', `${fn} 应是函数`);
  }
  assert.equal(run.stageIndex, 0);
  assert.equal(run.state, 'fight');
});

test('5 行 smoke test 不抛错', () => {
  const r = createRun({ stageIndex: 0, seed: 7 });
  r.step({ mx: 0, my: -1, aimX: 640, aimY: 500, fire: true, grenade: false });
  const hud = r.getHud();
  const events = r.drainEvents();
  assert.ok(hud && typeof hud.hp === 'number');
  assert.ok(Array.isArray(events));
});

test('四个关卡都能创建、地图尺寸正确', () => {
  for (let i = 0; i < STAGES.length; i++) {
    const run = createRun({ stageIndex: i, seed: STAGES[i].seed });
    assert.equal(run.map.rows, STAGES[i].rows);
    assert.equal(run.map.levelH, STAGES[i].rows * 64);
    assert.equal(run.player.maxHp, 6);
  }
});

test('emptyMods 是干净的零值对象', () => {
  const m = emptyMods();
  assert.equal(m.pierce, 0);
  assert.equal(m.maxHp, 0);
  assert.ok(Object.keys(m).length >= 10);
});

// ─── 确定性 ───

test('同 seed 生成同一份地图（逐字节一致）', () => {
  const stage = STAGES[0];
  const m1 = generateMap(stage);
  const m2 = generateMap(stage);
  assert.equal(m1.solid.length, m2.solid.length);
  for (let i = 0; i < m1.solid.length; i++) {
    assert.equal(m1.solid[i], m2.solid[i], `solid[${i}] 应相同`);
  }
  for (let i = 0; i < m1.sand.length; i++) {
    assert.equal(m1.sand[i], m2.sand[i], `sand[${i}] 应相同`);
  }
});

test('不同 seed 生成不同地图', () => {
  const stage = { ...STAGES[0], seed: 1111 };
  const stage2 = { ...STAGES[0], seed: 2222 };
  const m1 = generateMap(stage);
  const m2 = generateMap(stage2);
  let diff = 0;
  for (let i = 0; i < m1.solid.length; i++) {
    if (m1.solid[i] !== m2.solid[i]) diff++;
  }
  assert.ok(diff > 10, `不同 seed 应有足够差异 (got ${diff})`);
});

test('同 seed 两次 createRun 产生相同波次（确定性 RNG）', () => {
  const r1 = createRun({ stageIndex: 0, seed: 42 });
  const r2 = createRun({ stageIndex: 0, seed: 42 });
  // Step both 300 times with same input
  for (let i = 0; i < 300; i++) {
    r1.step({ mx: 0, my: -1, aimX: 640, aimY: 300, fire: true, grenade: false });
    r2.step({ mx: 0, my: -1, aimX: 640, aimY: 300, fire: true, grenade: false });
  }
  assert.equal(r1.entities.length, r2.entities.length, '实体数应相同');
  assert.equal(r1.stats.kills, r2.stats.kills, '击杀数应相同');
  assert.equal(r1.stats.shots, r2.stats.shots, '射击数应相同');
});

// ─── 玩家移动/碰撞 ───

test('玩家移动：向上输入 → y 减小', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  const startY = run.player.y;
  for (let i = 0; i < 60; i++) run.step({ mx: 0, my: -1, aimX: 640, aimY: 300 });
  assert.ok(run.player.y < startY, '向上移动 y 应减小');
});

test('玩家移动：有加速度和摩擦', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.step({ mx: 1, my: 0, aimX: 900, aimY: 400 });
  assert.ok(run.player.vx > 0, '向右输入 vx 应 > 0');
  // Without input, friction should slow down
  for (let i = 0; i < 120; i++) run.step({ mx: 0, my: 0, aimX: 900, aimY: 400 });
  assert.ok(Math.abs(run.player.vx) < 10, '摩擦应使速度归零');
});

test('玩家不穿过岩壁', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  // Teleport to near border
  run.debug.teleport(run.levelH - 200);
  run.player.x = 50; // near left border
  const startX = run.player.x;
  for (let i = 0; i < 30; i++) run.step({ mx: -1, my: 0, aimX: 0, aimY: 400 });
  assert.ok(run.player.x >= 40, '玩家不能穿过左边界');
});

// ─── 摄像机 ───

test('摄像机只向上推进', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  const startCam = run.cameraY;
  for (let i = 0; i < 240; i++) run.step({ mx: 0, my: -1, aimX: 640, aimY: 200 });
  assert.ok(run.cameraY <= startCam, '镜头只向上');
});

test('玩家不出屏幕范围', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  for (let i = 0; i < 300; i++) {
    run.step({ mx: (i % 2 === 0 ? 1 : -1), my: -1, aimX: 640, aimY: 300 });
    const screenY = run.player.y - run.cameraY;
    assert.ok(screenY >= 0 && screenY <= 720, `玩家屏幕 y 应在 [0,720] 内, got ${screenY} at step ${i}`);
  }
});

// ─── 射击 ───

test('机枪射击产生子弹', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.step({ mx: 0, my: 0, aimX: 900, aimY: 400, fire: true });
  const bullets = run.entities.filter(e => e.kind === 'bullet' && e.owner === 'player');
  assert.ok(bullets.length >= 1, '应有至少 1 发子弹');
});

test('机枪有冷却', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.step({ mx: 0, my: 0, aimX: 900, aimY: 400, fire: true });
  const count1 = run.entities.filter(e => e.kind === 'bullet' && e.owner === 'player').length;
  run.step({ mx: 0, my: 0, aimX: 900, aimY: 400, fire: true });
  const count2 = run.entities.filter(e => e.kind === 'bullet' && e.owner === 'player').length;
  assert.equal(count2, count1, '冷却内不应发射新子弹');
});

test('子弹命中敌人产生事件', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  // Spawn an enemy close to player
  run.entities.push({
    id: 9999, kind: 'enemy', type: 'rifle', x: run.player.x + 100, y: run.player.y,
    vx: 0, vy: 0, r: 13, hp: 1, maxHp: 1, angle: 0, t: 0, life: 0,
    owner: 'enemy', dmg: 1, speed: 0, state: 'idle', dead: false,
    ai: { fireCd: 99, moveState: 'aim', burstLeft: 0, burstCd: 0, mortarFuse: 0, summonCd: 99, strafeDir: 1, strafeCd: 99 },
  });
  run.player.angle = 0; // aim right
  run.step({ mx: 0, my: 0, aimX: run.player.x + 200, aimY: run.player.y, fire: true });
  // Wait for bullet to reach
  for (let i = 0; i < 10; i++) run.step({ mx: 0, my: 0, aimX: run.player.x + 200, aimY: run.player.y, fire: false });
  const events = run.drainEvents();
  const hitEvts = events.filter(e => e.type === 'hit' && e.targetId === 9999);
  assert.ok(hitEvts.length >= 1, '应有命中事件');
});

// ─── 手雷 ───

test('手雷投掷有抛物线', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.player.grenades = 3;
  run.step({ mx: 0, my: 0, aimX: run.player.x + 200, aimY: run.player.y - 100, fire: false, grenade: true });
  const grenades = run.entities.filter(e => e.kind === 'grenade');
  assert.ok(grenades.length >= 1, '应有手雷');
  const g = grenades[0];
  assert.ok(g.z >= 0, '手雷 z 应 >= 0');
});

test('手雷爆炸伤害范围内敌人', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.player.grenades = 3;
  // Place enemy near grenade target
  const targetX = run.player.x + 100;
  const targetY = run.player.y;
  run.entities.push({
    id: 8888, kind: 'enemy', type: 'rifle', x: targetX, y: targetY,
    vx: 0, vy: 0, r: 13, hp: 10, maxHp: 10, angle: 0, t: 0, life: 0,
    owner: 'enemy', dmg: 1, speed: 0, state: 'idle', dead: false,
    ai: { fireCd: 99, moveState: 'aim', burstLeft: 0, burstCd: 0, mortarFuse: 0, summonCd: 99, strafeDir: 1, strafeCd: 99 },
  });
  // Throw grenade
  run.step({ mx: 0, my: 0, aimX: targetX, aimY: targetY, fire: false, grenade: true });
  // Wait for explosion
  for (let i = 0; i < 40; i++) run.step({ mx: 0, my: 0, aimX: targetX, aimY: targetY, fire: false, grenade: false });
  const enemy = run.entities.find(e => e.id === 8888);
  assert.ok(!enemy || enemy.dead || enemy.hp < 10, '敌人应受伤或死亡');
});

test('手雷爆炸清除敌方子弹', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.player.grenades = 3;
  // Spawn enemy bullet near player
  const bx = run.player.x + 50;
  const by = run.player.y;
  run.entities.push({
    id: 7777, kind: 'bullet', type: 'mg', x: bx, y: by, vx: -100, vy: 0,
    r: 7, angle: Math.PI, dmg: 1, speed: 100, life: 4, maxLife: 4, t: 0,
    owner: 'enemy', hp: 1, maxHp: 1, state: 'fly', dead: false, pierce: 0, hitList: [],
  });
  // Throw grenade at bullet location
  run.step({ mx: 0, my: 0, aimX: bx, aimY: by, fire: false, grenade: true });
  for (let i = 0; i < 40; i++) run.step({ mx: 0, my: 0, aimX: bx, aimY: by, fire: false, grenade: false });
  const bullet = run.entities.find(e => e.id === 7777);
  assert.ok(!bullet || bullet.dead, '敌方子弹应被清除');
});

test('手雷数量为 0 时不投掷', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.player.grenades = 0;
  run.step({ mx: 0, my: 0, aimX: 800, aimY: 400, fire: false, grenade: true });
  const grenades = run.entities.filter(e => e.kind === 'grenade');
  assert.equal(grenades.length, 0, '无手雷时不应产生手雷实体');
});

// ─── POW 拾取/交付/里程碑 ───

test('debug.spawnPow 生成战俘', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  const before = run.entities.filter(e => e.kind === 'pow').length;
  run.debug.spawnPow(3);
  const after = run.entities.filter(e => e.kind === 'pow').length;
  assert.equal(after - before, 3, '应新增 3 个战俘');
});

test('玩家接触战俘 → 拾取', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.debug.spawnPow(1);
  const pow = run.entities.find(e => e.kind === 'pow');
  pow.x = run.player.x + 10;
  pow.y = run.player.y + 10;
  run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
  assert.equal(run.player.pow, 1, '应拾取 1 个战俘');
  const events = run.drainEvents();
  assert.ok(events.some(e => e.type === 'powPickup'), '应有 powPickup 事件');
});

test('战俘拾取上限 6', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.debug.spawnPow(8);
  const pows = run.entities.filter(e => e.kind === 'pow');
  for (const pw of pows) { pw.x = run.player.x + 10; pw.y = run.player.y + 10; }
  run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
  assert.ok(run.player.pow <= 6, `战俘不应超过 6, got ${run.player.pow}`);
});

test('停机坪交付战俘', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  // Teleport player to first helipad
  const helipad = run.zones.find(z => z.type === 'helipad');
  if (helipad) {
    run.debug.teleport(helipad.y + 80);
    run.player.x = helipad.x + helipad.w / 2;
    run.player.y = helipad.y + helipad.h / 2;
    run.debug.spawnPow(1);
    const pow = run.entities.find(e => e.kind === 'pow' && e.state === 'idle');
    if (pow) { pow.x = run.player.x + 5; pow.y = run.player.y + 5; }
    // Pickup
    run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
    // Deliver (need multiple steps for CD)
    for (let i = 0; i < 30; i++) run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
    assert.ok(run.stats.delivered >= 1, '应交付至少 1 人');
  }
});

test('交付 4 人触发射速里程碑', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  const helipad = run.zones.find(z => z.type === 'helipad');
  if (helipad) {
    run.debug.teleport(helipad.y + 80);
    run.player.x = helipad.x + helipad.w / 2;
    run.player.y = helipad.y + helipad.h / 2;
    // Force delivered to 3
    run.stats.delivered = 3;
    run.debug.spawnPow(2);
    const pows = run.entities.filter(e => e.kind === 'pow' && e.state === 'idle');
    for (const pw of pows) { pw.x = run.player.x + 5; pw.y = run.player.y + 5; }
    run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
    for (let i = 0; i < 30; i++) run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
    assert.ok(run.milestones.rate, '应触发射速里程碑');
    assert.ok(run.mods.mgRate > 0, 'mgRate 应增加');
  }
});

// ─── 敌人 AI ───

test('rifle 敌人在射程内开火', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.entities.push({
    id: 6666, kind: 'enemy', type: 'rifle', x: run.player.x + 200, y: run.player.y,
    vx: 0, vy: 0, r: 13, hp: 1, maxHp: 1, angle: Math.PI, t: 0, life: 0,
    owner: 'enemy', dmg: 1, speed: 62, state: 'idle', dead: false,
    ai: { fireCd: 0.1, moveState: 'aim', burstLeft: 0, burstCd: 0, mortarFuse: 0, summonCd: 99, strafeDir: 1, strafeCd: 99 },
  });
  for (let i = 0; i < 30; i++) run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
  const enemyBullets = run.entities.filter(e => e.kind === 'bullet' && e.owner === 'enemy');
  assert.ok(enemyBullets.length >= 1, 'rifle 应发射子弹');
});

test('tank 敌人缓慢移动并开炮', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.entities.push({
    id: 5555, kind: 'enemy', type: 'tank', x: run.player.x + 300, y: run.player.y,
    vx: 0, vy: 0, r: 24, hp: 8, maxHp: 8, angle: Math.PI, t: 0, life: 0,
    owner: 'enemy', dmg: 2, speed: 46, state: 'idle', dead: false,
    ai: { fireCd: 0.1, moveState: 'approach', burstLeft: 0, burstCd: 0, mortarFuse: 0, summonCd: 99, strafeDir: 1, strafeCd: 99 },
  });
  for (let i = 0; i < 60; i++) run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
  const tank = run.entities.find(e => e.id === 5555);
  assert.ok(tank && !tank.dead, 'tank 应存活');
});

test('turret 固定不动但会开火', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  const tx = run.player.x + 200;
  const ty = run.player.y;
  run.entities.push({
    id: 4444, kind: 'enemy', type: 'turret', x: tx, y: ty,
    vx: 0, vy: 0, r: 20, hp: 5, maxHp: 5, angle: Math.PI, t: 0, life: 0,
    owner: 'enemy', dmg: 1, speed: 0, state: 'idle', dead: false,
    ai: { fireCd: 0.1, moveState: 'aim', burstLeft: 0, burstCd: 0, mortarFuse: 0, summonCd: 99, strafeDir: 1, strafeCd: 99 },
  });
  for (let i = 0; i < 60; i++) run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
  const turret = run.entities.find(e => e.id === 4444);
  assert.ok(turret && turret.x === tx && turret.y === ty, 'turret 不应移动');
});

test('mine 在玩家接近时引爆', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  const mx = run.player.x + 30;
  const my = run.player.y;
  run.entities.push({
    id: 3333, kind: 'enemy', type: 'mine', x: mx, y: my,
    vx: 0, vy: 0, r: 14, hp: 1, maxHp: 1, angle: 0, t: 0, life: 0,
    owner: 'enemy', dmg: 2, speed: 0, state: 'idle', dead: false,
    ai: { fireCd: 99, moveState: 'idle', burstLeft: 0, burstCd: 0, mortarFuse: 0, summonCd: 99, strafeDir: 1, strafeCd: 99 },
  });
  // Move player toward mine
  for (let i = 0; i < 30; i++) run.step({ mx: 1, my: 0, aimX: mx + 100, aimY: my, fire: false });
  const mine = run.entities.find(e => e.id === 3333);
  assert.ok(!mine || mine.dead, '地雷应被引爆');
});

// ─── Boss ───

test('第 4 关 Boss 激活', () => {
  const run = createRun({ stageIndex: 3, seed: STAGES[3].seed });
  run.debug.teleport(200);
  for (let i = 0; i < 10; i++) run.step({ mx: 0, my: -1, aimX: 640, aimY: 100 });
  assert.ok(run.boss, 'Boss 应激活');
  assert.equal(run.boss.type, 'boss');
  assert.equal(run.boss.nodes.length, 4);
});

test('Boss 节点全部摧毁 → 护盾消失', () => {
  const run = createRun({ stageIndex: 3, seed: STAGES[3].seed });
  run.debug.teleport(200);
  for (let i = 0; i < 10; i++) run.step({ mx: 0, my: -1, aimX: 640, aimY: 100 });
  assert.ok(run.boss && run.boss.shield > 0, '初始应有护盾');
  for (const node of run.boss.nodes) {
    run.debug.damageBoss(100);
  }
  assert.equal(run.boss.shield, 0, '全部节点摧毁后护盾应消失');
  assert.equal(run.boss.phase, 2, '应进入 phase 2');
});

test('debug.damageBoss 可击杀 Boss', () => {
  const run = createRun({ stageIndex: 3, seed: STAGES[3].seed });
  run.debug.teleport(200);
  for (let i = 0; i < 10; i++) run.step({ mx: 0, my: -1, aimX: 640, aimY: 100 });
  // Destroy all nodes first
  for (const node of run.boss.nodes) {
    node.alive = false;
    node.hp = 0;
  }
  run.boss.shield = 0;
  run.boss.phase = 2;
  // Damage core
  run.debug.damageBoss(200);
  assert.equal(run.state, 'clear', 'Boss 击杀后应 clear');
});

// ─── 升级 ───

test('升级可叠加', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  const ids = run.getUpgradeChoices(3);
  assert.ok(ids.length >= 1, '应有可升级项');
  run.applyUpgrade(ids[0]);
  run.applyUpgrade(ids[0]);
  assert.equal(run.picked[ids[0]], 2, '应叠加 2 级');
});

test('armor 升级增加 maxHp', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  const origMax = run.player.maxHp;
  run.applyUpgrade('armor');
  assert.equal(run.player.maxHp, origMax + 2, 'maxHp 应 +2');
});

test('turbo 升级增加速度', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.applyUpgrade('turbo');
  assert.ok(run.mods.speedMul > 0, 'speedMul 应增加');
});

test('升级池耗尽后返回空', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  // Apply all upgrades to max
  for (let i = 0; i < 20; i++) {
    const ids = run.getUpgradeChoices(3);
    if (ids.length === 0) break;
    run.applyUpgrade(ids[0]);
  }
  const final = run.getUpgradeChoices(3);
  assert.equal(final.length, 0, '所有升满后应无可选');
});

// ─── 关卡推进 ───

test('到达关顶触发 clear', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.debug.teleport(100);
  run.cameraY = 0;
  run.player.y = 100;
  run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
  assert.equal(run.state, 'clear', '到达关顶应 clear');
});

test('HUD progress 随镜头变化', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  const h1 = run.getHud();
  for (let i = 0; i < 120; i++) run.step({ mx: 0, my: -1, aimX: 640, aimY: 200 });
  const h2 = run.getHud();
  assert.ok(h2.progress > h1.progress, '向上推进后 progress 应增加');
});

// ─── 玩家死亡 ───

test('debug.setPlayerHp(0) 触发死亡', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.player.hp = 1;
  run.player.invuln = 0;
  // Simulate damage via enemy bullet
  run.entities.push({
    id: 2222, kind: 'bullet', type: 'mg', x: run.player.x + 5, y: run.player.y + 5,
    vx: -200, vy: 0, r: 7, angle: Math.PI, dmg: 5, speed: 200, life: 2, maxLife: 2, t: 0,
    owner: 'enemy', hp: 1, maxHp: 1, state: 'fly', dead: false, pierce: 0, hitList: [],
  });
  run.step({ mx: 0, my: 0, aimX: 640, aimY: 400 });
  assert.equal(run.state, 'dead', 'HP 归零应 dead');
  const events = run.drainEvents();
  assert.ok(events.some(e => e.type === 'playerDead'), '应有 playerDead 事件');
});

// ─── Debug API ───

test('debug.teleport 正确传送', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.debug.teleport(1000);
  assert.ok(Math.abs(run.player.y - 1000) < 100, '玩家 y 应接近目标');
});

test('debug.airstrike 产生事件', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  run.debug.airstrike();
  const events = run.drainEvents();
  assert.ok(events.some(e => e.type === 'airstrike'), '应有 airstrike 事件');
});

// ─── 性能 ───

test('3600 步 < 1.5s（40 敌人 + 200 子弹）', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  // Spawn many entities
  for (let i = 0; i < 40; i++) {
    run.entities.push({
      id: 10000 + i, kind: 'enemy', type: 'rifle',
      x: 200 + (i % 10) * 100, y: 200 + Math.floor(i / 10) * 100,
      vx: 0, vy: 0, r: 13, hp: 1, maxHp: 1, angle: 0, t: 0, life: 0,
      owner: 'enemy', dmg: 1, speed: 62, state: 'idle', dead: false,
      ai: { fireCd: 1, moveState: 'aim', burstLeft: 0, burstCd: 0, mortarFuse: 0, summonCd: 99, strafeDir: 1, strafeCd: 99 },
    });
  }
  for (let i = 0; i < 200; i++) {
    run.entities.push({
      id: 20000 + i, kind: 'bullet', type: 'mg',
      x: Math.random() * 1280, y: Math.random() * 720,
      vx: (Math.random() - 0.5) * 400, vy: (Math.random() - 0.5) * 400,
      r: 6, angle: 0, dmg: 1, speed: 400, life: 0.85, maxLife: 0.85, t: 0,
      owner: 'player', hp: 1, maxHp: 1, state: 'fly', dead: false, pierce: 0, hitList: [],
    });
  }
  const start = performance.now();
  for (let i = 0; i < 3600; i++) {
    run.step({ mx: 0, my: -1, aimX: 640, aimY: 300, fire: true });
  }
  const elapsed = performance.now() - start;
  assert.ok(elapsed < 1500, `3600 步应 < 1.5s, got ${elapsed.toFixed(1)}ms`);
});

// ─── 地图生成 ───

test('地图出生点可走', () => {
  for (let i = 0; i < STAGES.length; i++) {
    const run = createRun({ stageIndex: i, seed: STAGES[i].seed });
    const px = run.player.x;
    const py = run.player.y;
    const tx = Math.floor(px / 64);
    const ty = Math.floor(py / 64);
    const v = run.map.solid[ty * run.map.cols + tx];
    assert.ok(v !== 1 && v !== 2, `Stage ${i} 出生点 (${tx},${ty}) 应可走, got solid=${v}`);
  }
});

test('地图边界全是岩壁', () => {
  const run = createRun({ stageIndex: 0, seed: 5 });
  const map = run.map;
  for (let x = 0; x < map.cols; x++) {
    assert.equal(map.solid[x], 1, '顶边应是岩壁');
    assert.equal(map.solid[(map.rows - 1) * map.cols + x], 1, '底边应是岩壁');
  }
  for (let y = 0; y < map.rows; y++) {
    assert.equal(map.solid[y * map.cols], 1, '左边应是岩壁');
    assert.equal(map.solid[y * map.cols + map.cols - 1], 1, '右边应是岩壁');
  }
});

// ─── 碰撞回归（P0：贴水边不能被吸进水里卡死） ───

function tileOf(run, x, y) {
  return run.map.solid[Math.floor(y / 64) * run.map.cols + Math.floor(x / 64)];
}

test('水边向右行驶：不会进入水格，也不会被吸住', () => {
  const run = createRun({ stageIndex: 0, seed: 4107 });
  run.player.x = 660;
  run.player.y = 1560;
  run.cameraY = 1036;
  for (let i = 0; i < 240; i += 1) run.step({ mx: 1, my: 0, aimX: 900, aimY: 1560 });
  assert.equal(tileOf(run, run.player.x, run.player.y), 0, '车心必须在地面格上');
  assert.ok(run.player.x + run.player.r <= 704.5, `不能压进 x>=704 的水格，实际 x=${run.player.x}`);
  // 贴边后仍能向上开
  const y0 = run.player.y;
  for (let i = 0; i < 120; i += 1) run.step({ mx: 0, my: -1, aimX: 640, aimY: 1200 });
  assert.ok(run.player.y < y0 - 20, `贴边后应能继续向上，y ${y0} -> ${run.player.y}`);
  assert.equal(tileOf(run, run.player.x, run.player.y), 0);
});

test('随机输入 2000 步：车心永远不在阻挡格内', () => {
  const run = createRun({ stageIndex: 0, seed: 4107 });
  const rng = mulberry32(99);
  run.player.hp = 99999; // 只测碰撞，不测战斗
  run.player.maxHp = 99999;
  let moved = 0;
  let px = run.player.x;
  let py = run.player.y;
  for (let i = 0; i < 2000; i += 1) {
    run.step({
      mx: rng() * 2 - 1,
      my: rng() * 2 - 1,
      aimX: rng() * WORLD.W,
      aimY: run.cameraY + rng() * WORLD.H,
    });
    assert.equal(tileOf(run, run.player.x, run.player.y), 0, `第 ${i} 步卡进阻挡格 (${run.player.x},${run.player.y})`);
    if (Math.hypot(run.player.x - px, run.player.y - py) > 1) moved += 1;
    px = run.player.x;
    py = run.player.y;
    if (run.state !== 'fight') break;
  }
  assert.ok(moved > 20, `应该能移动，实际移动帧 ${moved}`);
});

test('沙袋阻挡载具（载具不能穿过沙袋）', () => {
  const run = createRun({ stageIndex: 0, seed: 4107 });
  let found = null;
  for (let ty = 2; ty < run.map.rows - 2 && !found; ty += 1) {
    for (let tx = 2; tx < run.map.cols - 3; tx += 1) {
      if (run.map.solid[ty * run.map.cols + tx] === 3 && run.map.solid[ty * run.map.cols + tx - 1] === 0) {
        found = { tx, ty };
        break;
      }
    }
  }
  assert.ok(found, '地图里应有沙袋墙');
  run.player.x = found.tx * 64 - 40;
  run.player.y = found.ty * 64 + 32;
  run.cameraY = Math.max(0, run.player.y - 400);
  for (let i = 0; i < 180; i += 1) run.step({ mx: 1, my: 0, aimX: 1200, aimY: run.player.y });
  assert.ok(run.player.x + run.player.r <= found.tx * 64 + 0.5, `不能压进沙袋，实际 x=${run.player.x}`);
  assert.equal(tileOf(run, run.player.x, run.player.y), 0);
});
