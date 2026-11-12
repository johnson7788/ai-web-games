import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  BALL, CONFIG, PHYSICS, PLAY, POCKETS, RULES, TABLE,
} from '../config/game.config.js';
import { locales } from '../config/locales.js';
import Sdk from '../src/core/sdk.js';
import { collide, anyMoving, stepPhysics } from '../src/game/physics.js';
import { CUE, EIGHT, HEAD_SPOT, kindOf, makeBall } from '../src/game/balls.js';
import { legalTargets, planShot } from '../src/game/ai.js';
import { makeRng } from '../src/game/rng.js';
import { PLAYER, RIVAL, createMatch, shotSpeed } from '../src/game/match.js';
import { createSim } from '../src/game/sim.js';

const DT = 1 / 60;
const TOP = PLAY.top + BALL.R;

function world(list) {
  return { balls: list };
}

function settle(match, limitSeconds = 40) {
  const events = [];
  const max = Math.round(limitSeconds / DT);
  for (let i = 0; i < max; i += 1) {
    match.step(DT);
    events.push(...match.drainEvents());
    if (match.phase !== 'moving') break;
  }
  return events;
}

function clearedFor(match, who) {
  const group = match.groups[who];
  if (!group) return false;
  return match.world.balls.every((b) => !b.alive || b.id === CUE || b.id === EIGHT || kindOf(b.id) !== group);
}

// 45° 斜线：白球 → 目标球 → 右上角袋，正好是满球接触。
const CORNER_LINE = {
  cue: { x: PLAY.right - 160, y: PLAY.top + 160 },
  object: { x: PLAY.right - 80, y: PLAY.top + 80 },
  angle: -Math.PI / 4,
};

function potSetup(objectId, decoy = objectId === 5 ? 9 : 5) {
  return [
    makeBall(CUE, CORNER_LINE.cue.x, CORNER_LINE.cue.y),
    makeBall(objectId, CORNER_LINE.object.x, CORNER_LINE.object.y),
    makeBall(decoy, 300, 520),
  ];
}

test('碰撞动量守恒：正碰前后总动量不变且目标球加速', () => {
  const a = makeBall(CUE, 400, 370);
  const b = makeBall(3, 415, 370);
  a.vx = 600;
  const before = a.vx + b.vx;
  const out = [];
  const hit = collide(a, b, out);
  assert.ok(hit, '两球重叠应判定碰撞');
  assert.equal(out[0].type, 'hit');
  assert.ok(Math.abs(a.vx + b.vx - before) < 1e-9, '总动量守恒');
  assert.ok(b.vx > a.vx, '目标球应比白球更快');
  assert.ok(a.vx >= 0, '满接触正碰后白球不反向');
});

test('库边反弹：向右撞库后 vx 反向且按 0.82 衰减', () => {
  const ball = makeBall(2, PLAY.right - 40, 370);
  ball.vx = 800;
  const out = [];
  const w = world([ball]);
  for (let i = 0; i < 10 && ball.vx > 0; i += 1) stepPhysics(w, DT, out);
  assert.ok(ball.vx < 0, '撞库后水平速度反向');
  assert.ok(Math.abs(ball.vx) <= 800 * PHYSICS.CUSHION + 1e-6, '反弹不超过库边系数');
  assert.ok(Math.abs(ball.vx) > 800 * PHYSICS.CUSHION * 0.9, '反弹衰减幅度合理');
  assert.ok(out.some((e) => e.type === 'cushion'), '应产生库边事件');
  assert.ok(ball.x <= PLAY.right - BALL.R + 0.001, '球心不越过库边鼻线');
});

test('摩擦停止：低于 8px/s 的速度当帧归零且不再位移', () => {
  const slow = makeBall(4, 600, 300);
  slow.vx = PHYSICS.STOP_SPEED - 1;
  const out = [];
  const w = world([slow]);
  stepPhysics(w, DT, out);
  assert.equal(slow.vx, 0, '低速当帧清零');
  assert.ok(slow.x - 600 < 0.2, '清零前最多滑过 1/5 像素');
  const x0 = slow.x;
  stepPhysics(w, DT, out);
  assert.equal(slow.x, x0, '已停止的球不应再位移');
  assert.ok(!anyMoving([slow]));

  const fast = makeBall(6, 300, 500);
  fast.vx = 400;
  for (let i = 0; i < 600; i += 1) stepPhysics(world([fast]), DT, out);
  assert.equal(fast.vx, 0, '滚动了 10 秒后必然停下');
  assert.ok(fast.x < PLAY.right, '停在台面内');
});

test('落袋判定：球心进入袋口半径即落袋并停速', () => {
  const ball = makeBall(7, PLAY.right - 60, PLAY.top + 60);
  ball.vx = 500;
  ball.vy = -500;
  const out = [];
  for (let i = 0; i < 60 && ball.alive; i += 1) stepPhysics(world([ball]), DT, out);
  const potted = out.find((e) => e.type === 'pocket');
  assert.ok(potted, '应产生落袋事件');
  assert.equal(potted.id, 7);
  assert.equal(ball.alive, false);
  assert.equal(ball.vx, 0);
  assert.equal(potted.pocket.x, PLAY.right);
  assert.equal(potted.pocket.y, PLAY.top);
});

test('开球：白球必须碰到球堆，第一杆计为开球杆', () => {
  const match = createMatch({ seed: 7, autoAi: false });
  assert.equal(match.phase, 'break');
  assert.equal(match.world.balls.length, 16);
  match.shoot({ by: PLAYER, angle: 0, power: RULES.BREAK_POWER });
  const events = settle(match);
  assert.equal(match.shots[PLAYER], 1);
  assert.equal(match.isBreak, false);
  assert.ok(events.some((e) => e.type === 'hit'), '开球应碰到球堆');
  assert.equal(match.lastFoul, null, '开球碰到球堆不算犯规');
  const moved = match.world.balls.filter((b) => b.alive && b.id !== CUE && b.x !== TABLE.FOOT_X);
  assert.ok(moved.length > 4, '球堆被冲散');
});

test('空杆：白球未碰到任何球判犯规并交换出杆权', () => {
  const match = createMatch({ seed: 11, autoAi: false });
  match.shoot({ by: PLAYER, angle: 0, power: RULES.MIN_POWER });
  settle(match);
  assert.equal(match.lastFoul.reason, 'no_contact');
  assert.equal(match.turn, RIVAL);
  assert.equal(match.ballInHand, true);
});

test('定花色：开球后第一颗合法入袋决定双方分组', () => {
  const match = createMatch({ seed: 3, autoAi: false, balls: potSetup(3) });
  match.isBreak = false;
  match.phase = 'aim';
  match.shoot({ by: PLAYER, angle: CORNER_LINE.angle, power: 0.45 });
  const events = settle(match);
  assert.ok(events.some((e) => e.type === 'group'), '应广播定花色事件');
  assert.equal(match.groups[PLAYER], 'solid');
  assert.equal(match.groups[RIVAL], 'stripe');
  assert.equal(match.turn, PLAYER, '进本组球继续出杆');
  assert.equal(match.lastFoul, null);
});

test('犯规：先碰对方球并把对方球打进判自由球', () => {
  const match = createMatch({ seed: 5, autoAi: false, balls: potSetup(12) });
  match.isBreak = false;
  match.phase = 'aim';
  match.groups[PLAYER] = 'solid';
  match.groups[RIVAL] = 'stripe';
  match.shoot({ by: PLAYER, angle: CORNER_LINE.angle, power: 0.45 });
  const events = settle(match);
  const foul = events.find((e) => e.type === 'foul');
  assert.ok(foul, '应广播犯规');
  assert.equal(foul.reason, 'wrong_ball');
  assert.equal(match.turn, RIVAL);
  assert.equal(match.ballInHand, true);
  assert.equal(match.world.balls.find((b) => b.id === 12).alive, false, '被进的仍是对方球');
});

test('犯规：白球洗袋后重新摆回开球点', () => {
  const match = createMatch({ seed: 9, autoAi: false });
  match.isBreak = false;
  match.phase = 'aim';
  match.world.balls = [
    makeBall(CUE, 900, TOP),
    makeBall(3, 1080, 190),
    makeBall(11, 200, 520),
  ];
  // 沿上库边向左滚进中袋
  match.shoot({ by: PLAYER, angle: Math.PI, power: 0.3 });
  const events = settle(match);
  const foul = events.find((e) => e.type === 'foul');
  assert.ok(foul, '应广播洗袋犯规');
  assert.equal(foul.reason, 'scratch');
  const cue = match.world.balls.find((b) => b.id === CUE);
  assert.equal(cue.alive, true, '白球应被重新摆回台面');
  assert.equal(match.ballInHand, true);
  assert.equal(match.turn, RIVAL);
});

test('提前打进 8 号直接判负', () => {
  const match = createMatch({ seed: 13, autoAi: false, balls: potSetup(EIGHT) });
  match.isBreak = false;
  match.phase = 'aim';
  match.shoot({ by: PLAYER, angle: CORNER_LINE.angle, power: 0.45 });
  settle(match);
  assert.equal(match.phase, 'over');
  assert.equal(match.result, 'lose');
  assert.equal(match.resultReason, 'early');
});

test('未清完本组不能打 8：清完后合法进 8 判胜，提前进 8 判负', () => {
  const win = createMatch({ seed: 17, autoAi: false, balls: potSetup(EIGHT, 9) });
  win.isBreak = false;
  win.phase = 'aim';
  win.groups[PLAYER] = 'solid';
  win.groups[RIVAL] = 'stripe';
  assert.equal(clearedFor(win, PLAYER), true, '台面无本组球即为已清完');
  win.shoot({ by: PLAYER, angle: CORNER_LINE.angle, power: 0.45 });
  settle(win);
  assert.equal(win.result, 'win');
  assert.equal(win.resultReason, 'clean');

  const early = createMatch({ seed: 19, autoAi: false, balls: potSetup(EIGHT) });
  early.isBreak = false;
  early.phase = 'aim';
  early.groups[PLAYER] = 'solid';
  early.groups[RIVAL] = 'stripe';
  early.world.balls.push(makeBall(1, 300, 300));
  assert.equal(clearedFor(early, PLAYER), false);
  early.shoot({ by: PLAYER, angle: CORNER_LINE.angle, power: 0.45 });
  settle(early);
  assert.equal(early.result, 'lose');
  assert.equal(early.resultReason, 'early');
});

test('洗袋打进 8 号也算负', () => {
  // 8 号贴着右上角袋，白球在同一条 45° 线后方：8 号落袋时白球跟进洗袋。
  const gap = Math.SQRT1_2 * 45;
  const back = Math.SQRT1_2 * 110;
  const match = createMatch({ seed: 23, autoAi: false });
  match.isBreak = false;
  match.phase = 'aim';
  match.groups[PLAYER] = 'solid';
  match.groups[RIVAL] = 'stripe';
  match.world.balls = [
    makeBall(CUE, PLAY.right - gap - back, PLAY.top + gap + back),
    makeBall(EIGHT, PLAY.right - gap, PLAY.top + gap),
  ];
  match.shoot({ by: PLAYER, angle: -Math.PI / 4, power: 0.9 });
  settle(match);
  assert.equal(match.phase, 'over');
  assert.equal(match.result, 'lose');
  assert.equal(match.resultReason, 'scratch');
});

test('AI 找直线球：算出与目标球-袋口一致的 Ghost 方向', () => {
  const w = world(potSetup(3));
  const plan = planShot(w, {
    targets: legalTargets(w, 'solid', false),
    level: 'pro',
    rng: makeRng(1),
    isBreak: false,
  });
  assert.ok(plan, '应给出出杆方案');
  assert.equal(plan.kind, 'pot');
  assert.equal(plan.targetId, 3);
  assert.ok(Math.abs(plan.angle - CORNER_LINE.angle) < 0.05, `角度 ${plan.angle.toFixed(3)} 应接近 -45°`);
  assert.ok(plan.power > RULES.MIN_POWER && plan.power < 1);
  assert.ok(Math.abs(shotSpeed(plan.power) - (PHYSICS.MIN_SHOT_SPEED + plan.power * (PHYSICS.MAX_SHOT_SPEED - PHYSICS.MIN_SHOT_SPEED))) < 1e-6);
});

test('AI 无解时打安全球：轻碰最近合法球而不是卡死', () => {
  const target = { x: 640, y: 370 };
  const ring = [9, 10, 11, 12, 13, 14, 15];
  const balls = [makeBall(CUE, 300, 370), makeBall(3, target.x, target.y)];
  ring.forEach((id, i) => {
    const a = (i / ring.length) * Math.PI * 2;
    balls.push(makeBall(id, target.x + Math.cos(a) * 22.2, target.y + Math.sin(a) * 22.2));
  });
  const w = world(balls);
  const targets = legalTargets(w, 'solid', false);
  assert.deepEqual(targets.map((b) => b.id), [3], '本组只剩被围死的 3 号');
  const plan = planShot(w, {
    targets,
    level: 'club',
    rng: makeRng(2),
    isBreak: false,
  });
  assert.ok(plan, '无线路时仍应有方案');
  assert.equal(plan.kind, 'safety');
  assert.equal(plan.targetId, 3);
  assert.ok(Math.abs(plan.angle - 0) < 0.1, '安全球应指向最近的合法球');
  assert.ok(plan.power >= RULES.MIN_POWER);
});

test('自由球摆位：重叠、界外与袋口点被拒绝，合法点接受', () => {
  const match = createMatch({ seed: 29, autoAi: false, balls: potSetup(3) });
  assert.equal(match.placeCueBall(PLAY.left - 50, 370), false, '界外拒绝');
  assert.equal(match.placeCueBall(CORNER_LINE.object.x, CORNER_LINE.object.y), false, '与球重叠拒绝');
  assert.equal(match.placeCueBall(PLAY.right, PLAY.top), false, '袋口内拒绝');
  assert.equal(match.canPlaceCueBall(500, 450), true);
  assert.equal(match.placeCueBall(500, 450), true);
  const cue = match.world.balls.find((b) => b.id === CUE);
  assert.equal(cue.x, 500);
  assert.equal(cue.y, 450);
  assert.equal(match.ballInHand, false, '摆好后自由球解除');
});

test('无效出杆：力度过小或回合不对不产生击球', () => {
  const match = createMatch({ seed: 31, autoAi: false });
  assert.equal(match.shoot({ by: PLAYER, angle: 0, power: 0.01 })[0].reason, 'power');
  assert.equal(match.shots[PLAYER], 0);
  assert.deepEqual(match.shoot({ by: RIVAL, angle: 0, power: 0.8 }), [], '不是对手的回合');
  assert.equal(match.phase, 'break', '无效出杆不改变阶段');
});

test('同种子确定性：相同 seed 的球堆与开球结果一致', () => {
  const a = createMatch({ seed: 1234, autoAi: false });
  const b = createMatch({ seed: 1234, autoAi: false });
  assert.deepEqual(a.world.balls.map((x) => [x.id, Math.round(x.x), Math.round(x.y)]),
    b.world.balls.map((x) => [x.id, Math.round(x.x), Math.round(x.y)]));
  a.shoot({ by: PLAYER, angle: 0, power: RULES.BREAK_POWER });
  b.shoot({ by: PLAYER, angle: 0, power: RULES.BREAK_POWER });
  settle(a);
  settle(b);
  assert.deepEqual(a.world.balls.map((x) => [x.id, x.alive, Math.round(x.x), Math.round(x.y)]),
    b.world.balls.map((x) => [x.id, x.alive, Math.round(x.x), Math.round(x.y)]));
});

test('整局自对弈：双方轮流打，300 秒内必然终局不卡死', () => {
  const match = createMatch({ seed: 2026, aiLevel: 'club', autoAi: true });
  const rng = makeRng(99);
  let steps = 0;
  const limit = 300 * 60;
  while (match.phase !== 'over' && steps < limit) {
    if (match.turn === PLAYER && (match.phase === 'aim' || match.phase === 'break')) {
      if (match.ballInHand) {
        const cue = match.world.balls.find((b) => b.id === CUE);
        match.placeCueBall(cue.x, cue.y);
      }
      const plan = planShot(match.world, {
        targets: legalTargets(match.world, match.groups[PLAYER], clearedFor(match, PLAYER)),
        level: 'pro',
        rng,
        isBreak: match.isBreak,
      });
      if (plan) match.shoot({ by: PLAYER, angle: plan.angle, power: plan.power });
      else match.abortToOver('stalemate');
    }
    match.step(DT);
    match.drainEvents();
    steps += 1;
  }
  assert.equal(match.phase, 'over', `应在 ${limit} 步内终局，实际 ${steps} 步`);
  assert.ok(['win', 'lose'].indexOf(match.result) >= 0);
  assert.ok(match.shots[PLAYER] > 0 && match.shots[RIVAL] > 0, '双方都出过杆');
});

test('表现层事件：击球广播 shot/hit/pocket 且落袋动画不含白球', () => {
  const sim = createSim({ seed: 77, autoAi: false, balls: potSetup(3) });
  sim.match.isBreak = false;
  sim.match.phase = 'aim';
  assert.equal(sim.beginStrike({ angle: CORNER_LINE.angle, power: 0.45, by: PLAYER }), true);
  for (let i = 0; i < 60 * 12; i += 1) sim.step(DT);
  assert.ok(sim.sfx.length > 0, '应有待播音效队列');
  assert.ok(sim.sfx.some((s) => s.name === 'cue'), '开杆音');
  assert.ok(sim.sfx.some((s) => s.name === 'clack') || sim.sfx.some((s) => s.name === 'pocket'));
  assert.ok(sim.fx.pots.every((p) => p.id !== CUE), '白球不做落袋动画');
  assert.equal(sim.match.phase, 'aim', '一杆结束回到瞄准');
});

test('瞄准预测：虚球点与目标球方向在首次接触处', () => {
  const sim = createSim({ seed: 83, autoAi: false, balls: potSetup(3) });
  sim.match.phase = 'aim';
  sim.aim.angle = CORNER_LINE.angle;
  const preview = sim.aimPreview();
  assert.ok(preview.ghost, '应有虚球点');
  assert.equal(preview.ball.id, 3);
  const d = Math.hypot(preview.ghost.x - CORNER_LINE.object.x, preview.ghost.y - CORNER_LINE.object.y);
  assert.ok(Math.abs(d - BALL.DIAM) < 0.5, `虚球点应距目标球一球的直径，实际 ${d.toFixed(2)}`);
  assert.ok(Math.hypot(preview.object.dx, preview.object.dy) - 1 < 1e-6, '目标球方向为单位向量');
});

test('配置与文案默认值：en 默认 + zh 同键，台面尺寸符合规格', () => {
  assert.equal(CONFIG.defaultLang, 'en');
  assert.deepEqual(CONFIG.languages, ['en', 'zh']);
  assert.deepEqual(CONFIG.rtlLangs, []);
  assert.deepEqual(Object.keys(locales.en).sort(), Object.keys(locales.zh).sort());
  assert.ok(Object.keys(locales.en).length > 30);
  assert.ok(Object.values(locales.zh).every((s) => typeof s === 'string' && s.trim().length > 0));
  assert.equal(PLAY.right - PLAY.left, 1020);
  assert.equal(PLAY.bottom - PLAY.top, 510);
  assert.equal(BALL.R, 11);
  assert.equal(TABLE.POCKET_R, 26);
  assert.equal(POCKETS.length, 6);
  assert.equal(PHYSICS.FRICTION, 0.985);
  assert.equal(PHYSICS.CUSHION, 0.82);
  assert.equal(PHYSICS.STOP_SPEED, 8);
  assert.equal(HEAD_SPOT.x, PLAY.left + (PLAY.right - PLAY.left) / 4);
});

test('存档默认值：无浏览器存储时返回调用方给的缺省', () => {
  assert.equal(Sdk.load('progress', null), null);
  assert.equal(Sdk.load('best', 0), 0);
  assert.deepEqual(Sdk.load('eight-ball', { wins: 0 }), { wins: 0 }, '对象缺省原样返回');
  Sdk.save('progress', { wins: 2, losses: 1 });
  assert.deepEqual(Sdk.load('progress', null), null, 'node 无 storage，写不进也读不出');
});
