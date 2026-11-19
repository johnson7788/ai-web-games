// GUN GOD ARENA · 纯逻辑 sim（零 DOM，可被 node --test 与 tools/selfplay.mjs 直接驱动）
// P0 玩法规则 1:1 移植自参考源码（数值见 config/game.config.js 注释），主题换皮 + 新机制：
//   · 连击 combo：连续击碎全息靶叠加倍率，超时重置
//   · 道具箱 crate：子弹穿过即打爆，掉落补给(弹药+2)/三连发/加分/炸弹
//   · 岩石 rock：被子弹击中后坠落，碾压下方全息靶（免费击杀）
//   · VIP 中立目标：误伤立即失败（原 vip/injury 模式 1:1）
import {
  WORLD, STEP, GUN, BULLET, TARGET, CRATE, ROCK, POWERUP, COMBO, STAR_LEVELS,
} from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function clampAngle(a) {
  return clamp(a, -Math.PI + 0.12, -0.12);
}

function starsFor(shots, needs) {
  if (!needs || !needs.length) return 0;
  if (shots <= needs[0]) return 3;
  if (shots <= needs[1]) return 2;
  if (shots <= needs[2]) return 1;
  return 0;
}

export function createRun(opts = {}) {
  const seed = (opts.seed == null ? 1 : opts.seed) | 0;
  const rng = mulberry32(seed);

  const state = {
    phase: 'playing',            // playing | clear | result
    won: false,
    time: 0,
    level: 1,                    // 当前关卡（1-based）
    maxLevel: 1,
    score: 0,
    kills: 0,
    clearedCount: 0,
    bestCombo: 0,
    combo: 0,
    comboTimer: 0,
    triple: 0,
    bullets: 0,
    shotsUsed: 0,
    starNeeds: [0, 0, 0],
    levelStars: 0,
    clearTimer: 0,
    gunAngle: -Math.PI / 2,      // 0 = +x（右），-PI/2 = 正上
    targets: [],                 // { x, y } 可击碎全息靶
    vips: [],                    // { x, y } 中立目标，误伤即败
    crates: [],                  // { x, y, kind }
    rocks: [],                   // { x, y, falling, vy }
    powerups: [],                // { x, y, vy, kind }
    bulletsFlying: [],           // { x, y, vx, vy, bounces }
  };

  const events = [];

  function emit(type, payload = {}) {
    events.push({ type, ...payload });
  }

  function muzzlePos() {
    return {
      x: GUN.X + Math.cos(state.gunAngle) * GUN.LENGTH,
      y: GUN.Y + Math.sin(state.gunAngle) * GUN.LENGTH,
    };
  }

  function loadLevel(n) {
    const cfg = LEVELS[n - 1];
    state.level = n;
    state.maxLevel = Math.max(state.maxLevel, n);
    state.bullets = cfg.bullets;
    state.shotsUsed = 0;
    state.starNeeds = (cfg.starNeeds || [0, 0, 0]).slice();
    state.targets = cfg.targets.map((t) => ({ x: t.x, y: t.y }));
    state.vips = (cfg.vips || []).map((v) => ({ x: v.x, y: v.y }));
    state.crates = (cfg.crates || []).map((c) => ({ x: c.x, y: c.y, kind: c.kind }));
    state.rocks = (cfg.rocks || []).map((r) => ({ x: r.x, y: r.y, falling: false, vy: 0 }));
    state.powerups = [];
    state.bulletsFlying = [];
    state.combo = 0;
    state.comboTimer = 0;
    state.triple = 0;
    state.phase = 'playing';
    emit('spawn', { level: n, targets: state.targets.length, vips: state.vips.length });
  }

  function killTarget(t) {
    const i = state.targets.indexOf(t);
    if (i < 0) return;
    state.targets.splice(i, 1);
    state.kills += 1;
    state.combo += 1;
    state.bestCombo = Math.max(state.bestCombo, state.combo);
    state.comboTimer = COMBO.WINDOW;
    state.score += 100 * state.combo;
    emit('kill', { x: t.x, y: t.y, combo: state.combo });
    if (state.combo >= 2) emit('combo', { combo: state.combo });
  }

  function fail() {
    if (state.phase !== 'playing') return;
    state.phase = 'result';
    state.won = false;
    emit('fail', { score: state.score, level: state.level, kills: state.kills, cleared: state.clearedCount });
  }

  function failVip(v) {
    if (state.phase !== 'playing') return;
    state.phase = 'result';
    state.won = false;
    emit('vipfail', { x: v.x, y: v.y });
    emit('fail', { score: state.score, level: state.level, kills: state.kills, cleared: state.clearedCount, vip: true });
  }

  function win() {
    state.phase = 'result';
    state.won = true;
    emit('win', { score: state.score, level: state.level, kills: state.kills, cleared: state.clearedCount });
  }

  function levelClear() {
    state.phase = 'clear';
    state.clearTimer = 1.2;
    state.clearedCount += 1;
    state.levelStars = starsFor(state.shotsUsed, state.starNeeds);
    state.score += state.levelStars * 50;
    emit('levelclear', { level: state.level, stars: state.levelStars, shots: state.shotsUsed, score: state.score });
    state.bulletsFlying = [];
    state.powerups = [];
  }

  function collectPowerup(p) {
    const i = state.powerups.indexOf(p);
    if (i >= 0) state.powerups.splice(i, 1);
    if (p.kind === 'ammo') {
      state.bullets += 2;
      emit('pickup', { kind: 'ammo', bullets: state.bullets });
    } else if (p.kind === 'triple') {
      state.triple = 8;
      emit('pickup', { kind: 'triple' });
    } else if (p.kind === 'star') {
      state.score += 500;
      emit('pickup', { kind: 'star', score: state.score });
    } else if (p.kind === 'bomb') {
      emit('pickup', { kind: 'bomb' });
      emit('boom');
      if (state.targets.length) {
        const idx = Math.floor(rng() * state.targets.length);
        killTarget(state.targets[idx]);
      }
    }
  }

  function updateBullets(dt) {
    for (const b of state.bulletsFlying) {
      if (state.phase !== 'playing') break;
      b.x += b.vx * dt;
      b.y += b.vy * dt;

      // 墙反弹（左/右/上）
      if (b.x < BULLET.R) { b.x = BULLET.R; b.vx = Math.abs(b.vx); b.bounces += 1; emit('reflect'); }
      else if (b.x > WORLD.WIDTH - BULLET.R) { b.x = WORLD.WIDTH - BULLET.R; b.vx = -Math.abs(b.vx); b.bounces += 1; emit('reflect'); }
      if (b.y < WORLD.PLAY_TOP + BULLET.R) { b.y = WORLD.PLAY_TOP + BULLET.R; b.vy = Math.abs(b.vy); b.bounces += 1; emit('reflect'); }

      // 底部消耗
      if (b.y > WORLD.FLOOR_Y - BULLET.R) { b.dead = true; continue; }

      // VIP 误伤（优先）
      for (const v of state.vips) {
        const dx = b.x - v.x; const dy = b.y - v.y;
        if (dx * dx + dy * dy < (BULLET.R + TARGET.VIP_R) * (BULLET.R + TARGET.VIP_R)) {
          b.dead = true;
          failVip(v);
          break;
        }
      }
      if (b.dead) continue;

      // 可击碎全息靶（命中即消耗）
      for (const t of state.targets) {
        const dx = b.x - t.x; const dy = b.y - t.y;
        if (dx * dx + dy * dy < (BULLET.R + TARGET.R) * (BULLET.R + TARGET.R)) {
          b.dead = true;
          killTarget(t);
          break;
        }
      }
      if (b.dead) continue;

      // 道具箱（子弹穿过即打爆）
      for (let ci = state.crates.length - 1; ci >= 0; ci -= 1) {
        const c = state.crates[ci];
        const dx = b.x - c.x; const dy = b.y - c.y;
        if (dx * dx + dy * dy < (BULLET.R + CRATE.R) * (BULLET.R + CRATE.R)) {
          state.crates.splice(ci, 1);
          state.powerups.push({ x: c.x, y: c.y, vy: POWERUP.SPEED, kind: c.kind });
          emit('crate', { kind: c.kind, x: c.x, y: c.y });
        }
      }

      // 岩石（子弹穿过即激活坠落）
      for (const r of state.rocks) {
        if (r.falling) continue;
        const dx = b.x - r.x; const dy = b.y - r.y;
        if (dx * dx + dy * dy < (BULLET.R + ROCK.R) * (BULLET.R + ROCK.R)) {
          r.falling = true;
          r.vy = 0;
          emit('rock', { x: r.x, y: r.y });
        }
      }

      // 反弹次数上限
      if (b.bounces > BULLET.MAX_BOUNCES) b.dead = true;
    }
    state.bulletsFlying = state.bulletsFlying.filter((b) => !b.dead);
  }

  function updateRocks(dt) {
    for (const r of state.rocks) {
      if (!r.falling) continue;
      r.vy += ROCK.GRAVITY * dt;
      r.y += r.vy * dt;
      for (let ti = state.targets.length - 1; ti >= 0; ti -= 1) {
        const t = state.targets[ti];
        const dx = r.x - t.x; const dy = r.y - t.y;
        if (dx * dx + dy * dy < (ROCK.R + TARGET.R) * (ROCK.R + TARGET.R)) {
          killTarget(t);
          emit('crush', { x: t.x, y: t.y });
        }
      }
      if (r.y >= WORLD.FLOOR_Y - ROCK.R) {
        r.y = WORLD.FLOOR_Y - ROCK.R;
        r.falling = false;
        r.vy = 0;
      }
    }
  }

  function updatePowerups(dt) {
    for (let i = state.powerups.length - 1; i >= 0; i -= 1) {
      const p = state.powerups[i];
      p.y += p.vy * dt;
      if (p.y > WORLD.FLOOR_Y - 40) collectPowerup(p);
    }
  }

  function step(dt) {
    if (state.phase === 'result') return;

    if (state.phase === 'clear') {
      state.clearTimer -= dt;
      if (state.clearTimer <= 0) {
        if (state.level >= STAR_LEVELS || state.level >= LEVELS.length) win();
        else loadLevel(state.level + 1);
      }
      return;
    }

    // playing
    state.time += dt;
    state.comboTimer = Math.max(0, state.comboTimer - dt);
    if (state.comboTimer <= 0) state.combo = 0;
    if (state.triple > 0) state.triple = Math.max(0, state.triple - dt);

    updateBullets(dt);
    updateRocks(dt);
    updatePowerups(dt);

    // 过关判定
    if (state.phase === 'playing' && state.targets.length === 0) {
      levelClear();
      return;
    }
    // 失败判定：弹尽 + 无飞行弹 + 仍有目标
    if (state.phase === 'playing' && state.bullets <= 0 && state.bulletsFlying.length === 0 && state.targets.length > 0) {
      fail();
    }
  }

  function aimAt(x, y) {
    state.gunAngle = clampAngle(Math.atan2(y - GUN.Y, x - GUN.X));
    return { ok: true, angle: state.gunAngle };
  }

  function rotate(delta) {
    state.gunAngle = clampAngle(state.gunAngle + delta);
    return { ok: true, angle: state.gunAngle };
  }

  function fire() {
    if (state.phase !== 'playing') return { ok: false };
    if (state.bullets <= 0) { emit('noAmmo'); return { ok: false }; }
    state.bullets -= 1;
    state.shotsUsed += 1;
    const muzzle = muzzlePos();
    const spreads = state.triple > 0 ? [-0.16, 0, 0.16] : [0];
    for (const s of spreads) {
      const a = clampAngle(state.gunAngle + s);
      state.bulletsFlying.push({
        x: muzzle.x, y: muzzle.y,
        vx: Math.cos(a) * BULLET.SPEED,
        vy: Math.sin(a) * BULLET.SPEED,
        bounces: 0,
      });
    }
    emit('shot', { x: muzzle.x, y: muzzle.y });
    return { ok: true };
  }

  // 初始装载第 1 关
  loadLevel(1);
  emit('start', { level: 1 });

  return {
    state,
    input: {},               // 兼容主循环：真实输入走 aimAt / rotate / fire
    rng,
    step,
    fire,
    aimAt,
    rotate,
    stars() { return state.levelStars; },
    drainEvents() { return events.splice(0); },
  };
}

export { STEP, LEVELS, starsFor };
