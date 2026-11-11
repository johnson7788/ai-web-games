import { CONFIG, STEP } from '../../config/game.config.js';
import { MOVES } from '../../config/moves.js';
import { ITEMS, ITEM_RULES } from '../../config/items.js';

const EMPTY_INTENT = Object.freeze({ mx: 0, mz: 0, jump: false, dash: false, punch: false, grab: false, charge: false });
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const approach = (value, target, delta) => value < target ? Math.min(value + delta, target) : Math.max(value - delta, target);
const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));
const distance = (a, b) => Math.hypot(b.pos.x - a.pos.x, b.pos.z - a.pos.z);

export function distanceToEdge(pos, arena, bounds = arena) {
  if (arena.shape === 'rect') {
    return Math.min(bounds.width * 0.5 - Math.abs(pos.x), bounds.depth * 0.5 - Math.abs(pos.z));
  }
  return bounds.radius - Math.hypot(pos.x, pos.z);
}

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

function normalizedInput(intent) {
  const length = Math.hypot(intent.mx ?? 0, intent.mz ?? 0);
  return length > 1 ? { x: intent.mx / length, z: intent.mz / length } : { x: intent.mx ?? 0, z: intent.mz ?? 0 };
}

export function createSim({ arena, characters, playerCharId = 'shiba', bots = 7, seed = 1, eliminateOnFall, teams = 0, playerKnockScale = 1 }) {
  if (!arena?.spawns?.length) throw new Error('arena.spawns is required');
  if (!characters?.length) throw new Error('characters is required');
  const P = CONFIG.physics;
  const C = CONFIG.combat;
  const M = CONFIG.match;
  const random = makeRandom(seed);
  const itemRandom = makeRandom(seed ^ 0x9E3779B9);
  const byId = new Map(characters.map((character) => [character.id, character]));
  const player = byId.get(playerCharId) ?? characters[0];
  const requested = Array.isArray(bots) ? bots : Array.from({ length: bots }, () => null);
  const alternatives = characters.filter((character) => character.id !== player.id);
  const roster = [player, ...requested.map((id, index) => byId.get(id) ?? alternatives[index % alternatives.length] ?? player)];
  const practiceRespawn = eliminateOnFall === undefined ? roster.length === 1 : !eliminateOnFall;
  let time = 0;
  let arenaRadius = arena.shape === 'rect' ? arena.depth * 0.5 : arena.radius;
  let arenaWidth = arena.width ?? arena.radius * 2;
  let arenaDepth = arena.depth ?? arena.radius * 2;
  let roundEnded = false;
  let finalTwoSent = false;
  let nextItemDropT = ITEM_RULES.firstDrop;
  let nextItemId = 1;
  let nextBombId = 1;
  let starSpawned = false;
  const events = [];
  const eliminationOrder = [];
  const items = [];
  const bombs = [];
  const fighterMap = new Map();
  const hazardCooldowns = new Map();
  const sweepers = (arena.hazards ?? []).filter((hazard) => hazard.type === 'sweeper');
  const conveyors = (arena.hazards ?? []).filter((hazard) => hazard.type === 'conveyor');
  const hazardAttackers = sweepers.map((hazard, index) => ({
    id: `sweeper${index}`, charId: player.id, team: -1,
    pos: { x: hazard.x, y: 0, z: hazard.z }, facing: 0,
  }));

  function makeFighter(character, index) {
    const spawn = arena.spawns[index % arena.spawns.length];
    return {
      id: `f${index}`,
      charId: character.id,
      team: teams === 2 ? index % 2 : index,
      isPlayer: index === 0,
      pos: { x: spawn.x, y: spawn.y ?? 0, z: spawn.z },
      vel: { x: 0, y: 0, z: 0 },
      facing: spawn.facing ?? 0,
      state: 'idle',
      stateT: 0,
      onGround: true,
      radius: P.fighterRadius,
      height: P.fighterHeight,
      anim: { walk: 0, breathe: 0, blink: 0, lean: 0, walkPhase: 0, punch: 0, grab: 0, charge: 0, tumble: 0, knockLift: 0, knockLiftVelocity: 0, knockLandT: 0 },
      dashCd: 0,
      dashT: 0,
      dashDir: { x: 0, z: 1 },
      respawnT: 0,
      landT: 0,
      action: null,
      actionT: 0,
      attack: null,
      poise: C.poise,
      poiseTimer: C.poiseDelay,
      dizzyT: 0,
      staggerT: 0,
      tumbleT: 0,
      getUpT: 0,
      grabTarget: null,
      grabbedBy: null,
      grabHoldT: 0,
      struggle: 0,
      heldItem: null,
      gloveT: 0,
      starT: 0,
      koBy: null,
      rank: 0,
      eliminated: false,
      invulnT: 0,
      lastHitBy: null,
      kos: 0,
      combo: 0,
      comboWindow: 0,
      queuedPunch: false,
      queuedCharged: false,
      charging: false,
      chargeT: 0,
      prevPunchHeld: false,
      projectileT: 0,
      projectileBy: null,
      hitFlashT: 0,
      hitGraceT: 0,
      jumpsUsed: 0,
      airAdjusts: character.passive === 'airControl' ? 1 : 0,
      blinkT: P.blinkMin + random() * (P.blinkMax - P.blinkMin),
      blinkLeft: 0,
      spawn: { ...spawn },
    };
  }

  const fighters = roster.map(makeFighter);
  for (const fighter of fighters) fighterMap.set(fighter.id, fighter);

  function currentBounds() {
    return arena.shape === 'rect'
      ? { width: arenaWidth, depth: arenaDepth }
      : { radius: arenaRadius };
  }

  function edgeDistance(pos) {
    return distanceToEdge(pos, arena, currentBounds());
  }

  function outwardNormal(pos) {
    if (arena.shape === 'rect') {
      const xEdge = arenaWidth * 0.5 - Math.abs(pos.x);
      const zEdge = arenaDepth * 0.5 - Math.abs(pos.z);
      return xEdge < zEdge ? { x: Math.sign(pos.x) || 1, z: 0 } : { x: 0, z: Math.sign(pos.z) || 1 };
    }
    const radial = Math.max(Math.hypot(pos.x, pos.z), 1e-8);
    return { x: pos.x / radial, z: pos.z / radial };
  }

  function emit(event) {
    events.push(event);
  }

  function setState(fighter, state, dt) {
    if (fighter.state !== state) {
      fighter.state = state;
      fighter.stateT = 0;
    } else {
      fighter.stateT += dt;
    }
  }

  function clearCharge(fighter) {
    fighter.charging = false;
    fighter.chargeT = 0;
    fighter.queuedCharged = false;
    fighter.queuedPunch = false;
  }

  function releaseGrab(holder, target, invuln = 0) {
    if (!holder || !target) return;
    if (holder.grabTarget === target.id) holder.grabTarget = null;
    if (target.grabbedBy === holder.id) target.grabbedBy = null;
    target.grabHoldT = 0;
    target.struggle = 0;
    target.invulnT = Math.max(target.invulnT, invuln);
    if (holder.attack?.move === 'throw') holder.attack = null;
  }

  function breakGrab(fighter) {
    if (fighter.grabTarget) releaseGrab(fighter, fighterMap.get(fighter.grabTarget));
    if (fighter.grabbedBy) releaseGrab(fighterMap.get(fighter.grabbedBy), fighter);
  }

  function addItem(type, { x = 0, z = 0, y = 0 } = {}, uses = ITEMS[type]?.uses ?? 1, reserveStar = true) {
    const definition = ITEMS[type];
    if (!definition) throw new RangeError(`unknown item type: ${type}`);
    if (items.length >= ITEM_RULES.maxItems || (reserveStar && type === 'star' && starSpawned)) return null;
    if (reserveStar && type === 'star') starSpawned = true;
    const grounded = y <= 0;
    const item = {
      id: `item${nextItemId++}`,
      type,
      uses,
      pos: { x, y: Math.max(0, y), z },
      velY: 0,
      state: grounded ? 'grounded' : 'falling',
      pickupT: grounded ? 0 : ITEM_RULES.pickupDelay,
    };
    items.push(item);
    emit({
      type: 'itemSpawn', itemId: item.id, itemType: type, uses,
      x: item.pos.x, y: item.pos.y, z: item.pos.z,
    });
    return item;
  }

  function spawnItem(type, position = {}) {
    return addItem(type, position);
  }

  function dropHeldItem(fighter) {
    const held = fighter.heldItem;
    if (!held) return null;
    fighter.heldItem = null;
    return addItem(held.type, { x: fighter.pos.x, z: fighter.pos.z, y: 0 }, held.uses, false);
  }

  function tryPickup(fighter) {
    if (fighter.heldItem) return false;
    const available = items
      .filter((item) => item.state === 'grounded' && item.pickupT <= 0 &&
        Math.abs(item.pos.y - fighter.pos.y) <= 1.4 && distance(fighter, item) <= ITEM_RULES.pickupRadius)
      .sort((a, b) => distance(fighter, a) - distance(fighter, b) || a.id.localeCompare(b.id));
    const item = available[0];
    if (!item) return false;
    items.splice(items.indexOf(item), 1);
    fighter.heldItem = { type: item.type, uses: item.uses };
    emit({
      type: 'itemPickup', id: fighter.id, itemId: item.id, itemType: item.type, uses: item.uses,
      x: item.pos.x, y: item.pos.y, z: item.pos.z,
    });
    return true;
  }

  function throwBomb(fighter) {
    const definition = ITEMS.bomb;
    const facing = fighter.facing;
    const bomb = {
      id: `bomb${nextBombId++}`,
      owner: fighter.id,
      pos: {
        x: fighter.pos.x + Math.sin(facing) * 0.6,
        y: fighter.pos.y + 1,
        z: fighter.pos.z + Math.cos(facing) * 0.6,
      },
      vel: {
        x: Math.sin(facing) * definition.throwSpeed,
        y: definition.throwLift,
        z: Math.cos(facing) * definition.throwSpeed,
      },
      age: 0,
    };
    bombs.push(bomb);
    return bomb;
  }

  function useHeldItem(fighter) {
    const held = fighter.heldItem;
    if (!held || fighter.attack) return false;
    const definition = ITEMS[held.type];
    if (held.type === 'fish' || held.type === 'hammer') {
      if (!fighter.onGround) return false;
      startAttack(fighter, definition.move);
    } else if (held.type === 'bomb') {
      if (bombs.length >= ITEM_RULES.maxFlyingBombs) return false;
      throwBomb(fighter);
    } else if (held.type === 'glove') {
      fighter.gloveT = definition.duration;
    } else if (held.type === 'star') {
      fighter.starT = definition.duration;
      fighter.invulnT = Math.max(fighter.invulnT, definition.duration);
    } else {
      return false;
    }
    clearCharge(fighter);
    held.uses -= 1;
    emit({ type: 'itemUse', id: fighter.id, itemType: held.type, uses: held.uses });
    if (held.uses <= 0) fighter.heldItem = null;
    return true;
  }

  function randomItemType() {
    const eligible = Object.entries(ITEMS).filter(([type]) => type !== 'star' || !starSpawned);
    const total = eligible.reduce((sum, [, definition]) => sum + definition.weight, 0);
    let roll = itemRandom() * total;
    for (const [type, definition] of eligible) {
      roll -= definition.weight;
      if (roll < 0) return type;
    }
    return eligible.at(-1)[0];
  }

  function updateItems(dt) {
    while (time + 1e-9 >= nextItemDropT) {
      const count = Math.min(ITEM_RULES.dropCount, ITEM_RULES.maxItems - items.length);
      for (let index = 0; index < count; index++) {
        const type = randomItemType();
        const angle = itemRandom() * Math.PI * 2;
        const radius = ITEM_RULES.minDropRadius + itemRandom() * (ITEM_RULES.maxDropRadius - ITEM_RULES.minDropRadius);
        addItem(type, {
          x: Math.sin(angle) * radius,
          z: Math.cos(angle) * radius,
          y: ITEM_RULES.spawnY,
        });
      }
      nextItemDropT += ITEM_RULES.dropInterval;
    }
    for (const item of items) {
      if (item.state === 'falling') {
        item.velY += P.gravity * dt;
        item.pos.y += item.velY * dt;
        if (item.pos.y <= 0) {
          item.pos.y = 0;
          item.velY = 0;
          item.state = 'grounded';
          item.pickupT = ITEM_RULES.pickupDelay;
        }
      } else {
        item.pickupT = Math.max(0, item.pickupT - dt);
      }
    }
  }

  function explodeBomb(bomb) {
    const attacker = fighterMap.get(bomb.owner);
    const move = MOVES.bomb;
    emit({
      type: 'explosion', id: bomb.id, attacker: bomb.owner,
      x: bomb.pos.x, y: bomb.pos.y, z: bomb.pos.z, range: move.range,
    });
    if (!attacker) return;
    for (const target of fighters) {
      if (target.eliminated || distance({ pos: bomb.pos }, target) > move.range) continue;
      const scale = target === attacker ? ITEMS.bomb.selfScale : 1;
      applyHit(attacker, target, 'bomb', {
        origin: bomb.pos,
        knock: move.knock * scale,
        poise: move.poise * scale,
      });
    }
  }

  function updateBombs(dt) {
    for (let index = bombs.length - 1; index >= 0; index--) {
      const bomb = bombs[index];
      bomb.age += dt;
      bomb.vel.y += ITEMS.bomb.gravity * dt;
      bomb.pos.x += bomb.vel.x * dt;
      bomb.pos.y += bomb.vel.y * dt;
      bomb.pos.z += bomb.vel.z * dt;
      if (bomb.age + 1e-9 < ITEMS.bomb.fuse && bomb.pos.y > 0) continue;
      bomb.pos.y = Math.max(0, bomb.pos.y);
      bombs.splice(index, 1);
      explodeBomb(bomb);
    }
  }

  function startAttack(fighter, moveName) {
    const move = MOVES[moveName];
    fighter.attack = { move: moveName, phase: 'startup', t: 0, hasHit: new Set(), facing: fighter.facing, lungeLeft: move.lunge ?? 0 };
    fighter.action = moveName;
    fighter.actionT = move.startup + (move.active ?? 0) + move.recovery;
    fighter.queuedPunch = false;
    emit({ type: 'attack', id: fighter.id, move: moveName, sfx: move.sfx, shake: move.shake ?? 0 });
  }

  function startOrQueuePunch(fighter) {
    if (fighter.attack) {
      if (MOVES[fighter.attack.move]?.next) fighter.queuedPunch = true;
      return;
    }
    const chained = fighter.comboWindow > 0 && fighter.combo > 0 && fighter.combo < 3;
    const move = chained ? `punch${fighter.combo + 1}` : 'punch1';
    fighter.combo = chained ? fighter.combo + 1 : 1;
    fighter.comboWindow = 0;
    startAttack(fighter, move);
  }

  function canOperate(fighter) {
    return !fighter.eliminated && !fighter.grabbedBy && fighter.dizzyT <= 0 && fighter.staggerT <= 0 && fighter.getUpT <= 0;
  }

  function targetInArc(attacker, target, range, arc, facing = attacker.facing) {
    const dx = target.pos.x - attacker.pos.x;
    const dz = target.pos.z - attacker.pos.z;
    const angle = Math.abs(wrapAngle(Math.atan2(dx, dz) - facing));
    return Math.hypot(dx, dz) <= range + target.radius && angle <= arc * Math.PI / 360;
  }

  function applyPoise(attacker, target, amount) {
    if (target.dizzyT <= 0) {
      target.poise -= amount;
      if (target.poise <= 0) {
        const character = byId.get(target.charId);
        target.dizzyT = C.dizzyTime * (character.passive === 'steady' ? C.bearDizzyScale : 1);
        target.poise = C.poise;
        target.poiseTimer = 0;
        emit({ type: 'dizzy', id: target.id, attacker: attacker?.id ?? null, x: target.pos.x, y: target.pos.y, z: target.pos.z });
      }
    }
  }

  function applyHit(attacker, target, moveName, options = {}) {
    const move = MOVES[moveName];
    if (!move || target.eliminated || target.invulnT > 0) return false;
    if (attacker !== target && attacker.team === target.team) return false;
    const wasDizzy = target.dizzyT > 0;
    breakGrab(target);
    target.attack = null;
    target.action = null;
    clearCharge(target);
    target.staggerT = Math.max(target.staggerT, options.stagger ?? C.staggerTime);
    target.lastHitBy = attacker.id;
    if (target.isPlayer) target.hitGraceT = CONFIG.ai.playerHitGrace;
    target.poiseTimer = 0;
    applyPoise(attacker, target, options.poise ?? move.poise ?? 0);

    let dx = options.direction?.x ?? target.pos.x - (options.origin?.x ?? attacker.pos.x);
    let dz = options.direction?.z ?? target.pos.z - (options.origin?.z ?? attacker.pos.z);
    let length = Math.hypot(dx, dz);
    if (length < 1e-8) {
      dx = Math.sin(attacker.attack?.facing ?? attacker.facing);
      dz = Math.cos(attacker.attack?.facing ?? attacker.facing);
      length = 1;
    }
    const nx = dx / length;
    const nz = dz / length;
    const attackerCharacter = byId.get(attacker.charId);
    const targetCharacter = byId.get(target.charId);
    let multiplier = attackerCharacter.power / (0.55 + targetCharacter.weight * 0.55);
    multiplier *= 1 - (targetCharacter.passive === 'heavy' ? C.pandaKnockResist : 0);
    multiplier *= wasDizzy ? C.dizzyKnockMul : 1;
    let knock = options.knock ?? move.knock;
    const normalPunch = moveName === 'punch1' || moveName === 'punch2' || moveName === 'punch3';
    if (normalPunch && attacker.gloveT > 0) knock *= ITEMS.glove.knockMultiplier;
    if (normalPunch && attacker.starT > 0) knock *= ITEMS.star.knockMultiplier;
    const velocity = knock * multiplier * (target.isPlayer && attacker !== target ? playerKnockScale : 1);
    const visualKnock = velocity * CONFIG.animation.knockVisualScale;
    target.vel.x += nx * visualKnock * 1.6;
    target.vel.z += nz * visualKnock * 1.6;
    const lift = Math.max(1.2, velocity * (moveName === 'slam' ? 0.6 : 0.42));
    const visualLift = Math.max(lift * CONFIG.animation.knockVerticalScale, velocity >= C.tumbleThreshold ? CONFIG.animation.tumbleMinLift : 0);
    target.vel.y += lift;
    target.anim.knockLift = Math.max(target.pos.y, target.anim.knockLift);
    target.anim.knockLiftVelocity = Math.max(target.anim.knockLiftVelocity, visualLift);
    target.anim.knockLandT = 0;
    target.onGround = false;
    if (velocity >= C.tumbleThreshold) target.tumbleT = C.tumbleTime;
    if (target.isPlayer && target.tumbleT > 0) target.invulnT = Math.max(target.invulnT, 0.6);
    if (target.dizzyT > 0 || target.tumbleT > 0) dropHeldItem(target);
    target.projectileT = 0;
    target.projectileBy = null;
    target.hitFlashT = CONFIG.animation.hitFlashTime;
    const heavy = knock >= 12 || moveName === 'slam';
    emit({
      type: 'hit', attacker: attacker.id, target: target.id, move: moveName,
      x: target.pos.x, y: target.pos.y + target.height * 0.55, z: target.pos.z, heavy,
      dx: nx, dz: nz,
      hitstop: heavy ? C.hitstopHeavy : C.hitstopLight,
    });
    return true;
  }

  function resolveGrab(attacker) {
    const character = byId.get(attacker.charId);
    const range = MOVES.grab.range * (character.passive === 'tongue' ? C.frogGrabRange : 1);
    const targets = fighters
      .filter((target) => target !== attacker && target.team !== attacker.team && !target.eliminated && !target.grabbedBy && target.invulnT <= 0 && targetInArc(attacker, target, range, MOVES.grab.arc, attacker.attack.facing))
      .sort((a, b) => distance(attacker, a) - distance(attacker, b) || a.id.localeCompare(b.id));
    const target = targets[0];
    if (!target) return;
    attacker.grabTarget = target.id;
    target.grabbedBy = attacker.id;
    target.vel = { x: 0, y: 0, z: 0 };
    target.attack = null;
    target.action = null;
    clearCharge(target);
    target.struggle = 0;
    target.grabHoldT = 0;
    target.lastHitBy = attacker.id;
    attacker.attack = null;
    attacker.action = null;
    emit({ type: 'grab', attacker: attacker.id, target: target.id, x: target.pos.x, y: target.pos.y, z: target.pos.z });
  }

  function resolveAttack(attacker) {
    const attack = attacker.attack;
    if (!attack) return;
    if (attack.move === 'throw') {
      const target = fighterMap.get(attacker.grabTarget);
      if (!target) return;
      const facing = attack.facing;
      releaseGrab(attacker, target);
      target.pos.x = attacker.pos.x + Math.sin(facing) * C.grabDistance;
      target.pos.z = attacker.pos.z + Math.cos(facing) * C.grabDistance;
      target.vel.x = Math.sin(facing) * MOVES.throw.speed;
      target.vel.z = Math.cos(facing) * MOVES.throw.speed;
      target.vel.y = C.throwLift;
      target.onGround = false;
      target.tumbleT = C.throwTumbleTime;
      dropHeldItem(target);
      target.invulnT = 0;
      target.lastHitBy = attacker.id;
      target.projectileT = C.projectileTime;
      target.projectileBy = attacker.id;
      emit({ type: 'throw', attacker: attacker.id, target: target.id, x: target.pos.x, y: target.pos.y, z: target.pos.z });
      return;
    }
    if (attack.move === 'grab') {
      resolveGrab(attacker);
      return;
    }
    const move = MOVES[attack.move];
    for (const target of fighters) {
      if (target === attacker || target.eliminated || attack.hasHit.has(target.id)) continue;
      const inRange = move.aoe
        ? distance(attacker, target) <= move.range + target.radius
        : targetInArc(attacker, target, move.range, move.arc, attack.facing);
      if (!inRange) continue;
      attack.hasHit.add(target.id);
      applyHit(attacker, target, attack.move, move.aoe ? { origin: attacker.pos } : {});
    }
    if (move.aoe) emit({ type: 'slam', id: attacker.id, x: attacker.pos.x, y: 0, z: attacker.pos.z, range: move.range });
  }

  function advanceAttack(fighter, dt) {
    const attack = fighter.attack;
    if (!attack) return;
    const move = MOVES[attack.move];
    attack.t += dt;
    fighter.actionT = Math.max(0, fighter.actionT - dt);
    if (attack.phase === 'startup' && attack.t + 1e-9 >= move.startup) {
      attack.phase = 'active';
      attack.t = 0;
      resolveAttack(fighter);
      if (!fighter.attack) return;
    } else if (attack.phase === 'active' && attack.move !== 'slam' && attack.t + 1e-9 >= (move.active ?? 0)) {
      attack.phase = 'recovery';
      attack.t = 0;
    } else if (attack.phase === 'recovery' && attack.t + 1e-9 >= move.recovery) {
      const completed = attack.move;
      fighter.attack = null;
      fighter.action = null;
      fighter.actionT = 0;
      if (MOVES[completed]?.next) fighter.comboWindow = C.comboWindow;
      if (fighter.queuedCharged) {
        fighter.queuedCharged = false;
        startAttack(fighter, 'charged');
      } else if (fighter.queuedPunch && MOVES[completed]?.next) {
        fighter.combo = Math.min(3, fighter.combo + 1);
        fighter.comboWindow = 0;
        startAttack(fighter, MOVES[completed].next);
      }
    }
  }

  function botIntent(fighter, index) {
    const B = CONFIG.bots;
    let targetX;
    let targetZ;
    if (edgeDistance(fighter.pos) < 1.35) {
      targetX = 0;
      targetZ = 0;
    } else {
      const direction = index % 2 ? 1 : -1;
      const angle = Number(fighter.id.slice(1)) * B.phaseSeed + time * B.turnSpeed * direction;
      const radius = B.orbitRadius + Math.sin(time * B.targetDamp + index) * B.orbitVariance;
      targetX = Math.sin(angle) * radius;
      targetZ = Math.cos(angle) * radius;
    }
    const dx = targetX - fighter.pos.x;
    const dz = targetZ - fighter.pos.z;
    const length = Math.hypot(dx, dz);
    if (length < B.arriveDistance) return EMPTY_INTENT;
    return { ...EMPTY_INTENT, mx: dx / length, mz: dz / length };
  }

  function updateBlink(fighter, dt) {
    fighter.blinkT -= dt;
    fighter.blinkLeft = Math.max(0, fighter.blinkLeft - dt);
    if (fighter.blinkT <= 0) {
      fighter.blinkLeft = P.blinkDuration;
      fighter.blinkT = P.blinkMin + random() * (P.blinkMax - P.blinkMin);
    }
    fighter.anim.blink = fighter.blinkLeft > 0 ? 1 : 0;
  }

  function updateAnimation(fighter, dt) {
    fighter.anim.knockLandT = Math.max(0, fighter.anim.knockLandT - dt);
    const liftActive = fighter.anim.knockLift > 0 || fighter.anim.knockLiftVelocity > 0;
    if (liftActive) {
      fighter.anim.knockLift = Math.max(0, fighter.anim.knockLift + fighter.anim.knockLiftVelocity * dt);
      fighter.anim.knockLiftVelocity += P.gravity * dt;
      if (fighter.anim.knockLift === 0 && fighter.anim.knockLiftVelocity <= 0) {
        fighter.anim.knockLiftVelocity = 0;
        fighter.anim.knockLandT = P.landingDuration;
      }
    }
    const speed = Math.hypot(fighter.vel.x, fighter.vel.z);
    const maxSpeed = P.maxSpeed * (byId.get(fighter.charId)?.speed ?? 1);
    fighter.anim.walk = clamp(speed / maxSpeed, 0, 1);
    fighter.anim.walkPhase += speed * P.walkCycleSpeed * dt;
    fighter.anim.breathe += dt;
    const leanTarget = fighter.state === 'dash' ? P.dashLean : fighter.anim.walk * P.moveLean;
    fighter.anim.lean += (leanTarget - fighter.anim.lean) * (1 - Math.exp(-P.leanDamp * dt));
    fighter.anim.punch = fighter.attack && fighter.attack.move !== 'grab' ? clamp(fighter.attack.t / Math.max(0.01, MOVES[fighter.attack.move].startup), 0, 1) : 0;
    fighter.anim.grab = fighter.grabTarget || fighter.attack?.move === 'grab' ? 1 : 0;
    fighter.anim.charge = fighter.charging ? clamp(fighter.chargeT / MOVES.charged.chargeTime, 0, 1) : 0;
    fighter.anim.tumble = fighter.tumbleT > 0 ? 1 : 0;
    updateBlink(fighter, dt);
  }

  function respawn(fighter) {
    fighter.pos = { x: fighter.spawn.x, y: fighter.spawn.y ?? 0, z: fighter.spawn.z };
    fighter.vel = { x: 0, y: 0, z: 0 };
    fighter.facing = fighter.spawn.facing ?? 0;
    fighter.onGround = true;
    fighter.dashT = 0;
    fighter.dashCd = 0;
    fighter.respawnT = 0;
    fighter.attack = null;
    fighter.action = null;
    fighter.tumbleT = 0;
    fighter.staggerT = 0;
    fighter.dizzyT = 0;
    fighter.poise = C.poise;
    fighter.jumpsUsed = 0;
    setState(fighter, 'idle', 0);
    emit({ type: 'respawn', id: fighter.id, x: fighter.pos.x, y: fighter.pos.y, z: fighter.pos.z });
  }

  function eliminate(fighter) {
    if (fighter.eliminated) return;
    breakGrab(fighter);
    dropHeldItem(fighter);
    const aliveBefore = fighters.filter((item) => !item.eliminated).length;
    fighter.eliminated = true;
    fighter.onGround = false;
    fighter.rank = aliveBefore;
    fighter.koBy = fighter.lastHitBy && fighter.lastHitBy !== fighter.id ? fighter.lastHitBy : null;
    fighter.attack = null;
    fighter.action = null;
    fighter.projectileT = 0;
    eliminationOrder.push(fighter.id);
    setState(fighter, 'eliminated', 0);
    const killer = fighter.koBy ? fighterMap.get(fighter.koBy) : null;
    if (killer && !killer.eliminated) killer.kos += 1;
    emit({
      type: 'ko', victim: fighter.id, killer: fighter.koBy,
      killerName: killer ? byId.get(killer.charId).name : null,
      victimName: byId.get(fighter.charId).name,
      x: fighter.pos.x, y: fighter.pos.y, z: fighter.pos.z,
    });
    const alive = fighters.filter((item) => !item.eliminated);
    if (teams !== 2 && alive.length === 2 && !finalTwoSent) {
      finalTwoSent = true;
      emit({ type: 'finalTwo', ids: alive.map((item) => item.id) });
    }
    const aliveTeams = new Set(alive.map((fighter) => fighter.team));
    if (eliminationOrder.length > 0 && (teams === 2 ? aliveTeams.size <= 1 : alive.length <= 1)) roundEnded = true;
  }

  function handleActions(fighter, intent, move, dt) {
    const character = byId.get(fighter.charId);
    const punchHeld = Boolean(intent.punchHeld ?? intent.charge ?? intent.punch);
    if (intent.punch && canOperate(fighter)) {
      if (fighter.heldItem) {
        useHeldItem(fighter);
      } else {
        fighter.charging = true;
        fighter.chargeT = 0;
        if (fighter.grabTarget) {
          startAttack(fighter, 'throw');
        } else if (!fighter.onGround) {
          startAttack(fighter, 'slam');
          fighter.vel.y = C.slamSpeed;
        } else if (fighter.dashT > 0) {
          startAttack(fighter, 'dashPunch');
        } else {
          startOrQueuePunch(fighter);
        }
      }
    }
    if (!fighter.heldItem && intent.charged && canOperate(fighter) && !fighter.attack && fighter.onGround) {
      startAttack(fighter, 'charged');
      fighter.charging = false;
      fighter.chargeT = 0;
    } else if (punchHeld && fighter.charging) {
      fighter.chargeT += dt;
    } else if (!punchHeld && fighter.charging) {
      if (fighter.chargeT + 1e-9 >= MOVES.charged.chargeTime && canOperate(fighter) && fighter.onGround && !fighter.grabTarget) {
        if (fighter.attack) fighter.queuedCharged = true;
        else startAttack(fighter, 'charged');
      }
      fighter.charging = false;
      fighter.chargeT = 0;
    }
    fighter.prevPunchHeld = punchHeld;

    if (!canOperate(fighter)) return;
    if (intent.grab && !fighter.attack && !fighter.grabTarget && fighter.onGround && !fighter.heldItem) {
      if (!tryPickup(fighter)) startAttack(fighter, 'grab');
    }
    if (intent.dash && fighter.dashCd <= 0 && !fighter.grabTarget && !fighter.attack) {
      const length = Math.hypot(move.x, move.z);
      fighter.dashDir = length > 0
        ? { x: move.x / length, z: move.z / length }
        : { x: Math.sin(fighter.facing), z: Math.cos(fighter.facing) };
      fighter.dashT = P.dashDuration;
      fighter.dashCd = P.dashCooldown * (character.passive === 'dash' ? C.foxDashCooldown : 1);
      emit({ type: 'dash', id: fighter.id });
    }
    if (intent.jump && !fighter.grabTarget && !fighter.attack) {
      if (fighter.onGround) {
        fighter.onGround = false;
        fighter.jumpsUsed = 1;
        fighter.vel.y = P.jumpVelocity * character.jump;
        emit({ type: 'jump', id: fighter.id });
      } else if (character.passive === 'doubleJump' && fighter.jumpsUsed === 1) {
        fighter.jumpsUsed = 2;
        fighter.vel.y = P.jumpVelocity * character.jump * C.secondJumpScale;
        const length = Math.hypot(move.x, move.z);
        if (length > 0.01) {
          fighter.vel.x += move.x / length * P.maxSpeed * C.secondJumpBoost;
          fighter.vel.z += move.z / length * P.maxSpeed * C.secondJumpBoost;
        }
        emit({ type: 'jump', id: fighter.id, double: true });
      } else if (character.passive === 'airControl' && fighter.airAdjusts > 0) {
        fighter.airAdjusts -= 1;
        fighter.vel.x += move.x * C.catAirAdjust;
        fighter.vel.z += move.z * C.catAirAdjust;
        emit({ type: 'airAdjust', id: fighter.id });
      }
    }
  }

  function updateHeld(fighter, intent, dt) {
    fighter.grabHoldT += dt;
    const presses = Number(Boolean(intent.jump)) + Number(Boolean(intent.dash)) + Number(Boolean(intent.punch)) + Number(Boolean(intent.grab)) + (intent.struggle ?? 0);
    fighter.struggle += presses;
    if (fighter.struggle >= C.grabStruggles || fighter.grabHoldT >= C.grabBreakTime) {
      const holder = fighterMap.get(fighter.grabbedBy);
      releaseGrab(holder, fighter, C.grabInvuln);
      fighter.vel.x = -Math.sin(holder?.facing ?? 0) * 2;
      fighter.vel.z = -Math.cos(holder?.facing ?? 0) * 2;
      emit({ type: 'grabBreak', id: fighter.id, holder: holder?.id ?? null });
    }
    updateAnimation(fighter, dt);
  }

  function applyConveyor(fighter, dt) {
    if (!fighter.onGround || fighter.pos.y > 0.05) return;
    for (const conveyor of conveyors) {
      if (Math.abs(fighter.pos.x - conveyor.x) > conveyor.width * 0.5 || Math.abs(fighter.pos.z - conveyor.z) > conveyor.depth * 0.5) continue;
      fighter.pos.x += conveyor.dx * conveyor.speed * dt;
      fighter.pos.z += conveyor.dz * conveyor.speed * dt;
    }
  }

  function updateSweepers(dt) {
    for (const [key, cooldown] of hazardCooldowns) {
      if (cooldown <= dt) hazardCooldowns.delete(key);
      else hazardCooldowns.set(key, cooldown - dt);
    }
    sweepers.forEach((sweeper, index) => {
      const angle = sweeper.phase + time * sweeper.angularSpeed;
      const dx = Math.sin(angle);
      const dz = Math.cos(angle);
      const attacker = hazardAttackers[index];
      attacker.facing = angle;
      for (const target of fighters) {
        const key = `${index}:${target.id}`;
        if (target.eliminated || target.pos.y > 0.78 || target.pos.y < -0.5 || hazardCooldowns.has(key)) continue;
        const rx = target.pos.x - sweeper.x;
        const rz = target.pos.z - sweeper.z;
        const projection = clamp(rx * dx + rz * dz, -sweeper.length * 0.5, sweeper.length * 0.5);
        const closestX = sweeper.x + dx * projection;
        const closestZ = sweeper.z + dz * projection;
        if (Math.hypot(target.pos.x - closestX, target.pos.z - closestZ) > sweeper.radius + target.radius) continue;
        if (applyHit(attacker, target, 'punch3', {
          direction: { x: -target.pos.x, z: -target.pos.z },
          knock: sweeper.knock, poise: sweeper.poise, stagger: sweeper.stagger,
        })) {
          hazardCooldowns.set(key, 0.65);
          emit({ type: 'hazardHit', hazard: 'sweeper', hazardId: index, target: target.id, x: target.pos.x, y: target.pos.y, z: target.pos.z });
        }
      }
    });
  }

  function step(dt, intents = new Map()) {
    if (Math.abs(dt - STEP) > 1e-9) throw new RangeError(`step expects dt=${STEP}`);
    events.length = 0;
    if (roundEnded) return sim;
    time += dt;
    const shrink = clamp((time - M.shrinkStart) / M.shrinkDuration, 0, 1);
    if (arena.shape === 'rect') {
      const scale = 1 - (1 - M.minRadius / (arena.depth * 0.5)) * shrink;
      arenaWidth = arena.width * scale;
      arenaDepth = arena.depth * scale;
      arenaRadius = arenaDepth * 0.5;
    } else {
      arenaRadius = arena.radius + (M.minRadius - arena.radius) * shrink;
      arenaWidth = arenaRadius * 2;
      arenaDepth = arenaRadius * 2;
    }
    updateItems(dt);

    fighters.forEach((fighter, index) => {
      if (fighter.eliminated) {
        fighter.hitFlashT = Math.max(0, fighter.hitFlashT - dt);
        fighter.vel.y += P.gravity * dt;
        fighter.pos.x += fighter.vel.x * dt;
        fighter.pos.y += fighter.vel.y * dt;
        fighter.pos.z += fighter.vel.z * dt;
        fighter.stateT += dt;
        updateAnimation(fighter, dt);
        return;
      }
      fighter.dashCd = Math.max(0, fighter.dashCd - dt);
      fighter.landT = Math.max(0, fighter.landT - dt);
      fighter.invulnT = fighter.invulnT <= dt + 1e-9 ? 0 : fighter.invulnT - dt;
      fighter.gloveT = fighter.gloveT <= dt + 1e-9 ? 0 : fighter.gloveT - dt;
      fighter.starT = fighter.starT <= dt + 1e-9 ? 0 : fighter.starT - dt;
      fighter.hitFlashT = Math.max(0, fighter.hitFlashT - dt);
      fighter.hitGraceT = Math.max(0, fighter.hitGraceT - dt);
      fighter.staggerT = Math.max(0, fighter.staggerT - dt);
      fighter.tumbleT = Math.max(0, fighter.tumbleT - dt);
      fighter.getUpT = Math.max(0, fighter.getUpT - dt);
      fighter.projectileT = Math.max(0, fighter.projectileT - dt);
      fighter.comboWindow = Math.max(0, fighter.comboWindow - dt);
      if (fighter.comboWindow === 0 && !fighter.attack) fighter.combo = 0;
      if (fighter.dizzyT > 0) {
        fighter.dizzyT = Math.max(0, fighter.dizzyT - dt);
        if (fighter.dizzyT === 0) fighter.poise = C.poise;
      }
      fighter.poiseTimer += dt;
      if (fighter.poiseTimer >= C.poiseDelay && fighter.dizzyT <= 0) fighter.poise = Math.min(C.poise, fighter.poise + C.poiseRegen * dt);

      if (fighter.state === 'falling' && practiceRespawn) {
        fighter.respawnT -= dt;
        fighter.vel.y += P.gravity * dt;
        fighter.pos.y += fighter.vel.y * dt;
        fighter.stateT += dt;
        if (fighter.respawnT <= 0) respawn(fighter);
        updateAnimation(fighter, dt);
        return;
      }

      const intent = intents.get(fighter.id) ?? (fighter.isPlayer ? EMPTY_INTENT : botIntent(fighter, index));
      if (fighter.grabbedBy) {
        updateHeld(fighter, intent, dt);
        return;
      }
      const move = normalizedInput(intent);
      handleActions(fighter, intent, move, dt);
      const character = byId.get(fighter.charId);
      let speedScale = character.speed;
      if (fighter.starT > 0) speedScale *= ITEMS.star.speedMultiplier;
      if (fighter.attack) speedScale *= C.attackMoveScale;
      if (fighter.charging && fighter.chargeT >= MOVES.charged.chargeTime) speedScale *= C.chargeMoveScale;
      if (fighter.grabTarget) {
        const held = fighterMap.get(fighter.grabTarget);
        speedScale *= byId.get(held.charId).weight > C.heavyGrabWeight ? C.heavyGrabMoveScale : C.grabMoveScale;
      }
      const maxSpeed = P.maxSpeed * speedScale;

      if (!canOperate(fighter)) {
        const drag = Math.exp(-C.knockDecay * dt);
        fighter.vel.x *= drag;
        fighter.vel.z *= drag;
        if (!fighter.onGround) {
          fighter.vel.x += move.x * P.acceleration * P.airControl * C.recoveryAirControl * dt;
          fighter.vel.z += move.z * P.acceleration * P.airControl * C.recoveryAirControl * dt;
        }
      } else if (fighter.dashT > 0) {
        fighter.dashT = Math.max(0, fighter.dashT - dt);
        fighter.vel.x = fighter.dashDir.x * P.dashSpeed * character.speed;
        fighter.vel.z = fighter.dashDir.z * P.dashSpeed * character.speed;
      } else {
        const control = fighter.onGround ? 1 : P.airControl;
        const hasMove = Math.hypot(move.x, move.z) > 0;
        const surfaceScale = fighter.onGround && arena.friction < 1 ? (hasMove ? 0.55 : 0.18) : 1;
        const rate = (hasMove ? P.acceleration : P.deceleration) * control * surfaceScale * dt;
        fighter.vel.x = approach(fighter.vel.x, move.x * maxSpeed, rate);
        fighter.vel.z = approach(fighter.vel.z, move.z * maxSpeed, rate);
      }

      let desired = null;
      if (Number.isFinite(intent.facing)) desired = intent.facing;
      else if (Math.hypot(move.x, move.z) > 0.01 || fighter.dashT > 0) {
        desired = fighter.dashT > 0 ? Math.atan2(fighter.dashDir.x, fighter.dashDir.z) : Math.atan2(move.x, move.z);
      }
      if (desired !== null) {
        const delta = wrapAngle(desired - fighter.facing);
        fighter.facing = wrapAngle(fighter.facing + clamp(delta, -P.turnSpeed * dt, P.turnSpeed * dt));
      }

      if (fighter.attack?.phase === 'active' && fighter.attack.lungeLeft > 0 && fighter.attack.move !== 'slam') {
        const moveData = MOVES[fighter.attack.move];
        const amount = Math.min(fighter.attack.lungeLeft, moveData.lunge / Math.max(STEP, moveData.active) * dt);
        fighter.pos.x += Math.sin(fighter.attack.facing) * amount;
        fighter.pos.z += Math.cos(fighter.attack.facing) * amount;
        fighter.attack.lungeLeft -= amount;
      }

      applyConveyor(fighter, dt);
      if (edgeDistance(fighter.pos) < P.edgeMargin) fighter.onGround = false;
      if (!fighter.onGround) fighter.vel.y += P.gravity * dt;
      else fighter.vel.y = 0;
      fighter.pos.x += fighter.vel.x * dt;
      fighter.pos.y += fighter.vel.y * dt;
      fighter.pos.z += fighter.vel.z * dt;
      advanceAttack(fighter, dt);
    });

    updateSweepers(dt);
    updateBombs(dt);

    for (const fighter of fighters) {
      if (!fighter.grabTarget || fighter.eliminated) continue;
      const target = fighterMap.get(fighter.grabTarget);
      if (!target || target.eliminated) {
        fighter.grabTarget = null;
        continue;
      }
      target.pos.x = fighter.pos.x + Math.sin(fighter.facing) * C.grabDistance;
      target.pos.y = fighter.pos.y;
      target.pos.z = fighter.pos.z + Math.cos(fighter.facing) * C.grabDistance;
      target.vel.x = 0;
      target.vel.y = 0;
      target.vel.z = 0;
      target.facing = wrapAngle(Math.atan2(fighter.pos.x - target.pos.x, fighter.pos.z - target.pos.z));
      target.onGround = fighter.onGround;
    }

    for (const projectile of fighters) {
      if (projectile.projectileT <= 0 || projectile.onGround || projectile.eliminated) continue;
      for (const target of fighters) {
        if (target === projectile || target.eliminated || target.id === projectile.projectileBy || target.grabbedBy) continue;
        if (distance(projectile, target) >= C.projectileRange || Math.abs(projectile.pos.y - target.pos.y) > 1.4) continue;
        const attacker = fighterMap.get(projectile.projectileBy) ?? target;
        const origin = { x: (projectile.pos.x + target.pos.x) * 0.5, z: (projectile.pos.z + target.pos.z) * 0.5 };
        applyHit(attacker, target, 'punch3', { knock: C.projectileKnock, poise: C.projectilePoise, origin });
        applyHit(attacker, projectile, 'punch3', { knock: C.projectileKnock, poise: C.projectilePoise, origin });
        projectile.vel.x *= -C.projectileBounce;
        projectile.vel.z *= -C.projectileBounce;
        projectile.projectileT = 0;
        emit({ type: 'projectileHit', projectile: projectile.id, target: target.id, attacker: attacker.id });
        break;
      }
    }

    for (let iteration = 0; iteration < P.collisionIterations; iteration++) {
      for (let a = 0; a < fighters.length; a++) {
        const first = fighters[a];
        if (first.eliminated || first.state === 'falling' || first.grabbedBy) continue;
        for (let b = a + 1; b < fighters.length; b++) {
          const second = fighters[b];
          if (second.eliminated || second.state === 'falling' || second.grabbedBy || Math.abs(first.pos.y - second.pos.y) > Math.max(first.height, second.height)) continue;
          let dx = second.pos.x - first.pos.x;
          let dz = second.pos.z - first.pos.z;
          let separation = Math.hypot(dx, dz);
          const minimum = first.radius + second.radius;
          if (separation >= minimum) continue;
          if (separation < 1e-8) {
            const angle = (a + 1) * 2.399 + b;
            dx = Math.sin(angle);
            dz = Math.cos(angle);
          }
          const divisor = Math.max(separation, 1e-8);
          const nx = dx / divisor;
          const nz = dz / divisor;
          const overlap = minimum - separation + 1e-8;
          const firstWeight = byId.get(first.charId).weight;
          const secondWeight = byId.get(second.charId).weight;
          const total = firstWeight + secondWeight;
          first.pos.x -= nx * overlap * (secondWeight / total);
          first.pos.z -= nz * overlap * (secondWeight / total);
          second.pos.x += nx * overlap * (firstWeight / total);
          second.pos.z += nz * overlap * (firstWeight / total);
        }
      }
    }

    for (const fighter of fighters) {
      if (fighter.eliminated || fighter.grabbedBy || (fighter.state === 'falling' && practiceRespawn)) continue;
      if (fighter.pos.y < P.fallY) {
        fighter.onGround = false;
        if (practiceRespawn) {
          dropHeldItem(fighter);
          fighter.respawnT = P.respawnDelay;
          setState(fighter, 'falling', dt);
          emit({ type: 'fall', id: fighter.id });
        } else {
          eliminate(fighter);
        }
        continue;
      }
      const outside = edgeDistance(fighter.pos) < P.edgeMargin;
      if (outside) {
        fighter.onGround = false;
        const normal = outwardNormal(fighter.pos);
        fighter.vel.x += normal.x * P.edgeSlideAcceleration * dt;
        fighter.vel.z += normal.z * P.edgeSlideAcceleration * dt;
        if (fighter.pos.y <= 0) fighter.vel.y = Math.min(fighter.vel.y, -P.edgeDropSpeed);
      } else if (fighter.pos.y <= 0 && fighter.vel.y <= 0) {
        const landed = !fighter.onGround;
        fighter.pos.y = 0;
        fighter.vel.y = 0;
        fighter.onGround = true;
        fighter.jumpsUsed = 0;
        fighter.airAdjusts = byId.get(fighter.charId).passive === 'airControl' ? 1 : 0;
        fighter.projectileT = 0;
        if (landed) {
          const slippery = byId.get(fighter.charId).passive === 'slippery';
          fighter.landT = slippery ? 0 : (fighter.tumbleT > 0 ? C.getUpTime : P.landingDuration);
          fighter.getUpT = slippery ? 0 : (fighter.tumbleT > 0 ? C.getUpTime : 0);
          fighter.tumbleT = 0;
          emit({ type: 'land', id: fighter.id, x: fighter.pos.x, y: 0, z: fighter.pos.z });
          if (fighter.attack?.move === 'slam') {
            fighter.attack.phase = 'recovery';
            fighter.attack.t = 0;
            resolveAttack(fighter);
          }
        }
      }

      if (fighter.dizzyT > 0) {
        setState(fighter, 'dizzy', dt);
      } else if (fighter.staggerT > 0 || fighter.getUpT > 0) {
        setState(fighter, 'stagger', dt);
      } else if (fighter.tumbleT > 0 && !fighter.onGround) {
        setState(fighter, 'tumble', dt);
      } else if (fighter.attack) {
        setState(fighter, 'attack', dt);
      } else if (fighter.grabTarget) {
        setState(fighter, 'holding', dt);
      } else if (fighter.charging && fighter.chargeT >= MOVES.charged.chargeTime) {
        setState(fighter, 'charge', dt);
      } else if (!fighter.onGround) {
        setState(fighter, fighter.vel.y > 0 ? 'jump' : 'fall', dt);
      } else if (fighter.dashT > 0) {
        setState(fighter, 'dash', dt);
      } else {
        setState(fighter, Math.hypot(fighter.vel.x, fighter.vel.z) > P.runStateThreshold ? 'run' : 'idle', dt);
      }
      updateAnimation(fighter, dt);
    }

    return sim;
  }

  function reset() {
    time = 0;
    arenaRadius = arena.shape === 'rect' ? arena.depth * 0.5 : arena.radius;
    arenaWidth = arena.width ?? arena.radius * 2;
    arenaDepth = arena.depth ?? arena.radius * 2;
    hazardCooldowns.clear();
    roundEnded = false;
    finalTwoSent = false;
    nextItemDropT = ITEM_RULES.firstDrop;
    nextItemId = 1;
    nextBombId = 1;
    eliminationOrder.length = 0;
    items.length = 0;
    bombs.length = 0;
    events.length = 0;
    fighters.forEach((fighter, index) => {
      const fresh = makeFighter(byId.get(fighter.charId), index);
      fresh.isPlayer = fighter.isPlayer;
      Object.assign(fighter, fresh);
    });
  }

  const sim = {
    arena,
    teams,
    fighters,
    fighterMap,
    eliminationOrder,
    items,
    bombs,
    spawnItem,
    get time() { return time; },
    get arenaRadius() { return arenaRadius; },
    get arenaWidth() { return arenaWidth; },
    get arenaDepth() { return arenaDepth; },
    get shrinkProgress() { return clamp((time - M.shrinkStart) / M.shrinkDuration, 0, 1); },
    distanceToEdge: edgeDistance,
    get roundEnded() { return roundEnded; },
    get alive() { return fighters.filter((fighter) => !fighter.eliminated); },
    phase: 'ready',
    events,
    step(dt, intents) {
      sim.phase = roundEnded ? 'roundEnd' : 'playing';
      return step(dt, intents);
    },
    reset,
  };
  return sim;
}
