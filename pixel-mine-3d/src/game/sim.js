// src/game/sim.js — 纯逻辑体素挖矿模拟（无 DOM/three/Date.now，随机走 seed）。
// 世界 48×64×48：y=0 地表，向下越深越值钱；矿脉/岩浆/宝藏房按 seed 确定性生成。
// 输入契约：{ yaw, pitch, f, s, jump, mine, place, interact, target? }
//   f=前(+1)/后(-1)，s=右(+1)/左(-1)，jump/place/interact 为边沿（单帧 true）。
// 事件总线：sim 推 events，main 分发（render/audio/ui 各自消费）。
import { WORLD, PLAYER, T, BLOCKS, LAYERS, ORE_GEN, TREASURE, UPGRADES, GOAL, STEP } from '../../config/game.config.js';

const ORE_TYPES = new Set([T.COAL, T.IRON, T.GOLD, T.DIAMOND, T.TREASURE]);

// ---------- 小工具 ----------
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

const idx = (x, y, z) => (y * WORLD.W + x) * WORLD.D + z;

function layerBase(by) {
  for (const l of LAYERS) if (by <= l.maxDepth) return l.base;
  return T.BEDROCK;
}

function levelFor(by) {
  for (const l of LAYERS) if (by <= l.maxDepth) return l.level;
  return 5;
}

// ---------- 世界生成 ----------
function genWorld(seed) {
  const N = WORLD.W * WORLD.H * WORLD.D;
  const blocks = new Uint8Array(N);
  const rnd = mulberry32(seed);
  for (let y = 0; y < WORLD.H; y++) {
    const base = layerBase(y);
    for (let x = 0; x < WORLD.W; x++) {
      for (let z = 0; z < WORLD.D; z++) blocks[idx(x, y, z)] = base;
    }
  }
  // 矿脉/岩浆
  for (const g of ORE_GEN) {
    if (g.seams) {
      for (let i = 0; i < g.seams; i++) {
        const y = g.band[0] + Math.floor(rnd() * (g.band[1] - g.band[0]));
        const alongX = rnd() < 0.5;
        const cx = 2 + Math.floor(rnd() * (WORLD.W - 4));
        const cz = 2 + Math.floor(rnd() * (WORLD.D - 4));
        for (let k = 0; k < g.seamLen; k++) {
          const x = clamp(cx + (alongX ? k : 0) - Math.floor(g.seamLen / 2), 1, WORLD.W - 2);
          const z = clamp(cz + (alongX ? 0 : k) - Math.floor(g.seamLen / 2), 1, WORLD.D - 2);
          if (blocks[idx(x, y, z)] !== T.LAVA) blocks[idx(x, y, z)] = g.type;
        }
      }
    } else {
      for (let i = 0; i < g.veins; i++) {
        const y = g.band[0] + Math.floor(rnd() * (g.band[1] - g.band[0]));
        const cx = 2 + Math.floor(rnd() * (WORLD.W - 4));
        const cz = 2 + Math.floor(rnd() * (WORLD.D - 4));
        for (let k = 0; k < g.size; k++) {
          const x = clamp(cx + Math.floor(rnd() * 3 - 1), 1, WORLD.W - 2);
          const y2 = clamp(y + Math.floor(rnd() * 3 - 1), g.band[0], g.band[1]);
          const z = clamp(cz + Math.floor(rnd() * 3 - 1), 1, WORLD.D - 2);
          if (blocks[idx(x, y2, z)] !== T.LAVA) blocks[idx(x, y2, z)] = g.type;
        }
      }
    }
  }
  // 教学矿脉：出生点正下方竖井（24,24）两侧各层保证有矿，人类/ bot 直挖必有收获
  const vein = (x, z, ys, type) => ys.forEach((y) => { blocks[idx(x, y, z)] = type; });
  vein(23, 24, [17, 18], T.COAL);
  vein(23, 24, [26, 27], T.IRON);
  vein(23, 24, [34, 35], T.GOLD);
  vein(23, 24, [42, 43], T.DIAMOND);

  // 宝藏房：基岩中空腔 + 地板宝藏块 + 上方软石裂缝（出生点正下方）
  const R = TREASURE.room;
  for (let y = R.y0; y <= R.y1; y++) {
    for (let x = R.x0; x <= R.x1; x++) {
      for (let z = R.z0; z <= R.z1; z++) {
        blocks[idx(x, y, z)] = (y === R.y1) ? T.TREASURE : T.AIR;
      }
    }
  }
  for (let y = 48; y <= R.y0 - 1; y++) {
    blocks[idx(TREASURE.crack[0], y, TREASURE.crack[1])] = T.STONE;
  }
  return blocks;
}

// ---------- 方块查询 ----------
function getBlock(run, x, y, z) {
  if (x < 0 || x >= WORLD.W || z < 0 || z >= WORLD.D || y >= WORLD.H) return T.AIR;
  if (y < 0) return T.AIR; // 地表以上
  return run.blocks[idx(x, y, z)];
}
function setBlock(run, x, y, z, t) {
  if (x < 0 || x >= WORLD.W || z < 0 || z >= WORLD.D || y < 0 || y >= WORLD.H) return;
  run.blocks[idx(x, y, z)] = t;
  run.dirty = true; // 渲染层据此重建受影响 chunk
}
function isSolid(run, x, y, z) {
  const b = getBlock(run, x, y, z);
  return b !== T.AIR && b !== T.LADDER;
}

// ---------- 事件 ----------
function emit(run, type, payload = {}) {
  run.events.push({ type, t: run.time, ...payload });
}

// ---------- 玩家 AABB 碰撞（世界 y → 块坐标 by 转换） ----------
function collides(run, px, py, pz) {
  const hw = PLAYER.WIDTH / 2;
  const x0 = Math.floor(px - hw), x1 = Math.floor(px + hw);
  const z0 = Math.floor(pz - hw), z1 = Math.floor(pz + hw);
  const by0 = Math.floor(-(py + PLAYER.HEIGHT) + 1e-9);
  const by1 = Math.floor(-py - 1e-9);
  for (let by = by0; by <= by1; by++) {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if (isSolid(run, x, by, z)) return true;
      }
    }
  }
  return false;
}

// 玩家是否贴着梯子（身体周围 4 个水平邻格有梯子）
function onLadder(run) {
  const p = run.player;
  const cx = Math.floor(p.x), cz = Math.floor(p.z);
  const by0 = Math.floor(-(p.y + PLAYER.HEIGHT) + 1e-9);
  const by1 = Math.floor(-p.y - 1e-9);
  for (let by = by0; by <= by1; by++) {
    for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      if (getBlock(run, cx + dx, by, cz + dz) === T.LADDER) return true;
    }
  }
  return false;
}

// ---------- 射线（DDA，块坐标系：by 向下，与渲染相机同步） ----------
function raycast(run) {
  const p = run.player;
  const ox = p.x, oy = -(p.y + PLAYER.EYE), oz = p.z;   // 块空间：y 向下
  const cp = Math.cos(p.pitch), sp = Math.sin(p.pitch);
  const cy = Math.cos(p.yaw), sy = Math.sin(p.yaw);
  const dx = -sy * cp, dy = -sp, dz = -cy * cp;
  let bx = Math.floor(ox), by = Math.floor(oy), bz = Math.floor(oz);
  const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
  const tDx = dx !== 0 ? Math.abs(1 / dx) : Infinity;
  const tDy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
  const tDz = dz !== 0 ? Math.abs(1 / dz) : Infinity;
  let tMaxX = dx !== 0 ? ((stepX > 0 ? bx + 1 - ox : ox - bx) * tDx) : Infinity;
  let tMaxY = dy !== 0 ? ((stepY > 0 ? by + 1 - oy : oy - by) * tDy) : Infinity;
  let tMaxZ = dz !== 0 ? ((stepZ > 0 ? bz + 1 - oz : oz - bz) * tDz) : Infinity;
  let nx = 0, ny = 0, nz = 0, t = 0;
  for (let i = 0; i < 96; i++) {
    if (t > WORLD.REACH) return null;
    if (isSolid(run, bx, by, bz)) return { bx, by, bz, nx, ny, nz, dist: t };
    if (tMaxX < tMaxY && tMaxX < tMaxZ) { bx += stepX; t = tMaxX; tMaxX += tDx; nx = -stepX; ny = 0; nz = 0; }
    else if (tMaxY < tMaxZ) { by += stepY; t = tMaxY; tMaxY += tDy; nx = 0; ny = -stepY; nz = 0; }
    else { bz += stepZ; t = tMaxZ; tMaxZ += tDz; nx = 0; ny = 0; nz = -stepZ; }
  }
  return null;
}

// ---------- 背包 ----------
function capacityOf(run) { return 20 + run.upgrades.pack * UPGRADES.pack.per; }
function invTotal(run) {
  let n = 0;
  for (const k in run.inventory) n += run.inventory[k];
  return n;
}
function lowestType(run) {
  let best = null, bestV = Infinity;
  for (const k in run.inventory) {
    const v = BLOCKS[k].value;
    if (v < bestV) { bestV = v; best = k; }
  }
  return best;
}
function addToInventory(run, type, n) {
  const value = BLOCKS[type].value;
  if (value <= 0) return; // bedrock/lava 不掉落
  for (let i = 0; i < n; i++) {
    if (invTotal(run) < capacityOf(run)) {
      run.inventory[type] = (run.inventory[type] || 0) + 1;
    } else if (run.upgrades.sort) {
      const low = lowestType(run);
      if (low != null) { run.inventory[low]--; if (run.inventory[low] <= 0) delete run.inventory[low]; run.inventory[type] = (run.inventory[type] || 0) + 1; }
    } else {
      if (!run._invFullAt || run.time - run._invFullAt > 1.5) { run._invFullAt = run.time; emit(run, 'inventory_full'); }
      return;
    }
  }
}
function dropHalf(run) {
  let dropped = 0;
  for (const k in run.inventory) {
    const half = Math.ceil(run.inventory[k] / 2);
    run.inventory[k] -= half; dropped += half;
    if (run.inventory[k] <= 0) delete run.inventory[k];
  }
  run.stats.dropped += dropped;
}
function sellAll(run) {
  const total = invTotal(run);
  if (total <= 0) return;
  let value = 0;
  for (const k in run.inventory) {
    const v = BLOCKS[k].value * run.inventory[k];
    value += v * (run.upgrades.smelt ? 1.25 : 1);
  }
  run.coins += Math.round(value);
  run.stats.earned += Math.round(value);
  run.stats.sold += total;
  run.inventory = {};
  emit(run, 'sell', { n: total, value: Math.round(value) });
}

// ---------- 创建/更新 ----------
export function createSim({ seed = 1, bestDepth = 0 } = {}) {
  const blocks = genWorld(seed);
  const [sx, sy, sz] = WORLD.SPAWN;
  return {
    seed,
    bestDepth,
    blocks,
    dirty: true,
    time: 0,
    phase: 'playing',           // playing | finished
    treasureFound: false,
    coins: 0,
    depthMax: 0,
    goalDone: false,
    recallCooldown: 0,
    _invFullAt: null,
    _climbAt: 0,
    _staminaAt: 0,
    inventory: {},
    upgrades: { pick: 0, pack: 0, stamina: 0, lamp: 0, vein: false, double: false, smelt: false, sort: false, lava: false },
    player: {
      x: sx + 0.5, y: sy, z: sz + 0.5, vx: 0, vy: 0, vz: 0,
      yaw: 0, pitch: 0, onGround: true, stamina: PLAYER.STAMINA, hp: PLAYER.HP,
      fallFrom: 0,
    },
    mine: { target: null, progress: 0, stage: 0 },
    stats: { moved: false, mined: 0, sold: 0, earned: 0, dropped: 0, upgraded: 0, deaths: 0, depthRecord: false },
    events: [],
  };
}

export function updateSim(run, input = {}) {
  if (run.phase !== 'playing') return;
  const dt = STEP;
  const p = run.player;
  p.yaw = input.yaw ?? p.yaw;
  p.pitch = input.pitch ?? p.pitch;
  run.recallCooldown = Math.max(0, run.recallCooldown - dt);

  const climbing = onLadder(run);
  const f = input.f || 0, s = input.s || 0;

  // 水平目标速度
  const cos = Math.cos(p.yaw), sin = Math.sin(p.yaw);
  let wx = (s * cos - f * sin) * PLAYER.SPEED;
  let wz = (-f * cos - s * sin) * PLAYER.SPEED;

  if (climbing) {
    // 梯子：前=上，后=下，重力关闭
    if (f !== 0) {
      p.vy = f * PLAYER.CLIMB;
      if (!run._climbAt || run.time - run._climbAt > 0.6) { run._climbAt = run.time; emit(run, 'climb'); }
      run.player.stamina = Math.max(0, p.stamina - PLAYER.CLIMB_STAMINA * dt);
    } else {
      p.vy = 0;
    }
    wx *= 0.3; wz *= 0.3; // 梯子上水平移动减速
  } else {
    p.vy -= PLAYER.GRAVITY * dt;
  }

  const k = p.onGround ? PLAYER.ACCEL : PLAYER.ACCEL * 0.35;
  p.vx += (wx - p.vx) * Math.min(1, k * dt / PLAYER.SPEED * 2);
  p.vz += (wz - p.vz) * Math.min(1, k * dt / PLAYER.SPEED * 2);
  if (p.onGround && !f && !s) { const d = Math.max(0, 1 - PLAYER.FRICTION * dt); p.vx *= d; p.vz *= d; }

  if (input.jump && p.onGround && !climbing) { p.vy = PLAYER.JUMP; p.onGround = false; }

  // 分轴移动 + 碰撞
  const prevY = p.y;
  p.x += p.vx * dt;
  if (collides(run, p.x, p.y, p.z)) { p.x -= p.vx * dt; p.vx = 0; }
  p.z += p.vz * dt;
  if (collides(run, p.x, p.y, p.z)) { p.z -= p.vz * dt; p.vz = 0; }
  p.y += p.vy * dt;
  if (collides(run, p.x, p.y, p.z)) {
    if (p.vy < 0) { // 落地
      const fallDist = prevY - p.y;
      if (fallDist > PLAYER.FALL_DMG_Y) {
        p.hp -= PLAYER.FALL_DMG * (fallDist - PLAYER.FALL_DMG_Y);
        if (p.hp <= 0) forcedReturn(run);
      }
    }
    p.y -= p.vy * dt;
    const onGroundNow = p.vy <= 0;
    p.vy = 0;
    p.onGround = onGroundNow;
  } else {
    p.onGround = false;
  }

  // 世界边界
  const hw = PLAYER.WIDTH / 2;
  p.x = clamp(p.x, hw, WORLD.W - hw);
  p.z = clamp(p.z, hw, WORLD.D - hw);
  p.y = clamp(p.y, -(WORLD.H - 1), 8);

  // 移动标记（教学第 1 步）
  if (Math.abs(p.vx) + Math.abs(p.vz) > 1) run.stats.moved = true;

  // 岩浆接触
  if (!run.upgrades.lava && touchingLava(run)) {
    p.hp -= PLAYER.LAVA_DPS * dt;
    if (run.time - (run._lavaAt || -9) > 1) { run._lavaAt = run.time; emit(run, 'lava_hit'); }
    if (p.hp <= 0) forcedReturn(run);
  }

  // 挖掘
  if (input.mine) {
    mineTick(run, input);
  } else {
    run.mine.progress = 0; run.mine.stage = 0; run.mine.target = null;
  }

  // 放梯（边沿）
  if (input.place) placeLadder(run);

  // 体力
  if (input.mine && run.mine.target) {
    p.stamina = Math.max(0, p.stamina - PLAYER.MINE_STAMINA * dt);
    if (p.stamina <= 0) { forcedReturn(run); }
  } else if (!climbing && p.onGround && Math.abs(p.vx) + Math.abs(p.vz) < 0.5 && !input.mine) {
    p.stamina = Math.min(staminaMax(run), p.stamina + PLAYER.STAMINA_REGEN * dt);
  }
  if (p.stamina <= 5 && run.time - (run._staminaAt || -9) > 3) { run._staminaAt = run.time; emit(run, 'stamina_low'); }

  // 深度纪录
  const depth = clamp(-p.y, 0, WORLD.H);
  if (depth > run.depthMax) {
    run.depthMax = depth;
    if (!run.stats.depthRecord && run.bestDepth != null && depth > run.bestDepth) {
      run.stats.depthRecord = true;
      emit(run, 'depth_record', { depth: Math.floor(depth) });
    }
  }

  // 每日目标
  if (!run.goalDone && run.depthMax >= GOAL.target) {
    run.goalDone = true;
    run.coins += GOAL.reward;
    emit(run, 'goal_complete', { value: GOAL.reward });
  }

  // 卖矿台自动结算
  const [sx2, , sz2] = WORLD.SELL;
  const dist = Math.hypot(p.x - (sx2 + 0.5), p.z - (sz2 + 0.5));
  if (invTotal(run) > 0 && dist < WORLD.SELL_RADIUS) sellAll(run);

  run.time += dt;
}

function touchingLava(run) {
  const p = run.player;
  const hw = PLAYER.WIDTH / 2;
  const x0 = Math.floor(p.x - hw), x1 = Math.floor(p.x + hw);
  const z0 = Math.floor(p.z - hw), z1 = Math.floor(p.z + hw);
  const by0 = Math.floor(-(p.y + PLAYER.HEIGHT) + 1e-9);
  const by1 = Math.floor(-p.y - 1e-9);
  for (let by = by0; by <= by1; by++) {
    for (let x = x0; x <= x1; x++) {
      for (let z = z0; z <= z1; z++) {
        if (getBlock(run, x, by, z) === T.LAVA) return true;
      }
    }
  }
  return false;
}

function mineTick(run, input) {
  // 目标：bot 直接给 target，真人走射线
  let target = null;
  if (Array.isArray(input.target)) {
    const [bx, by, bz] = input.target;
    if (isSolid(run, bx, by, bz)) target = { bx, by, bz, nx: 0, ny: 1, nz: 0, dist: 0 };
  } else {
    target = raycast(run);
  }
  if (!target) { run.mine.progress = 0; run.mine.stage = 0; run.mine.target = null; return; }

  const key = `${target.bx},${target.by},${target.bz}`;
  const same = run.mine.target === key;
  if (!same) { run.mine.target = key; run.mine.progress = 0; run.mine.stage = 0; emit(run, 'mine_start', { bx: target.bx, by: target.by, bz: target.bz }); }

  const type = getBlock(run, target.bx, target.by, target.bz);
  const hardness = BLOCKS[type].hardness;
  if (hardness <= 0) { run.mine.progress = 0; return; } // 岩浆不可挖

  const speed = (1 + run.upgrades.pick * UPGRADES.pick.per) / hardness;
  run.mine.progress += speed * STEP;
  const stage = Math.min(WORLD.CRACK_STAGES, Math.ceil(run.mine.progress / hardness * WORLD.CRACK_STAGES));
  if (stage !== run.mine.stage) { run.mine.stage = stage; emit(run, 'crack', { stage }); }

  if (run.mine.progress >= hardness) {
    breakBlock(run, target.bx, target.by, target.bz, type);
    run.mine.progress = 0; run.mine.stage = 0; run.mine.target = null;
  }
}

function breakBlock(run, bx, by, bz, type) {
  setBlock(run, bx, by, bz, T.AIR);
  run.stats.mined++;
  emit(run, 'block_break', { bx, by, bz, block: type });
  // 签名：打破与金矿脉相邻的石头 → 发光金脉
  if (type === T.STONE) {
    for (const [dx, dy, dz] of [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]]) {
      if (getBlock(run, bx + dx, by + dy, bz + dz) === T.GOLD) { emit(run, 'gold_vein'); break; }
    }
  }
  if (ORE_TYPES.has(type)) {
    const n = run.upgrades.double ? 2 : 1;
    if (type === T.TREASURE) {
      run.coins += BLOCKS[T.TREASURE].value * n;
      run.stats.earned += BLOCKS[T.TREASURE].value * n;
      emit(run, 'treasure_found', { value: BLOCKS[T.TREASURE].value * n });
      run.treasureFound = true;
      run.phase = 'finished';
      emit(run, 'win');
      return;
    }
    addToInventory(run, type, n);
    emit(run, 'ore_collect', { block: type, count: n });
  } else {
    addToInventory(run, type, 1);
  }
}

function placeLadder(run) {
  const hit = raycast(run);
  if (!hit) return;
  const bx = hit.bx + hit.nx, by = hit.by + hit.ny, bz = hit.bz + hit.nz;
  if (getBlock(run, bx, by, bz) === T.AIR && by >= 0 && by < WORLD.H) {
    setBlock(run, bx, by, bz, T.LADDER);
    emit(run, 'ladder_place', { bx, by, bz });
  }
}

// ---------- 强制回营地 / 主动回营地 ----------
export function recallToCamp(run, voluntary = true) {
  if (!voluntary) {
    dropHalf(run);
    run.stats.deaths++;
  }
  // 回营地 = 传送到卖矿台（地表安全点，避免掉回竖井）
  const [sx, sy, sz] = WORLD.SELL;
  const p = run.player;
  p.x = sx + 0.5; p.y = sy; p.z = sz + 0.5; p.vx = 0; p.vy = 0; p.vz = 0;
  p.hp = PLAYER.HP; p.stamina = staminaMax(run); p.onGround = true;
  run.recallCooldown = 0.4;
  emit(run, voluntary ? 'return' : 'forced_return');
}

function forcedReturn(run) {
  if (run.recallCooldown > 0) return;
  recallToCamp(run, false);
}

// ---------- 结算（收工） ----------
export function finish(run) {
  if (run.phase !== 'playing') return;
  sellAll(run);
  run.phase = 'finished';
  emit(run, 'session_end');
}

// ---------- 升级 ----------
export function staminaMax(run) { return PLAYER.STAMINA + run.upgrades.stamina * UPGRADES.stamina.per; }

export function buyUpgrade(run, id) {
  const u = UPGRADES[id];
  if (!u) return { ok: false };
  const stat = u.levels != null;
  const cur = run.upgrades[id];
  if (stat && cur >= u.levels) return { ok: false, maxed: true };
  if (!stat && cur) return { ok: false, maxed: true };
  const cost = stat ? u.costs[cur] : u.cost;
  if (run.coins < cost) return { ok: false, need: cost };
  run.coins -= cost;
  if (stat) run.upgrades[id] = cur + 1; else run.upgrades[id] = true;
  run.stats.upgraded++;
  emit(run, 'upgrade', { id, level: run.upgrades[id] });
  return { ok: true, cost };
}

// ---------- HUD / 事件 ----------
export function getHud(run) {
  return {
    phase: run.phase,
    time: run.time,
    coins: run.coins,
    depth: Math.floor(Math.max(0, -run.player.y)),
    depthMax: Math.floor(run.depthMax),
    stamina: Math.ceil(run.player.stamina),
    staminaMax: staminaMax(run),
    hp: Math.ceil(run.player.hp),
    inv: invTotal(run),
    capacity: capacityOf(run),
    upgrades: { ...run.upgrades },
    pickLevel: run.upgrades.pick,
    packLevel: run.upgrades.pack,
    staminaLevel: run.upgrades.stamina,
    lampLevel: run.upgrades.lamp,
    crack: run.mine.stage / WORLD.CRACK_STAGES,
    mineTarget: run.mine.target,
    level: levelFor(Math.floor(Math.max(0, -run.player.y))),
    goal: { done: run.goalDone, type: GOAL.type, target: GOAL.target, progress: Math.floor(run.depthMax) },
    stats: { ...run.stats },
    treasureFound: run.treasureFound,
  };
}

export function drainEvents(run) {
  if (!run.events.length) return [];
  const evs = run.events;
  run.events = [];
  return evs;
}
