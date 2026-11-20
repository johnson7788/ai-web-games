// src/game/sim.js — 远征模拟（纯逻辑，零依赖）：状态机 + 组装 battle/expedition 规则
// 模式：formation → map → (battle | rest | event) → upgrade → map … → victory | defeat
// 契约：createRun({seed}) / run.step(input) / run.drainEvents() / run.getHud() / run.getState()
import { STEP } from '../../config/game.config.js';
import {
  HEROES, HERO_IDS, SUPPLY, BATTLE, UPGRADES, rollUpgrades, EVENTS,
} from '../../config/gameplay.js';
import { START_NODE, nodeById, nextNodesOf, TOTAL_COLS, chapterOf } from '../../config/levels.js';
import { mulberry32 } from './rng.js';
import { createBattle, tickBattle, applyAction, getBattleHud } from './battle.js';

function emit(run, type, fields = {}) {
  run.events.push({ type, ...fields });
}

function defaultMods() {
  return {
    frontDmgTaken: 1,
    backDmgTaken: 1,
    volleyAll: false,
    healShield: false,
    sigChargeMult: 1,
    supplyGainBonus: 0,
    starvingImmune: false,
    firstActionMult: 1,
  };
}

function buildHeroes() {
  return HERO_IDS.map((id) => {
    const h = HEROES[id];
    return {
      id: h.id,
      nameKey: h.nameKey,
      cls: h.cls,
      color: h.color,
      hp: h.hp,
      maxHp: h.hp,
      atk: h.atk,
      def: h.def,
      speed: h.speed,
      rowPref: h.rowPref,
      row: h.rowPref,
      alive: true,
      skills: h.skills.map((s) => ({ ...s })),
      skillCd: {},
      buffAtk: 0,
      buffAtkTurns: 0,
      shield: 0,
      tauntTurns: 0,
      side: 'hero',
      nextAt: 0,
    };
  });
}

export function createRun({ seed = 0 } = {}) {
  const rng = mulberry32(seed);
  const run = {
    rng,
    seed: seed >>> 0,
    mode: 'formation',          // formation | map | battle | rest | event | upgrade | victory | defeat
    time: 0,
    chapter: 1,
    nodeId: START_NODE.id,
    col: 0,
    levelsReached: 0,
    supplies: SUPPLY.start,
    starving: false,
    signature: 0,
    signatureMax: BATTLE.signatureMax,
    heroes: buildHeroes(),
    battle: null,
    choices: [],
    event: null,
    upgradeChoices: [],
    mods: defaultMods(),
    stats: { nodesCompleted: 0, battlesWon: 0, suppliesGained: 0 },
    events: [],
  };

  run.step = (input) => step(run, input || {});
  run.drainEvents = () => drainEvents(run);
  run.getHud = () => getHud(run);
  run.getState = () => ({ mode: run.mode, phase: run.mode });
  return run;
}

// ---------- 各模式转移 ----------
function step(run, input) {
  run.time += STEP;
  if (run.mode === 'formation') {
    if (input.confirmFormation) confirmFormation(run, input.confirmFormation);
  } else if (run.mode === 'map') {
    if (input.chooseNode) marchTo(run, input.chooseNode);
  } else if (run.mode === 'battle') {
    if (run.battle.waiting) {
      if (input.action) {
        const won = applyAction(run.battle, run, input.action);
        if (won) onBattleWin(run);
      }
    } else {
      tickBattle(run.battle, run, STEP);
      if (run.mode === 'defeat') return;
    }
  } else if (run.mode === 'event') {
    if (input.choice != null) resolveEvent(run, input.choice);
  } else if (run.mode === 'rest') {
    if (input.continue) backToMap(run);
  } else if (run.mode === 'upgrade') {
    if (input.upgrade) applyUpgrade(run, input.upgrade);
  }
}

// ---------- 布阵 ----------
function confirmFormation(run, formation) {
  if (!Array.isArray(formation) || formation.length !== 3) return;
  const ids = new Set(formation);
  if (ids.size !== 3 || !formation.every((id) => HERO_IDS.includes(id))) return;
  run.heroes.forEach((h) => { h.row = formation.indexOf(h.id); });
  run.mode = 'map';
  run.choices = nextNodesOf(nodeById(run.nodeId)).map((n) => n.id);
  emit(run, 'formationDone', {});
}

// ---------- 行军 ----------
function marchTo(run, nodeId) {
  const node = nodeById(nodeId);
  if (!node) return;
  const allowed = nextNodesOf(nodeById(run.nodeId)).map((n) => n.id);
  if (!allowed.includes(nodeId)) return;

  run.supplies = Math.max(0, run.supplies - SUPPLY.moveCost);
  run.starving = run.supplies <= 0 && !run.mods.starvingImmune;
  run.signature = Math.min(BATTLE.signatureMax, run.signature + BATTLE.chargePerNode);
  run.nodeId = node.id;
  run.col = node.col;
  run.chapter = chapterOf(node.col);
  run.levelsReached = Math.max(run.levelsReached, node.col);
  run.stats.nodesCompleted = run.col;
  emit(run, 'nodeMarch', { nodeId: node.id, type: node.type, chapter: run.chapter });

  if (node.type === 'battle' || node.type === 'elite' || node.type === 'boss') {
    run.battle = createBattle(run, node);
    run.mode = 'battle';
  } else if (node.type === 'rest') {
    for (const h of run.heroes) { h.alive = true; h.hp = h.maxHp; h.shield = 0; }
    run.supplies += SUPPLY.restGain;
    run.starving = run.supplies <= 0 && !run.mods.starvingImmune;
    emit(run, 'rest', { heal: true });
    run.mode = 'rest';
  } else if (node.type === 'event') {
    run.event = EVENTS[Math.floor(run.rng() * EVENTS.length)];
    emit(run, 'event', { eventId: run.event.id });
    run.mode = 'event';
  }
}

// ---------- 战斗胜利 → 奖励 / 升级 / 通关 ----------
function onBattleWin(run) {
  const node = nodeById(run.nodeId);
  const gain = (node.type === 'elite' ? SUPPLY.eliteGain : node.type === 'boss' ? SUPPLY.bossGain : SUPPLY.battleGain)
    + run.mods.supplyGainBonus;
  run.supplies += gain;
  run.stats.suppliesGained += gain;
  run.stats.battlesWon += 1;
  run.starving = run.supplies <= 0 && !run.mods.starvingImmune;
  for (const h of run.heroes) {
    h.alive = true;
    h.hp = Math.max(h.hp, Math.round(h.maxHp * BATTLE.reviveRatio));
    h.shield = 0; h.tauntTurns = 0; h.buffAtk = 0; h.buffAtkTurns = 0;
  }
  emit(run, 'reward', { supplies: gain });

  if (node.type === 'boss') {
    run.mode = 'victory';
    emit(run, 'victory', {});
  } else {
    run.upgradeChoices = rollUpgrades(run.rng);
    run.mode = 'upgrade';
    emit(run, 'upgradeAvailable', {});
  }
}

// ---------- 事件 ----------
function resolveEvent(run, choice) {
  const ev = run.event;
  if (!ev) { run.mode = 'map'; return; }
  const c = ev.choices[choice] || ev.choices[0];
  if (c.effect.supplies) run.supplies = Math.max(0, run.supplies + c.effect.supplies);
  if (c.effect.signature) run.signature = Math.min(BATTLE.signatureMax, run.signature + c.effect.signature);
  if (c.effect.healPct) {
    for (const h of run.heroes) {
      if (!h.alive) continue;
      h.hp = Math.min(h.maxHp, h.hp + Math.round(h.maxHp * c.effect.healPct));
    }
  }
  run.starving = run.supplies <= 0 && !run.mods.starvingImmune;
  run.event = null;
  emit(run, 'eventResolved', { eventId: ev.id, choice });
  backToMap(run);
}

// ---------- 升级 ----------
function applyUpgrade(run, upgradeId) {
  const u = UPGRADES[upgradeId];
  if (!u) { backToMap(run); return; }
  u.apply(run);
  emit(run, 'upgrade', { upgradeId });
  backToMap(run);
}

function backToMap(run) {
  run.mode = 'map';
  run.choices = nextNodesOf(nodeById(run.nodeId)).map((n) => n.id);
}

// ---------- HUD / 事件 ----------
function heroHud(h) {
  return {
    id: h.id, nameKey: h.nameKey, cls: h.cls, color: h.color, row: h.row,
    hp: h.hp, maxHp: h.maxHp, atk: h.atk, alive: h.alive, shield: h.shield,
    skills: (h.skills || []).map((s) => ({ id: s.id, nameKey: s.nameKey, kind: s.kind, cd: s.cd, cdLeft: h.skillCd ? h.skillCd[s.id] : 0 })),
  };
}

function getHud(run) {
  return {
    mode: run.mode,
    chapter: run.chapter,
    chapterName: `ch.${run.chapter}`,
    nodeId: run.nodeId,
    col: run.col,
    levelsReached: run.levelsReached,
    nodesTotal: TOTAL_COLS - 1,
    supplies: run.supplies,
    starving: run.starving,
    signature: run.signature,
    signatureMax: run.signatureMax,
    signatureReady: run.signature >= run.signatureMax,
    heroes: run.heroes.map(heroHud),
    choices: run.choices,
    event: run.event ? {
      textKey: run.event.textKey,
      choices: run.event.choices.map((c) => c.textKey),
    } : null,
    upgradeChoices: run.upgradeChoices,
    battle: run.battle ? getBattleHud(run.battle) : null,
    stats: { ...run.stats },
  };
}

function drainEvents(run) {
  const ev = run.events;
  run.events = [];
  return ev;
}
