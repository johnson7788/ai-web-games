// BUBBLE BRAWL IO · 纯逻辑（无 DOM，可被 node --test 与 selfplay 直接 import）
//
// 玩法状态机：
//   炮塔在底部左右滑动（回中）；向上发射气泡；
//   气泡穿过旋转圆环的缺口（+分）或被实心环反弹（下落、可能砸到自己）；
//   气泡命中顶部核心造成伤害；核心向下发射尖刺还击；
//   击破核心 = 过关；炮塔生命归零 = 失败。
import { WORLD, TURRET, STEP } from '../../config/game.config.js';
import { LEVELS, getLevel } from '../../config/levels.js';

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** 圆周角距离（0..π） */
export function circDist(a, b) {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/** φ 是否落在缺口（两个对向缺口：angle 与 angle+π，各 gapArc 全弧角）内 */
export function inGap(phi, angle, gapArc) {
  const half = gapArc / 2;
  return circDist(phi, angle) <= half || circDist(phi, angle + Math.PI) <= half;
}

/** 从炮塔 x 出发的竖直弹道能否穿过该圆环（|dx|≥radius 视为不挡道） */
export function ringClear(ring, dx) {
  const R = ring.radius;
  if (Math.abs(dx) >= R) return true;
  const h = Math.sqrt(R * R - dx * dx);
  const phi = Math.atan2(h, dx);
  return inGap(phi, ring.angle, ring.gapArc);
}

export function createRun(levelIndex = 0, opts = {}) {
  const seed = opts.seed ?? 1;
  const rng = mulberry32(seed);
  const level = getLevel(levelIndex);

  const rings = level.rings.map((r) => ({
    radius: r.radius,
    speed: r.speed,
    dir: r.dir,
    gapArc: (r.gapArc * Math.PI) / 180,
    angle: ((r.phase ?? 90) * Math.PI) / 180,
  }));

  const rocks = [];
  const rockCount = level.rocks || 0;
  for (let i = 0; i < rockCount; i += 1) {
    rocks.push({
      angle: (i * 2 * Math.PI) / rockCount + Math.PI / 3,
      radius: 92,
      speed: 0.9 + i * 0.05,
      r: 14,
      alive: true,
    });
  }

  const state = {
    phase: 'playing', // playing | won | lost
    levelIndex,
    level,
    time: 0,
    turret: { x: WORLD.CX, hearts: TURRET.HEARTS, cooldown: 0 },
    core: { hp: level.coreHp, maxHp: level.coreHp },
    rings,
    rocks,
    bubbles: [],
    spikes: [],
    spikeTimer: level.spikeInterval * 0.6,
    combo: 0,
    maxCombo: 0,
    score: 0,
    shots: 0,
    hits: 0,
    gaps: 0,
    stars: 0,
    events: [],
  };

  const input = { left: false, right: false };
  const ev = state.events;
  const emit = (type, payload = {}) => ev.push({ type, ...payload });

  function hurt() {
    if (state.turret.hearts <= 0) return;
    state.turret.hearts -= 1;
    emit('hurt', { hearts: state.turret.hearts });
    if (state.turret.hearts <= 0) {
      state.phase = 'lost';
      emit('lose', { score: state.score });
    }
  }

  function computeStars() {
    const par = state.level.par || 10;
    if (state.shots <= par) return 3;
    if (state.shots <= Math.ceil(par * 1.6)) return 2;
    return 1;
  }

  function winLevel() {
    if (state.phase !== 'playing') return;
    state.phase = 'won';
    state.stars = computeStars();
    emit('win', { level: state.levelIndex + 1, stars: state.stars, score: state.score });
    if (state.level.unlock) emit('levelup', { unlock: state.level.unlock });
  }

  function hitCore(b) {
    const mult = 1 + TURRET.COMBO_PER_STEP * Math.min(state.combo, TURRET.COMBO_MAX);
    let dmg = TURRET.BASE_DAMAGE * mult;
    let crit = false;
    if (rng() < TURRET.CRIT_CHANCE) { crit = true; dmg *= TURRET.CRIT_MULT; }
    dmg = Math.max(1, Math.floor(dmg));
    state.combo += 1;
    state.maxCombo = Math.max(state.maxCombo, state.combo);
    state.core.hp = Math.max(0, state.core.hp - dmg);
    state.hits += 1;
    state.score += dmg;
    b.dead = true;
    emit('hit', { dmg });
    if (crit) emit('crit', { dmg });
    if (state.combo >= 2) emit('combo', { combo: state.combo });
    if (state.core.hp <= 0) winLevel();
  }

  function fireNow() {
    if (state.phase !== 'playing') return { ok: false };
    if (state.turret.cooldown > 0) return { ok: false };
    state.turret.cooldown = TURRET.FIRE_COOLDOWN;
    state.shots += 1;
    state.bubbles.push({
      x: state.turret.x,
      y: WORLD.TURRET_Y - 6,
      vy: -WORLD.BUBBLE_UP,
      r: WORLD.BUBBLE_R,
      cleared: new Set(),
      dead: false,
    });
    emit('shot', { x: state.turret.x });
    return { ok: true };
  }

  function advance(dt) {
    state.time += dt;

    // 炮塔移动 + 回中
    const t = state.turret;
    if (input.left && !input.right) t.x -= WORLD.TURRET_MOVE_SPEED * dt;
    else if (input.right && !input.left) t.x += WORLD.TURRET_MOVE_SPEED * dt;
    else if (t.x < WORLD.CX - 2) t.x = Math.min(WORLD.CX, t.x + WORLD.TURRET_HOME_SPEED * dt);
    else if (t.x > WORLD.CX + 2) t.x = Math.max(WORLD.CX, t.x - WORLD.TURRET_HOME_SPEED * dt);
    else t.x = WORLD.CX;
    t.x = Math.max(WORLD.TURRET_MIN_X, Math.min(WORLD.TURRET_MAX_X, t.x));
    t.cooldown = Math.max(0, t.cooldown - dt);

    // 圆环 / 岩石旋转
    for (const r of state.rings) r.angle += r.dir * r.speed * dt;
    for (const r of state.rocks) r.angle += r.speed * dt;

    // 气泡
    for (const b of state.bubbles) {
      if (b.dead) continue;
      b.y += b.vy * dt;

      if (b.vy < 0) { // 上升（向圆心推进，逐层穿过圆环）
        let bounced = false;
        for (let i = 0; i < state.rings.length; i += 1) {
          const r = state.rings[i];
          const dx = b.x - WORLD.CX;
          const dy = b.y - WORLD.RING_CY;
          const dist = Math.hypot(dx, dy);
          if (Math.abs(dist - r.radius) <= WORLD.RING_BAND / 2) {
            const phi = Math.atan2(dy, dx);
            if (!inGap(phi, r.angle, r.gapArc)) {
              b.vy = WORLD.BUBBLE_DOWN;
              bounced = true;
              if (state.combo > 0) { state.combo = 0; emit('combobreak', {}); }
              emit('bounce', { x: b.x, y: b.y });
              break;
            }
          }
          if (!bounced && !b.cleared.has(i) && dist < r.radius - WORLD.RING_BAND / 2) {
            b.cleared.add(i);
            state.gaps += 1;
            state.score += TURRET.GAP_SCORE;
            emit('gap', { ring: i });
          }
        }
        if (bounced) continue;

        // 岩石碰撞
        for (const rock of state.rocks) {
          if (!rock.alive) continue;
          const rx = WORLD.CX + Math.cos(rock.angle) * rock.radius;
          const ry = WORLD.CORE_CY + Math.sin(rock.angle) * rock.radius;
          if (Math.hypot(b.x - rx, b.y - ry) <= rock.r + b.r) {
            rock.alive = false;
            state.score += 50;
            b.dead = true;
            emit('rock', { x: rx, y: ry });
            break;
          }
        }
        if (b.dead) continue;

        // 核心碰撞
        if (Math.hypot(b.x - WORLD.CORE_CX, b.y - WORLD.CORE_CY) <= WORLD.CORE_R + b.r) {
          hitCore(b);
        } else if (b.y < -40) {
          b.dead = true;
          if (state.combo > 0) { state.combo = 0; emit('combobreak', {}); }
          emit('miss', { x: b.x });
        }
      } else { // 下落
        if (b.y >= WORLD.TURRET_Y - b.r) {
          if (Math.abs(b.x - state.turret.x) <= WORLD.TURRET_HALF_W + b.r) {
            hurt();
          } else {
            emit('dodge', { x: b.x });
          }
          b.dead = true;
        }
      }
    }
    state.bubbles = state.bubbles.filter((b) => !b.dead);

    // 尖刺
    state.spikeTimer -= dt;
    if (state.spikeTimer <= 0) {
      state.spikeTimer = state.level.spikeInterval;
      state.spikes.push({
        x: state.turret.x + (rng() - 0.5) * 40,
        y: WORLD.CORE_CY + WORLD.CORE_R,
        vy: state.level.spikeSpeed,
        r: WORLD.SPIKE_R,
      });
      emit('spike', { x: state.spikes[state.spikes.length - 1].x });
    }
    for (const s of state.spikes) {
      s.y += s.vy * dt;
      if (s.y >= WORLD.TURRET_Y - s.r) {
        if (Math.abs(s.x - state.turret.x) <= WORLD.TURRET_HALF_W + s.r) hurt();
        else emit('dodge', { x: s.x });
        s.dead = true;
      } else if (s.y > WORLD.HEIGHT + 20) {
        s.dead = true;
      }
    }
    state.spikes = state.spikes.filter((s) => !s.dead);
  }

  const run = {
    state,
    step(dt = STEP) {
      if (state.phase === 'playing') advance(dt);
    },
    setInput(i = {}) {
      input.left = !!i.left;
      input.right = !!i.right;
    },
    move(dir) {
      input.left = dir < 0;
      input.right = dir > 0;
      return { ok: true };
    },
    fire: fireNow,
    drainEvents() {
      const e = state.events.slice();
      state.events.length = 0;
      return e;
    },
    getHud() {
      return {
        phase: state.phase,
        level: state.levelIndex + 1,
        score: state.score,
        combo: state.combo,
        hearts: state.turret.hearts,
        coreHp: state.core.hp,
        coreMaxHp: state.core.maxHp,
        stars: state.stars,
        shots: state.shots,
        time: state.time,
      };
    },
  };

  return run;
}

export { LEVELS };
