/**
 * src/render/combat-anim.js — 按武器类型播放的战斗动作演出。
 *
 * 不依赖图片序列：用 Canvas2D 程序化绘制光束、斩击、拳击、火焰、炮击、
 * 机枪、导弹、地图兵器等效果，配合 cut-in 两侧立绘的冲刺/受击 CSS 动画。
 *
 * 对外：
 *   weaponAnim(weapon) -> { kind, color, label, impact, duration }
 *   playCombatFx(canvas, { anim, fast, onImpact }) -> Promise
 */

const PALETTE = {
  beam: "#7fd4ff",
  spread: "#8fe6ff",
  saber: "#9ff0ff",
  axe: "#ffb45c",
  punch: "#ffd27a",
  fire: "#ff8a3c",
  cannon: "#ffcf7a",
  mg: "#ffe9a8",
  missile: "#ffb35c",
  map: "#b9e8ff",
  ball: "#c9a6ff"
};

export function weaponAnim(weapon = {}) {
  const name = weapon.name || "";
  const kind = weapon.kind || "melee";
  const pick = (k, label, extra = {}) => ({
    kind: k, label, color: PALETTE[k] || "#fff",
    impact: k === "map" ? 0.34 : 0.52,
    duration: k === "map" ? 900 : k === "missile" || k === "spread" ? 800 : 720,
    ...extra
  });
  if (/地图/.test(name)) return pick("map", "MAP");
  if (/扩散/.test(name)) return pick("spread", "SPREAD");
  if (/导弹|弹头/.test(name)) return pick("missile", "MISSILE");
  if (/火箭飞拳/.test(name)) return pick("punch", "ROCKET PUNCH", { rocket: true });
  if (/火焰/.test(name)) return pick("fire", "FIRE");
  if (/斧/.test(name)) return pick("axe", "AXE");
  if (/军刀|光束刀|剑|サーベル/.test(name)) return pick("saber", "SABER");
  if (/机枪|机炮|バルカン/.test(name)) return pick("mg", "VULCAN");
  if (/加农|主炮|舰炮|固定炮|キャノン/.test(name)) return pick("cannon", "CANNON");
  if (/格斗|拳|踢|パンチ/.test(name)) return pick("punch", "PUNCH");
  if (/光弹|反射光/.test(name)) return pick("ball", "ENERGY BALL");
  if (/光束|ビーム|射线|激光|步枪/.test(name)) return pick("beam", "BEAM");
  if (kind === "beam") return pick("beam", "BEAM");
  if (kind === "fire") return pick("fire", "FIRE");
  if (kind === "gun") return pick("mg", "GUN");
  return pick("saber", "BLADE");
}

const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const easeOut = (t) => 1 - Math.pow(1 - t, 3);

function hexA(hex, a) {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

function radial(ctx, x, y, r, color, alpha = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, Math.max(1, r));
  g.addColorStop(0, hexA("#ffffff", alpha));
  g.addColorStop(0.25, hexA(color, alpha * 0.95));
  g.addColorStop(1, hexA(color, 0));
  ctx.fillStyle = g;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(1, r), 0, Math.PI * 2);
  ctx.fill();
}

function glowLine(ctx, x1, y1, x2, y2, width, color, alpha = 1) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = hexA(color, alpha);
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.shadowColor = color;
  ctx.shadowBlur = width * 2.2;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.restore();
}

function star(ctx, x, y, r, color, alpha = 1, points = 8) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  ctx.strokeStyle = hexA(color, alpha);
  ctx.lineWidth = 2.5;
  ctx.shadowColor = color;
  ctx.shadowBlur = 12;
  for (let i = 0; i < points; i++) {
    const a = (i / points) * Math.PI * 2 + 0.2;
    const rr = i % 2 ? r * 0.45 : r;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    ctx.stroke();
  }
  ctx.restore();
}

function sparkBurst(list, x, y, color, n = 16, speed = 260) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const v = speed * (0.35 + Math.random() * 0.9);
    list.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v, life: 0.6 + Math.random() * 0.5, max: 1, size: 2 + Math.random() * 4, color });
  }
}

function updateParticles(list, dt) {
  for (const p of list) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 380 * dt;
    p.vx *= 0.985;
    p.life -= dt;
  }
}

function drawParticles(ctx, list) {
  ctx.save();
  ctx.globalCompositeOperation = "lighter";
  for (const p of list) {
    const a = clamp(p.life / 0.7);
    ctx.fillStyle = hexA(p.color, a);
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * (0.4 + a * 0.8), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

const _muzzleCache = new Map();

/** 从侧面立绘的 alpha 通道找“最靠前的武器/手”位置（归一化 0..1）。 */
function muzzleOf(img) {
  if (!img || !img.naturalWidth || !img.naturalHeight) return null;
  const key = img.currentSrc || img.src;
  if (_muzzleCache.has(key)) return _muzzleCache.get(key);
  try {
    const w = img.naturalWidth, h = img.naturalHeight;
    const c = document.createElement("canvas");
    c.width = w; c.height = h;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.drawImage(img, 0, 0, w, h);
    const d = g.getImageData(0, 0, w, h).data;
    let minY = h, maxY = -1, right = -1, rightY = -1;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (d[(y * w + x) * 4 + 3] < 24) continue;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
    if (maxY < 0) return null;
    const bandTop = minY + (maxY - minY) * 0.15;
    const bandBottom = minY + (maxY - minY) * 0.72;
    let sumY = 0, nY = 0;
    for (let x = w - 1; x >= 0 && right < 0; x--) {
      for (let y = Math.floor(bandTop); y <= Math.ceil(bandBottom); y++) {
        if (y < 0 || y >= h) continue;
        if (d[(y * w + x) * 4 + 3] >= 24) { sumY += y; nY += 1; }
      }
      if (nY) right = x;
      rightY = nY ? sumY / nY : -1;
    }
    if (right < 0) return null;
    // 如果最靠前的像素太靠后（手臂没伸出来），仍用它，但至少不会从身体中心发射
    const pt = { x: right / w, y: (rightY >= 0 ? rightY : (bandTop + bandBottom) / 2) / h };
    _muzzleCache.set(key, pt);
    return pt;
  } catch {
    return null;
  }
}

function positions(canvas, attackerEl) {
  const root = canvas.closest("#cutin") || canvas.parentElement;
  const a = root.querySelector("#cutinA");
  const b = root.querySelector("#cutinB");
  const cr = canvas.getBoundingClientRect();
  const ra = a ? a.getBoundingClientRect() : null;
  const rb = b ? b.getBoundingClientRect() : null;
  const rel = (r) => r ? { x: r.left - cr.left, y: r.top - cr.top, w: r.width, h: r.height } : null;
  const A = rel(ra) || { x: cr.width * 0.12, y: cr.height * 0.2, w: cr.width * 0.32, h: cr.height * 0.55 };
  const B = rel(rb) || { x: cr.width * 0.56, y: cr.height * 0.2, w: cr.width * 0.32, h: cr.height * 0.55 };
  const pt = attackerEl ? muzzleOf(attackerEl) : null;
  const origin = pt
    ? { x: A.x + pt.x * A.w, y: A.y + pt.y * A.h }
    : { x: A.x + A.w * 0.74, y: A.y + A.h * 0.46 };
  return {
    origin,
    centerA: { x: A.x + A.w * 0.5, y: A.y + A.h * 0.45 },
    target: { x: B.x + B.w * 0.38, y: B.y + B.h * 0.42 },
    centerB: { x: B.x + B.w * 0.5, y: B.y + B.h * 0.45 },
    w: cr.width, h: cr.height
  };
}

function weaponOrigin(P, shape) {
  const o = { ...P.origin };
  if (["mech", "bulky", "boss", "heavy"].includes(shape)) o.x += 44;
  else if (shape === "turret") o.x += 22;
  return o;
}

/** 攻击前摇：把武器举到身前/蓄力，画瞄准线，再交给 playCombatFx 开火。 */
export function playWindup(canvas, { anim, attackerEl = null, shape = "mech", fast = false } = {}) {
  if (!canvas || !anim) return Promise.resolve();
  const root = canvas.closest("#cutin") || canvas.parentElement;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = positions(canvas, attackerEl);
  const origin = weaponOrigin(P, shape);
  const target = P.target;
  const kind = anim.kind;
  const color = anim.color || "#fff";
  const dur = fast ? 200 : 420;
  let start = 0;
  let raf = 0;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const total = reduced ? 120 : dur;

  function frame(now) {
    if (!start) start = now;
    const t = clamp((now - start) / total);
    const e = easeOut(t);
    ctx.clearRect(0, 0, P.w, P.h);
    if (kind === "saber" || kind === "axe") {
      const angle = lerp(-2.25, -0.42, e);
      drawBlade(ctx, origin.x, origin.y, angle, kind === "axe", color, 0.35 + 0.65 * e);
      radial(ctx, P.centerA.x, P.centerA.y, 34 + 26 * e, color, 0.18 * e);
    } else if (kind === "punch") {
      const fx = lerp(P.centerA.x - 34, origin.x, e);
      const fy = lerp(P.centerA.y + 14, origin.y, e);
      drawFist(ctx, fx, fy, 0.5 + 0.5 * e);
      for (let i = 0; i < 3; i++) glowLine(ctx, fx - 30 - i * 10, fy, fx - 8, fy, 2, color, 0.25);
    } else if (kind === "fire") {
      radial(ctx, P.centerA.x, P.centerA.y, 18 + 46 * e, "#ff8a3c", 0.75 * e);
    } else if (kind === "map") {
      drawReticle(ctx, target.x, target.y, 0.35 + 0.4 * e);
      radial(ctx, target.x, target.y, 20 + 40 * e, color, 0.25 * e);
    } else {
      const x = lerp(origin.x - 30, origin.x, e);
      const y = lerp(origin.y + 24, origin.y, e);
      const angle = lerp(0.55, -0.03, e);
      drawRifle(ctx, x, y, angle, kind === "cannon", color, 0.4 + 0.6 * e);
      if (e > 0.5) {
        const a = (e - 0.5) / 0.5;
        ctx.save();
        ctx.globalAlpha = 0.22 * a;
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([5, 8]);
        ctx.beginPath();
        ctx.moveTo(origin.x, origin.y);
        ctx.lineTo(target.x, target.y);
        ctx.stroke();
        ctx.restore();
        drawReticle(ctx, target.x, target.y, 0.25 + 0.5 * a);
      }
      radial(ctx, origin.x, origin.y, 5 + 18 * e, color, 0.75 * e);
    }
    if (t < 1) raf = requestAnimationFrame(frame);
    else { cancelAnimationFrame(raf); ctx.clearRect(0, 0, P.w, P.h); }
  }
  raf = requestAnimationFrame(frame);
  return new Promise((resolve) => window.setTimeout(() => {
    cancelAnimationFrame(raf);
    ctx.clearRect(0, 0, P.w, P.h);
    resolve();
  }, total + 20));
}

function drawRifle(ctx, x, y, angle, heavy, color, alpha) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
  const len = heavy ? 64 : 50;
  ctx.strokeStyle = "#141920"; ctx.lineWidth = heavy ? 10 : 7; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-len, 0); ctx.lineTo(-2, 0); ctx.stroke();
  ctx.strokeStyle = "#94a1b3"; ctx.lineWidth = heavy ? 4 : 2.5;
  ctx.beginPath(); ctx.moveTo(-len + 4, -2); ctx.lineTo(-8, -2); ctx.stroke();
  ctx.fillStyle = "#2b313b";
  ctx.fillRect(-16, 3, 14, 11);
  ctx.fillRect(-6, 2, 8, 6);
  ctx.fillStyle = "#cfd8e6";
  ctx.fillRect(-2, -3, 3, 6);
  ctx.restore();
  radial(ctx, x + Math.cos(angle) * 2, y + Math.sin(angle) * 2, 8 + 14 * alpha, color, 0.65);
}

function drawBlade(ctx, x, y, angle, heavy, color, alpha) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
  ctx.globalCompositeOperation = "lighter";
  const len = heavy ? 118 : 98;
  const grad = ctx.createLinearGradient(0, 0, len, 0);
  grad.addColorStop(0, hexA("#ffffff", 0.95));
  grad.addColorStop(0.35, hexA(color, 0.85));
  grad.addColorStop(1, hexA(color, 0.15));
  ctx.strokeStyle = grad; ctx.lineWidth = heavy ? 14 : 9; ctx.lineCap = "round";
  ctx.shadowColor = color; ctx.shadowBlur = 24;
  ctx.beginPath(); ctx.moveTo(0, 0); ctx.lineTo(len, 0); ctx.stroke();
  ctx.restore();
  ctx.save();
  ctx.translate(x, y); ctx.rotate(angle); ctx.globalAlpha = alpha;
  if (heavy) {
    ctx.fillStyle = "#c9d3e3";
    ctx.beginPath(); ctx.moveTo(len - 10, -20); ctx.lineTo(len + 2, 0); ctx.lineTo(len - 10, 20); ctx.closePath(); ctx.fill();
  }
  ctx.strokeStyle = "#3a2a1c"; ctx.lineWidth = 8; ctx.lineCap = "round";
  ctx.beginPath(); ctx.moveTo(-10, 0); ctx.lineTo(20, 0); ctx.stroke();
  ctx.restore();
}

function drawFist(ctx, x, y, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.globalCompositeOperation = "lighter";
  radial(ctx, x, y, 26, "#ffd27a", 0.85);
  ctx.fillStyle = "#ffe8bd";
  ctx.beginPath(); ctx.arc(x, y, 15, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = "#8a5a35";
  for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + 8, y + i * 9, 4, 0, Math.PI * 2); ctx.fill(); }
  ctx.restore();
}

function drawReticle(ctx, x, y, alpha) {
  ctx.save(); ctx.globalAlpha = alpha; ctx.strokeStyle = "#bfefff"; ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.arc(x, y, 18, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(x - 26, y); ctx.lineTo(x - 6, y); ctx.moveTo(x + 6, y); ctx.lineTo(x + 26, y);
  ctx.moveTo(x, y - 26); ctx.lineTo(x, y - 6); ctx.moveTo(x, y + 6); ctx.lineTo(x, y + 26); ctx.stroke();
  ctx.restore();
}

export function playCombatFx(canvas, { anim, fast = false, onImpact, attackerEl = null, shape = "mech", hit = true } = {}) {
  if (!canvas || !anim) return Promise.resolve();
  const root = canvas.closest("#cutin") || canvas.parentElement;
  const reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const rect = canvas.getBoundingClientRect();
  canvas.width = Math.max(1, Math.round(rect.width * dpr));
  canvas.height = Math.max(1, Math.round(rect.height * dpr));
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const P = positions(canvas, attackerEl);
  // 把枪口再向前伸出一段，确保光束从“武器尖端”而不是身体发出
  P.origin = weaponOrigin(P, shape);
  const color = anim.color || "#fff";
  const isHit = hit !== false;
  const dur = reduced ? 220 : (fast ? 380 : anim.duration || 720);
  let impacted = false;
  let raf = 0;
  let start = 0;
  const particles = [];
  const smoke = [];

  const doImpact = () => {
    if (impacted) return;
    impacted = true;
    if (onImpact) onImpact();
    if (isHit) sparkBurst(particles, P.target.x, P.target.y, color, anim.kind === "map" ? 36 : 20, 300);
    if (isHit && (anim.kind === "cannon" || anim.kind === "missile" || anim.kind === "map")) {
      for (let i = 0; i < 10; i++) {
        smoke.push({ x: P.target.x, y: P.target.y, r: 18 + Math.random() * 26, vx: 30 * (Math.random() - 0.5), vy: -40 * Math.random(), life: 0.9 });
      }
    }
  };

  function frame(now) {
    if (!start) start = now;
    const elapsed = now - start;
    const t = clamp(elapsed / dur);
    const dt = Math.min(0.05, (now - (frame.last || now)) / 1000);
    frame.last = now;
    ctx.clearRect(0, 0, P.w, P.h);
    draw(ctx, t, anim, P, particles, smoke, color, shape, isHit);
    updateParticles(particles, dt);
    drawParticles(ctx, particles);
    for (const s of smoke) {
      s.x += s.vx * dt; s.y += s.vy * dt; s.r += 26 * dt; s.life -= dt;
      ctx.save();
      ctx.globalAlpha = clamp(s.life) * 0.25;
      ctx.fillStyle = "#5c6470";
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    if (!impacted && t >= (anim.impact || 0.52)) doImpact();
    if (t < 1) {
      raf = requestAnimationFrame(frame);
    } else {
      ctx.clearRect(0, 0, P.w, P.h);
      if (!impacted) doImpact();
    }
  }
  raf = requestAnimationFrame(frame);
  return new Promise((resolve) => {
    window.setTimeout(() => {
      cancelAnimationFrame(raf);
      if (!impacted) doImpact();
      ctx.clearRect(0, 0, P.w, P.h);
      resolve();
    }, dur + 20);
  });
}

function drawBarrel(ctx, x, y, color, heavy = false) {
  const len = heavy ? 58 : 46;
  ctx.save();
  ctx.strokeStyle = "#11151c";
  ctx.lineWidth = heavy ? 11 : 8;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(x - len, y);
  ctx.lineTo(x - 3, y);
  ctx.stroke();
  ctx.strokeStyle = "#8b97a8";
  ctx.lineWidth = heavy ? 5 : 3;
  ctx.beginPath();
  ctx.moveTo(x - len + 3, y - 1.5);
  ctx.lineTo(x - 7, y - 1.5);
  ctx.stroke();
  ctx.fillStyle = "#1b2028";
  ctx.fillRect(x - 6, y - (heavy ? 8 : 6), 8, heavy ? 16 : 12);
  ctx.strokeStyle = "#cfd8e6";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 6, y - (heavy ? 8 : 6));
  ctx.lineTo(x + 2, y - (heavy ? 8 : 6));
  ctx.moveTo(x - 6, y + (heavy ? 8 : 6));
  ctx.lineTo(x + 2, y + (heavy ? 8 : 6));
  ctx.stroke();
  ctx.restore();
}

function draw(ctx, t, anim, P, particles, smoke, color, shape = "mech", isHit = true) {
  const { origin, target, centerA, centerB } = P;
  const kind = anim.kind;
  const fade = t > 0.75 ? 1 - (t - 0.75) / 0.25 : 1;
  const ranged = ["beam", "spread", "cannon", "mg", "missile", "ball"].includes(kind);
  const noBarrel = ["beast", "mirror", "missile"].includes(shape);
  if (ranged && !noBarrel) {
    drawBarrel(ctx, origin.x, origin.y, color, kind === "cannon");
    if (t < 0.2) {
      radial(ctx, origin.x, origin.y, 8 + 26 * (t / 0.2), color, 0.9);
      for (let i = 0; i < 5; i++) {
        const a = -0.5 + i * 0.25;
        glowLine(ctx, origin.x, origin.y, origin.x + Math.cos(a) * 36, origin.y + Math.sin(a) * 36, 2, color, 0.7);
      }
    }
  }

  if (kind === "beam" || kind === "spread" || kind === "ball") {
    if (t < 0.24) radial(ctx, origin.x, origin.y, 10 + 34 * (t / 0.24), color, 0.9);
    const head = easeOut(clamp((t - 0.12) / 0.34));
    if (kind === "ball") {
      const p = easeOut(clamp((t - 0.08) / 0.42));
      const x = lerp(origin.x, target.x, p), y = lerp(origin.y, target.y, p) - Math.sin(p * Math.PI) * 24;
      radial(ctx, x, y, 16 + Math.sin(t * 30) * 3, color, 1);
      ctx.fillStyle = "#fff";
      ctx.beginPath(); ctx.arc(x, y, 4, 0, Math.PI * 2); ctx.fill();
      return;
    }
    const beams = kind === "spread" ? [-26, 0, 26] : [0];
    for (let bi = 0; bi < beams.length; bi++) {
      const off = beams[bi];
      const h = clamp(head - bi * 0.06);
      if (h <= 0) continue;
      const tx = target.x + off * 0.2, ty = target.y + off;
      const ex = lerp(origin.x, tx, h), ey = lerp(origin.y, ty, h);
      ctx.globalAlpha = fade;
      glowLine(ctx, origin.x, origin.y, ex, ey, 16, color, 0.22);
      glowLine(ctx, origin.x, origin.y, ex, ey, 7, color, 0.85);
      glowLine(ctx, origin.x, origin.y, ex, ey, 2, "#ffffff", 0.95);
      ctx.globalAlpha = 1;
    }
    if (t > (anim.impact || 0.52) && isHit) {
      radial(ctx, target.x, target.y, 60 * clamp((t - 0.5) / 0.25), color, 1.2);
      star(ctx, target.x, target.y, 46 + 40 * clamp((t - 0.5) / 0.3), color, 0.9, 10);
    }
    if (t > (anim.impact || 0.52) && !isHit) {
      glowLine(ctx, target.x, target.y, target.x + 120, target.y + 18, 2, color, 0.25 * (1 - t));
    }
    return;
  }

  if (kind === "saber" || kind === "axe") {
    const heavy = kind === "axe";
    const charge = clamp(t / 0.28);
    if (t < 0.42) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const len = 80 + 90 * charge;
      const ang = -1.1 + charge * 0.5;
      ctx.strokeStyle = hexA(heavy ? "#ffb45c" : "#bff6ff", 0.9);
      ctx.lineWidth = heavy ? 12 : 8;
      ctx.shadowColor = color; ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.moveTo(origin.x, origin.y);
      ctx.lineTo(origin.x + Math.cos(ang) * len, origin.y + Math.sin(ang) * len);
      ctx.stroke();
      ctx.restore();
    }
    const s = clamp((t - 0.28) / 0.3);
    if (s > 0) {
      const radius = heavy ? 110 : 92;
      const a0 = -1.9, a1 = a0 + (heavy ? 3.4 : 2.8) * s;
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let k = 0; k < 2; k++) {
        const g = ctx.createLinearGradient(target.x - radius, target.y - radius, target.x + radius, target.y + radius);
        g.addColorStop(0, hexA(color, 0));
        g.addColorStop(0.55, hexA("#ffffff", 0.95));
        g.addColorStop(1, hexA(color, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = (heavy ? 16 : 11) - k * 3;
        ctx.shadowColor = color; ctx.shadowBlur = 24;
        ctx.beginPath();
        ctx.arc(target.x - 8, target.y, radius - k * 14, a0, a1);
        ctx.stroke();
      }
      ctx.restore();
      if (s > 0.55 && isHit) {
        star(ctx, target.x, target.y, 54 + 40 * (s - 0.55), heavy ? "#ffcf7a" : "#bff6ff", 0.9, 12);
      }
    }
    return;
  }

  if (kind === "punch") {
    const p = easeOut(clamp((t - 0.06) / 0.36));
    const x = lerp(centerA.x, target.x, p);
    const y = lerp(centerA.y, target.y, p);
    if (p < 1) {
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 3; i++) glowLine(ctx, x - 40 - i * 12, y, x - 6, y, 3, color, 0.35);
      radial(ctx, x, y, 24, color, 0.9);
      ctx.fillStyle = "#ffe8bd";
      ctx.beginPath(); ctx.arc(x, y, 14, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = hexA("#8a5a35", 0.9);
      for (let i = -1; i <= 1; i++) { ctx.beginPath(); ctx.arc(x + 8, y + i * 9, 4, 0, Math.PI * 2); ctx.fill(); }
      ctx.restore();
    }
    if (t > 0.42 && isHit) {
      star(ctx, target.x, target.y, 58 + 45 * clamp((t - 0.42) / 0.3), color, 0.95, 10);
      radial(ctx, target.x, target.y, 48, color, 0.8);
    }
    return;
  }

  if (kind === "fire") {
    const p = clamp((t - 0.08) / 0.5);
    if (p > 0) {
      const x = lerp(centerA.x, target.x, p), y = lerp(centerA.y, target.y, p);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      for (let i = 0; i < 18; i++) {
        const a = Math.random() * Math.PI * 2;
        const r = 12 + Math.random() * (30 + 60 * p);
        const px = lerp(centerA.x, x, Math.random()) + Math.cos(a) * r * 0.5;
        const py = lerp(centerA.y, y, Math.random()) + Math.sin(a) * r * 0.35;
        radial(ctx, px, py, r * 0.8, i % 3 ? "#ff8a3c" : "#ffd36a", 0.5);
      }
      ctx.restore();
    }
    if (t > 0.45 && isHit) {
      radial(ctx, target.x, target.y, 70 * clamp((t - 0.45) / 0.3), "#ff9a3c", 0.9);
      star(ctx, target.x, target.y, 40, "#ffd36a", 0.7, 6);
    }
    return;
  }

  if (kind === "cannon") {
    if (t < 0.18) {
      radial(ctx, origin.x, origin.y, 16 + 50 * (t / 0.18), "#ffcf7a", 1);
      star(ctx, origin.x, origin.y, 40, "#ffe9a8", 0.7, 8);
    }
    const p = clamp((t - 0.12) / 0.4);
    if (p > 0 && p < 1) {
      const x = lerp(origin.x, target.x, p), y = lerp(origin.y, target.y, p);
      glowLine(ctx, x - 60, y, x, y, 5, "#ffcf7a", 0.7);
      ctx.fillStyle = "#fff3c4";
      ctx.beginPath(); ctx.arc(x, y, 8, 0, Math.PI * 2); ctx.fill();
    }
    if (t > 0.48 && isHit) {
      const q = clamp((t - 0.48) / 0.3);
      radial(ctx, target.x, target.y, 40 + 80 * q, "#ffb45c", 1);
      star(ctx, target.x, target.y, 60 + 40 * q, "#ffe9a8", 0.8, 12);
    }
    return;
  }

  if (kind === "mg") {
    const shots = 7;
    for (let i = 0; i < shots; i++) {
      const d = i * 0.075;
      if (t < 0.1 + d) continue;
      const p = clamp((t - 0.1 - d) / 0.16);
      const sx = origin.x, sy = origin.y + ((i % 2) ? -6 : 6);
      const tx = target.x, ty = target.y + (i % 3 - 1) * 16;
      const ex = lerp(sx, tx, p), ey = lerp(sy, ty, p);
      glowLine(ctx, ex - 22, ey, ex, ey, 3, "#ffe9a8", 0.9);
      if (p >= 1 && isHit) {
        radial(ctx, tx, ty, 18, "#ffd27a", 0.8);
        star(ctx, tx, ty, 18, "#fff3c4", 0.5, 5);
      }
    }
    return;
  }

  if (kind === "missile") {
    const n = 3;
    for (let i = 0; i < n; i++) {
      const d = i * 0.08;
      const p = clamp((t - 0.08 - d) / 0.42);
      if (p <= 0) continue;
      const midY = Math.min(origin.y, target.y) - 90 - i * 24;
      const x = lerp(origin.x, target.x, p);
      const y = (1 - p) * (1 - p) * origin.y + 2 * (1 - p) * p * midY + p * p * target.y;
      if (p < 1) {
        glowLine(ctx, x - 30, y + 10, x, y, 4, "#ffb45c", 0.45);
        ctx.fillStyle = "#ffe9c4";
        ctx.beginPath(); ctx.arc(x, y, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = hexA("#ff8a3c", 0.8);
        ctx.beginPath();
        ctx.moveTo(x + 8, y); ctx.lineTo(x - 4, y - 4); ctx.lineTo(x - 4, y + 4);
        ctx.closePath(); ctx.fill();
      }
    }
    if (t > 0.5 && isHit) {
      const q = clamp((t - 0.5) / 0.3);
      radial(ctx, target.x, target.y, 30 + 70 * q, "#ffb45c", 1);
      star(ctx, target.x, target.y, 50 + 30 * q, "#ffe9a8", 0.8, 10);
    }
    return;
  }

  if (kind === "map") {
    if (t < 0.22) {
      ctx.save();
      ctx.globalAlpha = clamp(1 - t / 0.22);
      ctx.fillStyle = "#dff6ff";
      ctx.fillRect(0, 0, P.w, P.h);
      ctx.restore();
    }
    const beam = clamp((t - 0.1) / 0.35);
    if (beam > 0) {
      const w = 70 + 50 * (1 - beam);
      ctx.save();
      ctx.globalCompositeOperation = "lighter";
      const g = ctx.createLinearGradient(target.x - w, 0, target.x + w, 0);
      g.addColorStop(0, hexA("#7fd4ff", 0));
      g.addColorStop(0.5, hexA("#eaffff", 0.95 * (1 - t * 0.5)));
      g.addColorStop(1, hexA("#7fd4ff", 0));
      ctx.fillStyle = g;
      ctx.fillRect(target.x - w, 0, w * 2, P.h);
      ctx.restore();
    }
    if (t > 0.3 && isHit) {
      const q = clamp((t - 0.3) / 0.35);
      radial(ctx, target.x, target.y, 80 + 160 * q, "#b9e8ff", 1);
      star(ctx, target.x, target.y, 90 + 80 * q, "#eaffff", 0.9, 16);
    }
    return;
  }

  /* 兜底：短促冲击 */
  if (t > 0.4) {
    radial(ctx, target.x, target.y, 50, color, 0.8);
    star(ctx, target.x, target.y, 50, color, 0.8, 8);
  }
}
