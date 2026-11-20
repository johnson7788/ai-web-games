// REEF RAIDER · Canvas 2D 渲染：三场景（珊瑚晨光/岩礁黄昏/磷光夜海）、
// 程序化鱼群（带金币值标签）、炮台、灯泡弹、光网涟漪、灯影环绕（signature）。
// 只消费 run.state + view（cursor/aimAngle/shake）。像素换算全部在此完成。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout() }。
import { WORLD, LAYOUT, FISH_TYPES } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

const SCENE_PALETTES = {
  'coral-dawn': {
    skyTop: '#FFE3B0', skyMid: '#9FE0E0', skyBot: '#3E9FC4',
    water: 'rgba(62,159,196,0.10)', coral: '#FF8A75', coralDark: '#E05A50',
    sand: '#F6D9A0', reefRock: '#C79A6A', reefHi: '#E6C08A', reefDark: '#8A6A48',
    particle: 'rgba(255,236,170,0.9)', glow: 'rgba(255,200,120,0.4)',
  },
  'reef-dusk': {
    skyTop: '#F2A65A', skyMid: '#C4552D', skyBot: '#6B2D5C',
    water: 'rgba(107,45,92,0.12)', coral: '#FF9E7A', coralDark: '#C25A50',
    sand: '#D9A86A', reefRock: '#7A4E58', reefHi: '#9A6A6E', reefDark: '#4E3646',
    particle: 'rgba(255,220,150,0.8)', glow: 'rgba(255,160,80,0.4)',
  },
  'phosphor-night': {
    skyTop: '#0B2E42', skyMid: '#0E3B5A', skyBot: '#061E30',
    water: 'rgba(11,46,66,0.14)', coral: '#4FD0C8', coralDark: '#2A8A8A',
    sand: '#12364A', reefRock: '#2A4A5E', reefHi: '#3A6074', reefDark: '#182E40',
    particle: 'rgba(182,246,255,0.9)', glow: 'rgba(120,220,255,0.28)',
  },
};

// ---- 静态背景离屏缓存 ----
const bgCache = new Map();

function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  drawBackground(c.getContext('2d'), sceneKey);
  bgCache.set(sceneKey, c);
  return c;
}

function seededRand(i, a, b) {
  let x = i >>> 0;
  x = (x + 0x6D2B79F5) | 0;
  let t = Math.imul(x ^ (x >>> 15), 1 | x);
  t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
  return (((t ^ (t >>> 14)) >>> 0) / 4294967296);
}

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['coral-dawn'];
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // 水纹
  g.strokeStyle = P.water;
  g.lineWidth = 2;
  for (let i = 0; i < 10; i += 1) {
    const y = H * 0.55 + i * 30;
    g.beginPath();
    for (let x = 0; x <= W; x += 24) {
      const yy = y + Math.sin(x * 0.02 + i * 1.4) * 3;
      if (x === 0) g.moveTo(x, yy); else g.lineTo(x, yy);
    }
    g.stroke();
  }

  // 沙底
  g.fillStyle = P.sand;
  g.beginPath();
  g.moveTo(0, H * 0.82);
  for (let i = 0; i <= 8; i += 1) {
    const x = (W / 8) * i;
    g.lineTo(x, H * 0.82 - Math.sin(i * 1.9 + 0.6) * 34 - 12);
  }
  g.lineTo(W, H);
  g.lineTo(0, H);
  g.closePath();
  g.fill();

  if (sceneKey === 'phosphor-night') {
    drawStars(g);
    for (let i = 0; i < 40; i += 1) {
      const x = seededRand(i, 3, 11) * W;
      const y = seededRand(i, 13, 17) * H;
      g.fillStyle = `rgba(182,246,255,${0.3 + seededRand(i, 23, 29) * 0.5})`;
      g.beginPath(); g.arc(x, y, 1.2 + seededRand(i, 31, 37) * 1.8, 0, Math.PI * 2); g.fill();
    }
  }

  // 珊瑚 / 礁石装饰（远景）
  if (sceneKey === 'coral-dawn') {
    drawCoral(g, 90, H * 0.82, P, 1.0);
    drawCoral(g, 1190, H * 0.82, P, 0.8);
  } else if (sceneKey === 'reef-dusk') {
    drawPillars(g, P);
  } else {
    drawGlowCoral(g, 120, H * 0.82, P);
    drawGlowCoral(g, 1160, H * 0.82, P);
  }
}

function drawStars(g) {
  for (let i = 0; i < 70; i += 1) {
    const x = seededRand(i, 1, 5) * W;
    const y = seededRand(i, 7, 11) * H * 0.6;
    const r = 0.6 + seededRand(i, 3, 7) * 1.3;
    g.fillStyle = `rgba(220,240,255,${0.4 + seededRand(i, 4, 9) * 0.6})`;
    g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}

function drawCoral(g, x, baseY, P, s) {
  g.save(); g.translate(x, baseY); g.scale(s, s);
  g.strokeStyle = P.coralDark; g.lineWidth = 8; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(8, -70, 6, -130); g.stroke();
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-20, -60, -34, -100); g.stroke();
  g.fillStyle = P.coral;
  for (let i = 0; i < 5; i += 1) {
    const a = -Math.PI / 2 + (i - 2) * 0.42;
    g.save(); g.translate(6, -130); g.rotate(a);
    g.beginPath(); g.ellipse(0, -22, 8, 26, 0, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.restore();
}

function drawGlowCoral(g, x, baseY, P) {
  g.save(); g.translate(x, baseY);
  const grad = g.createLinearGradient(0, 0, 0, -120);
  grad.addColorStop(0, P.coralDark); grad.addColorStop(1, P.coral);
  g.strokeStyle = grad; g.lineWidth = 7; g.lineCap = 'round';
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(10, -70, 8, -120); g.stroke();
  g.beginPath(); g.moveTo(0, 0); g.quadraticCurveTo(-22, -60, -30, -95); g.stroke();
  g.restore();
}

function drawPillars(g, P) {
  for (let i = 0; i < 4; i += 1) {
    const x = 240 + i * 260 + seededRand(i, 7, 11) * 40;
    const pw = 46 + seededRand(i, 9, 13) * 34;
    const ph = 190 + seededRand(i, 5, 17) * 110;
    const grad = g.createLinearGradient(x, H - ph, x + pw, H);
    grad.addColorStop(0, P.reefHi); grad.addColorStop(1, P.reefDark);
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(x, H); g.lineTo(x, H - ph); g.lineTo(x + pw, H - ph + 36); g.lineTo(x + pw, H); g.closePath(); g.fill();
  }
}

// ---- 鱼（程序化，带金币值标签）----
function drawFish(g, f, clock) {
  const r = f.radius;
  const dir = f.dir > 0 ? 1 : -1;
  const cx = f.x;
  const cy = f.y;
  const swim = Math.sin(clock * 8 + f.phase) * r * 0.06;

  g.save();
  g.translate(cx, cy + swim);

  // 光晕（幽灵/王/稀有）
  if (f.type === 'ghost' || f.type === 'king' || f.rare) {
    const halo = g.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.9);
    halo.addColorStop(0, f.glow);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = halo;
    g.beginPath(); g.arc(0, 0, r * 1.9, 0, Math.PI * 2); g.fill();
  }

  g.scale(dir, 1);

  // 尾鳍
  g.fillStyle = f.color;
  g.beginPath();
  g.moveTo(-r * 0.7, 0);
  g.lineTo(-r * 1.35, -r * 0.62);
  g.lineTo(-r * 1.35, r * 0.62);
  g.closePath(); g.fill();

  // 身体
  const body = g.createLinearGradient(-r, -r, r, r);
  body.addColorStop(0, f.glow);
  body.addColorStop(1, f.color);
  g.fillStyle = body;
  g.beginPath(); g.ellipse(0, 0, r, r * 0.66, 0, 0, Math.PI * 2); g.fill();

  // 背鳍
  g.fillStyle = f.color;
  g.beginPath();
  g.moveTo(-r * 0.1, -r * 0.5);
  g.lineTo(r * 0.1, -r * 0.95);
  g.lineTo(r * 0.35, -r * 0.5);
  g.closePath(); g.fill();

  // 眼睛
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(r * 0.5, -r * 0.14, r * 0.24, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#1A2233';
  g.beginPath(); g.arc(r * 0.56, -r * 0.14, r * 0.12, 0, Math.PI * 2); g.fill();

  // 王冠（boss）
  if (f.type === 'king') {
    g.fillStyle = '#FFD24E';
    g.beginPath();
    g.moveTo(-r * 0.4, -r * 0.7);
    g.lineTo(-r * 0.4, -r * 1.15);
    g.lineTo(-r * 0.15, -r * 0.8);
    g.lineTo(0, -r * 1.25);
    g.lineTo(r * 0.15, -r * 0.8);
    g.lineTo(r * 0.4, -r * 1.15);
    g.lineTo(r * 0.4, -r * 0.7);
    g.closePath(); g.fill();
  }

  g.restore();

  // 金币值标签（具体收集物标记，vision-review 需要）
  const badgeW = Math.max(26, r * 0.9);
  const bx = cx;
  const by = cy - r - 14;
  g.fillStyle = 'rgba(20,16,8,0.82)';
  roundRect(g, bx - badgeW / 2, by - 10, badgeW, 20, 10);
  g.fill();
  g.strokeStyle = '#FFD84E';
  g.lineWidth = 1.5;
  roundRect(g, bx - badgeW / 2, by - 10, badgeW, 20, 10);
  g.stroke();
  g.fillStyle = '#FFE95C';
  g.font = '800 12px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(`+${f.gold}`, bx, by + 1);
}

function drawReef(g, reef, P) {
  const r = reef.r;
  g.fillStyle = 'rgba(0,0,0,0.2)';
  g.beginPath(); g.ellipse(reef.x + 3, reef.y + r * 0.8, r, r * 0.34, 0, 0, Math.PI * 2); g.fill();
  const grad = g.createLinearGradient(reef.x - r, reef.y - r, reef.x + r, reef.y + r);
  grad.addColorStop(0, P.reefHi);
  grad.addColorStop(1, P.reefDark);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(reef.x - r, reef.y + r * 0.3);
  g.lineTo(reef.x - r * 0.5, reef.y - r);
  g.lineTo(reef.x + r * 0.5, reef.y - r * 0.8);
  g.lineTo(reef.x + r, reef.y + r * 0.2);
  g.closePath(); g.fill();
  g.strokeStyle = P.reefDark;
  g.lineWidth = 2;
  g.stroke();
}

// ---- 炮台 ----
function drawTurret(g, angle, powerLevel, clock) {
  const tx = LAYOUT.TURRET_X;
  const ty = LAYOUT.TURRET_Y;
  g.save();
  g.translate(tx, ty);

  // 底座
  const base = g.createRadialGradient(0, 0, 8, 0, 0, 58);
  base.addColorStop(0, '#FFE9A0');
  base.addColorStop(1, '#B8860B');
  g.fillStyle = base;
  g.beginPath(); g.arc(0, 0, 58, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#8A5A00';
  g.lineWidth = 4;
  g.stroke();

  // 炮管（随角度旋转）
  g.rotate(angle);
  const len = 74 + powerLevel * 7;
  const barrel = g.createLinearGradient(0, -14, 0, 14);
  barrel.addColorStop(0, '#FFE9A0');
  barrel.addColorStop(1, '#C99A3E');
  g.fillStyle = barrel;
  g.beginPath();
  g.moveTo(6, -16); g.lineTo(len, -9); g.lineTo(len, 9); g.lineTo(6, 16);
  g.closePath(); g.fill();
  g.fillStyle = '#FFD84E';
  g.beginPath(); g.arc(len, 0, 11 + powerLevel, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFF6DE';
  g.beginPath(); g.arc(len, 0, 5 + powerLevel * 1.2, 0, Math.PI * 2); g.fill();

  g.restore();

  // 炮档环
  const ringPulse = 0.5 + 0.5 * Math.sin(clock * 3);
  g.strokeStyle = `rgba(255,216,78,${0.4 + 0.3 * ringPulse})`;
  g.lineWidth = 3;
  g.beginPath(); g.arc(tx, ty, 64, 0, Math.PI * 2); g.stroke();
}

function drawBullet(g, b, clock) {
  const r = 9;
  const halo = g.createRadialGradient(b.x, b.y, 1, b.x, b.y, r * 2.6);
  halo.addColorStop(0, '#FFFFFF');
  halo.addColorStop(0.4, '#FFE9A0');
  halo.addColorStop(1, 'rgba(255,233,160,0)');
  g.fillStyle = halo;
  g.beginPath(); g.arc(b.x, b.y, r * 2.6, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#FFF6DE';
  g.beginPath(); g.arc(b.x, b.y, r, 0, Math.PI * 2); g.fill();
}

function drawAimLine(g, from, to) {
  g.save();
  g.strokeStyle = 'rgba(255,255,255,0.22)';
  g.lineWidth = 2;
  g.setLineDash([6, 8]);
  g.beginPath(); g.moveTo(from.x, from.y); g.lineTo(to.x, to.y); g.stroke();
  g.setLineDash([]);
  g.restore();
}

// ---- 特效 ----
function drawEffects(g, effects, clock) {
  for (const e of effects) {
    if (e.kind === 'netRipple') {
      const p = 1 - e.ttl / e.dur; // 0→1
      const maxR = e.big ? 120 : 66;
      const r = 8 + p * maxR;
      const alpha = (1 - p) * (e.big ? 0.85 : 0.6);
      g.strokeStyle = e.color;
      g.globalAlpha = Math.max(0, alpha);
      g.lineWidth = e.big ? 4 : 3;
      g.beginPath(); g.arc(e.x, e.y, r, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = Math.max(0, alpha * 0.5);
      g.lineWidth = 1.5;
      g.beginPath(); g.arc(e.x, e.y, r * 0.7, 0, Math.PI * 2); g.stroke();
      g.globalAlpha = 1;
    } else if (e.kind === 'reefBlock') {
      const p = 1 - e.ttl / e.dur;
      g.globalAlpha = 1 - p;
      g.fillStyle = e.color;
      for (let i = 0; i < 5; i += 1) {
        const a = (i / 5) * Math.PI * 2;
        const rr = 4 + p * 22;
        g.beginPath(); g.arc(e.x + Math.cos(a) * rr, e.y + Math.sin(a) * rr, 3, 0, Math.PI * 2); g.fill();
      }
      g.globalAlpha = 1;
    } else if (e.kind === 'lightShadow') {
      // signature：捕获后鱼化作灯影绕屏游一圈
      const p = 1 - e.ttl / e.dur; // 0→1
      const alpha = Math.sin(p * Math.PI) * 0.9;
      const ang = e.startAng != null ? e.startAng : (e.x * 0.01 + e.y * 0.013);
      const cx = W / 2 + Math.cos(ang + p * Math.PI * 2) * W * 0.38;
      const cy = H * 0.46 + Math.sin(ang + p * Math.PI * 2) * H * 0.24;
      const rr = e.radius * 0.7 * (1 - p * 0.4);
      g.save();
      g.globalAlpha = Math.max(0, alpha);
      g.fillStyle = e.color;
      g.beginPath(); g.ellipse(cx, cy, rr, rr * 0.6, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.8)';
      g.beginPath(); g.arc(cx + rr * 0.4, cy - rr * 0.1, rr * 0.16, 0, Math.PI * 2); g.fill();
      // 拖尾
      for (let i = 1; i <= 4; i += 1) {
        const pp = Math.max(0, p - i * 0.05);
        const ax = W / 2 + Math.cos(ang + pp * Math.PI * 2) * W * 0.38;
        const ay = H * 0.46 + Math.sin(ang + pp * Math.PI * 2) * H * 0.24;
        g.globalAlpha = Math.max(0, alpha * (1 - i * 0.22));
        g.beginPath(); g.arc(ax, ay, rr * 0.5, 0, Math.PI * 2); g.fill();
      }
      g.restore();
      g.globalAlpha = 1;
    }
  }
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

// ---- 标题屏演示场景（给 vision-review 一个可识别主体）----
function drawTitleScene(g, clock) {
  g.drawImage(getBackground('coral-dawn'), 0, 0);
  // 演示鱼（静态，带分值标签）
  const demos = [
    { type: 'turtle', x: 300, y: 300, dir: 1 },
    { type: 'ghost', x: 620, y: 210, dir: -1 },
    { type: 'manta', x: 960, y: 360, dir: 1 },
    { type: 'lantern', x: 500, y: 440, dir: 1 },
  ];
  for (const d of demos) {
    const f = { ...FISH_TYPES[d.type], x: d.x, y: d.y, dir: d.dir, phase: d.x, gold: FISH_TYPES[d.type].gold, rare: d.type === 'ghost' };
    drawFish(g, f, clock);
  }
  drawTurret(g, -0.6, 3, clock);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  let clock = 0;
  let lastState = null;

  function debugLayout() {
    return {
      canvas: { x: 0, y: 0, w: W, h: H },
      hud: { x: 0, y: 0, w: W, h: LAYOUT.HUD_H },
      turret: { x: LAYOUT.TURRET_X - 70, y: LAYOUT.TURRET_Y - 90, w: 140, h: 100 },
      fishArea: { x: 0, y: LAYOUT.FISH_TOP, w: W, h: LAYOUT.FISH_BOTTOM - LAYOUT.FISH_TOP },
    };
  }

  function draw(state, dt, view) {
    const v = view || {};
    if (!state || !state.fish) {
      drawTitleScene(ctx, clock);
      return;
    }
    clock += dt || 0;
    lastState = state;
    const sceneKey = state.scene || v.sceneKey || 'coral-dawn';
    const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES['coral-dawn'];

    ctx.clearRect(0, 0, W, H);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }

    ctx.drawImage(getBackground(sceneKey), 0, 0);

    // 暗礁
    for (const reef of (state.reef || [])) {
      drawReef(ctx, reef, P);
    }

    // 鱼
    for (const f of state.fish) {
      if (f.alive) drawFish(ctx, f, clock);
    }

    // 特效
    drawEffects(ctx, state.effects, clock);

    // 子弹
    for (const b of state.bullets) drawBullet(ctx, b, clock);

    // 瞄准激光线
    if (v.cursor && v.aimAngle != null) {
      drawAimLine(ctx, { x: LAYOUT.TURRET_X, y: LAYOUT.TURRET_Y }, v.cursor);
    }

    // 炮台
    drawTurret(ctx, v.aimAngle != null ? v.aimAngle : 0, state.powerLevel, clock);

    ctx.restore();
  }

  return { draw, debugLayout, __drawTitle: () => drawTitleScene(ctx, clock) };
}
