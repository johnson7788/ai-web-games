/**
 * src/game/engine.js — 战斗核心（纯逻辑，不碰 DOM）
 *
 * 规则来自原作公开资料：
 *   伤害 = 强度 + 武器攻击力 - 敌方防御（最低 10）
 *   命中 = 速度 + 武器命中 - 敌方速度；陆/海机体再乘地形修正（空型无视）
 *   速度差 ≥ 50 时再攻击一次
 *   移动消耗按 空/陆/海 与地形表计算（见 config/data.js）
 *
 * 三方势力：player（我方）/ enemy（敌方）/ npc（中立 NPC，由电脑控制）
 */

import { TERRAIN, LEGEND, SPIRITS, ARCHETYPES, resolveUnit, SPIRIT_SETS } from "../../config/data.js";

let uidSeed = 1;

/* ------------------------------------------------------------------ 工具 */

export function rngNext(state) {
  // mulberry32
  let t = (state.rng += 0x6d2b79f5);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

export const keyOf = (x, y) => `${x},${y}`;
export const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
export const distXY = (a, x, y) => Math.abs(a.x - x) + Math.abs(a.y - y);

export function parseMap(rows) {
  return rows.map((row) =>
    row.split("").map((ch) => {
      const key = LEGEND[ch] || "plain";
      return { ...TERRAIN[key], char: ch };
    })
  );
}

export function terrainAt(state, x, y) {
  const row = state.map[y];
  return row && row[x] ? row[x] : null;
}

export function unitAt(state, x, y) {
  return state.units.find((u) => u.alive && !u.escaped && u.x === x && u.y === y) || null;
}

export function unitsOf(state, side) {
  return state.units.filter((u) => u.alive && !u.escaped && u.side === side);
}

/** 单位是否还能被选中（我方、存活、未撤离、本回合未行动） */
export function isSelectable(unit) {
  return unit.alive && !unit.escaped && unit.side === "player" && !unit.acted;
}

export function enemySides(state, unit) {
  // NPC 与敌方互相敌对；我方与敌方敌对；NPC 不攻击我方
  if (unit.side === "player") return ["enemy"];
  if (unit.side === "enemy") return ["player", "npc"];
  return ["enemy"];
}

/* ------------------------------------------------------------ 创建战斗 */

function makeUnit(state, name, x, y, sideOverride, opts = {}) {
  const resolved = resolveUnit(name) || resolveUnit("ザク");
  const key = resolved.key;
  const def = resolved.def;
  const arch = ARCHETYPES[def.arch] || ARCHETYPES.grunt;
  const lv = Math.max(1, opts.lv || 1);
  // 数值模型：攻击/防御/速度用档位基准（不随等级膨胀，避免后期伤害触底）；
  // HP 随话数成长，等级用于显示、经验与击坠价值。
  const chapter = Math.max(1, state.scenario.chapter || 1);
  const hpScale = 1 + (chapter - 1) * 0.035;
  const side = sideOverride || (opts.side || "enemy");
  const unit = {
    id: `u${uidSeed++}`,
    key,
    side,
    name: opts.name || def.name || key,
    pilot: opts.pilot || def.pilot || "",
    sprite: opts.sprite || def.sprite || "gundam",
    x, y,
    level: lv,
    exp: 0,
    maxHp: Math.round(arch.hp * hpScale),
    hp: Math.round(arch.hp * hpScale),
    maxSp: side === "player" ? (arch.sp || 0) : 0,
    sp: side === "player" ? (arch.sp || 0) : 0,
    power: arch.power,
    armor: arch.armor,
    speed: arch.speed,
    move: opts.move != null ? opts.move : arch.move,
    type: opts.type || arch.type || "land",
    weapons: (def.weapons || arch.weapons).map((w) => ({ ...w })),
    spirits: (def.spirits || (side === "player" ? SPIRIT_SETS[def.arch] : null) || []).slice(),
    repair: arch.repair ? { ...arch.repair } : null,
    boss: !!(def.boss || arch.boss || opts.boss),
    ship: !!(arch.ship || opts.ship),
    ai: opts.ai || "aggressive",
    ability: opts.ability || null,
    expValue: opts.exp != null ? opts.exp : (20 + lv * 8),
    moneyValue: opts.money != null ? opts.money : (60 + lv * 10),
    buffs: {},
    acted: false,
    moved: false,
    npc: side === "npc",
    protected: !!opts.protected,
    escaped: false,
    alive: true
  };
  if (opts.immobile) unit.move = 0;
  if (opts.moveFromTurn) unit.moveFromTurn = opts.moveFromTurn;
  if (opts.leaveTurn) unit.leaveTurn = opts.leaveTurn;
  if (opts.waveIndex != null) unit.waveIndex = opts.waveIndex;
  if (opts.spawnTurn != null) unit.spawnTurn = opts.spawnTurn;
  // 数据里偶有同格冲突（如第 7 话 NPC 与一台高达同格）：就近找空格，避免叠放
  if (unitAt(state, x, y)) {
    const free = nearestFreeTile(state, x, y);
    if (free) { unit.x = free.x; unit.y = free.y; }
  }
  state.units.push(unit);
  return unit;
}

export function createBattle(scenario, seed = 20260101) {
  uidSeed = 1;
  const state = {
    scenario,
    map: parseMap(scenario.map),
    cols: scenario.cols || scenario.map[0].length,
    rows: scenario.rows || scenario.map.length,
    units: [],
    turn: 1,
    phase: "player",
    winner: null,
    rng: seed,
    log: [],
    events: [],
    wavesDone: [],
    stats: { kills: 0, attacks: 0, damageDealt: 0, damageTaken: 0, turns: 0, escaped: 0 },
    startedAt: Date.now()
  };

  (scenario.deploy || []).forEach((d) => {
    makeUnit(state, d.unit, d.x, d.y, "player", { lv: d.lv, pilot: d.pilot, immobile: isImmobile(scenario, d) });
  });
  (scenario.enemies || []).forEach((d) => {
    makeUnit(state, d.unit, d.x, d.y, "enemy", buildEnemyOpts(d));
  });
  (scenario.npcs || []).forEach((d) => {
    const npcCfg = (scenario.npcConfig || {})[d.unit] || {};
    makeUnit(state, d.unit, d.x, d.y, "npc", {
      lv: d.lv, pilot: d.pilot, immobile: isImmobile(scenario, d) || npcCfg.immobile,
      leaveTurn: npcCfg.leaveTurn
    });
  });

  pushLogKey(state, "logStart", { n: scenario.chapter, title: scenario.title });
  // 第 1 回合的增援在开局就出现
  applyWaves(state, 1);
  return state;
}

function isImmobile(scenario, d) {
  return (scenario.immobile || []).includes(d.unit);
}

function buildEnemyOpts(d) {
  const opts = { lv: d.lv, pilot: d.pilot, exp: d.exp, money: d.money, ability: d.ability };
  if (d.ai) {
    const m = /(\d+)\s*ターンから移動/.exec(d.ai);
    if (m) opts.moveFromTurn = Number(m[1]);
    else if (/最初から移動/.test(d.ai)) opts.moveFromTurn = 1;
  }
  return opts;
}

function nearestFreeTile(state, x, y) {
  for (let r = 1; r <= Math.max(state.cols, state.rows); r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
        const nx = x + dx;
        const ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= state.cols || ny >= state.rows) continue;
        if (!unitAt(state, nx, ny)) return { x: nx, y: ny };
      }
    }
  }
  return null;
}

export function pushLog(state, text, kind = "") {
  state.log.push({ text, kind, turn: state.turn });
  if (state.log.length > 160) state.log.shift();
}

/** 结构化日志：{key, vars}，由 UI 按当前语言渲染 */
export function pushLogKey(state, key, vars = {}, kind = "") {
  state.log.push({ key, vars, kind, turn: state.turn });
  if (state.log.length > 160) state.log.shift();
}

/* ---------------------------------------------------------------- 移动 */

export function moveCost(unit, terrain) {
  if (!terrain) return Infinity;
  const t = unit.type === "air" ? "air" : unit.type === "sea" ? "sea" : "land";
  const cost = terrain.move[t];
  return cost > 0 ? cost : Infinity;
}

/** 返回 Map("x,y" -> cost)，含原点；用 Dijkstra 保证不同地形成本下结果正确 */
export function moveRange(state, unit) {
  const budget = unit.move + (unit.buffs.move || 0);
  const seen = new Map([[keyOf(unit.x, unit.y), 0]]);
  const queue = [{ x: unit.x, y: unit.y, cost: 0 }];
  const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
  while (queue.length) {
    queue.sort((a, b) => a.cost - b.cost);
    const cur = queue.shift();
    if (cur.cost > (seen.get(keyOf(cur.x, cur.y)) ?? Infinity)) continue;
    for (const [dx, dy] of dirs) {
      const nx = cur.x + dx;
      const ny = cur.y + dy;
      const terrain = terrainAt(state, nx, ny);
      const step = moveCost(unit, terrain);
      if (!Number.isFinite(step)) continue;
      const cost = cur.cost + step;
      if (cost > budget) continue;
      const k = keyOf(nx, ny);
      if (seen.has(k) && seen.get(k) <= cost) continue;
      const occupied = unitAt(state, nx, ny);
      if (occupied && occupied.id !== unit.id) continue; // 任何单位都阻挡
      seen.set(k, cost);
      queue.push({ x: nx, y: ny, cost });
    }
  }
  return seen;
}

export function canReach(state, unit, x, y) {
  return moveRange(state, unit).has(keyOf(x, y));
}

export function moveUnit(state, unit, x, y) {
  if (!canReach(state, unit, x, y)) return false;
  const fromX = unit.x;
  const fromY = unit.y;
  unit.x = x;
  unit.y = y;
  unit.moved = true;
  state.events.push({ type: "move", unit: unit.id, x, y, fromX, fromY });
  return true;
}

/** 撤退 / 离场（不进入阵亡统计） */
export function removeUnit(state, unit, reason = "leave") {
  unit.alive = false;
  unit.escaped = reason === "escape";
  if (unit.escaped) state.stats.escaped += 1;
  state.events.push({ type: reason === "escape" ? "escape" : "leave", unit: unit.id });
}

export function isExitTile(state, x, y) {
  const esc = state.scenario.objective && state.scenario.objective.victory;
  if (!esc || esc.type !== "escape") return false;
  if (esc.exit === "right") return x >= state.cols - 1;
  if (esc.exit === "bottom") return y >= state.rows - 1;
  if (esc.exit === "left") return x <= 0;
  if (esc.exit === "top") return y <= 0;
  return false;
}

/* ---------------------------------------------------------------- 攻击 */

export function weaponCanHit(unit, weapon, target) {
  const d = dist(unit, target);
  return d >= 1 && d <= weapon.range;
}

export function attackOptions(state, unit, x, y) {
  const origin = { x: x == null ? unit.x : x, y: y == null ? unit.y : y };
  const foes = enemySides(state, unit);
  const out = [];
  for (const other of state.units) {
    if (!other.alive || other.escaped || !foes.includes(other.side)) continue;
    const d = distXY(origin, other.x, other.y);
    if (d < 1) continue;
    const weapons = unit.weapons
      .map((w, i) => ({ w, i }))
      .filter(({ w }) => d <= w.range)
      .filter(({ w }) => !(other.ability === "間接攻撃無効" && d > 1 && w.kind !== "melee"));
    if (weapons.length) out.push({ unit: other, weapons, distance: d });
  }
  return out;
}

export function maxRange(unit) {
  return Math.max(...unit.weapons.map((w) => w.range));
}

/** 地形命中修正只作用于陆/海机体 */
function terrainHitMod(terrain, defender) {
  if (!terrain) return 1;
  if (defender.type === "air") return 1;
  return terrain.hitMod;
}

export function damagePreview(state, attacker, defender, weapon, opts = {}) {
  const terrain = terrainAt(state, defender.x, defender.y);
  let dmg = attacker.power + weapon.atk - defender.armor;
  if (defender.buffs.guard) dmg = Math.floor(dmg / 2);
  if (defender.ability === "防御態勢") dmg = Math.floor(dmg * 0.7);
  if (defender.ability === "シールド防御") dmg = Math.floor(dmg * 0.8);
  if (attacker.buffs.dmg) dmg = Math.floor(dmg * attacker.buffs.dmg);
  if (defender.ability === "間接攻撃無効" && dist(attacker, defender) > 1 && weapon.kind !== "melee") dmg = 0;
  dmg = Math.max(10, dmg);

  let hit = attacker.speed + weapon.hit - defender.speed;
  hit *= terrainHitMod(terrain, defender);
  if (attacker.buffs.acc) hit += attacker.buffs.acc;
  if (attacker.buffs.critical) hit = 100;
  if (defender.buffs.dodge) return { dmg, hit: 0, double: false };
  if (defender.ability === "怪電波") hit *= 0.7;
  if (state.jamTurn === state.turn && attacker.side === "enemy") hit *= 0.5;
  hit = Math.max(5, Math.min(100, Math.round(hit)));
  return { dmg, hit, double: attacker.speed - defender.speed >= 50 };
}

function strike(state, attacker, defender, weapon, label) {
  const preview = damagePreview(state, attacker, defender, weapon);
  const roll = rngNext(state) * 100;
  state.stats.attacks += 1;
  const ev = {
    type: "attack",
    from: attacker.id,
    to: defender.id,
    weapon: weapon.name,
    kind: weapon.kind,
    label,
    hit: roll < preview.hit,
    damage: 0,
    crit: false
  };

  if (ev.hit) {
    ev.damage = preview.dmg;
    if (preview.dmg === 0) {
      pushLogKey(state, "logBarrier", { d: defender.key, a: attacker.key, weapon: weapon.name });
      state.events.push(ev);
      return ev;
    }
    defender.hp -= preview.dmg;
    if (attacker.side === "player") state.stats.damageDealt += preview.dmg;
    else if (attacker.side === "enemy") state.stats.damageTaken += preview.dmg;
    // 消耗一次性增益
    attacker.buffs.acc = 0;
    attacker.buffs.critical = false;
    attacker.buffs.dmg = 0;
    defender.buffs.dodge = false;
    defender.buffs.guard = false;
    if (defender.hp <= 0) {
      defender.hp = 0;
      defender.alive = false;
      ev.killed = true;
      if (attacker.side === "player") {
        state.stats.kills += 1;
        grantExp(state, attacker, defender);
      }
      pushLogKey(state, "logKill", { a: attacker.key, d: defender.key }, "kill");
      state.events.push({ type: "destroy", unit: defender.id });
    }
  }

  state.events.push(ev);
  if (ev.hit) pushLogKey(state, "logHit", { a: attacker.key, weapon: weapon.name, d: defender.key, damage: ev.damage }, "hit");
  else pushLogKey(state, "logMiss", { a: attacker.key, weapon: weapon.name, d: defender.key });
  return ev;
}

function bestCounterWeapon(defender, attacker, from) {
  const d = dist(from, attacker);
  const options = defender.weapons
    .map((w, i) => ({ w, i }))
    .filter(({ w }) => d >= 1 && d <= w.range);
  if (!options.length) return null;
  options.sort((a, b) => b.w.atk - a.w.atk);
  return options[0].w;
}

/** 一次完整交战：攻击 → 反击 → 再攻击 → 再反击 */
export function resolveAttack(state, attacker, defender, weapon) {
  const events = [];
  const first = strike(state, attacker, defender, weapon);
  events.push(first);

  if (defender.alive && !defender.escaped) {
    const counter = bestCounterWeapon(defender, attacker, defender);
    if (counter) events.push(strike(state, defender, attacker, counter, "counter"));
  }

  if (defender.alive && attacker.alive && attacker.speed - defender.speed >= 50) {
    events.push(strike(state, attacker, defender, weapon, "double"));
    if (defender.alive && defender.speed - attacker.speed >= 50) {
      const counter = bestCounterWeapon(defender, attacker, defender);
      if (counter) events.push(strike(state, defender, attacker, counter, "counter"));
    }
  }

  attacker.acted = true;
  state.events.push(...events);
  checkEnd(state);
  return events;
}

export function repairUnit(state, healer, target) {
  if (!healer.repair) return null;
  const amount = healer.repair.amount;
  const before = target.hp;
  target.hp = Math.min(target.maxHp, target.hp + amount);
  const healed = target.hp - before;
  healer.acted = true;
  const ev = { type: "heal", from: healer.id, to: target.id, amount: healed };
  state.events.push(ev);
  pushLogKey(state, "logRepair", { a: healer.key, d: target.key, amount: healed });
  return ev;
}

/* ---------------------------------------------------------- 经验 / 等级 */

export function expToNext(level) {
  return 80 + (level - 1) * 60;
}

export function grantExp(state, unit, defeated) {
  const base = defeated.expValue || 20;
  const gain = Math.max(8, Math.round(base * (1 + (defeated.level - unit.level) * 0.05)));
  unit.exp += gain;
  pushLogKey(state, "logExp", { u: unit.key, gain });
  while (unit.exp >= expToNext(unit.level)) {
    unit.exp -= expToNext(unit.level);
    levelUp(state, unit);
  }
}

export function levelUp(state, unit) {
  unit.level += 1;
  unit.maxHp += 12;
  unit.hp = Math.min(unit.maxHp, unit.hp + Math.round(unit.maxHp * 0.2));
  unit.power += 2;
  unit.armor += 1;
  unit.speed += 1;
  unit.maxSp += 3;
  unit.sp = Math.min(unit.maxSp, unit.sp + 3);
  state.events.push({ type: "levelup", unit: unit.id, level: unit.level });
  pushLogKey(state, "logLevel", { u: unit.key, level: unit.level }, "kill");
}

/* ---------------------------------------------------------------- 精神 */

export function spiritCost(unit, id) {
  const spirit = SPIRITS[id];
  return spirit ? spirit.cost : Infinity;
}

export function canUseSpirit(unit, id) {
  const spirit = SPIRITS[id];
  return !!spirit && unit.alive && !unit.escaped && unit.sp >= spirit.cost;
}

export function useSpirit(state, unit, id, opts = {}) {
  const spirit = SPIRITS[id];
  if (!spirit || !canUseSpirit(unit, id)) return false;
  unit.sp -= spirit.cost;
  const allies = state.units.filter((u) => u.alive && !u.escaped && u.side === unit.side);
  const foes = state.units.filter((u) => u.alive && !u.escaped && enemySides(state, unit).includes(u.side));
  const target = opts.target || null;

  switch (id) {
    case "guts": unit.hp = Math.min(unit.maxHp, unit.hp + 50); break;
    case "sense": unit.buffs.acc = 10; break;
    case "accel": unit.buffs.move = (unit.buffs.move || 0) + 3; break;
    case "guard": unit.buffs.guard = true; break;
    case "friend": if (target) target.hp = Math.min(target.maxHp, target.hp + 50); break;
    case "critical": unit.buffs.critical = true; break;
    case "drive": unit.buffs.dmg = 2; break;
    case "dodge": unit.buffs.dodge = true; break;
    case "swift": unit.buffs.move = (unit.buffs.move || 0) + 5; break;
    case "potential": unit.hp = unit.maxHp; break;
    case "bond": if (target) target.hp = target.maxHp; break;
    case "hotblood": unit.buffs.dmg = 3; break;
    case "support": allies.forEach((a) => { a.hp = Math.min(a.maxHp, a.hp + 50); }); break;
    case "jam": state.jamTurn = state.turn; break;
    case "anger":
      foes.forEach((e) => damageUnit(state, e, 1 + Math.floor(rngNext(state) * 128), unit));
      break;
    case "pray": allies.forEach((a) => { a.hp = Math.min(a.maxHp, a.hp + 100); }); break;
    case "love": allies.forEach((a) => { a.hp = a.maxHp; }); break;
    case "rage":
      foes.forEach((e) => damageUnit(state, e, 10 + Math.floor(rngNext(state) * 246), unit));
      break;
    case "teleport":
      if (target && opts.x != null) { target.x = opts.x; target.y = opts.y; }
      break;
    default: break;
  }

  state.events.push({ type: "spirit", unit: unit.id, spirit: id });
  pushLogKey(state, "logSpirit", { u: unit.key, spirit: spirit.name });
  checkEnd(state);
  return true;
}

function damageUnit(state, target, dmg, source) {
  target.hp = Math.max(0, target.hp - dmg);
  if (target.hp === 0) {
    target.alive = false;
    state.events.push({ type: "destroy", unit: target.id });
    if (source && source.side === "player") state.stats.kills += 1;
  }
}

/* ---------------------------------------------------------------- 回合 */

export function beginPlayerTurn(state) {
  state.phase = "player";
  state.units.forEach((u) => {
    if (!u.alive || u.escaped) return;
    u.acted = false;
    u.moved = false;
    u.buffs = {};
  });
  // 基地回复
  state.units.forEach((u) => {
    if (!u.alive || u.escaped) return;
    const t = terrainAt(state, u.x, u.y);
    if (t && t.heal > 0 && u.hp < u.maxHp) {
      const heal = Math.max(1, Math.round(u.maxHp * t.heal));
      u.hp = Math.min(u.maxHp, u.hp + heal);
      pushLogKey(state, "logHeal", { u: u.key, terrain: t.name, amount: heal });
    }
  });
  state.events.push({ type: "phase", phase: "player", turn: state.turn });
}

export function endPlayerTurn(state) {
  state.events = [];
  state.phase = "enemy";
  state.units.forEach((u) => { u.acted = false; u.moved = false; });
  state.events.push({ type: "phase", phase: "enemy", turn: state.turn });

  runEnemyPhase(state);
  if (state.winner) return state.events;

  state.turn += 1;
  state.stats.turns = state.turn;
  applyWaves(state, state.turn);
  beginPlayerTurn(state);
  checkEnd(state);
  return state.events;
}

/** 回合开始时触发增援；turn 表示「第 N 回合开始时登场」 */
export function applyWaves(state, turn) {
  const sc = state.scenario;
  (sc.allyWaves || []).forEach((wave, index) => {
    if (wave.turn !== turn) return;
    const key = `a${index}`;
    if (state.wavesDone.includes(key)) return;
    state.wavesDone.push(key);
    wave.units.forEach((d) => {
      const u = makeUnit(state, d.unit, d.x, d.y, "player", {
        lv: d.lv, pilot: d.pilot, waveIndex: key, spawnTurn: turn
      });
      state.events.push({ type: "spawn", unit: u.id, side: "player" });
    });
    pushLogKey(state, "logAllyWave", {}, "kill");
  });

  (sc.waves || []).forEach((wave, index) => {
    if (wave.turn !== turn) return;
    if (state.wavesDone.includes(index)) return;
    state.wavesDone.push(index);
    wave.units.forEach((d) => {
      const u = makeUnit(state, d.unit, d.x, d.y, "enemy", {
        ...buildEnemyOpts(d), waveIndex: index, spawnTurn: turn
      });
      state.events.push({ type: "spawn", unit: u.id, side: "enemy" });
    });
    pushLogKey(state, "logEnemyWave", {}, "kill");
    if (wave.dialogue) state.events.push({ type: "wave", index, dialogue: wave.dialogue });
  });
}

/* ------------------------------------------------------------------ AI */

function pathToward(state, unit, target) {
  const reach = moveRange(state, unit);
  const maxR = maxRange(unit);
  let best = { x: unit.x, y: unit.y, score: Infinity };
  for (const k of reach.keys()) {
    const [x, y] = k.split(",").map(Number);
    if (x === unit.x && y === unit.y) continue;
    if (unitAt(state, x, y)) continue;
    const d = distXY({ x, y }, target.x, target.y);
    // 优先选择「移动后能打到目标」的格子；否则靠近目标。
    const score = d <= maxR ? d - 1000 : d;
    if (score < best.score) best = { x, y, score };
  }
  return best;
}

/** 选择收益最高的攻击目标（伤害 × 命中） */
function pickAttack(state, unit) {
  const options = attackOptions(state, unit);
  let best = null;
  for (const entry of options) {
    for (const { w, i } of entry.weapons) {
      const prev = damagePreview(state, unit, entry.unit, w);
      // 优先能击坠的目标
      const killBonus = prev.dmg >= entry.unit.hp ? 100000 : 0;
      const score = killBonus + prev.dmg * prev.hit;
      if (!best || score > best.score) best = { entry, weapon: w, weaponIndex: i, score };
    }
  }
  return best;
}

function aiAct(state, unit) {
  if (!unit.alive || unit.escaped) return;
  // 「N 回合后开始移动」：未到回合数就原地不动（但可以攻击射程内目标）
  if (unit.moveFromTurn && state.turn < unit.moveFromTurn) {
    const attack = pickAttack(state, unit);
    if (attack) resolveAttack(state, unit, attack.entry.unit, attack.weapon);
    return;
  }
  // 离场型 NPC
  if (unit.leaveTurn && state.turn >= unit.leaveTurn) {
    pushLogKey(state, "logLeave", { u: unit.key });
    removeUnit(state, unit, "leave");
    return;
  }
  // 固定单位（炮台 / 镜面）不移动
  const canMove = unit.move > 0;

  const attack = pickAttack(state, unit);
  if (attack) {
    resolveAttack(state, unit, attack.entry.unit, attack.weapon);
    return;
  }

  const foes = enemySides(state, unit)
    .flatMap((side) => unitsOf(state, side));
  if (!foes.length || !canMove) return;
  const nearest = foes.slice().sort((a, b) => dist(unit, a) - dist(unit, b))[0];
  const step = pathToward(state, unit, nearest);
  if (step.x !== unit.x || step.y !== unit.y) {
    const fromX = unit.x;
    const fromY = unit.y;
    unit.x = step.x;
    unit.y = step.y;
    state.events.push({ type: "move", unit: unit.id, x: unit.x, y: unit.y, fromX, fromY });
  }
  const after = pickAttack(state, unit);
  if (after) resolveAttack(state, unit, after.entry.unit, after.weapon);
}

function runEnemyPhase(state) {
  // 敌方 + NPC 都行动；按敌方→NPC 顺序，避免 NPC 抢在敌人前面
  const actors = [
    ...unitsOf(state, "enemy"),
    ...unitsOf(state, "npc")
  ];
  for (const unit of actors) {
    if (state.winner) return;
    if (!unit.alive || unit.escaped) continue;
    aiAct(state, unit);
    checkEnd(state);
  }
}

/* ---------------------------------------------------------------- 结束 */

export function checkEnd(state) {
  if (state.winner) return state.winner;
  const sc = state.scenario;
  const obj = sc.objective || {};
  const victory = obj.victory || { type: "annihilate" };
  const defeat = obj.defeat || { type: "annihilate" };

  const players = unitsOf(state, "player");
  const enemies = unitsOf(state, "enemy");
  const pendingWaves = (sc.waves || []).some((w, i) => !state.wavesDone.includes(i) && w.turn > state.turn);

  // ---- 失败条件 ----
  if (defeat.type === "protect") {
    const lost = (defeat.units || []).some((name) => {
      const u = state.units.find((x) => x.key === name || x.name === name);
      return u ? (!u.alive && !u.escaped) : false;
    });
    if (lost) return finish(state, "defeat");
  }
  if (defeat.type === "turnLimit" && state.turn > defeat.turns) return finish(state, "defeat");
  if (defeat.type === "annihilate" && players.length === 0) return finish(state, "defeat");
  // 保护单位也是我方时：全灭仍算失败
  if (defeat.type === "protect" && players.length === 0) return finish(state, "defeat");

  // ---- 胜利条件 ----
  if (victory.type === "annihilate") {
    if (!enemies.length && !pendingWaves) return finish(state, "victory");
  } else if (victory.type === "destroy") {
    const targets = victory.targets || [];
    const remaining = state.units.filter((u) =>
      u.side === "enemy" && u.alive && !u.escaped &&
      (targets.includes("__boss__") ? u.boss : targets.some((t) => u.key === t || u.name === t)));
    const needWaves = (sc.waves || []).some((w, i) => !state.wavesDone.includes(i) && w.turn > state.turn);
    if (targets.length && !remaining.length && !needWaves) return finish(state, "victory");
    if (victory.orAnnihilate && !enemies.length && !pendingWaves) return finish(state, "victory");
    if (victory.turns && state.turn > victory.turns) return finish(state, "defeat");
  } else if (victory.type === "escape") {
    const onField = players.length;
    if (!onField && state.stats.escaped > 0) return finish(state, "victory");
    if (victory.orAnnihilate && !enemies.length && !pendingWaves) return finish(state, "victory");
    if (victory.turns && state.turn > victory.turns) return finish(state, "defeat");
  } else if (victory.type === "survive") {
    if (state.turn > (victory.turns || 20)) return finish(state, "victory");
    if (victory.orAnnihilate && !enemies.length && !pendingWaves) return finish(state, "victory");
  }
  return null;
}

function finish(state, winner) {
  state.winner = winner;
  state.events.push({ type: winner });
  return winner;
}

/* ---------------------------------------------------------------- 存档 */

export function serialize(state) {
  return {
    v: 2,
    scenarioId: state.scenario.id,
    turn: state.turn,
    phase: state.phase,
    rng: state.rng,
    wavesDone: state.wavesDone.slice(),
    stats: { ...state.stats },
    jamTurn: state.jamTurn || null,
    units: state.units.map((u) => ({
      id: u.id, key: u.key, side: u.side, name: u.name, pilot: u.pilot, sprite: u.sprite,
      x: u.x, y: u.y, level: u.level, exp: u.exp, hp: u.hp, maxHp: u.maxHp,
      sp: u.sp, maxSp: u.maxSp, power: u.power, armor: u.armor, speed: u.speed,
      move: u.move, type: u.type, alive: u.alive, acted: u.acted, moved: u.moved,
      escaped: u.escaped, npc: u.npc, protected: u.protected,
      boss: u.boss, ship: u.ship, ai: u.ai, ability: u.ability,
      expValue: u.expValue, moneyValue: u.moneyValue,
      waveIndex: u.waveIndex, spawnTurn: u.spawnTurn,
      moveFromTurn: u.moveFromTurn, leaveTurn: u.leaveTurn
    })),
    log: state.log.slice(-40)
  };
}

export function deserialize(scenario, save) {
  const state = createBattle(scenario, save.rng);
  state.units = (save.units || []).map((s) => {
    const resolved = resolveUnit(s.key) || resolveUnit("ザク");
    const def = resolved.def;
    const arch = ARCHETYPES[def.arch] || ARCHETYPES.grunt;
    return {
      id: s.id, key: s.key, side: s.side,
      name: s.name || def.name, pilot: s.pilot || def.pilot || "", sprite: s.sprite || def.sprite,
      x: s.x, y: s.y, level: s.level || 1, exp: s.exp || 0,
      maxHp: s.maxHp, hp: s.hp, maxSp: s.maxSp || 0, sp: s.sp || 0,
      power: s.power, armor: s.armor, speed: s.speed,
      move: s.move != null ? s.move : arch.move,
      type: s.type || arch.type || "land",
      weapons: (def.weapons || arch.weapons).map((w) => ({ ...w })),
      spirits: (def.spirits || (s.side === "player" ? SPIRIT_SETS[def.arch] : null) || []).slice(),
      repair: arch.repair ? { ...arch.repair } : null,
      boss: !!s.boss, ship: !!s.ship, ai: s.ai || "aggressive", ability: s.ability || null,
      expValue: s.expValue || 20, moneyValue: s.moneyValue || 0,
      buffs: {}, acted: !!s.acted, moved: !!s.moved,
      npc: !!s.npc, protected: !!s.protected, escaped: !!s.escaped,
      waveIndex: s.waveIndex, spawnTurn: s.spawnTurn,
      moveFromTurn: s.moveFromTurn, leaveTurn: s.leaveTurn,
      alive: s.alive !== false
    };
  });
  const maxId = state.units.reduce((m, u) => Math.max(m, Number(String(u.id).replace(/\D/g, "")) || 0), 0);
  uidSeed = Math.max(uidSeed, maxId + 1);
  state.turn = save.turn || 1;
  // 敌方阶段中途存档：读档时回到我方阶段开头，避免卡死
  state.phase = "player";
  if (save.phase === "enemy") {
    state.units.forEach((u) => { u.acted = false; u.moved = false; u.buffs = {}; });
  }
  state.wavesDone = save.wavesDone || [];
  state.stats = save.stats || state.stats;
  state.jamTurn = save.jamTurn || null;
  state.log = save.log || [];
  state.winner = null;
  return state;
}
