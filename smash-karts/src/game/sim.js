// SMASH KARTS · 纯逻辑战斗模拟（M1）
// 契约：docs/smash-karts/README.md §2.2–§2.4、§4 + docs/smash-karts/brief-m1.md §4
// 只做逻辑：不碰 DOM / window / localStorage / performance / Date / Math.random，随机一律 run.rand()。
import {
  WORLD, TUNING, WEAPONS, CRATE_WEAPONS, KARTS, BOT_KARTS, PLAYER_KART,
  ARENAS, RULES, UPGRADES, UPGRADE_PICKS, RANKS,
} from '../../config/game.config.js';

const K = TUNING.kart;
const B = TUNING.boost;
const C = TUNING.combat;
const A = TUNING.ai;

/**
 * README §4 / brief §4 用文字规定、但 config 里还没有对应键的数值集中在这里，
 * 便于 Lead 之后整体上抬进 config/game.config.js。config 已有的数值一律从 config 取。
 */
const SPEC = {
  wall: 28,                    // ARENA_WALL：契约 §2.1 明确指定 sim 内部用 28
  bulletRadius: 4,             // 弹丸命中判定半径
  crateRadius: 26,             // 武器箱判定半径（贴图游戏内约 120px）
  muzzlePad: 6,                // 枪口前伸余量
  bumpFrac: 0.15,              // 低于极速这个比例不算「撞墙」，不发 wallBump
  bumpGapSec: 0.35,            // 同车 wallBump 最小间隔，避免贴墙刷屏
  ramGapSec: 0.35,             // 同车 ram 最小间隔
  squashFadeSec: 0.18,         // squash 数值衰减
  exprHitSec: 0.45,
  exprAngrySec: 0.28,
  exprSurpriseSec: 0.6,
  exprHappySec: 0.7,
  exprWinSec: 1.2,
  lavaDamage: 7,               // brief §4.5：每 hazardTickSec 掉 7 血
  championDamageMul: 1.15,     // README §4
  tutorialBotSpeedMul: 0.45,   // brief §4.11
  stuckSec: 1.2,               // README §4：卡住 1.2s 反向脱困
  stuckMovePx: 9,              // 一个 think 周期内位移小于此值视为「没动」
  unstickSec: 0.7,
  trail: { spawnGap: 0.08, radius: 22, life: 1.1, damage: 4, tick: 0.35 },
  magnet: { radius: 260, speed: 130 },
  shield: 25,
  ai: {
    steerGain: 2.4,            // 角差 → steer 的比例
    aimTol: 0.22,              // 允许开火的瞄准角误差
    slowTurnRad: 1.25,         // 超过这个角差先收油门
    pressRange: 140,           // 贴脸距离：进入后改为绕圈，避免两车对穿死锁
    orbitRad: 1.1,
    sniperMin: 320,            // README §4：blu 保持 320–460、HP<35 撤退
    sniperMax: 460,
    sniperHpFlee: 35,
    brawlerRange: 260,
    camperRange: 260,          // README §4：grape 等玩家靠近再打
    camperIdleRange: 340,      // 目标比这更远 → 蹲点打盹
    gunRange: 520,
    crateAmmo: 4,              // 弹药低于此值就去找箱子
    lead: { aggressive: 0.35, sniper: 1, brawler: 0.55, camper: 0.8 },
  },
};

/** 升级幅度：config 的 UPGRADES 只给了文案，数值在这里落地。 */
const UPG = {
  armorHp: 30,                 // "+30 max HP"
  fireRateMul: 1 / 0.82,       // "-18% fire delay"
  speedMul: 1.1,               // "+10% top speed"
  driftChargeMul: 1.25,        // "faster drift charge"（幅度契约未量化）
  bounceTimes: 1,              // "ricochet off walls once"
  tripleExtra: 3,              // "3 extra pellets, each weaker"
  ghostInvulnSec: 3,
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
function normAngle(a) {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}
/** xorshift32：逻辑层唯一随机源。 */
function makeRng(seed) {
  let a = (seed >>> 0) || 0x9e3779b9;
  return function next() {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function emit(run, ev) { run.events.push(ev); }
function kartById(run, id) {
  for (const k of run.karts) if (k.id === id) return k;
  return null;
}
function arenaOf(run) { return ARENAS[run.tutorial ? 0 : run.roundIndex % ARENAS.length]; }
function aliveOthers(run, k) {
  const out = [];
  for (const o of run.karts) if (o !== k && !o.dead) out.push(o);
  return out;
}
function dist(ax, ay, bx, by) { return Math.hypot(ax - bx, ay - by); }
/** 出生朝向：看向竞技场中心，一开局就面向战场。 */
function facing(spawn) { return Math.atan2(WORLD.HEIGHT / 2 - spawn.y, WORLD.WIDTH / 2 - spawn.x); }

function newMods() {
  return {
    speedMul: 1, fireRateMul: 1, driftMul: 1,
    ram: false, bounce: false, triple: false, trail: false,
    magnet: false, lucky: false, ghost: false, refund: false,
  };
}

function pickExpression(k, name, dur) { k.expression = name; k.expressionT = dur; }
function defaultExpression(k) {
  if (k.dead) return 'ko';
  if (k.boosting) return 'boost';
  return 'idle';
}

function buildKart(run, kartId, isPlayer, spawn) {
  const spec = KARTS[kartId] || KARTS[PLAYER_KART];
  const head = facing(spawn);
  return {
    id: (run.seq += 1),
    kartId: spec.id,
    name: spec.name,
    color: spec.color,
    isPlayer,
    isChampion: false,
    x: spawn.x, y: spawn.y,
    angle: head, vAngle: head,
    speed: 0,
    hp: RULES.hp, maxHp: RULES.hp, shield: 0,
    dead: false, respawn: 0, deadT: 0, invuln: 0,
    weapon: 'gun', ammo: WEAPONS.gun.ammo, cooldown: 0,
    boost: 0, boosting: false, boostTime: 0,
    drift: { active: false, charge: 0 },
    kills: 0, deaths: 0, killsTotal: 0, deathsTotal: 0,
    expression: 'idle', expressionT: 0,
    hitFlash: 0, squash: 0,
    dmgMul: 1,
    bonusHp: 0,
    bumpT: 0, ramT: 0, hazardT: C.hazardTickSec, trailT: 0, trailTick: 0,
    ai: {
      mode: isPlayer ? 'player' : spec.personality,
      think: 0, targetId: 0, wander: 0, wanderTurn: 0, aimErr: 0,
      plan: { x: WORLD.WIDTH / 2, y: WORLD.HEIGHT / 2 },
      rangeMin: 0, wantFire: false, wantDrift: false,
      unstick: 0, unstickSteer: 0, moveAcc: 0, stuckT: 0, camp: null,
      lastX: spawn.x, lastY: spawn.y,
    },
    mods: newMods(),
  };
}

/** 重生点：离所有存活敌人（最近的那个）最远的 spawn。 */
function spawnPointFor(run, k) {
  const spawns = arenaOf(run).spawns;
  const foes = aliveOthers(run, k);
  if (!foes.length) return spawns[0];
  let best = spawns[0];
  let bestScore = -Infinity;
  for (const s of spawns) {
    let nearest = Infinity;
    for (const f of foes) nearest = Math.min(nearest, dist(s.x, s.y, f.x, f.y));
    if (nearest > bestScore) { bestScore = nearest; best = s; }
  }
  return best;
}

function applyChampion(run, k) {
  const champ = run.arena.champion;
  if (!champ || champ.kart !== k.kartId || k.isPlayer) return;
  k.isChampion = true;
  k.dmgMul = SPEC.championDamageMul;
  k.maxHp = champ.hp;
  k.hp = champ.hp;
  k.name = champ.label[run.lang] || champ.label.en;
  k.ai.mode = 'aggressive';
}

/** 局内重置：位置/血量/武器/计时；保留 mods、升级、跨局统计。 */
function resetKartState(run, k, index) {
  const s = run.arena.spawns[index % run.arena.spawns.length];
  const head = facing(s);
  k.isChampion = false;
  k.dmgMul = 1;
  k.name = KARTS[k.kartId].name;
  k.x = s.x; k.y = s.y;
  k.angle = head; k.vAngle = head;
  k.speed = 0;
  k.maxHp = RULES.hp + k.bonusHp;
  k.hp = k.maxHp;
  k.shield = 0;
  k.dead = false; k.respawn = 0; k.deadT = 0; k.invuln = 0;
  k.weapon = 'gun'; k.ammo = WEAPONS.gun.ammo; k.cooldown = 0;
  k.boost = 0; k.boosting = false; k.boostTime = 0;
  k.drift = { active: false, charge: 0 };
  k.kills = 0; k.deaths = 0;
  k.expression = 'idle'; k.expressionT = 0;
  k.hitFlash = 0; k.squash = 0;
  k.bumpT = 0; k.ramT = 0; k.hazardT = C.hazardTickSec; k.trailT = 0; k.trailTick = 0;
  const ai = k.ai;
  ai.mode = k.isPlayer ? 'player' : KARTS[k.kartId].personality;
  ai.think = 0; ai.targetId = 0; ai.wander = 0; ai.wanderTurn = 0; ai.aimErr = 0;
  ai.plan = { x: run.arena.crateSpots[0].x, y: run.arena.crateSpots[0].y };
  ai.rangeMin = 0; ai.wantFire = false; ai.wantDrift = false;
  ai.unstick = 0; ai.unstickSteer = 0; ai.moveAcc = 0; ai.stuckT = 0; ai.camp = null;
  ai.lastX = s.x; ai.lastY = s.y;
  applyChampion(run, k);
}

function startRound(run) {
  run.arena = arenaOf(run);
  run.arenaId = run.arena.id;
  run.projectiles = [];
  run.trails = [];
  run.crates = [];
  run.roundTime = 0;
  run.phase = 'countdown';
  run.countdown = RULES.countdownSec;
  run.countdownShown = 0;
  run.crateTimer = RULES.crateRespawnSec;
  for (let i = 0; i < run.karts.length; i += 1) resetKartState(run, run.karts[i], i);
  if (run.tutorial) {
    spawnCrateAt(run, run.arena.crateSpots[0].x, run.arena.crateSpots[0].y);
  } else {
    // 开局就摆 2 个箱子：第 6 秒的第一个决定（抢中央 / 先偷一枪）要有东西可抢
    spawnCrateAt(run, run.arena.crateSpots[0].x, run.arena.crateSpots[0].y);
    spawnCrateAt(run, run.arena.crateSpots[1].x, run.arena.crateSpots[1].y);
  }
  emit(run, { type: 'roundStart', roundIndex: run.roundIndex, arenaId: run.arena.id });
}

export function createRun({
  seed = 1, roundIndex = 0, upgrades = [], playerKart = PLAYER_KART,
  tutorial = false, lang = 'en',
} = {}) {
  const run = {
    seed: seed >>> 0,
    rand: makeRng(seed),
    seq: 0,
    tutorial: !!tutorial,
    lang,
    rounds: tutorial ? 1 : RULES.rounds,
    roundIndex: clamp(roundIndex | 0, 0, RULES.rounds - 1),
    roundsPlayed: 0,
    playerRoundsWon: 0,
    botRoundsWon: 0,
    time: 0,
    roundTime: 0,
    phase: 'countdown',
    winner: null,
    events: [],
    karts: [],
    projectiles: [],
    crates: [],
    trails: [],
    upgrades: [],
    crateTimer: RULES.crateRespawnSec,
    countdown: RULES.countdownSec,
    countdownShown: 0,
    arena: null,
    arenaId: null,
  };
  run.arena = arenaOf(run);
  run.arenaId = run.arena.id;
  const pk = KARTS[playerKart] ? playerKart : PLAYER_KART;
  // 玩家若选了电脑车身，则该车身从电脑池里换出，保证 5 台车不撞同一款
  const botPool = [PLAYER_KART, ...BOT_KARTS].filter((id) => id !== pk);
  run.karts.push(buildKart(run, pk, true, run.arena.spawns[0]));
  for (let i = 0; i < RULES.botCount; i += 1) {
    run.karts.push(buildKart(run, botPool[i % botPool.length], false, run.arena.spawns[i + 1]));
  }
  for (const id of upgrades || []) applyUpgrade(run, id);
  startRound(run);
  return run;
}

// ---------------------------------------------------------------- 驾驶 / 漂移 / 加速

function speedCeiling(run, k) {
  // 引导模式：电脑连加速段也不突破慢速上限，否则新手会被瞬秒（brief §4.11）
  if (run.tutorial && !k.isPlayer) return K.maxSpeed * k.mods.speedMul * SPEC.tutorialBotSpeedMul;
  return K.maxSpeed * k.mods.speedMul * (k.boosting ? B.speedMul : 1);
}

function grantBoost(k, value) {
  k.boost = Math.max(k.boost, clamp(value, 0, 1));
  k.boosting = k.boost > 0;
  k.boostTime = k.boost * B.maxDur;
}

/** 充能 charge∈[minToFire,1] 线性映射到时长 [minDur,maxDur]，再折算成 0..1 的加速条。 */
function chargeToBoostBar(charge) {
  const t = (charge - B.minToFire) / (1 - B.minToFire);
  return (B.minDur + (B.maxDur - B.minDur) * t) / B.maxDur;
}

function releaseDrift(run, k) {
  const charge = k.drift.charge;
  k.drift.charge = 0;
  emit(run, { type: 'driftEnd', id: k.id, x: k.x, y: k.y, charge });
  if (charge < B.minToFire) return;
  grantBoost(k, chargeToBoostBar(charge));
  pickExpression(k, 'boost', B.maxDur);
  emit(run, { type: 'boost', id: k.id, charge, x: k.x, y: k.y });
}

function reflectOff(run, k, nx, ny, restitution, hitX, hitY, incoming) {
  let vx = Math.cos(k.vAngle) * k.speed;
  let vy = Math.sin(k.vAngle) * k.speed;
  const dot = vx * nx + vy * ny;
  if (dot < 0) { vx -= 2 * dot * nx; vy -= 2 * dot * ny; }
  const sp = Math.hypot(vx, vy) * restitution;
  if (sp > 1) {
    k.vAngle = Math.atan2(vy, vx);
    k.angle = k.vAngle;          // 车头跟着弹回，否则会一直贴着墙磨擦出不来
  }
  k.speed = sp;
  bumpFeedback(run, k, hitX, hitY, incoming);
}

function slideAlong(k, nx, ny) {
  // bounce:false 的障碍：只削掉撞进去的法向分量，沿切面滑行（挡死）
  let vx = Math.cos(k.vAngle) * k.speed;
  let vy = Math.sin(k.vAngle) * k.speed;
  const dot = vx * nx + vy * ny;
  if (dot < 0) { vx -= dot * nx; vy -= dot * ny; }
  const sp = Math.hypot(vx, vy);
  if (sp > 1) {
    k.vAngle = Math.atan2(vy, vx);
    k.angle = k.vAngle;
  }
  k.speed = sp;
}

function bumpFeedback(run, k, hitX, hitY, incoming) {
  if (incoming <= K.maxSpeed * SPEC.bumpFrac || k.bumpT > 0) return;
  k.bumpT = SPEC.bumpGapSec;
  pickExpression(k, 'surprise', SPEC.exprSurpriseSec);
  emit(run, { type: 'wallBump', id: k.id, x: hitX, y: hitY, speed: incoming });
}

function collideWalls(run, k) {
  const lim = SPEC.wall + K.radius;
  let nx = 0;
  let ny = 0;
  if (k.x < lim) { k.x = lim; nx = 1; } else if (k.x > WORLD.WIDTH - lim) { k.x = WORLD.WIDTH - lim; nx = -1; }
  if (k.y < lim) { k.y = lim; ny = 1; } else if (k.y > WORLD.HEIGHT - lim) { k.y = WORLD.HEIGHT - lim; ny = -1; }
  if (!nx && !ny) return;
  const len = Math.hypot(nx, ny);
  const incoming = Math.abs(k.speed);
  reflectOff(run, k, nx / len, ny / len, K.wallBounce, k.x, k.y, incoming);
}

function pointBlocked(run, x, y, pad) {
  const lim = SPEC.wall + pad;
  if (x < lim || x > WORLD.WIDTH - lim || y < lim || y > WORLD.HEIGHT - lim) return true;
  for (const o of run.arena.obstacles) {
    if (o.shape === 'circle') { if (dist(x, y, o.x, o.y) < o.r + pad) return true; } else if (
      x > o.x - pad && x < o.x + o.w + pad && y > o.y - pad && y < o.y + o.h + pad) return true;
  }
  for (const h of run.arena.hazards) {
    if (h.type === 'lava' && dist(x, y, h.x, h.y) < h.r + pad) return true;
  }
  return false;
}

function collideObstacles(run, k) {
  for (const o of run.arena.obstacles) {
    let nx = 0;
    let ny = 0;
    let depth = 0;
    if (o.shape === 'circle') {
      const dx = k.x - o.x;
      const dy = k.y - o.y;
      const d = Math.hypot(dx, dy);
      const need = o.r + K.radius;
      if (d >= need) continue;
      if (d < 0.0001) { nx = 1; ny = 0; depth = need; } else { nx = dx / d; ny = dy / d; depth = need - d; }
    } else {
      const px = clamp(k.x, o.x, o.x + o.w);
      const py = clamp(k.y, o.y, o.y + o.h);
      const dx = k.x - px;
      const dy = k.y - py;
      const d = Math.hypot(dx, dy);
      if (d >= K.radius) continue;
      if (d >= 0.0001) { nx = dx / d; ny = dy / d; depth = K.radius - d; } else {
        const left = k.x - o.x;
        const right = o.x + o.w - k.x;
        const up = k.y - o.y;
        const down = o.y + o.h - k.y;
        const m = Math.min(left, right, up, down);
        if (m === left) { nx = -1; ny = 0; } else if (m === right) { nx = 1; ny = 0; } else if (m === up) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
        depth = m + K.radius;
      }
    }
    const incoming = Math.abs(k.speed);
    k.x += nx * depth;
    k.y += ny * depth;
    if (o.bounce) reflectOff(run, k, nx, ny, K.obstacleBounce, k.x, k.y, incoming);
    else {
      slideAlong(k, nx, ny);
      bumpFeedback(run, k, k.x, k.y, incoming);
    }
  }
}

function applyHazards(run, k, dt) {
  if (run.tutorial) return;                     // brief §4.11：引导模式无危险地形
  const lim = SPEC.wall + K.radius;
  let pushX = 0;
  let pushY = 0;
  let inLava = false;
  for (const h of run.arena.hazards) {
    if (h.type === 'belt') {
      if (k.x > h.x && k.x < h.x + h.w && k.y > h.y && k.y < h.y + h.h) {
        pushX += h.dx * h.speed * dt;
        pushY += h.dy * h.speed * dt;
      }
    } else if (h.type === 'lava' && dist(k.x, k.y, h.x, h.y) < h.r) {
      inLava = true;
    }
  }
  if (pushX || pushY) {
    // 只位移、不进速度，随后夹回边界：避免被带子按在墙上形成死循环
    k.x = clamp(k.x + pushX, lim, WORLD.WIDTH - lim);
    k.y = clamp(k.y + pushY, lim, WORLD.HEIGHT - lim);
  }
  if (inLava) {
    k.hazardT -= dt;
    if (k.hazardT <= 0) {
      k.hazardT = C.hazardTickSec;
      // 契约 §2.3 的 hazard 行同时用了两个 type 语义，载荷键改名为 kind
      emit(run, { type: 'hazard', id: k.id, kind: 'lava', x: k.x, y: k.y });
      damageKart(run, k, SPEC.lavaDamage, null, 'lava', k.x, k.y);
    }
  } else {
    k.hazardT = C.hazardTickSec;
  }
}

function driveKart(run, k, ctrl, dt) {
  const steer = clamp(ctrl.steer || 0, -1, 1);
  const throttle = clamp(ctrl.throttle || 0, -1, 1);

  if (k.boost > 0) k.boost = Math.max(0, k.boost - dt / B.maxDur);
  k.boosting = k.boost > 0;
  k.boostTime = k.boost * B.maxDur;

  const drifting = !!ctrl.drift && Math.abs(k.speed) >= B.driftMinSpeed;
  if (drifting !== k.drift.active) {
    if (k.drift.active) releaseDrift(run, k);
    else emit(run, { type: 'driftStart', id: k.id, x: k.x, y: k.y, charge: k.drift.charge });
    k.drift.active = drifting;
  }

  k.speed += throttle * K.accel * dt;
  // 摩擦：引擎顶住油门时不叠加阻力（否则 420/1.7=247 顶不到 config 规定的极速 300）；
  // 收油或反向刹车时才按普通/漂移摩擦掉速，漂移阻力更小 → 保留速度。
  const driving = throttle !== 0 && Math.sign(throttle) === Math.sign(k.speed);
  if (!driving) k.speed -= k.speed * (drifting ? K.driftFriction : K.friction) * dt;
  const ceiling = speedCeiling(run, k);
  // 超顶只会发生在加速段结束或被撞飞：每帧至少扣掉引擎给的两倍量，才不会「越顶越飞」收不住
  if (k.speed > ceiling) k.speed = Math.max(ceiling, k.speed - Math.max(K.accel * dt * 2, k.speed * K.friction * dt));
  const reverseCeil = K.reverseMax * k.mods.speedMul;
  if (k.speed < -reverseCeil) k.speed = -reverseCeil;

  if (drifting) {
    if (Math.abs(steer) >= B.driftMinSteer) {
      k.drift.charge = Math.min(1, k.drift.charge + B.perSec * k.mods.driftMul * dt);
    }
  } else if (k.drift.charge > 0 && !k.boosting) {
    k.drift.charge = Math.max(0, k.drift.charge - B.perSec * dt);
  }

  // 转向权限取自漂移门槛速度：几乎停住时转不动，避免原地打转
  const authority = Math.min(1, Math.abs(k.speed) / B.driftMinSpeed);
  const turnRate = drifting ? K.driftTurnRate : K.turnRate;
  if (steer) k.angle = normAngle(k.angle + steer * turnRate * dt * authority * (k.speed < 0 ? -1 : 1));

  if (drifting) {
    // 速度方向向车头收敛，夹角每秒保留 driftGrip → 走外线
    const err = normAngle(k.angle - k.vAngle);
    k.vAngle = normAngle(k.angle - err * Math.pow(K.driftGrip, dt));
  } else {
    k.vAngle = k.angle;
  }

  k.x += Math.cos(k.vAngle) * k.speed * dt;
  k.y += Math.sin(k.vAngle) * k.speed * dt;

  collideWalls(run, k);
  collideObstacles(run, k);
  applyHazards(run, k, dt);

  if (k.bumpT > 0) k.bumpT -= dt;
  if (k.ramT > 0) k.ramT -= dt;
  if (k.drift.active && k.mods.trail) {
    k.trailT -= dt;
    if (k.trailT <= 0) {
      k.trailT = SPEC.trail.spawnGap;
      run.trails.push({
        id: (run.seq += 1),
        x: k.x - Math.cos(k.vAngle) * K.radius,
        y: k.y - Math.sin(k.vAngle) * K.radius,
        r: SPEC.trail.radius,
        life: SPEC.trail.life,
        owner: k.id,
      });
    }
  }
}

// ---------------------------------------------------------------- 武器 / 弹道

function fireWeapon(run, k) {
  const wp = WEAPONS[k.weapon];
  const firedWeapon = wp.id;
  const aiSlow = k.isPlayer ? 1 : (TUNING.ai.fireRateMul || 1);
  k.cooldown = (wp.fireRate / k.mods.fireRateMul) / aiSlow;
  let count = wp.count;
  let dmg = wp.damage;
  if (k.mods.triple && wp.count > 1) {
    count = wp.count + UPG.tripleExtra;
    dmg = wp.damage * (wp.count / count);   // 多 3 颗、单颗变弱，总伤基本不变
  }
  const muzzle = K.radius + SPEC.muzzlePad;
  for (let i = 0; i < count; i += 1) {
    let a = k.angle;
    if (count > 1) a += (i / (count - 1) - 0.5) * 2 * wp.spread;
    else if (wp.spread > 0) a += (run.rand() - 0.5) * 2 * wp.spread;
    if (!k.isPlayer) a += k.ai.aimErr;
    run.projectiles.push({
      id: (run.seq += 1),
      x: k.x + Math.cos(k.angle) * muzzle,
      y: k.y + Math.sin(k.angle) * muzzle,
      vx: Math.cos(a) * wp.speed,
      vy: Math.sin(a) * wp.speed,
      damage: k.isPlayer ? Math.round(dmg) : Math.max(1, Math.round(dmg * (TUNING.ai.damageMul ?? 1))),
      owner: k.id,
      life: RULES.projectileLife,
      splash: wp.splash,
      color: wp.color,
      kind: k.weapon === 'rocket' ? 'rocket' : 'bullet',
      bounces: k.weapon === 'rocket' && k.mods.bounce ? UPG.bounceTimes : 0,
      weapon: firedWeapon,
    });
  }
  if (k.speed > 0) k.speed = Math.max(0, k.speed - wp.recoil);
  else if (k.speed < 0) k.speed = Math.min(0, k.speed + wp.recoil);
  if (Number.isFinite(k.ammo)) {
    k.ammo -= count;
    if (k.ammo <= 0) { k.weapon = 'gun'; k.ammo = WEAPONS.gun.ammo; }
  }
  pickExpression(k, 'angry', SPEC.exprAngrySec);
  emit(run, {
    type: 'shot', owner: k.id, weapon: firedWeapon,
    x: k.x + Math.cos(k.angle) * muzzle, y: k.y + Math.sin(k.angle) * muzzle, angle: k.angle,
  });
}

function detonate(run, p, direct) {
  const owner = kartById(run, p.owner);
  if (p.splash > 0) {
    for (const k of run.karts) {
      if (k === direct || k.id === p.owner || k.dead) continue;
      const d = dist(k.x, k.y, p.x, p.y);
      if (d > p.splash) continue;
      damageKart(run, k, p.damage * (1 - d / p.splash), owner, p.weapon, k.x, k.y);
    }
  }
  if (direct) damageKart(run, direct, p.damage, owner, p.weapon, direct.x, direct.y);
}

function updateProjectiles(run, dt) {
  const w = SPEC.wall;
  for (let i = run.projectiles.length - 1; i >= 0; i -= 1) {
    const p = run.projectiles[i];
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
    let dead = p.life <= 0;
    let hit = null;

    if (!dead) {
      let sideX = 0;
      let sideY = 0;
      if (p.x < w) sideX = 1; else if (p.x > WORLD.WIDTH - w) sideX = -1;
      if (p.y < w) sideY = 1; else if (p.y > WORLD.HEIGHT - w) sideY = -1;
      if (sideX || sideY) {
        if (p.bounces > 0) {
          p.bounces -= 1;
          if (sideX) { p.vx = Math.abs(p.vx) * sideX; p.x = clamp(p.x, w, WORLD.WIDTH - w); }
          if (sideY) { p.vy = Math.abs(p.vy) * sideY; p.y = clamp(p.y, w, WORLD.HEIGHT - w); }
        } else dead = true;
      }
    }

    if (!dead) {
      for (const o of run.arena.obstacles) {
        const inside = o.shape === 'circle'
          ? dist(p.x, p.y, o.x, o.y) < o.r
          : (p.x > o.x && p.x < o.x + o.w && p.y > o.y && p.y < o.y + o.h);
        if (inside) { dead = true; break; }
      }
    }

    if (!dead) {
      for (const k of run.karts) {
        if (k.id === p.owner || k.dead || k.invuln > 0) continue;
        if (dist(k.x, k.y, p.x, p.y) < K.radius + SPEC.bulletRadius) {
          if (p.splash > 0) { detonate(run, p, k); hit = 'direct'; } else {
            damageKart(run, k, p.damage, kartById(run, p.owner), p.weapon, k.x, k.y);
          }
          dead = true;
          break;
        }
      }
    }

    if (dead && p.splash > 0 && hit !== 'direct') detonate(run, p, null);
    if (dead) run.projectiles.splice(i, 1);
  }
}

// ---------------------------------------------------------------- 伤害 / 击杀 / 重生

function damageKart(run, victim, amount, attacker, weapon, x, y) {
  if (victim.dead || victim.invuln > 0 || amount <= 0) return false;
  if (run.tutorial && attacker && !attacker.isPlayer) return false;   // 引导模式 AI 不造成伤害
  const dmg = amount * (attacker ? attacker.dmgMul : 1);
  let left = dmg;
  if (victim.shield > 0) {
    const soaked = Math.min(victim.shield, left);
    victim.shield -= soaked;
    left -= soaked;
  }
  victim.hitFlash = C.hitFlashSec;
  if (left <= 0) {
    emit(run, { type: 'hit', victim: victim.id, attacker: attacker ? attacker.id : 0, damage: 0, x, y, weapon });
    return true;
  }
  victim.hp = Math.max(0, victim.hp - left);
  victim.squash = Math.min(1, victim.squash + 0.6);
  pickExpression(victim, 'hit', SPEC.exprHitSec);
  emit(run, {
    type: 'hit', victim: victim.id, attacker: attacker ? attacker.id : 0,
    damage: left, x, y, weapon,
  });
  if (victim.hp <= 0) killKart(run, victim, attacker);
  return true;
}

function killKart(run, victim, killer) {
  victim.dead = true;
  victim.hp = 0;
  victim.shield = 0;
  victim.deaths += 1;
  victim.deathsTotal += 1;
  victim.respawn = RULES.respawnSec;
  victim.deadT = 0;
  victim.weapon = 'gun';
  victim.ammo = WEAPONS.gun.ammo;
  victim.speed = 0;
  victim.boost = 0;
  victim.boosting = false;
  victim.boostTime = 0;
  victim.drift.active = false;
  victim.drift.charge = 0;
  pickExpression(victim, 'ko', RULES.respawnSec);
  // 冠军车是靶子：击倒它不计入击杀目标（README §4）
  const credit = !!(killer && killer !== victim && !victim.isChampion);
  if (credit) {
    killer.kills += 1;
    killer.killsTotal += 1;
    if (killer.mods.refund) grantBoost(killer, 1);
  }
  emit(run, {
    type: 'ko', victim: victim.id, killer: killer ? killer.id : 0,
    x: victim.x, y: victim.y, kartId: victim.kartId,
  });
  if (credit && killer.kills >= RULES.killTarget) endRound(run, 'target');
}

function respawnKart(run, k) {
  const s = spawnPointFor(run, k);
  const head = facing(s);
  k.x = s.x;
  k.y = s.y;
  k.angle = head;
  k.vAngle = head;
  k.speed = 0;
  k.hp = k.maxHp;
  k.dead = false;
  k.respawn = 0;
  k.invuln = k.mods.ghost ? UPG.ghostInvulnSec : C.respawnInvulnSec;
  k.cooldown = 0;
  k.ai.lastX = s.x;
  k.ai.lastY = s.y;
  grantBoost(k, k.mods.ghost ? 1 : RULES.boostStart);
  pickExpression(k, 'idle', 0.2);
  emit(run, { type: 'respawn', id: k.id, kartId: k.kartId, x: k.x, y: k.y });
}

// ---------------------------------------------------------------- 箱子 / 尾迹 / 车-车碰撞

function spawnCrateAt(run, x, y) {
  const crate = { id: (run.seq += 1), x, y, weapon: null, t: 0 };
  run.crates.push(crate);
  emit(run, { type: 'crate', id: crate.id, x, y });
  return crate;
}

function spawnCrate(run) {
  if (run.crates.length >= RULES.maxCrates) return null;
  const free = run.arena.crateSpots.filter((s) => (
    !run.crates.some((c) => c.x === s.x && c.y === s.y) && !pointBlocked(run, s.x, s.y, K.radius)
  ));
  if (!free.length) return null;
  const spot = free[Math.floor(run.rand() * free.length)];
  return spawnCrateAt(run, spot.x, spot.y);
}

function openCrates(run) {
  for (const k of run.karts) {
    if (k.dead) continue;
    for (let i = run.crates.length - 1; i >= 0; i -= 1) {
      const c = run.crates[i];
      if (dist(k.x, k.y, c.x, c.y) >= K.radius + SPEC.crateRadius) continue;
      const weapon = CRATE_WEAPONS[Math.floor(run.rand() * CRATE_WEAPONS.length)];
      c.weapon = weapon;                       // 武器在开箱瞬间才决定（契约 §2.2）
      k.weapon = weapon;
      k.ammo = WEAPONS[weapon].ammo;
      if (k.mods.lucky) k.shield = SPEC.shield;
      run.crates.splice(i, 1);
      pickExpression(k, 'happy', SPEC.exprHappySec);
      emit(run, { type: 'crateOpen', id: c.id, x: c.x, y: c.y, weapon, owner: k.id });
    }
  }
}

function updateCrates(run, dt) {
  for (const c of run.crates) c.t += dt;
  run.crateTimer -= dt;
  if (run.crateTimer <= 0) {
    run.crateTimer = RULES.crateRespawnSec;
    spawnCrate(run);
  }
  const player = run.karts[0];
  if (player.mods.magnet && !player.dead) {
    for (const c of run.crates) {
      const d = dist(c.x, c.y, player.x, player.y);
      if (d < SPEC.magnet.radius && d > 1) {
        c.x += ((player.x - c.x) / d) * SPEC.magnet.speed * dt;
        c.y += ((player.y - c.y) / d) * SPEC.magnet.speed * dt;
      }
    }
  }
  openCrates(run);
}

function updateTrails(run, dt) {
  for (let i = run.trails.length - 1; i >= 0; i -= 1) {
    const t = run.trails[i];
    t.life -= dt;
    if (t.life <= 0) { run.trails.splice(i, 1); continue; }
    const owner = kartById(run, t.owner);
    for (const k of run.karts) {
      if (k.id === t.owner || k.dead) continue;
      if (dist(k.x, k.y, t.x, t.y) > t.r + K.radius) continue;
      k.trailTick -= dt;
      if (k.trailTick <= 0) {
        k.trailTick = SPEC.trail.tick;
        damageKart(run, k, SPEC.trail.damage, owner, 'trail', k.x, k.y);
      }
    }
  }
}

function collideKarts(run) {
  const rr = K.radius * 2;
  for (let i = 0; i < run.karts.length; i += 1) {
    const a = run.karts[i];
    if (a.dead) continue;
    for (let j = i + 1; j < run.karts.length; j += 1) {
      const b = run.karts[j];
      if (b.dead) continue;
      const d = dist(a.x, a.y, b.x, b.y);
      if (d >= rr) continue;
      const nx = d < 0.0001 ? 1 : (a.x - b.x) / d;
      const ny = d < 0.0001 ? 0 : (a.y - b.y) / d;
      const push = (rr - d) / 2;
      a.x += nx * push; a.y += ny * push;
      b.x -= nx * push; b.y -= ny * push;
      ramCheck(run, a, b, nx, ny);          // n 指向攻击方 → 被撞方沿 -n 飞出去
      ramCheck(run, b, a, -nx, -ny);
    }
  }
}

function ramCheck(run, attacker, victim, nx, ny) {
  if (!attacker.mods.ram || !attacker.boosting || attacker.ramT > 0) return;
  if (victim.invuln > 0 || victim.dead) return;
  const avx = Math.cos(attacker.vAngle) * attacker.speed;
  const avy = Math.sin(attacker.vAngle) * attacker.speed;
  if (avx * nx + avy * ny > 0) return;      // 必须真的朝对方撞过去
  attacker.ramT = SPEC.ramGapSec;
  const damage = B.ramDamage * attacker.dmgMul;
  if (!damageKart(run, victim, damage, attacker, 'ram', victim.x, victim.y)) return;
  const vvx = Math.cos(victim.vAngle) * victim.speed - nx * B.ramKnock;
  const vvy = Math.sin(victim.vAngle) * victim.speed - ny * B.ramKnock;
  victim.vAngle = Math.atan2(vvy, vvx);
  victim.angle = victim.vAngle;
  victim.speed = Math.hypot(vvx, vvy);
  victim.squash = 1;
  emit(run, { type: 'ram', attacker: attacker.id, victim: victim.id, damage, x: victim.x, y: victim.y });
}

// ---------------------------------------------------------------- AI

function nearestFoe(run, k) {
  let best = null;
  let bd = Infinity;
  for (const o of aliveOthers(run, k)) {
    const d = dist(k.x, k.y, o.x, o.y);
    if (d < bd) { bd = d; best = o; }
  }
  return best ? { foe: best, d: bd } : null;
}

function nearestCrate(run, k) {
  let best = null;
  let bd = Infinity;
  for (const c of run.crates) {
    const d = dist(k.x, k.y, c.x, c.y);
    if (d < bd) { bd = d; best = c; }
  }
  return best ? { crate: best, d: bd } : null;
}

/** 预判瞄准：按弹速折算提前量 */
function aimAt(k, target, wp, lead) {
  const d = dist(k.x, k.y, target.x, target.y);
  const t = (d / wp.speed) * lead;
  const tx = target.x + Math.cos(target.vAngle) * target.speed * t;
  const ty = target.y + Math.sin(target.vAngle) * target.speed * t;
  return { angle: Math.atan2(ty - k.y, tx - k.x), d };
}

function avoidBias(run, k, angle) {
  for (const mult of [2.1, 3.4]) {
    const d = K.radius * mult;
    if (pointBlocked(run, k.x + Math.cos(angle) * d, k.y + Math.sin(angle) * d, K.radius)) {
      const left = angle - SPEC.ai.orbitRad;
      const right = angle + SPEC.ai.orbitRad;
      const bl = pointBlocked(run, k.x + Math.cos(left) * d, k.y + Math.sin(left) * d, K.radius);
      const br = pointBlocked(run, k.x + Math.cos(right) * d, k.y + Math.sin(right) * d, K.radius);
      if (!bl && br) return -SPEC.ai.orbitRad;
      if (!br && bl) return SPEC.ai.orbitRad;
      return (run.rand() < 0.5 ? -1 : 1) * SPEC.ai.orbitRad;
    }
  }
  return 0;
}

function wanderTarget(run, k) {
  const ai = k.ai;
  ai.wander -= A.thinkSec;
  if (ai.wander <= 0) {
    ai.wander = 1 + run.rand() * 1.6;
    ai.wanderTurn = (run.rand() - 0.5) * 2;
  }
  const ahead = K.radius * 6;
  return {
    x: clamp(k.x + Math.cos(k.angle + ai.wanderTurn) * ahead, SPEC.wall, WORLD.WIDTH - SPEC.wall),
    y: clamp(k.y + Math.sin(k.angle + ai.wanderTurn) * ahead, SPEC.wall, WORLD.HEIGHT - SPEC.wall),
  };
}

function awayFrom(k, foe) {
  return {
    x: clamp(k.x - (foe.x - k.x), SPEC.wall, WORLD.WIDTH - SPEC.wall),
    y: clamp(k.y - (foe.y - k.y), SPEC.wall, WORLD.HEIGHT - SPEC.wall),
  };
}

function aiDecide(run, k) {
  const ai = k.ai;
  const mode = k.isChampion ? 'champion' : ai.mode;
  const wp = WEAPONS[k.weapon];
  const player = run.karts[0];
  const foes = nearestFoe(run, k);
  const crate = nearestCrate(run, k);
  const tol = mode === 'champion' || mode === 'sniper' ? SPEC.ai.aimTol * 0.8 : SPEC.ai.aimTol;

  ai.wantFire = false;
  ai.rangeMin = 0;
  ai.wantDrift = false;

  let target = null;
  let targetIsCrate = false;
  let lead = SPEC.ai.lead[mode] || 0.4;

  if (mode === 'champion' && !player.dead) {
    target = player;
    lead = 0.6;
  } else if (mode === 'camper') {
    const dp = player.dead ? Infinity : dist(k.x, k.y, player.x, player.y);
    if (dp < SPEC.ai.camperRange) target = player;
    else {
      if (!ai.camp) ai.camp = crate ? { x: crate.crate.x, y: crate.crate.y } : { ...run.arena.crateSpots[0] };
      if (!foes) pickExpression(k, 'sleepy', 1);
      ai.plan = { x: ai.camp.x, y: ai.camp.y };
      ai.targetId = 0;
      return;
    }
  } else if (mode === 'sniper') {
    target = foes ? foes.foe : null;
    if (target && k.hp < SPEC.ai.sniperHpFlee) {    // 残血撤退
      ai.plan = awayFrom(k, foes.foe);
      ai.targetId = 0;
      ai.aimErr = 0;
      return;
    }
    ai.rangeMin = SPEC.ai.sniperMin;
  } else if (mode === 'brawler') {
    if (crate && (foes ? crate.d < foes.d : true)) { target = crate.crate; targetIsCrate = true; }
    else if (foes) { target = foes.foe; }
    ai.wantDrift = run.rand() < 0.45;
  } else {                                           // aggressive：贴脸，无视血量
    target = foes ? foes.foe : null;
    if (foes && foes.d < SPEC.ai.pressRange) ai.wantDrift = run.rand() < 0.3;
  }

  // 弹药将尽 / 还是默认枪 → 去找箱子
  const needAmmo = Number.isFinite(k.ammo) && k.ammo <= SPEC.ai.crateAmmo;
  if (!target && crate && (k.weapon === 'gun' || needAmmo)) { target = crate.crate; targetIsCrate = true; }

  if (!target) {
    ai.plan = wanderTarget(run, k);
    ai.targetId = 0;
    return;
  }

  if (targetIsCrate) {
    ai.plan = { x: target.x, y: target.y };
    ai.targetId = 0;
    return;
  }

  ai.targetId = target.id;
  const aim = aimAt(k, target, wp, lead);
  ai.aimErr = clamp((run.rand() - 0.5) * 2 * A.aimErrorRad * (mode === 'sniper' ? 0.6 : 1), -A.aimErrorRad, A.aimErrorRad);
  const rangeMax = mode === 'sniper' ? SPEC.ai.sniperMax
    : mode === 'brawler' ? SPEC.ai.brawlerRange
      : mode === 'camper' ? SPEC.ai.camperRange : SPEC.ai.gunRange;
  if (!run.tutorial && aim.d <= rangeMax && Math.abs(normAngle(aim.angle - k.angle - ai.aimErr)) < tol) {
    ai.wantFire = true;
  }
  if (mode === 'sniper' && aim.d < SPEC.ai.sniperMin) {   // 太近：拉开距离
    ai.plan = awayFrom(k, target);
    ai.rangeMin = 0;
    return;
  }
  if (aim.d < SPEC.ai.pressRange && mode !== 'sniper' && mode !== 'camper') {
    const side = run.rand() < 0.5 ? 1 : -1;               // 贴身绕圈
    const orbit = aim.angle + side * SPEC.ai.orbitRad;
    ai.plan = { x: k.x + Math.cos(orbit) * SPEC.ai.pressRange, y: k.y + Math.sin(orbit) * SPEC.ai.pressRange };
    return;
  }
  ai.plan = { x: target.x, y: target.y };
}

function aiControl(run, k, dt) {
  const ai = k.ai;
  ai.moveAcc += dist(k.x, k.y, ai.lastX, ai.lastY);
  ai.lastX = k.x;
  ai.lastY = k.y;
  ai.think -= dt;
  if (ai.think <= 0) {
    ai.think = A.thinkSec;
    if (ai.moveAcc < SPEC.stuckMovePx) ai.stuckT += A.thinkSec;
    else ai.stuckT = 0;
    ai.moveAcc = 0;
    if (ai.stuckT >= SPEC.stuckSec) {           // 卡住 1.2s → 反向脱困
      ai.stuckT = 0;
      ai.unstick = SPEC.unstickSec;
      ai.unstickSteer = run.rand() < 0.5 ? -0.8 : 0.8;
    }
    aiDecide(run, k);
  }
  if (ai.unstick > 0) {
    ai.unstick -= dt;
    return { throttle: -1, steer: ai.unstickSteer, drift: false, fire: false };
  }
  const desired = Math.atan2(ai.plan.y - k.y, ai.plan.x - k.x);
  let diff = normAngle(desired - k.angle) + avoidBias(run, k, desired);
  const steer = clamp(diff * SPEC.ai.steerGain, -1, 1);
  const d = dist(k.x, k.y, ai.plan.x, ai.plan.y);
  let throttle = 1;
  if (d < K.radius) throttle = 0;                      // 已经到位：停住，别绕着目标打转
  else if (ai.rangeMin > 0 && d < ai.rangeMin) throttle = -1;
  else if (Math.abs(diff) > SPEC.ai.slowTurnRad) throttle = 0.55;
  // 引导模式不漂移：漂移会解锁加速，突破 AI 限速（brief §4.11）
  return { throttle, steer, drift: run.tutorial ? false : ai.wantDrift, fire: ai.wantFire };
}

// ---------------------------------------------------------------- 回合

function roundWinner(run) {
  let best = run.karts[0];
  for (const k of run.karts) {
    if (k.kills > best.kills || (k.kills === best.kills && k.deaths < best.deaths)) best = k;
  }
  return best;
}

function endRound(run, reason) {
  if (run.phase !== 'playing') return;
  run.phase = 'roundover';
  const winner = roundWinner(run);
  const playerWon = winner.isPlayer;
  winner.expression = 'win';
  winner.expressionT = SPEC.exprWinSec;
  run.roundsPlayed += 1;
  if (playerWon) run.playerRoundsWon += 1;
  else run.botRoundsWon += 1;
  emit(run, { type: 'roundEnd', playerWon, reason });
}

export function nextRound(run, upgradeId) {
  if (run.phase !== 'roundover') return run;
  if (upgradeId) applyUpgrade(run, upgradeId);
  if (run.roundsPlayed >= run.rounds) {
    run.phase = 'matchover';
    run.winner = run.playerRoundsWon > run.botRoundsWon ? 'player' : 'bots';
    emit(run, { type: 'matchEnd', winner: run.winner });
    return run;
  }
  run.roundIndex = Math.min(run.roundsPlayed, run.rounds - 1);
  startRound(run);
  return run;
}

// ---------------------------------------------------------------- 升级

export function upgradeChoices(run, count = UPGRADE_PICKS) {
  const pool = UPGRADES.map((u) => u.id).filter((id) => !run.upgrades.includes(id));
  const out = [];
  for (let i = 0; i < count && pool.length; i += 1) {
    out.push(pool.splice(Math.floor(run.rand() * pool.length), 1)[0]);
  }
  return out;
}

export function applyUpgrade(run, upgradeId) {
  if (!upgradeId || run.upgrades.includes(upgradeId)) return;
  if (!UPGRADES.some((u) => u.id === upgradeId)) return;
  run.upgrades.push(upgradeId);
  const k = run.karts[0];
  const m = k.mods;
  switch (upgradeId) {
    case 'rocket-bounce': m.bounce = true; break;
    case 'triple-shot': m.triple = true; break;
    case 'drift-fire-trail': m.trail = true; break;
    case 'turbo-refund': m.refund = true; break;
    case 'ram-boost': m.ram = true; break;
    case 'ghost-respawn': m.ghost = true; break;
    case 'magnet-crate': m.magnet = true; break;
    case 'lucky-crate': m.lucky = true; break;
    case 'armor-plate':
      k.bonusHp += UPG.armorHp;
      k.maxHp += UPG.armorHp;
      k.hp = Math.min(k.maxHp, k.hp + UPG.armorHp);
      break;
    case 'quick-reload': m.fireRateMul = UPG.fireRateMul; break;
    case 'turbo-engine': m.speedMul = UPG.speedMul; m.driftMul = UPG.driftChargeMul; break;
    default: break;
  }
  emit(run, { type: 'upgrade', id: upgradeId });
}

// ---------------------------------------------------------------- 主循环

export function tick(run, dt, input = {}) {
  if (run.phase !== 'playing' && run.phase !== 'countdown') return;
  run.time += dt;

  if (run.phase === 'countdown') {
    run.countdown -= dt;
    const done = run.countdown <= 1e-9;      // 1/60 累减有浮点误差，留个 epsilon
    const step = RULES.countdownSec / 3;
    const shown = done ? 4 : clamp(Math.floor((RULES.countdownSec - run.countdown) / step) + 1, 0, 4);
    while (run.countdownShown < shown) {
      emit(run, { type: 'countdown', value: 3 - run.countdownShown });
      run.countdownShown += 1;
    }
    if (done) {
      run.countdown = 0;
      run.phase = 'playing';
    }
    return;
  }

  run.roundTime += dt;
  updateCrates(run, dt);

  for (const k of run.karts) {
    if (k.dead) {
      k.respawn -= dt;
      k.deadT += dt;
      if (k.respawn <= 0) respawnKart(run, k);
      continue;
    }
    if (k.invuln > 0) k.invuln -= dt;
    if (k.hitFlash > 0) k.hitFlash -= dt;
    if (k.squash > 0) k.squash = Math.max(0, k.squash - dt / SPEC.squashFadeSec);
    if (k.expressionT > 0) {
      k.expressionT -= dt;
      if (k.expressionT <= 0) k.expression = defaultExpression(k);
    } else if (k.expression === 'boost' && !k.boosting) {
      k.expression = 'idle';
    }

    const ctrl = k.isPlayer
      ? {
        throttle: input.throttle || 0,
        steer: input.steer || 0,
        drift: !!input.drift,
        fire: !!input.fire,
      }
      : aiControl(run, k, dt);

    driveKart(run, k, ctrl, dt);
    k.cooldown -= dt;
    if (ctrl.fire && k.cooldown <= 0) fireWeapon(run, k);
  }

  collideKarts(run);
  updateProjectiles(run, dt);
  updateTrails(run, dt);

  if (run.roundTime >= RULES.roundSeconds) endRound(run, 'time');
}

// ---------------------------------------------------------------- 快照 / 事件

export function getHud(run) {
  const player = run.karts[0];
  const wp = WEAPONS[player.weapon];
  const score = scoreOf(run);
  return {
    phase: run.phase,
    roundIndex: run.roundIndex,
    rounds: run.rounds,
    roundsWon: run.playerRoundsWon,
    roundsLost: run.botRoundsWon,
    winner: run.winner,
    tutorial: run.tutorial,
    arenaId: run.arena.id,
    arena: { id: run.arena.id, name: run.arena.name, tagline: run.arena.tagline },
    countdown: run.phase === 'countdown' ? Math.max(0, 3 - run.countdownShown) : 0,
    killTarget: RULES.killTarget,
    time: run.roundTime,
    timeLeft: Math.max(0, RULES.roundSeconds - run.roundTime),
    elapsed: run.time,
    score,
    rank: rankOf(score),
    crates: run.crates.length,
    upgrades: run.upgrades.slice(),
    player: {
      id: player.id,
      kartId: player.kartId,
      name: player.name,
      color: player.color,
      isPlayer: true,
      x: player.x, y: player.y, angle: player.angle, speed: player.speed,
      hp: player.hp, maxHp: player.maxHp, shield: player.shield,
      dead: player.dead, respawn: player.respawn, invuln: player.invuln,
      weapon: player.weapon, weaponName: wp.name, ammo: player.ammo, ammoMax: wp.ammo,
      cooldown: player.cooldown,
      boost: player.boost, boosting: player.boosting, boostTime: player.boostTime,
      drift: { active: player.drift.active, charge: player.drift.charge },
      kills: player.kills, deaths: player.deaths,
      killsTotal: player.killsTotal, deathsTotal: player.deathsTotal,
      expression: player.expression, expressionT: player.expressionT,
      hitFlash: player.hitFlash, squash: player.squash,
      mods: { ...player.mods },
    },
    karts: run.karts.map((k) => ({
      id: k.id, kartId: k.kartId, name: k.name, color: k.color,
      isPlayer: k.isPlayer, isChampion: k.isChampion,
      hp: k.hp, maxHp: k.maxHp, shield: k.shield, dead: k.dead,
      kills: k.kills, deaths: k.deaths,
      killsTotal: k.killsTotal, deathsTotal: k.deathsTotal,
      boost: k.boost, expression: k.expression,
    })),
    scores: run.karts.map((k) => ({
      id: k.id, kartId: k.kartId, isPlayer: k.isPlayer, name: k.name,
      color: k.color, kills: k.kills, deaths: k.deaths,
    })),
  };
}

export function drainEvents(run) {
  const out = run.events;
  run.events = [];
  return out;
}

export function scoreOf(run) {
  const p = run.karts[0];
  return Math.max(0, p.killsTotal * 10 + run.playerRoundsWon * 40 - p.deathsTotal * 2);
}

export function rankOf(score) {
  for (const r of RANKS) if (score >= r.min) return r.id;
  return RANKS[RANKS.length - 1].id;
}

export const SMOKE = () => {
  const r = createRun({});
  tick(r, 1 / 60, { throttle: 1, steer: 0.3, drift: true, fire: true });
  getHud(r);
  return drainEvents(r).length >= 0;
};
