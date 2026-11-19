// MERGE MELON DROP · 纯逻辑模拟（不碰 DOM / window / localStorage / Date.now）
//
// Suika 式落球合成：持球左右瞄准 → 松手落球 → 同阶相碰合成下一阶，直到星爆瓜（NOVA）。
// 新机制：岩石（不合成、可被 ≥2 阶压碎）、连击（1.5s 内连续合成加分）、星级结算。
// 随机用 seed（mulberry32），同 seed 完全可复现。
//
// 对外契约（selfplay / main / 测试通用）：
//   createRun(opts) → run；run.step(dt)；run.drainEvents()；run.getHud()；
//   run.setAim(x)；run.drop()；run.state（快照）；run.debugState()。
import {
  STEP, WORLD, PHYS, COMBO, ROCK, TIERS, MAX_TIER,
  SEQUENCE_FIXED, SEQUENCE_RANDOM_MIN, SEQUENCE_RANDOM_MAX, STARS, milestoneForTier,
} from '../../config/game.config.js';

export { STEP };

/** mulberry32：轻量可复现 PRNG */
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

let NEXT_ID = 1;

/** 生成落球队列（首段固定 + 随机；每第 ROCK.EVERY 个替换为岩石，-1 表示岩石）。 */
function buildQueue(rng, len = 320) {
  const q = [];
  for (let i = 0; i < len; i += 1) {
    let tier;
    if (i < SEQUENCE_FIXED.length) tier = SEQUENCE_FIXED[i];
    else tier = SEQUENCE_RANDOM_MIN + Math.floor(rng() * (SEQUENCE_RANDOM_MAX - SEQUENCE_RANDOM_MIN + 1));
    if ((i + 1) % ROCK.EVERY === 0) tier = -1;
    q.push(tier);
  }
  return q;
}

function radiusOf(tier) {
  return tier === -1 ? ROCK.RADIUS : TIERS[tier].r;
}

function makeBody(tier, x, y, kind) {
  return {
    id: NEXT_ID++,
    kind,                    // 'fruit' | 'rock'
    tier,                    // 0..10 或 -1（岩石）
    x, y,
    vx: 0, vy: 0,
    r: kind === 'rock' ? ROCK.RADIUS : TIERS[tier].r,
    touched: false,          // 是否已接触过地面/其它球（用于越线判负）
    overLineT: 0,
    warned: false,
    mergeCd: 0,              // 新合成球短暂不可再合成
    landPlayed: false,
  };
}

export function computeStars(score, maxTier) {
  if (maxTier >= STARS.three.tier || score >= STARS.three.score) return 3;
  if (maxTier >= STARS.two.tier || score >= STARS.two.score) return 2;
  if (maxTier >= STARS.one.tier || score >= STARS.one.score) return 1;
  return 0;
}

function emit(s, type, payload) {
  s.events.push({ type, t: s.time, ...payload });
}

export function createRun(opts = {}) {
  const seed = (opts.seed == null ? 1 : opts.seed) | 0;
  const rng = mulberry32(seed);
  const queue = buildQueue(rng);

  const state = {
    phase: 'playing',        // 'playing' | 'over'
    seed,
    time: 0,
    score: 0,
    best: opts.best | 0 || 0,
    merges: 0,
    maxTier: -1,             // 本局合成出的最高阶（0..10）；-1 = 尚未合成
    dropCount: 0,
    spawnIndex: 0,
    heldTier: 0,             // 当前持球（-1 = 岩石）
    heldX: (WORLD.WALL_L + WORLD.WALL_R) / 2,
    nextTier: queue[0],      // 下一球预览
    combo: 0,
    lastMergeTime: -1e9,
    levelsReached: 1,
    stars: 0,
    reason: null,
    bodies: [],
    events: [],
    firstInputFired: false,
  };

  const run = {
    state,
    _queue: queue,
    _rng: rng,

    step(dt) {
      if (state.phase !== 'playing') return;
      state.time += dt;
      let bodies = state.bodies;

      // 1) 重力积分
      for (const b of bodies) {
        b.vy = Math.min(PHYS.MAX_VY, b.vy + PHYS.GRAVITY * dt);
        b.x += b.vx * dt;
        b.y += b.vy * dt;
        if (b.mergeCd > 0) b.mergeCd -= dt;
      }

      // 2) 墙壁 / 地面
      for (const b of bodies) {
        if (b.x - b.r < WORLD.WALL_L) { b.x = WORLD.WALL_L + b.r; b.vx = Math.abs(b.vx) * PHYS.WALL_REST; }
        else if (b.x + b.r > WORLD.WALL_R) { b.x = WORLD.WALL_R - b.r; b.vx = -Math.abs(b.vx) * PHYS.WALL_REST; }
        if (b.y + b.r > WORLD.FLOOR_Y) {
          b.y = WORLD.FLOOR_Y - b.r;
          if (!b.touched) { b.touched = true; if (!b.landPlayed) { b.landPlayed = true; emit(state, 'land', { tier: b.tier, kind: b.kind, x: b.x, y: b.y }); } }
          if (b.vy > 0) b.vy = 0;
        }
      }

      // 2.5) 岩石压碎（必须在两两分离之前）：≥2 阶水果砸落压碎岩石
      let crushed = false;
      for (const rock of bodies) {
        if (rock.kind !== 'rock') continue;
        for (const f of bodies) {
          if (f.kind !== 'fruit' || f.tier < ROCK.CRUSH_TIER) continue;
          if (f.vy > 30 && Math.hypot(f.x - rock.x, f.y - rock.y) < f.r + rock.r - 3) {
            crushRock(rock);
            crushed = true;
            break;
          }
        }
      }
      if (crushed) bodies = state.bodies;

      // 3) 两两碰撞（迭代分离 + 速度冲量），收集合成对
      const mergePairs = [];
      for (let iter = 0; iter < PHYS.ITER; iter += 1) {
        for (let i = 0; i < bodies.length; i += 1) {
          for (let j = i + 1; j < bodies.length; j += 1) {
            const a = bodies[i];
            const b = bodies[j];
            const dx = b.x - a.x;
            const dy = b.y - a.y;
            const dist = Math.hypot(dx, dy);
            const minDist = a.r + b.r;
            if (dist >= minDist) continue;
            // 同阶水果相碰 → 合成（每个配对只记一次）
            if (a.kind === 'fruit' && b.kind === 'fruit' && a.tier === b.tier
              && a.tier < MAX_TIER && a.mergeCd <= 0 && b.mergeCd <= 0) {
              const already = mergePairs.some((p) => (p.a === a && p.b === b) || (p.a === b && p.b === a));
              if (!already) mergePairs.push({ a, b, tier: a.tier });
              continue;
            }
            resolvePair(a, b, dx, dy, dist, minDist);
          }
        }
      }

      // 5) 处理合成
      for (const mp of mergePairs) {
        if (!state.bodies.includes(mp.a) || !state.bodies.includes(mp.b)) continue;
        doMerge(mp.a, mp.b);
      }
      bodies = state.bodies;

      // 6) 再夹回容器（防止分离把球推出边界）
      for (const b of bodies) {
        if (b.x - b.r < WORLD.WALL_L) { b.x = WORLD.WALL_L + b.r; b.vx = Math.abs(b.vx) * PHYS.WALL_REST; }
        else if (b.x + b.r > WORLD.WALL_R) { b.x = WORLD.WALL_R - b.r; b.vx = -Math.abs(b.vx) * PHYS.WALL_REST; }
        if (b.y + b.r > WORLD.FLOOR_Y) { b.y = WORLD.FLOOR_Y - b.r; if (b.vy > 0) b.vy = 0; }
      }

      // 7) 越线判负
      checkGameOver(dt);
    },

    /** 设置持球水平瞄准位置（夹在容器内），返回是否生效。 */
    setAim(x) {
      if (state.phase !== 'playing') return { ok: false };
      const r = radiusOf(state.heldTier);
      const minX = WORLD.WALL_L + r;
      const maxX = WORLD.WALL_R - r;
      const nx = Math.max(minX, Math.min(maxX, x));
      const moved = Math.abs(nx - state.heldX) > 0.01;
      state.heldX = nx;
      if (!state.firstInputFired) { state.firstInputFired = true; emit(state, 'first_input', { x: nx }); }
      return { ok: true, moved };
    },

    /** 松手落球，并生成下一颗持球。 */
    drop() {
      if (state.phase !== 'playing') return { ok: false };
      if (!state.firstInputFired) { state.firstInputFired = true; emit(state, 'first_input', {}); }
      const tier = state.heldTier;
      const kind = tier === -1 ? 'rock' : 'fruit';
      const b = makeBody(tier, state.heldX, WORLD.HOLD_Y, kind);
      b.vy = PHYS.DROP_VY;
      state.bodies.push(b);
      state.dropCount += 1;
      emit(state, 'drop', { tier, kind, x: state.heldX });
      if (kind === 'rock') emit(state, 'rock', { x: b.x, y: b.y });

      // 生成下一颗
      state.heldTier = queue[state.spawnIndex] ?? randomTier();
      state.spawnIndex += 1;
      state.nextTier = queue[state.spawnIndex] ?? randomTier();
      const nr = radiusOf(state.heldTier);
      state.heldX = Math.max(WORLD.WALL_L + nr, Math.min(WORLD.WALL_R - nr, state.heldX));
      return { ok: true };
    },

    drainEvents() {
      const e = state.events;
      state.events = [];
      return e;
    },

    getHud() {
      return {
        score: state.score,
        best: state.best,
        heldTier: state.heldTier,
        nextTier: state.nextTier,
        combo: state.combo,
        maxTier: state.maxTier,
        merges: state.merges,
        dropCount: state.dropCount,
        time: state.time,
        phase: state.phase,
        levelsReached: state.levelsReached,
        stars: state.stars,
      };
    },

    debugState() {
      let rockCount = 0;
      for (const b of state.bodies) if (b.kind === 'rock') rockCount += 1;
      return {
        phase: state.phase,
        score: state.score,
        merges: state.merges,
        maxTier: state.maxTier,
        heldTier: state.heldTier,
        nextTier: state.nextTier,
        combo: state.combo,
        levelsReached: state.levelsReached,
        stars: state.stars,
        bodyCount: state.bodies.length,
        rockCount,
        dropCount: state.dropCount,
      };
    },

    /** 调试/截图辅助：直接铺一个球（-1 = 岩石）。 */
    debugSpawn(tier, x, y) {
      if (state.phase !== 'playing') state.phase = 'playing';
      const kind = tier === -1 ? 'rock' : 'fruit';
      const b = makeBody(tier, x, y, kind);
      b.touched = true;
      state.bodies.push(b);
      return b;
    },

    /** 调试/截图辅助：直接判负（触发结算）。 */
    debugGameOver() {
      if (state.phase === 'over') return;
      gameOver();
    },
  };

  function randomTier() {
    return SEQUENCE_RANDOM_MIN + Math.floor(rng() * (SEQUENCE_RANDOM_MAX - SEQUENCE_RANDOM_MIN + 1));
  }

  function resolvePair(a, b, dx, dy, dist, minDist) {
    const nx = dx / dist;
    const ny = dy / dist;
    const overlap = minDist - dist;
    const push = overlap / 2;
    a.x -= nx * push;
    a.y -= ny * push;
    b.x += nx * push;
    b.y += ny * push;
    a.touched = true;
    b.touched = true;

    const rvx = b.vx - a.vx;
    const rvy = b.vy - a.vy;
    const vn = rvx * nx + rvy * ny;
    if (vn < 0) {
      const imp = -(1 + PHYS.WALL_REST) * vn / 2;
      a.vx -= imp * nx;
      a.vy -= imp * ny;
      b.vx += imp * nx;
      b.vy += imp * ny;
    }
    // 切向摩擦：让堆积逐渐稳定
    a.vx *= PHYS.CONTACT_DAMP;
    a.vy *= PHYS.CONTACT_DAMP;
    b.vx *= PHYS.CONTACT_DAMP;
    b.vy *= PHYS.CONTACT_DAMP;
  }

  function doMerge(fruitA, fruitB) {
    const newTier = fruitA.tier + 1;
    const x = (fruitA.x + fruitB.x) / 2;
    const y = (fruitA.y + fruitB.y) / 2;

    const now = state.time;
    if (now - state.lastMergeTime <= COMBO.WINDOW) state.combo = Math.min(COMBO.MAX, state.combo + 1);
    else state.combo = 1;
    state.lastMergeTime = now;

    const base = fruitA.tier + 1;
    const comboBonus = state.combo > 1 ? (state.combo - 1) * COMBO.BONUS_PER : 0;
    const gain = base + comboBonus;
    state.score += gain;
    state.merges += 1;
    state.maxTier = Math.max(state.maxTier, newTier);
    state.levelsReached = Math.max(state.levelsReached, milestoneForTier(newTier));

    emit(state, 'merge', { tier: fruitA.tier, newTier, score: gain, combo: state.combo, x, y, total: state.score });
    if (state.combo > 1) emit(state, 'combo', { combo: state.combo });

    // 移除两球
    state.bodies = state.bodies.filter((b) => b !== fruitA && b !== fruitB);

    // 生成新阶球
    const nb = makeBody(newTier, x, y, 'fruit');
    nb.touched = true;
    nb.mergeCd = PHYS.MERGE_COOLDOWN;
    nb.vx = (rng() - 0.5) * 40;
    nb.vy = 60;
    state.bodies.push(nb);

    if (newTier >= MAX_TIER) {
      state.score += 50;
      emit(state, 'watermelon', { x, y, total: state.score });
    }
  }

  function crushRock(rock) {
    state.bodies = state.bodies.filter((b) => b !== rock);
    state.score += ROCK.SCORE;
    emit(state, 'rock_crush', { x: rock.x, y: rock.y, total: state.score });
  }

  function checkGameOver(dt) {
    let anyOver = false;
    for (const b of state.bodies) {
      if (!b.touched) continue;
      if (b.y - b.r < WORLD.DASH_Y) {
        b.overLineT += dt;
        if (b.overLineT > 1 && !b.warned) {
          b.warned = true;
          emit(state, 'near_line', { x: b.x, y: b.y });
        }
        if (b.overLineT >= PHYS.OVER_LINE_SEC) anyOver = true;
      } else {
        b.overLineT = 0;
        b.warned = false;
      }
    }
    if (anyOver) gameOver();
  }

  function gameOver() {
    state.phase = 'over';
    state.reason = 'overflow';
    state.stars = computeStars(state.score, state.maxTier);
    emit(state, 'gameover', { score: state.score, stars: state.stars, maxTier: state.maxTier, merges: state.merges, reason: state.reason });
  }

  return run;
}
