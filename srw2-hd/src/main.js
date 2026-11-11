/**
 * src/main.js — 装配：输入、动画、回合流转、相机、存档、音频、i18n
 */

import { GRID, SPIRITS, SPRITES } from "../config/data.js";
import { SCENARIOS } from "../config/scenarios.js";
import * as E from "./game/engine.js";
import { buildTerrainLayer, drawScene, hdMapReady, spriteImageSrc } from "./render/renderer.js";
import { createUI } from "./ui/ui.js";
import { t, i18n, objectiveText } from "./core/i18n.js";
import { createAudio } from "./core/audio.js";
import { initSDK } from "./core/sdk.js";
import { chapterScript } from "./game/script.js";
import { weaponAnim } from "./render/combat-anim.js";
import { playSkeletalCombat } from "./render/skeletal.js";
import { SIDE_KEYS } from "../config/sprites-generated.js";
import { UNIT_PARTS } from "../config/unit-parts.js";

const T = GRID.tile;

const VIEW_COLS = 16;
const VIEW_ROWS = 11;
const SAVE_KEY = "srw2hd.save.v1";

const canvas = document.getElementById("map");
const stage = document.getElementById("stage");
const ctx = canvas.getContext("2d");
const dpr = Math.min(2, window.devicePixelRatio || 1);
canvas.width = VIEW_COLS * T * dpr;
canvas.height = VIEW_ROWS * T * dpr;
canvas.style.width = `${VIEW_COLS * T}px`;
canvas.style.height = `${VIEW_ROWS * T}px`;
ctx.scale(dpr, dpr);
ctx.imageSmoothingEnabled = true;

const app = {
  scenarios: SCENARIOS,
  battle: null,
  terrain: null,
  mode: "title",          // title | battle | move | action | anim | result
  selectedId: null,
  hover: { x: 0, y: 0 },
  hoverUnitId: null,
  moveSet: null,
  actionList: null,
  repairList: null,
  moveOrigin: null,       // 取消移动时回退
  effects: [],
  anim: null,
  shake: 0,
  locked: true,
  scenarioIndex: 0,
  cam: { x: 0, y: 0 },
  hdApplied: false
};

const ui = createUI(app);
const audio = createAudio();
const sdk = initSDK();

/* ------------------------------------------------------------ 视图缩放 */

function fitStage() {
  const scale = Math.min(window.innerWidth / 1280, window.innerHeight / 760);
  stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
}
window.addEventListener("resize", fitStage);
fitStage();

/* ------------------------------------------------------------ 查询接口 */

app.selected = () => app.battle?.units.find((u) => u.id === app.selectedId && u.alive) || null;

app.inspectUnit = () => {
  const sel = app.selected();
  if (sel) return sel;
  if (app.hoverUnitId) {
    const u = app.battle?.units.find((x) => x.id === app.hoverUnitId);
    if (u && u.alive) return u;
  }
  return null;
};

app.modeLabel = () => ({
  title: t("modeTitle"),
  battle: t("modeBattle"),
  move: t("modeMove"),
  action: t("modeAction"),
  anim: t("modeAnim")
}[app.mode] || "SELECT");

app.sideEmptyText = () => (app.battle?.phase === "enemy" ? t("emptyEnemyPhase") : t("emptySelect"));

app.hintText = () => {
  if (app.mode === "move") return t("hintMove");
  if (app.mode === "action") return t("hintAction");
  if (app.mode === "anim") return t("hintAnim");
  return t("hintBattle");
};

app.actionTargets = () => app.actionList;
app.repairTargets = () => app.repairList;

app.preview = (target, weapon) => {
  const sel = app.selected();
  return E.damagePreview(app.battle, sel, target, weapon);
};

app.currentScenario = () => SCENARIOS[Math.min(app.scenarioIndex, SCENARIOS.length - 1)] || SCENARIOS[0];
app.escapeMode = () => {
  const v = app.battle?.scenario.objective?.victory;
  return v && v.type === "escape" ? v : null;
};

/* ------------------------------------------------------------ 摄像头 */

function updateCamera(focus = app.selected()) {
  const b = app.battle;
  if (!b || !focus) return;
  const cols = b.cols;
  const rows = b.rows;
  let cx = focus.x - VIEW_COLS / 2 + 0.5;
  let cy = focus.y - VIEW_ROWS / 2 + 0.5;
  cx = Math.max(0, Math.min(cols - VIEW_COLS, cx));
  cy = Math.max(0, Math.min(rows - VIEW_ROWS, cy));
  if (cols <= VIEW_COLS) cx = (cols - VIEW_COLS) / 2;
  if (rows <= VIEW_ROWS) cy = (rows - VIEW_ROWS) / 2;
  app.cam.x = Math.round(cx);
  app.cam.y = Math.round(cy);
}

/* ------------------------------------------------------------ 战斗建立 */

function bootBattle(saveData) {
  const sc = app.currentScenario();
  app.battle = saveData ? E.deserialize(sc, saveData) : E.createBattle(sc);
  app.hdApplied = false;
  app.terrain = buildTerrainLayer(app.battle);
  const first = app.battle.units.find((u) => u.side === "player" && u.alive);
  if (first) {
    app.hover.x = first.x;
    app.hover.y = first.y;
  }
  updateCamera(first || null);
  app.mode = "battle";
  app.selectedId = null;
  app.moveSet = null;
  app.actionList = null;
  app.repairList = null;
  app.moveOrigin = null;
  app.locked = false;
  ui.renderAll();
  ui.renderChapter();
}

function startNew(index = 0) {
  if (typeof index !== "number" || !Number.isFinite(index)) index = 0;
  app.scenarioIndex = Math.max(0, Math.min(SCENARIOS.length - 1, index));
  ui.hideTitle();
  ui.hideResult();
  bootBattle(null);
  const sc = app.currentScenario();
  audio.play("story", sc.chapter);
  app.locked = true;
  playChapterScript(sc)
    .then(() => openBriefing(sc))
    .then(() => {
      app.locked = false;
      app.mode = "battle";
      audio.play("scenario", sc.chapter);
      ui.renderAll();
      sdk.track("stage_start", { stage: sc.chapter, title: sc.title });
    });
}

function continueGame() {
  const raw = localStorage.getItem(SAVE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    app.scenarioIndex = parsed.scenarioIndex || 0;
    ui.hideTitle();
    bootBattle(parsed.data);
    const sc = app.currentScenario();
    audio.play("scenario", sc.chapter);
    if (app.battle.turn > 1) ui.toast(t("saved") + " · T" + app.battle.turn);
    sdk.track("stage_resume", { stage: sc.chapter, turn: app.battle.turn });
  } catch (err) {
    console.error(err);
    ui.toast("存档损坏，开始新游戏");
    startNew(0);
  }
}

/* ------------------------------------------------------------ 剧情简报 */

function briefingLines(sc) {
  const zh = i18n.lang === "zh";
  const summary = zh ? sc.summary : (sc.summaryEn || sc.summary);
  const brief = zh ? sc.brief : (sc.briefEn || sc.brief);
  const lines = [];
  if (summary) lines.push({ who: zh ? "乔" : "Bright", sprite: "whitebase", text: summary });
  lines.push({
    who: zh ? "爱美神" : "Sayaka",
    sprite: "aphrodite",
    text: `${t("objectiveLabel", { text: objectiveText(sc, "victory") })}　${t("defeatLabel", { text: objectiveText(sc, "defeat") })}`
  });
  if (brief) lines.push({ who: zh ? "乔" : "Bright", sprite: "whitebase", text: brief });
  lines.push({
    who: zh ? "甲儿" : "Koji",
    sprite: "mazinger",
    text: sc.joinUnits && sc.joinUnits.length ? t("joinLine", { units: sc.join }) : t("joinNone")
  });
  return lines;
}

async function playChapterScript(sc) {
  const lines = await chapterScript(sc.chapter, i18n.lang);
  if (!lines.length) return;
  await openDialogue(lines);
}

function openBriefing(sc) {
  return new Promise((resolve) => {
    app.locked = true;
    ui.playDialogue(briefingLines(sc), () => {
      app.locked = false;
      resolve();
    });
  });
}

/* ------------------------------------------------------------ 动画工具 */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const center = (unit) => ({ x: unit.x * T + T / 2, y: unit.y * T + T / 2 });

function addFx(fx) {
  app.effects.push({ start: performance.now(), duration: 800, ...fx });
}

function animateMove(unit, fromX, fromY, toX, toY, dur = 380) {
  return new Promise((resolve) => {
    const start = performance.now();
    const step = (now) => {
      const t = Math.min(1, (now - start) / dur);
      // smoothstep：起步慢 → 中间快 → 停止慢
      const e = t * t * (3 - 2 * t);
      const bob = -Math.sin(Math.PI * t) * 4;
      app.anim = {
        unitId: unit.id,
        x: (fromX + (toX - fromX) * e) * T + T / 2,
        y: (fromY + (toY - fromY) * e) * T + T / 2 + bob
      };
      if (t < 1) requestAnimationFrame(step);
      else { app.anim = null; resolve(); }
    };
    requestAnimationFrame(step);
  });
}

const unitSteps = (a, b, c, d) => Math.abs(c - a) + Math.abs(d - b);
const moveDuration = (steps, fast = false) => Math.max(260, Math.min(fast ? 520 : 580, 280 + steps * 38));

const phaseBannerEl = document.getElementById("phaseBanner");
const phaseBannerMain = document.getElementById("phaseBannerMain");
const phaseBannerSub = document.getElementById("phaseBannerSub");
async function showPhaseBanner(main, sub, ms = 950) {
  if (!phaseBannerEl) return;
  phaseBannerMain.textContent = main;
  phaseBannerSub.textContent = sub;
  phaseBannerEl.hidden = false;
  void phaseBannerEl.offsetWidth;
  phaseBannerEl.classList.add("show");
  await sleep(ms);
  phaseBannerEl.classList.remove("show");
  await sleep(180);
  phaseBannerEl.hidden = true;
}

function shake(mag = 6, dur = 240) {
  const until = performance.now() + dur;
  const tick = () => {
    if (performance.now() > until) { app.shake = 0; return; }
    app.shake = mag * (Math.random() * 2 - 1);
    requestAnimationFrame(tick);
  };
  tick();
}

function playStrike(ev) {
  const b = app.battle;
  const from = b.units.find((u) => u.id === ev.from);
  const to = b.units.find((u) => u.id === ev.to);
  if (!from || !to) return;
  const a = center(from);
  const d = center(to);
  if (ev.hit) {
    if (ev.kind === "beam" || ev.kind === "gun") {
      addFx({ kind: "beam", x1: a.x, y1: a.y, x2: d.x, y2: d.y, duration: 260, color: "rgba(120, 220, 255, 0.95)" });
    } else {
      addFx({ kind: "slash", x: d.x, y: d.y, duration: 300 });
    }
    setTimeout(() => {
      addFx({ kind: "impact", x: d.x, y: d.y, duration: 380 });
      addFx({ kind: "explosion", x: d.x, y: d.y, duration: 520, big: ev.killed });
      if (ev.damage > 0) addFx({ kind: "damage", x: d.x, y: d.y - 8, text: `-${ev.damage}`, duration: 1000 });
      shake(ev.killed ? 8 : 4, 220);
      if (ev.killed) addFx({ kind: "explosion", x: d.x, y: d.y, duration: 900 });
    }, 210);
  } else {
    addFx({ kind: "damage", x: d.x, y: d.y - 8, text: "MISS", duration: 900 });
  }
}

/* -------------------------------------------------------- 战斗演出 */

const cutinEl = {
  root: document.getElementById("cutin"),
  a: document.getElementById("cutinA"),
  b: document.getElementById("cutinB"),
  na: document.getElementById("cutinNA"),
  nb: document.getElementById("cutinNB"),
  flash: document.getElementById("cutinFlash"),
  dmg: document.getElementById("cutinDmg"),
  fx: document.getElementById("cutinFx"),
  move: document.getElementById("cutinMove")
};

function spriteSideSrc(sprite) {
  return SIDE_KEYS.includes(sprite) ? `assets/hd/units-side/${sprite}.webp` : spriteImageSrc(sprite);
}

async function showCutin(attacker, defender, ev, fast = false, weapon = null) {
  const quick = fast === "quick";
  if (!cutinEl.root || !attacker || !defender) return;
  const w = weapon
    || (ev && ev.weapon ? (attacker.weapons || []).find((x) => x.name === ev.weapon) : null)
    || { name: (ev && ev.weapon) || "攻击", kind: (ev && ev.kind) || "melee" };
  const anim = weaponAnim(w);
  const bgEl = document.querySelector(".cutin-bg");
  if (bgEl && app.battle) {
    const ai = new URLSearchParams(location.search).get("maps") === "ai";
    const ch = String(app.battle.scenario.chapter).padStart(2, "0");
    bgEl.src = `assets/hd/${ai ? "maps-ai" : "maps"}/s${ch}.webp`;
  }
  cutinEl.a.src = spriteSideSrc(attacker.sprite);
  cutinEl.b.src = spriteSideSrc(defender.sprite);
  cutinEl.na.textContent = `${attacker.name} · ${attacker.pilot || "—"}`;
  cutinEl.nb.textContent = `${defender.name} · ${defender.pilot || "—"}`;
  cutinEl.dmg.className = "cutin-dmg";
  cutinEl.dmg.textContent = "";
  cutinEl.b.style.filter = "";
  if (cutinEl.move) cutinEl.move.textContent = `${anim.label} · ${w.name}`;
  cutinEl.root.classList.remove("attacking", "rush", "aim", "recoil", "fx-hit");
  cutinEl.root.hidden = false;
  void cutinEl.root.offsetWidth;
  cutinEl.root.classList.add("show");
  const bossFight = !!(attacker.boss || defender.boss);
  const ch = app.battle ? app.battle.scenario.chapter : 1;
  if (bossFight) audio.play("boss", ch);
  audio.duck(true);

  await sleep(quick ? 90 : fast ? 200 : 320);
  cutinEl.root.classList.add("attacking");
  cutinEl.a.style.opacity = "0";
  try {
    await playSkeletalCombat(cutinEl.fx, {
      attackerEl: cutinEl.a,
      defenderEl: cutinEl.b,
      anim,
      palette: SPRITES[attacker.sprite] || {},
      shape: (SPRITES[attacker.sprite] || {}).shape || "mech",
      parts: UNIT_PARTS[attacker.sprite] || null,
      fast: fast === true,
      quick,
      hit: ev ? !!ev.hit : true,
      onEvent: (type) => {
        if (type !== "impact") return;
        if (ev && ev.hit) {
          cutinEl.flash.classList.remove("on");
          void cutinEl.flash.offsetWidth;
          cutinEl.flash.classList.add("on");
          cutinEl.dmg.textContent = ev.damage > 0 ? `-${ev.damage}` : "GUARD";
          if (ev.killed) cutinEl.b.style.filter = "grayscale(1) brightness(1.45)";
          if (ev.damage === 0) cutinEl.dmg.classList.add("miss");
          cutinEl.dmg.classList.add("on");
          cutinEl.root.classList.add("fx-hit");
        } else if (ev) {
          cutinEl.root.classList.add("dodge");
          cutinEl.dmg.textContent = t("dodge");
          cutinEl.dmg.classList.add("miss", "on");
        }
      }
    });
  } finally {
    cutinEl.a.style.opacity = "";
  }

  cutinEl.root.classList.remove("attacking");
  await sleep(fast ? 120 : 180);
  cutinEl.root.classList.remove("rush", "aim", "charge", "dodge");
  await sleep(fast ? 120 : 240);
  cutinEl.root.classList.remove("fx-hit");
  cutinEl.root.classList.remove("show");
  await sleep(fast ? 160 : 240);
  cutinEl.root.hidden = true;
  if (cutinEl.fx) {
    const ctx = cutinEl.fx.getContext("2d");
    if (ctx) ctx.clearRect(0, 0, cutinEl.fx.width, cutinEl.fx.height);
  }
  audio.duck(false);
  if (bossFight) {
    audio.play(app.battle && app.battle.phase === "enemy" ? "battle" : "scenario", ch);
  }
}

/* ------------------------------------------------------------ 对话 */

function openDialogue(lines) {
  return new Promise((resolve) => {
    app.locked = true;
    ui.playDialogue(lines, () => {
      app.locked = false;
      resolve();
    });
  });
}

/* ------------------------------------------------------------ 选择/移动 */

function canControl(unit) {
  return unit && unit.side === "player" && !unit.npc && unit.alive;
}

function selectUnit(unit) {
  if (app.locked || !app.battle || app.battle.phase !== "player") return;
  if (!canControl(unit)) {
    if (unit && unit.npc) ui.toast(t("npcControlled"));
    return;
  }
  if (unit.acted) {
    ui.toast(t("alreadyActed"));
    return;
  }
  app.selectedId = unit.id;
  app.mode = "move";
  app.actionList = null;
  app.repairList = null;
  app.moveOrigin = { x: unit.x, y: unit.y };
  app.hoverUnitId = null;
  const reach = E.moveRange(app.battle, unit);
  app.moveSet = new Set(reach.keys());
  updateCamera();
  ui.renderAll();
}

function clearSelection() {
  app.selectedId = null;
  app.mode = "battle";
  app.moveSet = null;
  app.actionList = null;
  app.repairList = null;
  app.moveOrigin = null;
}

function deselect() {
  const sel = app.selected();
  // 已移动但还没行动：撤销移动（防止无限移动）
  if (sel && app.moveOrigin && (sel.x !== app.moveOrigin.x || sel.y !== app.moveOrigin.y)) {
    sel.x = app.moveOrigin.x;
    sel.y = app.moveOrigin.y;
    sel.moved = false;
  }
  clearSelection();
  ui.renderAll();
}

function refreshActions() {
  const sel = app.selected();
  if (!sel) return;
  app.actionList = E.attackOptions(app.battle, sel);
  const repairs = [];
  if (sel.repair) {
    app.battle.units.forEach((u) => {
      if (u.side === sel.side && u.alive && !u.escaped && u.id !== sel.id && u.hp < u.maxHp) {
        if (E.dist(sel, u) <= sel.repair.range) repairs.push(u);
      }
    });
  }
  app.repairList = repairs;
}

async function doMove(sel, x, y) {
  const fromX = sel.x;
  const fromY = sel.y;
  app.mode = "anim";
  app.moveSet = null;
  app.locked = true;
  E.moveUnit(app.battle, sel, x, y);
  updateCamera();
  await animateMove(sel, fromX, fromY, x, y, moveDuration(unitSteps(fromX, fromY, x, y)));
  app.locked = false;
  refreshActions();
  // 即使射程内没有目标也进入 action 模式：可以「待机」或按 Esc 撤销移动
  app.mode = "action";
  ui.renderAll();
}

function finishAction() {
  const sel = app.selected();
  if (sel) {
    // 站在撤离点上：直接撤离
    if (sel.side === "player" && E.isExitTile(app.battle, sel.x, sel.y)) {
      E.removeUnit(app.battle, sel, "escape");
      ui.toast(t("escapedToast", { name: sel.name }));
    } else {
      sel.acted = true;
    }
  }
  app.locked = false;
  clearSelection();
  ui.renderAll();
  checkBattleEnd();
}

/* ------------------------------------------------------------ 攻击/修理 */

async function doAttack(targetId, weaponIndex) {
  if (app.locked) return;
  const sel = app.selected();
  const target = app.battle.units.find((u) => u.id === targetId);
  if (!sel || !target || !target.alive) return;
  const weapon = sel.weapons[weaponIndex];
  if (!weapon) return;
  if (!E.weaponCanHit(sel, weapon, target)) {
    ui.toast(t("outOfRange"));
    return;
  }

  app.locked = true;
  app.mode = "anim";
  ui.renderSide();
  const events = E.resolveAttack(app.battle, sel, target, weapon);
  const main = events.find((e) => e.type === "attack");
  try {
    await showCutin(sel, target, main, false, weapon);
    await sleep(120);
  } finally {
    app.locked = false;
    finishAction();
  }
}

async function doRepair(targetId) {
  const sel = app.selected();
  const target = app.battle.units.find((u) => u.id === targetId);
  if (!sel || !target || !sel.repair) return;
  if (E.dist(sel, target) > sel.repair.range) { ui.toast(t("outOfRange")); return; }
  app.locked = true;
  const ev = E.repairUnit(app.battle, sel, target);
  const p = center(target);
  if (ev) {
    addFx({ kind: "damage", x: p.x, y: p.y - 8, text: `+${ev.amount}`, duration: 1000, heal: true });
    await sleep(500);
  }
  app.locked = false;
  finishAction();
}

function useSpirit(id) {
  const sel = app.selected();
  if (!sel || app.locked) return;
  if (!E.canUseSpirit(sel, id)) {
    ui.toast(t("spiritNoSp"));
    return;
  }
  const opts = {};
  if (id === "friend" || id === "bond") {
    const allies = app.battle.units
      .filter((u) => u.side === sel.side && u.alive && u.hp < u.maxHp)
      .sort((a, b) => a.hp / a.maxHp - b.hp / b.maxHp);
    if (!allies.length) { ui.toast(t("noAlliesToHeal")); return; }
    opts.target = allies[0];
  }
  const before = sel.hp;
  E.useSpirit(app.battle, sel, id, opts);
  if (sel.hp > before) {
    const p = center(sel);
    addFx({ kind: "damage", x: p.x, y: p.y - 8, text: `+${sel.hp - before}`, duration: 900, heal: true });
  }
  const spirit = SPIRITS[id];
  // 加速/疾风会改变移动力：重算移动范围
  if (app.mode === "move" && app.selected()) {
    app.moveSet = new Set(E.moveRange(app.battle, sel).keys());
  }
  ui.toast(spirit ? spirit.name : id);
  ui.renderAll();
  checkBattleEnd();
}

/** 结束当前机体的行动（待机） */
function standby() {
  if (app.locked) return;
  finishAction();
}

/* 供侧栏按钮调用 */
app.attack = doAttack;
app.repair = doRepair;
app.useSpirit = useSpirit;
app.standby = standby;

/* ------------------------------------------------------------ 回合流转 */

async function endTurn() {
  if (app.locked) return;
  if (!app.battle || app.battle.phase !== "player") return;
  if (app.battle.winner) return;

  app.locked = true;
  app.mode = "anim";
  clearSelection();
  ui.renderAll();

  const events = E.endPlayerTurn(app.battle);
  await playEnemyEvents(events);

  app.mode = "battle";
  app.locked = false;
  ui.renderAll();
  await checkBattleEnd();
}

async function playEnemyEvents(events) {
  let enemyCutins = 0;
  // 引擎已经算完敌方阶段，单位状态都在终点；先把本阶段会移动的单位放回起点，
  // 再按事件逐个播放，避免“先闪现到终点、再跳回起点”的假移动。
  for (const ev of events) {
    if (ev.type !== "move") continue;
    const unit = app.battle.units.find((u) => u.id === ev.unit);
    if (unit) { unit.x = ev.fromX; unit.y = ev.fromY; }
  }
  for (const ev of events) {
    switch (ev.type) {
      case "phase": {
        // 此时引擎状态已经推进到下一阶段，HUD 需要按事件显示当前正在播放的阶段
        ui.el.turn.textContent = String(ev.turn).padStart(2, "0");
        const playerPhase = ev.phase === "player";
        ui.el.phase.textContent = playerPhase ? t("playerPhase") : t("enemyPhase");
        ui.el.phase.classList.toggle("enemy", !playerPhase);
        if (ev.phase === "enemy") {
          await showPhaseBanner(t("phasePlayerEnd", { n: ev.turn }), t("phaseEnemy", { n: ev.turn }));
          audio.play("battle", app.battle.scenario.chapter);
        } else if (ev.phase === "player") {
          await showPhaseBanner(t("phaseEnemyEnd", { n: Math.max(1, ev.turn - 1) }), t("phasePlayer", { n: ev.turn }));
          audio.play("scenario", app.battle.scenario.chapter);
        }
        break;
      }
      case "move": {
        const unit = app.battle.units.find((u) => u.id === ev.unit);
        if (unit) {
          app.hover.x = ev.x;
          app.hover.y = ev.y;
          // 敌方移动时把镜头跟到落点，否则会移出视口
          updateCamera({ x: (ev.fromX + ev.x) / 2, y: (ev.fromY + ev.y) / 2 });
          const steps = unitSteps(ev.fromX, ev.fromY, ev.x, ev.y);
          await animateMove(unit, ev.fromX, ev.fromY, ev.x, ev.y, moveDuration(steps, true));
          unit.x = ev.x; unit.y = ev.y;
          await sleep(80);
        }
        break;
      }
      case "attack": {
        const from = app.battle.units.find((u) => u.id === ev.from);
        const to = app.battle.units.find((u) => u.id === ev.to);
        const hostile = from && (from.side === "enemy" || from.side === "npc");
        // 每阶段最多 3 次敌方骨骼 cut-in（Boss/击坠仍强制演出），
        // 避免一回合十几个敌人连续 cut-in 把敌方阶段拖到几十秒。
        const useCutin = from && to && (from.boss || ev.killed || (hostile && enemyCutins < 3));
        if (useCutin) {
          await showCutin(from, to, ev, "quick");
          if (hostile) enemyCutins += 1;
        } else {
          if (to) updateCamera(center(to));
          playStrike(ev);
          await sleep(180);
        }
        break;
      }
      case "spawn": {
        const unit = app.battle.units.find((u) => u.id === ev.unit);
        if (unit) {
          const p = center(unit);
          addFx({ kind: "explosion", x: p.x, y: p.y, duration: 700 });
          addFx({ kind: "damage", x: p.x, y: p.y - 8, text: unit.side === "player" ? "REINFORCE" : "WAVE", duration: 900, heal: unit.side === "player" });
        }
        await sleep(240);
        break;
      }
      case "escape": {
        const unit = app.battle.units.find((u) => u.id === ev.unit);
        if (unit) ui.toast(t("escapedToast", { name: unit.name }));
        await sleep(200);
        break;
      }
      case "leave": {
        const unit = app.battle.units.find((u) => u.id === ev.unit);
        if (unit) ui.toast(unit.name);
        break;
      }
      case "retreat":
        ui.toast(t("retreatToast"));
        break;
      case "victory":
      case "defeat":
        break;
      default:
        break;
    }
  }
}

async function checkBattleEnd() {
  const b = app.battle;
  if (!b || !b.winner || app.mode === "result") return;
  app.mode = "result";
  app.locked = true;
  const sc = app.currentScenario();

  if (b.winner === "victory") {
    sdk.track("stage_clear", { stage: sc.chapter, turns: b.stats.turns, kills: b.stats.kills });
    await openDialogue([{ who: i18n.lang === "zh" ? "乔" : "Bright", sprite: "whitebase",
      text: i18n.lang === "zh" ? "敌军已全部消灭，作战成功。" : "All hostiles down. Mission complete." }]);
    const isLast = app.scenarioIndex >= SCENARIOS.length - 1;
    const next = isLast ? backToTitle : () => {
      app.scenarioIndex += 1;
      app.mode = "battle";
      ui.hideResult();
      bootBattle(null);
      const ns = app.currentScenario();
      audio.play("story", ns.chapter);
      playChapterScript(ns)
        .then(() => openBriefing(ns))
        .then(() => { app.mode = "battle"; app.locked = false; audio.play("scenario", ns.chapter); ui.renderAll(); sdk.track("stage_start", { stage: ns.chapter }); });
    };
    ui.showResult("victory", { ...b.stats, join: sc.join, chapter: sc.chapter, title: sc.title },
      { again: () => startNew(app.scenarioIndex), title: backToTitle, next, isLast });
  } else {
    sdk.track("stage_fail", { stage: sc.chapter, turns: b.stats.turns });
    await openDialogue([{ who: i18n.lang === "zh" ? "乔" : "Bright", sprite: "whitebase",
      text: i18n.lang === "zh" ? "……全灭了吗。撤退，重整旗鼓再来。" : "…We're wiped out. Withdraw and regroup." }]);
    ui.showResult("defeat", b.stats, { again: () => startNew(app.scenarioIndex), title: backToTitle });
  }
}

function backToTitle() {
  app.mode = "title";
  app.battle = null;
  app.terrain = null;
  app.selectedId = null;
  app.locked = true;
  ui.hideResult();
  ui.showTitle(true);
  audio.play("title", 1);
  ui.renderTitle(!!localStorage.getItem(SAVE_KEY));
  ui.renderChapter();
}

/* ------------------------------------------------------------ 输入 */

function tileFromEvent(e) {
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * VIEW_COLS) + app.cam.x;
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * VIEW_ROWS) + app.cam.y;
  if (!app.battle || x < 0 || y < 0 || x >= app.battle.cols || y >= app.battle.rows) return null;
  return { x, y };
}

// 机体立绘比格子高，点击头部/身体/脚下都要能选中
function unitFromEvent(e) {
  if (!app.battle) return null;
  const rect = canvas.getBoundingClientRect();
  const wx = ((e.clientX - rect.left) / rect.width) * VIEW_COLS * T + app.cam.x * T;
  const wy = ((e.clientY - rect.top) / rect.height) * VIEW_ROWS * T + app.cam.y * T;
  let best = null;
  let bestD = Infinity;
  for (const u of app.battle.units) {
    if (!u.alive || u.escaped) continue;
    const cx = u.x * T + T / 2;
    const feet = u.y * T + T / 2 + 18;
    const h = u.boss ? 70 : 62;
    const left = cx - T * 0.62;
    const right = cx + T * 0.62;
    const top = feet - h;
    const bottom = feet + 10;
    if (wx < left || wx > right || wy < top || wy > bottom) continue;
    const d = Math.abs(wx - cx) + Math.abs(wy - feet);
    if (d < bestD) { bestD = d; best = u; }
  }
  return best;
}

async function handleClick(x, y) {
  if (app.locked || ui.isDialogueOpen()) return;
  const b = app.battle;
  if (!b || b.phase !== "player" || b.winner) return;
  const unit = E.unitAt(b, x, y);

  if (app.mode === "battle") {
    if (unit && canControl(unit) && !unit.acted) selectUnit(unit);
    else if (unit) { app.hoverUnitId = unit.id; ui.renderSide(); }
    return;
  }

  if (app.mode === "move") {
    const sel = app.selected();
    if (!sel) { clearSelection(); return; }
    if (unit && unit.side === "player" && unit.id !== sel.id) {
      if (!unit.acted) selectUnit(unit);
      return;
    }
    if (unit && unit.id === sel.id) {
      refreshActions();
      if ((app.actionList && app.actionList.length) || (app.repairList && app.repairList.length) || E.isExitTile(b, sel.x, sel.y)) {
        app.mode = "action";
        app.moveSet = null;
        ui.renderAll();
      }
      return;
    }
    if (!app.moveSet || !app.moveSet.has(E.keyOf(x, y))) return;
    await doMove(sel, x, y);
    return;
  }

  if (app.mode === "action") {
    const sel = app.selected();
    if (!sel) { clearSelection(); return; }
    if (unit && unit.side === "enemy") {
      const entry = (app.actionList || []).find((a) => a.unit.id === unit.id);
      if (!entry) { ui.toast(t("outOfRange")); return; }
      const best = entry.weapons.slice().sort((a, c) => {
        const pa = app.preview(entry.unit, a.w);
        const pc = app.preview(entry.unit, c.w);
        return pc.dmg * pc.hit - pa.dmg * pa.hit;
      })[0];
      await doAttack(unit.id, best.i);
      return;
    }
    const repair = (app.repairList || []).find((u) => u.x === x && u.y === y);
    if (repair) { await doRepair(repair.id); return; }
    if (unit && unit.id === app.selectedId) { standby(); return; }
  }
}

canvas.addEventListener("mousemove", (e) => {
  const hit = unitFromEvent(e);
  const tile = hit ? { x: hit.x, y: hit.y } : tileFromEvent(e);
  if (!tile) return;
  const changed = tile.x !== app.hover.x || tile.y !== app.hover.y;
  app.hover = tile;
  const unit = hit || (app.battle ? E.unitAt(app.battle, tile.x, tile.y) : null);
  const hoverId = unit ? unit.id : null;
  if (changed || hoverId !== app.hoverUnitId) {
    app.hoverUnitId = hoverId;
    if (app.mode === "battle" || !app.selectedId) ui.renderSide();
  }
});

canvas.addEventListener("click", (e) => {
  const hit = unitFromEvent(e);
  const tile = hit ? { x: hit.x, y: hit.y } : tileFromEvent(e);
  if (tile) handleClick(tile.x, tile.y);
});

// 滚轮平移相机；不再让鼠标悬停自动带动地图
canvas.addEventListener("wheel", (e) => {
  if (!app.battle) return;
  e.preventDefault();
  const step = Math.sign(e.deltaY) || 0;
  if (e.shiftKey) {
    app.cam.x = Math.max(0, Math.min(app.battle.cols - VIEW_COLS, app.cam.x + step));
  } else {
    app.cam.y = Math.max(0, Math.min(app.battle.rows - VIEW_ROWS, app.cam.y + step));
  }
}, { passive: false });

window.addEventListener("keydown", (e) => {
  if (ui.isDialogueOpen()) {
    if (e.key === "Enter" || e.key === " ") { e.preventDefault(); ui.advanceDialogue(); }
    return;
  }
  if (app.locked) return;
  const k = e.key;
  if (!app.battle) return;
  if (k === "ArrowUp") { app.hover.y = Math.max(0, app.hover.y - 1); e.preventDefault(); }
  else if (k === "ArrowDown") { app.hover.y = Math.min(app.battle.rows - 1, app.hover.y + 1); e.preventDefault(); }
  else if (k === "ArrowLeft") { app.hover.x = Math.max(0, app.hover.x - 1); e.preventDefault(); }
  else if (k === "ArrowRight") { app.hover.x = Math.min(app.battle.cols - 1, app.hover.x + 1); e.preventDefault(); }
  else if (k === "Enter") { handleClick(app.hover.x, app.hover.y); }
  else if (k === "Escape") { if (app.selectedId) deselect(); }
  else if (k === "e" || k === "E") { endTurn(); }
  else if (k === " ") { if (app.mode === "action") standby(); }
});

/* ------------------------------------------------------------ 按钮 */

document.getElementById("btnStart").addEventListener("click", () => startNew(0));
document.getElementById("btnContinue").addEventListener("click", continueGame);
document.getElementById("btnEndTurn").addEventListener("click", endTurn);
document.getElementById("btnSave").addEventListener("click", () => {
  if (!app.battle || app.locked) return;
  if (app.battle.phase !== "player") return;
  localStorage.setItem(SAVE_KEY, JSON.stringify({ at: Date.now(), scenarioIndex: app.scenarioIndex, data: E.serialize(app.battle) }));
  ui.toast(t("saved"));
  ui.renderTitle(true);
  sdk.track("save", { stage: app.currentScenario().chapter, turn: app.battle.turn });
});
document.getElementById("btnMute").addEventListener("click", () => {
  const muted = audio.toggleMute();
  document.getElementById("btnMute").style.color = muted ? "#5f7598" : "";
  ui.toast(muted ? t("musicOff") : t("musicOn"));
});
document.getElementById("btnHelp").addEventListener("click", () => ui.showHelp(true));
document.getElementById("btnHelpClose").addEventListener("click", () => ui.showHelp(false));
document.getElementById("btnLang").addEventListener("click", () => {
  i18n.toggle();
  ui.renderAll();
  ui.renderChapter();
  ui.renderTitle(!!localStorage.getItem(SAVE_KEY));
});

/* ------------------------------------------------------------ 渲染循环 */

function frame(now) {
  if (app.battle && app.terrain) {
    if (!app.hdApplied && hdMapReady(app.battle)) {
      app.terrain = buildTerrainLayer(app.battle);
      app.hdApplied = true;
    }
    updateCamera();
    const attackSet = app.mode === "action" && app.actionList
      ? new Set(app.actionList.map((a) => E.keyOf(a.unit.x, a.unit.y)))
      : null;
    const view = {
      time: now,
      hover: app.mode === "move" || app.mode === "battle" ? app.hover : null,
      selectedId: app.selectedId,
      moveSet: app.moveSet,
      attackSet,
      effects: app.effects,
      anim: app.anim,
      cam: app.cam,
      escape: app.escapeMode()
    };
    ctx.save();
    if (app.shake) ctx.translate(app.shake, app.shake * 0.6);
    drawScene(ctx, app.battle, view, app.terrain);
    ctx.restore();
    if (app.effects.length) {
      app.effects = app.effects.filter((fx) => now - fx.start < fx.duration);
    }
  }
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

/* ------------------------------------------------------------ 调试接口 */

window.G = { app, ui, engine: E, audio };
window.__ll = {
  get state() { return app.battle; },
  start: (i = 0) => startNew(i),
  loadScenario: (i) => {
    app.scenarioIndex = Math.max(0, Math.min(SCENARIOS.length - 1, i));
    app.locked = true;
    bootBattle(null);
    app.locked = false;
    app.mode = "battle";
    ui.renderAll();
    const sc = app.currentScenario();
    audio.play("scenario", sc.chapter);
    return { cols: app.battle.cols, rows: app.battle.rows, units: app.battle.units.length };
  },
  scenarioCount: SCENARIOS.length,
  forceVictory: () => {
    if (!app.battle) return;
    app.battle.units.filter((u) => u.side === "enemy").forEach((u) => { u.alive = false; u.hp = 0; });
    app.battle.wavesDone = (app.battle.scenario.waves || []).map((_, i) => i);
    E.checkEnd(app.battle);
    checkBattleEnd();
  },
  endTurn,
  attack: doAttack,
  demoCutin: (weaponName = "光束步枪", kind = "beam", sprite = "", hit = true) => {
    if (!app.battle) return false;
    const p = app.battle.units.find((u) => u.side === "player" && u.alive && (!sprite || u.sprite === sprite))
      || app.battle.units.find((u) => u.side === "player" && u.alive);
    const e = app.battle.units.find((u) => u.side === "enemy" && u.alive);
    if (!p || !e) return false;
    showCutin(p, e, { hit: !!hit, damage: hit ? 123 : 0, weapon: weaponName, kind }, false, { name: weaponName, kind });
    return true;
  },
  standby,
  select: (id) => {
    const u = app.battle.units.find((x) => x.id === id);
    if (u) selectUnit(u);
  },
  getHud: () => ({
    turn: app.battle?.turn,
    phase: app.battle?.phase,
    mode: app.mode,
    units: app.battle?.units.filter((u) => u.alive && !u.escaped).length,
    winner: app.battle?.winner || null,
    chapter: app.currentScenario().chapter,
    lang: i18n.lang
  }),
  setLang: (l) => { i18n.setLang(l); ui.renderAll(); ui.renderChapter(); return i18n.lang; },
  objective: () => ({
    victory: objectiveText(app.currentScenario(), "victory"),
    defeat: objectiveText(app.currentScenario(), "defeat")
  })
};

sdk.track("load", {});
ui.renderTitle(!!localStorage.getItem(SAVE_KEY));
ui.renderChapter();
app.mode = "title";
