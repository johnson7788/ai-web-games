// 纯逻辑：横版跑酷射击（蓝方玩家 vs 红方 bot）。无 DOM / window / Date.now；RNG 可注入。
import { WORLD, GRAVITY, GROUND_Y, PLATFORMS, PLAYER, BULLET, RULES } from '../../config/game.config.js';

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

function spawnPoint(team, idx) {
  if (team === 0) return { x: 120, y: GROUND_Y };
  return { x: 1160 - idx * 60, y: GROUND_Y };
}

function mkPlayer(id, team, idx) {
  const sp = spawnPoint(team, idx);
  return {
    id, team, x: sp.x, y: sp.y, vx: 0, vy: 0,
    hp: PLAYER.HP, alive: true, respawnT: 0,
    isBot: id !== 0, onGround: true, jumps: 0,
    aim: team === 0 ? 0 : Math.PI, fireCd: 0, facing: team === 0 ? 1 : -1, jumpHeld: false,
  };
}

export function createRun({ seed = 1 } = {}) {
  const players = [mkPlayer(0, 0, 0)];
  for (let i = 0; i < RULES.botCount; i++) players.push(mkPlayer(i + 1, 1, i));
  return {
    phase: 'play',
    scores: [0, 0],
    winner: null,
    players,
    bullets: [],
    time: 0,
    events: [],
    rng: makeRng(seed),
  };
}

function fire(run, p, spread) {
  const ang = p.aim + (run.rng() - 0.5) * spread;
  const cy = p.y - PLAYER.H * 0.55;
  run.bullets.push({
    x: p.x + Math.cos(p.aim) * 20, y: cy + Math.sin(p.aim) * 20,
    vx: Math.cos(ang) * BULLET.SPEED, vy: Math.sin(ang) * BULLET.SPEED,
    team: p.team, owner: p.id, life: BULLET.LIFE,
  });
  p.fireCd = p.isBot ? RULES.botFireCd : PLAYER.FIRE_CD;
  run.events.push({ type: 'shoot', id: p.id });
}

function tryJump(run, p, want) {
  if (want && !p.jumpHeld && p.jumps < PLAYER.MAX_JUMPS) {
    p.vy = PLAYER.JUMP_V; p.jumps += 1; p.onGround = false;
    run.events.push({ type: 'jump', id: p.id });
  }
  p.jumpHeld = want;
}

function physics(run, p, dx, dt) {
  p.vx = dx * PLAYER.SPEED;
  if (dx !== 0) p.facing = dx > 0 ? 1 : -1;
  const prevY = p.y;
  p.vy += GRAVITY * dt;
  p.x = clamp(p.x + p.vx * dt, PLAYER.W / 2, WORLD.WIDTH - PLAYER.W / 2);
  p.y += p.vy * dt;
  p.onGround = false;
  for (const pl of PLATFORMS) {
    if (p.vy >= 0 && prevY <= pl.y + 1 && p.y >= pl.y &&
        p.x > pl.x - PLAYER.W / 2 && p.x < pl.x + pl.w + PLAYER.W / 2) {
      p.y = pl.y; p.vy = 0; p.onGround = true; p.jumps = 0;
    }
  }
  if (p.y > GROUND_Y) { p.y = GROUND_Y; p.vy = 0; p.onGround = true; p.jumps = 0; }
}

function botThink(run, p, dt) {
  let me = null, bd = 1e9;
  for (const q of run.players) {
    if (q.team === p.team || !q.alive) continue;
    const d = dist(p.x, p.y, q.x, q.y);
    if (d < bd) { bd = d; me = q; }
  }
  let dx = 0, jump = false, shoot = false;
  if (me) {
    const tx = me.x, ty = me.y - PLAYER.H / 2;
    const d = dist(p.x, p.y, me.x, me.y);
    if (Math.abs(tx - p.x) > 90) dx = tx > p.x ? 1 : -1;
    else if (d < 160) dx = tx > p.x ? -1 : 1;
    p.aim = Math.atan2(ty - (p.y - PLAYER.H * 0.55), tx - p.x);
    if (p.onGround && (me.y < p.y - 50 || run.rng() < 0.012)) jump = true;
    if (d < RULES.botRange && p.fireCd <= 0) shoot = true;
  } else {
    if (p.onGround && run.rng() < 0.01) jump = true;
  }
  tryJump(run, p, jump);
  physics(run, p, dx, dt);
  if (shoot) fire(run, p, RULES.botAccuracy);
}

function respawn(run, p) {
  const idx = p.team === 0 ? 0 : p.id - 1;
  const sp = spawnPoint(p.team, idx);
  p.x = sp.x; p.y = sp.y; p.vx = 0; p.vy = 0;
  p.hp = PLAYER.HP; p.alive = true; p.jumps = 0; p.fireCd = 0;
  run.events.push({ type: 'respawn', id: p.id });
}

function bulletHitsPlatform(b) {
  for (const pl of PLATFORMS) {
    if (b.x > pl.x && b.x < pl.x + pl.w && b.y > pl.y && b.y < pl.y + pl.h) return true;
  }
  return false;
}

function updateBullets(run, dt) {
  for (let i = run.bullets.length - 1; i >= 0; i--) {
    const b = run.bullets[i];
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    let dead = b.life <= 0 || b.x < 0 || b.x > WORLD.WIDTH || b.y < 0 || b.y > WORLD.HEIGHT || bulletHitsPlatform(b);
    if (!dead) {
      for (const q of run.players) {
        if (q.team === b.team || !q.alive) continue;
        const cx = q.x, cy = q.y - PLAYER.H / 2;
        if (Math.abs(b.x - cx) < PLAYER.W / 2 + BULLET.R && Math.abs(b.y - cy) < PLAYER.H / 2 + BULLET.R) {
          q.hp -= BULLET.DMG;
          run.events.push({ type: 'hit', id: q.id });
          if (q.hp <= 0) {
            q.alive = false; q.respawnT = PLAYER.RESPAWN;
            run.scores[b.team] += 1;
            run.events.push({ type: 'kill', killer: b.owner, victim: q.id, team: b.team });
          }
          dead = true; break;
        }
      }
    }
    if (dead) run.bullets.splice(i, 1);
  }
}

export function tick(run, dt, input = {}) {
  if (run.phase !== 'play') return;
  run.time += dt;
  for (const p of run.players) {
    if (p.fireCd > 0) p.fireCd -= dt;
    if (!p.alive) {
      p.respawnT -= dt;
      if (p.respawnT <= 0) respawn(run, p);
      continue;
    }
    if (p.isBot) {
      botThink(run, p, dt);
    } else {
      const dx = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      tryJump(run, p, !!input.jump);
      physics(run, p, dx, dt);
      if (typeof input.aim === 'number') p.aim = input.aim;
      if (input.shoot && p.fireCd <= 0) fire(run, p, 0.02);
    }
  }
  updateBullets(run, dt);
  for (let t = 0; t < 2; t++) {
    if (run.scores[t] >= RULES.killTarget) {
      run.phase = 'over'; run.winner = t;
      run.events.push({ type: 'win', winner: t });
      return;
    }
  }
}

export function getHud(run) {
  const me = run.players[0];
  return {
    phase: run.phase,
    scores: [...run.scores],
    winner: run.winner,
    killTarget: RULES.killTarget,
    hp: me.hp,
    alive: me.alive,
    jumps: me.jumps,
  };
}

export function drainEvents(run) { const e = run.events; run.events = []; return e; }