// MR HAT ESCAPE · 纯逻辑 sim（无 DOM / 无 canvas），供 main / selfplay / node --test 共用。
// 事件表：drainEvents() 返回 [{type, ...payload}]；payload 里绝不使用 `type` 字段（会覆盖事件名）。

import { LEVELS } from '../../config/levels.js';
import { WORLD, PLAYER, STEP, COMBO } from '../../config/game.config.js';

const EPS = 0.5;

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

const rectsOverlap = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
const aabb = (p, pl) => p.x < pl.x + pl.w && p.x + PLAYER.W > pl.x && p.y < pl.y + pl.h && p.y + PLAYER.H > pl.y;
const horizOverlap = (p, pl) => p.x < pl.x + pl.w && p.x + PLAYER.W > pl.x;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const playerRect = (p) => ({ x: p.x, y: p.y, w: PLAYER.W, h: PLAYER.H });

function emit(run, type, payload) {
  run.events.push({ type, ...(payload || {}) });
}

function resetLevel(run) {
  const s = run.state;
  const def = run.def;
  s.player.x = def.playerStart.x;
  s.player.y = def.playerStart.y;
  s.player.vx = 0;
  s.player.vy = 0;
  s.player.onGround = false;
  s.player.facing = 1;
  s.player.prevJump = false;
  s.keyCollected = false;
  s.doorOpen = false;
  s.starsCollected = 0;
  s.combo = 0;
  s.comboTimer = 0;
  s.score = 0;
  s.time = 0;
  s.stars = def.stars.map((st) => ({ ...st, collected: false }));
  s.key = def.key ? { ...def.key } : null;
  s.crates = (def.crates || []).map((c) => ({ ...c }));
  s.draggables = (def.draggables || []).map((d) => ({ ...d }));
  s.blades = (def.blades || []).map((b) => ({ ...b, angle: 0 }));
  if (s.special === 'pulley' && s.key) s.key.y = def.key.y;
  s.dragTarget = null;
}

function tryPushCrate(run, crate, dx) {
  const s = run.state;
  const nx = crate.x + dx;
  if (nx < 0 || nx + crate.w > s.width) return false;
  const test = { x: nx, y: crate.y, w: crate.w, h: crate.h };
  for (const pl of s.platforms) if (pl.kind !== 'oneway' && rectsOverlap(test, pl)) return false;
  for (const d of s.draggables) if (d.kind === 'platform' && rectsOverlap(test, d)) return false;
  for (const c of s.crates) if (c !== crate && rectsOverlap(test, c)) return false;
  crate.x = nx;
  return true;
}

function moveAndCollide(run) {
  const s = run.state;
  const p = s.player;
  const solid = s.platforms.filter((pl) => pl.kind !== 'oneway');
  const bridges = s.draggables.filter((d) => d.kind === 'platform');
  const oneways = s.platforms.filter((pl) => pl.kind === 'oneway');

  // X 轴（只有脚部在平台顶面以下才做水平阻挡，允许跳到平台/木箱上面）
  p.x += p.vx;
  for (const pl of [...solid, ...bridges]) {
    if (!aabb(p, pl)) continue;
    if (p.y + PLAYER.H <= pl.y + 4) continue;
    if (p.vx > 0) p.x = pl.x - PLAYER.W - EPS;
    else if (p.vx < 0) p.x = pl.x + pl.w + EPS;
  }
  for (const c of s.crates) {
    if (!aabb(p, c)) continue;
    if (p.y + PLAYER.H <= c.y + 4) continue;
    const dir = p.vx > 0 ? 1 : p.vx < 0 ? -1 : 0;
    if (dir === 0) continue;
    const dx = dir * Math.abs(p.vx);
    if (tryPushCrate(run, c, dx)) {
      /* 推开了，相对位置不变 */
    } else if (dir > 0) p.x = c.x - PLAYER.W - EPS;
    else p.x = c.x + c.w + EPS;
  }

  // Y 轴
  const prevBottom = p.y + PLAYER.H;
  p.y += p.vy;
  p.onGround = false;
  for (const pl of [...solid, ...bridges]) {
    if (!aabb(p, pl)) continue;
    if (p.vy >= 0 && prevBottom <= pl.y + EPS) {
      p.y = pl.y - PLAYER.H;
      if (p.vy > 1.5) emit(run, 'land');
      p.vy = 0;
      p.onGround = true;
    } else if (p.vy < 0) {
      p.y = pl.y + pl.h;
      p.vy = 0;
    } else {
      p.y = pl.y - PLAYER.H;
      p.vy = 0;
      p.onGround = true;
    }
  }
  for (const c of s.crates) {
    if (!aabb(p, c)) continue;
    if (p.vy >= 0 && prevBottom <= c.y + EPS) {
      p.y = c.y - PLAYER.H;
      if (p.vy > 1.5) emit(run, 'land');
      p.vy = 0;
      p.onGround = true;
    } else if (p.vy < 0) {
      p.y = c.y + c.h;
      p.vy = 0;
    }
  }
  for (const pl of oneways) {
    if (p.vy >= 0 && prevBottom <= pl.y + EPS && horizOverlap(p, pl)) {
      p.y = pl.y - PLAYER.H;
      if (p.vy > 1.5) emit(run, 'land');
      p.vy = 0;
      p.onGround = true;
    }
  }

  // 世界边界
  if (p.x < 0) p.x = 0;
  if (p.x > s.width - PLAYER.W) p.x = s.width - PLAYER.W;
}

function handleDrag(run, inp) {
  const s = run.state;
  if (!s.draggables.length) {
    s.dragTarget = null;
    return;
  }
  if (inp.pointerDown) {
    if (!s.dragTarget) {
      for (const d of s.draggables) {
        if (inp.pointerX >= d.x - 8 && inp.pointerX <= d.x + d.w + 8 && inp.pointerY >= d.y - 8 && inp.pointerY <= d.y + d.h + 8) {
          s.dragTarget = d;
          s.dragOffset = { x: inp.pointerX - d.x, y: inp.pointerY - d.y };
          break;
        }
      }
    }
    if (s.dragTarget) {
      const d = s.dragTarget;
      const nx = inp.pointerX - s.dragOffset.x;
      const ny = inp.pointerY - s.dragOffset.y;
      if (d.kind === 'platform') {
        d.x = clamp(nx, 0, s.width - d.w);
        d.y = clamp(ny, d.minY ?? d.y, d.maxY ?? d.y);
      } else if (d.kind === 'keyword') {
        d.x = clamp(nx, 0, s.width - d.w);
        d.y = clamp(ny, 0, WORLD.HEIGHT - d.h);
        if (rectsOverlap(d, s.door)) {
          s.doorOpen = true;
          s.draggables = s.draggables.filter((x) => x !== d);
          s.dragTarget = null;
          emit(run, 'doorOpen');
        }
      }
    }
  } else {
    s.dragTarget = null;
  }
}

function checkSpikes(run) {
  const pr = playerRect(run.state.player);
  for (const sp of run.state.spikes) {
    const hit = { x: sp.x + 6, y: sp.y + 4, w: sp.w - 12, h: sp.h - 4 };
    if (rectsOverlap(pr, hit)) return true;
  }
  return false;
}

function checkBlades(run) {
  const p = run.state.player;
  const cx = p.x + PLAYER.W / 2;
  const cy = p.y + PLAYER.H / 2;
  for (const b of run.state.blades) {
    const dx = cx - b.x;
    const dy = cy - b.y;
    const rr = b.r - 8;
    if (dx * dx + dy * dy <= rr * rr) return true;
  }
  return false;
}

function die(run, cause) {
  const s = run.state;
  s.deaths += 1;
  emit(run, 'lose', { cause });
  resetLevel(run);
}

function win(run) {
  const s = run.state;
  s.phase = 'won';
  s.wonAt = s.time;
  s.starsEarned = s.starsCollected;
  emit(run, 'win', { stars: s.starsCollected, time: s.time });
}

function step(run, dt, input) {
  const s = run.state;
  if (s.phase !== 'playing') return;
  s.time += dt;
  const p = s.player;
  const inp = input || run.lastInput || {};

  // 水平方向
  p.vx = 0;
  if (inp.left) p.vx = -PLAYER.SPEED;
  else if (inp.right) p.vx = PLAYER.SPEED;
  if (p.vx !== 0) p.facing = p.vx > 0 ? 1 : -1;

  // 跳跃（上升沿触发；continuousJump 允许空中二段跳）
  const jumpEdge = !!inp.jump && !p.prevJump;
  if (jumpEdge && (s.continuousJump || p.onGround)) {
    p.vy = PLAYER.JUMP_VY;
    p.onGround = false;
    emit(run, 'jump');
  }
  p.prevJump = !!inp.jump;

  // 滑轮钥匙：不按住就上升
  if (s.special === 'pulley' && !s.keyCollected && s.key) {
    if (!inp.hold) s.key.y -= s.riseSpeed * (dt * 60);
    if (s.key.y < s.keyMaxY) s.key.y = s.keyMaxY;
    if (s.key.y > s.keyMinY) s.key.y = s.keyMinY;
  }

  // 重力 + 积分 + 碰撞
  p.vy += PLAYER.GRAVITY;
  if (p.vy > PLAYER.MAX_FALL) p.vy = PLAYER.MAX_FALL;
  moveAndCollide(run);

  // 锯片旋转（供渲染）
  for (const b of s.blades) {
    b.angle = (b.angle || 0) + (b.clockwise ? 1 : -1) * b.speed * (dt * 60) * 0.06;
  }

  handleDrag(run, inp);

  // 危险判定
  if (checkSpikes(run)) { die(run, 'spike'); return; }
  if (checkBlades(run)) { die(run, 'blade'); return; }

  // 钥匙
  if (!s.keyCollected && s.key && rectsOverlap(playerRect(p), s.key)) {
    s.keyCollected = true;
    s.doorOpen = true;
    emit(run, 'key');
    emit(run, 'doorOpen');
  }

  // 星星 + 连击
  for (const star of s.stars) {
    if (star.collected) continue;
    const sr = { x: star.x - 14, y: star.y - 14, w: 28, h: 28 };
    if (rectsOverlap(playerRect(p), sr)) {
      star.collected = true;
      s.starsCollected += 1;
      s.combo = s.comboTimer > 0 ? s.combo + 1 : 1;
      s.comboTimer = COMBO.WINDOW;
      s.score += COMBO.SCORE_PER_STAR + (s.combo - 1) * COMBO.COMBO_BONUS;
      emit(run, 'star', { stars: s.starsCollected });
      if (s.combo >= 2) emit(run, 'combo', { combo: s.combo });
    }
  }
  if (s.comboTimer > 0) {
    s.comboTimer -= dt;
    if (s.comboTimer <= 0) { s.comboTimer = 0; s.combo = 0; }
  }

  // 门
  if (s.doorOpen && rectsOverlap(playerRect(p), s.door)) {
    win(run);
    return;
  }

  // 掉出世界
  if (p.y > WORLD.HEIGHT + 80) {
    die(run, 'fall');
  }
}

export function createRun(levelIndex = 0, opts = {}) {
  const def = LEVELS[levelIndex] || LEVELS[0];
  const run = {
    levelIndex,
    def,
    state: {
      phase: 'playing',
      level: levelIndex + 1,
      levelIndex,
      width: def.width,
      time: 0,
      deaths: 0,
      starsCollected: 0,
      starsTotal: def.stars.length,
      starsEarned: 0,
      combo: 0,
      comboTimer: 0,
      score: 0,
      keyCollected: false,
      doorOpen: false,
      wonAt: 0,
      continuousJump: def.continuousJump !== false,
      special: def.special || null,
      riseSpeed: def.riseSpeed || 0.5,
      keyMaxY: def.keyMaxY || 0,
      keyMinY: def.keyMinY || 0,
      player: { x: def.playerStart.x, y: def.playerStart.y, vx: 0, vy: 0, onGround: false, facing: 1, prevJump: false },
      platforms: def.platforms.map((p) => ({ ...p })),
      spikes: (def.spikes || []).map((sp) => ({ ...sp })),
      blades: (def.blades || []).map((b) => ({ ...b, angle: 0 })),
      stars: (def.stars || []).map((st) => ({ ...st, collected: false })),
      crates: (def.crates || []).map((c) => ({ ...c })),
      draggables: (def.draggables || []).map((d) => ({ ...d })),
      key: def.key ? { ...def.key } : null,
      door: { ...def.door },
      dragTarget: null,
    },
    events: [],
    lastInput: { left: false, right: false, jump: false, hold: false, pointerX: 0, pointerY: 0, pointerDown: false },
  };
  run.step = (dt, input) => step(run, dt, input);
  run.drainEvents = () => { const e = run.events; run.events = []; return e; };
  run.reset = () => resetLevel(run);
  emit(run, 'start');
  return run;
}

export { STEP };
