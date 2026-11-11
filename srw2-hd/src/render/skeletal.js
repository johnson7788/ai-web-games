/**
 * 2D 骨骼 cut-in：
 * root → torso → shoulder → upperArm → forearm → hand → weaponSocket → muzzle
 * 身体使用现有侧面立绘（刚性 body 骨骼），手臂/武器/枪口是真正的层级骨骼；
 * 动画由 CombatStateMachine 驱动，fire / impact 通过动画事件回调。
 */
import { CombatStateMachine, TIMELINES } from "../game/combat-fsm.js";

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
const rad = (d) => (d * Math.PI) / 180;

export class Bone {
  constructor(name, parent = null, x = 0, y = 0, rot = 0) {
    this.name = name;
    this.parent = parent;
    this.x = x; this.y = y; this.rot = rot;
    this.world = { x: 0, y: 0, rot: 0 };
    this.children = [];
    if (parent) parent.children.push(this);
  }
  add(name, x = 0, y = 0, rot = 0) { return new Bone(name, this, x, y, rot); }
  update(px = 0, py = 0, pr = 0) {
    const c = Math.cos(pr), s = Math.sin(pr);
    this.world.x = px + this.x * c - this.y * s;
    this.world.y = py + this.x * s + this.y * c;
    this.world.rot = pr + this.rot;
    for (const b of this.children) b.update(this.world.x, this.world.y, this.world.rot);
  }
}

export function weaponSpec(kind, bodyH) {
  const k = kind || "saber";
  const H = bodyH;
  switch (k) {
    case "beam": return { type: "rifle", len: H * 0.24, width: H * 0.026, heavy: false };
    case "spread": return { type: "rifle", len: H * 0.25, width: H * 0.05, heavy: true };
    case "cannon": return { type: "cannon", len: H * 0.32, width: H * 0.055, heavy: true };
    case "map": return { type: "cannon", len: H * 0.36, width: H * 0.07, heavy: true };
    case "mg": return { type: "rifle", len: H * 0.24, width: H * 0.022, heavy: false };
    case "missile": return { type: "launcher", len: H * 0.25, width: H * 0.07, heavy: true };
    case "saber": return { type: "blade", len: H * 0.26, width: H * 0.024, heavy: false };
    case "axe": return { type: "axe", len: H * 0.28, width: H * 0.045, heavy: true };
    case "punch": return { type: "fist", len: H * 0.05, width: H * 0.08, heavy: true };
    case "ball": return { type: "orb", len: H * 0.03, width: H * 0.06, heavy: false };
    case "fire": return { type: "none", len: 0, width: 0, heavy: false };
    default: return { type: "blade", len: H * 0.30, width: H * 0.024, heavy: false };
  }
}

export class SkeletalRig {
  constructor({ base, bodyW, bodyH, palette, facing = 1, kind, color = "#8fe3ff", shape = "mech" }) {
    this.base = base;
    this.bodyW = bodyW;
    this.bodyH = bodyH;
    this.palette = palette || {};
    this.facing = facing;
    this.kind = kind;
    this.color = color;
    this.shape = shape;
    this.spec = weaponSpec(kind, bodyH);
    this.root = new Bone("root", null, base.x, base.y);
    this.torso = this.root.add("torso", 0, -bodyH * 0.44, 0);
    this.shoulder = this.torso.add("shoulder", bodyW * 0.28 * facing, -bodyH * 0.06, 0);
    this.upper = this.shoulder.add("upper", 0, 0, 0);
    this.fore = this.upper.add("fore", bodyH * 0.18, 0, 0);
    this.hand = this.fore.add("hand", bodyH * 0.17, 0, 0);
    this.weapon = this.hand.add("weaponSocket", 0, 0, 0);
    this.muzzle = this.weapon.add("muzzle", this.spec.len, 0, 0);
    this.bodyRot = 0; this.scaleY = 1; this.jump = 0;
  }

  pose(t, state, kind, targetX) {
    const melee = ["saber", "axe", "punch"].includes(kind);
    const H = this.bodyH;
    let rootX = 0, rootY = 0, bodyRot = 0, scaleY = 1;
    let upper = 0.55, fore = -0.35, weapon = 0;
    let jump = 0;

    if (melee) {
      if (state === "windup" || t < 0.34) {
        const w = clamp((t - 0.10) / 0.24);
        scaleY = lerp(1, 0.94, w);
        bodyRot = lerp(0, -0.10, w);
        upper = lerp(0.55, -1.75, w);
        fore = lerp(-0.35, -2.05, w);
        weapon = lerp(0, -1.45, w);
        rootX = -6 * w;
      } else if (state === "attack") {
        const a = clamp((t - 0.34) / 0.26);
        const dist = clamp(targetX - this.base.x - this.bodyW * 0.42, H * 0.35, H * 0.72);
        rootX = dist * easeOut(a);
        jump = Math.sin(Math.PI * a) * H * 0.16;
        scaleY = 0.98;
        bodyRot = lerp(-0.10, 0.14, a);
        upper = lerp(-1.75, -0.15, easeOut(a));
        fore = lerp(-2.05, 0.15, easeOut(a));
        weapon = lerp(-1.45, 0.25, easeOut(a));
      } else if (state === "recover") {
        const r = clamp((t - 0.64) / 0.36);
        const e = easeOut(r);
        rootX = lerp(clamp(targetX - this.base.x - this.bodyW * 0.42, H * 0.35, H * 0.72), 0, e);
        jump = 0;
        bodyRot = lerp(0.14, 0, e);
        upper = lerp(-0.15, 0.55, e);
        fore = lerp(0.15, -0.35, e);
        weapon = lerp(0.25, 0, e);
      } else {
        upper = 0.20; fore = -0.10;
      }
    } else {
      const w = clamp((t - 0.10) / 0.24);
      if (state === "windup" || t < 0.34) {
        bodyRot = lerp(0, -0.035, w);
        upper = lerp(0.20, -0.55, w);
        fore = lerp(-0.10, -0.15, w);
        weapon = lerp(0.05, 0, w);
        rootX = 10 * w;
        scaleY = lerp(1, 0.985, w);
      } else if (state === "attack") {
        const a = clamp((t - 0.34) / 0.30);
        const recoil = Math.sin(Math.PI * clamp((t - 0.38) / 0.20)) * 10;
        rootX = 10 - recoil;
        bodyRot = 0.025 * a;
        upper = -0.50 + 0.06 * a;
        fore = -0.12;
        weapon = 0.02 * a;
        scaleY = 0.985;
      } else if (state === "recover") {
        const r = clamp((t - 0.64) / 0.36);
        rootX = lerp(10, 0, easeOut(r));
        bodyRot = lerp(0.025, 0, easeOut(r));
        upper = lerp(-0.50, 0.20, easeOut(r));
        fore = lerp(-0.12, -0.10, easeOut(r));
        weapon = lerp(0.02, 0.05, easeOut(r));
      } else {
        upper = 0.20; fore = -0.10;
      }
    }

    this.root.x = this.base.x + rootX;
    this.root.y = this.base.y - jump;
    this.torso.rot = bodyRot;
    this.upper.rot = upper;
    this.fore.rot = fore - upper;
    this.hand.rot = 0;
    this.weapon.rot = weapon - (bodyRot + fore);
    this.bodyRot = bodyRot;
    this.scaleY = scaleY;
    this.jump = jump;
    this.root.update();
  }

  drawBody(ctx, img) {
    const H = this.bodyH, W = this.bodyW;
    // 脚下软阴影
    ctx.save();
    ctx.translate(this.root.world.x, this.root.world.y + 2);
    ctx.scale(1, 0.26);
    const sh = ctx.createRadialGradient(0, 0, 2, 0, 0, W * 0.42);
    sh.addColorStop(0, "rgba(0,0,0,0.38)");
    sh.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = sh;
    ctx.beginPath(); ctx.arc(0, 0, W * 0.42, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    ctx.save();
    ctx.translate(this.root.world.x, this.root.world.y);
    ctx.rotate(this.torso.world.rot);
    ctx.scale(1, this.scaleY);
    if (img && img.naturalWidth) {
      ctx.drawImage(img, -W / 2, -H, W, H);
    } else {
      ctx.fillStyle = this.palette.main || "#dbe4f2";
      ctx.fillRect(-W * 0.28, -H, W * 0.56, H);
    }
    ctx.restore();
  }

  drawArm(ctx) {
    if (!["mech", "bulky", "boss", "heavy"].includes(this.shape)) return;
    const p = this.palette;
    const shoulder = this.shoulder.world;
    const elbow = this.fore.world;
    const hand = this.hand.world;
    const outline = "#0a1018";
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = outline; ctx.lineWidth = this.bodyH * 0.060;
    ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(elbow.x, elbow.y); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    ctx.strokeStyle = p.sub || "#4a6fa8"; ctx.lineWidth = this.bodyH * 0.040;
    ctx.beginPath(); ctx.moveTo(shoulder.x, shoulder.y); ctx.lineTo(elbow.x, elbow.y); ctx.stroke();
    ctx.strokeStyle = p.main || "#e6edf8"; ctx.lineWidth = this.bodyH * 0.036;
    ctx.beginPath(); ctx.moveTo(elbow.x, elbow.y); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    ctx.fillStyle = p.sub || "#4a6fa8";
    ctx.beginPath(); ctx.arc(shoulder.x, shoulder.y, this.bodyH * 0.032, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.accent || "#d84b4b";
    ctx.beginPath(); ctx.arc(elbow.x, elbow.y, this.bodyH * 0.022, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = p.main || "#e6edf8";
    ctx.beginPath(); ctx.arc(hand.x, hand.y, this.bodyH * 0.026, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawWeapon(ctx, muzzleFlash = 0, energy = this.color) {
    const s = this.spec;
    if (s.type === "none") return;
    const p = this.palette;
    const x = this.weapon.world.x, y = this.weapon.world.y, a = this.weapon.world.rot;
    ctx.save();
    ctx.translate(x, y); ctx.rotate(a);
    ctx.lineCap = "round";
    const accent = p.accent || "#d84b4b";

    if (s.type === "rifle" || s.type === "cannon") {
      const w = s.width;
      ctx.strokeStyle = "#0b1119"; ctx.lineWidth = w * 1.6;
      ctx.beginPath(); ctx.moveTo(-s.len * 0.28, 0); ctx.lineTo(s.len, 0); ctx.stroke();
      ctx.strokeStyle = "#9aa8ba"; ctx.lineWidth = w * 0.65;
      ctx.beginPath(); ctx.moveTo(-s.len * 0.22, -w * 0.25); ctx.lineTo(s.len * 0.92, -w * 0.25); ctx.stroke();
      ctx.fillStyle = "#1b222d"; ctx.fillRect(-s.len * 0.24, w * 0.1, s.len * 0.22, w * 0.9);
      ctx.fillStyle = accent; ctx.fillRect(s.len * 0.62, -w * 0.6, s.len * 0.10, w * 0.5);
      ctx.fillStyle = "#cfd8e6"; ctx.fillRect(s.len * 0.94, -w * 0.45, w * 0.5, w * 0.9);
    } else if (s.type === "blade") {
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = energy; ctx.lineWidth = s.width * 1.2;
      ctx.shadowColor = energy; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(s.len, 0); ctx.stroke();
      ctx.shadowBlur = 0; ctx.strokeStyle = "#ffffff"; ctx.lineWidth = s.width * 0.35;
      ctx.beginPath(); ctx.moveTo(s.len * 0.08, 0); ctx.lineTo(s.len, 0); ctx.stroke();
      ctx.globalCompositeOperation = "source-over";
      ctx.strokeStyle = "#2a2118"; ctx.lineWidth = s.width * 1.5;
      ctx.beginPath(); ctx.moveTo(-s.len * 0.14, 0); ctx.lineTo(0, 0); ctx.stroke();
    } else if (s.type === "axe") {
      ctx.strokeStyle = "#3a2a1c"; ctx.lineWidth = s.width * 0.7;
      ctx.beginPath(); ctx.moveTo(-s.len * 0.16, 0); ctx.lineTo(s.len * 0.78, 0); ctx.stroke();
      ctx.fillStyle = "#b8c2cf"; ctx.beginPath();
      ctx.moveTo(s.len * 0.70, -s.width * 2.0); ctx.lineTo(s.len * 0.98, 0);
      ctx.lineTo(s.len * 0.70, s.width * 2.0); ctx.closePath(); ctx.fill();
      ctx.fillStyle = energy; ctx.fillRect(s.len * 0.64, -s.width * 0.4, s.len * 0.08, s.width * 0.8);
    } else if (s.type === "launcher") {
      ctx.fillStyle = "#1b222d"; ctx.fillRect(-s.len * 0.25, -s.width * 0.8, s.len * 1.1, s.width * 1.6);
      ctx.strokeStyle = "#9aa8ba"; ctx.lineWidth = s.width * 0.2;
      ctx.strokeRect(-s.len * 0.22, -s.width * 0.7, s.len * 1.02, s.width * 1.4);
      ctx.fillStyle = accent; ctx.fillRect(s.len * 0.55, -s.width * 0.9, s.len * 0.12, s.width * 1.8);
    } else if (s.type === "fist") {
      ctx.fillStyle = "#0b1119"; ctx.beginPath(); ctx.arc(s.len * 0.1, 0, s.width, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.main || "#e6edf8"; ctx.beginPath(); ctx.arc(s.len * 0.1, 0, s.width * 0.78, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = p.sub || "#4a6fa8";
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(s.len * 0.1 + s.width * 0.45, i * s.width * 0.38, s.width * 0.18, 0, Math.PI * 2); ctx.fill(); }
    } else if (s.type === "orb") {
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(0, 0, 1, 0, 0, s.width * 1.4);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.4, energy); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, s.width * 1.4, 0, Math.PI * 2); ctx.fill();
    }
    if (muzzleFlash > 0 && s.type !== "blade" && s.type !== "axe" && s.type !== "fist" && s.type !== "orb") {
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(s.len, 0, 1, s.len, 0, s.width * 5 * muzzleFlash);
      g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, energy); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.len, 0, s.width * 5 * muzzleFlash, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }
}

function drawEffect(ctx, t, kind, muzzle, target, color, hit, fsm) {
  const fireAt = 0.38, impactAt = 0.56;
  const p = clamp((t - fireAt) / (impactAt - fireAt));
  const after = t >= impactAt;
  const fade = after ? clamp(1 - (t - impactAt) / 0.26) : 1;
  const rnd = (i) => (Math.sin(i * 91.7 + 1.3) * 0.5 + 0.5);

  if (t >= fireAt) {
    if (kind === "beam" || kind === "spread" || kind === "ball") {
      const beams = kind === "spread" ? [-0.09, 0, 0.09] : [0];
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (const off of beams) {
        const tx = target.x, ty = target.y + off * 120;
        const hx = lerp(muzzle.x, tx, easeOut(p));
        const hy = lerp(muzzle.y, ty, easeOut(p));
        const grad = ctx.createLinearGradient(muzzle.x, muzzle.y, hx, hy);
        grad.addColorStop(0, color); grad.addColorStop(1, "#ffffff");
        ctx.strokeStyle = grad; ctx.lineWidth = kind === "spread" ? 3 : 5;
        ctx.shadowColor = color; ctx.shadowBlur = 18;
        ctx.beginPath(); ctx.moveTo(muzzle.x, muzzle.y); ctx.lineTo(hx, hy); ctx.stroke();
        if (after && !hit) { ctx.globalAlpha = 0.3; ctx.beginPath(); ctx.moveTo(hx, hy); ctx.lineTo(hx + 70, hy + 12); ctx.stroke(); }
      }
      ctx.restore();
    } else if (kind === "saber" || kind === "axe") {
      const q = clamp((p - 0.25) / 0.6);
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = color; ctx.lineWidth = 6; ctx.shadowColor = color; ctx.shadowBlur = 20;
      ctx.beginPath(); ctx.arc(target.x, target.y, 34 + 16 * q, -1.5 + q * 1.6, -0.2 + q * 1.8); ctx.stroke();
      ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(target.x, target.y, 34 + 16 * q, -1.5 + q * 1.6, -0.2 + q * 1.8); ctx.stroke();
      ctx.restore();
    } else if (kind === "punch") {
      const fxp = lerp(muzzle.x, target.x, easeOut(p));
      const fyp = lerp(muzzle.y, target.y, easeOut(p));
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const g = ctx.createRadialGradient(fxp, fyp, 2, fxp, fyp, 22);
      g.addColorStop(0, "#fff"); g.addColorStop(0.4, color); g.addColorStop(1, "rgba(0,0,0,0)");
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(fxp, fyp, 22, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    } else if (kind === "fire") {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 12; i++) {
        const q = clamp(p - i * 0.04);
        const xx = lerp(muzzle.x + (rnd(i) - 0.5) * 50, target.x, easeOut(q));
        const yy = lerp(muzzle.y + (rnd(i + 9) - 0.5) * 30, target.y, easeOut(q));
        const g = ctx.createRadialGradient(xx, yy, 2, xx, yy, 18 + q * 22);
        g.addColorStop(0, "#fff3b0"); g.addColorStop(0.4, color); g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g; ctx.beginPath(); ctx.arc(xx, yy, 18 + q * 22, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    } else if (kind === "map") {
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      const q = clamp(p);
      ctx.fillStyle = color; ctx.globalAlpha = 0.8 * fade;
      ctx.fillRect(target.x - 30 - q * 10, target.y - 300 * q, 60 + q * 20, 300 * q);
      ctx.fillStyle = "#fff"; ctx.globalAlpha = 0.7 * fade;
      ctx.fillRect(target.x - 7, target.y - 300 * q, 14, 300 * q);
      ctx.restore();
    } else if (kind === "cannon" || kind === "missile" || kind === "mg") {
      const n = kind === "mg" ? 4 : 1;
      ctx.save(); ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < n; i++) {
        const q = clamp(p - i * 0.03);
        const xx = lerp(muzzle.x, target.x, easeOut(q));
        const yy = lerp(muzzle.y, target.y, easeOut(q));
        ctx.fillStyle = i === 0 ? "#fff" : color;
        ctx.beginPath(); ctx.arc(xx, yy, kind === "cannon" ? 9 : 5, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
  }

  if (after && hit) {
    ctx.save(); ctx.globalCompositeOperation = "lighter"; ctx.globalAlpha = fade;
    const g = ctx.createRadialGradient(target.x, target.y, 2, target.x, target.y, 60);
    g.addColorStop(0, "#ffffff"); g.addColorStop(0.35, color); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(target.x, target.y, 60, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = "#ffffff"; ctx.lineWidth = 2;
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * Math.PI * 2;
      ctx.beginPath(); ctx.moveTo(target.x + Math.cos(a) * 12, target.y + Math.sin(a) * 12);
      ctx.lineTo(target.x + Math.cos(a) * (38 + 18 * (1 - fade)), target.y + Math.sin(a) * (38 + 18 * (1 - fade))); ctx.stroke();
    }
    ctx.restore();
  }
}

export async function playSkeletalCombat(canvas, {
  attackerEl, defenderEl, anim, palette, fast = false, hit = true, onEvent, shape = "mech", parts = null, quick = false,
} = {}) {
  if (!canvas || !attackerEl || !defenderEl) return;
  const img = attackerEl;
  if (!img.complete) { try { await img.decode(); } catch { /* fallback */ } }
  const rect = canvas.getBoundingClientRect();
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const rel = (el) => {
    const r = el.getBoundingClientRect();
    return { x: r.left - rect.left, y: r.top - rect.top, w: r.width, h: r.height };
  };
  const A = rel(attackerEl), B = rel(defenderEl);
  const base = { x: A.x + A.w * 0.5, y: A.y + A.h * 0.985 };
  const bodyH = A.h * 0.97;
  const bodyW = Math.max(80, bodyH * ((img.naturalWidth || 150) / (img.naturalHeight || 256)));
  const kind = anim.kind;
  const color = anim.color || "#8fe3ff";
  const humanoid = ["mech", "bulky", "boss", "heavy"].includes(shape);
  const layered = !!(parts && parts.head && parts["arm-r"] && parts["leg-r"]);
  const partImages = layered ? await loadPartImages(parts) : null;
  const rig = layered
    ? new LayeredRig({ base, bodyH, parts, images: partImages, palette, kind, color, shape })
    : new SkeletalRig({ base, bodyW, bodyH, palette, facing: 1, kind, color, shape });
  const fsm = new CombatStateMachine({ fast, timeline: quick ? TIMELINES.quick : null });
  const timeline = fsm.timeline;
  const duration = timeline.duration;
  const target = { x: B.x + B.w * 0.40, y: B.y + B.h * 0.44 };

  return new Promise((resolve) => {
    let start = 0;
    const frame = (now) => {
      if (!start) start = now;
      const t = clamp((now - start) / duration);
      const events = fsm.update(t);
      for (const e of events) if (onEvent) onEvent(e.type, e);
      rig.pose(t, fsm.state, kind, target.x);
      ctx.clearRect(0, 0, rect.width, rect.height);
      if (layered) {
        rig.drawBody(ctx);
      } else {
        rig.drawBody(ctx, img);
        rig.drawArm(ctx);
      }
      const flash = fsm.fired ? clamp(1 - (t - 0.38) / 0.12) : 0;
      rig.drawWeapon(ctx, flash, color);
      const muzzle = layered ? rig.muzzle : rig.muzzle.world;
      const effectOrigin = kind === "fire"
        ? (layered ? { x: rig.base.x + rig.rootX, y: rig.base.y - bodyH * 0.55 } : { x: rig.torso.world.x, y: rig.torso.world.y })
        : muzzle;
      drawEffect(ctx, t, kind, effectOrigin, target, color, hit, fsm);
      if (t < 1) requestAnimationFrame(frame);
      else { ctx.clearRect(0, 0, rect.width, rect.height); resolve(); }
    };
    requestAnimationFrame(frame);
  });
}

/* ------------------------------------------------------------------ 分层纸偶
 * 使用 tools/build_unit_parts.py 生成的 6 层（head/torso/arm-l/arm-r/leg-l/leg-r）。
 * 静止时六层按原始偏移叠回去与原图逐像素一致；播放时围绕颈/肩/髋旋转。
 */
export class LayeredRig {
  constructor({ base, bodyH, parts, images, palette, kind, color, shape }) {
    this.base = base;
    this.parts = parts;
    this.images = images;
    this.palette = palette || {};
    this.kind = kind;
    this.color = color;
    this.shape = shape;
    this.fullW = parts.head.fullW;
    this.fullH = parts.head.fullH;
    this.s = bodyH / this.fullH;
    this.originX = base.x - (this.fullW * this.s) / 2;
    this.originY = base.y - this.fullH * this.s;
    this.spec = weaponSpec(kind, bodyH);
    this.rootX = 0; this.rootY = 0;
    this.torsoRot = 0; this.headRot = 0;
    this.armL = 0; this.armR = 0; this.legL = 0; this.legR = 0;
    this.weaponAngle = 0;
    this.hand = { x: 0, y: 0 };
    this.muzzle = { x: 0, y: 0 };
  }

  pivot(name) {
    const p = this.parts[name];
    return { x: p.x + p.pivotX, y: p.y + p.pivotY };
  }

  rotateAround(pt, c, a) {
    const dx = pt.x - c.x, dy = pt.y - c.y;
    const co = Math.cos(a), si = Math.sin(a);
    return { x: c.x + dx * co - dy * si, y: c.y + dx * si + dy * co };
  }

  worldPivot(name) {
    const tp = this.pivot("torso");
    let p = this.pivot(name);
    if (["head", "arm-l", "arm-r", "torso-back"].includes(name)) p = this.rotateAround(p, tp, this.torsoRot);
    return {
      x: this.originX + p.x * this.s + this.rootX,
      y: this.originY + p.y * this.s + this.rootY,
    };
  }

  pose(t, state, kind, targetX) {
    const melee = ["saber", "axe", "punch"].includes(kind);
    let rootX = 0, rootY = 0, torso = 0, head = 0;
    let armR = 0.1, armL = -0.05, legL = 0, legR = 0, weapon = 0;
    const H = this.fullH * this.s;
    if (melee) {
      if (state === "windup" || t < 0.34) {
        const w = clamp((t - 0.10) / 0.24);
        rootX = -6 * w; torso = -0.10 * w; head = -0.05 * w;
        armR = lerp(0.1, -1.55, w); armL = lerp(-0.05, 0.25, w);
        weapon = lerp(0, -1.3, w);
      } else if (state === "attack") {
        const a = clamp((t - 0.34) / 0.26);
        const dist = clamp(targetX - this.base.x - (this.fullW * this.s) * 0.42, H * 0.35, H * 0.72);
        rootX = dist * easeOut(a);
        rootY = -Math.sin(Math.PI * a) * H * 0.16;
        torso = lerp(-0.10, 0.14, a); head = lerp(-0.05, 0.05, a);
        armR = lerp(-1.55, -0.15, easeOut(a)); armL = lerp(0.25, -0.2, easeOut(a));
        weapon = lerp(-1.3, 0.25, easeOut(a));
      } else if (state === "recover") {
        const r = clamp((t - 0.64) / 0.36), e = easeOut(r);
        const dist = clamp(targetX - this.base.x - (this.fullW * this.s) * 0.42, H * 0.35, H * 0.72);
        rootX = lerp(dist, 0, e);
        torso = lerp(0.14, 0, e); head = lerp(0.05, 0, e);
        armR = lerp(-0.15, 0.1, e); armL = lerp(-0.2, -0.05, e);
        weapon = lerp(0.25, 0, e);
      }
    } else {
      const w = clamp((t - 0.10) / 0.24);
      if (state === "windup" || t < 0.34) {
        rootX = 10 * w; torso = -0.035 * w; head = 0.02 * w;
        armR = lerp(0.1, -0.5, w); armL = lerp(-0.05, -0.3, w);
        weapon = 0.02 * w;
      } else if (state === "attack") {
        const a = clamp((t - 0.34) / 0.30);
        const recoil = Math.sin(Math.PI * clamp((t - 0.38) / 0.20)) * 10;
        rootX = 10 - recoil; torso = 0.03 * a; head = -0.02 * a;
        armR = -0.5 + 0.05 * a; armL = -0.3; weapon = 0.02;
      } else if (state === "recover") {
        const r = clamp((t - 0.64) / 0.36), e = easeOut(r);
        rootX = lerp(10, 0, e); torso = lerp(0.03, 0, e); head = lerp(-0.02, 0, e);
        armR = lerp(-0.5, 0.1, e); armL = lerp(-0.3, -0.05, e); weapon = lerp(0.02, 0, e);
      }
    }
    this.rootX = rootX; this.rootY = rootY;
    // 侧面立绘的层与层之间是紧贴的，任何局部旋转都会露缝；
    // 这里保留完整六层（静态），只让 root 位移 + 武器/枪口做动作。
    this.torsoRot = 0; this.headRot = 0;
    this.armR = 0; this.armL = 0;
    this.legL = 0; this.legR = 0;
    this.weaponAngle = weapon;
    // 手掌取 arm-r 前下方
    const p = this.parts["arm-r"];
    const ap = this.pivot("arm-r"), tp = this.pivot("torso");
    let hand = { x: p.x + p.w * 0.88, y: p.y + p.h * 0.82 };
    hand = this.rotateAround(hand, ap, armR);
    hand = this.rotateAround(hand, tp, torso);
    this.hand = {
      x: this.originX + hand.x * this.s + rootX,
      y: this.originY + hand.y * this.s + rootY,
    };
    const wa = torso + armR + weapon;
    this.muzzle = {
      x: this.hand.x + Math.cos(wa) * this.spec.len * this.s,
      y: this.hand.y + Math.sin(wa) * this.spec.len * this.s,
    };
  }

  drawPart(ctx, name, angle) {
    const p = this.parts[name], img = this.images[name];
    if (!p || !img) return;
    const w = this.worldPivot(name);
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(angle);
    ctx.drawImage(img, -p.pivotX * this.s, -p.pivotY * this.s, p.w * this.s, p.h * this.s);
    ctx.restore();
  }

  drawBody(ctx) {
    const s = this.s, base = { x: this.originX + this.rootX, y: this.originY + this.rootY };
    // 脚下软阴影
    ctx.save();
    ctx.translate(base.x + this.fullW * s / 2, base.y + this.fullH * s + 2);
    ctx.scale(1, 0.25);
    const g = ctx.createRadialGradient(0, 0, 2, 0, 0, this.fullW * s * 0.34);
    g.addColorStop(0, "rgba(0,0,0,0.36)"); g.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, this.fullW * s * 0.34, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
    this.drawPart(ctx, "torso", 0);
    this.drawPart(ctx, "head", 0);
    this.drawPart(ctx, "arm-l", 0);
    this.drawPart(ctx, "arm-r", 0);
    this.drawPart(ctx, "leg-l", 0);
    this.drawPart(ctx, "leg-r", 0);
    this.drawSupportArm(ctx);
  }

  drawSupportArm(ctx) {
    if (!["mech", "bulky", "boss", "heavy"].includes(this.shape)) return;
    const sh = this.worldPivot("arm-r");
    const hand = this.hand;
    const mx = (sh.x + hand.x) / 2, my = (sh.y + hand.y) / 2;
    const p = this.palette;
    ctx.save();
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0a1018"; ctx.lineWidth = this.fullH * this.s * 0.050;
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(mx, my); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    ctx.strokeStyle = p.sub || "#4a6fa8"; ctx.lineWidth = this.fullH * this.s * 0.034;
    ctx.beginPath(); ctx.moveTo(sh.x, sh.y); ctx.lineTo(mx, my); ctx.stroke();
    ctx.strokeStyle = p.main || "#e6edf8"; ctx.lineWidth = this.fullH * this.s * 0.030;
    ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(hand.x, hand.y); ctx.stroke();
    ctx.fillStyle = p.accent || "#d84b4b";
    ctx.beginPath(); ctx.arc(mx, my, this.fullH * this.s * 0.018, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  drawWeapon(ctx, flash = 0) {
    const fake = {
      spec: this.spec, palette: this.palette, color: this.color,
      weapon: { world: { x: this.hand.x, y: this.hand.y, rot: this.torsoRot + this.armR + this.weaponAngle } },
    };
    SkeletalRig.prototype.drawWeapon.call(fake, ctx, flash, this.color);
  }
}

async function loadPartImages(parts) {
  const out = {};
  await Promise.all(Object.entries(parts).map(async ([name, p]) => {
    const im = new Image();
    im.src = p.file;
    try { await im.decode(); } catch { /* ignore */ }
    out[name] = im;
  }));
  return out;
}
