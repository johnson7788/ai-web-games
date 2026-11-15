import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createSim, updateSim, drainEvents, getHud, ratingFor, contains } from '../src/game/sim.js';
import { PHYS, WORLD, TOWER, CRUMBLE } from '../config/game.config.js';

const plat = (sim, id) => sim.platforms.find((p) => p.id === id);
const step = (sim, n, input = {}) => { for (let i = 0; i < n; i++) updateSim(sim, input); };

// 把玩家放到某平台正上方并砸下去，触发落地
function dropOnto(sim, id) {
  const q = plat(sim, id);
  const p = sim.player;
  p.x = q.x; p.z = q.z; p.y = q.y + 0.5; p.vx = 0; p.vz = 0; p.vy = -40;
  p.onGround = false; p.groundPlat = null;
  updateSim(sim, {});
}

test('初始：站在第 1 层，phase=playing', () => {
  const sim = createSim();
  assert.equal(sim.phase, 'playing');
  assert.equal(sim.floor, 1);
  assert.equal(sim.maxFloor, 1);
  assert.ok(sim.player.onGround);
  assert.equal(sim.player.groundPlat, 'landing-1');
  assert.ok(drainEvents(sim).some((e) => e.type === 'start'));
});

test('跳跃：按跳后 vy>0 且离地', () => {
  const sim = createSim();
  updateSim(sim, { jump: true });
  assert.ok(sim.player.vy > 0);
  assert.ok(!sim.player.onGround);
});

test('落地：原地跳起后落回平台', () => {
  const sim = createSim();
  updateSim(sim, { jump: true });
  step(sim, 200);
  assert.ok(sim.player.onGround);
  assert.equal(sim.player.y, plat(sim, 'landing-1').y);
});

test('coyote：离地 120ms 内还能起跳', () => {
  const sim = createSim();
  const p = sim.player;
  p.onGround = false; p.groundPlat = null; p.coyote = 0.1; p.y = 10;
  updateSim(sim, { jump: true });
  assert.ok(p.vy > 0, 'coyote 窗口内应能起跳');
});

test('coyote 过期后不能起跳', () => {
  const sim = createSim();
  const p = sim.player;
  p.onGround = false; p.groundPlat = null; p.coyote = 0; p.y = 10;
  updateSim(sim, { jump: true });
  assert.equal(p.vy, -PHYS.gravity * (1 / 60), 'coyote 过期后只受重力');
});

test('jump buffer：落地前按跳，落地瞬间自动起跳', () => {
  const sim = createSim();
  const p = sim.player;
  p.onGround = false; p.groundPlat = null; p.coyote = 0; p.y = 10;
  updateSim(sim, { jump: true });
  assert.ok(p.jumpBuffer > 0, '按跳应进入 buffer');
  assert.equal(p.vy, -PHYS.gravity * (1 / 60));
  // 落地（回第 1 层上方）后 buffer 触发
  p.onGround = true; p.coyote = PHYS.coyote; p.groundPlat = 'landing-1';
  updateSim(sim, {});
  assert.ok(p.vy > 0, '落地后 buffer 应触发起跳');
});

test('冲刺：只能在空中用，落地回充', () => {
  const sim = createSim();
  const p = sim.player;
  assert.equal(p.dashAvailable, true);
  // 地面按冲刺无效
  updateSim(sim, { dash: true });
  assert.equal(p.dashAvailable, true);
  // 空中冲刺
  updateSim(sim, { jump: true });
  const before = Math.hypot(p.vx, p.vz);
  updateSim(sim, { dash: true });
  assert.equal(p.dashAvailable, false);
  assert.ok(Math.hypot(p.vx, p.vz) >= PHYS.dashSpeed - 0.01, '冲刺应把水平速度推到 dashSpeed');
});

test('冲刺后落地回充', () => {
  const sim = createSim();
  const p = sim.player;
  updateSim(sim, { jump: true });
  updateSim(sim, { dash: true });
  assert.equal(p.dashAvailable, false);
  dropOnto(sim, 'landing-1');
  assert.equal(p.dashAvailable, true);
});

test('走空：离开平台脚印后开始下落', () => {
  const sim = createSim();
  const p = sim.player;
  const q = plat(sim, 'landing-1');
  p.x = q.x + q.half - 0.05; p.z = q.z; p.y = q.y;
  // 朝外移动直到脱离脚印
  let fell = false;
  for (let i = 0; i < 40; i++) { updateSim(sim, { moveF: 1, moveS: 0 }); if (!p.onGround) { fell = true; break; } }
  assert.ok(fell, '朝平台外走应脱离地面');
});

test('坠落：低于击杀面回第 1 层并计 1 次坠落', () => {
  const sim = createSim();
  const p = sim.player;
  p.onGround = false; p.groundPlat = null;
  p.y = WORLD.KILL_Y + 0.5; p.vy = -40;
  updateSim(sim, {});
  assert.equal(sim.falls, 1);
  assert.equal(sim.floor, 1);
  assert.ok(p.onGround);
  assert.ok(drainEvents(sim).some((e) => e.type === 'fall'));
});

test('第 2 层：落到 landing-2 触发 level_up 与 maxFloor=2', () => {
  const sim = createSim();
  dropOnto(sim, 'landing-2');
  assert.equal(sim.floor, 2);
  assert.equal(sim.maxFloor, 2);
  assert.ok(drainEvents(sim).some((e) => e.type === 'level_up' && e.floor === 2));
});

test('存档：到达第 5 层后坠落回第 5 层', () => {
  const sim = createSim();
  dropOnto(sim, 'landing-5');
  assert.equal(sim.checkpointFloor, 5);
  assert.ok(drainEvents(sim).some((e) => e.type === 'checkpoint' && e.floor === 5));
  const p = sim.player;
  p.onGround = false; p.groundPlat = null;
  p.y = WORLD.KILL_Y + 0.5; p.vy = -40;
  updateSim(sim, {});
  assert.equal(sim.floor, 5, '应回到第 5 层');
  assert.equal(sim.player.groundPlat, 'landing-5');
  assert.equal(sim.falls, 1);
});

test('登顶：落到 landing-10 触发胜利与评级', () => {
  const sim = createSim();
  dropOnto(sim, 'landing-10');
  assert.equal(sim.phase, 'won');
  assert.equal(sim.rating, ratingFor(sim.falls, sim.time));
  const won = drainEvents(sim).find((e) => e.type === 'won');
  assert.ok(won);
  assert.equal(typeof won.rating, 'string');
});

test('评级：零坠落且够快 = S，多次坠落 = C', () => {
  assert.equal(ratingFor(0, 50), 'S');
  assert.equal(ratingFor(1, 100), 'A');
  assert.equal(ratingFor(2, 200), 'B');
  assert.equal(ratingFor(4, 200), 'C');
});

test('塌方块：踩上 0.6s 后消失', () => {
  const sim = createSim();
  const q = plat(sim, 'step-5');
  assert.ok(q.crumble);
  dropOnto(sim, 'step-5');
  assert.ok(q.crumbling);
  step(sim, Math.ceil(CRUMBLE.time * 60) + 2);
  assert.ok(q.collapsed, '0.6s 后应坍塌');
  assert.ok(drainEvents(sim).some((e) => e.type === 'crumble'));
});

test('水平移动平台：moveH 会改变 x/z', () => {
  const sim = createSim();
  const q = plat(sim, 'step-3');
  assert.equal(q.type, 'moveH');
  const x0 = q.x, z0 = q.z;
  step(sim, 30);
  assert.ok(Math.abs(q.x - x0) > 0.01 || Math.abs(q.z - z0) > 0.01, 'moveH 平台应移动');
});

test('垂直移动平台：moveV 会改变 y', () => {
  const sim = createSim();
  const q = plat(sim, 'step-7');
  assert.equal(q.type, 'moveV');
  const y0 = q.y;
  step(sim, 30);
  assert.ok(Math.abs(q.y - y0) > 0.01, 'moveV 平台应升降');
});

test('旋转平台：rotate 会绕中心改变位置', () => {
  const sim = createSim();
  const q = plat(sim, 'step-9');
  assert.equal(q.type, 'rotate');
  const x0 = q.x, z0 = q.z;
  step(sim, 30);
  assert.ok(Math.abs(q.x - x0) > 0.01 || Math.abs(q.z - z0) > 0.01);
});

test('侧风：第 7 层以下无风，7 层起有风且换向', () => {
  const sim = createSim();
  const p = sim.player;
  p.onGround = false; p.groundPlat = null;
  p.y = WORLD.WIND_MIN_Y - 1; p.vx = 0; p.vy = 0;
  updateSim(sim, {});
  assert.equal(p.vx, 0, '低层无侧风');
  // 站到第 7 层（y=36），持续 5s 应触发一次风向切换
  dropOnto(sim, 'landing-7');
  let gust = false;
  for (let i = 0; i < 60 * 6; i++) {
    updateSim(sim, {});
    if (drainEvents(sim).some((e) => e.type === 'wind_gust')) gust = true;
  }
  assert.ok(gust, '7 层起应有风向切换事件');
});

test('contains：脚印边界判定', () => {
  const q = { x: 0, z: 0, half: 2 };
  assert.ok(contains(q, 1.9, 1.9, 0.1));
  assert.ok(!contains(q, 2.2, 0, 0.1));
  assert.ok(contains(q, 2.1, 0, 0.15));
});

test('drainEvents 清空队列，getHud 字段齐全', () => {
  const sim = createSim();
  const ev = drainEvents(sim);
  assert.ok(ev.length >= 1);
  assert.equal(sim.events.length, 0);
  const hud = getHud(sim);
  assert.equal(hud.phase, 'playing');
  assert.equal(hud.floor, 1);
  assert.equal(hud.falls, 0);
  assert.equal(typeof hud.time, 'number');
});

test('R 键（respawn）回起点', () => {
  const sim = createSim();
  dropOnto(sim, 'landing-3');
  assert.equal(sim.floor, 3);
  updateSim(sim, { respawn: true });
  assert.equal(sim.floor, 1);
  assert.equal(sim.player.groundPlat, 'landing-1');
});
