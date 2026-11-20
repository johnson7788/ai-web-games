// 纯逻辑模拟：CHEF MARIE SERVE 横版平台跳跃核心（无 DOM，可被 node --test 与 selfplay 直接 import）。
// 规则 1:1 保留参考源（玛丽师傅）：跑/跳/重力、收集加分、巡逻敌人可踩可撞、掉坑死亡、终点结算。
// 新增机制：连击（空中连续收集倍率）、星级（按收集率 1-3 星）、香料冲刺（无敌+加速撞飞敌人）。
import { WORLD, PLAYER, ENEMY, SPICE, SCORE } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

export function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ING_R = 16;

function rectOverlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createRun(levelIndex, opts = {}) {
  const lvl = LEVELS[levelIndex] || LEVELS[0];
  const state = {
    level: levelIndex + 1,
    levelIndex,
    phase: 'playing', // playing | dead | won
    time: 0,
    score: 0,
    collected: 0,
    totalIngredients: lvl.ingredients.length,
    combo: 1,
    bestCombo: 1,
    deaths: 0,
    moving: false,
    player: {
      x: lvl.spawn.x, y: lvl.spawn.y,
      w: PLAYER.WIDTH, h: PLAYER.HEIGHT,
      vx: 0, vy: 0,
      onGround: false, facing: 1,
      spiceUntil: -Infinity, invincibleUntil: 0, landTime: 0,
    },
    input: { left: false, right: false, jump: false },
    ingredients: lvl.ingredients.map((c) => ({ ...c, taken: false })),
    enemies: lvl.enemies.map((e) => ({
      ...e,
      w: 40, h: 40,
      dir: 1, dirY: 1, alive: true,
    })),
    spices: lvl.spices.map((s) => ({ ...s, taken: false })),
    hazards: lvl.hazards.map((h) => ({ ...h })),
    cards: lvl.cards.map((c) => ({ ...c, shown: false })),
    platforms: lvl.platforms.map((p) => ({ ...p })),
    end: { ...lvl.end },
    spawn: { ...lvl.spawn },
    width: lvl.width,
    sky: lvl.sky,
    name: lvl.name,
  };

  const events = [];
  function emit(type, payload = {}) {
    events.push({ type, ...payload, t: state.time });
  }

  function playerRect() {
    const p = state.player;
    return { x: p.x, y: p.y, w: p.w, h: p.h };
  }

  function enemyRect(e) {
    return { x: e.x, y: e.y, w: e.w, h: e.h };
  }

  function die() {
    if (state.phase !== 'playing') return;
    state.deaths += 1;
    state.player.invincibleUntil = 0;
    emit('hit', {});
    emit('death', { score: state.score });
    state.phase = 'dead';
  }

  function win() {
    if (state.phase !== 'playing') return;
    const ratio = state.totalIngredients ? state.collected / state.totalIngredients : 0;
    const stars = 1 + (ratio >= 0.5 ? 1 : 0) + (ratio >= 0.9 ? 1 : 0);
    emit('win', { stars, score: state.score, collected: state.collected, total: state.totalIngredients });
    state.phase = 'won';
  }

  function step(dt) {
    if (state.phase !== 'playing') return;
    state.time += dt;
    const p = state.player;
    const inp = state.input;

    // ---- 水平移动 ----
    const dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
    const spdMult = p.spiceUntil > state.time ? SPICE.SPEED_MULT : 1;
    const maxSpd = PLAYER.MAX_SPEED * spdMult;
    if (dir !== 0) {
      const acc = p.onGround ? PLAYER.ACCEL : PLAYER.AIR_ACCEL;
      p.vx += dir * acc * dt;
      if (Math.abs(p.vx) > maxSpd) p.vx = dir * maxSpd;
      if (p.facing !== dir) { p.facing = dir; }
      if (!state.moving) { state.moving = true; emit('move', { dir }); }
    } else {
      if (p.vx > 0) p.vx = Math.max(0, p.vx - PLAYER.FRICTION * dt);
      else p.vx = Math.min(0, p.vx + PLAYER.FRICTION * dt);
      if (Math.abs(p.vx) < 2) state.moving = false;
    }

    // ---- 跳跃（边沿触发）----
    if (inp.jump) {
      const canJump = p.onGround || (state.time - p.landTime) <= PLAYER.COYOTE;
      if (canJump) {
        p.vy = PLAYER.JUMP_VY;
        p.onGround = false;
        emit('jump', {});
      }
      inp.jump = false;
    }

    // ---- 重力 ----
    p.vy += PLAYER.GRAVITY * dt;
    if (p.vy > PLAYER.MAX_FALL) p.vy = PLAYER.MAX_FALL;

    const wasGround = p.onGround;
    p.onGround = false;

    // ---- 位移 ----
    p.x += p.vx * dt;
    p.y += p.vy * dt;

    // ---- 平台碰撞（最小穿透轴分离，避免空中被错误横向推出）----
    for (const plat of state.platforms) {
      const pr = playerRect();
      if (!rectOverlap(pr, plat)) continue;
      const overlapX = Math.min(pr.x + pr.w, plat.x + plat.w) - Math.max(pr.x, plat.x);
      const overlapY = Math.min(pr.y + pr.h, plat.y + plat.h) - Math.max(pr.y, plat.y);
      if (overlapX < overlapY) {
        if (pr.x + pr.w / 2 < plat.x + plat.w / 2) p.x = plat.x - p.w;
        else p.x = plat.x + plat.w;
        p.vx = 0;
      } else if (pr.y + pr.h / 2 < plat.y + plat.h / 2) {
        p.y = plat.y - p.h;
        p.vy = 0;
        p.onGround = true;
      } else {
        p.y = plat.y + plat.h;
        p.vy = 0;
      }
    }

    if (p.onGround && !wasGround) {
      p.landTime = state.time;
      if (state.combo !== 1) state.combo = 1;
      emit('land', {});
    }

    // ---- 边界 ----
    if (p.x < 0) { p.x = 0; if (p.vx < 0) p.vx = 0; }
    if (p.x > state.width - p.w) { p.x = state.width - p.w; if (p.vx > 0) p.vx = 0; }

    // ---- 掉坑死亡 ----
    if (p.y > WORLD.DEATH_Y) { die(); return; }

    const pr = playerRect();

    // ---- 收集食材 ----
    for (const ing of state.ingredients) {
      if (ing.taken) continue;
      const ir = { x: ing.x - ING_R, y: ing.y - ING_R, w: ING_R * 2, h: ING_R * 2 };
      if (rectOverlap(pr, ir)) {
        ing.taken = true;
        state.collected += 1;
        const mult = state.combo;
        state.score += SCORE.INGREDIENT * mult;
        emit('coin', { mult });
        if (!p.onGround) {
          state.combo = Math.min(9, state.combo + 1);
          if (state.combo > state.bestCombo) state.bestCombo = state.combo;
          if (state.combo >= 2) emit('combo', { tier: state.combo });
        }
      }
    }

    // ---- 香料 ----
    for (const s of state.spices) {
      if (s.taken) continue;
      const sr = { x: s.x - 16, y: s.y - 16, w: 32, h: 32 };
      if (rectOverlap(pr, sr)) {
        s.taken = true;
        p.spiceUntil = state.time + SPICE.DURATION;
        emit('spice', {});
      }
    }

    // ---- 敌人 ----
    for (const e of state.enemies) {
      if (!e.alive) continue;
      if (e.kind === 'fly') {
        e.y += e.dirY * e.speed * dt;
        if (e.y <= e.minY) { e.y = e.minY; e.dirY = 1; }
        else if (e.y >= e.maxY) { e.y = e.maxY; e.dirY = -1; }
      } else {
        e.x += e.dir * e.speed * dt;
        if (e.x <= e.minX) { e.x = e.minX; e.dir = 1; }
        else if (e.x >= e.maxX) { e.x = e.maxX; e.dir = -1; }
      }
      if (!rectOverlap(pr, enemyRect(e))) continue;
      if (p.spiceUntil > state.time) {
        e.alive = false;
        state.score += ENEMY.SMASH_SCORE;
        emit('smash', {});
      } else if (p.vy > 60 && (p.y + p.h) <= e.y + 26) {
        e.alive = false;
        p.vy = ENEMY.STOMP_VY;
        p.onGround = false;
        state.score += ENEMY.STOMP_SCORE;
        emit('stomp', {});
      } else {
        die();
        return;
      }
    }

    // ---- 热锅危害 ----
    for (const hz of state.hazards) {
      if (rectOverlap(pr, hz)) { die(); return; }
    }

    // ---- 菜谱卡牌（路牌）----
    for (const c of state.cards) {
      if (c.shown) continue;
      const cr = { x: c.x - 22, y: c.y - 40, w: 44, h: 80 };
      if (rectOverlap(pr, cr)) {
        c.shown = true;
        emit('card', { title: c.title, text: c.text });
      }
    }

    // ---- 上菜台 ----
    if (rectOverlap(pr, state.end)) win();
  }

  return {
    state,
    step,
    drainEvents() {
      const out = events.splice(0);
      return out;
    },
    getHud() {
      return {
        score: state.score,
        collected: state.collected,
        totalIngredients: state.totalIngredients,
        combo: state.combo,
        level: state.level,
        time: state.time,
        spiceLeft: Math.max(0, state.player.spiceUntil - state.time),
      };
    },
  };
}

export function starRating(collected, total) {
  const ratio = total ? collected / total : 0;
  return 1 + (ratio >= 0.5 ? 1 : 0) + (ratio >= 0.9 ? 1 : 0);
}
