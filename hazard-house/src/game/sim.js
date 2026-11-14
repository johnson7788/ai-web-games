// 纯逻辑：本地 1–4 人陷阱生存。无 DOM / window / Date.now；RNG 可注入。
import { WORLD, ARENA, GRID, PLAYER, RULES } from '../../config/game.config.js';

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

const SPAWNS = [
  { x: ARENA.x0 + 60, y: ARENA.y0 + 50 },
  { x: ARENA.x1 - 60, y: ARENA.y0 + 50 },
  { x: ARENA.x0 + 60, y: ARENA.y1 - 50 },
  { x: ARENA.x1 - 60, y: ARENA.y1 - 50 },
];

function tileIdx(x, y) {
  const c = clamp(Math.floor((x - GRID.ox) / GRID.tw), 0, GRID.cols - 1);
  const r = clamp(Math.floor((y - GRID.oy) / GRID.th), 0, GRID.rows - 1);
  return r * GRID.cols + c;
}

function mkPlayer(i, humans) {
  return {
    id: i, x: SPAWNS[i].x, y: SPAWNS[i].y,
    hp: PLAYER.HP, alive: true, invuln: 0,
    isBot: i >= humans,
    target: null, retargetT: 0,
  };
}

export function createRun({ seed = 1, humans = 1 } = {}) {
  const run = {
    phase: 'countdown',
    round: 1,
    phaseT: RULES.countdown,
    scores: [0, 0, 0, 0],
    matchWinner: null,
    players: [0, 1, 2, 3].map((i) => mkPlayer(i, humans)),
    traps: [],
    trapT: 1.0,
    elapsed: 0,
    humans,
    events: [],
    rng: makeRng(seed),
  };
  return run;
}

function resetRound(run) {
  for (const p of run.players) {
    p.x = SPAWNS[p.id].x; p.y = SPAWNS[p.id].y;
    p.hp = PLAYER.HP; p.alive = true; p.invuln = 0;
    p.target = null; p.retargetT = 0;
  }
  run.traps = [];
  run.elapsed = 0;
  run.trapT = 1.0;
}

// ---- 危险判定（bot 用） ----------------------------------------------------
function isSafePoint(run, x, y) {
  const ti = tileIdx(x, y);
  for (const tr of run.traps) {
    if (tr.type === 'spike' && tr.tiles.includes(ti)) return false;
    if (tr.type === 'bomb' && Math.hypot(x - tr.x, y - tr.y) < RULES.bombRadius + 24) return false;
  }
  return true;
}

function botInput(run, p, dt) {
  p.retargetT -= dt;
  const reached = p.target && Math.hypot(p.x - p.target.x, p.y - p.target.y) < 24;
  if (!p.target || p.retargetT <= 0 || reached || !isSafePoint(run, p.x, p.y)) {
    let target = null;
    for (let k = 0; k < 10; k++) {
      const x = ARENA.x0 + 30 + run.rng() * (ARENA.x1 - ARENA.x0 - 60);
      const y = ARENA.y0 + 30 + run.rng() * (ARENA.y1 - ARENA.y0 - 60);
      if (isSafePoint(run, x, y)) { target = { x, y }; break; }
    }
    p.target = target || { x: WORLD.WIDTH / 2, y: (ARENA.y0 + ARENA.y1) / 2 };
    p.retargetT = 0.6 + run.rng() * 0.5;
  }
  const dx = p.target.x - p.x, dy = p.target.y - p.y;
  const inp = { up: false, down: false, left: false, right: false };
  if (Math.abs(dx) > 10) inp[dx > 0 ? 'right' : 'left'] = true;
  if (Math.abs(dy) > 10) inp[dy > 0 ? 'down' : 'up'] = true;
  return inp;
}

// ---- 陷阱生成 --------------------------------------------------------------
function trapInterval(elapsed) {
  return Math.max(RULES.trapIntervalMin, RULES.trapIntervalStart - elapsed * 0.03);
}

function spawnTrap(run) {
  const alive = run.players.filter((p) => p.alive);
  if (run.rng() < 0.55) {
    const k = Math.min(8, 2 + Math.floor(run.elapsed / 8));
    const tiles = new Set();
    while (tiles.size < k) tiles.add(Math.floor(run.rng() * GRID.cols * GRID.rows));
    run.traps.push({ type: 'spike', tiles: [...tiles], t: 0, phase: 'warn' });
  } else {
    const victim = alive.length ? alive[Math.floor(run.rng() * alive.length)] : null;
    const x = victim ? victim.x : ARENA.x0 + run.rng() * (ARENA.x1 - ARENA.x0);
    const y = victim ? victim.y : ARENA.y0 + run.rng() * (ARENA.y1 - ARENA.y0);
    run.traps.push({ type: 'bomb', x, y, t: 0, phase: 'warn' });
  }
}

function updateTraps(run, dt) {
  for (let i = run.traps.length - 1; i >= 0; i--) {
    const tr = run.traps[i];
    tr.t += dt;
    if (tr.type === 'spike') {
      if (tr.phase === 'warn' && tr.t >= RULES.spikeWarn) { tr.phase = 'active'; tr.t = 0; }
      else if (tr.phase === 'active' && tr.t >= RULES.spikeActive) run.traps.splice(i, 1);
    } else {
      if (tr.phase === 'warn' && tr.t >= RULES.bombWarn) { tr.phase = 'active'; tr.t = 0; run.events.push({ type: 'boom', x: tr.x, y: tr.y }); }
      else if (tr.phase === 'active' && tr.t >= 0.25) run.traps.splice(i, 1);
    }
  }
}

// ---- 伤害 ------------------------------------------------------------------
function applyHits(run) {
  for (const p of run.players) {
    if (!p.alive || p.invuln > 0) continue;
    let hit = false;
    const ti = tileIdx(p.x, p.y);
    for (const tr of run.traps) {
      if (tr.phase !== 'active') continue;
      if (tr.type === 'spike' && tr.tiles.includes(ti)) { hit = true; break; }
      if (tr.type === 'bomb' && Math.hypot(p.x - tr.x, p.y - tr.y) < RULES.bombRadius) { hit = true; break; }
    }
    if (hit) {
      p.hp -= 1; p.invuln = PLAYER.INVULN;
      run.events.push({ type: 'hit', id: p.id });
      if (p.hp <= 0) { p.alive = false; run.events.push({ type: 'eliminated', id: p.id }); }
    }
  }
}

// ---- 主步进 ----------------------------------------------------------------
export function tick(run, dt, inputs = []) {
  if (run.phase === 'over') return;

  if (run.phase === 'countdown') {
    run.phaseT -= dt;
    if (run.phaseT <= 0) { run.phase = 'play'; run.events.push({ type: 'go' }); }
    return;
  }

  if (run.phase === 'roundend') {
    run.phaseT -= dt;
    if (run.phaseT <= 0) {
      const champ = run.scores.findIndex((s) => s >= RULES.roundWins);
      if (champ >= 0) {
        run.phase = 'over'; run.matchWinner = champ;
        run.events.push({ type: 'matchend', winner: champ });
      } else {
        run.round += 1;
        resetRound(run);
        run.phase = 'countdown'; run.phaseT = RULES.countdown;
      }
    }
    return;
  }

  // play
  run.elapsed += dt;
  for (const p of run.players) {
    if (!p.alive) continue;
    if (p.invuln > 0) p.invuln -= dt;
    const inp = p.isBot ? botInput(run, p, dt) : (inputs[p.id] || {});
    let dx = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    let dy = (inp.down ? 1 : 0) - (inp.up ? 1 : 0);
    if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
    p.x = clamp(p.x + dx * PLAYER.SPEED * dt, ARENA.x0 + PLAYER.R, ARENA.x1 - PLAYER.R);
    p.y = clamp(p.y + dy * PLAYER.SPEED * dt, ARENA.y0 + PLAYER.R, ARENA.y1 - PLAYER.R);
  }

  run.trapT -= dt;
  if (run.trapT <= 0) {
    spawnTrap(run);
    run.trapT = trapInterval(run.elapsed) * (0.7 + run.rng() * 0.6);
  }
  updateTraps(run, dt);
  applyHits(run);

  const alive = run.players.filter((p) => p.alive);
  if (alive.length <= 1) {
    const winner = alive.length === 1 ? alive[0].id : -1;
    if (winner >= 0) run.scores[winner] += 1;
    run.lastRoundWinner = winner;
    run.events.push({ type: 'roundend', winner, scores: [...run.scores] });
    run.phase = 'roundend';
    run.phaseT = RULES.roundEndDelay;
  }
}

export function getHud(run) {
  return {
    phase: run.phase,
    round: run.round,
    scores: [...run.scores],
    hp: run.players.map((p) => p.hp),
    alive: run.players.map((p) => p.alive),
    matchWinner: run.matchWinner,
    humans: run.humans,
    roundWins: RULES.roundWins,
  };
}

export function drainEvents(run) { const e = run.events; run.events = []; return e; }
export { tileIdx, resetRound };