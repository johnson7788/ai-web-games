// 纯逻辑：第一人称 3D 体素沙盒。无 DOM / window / Date.now；RNG 可注入。
import { SX, SY, SZ, GRAVITY, BLOCKS, HOTBAR, PLAYER } from '../../config/game.config.js';

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const idx = (x, y, z) => x + SX * (z + SZ * y);

function genWorld(rng) {
  const world = new Uint8Array(SX * SY * SZ);
  const h = [];
  for (let x = 0; x < SX; x++) {
    h[x] = [];
    for (let z = 0; z < SZ; z++) {
      h[x][z] = clamp(Math.floor(8 + Math.sin(x * 0.3) * 2 + Math.cos(z * 0.25) * 2 + (rng() - 0.5) * 2), 4, 14);
    }
  }
  const set = (x, y, z, id) => { if (x >= 0 && x < SX && y >= 0 && y < SY && z >= 0 && z < SZ) world[idx(x, y, z)] = id; };
  for (let x = 0; x < SX; x++)
    for (let z = 0; z < SZ; z++) {
      const s = h[x][z];
      for (let y = 0; y <= s; y++) {
        let id = 3;
        if (y === s) id = rng() < 0.1 ? 6 : 1;
        else if (y >= s - 3) id = 2;
        set(x, y, z, id);
      }
    }
  // 树
  for (let i = 0; i < 14; i++) {
    const x = 2 + Math.floor(rng() * (SX - 4)), z = 2 + Math.floor(rng() * (SZ - 4));
    const s = h[x][z];
    if (world[idx(x, s, z)] !== 1) continue;
    const th = 3 + Math.floor(rng() * 2);
    for (let k = 1; k <= th; k++) set(x, s + k, z, 4);
    for (let dx = -1; dx <= 1; dx++)
      for (let dz = -1; dz <= 1; dz++)
        for (let dy = 0; dy <= 1; dy++)
          if (!(dx === 0 && dz === 0 && dy === 0)) set(x + dx, s + th + dy, z + dz, 5);
    set(x, s + th + 1, z, 5);
  }
  return { world, h };
}

export function createRun({ seed = 1 } = {}) {
  const rng = makeRng(seed);
  const { world, h } = genWorld(rng);
  const cx = SX >> 1, cz = SZ >> 1;
  const inventory = {};
  for (const id of HOTBAR) inventory[id] = 0;
  inventory[2] = 16;
  return {
    phase: 'play',
    world,
    player: { x: cx + 0.5, y: h[cx][cz] + 1, z: cz + 0.5, vx: 0, vy: 0, vz: 0, yaw: 0, pitch: 0, onGround: true },
    inventory,
    selected: 0,
    mining: null,
    time: 0,
    mined: 0,
    placed: 0,
    events: [],
    rng,
  };
}

export function getBlock(run, x, y, z) {
  if (x < 0 || x >= SX || y < 0 || y >= SY || z < 0 || z >= SZ) return 0;
  return run.world[idx(x, y, z)];
}
function solid(run, x, y, z) {
  if (y < 0) return true;
  if (x < 0 || x >= SX || z < 0 || z >= SZ) return true;
  if (y >= SY) return false;
  return run.world[idx(x, y, z)] !== 0;
}

function collides(run, px, py, pz) {
  const w = PLAYER.W / 2;
  const x0 = Math.floor(px - w), x1 = Math.floor(px + w);
  const y0 = Math.floor(py), y1 = Math.floor(py + PLAYER.H - 0.001);
  const z0 = Math.floor(pz - w), z1 = Math.floor(pz + w);
  for (let y = y0; y <= y1; y++)
    for (let z = z0; z <= z1; z++)
      for (let x = x0; x <= x1; x++)
        if (solid(run, x, y, z)) return true;
  return false;
}

function moveAxis(run, p, dx, dy, dz) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) / 0.2));
  const sx = dx / steps, sy = dy / steps, sz = dz / steps;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0) { if (!collides(run, p.x + sx, p.y, p.z)) p.x += sx; else { p.vx = 0; break; } }
    if (sy !== 0) { if (!collides(run, p.x, p.y + sy, p.z)) { p.y += sy; p.onGround = false; } else { if (sy < 0) p.onGround = true; p.vy = 0; break; } }
    if (sz !== 0) { if (!collides(run, p.x, p.y, p.z + sz)) p.z += sz; else { p.vz = 0; break; } }
  }
}

export function lookDir(p) {
  const cp = Math.cos(p.pitch);
  return { x: Math.sin(p.yaw) * cp, y: Math.sin(p.pitch), z: -Math.cos(p.yaw) * cp };
}

function physics(run, input, dt) {
  const p = run.player;
  if (typeof input.yaw === 'number') p.yaw = input.yaw;
  if (typeof input.pitch === 'number') p.pitch = clamp(input.pitch, -1.5, 1.5);
  const f = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
  const s = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  const fx = Math.sin(p.yaw), fz = -Math.cos(p.yaw);
  const rx = Math.cos(p.yaw), rz = Math.sin(p.yaw);
  let mx = fx * f + rx * s, mz = fz * f + rz * s;
  const ml = Math.hypot(mx, mz);
  if (ml > 0) { mx = mx / ml * PLAYER.SPEED; mz = mz / ml * PLAYER.SPEED; }
  p.vx = mx; p.vz = mz;
  if (input.jump && p.onGround) { p.vy = PLAYER.JUMP_V; p.onGround = false; }
  p.vy -= GRAVITY * dt;
  p.vy = clamp(p.vy, -30, 30);
  moveAxis(run, p, p.vx * dt, 0, p.vz * dt);
  p.onGround = false;
  moveAxis(run, p, 0, p.vy * dt, 0);
  p.x = clamp(p.x, 0.5, SX - 0.5);
  p.z = clamp(p.z, 0.5, SZ - 0.5);
  if (p.y < 0) { p.y = 0; p.vy = 0; p.onGround = true; }
}

// 光线步进找目标方块
export function raycast(run) {
  const p = run.player;
  const d = lookDir(p);
  let ox = p.x, oy = p.y + PLAYER.EYE, oz = p.z;
  let prev = null;
  const step = 0.08;
  for (let t = 0; t < PLAYER.REACH; t += step) {
    const x = Math.floor(ox + d.x * t), y = Math.floor(oy + d.y * t), z = Math.floor(oz + d.z * t);
    if (getBlock(run, x, y, z) !== 0) return { hit: { x, y, z }, place: prev };
    prev = { x, y, z };
  }
  return null;
}

function handleMinePlace(run, input, dt) {
  const target = raycast(run);
  if (input.mining && target) {
    const { x, y, z } = target.hit;
    const id = getBlock(run, x, y, z);
    if (!run.mining || run.mining.x !== x || run.mining.y !== y || run.mining.z !== z) run.mining = { x, y, z, t: 0 };
    run.mining.t += dt;
    if (run.mining.t >= BLOCKS[id].hard) {
      run.world[idx(x, y, z)] = 0;
      const drop = id === 1 ? 2 : id;
      if (HOTBAR.includes(drop)) run.inventory[drop] = (run.inventory[drop] || 0) + 1;
      run.mined += 1;
      run.events.push({ type: 'mine', x, y, z, id });
      run.mining = null;
    }
  } else run.mining = null;

  if (input.placing && target && target.place) {
    const { x, y, z } = target.place;
    const id = HOTBAR[run.selected];
    if ((run.inventory[id] || 0) > 0 && getBlock(run, x, y, z) === 0) {
      const p = run.player;
      const overlap = x === Math.floor(p.x) && z === Math.floor(p.z) && (y === Math.floor(p.y) || y === Math.floor(p.y + 1));
      if (!overlap && x >= 0 && x < SX && y >= 0 && y < SY && z >= 0 && z < SZ) {
        run.world[idx(x, y, z)] = id;
        run.inventory[id] -= 1;
        run.placed += 1;
        run.events.push({ type: 'place', x, y, z, id });
      }
    }
  }
}

export function tick(run, dt, input = {}) {
  if (run.phase !== 'play') return;
  run.time += dt;
  physics(run, input, dt);
  handleMinePlace(run, input, dt);
}

export function getHud(run) {
  return {
    phase: run.phase,
    mined: run.mined,
    placed: run.placed,
    inventory: { ...run.inventory },
    selected: run.selected,
    hotbar: [...HOTBAR],
    pos: { x: run.player.x, y: run.player.y, z: run.player.z },
    yaw: run.player.yaw,
  };
}

export function drainEvents(run) { const e = run.events; run.events = []; return e; }
export { idx };