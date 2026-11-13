// src/game/input.js — 键鼠 + 触屏统一输入（玩法只读状态，不关心来源）
// PC：WASD 移动 / ←→ 或按住左键拖动转向 / Space 跳 / Shift 冲刺 / LMB 开火 / RMB 瞄准 / R 换弹 / 1·2 切枪 / H 助攻
// 触屏：左右方向键转向 + FIRE / AIM / RELOAD / JUMP 大按钮，与键盘写进同一份状态。
import { GAME } from "config/game.config.js";

const KEYMAP = {
  ArrowLeft: "left", a: "left", A: "left",
  ArrowRight: "right", d: "right", D: "right",
  ArrowUp: "fwd", w: "fwd", W: "fwd",
  ArrowDown: "back", s: "back", S: "back",
  Shift: "sprint", " ": "jump", r: "reload", R: "reload",
  "1": "weapon1", "2": "weapon2", q: "swap", e: "aim", E: "aim",
  j: "fire", J: "fire", Escape: "pause", p: "pause", P: "pause", t: "store", T: "store",
  b: "inventory", B: "inventory", h: "assist", H: "assist"
};

export class Input {
  constructor(stageEl, { onPause, onFirstAction, onStore, onInventory, onAssist } = {}) {
    this.stage = stageEl;
    this.onPause = onPause;
    this.onFirstAction = onFirstAction;
    this.onStore = onStore;
    this.onInventory = onInventory;
    this.onAssist = onAssist;
    this.keys = Object.create(null);
    this.pointerX = null;
    this.pointerY = null;
    this.mouseDX = 0;
    this.mouseDY = 0;
    this.dragging = false;
    this.used = false;
    this.locked = false;
    this._bind();
  }

  get axis() { return (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0); }
  get forward() { return (this.keys.fwd ? 1 : 0) - (this.keys.back ? 1 : 0); }
  get strafe() { return (this.keys.right ? 1 : 0) - (this.keys.left ? 1 : 0); }
  get fire() { return !!this.keys.fire; }
  get aim() { return !!this.keys.aim; }
  get sprint() { return !!this.keys.sprint; }

  _markUsed() {
    if (this.used) return;
    this.used = true;
    if (this.onFirstAction) this.onFirstAction();
  }

  _bind() {
    const canvas = this.stage.querySelector("canvas") || this.stage;
    this.canvas = canvas;

    this._down = (e) => {
      const k = KEYMAP[e.key];
      if (!k) return;
      this.keys[k] = true;
      this._markUsed();
      if (k === "pause") { this.onPause?.(); e.preventDefault(); }
      if (k === "store") this.onStore?.();
      if (k === "inventory") this.onInventory?.();
      if (k === "assist" && !e.repeat) { this.onAssist?.(); e.preventDefault(); }
      if (["left", "right", "fwd", "back", "jump", "reload", "weapon1", "weapon2"].includes(k)) e.preventDefault();
    };
    this._up = (e) => { const k = KEYMAP[e.key]; if (k) this.keys[k] = false; };
    this._blur = () => {
      this.keys = Object.create(null);
      this.pointerX = null; this.dragging = false; this._lastX = null; this._lastY = null;
    };
    window.addEventListener("keydown", this._down);
    window.addEventListener("keyup", this._up);
    window.addEventListener("blur", this._blur);

    const toDesign = (cx, cy) => {
      const r = canvas.getBoundingClientRect();
      const scale = r.width / GAME.design.width;
      return { x: (cx - r.left) / Math.max(scale, 0.0001), y: (cy - r.top) / Math.max(scale, 0.0001) };
    };

    // 绝不 requestPointerLock：指针一旦被锁在 canvas 上，HUD 里的 ASSIST / 商店 /
    // 暂停按钮全部点不到，只有按 ESC 释放指针锁才能点——这是浏览器 H5 的经典坑。
    // 改为「按住左键拖动 = 转视角」，光标始终是自由的，所有 HUD 按钮随时可点。
    this._pointerDown = (e) => {
      if (e.target.closest && e.target.closest("button")) return;
      this._markUsed();
      if (e.button === 2) { this.keys.aim = true; e.preventDefault(); }
      else if (e.button === 0) {
        this.keys.fire = true;
        this.dragging = true;
        this._lastX = e.clientX; this._lastY = e.clientY;
        const p = toDesign(e.clientX, e.clientY);
        this.pointerX = p.x; this.pointerY = p.y;
      }
    };
    this._pointerUp = (e) => {
      if (e.button === 2) this.keys.aim = false;
      if (e.button === 0) { this.keys.fire = false; this.dragging = false; this._lastX = null; this._lastY = null; }
    };
    this._pointerMove = (e) => {
      if (this.dragging) {
        const dx = e.movementX || (this._lastX == null ? 0 : e.clientX - this._lastX);
        const dy = e.movementY || (this._lastY == null ? 0 : e.clientY - this._lastY);
        this.mouseDX += dx; this.mouseDY += dy;
      }
      this._lastX = e.clientX; this._lastY = e.clientY;
      const p = toDesign(e.clientX, e.clientY);
      this.pointerX = p.x; this.pointerY = p.y;
    };
    this._context = (e) => e.preventDefault();
    this._lockChange = () => {
      this.locked = false;
      if (document.pointerLockElement) document.exitPointerLock();
    };

    canvas.addEventListener("pointerdown", this._pointerDown);
    window.addEventListener("pointerup", this._pointerUp);
    window.addEventListener("pointermove", this._pointerMove);
    window.addEventListener("pointercancel", this._pointerUp);
    canvas.addEventListener("contextmenu", this._context);
    document.addEventListener("pointerlockchange", this._lockChange);
  }

  /** 触屏方向键与动作按钮：按住生效，抬起失效 */
  bindPad(btn, dir) {
    if (!btn) return;
    const on = (e) => { e.preventDefault(); this.keys[dir] = true; this._markUsed(); btn.classList.add("is-on"); };
    const off = () => { this.keys[dir] = false; btn.classList.remove("is-on"); };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("pointercancel", off);
  }

  bindAction(btn, name) {
    if (!btn) return;
    const on = (e) => { e.preventDefault(); this.keys[name] = true; this._markUsed(); btn.classList.add("is-on"); };
    const off = () => { this.keys[name] = false; btn.classList.remove("is-on"); };
    btn.addEventListener("pointerdown", on);
    btn.addEventListener("pointerup", off);
    btn.addEventListener("pointerleave", off);
    btn.addEventListener("pointercancel", off);
  }

  consumeMouse() {
    const d = { x: this.mouseDX, y: this.mouseDY };
    this.mouseDX = 0; this.mouseDY = 0;
    return d;
  }

  destroy() {
    window.removeEventListener("keydown", this._down);
    window.removeEventListener("keyup", this._up);
    window.removeEventListener("blur", this._blur);
    window.removeEventListener("pointerup", this._pointerUp);
    window.removeEventListener("pointermove", this._pointerMove);
    window.removeEventListener("pointercancel", this._pointerUp);
    document.removeEventListener("pointerlockchange", this._lockChange);
  }
}

export function isTouchDevice() {
  return (navigator.maxTouchPoints || 0) > 0 || "ontouchstart" in window;
}
