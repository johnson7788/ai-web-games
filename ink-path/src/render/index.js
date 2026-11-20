// INK PATH · Canvas 2D 渲染：三场景包 / 星子 / 丝线 / 织网路径 / 涟漪 + 萤火虫。
// 只消费 run.state + view（hoverNode/cursor），像素换算全部在此完成（sim 只给 id 与掩码）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout(), hitNode(p, state), nodePositions(state) }。
// 主题：萤火虫蛛在星空网上织丝。节点=星子，边=丝线，画过之处丝线发亮；
//       完成瞬间整张星网亮起涟漪 + 萤火虫群飞散（signature）。

import { WORLD, LAYOUT } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';
import { normalizeLevel } from '../game/solver.js';

const TAU = Math.PI * 2;

// 三场景包色板（换章必换：色板/构图/装饰互异）
const SCENES = {
  'dusk-forest': {
    skyTop: '#12242e', skyMid: '#1c3940', skyBot: '#0a171d',
    accent: '#63e6c8', silk: '#aef7e6', silkGlow: 'rgba(120,240,210,0.55)',
    dim: '#355a60', nodeDim: '#33515a', nodeLit: '#e8fff6', firefly: '#ffd76a',
    decor: 'pines',
  },
  'aurora-ice': {
    skyTop: '#0a1e33', skyMid: '#13304f', skyBot: '#070f1f',
    accent: '#67d8ff', silk: '#c9f2ff', silkGlow: 'rgba(110,220,255,0.55)',
    dim: '#2b5a86', nodeDim: '#2a5480', nodeLit: '#ecfbff', firefly: '#bfffe0',
    decor: 'aurora',
  },
  'deep-space': {
    skyTop: '#0a0616', skyMid: '#170d2b', skyBot: '#05030c',
    accent: '#c07bff', silk: '#e7c8ff', silkGlow: 'rgba(190,120,255,0.55)',
    dim: '#4a2f78', nodeDim: '#3f2a66', nodeLit: '#f6eaff', firefly: '#ffd0f0',
    decor: 'nebula',
  },
};

function seededRand(a, b, c) {
  const x = Math.sin(a * 127.1 + b * 311.7 + c * 74.7) * 43758.5453;
  return x - Math.floor(x);
}

// ---- 布局（sim 只给归一化坐标，这里映射到世界像素）----
function computeLayout(state) {
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  const playX = LAYOUT.MARGIN;
  const playY = LAYOUT.HUD_H + LAYOUT.MARGIN;
  const playW = W - LAYOUT.MARGIN * 2;
  const playH = H - LAYOUT.HUD_H - LAYOUT.MARGIN * 2;
  const n = state.nodes.length;
  const r = Math.max(LAYOUT.STAR_R_MIN, Math.min(LAYOUT.STAR_R_MAX, LAYOUT.STAR_R_MAX - (n - 3) * 0.9));
  const pos = (id) => {
    const node = state.nodes[id];
    return { x: playX + node.x * playW, y: playY + node.y * playH };
  };
  return { playX, playY, playW, playH, r, pos };
}

// ---- 静态背景离屏缓存（每帧只 drawImage 一次）----
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
  const P = SCENES[sceneKey] || SCENES['dusk-forest'];
  const W = WORLD.WIDTH;
  const H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(0.55, P.skyMid);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  if (P.decor === 'aurora') {
    drawAurora(g, P);
  } else if (P.decor === 'nebula') {
    drawNebula(g, P);
    drawStars(g, 140, 0.7);
  } else {
    drawStars(g, 70, 0.5);
    drawPines(g, P);
  }

  // 底部渐隐，保证 HUD 与星网可读
  const grd = g.createLinearGradient(0, H * 0.72, 0, H);
  grd.addColorStop(0, 'rgba(0,0,0,0)');
  grd.addColorStop(1, 'rgba(0,0,0,0.35)');
  g.fillStyle = grd;
  g.fillRect(0, H * 0.72, W, H * 0.28);
}

function drawStars(g, count, bright) {
  for (let i = 0; i < count; i += 1) {
    const x = seededRand(i, 1, 3) * WORLD.WIDTH;
    const y = seededRand(i, 2, 5) * WORLD.HEIGHT * 0.7;
    const r = 0.6 + seededRand(i, 3, 7) * 1.5;
    g.fillStyle = `rgba(225,240,255,${(0.25 + seededRand(i, 4, 9) * 0.5) * bright})`;
    g.beginPath();
    g.arc(x, y, r, 0, TAU);
    g.fill();
  }
}

function drawAurora(g, P) {
  for (let k = 0; k < 3; k += 1) {
    const y = 120 + k * 90;
    const hue = k === 0 ? 'rgba(110,220,255,0.16)' : k === 1 ? 'rgba(120,255,200,0.12)' : 'rgba(150,180,255,0.10)';
    g.fillStyle = hue;
    g.beginPath();
    g.moveTo(0, y + 40);
    for (let x = 0; x <= WORLD.WIDTH; x += 32) {
      g.lineTo(x, y + Math.sin(x * 0.012 + k * 1.7) * 55 + Math.sin(x * 0.004 + k) * 30);
    }
    g.lineTo(WORLD.WIDTH, y + 220);
    g.lineTo(0, y + 220);
    g.closePath();
    g.fill();
  }
}

function drawNebula(g, P) {
  const clouds = [
    { x: 300, y: 220, r: 260, c: 'rgba(150,80,220,0.16)' },
    { x: 980, y: 160, r: 300, c: 'rgba(220,90,170,0.13)' },
    { x: 640, y: 420, r: 260, c: 'rgba(90,120,240,0.12)' },
  ];
  for (const cl of clouds) {
    const grd = g.createRadialGradient(cl.x, cl.y, 10, cl.x, cl.y, cl.r);
    grd.addColorStop(0, cl.c);
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(cl.x - cl.r, cl.y - cl.r, cl.r * 2, cl.r * 2);
  }
}

function drawPines(g, P) {
  g.fillStyle = 'rgba(8,24,20,0.55)';
  for (let i = 0; i < 9; i += 1) {
    const x = i * 150 + seededRand(i, 9, 13) * 60;
    const h = 120 + seededRand(i, 5, 17) * 120;
    const w = 60 + seededRand(i, 7, 19) * 40;
    g.beginPath();
    g.moveTo(x, WORLD.HEIGHT);
    g.lineTo(x + w / 2, WORLD.HEIGHT - h);
    g.lineTo(x + w, WORLD.HEIGHT);
    g.closePath();
    g.fill();
  }
}

// ---- 丝线 ----
function edgePoints(state, L, edge) {
  const p = computeLayout(state);
  const a = p.pos(edge.a);
  const b = p.pos(edge.b);
  return { a, b };
}

function drawArrowHead(g, from, to, r, color) {
  const ang = Math.atan2(to.y - from.y, to.x - from.x);
  const t = { x: to.x - Math.cos(ang) * (r + 4), y: to.y - Math.sin(ang) * (r + 4) };
  g.save();
  g.translate(t.x, t.y);
  g.rotate(ang);
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(-8, -4);
  g.lineTo(-8, 4);
  g.closePath();
  g.fill();
  g.restore();
}

function drawEdge(g, state, L, edge, edgeIdx, view, clock) {
  const P = SCENES[state.scene] || SCENES['dusk-forest'];
  const { a, b } = edgePoints(state, L, edge);
  const traversed = !!(state.traversedMask & (1 << edgeIdx));
  const gated = edge.gate >= 0;
  const gateMask = state.mode === 'nodes' ? state.visitedMask : state.enteredMask;
  const unlocked = !gated || ((gateMask >> edge.gate) & 1);

  // 当前星子可走的下一步，给一点脉冲提示
  let available = false;
  if (state.phase === 'playing') {
    const cur = state.current;
    if ((edge.a === cur && (edge.dir === 0 || edge.dir === 1)) || (edge.b === cur && (edge.dir === 0 || edge.dir === 2))) {
      if (gated ? unlocked : true) available = true;
    }
  }

  const pulse = 0.5 + 0.5 * Math.sin(clock * 4);

  let stroke = P.dim;
  let width = 2.2;
  if (traversed) {
    stroke = P.silk;
    width = 4.5;
  } else if (gated && !unlocked) {
    stroke = 'rgba(120,130,150,0.30)';
    g.setLineDash([6, 7]);
    width = 2;
  } else if (available) {
    stroke = P.accent;
    width = 3 + pulse * 1.6;
  }

  g.strokeStyle = stroke;
  g.lineWidth = width;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(a.x, a.y);
  g.lineTo(b.x, b.y);
  g.stroke();
  g.setLineDash([]);

  // 已织成的丝带发光
  if (traversed) {
    g.strokeStyle = P.silkGlow;
    g.lineWidth = width + 5;
    g.globalAlpha = 0.35;
    g.beginPath();
    g.moveTo(a.x, a.y);
    g.lineTo(b.x, b.y);
    g.stroke();
    g.globalAlpha = 1;
  }

  // 单向丝：箭头
  if (edge.dir === 1) drawArrowHead(g, a, b, computeLayout(state).r, traversed ? P.silk : P.dim);
  else if (edge.dir === 2) drawArrowHead(g, b, a, computeLayout(state).r, traversed ? P.silk : P.dim);

  // 断线：锁图标语义（未解锁画小锁点）
  if (gated && !unlocked) {
    const mx = (a.x + b.x) / 2;
    const my = (a.y + b.y) / 2;
    g.fillStyle = 'rgba(255,210,90,0.9)';
    g.beginPath();
    g.arc(mx, my, 3.4, 0, TAU);
    g.fill();
  }
}

// ---- 星子 ----
function drawNode(g, state, id, view, clock) {
  const P = SCENES[state.scene] || SCENES['dusk-forest'];
  const L = computeLayout(state);
  const p = L.pos(id);
  const node = state.nodes[id];
  const isStart = state.start === id;
  const isCurrent = state.phase === 'playing' && state.current === id;
  const visited = !!(state.visitedMask & (1 << id));
  const entered = !!(state.enteredMask & (1 << id));
  const lit = state.mode === 'nodes' ? visited : entered;

  const hover = view && view.hoverNode === id;
  const r = L.r * (isStart ? 1.25 : 1) * (hover ? 1.2 : 1);

  // 光晕
  let glow = lit ? P.silkGlow : 'rgba(255,255,255,0.08)';
  const grd = g.createRadialGradient(p.x, p.y, 1, p.x, p.y, r * 2.6);
  grd.addColorStop(0, glow);
  grd.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = grd;
  g.beginPath();
  g.arc(p.x, p.y, r * 2.6, 0, TAU);
  g.fill();

  // 星体
  const core = lit ? P.nodeLit : P.nodeDim;
  g.fillStyle = core;
  g.beginPath();
  g.arc(p.x, p.y, r, 0, TAU);
  g.fill();

  // 星芒（四角）
  g.strokeStyle = lit ? P.silk : 'rgba(255,255,255,0.25)';
  g.lineWidth = 1.4;
  g.beginPath();
  g.moveTo(p.x - r * 1.7, p.y);
  g.lineTo(p.x + r * 1.7, p.y);
  g.moveTo(p.x, p.y - r * 1.7);
  g.lineTo(p.x, p.y + r * 1.7);
  g.stroke();

  // 起点：脉冲环
  if (isStart) {
    const pr = r + 5 + Math.sin(clock * 2.6) * 2;
    g.strokeStyle = P.accent;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(p.x, p.y, pr, 0, TAU);
    g.stroke();
  }

  // 当前：白圈
  if (isCurrent) {
    g.strokeStyle = '#ffffff';
    g.lineWidth = 2.6;
    g.beginPath();
    g.arc(p.x, p.y, r + 4 + Math.sin(clock * 5) * 1.5, 0, TAU);
    g.stroke();
  }

  // 触发星子（有 gate 指向它）：小三角标记
  for (const e of state.edges) {
    if (e.gate === id) {
      g.fillStyle = '#ffd65a';
      g.beginPath();
      g.moveTo(p.x, p.y - r - 8);
      g.lineTo(p.x - 4, p.y - r - 14);
      g.lineTo(p.x + 4, p.y - r - 14);
      g.closePath();
      g.fill();
      break;
    }
  }
}

// ---- 织网路径（发光蛛丝）----
function drawPath(g, state) {
  if (state.path.length < 2) return;
  const P = SCENES[state.scene] || SCENES['dusk-forest'];
  const L = computeLayout(state);
  const pts = state.path.map((id) => L.pos(id));

  g.lineCap = 'round';
  g.lineJoin = 'round';

  // 外发光
  g.strokeStyle = P.silkGlow;
  g.lineWidth = L.r * 1.4;
  g.globalAlpha = 0.4;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i].x, pts[i].y);
  g.stroke();
  g.globalAlpha = 1;

  // 内核亮丝
  g.strokeStyle = '#ffffff';
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i += 1) g.lineTo(pts[i].x, pts[i].y);
  g.stroke();
}

// ---- 完成涟漪 + 萤火虫飞散（signature）----
function drawWinFx(g, state, winT) {
  if (!state || state.phase !== 'won') return;
  const P = SCENES[state.scene] || SCENES['dusk-forest'];
  const L = computeLayout(state);
  const last = state.path[state.path.length - 1];
  const c = L.pos(last ?? state.start);

  // 整张星网涟漪：从终点扩散的多重圆环
  const rings = 4;
  for (let i = 0; i < rings; i += 1) {
    const t = Math.max(0, winT - i * 0.16);
    const k = Math.min(1, t / 0.9);
    if (t <= 0) continue;
    const rr = k * Math.max(WORLD.WIDTH, WORLD.HEIGHT) * 0.62;
    g.strokeStyle = P.silkGlow;
    g.lineWidth = (1 - k) * 5 + 1;
    g.globalAlpha = (1 - k) * 0.7;
    g.beginPath();
    g.arc(c.x, c.y, rr, 0, TAU);
    g.stroke();
  }
  g.globalAlpha = 1;

  // 萤火虫群飞散
  for (let i = 0; i < 34; i += 1) {
    const ang = seededRand(i, 1, 5) * TAU + i * 0.37;
    const spd = 90 + seededRand(i, 3, 9) * 220;
    const d = spd * Math.min(winT, 1.6);
    const fx = c.x + Math.cos(ang) * d;
    const fy = c.y + Math.sin(ang) * d;
    const a = Math.max(0, 1 - winT / 1.6);
    g.fillStyle = P.firefly;
    g.globalAlpha = a;
    g.beginPath();
    g.arc(fx, fy, 2.6, 0, TAU);
    g.fill();
    // 拖尾
    g.globalAlpha = a * 0.35;
    g.beginPath();
    g.arc(fx - Math.cos(ang) * 9, fy - Math.sin(ang) * 9, 1.7, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

// ---- 环境萤火虫（薄暮林间场景的氛围粒子）----
function drawAmbientFireflies(g, state, clock) {
  const P = SCENES[state.scene] || SCENES['dusk-forest'];
  const count = state.scene === 'dusk-forest' ? 10 : state.scene === 'aurora-ice' ? 6 : 0;
  for (let i = 0; i < count; i += 1) {
    const fx = seededRand(i, 11, 3) * WORLD.WIDTH + Math.sin(clock * 1.1 + i * 2.1) * 40;
    const fy = WORLD.HEIGHT * 0.55 + Math.sin(clock * 0.9 + i * 1.7) * 60 + seededRand(i, 13, 7) * 70;
    const a = 0.25 + Math.sin(clock * 2.4 + i) * 0.2;
    g.fillStyle = P.firefly;
    g.globalAlpha = Math.max(0, a);
    g.beginPath();
    g.arc(fx, fy, 2.2, 0, TAU);
    g.fill();
  }
  g.globalAlpha = 1;
}

// ---- 渲染器入口 ----
export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;
  let lastPhase = null;
  let winT = 0;

  // 标题屏：用大师网作静态星网背景
  const titleState = (() => {
    const L = normalizeLevel(LEVELS[11]);
    return {
      level: 12, scene: 'deep-space', mode: 'nodes', start: 0, current: 0,
      nodes: L.nodes, edges: L.edges, path: [0],
      visitedMask: 1 << 0, traversedMask: 0, enteredMask: 1 << 0,
      phase: 'title', moves: 0, par: 7, stars: 0,
    };
  })();

  function nodePositions(state) {
    const L = computeLayout(state);
    return state.nodes.map((n, id) => ({ id, ...L.pos(id), r: L.r }));
  }

  function hitNode(p, state) {
    const L = computeLayout(state);
    let best = -1;
    let bestD = LAYOUT.HIT_R;
    for (let id = 0; id < state.nodes.length; id += 1) {
      const q = L.pos(id);
      const d = Math.hypot(p.x - q.x, p.y - q.y);
      if (d < bestD) { bestD = d; best = id; }
    }
    return best;
  }

  function debugLayout() {
    const st = lastState || titleState;
    const L = computeLayout(st);
    return {
      hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
      web: { x: L.playX, y: L.playY, w: L.playW, h: L.playH },
      nodes: nodePositions(st),
      r: L.r,
    };
  }

  function draw(state, dt, view) {
    const v = view || {};
    clock += dt || 0;
    const st = state || titleState;
    lastState = st;

    if (st.phase !== lastPhase) {
      lastPhase = st.phase;
      if (st.phase === 'won') winT = 0;
    }
    if (st.phase === 'won') winT += dt || 0;

    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground(st.scene), 0, 0);

    drawAmbientFireflies(ctx, st, clock);

    // 丝线
    for (let i = 0; i < st.edges.length; i += 1) {
      drawEdge(ctx, st, st, st.edges[i], i, v, clock);
    }

    // 织网路径
    drawPath(ctx, st);

    // 星子
    for (let id = 0; id < st.nodes.length; id += 1) {
      drawNode(ctx, st, id, v, clock);
    }

    // hover 高亮环
    if (v.hoverNode != null && v.hoverNode >= 0) {
      const L = computeLayout(st);
      const p = L.pos(v.hoverNode);
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(p.x, p.y, L.r + 7, 0, TAU);
      ctx.stroke();
    }

    // 键盘 Tab 聚焦环（黄框，区别于 hover）
    if (v.focusNode != null && v.focusNode >= 0) {
      const L = computeLayout(st);
      const p = L.pos(v.focusNode);
      ctx.strokeStyle = '#ffd65a';
      ctx.lineWidth = 3.5;
      ctx.setLineDash([5, 4]);
      ctx.beginPath();
      ctx.arc(p.x, p.y, L.r + 11, 0, TAU);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    drawWinFx(ctx, st, winT);
  }

  return { draw, debugLayout, hitNode, nodePositions };
}
