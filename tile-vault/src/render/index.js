// Canvas 2D 渲染：Tile Vault 的伪 3D 等距宝库堆 / 底部槽 / 钱袋 / 金币雨 / 三场景。
// 只消费 run.state（契约 §3）+ view（rot/hoverTile/cursor/fxQueue/shake）。
// 像素换算全部在此完成（sim 只给 x,z,y 与 tile type）。
// 契约 API：createRenderer(canvas) → { draw(state,dt,view), debugLayout(), resize(w,h), pickTile(state,px,py) }。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { t } from '../core/i18n.js';

const TILE_W = LAYOUT.TILE_W;
const TILE_H = LAYOUT.TILE_H;
const TILE_LIFT = LAYOUT.TILE_LIFT;
const BODY_H = LAYOUT.BODY_H;

// ---- 三场景色板（换章必换：色板/构图/装饰互异）----
const SCENE_PALETTES = {
  vault: {
    skyTop: '#1B1410', skyMid: '#2A1C12', skyBot: '#120C08',
    wall: '#3A2416', wallDark: '#24150C', floor: '#2E1B0F',
    accent: '#F6C453', glow: 'rgba(246,196,83,0.22)',
    deco: 'vault',
  },
  tomb: {
    skyTop: '#2A1D12', skyMid: '#4A3220', skyBot: '#1A1208',
    wall: '#5C4326', wallDark: '#3A2A17', floor: '#4A3520',
    accent: '#E8B36A', glow: 'rgba(232,179,106,0.2)',
    deco: 'tomb',
  },
  dragon: {
    skyTop: '#2B0E12', skyMid: '#4A1418', skyBot: '#140508',
    wall: '#5C1E1E', wallDark: '#360F12', floor: '#441314',
    accent: '#FF7A45', glow: 'rgba(255,122,69,0.22)',
    deco: 'dragon',
  },
};

// ---- 12 种宝物（品类 6→12）：色 + 简笔图符 ----
const TREASURE = [
  { color: '#E74C3C', hi: '#F1948A', dark: '#7B241C', glyph: 'gem' },
  { color: '#F1C40F', hi: '#F9E79F', dark: '#7D6608', glyph: 'coin' },
  { color: '#3498DB', hi: '#85C1E9', dark: '#1A5276', glyph: 'goblet' },
  { color: '#9B59B6', hi: '#C39BD3', dark: '#4A235A', glyph: 'crown' },
  { color: '#2ECC71', hi: '#82E0AA', dark: '#145A32', glyph: 'key' },
  { color: '#E67E22', hi: '#F0B27A', dark: '#7E4A12', glyph: 'scroll' },
  { color: '#D6DBDF', hi: '#F4F6F7', dark: '#566573', glyph: 'pearl' },
  { color: '#1ABC9C', hi: '#76D7C4', dark: '#0E6251', glyph: 'ring' },
  { color: '#E91E63', hi: '#F08CB5', dark: '#7B1F3A', glyph: 'chalice' },
  { color: '#F39C12', hi: '#F7DC6F', dark: '#7E5109', glyph: 'ingot' },
  { color: '#7F8C8D', hi: '#BFC9CA', dark: '#424949', glyph: 'idol' },
  { color: '#8E44AD', hi: '#BB8FCE', dark: '#4A235A', glyph: 'egg' },
];

// ---- 背景离屏缓存 ----
const bgCache = new Map();
function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  drawBackground(c.getContext('2d'), sceneKey);
  bgCache.set(sceneKey, c);
  return c;
}

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.vault;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (P.deco === 'vault') drawVault(g, P, W, H);
  else if (P.deco === 'tomb') drawTomb(g, P, W, H);
  else drawDragon(g, P, W, H);

  // 地面
  g.fillStyle = P.floor;
  g.fillRect(0, H * 0.72, W, H * 0.28);
  const grd = g.createLinearGradient(0, H * 0.72, 0, H);
  grd.addColorStop(0, P.floor);
  grd.addColorStop(1, P.skyBot);
  g.fillStyle = grd;
  g.fillRect(0, H * 0.72, W, H * 0.28);
}

function drawVault(g, P, W, H) {
  // 拱形金库门
  g.strokeStyle = P.wallDark;
  g.lineWidth = 10;
  g.beginPath(); g.arc(W * 0.14, H * 0.72, 120, Math.PI, 0); g.stroke();
  g.strokeStyle = P.wall;
  g.lineWidth = 6;
  g.beginPath(); g.arc(W * 0.14, H * 0.72, 90, Math.PI, 0); g.stroke();
  // 门轴/铆钉
  g.fillStyle = P.accent;
  for (let i = 0; i < 5; i += 1) {
    g.beginPath();
    g.arc(W * 0.14 - 60 + i * 30, H * 0.62, 4, 0, Math.PI * 2);
    g.fill();
  }
  // 火把光晕
  drawTorch(g, P, W * 0.86, H * 0.34, W);
}

function drawTomb(g, P, W, H) {
  // 石柱
  g.fillStyle = P.wall;
  for (let i = 0; i < 3; i += 1) {
    const x = 160 + i * 380;
    g.fillRect(x, H * 0.28, 54, H * 0.5);
    g.fillStyle = P.wallDark;
    g.fillRect(x + 6, H * 0.28, 42, H * 0.5);
    g.fillStyle = P.wall;
  }
  // 顶梁
  g.fillStyle = P.wallDark;
  g.fillRect(0, H * 0.24, W, 26);
  drawTorch(g, P, W * 0.5, H * 0.3, W);
}

function drawDragon(g, P, W, H) {
  // 火山熔岩光
  const halo = g.createRadialGradient(W * 0.78, H * 0.6, 40, W * 0.78, H * 0.6, 360);
  halo.addColorStop(0, 'rgba(255,90,40,0.5)');
  halo.addColorStop(1, 'rgba(255,90,40,0)');
  g.fillStyle = halo;
  g.fillRect(0, 0, W, H);
  // 龙尾剪影
  g.fillStyle = 'rgba(20,8,8,0.7)';
  g.beginPath();
  g.moveTo(W * 0.78, H * 0.9);
  g.quadraticCurveTo(W * 0.9, H * 0.4, W * 0.98, H * 0.32);
  g.quadraticCurveTo(W * 0.86, H * 0.5, W * 0.82, H * 0.66);
  g.closePath();
  g.fill();
  drawTorch(g, P, W * 0.24, H * 0.3, W);
}

function drawTorch(g, P, x, y, W) {
  const halo = g.createRadialGradient(x, y, 6, x, y, 160);
  halo.addColorStop(0, P.glow);
  halo.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = halo;
  g.fillRect(x - 160, y - 160, 320, 320);
  g.fillStyle = P.accent;
  g.beginPath(); g.ellipse(x, y, 7, 13, 0, 0, Math.PI * 2); g.fill();
}

// ---- 图符（简笔，画在块顶面中央）----
function drawGlyph(g, type, cx, cy, s) {
  const k = (TREASURE[type] || TREASURE[0]).glyph;
  g.fillStyle = 'rgba(0,0,0,0.55)';
  g.strokeStyle = 'rgba(0,0,0,0.55)';
  g.lineWidth = Math.max(2, s * 0.12);
  switch (k) {
    case 'gem': { // 菱形宝石 + 高光
      g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s, cy); g.lineTo(cx, cy + s); g.lineTo(cx - s, cy); g.closePath(); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.4, cy); g.lineTo(cx, cy + s * 0.3); g.lineTo(cx - s * 0.4, cy); g.closePath(); g.fill();
      break;
    }
    case 'coin': {
      g.beginPath(); g.arc(cx, cy, s, 0, Math.PI * 2); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.6)';
      g.lineWidth = Math.max(1.5, s * 0.18);
      g.beginPath(); g.arc(cx, cy, s * 0.55, 0, Math.PI * 2); g.stroke();
      break;
    }
    case 'goblet': {
      g.beginPath(); g.moveTo(cx - s, cy - s); g.lineTo(cx - s * 0.6, cy + s * 0.2); g.lineTo(cx + s * 0.6, cy + s * 0.2); g.lineTo(cx + s, cy - s); g.closePath(); g.fill();
      g.fillRect(cx - s * 0.12, cy + s * 0.2, s * 0.24, s * 0.8);
      g.fillRect(cx - s * 0.5, cy + s, s, s * 0.2);
      break;
    }
    case 'crown': {
      g.beginPath();
      g.moveTo(cx - s, cy + s * 0.4); g.lineTo(cx - s, cy - s * 0.2); g.lineTo(cx - s * 0.4, cy); g.lineTo(cx, cy - s); g.lineTo(cx + s * 0.4, cy); g.lineTo(cx + s, cy - s * 0.2); g.lineTo(cx + s, cy + s * 0.4);
      g.closePath(); g.fill();
      break;
    }
    case 'key': {
      g.beginPath(); g.arc(cx, cy - s, s * 0.4, 0, Math.PI * 2); g.stroke();
      g.beginPath(); g.moveTo(cx, cy - s * 0.6); g.lineTo(cx, cy + s); g.stroke();
      g.beginPath(); g.moveTo(cx, cy + s * 0.2); g.lineTo(cx + s * 0.6, cy + s); g.moveTo(cx, cy + s * 0.7); g.lineTo(cx + s * 0.4, cy + s); g.stroke();
      break;
    }
    case 'scroll': {
      g.fillRect(cx - s * 0.7, cy - s * 0.5, s * 1.4, s);
      g.strokeStyle = 'rgba(255,255,255,0.5)';
      g.beginPath(); g.moveTo(cx - s * 0.4, cy - s * 0.2); g.lineTo(cx + s * 0.4, cy - s * 0.2); g.moveTo(cx - s * 0.4, cy + s * 0.2); g.lineTo(cx + s * 0.4, cy + s * 0.2); g.stroke();
      break;
    }
    case 'pearl': {
      g.beginPath(); g.arc(cx, cy, s * 0.8, 0, Math.PI * 2); g.fill();
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.beginPath(); g.arc(cx - s * 0.25, cy - s * 0.25, s * 0.22, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'ring': {
      g.lineWidth = Math.max(2, s * 0.24);
      g.beginPath(); g.arc(cx, cy, s * 0.7, 0, Math.PI * 2); g.stroke();
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.beginPath(); g.arc(cx, cy - s * 0.7, s * 0.2, 0, Math.PI * 2); g.fill();
      break;
    }
    case 'chalice': {
      g.beginPath(); g.moveTo(cx - s * 0.7, cy - s * 0.3); g.quadraticCurveTo(cx, cy + s * 0.1, cx + s * 0.7, cy - s * 0.3); g.closePath(); g.fill();
      g.fillRect(cx - s * 0.1, cy + s * 0.1, s * 0.2, s * 0.8);
      break;
    }
    case 'ingot': {
      g.beginPath(); g.moveTo(cx - s, cy + s * 0.4); g.lineTo(cx - s * 0.6, cy - s * 0.5); g.lineTo(cx + s * 0.6, cy - s * 0.5); g.lineTo(cx + s, cy + s * 0.4); g.closePath(); g.fill();
      break;
    }
    case 'idol': {
      g.beginPath(); g.moveTo(cx, cy - s); g.lineTo(cx + s * 0.7, cy + s * 0.3); g.lineTo(cx + s * 0.4, cy + s); g.lineTo(cx - s * 0.4, cy + s); g.lineTo(cx - s * 0.7, cy + s * 0.3); g.closePath(); g.fill();
      break;
    }
    default: { // egg
      g.beginPath(); g.ellipse(cx, cy, s * 0.65, s * 0.9, 0, 0, Math.PI * 2); g.fill();
      break;
    }
  }
}

// ---- 单个宝物块（等距立方体：顶面 + 左右两个明暗分面）----
function drawTile(g, tile, free, locked, px, py) {
  const T = TREASURE[tile.type] || TREASURE[0];
  const hw = TILE_W / 2;
  const hh = TILE_H;
  const top = { x: px, y: py - hh };
  const right = { x: px + hw, y: py };
  const bottom = { x: px, y: py + hh };
  const left = { x: px - hw, y: py };

  const gray = (hex, f) => {
    const n = parseInt(hex.slice(1), 16);
    const r = (n >> 16) & 255, gg = (n >> 8) & 255, b = n & 255;
    const m = Math.round((r + gg + b) / 3);
    const mix = (a) => Math.round(a + (m - a) * f);
    return `rgb(${mix(r)},${mix(gg)},${mix(b)})`;
  };
  const dim = locked ? 0.5 : 0.25;
  const topCol = free ? T.hi : gray(T.color, dim);
  const leftCol = free ? T.color : gray(T.color, dim + 0.12);
  const rightCol = free ? T.dark : gray(T.dark, dim + 0.1);

  // 右面
  g.fillStyle = rightCol;
  g.beginPath();
  g.moveTo(bottom.x, bottom.y); g.lineTo(right.x, right.y); g.lineTo(right.x, right.y + BODY_H); g.lineTo(bottom.x, bottom.y + BODY_H);
  g.closePath(); g.fill();
  // 左面
  g.fillStyle = leftCol;
  g.beginPath();
  g.moveTo(left.x, left.y); g.lineTo(bottom.x, bottom.y); g.lineTo(bottom.x, bottom.y + BODY_H); g.lineTo(left.x, left.y + BODY_H);
  g.closePath(); g.fill();
  // 顶面
  g.fillStyle = topCol;
  g.beginPath();
  g.moveTo(top.x, top.y); g.lineTo(right.x, right.y); g.lineTo(bottom.x, bottom.y); g.lineTo(left.x, left.y);
  g.closePath(); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.4)';
  g.lineWidth = 1.5;
  g.stroke();

  // 图符（只画在顶面，居中）
  drawGlyph(g, tile.type, px, py, TILE_H * 0.5);

  // 自由块：顶面白描边 + 轻微光晕
  if (free) {
    g.strokeStyle = 'rgba(255,255,255,0.9)';
    g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(top.x, top.y); g.lineTo(right.x, right.y); g.lineTo(bottom.x, bottom.y); g.lineTo(left.x, left.y);
    g.closePath(); g.stroke();
  }

  // 锁样（假锁：视觉误导，实际只是被压块）
  if (locked) {
    const lx = px, ly = py - hh * 0.2;
    g.fillStyle = '#1A1208';
    g.fillRect(lx - 8, ly - 7, 16, 13);
    g.strokeStyle = '#F6C453';
    g.lineWidth = 2.5;
    g.beginPath(); g.arc(lx, ly + 4, 5, Math.PI, 0); g.stroke();
    g.beginPath(); g.moveTo(lx - 3, ly - 7); g.lineTo(lx - 3, ly + 1); g.moveTo(lx + 3, ly - 7); g.lineTo(lx + 3, ly + 1); g.stroke();
  }
}

// ---- 钱袋（目标物：带金币标签 + 脉冲目标环）----
function drawBag(g, x, y, coins, clock) {
  // 目标脉冲环
  const pulse = 0.5 + 0.5 * Math.sin(clock * 2.6);
  g.strokeStyle = `rgba(246,196,83,${0.35 + 0.35 * pulse})`;
  g.lineWidth = 4;
  g.beginPath(); g.arc(x, y, 62 + 5 * pulse, 0, Math.PI * 2); g.stroke();

  g.save();
  g.translate(x, y);
  const sway = Math.sin(clock * 2.2) * 0.03;
  g.rotate(sway);
  // 袋身
  const grad = g.createLinearGradient(-40, -40, 40, 40);
  grad.addColorStop(0, '#8A5A2B');
  grad.addColorStop(1, '#5A3413');
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(-44, -40); g.quadraticCurveTo(-58, 8, -30, 40); g.lineTo(30, 40); g.quadraticCurveTo(58, 8, 44, -40);
  g.closePath(); g.fill();
  g.strokeStyle = '#3A220C'; g.lineWidth = 3; g.stroke();
  // 束口
  g.fillStyle = '#C9A15A';
  g.beginPath(); g.ellipse(0, -40, 44, 12, 0, 0, Math.PI * 2); g.fill();
  // 金币符号
  g.fillStyle = '#F6C453';
  g.beginPath(); g.arc(0, 4, 22, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7D6608'; g.lineWidth = 3;
  g.beginPath(); g.arc(0, 4, 22, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#7D6608';
  g.font = '800 20px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('$', 0, 5);
  g.restore();

  // 金币标签
  g.fillStyle = 'rgba(20,14,6,0.9)';
  g.font = '800 15px sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const label = t('coinsLabel');
  const num = `${coins}`;
  const w = Math.max(120, 46 + (label.length + num.length) * 8);
  g.fillRect(x - w / 2, y + 56, w, 26);
  g.fillStyle = '#F6C453';
  g.font = '800 15px sans-serif';
  g.fillText(`${label} ${num}`, x, y + 70);
}

// ---- 目标横幅（顶部中央）----
function drawGoalBanner(g) {
  const text = t('goal');
  g.font = '800 15px sans-serif';
  const w = 24 + text.length * 8.2;
  const x = WORLD.WIDTH / 2;
  const y = LAYOUT.HUD_H + 20;
  g.fillStyle = 'rgba(20,14,6,0.82)';
  g.beginPath();
  g.roundRect ? g.roundRect(x - w / 2, y - 12, w, 24, 12) : g.rect(x - w / 2, y - 12, w, 24);
  g.fill();
  g.strokeStyle = 'rgba(246,196,83,0.4)';
  g.lineWidth = 1.5;
  g.beginPath();
  g.roundRect ? g.roundRect(x - w / 2, y - 12, w, 24, 12) : g.rect(x - w / 2, y - 12, w, 24);
  g.stroke();
  g.fillStyle = '#F6E3B4';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, x, y + 1);
}

// ---- 投影 ----
function computeProjection(state, rot) {
  const gridX = state.gridX || 6;
  const gridZ = state.gridZ || 5;
  const cx = (gridX - 1) / 2;
  const cz = (gridZ - 1) / 2;
  const th = (rot || 0) * Math.PI / 4;

  const project = (t) => {
    const dx = t.x - cx;
    const dz = t.z - cz;
    const rx = dx * Math.cos(th) - dz * Math.sin(th);
    const rz = dx * Math.sin(th) + dz * Math.cos(th);
    return { px: (rx - rz) * TILE_W / 2, py: (rx + rz) * TILE_H - t.y * TILE_LIFT };
  };

  // 计算包围盒（含侧面高度），居中到场景区（顶部留足 HUD 余量，右侧留给钱袋）
  const sceneTop = LAYOUT.HUD_H + 46;
  const sceneBottom = WORLD.HEIGHT - LAYOUT.TRAY_H - 18;
  const sceneLeft = 52;
  const sceneRight = WORLD.WIDTH - 210;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const t of state.tiles) {
    const p = project(t);
    minX = Math.min(minX, p.px - TILE_W / 2);
    maxX = Math.max(maxX, p.px + TILE_W / 2);
    minY = Math.min(minY, p.py - TILE_H);
    maxY = Math.max(maxY, p.py + TILE_H + BODY_H);
  }
  if (!Number.isFinite(minX)) { minX = 0; maxX = 0; minY = 0; maxY = 0; }
  const pw = maxX - minX;
  const ph = maxY - minY;
  const offsetX = sceneLeft + ((sceneRight - sceneLeft) - pw) / 2 - minX;
  const offsetY = sceneTop + ((sceneBottom - sceneTop) - ph) / 2 - minY;

  return {
    rot,
    hw: TILE_W / 2,
    hh: TILE_H,
    lift: TILE_LIFT,
    project: (t) => {
      const p = project(t);
      return { x: p.px + offsetX, y: p.py + offsetY };
    },
  };
}

function tileSort(a, b, proj) {
  // 后→前：先按深度 (rx+rz) 增序，再按层 y 增序（同列上层在上）
  const pa = proj.project(a);
  const pb = proj.project(b);
  if (pa.y !== pb.y) return pa.y - pb.y;
  return a.y - b.y;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;
  let lastProj = null;

  function resize(w, h) {
    return { w, h, world: { width: WORLD.WIDTH, height: WORLD.HEIGHT } };
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('vault'), 0, 0);
    drawBag(ctx, WORLD.WIDTH - 150, WORLD.HEIGHT - 200, 0, clock);
  }

  function draw(state, dt, view) {
    clock += dt || 0;
    if (!state || !state.tiles) { drawTitleScene(); return; }
    const v = view || {};
    const rot = v.rot || 0;
    lastState = state;
    const proj = computeProjection(state, rot);
    lastProj = proj;
    const sceneKey = state.scene || 'vault';

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }
    ctx.drawImage(getBackground(sceneKey), 0, 0);

    drawGoalBanner(ctx);

    // 宝库堆：后→前绘制（画家算法）
    const tiles = state.tiles.slice().sort((a, b) => tileSort(a, b, proj));
    for (const t of tiles) {
      const p = proj.project(t);
      const free = !state._posSet ? true : isFree(state, t);
      drawTile(ctx, t, free, !!t.lockVisual, p.x, p.y);
    }

    // hover 高亮（自由块）
    if (v.hoverTile && v.hoverTile.id != null) {
      const p = proj.project(v.hoverTile);
      ctx.strokeStyle = 'rgba(255,240,160,0.95)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y - proj.hh); ctx.lineTo(p.x + proj.hw, p.y); ctx.lineTo(p.x, p.y + proj.hh); ctx.lineTo(p.x - proj.hw, p.y);
      ctx.closePath(); ctx.stroke();
    }

    // 底部槽
    drawTray(ctx, state, clock);

    // 钱袋 + 金币雨
    const bag = bagRect();
    drawBag(ctx, bag.x, bag.y, state.coins, clock);
    if (v.fxQueue) {
      for (const fx of v.fxQueue) {
        if (fx.type === 'coinRain' && fx.ttl > 0) drawCoinRain(ctx, fx, bag);
      }
    }

    ctx.restore();
  }

  function drawTray(g, state, clock) {
    const n = state.trayCap;
    const slotW = LAYOUT.TRAY_SLOT;
    const totalW = n * slotW;
    const x0 = (WORLD.WIDTH - totalW) / 2;
    const y0 = WORLD.HEIGHT - LAYOUT.TRAY_H + 8;
    // 槽标签
    g.fillStyle = 'rgba(20,14,6,0.85)';
    g.font = '800 12px sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const label = t('trayLabel');
    const lw = 14 + label.length * 7;
    g.fillRect(x0 - lw - 8, y0 + 6, lw, 20);
    g.fillStyle = '#F6C453';
    g.textAlign = 'center';
    g.fillText(label, x0 - lw / 2 - 8, y0 + 17);
    // 槽底
    for (let i = 0; i < n; i += 1) {
      const x = x0 + i * slotW;
      g.fillStyle = 'rgba(0,0,0,0.32)';
      g.fillRect(x + 4, y0 + 10, slotW - 8, slotW - 20);
      g.strokeStyle = 'rgba(255,255,255,0.14)';
      g.lineWidth = 1.5;
      g.strokeRect(x + 4, y0 + 10, slotW - 8, slotW - 20);
    }
    // 槽内宝物（平铺显示）
    const half = Math.min(LAYOUT.TRAY_H - 28, 44);
    for (let i = 0; i < state.tray.length; i += 1) {
      const t = state.tray[i];
      const T = TREASURE[t.type] || TREASURE[0];
      const x = x0 + i * slotW + slotW / 2;
      const y = y0 + 10 + (LAYOUT.TRAY_H - 28) / 2;
      g.fillStyle = T.color;
      g.beginPath();
      g.arc(x, y, half * 0.7, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = 'rgba(0,0,0,0.5)';
      g.lineWidth = 2;
      g.stroke();
      drawGlyph(g, t.type, x, y, half * 0.5);
    }
    // 槽满预警
    if (state.tray.length >= state.trayCap) {
      g.strokeStyle = `rgba(255,90,70,${0.5 + 0.5 * Math.sin(clock * 6)})`;
      g.lineWidth = 3;
      g.strokeRect(x0 + 2, y0 + 8, totalW - 4, LAYOUT.TRAY_H - 20);
    }
  }

  function drawCoinRain(g, fx, bag) {
    const t = 1 - fx.ttl / (fx.maxTtl || 0.6);
    const n = fx.count || 6;
    for (let i = 0; i < n; i += 1) {
      const phase = (i / n + t * 0.7) % 1;
      const x = fx.fromX + (bag.x - fx.fromX) * phase + Math.sin(phase * Math.PI * 3 + i) * 18;
      const y = fx.fromY + (bag.y - fx.fromY) * phase - Math.sin(phase * Math.PI) * 60;
      g.fillStyle = '#F6C453';
      g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#7D6608'; g.lineWidth = 1.5; g.stroke();
    }
  }

  function bagRect() {
    return { x: WORLD.WIDTH - 150, y: WORLD.HEIGHT - 200 };
  }

  function isFree(state, tile) {
    if (state._posSet) return !state._posSet.has(`${tile.x},${tile.z},${tile.y + 1}`);
    for (const t of state.tiles) if (t.x === tile.x && t.z === tile.z && t.y === tile.y + 1) return false;
    return true;
  }

  function debugLayout() {
    if (!lastState) return null;
    const proj = lastProj || computeProjection(lastState, 0);
    const trayN = lastState.trayCap;
    const slotW = LAYOUT.TRAY_SLOT;
    const x0 = (WORLD.WIDTH - trayN * slotW) / 2;
    const y0 = WORLD.HEIGHT - LAYOUT.TRAY_H + 8;
    const bag = bagRect();
    // 第一个自由块的矩形（供引导聚光）
    let firstFree = null;
    for (const t of lastState.tiles) {
      if (isFree(lastState, t)) { firstFree = t; break; }
    }
    const layout = {
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
      tray: { x: x0, y: y0, w: trayN * slotW, h: LAYOUT.TRAY_H - 8 },
      bag: { x: bag.x - 60, y: bag.y - 60, w: 120, h: 130 },
      stack: { x: 40, y: LAYOUT.HUD_H, w: WORLD.WIDTH - 220, h: WORLD.HEIGHT - LAYOUT.HUD_H - LAYOUT.TRAY_H - 24 },
    };
    if (firstFree) {
      const p = proj.project(firstFree);
      layout.firstFree = { x: p.x - proj.hw, y: p.y - proj.hh, w: proj.hw * 2, h: proj.hh * 2 };
    }
    return layout;
  }

  function pickTile(state, px, py) {
    if (!state || !lastProj) return null;
    const proj = computeProjection(state, lastProj.rot);
    const tiles = state.tiles.slice().sort((a, b) => tileSort(a, b, proj));
    // 前→后（逆绘制序）做菱形命中
    for (let i = tiles.length - 1; i >= 0; i -= 1) {
      const t = tiles[i];
      const p = proj.project(t);
      const dx = Math.abs(px - p.x) / proj.hw;
      const dy = Math.abs(py - p.y) / proj.hh;
      if (dx + dy <= 1) return t;
    }
    return null;
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout, resize, pickTile };
}
