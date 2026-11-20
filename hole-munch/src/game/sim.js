// HOLE MUNCH · M1 模拟/玩法核心（纯逻辑，零依赖）
// 契约：docs/analysis.md；事件名见下方 emit 调用。
// 事件表：swallow / building / meteorRain / meteorGain / chain / chainProgress / chainEnd /
//   kill / death / respawn / nearMiss / matchEnd / upgrade / moveMilestone / rankTick / spawn
import {
  WORLD, STEP, HOLE, MOVE, SUCK, OBJECTS, CHAIN, METEOR, MATCH, UPGRADES, FEEDBACK,
  clamp, radiusAt, moveSpeedAt,
} from '../../config/gameplay.js';
import { matchAt, MATCH_COUNT } from '../../config/levels.js';
import { mulberry32, randInt } from './rng.js';

// 每场解锁的可吞物种类（随场次递进）
function unlockedKinds(level) {
  const kinds = ['lamp'];
  if (level >= 2) kinds.push('car');
  if (level >= 3) kinds.push('bus');
  if (level >= 4) kinds.push('building');
  if (level >= 7) kinds.push('skyscraper');
  return kinds;
}

const KIND_WEIGHTS = { lamp: 40, car: 26, bus: 16, building: 12, skyscraper: 8 };

function pickKind(rng, kinds) {
  let total = 0;
  for (const k of kinds) total += KIND_WEIGHTS[k] || 10;
  let r = rng() * total;
  for (const k of kinds) {
    r -= KIND_WEIGHTS[k] || 10;
    if (r <= 0) return k;
  }
  return kinds[kinds.length - 1];
}

function defaultMods() {
  return {
    suckRadiusMul: 1,
    suckTimeMul: 1,
    chainCountReq: CHAIN.COUNT,
    chainBonusAdd: CHAIN.BONUS,
    chainDurationBonus: 0,
    meteorMult: 3,
    moveSpeedMul: 1,
    startMassBonus: 0,
    maxRadiusBonus: 0,
    huntDouble: false,
  };
}

function makeHole(id, x, y, mass, isPlayer, mods) {
  return {
    id,
    x,
    y,
    mass,
    r: radiusAt(mass, HOLE.MAX_R + mods.maxRadiusBonus),
    maxR: HOLE.MAX_R + mods.maxRadiusBonus,
    tx: x,
    ty: y,
    isPlayer: !!isPlayer,
    alive: true,
    invulnUntil: -Infinity,
    color: null, // render 决定配色
    distAccum: 0,
    rankTickAt: 0,
    huntId: null,        // 捕食锁定：一旦开始追小洞，锁定几秒
    huntUntil: -Infinity,
  };
}

export function createRun({ seed = 0, startLevel = 1 } = {}) {
  const rng = mulberry32(seed);
  const level = clamp(startLevel, 1, MATCH_COUNT);
  const match = matchAt(level);
  const mods = defaultMods();

  const run = {
    rng,
    seed: seed >>> 0,
    phase: 'playing',       // playing | matchEnd | campaignComplete
    level,
    time: 0,
    match,
    mods,
    player: null,
    ai: [],
    objects: [],
    chain: { count: 0, lastAt: -Infinity, lastX: 0, lastY: 0, active: false, until: -Infinity },
    meteor: { nextAt: METEOR.INTERVAL, active: false, until: -Infinity },
    stats: {
      swallows: 0, kills: 0, deaths: 0, chainTriggers: 0, meteorsEaten: 0,
      maxMass: 0, bestRank: 6, wins: 0,
    },
    result: null,
    nextId: 1,
    events: [],
    _lastRank: 6,
    _rankTick: 0,
  };

  // 玩家 + 5 AI
  const playerMass = mods.startMassBonus + HOLE.PLAYER_HEAD_START;
  run.player = makeHole(run.nextId++, WORLD.WIDTH * 0.5, WORLD.HEIGHT * 0.5, playerMass, true, mods);
  const AI_COLORS = [0, 1, 2, 3, 4]; // 渲染里映射
  for (let i = 0; i < MATCH.AI_COUNT; i += 1) {
    const x = 80 + rng() * (WORLD.WIDTH - 160);
    const y = 80 + rng() * (WORLD.HEIGHT - 160);
    const ai = makeHole(run.nextId++, x, y, mods.startMassBonus, false, mods);
    ai.color = AI_COLORS[i];
    ai.strength = match.aiStrength;
    ai.hunter = match.newElement === 'hunter AI' ? i < 2 : false;
    run.ai.push(ai);
  }

  makeClusters(run);
  spawnObjects(run, match.density);

  run.step = (input) => step(run, input);
  run.getHud = () => getHud(run);
  run.drainEvents = () => drainEvents(run);
  run.advance = (upgradeId) => advance(run, upgradeId);
  run.retry = () => retry(run);
  return run;
}

// ---------- 每 tick ----------
export function step(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  run.time += dt;

  updatePlayerInput(run, input, dt);
  updateAI(run, dt);
  updateSucking(run, dt);
  eliminateHoles(run);
  spawnIfLow(run);
  updateMeteor(run);
  updateChainTimeout(run);
  updateFeedback(run, dt);
  updateTimer(run);

  run.stats.maxMass = Math.max(run.stats.maxMass, run.player.mass);
}

// ---------- 玩家输入 ----------
function updatePlayerInput(run, input, dt) {
  const p = run.player;
  if (!p.alive) return;
  if (input.steerX != null && input.steerY != null) {
    p.tx = clamp(input.steerX, WORLD.MARGIN, WORLD.WIDTH - WORLD.MARGIN);
    p.ty = clamp(input.steerY, WORLD.MARGIN, WORLD.HEIGHT - WORLD.MARGIN);
  }
  moveHole(run, p, dt, MOVE.LERP);
}

function moveHole(run, h, dt, lerp) {
  let speedMul = h.isPlayer
    ? run.mods.moveSpeedMul * MOVE.PLAYER_SPEED_MULT
    : (1 - (h.strength ?? 0.5) * MOVE.AI_SPEED_FALLOFF);
  if (!h.isPlayer && h.huntId != null && run.time < h.huntUntil) speedMul *= MOVE.HUNT_SPEED_BOOST;
  const speed = moveSpeedAt(h.r) * speedMul;
  const maxStep = speed * dt;
  let dx = h.tx - h.x;
  let dy = h.ty - h.y;
  const d = Math.hypot(dx, dy);
  if (d > 1) {
    const step = Math.min(maxStep, d * lerp * dt + maxStep * 0.2);
    h.x += (dx / d) * step;
    h.y += (dy / d) * step;
    if (h.isPlayer) {
      h.distAccum += step;
    }
  }
  h.x = clamp(h.x, WORLD.MARGIN, WORLD.WIDTH - WORLD.MARGIN);
  h.y = clamp(h.y, WORLD.MARGIN, WORLD.HEIGHT - WORLD.MARGIN);
  h.r = radiusAt(h.mass, h.maxR);
}

// ---------- AI ----------
function updateAI(run, dt) {
  for (const ai of run.ai) {
    if (!ai.alive) continue;
    ai.strength = run.match.aiStrength;
    const t = aiTarget(run, ai);
    ai.tx = t.x;
    ai.ty = t.y;
    moveHole(run, ai, dt, MOVE.AI_LERP);
  }
}

function aiTarget(run, ai) {
  // 1) 逃离更大的洞
  let flee = null;
  for (const h of allHoles(run)) {
    if (h.id === ai.id || !h.alive) continue;
    if (h.r > ai.r * HOLE.EAT_RATIO) {
      const d = Math.hypot(h.x - ai.x, h.y - ai.y);
      if (d < (h.r + ai.r) * 1.6) {
        const vx = (ai.x - h.x) / (d || 1);
        const vy = (ai.y - h.y) / (d || 1);
        flee = { x: clamp(ai.x + vx * 360, WORLD.MARGIN, WORLD.WIDTH - WORLD.MARGIN), y: clamp(ai.y + vy * 360, WORLD.MARGIN, WORLD.HEIGHT - WORLD.MARGIN) };
        break;
      }
    }
  }
  if (flee) return flee;

  // 2) 追猎明显更小的玩家：小洞是猎物，明显大得多的 AI 会主动清掉落单的小玩家。
  const p = run.player;
  if (p.alive && ai.r > p.r * HOLE.PLAYER_HUNT_RATIO) {
    const dp = Math.hypot(p.x - ai.x, p.y - ai.y);
    if (dp < ai.r * HOLE.PLAYER_HUNT_RANGE) {
      ai.huntId = p.id;
      ai.huntUntil = run.time + HOLE.PLAYER_HUNT_LOCK;
      return { x: p.x, y: p.y };
    }
  }

  // 3) 捕食更小的洞：锁定后持续追击几秒（捕食者行为）
  const holes = allHoles(run);
  if (ai.huntId != null && run.time < ai.huntUntil) {
    const prey = holes.find((h) => h.id === ai.huntId);
    if (prey && prey.alive && ai.r > prey.r * HOLE.EAT_RATIO) return { x: prey.x, y: prey.y };
    ai.huntId = null;
  }
  for (const h of holes) {
    if (h.id === ai.id || !h.alive) continue;
    if (ai.r > h.r * HOLE.EAT_RATIO) {
      const d = Math.hypot(h.x - ai.x, h.y - ai.y);
      if (d < ai.r * 3.2 && run.rng() < Math.min(1, 0.3 + ai.strength)) {
        ai.huntId = h.id;
        ai.huntUntil = run.time + 3.5;
        return { x: h.x, y: h.y };
      }
    }
  }

  // 3) 奔向最近高价值可吞物密集区
  return bestSwallowTarget(run, ai, ai.strength);
}

// 评分目标：奔向「可吞物密集区里最近的高价值物体」，只吞「比洞小」的物体。
// 街区集群布局提供密度差异；洞朝最近可吞物移动，自然在集群内连续扫街。
function bestSwallowTarget(run, h, strength) {
  const penalty = 1 - strength * 0.3;
  let best = { x: h.x + (run.rng() - 0.5) * 400, y: h.y + (run.rng() - 0.5) * 400 };
  let bestScore = Infinity; // 最近优先，value 做次级加权
  for (const o of run.objects) {
    if (o.state !== 'idle' && o.suckedBy !== h.id) continue;
    if (o.r >= h.r * 0.9) continue;
    const growth = o.kind === 'meteor' ? run.mods.meteorMult : 1;
    const d = Math.hypot(o.x - h.x, o.y - h.y);
    // 距离主导：扫街就近吃；同距离时优先高价值
    const score = d / (0.5 + o.mass * growth * penalty);
    if (score < bestScore) {
      bestScore = score;
      best = { x: o.x, y: o.y };
    }
  }
  return best;
}

function allHoles(run) {
  return [run.player, ...run.ai];
}

// ---------- 吸入 / 吞并 ----------
function updateSucking(run, dt) {
  const holes = allHoles(run).filter((h) => h.alive);

  for (const o of run.objects) {
    // 找到最近能吸它的洞
    let best = null;
    let bestD = Infinity;
    for (const h of holes) {
      if (o.r >= h.r) continue; // 只能吞比洞小的
      const chainMul = (h.isPlayer && run.chain.active) ? (1 + run.mods.chainBonusAdd) : 1;
      const outer = (h.r + o.r * SUCK.OUTER_K) * (h.isPlayer ? run.mods.suckRadiusMul : 1) * chainMul;
      const d = Math.hypot(o.x - h.x, o.y - h.y);
      if (d < outer && d < bestD) {
        bestD = d;
        best = h;
      }
    }

    if (best) {
      if (o.state !== 'sucked' || o.suckedBy !== best.id) {
        o.state = 'sucked';
        o.suckedBy = best.id;
        o.suckT = 0;
        o.spinAngle = Math.atan2(o.y - best.y, o.x - best.x);
        o.fromX = o.x;
        o.fromY = o.y;
      }
    } else if (o.state === 'sucked') {
      o.state = 'idle';
      o.suckedBy = null;
      o.suckT = 0;
    }
  }

  // 推进吸入
  for (const o of run.objects) {
    if (o.state !== 'sucked') continue;
    const h = holes.find((x) => x.id === o.suckedBy);
    if (!h || !h.alive) { o.state = 'idle'; o.suckedBy = null; o.suckT = 0; continue; }
    // 洞跑远则脱出
    const d = Math.hypot(o.x - h.x, o.y - h.y);
    const escape = (h.r + o.r) * 1.6;
    if (d > escape) { o.state = 'idle'; o.suckedBy = null; o.suckT = 0; continue; }

    o.suckT += dt;
    // 螺旋吸入
    o.spinAngle += SUCK.SPIN * dt;
    const pull = 1 - Math.min(1, o.suckT / (SUCK.TIME * run.mods.suckTimeMul));
    const radius = d * (0.2 + 0.8 * pull);
    o.x = h.x + Math.cos(o.spinAngle) * radius;
    o.y = h.y + Math.sin(o.spinAngle) * radius;

    const need = SUCK.TIME * run.mods.suckTimeMul;
    if (o.suckT >= need) {
      consume(run, h, o);
    }
  }

  run.objects = run.objects.filter((o) => !o.dead);
}

function consume(run, h, o) {
  o.dead = true;
  const mult = o.kind === 'meteor' ? run.mods.meteorMult : 1;
  const massGain = o.mass * mult;
  h.mass += massGain;
  h.r = radiusAt(h.mass, h.maxR);

  if (h.isPlayer) {
    run.stats.swallows += 1;
    run.stats.maxMass = Math.max(run.stats.maxMass, h.mass);
    if (o.kind === 'meteor') run.stats.meteorsEaten += 1;
    // 引力连锁
    trackChain(run, o);
  } else {
    // AI 也触发连锁？连锁是玩家能力，AI 不触发（spec：玩家区别点）
  }

  if (o.kind === 'building' || o.kind === 'skyscraper') {
    emit(run, 'building', { x: o.x, y: o.y, mass: massGain, kind: o.kind, hole: h.id });
  } else if (o.kind === 'meteor') {
    emit(run, 'meteorGain', { x: o.x, y: o.y, mass: massGain });
  } else {
    emit(run, 'swallow', { x: o.x, y: o.y, mass: massGain, kind: o.kind, hole: h.id });
  }
}

// ---------- 引力连锁（玩家专属） ----------
function trackChain(run, o) {
  const now = run.time;
  const d = Math.hypot(o.x - run.chain.lastX, o.y - run.chain.lastY);
  if (now - run.chain.lastAt <= CHAIN.WINDOW && d <= CHAIN.AREA && run.chain.lastAt > -Infinity) {
    run.chain.count += 1;
  } else {
    run.chain.count = 1;
  }
  run.chain.lastAt = now;
  run.chain.lastX = o.x;
  run.chain.lastY = o.y;

  if (run.chain.count > 1) emit(run, 'chainProgress', { count: run.chain.count, need: run.mods.chainCountReq });

  if (run.chain.count >= run.mods.chainCountReq) {
    run.chain.active = true;
    run.chain.until = now + CHAIN.DURATION + run.mods.chainDurationBonus;
    run.chain.count = 0;
    run.stats.chainTriggers += 1;
    emit(run, 'chain', { bonus: 1 + run.mods.chainBonusAdd });
  }
}

function updateChainTimeout(run) {
  if (run.chain.active && run.time > run.chain.until) {
    run.chain.active = false;
    emit(run, 'chainEnd', {});
  }
}

// ---------- 吞噬竞速（陨石雨） ----------
function updateMeteor(run) {
  const level = run.level;
  if (level < 6) return;
  if (run.time >= run.meteor.nextAt) {
    run.meteor.nextAt += METEOR.INTERVAL;
    run.meteor.active = true;
    run.meteor.until = run.time + 8; // 8s 内陨石碎片有效
    for (let i = 0; i < METEOR.COUNT; i += 1) {
      const x = WORLD.MARGIN + run.rng() * (WORLD.WIDTH - WORLD.MARGIN * 2);
      const y = WORLD.MARGIN + run.rng() * (WORLD.HEIGHT - WORLD.MARGIN * 2);
      spawnObject(run, 'meteor', x, y);
    }
    emit(run, 'meteorRain', { count: METEOR.COUNT });
  }
  if (run.meteor.active && run.time > run.meteor.until) {
    run.meteor.active = false;
  }
}

// ---------- 大洞吞小洞 ----------
function eliminateHoles(run) {
  const holes = allHoles(run);
  for (let i = 0; i < holes.length; i += 1) {
    const big = holes[i];
    if (!big.alive) continue;
    for (let j = 0; j < holes.length; j += 1) {
      if (i === j) continue;
      const small = holes[j];
      if (!small.alive) continue;
      if (big.r <= small.r * HOLE.EAT_RATIO) continue;
      const d = Math.hypot(big.x - small.x, big.y - small.y);
      if (d < big.r - small.r * 0.4) {
        swallowHole(run, big, small);
      }
    }
  }
}

function swallowHole(run, big, small) {
  const gain = small.mass * (run.mods.huntDouble ? 2 : 1);

  if (small.isPlayer) {
    // 玩家被吞：立即淘汰，本场结束（名次 6）
    run.stats.deaths += 1;
    small.alive = false;
    emit(run, 'death', { x: small.x, y: small.y, by: big.id });
    endMatch(run, 6);
  } else {
    // AI 被吞：保持在同一榜单里（mass 归零），big 获得其质量
    const massBefore = small.mass;
    small.alive = false;
    small.mass = 0;
    big.mass += massBefore * (run.mods.huntDouble && big.isPlayer ? 2 : 1);
    big.r = radiusAt(big.mass, big.maxR);
    if (big.isPlayer) {
      run.stats.kills += 1;
      emit(run, 'kill', { x: small.x, y: small.y, holeId: big.id, mass: massBefore });
    }
  }
}

// ---------- 物体生成 ----------
// 可吞物按「街区集群」生成（几个密集区 + 稀疏间隙），让「冲密集区」成为真正的决定。
const CLUSTER_COUNT = 5;
const CLUSTER_RADIUS = 130;

function makeClusters(run) {
  run.clusters = [];
  for (let i = 0; i < CLUSTER_COUNT; i += 1) {
    run.clusters.push({
      x: 120 + run.rng() * (WORLD.WIDTH - 240),
      y: 120 + run.rng() * (WORLD.HEIGHT - 240),
    });
  }
}

function clusterPos(run) {
  const c = run.clusters[Math.floor(run.rng() * run.clusters.length)];
  const a = run.rng() * Math.PI * 2;
  const r = run.rng() * CLUSTER_RADIUS;
  return {
    x: Math.max(WORLD.MARGIN, Math.min(WORLD.WIDTH - WORLD.MARGIN, c.x + Math.cos(a) * r)),
    y: Math.max(WORLD.MARGIN, Math.min(WORLD.HEIGHT - WORLD.MARGIN, c.y + Math.sin(a) * r)),
  };
}

function spawnObject(run, kind, x, y) {
  const spec = OBJECTS[kind];
  run.objects.push({
    id: run.nextId++,
    kind,
    x,
    y,
    r: spec.r,
    mass: spec.mass,
    state: 'idle',
    suckedBy: null,
    suckT: 0,
    spinAngle: 0,
    dead: false,
  });
}

function spawnObjects(run, count) {
  const kinds = unlockedKinds(run.level);
  for (let i = 0; i < count; i += 1) {
    const kind = pickKind(run.rng, kinds);
    const pos = clusterPos(run);
    spawnObject(run, kind, pos.x, pos.y);
  }
  emit(run, 'spawn', { kind: 'wave', count });
}

function spawnIfLow(run) {
  const target = run.match.density;
  if (run.objects.length < target) {
    const need = target - run.objects.length;
    const kinds = unlockedKinds(run.level);
    for (let i = 0; i < need; i += 1) {
      const kind = pickKind(run.rng, kinds);
      const pos = clusterPos(run);
      spawnObject(run, kind, pos.x, pos.y);
    }
  }
}

// ---------- 反馈密度（里程碑 / 名次 tick / nearMiss） ----------
function updateFeedback(run, dt) {
  const p = run.player;
  // 移动里程碑
  if (p.distAccum >= FEEDBACK.MOVE_STEP) {
    p.distAccum -= FEEDBACK.MOVE_STEP;
    emit(run, 'moveMilestone', { x: p.x, y: p.y });
  }
  // 每秒名次/得分 tick（可感知反馈，压缩事件最大间隔）
  run._rankTick += dt;
  if (run._rankTick >= FEEDBACK.RANK_TICK) {
    run._rankTick = 0;
    const rank = currentRank(run);
    if (rank !== run._lastRank) run._lastRank = rank;
    emit(run, 'rankTick', { rank, score: Math.floor(p.mass) });
  }
  // nearMiss：更大的洞贴近玩家（威胁）
  for (const a of run.ai) {
    if (!a.alive || a.r <= p.r * HOLE.EAT_RATIO) continue;
    const d = Math.hypot(a.x - p.x, a.y - p.y);
    if (d < (a.r + p.r) * 1.5 && run.time - (p._lastNearMissAt ?? -Infinity) > 2) {
      p._lastNearMissAt = run.time;
      emit(run, 'nearMiss', { x: p.x, y: p.y });
    }
  }
}

// ---------- 计时 / 结算 ----------
function updateTimer(run) {
  if (run.time >= run.match.duration) {
    endMatch(run);
  }
}

function currentRank(run) {
  let rank = 1;
  for (const a of run.ai) {
    if (a.alive && a.mass > run.player.mass) rank += 1;
  }
  return rank;
}

function endMatch(run, forceRank = null) {
  if (run.phase !== 'playing') return;
  run.phase = 'matchEnd';
  const rank = forceRank != null ? forceRank : currentRank(run);
  const qualified = rank <= MATCH.RANK_TO_ADVANCE;
  const score = Math.floor(run.player.mass);
  const newBest = rank < run.stats.bestRank;
  if (newBest) run.stats.bestRank = rank;
  if (qualified) run.stats.wins += 1;
  run.result = { rank, score, qualified, newBest, level: run.level, bestRank: run.stats.bestRank };
  emit(run, 'matchEnd', { rank, score, qualified, level: run.level });
}

function advance(run, upgradeId) {
  if (run.phase !== 'matchEnd') return;
  if (!run.result || !run.result.qualified) return;
  if (run.level >= MATCH_COUNT) {
    run.phase = 'campaignComplete';
    return;
  }
  // 应用升级
  const up = UPGRADES.find((u) => u.id === upgradeId) || UPGRADES[0];
  applyUpgrade(run, up);
  run.level += 1;
  run.match = matchAt(run.level);
  resetMatch(run);
  emit(run, 'upgrade', { id: up.id });
}

function retry(run) {
  if (run.phase !== 'matchEnd') return;
  resetMatch(run);
}

function resetMatch(run) {
  run.phase = 'playing';
  run.time = 0;
  run.result = null;
  run.chain = { count: 0, lastAt: -Infinity, lastX: 0, lastY: 0, active: false, until: -Infinity };
  run.meteor = { nextAt: METEOR.INTERVAL, active: false, until: -Infinity };
  run.objects = [];
  run._rankTick = 0;
  run._lastRank = 6;

  // 玩家回到中央、保留质量（或按 startMass 重置）
  const keepMass = run.player.mass;
  const p = run.player;
  p.alive = true;
  p.x = WORLD.WIDTH * 0.5;
  p.y = WORLD.HEIGHT * 0.5;
  p.tx = p.x;
  p.ty = p.y;
  p.invulnUntil = -Infinity;
  p.distAccum = 0;
  // 每场玩家保留 30% 质量起步（成长钩子）+ 英雄优势，AI 按场次强度重置
  p.mass = keepMass * 0.3 + run.mods.startMassBonus + HOLE.PLAYER_HEAD_START;
  p.r = radiusAt(p.mass, p.maxR);

  // 重建 AI
  run.ai = [];
  for (let i = 0; i < MATCH.AI_COUNT; i += 1) {
    const x = 80 + run.rng() * (WORLD.WIDTH - 160);
    const y = 80 + run.rng() * (WORLD.HEIGHT - 160);
    const aiMass = run.mods.startMassBonus + (run.level - 1) * 6 * run.match.aiStrength;
    const ai = makeHole(run.nextId++, x, y, aiMass, false, run.mods);
    ai.color = i;
    ai.strength = run.match.aiStrength;
    ai.hunter = run.match.newElement === 'hunter AI' ? i < 2 : false;
    run.ai.push(ai);
  }

  makeClusters(run);
  spawnObjects(run, run.match.density);
}

function applyUpgrade(run, up) {
  const m = run.mods;
  switch (up.id) {
    case 'gravity-radius': m.suckRadiusMul *= 1 + up.value; break;
    case 'devour-speed': m.suckTimeMul *= 1 + up.value; break;
    case 'chain-lower': m.chainCountReq += up.value; break;
    case 'chain-bonus': m.chainBonusAdd += up.value; break;
    case 'meteor-boost': m.meteorMult += up.value; break;
    case 'chain-duration': m.chainDurationBonus += up.value; break;
    case 'move-speed': m.moveSpeedMul *= 1 + up.value; break;
    case 'start-mass': m.startMassBonus += up.value; break;
    case 'max-radius': m.maxRadiusBonus += up.value; break;
    case 'hunt-double': m.huntDouble = true; break;
    default: break;
  }
}

// ---------- HUD / 事件 ----------
function getHud(run) {
  return {
    phase: run.phase,
    level: run.level,
    totalLevels: MATCH_COUNT,
    time: run.time,
    timeLeft: Math.max(0, run.match.duration - run.time),
    score: Math.floor(run.player.mass),
    rank: currentRank(run),
    chainCount: run.chain.count,
    chainNeed: run.mods.chainCountReq,
    chainActive: run.chain.active,
    meteorActive: run.meteor.active,
    scene: run.match.scene,
    mass: Math.floor(run.player.mass),
  };
}

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
