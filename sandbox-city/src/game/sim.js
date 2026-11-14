// 纯逻辑：俯视角城市建造沙盒。无 DOM / window / Date.now；RNG 可注入。
import { TILE, COLS, ROWS, BUILDINGS, TOOLS, RULES } from '../../config/game.config.js';

export function makeRng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRun({ seed = 1 } = {}) {
  const grid = [];
  for (let r = 0; r < ROWS; r++) grid.push(new Array(COLS).fill(0));
  return {
    phase: 'play',
    grid,
    money: RULES.startMoney,
    pop: 0,
    income: 0,
    time: 0,
    incomeT: 0,
    selected: 0,
    cars: [],
    carT: 0,
    built: 0,
    events: [],
    rng: makeRng(seed),
  };
}

function recompute(run) {
  let pop = 0, income = 0;
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++) {
      const b = BUILDINGS[run.grid[r][c]];
      pop += b.pop; income += b.income;
    }
  run.pop = pop;
  run.income = income + pop * RULES.taxPerPop;
}

export function placeTile(run, c, r, id) {
  if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return { ok: false };
  if (id === -1) {
    if (run.grid[r][c] !== 0) {
      run.grid[r][c] = 0;
      run.events.push({ type: 'bulldoze', c, r });
      recompute(run);
      return { ok: true };
    }
    return { ok: false };
  }
  if (run.grid[r][c] !== 0) return { ok: false, reason: 'occupied' };
  const cost = BUILDINGS[id].cost;
  if (run.money < cost) return { ok: false, reason: 'money' };
  run.grid[r][c] = id;
  run.money -= cost;
  run.built += 1;
  run.events.push({ type: 'build', c, r, id });
  recompute(run);
  return { ok: true };
}

function roadNeighbors(run, c, r) {
  const out = [];
  for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    const nc = c + dc, nr = r + dr;
    if (nc >= 0 && nc < COLS && nr >= 0 && nr < ROWS && run.grid[nr][nc] === 1) out.push([nc, nr]);
  }
  return out;
}

function spawnCar(run) {
  const roads = [];
  for (let r = 0; r < ROWS; r++)
    for (let c = 0; c < COLS; c++)
      if (run.grid[r][c] === 1 && roadNeighbors(run, c, r).length) roads.push([c, r]);
  if (!roads.length) return;
  const [c, r] = roads[Math.floor(run.rng() * roads.length)];
  const nb = roadNeighbors(run, c, r);
  const [nc, nr] = nb[Math.floor(run.rng() * nb.length)];
  run.cars.push({ c, r, nc, nr, t: 0 });
}

function updateCars(run, dt) {
  run.carT -= dt;
  const roadCount = run.grid.flat().filter((x) => x === 1).length;
  const want = Math.min(RULES.maxCars, Math.floor(roadCount / 3));
  if (run.carT <= 0 && run.cars.length < want) { spawnCar(run); run.carT = 0.8; }
  for (let i = run.cars.length - 1; i >= 0; i--) {
    const car = run.cars[i];
    if (run.grid[car.r][car.c] !== 1) { run.cars.splice(i, 1); continue; }
    car.t += RULES.carSpeed * dt;
    if (car.t >= 1) {
      car.c = car.nc; car.r = car.nr; car.t = 0;
      const nb = roadNeighbors(run, car.c, car.r);
      if (!nb.length) { run.cars.splice(i, 1); continue; }
      const [nc, nr] = nb[Math.floor(run.rng() * nb.length)];
      car.nc = nc; car.nr = nr;
    }
  }
}

export function tick(run, dt) {
  if (run.phase !== 'play') return;
  run.time += dt;
  run.incomeT += dt;
  if (run.incomeT >= RULES.incomeEvery) {
    run.incomeT -= RULES.incomeEvery;
    const gain = Math.round(run.income);
    run.money += gain;
    if (gain > 0) run.events.push({ type: 'income', gain });
  }
  updateCars(run, dt);
}

export function getHud(run) {
  return {
    phase: run.phase,
    money: Math.floor(run.money),
    pop: run.pop,
    income: Math.round(run.income * 10) / 10,
    built: run.built,
    selected: run.selected,
    tools: [...TOOLS],
    cars: run.cars.length,
  };
}

export function drainEvents(run) { const e = run.events; run.events = []; return e; }
export { recompute };