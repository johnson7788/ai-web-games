// HAPPY CHICK HOP · 纯逻辑模拟（无 DOM，可被 node --test / selfplay 直接 import）
// 玩法骨架 1:1 还原「合成大西瓜」：同类两球重叠 → 合并成下一阶 → 加分；顶部红线判负。
// 新增机制：岩石（不可合并占位）/ 锤子（砸掉任意对象）/ 连击加分（只影响展示分，不计阶段）。
import { WORLD, TIERS, GAME } from '../../config/game.config.js';

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

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

export function radiusOf(o) {
  return o.rock ? GAME.ROCK_R : TIERS[o.tier].r;
}

function isRockDrop(n) {
  // 第 7 / 14 / 21 … 次投放（1 基）为岩石
  return (n + 1) % GAME.ROCK_EVERY === 0;
}

export function createRun(opts = {}) {
  const seed = opts.seed == null ? ((Date.now() % 2147483647) || 1) : (opts.seed | 0);
  const rng = mulberry32(seed);

  let nextId = 1;
  const state = {
    phase: 'playing',        // playing | result
    score: 0,
    base: 0,
    best: 0,
    combo: 0,
    comboTimer: 0,
    stage: 1,
    highestTier: 0,
    drops: 0,
    merges: 0,
    hammers: GAME.HAMMER_START,
    dangerTimer: 0,
    hardTimer: 0,
    objects: [],
    current: null,
    next: null,
    aimX: W / 2,
    result: null,
  };

  const events = [];
  const emit = (type, payload = {}) => events.push({ type, ...payload });

  function randTier() {
    return Math.floor(rng() * GAME.SPAWN_TIERS);
  }

  function makeDrop(n) {
    return { tier: randTier(), rock: isRockDrop(n) };
  }

  function spawnObject(tier, x, y, extra = {}) {
    return {
      id: nextId++,
      tier,
      x,
      y,
      vx: extra.vx || 0,
      vy: extra.vy || 0,
      rock: !!extra.rock,
      restTime: 0,
      merged: false,
      alive: true,
    };
  }

  state.current = makeDrop(0);
  state.next = makeDrop(1);
  state.aimX = W / 2;

  function computeStars() {
    if (state.highestTier >= 8) return 3;
    if (state.highestTier >= 5) return 2;
    return 1;
  }

  function checkProgress() {
    if (state.stage === 1 && state.highestTier >= GAME.STAGE2_TIER) {
      state.stage = 2;
      emit('stage', { stage: 2 });
    }
    if (state.stage === 2 && state.highestTier >= GAME.STAGE3_TIER) {
      state.stage = 3;
      emit('stage', { stage: 3 });
    }
    if (state.highestTier >= GAME.WIN_TIER) {
      state.phase = 'result';
      state.result = {
        won: true,
        score: state.score,
        base: state.base,
        stars: 3,
        highestTier: state.highestTier,
        reason: 'win',
      };
      emit('win', { score: state.score, base: state.base, stage: 3, stars: 3 });
    }
  }

  function processMerges() {
    const objs = state.objects.filter((o) => o.alive && !o.rock && !o.merged);
    for (let i = 0; i < objs.length; i += 1) {
      const a = objs[i];
      if (a.merged || !a.alive) continue;
      for (let j = i + 1; j < objs.length; j += 1) {
        const b = objs[j];
        if (b.merged || !b.alive) continue;
        if (a.tier !== b.tier || a.tier >= GAME.MAX_TIER) continue;
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < (TIERS[a.tier].r + TIERS[b.tier].r) * GAME.MERGE_OVERLAP) {
          a.merged = true;
          b.merged = true;
          const nt = a.tier + 1;
          const no = spawnObject(nt, (a.x + b.x) / 2, (a.y + b.y) / 2, { vx: (rng() - 0.5) * 40 });
          no.restTime = 0;
          state.objects.push(no);
          state.merges += 1;
          state.highestTier = Math.max(state.highestTier, nt);
          const baseGain = TIERS[a.tier].score;
          state.base += baseGain;
          state.combo += 1;
          state.comboTimer = GAME.COMBO_WINDOW;
          const bonus = state.combo >= 2 ? Math.round(baseGain * GAME.COMBO_BONUS * (state.combo - 1)) : 0;
          state.score += baseGain + bonus;
          emit('merge', {
            tier: nt,
            x: no.x,
            y: no.y,
            base: baseGain,
            bonus,
            combo: state.combo,
            score: state.score,
          });
          if (state.combo === 2) emit('combo', { combo: 2 });
          if (state.merges % GAME.HAMMER_EVERY === 0 && state.hammers < GAME.HAMMER_MAX) {
            state.hammers += 1;
            emit('hammer', { hammers: state.hammers, earned: true });
          }
          checkProgress();
          break;
        }
      }
    }
    if (state.objects.some((o) => o.merged)) {
      state.objects = state.objects.filter((o) => o.alive && !o.merged);
    }
  }

  function resolveCollisions(sdt) {
    const objs = state.objects.filter((o) => o.alive);
    for (let iter = 0; iter < 3; iter += 1) {
      for (let i = 0; i < objs.length; i += 1) {
        const a = objs[i];
        if (!a.alive) continue;
        for (let j = i + 1; j < objs.length; j += 1) {
          const b = objs[j];
          if (!b.alive) continue;
          const ra = radiusOf(a);
          const rb = radiusOf(b);
          let dx = b.x - a.x;
          let dy = b.y - a.y;
          let dist = Math.hypot(dx, dy);
          const minDist = ra + rb;
          if (dist < 0.0001) {
            dx = (rng() - 0.5);
            dy = (rng() - 0.5);
            dist = Math.hypot(dx, dy) || 0.0001;
          }
          if (dist < minDist) {
            const overlap = minDist - dist;
            const nx = dx / dist;
            const ny = dy / dist;
            const ma = ra * ra;
            const mb = rb * rb;
            const total = ma + mb || 1;
            a.x -= nx * overlap * (mb / total);
            a.y -= ny * overlap * (mb / total);
            b.x += nx * overlap * (ma / total);
            b.y += ny * overlap * (ma / total);
            const rel = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
            if (rel < 0) {
              const e = 0.05;
              const j = (-(1 + e) * rel) / 2;
              a.vx -= j * nx;
              a.vy -= j * ny;
              b.vx += j * nx;
              b.vy += j * ny;
              // 只有真实撞击（相对速度显著）才打断「静止」判定；稳定堆叠的微小
              // 接触不重置 restTime，否则 allSettled()/红线判负永远无法触发。
              if (Math.abs(rel) > GAME.REST_SPEED * 0.5) {
                a.restTime = 0;
                b.restTime = 0;
              }
            }
          }
        }
      }
    }
  }

  function endRun(reason) {
    if (state.phase !== 'playing') return;
    state.phase = 'result';
    state.result = {
      won: false,
      score: state.score,
      base: state.base,
      stars: computeStars(),
      highestTier: state.highestTier,
      reason,
    };
    emit('lose', { score: state.score, base: state.base, reason, stars: state.result.stars });
  }

  function checkGameOver(dt) {
    if (state.phase !== 'playing') return;
    // 双重判负：
    // 1) 硬溢出：任何对象的顶部越过 HARD_LOSE_Y（接近井口最顶）→ 短暂宽限后立即判负。
    //    即使堆叠持续被顶动（restTime 一直归零），也能可靠判负（对齐参考实现的「碰到顶即结束」）。
    // 2) 软溢出：对象静止后仍停在红色警示线上方 → 判负。
    let hard = false;
    let soft = false;
    for (const o of state.objects) {
      if (!o.alive) continue;
      const r = radiusOf(o);
      const top = o.y - r;
      if (top < GAME.HARD_LOSE_Y) { hard = true; break; }
      if (o.restTime > GAME.REST_TIME && top < GAME.DANGER_Y) soft = true;
    }
    state.hardTimer = hard ? (state.hardTimer || 0) + dt : 0;
    if (state.hardTimer > GAME.HARD_GRACE) { endRun('overflow'); return; }
    state.dangerTimer = soft ? state.dangerTimer + dt : 0;
    if (state.dangerTimer > GAME.DANGER_GRACE) endRun('overflow');
  }

  function step(dt) {
    if (state.phase !== 'playing') return;
    const sdt = dt / GAME.SUBSTEPS;
    for (let s = 0; s < GAME.SUBSTEPS; s += 1) {
      for (const o of state.objects) {
        if (!o.alive) continue;
        o.vy += GAME.GRAVITY * sdt;
        o.x += o.vx * sdt;
        o.y += o.vy * sdt;
        const r = radiusOf(o);
        if (o.x < r) { o.x = r; o.vx = Math.abs(o.vx) * GAME.WALL_RESTITUTION; }
        else if (o.x > W - r) { o.x = W - r; o.vx = -Math.abs(o.vx) * GAME.WALL_RESTITUTION; }
        if (o.y + r > GAME.FLOOR_Y) {
          o.y = GAME.FLOOR_Y - r;
          if (o.vy > 0) o.vy = -o.vy * GAME.FLOOR_RESTITUTION;
          o.vx *= GAME.FRICTION;
        }
        const damp = Math.max(0, 1 - GAME.LINEAR_DAMPING * sdt);
        o.vx *= damp;
        const speed = Math.hypot(o.vx, o.vy);
        if (speed < GAME.REST_SPEED) {
          o.restTime += sdt;
          if (o.restTime > 0.2) { o.vx = 0; o.vy = 0; }
        } else {
          o.restTime = 0;
        }
      }
      resolveCollisions(sdt);
      processMerges();
    }
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) {
        state.comboTimer = 0;
        if (state.combo > 0) state.combo = 0;
      }
    }
    checkGameOver(dt);
  }

  function setAim(x) {
    if (state.phase !== 'playing' || !state.current) return { ok: false };
    const r = radiusOf(state.current);
    state.aimX = Math.max(r, Math.min(W - r, x));
    return { ok: true };
  }

  function drop() {
    if (state.phase !== 'playing' || !state.current) return { ok: false };
    const o = spawnObject(state.current.tier, state.aimX, GAME.SPAWN_Y, { rock: state.current.rock });
    state.objects.push(o);
    // 岩石与普通对象分开发事件：岩石不可合并，视觉/音效/遥测口径都不同。
    emit(state.current.rock ? 'rock' : 'drop', { tier: state.current.tier, rock: state.current.rock, x: state.aimX });
    state.drops += 1;
    state.current = state.next;
    state.next = makeDrop(state.drops + 1);
    state.aimX = W / 2;
    return { ok: true };
  }

  function useHammer(x, y) {
    if (state.phase !== 'playing' || state.hammers <= 0) return { ok: false };
    let hit = null;
    let hitDist = Infinity;
    for (const o of state.objects) {
      if (!o.alive) continue;
      const d = Math.hypot(o.x - x, o.y - y);
      if (d <= radiusOf(o) + 6 && d < hitDist) {
        hit = o;
        hitDist = d;
      }
    }
    if (!hit) return { ok: false };
    hit.alive = false;
    state.hammers -= 1;
    emit('hammer', { x: hit.x, y: hit.y, hammers: state.hammers, used: true });
    state.objects = state.objects.filter((o) => o.alive);
    return { ok: true };
  }

  function allSettled() {
    return state.objects.every((o) => !o.alive || o.restTime > 0.2);
  }

  function forceResult(won) {
    if (state.phase === 'result') return { ok: false };
    state.phase = 'result';
    state.result = won
      ? { won: true, score: state.score, base: state.base, stars: Math.max(1, computeStars()), highestTier: state.highestTier, reason: 'forced' }
      : { won: false, score: state.score, base: state.base, stars: 0, highestTier: state.highestTier, reason: 'forced' };
    emit(won ? 'win' : 'lose', { score: state.score, base: state.base, forced: true });
    return { ok: true };
  }

  function getHud() {
    return {
      score: state.score,
      base: state.base,
      stage: state.stage,
      combo: state.combo,
      hammers: state.hammers,
      drops: state.drops,
      highestTier: state.highestTier,
      current: state.current,
      next: state.next,
    };
  }

  return {
    seed,
    rng,
    state,
    step,
    drainEvents: () => events.splice(0),
    setAim,
    drop,
    useHammer,
    allSettled,
    forceResult,
    getHud,
    radiusOf,
  };
}

export { W, H };
