// BEAR DASH RUN · 纯逻辑模拟（无 DOM，可被 node --test 与 tools/selfplay.mjs 直接驱动）
// 物理：固定步长 1/60，左右恒速 + 二段跳 + 重力；踩踏击杀敌人；碰障碍/敌人侧面即死。
// 事件：start / jump / land / stomp / combo / star / boost / nearMiss / checkpoint / win / lose
import { WORLD, PLAYER } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

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

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function aabb(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function circleRect(cx, cy, r, b) {
  const nx = clamp(cx, b.x, b.x + b.w);
  const ny = clamp(cy, b.y, b.y + b.h);
  const dx = cx - nx;
  const dy = cy - ny;
  return dx * dx + dy * dy < r * r;
}

function clone(v) { return JSON.parse(JSON.stringify(v)); }

function playerRect(p) {
  return { x: p.x, y: p.y, w: PLAYER.W, h: PLAYER.H };
}

export function createRun(levelIndex = 0, opts = {}) {
  const lv = LEVELS[levelIndex] || LEVELS[0];
  const GROUND = WORLD.GROUND_Y;

  // 归一化实体，补齐 y 坐标
  const rocks = (lv.rocks || []).map((o) => ({ x: o.x, y: GROUND - o.h, w: o.w, h: o.h, passed: false }));
  const spikes = (lv.spikes || []).map((o) => ({ x: o.x, y: GROUND - 18, w: o.w, h: 18, passed: false }));
  const rings = (lv.rings || []).map((o) => ({ x: o.x, y: o.y, r: o.r, vx: o.vx || 0, passed: false }));
  const enemies = (lv.enemies || []).map((o) => ({ x: o.x, y: GROUND - o.h, w: o.w, h: o.h, minX: o.minX, maxX: o.maxX, dir: o.dir || -1, speed: o.speed || 140, dead: false, passed: false }));
  const chompers = (lv.chompers || []).map((o) => ({ x: o.x, y: GROUND - o.h, w: o.w, h: o.h, passed: false }));
  const boosters = (lv.boosters || []).map((o) => ({ x: o.x, y: GROUND - 12, w: o.w, h: 12, used: false }));
  const stars = (lv.stars || []).map((o) => ({ x: o.x, y: o.y, taken: false }));

  const player = {
    x: 80,
    y: GROUND - PLAYER.H,
    vx: 0,
    vy: 0,
    onGround: true,
    jumps: 0,
    facing: 1,
    alive: true,
    invT: 0,
    boostT: 0,
  };

  const run = {
    state: {
      phase: 'playing',
      level: levelIndex + 1,
      levelIndex,
      time: 0,
      score: 0,
      stars: 0,
      combo: 0,
      maxCombo: 0,
      player,
      goalX: lv.goalX,
      width: lv.width,
    },
    input: { left: false, right: false, jump: false },
    entities: { rocks, spikes, rings, enemies, chompers, boosters, stars },
    _prevJump: false,
    _wasOnGround: true,
    _wasAirborne: false,
    _events: [],
    _checkpoints: new Set(),
  };

  run._emit = (type, extra) => run._events.push({ type, ...(extra || {}) });
  run._emit('start', { level: run.state.level });

  run.drainEvents = () => {
    const out = run._events;
    run._events = [];
    return out;
  };

  run.rating = () => 1 + Math.min(2, run.state.stars); // 1 完成星 + 最多 2 奖励星

  run.step = (dt = 1 / 60) => updateRun(run, dt);
  return run;
}

export function updateRun(run, dt) {
  const s = run.state;
  if (s.phase !== 'playing') return;
  const p = s.player;

  p.invT = Math.max(0, p.invT - dt);
  p.boostT = Math.max(0, p.boostT - dt);

  // ---- 水平输入 ----
  const boost = p.boostT > 0;
  let want = 0;
  if (run.input.right) want = PLAYER.SPEED;
  else if (run.input.left) want = -PLAYER.SPEED;
  if (boost) want = PLAYER.SPEED * PLAYER.BOOST_SPEED * (want < 0 ? -1 : 1);
  p.vx = want;
  if (want > 0) p.facing = 1;
  else if (want < 0) p.facing = -1;

  // ---- 跳跃（边沿触发，二段跳）----
  if (run.input.jump && !run._prevJump && p.alive) {
    if (p.jumps < PLAYER.MAX_JUMPS) {
      p.vy = -PLAYER.JUMP_V;
      p.jumps += 1;
      p.onGround = false;
      run._emit('jump', { jumps: p.jumps });
    }
  }
  run._prevJump = run.input.jump;

  // ---- 重力与积分 ----
  p.vy += WORLD.GRAVITY * dt;
  if (p.vy > WORLD.MAX_FALL) p.vy = WORLD.MAX_FALL;
  p.x += p.vx * dt;
  p.y += p.vy * dt;

  // 边界
  if (p.x < 0) p.x = 0;
  if (p.x > s.width - PLAYER.W) p.x = s.width - PLAYER.W;

  // ---- 地面 ----
  const wasAirborne = p.y + PLAYER.H < WORLD.GROUND_Y - 0.5 && p.vy > 0;
  if (p.y + PLAYER.H >= WORLD.GROUND_Y) {
    if (!p.onGround) run._emit('land', {});
    p.y = WORLD.GROUND_Y - PLAYER.H;
    p.vy = 0;
    p.onGround = true;
    p.jumps = 0;
  } else {
    p.onGround = false;
  }

  // ---- 岩块（实心）----
  for (const r of run.entities.rocks) {
    if (aabb(playerRect(p), r)) {
      const feetPen = (p.y + PLAYER.H) - r.y;
      if (p.vy >= 0 && feetPen < 30) {
        // 落在顶上
        if (!p.onGround) run._emit('land', {});
        p.y = r.y - PLAYER.H;
        p.vy = 0;
        p.onGround = true;
        p.jumps = 0;
      } else {
        // 侧面阻挡
        const overlapRight = (p.x + PLAYER.W) - r.x;
        const overlapLeft = (r.x + r.w) - p.x;
        if (overlapRight < overlapLeft) p.x = r.x - PLAYER.W;
        else p.x = r.x + r.w;
        p.vx = 0;
      }
    }
  }

  // ---- 尖刺 / 食人花（碰到即死）----
  for (const sp of run.entities.spikes) {
    if (aabb(playerRect(p), sp)) return kill(run, 'spike');
  }
  for (const ch of run.entities.chompers) {
    if (aabb(playerRect(p), ch)) return kill(run, 'chomper');
  }

  // ---- 火圈（向左移动）----
  for (const ring of run.entities.rings) {
    ring.x -= ring.vx * dt;
    if (circleRect(ring.x, ring.y, ring.r, playerRect(p))) return kill(run, 'ring');
  }

  // ---- 敌人巡逻与碰撞 ----
  for (const e of run.entities.enemies) {
    if (e.dead) continue;
    e.x += e.dir * e.speed * dt;
    if (e.x < e.minX) { e.x = e.minX; e.dir = 1; }
    else if (e.x > e.maxX) { e.x = e.maxX; e.dir = -1; }
    if (aabb(playerRect(p), e)) {
      const feetPen = (p.y + PLAYER.H) - e.y;
      if (p.vy > 0 && feetPen < 34) {
        // 踩头击杀
        e.dead = true;
        p.vy = -PLAYER.JUMP_V * PLAYER.STOMP_BOUNCE;
        p.jumps = 1;
        s.combo += 1;
        s.maxCombo = Math.max(s.maxCombo, s.combo);
        s.score += 50 * s.combo;
        run._emit('stomp', { combo: s.combo });
        if (s.combo >= 2) run._emit('combo', { combo: s.combo });
      } else if (p.onGround && p.invT <= 0) {
        // 仅地面接触致死；跳跃穿过/踩头安全（与原作 speed.y==0 判定一致）
        return kill(run, 'enemy');
      }
    }
  }

  // ---- 加速垫 ----
  for (const b of run.entities.boosters) {
    if (!b.used && aabb(playerRect(p), b)) {
      b.used = true;
      p.boostT = PLAYER.BOOST_TIME;
      p.invT = Math.max(p.invT, PLAYER.INV_TIME);
      s.score += 50;
      run._emit('boost', {});
    }
  }

  // ---- 奖励星（用较宽松的距离判定）----
  for (const st of run.entities.stars) {
    if (st.taken) continue;
    const cx = p.x + PLAYER.W / 2;
    const cy = p.y + PLAYER.H / 2;
    const dx = cx - st.x;
    const dy = cy - st.y;
    if (dx * dx + dy * dy < 70 * 70) {
      st.taken = true;
      s.stars += 1;
      s.score += 100;
      run._emit('star', { stars: s.stars });
    }
  }

  // ---- 近失（障碍从身后掠过）----
  for (const list of [run.entities.rocks, run.entities.spikes, run.entities.chompers]) {
    for (const o of list) {
      if (!o.passed && o.x + o.w < p.x) {
        o.passed = true;
        run._emit('nearMiss', {});
      }
    }
  }
  for (const e of run.entities.enemies) {
    if (!e.passed && e.x + e.w < p.x) {
      e.passed = true;
      if (!e.dead) run._emit('nearMiss', {});
    }
  }
  for (const ring of run.entities.rings) {
    if (!ring.passed && ring.x + ring.r < p.x) {
      ring.passed = true;
      run._emit('nearMiss', {});
    }
  }

  // ---- 检查点（每 600px）----
  const cp = Math.floor(p.x / 600) * 600;
  if (cp > 0 && !run._checkpoints.has(cp)) {
    run._checkpoints.add(cp);
    s.score += 10;
    run._emit('checkpoint', { x: cp });
  }

  // ---- 连击落地重置 ----
  if (p.onGround && wasAirborne && s.combo > 0) {
    // 落地不重置连击——只有碰敌人侧面/死才重置；这里仅用于防抖。
  }

  // ---- 胜利 ----
  if (p.x + PLAYER.W >= s.goalX) {
    s.phase = 'won';
    s.score += 200;
    run._emit('win', { stars: run.rating(), score: s.score });
    return;
  }

  s.time += dt;
}

function kill(run, reason) {
  const s = run.state;
  if (s.phase !== 'playing') return;
  if (s.player.invT > 0) return; // 无敌帧（加速垫）不致死
  s.phase = 'lost';
  s.player.alive = false;
  run._emit('lose', { reason, score: s.score });
}
