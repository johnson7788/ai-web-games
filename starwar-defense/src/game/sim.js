// 纯逻辑模拟器（无 DOM）：霓虹街机星际防线。
// 60Hz 固定步长；事件通过 drainEvents() 消费；selfplay / tests 直接 import。
import { WORLD, TUNE } from '../../config/game.config.js';
import { levelConfig } from './level.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let NEXT_ID = 1;
function nid() { return NEXT_ID++; }

function dist(ax, ay, bx, by) {
  const dx = ax - bx;
  const dy = ay - by;
  return Math.sqrt(dx * dx + dy * dy);
}

const POWERUP_TYPES = ['rapid', 'freeze', 'shield'];

export function createRun(levelIndex = 0, opts = {}) {
  const seed = (opts.seed == null ? 1 : opts.seed) >>> 0;
  const rng = mulberry32(seed);
  const cfg = levelConfig(levelIndex);
  const W = WORLD.W;
  const BASE_Y = WORLD.BASE_Y;

  const state = {
    phase: 'playing', // playing | won | lost
    level: cfg && Math.max(1, (levelIndex | 0) + 1),
    time: 0,
    seed,
    enemies: [],
    bullets: [],
    powerups: [],
    turrets: [
      { x: W / 2, y: BASE_Y, unlocked: true, auto: false, cd: 0 },
      { x: W / 2 - 230, y: BASE_Y, unlocked: cfg.unlock2, auto: true, cd: 0 },
      { x: W / 2 + 230, y: BASE_Y, unlocked: cfg.unlock3, auto: true, cd: 0 },
    ],
    kills: 0,
    leaks: 0,
    score: 0,
    combo: 0,
    bestCombo: 0,
    energy: 0,
    fireCooldown: 0,
    rapidUntil: 0,
    freezeUntil: 0,
    shield: 0,
    wavesSpawned: 0,
    spawnedCount: 0,
    totalToSpawn: cfg.waveCount * cfg.enemiesPerWave + (cfg.boss ? 1 : 0),
    spawnTimer: 0.35, // 首波很快出现
    bossSpawned: false,
    bossTimer: 0,
    stars: 0,
    reason: null,
    events: [],
  };

  const cfg2 = cfg;

  function emit(type, payload = {}) {
    state.events.push({ type, ...payload });
  }

  function nearestEnemy(fromX, fromY) {
    let best = null;
    let bestD = Infinity;
    for (const e of state.enemies) {
      const d = dist(fromX, fromY, e.x, e.y);
      if (d < bestD) { bestD = d; best = e; }
    }
    return best;
  }

  function spawnBullet(tx, ty, damage, target, speed) {
    const bullet = {
      id: nid(),
      x: tx,
      y: ty,
      vx: 0,
      vy: -1,
      speed,
      damage,
      targetId: target ? target.id : null,
      dead: false,
      from: 'player',
    };
    if (target) {
      const d = Math.max(1, dist(tx, ty, target.x, target.y));
      bullet.vx = (target.x - tx) / d;
      bullet.vy = (target.y - ty) / d;
    }
    state.bullets.push(bullet);
  }

  function fireMain(burstCount, auto) {
    if (state.fireCooldown > 0) return false;
    const t = state.turrets[0];
    const target = nearestEnemy(t.x, t.y - 40);
    const rapid = state.time < state.rapidUntil;
    const n = rapid ? Math.max(2, burstCount + 1) : burstCount;
    for (let i = 0; i < n; i += 1) {
      spawnBullet(t.x + (i - (n - 1) / 2) * 18, t.y - 46, TUNE.MAIN_DAMAGE, target, TUNE.MAIN_BULLET_SPEED);
    }
    state.fireCooldown = rapid ? TUNE.MAIN_COOLDOWN * 0.6 : TUNE.MAIN_COOLDOWN;
    emit('shot', { x: t.x, y: t.y - 46, auto: !!auto, burst: n });
    return true;
  }

  function sideFire(t) {
    const target = nearestEnemy(t.x, t.y - 30);
    if (!target) return;
    spawnBullet(t.x, t.y - 40, TUNE.SIDE_DAMAGE, target, TUNE.SIDE_BULLET_SPEED);
    t.cd = TUNE.SIDE_COOLDOWN;
    emit('shot', { x: t.x, y: t.y - 40, auto: true, burst: 1 });
  }

  function spawnEnemy(e) {
    state.enemies.push(e);
    state.spawnedCount += 1;
    if (e.type === 'boss') emit('boss', { x: e.x, y: e.y, hp: e.hp });
    else emit('wave', { index: state.wavesSpawned });
  }

  function spawnWave() {
    const n = cfg2.enemiesPerWave;
    for (let i = 0; i < n; i += 1) {
      const x = 60 + rng() * (W - 120);
      const y = 72 + rng() * 26; // 从 HUD 下方生成，避免被顶部状态条遮挡
      const type = rng() < 0.22 ? 'tank' : 'drone';
      const hpMul = type === 'tank' ? 1.9 : 1;
      spawnEnemy({
        id: nid(),
        x,
        y,
        hp: Math.round(cfg2.enemyHp * hpMul),
        maxHp: Math.round(cfg2.enemyHp * hpMul),
        speed: cfg2.enemySpeed * (type === 'tank' ? 0.8 : 1),
        size: type === 'tank' ? 54 : 40,
        type,
        dead: false,
      });
    }
    state.wavesSpawned += 1;
  }

  function spawnBoss() {
    const x = W / 2;
    spawnEnemy({
      id: nid(),
      x,
      y: 84,
      hp: cfg2.bossHp,
      maxHp: cfg2.bossHp,
      speed: cfg2.bossSpeed,
      size: 84,
      type: 'boss',
      dead: false,
    });
  }

  function comboMultiplier() {
    return Math.min(8, 1 + Math.floor(state.combo / 4));
  }

  function killEnemy(e, viaBlast) {
    e.dead = true;
    state.kills += 1;
    state.combo += 1;
    if (state.combo > state.bestCombo) state.bestCombo = state.combo;
    const mult = comboMultiplier();
    state.score += TUNE.COMBO_SCORE * mult;
    if (!viaBlast) state.energy = Math.min(TUNE.MAX_ENERGY, state.energy + TUNE.KILL_ENERGY);
    emit('kill', { x: e.x, y: e.y, type: e.type, combo: state.combo, mult });
    if (state.combo > 0 && state.combo % 4 === 0) emit('combo', { combo: state.combo, mult });
    if (!viaBlast && rng() < TUNE.DROP_RATE) {
      const pt = POWERUP_TYPES[Math.floor(rng() * POWERUP_TYPES.length)];
      const pu = { id: nid(), x: e.x, y: e.y, type: pt, dead: false };
      state.powerups.push(pu);
      emit('powerup', { x: pu.x, y: pu.y, type: pt, id: pu.id });
    }
  }

  function leakEnemy(e) {
    e.dead = true;
    if (state.shield > 0) {
      state.shield -= 1;
      state.score += 30;
      emit('shield', { x: e.x });
      return;
    }
    state.leaks += 1;
    state.combo = 0;
    emit('leak', { x: e.x, leaks: state.leaks, limit: cfg2.leakLimit });
  }

  function applyPowerup(p) {
    p.dead = true;
    if (p.type === 'rapid') state.rapidUntil = state.time + TUNE.RAPID_SEC;
    else if (p.type === 'freeze') state.freezeUntil = state.time + TUNE.FREEZE_SEC;
    else if (p.type === 'shield') state.shield += 1;
    emit('collect', { x: p.x, y: p.y, type: p.type });
  }

  function checkEnd() {
    if (state.phase !== 'playing') return;
    if (state.leaks >= cfg2.leakLimit) {
      state.phase = 'lost';
      state.reason = 'breach';
      state.stars = 0;
      emit('lose', { reason: 'breach', leaks: state.leaks, score: state.score, level: state.level });
      return;
    }
    if (state.spawnedCount >= state.totalToSpawn && state.enemies.length === 0) {
      state.phase = 'won';
      state.reason = 'clear';
      state.stars = state.leaks === 0 ? 3 : state.leaks <= 2 ? 2 : state.leaks <= 4 ? 1 : 0;
      state.score += 100 + state.level * 50 + state.stars * 100;
      emit('win', { stars: state.stars, leaks: state.leaks, score: state.score, level: state.level, combo: state.bestCombo });
    }
  }

  function step(dt) {
    if (state.phase !== 'playing') return;
    state.time += dt;

    // 副炮自动开火
    for (let i = 1; i < state.turrets.length; i += 1) {
      const t = state.turrets[i];
      if (!t.unlocked) continue;
      t.cd -= dt;
      if (t.cd <= 0 && state.enemies.length > 0) sideFire(t);
    }

    // 主炮冷却
    if (state.fireCooldown > 0) state.fireCooldown -= dt;

    // 生成敌人
    if (!cfg2.boss) {
      if (state.wavesSpawned < cfg2.waveCount) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) { state.spawnTimer = cfg2.spawnInterval; spawnWave(); }
      }
    } else {
      if (state.wavesSpawned < cfg2.waveCount) {
        state.spawnTimer -= dt;
        if (state.spawnTimer <= 0) { state.spawnTimer = cfg2.spawnInterval; spawnWave(); }
      } else if (!state.bossSpawned) {
        state.bossTimer += dt;
        if (state.bossTimer >= 1.2) { state.bossTimer = 0; spawnBoss(); state.bossSpawned = true; }
      }
    }

    // 敌人移动（freeze 减速）
    const freeze = state.time < state.freezeUntil;
    const spdMul = freeze ? TUNE.FREEZE_FACTOR : 1;
    const aliveEnemies = [];
    for (const e of state.enemies) {
      if (e.dead) continue;
      e.y += e.speed * spdMul * dt;
      if (e.y >= BASE_Y - e.size) leakEnemy(e);
      else aliveEnemies.push(e);
    }
    state.enemies = aliveEnemies;

    // 子弹移动（追踪目标，否则直线向上）
    const aliveBullets = [];
    for (const b of state.bullets) {
      if (b.dead) continue;
      let tx = null;
      let ty = null;
      if (b.targetId != null) {
        for (const e of state.enemies) {
          if (e.id === b.targetId) { tx = e.x; ty = e.y; break; }
        }
      }
      if (tx != null) {
        const d = Math.max(1, dist(b.x, b.y, tx, ty));
        b.vx = (tx - b.x) / d;
        b.vy = (ty - b.y) / d;
      }
      b.x += b.vx * b.speed * dt;
      b.y += b.vy * b.speed * dt;
      if (b.y < -50 || b.y > BASE_Y + 80 || b.x < -60 || b.x > W + 60) b.dead = true;
      else aliveBullets.push(b);
    }
    state.bullets = aliveBullets;

    // 道具下落，到基座自动拾取
    const alivePu = [];
    for (const p of state.powerups) {
      if (p.dead) continue;
      p.y += TUNE.POWERUP_SPEED * dt;
      if (p.y >= BASE_Y - 20) applyPowerup(p);
      else alivePu.push(p);
    }
    state.powerups = alivePu;

    // 子弹 × 敌人碰撞
    for (const b of state.bullets) {
      if (b.dead) continue;
      for (const e of state.enemies) {
        if (e.dead) continue;
        if (dist(b.x, b.y, e.x, e.y) <= e.size + 8) {
          e.hp -= b.damage;
          b.dead = true;
          emit('hit', { x: e.x, y: e.y });
          if (e.hp <= 0) killEnemy(e, false);
          break;
        }
      }
    }
    state.bullets = state.bullets.filter((b) => !b.dead);
    state.enemies = state.enemies.filter((e) => !e.dead);

    checkEnd();
  }

  return {
    state,
    get cfg() { return cfg2; },
    step,
    drainEvents() {
      const ev = state.events;
      state.events = [];
      return ev;
    },
    // 主炮连点/按住开火（一次一发或一发 burst）
    fire() {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (fireMain(1, false)) return { ok: true };
      return { ok: false, reason: 'cooldown' };
    },
    // 大招：能量满 → 全屏清场
    blast() {
      if (state.phase !== 'playing') return { ok: false, reason: 'phase' };
      if (state.energy < TUNE.MAX_ENERGY) return { ok: false, reason: 'energy' };
      state.energy = 0;
      const cleared = state.enemies.length;
      for (const e of state.enemies) if (!e.dead) killEnemy(e, true);
      state.enemies = [];
      emit('blast', { cleared });
      state.score += cleared * 5;
      return { ok: true, cleared };
    },
    // 道具（触点拾取；基座自动拾取走 step）
    collect(id) {
      if (state.phase !== 'playing') return { ok: false };
      const p = state.powerups.find((x) => x.id === id);
      if (!p || p.dead) return { ok: false };
      applyPowerup(p);
      state.powerups = state.powerups.filter((x) => !x.dead);
      return { ok: true, type: p.type };
    },
    getHud() {
      return {
        level: state.level,
        kills: state.kills,
        leaks: state.leaks,
        leakLimit: this.cfg.leakLimit,
        score: state.score,
        combo: state.combo,
        bestCombo: state.bestCombo,
        energy: state.energy,
        shield: state.shield,
        remaining: Math.max(0, state.totalToSpawn - state.spawnedCount + state.enemies.length),
      };
    },
  };
}
