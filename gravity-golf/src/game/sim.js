// 纯逻辑：侧视弹道高尔夫。不碰 DOM / window / Date.now / Math.random。
// 随机性只用 seed 哈希（地形可复现），弹道用固定步长积分，同 seed 同结果。
import {
  WORLD, GOLF, PLANETS, TERRAIN, UPGRADES, UPGRADE_EFFECT,
} from '../../config/game.config.js';

// --- 确定性哈希地形 ------------------------------------------------------

function hash2(a, b) {
  let h = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}

function segHeight(seed, i) {
  // <= FLAT_SEGS：插值两端都为 0，开球段 [0, (FLAT_SEGS+1)*SEG) 是真平地
  if (i <= TERRAIN.FLAT_SEGS) return 0;
  return Math.round((hash2(seed, i) - 0.5) * 2 * TERRAIN.AMP);
}

export function groundY(x, seed) {
  const seg = Math.floor(x / TERRAIN.SEG);
  const t = (x - seg * TERRAIN.SEG) / TERRAIN.SEG;
  const h0 = segHeight(seed, seg);
  const h1 = segHeight(seed, seg + 1);
  return WORLD.GROUND_BASE + h0 * (1 - t) + h1 * t;
}

export function groundSlope(x, seed) {
  return (groundY(x + 4, seed) - groundY(x - 4, seed)) / 8;
}

// --- 工具 ---------------------------------------------------------------

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function upgradeCost(type, level) {
  const spec = UPGRADES[type];
  if (!spec) return 0;
  return Math.round(spec.base * Math.pow(spec.growth, level));
}

function restitutionOf(run) {
  return Math.min(
    UPGRADE_EFFECT.REST_MAX,
    PLANETS[run.planetIndex].restitution + run.upgrades.bounce * UPGRADE_EFFECT.REST_PER_LVL,
  );
}

function rollDecayOf(run) {
  return Math.max(
    UPGRADE_EFFECT.ROLL_DECAY_MIN,
    GOLF.ROLL_DECAY - run.upgrades.spin * UPGRADE_EFFECT.ROLL_DECAY_PER_LVL,
  );
}

export function launchSpeed(run, power) {
  return GOLF.V0_BASE + GOLF.V0_POWER_SCALE * power
    + run.upgrades.power * UPGRADE_EFFECT.V0_PER_LVL;
}

// --- 创建一局 -----------------------------------------------------------

export function createRun({ seed = 1, planetIndex = 0, best = 0 } = {}) {
  const s = Number(seed) | 0;
  const run = {
    seed: s,
    planetIndex: ((planetIndex % PLANETS.length) + PLANETS.length) % PLANETS.length,
    best,
    bestAbsX: GOLF.TEE_X,
    shotIndex: 0,
    shotsOnPlanet: 0,
    coins: 0,
    upgrades: { power: 0, bounce: 0, luck: 0, spin: 0 },
    ball: {
      x: GOLF.TEE_X, y: groundY(GOLF.TEE_X, s) - GOLF.BALL_R,
      vx: 0, vy: 0, state: 'stopped',
    },
    golfer: {
      x: GOLF.TEE_X - 26, y: groundY(GOLF.TEE_X - 26, s),
      vx: 0, vy: 0, rot: 0, vrot: 0, state: 'idle',
    },
    phase: 'ready', // ready（待击球）| flight（球在飞/滚）
    aim: { active: false, power: 0, angleDeg: 45 },
    airTime: 0,
    flightTime: 0,
    shotStartX: GOLF.TEE_X,
    liveDist: 0,
    lastDistance: 0,
    lastCoins: 0,
    lastBurned: 0, // 0 无 | 1 起火 | 2 烧毁
    burning: false,
    burnedOut: false,
    pendingPanel: false,
    time: 0,
    events: [],
  };
  // brief 契约：run.shoot / run.step / run.settle / run.upgrade / run.getHud
  run.shoot = (opts) => shoot(run, opts);
  run.step = (dt) => step(run, dt);
  run.settle = () => settle(run);
  run.upgrade = (type) => upgrade(run, type);
  run.getHud = () => getHud(run);
  run.setPlanet = (i) => setPlanet(run, i);
  run.addCoins = (n) => addCoins(run, n);
  return run;
}

// --- 击球 ---------------------------------------------------------------

export function shoot(run, { power = 0, angleDeg = 45 } = {}) {
  if (run.phase !== 'ready') return { ok: false, reason: 'not_ready' };
  const p = clamp(power, 0, 1);
  const a = clamp(angleDeg, GOLF.ANGLE_MIN, GOLF.ANGLE_MAX);
  const rad = (a * Math.PI) / 180;
  const v = launchSpeed(run, p);
  run.ball.vx = Math.cos(rad) * v;
  run.ball.vy = -Math.sin(rad) * v;
  run.ball.state = 'flying';
  run.phase = 'flight';
  run.shotStartX = run.ball.x;
  run.liveDist = 0;
  run.airTime = 0;
  run.flightTime = 0;
  run.burning = false;
  run.burnedOut = false;
  run.lastBurned = 0;
  run.shotIndex += 1;
  run.shotsOnPlanet += 1;
  // 球手被后坐力甩出去（签名记忆点）：与出球反向 + 向上，翻滚追球
  run.golfer.state = 'ragdoll';
  run.golfer.vx = -Math.cos(rad) * v * 0.22;
  run.golfer.vy = -(140 + Math.sin(rad) * v * 0.2);
  run.golfer.vrot = 5 + p * 7;
  run.aim.active = false;
  run.aim.power = 0;
  run.events.push({ type: 'shot', power: p, angle: a, planet: run.planetIndex });
  return { ok: true, power: p, angleDeg: a };
}

// --- 单步推进 -----------------------------------------------------------

export function step(run, dt) {
  run.time += dt;
  if (run.phase === 'flight') stepFlight(run, dt);
  stepGolfer(run, dt);
}

function stepFlight(run, dt) {
  const pl = PLANETS[run.planetIndex];
  const b = run.ball;

  if (b.state === 'flying') {
    b.vy += pl.gravity * dt;
    b.vx += pl.wind * dt;
    b.vx *= Math.max(0, 1 - pl.drag * dt);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    run.airTime += dt;
    run.flightTime += dt;

    const speed = Math.hypot(b.vx, b.vy);
    if (!run.burnedOut && run.flightTime > GOLF.BURNOUT_GRACE && speed > GOLF.BURNOUT_SPEED) {
      run.burnedOut = true;
      run.events.push({ type: 'burnout', x: b.x, y: b.y });
      finishFlight(run);
      return;
    }
    if (!run.burning && speed > GOLF.BURN_SPEED) {
      run.burning = true;
      run.events.push({ type: 'burn' });
    } else if (run.burning && speed < GOLF.BURN_SPEED * GOLF.BURN_EXIT_FACTOR) {
      run.burning = false;
    }

    run.liveDist = Math.max(run.liveDist, (b.x - run.shotStartX) / GOLF.PX_PER_M);

    const gy = groundY(b.x, run.seed);
    if (b.y + GOLF.BALL_R >= gy) {
      b.y = gy - GOLF.BALL_R;
      const impact = Math.abs(b.vy);
      b.vy = -b.vy * restitutionOf(run);
      b.vx *= GOLF.BOUNCE_FRICTION;
      run.events.push({ type: 'bounce', x: b.x, y: gy, impact });
      if (Math.abs(b.vy) < GOLF.ROLL_ENTER_V) {
        b.vy = 0;
        b.state = 'rolling';
      }
    }
    if (b.x < 20) { b.x = 20; b.vx = Math.abs(b.vx) * 0.5; }
  }

  if (b.state === 'rolling') {
    run.flightTime += dt;
    const slope = groundSlope(b.x, run.seed);
    b.vx += slope * pl.gravity * GOLF.ROLL_SLOPE_ACCEL * dt;
    b.vx *= Math.max(0, 1 - rollDecayOf(run) * dt);
    b.x += b.vx * dt;
    if (b.x < 20) { b.x = 20; b.vx = 0; }
    b.y = groundY(b.x, run.seed) - GOLF.BALL_R;
    if (Math.abs(b.vx) < GOLF.STOP_SPEED) {
      finishFlight(run);
      return;
    }
  }

  if (run.flightTime > GOLF.MAX_FLIGHT_TIME) finishFlight(run);
}

// 停球结算：距离→金币→最远→换星球
function finishFlight(run) {
  const b = run.ball;
  b.vx = 0;
  b.vy = 0;
  b.state = 'stopped';
  const dist = Math.max(0, Math.floor((b.x - run.shotStartX) / GOLF.PX_PER_M));
  let coins = Math.floor(Math.pow(Math.max(dist, 0), GOLF.COIN_EXP));
  coins += Math.floor(run.airTime * GOLF.AIR_BONUS_PER_SEC);
  coins = Math.floor(coins * (1 + run.upgrades.luck * UPGRADE_EFFECT.LUCK_PER_LVL));
  if (run.burning) coins = Math.floor(coins * 0.9);
  if (run.burnedOut) coins = Math.floor(coins * 0.5);
  run.coins += coins;
  run.lastDistance = dist;
  run.lastCoins = coins;
  run.lastBurned = run.burnedOut ? 2 : (run.burning ? 1 : 0);
  run.bestAbsX = Math.max(run.bestAbsX, b.x);
  let newBest = false;
  if (dist > run.best) {
    run.best = dist;
    newBest = true;
  }
  run.phase = 'ready';
  run.events.push({
    type: 'stop', distance: dist, coins, burned: run.lastBurned, newBest,
  });
  if (run.shotsOnPlanet >= GOLF.SHOTS_PER_PLANET) {
    run.shotsOnPlanet = 0;
    run.planetIndex = (run.planetIndex + 1) % PLANETS.length;
    run.pendingPanel = true;
    run.events.push({ type: 'planet', index: run.planetIndex });
  }
}

// 球手：被甩飞（ragdoll）→ 停球后跑回球位（walk）→ 站定（idle）
function stepGolfer(run, dt) {
  const g = run.golfer;
  const pl = PLANETS[run.planetIndex];
  if (g.state === 'ragdoll') {
    g.vy += pl.gravity * dt;
    // 追球：飞行时贴住球速（保持入画），停球后朝球方向自进
    const chase = run.phase === 'flight'
      ? run.ball.vx * 0.8
      : Math.sign(run.ball.x - g.x) * 420;
    g.vx += (chase - g.vx) * 2.5 * dt;
    g.x += g.vx * dt;
    g.y += g.vy * dt;
    g.rot += g.vrot * dt;
    g.vrot *= Math.max(0, 1 - 1.4 * dt);
    const gy = groundY(g.x, run.seed);
    if (g.y >= gy) {
      g.y = gy;
      if (Math.abs(g.vy) > 90) {
        g.vy = -g.vy * 0.4;
        g.vx *= 0.7;
      } else {
        g.vy = 0;
        g.state = 'walk';
      }
    }
  } else if (g.state === 'walk') {
    const target = run.ball.x - 26;
    const d = target - g.x;
    // 距离越远跑得越快，尽快回到球位入画
    const speed = Math.min(1400, Math.max(300, Math.abs(d) * 1.5));
    if (Math.abs(d) <= speed * dt) {
      g.x = target;
      g.rot *= Math.max(0, 1 - 10 * dt);
      if (Math.abs(g.rot) < 0.05) g.rot = 0;
      g.state = 'idle';
    } else {
      g.x += Math.sign(d) * speed * dt;
      g.rot *= Math.max(0, 1 - 3 * dt);
    }
    g.y = groundY(g.x, run.seed);
  } else {
    g.y = groundY(g.x, run.seed);
  }
}

// --- 强制结算（调试口 / 测试用）-----------------------------------------

export function settle(run) {
  if (run.phase !== 'flight') return false;
  let guard = 0;
  while (run.phase === 'flight' && guard < 5000) {
    step(run, 1 / 60);
    guard += 1;
  }
  return true;
}

// --- 升级 ---------------------------------------------------------------

export function upgrade(run, type) {
  const spec = UPGRADES[type];
  if (!spec) return { ok: false, reason: 'unknown', level: 0, cost: 0 };
  const lvl = run.upgrades[type];
  if (lvl >= spec.maxLevel) {
    return { ok: false, reason: 'maxed', level: lvl, cost: 0 };
  }
  const cost = upgradeCost(type, lvl);
  if (run.coins < cost) {
    return { ok: false, reason: 'poor', level: lvl, cost };
  }
  run.coins -= cost;
  run.upgrades[type] = lvl + 1;
  run.events.push({ type: 'upgrade', upgrade: type, level: lvl + 1, cost });
  return { ok: true, cost, level: lvl + 1 };
}

// --- 调试 / HUD ---------------------------------------------------------

export function setPlanet(run, i) {
  run.planetIndex = ((i % PLANETS.length) + PLANETS.length) % PLANETS.length;
  run.shotsOnPlanet = 0;
  run.pendingPanel = false;
  run.events.push({ type: 'planet', index: run.planetIndex });
  return PLANETS[run.planetIndex].id;
}

export function addCoins(run, n) {
  run.coins = Math.max(0, run.coins + Math.round(n));
  return run.coins;
}

export function getHud(run) {
  return {
    distance: run.phase === 'flight' ? Math.floor(run.liveDist) : run.lastDistance,
    best: run.best,
    coins: run.coins,
    planet: PLANETS[run.planetIndex].id,
    planetIndex: run.planetIndex,
    power: run.aim.power,
    aiming: run.aim.active,
    shot: Math.min(run.shotsOnPlanet + 1, GOLF.SHOTS_PER_PLANET),
    shotOf: GOLF.SHOTS_PER_PLANET,
    phase: run.phase,
  };
}
