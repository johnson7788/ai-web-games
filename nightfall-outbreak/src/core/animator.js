// src/core/animator.js — 逐帧序列播放（禁止骨骼/补间/两图切换）
// 帧清单来自 assets/images/frame-manifest.json，路径约定见 src/core/assets.js。
//
// 三个易踩的点（写完对照检查）：
//   1) 缺帧必须**出声**：静默 return 会让"角色只有 idle"这种问题一路带到交付；
//   2) 朝向只翻不产反向条带：侧面动作一律靠 flip，左右共用一套帧；
//   3) 锚点分两种：feet（脚底，站立/行走）/ center（包围盒中心，倒地/腾空），
//      倒地帧用 feet 会悬空，腾空帧用 feet 会陷地。
import { frameUrl } from "core/assets.js";

export class Animator {
  constructor({ images, manifest }) {
    this.images = images || new Map();
    this.manifest = manifest || {};
    this.dir = this.manifest.dir || "assets/images/frames/";
    this.ext = this.manifest.ext || "webp";
  }

  def(name) {
    return (this.manifest.characters || {})[name] || null;
  }

  has(name, action) {
    const d = this.def(name);
    const a = d && (d.actions || {})[action];
    return !!(a && Number(a.frames) > 0);
  }

  /** 取一组已解码的帧（原样按 manifest 顺序，不做镜像；朝向用水平翻转） */
  frames(name, action) {
    const d = this.def(name);
    if (!d) return [];
    const a = (d.actions || {})[action];
    if (!a) return [];
    const out = [];
    for (let i = 1; i <= Number(a.frames || 0); i += 1) {
      const img = this.images.get(frameUrl(this.dir, d.reuseOf || name, action, i, this.ext));
      if (img) out.push(img);
    }
    return out;
  }

  fps(name, action) {
    const d = this.def(name);
    const a = d && (d.actions || {})[action];
    const v = Number(a?.fps) || Number(d?.fps) || 12;
    return v > 0 ? v : 12;
  }

  loop(name, action) {
    const d = this.def(name);
    const a = d && (d.actions || {})[action];
    return a?.loop !== false && a?.type !== "once";
  }

  /** 绘制锚点：feet = 脚底中心（默认），center = 包围盒中心（倒地/腾空） */
  anchor(name, action) {
    const d = this.def(name);
    const a = d && (d.actions || {})[action];
    return a?.anchor || d?.anchor || "feet";
  }

  /** 动作缺失清单：交付前应打印出来，不要让它静默降级 */
  missing(name, actions) {
    return (actions || []).filter((a) => !this.has(name, a));
  }
}

/** 一个可绘制的实体：持有当前动作、帧序号与朝向。 */
export class Sprite {
  constructor(animator, name, action = "idle", opts = {}) {
    this.a = animator;
    this.name = name;
    this.action = action;
    this.frames = animator.frames(name, action);
    this.fps = opts.fps || animator.fps(name, action);
    this.loop = opts.loop ?? animator.loop(name, action);
    this.anchor = opts.anchor || animator.anchor(name, action);
    this.scale = opts.scale || 1;
    this.flip = !!opts.flip;
    this.index = 0;
    this.time = 0;
    this.done = false;
    this.missing = new Set();
  }

  /**
   * 切动作。缺帧时：先用 fallback（默认 idle）兜住，并记进 missing + 警告一次。
   * 禁止静默 return —— 那等于"death 播不出来就继续站着"。
   */
  set(action, { force = false, fallback = "idle", silent = false } = {}) {
    if (!force && action === this.action) return true;
    let target = action;
    let frames = this.a.frames(this.name, target);
    if (!frames.length && fallback && fallback !== action) {
      target = fallback;
      frames = this.a.frames(this.name, target);
    }
    if (!frames.length) {
      this.missing.add(action);
      if (!silent) console.warn(`[animator] ${this.name}.${action} 缺帧，保持 ${this.action}`);
      return false;
    }
    if (target !== action) {
      this.missing.add(action);
      if (!silent) console.warn(`[animator] ${this.name}.${action} 缺帧，回落 ${target}`);
    }
    this.action = target;
    this.frames = frames;
    this.fps = this.a.fps(this.name, target);
    this.loop = this.a.loop(this.name, target);
    this.anchor = this.a.anchor(this.name, target);
    this.index = 0;
    this.time = 0;
    this.done = false;
    return true;
  }

  /** 朝向：true = 面向左。左右共用一个条带，不产反向帧。 */
  setFacing(flip) {
    this.flip = !!flip;
  }

  /** 换色（造型解锁用）：给同一套帧叠一层色，不重新产图。 */
  setTint(color) {
    if (this.tint === color) return;
    this.tint = color || null;
    this._tintCache = new Map();
  }

  _srcFrame(img) {
    if (!this.tint) return img;
    if (!this._tintCache) this._tintCache = new Map();
    const key = this.tint;
    let cv = this._tintCache.get(key);
    if (!cv) {
      cv = document.createElement("canvas");
      cv.width = img.naturalWidth || img.width;
      cv.height = img.naturalHeight || img.height;
      const c = cv.getContext("2d");
      c.drawImage(img, 0, 0);
      c.globalCompositeOperation = "source-atop";     // 只给不透明像素上色，透明区不动
      c.fillStyle = this.tint;
      c.fillRect(0, 0, cv.width, cv.height);
      this._tintCache.set(key, cv);
    }
    return cv;
  }

  update(dt) {
    if (!this.frames.length || this.done) return;
    this.time += dt * this.fps;
    while (this.time >= 1) {
      this.time -= 1;
      this.index += 1;
      if (this.index >= this.frames.length) {
        if (this.loop) this.index = 0;
        else { this.index = this.frames.length - 1; this.done = true; break; }
      }
    }
  }

  /** 以 (x, y) 为锚点绘制：feet 时 y 是脚底，center 时 y 是包围盒中心。 */
  draw(ctx, x, y) {
    const raw = this.frames[this.index];
    if (!raw) return;
    const img = this._srcFrame(raw);
    const w = (img.naturalWidth || img.width) * this.scale;
    const h = (img.naturalHeight || img.height) * this.scale;
    ctx.save();
    ctx.translate(x, y);
    if (this.flip) ctx.scale(-1, 1);
    const oy = this.anchor === "center" ? -h / 2 : -h;
    ctx.drawImage(img, -w / 2, oy, w, h);
    ctx.restore();
  }
}
