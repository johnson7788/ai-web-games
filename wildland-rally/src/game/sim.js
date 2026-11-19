// WILDLAND RALLY · 纯逻辑模拟（无 DOM / 无渲染依赖，Node 可 import）
// 波次生存竞技场：玩家自动炮击最近敌人，闪烁(dash)逃生，新星(nova)爆发清场；
// 连击叠乘、击杀掉落/定时刷新道具、升级成长。清完 4 波胜利，血量为 0 失败。
// 确定性：同一 seed 产生同一局（mulberry32）。
import { WORLD, STEP, ENEMY, PLAYER, PICKUP, MATCH } from '../../config/game.config.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
const norm = (x, y) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};

function circleHit(cx, cy, r, px, py, pr) {
  return dist(cx, cy, px, py) < r + pr;
}


const WAVE_DEFS = [
  [{ t: 1, n: 3 }],
  [{ t: 1, n: 2 }, { t: 2, n: 2 }],
  [{ t: 2, n: 2 }, { t: 3, n: 2 }, { t: 2, n: 1, shield: true }],
  [{ t: 3, n: 2 }, { t: 3, n: 2, shield: true }, { t: 3, n: 1, champ: true }],
];

function spawnEnemy(run, t, opts = {}) {
  const cfg = ENEMY[t];
  const champ = !!opts.champ;
  const hp = champ ? cfg.hp * 2 : cfg.hp;
  const p = run.state.player;
  let x = 0; let y = 0; let tries = 0;
  do {
    x = WORLD.MIN_X + run._rng() * (WORLD.MAX_X - WORLD.MIN_X);
    y = WORLD.MIN_Y + run._rng() * (WORLD.MAX_Y - WORLD.MIN_Y);
    tries += 1;
  } while (dist(x, y, p.x, p.y) < 240 && tries < 60);
  const e = {
    id: run._nextId(),
    type: t,
    x, y,
    hp, maxHp: hp,
    speed: cfg.speed * (champ ? 0.9 : 1),
    dmg: champ ? cfg.dmg + 4 : cfg.dmg,
    fireCd: run._rng() * 0.6,
    radius: cfg.radius * (champ ? 1.2 : 1),
    shield: !!opts.shield,
    champ,
    score: champ ? 300 : cfg.score,
    color: cfg.color,
    hurt: 0,
  };
  run.state.enemies.push(e);
  run._emit('spawn', { id: e.id, kind: t });
  return e;
}

function makeRocks(run) {
  const rocks = [];
  const n = 5;
  let tries = 0;
  const cx = (WORLD.MIN_X + WORLD.MAX_X) / 2;
  const cy = (WORLD.MIN_Y + WORLD.MAX_Y) / 2;
  while (rocks.length < n && tries < 200) {
    tries += 1;
    const x = WORLD.MIN_X + 40 + run._rng() * (WORLD.MAX_X - WORLD.MIN_X - 80);
    const y = WORLD.MIN_Y + 40 + run._rng() * (WORLD.MAX_Y - WORLD.MIN_Y - 80);
    const r = 22 + run._rng() * 18;
    if (dist(x, y, cx, cy) < 120) continue;
    let ok = true;
    for (const ro of rocks) if (dist(x, y, ro.x, ro.y) < ro.r + r + 60) { ok = false; break; }
    if (ok) rocks.push({ x, y, r });
  }
  return rocks;
}

function makePickup(run, x, y, type) {
  const types = ['heal', 'shield', 'speed', 'magnet'];
  const t = type || types[Math.floor(run._rng() * types.length)];
  run.state.pickups.push({ id: run._nextId(), type: t, x, y, ttl: PICKUP.ttl, seed: run._rng() * 6.28 });
  if (run.state.pickups.length > PICKUP.maxField) run.state.pickups.shift();
}

function nearestEnemy(state, x, y) {
  let best = null; let bd = Infinity;
  for (const e of state.enemies) {
    if (e.hp <= 0) continue;
    const d = dist(x, y, e.x, e.y);
    if (d < bd) { bd = d; best = e; }
  }
  return best;
}

function applyDamageToEnemy(run, e, dmg, x, y) {
  if (e.hp <= 0) return;
  e.hurt = 0.12;
  if (e.shield) {
    e.shield = false;
    run._emit('shield', { id: e.id, enemy: true });
    return;
  }
  e.hp -= dmg;
  run._emit('hit', { id: e.id, dmg });
  if (e.hp <= 0) {
    e.hp = 0;
    onKill(run, e);
  }
}

function onKill(run, e) {
  run.state.combo += 1;
  run.state.comboTimer = MATCH.comboWindow;
  const mult = Math.min(run.state.combo, MATCH.comboMax);
  const gained = e.score * mult;
  run.state.score += gained;
  run.state.player.exp += PLAYER.expPerKill;
  while (run.state.player.exp >= PLAYER.expPerLevel && run.state.player.level < PLAYER.maxLevel) {
    run.state.player.exp -= PLAYER.expPerLevel;
    run.state.player.level += 1;
    run._emit('levelup', { level: run.state.player.level });
  }
  run._emit('kill', { id: e.id, score: gained, combo: run.state.combo, mult, x: e.x, y: e.y });
  if (run.state.combo >= 2) run._emit('combo', { n: run.state.combo });
  if (run._rng() < PICKUP.dropChance) {
    makePickup(run, e.x, e.y);
  }
  // 移除尸体（enemy 数组过滤在 step 统一做，这里标记 hp<=0）
}

export function createRun(opts = {}) {
  const seed = (opts.seed | 0) || 1;
  const rng = mulberry32(seed);
  const cx = (WORLD.MIN_X + WORLD.MAX_X) / 2;
  const cy = (WORLD.MIN_Y + WORLD.MAX_Y) / 2;

  const state = {
    phase: 'playing',          // playing | won | lost
    time: 0,
    wave: 0,                   // 当前波（1 基，0=未开始）
    waveTimer: 1.0,            // 首波延迟
    wavePending: true,
    score: 0,
    combo: 0,
    comboTimer: 0,
    bestCombo: 0,
    pickupTimer: PICKUP.interval,
    player: {
      x: cx, y: cy,
      hp: PLAYER.hp, maxHp: PLAYER.hp,
      speed: PLAYER.speed,
      radius: PLAYER.radius,
      level: 1, exp: 0,
      cd: 0, dashCd: 0, novaCd: 0,
      invuln: 0, shieldT: 0, speedT: 0, magnetT: 0,
      dirx: 0, diry: 0, aimx: 1, aimy: 0,
      alive: true,
    },
    enemies: [],
    pickups: [],
    rocks: makeRocks({ _rng: rng }),
    projectiles: [],
  };

  const run = {
    state,
    _seed: seed,
    _rng: rng,
    _idc: 0,
    _events: [],
    _in: { dx: 0, dy: 0, dash: false, nova: false },
    _pickupSpawnAt: 0,

    _nextId() {
      this._idc += 1;
      return this._idc;
    },

    _emit(type, payload = {}) {
      this._events.push({ type, ...payload });
    },

    move(dx, dy) {
      if (state.phase !== 'playing') return { ok: false };
      if (dx === 0 && dy === 0) { this._in.dx = 0; this._in.dy = 0; return { ok: true }; }
      const n = norm(dx, dy);
      this._in.dx = n.x;
      this._in.dy = n.y;
      return { ok: true };
    },

    dash() {
      if (state.phase !== 'playing') return { ok: false };
      if (state.player.dashCd > 0) return { ok: false };
      this._in.dash = true;
      return { ok: true };
    },

    nova() {
      if (state.phase !== 'playing') return { ok: false };
      if (state.player.novaCd > 0) return { ok: false };
      this._in.nova = true;
      return { ok: true };
    },

    getHud() {
      const p = state.player;
      return {
        wave: state.wave,
        time: state.time,
        score: state.score,
        combo: state.combo,
        hp: Math.max(0, Math.round(p.hp)),
        maxHp: p.maxHp,
        level: p.level,
        targets: state.enemies.filter((e) => e.hp > 0).length,
        dashCd: p.dashCd,
        novaCd: p.novaCd,
        shieldT: p.shieldT,
        speedT: p.speedT,
        magnetT: p.magnetT,
        phase: state.phase,
      };
    },

    drainEvents() {
      const ev = this._events;
      this._events = [];
      return ev;
    },

    step(dt) {
      if (state.phase !== 'playing') return;
      const p = state.player;
      state.time += dt;
      state.comboTimer = Math.max(0, state.comboTimer - dt);
      if (state.comboTimer === 0 && state.combo > 0) {
        if (state.combo > state.bestCombo) state.bestCombo = state.combo;
        state.combo = 0;
      }

      // 冷却
      p.cd = Math.max(0, p.cd - dt);
      p.dashCd = Math.max(0, p.dashCd - dt);
      p.novaCd = Math.max(0, p.novaCd - dt);
      p.invuln = Math.max(0, p.invuln - dt);
      p.shieldT = Math.max(0, p.shieldT - dt);
      p.speedT = Math.max(0, p.speedT - dt);
      p.magnetT = Math.max(0, p.magnetT - dt);

      // ---- 玩家移动 ----
      const spd = p.speed + (p.speedT > 0 ? PICKUP.speedBoost : 0);
      let mx = this._in.dx * spd * dt;
      let my = this._in.dy * spd * dt;
      if (mx !== 0 || my !== 0) {
        p.dirx = this._in.dx; p.diry = this._in.dy;
      }
      p.x = clamp(p.x + mx, WORLD.MIN_X, WORLD.MAX_X);
      p.y = clamp(p.y + my, WORLD.MIN_Y, WORLD.MAX_Y);
      pushOutOfRocks(p, state.rocks);

      // ---- 玩家技能 ----
      if (this._in.dash) {
        let aim;
        if (p.dirx !== 0 || p.diry !== 0) {
          const dl = Math.hypot(p.dirx, p.diry) || 1;
          aim = { x: p.dirx / dl, y: p.diry / dl };
        } else {
          aim = this._aim();
        }
        let nx = p.x + aim.x * PLAYER.dashDist;
        let ny = p.y + aim.y * PLAYER.dashDist;
        nx = clamp(nx, WORLD.MIN_X, WORLD.MAX_X);
        ny = clamp(ny, WORLD.MIN_Y, WORLD.MAX_Y);
        // 落点撞岩石则停在岩石前
        const probe = { x: nx, y: ny };
        pushOutOfRocks(probe, state.rocks);
        p.x = probe.x; p.y = probe.y;
        p.invuln = PLAYER.dashInvuln;
        p.dashCd = PLAYER.dashCd;
        this._emit('dash', { x: p.x, y: p.y });
      }
      if (this._in.nova) {
        p.novaCd = PLAYER.novaCd;
        this._emit('nova', { x: p.x, y: p.y });
        for (const e of state.enemies) {
          if (e.hp <= 0) continue;
          if (dist(p.x, p.y, e.x, e.y) < PLAYER.novaRadius) {
            applyDamageToEnemy(this, e, PLAYER.novaDmg, p.x, p.y);
          }
        }
      }
      this._in.dash = false;
      this._in.nova = false;

      // ---- 玩家自动炮击 ----
      p.aimx = p.dirx || 1; p.aimy = p.diry || 0;
      const target = nearestEnemy(state, p.x, p.y);
      if (target) { p.aimx = target.x - p.x; p.aimy = target.y - p.y; const al = Math.hypot(p.aimx, p.aimy) || 1; p.aimx /= al; p.aimy /= al; }
      if (target && p.cd <= 0 && dist(p.x, p.y, target.x, target.y) <= PLAYER.basicRange) {
        const dmg = Math.round(PLAYER.basicDmg * (1 + PLAYER.dmgPerLevel * (p.level - 1)));
        const a = norm(p.aimx, p.aimy);
        state.projectiles.push({
          id: this._nextId(), from: 'player', x: p.x, y: p.y,
          vx: a.x * PLAYER.projSpeed, vy: a.y * PLAYER.projSpeed, dmg,
        });
        p.cd = PLAYER.basicCd;
        this._emit('shot', {});
      }

      // ---- 敌人 AI（搜索→追击→开火）----
      for (const e of state.enemies) {
        if (e.hp <= 0) continue;
        e.hurt = Math.max(0, e.hurt - dt);
        e.fireCd -= dt;
        const d = dist(e.x, e.y, p.x, p.y);
        if (d > PLAYER.fireRange) {
          const a = norm(p.x - e.x, p.y - e.y);
          e.x += a.x * e.speed * dt;
          e.y += a.y * e.speed * dt;
        } else {
          // 近距离微侧移，避免完全重叠
          const strafe = Math.sin(state.time * 3 + e.id) * e.speed * 0.4 * dt;
          const a = norm(p.x - e.x, p.y - e.y);
          e.x += -a.y * strafe;
          e.y += a.x * strafe;
          if (e.fireCd <= 0) {
            const b = norm(p.x - e.x, p.y - e.y);
            state.projectiles.push({
              id: this._nextId(), from: 'enemy', x: e.x, y: e.y,
              vx: b.x * ENEMY[e.type].projSpeed, vy: b.y * ENEMY[e.type].projSpeed,
              dmg: e.dmg, owner: e.id,
            });
            e.fireCd = ENEMY[e.type].fireCd;
            this._emit('eshoot', {});
          }
        }
        e.x = clamp(e.x, WORLD.MIN_X, WORLD.MAX_X);
        e.y = clamp(e.y, WORLD.MIN_Y, WORLD.MAX_Y);
        pushOutOfRocks(e, state.rocks);
      }

      // ---- 子弹 ----
      for (const pr of state.projectiles) {
        pr.x += pr.vx * dt;
        pr.y += pr.vy * dt;
        // 出界/撞岩石
        if (pr.x < WORLD.MIN_X || pr.x > WORLD.MAX_X || pr.y < WORLD.MIN_Y || pr.y > WORLD.MAX_Y) { pr.dead = true; continue; }
        for (const ro of state.rocks) {
          if (circleHit(pr.x, pr.y, 3, ro.x, ro.y, ro.r)) { pr.dead = true; break; }
        }
        if (pr.dead) continue;
        if (pr.from === 'player') {
          for (const e of state.enemies) {
            if (e.hp <= 0) continue;
            if (circleHit(pr.x, pr.y, 4, e.x, e.y, e.radius)) {
              applyDamageToEnemy(this, e, pr.dmg, pr.x, pr.y);
              pr.dead = true;
              break;
            }
          }
        } else {
          if (circleHit(pr.x, pr.y, 4, p.x, p.y, p.radius)) {
            if (p.invuln <= 0 && p.shieldT <= 0) {
              p.hp -= pr.dmg;
              this._emit('ehit', { dmg: pr.dmg });
            }
            pr.dead = true;
          }
        }
      }
      state.projectiles = state.projectiles.filter((pr) => !pr.dead);

      // ---- 拾取 ----
      for (const pk of state.pickups) {
        pk.ttl -= dt;
        if (pk.ttl <= 0) { pk.dead = true; continue; }
        if (circleHit(pk.x, pk.y, 12, p.x, p.y, p.radius + (p.magnetT > 0 ? 90 : 0))) {
          applyPickup(this, pk);
          pk.dead = true;
        }
      }
      state.pickups = state.pickups.filter((pk) => !pk.dead);

      // ---- 定时刷新道具 ----
      state.pickupTimer -= dt;
      if (state.pickupTimer <= 0) {
        state.pickupTimer = PICKUP.interval;
        if (state.pickups.length < PICKUP.maxField) {
          const x = WORLD.MIN_X + 40 + this._rng() * (WORLD.MAX_X - WORLD.MIN_X - 80);
          const y = WORLD.MIN_Y + 40 + this._rng() * (WORLD.MAX_Y - WORLD.MIN_Y - 80);
          makePickup(this, x, y);
        }
      }

      // ---- 波次推进 ----
      state.enemies = state.enemies.filter((e) => e.hp > 0);
      if (state.wavePending) {
        state.waveTimer -= dt;
        if (state.waveTimer <= 0) {
          state.wave += 1;
          state.wavePending = false;
          this._emit('wave', { n: state.wave });
          const def = WAVE_DEFS[state.wave - 1] || [];
          for (const grp of def) {
            for (let i = 0; i < grp.n; i += 1) spawnEnemy(this, grp.t, grp);
          }
        }
      } else if (state.enemies.length === 0) {
        if (state.wave >= MATCH.waves) {
          state.phase = 'won';
          this._emit('win', { score: state.score, hp: p.hp });
        } else {
          state.wavePending = true;
          state.waveTimer = MATCH.waveGap;
        }
      }

      // ---- 玩家死亡 ----
      if (p.hp <= 0 && p.alive) {
        p.hp = 0;
        p.alive = false;
        state.phase = 'lost';
        this._emit('lose', { score: state.score, wave: state.wave });
      }
    },

    _aim() {
      const p = state.player;
      const t = nearestEnemy(state, p.x, p.y);
      if (t) return norm(t.x - p.x, t.y - p.y);
      if (p.dirx !== 0 || p.diry !== 0) return norm(p.dirx, p.diry);
      return { x: 1, y: 0 };
    },
  };

  return run;
}

function pushOutOfRocks(e, rocks) {
  for (const ro of rocks) {
    const d = dist(e.x, e.y, ro.x, ro.y);
    const min = ro.r + (e.radius ?? 0) + 4;
    if (d < min && d > 0.001) {
      const push = (min - d) / d;
      e.x += (e.x - ro.x) * push;
      e.y += (e.y - ro.y) * push;
    }
  }
}

function applyPickup(run, pk) {
  const p = run.state.player;
  if (pk.type === 'heal') {
    p.hp = Math.min(p.maxHp, p.hp + PICKUP.heal);
  } else if (pk.type === 'shield') {
    p.shieldT = PICKUP.shieldTime;
  } else if (pk.type === 'speed') {
    p.speedT = PICKUP.speedTime;
  } else if (pk.type === 'magnet') {
    p.magnetT = PICKUP.magnetTime;
  }
  run._emit('pickup', { kind: pk.type, x: pk.x, y: pk.y });
}
