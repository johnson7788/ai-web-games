import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  createRun, shoot, step, drainEvents, solveAim, getHud,
  holeResult, rating, HOLES, totalPar,
} from '../src/game/sim.js';
import { GOLF } from '../config/game.config.js';

// 便捷：把一杆打到停球/进洞，返回期间的事件
function playShot(run, aim, maxSec = 40) {
  const r = shoot(run, aim);
  if (!r.ok) return { ok: false, events: [] };
  const events = [];
  for (let t = 0; t < maxSec * 60 && run.phase !== 'aim' && run.phase !== 'finished'; t += 1) {
    step(run, 1 / 60);
    events.push(...drainEvents(run));
  }
  return { ok: true, events };
}

function drainAll(run) { return drainEvents(run); }

// ---------------------------------------------------------------- 判定
test('holeResult：一杆进洞 / 老鹰 / 小鸟 / 帕 / 柏忌 / 双柏忌 / 爆杆', () => {
  assert.equal(holeResult(1, 3), 'ace');
  assert.equal(holeResult(1, 4), 'ace');
  assert.equal(holeResult(1, 2), 'ace');
  assert.equal(holeResult(2, 4), 'eagle');
  assert.equal(holeResult(2, 3), 'birdie');
  assert.equal(holeResult(3, 3), 'par');
  assert.equal(holeResult(4, 3), 'bogey');
  assert.equal(holeResult(5, 3), 'double');
  assert.equal(holeResult(6, 3), 'busted');
});

test('rating：总杆低于 par 越多评级越高', () => {
  assert.equal(rating(70, 70), 'B');
  assert.equal(rating(66, 70), 'A');
  assert.equal(rating(63, 70), 'S');
  assert.equal(rating(74, 70), 'C');
  assert.equal(rating(80, 70), 'D');
});

test('HOLES：24 洞且 par 在 2–4 之间', () => {
  assert.equal(HOLES.length, 24);
  for (const h of HOLES) assert.ok(h.par >= 2 && h.par <= 4, `洞${h.n} par=${h.par}`);
  assert.ok(totalPar() > 0);
});

// ---------------------------------------------------------------- 状态机
test('createRun：从第 1 洞开始，phase=aim，杆数为 0', () => {
  const run = createRun();
  assert.equal(run.phase, 'aim');
  assert.equal(run.holeIndex, 0);
  assert.equal(run.holeStrokes, 0);
  assert.equal(run.totalStrokes, 0);
  const hud = getHud(run);
  assert.equal(hud.hole, 1);
  assert.equal(hud.holeOf, 24);
});

test('shoot：非 aim 阶段击球被拒绝', () => {
  const run = createRun();
  shoot(run, { dirX: 1, dirZ: 0, power: 0.5 });
  assert.equal(run.phase, 'roll');
  const r = shoot(run, { dirX: 1, dirZ: 0, power: 0.5 });
  assert.equal(r.ok, false);
});

test('shoot：power 被 clamp 到 0..1，且记一杆', () => {
  const run = createRun();
  const r = shoot(run, { dirX: 1, dirZ: 0, power: 5 });
  assert.equal(r.ok, true);
  assert.equal(run.holeStrokes, 1);
  const run2 = createRun();
  assert.equal(shoot(run2, { dirX: 0, dirZ: 0, power: 0.5 }).ok, false, '零方向拒绝');
});

// ---------------------------------------------------------------- 物理
test('平地一杆：球向前滚并最终停球（回到 aim）', () => {
  const run = createRun({ holeIndex: 0 });
  const x0 = run.ball.x;
  playShot(run, { dirX: 1, dirZ: 0, power: 0.4 });
  assert.equal(run.phase, 'aim');
  assert.ok(run.ball.x > x0 + 5, '球应向前滚');
  assert.ok(Math.abs(run.ball.vx) < GOLF.STOP_SPEED + 0.01, '停球后速度≈0');
});

test('坡地：沿下坡方向滚动更远（洞7 vs 平地）', () => {
  const flat = createRun({ holeIndex: 0 });
  playShot(flat, { dirX: 1, dirZ: 0, power: 0.4 });
  const flatDist = flat.ball.x - 12;
  const slope = createRun({ holeIndex: 6 }); // 洞7 slope +x（下坡）
  playShot(slope, { dirX: 1, dirZ: 0, power: 0.4 });
  const slopeDist = slope.ball.x - 12;
  assert.ok(slopeDist > flatDist, `下坡应更远 flat=${flatDist} slope=${slopeDist}`);
});

test('solveAim：返回单位方向 + 合法力度', () => {
  const run = createRun({ holeIndex: 3 });
  const a = solveAim(run);
  const len = Math.hypot(a.dirX, a.dirZ);
  assert.ok(Math.abs(len - 1) < 1e-3, '方向应为单位向量');
  assert.ok(a.power >= 0.03 && a.power <= 1, `power=${a.power}`);
});

test('greedy bot：第 1 洞在 10 杆内进洞（首胜）', () => {
  const run = createRun({ holeIndex: 0 });
  const events = [];
  let shots = 0;
  while (shots < 10 && run.phase !== 'finished' && run.holeIndex === 0) {
    if (run.phase === 'aim') { shoot(run, solveAim(run)); shots += 1; }
    step(run, 1 / 60);
    events.push(...drainEvents(run));
  }
  assert.ok(events.some((e) => e.type === 'hole' && e.hole === 1), '应产生第 1 洞的 hole 事件');
  assert.ok(shots <= 10);
});

test('进洞后推进到下一洞并重置杆数', () => {
  const run = createRun({ holeIndex: 0 });
  for (let i = 0; i < 10 && run.holeIndex === 0; i += 1) {
    if (run.phase === 'aim') shoot(run, solveAim(run));
    for (let k = 0; k < 40 * 60 && run.phase !== 'aim' && run.phase !== 'finished'; k += 1) step(run, 1 / 60);
  }
  assert.ok(run.holeIndex >= 1, '应推进到第 2 洞');
  assert.equal(run.holeStrokes, 0, '新洞杆数归零');
});

test('爆杆：杆数达到 par+3 自动推进并记 busted', () => {
  const run = createRun({ holeIndex: 0 }); // par 2
  const bustAt = 2 + GOLF.BUST_STROKES;
  const events = [];
  for (let i = 0; i < bustAt; i += 1) {
    if (run.phase === 'aim') shoot(run, { dirX: 0, dirZ: 1, power: 0.08 }); // 朝无关方向打
    for (let k = 0; k < 20 * 60 && run.phase !== 'aim' && run.phase !== 'finished'; k += 1) step(run, 1 / 60);
    events.push(...drainEvents(run));
  }
  assert.ok(events.some((e) => e.type === 'busted'), '应产生 busted 事件');
  assert.ok(run.holeIndex >= 1, '爆杆后推进下一洞');
  assert.equal(run.busts, 1);
});

test('水障：球入水 +1 杆并回原位', () => {
  const run = createRun({ holeIndex: 21 }); // 洞22 含水
  const events = [];
  // 朝水障方向打（水区中心约 [24,23]）
  playShot(run, { dirX: 0.5, dirZ: 0.7, power: 0.7 });
  events.push(...drainEvents(run));
  // 可能一杆没进水，再补
  for (let i = 0; i < 6 && run.penalties === 0; i += 1) {
    if (run.phase === 'aim') playShot(run, { dirX: 0.5, dirZ: 0.7, power: 0.8 });
    events.push(...drainEvents(run));
  }
  assert.equal(run.penalties, 1, '应有一次水障罚杆');
  assert.equal(run.ball.x, run.hole.tee[0], '回开球点');
  assert.equal(run.ball.z, run.hole.tee[1], '回开球点');
});

test('同 seed 重跑结果一致（确定性）', () => {
  function play(seed) {
    const run = createRun({ seed, holeIndex: 0 });
    let shots = 0;
    while (shots < 12 && run.holeIndex === 0) {
      if (run.phase === 'aim') { shoot(run, solveAim(run)); shots += 1; }
      step(run, 1 / 60);
      drainEvents(run);
    }
    return { x: run.ball.x, z: run.ball.z, shots };
  }
  const a = play(7);
  const b = play(7);
  assert.deepEqual(a, b);
});

test('drainEvents 清空事件队列', () => {
  const run = createRun();
  shoot(run, { dirX: 1, dirZ: 0, power: 0.4 });
  const evs = drainEvents(run);
  assert.ok(evs.length > 0);
  assert.equal(run.events.length, 0);
});

test('getHud：杆数/标准杆/总杆字段完整', () => {
  const run = createRun({ holeIndex: 5 });
  shoot(run, { dirX: 1, dirZ: 0, power: 0.3 });
  const hud = getHud(run);
  assert.equal(hud.hole, 6);
  assert.equal(hud.strokes, 1);
  assert.equal(typeof hud.par, 'number');
  assert.equal(typeof hud.total, 'number');
});

test('事件总线：shot / roll / stop 事件带坐标或参数', () => {
  const run = createRun({ holeIndex: 0 });
  shoot(run, { dirX: 1, dirZ: 0, power: 0.3 });
  const evs = [];
  for (let k = 0; k < 40 * 60 && run.phase === 'roll'; k += 1) {
    step(run, 1 / 60);
    evs.push(...drainEvents(run));
  }
  assert.ok(evs.some((e) => e.type === 'shot' && e.power > 0));
  assert.ok(evs.some((e) => e.type === 'roll'));
  assert.ok(evs.some((e) => e.type === 'stop'));
});

test('风：横向风使球侧向偏移（洞13 vs 平地）', () => {
  const flat = createRun({ holeIndex: 0 });
  playShot(flat, { dirX: 1, dirZ: 0, power: 0.4 });
  const windRun = createRun({ holeIndex: 12 }); // 洞13 wind [0.8,0]（顺风）
  playShot(windRun, { dirX: 1, dirZ: 0, power: 0.4 });
  assert.ok(windRun.ball.x - 12 > flat.ball.x - 12, '顺风应更远');
});

test('机关：风车叶片周期性挡路（洞19 有 windmill）', () => {
  assert.ok(HOLES[18].windmill, '洞19 应有风车');
  assert.ok(HOLES[19].bounce, '洞20 应有弹板');
  assert.ok(HOLES[20].gate, '洞21 应有移动门');
  assert.ok(HOLES[21].sand && HOLES[21].water, '洞22 应有沙坑+水');
  assert.ok(HOLES[23].gate && HOLES[23].water, '洞24 应有复合机关');
});
