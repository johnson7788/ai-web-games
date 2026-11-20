import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { HEAD, WORLD, ORBS } from '../config/gameplay.js';

// ---------- 测试工具 ----------
function stepN(run, n, input = {}) {
  for (let i = 0; i < n; i += 1) run.step(input);
}

// 直接注入一面墙到头部当前位置（碰撞单元测试用，白色盒）
function wall(run, { value, kind = 'coral', x, worldY, w = 200, h = 200, partIndex, moving } = {}) {
  const wobj = {
    id: run.nextId++,
    x: x ?? run.head.x - 60, // 墙中心在头右侧 40px：既相交，又让火花不贴脸即吸
    worldY: worldY ?? run.depth * 10,
    w, h, value, initial: value, kind,
  };
  if (partIndex != null) wobj.partIndex = partIndex;
  if (moving) { wobj.moving = true; wobj.vx = 90; }
  run.walls.push(wobj);
  return wobj;
}

function injectBoss(run, baseValue) {
  run.boss = {
    id: run.nextId++, depth: run.depth, active: true, baseValue,
    regen: [Infinity, Infinity, Infinity, Infinity, Infinity],
    segments: [],
  };
  for (let i = 0; i < 5; i += 1) {
    run.boss.segments.push({ x: i * 256, w: 256, h: 120, value: baseValue, initial: baseValue, partIndex: i });
    wall(run, { value: baseValue, kind: 'bossPart', x: i * 256, w: 256, h: 120, partIndex: i });
  }
  return run.boss;
}

function types(events) {
  return events.map((e) => e.type);
}

// ---------- 契约 / 初始状态 ----------
test('createRun 初始状态符合契约', () => {
  const run = createRun({ seed: 1 });
  assert.equal(run.phase, 'playing');
  assert.equal(run.orbsCount, ORBS.START);
  assert.equal(run.depth, 0);
  assert.equal(run.zone, 1);
  assert.equal(run.head.x, HEAD.START_X);
  assert.deepEqual(run.stats, { depth: 0, maxCombo: 0, zoneReached: 1, wallsBroken: 0, goldEaten: 0 });
  assert.deepEqual(run.drainEvents(), []);
});

test('getHud 契约字段齐全且 zoneName 是 i18n key', () => {
  const run = createRun({ seed: 2 });
  const hud = run.getHud();
  assert.deepEqual(Object.keys(hud).sort(), [
    'bossHp', 'bossMax', 'combo', 'dashHeat', 'depth', 'lightRadius', 'maxCombo', 'orbs', 'phase', 'zone', 'zoneName',
  ]);
  assert.equal(hud.zoneName, 'zone.1');
  assert.equal(hud.orbs, 10);
  assert.equal(hud.phase, 'playing');
});

test('同 seed 同输入 → 同结果（随机种子确定性）', () => {
  const a = createRun({ seed: 42 });
  const b = createRun({ seed: 42 });
  stepN(a, 120, { steerX: 500, dash: false });
  stepN(b, 120, { steerX: 500, dash: false });
  assert.equal(a.depth, b.depth);
  assert.equal(a.orbsCount, b.orbsCount);
  assert.equal(a.head.x, b.head.x);
  assert.equal(a.walls.length, b.walls.length);
  assert.deepEqual(a.drainEvents().map((e) => e.type), b.drainEvents().map((e) => e.type));
});

test('滚动：1s（60 tick）深度推进 = scrollSpeed/10', () => {
  const run = createRun({ seed: 3 });
  stepN(run, 60); // 无输入，头不动，前 60 tick 无墙贴近
  assert.ok(Math.abs(run.depth - 14) < 0.01, `depth=${run.depth}`);
});

// ---------- 转向 / 轨迹跟随 ----------
test('轨迹跟随：横移后珠链沿头轨迹挂于下方', () => {
  const run = createRun({ seed: 4 });
  stepN(run, 40, { steerX: 1000, dash: false });
  assert.ok(run.head.x > HEAD.START_X, '头应向右移动');
  assert.equal(run.orbs.length, run.orbsCount, '珠链长度 = 珠数');
  assert.equal(run.orbs.length, ORBS.START);
  assert.ok(run.orbs[0].x < run.head.x, '首珠应落后于头');
  assert.ok(run.orbs[0].y >= WORLD.HEAD_Y, '珠链挂在头下方');
  const tail = run.orbs[run.orbs.length - 1];
  assert.ok(Math.hypot(tail.x - run.head.x, tail.y - WORLD.HEAD_Y) > 34 * 3, '尾珠远离头部');
});

test('转向缓动：steerX 绝对 x 坐标追踪', () => {
  const run = createRun({ seed: 5 });
  const before = run.head.x;
  stepN(run, 5, { steerX: 100, dash: false });
  assert.ok(run.head.x < before, '应向左追踪');
  assert.ok(run.head.x > 100, '缓动不应瞬时到位');
});

// ---------- 破墙 / 扣珠 / 连击 ----------
test('撞墙每 tick 扣墙值与珠并同步发 wallHit，归零发 wallBreak', () => {
  const run = createRun({ seed: 6 });
  const w = wall(run, { value: 5 });
  run.step({});
  assert.equal(run.orbsCount, 9);
  assert.ok(run.walls.some((x) => x.id === w.id), '未破前墙仍在');
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'wallHit' && e.value === 1), 'wallHit value=1');
  assert.ok(!evs.some((e) => e.type === 'wallBreak'));

  stepN(run, 4);
  const evs2 = run.drainEvents();
  const brk = evs2.find((e) => e.type === 'wallBreak');
  assert.ok(brk, '墙值归零应发 wallBreak');
  assert.equal(brk.value, 5, 'wallBreak.value = 墙的初始值');
  assert.ok(!run.walls.some((x) => x.id === w.id), '破墙后移除');
  // 途中可能吃到散珠/回吸火花：最终珠数 = 10 - 5 + 途中拾取数
  const picked = [...evs, ...evs2].filter((e) => e.type === 'orbGain').length;
  assert.equal(run.orbsCount, 5 + picked);
});

test('破墙生成 3–6 火花并真空回吸 orbGain', () => {
  const run = createRun({ seed: 8 });
  wall(run, { value: 1 });
  const orbsBefore = run.orbsCount;
  run.step({});
  stepN(run, 60); // 1s 内回吸（火花可能部分当帧即吸回，最终全回）
  assert.equal(run.sparks.length, 0, '火花应在 1s 内被吸回');
  const gains = run.drainEvents().filter((e) => e.type === 'orbGain' && e.kind === 'spark');
  assert.ok(gains.length >= 3 && gains.length <= 6, `火花数=${gains.length}`);
  assert.equal(run.orbsCount, orbsBefore - 1 + gains.length, '破墙扣 1，每个火花 +1');
});

test('冲刺撞墙伤害 ×2', () => {
  const run = createRun({ seed: 9, startZone: 2 });
  wall(run, { value: 6 });
  const evs = [];
  for (let i = 0; i < 3; i += 1) {
    run.step({ steerX: run.head.x, dash: true });
    evs.push(...run.drainEvents());
  }
  const brk = evs.find((e) => e.type === 'wallBreak');
  assert.ok(brk, '6 值墙冲刺 3 tick 击穿');
  const gains = evs.filter((e) => e.type === 'orbGain').length;
  assert.equal(run.orbsCount, 4 + gains, '冲刺扣珠 2×3=6（另加途中拾取）');
});

test('冲刺边界：zone1 不可用 / 不足 5 珠不可启动 / 启停事件', () => {
  const z1 = createRun({ seed: 10, startZone: 1 });
  stepN(z1, 3, { dash: true });
  assert.ok(!types(z1.drainEvents()).includes('dashStart'), 'zone1 冲刺未解锁');

  const low = createRun({ seed: 11, startZone: 2 });
  low.orbsCount = 4;
  stepN(low, 3, { dash: true });
  assert.ok(!types(low.drainEvents()).includes('dashStart'), '不足 5 珠不可启动');

  const ok = createRun({ seed: 12, startZone: 2 });
  ok.step({ dash: true });
  ok.step({ dash: false });
  const evs = types(ok.drainEvents());
  assert.ok(evs.includes('dashStart') && evs.includes('dashEnd'), '冲刺启停事件');
});

test('冲刺持续燃烧 2 珠/s', () => {
  const run = createRun({ seed: 13, startZone: 2 });
  stepN(run, 60, { steerX: run.head.x, dash: true }); // 1s 燃烧
  assert.equal(run.orbsCount, 8, '1s 燃烧 2 珠（10→8）');
});

// ---------- 海胆 ----------
test('海胆碰头断尾 5 珠 + 0.8s 无敌', () => {
  const run = createRun({ seed: 14, startZone: 4 });
  wall(run, { value: 999, kind: 'urchin' });
  run.step({});
  assert.equal(run.orbsCount, 5, '断尾 5 珠');
  assert.ok(types(run.drainEvents()).includes('urchinCut'));

  run.step({}); // 无敌窗口内再碰
  assert.equal(run.orbsCount, 5, '无敌期内不再断尾');

  run.time += 1.0;
  run.step({});
  assert.equal(run.orbsCount, 0, '无敌过后再断尾 5 珠');
});

// ---------- 连击窗口 ----------
test('连击：2.5s 内连破两墙 +1，乘数正确', () => {
  const run = createRun({ seed: 15 });
  wall(run, { value: 1 });
  run.step({});
  wall(run, { value: 1 });
  run.step({});
  const evs = run.drainEvents();
  const ups = evs.filter((e) => e.type === 'comboUp');
  assert.equal(ups.length, 2);
  assert.equal(ups[0].combo, 1);
  assert.equal(ups[1].combo, 2);
  assert.equal(ups[1].mult, 1.2);
});

test('连击窗口超时发 comboBreak', () => {
  const run = createRun({ seed: 16 });
  wall(run, { value: 1 });
  run.step({});
  run.time += 2.6;
  run.step({});
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'comboBreak'));
  assert.equal(run.combo, 0);
});

// ---------- 光半径 ----------
test('光半径公式：zone<3 全亮，zone≥3 = 160+orbs*14 clamp', () => {
  const z1 = createRun({ seed: 17, startZone: 1 });
  assert.equal(z1.getHud().lightRadius, 900);

  const z3 = createRun({ seed: 18, startZone: 3 });
  assert.equal(z3.getHud().lightRadius, 160 + 10 * 14);

  z3.orbsCount = 0;
  assert.equal(z3.getHud().lightRadius, 160);

  z3.orbsCount = 99;
  assert.equal(z3.getHud().lightRadius, 900);
});

// ---------- 死亡 ----------
test('死亡：珠数 0 且再撞任意墙 → phase=dead + death 事件', () => {
  const run = createRun({ seed: 19 });
  wall(run, { value: 60 });
  stepN(run, 11); // 前 10 tick 扣光 10 珠，第 11 tick 再撞致死
  assert.equal(run.phase, 'dead');
  assert.ok(types(run.drainEvents()).includes('death'));
  // 死后 step 无副作用
  const depthBefore = run.depth;
  run.step({});
  assert.equal(run.depth, depthBefore);
});

// ---------- nearMiss ----------
test('nearMiss：水平擦肩 <24px 触发且 2s 节流', () => {
  const run = createRun({ seed: 20 });
  wall(run, { value: 3, x: run.head.x + HEAD.W / 2 + 10, w: 100 });
  run.step({});
  assert.ok(types(run.drainEvents()).includes('nearMiss'));
  run.step({});
  assert.ok(!types(run.drainEvents()).includes('nearMiss'), '2s 内节流不重复');
});

// ---------- Boss ----------
test('Boss 分段：碰撞扣段值并发 bossHit', () => {
  const run = createRun({ seed: 21, startZone: 5 });
  injectBoss(run, 100);
  run.head.x = 128; // 第 0 段中心
  run.step({});
  const evs = run.drainEvents();
  assert.ok(evs.some((e) => e.type === 'bossHit' && e.partValue === 99), 'bossHit.partValue 剩余值');
  assert.equal(run.orbsCount, 9, '撞 Boss 同步扣珠');
  const hud = run.getHud();
  assert.equal(hud.bossHp, 99 + 100 * 4);
  assert.equal(hud.bossMax, 500);
});

test('Boss 击穿段 6s 后半值再生', () => {
  const run = createRun({ seed: 22, startZone: 5 });
  injectBoss(run, 8);
  const part = run.walls.find((w) => w.kind === 'bossPart' && w.partIndex === 0);
  part.value = 1;
  run.head.x = 128;
  run.step({});
  assert.equal(run.walls.filter((w) => w.kind === 'bossPart').length, 4, '击穿段移除');

  run.time += 10;
  run.step({});
  const parts = run.walls.filter((w) => w.kind === 'bossPart');
  assert.equal(parts.length, 5, '6s 后再生');
  const regen = parts.find((w) => w.partIndex === 0);
  assert.equal(regen.value, 4, '半值再生（8→4）');
});

test('Boss 循环：深度越过 2100 触发线自动生成 Boss，getHud 报血量', () => {
  const run = createRun({ seed: 27 });
  run.depth = 2090; // 越过 2100 - APPROACH(60m) 触发线
  run.step({});
  assert.ok(run.boss, '应生成 Boss');
  assert.equal(run.walls.filter((w) => w.kind === 'bossPart').length, 5);
  const hud = run.getHud();
  assert.ok(hud.bossHp > 0);
  assert.ok(hud.bossMax > 0);
  assert.equal(hud.zone, 5);
});

test('Boss 5 段全穿 → bossBreak 且不再再生', () => {
  const run = createRun({ seed: 23, startZone: 5 });
  injectBoss(run, 8);
  for (let i = 0; i < 5; i += 1) {
    const p = run.walls.find((w) => w.kind === 'bossPart' && w.partIndex === i);
    p.value = 1;
    run.head.x = i * 256 + 128;
    run.step({});
  }
  assert.equal(run.boss, null);
  assert.ok(types(run.drainEvents()).includes('bossBreak'));
  run.time += 10;
  run.step({});
  assert.equal(run.walls.filter((w) => w.kind === 'bossPart').length, 0, '击破后不再再生');
});

// ---------- 食物 / 统计 ----------
test('金珠食物：orbGain + goldEaten 统计', () => {
  const run = createRun({ seed: 24 });
  run.foods.push({ id: run.nextId++, x: run.head.x, worldY: run.depth * 10, kind: 'gold' });
  run.step({});
  assert.equal(run.orbsCount, 11);
  assert.equal(run.stats.goldEaten, 1);
  assert.ok(run.drainEvents().some((e) => e.type === 'orbGain' && e.kind === 'gold'));
});

test('stats：破墙计数与最深层/最大连击更新', () => {
  const run = createRun({ seed: 25 });
  wall(run, { value: 1 });
  run.step({});
  assert.equal(run.stats.wallsBroken, 1);
  assert.equal(run.stats.maxCombo, 1);
  assert.ok(run.stats.depth >= 0);
  assert.equal(run.stats.zoneReached, 1);
});

// ---------- 移动墙 ----------
test('移动墙（zone2+）横向往返', () => {
  const run = createRun({ seed: 26, startZone: 2 });
  const w = wall(run, { value: 3, moving: true, x: 600 });
  w.worldY = run.depth * 10 + 400; // 移出碰撞带，避免误撞
  const x0 = w.x;
  stepN(run, 30, {});
  assert.notEqual(w.x, x0, '移动墙应横向移动');
  assert.ok(w.x >= 0 && w.x + w.w <= 1280, '不出界');
});
