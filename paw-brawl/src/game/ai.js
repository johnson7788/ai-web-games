import { CONFIG } from '../../config/game.config.js';
import { MOVES } from '../../config/moves.js';

const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const normalize = (x, z) => {
  const length = Math.hypot(x, z);
  return length > 1 ? { x: x / length, z: z / length } : { x, z };
};

function makeRandom(seed) {
  let value = seed >>> 0;
  return () => {
    value += 0x6D2B79F5;
    let result = value;
    result = Math.imul(result ^ result >>> 15, result | 1);
    result ^= result + Math.imul(result ^ result >>> 7, result | 61);
    return ((result ^ result >>> 14) >>> 0) / 4294967296;
  };
}

const blankIntent = () => ({ mx: 0, mz: 0, jump: false, dash: false, punch: false, punchHeld: false, grab: false, charge: false });

export function createBrains({ fighters, characters, arena, seed = 1, difficulty = 'normal', allBots = false }) {
  const A = CONFIG.ai;
  const level = A.difficulties[difficulty] ?? A.difficulties.normal;
  const teamMode = new Set(fighters.map((fighter) => fighter.team)).size === 2;
  const teamPace = teamMode && difficulty === 'normal' ? 2.2 : 1;
  const random = makeRandom(seed);
  const characterMap = new Map(characters.map((character) => [character.id, character]));
  const memories = new Map();
  let time = 0;
  let maxPlayerTargets = 0;

  for (const fighter of fighters) {
    if (fighter.isPlayer && !allBots) continue;
    const index = Number(fighter.id.slice(1));
    memories.set(fighter.id, {
      id: fighter.id,
      index,
      targetId: null,
      targetT: 0,
      reactionT: level.reaction,
      intent: blankIntent(),
      pending: [],
      personality: ['brawler', 'trickster', 'grabber', 'balanced'][teamMode ? Math.floor(index / 2) % 4 : index % 4],
      decisionT: random() * A.decisionInterval,
      attackCd: random() * 0.3,
      grabCd: 0,
      retreatT: 0,
      stuckT: 0,
      stuckMoveT: 0,
      stuckDir: { x: 0, z: 0 },
      lastPos: { ...fighter.pos },
      strafeDir: index % 2 ? 1 : -1,
      chargeT: 0,
      struggleT: 0,
      aimError: 0,
    });
  }

  function targetCount(targetId, exceptId) {
    let count = 0;
    for (const memory of memories.values()) {
      if (memory.id !== exceptId && memory.targetId === targetId) count += 1;
    }
    return count;
  }

  function chooseTarget(memory, sim) {
    const fighter = sim.fighterMap.get(memory.id);
    const candidates = sim.alive
      .filter((target) => target.id !== fighter.id && target.team !== fighter.team)
      .sort((a, b) => Math.hypot(a.pos.x - fighter.pos.x, a.pos.z - fighter.pos.z) - Math.hypot(b.pos.x - fighter.pos.x, b.pos.z - fighter.pos.z) || a.id.localeCompare(b.id));
    const playerLimit = difficulty === 'normal' ? A.earlyPlayerTargetLimit : A.playerTargetLimit;
    const allowed = candidates.filter((target) => !target.isPlayer || (target.hitGraceT <= 0 && targetCount(target.id, memory.id) < playerLimit));
    const list = allowed.length ? allowed : candidates.filter((target) => !target.isPlayer);
    const pool = list;
    if (!pool.length) return null;
    const current = pool.findIndex((target) => target.id === memory.targetId);
    return pool[(current + 1 + pool.length) % pool.length]?.id ?? pool[0].id;
  }

  function decide(memory, sim) {
    const fighter = sim.fighterMap.get(memory.id);
    if (!memory.targetId || memory.targetT <= 0 || !sim.fighterMap.get(memory.targetId) || sim.fighterMap.get(memory.targetId).eliminated) {
      memory.targetId = chooseTarget(memory, sim);
      memory.targetT = A.targetRotation * (0.85 + random() * 0.3);
      memory.strafeDir *= random() < 0.35 ? -1 : 1;
    }
    let target = sim.fighterMap.get(memory.targetId);
    if (target?.isPlayer && target.hitGraceT > 0) {
      memory.targetId = chooseTarget(memory, sim);
      memory.targetT = A.targetRotation;
      target = sim.fighterMap.get(memory.targetId);
    }
    if (!target) return;
    const dx = target.pos.x - fighter.pos.x;
    const dz = target.pos.z - fighter.pos.z;
    const dist = Math.max(0.001, Math.hypot(dx, dz));
    const nx = dx / dist;
    const nz = dz / dist;
    const sideX = nz * memory.strafeDir;
    const sideZ = -nx * memory.strafeDir;
    let move;

    if (memory.stuckMoveT > 0) {
      move = memory.stuckDir;
    } else if (fighter.poise < A.retreatPoise && dist < A.retreatDistance) {
      memory.retreatT = A.retreatTime;
    }
    if (!move && memory.retreatT > 0) {
      move = normalize(-nx + sideX * 0.8, -nz + sideZ * 0.8);
    } else if (!move) {
      const desired = A.strafeMin + (A.strafeMax - A.strafeMin) * (0.5 + 0.5 * Math.sin(time * 0.8 + memory.index));
      const chaseRange = target.isPlayer && difficulty === 'normal' ? A.playerChaseRange * A.playerChaseScale : Infinity;
      const radialMove = dist > chaseRange ? 0 : dist > desired + 0.18 ? 1 : dist < desired - 0.18 ? -0.65 : 0;
      move = normalize(nx * radialMove + sideX * 0.55, nz * radialMove + sideZ * 0.55);
    }

    memory.aimError = (random() * 2 - 1) * level.aimError;
    const intent = { ...blankIntent(), mx: move.x, mz: move.z, facing: Math.atan2(nx, nz) + memory.aimError };
    const targetEdge = sim.distanceToEdge(target.pos);
    const targetBack = Math.abs(wrapAngle(Math.atan2(-dx, -dz) - target.facing)) > Math.PI * 0.55;
    const grabChance = level.grabChance * (memory.personality === 'grabber' ? 1.8 : memory.personality === 'trickster' ? 1.25 : 1);

    const nearbyItem = fighter.heldItem || memory.personality !== 'trickster' ? null : (sim.items ?? [])
      .filter((item) => item.type !== 'bomb' && item.state === 'grounded' && item.pickupT <= 0)
      .map((item) => ({ item, distance: Math.hypot(item.pos.x - fighter.pos.x, item.pos.z - fighter.pos.z) }))
      .filter((entry) => entry.distance < (memory.personality === 'trickster' ? 1.6 : 1.2))
      .sort((a, b) => a.distance - b.distance)[0];
    if (nearbyItem) {
      const { item, distance: itemDistance } = nearbyItem;
      const ix = item.pos.x - fighter.pos.x;
      const iz = item.pos.z - fighter.pos.z;
      intent.facing = Math.atan2(ix, iz);
      intent.mx = itemDistance > 0.8 ? ix / itemDistance : 0;
      intent.mz = itemDistance > 0.8 ? iz / itemDistance : 0;
      if (itemDistance <= 1) intent.grab = true;
      memory.reactionT = level.reaction * (0.85 + random() * 0.3);
      memory.pending.push({ due: time + memory.reactionT, intent });
      return;
    }

    const grabReach = A.grabDistance * (characterMap.get(fighter.charId).passive === 'tongue' ? CONFIG.combat.frogGrabRange : 1);
    const playerPace = target.isPlayer && difficulty === 'normal' ? 2.4 : 1;
    const heldMove = fighter.heldItem ? MOVES[fighter.heldItem.type] : null;
    if (fighter.heldItem && (fighter.heldItem.type === 'glove' || fighter.heldItem.type === 'star' || (heldMove && dist <= heldMove.range + target.radius))) {
      intent.punch = true;
      intent.punchHeld = true;
      memory.attackCd = 0.4 * teamPace * playerPace;
    } else if (!fighter.heldItem && !(target.isPlayer && difficulty === 'normal') && dist < grabReach && memory.grabCd <= 0 && (targetEdge < A.grabEdgeDistance || random() < grabChance / teamPace)) {
      intent.grab = true;
      memory.grabCd = 0.8 * teamPace;
    } else if (!fighter.heldItem && dist <= MOVES.punch1.range + A.attackBuffer + target.radius && memory.attackCd <= 0) {
      intent.punch = true;
      intent.punchHeld = true;
      const combo = !(target.isPlayer && difficulty === 'normal') && random() < level.comboChance * (memory.personality === 'brawler' ? 1.2 : 1) / (teamPace * playerPace);
      memory.attackCd = (combo ? 0.14 : 0.38 + random() * 0.18) * teamPace * playerPace;
      if (!(target.isPlayer && difficulty === 'normal') && (target.dizzyT > 0 || targetBack)) intent.chargeAfter = true;
    }

    memory.reactionT = level.reaction * (0.85 + random() * 0.3);
    memory.pending.push({ due: time + memory.reactionT, intent });
  }

  function applyPending(memory) {
    while (memory.pending.length && memory.pending[0].due <= time) {
      const next = memory.pending.shift().intent;
      const chargeAfter = next.chargeAfter;
      delete next.chargeAfter;
      Object.assign(memory.intent, next);
      if (chargeAfter) memory.chargeT = A.chargeHoldTime;
    }
  }

  function sweeperIntent(fighter, sim) {
    for (const sweeper of sim.arena.hazards ?? []) {
      if (sweeper.type !== 'sweeper') continue;
      const angle = sweeper.phase + (sim.time + 0.3) * sweeper.angularSpeed;
      const dx = Math.sin(angle);
      const dz = Math.cos(angle);
      const rx = fighter.pos.x - sweeper.x;
      const rz = fighter.pos.z - sweeper.z;
      const projection = Math.max(-sweeper.length * 0.5, Math.min(sweeper.length * 0.5, rx * dx + rz * dz));
      const closestX = sweeper.x + dx * projection;
      const closestZ = sweeper.z + dz * projection;
      let awayX = fighter.pos.x - closestX;
      let awayZ = fighter.pos.z - closestZ;
      const distance = Math.hypot(awayX, awayZ);
      if (distance > 1.45 || fighter.pos.y > 0.65) continue;
      if (distance < 0.05) {
        awayX = dz;
        awayZ = -dx;
      } else {
        awayX /= distance;
        awayZ /= distance;
      }
      return { ...blankIntent(), mx: awayX, mz: awayZ, facing: Math.atan2(awayX, awayZ), jump: fighter.onGround };
    }
    return null;
  }

  function safetyIntent(fighter, sim) {
    const edge = sim.distanceToEdge(fighter.pos);
    let inward = { x: -fighter.pos.x, z: -fighter.pos.z };
    if (sim.arena.shape === 'rect') {
      const xEdge = sim.arenaWidth * 0.5 - Math.abs(fighter.pos.x);
      const zEdge = sim.arenaDepth * 0.5 - Math.abs(fighter.pos.z);
      inward = xEdge < zEdge ? { x: -Math.sign(fighter.pos.x), z: 0 } : { x: 0, z: -Math.sign(fighter.pos.z) };
    }
    const length = Math.max(Math.hypot(inward.x, inward.z), 0.001);
    inward.x /= length;
    inward.z /= length;
    const outwardSpeed = -(fighter.vel.x * inward.x + fighter.vel.z * inward.z);
    const weight = characterMap.get(fighter.charId).weight;
    const edgeMargin = Math.max(A.minEdgeMargin, Math.min(A.maxEdgeMargin, level.edgeMargin + (1 - weight) * A.edgeWeightMargin));
    if (edge >= edgeMargin && !(edge < edgeMargin + 0.8 && outwardSpeed > 2.5)) return sweeperIntent(fighter, sim);
    return { ...blankIntent(), mx: inward.x, mz: inward.z, facing: Math.atan2(inward.x, inward.z) };
  }

  function update(dt, sim) {
    time += dt;
    let playerTargets = 0;
    for (const memory of memories.values()) {
      const fighter = sim.fighterMap.get(memory.id);
      if (!fighter || fighter.eliminated) {
        memory.intent = blankIntent();
        memory.pending.length = 0;
        continue;
      }
      memory.targetT -= dt;
      memory.decisionT -= dt;
      memory.attackCd = Math.max(0, memory.attackCd - dt);
      memory.grabCd = Math.max(0, memory.grabCd - dt);
      memory.retreatT = Math.max(0, memory.retreatT - dt);
      memory.stuckMoveT = Math.max(0, memory.stuckMoveT - dt);
      memory.intent.punch = false;
      memory.intent.grab = false;
      memory.intent.dash = false;
      memory.intent.jump = false;
      memory.intent.punchHeld = false;

      if (fighter.grabbedBy) {
        memory.struggleT -= dt;
        memory.intent = blankIntent();
        if (memory.struggleT <= 0) {
          memory.intent.punch = true;
          memory.struggleT = 0.12;
        }
        continue;
      }

      if (fighter.grabTarget) {
        let outward = { x: fighter.pos.x, z: fighter.pos.z };
        if (sim.arena.shape === 'rect') {
          const xEdge = sim.arenaWidth * 0.5 - Math.abs(fighter.pos.x);
          const zEdge = sim.arenaDepth * 0.5 - Math.abs(fighter.pos.z);
          outward = xEdge < zEdge ? { x: Math.sign(fighter.pos.x), z: 0 } : { x: 0, z: Math.sign(fighter.pos.z) };
        }
        const radial = Math.max(0.001, Math.hypot(outward.x, outward.z));
        memory.intent.mx = outward.x / radial;
        memory.intent.mz = outward.z / radial;
        memory.intent.facing = Math.atan2(outward.x, outward.z);
        if (sim.distanceToEdge(fighter.pos) < 1.15) memory.intent.punch = true;
        memory.pending.length = 0;
        continue;
      }

      const lockedTarget = sim.fighterMap.get(memory.targetId);
      if (lockedTarget?.isPlayer && lockedTarget.hitGraceT > 0) {
        memory.pending.length = 0;
        memory.intent = blankIntent();
        memory.targetId = null;
        memory.targetT = 0;
      }
      applyPending(memory);
      if (memory.decisionT <= 0) {
        memory.decisionT += A.decisionInterval;
        memory.stuckT += A.decisionInterval;
        const moved = Math.hypot(fighter.pos.x - memory.lastPos.x, fighter.pos.z - memory.lastPos.z);
        if (moved >= A.stuckDistance) {
          memory.stuckT = 0;
          memory.lastPos = { ...fighter.pos };
        } else if (memory.stuckT >= A.stuckTime) {
          const angle = random() * Math.PI * 2;
          memory.stuckDir = { x: Math.sin(angle), z: Math.cos(angle) };
          memory.stuckMoveT = A.stuckMoveTime;
          memory.stuckT = 0;
          memory.lastPos = { ...fighter.pos };
        }
        decide(memory, sim);
      }

      if (difficulty === 'normal' && sim.fighters[0].hitGraceT > 0) {
        memory.pending.length = 0;
        memory.intent.punch = false;
        memory.intent.punchHeld = false;
        memory.intent.grab = false;
        memory.chargeT = 0;
      }

      if (memory.chargeT > 0) {
        memory.chargeT -= dt;
        memory.intent.punchHeld = true;
        if (memory.chargeT <= 0) memory.intent.punchHeld = false;
      }

      const safety = safetyIntent(fighter, sim);
      if (safety) {
        const held = memory.chargeT > 0;
        memory.intent = { ...safety, punchHeld: held };
        const passive = characterMap.get(fighter.charId).passive;
        if (!fighter.onGround && fighter.vel.y < 0 && ((passive === 'doubleJump' && fighter.jumpsUsed === 1) || (passive === 'airControl' && fighter.airAdjusts > 0))) {
          memory.intent.jump = true;
        }
        memory.pending.length = 0;
      }
      if (memory.targetId && sim.fighterMap.get(memory.targetId)?.isPlayer) playerTargets += 1;
    }
    maxPlayerTargets = Math.max(maxPlayerTargets, playerTargets);
  }

  function intentOf(id) {
    return memories.get(id)?.intent ?? null;
  }

  function reset() {
    time = 0;
    maxPlayerTargets = 0;
    for (const memory of memories.values()) {
      memory.targetId = null;
      memory.targetT = 0;
      memory.intent = blankIntent();
      memory.pending.length = 0;
      memory.decisionT = random() * A.decisionInterval;
      memory.attackCd = random() * 0.3;
      memory.grabCd = 0;
      memory.retreatT = 0;
      memory.stuckT = 0;
      memory.stuckMoveT = 0;
      memory.chargeT = 0;
    }
  }

  return { update, intentOf, reset, memories, get maxPlayerTargets() { return maxPlayerTargets; } };
}
