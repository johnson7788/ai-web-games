// Pirate Escape Run · 纯逻辑 sim（零 DOM，可在 node --test 与 selfplay 里直接 import）
//
// 玩法骨架 1:1 还原参考原作「海盗逃命」：
//   - 两赛道（左/右），点左/右 = 换道 + 向上爬一步（score+1）
//   - 海水持续上涨（height 持续下降），height<=0 坠海死亡
//   - 每行有木板障碍（左/右/无），撞到当前赛道的木板即死亡
//   - 金币（50%）/ 宝箱（低概率→随机道具）分布在两赛道
//   - 速度每 30 分上一档
// 新增机制：星星收集、连击奖励、护盾道具、结算星级（见 design.json）。

import { RULES, ITEMS } from '../../config/game.config.js';

const {
  START_HEIGHT, STEP_HEIGHT, SINK0, SINK_STEP, TIER_EVERY,
  COMBO_EVERY, COMBO_COIN, SAFE_ROWS, DASH_RATE, DASH_TIME,
  MAGNET_TIME, SHIELD_TIME,
} = RULES;

// ---------- 可复现随机数 ----------

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- 过程化行生成（确定性） ----------

function genItem(rng) {
  const x = rng();
  if (x < ITEMS.COIN_P) return 'coin';
  if (x < ITEMS.COIN_P + ITEMS.STAR_P) return 'star';
  if (x < ITEMS.COIN_P + ITEMS.STAR_P + ITEMS.BOX_P) return 'box';
  return 'none';
}

function genRow(rng, r) {
  if (r <= SAFE_ROWS) return { barrier: 0, items: ['none', 'none'] };
  if (r === SAFE_ROWS + 1) return { barrier: 0, items: ['coin', 'coin'] }; // 首个奖励：金币
  if (r === SAFE_ROWS + 3) return { barrier: 0, items: ['star', 'star'] }; // 首个星星
  if (r === SAFE_ROWS + 5) return { barrier: 0, items: ['box', 'box'] };   // 首个宝箱
  const b = rng();
  let barrier = 0;
  if (b < 0.4) barrier = -1;      // 左
  else if (b < 0.8) barrier = 1;  // 右
  return { barrier, items: [genItem(rng), genItem(rng)] };
}

// ---------- 事件 ----------

function emit(sim, type, payload) {
  sim.events.push(payload ? { type, ...payload } : { type });
}

// ---------- 状态创建 ----------

export function createSim(seed = 1) {
  const rng = mulberry32(seed);
  const sim = {
    phase: 'playing',   // playing | dead
    lane: 0,            // 0=左 1=右
    height: START_HEIGHT,
    score: 0,
    coins: 0,
    starGems: 0,
    combo: 0,
    maxCombo: 0,
    tier: 1,
    alive: true,
    reviveUsed: false,
    items: { speed: 0, magnet: 0, shield: 0 },
    shieldCharges: 0,
    dashAcc: 0,
    time: 0,
    cause: null,
    events: [],
    rows: new Map(),
    rng,
  };
  return sim;
}

// ---------- 内部工具 ----------

function rowFor(sim, r) {
  if (sim.rows.has(r)) return sim.rows.get(r);
  const row = genRow(sim.rng, r);
  sim.rows.set(r, row);
  return row;
}

function sinkRate(sim) {
  return SINK0 + (sim.tier - 1) * SINK_STEP;
}

function laneSign(lane) {
  return lane === 0 ? -1 : 1;
}

function kill(sim, cause) {
  if (!sim.alive) return;
  sim.alive = false;
  sim.phase = 'dead';
  sim.cause = cause;
  sim.combo = 0;
  emit(sim, 'death', { cause });
}

function grantPowerup(sim) {
  const x = sim.rng();
  let kind;
  if (x < 0.34) kind = 'speed';
  else if (x < 0.67) kind = 'magnet';
  else kind = 'shield';
  if (kind === 'speed') sim.items.speed = DASH_TIME;
  else if (kind === 'magnet') sim.items.magnet = MAGNET_TIME;
  else { sim.items.shield = SHIELD_TIME; sim.shieldCharges = 1; }
  emit(sim, 'powerup', { kind });
}

function collectItem(sim, item) {
  if (item === 'coin') { sim.coins += 1; emit(sim, 'coin'); }
  else if (item === 'star') { sim.starGems += 1; sim.coins += 3; emit(sim, 'star'); }
  else if (item === 'box') { emit(sim, 'box'); grantPowerup(sim); }
}

function collectRow(sim, row, lane) {
  if (sim.items.magnet > 0) {
    collectItem(sim, row.items[0]);
    collectItem(sim, row.items[1]);
  } else {
    collectItem(sim, row.items[lane]);
  }
}

function onCombo(sim) {
  sim.maxCombo = Math.max(sim.maxCombo, sim.combo);
  if (sim.combo > 0 && sim.combo % COMBO_EVERY === 0) {
    sim.coins += COMBO_COIN;
    emit(sim, 'combo', { combo: sim.combo });
  }
}

function checkTier(sim) {
  const nt = 1 + Math.floor(sim.score / TIER_EVERY);
  if (nt > sim.tier) {
    sim.tier = nt;
    emit(sim, 'tierUp', { tier: nt });
  }
}

// 玩家主动攀爬（换道 + 爬一步 + 判定）
function move(sim, lane) {
  if (!sim.alive) return { ok: false };
  sim.lane = lane;
  sim.height += STEP_HEIGHT;
  sim.score += 1;
  checkTier(sim);

  const sign = laneSign(lane);
  const row = rowFor(sim, sim.score);
  const hit = row.barrier !== 0 && row.barrier === sign;

  if (hit) {
    if (sim.shieldCharges > 0) {
      sim.shieldCharges -= 1;
      emit(sim, 'shieldBreak');
      sim.combo += 1;
    } else {
      kill(sim, 'barrier');
      emit(sim, 'climb');
      return { ok: true };
    }
  } else {
    if (row.barrier !== 0) emit(sim, 'dodge');
    sim.combo += 1;
  }
  onCombo(sim);
  collectRow(sim, row, lane);
  emit(sim, 'climb');
  return { ok: true };
}

// 冲刺自动攀爬：无视木板（飞驰），仍收集当前赛道道具
function dashClimb(sim) {
  sim.height += STEP_HEIGHT;
  sim.score += 1;
  checkTier(sim);
  const row = rowFor(sim, sim.score);
  collectRow(sim, row, sim.lane);
  sim.combo += 1;
  onCombo(sim);
  emit(sim, 'climb');
}

// 每帧推进：海水上涨 + 道具计时 + 冲刺自动攀爬 + 坠海判定
function tick(sim, dt) {
  sim.time += dt;
  if (!sim.alive) return;
  sim.height -= sinkRate(sim) * dt;
  if (sim.height <= 0) { sim.height = 0; kill(sim, 'water'); return; }

  sim.items.speed = Math.max(0, sim.items.speed - dt);
  sim.items.magnet = Math.max(0, sim.items.magnet - dt);
  sim.items.shield = Math.max(0, sim.items.shield - dt);
  if (sim.items.shield <= 0) sim.shieldCharges = 0;

  if (sim.items.speed > 0) {
    sim.dashAcc += DASH_RATE * dt;
    while (sim.dashAcc >= 1 && sim.alive) {
      sim.dashAcc -= 1;
      dashClimb(sim);
    }
  }
}

function revive(sim) {
  if (sim.reviveUsed) return { ok: false };
  sim.reviveUsed = true;
  sim.alive = true;
  sim.phase = 'playing';
  sim.height = Math.max(sim.height, 1.0);
  sim.combo = 0;
  sim.cause = null;
  // 复活给 3 秒护盾兜底
  sim.shieldCharges = 1;
  sim.items.shield = 3.0;
  emit(sim, 'revive');
  return { ok: true };
}

function getHud(sim) {
  return {
    score: sim.score,
    coins: sim.coins,
    starGems: sim.starGems,
    combo: sim.combo,
    tier: sim.tier,
    height: sim.height,
  };
}

// 供渲染层读取某一行（确定性生成，可越过当前 score 提前预览）
export function peekRow(sim, r) {
  return rowFor(sim, r);
}

// ---------- run 接口（selfplay / main 用） ----------

export function createRun(seed = 1) {
  const sim = createSim(seed);
  return {
    state: sim,
    move: (lane) => move(sim, lane),
    tick: (dt) => tick(sim, dt),
    step: (lane, dt) => { if (sim.alive) move(sim, lane); tick(sim, dt); },
    peek: (r) => rowFor(sim, r),
    drainEvents: () => { const e = sim.events; sim.events = []; return e; },
    revive: () => revive(sim),
    sinkRate: () => sinkRate(sim),
    getHud: () => getHud(sim),
  };
}
