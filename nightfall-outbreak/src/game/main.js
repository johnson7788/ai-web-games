// src/game/main.js — NIGHTFALL: OUTBREAK 主玩法状态机
// 职责：输入 → 第一人称移动/转向 → GLB 僵尸 AI → hitscan 开火 → 波次/过关 → 广告与存档。
// 数值旋钮全部来自 config/levels.js；本文件不写 difficulty 的魔法系数。
import * as THREE from "three";
import { GAME } from "config/game.config.js";
import { LEVELS } from "config/levels.js";
import { t } from "core/i18n.js";
import { EnemyManager } from "game/enemies.js";
import { Waves } from "game/waves.js";
import { Weapon } from "game/weapon.js";
import { STAGE } from "art/theme.js";

const SAVE_KEY = "pipy:nightfall-outbreak:v1";
const TURN_SPEED = 2.45;        // rad/s：← → 转向
const MOUSE_SENS = 0.0024;
const MOVE = 5.2;               // m/s：由 baseline 620 逻辑像素/秒折算到 3D 世界单位
const SIDEARM_MAG = 12;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * 机制注册表：关卡表里的每个 newMechanic 必须在这里有真实实现，否则只是换皮文字。
 * 复用机制（reuse）同样会走一遍，保证「教过的能力」在后半段一直生效。
 */
export const MECHANIC_HOOKS = {
  // 第 1 关：放宽准星容差，把「对准再开火」教清楚
  aim(game) {
    game.mods.aim = true;
    game.mods.tolerance = GAME.play.crosshairTolerance;
  },
  // 第 3 关：弹匣收紧，主动换弹成为真正可用的动作
  reload(game) {
    game.mods.reload = true;
    game.magazine = game.level.ammo;
  },
  // 第 4 关：疾行者入场，站着清场会被扑倒
  kite(game) {
    game.mods.kite = true;
    game.mods.runner = true;
  },
  // 第 6 关：Shift 冲刺解锁，给玩家一次拉开距离的机会
  sprint(game) {
    game.mods.sprint = true;
  },
  // 第 8 关：爆燃尸靠近火堆会被引爆，地形杀生效
  bait(game) {
    game.mods.bait = true;
  },
  // 第 9 关：切副武器代替换弹，连击窗口才续得上
  swap(game) {
    game.mods.swap = true;
    game.mods.sidearm = true;
  }
};

export class Game {
  constructor({ renderer, pool, audio, ui, ads, assist, input, headless = false, touch = false }) {
    this.renderer = renderer;
    this.pool = pool;
    this.audio = audio;
    this.ui = ui;
    this.ads = ads;
    this.assist = assist;
    this.input = input;
    this.headless = headless;
    this.touch = touch;

    this.weapon = new Weapon(renderer.camera);
    this.enemies = new EnemyManager(pool, renderer.scene);
    this.waves = null;
    this.level = LEVELS[0];
    this.levelIndex = 0;
    this.mode = "survival";
    this.state = "menu";
    this.spawnEnabled = true;
    this.spawnCount = 0;
    this._resumeAfterPanel = false;
    this._adPoll = 0;
    this._moving = 0;
    this._yawDelta = 0;

    this.saveData = { best: 0, unlocked: 1, coins: 0, owned: ["classic"], skin: "classic" };
    this.score = 0; this.best = 0; this.coins = 0;
    this.revived = false;
    this.runStart = performance.now();
    this.player = { x: 0, z: 0, eye: 1.65, yaw: 0, pitch: 0, hp: GAME.play.health, ads: false, hop: 0, vy: 0 };
    this.magazine = GAME.play.magazine;
    this.magazines = { 1: GAME.play.magazine, 2: SIDEARM_MAG };
    this.ammoBySlot = { 1: GAME.play.magazine, 2: SIDEARM_MAG };
    this.weaponSlot = 1;
    this.ammo = GAME.play.magazine;
    this.reserve = 120;
    this.reloading = 0;
    this.fireCd = 0;
    this.killed = 0; this.combo = 0; this.maxCombo = 0; this.comboT = 0;
    this.stepT = 0;
    this.guide = { step: 0, done: true };
    this.mods = { tolerance: 52 };

    this.load();
    this.applyTheme();
    this.ui.renderShops(GAME.shop.skins, this.saveData, this.coins, (id) => this.buySkin(id));
    this.ui.renderInventory(Math.floor(this.player.hp / 40), this.reserve);
    this.ui.displayMode(this.mode);
    this.ui.openOverlay("menu");
    this.ui.showHud(false);
    this.ui.setAssist(this.assist.snapshot(), false);
    this._bindLifecycle();

    // 平台冒烟契约：字段名固定，smoke.cjs 靠 items[].off 跟随目标完成真玩过关。
    this.debug = {
      start: (idx = 0, mode) => this.startRun(idx, mode || this.mode, { fresh: true }),
      snapshot: () => this.snapshot(),
      pause: () => this.pause(true),
      resume: () => this.resume(),
      setSpawnEnabled: (v) => { this.spawnEnabled = !!v; },
      setInput: (name, on) => { this.input.keys[name] = !!on; },
      assist: () => this.assist.snapshot(),
      audio: () => this.audio.audioState(),
      anim: () => this.enemies.list.map((e) => e.animState()),
      save: () => this.save(),
      load: () => this.load()
    };
    window.PipyGame = window.PipyGame || {};
    window.PipyGame.debug = this.debug;
  }

  _bindLifecycle() {
    // 广告开始/结束：暂停玩法 + 静音，结束恢复记录的音量
    this.ads.onStart(() => this.pause(true));
    this.ads.onEnd(() => { if (this.state === "paused" && !document.hidden) this.resume(); });
    // 接电话回来不该已经被扣光血
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.pause(true);
      else if (this.state === "paused" && !this.ads.paused) this.resume();
    });
    window.addEventListener("blur", () => this.pause(true));
    // 关键：静默暂停（blur / 广告 / 切后台）必须能被 focus 恢复，
    // 否则 audio.suspend() 的静音会一直留到下一次手动 resume，BGM 就此消失。
    window.addEventListener("focus", () => {
      if (this.state === "paused" && this._silentPause && !this.ads.paused &&
          !document.hidden && !this.ui.anyOverlayOpen()) this.resume();
      else this.audio.restore();
    });
  }

  // ------------------------------------------------------------ 存档 / 主题
  load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        this.saveData = {
          best: Math.max(0, Number(d.best) || 0),
          unlocked: clamp(Number(d.unlocked) || 1, 1, LEVELS.length),
          coins: Math.max(0, Number(d.coins) || 0),
          owned: Array.isArray(d.owned) && d.owned.length ? d.owned : ["classic"],
          skin: typeof d.skin === "string" ? d.skin : "classic"
        };
      }
    } catch (_) { /* 隐私模式 / 损坏存档：静默回落默认 */ }
    this.best = this.saveData.best;
    this.coins = this.saveData.coins;
  }

  save() {
    this.saveData.best = Math.max(this.saveData.best, this.score);
    this.saveData.coins = this.coins;
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(this.saveData)); } catch (_) { /* 忽略配额异常 */ }
  }

  applyTheme() {
    const skin = GAME.shop.skins.find((s) => s.id === this.saveData.skin);
    document.body.dataset.uiTheme = skin ? skin.id : "classic";
    this.weapon.setTint(skin ? skin.tint : null);
    this.renderer.setWeaponTint(skin ? skin.tint : null);
  }

  buySkin(id) {
    const skin = GAME.shop.skins.find((s) => s.id === id);
    if (!skin) return false;
    if (!this.saveData.owned.includes(id)) {
      if (this.coins < skin.cost) {
        this.ui.toast(t("shop.short", { n: skin.cost - this.coins }));
        return false;
      }
      this.coins -= skin.cost;                 // 金币真实出口：买了就少
      this.saveData.owned.push(id);
    }
    this.saveData.skin = id;
    this.applyTheme();
    this.save();
    this.audio.play("click");
    this.ui.renderShops(GAME.shop.skins, this.saveData, this.coins, (sid) => this.buySkin(sid));
    this.ui.toast(t("shop.equipped"));
    return true;
  }

  // ------------------------------------------------------------ 局生命周期
  startRun(levelIndex = 0, mode = "survival", { fresh = true } = {}) {
    this.levelIndex = clamp(levelIndex, 0, LEVELS.length - 1);
    this.mode = mode;
    this.level = LEVELS[this.levelIndex];
    this.ads.newRun();
    if (fresh) {
      this.assist.reset();                   // 次数只在真正开局回满，跨关保留
      this.revived = false;
      this.score = 0;
      this.runStart = performance.now();
    }

    this.mods = { tolerance: 52 };
    const learned = new Set([...(this.level.reuse || []), this.level.newMechanic].filter(Boolean));
    for (const key of learned) {
      const hook = MECHANIC_HOOKS[key];
      if (hook) hook(this);
    }

    this.enemies.clear();
    const boost = mode === "nightmare" ? 1.35 : 1;
    this.waves = new Waves({
      ...this.level,
      spawnMs: Math.round(this.level.spawnMs / (this.level.speedScale * boost)),
      enemySpeed: this.level.enemySpeed * boost
    });
    this.spawnCount = 0;
    this.spawnEnabled = true;
    this.input.consumeMouse();                     // 丢掉菜单里累积的鼠标位移，避免开局瞬间甩头

    this.player.x = 0; this.player.z = 0; this.player.yaw = 0; this.player.pitch = 0;
    this.player.hp = GAME.play.health; this.player.ads = false;
    this.player.hop = 0; this.player.vy = 0; this.player.eye = 1.65;
    this.magazine = this.level.ammo;
    this.magazines = { 1: this.level.ammo, 2: SIDEARM_MAG };
    this.ammoBySlot = { 1: this.level.ammo, 2: SIDEARM_MAG };
    this.weaponSlot = 1;
    this.ammo = this.magazine;
    this.reserve = 120;
    this.reloading = 0; this.fireCd = 0;
    this.killed = 0; this.combo = 0; this.maxCombo = 0; this.comboT = 0; this.stepT = 0;
    this.state = "playing";

    this.renderer.setLevel(this.level);
    this.audio.setIntensity(this.level.speedScale / 1.6);
    this.audio.ensureMusic();              // 开局必定重新确认 BGM 调度器存活
    this.ui.closeOverlays();
    this.ui.showHud(true);
    this.ui.showTouch(this.touch);
    this.ui.banner(t("banner.level", { n: this.level.id }));
    this.ui.setAssist(this.assist.snapshot(), this.ads.canShow("assist"));

    // 教学关：3 步自动推进（转向 → 命中 → 清场），走完即清空，不残留不循环
    this.guide = { step: 0, done: !this.level.tutorial };
    if (this.guide.done) { this.ui.hint(t(this.level.hintKey)); this.ui.keybar(false); }
    else { this.ui.hint(t("guide.move")); this.ui.keybar(!this.touch); }
    this._pollAssistAd();
  }

  toMenu() {
    clearInterval(this._adPoll);
    this.state = "menu";
    this.enemies.clear();
    this.ui.showHud(false);
    this.ui.showTouch(false);
    this.ui.hint(null);
    this.ui.keybar(false);
    this.ui.displayMode(this.mode);
    this.ui.renderShops(GAME.shop.skins, this.saveData, this.coins, (id) => this.buySkin(id));
    this.ui.openOverlay("menu");
    this.audio.restore();
  }

  play() {
    this.audio.unlock();
    const idx = this.mode === "operations"
      ? clamp(this.saveData.unlocked - 1, 0, LEVELS.length - 1) : 0;
    this.startRun(idx, this.mode, { fresh: true });
  }

  /** 区域选择页：10 关各带一张缩略图，锁定关仍展示图片但不可进入 */
  openSectors() {
    if (this.state === "playing") return;
    this.mode = "operations";
    this.ui.displayMode("operations");
    this.ui.renderLevels(LEVELS, this.saveData.unlocked, (idx, locked) => this.pickLevel(idx, locked));
    this.ui.openOverlay("levels");
    this.audio.play("click");
  }

  pickLevel(idx, locked) {
    if (locked) { this.ui.toast(t("sector.lockedToast")); return; }
    this.audio.unlock();
    this.startRun(clamp(idx, 0, LEVELS.length - 1), "operations", { fresh: true });
  }

  closeSectors() {
    this.ui.openOverlay("menu");
    this.audio.play("click");
  }

  setMode(next) {
    if (!["survival", "operations", "nightmare"].includes(next)) return;
    this.mode = next;
    this.ui.displayMode(next);
    this.audio.play("click");
    if (next === "operations") this.openSectors();
  }

  pause(silent = false) {
    if (this.state !== "playing") return;
    this.state = "paused";
    this._silentPause = silent;
    this.audio.suspend();
    if (!silent) this.ui.openOverlay("pause");
  }

  resume() {
    if (this.state !== "paused") return;
    this.state = "playing";
    this.audio.restore();
    this.ui.closeOverlays();
  }

  openStore() {
    if (this.state === "playing") { this.pause(true); this._resumeAfterPanel = true; }
    this.ui.renderShops(GAME.shop.skins, this.saveData, this.coins, (id) => this.buySkin(id));
    this.ui.openOverlay("store");
  }

  openInventory() {
    if (this.state === "playing") { this.pause(true); this._resumeAfterPanel = true; }
    this.ui.renderInventory(Math.floor(this.player.hp / 40), this.reserve);
    this.ui.openOverlay("inv");
  }

  closePanel() {
    this.ui.closeOverlays();
    if (this._resumeAfterPanel && this.state === "paused") {
      this._resumeAfterPanel = false;
      this.resume();
    } else if (this.state === "menu") this.ui.openOverlay("menu");
    else if (this.state === "over") this.ui.openOverlay("over");
  }

  // ------------------------------------------------------------ 主循环
  update(dt, animDt = dt) {
    if (this.state === "playing") this._tickPlay(dt, animDt);
    else if (this.state === "menu") this.player.yaw += dt * 0.055;  // 菜单背景缓慢环视
    this.weapon.update(dt, { ads: this.player.ads, moving: this._moving, yawDelta: this._yawDelta });
    this.renderer.update(dt, this.player);
    this.renderer.render();
    this._yawDelta = 0;
  }

  _tickPlay(dt, animDt = dt) {
    const I = this.input;
    const m = I.consumeMouse();
    const turn = I.axis;
    const dYaw = -turn * TURN_SPEED * dt - m.x * MOUSE_SENS;
    this.player.yaw += dYaw;
    this.player.pitch = clamp(this.player.pitch - m.y * MOUSE_SENS, -0.44, 0.44);
    this._yawDelta = dYaw;
    if (!this.guide.done && this.guide.step === 0 && (turn !== 0 || Math.abs(m.x) > 0)) this._advanceGuide();

    const fwd = I.forward;
    const speed = MOVE * (I.sprint && this.mods.sprint ? 1.75 : 1);
    const fx = -Math.sin(this.player.yaw), fz = -Math.cos(this.player.yaw);
    if (fwd !== 0) {
      this.player.x += fx * fwd * speed * dt;
      this.player.z += fz * fwd * speed * dt;
      this.stepT -= dt;
      if (this.stepT <= 0) { this.stepT = 0.42; this.audio.play("step", { volume: 0.5 }); }
    }
    const lim = this.level.arenaW * 0.5;
    this.player.x = clamp(this.player.x, -lim, lim);
    this.player.z = clamp(this.player.z, -lim, lim);
    this._moving = Math.abs(fwd);

    if (I.keys.jump && this.player.hop <= 0 && this.player.vy === 0) this.player.vy = 3.4;
    if (this.player.vy !== 0 || this.player.hop > 0) {
      this.player.hop += this.player.vy * dt;
      this.player.vy -= 9.2 * dt;
      if (this.player.hop <= 0) { this.player.hop = 0; this.player.vy = 0; }
    }
    this.player.eye = 1.65 + this.player.hop;
    this.player.ads = I.aim;

    if (this.reloading > 0) {
      this.reloading -= dt;
      if (this.reloading <= 0) {
        const need = this.magazine - this.ammo;
        const got = Math.min(need, this.reserve);
        this.ammo += got; this.reserve -= got;
        this.reloading = 0;
        this.ui.hitmark();
      }
    }
    if (I.keys.reload) this.startReload();
    if (I.keys.weapon1) this.swapTo(1);
    if (I.keys.weapon2 || I.keys.swap) this.swapTo(2);

    this.fireCd -= dt;
    if (I.fire && this.fireCd <= 0) this.fire();
    if (this.comboT > 0) {
      this.comboT -= dt;
      if (this.comboT <= 0) this.combo = 0;
    }

    this.enemies.update(dt, this.player, (dmg) => this._onAttack(dmg), animDt);
    if (this.mods.bait) this._tickBait();

    const spec = this.waves.update(dt, this.player, this.enemies.count);
    if (spec && this.spawnEnabled) {
      this.spawnCount += 1;
      this.enemies.spawn(spec.type, spec.pos, this.waves.level);
      if (spec.type === "boss") { this.audio.play("boss"); this.ui.banner(t("banner.boss"), 1500); }
      else if (this.spawnCount === 1 || this.spawnCount % 5 === 0) this.audio.play("zombie");
    }

    this.ui.updateHud(this._hudState());
    if (this.killed >= this.level.goal && this.enemies.count === 0) this.levelCleared();
  }

  _onAttack(dmg) {
    if (this.level.failSafe) return;                 // 第 1 关零失败：伤害来源被关卡表关掉
    this.player.hp -= dmg;
    this.audio.play("hurt");
    this.renderer.flashDamage(0.75);
    this.ui.damageFlash();
    this.combo = 0;
    if (this.player.hp <= 0) { this.player.hp = 0; this.gameOver(); }
  }

  /** 第 8 关：爆燃尸被诱到火堆半径内自爆，形成地形杀 */
  _tickBait() {
    for (const e of this.enemies.list) {
      if (e.dead || e.type !== "bloater") continue;
      const r = Math.hypot(e.object.position.x, e.object.position.z);
      if (r < 6.5 && e.hurt(999)) {
        this.audio.play("explode");
        this.renderer.burst(e.bodyPos(), 0xff8a3c, 24, 4.2);
        this._onKill(e, false);
      }
    }
  }

  // ------------------------------------------------------------ 武器 / 命中
  startReload() {
    if (this.reloading > 0 || this.ammo >= this.magazine || this.reserve <= 0) return;
    this.reloading = GAME.play.reloadMs / 1000;
    this.audio.play("reload");
    this.ui.toast(t("toast.reloading"), 900);
  }

  swapTo(slot) {
    if (slot === this.weaponSlot) return;
    if (slot === 2 && !this.mods.sidearm) return;
    this.ammoBySlot[this.weaponSlot] = this.ammo;
    this.weaponSlot = slot;
    this.magazine = this.magazines[slot];
    this.ammo = this.ammoBySlot[slot];
    this.reloading = 0;
    this.audio.play("click");
  }

  fire() {
    if (this.reloading > 0) return;
    if (this.ammo <= 0) {
      this.audio.play("dry");
      this.ui.toast(t("toast.noAmmo"), 800);
      this.fireCd = 0.24;
      return;
    }
    this.ammo -= 1;
    this.fireCd = GAME.play.fireRateMs / 1000;
    // 第 3 关起「主动换弹」机制：剩 3 发时给一次提示，别让玩家打空才发现
    if (this.mods.reload && this.ammo === 3) this.ui.toast(t("toast.noAmmo"), 900);
    this.weapon.fire();
    this.audio.play("rifle");
    this.renderer.flashMuzzle();
    this.renderer.camera.updateMatrixWorld(true);   // 枪口与投影都用本帧姿势
    this.renderer.burst(this.weapon.muzzleWorld(), 0xffc070, 7, 1.3);

    const cands = this.enemies.candidates(this.renderer, this.mods.tolerance);
    if (!cands.length) { this.combo = 0; return; }
    const hit = cands[0];
    const e = hit.enemy;
    if (e.weakOnly && !hit.headshot) {
      // 首领只有发光弱点吃伤害
      this.audio.play("impact");
      this.renderer.burst(e.bodyPos(), 0xffe08a, 5, 1.0);
      this.combo = 0;
      return;
    }
    const dmg = hit.headshot ? 2 : 1;
    const killed = e.hurt(dmg);
    this.audio.play(hit.headshot ? "headshot" : "impact");
    this.ui.hitmark();
    this.renderer.burst(e.bodyPos(), 0xb84038, killed ? 14 : 6, killed ? 2.4 : 1.2);
    if (hit.headshot) this.ui.banner(t("banner.headshot"), 600);
    if (killed) this._onKill(e, hit.headshot);
    if (!this.guide.done && this.guide.step === 1) this._advanceGuide();
  }

  _onKill(e, headshot) {
    this.killed += 1;
    this.combo += 1;
    this.comboT = this.level.comboWindow;
    this.maxCombo = Math.max(this.maxCombo, this.combo);
    const points = e.score * clamp(this.combo, 1, 5) + (headshot ? 50 : 0);
    this.score += points;
    this.coins += Math.round(e.score / 10);
    this.audio.play("zombieDie");
    this.ui.kill(`+${points}`);
    if (this.combo >= 3) this.ui.banner(t("banner.combo", { n: this.combo }), 700);
  }

  // ------------------------------------------------------------ 引导
  _advanceGuide() {
    if (this.guide.done) return;
    this.guide.step += 1;
    if (this.guide.step === 1) { this.ui.hint(t("guide.fire")); this.ui.keybar(!this.touch, true); }
    else if (this.guide.step === 2) { this.ui.hint(t("guide.clear")); this.ui.keybar(!this.touch, true); }
    if (this.guide.step >= (this.level.teachSteps || 3)) {
      this.guide.done = true;
      this.ui.hint(null);
      this.ui.keybar(false);
    }
  }

  // ------------------------------------------------------------ 结算 / 广告
  levelCleared() {
    if (this.state !== "playing") return;
    this.state = "clear";
    if (!this.guide.done) this._advanceGuide();
    const durationMs = Math.round(performance.now() - this.runStart);
    const progress = Math.min(1, this.killed / Math.max(1, this.level.goal));
    const stars = 1 + (durationMs / 1000 <= this.level.starTimeSec ? 1 : 0) +
                  (this.maxCombo >= this.level.starMinCombo ? 1 : 0);
    this.saveData.unlocked = Math.max(this.saveData.unlocked, Math.min(LEVELS.length, this.levelIndex + 2));
    this.save();
    // 漏斗埋点：时长 / 进度 / 是否复活缺一不可
    this.ads.levelCleared({ levelId: this.level.id, durationMs, progress, revived: this.revived, stars, score: this.score });
    this.audio.play("win");
    this.ui.banner(t("banner.clear"), 1400);
    this.ui.toast(t("toast.saved"), 1600);

    const goNext = () => {
      if (this.levelIndex + 1 < LEVELS.length) this.startRun(this.levelIndex + 1, this.mode, { fresh: false });
      else this.toMenu();
    };
    // 插屏只在过关后，前 3 关（含教学关）完全不弹
    if (this.level.id > GAME.ads.interstitial.skipFirstLevels && this.ads.canShow("stageClear")) {
      this.ads.interstitial("stageClear").then(goNext);
    } else {
      setTimeout(goNext, 1100);
    }
  }

  gameOver() {
    if (this.state !== "playing") return;
    this.state = "over";
    const durationMs = Math.round(performance.now() - this.runStart);
    const progress = Math.min(1, this.killed / Math.max(1, this.level.goal));
    this.ads.gameOver({ levelId: this.level.id, durationMs, progress, revived: this.revived, score: this.score });
    this.save();
    this.audio.play("lose");
    this.ui.hint(null);
    this.ui.keybar(false);
    this.ui.setOverStats({ score: this.score, best: Math.max(this.best, this.score), coins: this.coins });
    this.ui.openOverlay("over");
    this._refreshOverAds();
    // canShowAd 异步到位：面板停留期间轮询补显，别丢掉最高转化位
    clearInterval(this._adPoll);
    let n = 0;
    this._adPoll = setInterval(() => {
      if (this.state !== "over" || n++ >= 5) { clearInterval(this._adPoll); return; }
      this._refreshOverAds();
    }, 900);
  }

  _refreshOverAds() {
    const canRevive = !this.revived && this.ads.canShow("revive");
    const canDouble = !canRevive && this.ads.canShow("doubleCoins");
    this.ui.refreshOverAds(canRevive, canDouble);   // revive 独占，两按钮不同框
  }

  _pollAssistAd() {
    // 助攻按钮的「看广告补次数」入口也随 canShowAd 异步到位刷新
    let n = 0;
    const timer = setInterval(() => {
      if (this.state !== "playing" || n++ >= 5) { clearInterval(timer); return; }
      this.ui.setAssist(this.assist.snapshot(), this.ads.canShow("assist"));
    }, 900);
  }

  async revive() {
    if (this.state !== "over" || this.revived) return;
    const ok = await this.ads.rewarded("revive");
    if (!ok) { this.ui.toast(t("toast.adFail")); return; }
    this.revived = true;
    this.ads.track("revive_used", { levelId: this.level.id, score: this.score });
    this.player.hp = GAME.play.health;
    this.player.x = 0; this.player.z = 0;
    this.enemies.clearAround(this.player, 9);
    this.reserve = 120;
    this.ammo = this.magazine;
    this.ui.closeOverlays();
    this.ui.showHud(true);
    this.state = "playing";
    this.ui.banner(t("ad.revive.title"), 1100);
  }

  async doubleCoins() {
    if (this.state !== "over") return;
    const ok = await this.ads.rewarded("doubleCoins");
    if (ok !== true) { this.ui.toast(t("toast.adFail")); return; }
    this.coins *= 2;                                // 只翻可消费的金币，不动分数
    this.ads.track("coins_doubled", { levelId: this.level.id, coins: this.coins });
    this.save();
    this.ui.setOverStats({ score: this.score, best: Math.max(this.best, this.score), coins: this.coins });
    this.ui.refreshOverAds(false, false);
    this.ui.banner(t("ad.double.title"), 1100);
  }

  async assistAction() {
    if (this.state !== "playing") return;
    const snap = this.assist.snapshot();
    if (!snap.canUse) {
      if (!snap.canRefill) { this.ui.toast(t("assist.empty")); return; }
      const ok = await this.ads.rewarded("assist");
      if (ok !== true) { this.ui.toast(t("toast.adFail")); return; }
      this.assist.refill();                        // 只有广告真的看完才补次数
      this.ads.track("assist_refill", { levelId: this.level.id, refills: this.assist.snapshot().refills });
      this.ui.toast(t("assist.refill", { n: snap.refillSize }));
      this.ui.setAssist(this.assist.snapshot(), this.ads.canShow("assist"));
      return;
    }
    if (!this.assist.use()) return;
    // 助攻清出的敌人不计入过关目标：解围是救急，不能白嫖关卡进度
    const cleared = this.enemies.clearAround(this.player, 8);
    this.player.hp = Math.min(GAME.play.health, this.player.hp + GAME.play.assistHeal);
    this.audio.play("explode");
    this.renderer.burst(new THREE.Vector3(this.player.x, 1.1, this.player.z), 0xffa64d, 26, 4.5);
    this.ui.toast(t("ad.revive.title"), 900);
    this.ui.setAssist(this.assist.snapshot(), this.ads.canShow("assist"));
    return cleared;
  }

  // ------------------------------------------------------------ HUD / debug 快照
  _hudState() {
    let bossHp = 0;
    const radar = [];
    for (const e of this.enemies.list) {
      if (e.dead) continue;
      radar.push({ x: e.object.position.x - this.player.x, y: e.object.position.z - this.player.z, kind: e.type });
      if (e.type === "boss") bossHp = e.hp / e.maxHp;
    }
    return {
      caught: this.killed, goal: this.level.goal, coins: this.coins, level: this.level.id,
      score: this.score, hp: this.player.hp, ammo: this.ammo, reserve: this.reserve,
      reloading: this.reloading > 0, weapon: this.weaponSlot, combo: this.combo,
      bossHp, ads: this.player.ads,
      chainNode: this.waves ? this.waves.chainNode() : 1,
      player: { x: this.player.x, y: this.player.z, yaw: this.player.yaw },
      radar
    };
  }

  /** 平台冒烟契约：state / levelIndex / score / goal / progress / caught / player / items 固定 */
  snapshot() {
    this.renderer.scene.updateMatrixWorld(true);
    const items = [];
    const yaw = this.player.yaw;
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);       // 相机前向
    const rx = Math.cos(yaw), rz = -Math.sin(yaw);        // 相机右向
    for (const e of this.enemies.list) {
      if (e.dead) continue;
      const dx = e.object.position.x - this.player.x;
      const dz = e.object.position.z - this.player.z;
      const dist = Math.hypot(dx, dz);
      const p = this.renderer.project(e.bodyPos());
      // ang = 目标相对视线的有符号方位角（正=右侧）。不能只给屏幕 off：
      // 玩家转身后 off 会翻转/出屏，冒烟会「看不见」其实还能打的目标而卡死。
      const ang = Math.atan2(dx * rx + dz * rz, dx * fx + dz * fz);
      items.push({
        x: Math.round(p.x), y: Math.round(p.y), kind: e.type,
        off: Math.round(p.x - STAGE.cx), ang: Number(ang.toFixed(3)),
        dist: Math.round(dist), visible: p.visible
      });
    }
    items.sort((a, b) => Math.abs(a.ang) - Math.abs(b.ang));
    return {
      state: this.state,
      levelIndex: this.levelIndex,
      level: this.level.id,
      score: this.score,
      goal: this.level.goal,
      progress: Math.min(1, this.killed / Math.max(1, this.level.goal)),
      caught: this.killed,
      player: { x: this.player.x, y: this.player.z, yaw: this.player.yaw, hp: this.player.hp },
      ammo: this.ammo,
      items,
      spawned: this.waves ? this.waves.spawned : 0,
      enemyAlive: this.enemies.list.filter((e) => !e.dead).length,
      enemyPending: this.enemies.pending,
      spawnEnabled: this.spawnEnabled,
      adsReady: this.ads.ready,
      renderTris: this.renderer.renderer.info.render.triangles
    };
  }
}
