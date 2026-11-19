// Frenzy Racer · canvas 程序化渲染（霓虹街机风，零美术文件）
// 背景 = 合成波渐变 + 网格 + 落日；道路 = 4 车道 + 滚动虚线；车辆 = 发光圆角车；
// 实体 = 能量球（黄）/ 闸门（红）/ 护盾（青绿）。
import { WORLD, LAYOUT, GAME } from '../../config/game.config.js';

const TAU = Math.PI * 2;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function glow(ctx, color, blur = 18) {
  ctx.shadowColor = color;
  ctx.shadowBlur = blur;
}

function noGlow(ctx) {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let W = WORLD.WIDTH;
  let H = WORLD.HEIGHT;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    W = WORLD.WIDTH;
    H = WORLD.HEIGHT;
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(H * dpr);
    canvas.style.width = `${W}px`;
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  if (typeof window !== 'undefined') {
    resize();
    window.addEventListener('resize', resize);
  }

  // ---------- 背景（合成波网格 + 落日） ----------
  function drawBackground(time) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1b0b3f');
    g.addColorStop(0.55, '#2a0f52');
    g.addColorStop(1, '#0c0524');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 落日
    const sunX = W / 2;
    const sunY = H * 0.42;
    const sunR = 120;
    const sg = ctx.createLinearGradient(0, sunY - sunR, 0, sunY + sunR);
    sg.addColorStop(0, '#ff5ea8');
    sg.addColorStop(0.5, '#ff9d2e');
    sg.addColorStop(1, '#ffd23e');
    ctx.save();
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.arc(sunX, sunY, sunR, 0, TAU);
    ctx.fill();
    // 落日条纹
    ctx.fillStyle = 'rgba(26,11,59,0.55)';
    for (let i = 0; i < 6; i += 1) {
      const yy = sunY - sunR + 10 + i * 24;
      ctx.fillRect(sunX - sunR - 20, yy, sunR * 2 + 40, 6 + i * 2);
    }
    ctx.restore();

    // 透视网格地面
    ctx.save();
    ctx.strokeStyle = 'rgba(120, 90, 220, 0.35)';
    ctx.lineWidth = 1.5;
    const horizon = H * 0.46;
    const scroll = (time * 60) % 40;
    for (let i = 0; i <= 14; i += 1) {
      const y = horizon + Math.pow(i / 14, 2.1) * (H - horizon) + scroll * 0.0;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // 纵向网格线（向消失点汇聚）
    const cx = W / 2;
    for (let i = -6; i <= 6; i += 1) {
      ctx.beginPath();
      ctx.moveTo(cx + i * 26, horizon);
      ctx.lineTo(cx + i * 190, H);
      ctx.stroke();
    }
    ctx.restore();
  }

  // ---------- 道路 ----------
  function drawRoad(time) {
    const { ROAD_L, ROAD_R, CAR_Y, SPAWN_Y, LANE_CX } = LAYOUT;
    // 路面
    const rg = ctx.createLinearGradient(ROAD_L, 0, ROAD_R, 0);
    rg.addColorStop(0, '#120c26');
    rg.addColorStop(0.5, '#1a1233');
    rg.addColorStop(1, '#120c26');
    ctx.fillStyle = rg;
    ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);

    // 路边霓虹灯带
    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ff2d95';
    glow(ctx, '#ff2d95', 16);
    ctx.beginPath(); ctx.moveTo(ROAD_L, 0); ctx.lineTo(ROAD_L, H); ctx.stroke();
    ctx.strokeStyle = '#21e6ff';
    glow(ctx, '#21e6ff', 16);
    ctx.beginPath(); ctx.moveTo(ROAD_R, 0); ctx.lineTo(ROAD_R, H); ctx.stroke();
    noGlow(ctx);
    ctx.restore();

    // 车道分隔虚线（滚动）
    const dashH = 46;
    const gap = 34;
    const offset = (time * (200 + 60) * 0.6) % (dashH + gap);
    ctx.strokeStyle = 'rgba(210, 200, 255, 0.5)';
    ctx.lineWidth = 4;
    ctx.setLineDash([dashH, gap]);
    for (let i = 1; i < 4; i += 1) {
      const x = ROAD_L + ((ROAD_R - ROAD_L) / 4) * i;
      ctx.beginPath();
      ctx.moveTo(x, 0 - gap + offset);
      ctx.lineTo(x, H);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // 车道中心参考线（暗）
    return { LANE_CX, CAR_Y, SPAWN_Y };
  }

  // ---------- 车辆 ----------
  function drawCar(x, y, lane, color, time, tilt) {
    const { CAR_W, CAR_H } = LAYOUT;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(tilt || 0);
    // 车身发光
    glow(ctx, color, 26);
    const bg = ctx.createLinearGradient(0, -CAR_H / 2, 0, CAR_H / 2);
    bg.addColorStop(0, color);
    bg.addColorStop(1, shade(color, 0.45));
    ctx.fillStyle = bg;
    roundRect(ctx, -CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 22);
    ctx.fill();
    noGlow(ctx);
    // 车顶高光
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundRect(ctx, -CAR_W / 2 + 12, -CAR_H / 2 + 12, CAR_W - 24, 20, 8);
    ctx.fill();
    // 前挡风
    ctx.fillStyle = 'rgba(8,8,24,0.8)';
    roundRect(ctx, -CAR_W / 2 + 16, -CAR_H / 2 + 34, CAR_W - 32, 26, 8);
    ctx.fill();
    // 尾灯 / 头灯
    ctx.fillStyle = '#fff';
    glow(ctx, '#fff', 10);
    ctx.fillRect(-CAR_W / 2 + 8, -CAR_H / 2 + 4, 12, 8);
    ctx.fillRect(CAR_W / 2 - 20, -CAR_H / 2 + 4, 12, 8);
    ctx.fillRect(-CAR_W / 2 + 8, CAR_H / 2 - 12, 12, 8);
    ctx.fillRect(CAR_W / 2 - 20, CAR_H / 2 - 12, 12, 8);
    noGlow(ctx);
    ctx.restore();
  }

  function shade(hex, f) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.round(((n >> 16) & 255) * f);
    const g = Math.round(((n >> 8) & 255) * f);
    const b = Math.round((n & 255) * f);
    return `rgb(${r},${g},${b})`;
  }

  function entityY(e, state) {
    const { CAR_Y, SPAWN_Y } = LAYOUT;
    const t = e.arrive - state.time; // >0 未到，<0 已过
    const lead = state.lead || 1;
    return CAR_Y - t * ((CAR_Y - SPAWN_Y) / lead);
  }

  // ---------- 实体 ----------
  function drawOrb(x, y, time) {
    const r = 15 + Math.sin(time * 6 + x * 0.05) * 2.5;
    ctx.save();
    glow(ctx, '#ffd23e', 24);
    const g = ctx.createRadialGradient(x, y, 2, x, y, r);
    g.addColorStop(0, '#fff7d6');
    g.addColorStop(0.4, '#ffd23e');
    g.addColorStop(1, '#ff9d2e');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, TAU);
    ctx.fill();
    noGlow(ctx);
    // 星芒
    ctx.strokeStyle = 'rgba(255,255,255,0.8)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x - r - 6, y); ctx.lineTo(x + r + 6, y);
    ctx.moveTo(x, y - r - 6); ctx.lineTo(x, y + r + 6);
    ctx.stroke();
    ctx.restore();
  }

  function drawBarrier(x, y, time) {
    const w = 74;
    const h = 22;
    ctx.save();
    glow(ctx, '#ff3b3b', 20);
    ctx.fillStyle = '#2a0a14';
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 5);
    ctx.fill();
    // 危险斜纹
    ctx.save();
    ctx.beginPath();
    ctx.rect(x - w / 2, y - h / 2, w, h);
    ctx.clip();
    ctx.strokeStyle = '#ff3b3b';
    ctx.lineWidth = 7;
    for (let i = -w; i < w; i += 16) {
      ctx.beginPath();
      ctx.moveTo(x + i, y - h / 2 - 4);
      ctx.lineTo(x + i + h, y + h / 2 + 4);
      ctx.stroke();
    }
    ctx.restore();
    // 两端灯柱
    ctx.fillStyle = '#ff3b3b';
    glow(ctx, '#ff3b3b', 12);
    ctx.fillRect(x - w / 2 - 5, y - h / 2 - 6, 4, h + 12);
    ctx.fillRect(x + w / 2 + 1, y - h / 2 - 6, 4, h + 12);
    noGlow(ctx);
    ctx.restore();
  }

  function drawShield(x, y, time) {
    const r = 17;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(Math.sin(time * 4) * 0.25);
    glow(ctx, '#39ffb0', 22);
    ctx.strokeStyle = '#39ffb0';
    ctx.lineWidth = 4;
    ctx.beginPath();
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * TAU - Math.PI / 2;
      const px = Math.cos(a) * r;
      const py = Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.fillStyle = 'rgba(57,255,176,0.25)';
    ctx.fill();
    noGlow(ctx);
    ctx.fillStyle = '#39ffb0';
    ctx.font = 'bold 14px system-ui';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('+', 0, 1);
    ctx.restore();
  }

  // ---------- 粒子效果 ----------
  function drawFx(view, dt) {
    const keep = [];
    for (const fx of view.fxQueue) {
      fx.ttl -= dt;
      if (fx.ttl <= 0) continue;
      keep.push(fx);
      const p = 1 - fx.ttl / fx.life;
      const x = fx.x;
      const y = fx.y;
      if (fx.type === 'burst') {
        const r = 6 + p * 30;
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.strokeStyle = '#ffd23e';
        glow(ctx, '#ffd23e', 14);
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
        noGlow(ctx);
        ctx.restore();
      } else if (fx.type === 'spark') {
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = '#ff2d95';
        glow(ctx, '#ff2d95', 12);
        ctx.beginPath(); ctx.arc(x, y, 4 * (1 - p) + 1, 0, TAU); ctx.fill();
        noGlow(ctx);
        ctx.restore();
      } else if (fx.type === 'shieldFlash') {
        ctx.save();
        ctx.globalAlpha = 1 - p;
        ctx.fillStyle = 'rgba(57,255,176,0.35)';
        ctx.beginPath(); ctx.arc(x, y, 40 * p + 8, 0, TAU); ctx.fill();
        ctx.restore();
      }
    }
    view.fxQueue = keep;
  }

  // ---------- 主绘制 ----------
  function draw(state, dt, view = {}) {
    const time = (state ? state.time : view.time ?? 0);
    ctx.save();
    if (view.shake > 0) {
      ctx.translate((Math.random() - 0.5) * view.shake * 2, (Math.random() - 0.5) * view.shake * 2);
    }
    drawBackground(time);
    const { LANE_CX, CAR_Y } = drawRoad(time);

    if (state) {
      // 实体
      for (const e of state.entities) {
        if (e.resolved) continue;
        const x = LANE_CX[e.lane];
        const y = entityY(e, state);
        if (y < -60 || y > H + 60) continue;
        if (e.kind === 'star') drawOrb(x, y, time);
        else if (e.kind === 'barrier') drawBarrier(x, y, time);
        else if (e.kind === 'shield') drawShield(x, y, time);
      }
    } else {
      // 标题演示：两辆车 + 几条装饰球
      for (let i = 0; i < 4; i += 1) {
        const x = LANE_CX[i];
        const y = ((time * 90 + i * 160) % (H + 120)) - 60;
        drawOrb(x, y, time);
      }
    }

    // 车辆（car1 紫 / car2 青）
    const tilt = view.carTilt || { c1: 0, c2: 0 };
    const c1Lane = state ? state.cars.c1 : 0;
    const c2Lane = state ? state.cars.c2 : 0;
    const c1x = LANE_CX[c1Lane];
    const c2x = LANE_CX[2 + c2Lane];
    drawCar(c1x, CAR_Y, c1Lane, '#ff2d95', time, tilt.c1 || 0);
    drawCar(c2x, CAR_Y, 2 + c2Lane, '#21e6ff', time, tilt.c2 || 0);

    // 护盾光环
    if (state && state.shield) {
      ctx.save();
      ctx.strokeStyle = 'rgba(57,255,176,0.7)';
      glow(ctx, '#39ffb0', 16);
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(c1x, CAR_Y, 52, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(c2x, CAR_Y, 52, 0, TAU); ctx.stroke();
      noGlow(ctx);
      ctx.restore();
    }

    drawFx(view, dt || 0);
    ctx.restore();
  }

  function debugLayout() {
    return {
      lanes: LAYOUT.LANE_CX,
      carY: LAYOUT.CAR_Y,
      road: { x: LAYOUT.ROAD_L, y: 0, w: LAYOUT.ROAD_R - LAYOUT.ROAD_L, h: H },
    };
  }

  return { draw, debugLayout, resize };
}
