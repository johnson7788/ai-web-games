import { CONFIG } from '../../config/game.config.js';
import { CHARACTER_MAP } from '../../config/characters.js';

const lerp = (a, b, t) => a + (b - a) * t;
const wrap = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const number = (value, fallback = 0) => Number.isFinite(value) ? value : fallback;
const fighterId = (playerId) => playerId?.startsWith('p') ? `f${playerId.slice(1)}` : playerId;

export function toViewFighter(raw = {}, localId = null, elapsed = 0, name = '') {
  const character = CHARACTER_MAP[raw.charId] ?? CHARACTER_MAP.shiba;
  const index = Number.parseInt(String(raw.id ?? 'f0').replace(/\D/g, ''), 10) || 0;
  return {
    ...raw,
    id: raw.id ?? 'f0',
    charId: character.id,
    team: number(raw.team),
    name: name || raw.name || character.name.en,
    isPlayer: raw.id === localId,
    pos: { x: number(raw.x ?? raw.pos?.x), y: number(raw.y ?? raw.pos?.y), z: number(raw.z ?? raw.pos?.z) },
    vel: { x: number(raw.vel?.x), y: number(raw.vel?.y), z: number(raw.vel?.z) },
    facing: number(raw.facing),
    state: raw.state ?? 'idle',
    onGround: raw.onGround ?? true,
    radius: number(raw.radius, CONFIG.physics.fighterRadius),
    height: number(raw.height, CONFIG.physics.fighterHeight),
    poise: number(raw.poise, CONFIG.combat.poise),
    kos: number(raw.kos),
    rank: number(raw.rank),
    anim: {
      walk: number(raw.anim?.walk),
      walkPhase: number(raw.anim?.walkPhase),
      lean: number(raw.anim?.lean),
      punch: number(raw.anim?.punch),
      grab: number(raw.anim?.grab),
      charge: number(raw.anim?.charge),
      tumble: number(raw.anim?.tumble),
      knockLift: number(raw.anim?.knockLift),
      knockLandT: number(raw.anim?.knockLandT),
      breathe: elapsed + index * 0.37,
      blink: (elapsed + index * 0.7) % 3.4 < 0.12 ? 1 : 0,
    },
    attack: raw.attack ?? null,
    heldItem: raw.heldItem ? { type: raw.heldItem.type ?? raw.heldItem, uses: number(raw.heldItem.uses ?? raw.itemUses, 1) } : null,
    dizzyT: number(raw.dizzyT),
    staggerT: number(raw.staggerT),
    tumbleT: number(raw.tumbleT),
    getUpT: number(raw.getUpT),
    hitFlashT: number(raw.hitFlashT),
    landT: number(raw.landT),
    invulnT: number(raw.invulnT),
    starT: number(raw.starT),
    gloveT: number(raw.gloveT),
    grabbedBy: raw.grabbedBy ?? null,
    grabTarget: raw.grabTarget ?? null,
    eliminated: Boolean(raw.eliminated),
  };
}

export function interpolateSnapshot(from, to, alpha, playerId, elapsed = 0, roster = new Map()) {
  const localId = fighterId(playerId);
  const right = new Map((to?.fighters ?? []).map((fighter) => [fighter.id, fighter]));
  const fighters = (from?.fighters ?? to?.fighters ?? []).map((left) => {
    const other = right.get(left.id) ?? left;
    const meta = roster.get(left.id);
    const view = toViewFighter(alpha < 0.5 ? left : other, localId, elapsed, meta?.name);
    view.pos = {
      x: lerp(number(left.x), number(other.x), alpha),
      y: lerp(number(left.y), number(other.y), alpha),
      z: lerp(number(left.z), number(other.z), alpha),
    };
    view.facing = number(left.facing) + wrap(number(other.facing) - number(left.facing)) * alpha;
    for (const key of ['walk', 'walkPhase', 'lean', 'punch', 'grab', 'charge', 'tumble']) {
      view.anim[key] = lerp(number(left.anim?.[key]), number(other.anim?.[key]), alpha);
    }
    for (const key of ['dizzyT', 'staggerT', 'tumbleT', 'hitFlashT', 'landT']) {
      view[key] = lerp(number(left[key]), number(other[key]), alpha);
    }
    return view;
  });
  const rightItems = new Map((to?.items ?? []).map((item) => [item.id, item]));
  const items = (from?.items ?? to?.items ?? []).map((left) => {
    const other = rightItems.get(left.id) ?? left;
    return {
      ...left,
      pos: {
        x: lerp(number(left.x), number(other.x), alpha),
        y: lerp(number(left.y), number(other.y), alpha),
        z: lerp(number(left.z), number(other.z), alpha),
      },
    };
  });
  return { ...(to ?? from), fighters, items };
}

function authoritativeState(fighter) {
  return fighter.eliminated || fighter.state === 'falling' || fighter.tumbleT > 0 ||
    fighter.dizzyT > 0 || fighter.staggerT > 0 || Boolean(fighter.grabbedBy);
}

function edgeInfo(pos, arena) {
  if (arena.shape === 'rect') {
    const xEdge = arena.width * 0.5 - Math.abs(pos.x);
    const zEdge = arena.depth * 0.5 - Math.abs(pos.z);
    return xEdge < zEdge
      ? { distance: xEdge, normal: { x: Math.sign(pos.x) || 1, z: 0 } }
      : { distance: zEdge, normal: { x: 0, z: Math.sign(pos.z) || 1 } };
  }
  const radial = Math.max(Math.hypot(pos.x, pos.z), 1e-8);
  return { distance: arena.radius - radial, normal: { x: pos.x / radial, z: pos.z / radial } };
}

function predict(prediction, fighter, intent, dt, arena) {
  const P = CONFIG.physics;
  const character = CHARACTER_MAP[fighter.charId] ?? CHARACTER_MAP.shiba;
  const pos = prediction.pos;
  const vel = prediction.vel;
  prediction.dashT = Math.max(0, prediction.dashT - dt);
  prediction.dashCd = Math.max(0, prediction.dashCd - dt);
  let mx = number(intent.mx);
  let mz = number(intent.mz);
  const magnitude = Math.hypot(mx, mz);
  if (magnitude > 1) { mx /= magnitude; mz /= magnitude; }

  if (intent.dash && prediction.dashCd <= 0) {
    const length = Math.hypot(mx, mz);
    prediction.dashDir = length > 0.01 ? { x: mx / length, z: mz / length } : { x: Math.sin(fighter.facing), z: Math.cos(fighter.facing) };
    prediction.dashT = P.dashDuration;
    prediction.dashCd = P.dashCooldown;
  }
  if (intent.jump && prediction.onGround) {
    prediction.onGround = false;
    vel.y = P.jumpVelocity * character.jump;
  }

  if (prediction.dashT > 0) {
    vel.x = prediction.dashDir.x * P.dashSpeed;
    vel.z = prediction.dashDir.z * P.dashSpeed;
  } else {
    const speed = P.maxSpeed * character.speed;
    const rate = (magnitude > 0.01 ? P.acceleration : P.deceleration) * (prediction.onGround ? 1 : P.airControl);
    const blend = Math.min(1, rate * dt / Math.max(speed, 0.01));
    vel.x += (mx * speed - vel.x) * blend;
    vel.z += (mz * speed - vel.z) * blend;
  }
  if (!prediction.onGround) vel.y += P.gravity * dt;
  pos.x += vel.x * dt;
  pos.y += vel.y * dt;
  pos.z += vel.z * dt;

  const edge = edgeInfo(pos, arena);
  if (edge.distance < P.edgeMargin) {
    prediction.onGround = false;
    vel.x += edge.normal.x * P.edgeSlideAcceleration * dt;
    vel.z += edge.normal.z * P.edgeSlideAcceleration * dt;
    if (pos.y <= 0) vel.y = Math.min(vel.y, -P.edgeDropSpeed);
  } else if (pos.y <= 0 && vel.y <= 0) {
    pos.y = 0;
    vel.y = 0;
    prediction.onGround = true;
  }
  if (magnitude > 0.05) prediction.facing = Math.atan2(mx, mz);
  const groundSpeed = Math.hypot(vel.x, vel.z);
  prediction.walk += ((groundSpeed > P.runStateThreshold ? Math.min(1, groundSpeed / P.maxSpeed) : 0) - prediction.walk) * Math.min(1, dt * 12);
  prediction.walkPhase += groundSpeed * P.walkCycleSpeed * dt;
}

export function createOnlineView(playerId) {
  let prediction = null;
  let round = null;
  const previousPositions = new Map();

  function reconcile(snapshot) {
    const raw = snapshot?.fighters?.find((fighter) => fighter.id === fighterId(playerId));
    if (!raw) return;
    const server = toViewFighter(raw, fighterId(playerId));
    const reset = !prediction || round !== snapshot.round || authoritativeState(server);
    if (reset) {
      prediction = {
        pos: { ...server.pos }, vel: { ...server.vel }, facing: server.facing,
        onGround: server.onGround, walk: server.anim.walk, walkPhase: server.anim.walkPhase,
        dashT: 0, dashCd: 0, dashDir: { x: 0, z: 1 },
      };
    } else {
      const error = Math.hypot(server.pos.x - prediction.pos.x, server.pos.y - prediction.pos.y, server.pos.z - prediction.pos.z);
      if (error > 0.6) {
        prediction.pos = { ...server.pos };
        prediction.vel = { ...server.vel };
        prediction.onGround = server.onGround;
      } else {
        prediction.pos.x += (server.pos.x - prediction.pos.x) * 0.08;
        prediction.pos.y += (server.pos.y - prediction.pos.y) * 0.08;
        prediction.pos.z += (server.pos.z - prediction.pos.z) * 0.08;
      }
    }
    round = snapshot.round;
  }

  function sample({ buffer, now, dt, intent = {}, arena, phase, elapsed, roster = new Map() }) {
    const frame = buffer.sample(now);
    if (!frame) return null;
    const result = interpolateSnapshot(frame.from, frame.to, frame.alpha, playerId, elapsed, roster);
    for (const fighter of result.fighters) {
      const previous = previousPositions.get(fighter.id);
      if (previous && dt > 0) {
        fighter.vel = {
          x: (fighter.pos.x - previous.x) / dt,
          y: (fighter.pos.y - previous.y) / dt,
          z: (fighter.pos.z - previous.z) / dt,
        };
      }
      if (fighter.isPlayer && prediction && !authoritativeState(fighter)) {
        if (phase === 'fight' && dt > 0) predict(prediction, fighter, intent, dt, arena);
        fighter.pos = { ...prediction.pos };
        fighter.vel = { ...prediction.vel };
        fighter.onGround = prediction.onGround;
        fighter.facing = prediction.facing;
        fighter.anim.walk = prediction.walk;
        fighter.anim.walkPhase = prediction.walkPhase;
        if (fighter.state === 'idle' || fighter.state === 'run') {
          fighter.state = Math.hypot(fighter.vel.x, fighter.vel.z) > CONFIG.physics.runStateThreshold ? 'run' : 'idle';
        }
      }
      previousPositions.set(fighter.id, { ...fighter.pos });
    }
    result.phase = phase ?? result.phase;
    return result;
  }

  function reset() {
    prediction = null;
    round = null;
    previousPositions.clear();
  }

  return { reconcile, sample, reset };
}
