// 单人 8 球规则与回合状态机（纯逻辑）：开球 → 定花色 → 清本组 → 打 8 号。
import { AI, PHYSICS, RULES } from '../../config/game.config.js';
import { firstLegalPlacement, legalTargets, planPlacement, planShot, placementOk } from './ai.js';
import { CUE, EIGHT, HEAD_SPOT, createRack, kindOf, makeBall } from './balls.js';
import { anyMoving, stepPhysics } from './physics.js';
import { makeRng } from './rng.js';

export const PLAYER = 'player';
export const RIVAL = 'rival';

const clamp01 = (v) => Math.max(0, Math.min(1, v));
const other = (who) => (who === PLAYER ? RIVAL : PLAYER);

export function shotSpeed(power) {
  return PHYSICS.MIN_SHOT_SPEED + clamp01(power) * (PHYSICS.MAX_SHOT_SPEED - PHYSICS.MIN_SHOT_SPEED);
}

export function createMatch(options = {}) {
  const seed = Number.isFinite(options.seed) ? options.seed : 20261112;
  const aiLevel = AI.LEVELS[options.aiLevel] ? options.aiLevel : AI.DEFAULT;
  const rng = makeRng(seed);

  const match = {
    seed,
    aiLevel,
    rng,
    world: { balls: options.balls || createRack(rng) },
    turn: PLAYER,
    groups: { [PLAYER]: null, [RIVAL]: null },
    phase: 'break', // break | aim | moving | over
    isBreak: true,
    ballInHand: false,
    lastFoul: null,
    result: null, // win | lose（玩家视角）
    resultReason: null, // clean | early | scratch
    shots: { [PLAYER]: 0, [RIVAL]: 0 },
    autoAi: options.autoAi !== false,
    aiTimer: 0,
    shot: null,
    queue: [],
  };

  const cueBall = () => match.world.balls.find((b) => b.id === CUE) || null;

  const aliveOf = (group) =>
    group
      ? match.world.balls.filter((b) => b.alive && b.id !== CUE && b.id !== EIGHT && kindOf(b.id) === group)
      : [];

  const remainingFor = (who) => (match.groups[who] ? aliveOf(match.groups[who]).length : null);

  const clearedFor = (who) => !!match.groups[who] && aliveOf(match.groups[who]).length === 0;

  const targetsFor = (who) => legalTargets(match.world, match.groups[who], clearedFor(who));

  // 洗袋 / 摆球后把白球放回台面
  function respawnCue(prefer = HEAD_SPOT) {
    const spot = placementOk(match.world, prefer.x, prefer.y)
      ? prefer
      : firstLegalPlacement(match.world) || prefer;
    const cue = cueBall();
    if (cue) {
      cue.alive = true;
      cue.x = spot.x;
      cue.y = spot.y;
      cue.vx = 0;
      cue.vy = 0;
    } else {
      match.world.balls.push(makeBall(CUE, spot.x, spot.y));
    }
    return spot;
  }

  const push = (events) => {
    for (const e of events) match.queue.push(e);
    return events;
  };

  function firstContactFoul(s) {
    const hit = kindOf(s.firstContact);
    if (s.wasBreak) return null; // 开球只要求碰到球堆
    if (!s.before.group) return s.firstContact === EIGHT ? 'wrong_ball' : null;
    if (s.before.cleared) return s.firstContact === EIGHT ? null : 'wrong_ball';
    return hit === s.before.group ? null : 'wrong_ball';
  }

  // 本杆结算：犯规 → 8 号胜负 → 定花色 → 是否继续出杆
  function resolveShot() {
    const s = match.shot;
    const ev = [{ type: 'rest', by: s.by, potted: s.potted.slice() }];
    let foul = null;
    if (s.cuePotted) foul = 'scratch';
    else if (s.firstContact === null) foul = 'no_contact';
    else foul = firstContactFoul(s);

    const objects = s.potted.filter((id) => id !== CUE);
    const eightDown = objects.indexOf(EIGHT) >= 0;
    match.shot = null;

    if (eightDown) {
      const legal = !foul && s.before.cleared;
      match.result = s.by === PLAYER ? (legal ? 'win' : 'lose') : legal ? 'lose' : 'win';
      match.resultReason = foul === 'scratch' ? 'scratch' : legal ? 'clean' : 'early';
      match.phase = 'over';
      ev.push({ type: 'over', result: match.result, reason: match.resultReason, by: s.by });
      return ev;
    }

    // 开球后第一颗合法入袋定花色；同杆进两种花色按先入的算
    if (!s.wasBreak && !foul && !match.groups[PLAYER] && !match.groups[RIVAL] && objects.length) {
      const mine = kindOf(objects[0]);
      match.groups[s.by] = mine;
      match.groups[other(s.by)] = mine === 'solid' ? 'stripe' : 'solid';
      ev.push({ type: 'group', by: s.by, group: mine });
    }

    let keep = false;
    if (!foul) {
      if (s.wasBreak || !s.before.group) keep = objects.length > 0;
      else keep = objects.some((id) => kindOf(id) === s.before.group);
    }

    if (foul) {
      match.lastFoul = { by: s.by, reason: foul };
      respawnCue();
      match.ballInHand = true;
      ev.push({ type: 'foul', by: s.by, reason: foul });
    } else {
      match.lastFoul = null;
      match.ballInHand = false;
    }

    match.turn = keep ? s.by : other(s.by);
    match.phase = 'aim';
    match.isBreak = false;
    match.aiTimer = 0;
    ev.push({ type: 'turn', to: match.turn, ballInHand: match.ballInHand });
    return ev;
  }

  match.shoot = (shot = {}) => {
    if (match.phase !== 'break' && match.phase !== 'aim') return [];
    const by = shot.by || match.turn;
    if (by !== match.turn) return [];
    const power = clamp01(shot.power === undefined ? 0 : shot.power);
    if (power < RULES.MIN_POWER) return [{ type: 'invalid', reason: 'power' }];
    if (!cueBall() || !cueBall().alive) respawnCue();
    const angle = Number.isFinite(shot.angle) ? shot.angle : 0;
    const speed = shotSpeed(power);
    const cue = cueBall();
    cue.vx = Math.cos(angle) * speed;
    cue.vy = Math.sin(angle) * speed;

    match.shot = {
      by,
      angle,
      power,
      wasBreak: match.isBreak,
      before: { group: match.groups[by], cleared: clearedFor(by) },
      firstContact: null,
      potted: [],
      cuePotted: false,
      elapsed: 0,
    };
    match.phase = 'moving';
    match.shots[by] += 1;
    return push([{ type: 'shot', by, angle, power, kind: match.shot.wasBreak ? 'break' : 'normal' }]);
  };

  match.step = (dt) => {
    const out = [];
    if (match.phase === 'moving') {
      const s = match.shot;
      s.elapsed += dt;
      stepPhysics(match.world, dt, out);
      for (const e of out) {
        if (e.type === 'hit' && s.firstContact === null) {
          if (e.a === CUE) s.firstContact = e.b;
          else if (e.b === CUE) s.firstContact = e.a;
        } else if (e.type === 'pocket') {
          if (e.id === CUE) s.cuePotted = true;
          else s.potted.push(e.id);
        }
      }
      if (!anyMoving(match.world.balls) || s.elapsed >= PHYSICS.SETTLE_TIMEOUT) {
        out.push(...resolveShot());
      }
      return push(out);
    }
    if (match.phase === 'over') return out;

    if (match.autoAi && match.turn === RIVAL) {
      if (match.ballInHand) {
        const place = match.planAiPlacement();
        if (place) match.placeCueBall(place.x, place.y);
      }
      match.aiTimer += dt;
      if (match.aiTimer >= AI.THINK) {
        match.aiTimer = 0;
        const plan = match.planAiShot();
        // shoot() 自带入队，这里不再重复 push
        if (plan) match.shoot({ by: RIVAL, angle: plan.angle, power: plan.power });
        else match.abortToOver('stalemate');
      }
    }
    return out;
  };

  match.planAiShot = () =>
    planShot(match.world, {
      targets: targetsFor(RIVAL),
      level: match.aiLevel,
      rng: match.rng,
      isBreak: match.isBreak,
    });

  match.planAiPlacement = () => planPlacement(match.world, targetsFor(RIVAL), cueBall());

  // 兜底：台面已无可打目标（正常流程不会走到，8 号落袋即已终局）
  match.abortToOver = (reason) => {
    if (match.phase === 'over') return false;
    match.result = 'lose';
    match.resultReason = reason;
    match.phase = 'over';
    push([{ type: 'over', result: match.result, reason, by: match.turn }]);
    return true;
  };

  match.placeCueBall = (x, y) => {
    if (match.phase === 'moving' || match.phase === 'over') return false;
    if (!placementOk(match.world, x, y)) return false;
    const cue = cueBall();
    if (!cue) return false;
    cue.alive = true;
    cue.x = x;
    cue.y = y;
    cue.vx = 0;
    cue.vy = 0;
    match.ballInHand = false;
    return true;
  };

  match.canPlaceCueBall = (x, y) => placementOk(match.world, x, y);

  match.drainEvents = () => {
    const q = match.queue;
    match.queue = [];
    return q;
  };

  match.setBalls = (list) => {
    match.world.balls = list.map((b) => makeBall(b.id | 0, b.x, b.y));
    if (!cueBall()) respawnCue();
    if (match.phase !== 'over') match.phase = 'aim';
    match.shot = null;
    return match.world.balls;
  };

  match.getHud = () => ({
    turn: match.turn,
    phase: match.phase,
    groups: { [PLAYER]: match.groups[PLAYER], [RIVAL]: match.groups[RIVAL] },
    remaining: { [PLAYER]: remainingFor(PLAYER), [RIVAL]: remainingFor(RIVAL) },
    left: {
      [PLAYER]: aliveOf(match.groups[PLAYER]).map((b) => b.id),
      [RIVAL]: aliveOf(match.groups[RIVAL]).map((b) => b.id),
    },
    onEight: { [PLAYER]: clearedFor(PLAYER), [RIVAL]: clearedFor(RIVAL) },
    foul: match.lastFoul,
    ballInHand: match.ballInHand,
    isBreak: match.isBreak,
    result: match.result,
    resultReason: match.resultReason,
    shots: { [PLAYER]: match.shots[PLAYER], [RIVAL]: match.shots[RIVAL] },
    thinking: match.turn === RIVAL && match.phase !== 'moving' && match.phase !== 'over',
  });

  return match;
}

export { CUE as CUE_BALL_ID, EIGHT as EIGHT_BALL_ID };
