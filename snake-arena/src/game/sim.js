// SNAKE ARENA · M1 纯逻辑模拟（无 DOM / 无 window / 无 Date.now；随机全走 run.rng）
// 契约：createRun({seed}) → run；run.step(input) / run.getHud() / run.drainEvents() / run.chooseUpgrade(i)
// input = { steerAngle: number|null(rad), boost: bool, pulse: bool(边沿触发) }
// 事件表（drainEvents 产出）：roundStart / eat / grow / shardDrop / boostStart / boostEnd /
//   pulse / stun / kill / death / nearMiss / milestone / rankChange / roundWin / win / lose / unlock
import { WORLD, STEP } from '../../config/game.config.js';
import * as C from '../../config/gameplay.js';
import { roundDef } from '../../config/rounds.js';
import { mulberry32 } from './rng.js';

const TAU = Math.PI * 2;

// AI 出生点：顶部下移避开 HUD 预留带（WORLD.HUD_TOP），其余沿竞技场边缘分布。
const RING_SPAWNS = [
  [90, WORLD.HUD_TOP + 100], [WORLD.WIDTH - 90, WORLD.HUD_TOP + 100],
  [90, WORLD.HEIGHT - 100], [WORLD.WIDTH - 90, WORLD.HEIGHT - 100],
  [WORLD.WIDTH / 2, WORLD.HUD_TOP + 100], [WORLD.WIDTH / 2, WORLD.HEIGHT - 100],
  [90, WORLD.HEIGHT / 2], [WORLD.WIDTH - 90, WORLD.HEIGHT / 2],
];

function emit(run, type, payload = {}) {
  run.events.push({ type, ...payload });
}

function makeSnake(run, { isPlayer, x, y, heading, name, colorIdx }) {
  const seg = [];
  const dx = Math.cos(heading);
  const dy = Math.sin(heading);
  for (let i = 0; i < C.SNAKE.START_SEGMENTS; i += 1) {
    seg.push({ x: x - dx * i * C.SNAKE.SEGMENT_SPACING, y: y - dy * i * C.SNAKE.SEGMENT_SPACING });
  }
  const snake = {
    id: run.nextId++,
    isPlayer,
    name,
    colorIdx,
    segments: seg,
    heading,
    turnRate: C.SNAKE.TURN_RATE,
    boosting: false,
    boostTimer: C.BOOST.DRAIN_SEC,
    pulseCooldown: 0,
    stunned: 0,
    invuln: 0,
    alive: true,
    kills: 0,
    weight: 0,
    nearMissThrottle: 0,
    _shardFlip: false,
    ai: isPlayer ? null : { mode: 'wander', timer: C.AI.DECIDE_EVERY * run.rng(), targetAngle: run.rng() * TAU },
  };
  return snake;
}

function resetSnake(s, x, y, heading) {
  const seg = [];
  const dx = Math.cos(heading);
  const dy = Math.sin(heading);
  for (let i = 0; i < C.SNAKE.START_SEGMENTS; i += 1) {
    seg.push({ x: x - dx * i * C.SNAKE.SEGMENT_SPACING, y: y - dy * i * C.SNAKE.SEGMENT_SPACING });
  }
  s.segments = seg;
  s.heading = heading;
  s.turnRate = C.SNAKE.TURN_RATE;
  s.boosting = false;
  s.boostTimer = C.BOOST.DRAIN_SEC;
  s.pulseCooldown = 0;
  s.stunned = 0;
  s.invuln = 0;
  s.alive = true;
  s.kills = 0;
  s.weight = 0;
  s.nearMissThrottle = 0;
  s._shardFlip = false;
}

function addFood(run, kind, x, y, moving) {
  const f = { id: run.nextId++, x, y, kind, weight: kind === 'shard' ? C.GROWTH.SHARD_WEIGHT : C.GROWTH.FOOD_WEIGHT, vx: 0, vy: 0 };
  if (moving) {
    const a = run.rng() * TAU;
    const sp = 18 + run.rng() * 14;
    f.vx = Math.cos(a) * sp;
    f.vy = Math.sin(a) * sp;
  }
  run.foods.push(f);
  return f;
}

function scatterFood(run, count, moving) {
  for (let i = 0; i < count; i += 1) {
    const m = 46;
    const top = WORLD.HUD_TOP + 32; // 顶部食物（含光晕）也不进 HUD 预留带
    addFood(run, 'data', m + run.rng() * (WORLD.WIDTH - m * 2), top + run.rng() * (WORLD.HEIGHT - top - m), moving);
  }
}

function startRound(run, index) {
  const def = roundDef(index);
  run.round = index;
  run.roundTime = C.ROUND.DURATION;
  run.foods = [];
  run.respawnQueue = [];
  run.lastRank = 0;
  run.lastMilestone = C.SNAKE.START_SEGMENTS;
  run.stats.theme = def.theme;
  run.upgradeOffers = [];
  run.phase = 'playing';

  const player = makeSnake(run, { isPlayer: true, x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2, heading: 0, name: 'YOU', colorIdx: 0 });
  player.invuln = C.ROUND.PLAYER_INVULN;
  run.player = player;
  run.snakes = [player];

  for (let i = 0; i < def.aiCount; i += 1) {
    const sp = RING_SPAWNS[i % RING_SPAWNS.length];
    const heading = run.rng() * TAU;
    const ai = makeSnake(run, { isPlayer: false, x: sp[0], y: sp[1], heading, name: `AI-${i + 1}`, colorIdx: 1 + (i % 3) });
    run.snakes.push(ai);
  }

  scatterFood(run, def.foodDensity, index >= 4);
  emit(run, 'roundStart', { round: index, name: def.nameKey, theme: def.theme });
  updateRank(run);
}

function nearestFood(run, h) {
  let best = null;
  let bestD = Infinity;
  for (const f of run.foods) {
    const d = (f.x - h.x) * (f.x - h.x) + (f.y - h.y) * (f.y - h.y);
    if (d < bestD) { bestD = d; best = f; }
  }
  return best;
}

function decideAI(run, s, def) {
  const h = s.segments[0];
  const m = C.AI.WALL_STEER_MARGIN;
  if (h.x < m || h.x > WORLD.WIDTH - m || h.y < m || h.y > WORLD.HEIGHT - m) {
    s.ai.mode = 'center';
    s.ai.targetAngle = Math.atan2(WORLD.HEIGHT / 2 - h.y, WORLD.WIDTH / 2 - h.x);
    s.turnRate = C.SNAKE.TURN_RATE;
    return;
  }
  const p = run.player;
  const playerLen = p && p.alive ? p.segments.length : 0;
  const wantHunt = run.rng() < def.aggression && playerLen > 0 && s.segments.length > playerLen + 2;
  if (wantHunt) {
    s.ai.mode = 'hunter';
    s.ai.targetAngle = Math.atan2(p.segments[0].y - h.y, p.segments[0].x - h.x);
    s.turnRate = C.AI.HUNTER_TURN;
  } else if (run.rng() < 0.72) {
    s.ai.mode = 'food';
    const f = nearestFood(run, h);
    s.ai.targetAngle = f ? Math.atan2(f.y - h.y, f.x - h.x) : run.rng() * TAU;
    s.turnRate = C.SNAKE.TURN_RATE;
  } else {
    s.ai.mode = 'wander';
    s.ai.targetAngle = run.rng() * TAU;
    s.turnRate = C.SNAKE.TURN_RATE;
  }
}

function aiStep(run, s, def) {
  if (s.stunned > 0) return;
  s.ai.timer -= STEP;
  if (s.ai.timer <= 0) {
    s.ai.timer = C.AI.DECIDE_EVERY * (0.6 + run.rng() * 0.8);
    decideAI(run, s, def);
  }
  steerToward(run, s, s.ai.targetAngle);
}

function steerToward(run, s, targetAngle) {
  if (s.stunned > 0) return;
  if (typeof targetAngle !== 'number' || Number.isNaN(targetAngle)) return;
  let diff = C.angleDiff(targetAngle, s.heading);
  const maxTurn = s.turnRate * STEP;
  if (diff > maxTurn) diff = maxTurn;
  else if (diff < -maxTurn) diff = -maxTurn;
  s.heading = C.wrapAngle(s.heading + diff);
}

function addSegment(run, s) {
  if (s.segments.length >= C.SNAKE.MAX_SEGMENTS) return false;
  const tail = s.segments[s.segments.length - 1];
  s.segments.push({ x: tail.x, y: tail.y });
  emit(run, 'grow', { snakeId: s.id, isPlayer: s.isPlayer, length: s.segments.length, x: tail.x, y: tail.y });
  if (s.isPlayer) {
    run.stats.bestLength = Math.max(run.stats.bestLength, s.segments.length);
    checkMilestone(run, s);
  }
  return true;
}

function growSegments(run, s, n) {
  for (let i = 0; i < n; i += 1) if (!addSegment(run, s)) break;
}

function checkMilestone(run, p) {
  const len = p.segments.length;
  if (len >= run.lastMilestone + C.MILESTONE.EVERY) {
    run.lastMilestone = len;
    emit(run, 'milestone', { length: len });
  }
}

function dropShard(run, s) {
  if (s.segments.length <= C.BOOST.MIN_SEGMENTS) { s.boosting = false; return; }
  const tail = s.segments[s.segments.length - 1];
  s.segments.pop();
  emit(run, 'shardDrop', { snakeId: s.id, isPlayer: s.isPlayer, x: tail.x, y: tail.y });
  s._shardFlip = !s._shardFlip;
  const dropIt = !run.upgrades.overclock && (!run.upgrades.shardRefund || s._shardFlip);
  if (dropIt) {
    run.foods.push({ id: run.nextId++, x: tail.x, y: tail.y, kind: 'shard', weight: C.GROWTH.SHARD_WEIGHT, vx: 0, vy: 0 });
  }
}

function moveSnake(run, s) {
  if (!s.alive) return;
  if (s.invuln > 0) s.invuln -= STEP;
  if (s.stunned > 0) s.stunned -= STEP;
  if (s.pulseCooldown > 0) s.pulseCooldown -= STEP;
  if (s.nearMissThrottle > 0) s.nearMissThrottle -= STEP;

  const speed = s.boosting ? C.SNAKE.BASE_SPEED * C.SNAKE.BOOST_MULT : C.SNAKE.BASE_SPEED;
  const h = s.segments[0];
  h.x += Math.cos(s.heading) * speed * STEP;
  h.y += Math.sin(s.heading) * speed * STEP;

  for (let i = 1; i < s.segments.length; i += 1) {
    const prev = s.segments[i - 1];
    const cur = s.segments[i];
    const dx = prev.x - cur.x;
    const dy = prev.y - cur.y;
    const d = Math.hypot(dx, dy);
    const spacing = C.SNAKE.SEGMENT_SPACING;
    if (d > spacing) {
      const k = (d - spacing) / (d || 1);
      cur.x += dx * k;
      cur.y += dy * k;
    }
  }

  if (s.boosting) {
    s.boostTimer -= STEP;
    if (s.boostTimer <= 0) {
      s.boostTimer += C.BOOST.DRAIN_SEC;
      dropShard(run, s);
    }
  }

  if (h.x < C.COLLIDE.WALL_MARGIN || h.x > WORLD.WIDTH - C.COLLIDE.WALL_MARGIN
    || h.y < WORLD.HUD_TOP || h.y > WORLD.HEIGHT - C.COLLIDE.WALL_MARGIN) {
    killSnake(run, s, null, 'wall');
  }
}

function tryPulse(run, p) {
  if (!C.canPulse(p, run.round, p.pulseCooldown)) return false;
  if (run.upgrades.pulseShield) p.invuln = Math.max(p.invuln, 1.0);
  p.pulseCooldown = C.PULSE.COOLDOWN * run.upgrades.pulseCooldownMult;
  const hx = p.segments[0].x;
  const hy = p.segments[0].y;
  emit(run, 'pulse', { x: hx, y: hy, radius: C.PULSE.RADIUS });
  for (const s of run.snakes) {
    if (s === p || !s.alive) continue;
    if (Math.hypot(s.segments[0].x - hx, s.segments[0].y - hy) <= C.PULSE.RADIUS) {
      s.stunned = C.PULSE.STUN_SEC;
      emit(run, 'stun', { snakeId: s.id });
    }
  }
  return true;
}

function eatFood(run) {
  for (const s of run.snakes) {
    if (!s.alive) continue;
    const h = s.segments[0];
    for (let i = run.foods.length - 1; i >= 0; i -= 1) {
      const f = run.foods[i];
      if ((f.x - h.x) * (f.x - h.x) + (f.y - h.y) * (f.y - h.y) < C.FOOD.EAT_RADIUS * C.FOOD.EAT_RADIUS) {
        run.foods.splice(i, 1);
        s.weight += f.weight;
        emit(run, 'eat', { snakeId: s.id, isPlayer: s.isPlayer, kind: f.kind, value: f.weight, x: f.x, y: f.y });
        while (s.weight >= C.GROWTH.WEIGHT_PER_SEGMENT && s.segments.length < C.SNAKE.MAX_SEGMENTS) {
          s.weight -= C.GROWTH.WEIGHT_PER_SEGMENT;
          addSegment(run, s);
        }
      }
    }
  }
}

function killSnake(run, victim, killer, cause) {
  if (!victim || !victim.alive) return;
  if (victim.invuln > 0) return;
  victim.alive = false;
  emit(run, 'death', { id: victim.id, isPlayer: victim.isPlayer, x: victim.segments[0].x, y: victim.segments[0].y, cause });

  if (killer && killer.alive && killer !== victim) {
    killer.kills += 1;
    emit(run, 'kill', { killerId: killer.id, victimId: victim.id, isPlayerKill: killer.isPlayer, x: victim.segments[0].x, y: victim.segments[0].y });
    if (killer.isPlayer) {
      run.stats.kills += 1;
      const bonus = C.GROWTH.KILL_BONUS_SEGMENTS + (run.upgrades.coreSteal ? C.GROWTH.CORE_STEAL_SEGMENTS : 0);
      growSegments(run, killer, bonus);
    }
  }

  // 光带碎成数据雨（身体 → 食物）
  for (const seg of victim.segments) {
    run.foods.push({ id: run.nextId++, x: seg.x, y: seg.y, kind: 'data', weight: C.GROWTH.FOOD_WEIGHT, vx: 0, vy: 0 });
  }

  if (victim.isPlayer) {
    run.stats.rank = computeRank(run, victim);
    run.stats.score = victim.segments.length;
    run.stats.bestLength = Math.max(run.stats.bestLength, victim.segments.length);
    run.phase = 'dead';
    emit(run, 'lose', { rank: run.stats.rank, length: victim.segments.length });
  } else {
    run.respawnQueue.push({ slot: victim, at: run.time + C.AI.RESPAWN_DELAY });
  }
}

function headHitsBody(run, head, bodySnake) {
  let end = bodySnake.segments.length;
  if (bodySnake.isPlayer && run.upgrades.tailArmor) end = Math.max(1, end - 2);
  for (let k = 1; k < end; k += 1) {
    const seg = bodySnake.segments[k];
    if ((head.x - seg.x) * (head.x - seg.x) + (head.y - seg.y) * (head.y - seg.y) < C.COLLIDE.HEAD_BODY_R * C.COLLIDE.HEAD_BODY_R) return true;
  }
  return false;
}

function resolveCollisions(run) {
  const alive = run.snakes.filter((s) => s.alive);
  for (let i = 0; i < alive.length; i += 1) {
    const a = alive[i];
    const ha = a.segments[0];
    for (let j = i + 1; j < alive.length; j += 1) {
      const b = alive[j];
      const hb = b.segments[0];
      if ((ha.x - hb.x) * (ha.x - hb.x) + (ha.y - hb.y) * (ha.y - hb.y) < C.COLLIDE.HEAD_HEAD_R * C.COLLIDE.HEAD_HEAD_R) {
        const la = a.segments.length;
        const lb = b.segments.length;
        if (la > lb) killSnake(run, b, a, 'head');
        else if (lb > la) killSnake(run, a, b, 'head');
        else { killSnake(run, a, b, 'head'); killSnake(run, b, a, 'head'); }
        continue;
      }
      if (headHitsBody(run, ha, b)) {
        killSnake(run, a, b, 'body');
        if (!a.alive) continue;
      }
      if (headHitsBody(run, hb, a)) killSnake(run, b, a, 'body');
    }
  }
}

function applyMagnet(run, p) {
  const r = run.upgrades.magnetRadius;
  if (!(r > 0) || !p || !p.alive) return;
  const h = p.segments[0];
  for (const f of run.foods) {
    const dx = h.x - f.x;
    const dy = h.y - f.y;
    const d = Math.hypot(dx, dy);
    if (d < r && d > 1) {
      const k = (C.FOOD.MAGNET_PULL * STEP) / d;
      f.x += dx * k;
      f.y += dy * k;
    }
  }
}

function checkNearMiss(run, p) {
  if (!p || !p.alive || p.nearMissThrottle > 0) return;
  const ha = p.segments[0];
  let minD = Infinity;
  for (const s of run.snakes) {
    if (s === p || !s.alive) continue;
    for (let k = 1; k < s.segments.length; k += 1) {
      const d = (ha.x - s.segments[k].x) * (ha.x - s.segments[k].x) + (ha.y - s.segments[k].y) * (ha.y - s.segments[k].y);
      if (d < minD) minD = d;
    }
  }
  minD = Math.sqrt(minD);
  if (minD < C.COLLIDE.NEAR_MISS_R) {
    p.nearMissThrottle = C.COLLIDE.NEAR_MISS_THROTTLE;
    emit(run, 'nearMiss', { snakeId: p.id });
    if (run.upgrades.shockAbsorb) p.pulseCooldown = Math.max(0, p.pulseCooldown - 2.0);
  }
}

function computeRank(run, p) {
  const alive = run.snakes.filter((s) => s.alive);
  alive.sort((a, b) => b.segments.length - a.segments.length);
  return alive.indexOf(p) + 1;
}

function updateRank(run) {
  const p = run.player;
  if (!p || !p.alive) return;
  const rank = computeRank(run, p);
  if (rank !== run.lastRank) {
    run.lastRank = rank;
    run.stats.rank = rank;
    emit(run, 'rankChange', { rank });
  }
}

function updateFood(run) {
  for (const f of run.foods) {
    if (f.vx || f.vy) {
      f.x += f.vx * STEP;
      f.y += f.vy * STEP;
      if (f.x < 40 || f.x > WORLD.WIDTH - 40) f.vx *= -1;
      if (f.y < 40 || f.y > WORLD.HEIGHT - 40) f.vy *= -1;
    }
  }
}

function processRespawns(run, def) {
  for (let i = run.respawnQueue.length - 1; i >= 0; i -= 1) {
    const q = run.respawnQueue[i];
    if (run.time >= q.at) {
      run.respawnQueue.splice(i, 1);
      const sp = RING_SPAWNS[Math.floor(run.rng() * RING_SPAWNS.length)];
      resetSnake(q.slot, sp[0], sp[1], run.rng() * TAU);
      q.slot.invuln = C.AI.INVULN;
      q.slot.ai = { mode: 'wander', timer: C.AI.DECIDE_EVERY * run.rng(), targetAngle: run.rng() * TAU };
    }
  }
}

function shuffle(run, arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i -= 1) {
    const j = Math.floor(run.rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function makeOffers(run) {
  const takenRule = new Set();
  // 追踪已选规则升级：直接读 run.upgrades 里为 true 的布尔升级
  const ruleIds = ['shardRefund', 'tailArmor', 'pulseShield', 'overclock', 'coreSteal', 'shockAbsorb'];
  const statIds = ['turnSpeed', 'magnetRadius', 'pulseCooldown'];
  const available = [];
  for (const id of statIds) available.push(id);
  for (const id of ruleIds) {
    if (!run.upgrades[id]) available.push(id);
  }
  return shuffle(run, available).slice(0, 3);
}

function applyUpgrade(run, id) {
  switch (id) {
    case 'turnSpeed': run.upgrades.turnRateMult *= 1.18; break;
    case 'magnetRadius': run.upgrades.magnetRadius += 130; break;
    case 'pulseCooldown': run.upgrades.pulseCooldownMult *= 0.75; break;
    case 'shardRefund': run.upgrades.shardRefund = true; break;
    case 'tailArmor': run.upgrades.tailArmor = true; break;
    case 'pulseShield': run.upgrades.pulseShield = true; break;
    case 'overclock': run.upgrades.overclock = true; break;
    case 'coreSteal': run.upgrades.coreSteal = true; break;
    case 'shockAbsorb': run.upgrades.shockAbsorb = true; break;
    default: return;
  }
}

function endRoundWin(run) {
  const p = run.player;
  run.stats.roundsCleared += 1;
  if (run.round >= C.ROUND.TOTAL) {
    run.stats.rank = computeRank(run, p);
    run.stats.score = p.segments.length;
    run.stats.bestLength = Math.max(run.stats.bestLength, p.segments.length);
    run.phase = 'won';
    emit(run, 'win', { round: run.round, length: p.segments.length, rank: run.stats.rank });
  } else {
    emit(run, 'roundWin', { round: run.round, length: p.segments.length, rank: computeRank(run, p) });
    run.phase = 'choosing';
    run.upgradeOffers = makeOffers(run);
  }
}

function stepRun(run, input) {
  if (run.phase !== 'playing') return;
  const def = roundDef(run.round);
  const p = run.player;
  const inp = input || {};

  if (inp.pulse && p && p.alive) tryPulse(run, p);

  if (p && p.alive) {
    p.turnRate = C.SNAKE.TURN_RATE * run.upgrades.turnRateMult;
    const wantBoost = !!inp.boost && C.canBoost(p, run.round);
    if (wantBoost !== p.boosting) {
      p.boosting = wantBoost;
      emit(run, wantBoost ? 'boostStart' : 'boostEnd', { snakeId: p.id });
    }
    steerToward(run, p, inp.steerAngle);
  }

  for (const s of run.snakes) {
    if (!s.isPlayer) aiStep(run, s, def);
  }
  for (const s of run.snakes) moveSnake(run, s);

  eatFood(run);
  resolveCollisions(run);
  applyMagnet(run, p);
  checkNearMiss(run, p);
  updateFood(run);
  processRespawns(run, def);
  updateRank(run);

  run.beatTimer -= STEP;
  if (run.beatTimer <= 0) {
    run.beatTimer += 2.0;
    if (p && p.alive) emit(run, 'beat', { roundTime: Math.max(0, run.roundTime) });
  }

  run.roundTime -= STEP;
  run.time += STEP;
  if (run.roundTime <= 0 && run.phase === 'playing') endRoundWin(run);
}

function chooseUpgrade(run, i) {
  if (run.phase !== 'choosing') return;
  const offer = run.upgradeOffers[i];
  if (!offer) return;
  applyUpgrade(run, offer);
  emit(run, 'unlock', { id: offer });
  run.upgradeOffers = [];
  startRound(run, run.round + 1);
}

function getHud(run) {
  const p = run.player;
  const def = roundDef(run.round);
  return {
    phase: run.phase,
    round: run.round,
    roundName: def.nameKey,
    theme: def.theme,
    roundTime: Math.max(0, run.roundTime),
    length: p ? p.segments.length : 0,
    rank: run.stats.rank,
    bestLength: run.stats.bestLength,
    kills: run.stats.kills,
    aiAlive: run.snakes.filter((s) => !s.isPlayer && s.alive).length,
    aiTotal: def.aiCount,
    boostReady: p ? C.canBoost(p, run.round) : false,
    boostActive: p ? p.boosting : false,
    pulseReady: p ? C.canPulse(p, run.round, p.pulseCooldown) : false,
    pulseCooldown: p ? Math.max(0, p.pulseCooldown) : 0,
    pulseCharge: p ? 1 - Math.min(1, p.pulseCooldown / (C.PULSE.COOLDOWN * run.upgrades.pulseCooldownMult)) : 0,
    pulseNeedLength: C.PULSE.MIN_SEGMENTS + 1,
  };
}

export function createRun({ seed = 1 } = {}) {
  const run = {
    phase: 'playing',
    time: 0,
    round: 1,
    rng: mulberry32(seed),
    nextId: 1,
    snakes: [],
    foods: [],
    events: [],
    respawnQueue: [],
    upgradeOffers: [],
    roundTime: 0,
    beatTimer: 2.0,
    lastRank: 0,
    lastMilestone: C.SNAKE.START_SEGMENTS,
    upgrades: {
      turnRateMult: 1,
      magnetRadius: 0,
      pulseCooldownMult: 1,
      shardRefund: false,
      tailArmor: false,
      pulseShield: false,
      overclock: false,
      coreSteal: false,
      shockAbsorb: false,
    },
    stats: { score: 0, bestLength: 0, kills: 0, roundsCleared: 0, rank: 1, theme: 'core' },
    player: null,
  };
  run.step = (input) => stepRun(run, input);
  run.drainEvents = () => run.events.splice(0);
  run.getHud = () => getHud(run);
  run.chooseUpgrade = (i) => chooseUpgrade(run, i);
  startRound(run, 1);
  return run;
}
