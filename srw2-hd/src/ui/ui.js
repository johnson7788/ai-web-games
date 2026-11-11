/**
 * src/ui/ui.js — DOM 界面：HUD、侧栏、战况、对话、结算（i18n）
 */

import { SPIRITS, unitName } from "../../config/data.js";
import { drawPortrait } from "../render/renderer.js";
import { t, i18n, objectiveText } from "../core/i18n.js";

const $ = (sel, root = document) => root.querySelector(sel);

export function createUI(app) {
  const el = {
    turn: $("#turnNum"),
    phase: $("#phaseTag"),
    objective: $("#objective"),
    hint: $("#hint"),
    keys: $("#bar .keys"),
    card: $("#unitCard"),
    side: $("#side"),
    log: $("#log"),
    sideKicker: $("#sideKicker"),
    sidePhase: $("#sidePhase"),
    title: $("#titleScreen"),
    chapterLabel: $(".hud-left .chapter"),
    hudTitle: $("#hud-title"),
    titleChapter: $(".title-chapter"),
    titleKicker: $(".title-kicker"),
    titleDesc: $(".title-desc"),
    titleFoot: $(".title-foot"),
    btnStart: $("#btnStart"),
    btnContinue: $("#btnContinue"),
    btnHelp: $("#btnHelp"),
    btnHelpClose: $("#btnHelpClose"),
    btnEndTurn: $("#btnEndTurn"),
    btnSave: $("#btnSave"),
    btnLang: $("#btnLang"),
    btnNext: $("#btnNext"),
    btnAgain: $("#btnAgain"),
    btnBackTitle: $("#btnBackTitle"),
    dialogue: $("#dialogue"),
    dlgName: $("#dlgName"),
    dlgText: $("#dlgText"),
    dlgPortrait: $("#dlgPortrait"),
    dlgNext: $(".dlg-next"),
    dlgSkip: $("#dlgSkip"),
    result: $("#result"),
    resultKicker: $("#resultKicker"),
    resultTitle: $("#resultTitle"),
    resultStats: $("#resultStats"),
    help: $("#help"),
    helpTitle: $(".help-card h2"),
    helpCols: document.querySelectorAll(".help-grid > div"),
    toast: $("#toast")
  };

  let toastTimer = null;
  let dialogue = null;

  /* ------------------------------------------------------------ 章节 */

  function renderChapter() {
    const sc = app.currentScenario ? app.currentScenario() : null;
    if (!sc) return;
    const chapterText = t("chapter", { n: sc.chapter });
    if (el.chapterLabel) el.chapterLabel.textContent = chapterText;
    const title = i18n.lang === "en" ? (sc.titleEn || sc.title) : sc.title;
    if (el.hudTitle) el.hudTitle.textContent = title;
    if (el.titleChapter) el.titleChapter.innerHTML = `${chapterText} <b>${title}</b>`;
    document.title = `${chapterText} ${title} · ${t("gameTitle")}`;
  }

  /* ------------------------------------------------------------- HUD */

  function renderHud() {
    const b = app.battle;
    if (!b) return;
    el.turn.textContent = String(b.turn).padStart(2, "0");
    const playerPhase = b.phase === "player";
    el.phase.textContent = playerPhase ? t("playerPhase") : t("enemyPhase");
    el.phase.classList.toggle("enemy", !playerPhase);
    el.objective.textContent = objectiveText(b.scenario, "victory");
    el.hint.textContent = app.hintText();
    el.btnEndTurn.innerHTML = `${t("endTurn")} <kbd>E</kbd>`;
    el.btnSave.textContent = t("save");
    if (el.btnLang) el.btnLang.textContent = t("langButton");
    if (el.keys) el.keys.innerHTML = t("helpKeys");
  }

  /* ------------------------------------------------------------ 侧栏 */

  function typeLabel(type) {
    if (type === "air") return t("typeAir");
    if (type === "sea") return t("typeSea");
    return t("typeLand");
  }

  function unitCard(unit) {
    const pct = Math.round((unit.hp / unit.maxHp) * 100);
    const spPct = unit.maxSp ? Math.round((unit.sp / unit.maxSp) * 100) : 0;
    const weaponRows = unit.weapons.map((w) => `
      <div class="weapon">
        <span class="w-name">${w.name}</span>
        <span class="w-num">${t("weaponRange", { n: w.range })}</span>
        <span class="w-num">${t("weaponHit", { n: w.hit })}</span>
        <span class="w-num w-atk">${w.atk}</span>
      </div>`).join("");
    const tags = [
      `<span class="u-tag">${typeLabel(unit.type)}</span>`,
      `<span class="u-tag">${t("moveLabel", { n: unit.move })}</span>`,
      unit.boss ? `<span class="u-tag boss">${t("tagBoss")}</span>` : "",
      unit.side === "enemy" ? `<span class="u-tag enemy">${t("tagEnemy")}</span>` : "",
      unit.side === "npc" ? `<span class="u-tag npc">${t("tagNpc")}</span>` : "",
      unit.repair ? `<span class="u-tag">${t("tagRepair")}</span>` : "",
      unit.protected ? `<span class="u-tag">${t("tagProtected")}</span>` : ""
    ].join("");

    return `
      <div class="u-top">
        <div class="u-portrait"><canvas data-portrait="${unit.sprite}"></canvas></div>
        <div style="min-width:0">
          <div class="u-name">${unit.name}</div>
          <div class="u-pilot">${unit.pilot || "—"} · Lv.${unit.level}</div>
          <div class="u-tags">${tags}</div>
        </div>
      </div>
      <div class="bars">
        <div class="bar-row"><span class="bar-label">HP</span>
          <span class="bar hp ${pct <= 30 ? "low" : ""}"><i style="width:${pct}%"></i></span>
          <span class="bar-val">${unit.hp} / ${unit.maxHp}</span></div>
        <div class="bar-row"><span class="bar-label">SP</span>
          <span class="bar sp"><i style="width:${spPct}%"></i></span>
          <span class="bar-val">${unit.sp} / ${unit.maxSp}</span></div>
      </div>
      <div class="stats">
        <div class="stat"><b>${unit.power}</b><span>${t("statPower")}</span></div>
        <div class="stat"><b>${unit.armor}</b><span>${t("statArmor")}</span></div>
        <div class="stat"><b>${unit.speed}</b><span>${t("statSpeed")}</span></div>
        <div class="stat"><b>${unit.level}</b><span>${t("statLevel")}</span></div>
      </div>
      <div class="weapon-list">${weaponRows}</div>`;
  }

  function actionBlock() {
    const list = app.actionTargets();
    if (!list) return "";
    const rows = [];
    list.forEach((entry) => {
      entry.weapons.forEach(({ w, i }) => {
        const preview = app.preview(entry.unit, w);
        rows.push(`
          <div class="weapon selectable" data-attack="${entry.unit.id}" data-weapon="${i}">
            <span class="w-name">${w.name} → ${entry.unit.name}</span>
            <span class="w-num">${t("weaponHit", { n: preview.hit })}</span>
            <span class="w-num">${t("weaponDmg", { n: preview.dmg })}</span>
            <span class="w-num w-atk">${preview.double ? t("doubleAttack") : t("weaponRange", { n: w.range })}</span>
          </div>`);
      });
    });
    (app.repairTargets() || []).forEach((u) => {
      const sel = app.selected();
      rows.push(`
        <div class="weapon selectable" data-repair="${u.id}">
          <span class="w-name">${t("repairAction")} → ${u.name}</span>
          <span class="w-num">+${sel && sel.repair ? sel.repair.amount : 0}</span>
          <span class="w-num">HP ${u.hp}/${u.maxHp}</span>
          <span class="w-num w-atk">${t("supportTag")}</span>
        </div>`);
    });
    rows.push(`
      <div class="weapon selectable standby" data-standby="1">
        <span class="w-name">${t("standby")}</span>
        <span class="w-num" style="color:#7286a6">${t("standbyHint")}</span>
        <span class="w-num w-atk">SPACE</span>
      </div>`);
    return `<div class="weapon-list">${rows.join("")}</div>`;
  }

  function spiritBlock(unit) {
    if (!unit.spirits || !unit.spirits.length) return "";
    const chips = unit.spirits.map((id) => {
      const s = SPIRITS[id];
      if (!s) return "";
      const disabled = unit.sp >= s.cost ? "" : " disabled";
      return `<button class="spirit${disabled}" data-spirit="${id}" title="${s.desc}" type="button">${s.name}<b>${s.cost}</b></button>`;
    }).join("");
    return `<div class="spirit-list">${chips}</div>`;
  }

  function renderSide() {
    const b = app.battle;
    if (!b) return;
    const unit = app.inspectUnit();
    el.sideKicker.textContent = unit
      ? (unit.side === "player" ? t("kickerPlayer") : unit.side === "npc" ? t("kickerNpc") : t("kickerEnemy"))
      : t("kickerNone");
    el.sidePhase.textContent = app.modeLabel();

    if (!unit) {
      el.card.className = "unit-card empty";
      el.card.innerHTML = `<div class="unit-empty">${app.sideEmptyText()}</div>`;
      bindCard();
      return;
    }

    el.card.className = "unit-card";
    const actionHtml = app.mode === "action" ? actionBlock() : "";
    const spiritHtml = unit.side === "player" && !unit.npc && unit.hp > 0 ? spiritBlock(unit) : "";
    el.card.innerHTML = unitCard(unit) + actionHtml + spiritHtml;
    el.card.querySelectorAll("canvas[data-portrait]").forEach((cv) => {
      drawPortrait(cv, cv.dataset.portrait);
    });
    bindCard();
  }

  function bindCard() {
    el.card.querySelectorAll("[data-attack]").forEach((node) => {
      node.addEventListener("click", () => app.attack(node.dataset.attack, Number(node.dataset.weapon)));
    });
    el.card.querySelectorAll("[data-repair]").forEach((node) => {
      node.addEventListener("click", () => app.repair(node.dataset.repair));
    });
    el.card.querySelectorAll("[data-standby]").forEach((node) => {
      node.addEventListener("click", () => app.standby());
    });
    el.card.querySelectorAll("[data-spirit]").forEach((node) => {
      node.addEventListener("click", () => {
        if (node.classList.contains("disabled")) return;
        app.useSpirit(node.dataset.spirit);
      });
    });
  }

  function logText(entry) {
    if (!entry.key) return entry.text || "";
    const vars = { ...(entry.vars || {}) };
    for (const k of ["a", "d", "u"]) {
      if (vars[k]) vars[k] = unitName(vars[k], i18n.lang);
    }
    if (entry.key === "logStart" && i18n.lang === "en" && app.battle) {
      vars.title = app.battle.scenario.titleEn || vars.title;
    }
    return t(entry.key, vars);
  }

  function renderLog() {
    const b = app.battle;
    if (!b) return;
    el.log.innerHTML = b.log.slice(-14).map((entry) =>
      `<li class="${entry.kind || ""}">${logText(entry)}</li>`
    ).join("");
  }

  function renderAll() {
    renderHud();
    renderSide();
    renderLog();
  }

  /* ------------------------------------------------------------ 对话 */

  function playDialogue(lines, onDone) {
    if (!lines || !lines.length) {
      if (onDone) onDone();
      return;
    }
    dialogue = { lines, index: 0, onDone, typing: false, timer: null };
    el.dialogue.hidden = false;
    showLine();
    el.dialogue.onclick = advanceDialogue;
    if (el.dlgNext) el.dlgNext.innerHTML = `${t("clickContinue")} <span>▸</span>`;
    if (el.dlgSkip) el.dlgSkip.textContent = t("skip");
  }

  function showLine() {
    const line = dialogue.lines[dialogue.index];
    el.dlgName.textContent = line.who;
    el.dlgText.textContent = "";
    if (line.portrait) {
      el.dlgPortrait.innerHTML = `<img src="${line.portrait}" alt="" />`;
    } else {
      el.dlgPortrait.innerHTML = `<canvas></canvas>`;
      drawPortrait(el.dlgPortrait.querySelector("canvas"), line.sprite);
    }
    let i = 0;
    dialogue.typing = true;
    clearInterval(dialogue.timer);
    dialogue.timer = setInterval(() => {
      i += 1;
      el.dlgText.textContent = line.text.slice(0, i);
      if (i >= line.text.length) {
        clearInterval(dialogue.timer);
        dialogue.typing = false;
      }
    }, 18);
  }

  function advanceDialogue() {
    if (!dialogue) return;
    if (dialogue.typing) {
      clearInterval(dialogue.timer);
      dialogue.typing = false;
      el.dlgText.textContent = dialogue.lines[dialogue.index].text;
      return;
    }
    dialogue.index += 1;
    if (dialogue.index >= dialogue.lines.length) {
      el.dialogue.hidden = true;
      el.dialogue.onclick = null;
      const done = dialogue.onDone;
      dialogue = null;
      if (done) done();
      return;
    }
    showLine();
  }

  function skipDialogue() {
    if (!dialogue) return;
    clearInterval(dialogue.timer);
    el.dialogue.hidden = true;
    el.dialogue.onclick = null;
    const done = dialogue.onDone;
    dialogue = null;
    if (done) done();
  }

  if (el.dlgSkip) {
    el.dlgSkip.addEventListener("click", (e) => {
      e.stopPropagation();
      skipDialogue();
    });
  }

  function isDialogueOpen() {
    return !!dialogue;
  }

  /* ------------------------------------------------------------ 结算 */

  function showResult(kind, stats, handlers) {
    el.result.hidden = false;
    el.resultKicker.textContent = kind === "victory" ? t("victoryTitle") : t("defeatTitle");
    el.resultTitle.textContent = kind === "victory"
      ? t("resultVictory", { n: stats.chapter || 1 })
      : t("resultDefeat");
    const cells = [
      `<li><b>${stats.turns || 0}</b>${t("statsTurns")}</li>`,
      `<li><b>${stats.kills || 0}</b>${t("statsKills")}</li>`,
      `<li><b>${stats.damageDealt || 0}</b>${t("statsDealt")}</li>`,
      `<li><b>${stats.damageTaken || 0}</b>${t("statsTaken")}</li>`
    ];
    if (stats.escaped) cells.push(`<li><b>${stats.escaped}</b>${t("statsEscaped")}</li>`);
    if (stats.join && stats.join !== "—") cells.push(`<li style="grid-column:1/-1"><b>${stats.join}</b>${t("joinUnits")}</li>`);
    el.resultStats.innerHTML = cells.join("");
    el.btnAgain.onclick = () => { el.result.hidden = true; handlers.again(); };
    el.btnBackTitle.onclick = () => { el.result.hidden = true; handlers.title(); };
    el.btnAgain.textContent = t("retry");
    el.btnBackTitle.textContent = t("backToTitle");
    if (el.btnNext) {
      el.btnNext.hidden = !handlers.next || handlers.isLast;
      el.btnNext.textContent = t("nextChapter");
      el.btnNext.onclick = () => { el.result.hidden = true; handlers.next(); };
    }
  }

  function hideResult() {
    el.result.hidden = true;
  }

  function renderTitle(hasSave) {
    el.btnContinue.hidden = !hasSave;
    el.btnStart.textContent = t("start");
    el.btnContinue.textContent = t("continueBtn");
    if (el.titleKicker) el.titleKicker.textContent = t("gameSub");
    if (el.titleDesc) el.titleDesc.innerHTML = t("tagline");
    if (el.titleFoot) el.titleFoot.textContent = t("titleFooter");
    if (el.btnHelp) el.btnHelp.title = t("help");
    renderHelp();
  }

  function renderHelp() {
    if (!el.help) return;
    if (el.helpTitle) el.helpTitle.textContent = t("helpTitle");
    if (el.helpCols && el.helpCols.length >= 3) {
      el.helpCols[0].innerHTML = `<h3>${t("helpOpsTitle")}</h3><p>${t("helpOps")}</p>`;
      el.helpCols[1].innerHTML = `<h3>${t("helpRulesTitle")}</h3><p>${t("helpRules")}</p>`;
      el.helpCols[2].innerHTML = `<h3>${t("helpSpiritsTitle")}</h3><p>${t("helpSpirits")}</p>`;
    }
    if (el.btnHelpClose) el.btnHelpClose.textContent = t("close");
  }

  function showHelp(show) {
    el.help.hidden = !show;
  }

  function hideTitle() {
    el.title.hidden = true;
  }

  function showTitle(show) {
    el.title.hidden = !show;
  }

  function toast(message) {
    el.toast.textContent = message;
    el.toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.toast.classList.remove("show"), 2000);
  }

  i18n.onChange(() => {
    renderAll();
    renderChapter();
    renderTitle(!el.btnContinue.hidden);
  });

  return {
    el,
    showTitle,
    hideTitle,
    renderTitle,
    renderAll,
    renderHud,
    renderSide,
    renderLog,
    renderChapter,
    toast,
    playDialogue,
    advanceDialogue,
    skipDialogue,
    isDialogueOpen,
    showResult,
    hideResult,
    showHelp
  };
}
