// 纯逻辑：2D 挖掘建造沙盒。无 DOM / window / Date.now；RNG 可注入。
import { WORLD, TILE, COLS, ROWS, GRAVITY, BLOCKS, HOTBAR, PLAYER, RULES } from '../../config/game.config.js';

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

function genWorld(rng) {
  const grid = [];
  for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(0));
  const surface = [];
  for (let c = 0; c < COLS; c++) {
    surface[c] = clamp(Math.floor(10 + Math.sin(c * 0.32) * 2 + (rng() - 0.5) * 2), 6, 14);
  }
  for (let c = 0; c < COLS; c++) {
    const s = surface[c];
    for (let r = s; r < ROWS; r++) {
      if (r === s) grid[r][c] = 1;
      else if (r <= s + 3) grid[r][c] = 2;
      else grid[r][c] = rng() < 0.07 ? 6 : 3;
    }
    // 沙地
    if (rng() < 0.12) grid[s][c] = 7;
    // 树
    if (rng() < 0.1 && s > 4 && c > 1 && c < COLS - 2) {
      const h = 3 + Math.floor(rng() * 2);
      for (let k = 1; k <= h; k++) if (s - k >= 0) grid[s - k][c] = 4;
      const top = s - h;
      for (let dr = -2; dr <= 0; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const rr = top + dr, cc = c + dc;
          if (rr >= 0 && cc >= 0 && cc < COLS && grid[rr][cc] === 0) grid[rr][cc] = 5;
        }
    }
  }
  return { grid, surface };
}

export function createRun({ seed = 1 } = {}) {
  const rng = makeRng(seed);
  const { grid, surface } = genWorld(rng);
  const c = 20;
  const inventory = {};
  for (const id of [2, 3, 4, 5, 6, 7]) inventory[id] = 0;
  inventory[2] = 8; // 起始送一些泥土
  return {
    phase: 'play',
    grid,
    player: { x: c * TILE + TILE / 2, y: surface[c] * TILE, vx: 0, vy: 0, onGround: true, facing: 1 },
    inventory,
    selected: 0,
    mining: null,
    placeCd: 0,
    time: 0,
    mined: 0,
    placed: 0,
    events: [],
    rng,
  };
}

function solidAt(run, c, r) {
  if (c < 0 || c >= COLS) return true;
  if (r >= ROWS) return true;
  if (r < 0) return false;
  return run.grid[r][c] !== 0;
}

function collides(run, px, py) {
  const x0 = px - PLAYER.W / 2, x1 = px + PLAYER.W / 2;
  const y0 = py - PLAYER.H, y1 = py - 0.01;
  const c0 = Math.floor(x0 / TILE), c1 = Math.floor(x1 / TILE);
  const r0 = Math.floor(y0 / TILE), r1 = Math.floor(y1 / TILE);
  for (let r = r0; r <= r1; r++)
    for (let c = c0; c <= c1; c++)
      if (solidAt(run, c, r)) return true;
  return false;
}

function moveAxis(run, p, dx, dy) {
  const steps = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dy))));
  const sx = dx / steps, sy = dy / steps;
  for (let i = 0; i < steps; i++) {
    if (sx !== 0) {
      if (!collides(run, p.x + sx, p.y)) p.x += sx;
      else { p.vx = 0; break; }
    }
    if (sy !== 0) {
      if (!collides(run, p.x, p.y + sy)) { p.y += sy; p.onGround = false; }
      else { if (sy > 0) p.onGround = true; p.vy = 0; break; }
    }
  }
}

function physics(run, input, dt) {
  const p = run.player;
  const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
  p.vx = dir * PLAYER.SPEED;
  if (dir !== 0) p.facing = dir;
  if (input.jump && p.onGround) { p.vy = PLAYER.JUMP_V; p.onGround = false; }
  p.vy += GRAVITY * dt;
  p.vy = clamp(p.vy, -900, 900);
  moveAxis(run, p, p.vx * dt, 0);
  p.onGround = false;
  moveAxis(run, p, 0, p.vy * dt);
  p.x = clamp(p.x, PLAYER.W / 2, WORLD.WIDTH - PLAYER.W / 2);
  if (p.y > ROWS * TILE) { p.y = ROWS * TILE; p.vy = 0; p.onGround = true; }
}

function tileCenter(c, r) { return { x: (c + 0.5) * TILE, y: (r + 0.5) * TILE }; }

function inReach(run, c, r) {
  const p = run.player;
  const tc = tileCenter(c, r);
  return Math.hypot(tc.x - p.x, tc.y - (p.y - PLAYER.H / 2)) <= PLAYER.REACH * TILE;
}

function handleMinePlace(run, input, dt) {
  if (run.placeCd > 0) run.placeCd -= dt;
  const m = input.mouse;
  if (!m) { run.mining = null; return; }
  const c = Math.floor(m.x / TILE), r = Math.floor(m.y / TILE);
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) { run.mining = null; return; }
  const reach = inReach(run, c, r);

  if (input.mining && reach && run.grid[r][c] !== 0) {
    if (!run.mining || run.mining.c !== c || run.mining.r !== r) run.mining = { c, r, t: 0 };
    run.mining.t += dt;
    const id = run.grid[r][c];
    if (run.mining.t >= BLOCKS[id].hard) {
      const drop = BLOCKS[id].drop;
      run.grid[r][c] = 0;
      if (drop) run.inventory[drop] = (run.inventory[drop] || 0) + 1;
      run.mined += 1;
      run.events.push({ type: 'mine', c, r, id });
      run.mining = null;
    }
  } else {
    run.mining = null;
  }

  if (input.placing && reach && run.grid[r][c] === 0 && run.placeCd <= 0) {
    const id = HOTBAR[run.selected];
    if ((run.inventory[id] || 0) > 0) {
      // 不能放在玩家身体里
      const tc = tileCenter(c, r);
      const p = run.player;
      const overlap = Math.abs(tc.x - p.x) < (TILE + PLAYER.W) / 2 && tc.y > p.y - PLAYER.H - TILE / 2 && tc.y < p.y + TILE / 2;
      if (!overlap) {
        run.grid[r][c] = id;
        run.inventory[id] -= 1;
        run.placed += 1;
        run.placeCd = 0.18;
        run.events.push({ type: 'place', c, r, id });
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
    day: Math.floor(run.time / RULES.dayLength) + 1,
    timeOfDay: (run.time % RULES.dayLength) / RULES.dayLength,
    mined: run.mined,
    placed: run.placed,
    inventory: { ...run.inventory },
    selected: run.selected,
    hotbar: [...HOTBAR],
    mining: run.mining ? { c: run.mining.c, r: run.mining.r, t: run.mining.t } : null,
  };
}

export function drainEvents(run) { const e = run.events; run.events = []; return e; }
export { solidAt, tileCenter };