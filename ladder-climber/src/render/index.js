// LADDER CLIMBER · 渲染层（纯 canvas 程序化，霓虹街机风，零素材零外链）
// 世界坐标：y 向上增大；screenX = W/2 + (wx - camX)，screenY = H*0.62 - (wy - camY)。
// 画：合成波背景 + 星空 + 上升的「数据擦除波」+ 霓虹阶梯塔 + 星星/冰冻道具 + 玩家 + 粒子。

import { GAME } from '../../config/game.config.js';

const W = 1280;
const H = 720;

// 调色板（霓虹街机，全套统一）
const C = {
  bgTop: '#0b0620',
  bgMid: '#160a36',
  bgBottom: '#2a0f46',
  grid: 'rgba(120, 90, 220, 0.10)',
  star: '#c7b9ff',
  voidCore: '#ff3b8d',
  voidEdge: '#ff7ac0',
  stepCyan: '#24f0ff',
  stepCyanDim: '#0e7fa8',
  stepMagenta: '#ff4fd8',
  stepNext: '#ffd24e',
  decoBroken: '#ff3b5c',
  decoBrokenDim: '#7a1f33',
  player: '#eaffff',
  playerGlow: '#55e6ff',
  eye: '#0b0620',
  orb: '#7df6ff',
  starCol: '#ffe14d',
  shieldRing: '#5cf7c8',
};

function roundedRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function drawStar(ctx, cx, cy, r, color, glow) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const ang = -Math.PI / 2 + (i * Math.PI) / 5;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const px = Math.cos(ang) * rad;
    const py = Math.sin(ang) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = color;
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = glow;
  }
  ctx.fill();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  // 星空（固定伪随机，不闪烁，省 GPU）
  const starField = [];
  {
    let s = 1337;
    const rnd = () => {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      return s / 0x7fffffff;
    };
    for (let i = 0; i < 90; i += 1) {
      starField.push({ x: rnd() * W, y: rnd() * H, r: 0.6 + rnd() * 1.6, a: 0.3 + rnd() * 0.6 });
    }
  }

  function resize(dpr) {
    canvas.width = Math.floor(W * dpr);
    canvas.height = Math.floor(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize(1);

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, C.bgTop);
    g.addColorStop(0.5, C.bgMid);
    g.addColorStop(1, C.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 星空
    for (const s of starField) {
      ctx.globalAlpha = s.a;
      ctx.fillStyle = C.star;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 霓虹网格地平线
    ctx.strokeStyle = C.grid;
    ctx.lineWidth = 1;
    for (let i = 0; i < 22; i += 1) {
      const y = i * 40;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
  }

  function worldToScreen(wx, wy, cam) {
    return { x: W / 2 + (wx - cam.x), y: H * 0.62 - (wy - cam.y) };
  }

  // 画一个横杆（正式阶梯）
  function drawStep(sx, sy, w, kind, pulse) {
    let fill;
    let glow;
    if (kind === 'next') {
      fill = C.stepNext;
      glow = 22 + pulse * 10;
    } else if (kind === 'current') {
      fill = C.stepCyan;
      glow = 14;
    } else {
      fill = C.stepCyanDim;
      glow = 5;
    }
    ctx.save();
    ctx.shadowColor = fill;
    ctx.shadowBlur = glow;
    ctx.fillStyle = fill;
    roundedRect(ctx, sx - w / 2, sy - 11, w, 22, 8);
    ctx.fill();
    // 顶部高光
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    roundedRect(ctx, sx - w / 2 + 4, sy - 11 + 3, w - 8, 5, 3);
    ctx.fill();
    ctx.restore();
  }

  function drawBrokenStep(sx, sy, w) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.strokeStyle = C.decoBroken;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = C.decoBroken;
    ctx.shadowBlur = 6;
    roundedRect(ctx, sx - w / 2, sy - 10, w, 20, 7);
    ctx.stroke();
    // 裂缝
    ctx.shadowBlur = 0;
    ctx.beginPath();
    ctx.moveTo(sx - 6, sy - 8);
    ctx.lineTo(sx + 2, sy);
    ctx.lineTo(sx - 2, sy + 8);
    ctx.strokeStyle = C.decoBrokenDim;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  function drawVoid(voidY, t) {
    const sy = voidY;
    if (sy > H + 60) return;
    if (sy < -60) return;

    // 擦除波亮线 + 下方短渐变（不铺满到底部，避免压住方向按钮）
    ctx.save();
    ctx.shadowColor = C.voidCore;
    ctx.shadowBlur = 18 + Math.sin(t * 6) * 6;
    ctx.strokeStyle = C.voidEdge;
    ctx.lineWidth = 3;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 16) {
      const yy = sy + Math.sin(x * 0.02 + t * 5) * 4;
      if (x === 0) ctx.moveTo(x, yy);
      else ctx.lineTo(x, yy);
    }
    ctx.stroke();
    ctx.restore();

    const g = ctx.createLinearGradient(0, sy, 0, sy + 46);
    g.addColorStop(0, 'rgba(255,59,141,0.5)');
    g.addColorStop(1, 'rgba(42,15,70,0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, sy, W, 46);
  }

  function drawPlayer(sx, sy, t, flash, scale) {
    const r = 21 * scale;
    ctx.save();
    ctx.translate(sx, sy);
    // 光圈
    ctx.shadowColor = C.playerGlow;
    ctx.shadowBlur = 28;
    ctx.fillStyle = C.player;
    roundedRect(ctx, -r, -r, r * 2, r * 2, 7);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 边框
    ctx.strokeStyle = C.playerGlow;
    ctx.lineWidth = 2.5;
    roundedRect(ctx, -r, -r, r * 2, r * 2, 7);
    ctx.stroke();
    // 眼睛（看向下一层方向）
    const look = flash > 0 ? -1 : 0;
    ctx.fillStyle = C.eye;
    const eyeR = r * 0.16;
    const blink = (Math.sin(t * 3) > 0.97) ? 0.12 : 1;
    ctx.beginPath();
    ctx.arc(-r * 0.34 + look, -r * 0.18, eyeR, 0, Math.PI * 2);
    ctx.arc(r * 0.34 + look, -r * 0.18, eyeR, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawFx(fx) {
    for (const p of fx) {
      const k = 1 - p.ttl / p.max;
      const alpha = Math.max(0, p.ttl / p.max);
      ctx.save();
      ctx.globalAlpha = alpha;
      if (p.type === 'spark') {
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(1, p.r * (1 - k)), 0, Math.PI * 2);
        ctx.fill();
      } else if (p.type === 'ring') {
        ctx.strokeStyle = p.color;
        ctx.globalAlpha = alpha * 0.8;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * k + 4, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.restore();
    }
  }

  function draw(view, dt) {
    const t = view.time;
    const cam = { x: view.camX, y: view.camY };

    resize(view.dpr);

    ctx.save();
    if (view.shake > 0) {
      ctx.translate((Math.random() - 0.5) * view.shake * 2, (Math.random() - 0.5) * view.shake * 2);
    }

    drawBackground();

    const floors = view.floors || [];
    const curIndex = view.curIndex ?? 0;
    const removeTopIndex = view.removeTopIndex ?? 0;

    // 底部擦除波：对应最低存活楼层的下方
    const voidWorldY = removeTopIndex * GAME.STEP_H - GAME.STEP_H * 0.5;
    const voidScreen = worldToScreen(0, voidWorldY, cam);
    drawVoid(voidScreen.y, t);

    // 画横杆：从最低存活层到玩家上方若干层
    const top = Math.min(floors.length - 1, curIndex + 12);
    for (let i = removeTopIndex; i <= top; i += 1) {
      const f = floors[i];
      if (!f) continue;
      const p = worldToScreen(f.x, f.y, cam);
      if (p.y > H + 40 || p.y < 84) continue; // 顶部 HUD 区不画横杆，避免遮挡
      if (f.deco) {
        const dp = worldToScreen(f.x + f.deco.type * (GAME.STEP_HALF * 2), f.y, cam);
        drawBrokenStep(dp.x, dp.y, 108);
      }
      const kind = i === curIndex ? 'current' : i === curIndex + 1 ? 'next' : 'past';
      const pulse = i === curIndex + 1 ? (Math.sin(t * 7) + 1) / 2 : 0;
      drawStep(p.x, p.y, 116, kind, pulse);
      // 收集物
      if (f.star) drawStar(ctx, p.x, p.y - 44, 13, C.starCol, 12);
      if (f.orb) {
        ctx.save();
        ctx.shadowColor = C.orb;
        ctx.shadowBlur = 14;
        ctx.fillStyle = C.orb;
        ctx.beginPath();
        ctx.arc(p.x, p.y - 46, 11, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      // 下一层方向箭头
      if (i === curIndex + 1) {
        const dx = f.x - (floors[curIndex] ? floors[curIndex].x : f.x);
        const dir = dx < 0 ? -1 : 1;
        ctx.save();
        ctx.fillStyle = C.stepNext;
        ctx.shadowColor = C.stepNext;
        ctx.shadowBlur = 12;
        const ax = p.x + dir * 34;
        const ay = p.y - 42 + Math.sin(t * 7) * 3;
        ctx.beginPath();
        ctx.moveTo(ax + dir * 13, ay);
        ctx.lineTo(ax - dir * 5, ay - 11);
        ctx.lineTo(ax - dir * 5, ay + 11);
        ctx.closePath();
        ctx.fill();
        ctx.restore();
      }
    }

    // 玩家
    if (view.player) {
      const pp = worldToScreen(view.player.x, view.player.y, cam);
      drawPlayer(pp.x, pp.y, t, view.player.flash, view.player.scale ?? 1);
    }

    // 坠落残影
    if (view.fall) {
      const f = view.fall;
      const fp = worldToScreen(f.x, f.y, cam);
      ctx.save();
      ctx.globalAlpha = Math.max(0, 1 - f.t);
      ctx.shadowColor = C.voidCore;
      ctx.shadowBlur = 14;
      ctx.fillStyle = C.player;
      roundedRect(ctx, fp.x - 16, fp.y - 16, 32, 32, 6);
      ctx.fill();
      ctx.restore();
    }

    drawFx(view.fx || []);

    ctx.restore();
  }

  return { draw, resize, W, H };
}
