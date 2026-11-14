// 纯逻辑：俯视角 4v4 阵营射击。无 DOM / window / Date.now；RNG 可注入。
// 结构：3 回合（先赢 2 回合）→ 每回合先达 15 击杀 / 120s；回合间三选一强化。
import {
  WORLD, ARENA, WALLS, SPAWNS, LOADOUTS, PERKS, RULES, ROUNDS,
} from '../../config/game.config.js';

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
const dist = (ax, ay, bx, by) => Math.hypot(ax - bx, ay - by);

function wallHit(x, y, r = 0, run = null) {
  if (run?.tutorial) return false;
  for (const w of WALLS) {
    if (x + r > w.x && x - r < w.x + w.w && y + r > w.y && y - r < w.y + w.h) return true;
  }
  return false;
}

function spawnPoint(team, idx) {
  const p = SPAWNS[team][idx % SPAWNS[team].length];
  return { x: p.x, y: p.y };
}

function mkPlayer(run, id, team, idx, loadoutId, isBot) {
  const load = LOADOUTS[loadoutId] || LOADOUTS.rifleman;
  const sp = spawnPoint(team, idx);
  return {
    id,
    team,
    x: sp.x + (run.rng() - 0.5) * 24,
    y: sp.y + (run.rng() - 0.5) * 30,
    hp: load.hp,
    maxHp: load.hp,
    baseMaxHp: load.hp,
    baseSpeed: load.speed,
    baseFireCd: load.fireCd,
    alive: true,
    respawnT: 0,
    isBot,
    isDummy: false,
    loadout: load.id,
    speed: load.speed,
    radius: load.radius,
    damage: load.damage,
    bulletSpeed: load.bulletSpeed,
    spread: load.spread,
    aim: team === 0 ? 0 : Math.PI,
    fireCd: 0,
    strafe: idx % 2 ? 1 : -1,
    strafeT: 0,
    kills: 0,
    deaths: 0,
    overdriveT: 0,
    dashT: 0,
    dashCd: 0,
    dashUsed: false,
    name: `${team === 0 ? 'B' : 'R'}${idx + 1}`,
  };
}

function resetTeams(run) {
  const me = mkPlayer(run, 0, 0, 0, run.loadout, false);
  me.name = 'YOU';
  run.players = [me];
  for (let i = 1; i < RULES.perTeam; i += 1) {
    const allyLoad = ['rifleman', 'scout', 'rifleman'][i - 1] || 'rifleman';
    run.players.push(mkPlayer(run, i, 0, i, allyLoad, true));
  }
  const enemies = ROUNDS[Math.min(run.round, ROUNDS.length - 1)].enemy;
  for (let i = 0; i < RULES.perTeam; i += 1) {
    run.players.push(mkPlayer(run, RULES.perTeam + i, 1, i, enemies[i] || 'rifleman', true));
  }
  if (run.perks.includes('armor')) { me.maxHp = me.baseMaxHp + 25; me.hp = me.maxHp; }
}

export function makeRun({ seed = 1, loadout = 'rifleman' } = {}) {
  const run = {
    phase: 'play',
    tutorial: false,
    tutorialStep: 0,
    tutorialAimT: 0,
    tutorialStart: null,
    round: 0,
    roundWins: [0, 0],
    roundWinner: null,
    matchWinner: null,
    scores: [0, 0],
    matchKills: 0,
    matchDeaths: 0,
    overtime: false,
    timeLeft: RULES.roundTime,
    loadout,
    perks: [],
    players: [],
    bullets: [],
    pickup: { x: 640, y: 390, active: false, timer: 14, pulse: 0 },
    events: [],
    rng: makeRng(seed),
    seed,
    time: 0,
  };
  resetTeams(run);
  run.phase = 'play';
  return run;
}

export const createRun = makeRun;

export function createTutorialRun() {
  const run = makeRun({ seed: 424242, loadout: 'rifleman' });
  run.tutorial = true;
  run.tutorialStep = 0;
  run.tutorialStart = { x: 280, y: 360 };
  run.timeLeft = 300;
  run.players = run.players.slice(0, 1);
  const me = run.players[0];
  me.x = 280; me.y = 360; me.hp = me.maxHp;
  const dummy = {
    id: 99, team: 1, x: 900, y: 560, hp: 100, maxHp: 100,
    alive: true, respawnT: 0, isBot: false, isDummy: true,
    loadout: 'rifleman', speed: 0, radius: 18, baseFireCd: 1, damage: 0,
    bulletSpeed: 0, spread: 0, aim: Math.PI, fireCd: 0, kills: 0, deaths: 0,
    overdriveT: 0, dashT: 0, dashCd: 0, dashUsed: false, name: 'TARGET',
  };
  run.players.push(dummy);
  run.pickup.active = false;
  run.events = [];
  return run;
}

function nearestEnemy(run, p) {
  let best = null; let bd = 1e9;
  for (const q of run.players) {
    if (q.team === p.team || !q.alive || q.isDummy) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < bd) { bd = d; best = q; }
  }
  return best ? { p: best, d: bd } : null;
}

function fire(run, p, spread) {
  if (!p.alive) return;
  const ang = p.aim + (run.rng() - 0.5) * spread;
  const speed = p.bulletSpeed;
  const over = p.overdriveT > 0;
  let dmg = p.damage + (over ? 5 : 0);
  if (p.team === 0 && p.isBot && run.perks.includes('leader')) dmg *= 1.2;
  run.bullets.push({
    x: p.x + Math.cos(p.aim) * (p.radius + 5),
    y: p.y + Math.sin(p.aim) * (p.radius + 5),
    vx: Math.cos(ang) * speed,
    vy: Math.sin(ang) * speed,
    team: p.team,
    owner: p.id,
    life: 1.1,
    damage: dmg,
    pierceLeft: p.id === 0 && run.perks.includes('pierce') ? 1 : 0,
    hits: [],
  });
  const rapid = p.id === 0 && run.perks.includes('rapid');
  p.fireCd = p.baseFireCd * (rapid ? 0.75 : 1) * (over ? 0.5 : 1);
  run.events.push({ type: 'shoot', id: p.id, team: p.team, over });
}

function movePlayer(run, p, dx, dy, dt) {
  let speed = p.baseSpeed;
  if (p.id === 0 && run.perks.includes('speed')) speed *= 1.12;
  if (p.dashT > 0) speed *= RULES.dashSpeed;
  const nx = clamp(p.x + dx * speed * dt, ARENA.x0 + p.radius, ARENA.x1 - p.radius);
  const ny = clamp(p.y + dy * speed * dt, ARENA.y0 + p.radius, ARENA.y1 - p.radius);
  const ox = p.x; const oy = p.y;
  if (!wallHit(nx, p.y, p.radius, run)) p.x = nx;
  if (!wallHit(p.x, ny, p.radius, run)) p.y = ny;
  return p.x !== ox || p.y !== oy;
}

function botThink(run, p, dt) {
  const tgt = nearestEnemy(run, p);
  let dx = 0; let dy = 0;
  const aggression = 1 + run.round * 0.08;
  if (tgt) {
    const e = tgt.p;
    const want = Math.atan2(e.y - p.y, e.x - p.x);
    let da = want - p.aim;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    p.aim += clamp(da, -7 * dt, 7 * dt);
    p.strafeT -= dt;
    if (p.strafeT <= 0) { p.strafe = run.rng() < 0.5 ? 1 : -1; p.strafeT = 0.7 + run.rng(); }
    const ux = Math.cos(want); const uy = Math.sin(want);
    if (tgt.d > RULES.botRange * 0.55) { dx = ux; dy = uy; }
    else if (tgt.d < 120) { dx = -ux; dy = -uy; }
    else { dx = -uy * p.strafe; dy = ux * p.strafe; }
    if (tgt.d < RULES.botRange && Math.abs(da) < 0.28 * aggression && p.fireCd <= 0) {
      fire(run, p, RULES.botAccuracy + (p.loadout === 'heavy' ? 0.04 : 0));
    }
  } else {
    const cx = 640; const cy = 390;
    const d = dist(p.x, p.y, cx, cy);
    if (d > 50) { dx = (cx - p.x) / d; dy = (cy - p.y) / d; }
  }
  let moved = movePlayer(run, p, dx, dy, dt);
  if (!moved && (dx || dy)) {
    const base = Math.atan2(dy, dx);
    for (const off of [0.65, -0.65, 1.25, -1.25, 2.0, -2.0]) {
      const a = base + off;
      moved = movePlayer(run, p, Math.cos(a), Math.sin(a), dt);
      if (moved) break;
    }
  }
}

function respawn(run, p) {
  const idx = p.id % RULES.perTeam;
  const sp = spawnPoint(p.team, idx);
  p.x = sp.x + (run.rng() - 0.5) * 30;
  p.y = sp.y + (run.rng() - 0.5) * 40;
  p.hp = p.maxHp;
  p.alive = true;
  p.fireCd = 0;
  p.overdriveT = 0;
  p.dashT = 0;
  p.dashCd = 0;
  if (p.id === 0) p.dashUsed = false;
  run.events.push({ type: 'respawn', id: p.id });
}

function onKill(run, killer, victim) {
  victim.alive = false;
  victim.hp = 0;
  victim.deaths += 1;
  if (victim.id === 0) run.matchDeaths += 1;
  victim.respawnT = RULES.respawn * (victim.id === 0 && run.perks.includes('respawn') ? 0.6 : 1);
  if (killer) {
    killer.kills += 1;
    if (killer.id === 0) run.matchKills += 1;
    run.scores[killer.team] += 1;
    if (killer.id === 0 && run.perks.includes('medic')) {
      killer.hp = Math.min(killer.maxHp, killer.hp + 30);
    }
    if (killer.id === 0 && run.perks.includes('overcharge')) killer.dashCd = 0;
  }
  run.events.push({
    type: 'kill',
    killer: killer ? killer.id : null,
    killerName: killer ? killer.name : '',
    victim: victim.id,
    victimName: victim.name,
    team: killer ? killer.team : null,
    x: victim.x,
    y: victim.y,
  });
}

function updateBullets(run, dt) {
  for (let i = run.bullets.length - 1; i >= 0; i -= 1) {
    const b = run.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || b.x < ARENA.x0 || b.x > ARENA.x1 || b.y < ARENA.y0 || b.y > ARENA.y1 || wallHit(b.x, b.y, 0, run);
    if (!dead) {
      for (const q of run.players) {
        if (q.team === b.team || !q.alive || b.hits.includes(q.id)) continue;
        if (dist(b.x, b.y, q.x, q.y) < q.radius + 4) {
          q.hp -= b.damage;
          b.hits.push(q.id);
          run.events.push({ type: 'hit', id: q.id, x: q.x, y: q.y, dmg: b.damage, team: b.team });
          if (q.hp <= 0) {
            const killer = run.players[b.owner];
            onKill(run, killer, q);
          }
          if (b.pierceLeft > 0) b.pierceLeft -= 1;
          else { dead = true; break; }
        }
      }
    }
    if (dead) run.bullets.splice(i, 1);
  }
}

function updatePickup(run, dt) {
  const pickup = run.pickup;
  if (!pickup) return;
  pickup.pulse += dt;
  if (!pickup.active) {
    pickup.timer -= dt;
    if (pickup.timer <= 0) {
      pickup.active = true;
      run.events.push({ type: 'pickupSpawn' });
    }
    return;
  }
  for (const p of run.players) {
    if (!p.alive) continue;
    if (dist(p.x, p.y, pickup.x, pickup.y) < p.radius + 18) {
      p.overdriveT = RULES.overdriveDuration;
      pickup.active = false;
      pickup.timer = RULES.overdriveEvery;
      run.events.push({ type: 'pickup', id: p.id, team: p.team });
      break;
    }
  }
}

function endRound(run, winner) {
  run.phase = 'roundOver';
  run.roundWinner = winner;
  run.roundWins[winner] += 1;
  if (run.roundWins[winner] >= RULES.roundsToWin) {
    run.phase = 'matchOver';
    run.matchWinner = winner;
    run.events.push({ type: 'matchWin', winner });
  } else {
    run.events.push({ type: 'roundEnd', winner, round: run.round });
  }
}

function checkRoundEnd(run) {
  if (run.tutorial) return;
  if (run.scores[0] >= RULES.killTarget || run.scores[1] >= RULES.killTarget) {
    endRound(run, run.scores[0] >= RULES.killTarget ? 0 : 1);
    return;
  }
  if (run.overtime && run.scores[0] !== run.scores[1]) {
    endRound(run, run.scores[0] > run.scores[1] ? 0 : 1);
    return;
  }
  if (run.timeLeft <= 0 && !run.overtime) {
    if (run.scores[0] === run.scores[1]) {
      run.overtime = true;
      run.events.push({ type: 'overtime' });
    } else {
      endRound(run, run.scores[0] > run.scores[1] ? 0 : 1);
    }
  }
}

function tutorialStepCheck(run, dt) {
  const me = run.players[0];
  const dummy = run.players[1];
  if (!me || !dummy) return;
  if (run.tutorialStep === 0) {
    if (dist(me.x, me.y, run.tutorialStart.x, run.tutorialStart.y) > 55) {
      run.tutorialStep = 1;
      run.events.push({ type: 'tutorialStep', step: 1 });
    }
  } else if (run.tutorialStep === 1) {
    const da = Math.abs(Math.atan2(dummy.y - me.y, dummy.x - me.x) - me.aim);
    if (da < 0.22) {
      run.tutorialAimT += dt;
      if (run.tutorialAimT > 0.22) {
        run.tutorialStep = 2;
        run.events.push({ type: 'tutorialStep', step: 2 });
      }
    } else {
      run.tutorialAimT = 0;
    }
  } else if (run.tutorialStep === 2) {
    if (!dummy.alive || dummy.hp <= 0) {
      dummy.alive = false;
      run.tutorialStep = 3;
      run.events.push({ type: 'tutorialStep', step: 3 });
    }
  } else if (run.tutorialStep === 3) {
    if (me.dashUsed) {
      run.tutorialStep = 4;
      run.phase = 'tutorialDone';
      run.events.push({ type: 'tutorialDone' });
    }
  }
}

export function tick(run, dt, input = {}) {
  if (run.phase !== 'play') return;
  run.time += dt;
  if (!run.tutorial) run.timeLeft = Math.max(0, run.timeLeft - dt);

  for (const p of run.players) {
    if (p.fireCd > 0) p.fireCd -= dt;
    if (p.dashCd > 0) p.dashCd -= dt;
    if (p.dashT > 0) p.dashT = Math.max(0, p.dashT - dt);
    if (p.overdriveT > 0) p.overdriveT = Math.max(0, p.overdriveT - dt);
    if (!p.alive) {
      if (p.isDummy) continue;
      p.respawnT -= dt;
      if (p.respawnT <= 0) respawn(run, p);
      continue;
    }
    if (p.isDummy) continue;
    if (p.isBot) {
      botThink(run, p, dt);
    } else {
      let dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      let dy = (input.down ? 1 : 0) - (input.up ? 1 : 0);
      if (dx && dy) { dx *= 0.7071; dy *= 0.7071; }
      if (input.dash && p.dashCd <= 0 && p.dashT <= 0) {
        p.dashT = RULES.dashDuration;
        p.dashCd = RULES.dashCooldown;
        p.dashUsed = true;
        run.events.push({ type: 'dash', id: p.id });
      }
      if (p.dashT > 0 && !dx && !dy) {
        dx = Math.cos(p.aim); dy = Math.sin(p.aim);
      }
      movePlayer(run, p, dx, dy, dt);
      if (typeof input.aim === 'number') p.aim = input.aim;
      if (input.shoot && p.fireCd <= 0) fire(run, p, p.spread);
    }
  }
  updateBullets(run, dt);
  updatePickup(run, dt);
  if (run.tutorial) {
    tutorialStepCheck(run, dt);
  } else {
    checkRoundEnd(run);
  }
}

export function getPerkChoices(run, count = 3) {
  const available = PERKS.filter((p) => !run.perks.includes(p.id));
  const rng = makeRng(run.seed + run.round * 97 + run.perks.length * 13);
  for (let i = available.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [available[i], available[j]] = [available[j], available[i]];
  }
  return available.slice(0, count);
}

export function nextRound(run, perkId) {
  if (run.phase !== 'roundOver') return { ok: false };
  if (perkId && PERKS.some((p) => p.id === perkId) && !run.perks.includes(perkId)) {
    run.perks.push(perkId);
  }
  run.round += 1;
  run.roundWinner = null;
  run.scores = [0, 0];
  run.overtime = false;
  run.timeLeft = RULES.roundTime;
  run.bullets = [];
  run.phase = 'play';
  run.pickup = { x: 640, y: 390, active: false, timer: 14, pulse: 0 };
  resetTeams(run);
  run.events.push({ type: 'roundStart', round: run.round });
  return { ok: true };
}

export function getHud(run) {
  const me = run.players[0];
  return {
    phase: run.phase,
    tutorial: run.tutorial,
    tutorialStep: run.tutorialStep,
    round: run.round + 1,
    roundWins: [...run.roundWins],
    scores: [...run.scores],
    timeLeft: Math.ceil(run.timeLeft),
    overtime: run.overtime,
    winner: run.roundWinner,
    matchWinner: run.matchWinner,
    killTarget: RULES.killTarget,
    loadout: run.loadout,
    perks: [...run.perks],
    hp: Math.max(0, Math.ceil(me.hp)),
    maxHp: me.maxHp,
    alive: me.alive,
    respawnT: Math.max(0, me.respawnT),
    dashCd: Math.max(0, me.dashCd),
    dashReady: me.dashCd <= 0,
    overdrive: Math.max(0, me.overdriveT),
    kills: run.matchKills,
    deaths: run.matchDeaths,
    roundKills: me.kills,
    roundDeaths: me.deaths,
    blueAlive: run.players.filter((p) => p.team === 0 && p.alive).length,
    redAlive: run.players.filter((p) => p.team === 1 && p.alive).length,
    pickupActive: !!run.pickup?.active,
  };
}

export function drainEvents(run) {
  const e = run.events;
  run.events = [];
  return e;
}
