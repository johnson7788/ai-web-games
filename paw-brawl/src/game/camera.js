import { CONFIG } from '../../config/game.config.js';

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const STEP_FALLBACK = 1 / CONFIG.logicFps;

function boundsFor(list) {
  const bounds = { minX: Infinity, maxX: -Infinity, minY: Infinity, maxY: -Infinity, minZ: Infinity, maxZ: -Infinity };
  for (const fighter of list) {
    bounds.minX = Math.min(bounds.minX, fighter.pos.x - fighter.radius);
    bounds.maxX = Math.max(bounds.maxX, fighter.pos.x + fighter.radius);
    bounds.minY = Math.min(bounds.minY, fighter.pos.y);
    bounds.maxY = Math.max(bounds.maxY, fighter.pos.y + fighter.height);
    bounds.minZ = Math.min(bounds.minZ, fighter.pos.z - fighter.radius);
    bounds.maxZ = Math.max(bounds.maxZ, fighter.pos.z + fighter.radius);
  }
  return bounds;
}

export function autoFrame({ fighters, arena, time, aspect, view = null, distanceScale = 1, focus = null, azimuthOffset = 0 }) {
  const C = CONFIG.camera;
  const active = fighters.filter((fighter) => fighter.state !== 'eliminated' && fighter.state !== 'falling');
  const player = fighters.find((fighter) => fighter.isPlayer);
  const following = player && active.includes(player);
  let desiredTarget;
  let desiredDistance;
  let elevation;

  if (following) {
    const nearby = active.filter((fighter) => fighter !== player && Math.hypot(fighter.pos.x - player.pos.x, fighter.pos.z - player.pos.z) <= C.nearbyRadius);
    const centroid = nearby.length ? nearby.reduce((center, fighter) => ({
      x: center.x + fighter.pos.x / nearby.length,
      z: center.z + fighter.pos.z / nearby.length,
    }), { x: 0, z: 0 }) : player.pos;
    desiredTarget = {
      x: player.pos.x * C.playerWeight + centroid.x * C.nearbyWeight,
      y: C.followTargetHeight,
      z: player.pos.z * C.playerWeight + centroid.z * C.nearbyWeight,
    };
    const speed = Math.hypot(player.vel?.x ?? 0, player.vel?.z ?? 0);
    if (speed > C.lookAheadSpeed) {
      desiredTarget.x += player.vel.x / speed * C.lookAhead;
      desiredTarget.z += player.vel.z / speed * C.lookAhead;
    }
    if (arena.shape === 'rect') {
      if (Math.abs(player.pos.x) > arena.width * 0.5 - C.edgeMargin) desiredTarget.x -= Math.sign(player.pos.x) * C.edgePull;
      if (Math.abs(player.pos.z) > arena.depth * 0.5 - C.edgeMargin) desiredTarget.z -= Math.sign(player.pos.z) * C.edgePull;
    } else {
      const radial = Math.max(Math.hypot(player.pos.x, player.pos.z), 1e-8);
      if (radial > arena.radius - C.edgeMargin) {
        desiredTarget.x -= player.pos.x / radial * C.edgePull;
        desiredTarget.z -= player.pos.z / radial * C.edgePull;
      }
    }
    const bounds = boundsFor([player, ...nearby]);
    const spread = Math.max((bounds.maxX - bounds.minX) * 0.5, (bounds.maxZ - bounds.minZ) * 0.5);
    desiredDistance = clamp(C.followBaseDistance + spread * C.followSpreadScale, C.followMinDistance, C.followMaxDistance);
    elevation = C.followElevation;
  } else {
    const list = active.length ? active : fighters.filter((fighter) => fighter.state !== 'eliminated');
    const bounds = boundsFor(list);
    bounds.minX = Math.min(bounds.minX, -arena.radius * 0.2);
    bounds.maxX = Math.max(bounds.maxX, arena.radius * 0.2);
    bounds.minZ = Math.min(bounds.minZ, -arena.radius * 0.2);
    bounds.maxZ = Math.max(bounds.maxZ, arena.radius * 0.2);
    desiredTarget = {
      x: (bounds.minX + bounds.maxX) * 0.5,
      y: (bounds.minY + bounds.maxY) * 0.5 + C.targetHeight,
      z: (bounds.minZ + bounds.maxZ) * 0.5,
    };
    const horizontalRadius = Math.max((bounds.maxX - bounds.minX) * 0.5, (bounds.maxZ - bounds.minZ) * 0.5);
    const verticalRadius = (bounds.maxY - bounds.minY) * 0.5;
    const fov = aspect < 1 ? C.portraitFov : C.fov;
    const halfFov = fov * Math.PI / 360;
    const verticalFit = (horizontalRadius + verticalRadius) / Math.tan(halfFov);
    const horizontalFit = horizontalRadius / (Math.tan(halfFov) * Math.max(0.5, aspect));
    desiredDistance = clamp(Math.max(verticalFit, horizontalFit) * C.padding, C.minDistance, C.maxDistance);
    elevation = C.elevation;
  }

  if (focus) {
    desiredTarget = { x: focus.pos.x, y: focus.pos.y + C.followTargetHeight, z: focus.pos.z };
    desiredDistance = C.followBaseDistance * 0.82;
    elevation = C.followElevation;
  }
  desiredDistance *= distanceScale;

  const dt = Math.max(0, view?.dt ?? STEP_FALLBACK);
  const targetBlend = view?.target ? 1 - Math.exp(-C.damp * dt) : 1;
  const distanceBlend = view ? 1 - Math.exp(-C.distanceDamp * dt) : 1;
  const previousTarget = view?.target ?? desiredTarget;

  return {
    target: {
      x: previousTarget.x + (desiredTarget.x - previousTarget.x) * targetBlend,
      y: previousTarget.y + (desiredTarget.y - previousTarget.y) * targetBlend,
      z: previousTarget.z + (desiredTarget.z - previousTarget.z) * targetBlend,
    },
    distance: (view?.distance ?? desiredDistance) + (desiredDistance - (view?.distance ?? desiredDistance)) * distanceBlend,
    azimuth: C.azimuthBase + Math.sin(time * C.azimuthSpeed) * C.azimuthSwing + azimuthOffset,
    elevation,
    shake: C.shake,
    mode: following ? 'follow' : 'spectator',
  };
}
