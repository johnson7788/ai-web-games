// Travel Master Pack · 渲染层（canvas 程序化，霓虹街机统一气质，零素材零外链）
// 只读 sim 状态画图；粒子/震屏走 view（main 注入）。DPR ≤2。

import { WORLD, GAME } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const HORIZON = 258;

const C = {
  skyTop: '#0b0418',
  skyMid: '#251040',
  skyHorizon: '#57195f',
  sunA: '#ff7ab0',
  sunB: '#ff2e63',
  sunLine: '#3c1030',
  star: '#cfe9ff',
  grid: '#7a2f9c',
  gridFar: '#4c1c66',
  laneGuide: 'rgba(255,255,255,0.07)',
  playerCore: '#ffffff',
  playerGlow: '#59f2ff',
  playerBody: '#2bd8ff',
  barrier: ['#ff8a00', '#ff2e63', '#ff3b3b'],
  barrierGlow: ['#ff8a00', '#ff2e63', '#ff3b3b'],
  goods: ['#39ff88', '#41e8ff', '#b6ff4a'],
  goodsGlow: '#39ff88',
  shield: '#ffd84e',
  shieldGlow: '#ffd84e',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  // 预生成星空（固定）
  const stars = [];
  let starSeed = 7;
  const srand = () => { starSeed = (starSeed * 16807) % 2147483647; return starSeed / 2147483647; };
  for (let i = 0; i < 90; i += 1) {
    stars.push({ x: srand() * W, y: srand() * HORIZON, r: 0.5 + srand() * 1.6, p: srand() * Math.PI * 2 });
  }

  // 远景城市天际线（固定）
  const skyline = [];
  for (let x = 0; x < W; x += 46) {
    const h = 18 + srand() * 60;
    skyline.push({ x, w: 34, h, top: HORIZON - h });
  }

  // 地面纵向汇聚线（固定端点，从视平线向底部扩散）
  const gridV = [];
  const vanish = { x: W / 2, y: HORIZON };
  for (let i = -9; i <= 9; i += 1) {
    gridV.push({ x: vanish.x + i * 200, yTop: vanish.y, xBottom: vanish.x + i * 320, yBottom: H });
  }

  function drawSky(t) {
    const g = ctx.createLinearGradient(0, 0, 0, HORIZON);
    g.addColorStop(0, C.skyTop);
    g.addColorStop(0.6, C.skyMid);
    g.addColorStop(1, C.skyHorizon);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, HORIZON + 4);

    // 星星
    for (const s of stars) {
      const tw = 0.4 + 0.6 * (0.5 + 0.5 * Math.sin(t * 1.6 + s.p));
      ctx.globalAlpha = tw;
      ctx.fillStyle = C.star;
      ctx.fillRect(s.x, s.y, s.r, s.r);
    }
    ctx.globalAlpha = 1;

    // 太阳（带霓虹横缝）
    const sg = ctx.createLinearGradient(0, HORIZON - 150, 0, HORIZON + 40);
    sg.addColorStop(0, C.sunA);
    sg.addColorStop(1, C.sunB);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(vanish.x, HORIZON - 26, 118, Math.PI, 0);
    ctx.fill();
    ctx.restore();
    ctx.fillStyle = C.sunLine;
    for (let i = 0; i < 5; i += 1) {
      const y = HORIZON - 8 - i * 16;
      ctx.fillRect(vanish.x - 116, y, 232, 3 + i * 1.5);
    }

    // 天际线
    ctx.fillStyle = 'rgba(12, 5, 20, 0.9)';
    for (const b of skyline) ctx.fillRect(b.x, b.top, b.w, b.h);
  }

  function drawFloor(t) {
    // 地面底色
    const g = ctx.createLinearGradient(0, HORIZON, 0, H);
    g.addColorStop(0, '#1c0b30');
    g.addColorStop(1, '#0b0418');
    ctx.fillStyle = g;
    ctx.fillRect(0, HORIZON, W, H - HORIZON);

    // 纵向线
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const l of gridV) {
      ctx.moveTo(l.x, l.yTop);
      ctx.lineTo(l.xBottom, l.yBottom);
    }
    ctx.stroke();

    // 横向滚线（向画面下方流动，营造前进感）
    const speed = 90; // px/s
    const span = H - HORIZON;
    const count = 10;
    ctx.strokeStyle = C.gridFar;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < count; i += 1) {
      // 用 (i / count + t*speed/span) 取小数部分，形成循环
      const k = ((i / count) + (t * speed) / span) % 1;
      // 近大远小：y 用平方分布
      const y = HORIZON + span * (k * k);
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
    }
    ctx.stroke();
  }

  function drawLanes() {
    // 车道分隔虚线
    ctx.save();
    ctx.strokeStyle = C.laneGuide;
    ctx.lineWidth = 3;
    ctx.setLineDash([14, 16]);
    ctx.beginPath();
    for (let i = 0; i < GAME.LANE_COUNT - 1; i += 1) {
      const x = (GAME.LANE_X[i] + GAME.LANE_X[i + 1]) / 2;
      ctx.moveTo(x, 0);
      ctx.lineTo(x, H);
    }
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.restore();
  }

  function glow(color, blur = 18) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function noGlow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }

  function drawCross(x, y, r) {
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.stroke();
    ctx.lineCap = 'butt';
  }

  function drawBarrier(e) {
    const x = GAME.LANE_X[e.lane];
    const y = e.y;
    ctx.save();
    glow(C.barrierGlow[e.thing], 18);
    if (e.thing === 0) {
      // 路锥
      ctx.fillStyle = C.barrier[0];
      ctx.beginPath();
      ctx.moveTo(x - 34, y + 30);
      ctx.lineTo(x, y - 30);
      ctx.lineTo(x + 34, y + 30);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#ffd8a0';
      ctx.fillRect(x - 40, y + 28, 80, 8);
      drawCross(x, y - 4, 12);
    } else if (e.thing === 1) {
      // 能量潭（椭圆）
      ctx.fillStyle = C.barrier[1];
      ctx.beginPath();
      ctx.ellipse(x, y, 46, 26, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#ffd0de';
      ctx.lineWidth = 2;
      ctx.stroke();
      drawCross(x, y, 12);
    } else {
      // 路障（红白条纹）
      ctx.fillStyle = C.barrier[2];
      ctx.fillRect(x - 44, y - 24, 88, 48);
      ctx.fillStyle = '#ffffff';
      for (let i = -1; i < 3; i += 1) ctx.fillRect(x - 44 + i * 24 + 4, y - 24, 12, 48);
      ctx.strokeStyle = '#ffe0c0';
      ctx.lineWidth = 3;
      ctx.strokeRect(x - 44, y - 24, 88, 48);
      drawCross(x, y, 14);
    }
    ctx.restore();
    noGlow();
  }

  function drawGoods(e) {
    const x = GAME.LANE_X[e.lane];
    const y = e.y;
    ctx.save();
    glow(C.goodsGlow, 18);
    // 包裹
    ctx.fillStyle = C.goods[e.thing];
    ctx.fillRect(x - 30, y - 26, 60, 52);
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 3;
    ctx.strokeRect(x - 30, y - 26, 60, 52);
    // 捆带
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(x - 4, y - 26, 8, 52);
    // 收集物标记：白色菱形 ◆
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.moveTo(x, y - 46);
    ctx.lineTo(x + 15, y - 34);
    ctx.lineTo(x, y - 22);
    ctx.lineTo(x - 15, y - 34);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    noGlow();
  }

  function drawShieldPickup(e) {
    const x = GAME.LANE_X[e.lane];
    const y = e.y;
    ctx.save();
    glow(C.shieldGlow, 20);
    ctx.strokeStyle = C.shield;
    ctx.lineWidth = 5;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (Math.PI / 3) * i - Math.PI / 2;
      const px = x + Math.cos(a) * 30;
      const py = y + Math.sin(a) * 30;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(255,216,78,0.25)';
    ctx.fill();
    // 白色加号标记（= 护盾/增益）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x - 11, y - 3, 22, 6);
    ctx.fillRect(x - 3, y - 11, 6, 22);
    ctx.restore();
    noGlow();
  }

  function drawPlayer(state, t) {
    const x = GAME.LANE_X[state ? state.lane : 1];
    const y = GAME.PLAYER_Y;
    ctx.save();
    // 喷射火焰
    const flick = 6 + Math.sin(t * 40) * 3;
    glow('#ff9a3d', 14);
    ctx.fillStyle = '#ffcf6a';
    ctx.beginPath();
    ctx.moveTo(x - 16, y + 26);
    ctx.lineTo(x - 6, y + 26 + flick);
    ctx.lineTo(x + 2, y + 26);
    ctx.moveTo(x + 8, y + 26);
    ctx.lineTo(x + 16, y + 26 + flick);
    ctx.lineTo(x + 20, y + 26);
    ctx.closePath();
    ctx.fill();
    // 车身（最亮）
    glow(C.playerGlow, 22);
    ctx.fillStyle = C.playerBody;
    roundRect(ctx, x - 52, y - 24, 104, 50, 14);
    ctx.fill();
    ctx.fillStyle = C.playerCore;
    roundRect(ctx, x - 40, y - 16, 80, 18, 8);
    ctx.fill();
    // 驾驶员圆点
    ctx.fillStyle = '#1b2540';
    ctx.beginPath();
    ctx.arc(x, y - 2, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(x + 2, y - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    // 护盾层数显示（若有）
    if (state && state.shield > 0) {
      ctx.strokeStyle = C.shield;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, 44, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < state.shield; i += 1) {
        ctx.fillStyle = '#eafcff';
        ctx.beginPath();
        ctx.arc(x + 34, y - 34 + i * 12, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    noGlow();
  }

  function roundRect(c, x, y, w, h, r) {
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }

  function drawParticles(fx, dt) {
    for (const p of fx) {
      if (p.ttl <= 0) continue;
      const a = Math.max(0, p.ttl / p.max);
      ctx.save();
      ctx.globalAlpha = a;
      glow(p.color || '#ffffff', 12);
      ctx.fillStyle = p.color || '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.5 + a * 0.5), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.ttl -= dt;
    }
    noGlow();
  }

  function draw(state, dt, view = {}) {
    const t = (view.time || 0);
    ctx.clearRect(0, 0, W, H);

    ctx.save();
    if (view.shake > 0) {
      const sx = (Math.random() - 0.5) * view.shake;
      const sy = (Math.random() - 0.5) * view.shake;
      ctx.translate(sx, sy);
    }

    drawSky(t);
    drawFloor(t);
    drawLanes();

    if (state && state.entities) {
      for (const e of state.entities) {
        if (e.kind === 'barrier') drawBarrier(e);
        else if (e.kind === 'goods') drawGoods(e);
        else if (e.kind === 'shield') drawShieldPickup(e);
      }
    }
    drawPlayer(state, t);
    drawParticles(view.fxQueue || [], dt);

    ctx.restore();
  }

  function debugLayout() {
    return {
      playfield: { x: 0, y: 0, w: W, h: H },
      lanes: GAME.LANE_X.map((x) => ({ x: x - GAME.LANE_W / 2, y: 0, w: GAME.LANE_W, h: H })),
      player: { x: GAME.LANE_X[1] - 52, y: GAME.PLAYER_Y - 26, w: 104, h: 52 },
      horizon: HORIZON,
    };
  }

  return { draw, debugLayout, resize };
}
