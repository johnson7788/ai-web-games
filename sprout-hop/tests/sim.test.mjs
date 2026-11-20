import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRun } from '../src/game/sim.js';
import { LEVELS, LEVEL_COUNT, BOOST } from '../config/levels.js';
import { PHYS, ANCHOR, TOP0, WATER_Y, PLAY } from '../config/game.config.js';
import { aimToPlatform, solveLaunch, generatePlatforms, predictTrajectory, platformScreenX, platformTopY } from '../src/game/level.js';

// 以 1/60 步长推进 sec 秒
function advance(run, sec) {
  const n = Math.max(1, Math.round(sec * 60));
  for (let i = 0; i < n; i += 1) run.step(1 / 60);
}

function drain(run) {
  return run.drainEvents();
}

test('冒烟：createRun → aimStart → aimSet → launch → step → getHud → drainEvents 无异常', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.state.phase, 'aiming');
  assert.equal(r.aimStart().ok, true);
  assert.equal(r.aimSet({ x: -80, y: 40 }).ok, true);
  assert.equal(r.launch({ x: 240, y: -240 }).ok, true);
  assert.equal(r.state.phase, 'flying');
  r.step(1 / 60);
  const hud = r.getHud();
  assert.equal(hud.level, 1);
  const ev = drain(r);
  assert.ok(Array.isArray(ev));
});

test('state 形状：level/scene/phase/score/goalJumps/pea 位置', () => {
  const r = createRun(0, { seed: 1 });
  const s = r.state;
  assert.equal(s.level, 1);
  assert.equal(s.scene, 'dawn');
  assert.equal(s.phase, 'aiming');
  assert.equal(s.score, 0);
  assert.equal(s.jumps, 0);
  assert.equal(s.goalJumps, LEVELS[0].goalJumps);
  assert.equal(s.pea.x, ANCHOR.X);
  assert.equal(s.pea.y, ANCHOR.Y);
  assert.ok(Array.isArray(s.platforms) && s.platforms.length >= s.goalJumps + 2);
});

test('aim：蓄力 power 与拖拽模长成比例、钳制上限', () => {
  const r = createRun(0, { seed: 1 });
  r.aimStart();
  const res = r.aimSet({ x: -100, y: 50 });
  assert.equal(res.ok, true);
  assert.ok(res.power > 0.3 && res.power < 0.6);
  const big = r.aimSet({ x: -5000, y: 5000 });
  assert.ok(big.power <= 1);
});

test('launch：后退拖拽（vx≤0）拒绝发射', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.launch({ x: 0, y: -200 }).ok, false);
  assert.equal(r.launch({ x: -100, y: -100 }).ok, false);
  assert.equal(r.state.phase, 'aiming');
});

test('launch：前进速度合法进入 flying，速度被钳制', () => {
  const r = createRun(0, { seed: 1 });
  assert.equal(r.launch({ x: 9000, y: -9000 }).ok, true);
  assert.equal(r.state.phase, 'flying');
  assert.ok(r.state.pea.vx <= PHYS.MAX_SPEED);
  assert.ok(Math.abs(r.state.pea.vy) <= PHYS.MAX_SPEED);
});

test('落台：goalJumps 次成功前进后 win', () => {
  const r = createRun(0, { seed: 3 });
  let guard = 4000;
  while (guard-- > 0 && r.state.phase !== 'won') {
    if (r.state.phase === 'aiming') {
      const spd = aimToPlatform(r.state, r.state.cur + 1);
      assert.ok(spd, '下一平台应有解');
      r.launch(spd);
    } else {
      r.step(1 / 60);
    }
  }
  assert.equal(r.state.phase, 'won');
  assert.equal(r.state.result.won, true);
  assert.ok(r.state.jumps >= r.state.goalJumps);
  assert.ok(r.state.stars >= 1);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'win'));
});

test('落水判负：无目标乱跳最终 water', () => {
  const r = createRun(0, { seed: 7 });
  // 轻微前进 + 基本不下坠的高度 → 掉进平台间池塘
  r.launch({ x: 50, y: -60 });
  advance(r, 4);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'water');
});

test('完美落点：中心落点发 perfect 事件且加分', () => {
  const r = createRun(0, { seed: 3 });
  const spd = aimToPlatform(r.state, 1);
  assert.ok(spd, '首平台应有精确解');
  r.launch(spd);
  advance(r, 2);
  assert.equal(r.state.phase, 'aiming');
  assert.equal(r.state.jumps, 1);
  const ev = drain(r);
  assert.ok(ev.some((e) => e.type === 'land'));
  assert.ok(ev.some((e) => e.type === 'perfect'), '中心解应命中完美区');
});

test('复活：lost 后可 revive，耗尽后拒绝', () => {
  const r = createRun(0, { seed: 7 });
  r.launch({ x: 50, y: -60 });
  advance(r, 4);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.revive().ok, true);
  assert.equal(r.state.phase, 'aiming');
  assert.equal(r.state.relivesUsed, 1);
  // 连续两次复活耗尽
  r.launch({ x: 50, y: -60 });
  advance(r, 4);
  assert.equal(r.revive().ok, true);
  assert.equal(r.state.relivesUsed, 2);
  r.launch({ x: 50, y: -60 });
  advance(r, 4);
  assert.equal(r.revive().ok, false);
});

test('南瓜回弹：落到南瓜后 nextBoost=1.3', () => {
  // L3 有南瓜，用其种子构造并直接找到南瓜平台
  const r = createRun(2, { seed: 11 });
  const plat = r.state.platforms.find((p) => p.kind === 'pumpkin');
  assert.ok(plat, 'L3 应有南瓜');
  const idx = r.state.platforms.indexOf(plat);
  // 直接模拟落上该南瓜平台（用内部 land 逻辑验证 nextBoost）
  r._land(idx, 0, plat);
  assert.equal(r.state.nextBoost, 1.3);
});

test('竹筐吸力：落到竹筐后 nextBoost=0.7', () => {
  const r = createRun(3, { seed: 5 });
  const plat = r.state.platforms.find((p) => p.kind === 'basket');
  assert.ok(plat, 'L4 应有竹筐');
  r._land(r.state.platforms.indexOf(plat), 0, plat);
  assert.equal(r.state.nextBoost, 0.7);
});

test('断藤：落上后 0.6s 塌 → collapse 判负', () => {
  const r = createRun(5, { seed: 3 });
  const plat = r.state.platforms.find((p) => p.broken);
  assert.ok(plat, 'L6 应有断藤');
  r._land(r.state.platforms.indexOf(plat), 0, plat);
  assert.equal(r.state.phase, 'aiming');
  assert.ok(r.state.collapseT > 0);
  advance(r, 1.8);
  assert.equal(r.state.phase, 'lost');
  assert.equal(r.state.result.reason, 'collapse');
});

test('风：顺风关 wind>1，逆风关 wind<1', () => {
  assert.ok(createRun(4, { seed: 1 }).state.wind > 1);
  assert.ok(createRun(7, { seed: 1 }).state.wind < 1);
});

test('预测轨迹：抛物线单调下落且长度有限', () => {
  const r = createRun(0, { seed: 1 });
  const { pts } = predictTrajectory(r.state, { x: -80, y: 40 });
  assert.ok(pts.length > 3 && pts.length < 500);
  const last = pts[pts.length - 1];
  assert.ok(last.y > r.state.pea.y - 1, '轨迹应向下落到水面附近');
});

test('平台生成：首平台在锚点、间距为正、可解', () => {
  const lv = LEVELS[0];
  const plats = generatePlatforms(lv, 3);
  assert.equal(plats[0].wx, 0);
  assert.equal(plats[0].wy, 0);
  for (let i = 1; i < plats.length; i += 1) {
    assert.ok(plats[i].wx > plats[i - 1].wx, '平台单调向右');
  }
});

test('12 关全部：greedy 可通关（结构可解性）', () => {
  for (let li = 0; li < LEVEL_COUNT; li += 1) {
    const r = createRun(li, { seed: 3 });
    let guard = 6000;
    while (guard-- > 0 && r.state.phase !== 'won' && r.state.phase !== 'lost') {
      if (r.state.phase === 'aiming') {
        const spd = aimToPlatform(r.state, r.state.cur + 1);
        if (!spd) break;
        r.launch(spd);
      } else {
        r.step(1 / 60);
      }
    }
    assert.equal(r.state.phase, 'won', `L${li + 1} 应可通关`);
  }
});
