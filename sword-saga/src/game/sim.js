// src/game/sim.js — 纯逻辑游戏状态机：地图行走 / NPC 对话 / 剧情节点 / 回合战斗 / 12 章推进。
// createRun({seed}) → run；run.step(input) / run.drainEvents() / run.getHud() / run.phase。
// 不碰 DOM/window/localStorage/Date.now；随机用注入 rng。
import { WORLD, STEP } from '../../config/game.config.js';
import {
  CHAPTERS, chapterDef, MAP, POST_BATTLE, HEROES, ITEMS,
} from '../../config/gameplay.js';
import { STORY } from '../../config/story.js';
import { createBattle, stepBattle, battleStartEvents, applyPostBattle } from './battle.js';
import { mulberry32 } from './rng.js';

const MOVE_SPEED = 6.0;      // tiles / sec
const TALK_RADIUS = 1.6;     // 与 NPC 交互距离（tile）
const DOOR_RADIUS = 1.6;
const MILESTONE_EVERY = 0.6; // 细粒度里程碑事件间隔（秒），压低遥测事件最大间隔

function freshParty() {
  return {
    hero: { hp: HEROES.hero.hp, mp: HEROES.hero.mp, bonusHp: 0 },
    fox: { hp: HEROES.fox.hp, mp: HEROES.fox.mp, bonusHp: 0 },
  };
}

function freshInventory() {
  return { herb: 3, elixir: 2 };
}

export function createRun({ seed = 1, startChapter = 1 } = {}) {
  const rng = mulberry32(seed >>> 0);
  const run = {
    phase: 'playing',            // playing | victory | dead
    time: 0,
    chapter: startChapter,
    scene: 1,
    mode: 'map',                 // map | dialog | battle | chapterEnd
    party: freshParty(),
    inventory: freshInventory(),
    map: { px: MAP.spawn.x, py: MAP.spawn.y, openingDone: false, stepAccum: 0, lastStepAt: 0 },
    dialog: null,
    battle: null,
    pendingCommand: null,        // 战斗菜单命令缓冲（UI / bot 写入）
    stats: { chaptersCleared: 0, bossDefeated: 0, battlesWon: 0, battlesFought: 0 },
    events: [],
    milestoneTimer: 0,
    rng,
  };

  setupChapter(run);
  push(run, { type: 'chapterStart', chapter: run.chapter, scene: run.scene });
  push(run, { type: 'runStart', chapter: run.chapter });

  // 装配 run 的契约方法（main / selfplay / verify 统一调用）
  run.step = (input) => stepRun(run, input);
  run.drainEvents = () => {
    const e = run.events;
    run.events = [];
    return e;
  };
  run.getHud = () => getHud(run);
  // 调试/截图用：跳到指定章节并重装配地图
  run.jumpTo = (n) => {
    run.chapter = Math.max(1, Math.min(CHAPTERS.length, n));
    setupChapter(run);
    run.phase = 'playing';
    push(run, { type: 'chapterStart', chapter: run.chapter, scene: run.scene });
  };
  return run;
}

function push(run, ev) {
  run.events.push(ev);
}

// ---------------------------------------------------------------------------
// 章节装配
// ---------------------------------------------------------------------------

function setupChapter(run) {
  const def = chapterDef(run.chapter);
  run.scene = def.scene;
  run.map.px = MAP.spawn.x;
  run.map.py = MAP.spawn.y;
  run.map.openingDone = false;
  run.mode = 'map';
  run.dialog = null;
  run.battle = null;
  run.pendingCommand = null;
}

function dialogLinesFor(chapter, kind) {
  const s = STORY[chapter] || STORY[1];
  if (kind === 'opening') return [...(s.npc || []), ...(s.opening || [])];
  return s.closing || [];
}

function openDialog(run, kind) {
  const lines = dialogLinesFor(run.chapter, kind);
  run.dialog = { kind, lines, idx: 0 };
  run.mode = 'dialog';
  push(run, { type: 'dialogOpen', kind, lines: lines.length, chapter: run.chapter });
}

// ---------------------------------------------------------------------------
// 地图步进
// ---------------------------------------------------------------------------

function stepMap(run, input, events) {
  const dir = input.dir || null;
  if (dir) {
    const dx = Math.max(-1, Math.min(1, dir.x || 0));
    const dy = Math.max(-1, Math.min(1, dir.y || 0));
    if (dx || dy) {
      run.map.px = clamp(run.map.px + dx * MOVE_SPEED * STEP, 0.5, MAP.cols - 0.5);
      run.map.py = clamp(run.map.py + dy * MOVE_SPEED * STEP, 0.5, MAP.rows - 0.5);
      run.map.stepAccum += Math.hypot(dx, dy) * MOVE_SPEED * STEP;
      if (run.map.stepAccum >= 0.6) {
        run.map.stepAccum = 0;
        events.push({ type: 'step', x: run.map.px, y: run.map.py });
      }
    }
  }

  const dxNpc = run.map.px - MAP.npc.x;
  const dyNpc = run.map.py - MAP.npc.y;
  if (!run.map.openingDone && Math.hypot(dxNpc, dyNpc) <= TALK_RADIUS) {
    run.map.openingDone = true;
    openDialog(run, 'opening');
    return;
  }

  const dxDoor = run.map.px - MAP.door.x;
  const dyDoor = run.map.py - MAP.door.y;
  if (run.map.openingDone && Math.hypot(dxDoor, dyDoor) <= DOOR_RADIUS) {
    startBattle(run, events);
  }
}

// ---------------------------------------------------------------------------
// 对话步进
// ---------------------------------------------------------------------------

function stepDialog(run, input, events) {
  if (!input.advance) return;
  run.dialog.idx += 1;
  events.push({ type: 'dialogAdvance', idx: run.dialog.idx, total: run.dialog.lines.length });
  if (run.dialog.idx >= run.dialog.lines.length) {
    const kind = run.dialog.kind;
    run.dialog = null;
    if (kind === 'opening') {
      run.mode = 'map';
      events.push({ type: 'storyDone', chapter: run.chapter });
    } else if (kind === 'closing') {
      completeChapter(run, events);
    }
  }
}

function completeChapter(run, events) {
  run.stats.chaptersCleared = run.chapter;
  if (chapterDef(run.chapter).boss) run.stats.bossDefeated += 1;
  events.push({ type: 'chapterClear', chapter: run.chapter });
  if (run.chapter >= CHAPTERS.length) {
    run.phase = 'victory';
    run.mode = 'chapterEnd';
    events.push({ type: 'taleComplete', chapters: run.chapter });
    return;
  }
  run.chapter += 1;
  setupChapter(run);
  events.push({ type: 'chapterStart', chapter: run.chapter, scene: run.scene });
}

// ---------------------------------------------------------------------------
// 战斗步进
// ---------------------------------------------------------------------------

function startBattle(run, events) {
  const def = chapterDef(run.chapter);
  run.stats.battlesFought += 1;
  run.battle = createBattle({ chapter: def, party: run.party, inventory: run.inventory, rng: run.rng });
  run.mode = 'battle';
  for (const ev of battleStartEvents(run.battle)) events.push(ev);
}

function stepBattleMode(run, input, events) {
  if (input.menu && run.battle.pending && !run.pendingCommand) {
    run.pendingCommand = input.menu;
  }
  const command = run.pendingCommand;
  run.pendingCommand = null;
  const evs = stepBattle(run.battle, STEP, command);
  for (const ev of evs) events.push(ev);

  if (run.battle.over) {
    const won = run.battle.victory;
    if (won) {
      run.stats.battlesWon += 1;
      // 回写血量/蓝量（幸存者）
      for (const u of run.battle.units) {
        if (u.side === 'player') {
          run.party[u.id].hp = u.hp;
          run.party[u.id].mp = u.mp;
        }
      }
      applyPostBattle(run.party, true);
      // 战后成长（成长钩子）：每战 +6 上限，封顶
      for (const id of ['hero', 'fox']) {
        run.party[id].bonusHp = Math.min(POST_BATTLE.growthCap, (run.party[id].bonusHp || 0) + POST_BATTLE.growthMaxHp);
        run.party[id].hp = Math.min(HEROES[id].hp + run.party[id].bonusHp, run.party[id].hp + Math.round(HEROES[id].hp * POST_BATTLE.healHpRatio));
      }
      run.battle = null;
      openDialog(run, 'closing');
    } else {
      run.phase = 'dead';
      run.mode = 'chapterEnd';
      events.push({ type: 'gameOver', chapter: run.chapter });
    }
  }
}

// ---------------------------------------------------------------------------
// 主步进
// ---------------------------------------------------------------------------

function stepRun(run, input) {
  input = input || {};
  run.time += STEP;
  const events = run.events;

  if (run.phase !== 'playing') return;

  switch (run.mode) {
    case 'map': stepMap(run, input, events); break;
    case 'dialog': stepDialog(run, input, events); break;
    case 'battle': stepBattleMode(run, input, events); break;
    default: break;
  }

  // 细粒度里程碑：任何模式都保证事件间隔不超 ~0.6s（遥测 maxEventGap）
  run.milestoneTimer += STEP;
  if (run.milestoneTimer >= MILESTONE_EVERY) {
    run.milestoneTimer = 0;
    events.push({ type: 'milestone', chapter: run.chapter, mode: run.mode });
  }
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

// ---------------------------------------------------------------------------
// HUD 快照（渲染/UI 消费）
// ---------------------------------------------------------------------------

function getHud(run) {
  const battle = run.battle;
  return {
    mode: run.mode,
    chapter: run.chapter,
    scene: run.scene,
    party: {
      hero: { hp: run.party.hero.hp, maxHp: HEROES.hero.hp + (run.party.hero.bonusHp || 0), mp: run.party.hero.mp, maxMp: HEROES.hero.mp },
      fox: { hp: run.party.fox.hp, maxHp: HEROES.fox.hp + (run.party.fox.bonusHp || 0), mp: run.party.fox.mp, maxMp: HEROES.fox.mp },
    },
    inventory: { ...run.inventory },
    battle: battle ? {
      activeHero: battle.activeHero,
      pending: battle.pending,
      foxGuard: battle.foxGuard,
      foxCooldown: battle.foxCooldown,
      units: battle.units.map((u) => ({
        id: u.id, side: u.side, nameKey: u.nameKey, element: u.element,
        hp: u.hp, maxHp: u.maxHp, mp: u.mp, maxMp: u.maxMp, alive: u.alive,
        atb: u.atb, defend: u.defend, swordIntent: u.swordIntent, boss: !!u.boss,
      })),
    } : null,
    dialog: run.dialog ? { line: run.dialog.lines[run.dialog.idx], idx: run.dialog.idx, total: run.dialog.lines.length } : null,
    stats: { ...run.stats },
  };
}

export const _internals = { clamp, dialogLinesFor, freshParty };

export { getHud, chapterDef };
