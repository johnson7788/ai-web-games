// Canvas 2D 渲染：霓虹街机风（纯程序化，零素材零外链）
// 卡车是最亮元素（silhouette 友好）；火池/火花束/能量核心分层清晰。
import { WORLD, GAME } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  function glow(color, blur = 22) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function noGlow() { ctx.shadowColor = 'transparent'; ctx.shadowBlur = 0; }

  function drawBackground(now) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#070818');
    g.addColorStop(0.55, '#0d0b22');
    g.addColorStop(1, '#1a0f2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 网格
    ctx.strokeStyle = 'rgba(120,120,255,0.05)';
    ctx.lineWidth = 1;
    const step = 48;
    for (let x = 0; x <= W; x += step) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    for (let y = 0; y <= H; y += step) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }

    // 远景地平线光带
    const hg = ctx.createLinearGradient(0, 0, W, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0)');
    hg.addColorStop(0.5, 'rgba(60,40,140,0.35)');
    hg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 120, W, 6);
  }

  function drawFire(now) {
    const top = GAME.FIRE_Y;
    const g = ctx.createLinearGradient(0, top, 0, H);
    g.addColorStop(0, '#ff5a1f');
    g.addColorStop(0.5, '#e0326e');
    g.addColorStop(1, '#4a0f3a');
    ctx.fillStyle = g;
    ctx.fillRect(0, top, W, H - top);

    // 波动光带
    glow('#ff6a2a', 26);
    ctx.fillStyle = 'rgba(255,140,50,0.55)';
    for (let i = 0; i < 7; i += 1) {
      const px = ((i * 180 + now * 0.02) % (W + 120)) - 60;
      const ph = Math.sin(now * 0.004 + i * 1.7) * 14 + 22;
      ctx.beginPath();
      ctx.ellipse(px, top + 6, 70, ph, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    noGlow();

    // 顶面火线
    ctx.strokeStyle = '#ffd23e';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, top);
    for (let x = 0; x <= W; x += 16) {
      ctx.lineTo(x, top - Math.abs(Math.sin(x * 0.02 + now * 0.005)) * 4);
    }
    ctx.stroke();

    // 危险条纹带（火池顶缘，明确不可通行）
    const bandH = 12;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, W, bandH);
    ctx.clip();
    ctx.fillStyle = '#ff9d1f';
    for (let x = -24; x < W; x += 24) {
      ctx.beginPath();
      ctx.moveTo(x, top + bandH);
      ctx.lineTo(x + 12, top);
      ctx.lineTo(x + 24, top + bandH);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }

  function drawPlatform(x0, x1, y, color, now) {
    // 台体
    const g = ctx.createLinearGradient(0, y, 0, y + 60);
    g.addColorStop(0, 'rgba(20,40,60,0.95)');
    g.addColorStop(1, 'rgba(12,20,36,0.95)');
    ctx.fillStyle = g;
    ctx.fillRect(x0, y, x1 - x0, 60);
    // 顶面
    glow(color, 18);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(x0, y);
    ctx.lineTo(x1, y);
    ctx.stroke();
    noGlow();
    // 警示斜纹
    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y, x1 - x0, 60);
    ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,0.05)';
    ctx.lineWidth = 8;
    for (let x = x0 - 60; x < x1; x += 34) {
      ctx.beginPath(); ctx.moveTo(x, y + 60); ctx.lineTo(x + 60, y); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTrack(points, now) {
    if (!points || points.length < 2) return;
    ctx.save();
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    // 路面（宽 strip）
    ctx.strokeStyle = 'rgba(28,36,58,0.92)';
    ctx.lineWidth = 34;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    // 霓虹核心线
    glow('#7ffbff', 14);
    ctx.strokeStyle = '#b9fdff';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
    ctx.stroke();
    noGlow();
    ctx.restore();
  }

  function drawBeam(b, now) {
    const flicker = 0.8 + Math.sin(now * 0.02 + b.x) * 0.2;
    const h = b.yBot - b.yTop;
    glow('#ff2bd6', 30);
    ctx.fillStyle = `rgba(255,43,214,${0.35 * flicker})`;
    ctx.fillRect(b.x - GAME.BEAM_HALF_W, b.yTop, GAME.BEAM_HALF_W * 2, h);
    ctx.fillStyle = `rgba(255,120,240,${0.9 * flicker})`;
    ctx.fillRect(b.x - 3, b.yTop, 6, h);
    noGlow();
    // 顶部与底部端点
    ctx.fillStyle = '#ffd7fb';
    ctx.beginPath(); ctx.arc(b.x, b.yTop, 6, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(b.x, b.yBot, 6, 0, Math.PI * 2); ctx.fill();
  }

  function drawCore(c, now, collected) {
    const pulse = 1 + Math.sin(now * 0.006 + c.x) * 0.14;
    const r = 13 * pulse;
    glow('#7ffbff', 24);
    if (!collected) {
      ctx.fillStyle = 'rgba(127,251,255,0.22)';
      ctx.beginPath(); ctx.arc(c.x, c.y, r + 10, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#eaffff';
      ctx.beginPath(); ctx.arc(c.x, c.y, r, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#37f0ff';
      ctx.beginPath(); ctx.arc(c.x, c.y, r * 0.55, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.strokeStyle = 'rgba(127,251,255,0.4)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(c.x, c.y, 16, 0, Math.PI * 2); ctx.stroke();
    }
    noGlow();
  }

  function drawGoalMarker(now) {
    const x = (GAME.GOAL_X0 + GAME.GOAL_X1) / 2;
    const y = GAME.GOAL_Y - 40;
    const bob = Math.sin(now * 0.005) * 5;
    glow('#2bff8c', 20);
    ctx.fillStyle = '#2bff8c';
    ctx.beginPath();
    ctx.moveTo(x - 14, y - 20 + bob);
    ctx.lineTo(x + 14, y - 20 + bob);
    ctx.lineTo(x, y + 2 + bob);
    ctx.closePath();
    ctx.fill();
    noGlow();
    ctx.strokeStyle = '#d6fff0';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, y + 2 + bob);
    ctx.lineTo(x, y + 24 + bob);
    ctx.stroke();
  }

  function drawTruck(tr, now, driving) {
    const x = tr.x;
    const y = tr.y;
    const tilt = Math.max(-0.16, Math.min(0.16, tr.vx * 0.004));
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt);
    glow('#2ef2ff', 22);
    // 车体
    ctx.fillStyle = '#2ef2ff';
    roundRect(ctx, -30, -15, 52, 30, 6);
    ctx.fill();
    // 货厢高亮
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, -26, -11, 20, 22, 4);
    ctx.fill();
    // 驾驶室（前=右）
    ctx.fillStyle = '#c9feff';
    roundRect(ctx, 6, -12, 14, 24, 4);
    ctx.fill();
    noGlow();
    // 车窗
    ctx.fillStyle = '#0a1630';
    roundRect(ctx, 9, -8, 9, 10, 2);
    ctx.fill();
    // 轮子
    ctx.fillStyle = '#0b0b14';
    ctx.beginPath(); ctx.arc(-17, 15, 8, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(19, 15, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3a4a6a';
    ctx.beginPath(); ctx.arc(-17, 15, 3.5, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(19, 15, 3.5, 0, Math.PI * 2); ctx.fill();
    // 车灯
    glow('#fff7b0', 14);
    ctx.fillStyle = '#fff7b0';
    ctx.beginPath(); ctx.arc(22, -4, 3, 0, Math.PI * 2); ctx.fill();
    noGlow();
    // 排气（行驶时）
    if (driving) {
      ctx.fillStyle = 'rgba(120,220,255,0.4)';
      const puff = (now * 0.02) % 1;
      ctx.beginPath(); ctx.arc(-34 - puff * 18, 10 - puff * 8, 5 + puff * 6, 0, Math.PI * 2); ctx.fill();
    }
    ctx.restore();
  }

  function drawScene(state, now, driving) {
    drawBackground(now);
    drawFire(now);
    drawPlatform(GAME.LEDGE_X0, GAME.LEDGE_X1, GAME.LEDGE_Y, '#19e3ff', now);
    drawPlatform(GAME.GOAL_X0, GAME.GOAL_X1, GAME.GOAL_Y, '#2bff8c', now);

    const tracks = state ? state.tracks : [];
    const beams = state ? state.beams : [];
    const cores = state ? state.cores : [];
    const truck = state ? state.truck : null;

    for (const t of tracks) drawTrack(t, now);
    drawGoalMarker(now);
    for (const b of beams) drawBeam(b, now);
    for (const c of cores) drawCore(c, now, c.collected);
    if (truck) drawTruck(truck, now, driving);
  }

  // 标题屏展示场景（一个漂亮的示例路线）
  function demoScene(now) {
    drawScene(null, now, false);
    drawTrack([
      { x: 200, y: 470 },
      { x: 340, y: 470 },
      { x: 430, y: 280 },
      { x: 560, y: 260 },
      { x: 700, y: 540 },
      { x: 860, y: 540 },
      { x: 1085, y: 470 },
    ], now);
    drawBeam({ x: 640, yTop: 340, yBot: 470 }, now);
    drawCore({ x: 560, y: 260 }, now, false);
    drawCore({ x: 700, y: 540 }, now, false);
    drawTruck({ x: 200, y: GAME.LEDGE_Y - GAME.TRUCK_R, vx: 0 }, now, false);
  }

  return {
    draw(state, now, view = {}) {
      const driving = !!(state && state.phase === 'playing' && state.inputDir !== 0);
      if (state) drawScene(state, now, driving);
      else demoScene(now);
      if (view.shake > 0) {
        const s = view.shake;
        ctx.save();
        ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
        ctx.restore();
      }
    },
  };
}
