// 纯逻辑测试：只测 src/game/sim.js，不碰 DOM。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, groundY, upgradeCost,
} from '../src/game/sim.js';
import { PLANETS, GOLF, UPGRADES } from '../config/game.config.js';

function fireAndSettle(run, power, angleDeg) {
  const r = run.shoot({ power, angleDeg });
  assert.ok(r.ok, `shoot 应成功: ${JSON.stringify(r)}`);
  run.settle();
}

test('弹道确定性：同 seed 同参数，两局的距离/金币/停球位置完全一致', () => {
  const a = createRun({ seed: 7 });
  const b = createRun({ seed: 7 });
  fireAndSettle(a, 0.9, 42);
  fireAndSettle(b, 0.9, 42);
  assert.equal(a.lastDistance, b.lastDistance, '距离应一致');
  assert.equal(a.lastCoins, b.lastCoins, '金币应一致');
  assert.equal(a.ball.x, b.ball.x, '停球 x 应一致');
});

test('重力越大距离越短：月球(0.35g) 必远于 熔岩星(1.8g)', () => {
  const moon = createRun({ seed: 7, planetIndex: 0 });
  const lava = createRun({ seed: 7, planetIndex: 3 });
  fireAndSettle(moon, 0.9, 42);
  fireAndSettle(lava, 0.9, 42);
  assert.ok(moon.lastDistance > lava.lastDistance,
    `moon=${moon.lastDistance} 应 > lava=${lava.lastDistance}`);
});

test('反弹能量递减：平地上连续反弹的冲击速度严格递减', () => {
  const r = createRun({ seed: 7 });
  fireAndSettle(r, 0.55, 80); // 高抛，落在开头平地段
  const impacts = r.events.filter((e) => e.type === 'bounce').map((e) => e.impact);
  assert.ok(impacts.length >= 2, `应有多次反弹，实际 ${impacts.length}`);
  for (let i = 1; i < impacts.length; i += 1) {
    assert.ok(impacts[i] < impacts[i - 1],
      `第 ${i} 次反弹 ${impacts[i]} 应小于前一次 ${impacts[i - 1]}`);
  }
});

test('滚动会停：低角度平射最终停下（vx=0, state=stopped）', () => {
  const r = createRun({ seed: 7 });
  fireAndSettle(r, 0.35, 20);
  assert.equal(r.ball.state, 'stopped');
  assert.equal(r.ball.vx, 0);
  assert.equal(r.phase, 'ready', '结算后应回到待击球');
});

test('金币随距离单调增长：远杆金币严格更多', () => {
  const short = createRun({ seed: 7 });
  const long = createRun({ seed: 7 });
  fireAndSettle(short, 0.3, 40);
  fireAndSettle(long, 0.9, 40);
  assert.ok(long.lastDistance > short.lastDistance);
  assert.ok(long.lastCoins > short.lastCoins,
    `long=${long.lastCoins} 应 > short=${short.lastCoins}`);
});

test('升级扣钱且提升 v0：买 Power 后同参数飞得更远', () => {
  const a = createRun({ seed: 7 });
  fireAndSettle(a, 0.8, 45);
  const b = createRun({ seed: 7 });
  b.addCoins(1000);
  const res = b.upgrade('power');
  assert.ok(res.ok);
  assert.equal(res.level, 1);
  assert.equal(res.cost, upgradeCost('power', 0));
  assert.equal(b.coins, 1000 - UPGRADES.power.base);
  fireAndSettle(b, 0.8, 45);
  assert.ok(b.lastDistance > a.lastDistance,
    `升级后 ${b.lastDistance} 应 > 升级前 ${a.lastDistance}`);
});

test('失败路径：钱不够不能升级，等级与金币都不变', () => {
  const r = createRun({ seed: 7 });
  const res = r.upgrade('power');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'poor');
  assert.equal(r.upgrades.power, 0);
  assert.equal(r.coins, 0);
});

test('最远距离只在被超过时更新', () => {
  const r = createRun({ seed: 7 });
  fireAndSettle(r, 0.9, 42);
  const best1 = r.best;
  assert.equal(best1, r.lastDistance, '首杆应刷新最远');
  fireAndSettle(r, 0.25, 30);
  assert.ok(r.lastDistance < best1, '第二杆更短');
  assert.equal(r.best, best1, '短杆不应更新最远');
});

test('烧毁阈值：满级 Power 在月球上 v0 超过 1750 → 直接烧毁（金币减半标记）', () => {
  const r = createRun({ seed: 7, planetIndex: 0 });
  r.addCoins(100000);
  for (let i = 0; i < UPGRADES.power.maxLevel; i += 1) {
    assert.ok(r.upgrade('power').ok);
  }
  const v0 = GOLF.V0_BASE + GOLF.V0_POWER_SCALE
    + UPGRADES.power.maxLevel * 60;
  assert.ok(v0 > GOLF.BURNOUT_SPEED, `v0=${v0} 应超过烧毁阈值 ${GOLF.BURNOUT_SPEED}`);
  fireAndSettle(r, 1, 45);
  assert.equal(r.lastBurned, 2, '应标记为烧毁');
  assert.ok(r.events.some((e) => e.type === 'burnout'), '应有 burnout 事件');
  assert.ok(r.lastDistance < 100, `烧毁前飞行距离应很短，实际 ${r.lastDistance}`);
  assert.equal(r.ball.state, 'stopped');
});

test('起火阈值：v0 介于起火与烧毁之间 → 触发 burn 事件且不烧毁', () => {
  const r = createRun({ seed: 7, planetIndex: 0 });
  r.addCoins(100000);
  for (let i = 0; i < 7; i += 1) r.upgrade('power'); // v0 = 380+820+420 = 1620
  const res = r.shoot({ power: 1, angleDeg: 45 });
  assert.ok(res.ok);
  for (let i = 0; i < 3; i += 1) r.step(1 / 60); // 起火判定在首帧物理里
  assert.ok(r.burning, '发射后应立即处于起火状态');
  assert.ok(!r.burnedOut, '不应烧毁');
  r.settle();
  assert.ok(r.events.some((e) => e.type === 'burn'), '应有 burn 事件');
  assert.ok(r.events.every((e) => e.type !== 'burnout'), '不应有 burnout 事件');
});

test('升级封顶：达到 maxLevel 后再买返回 ok=false (maxed)', () => {
  const r = createRun({ seed: 7 });
  r.addCoins(10000000);
  for (let i = 0; i < UPGRADES.power.maxLevel; i += 1) {
    assert.ok(r.upgrade('power').ok);
  }
  const res = r.upgrade('power');
  assert.equal(res.ok, false);
  assert.equal(res.reason, 'maxed');
});

test('存档/配置默认值：新局 HUD 归零、星球循环、3 杆自动切星球并请求升级面板', () => {
  assert.equal(PLANETS.length, 6, '应有 6 颗星球');
  const r = createRun({ seed: 7 });
  const hud = r.getHud();
  assert.equal(hud.best, 0);
  assert.equal(hud.coins, 0);
  assert.equal(hud.planet, PLANETS[0].id);
  assert.equal(hud.shot, 1);
  assert.equal(hud.phase, 'ready');

  assert.equal(r.setPlanet(5), 'ring', 'setPlanet 应立即切到第 6 颗');
  fireAndSettle(r, 0.5, 40);
  fireAndSettle(r, 0.5, 40);
  fireAndSettle(r, 0.5, 40); // 打满 3 杆
  assert.equal(PLANETS[r.planetIndex].id, 'moon', '应循环回第一颗星球');
  assert.ok(r.pendingPanel, '应请求弹出升级面板');
  assert.equal(r.getHud().shot, 1, '新星球从第 1 杆重新计数');
});

test('地形函数：seed 相同则 groundY 处处一致，开球段是平地', () => {
  for (const x of [0, 700, 1234, 5000, 12345]) {
    assert.equal(groundY(x, 42), groundY(x, 42), `x=${x} 应可复现`);
  }
  for (let x = 20; x <= 1300; x += 60) {
    assert.equal(groundY(x, 42), 600, `开球段 x=${x} 应为平地 y=600`);
  }
});
