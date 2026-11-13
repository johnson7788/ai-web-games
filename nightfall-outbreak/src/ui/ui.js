// src/ui/ui.js — DOM/HUD 层：只负责显示与事件转发，不保存任何玩法状态。
// 所有玩家可见文案来自 config/locales.js；动态节点一律 textContent，禁止 innerHTML 拼接。
import { t, applyStatic } from "core/i18n.js";
import { GAME } from "config/game.config.js";
import { drawMinimap, PALETTE } from "art/theme.js";

const $ = (id) => document.getElementById(id);

const IDS = [
  "boot", "boot-fill", "boot-pct", "boot-tip",
  "hud", "hud-goal", "hud-bar-fill", "hud-coins", "hud-level", "hud-score",
  "hud-health", "hud-ammo", "hud-reserve", "hud-weapon", "hud-reload",
  "hud-combo", "hud-best", "wavechain", "minimap", "map-canvas", "health-ring",
  "ammo", "crosshair", "hitmark", "killfeed", "combo-chip", "bossbar", "bossbar-fill",
  "banner", "keybar", "keybar-move", "keybar-fire", "keybar-pause", "keybar-assist",
  "hint", "hint-text", "touch", "toast", "vignette",
  "menu-title", "modegrid", "levels-grid", "shop", "shop-coins", "shop-row", "store-coins", "store-row",
  "btn-sound", "btn-assist", "assist-badge", "assist-label",
  "btn-revive", "btn-double", "over-score", "over-best", "over-coins",
  "inv-medkit", "inv-ammo"
];

export class UI {
  constructor() {
    this.e = {};
    for (const id of IDS) this.e[id] = $(id);
    this.ov = {
      menu: $("ov-menu"), levels: $("ov-levels"), pause: $("ov-pause"),
      store: $("ov-store"), inv: $("ov-inv"), over: $("ov-over")
    };
    this.mapCtx = this.e["map-canvas"] ? this.e["map-canvas"].getContext("2d") : null;
    this._timers = { banner: 0, toast: 0, hit: 0, flash: 0 };

    applyStatic();
    // 静态节点里没挂 data-i18n 的几处，也统一走词条（默认英文）
    this.e["menu-title"].textContent = t("brand.name");
    this.e["keybar-move"].textContent = t("key.move");
    this.e["keybar-fire"].textContent = t("key.fire");
    this.e["keybar-pause"].textContent = t("key.pause");
    this.e["hud-weapon"].textContent = t("hud.weapon");
    this.e["keybar-assist"].textContent = t("key.assist");
    this.setSound(false);
  }

  // ---------------------------------------------------------------- 开屏
  /** 真实加载进度：由 preloadArt 的「完成数 / 总数」驱动，不是假动画 */
  setBoot(ratio) {
    // 后台 preheat 会持续回调进度；开屏一旦收尾就锁死，别让 100% 倒退回 90%
    if (this._bootDone) return;
    const pct = Math.max(0, Math.min(100, Math.round(ratio * 100)));
    if (this.e["boot-pct"]) this.e["boot-pct"].textContent = String(pct);
    if (this.e["boot-fill"]) this.e["boot-fill"].style.inlineSize = `${pct}%`;
  }

  finishBoot() {
    this.setBoot(1);
    this._bootDone = true;
    if (!this.e.boot) return;
    this.e.boot.classList.add("is-done");
    setTimeout(() => { this.e.boot.hidden = true; }, 480);
  }

  // ---------------------------------------------------------------- 覆盖层
  closeOverlays() {
    for (const el of Object.values(this.ov)) if (el) el.classList.remove("is-open");
  }

  openOverlay(name) {
    this.closeOverlays();
    const el = this.ov[name];
    if (el) el.classList.add("is-open");
  }

  displayMode(mode) {
    const cards = this.e.modegrid ? this.e.modegrid.querySelectorAll(".mode-card") : [];
    cards.forEach((c) => c.classList.toggle("is-active", c.dataset.mode === mode));
  }

  showHud(on) {
    if (this.e.hud) this.e.hud.hidden = !on;
    if (this.e.crosshair) this.e.crosshair.hidden = !on;
    if (this.e["btn-assist"]) this.e["btn-assist"].hidden = !on;
  }

  showTouch(on) {
    if (this.e.touch) this.e.touch.classList.toggle("is-on", !!on);
  }

  setSound(muted) {
    const b = this.e["btn-sound"];
    if (!b) return;
    b.classList.toggle("is-muted", !!muted);
    b.setAttribute("aria-label", t(muted ? "btn.soundOff" : "btn.soundOn"));
    b.title = t(muted ? "btn.soundOff" : "btn.soundOn");
  }

  // ---------------------------------------------------------------- 引导
  /** PC 底部键帽图例；touch 设备由 hint() 承担 */
  keybar(on, dim = false) {
    const el = this.e.keybar;
    if (!el) return;
    el.classList.toggle("is-open", !!on);
    el.classList.toggle("is-dim", !!dim);
  }

  /** 游戏内手势/动作提示；text=null 即清空并退出引导 */
  hint(text) {
    const el = this.e.hint;
    if (!el) return;
    if (!text) { el.classList.remove("is-open"); return; }
    this.e["hint-text"].textContent = text;
    el.classList.add("is-open");
  }

  // ---------------------------------------------------------------- 反馈
  banner(text, ms = 1250) {
    const el = this.e.banner;
    if (!el) return;
    el.textContent = text;
    el.classList.add("is-open");
    clearTimeout(this._timers.banner);
    this._timers.banner = setTimeout(() => el.classList.remove("is-open"), ms);
  }

  toast(text, ms = 1750) {
    const el = this.e.toast;
    if (!el) return;
    el.textContent = text;
    el.classList.add("is-open");
    clearTimeout(this._timers.toast);
    this._timers.toast = setTimeout(() => el.classList.remove("is-open"), ms);
  }

  hitmark() {
    const el = this.e.hitmark;
    if (!el) return;
    el.classList.add("is-on");
    clearTimeout(this._timers.hit);
    this._timers.hit = setTimeout(() => el.classList.remove("is-on"), 130);
  }

  damageFlash() {
    const el = this.e.vignette;
    if (!el) return;
    el.classList.add("is-hit");
    clearTimeout(this._timers.flash);
    this._timers.flash = setTimeout(() => el.classList.remove("is-hit"), 220);
  }

  kill(text) {
    const el = this.e.killfeed;
    if (!el) return;
    const row = document.createElement("div");
    row.className = "killfeed__row";
    row.textContent = text;
    el.prepend(row);
    while (el.children.length > 3) el.lastChild.remove();
    setTimeout(() => row.remove(), 2200);
  }

  // ---------------------------------------------------------------- HUD
  updateHud(s) {
    const e = this.e;
    const set = (id, v) => { if (e[id] && e[id].textContent !== String(v)) e[id].textContent = String(v); };
    set("hud-goal", `${s.caught}/${s.goal}`);
    if (e["hud-bar-fill"]) e["hud-bar-fill"].style.inlineSize = `${Math.min(100, (s.caught / Math.max(1, s.goal)) * 100)}%`;
    set("hud-coins", s.coins);
    set("hud-level", s.level);
    set("hud-score", s.score);
    set("hud-health", Math.max(0, Math.ceil(s.hp)));
    if (e["health-ring"]) {
      e["health-ring"].style.setProperty("--hp", String(Math.max(0, s.hp)));
      e["health-ring"].classList.toggle("is-low", s.hp <= 35);
    }
    set("hud-ammo", s.ammo);
    set("hud-reserve", s.reserve);
    set("hud-weapon", t(s.weapon === 2 ? "hud.sidearm" : "hud.weapon"));
    if (e["hud-reload"]) e["hud-reload"].hidden = !s.reloading;

    if (e["hud-combo"]) set("hud-combo", `x${Math.max(1, s.combo)}`);
    if (e["combo-chip"]) e["combo-chip"].hidden = s.combo < 2;

    if (e.bossbar) {
      e.bossbar.hidden = !s.bossHp;
      if (s.bossHp && e["bossbar-fill"]) e["bossbar-fill"].style.inlineSize = `${Math.max(0, s.bossHp * 100)}%`;
    }

    const nodes = e.wavechain ? e.wavechain.querySelectorAll(".wavechain__node") : [];
    nodes.forEach((n) => {
      const idx = Number(n.dataset.node);
      n.classList.toggle("is-done", idx < s.chainNode);
      n.classList.toggle("is-current", idx === s.chainNode);
    });
    if (e.crosshair) e.crosshair.classList.toggle("is-ads", !!s.ads);
    drawMinimap(e["map-canvas"], s);
  }

  /** 助攻按钮：次数常显；用光切「看广告 +N」且不消失；补充额度耗尽才禁用 */
  setAssist(snap, canShowAd) {
    const b = this.e["btn-assist"];
    if (!b) return;
    let state = "ready";
    let label = t("btn.assist", { n: snap.left });
    let badge = String(snap.left);
    if (!snap.canUse && snap.canRefill) {
      state = "refill";
      label = t("btn.assistRefill", { n: snap.refillSize });
      badge = `+${snap.refillSize}`;
    } else if (!snap.canUse && !snap.canRefill) {
      state = "empty";
      label = t("assist.empty");
      badge = "0";
    }
    b.dataset.state = state;
    b.disabled = state === "empty";
    b.setAttribute("aria-label", label);
    b.title = label;
    if (this.e["assist-label"]) this.e["assist-label"].textContent = label;
    if (this.e["assist-badge"]) this.e["assist-badge"].textContent = badge;
    b.dataset.adReady = canShowAd ? "1" : "0";
  }

  /** 是否有覆盖层占屏（focus 恢复时要区分「玩家主动暂停」和「切后台静默暂停」） */
  anyOverlayOpen() {
    return Object.values(this.ov).some((el) => el && el.classList.contains("is-open"));
  }

  /**
   * 区域选择：每关一张程序化 WebP 缩略图铺在卡片背后。
   * 一律用 DOM 节点 + style.backgroundImage，不做 innerHTML 拼接。
   */
  renderLevels(levels, unlocked, onPick) {
    const box = this.e["levels-grid"];
    if (!box) return;
    box.textContent = "";
    for (const lv of levels) {
      const locked = lv.id > unlocked;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sector-card" + (locked ? " is-locked" : "") + (lv.boss ? " is-boss" : "");
      const file = `sector-${String(lv.id).padStart(2, "0")}.webp`;
      b.style.backgroundImage =
        `linear-gradient(180deg, rgba(4,12,16,.05), rgba(4,12,16,.42)), url("assets/images/sectors/${file}")`;
      const num = document.createElement("span");
      num.className = "sector-card__num";
      num.textContent = String(lv.id).padStart(2, "0");
      const title = document.createElement("span");
      title.className = "sector-card__title";
      title.textContent = t(lv.titleKey);
      const meta = document.createElement("span");
      meta.className = "sector-card__meta";
      meta.textContent = locked ? t("sector.locked")
        : lv.boss ? t("hud.boss") : t("sector.chapter", { n: lv.chapter });
      b.append(num, title, meta);
      b.setAttribute("aria-label", `${lv.id} · ${title.textContent}${locked ? ` · ${t("sector.locked")}` : ""}`);
      b.addEventListener("click", () => onPick(lv.id - 1, locked));
      box.appendChild(b);
    }
  }

  // ---------------------------------------------------------------- 商店 / 背包
  renderShops(skins, save, coins, onBuy) {
    const paint = (container) => {
      if (!container) return;
      container.textContent = "";
      for (const skin of skins) {
        const owned = save.owned.includes(skin.id);
        const active = save.skin === skin.id;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "skin" + (owned ? "" : " is-locked") + (active ? " is-active" : "");
        const sw = document.createElement("span");
        sw.className = "skin__swatch";
        sw.style.background = skin.tint || PALETTE.player;
        const name = document.createElement("span");
        name.textContent = t(skin.nameKey);
        const cost = document.createElement("span");
        cost.className = "skin__cost";
        cost.textContent = skin.cost === 0
          ? t("shop.owned")
          : owned ? (active ? t("shop.equippedTag") : t("btn.equip")) : String(skin.cost);
        b.append(sw, name, cost);
        b.addEventListener("click", () => onBuy(skin.id));
        container.appendChild(b);
      }
    };
    paint(this.e["shop-row"]);
    paint(this.e["store-row"]);
    if (this.e["shop-coins"]) this.e["shop-coins"].textContent = String(coins);
    if (this.e["store-coins"]) this.e["store-coins"].textContent = String(coins);
    if (this.e.shop) this.e.shop.hidden = false;
  }

  renderInventory(medkits, reserve) {
    if (this.e["inv-medkit"]) this.e["inv-medkit"].textContent = `x${medkits}`;
    if (this.e["inv-ammo"]) this.e["inv-ammo"].textContent = `x${reserve}`;
  }

  // ---------------------------------------------------------------- 失败面板
  setOverStats({ score, best, coins }) {
    if (this.e["over-score"]) this.e["over-score"].textContent = String(score);
    if (this.e["over-best"]) this.e["over-best"].textContent = String(best);
    if (this.e["over-coins"]) this.e["over-coins"].textContent = String(coins);
  }

  /** revive 独占：复活可用时绝不显示翻倍；canShowAd 异步到位后由 Game 轮询补显 */
  refreshOverAds(canRevive, canDouble) {
    const r = this.e["btn-revive"], d = this.e["btn-double"];
    if (r) r.hidden = !canRevive;
    if (d) d.hidden = !canDouble;
  }

  // ---------------------------------------------------------------- 事件
  bind(h) {
    const on = (id, fn) => {
      const el = $(id);
      if (el) el.addEventListener("click", (ev) => { ev.preventDefault(); fn(ev); });
    };
    on("btn-play", h.play);
    on("btn-sectors", h.sectors);
    on("btn-sectors-back", h.closeSectors);
    on("btn-sound", h.sound);
    on("btn-store", h.store);
    on("btn-store2", h.store);
    on("btn-inventory", h.inventory);
    on("btn-inventory2", h.inventory);
    on("btn-pause", h.pause);
    on("btn-continue", h.resume);
    on("btn-exit", h.home);
    on("btn-store-close", h.closeStore);
    on("btn-inv-close", h.closeInv);
    on("btn-revive", h.revive);
    on("btn-double", h.doubleCoins);
    on("btn-retry", h.retry);
    on("btn-home", h.home);
    on("btn-assist", h.assist);
    for (const id of ["mode-survival", "mode-operations", "mode-nightmare"]) {
      on(id, () => h.mode($(id).dataset.mode));
    }
  }
}

export const STAGE_W = GAME.design.width;
