// 球的静态定义与球堆摆放：纯数据，无 DOM。
import { BALL, PLAY, POCKETS, RACK, TABLE } from '../../config/game.config.js';
import { shuffle } from './rng.js';

export const CUE = BALL.CUE_ID;
export const EIGHT = BALL.EIGHT_ID;

export function kindOf(id) {
  if (id === CUE) return 'cue';
  if (id === EIGHT) return 'eight';
  return id < EIGHT ? 'solid' : 'stripe';
}

export function groupOf(id) {
  const k = kindOf(id);
  return k === 'eight' || k === 'cue' ? null : k;
}

export function makeBall(id, x, y) {
  return { id, x, y, vx: 0, vy: 0, spin: 0, alive: true, kind: kindOf(id), group: groupOf(id) };
}

export function pocketAt(x, y, radius = TABLE.POCKET_R) {
  for (const p of POCKETS) {
    const dx = x - p.x;
    const dy = y - p.y;
    if (dx * dx + dy * dy <= radius * radius) return p;
  }
  return null;
}

export const HEAD_SPOT = { x: TABLE.HEAD_X, y: (PLAY.top + PLAY.bottom) / 2 };
export const FOOT_SPOT = { x: TABLE.FOOT_X, y: (PLAY.top + PLAY.bottom) / 2 };

// 标准三角堆：顶点朝向开球端，8 号固定在第三行中心，两个底角一实一花。
export function rackPositions() {
  return RACK.SLOTS.map(([row, idx]) => ({
    x: FOOT_SPOT.x + row * RACK.ROW_DX,
    y: FOOT_SPOT.y + (idx - row / 2) * RACK.COL_DY,
  }));
}

function slotIndex(slots, target) {
  return slots.findIndex(([a, b]) => a === target[0] && b === target[1]);
}

export function rackIds(rng) {
  const slots = RACK.SLOTS;
  const ids = new Array(slots.length).fill(null);
  ids[slotIndex(slots, RACK.EIGHT_SLOT)] = EIGHT;

  const solids = BALL.SOLID.slice();
  const stripes = BALL.STRIPE.slice();
  const [cornerA, cornerB] = RACK.CORNER_SLOTS.map((c) => slotIndex(slots, c));
  if (rng.next() < 0.5) {
    ids[cornerA] = solids.splice(Math.floor(rng.next() * solids.length), 1)[0];
    ids[cornerB] = stripes.splice(Math.floor(rng.next() * stripes.length), 1)[0];
  } else {
    ids[cornerA] = stripes.splice(Math.floor(rng.next() * stripes.length), 1)[0];
    ids[cornerB] = solids.splice(Math.floor(rng.next() * solids.length), 1)[0];
  }

  const rest = shuffle(solids.concat(stripes), rng);
  for (let i = 0; i < ids.length; i += 1) {
    if (ids[i] === null) ids[i] = rest.shift();
  }
  return ids;
}

// 开局 16 颗球：白球在开球点，1–15 在球堆。
export function createRack(rng, cueSpot = HEAD_SPOT) {
  const positions = rackPositions();
  const ids = rackIds(rng);
  const balls = [makeBall(CUE, cueSpot.x, cueSpot.y)];
  for (let i = 0; i < positions.length; i += 1) {
    balls.push(makeBall(ids[i], positions[i].x, positions[i].y));
  }
  return balls;
}

export function liveBalls(world) {
  return world.balls.filter((b) => b.alive);
}

export function ballById(world, id) {
  return world.balls.find((b) => b.id === id) || null;
}
