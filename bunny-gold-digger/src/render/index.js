// Bunny Gold Digger · Canvas 2D 渲染（霓虹街机统一风格，零素材零外链）
// 画：矿坑背景 → 矿层 → 物品 → 绳子 → 兔兔 + 抓钩 → 狂热光效 → 粒子/震屏。
import { WORLD, CLAW } from '../../config/game.config.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

function createRenderer(canvas) {
  const dpr = Math.min(typeof devicePixelRatio !== 'undefined' ? devicePixelRatio : 1, 2);
  canvas.width = W * dpr;
  canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const COL = {
    bgTop: '#07070f',
    bgMid: '#0c0c1c',
    bgBot: '#12122a',
    strata: ['#14142e', '#18183a', '#16162f'],
    floor: '#0e0e20',
    floorEdge: '#3a3a6a',
    rope: '#cdd6ff',
    claw: '#e6ecff',
    bunny: '#ffe3f0',
    bunnyAccent: '#ff9ecb',
    gold1: '#ffe066',
    gold1Core: '#fff7c9',
    gold2: '#ffb020',
    gold2Core: '#ffd98a',
    gold3: '#ff7a45',
    gold3Core: '#ffc39a',
    diamond: '#6ff7ff',
    diamondCore: '#e0ffff',
    rock: '#9aa7c7',
    rockCore: '#c9d4ef',
    carrot: '#7dff9e',
    carrotTip: '#ffb45e',
    fever: 'rgba(255,190,60,',
  };

  function glow(color, r) {
    ctx.shadowColor = color;
    ctx.shadowBlur = r;
  }
  function noGlow() { ctx.shadowBlur = 0; ctx.shadowColor = 'transparent'; }

  function rr(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function poly(points, cx, cy, rot = 0) {
    ctx.beginPath();
    ctx.moveTo(cx + Math.cos(rot) * points[0][0] - Math.sin(rot) * points[0][1], cy + Math.sin(rot) * points[0][0] + Math.cos(rot) * points[0][1]);
    for (let i = 1; i < points.length; i += 1) {
      ctx.lineTo(cx + Math.cos(rot) * points[i][0] - Math.sin(rot) * points[i][1], cy + Math.sin(rot) * points[i][0] + Math.cos(rot) * points[i][1]);
    }
    ctx.closePath();
  }

  function drawBackground(t) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, COL.bgTop);
    g.addColorStop(0.4, COL.bgMid);
    g.addColorStop(1, COL.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 矿层横纹（程序化，均匀 + 缓慢呼吸）
    for (let i = 0; i < 9; i += 1) {
      const y = CLAW.pivotY + 34 + i * 62;
      ctx.fillStyle = COL.strata[i % 3];
      const w = Math.sin(t * 0.3 + i) * 6;
      ctx.fillRect(0, y, W, 22 + w);
    }

    // 矿坑底
    ctx.fillStyle = COL.floor;
    ctx.fillRect(0, CLAW.floorY, W, H - CLAW.floorY);
    ctx.fillStyle = COL.floorEdge;
    ctx.fillRect(0, CLAW.floorY, W, 3);

    // 顶部标题区霓虹分隔线
    ctx.fillStyle = COL.floorEdge;
    ctx.fillRect(0, CLAW.pivotY - 8, W, 2);
  }

  function drawBunny(t) {
    const bx = CLAW.pivotX;
    const by = CLAW.pivotY - 4;
    // 耳
    glow(COL.bunnyAccent, 12);
    ctx.fillStyle = COL.bunny;
    ctx.beginPath();
    ctx.ellipse(bx - 14, by - 34, 7, 22, -0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx + 14, by - 34, 7, 22, 0.16, 0, Math.PI * 2);
    ctx.fill();
    // 头 + 身体
    ctx.beginPath();
    ctx.arc(bx, by, 20, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(bx, by + 22, 17, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
    // 眼睛 + 腮红
    ctx.fillStyle = '#24131f';
    ctx.beginPath(); ctx.arc(bx - 7, by - 3, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 7, by - 3, 2.4, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,158,203,0.7)';
    ctx.beginPath(); ctx.arc(bx - 12, by + 3, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx + 12, by + 3, 3, 0, Math.PI * 2); ctx.fill();
  }

  function drawRope(tip, t) {
    const segs = CLAW.lineSeg;
    const sag = 0.02;
    ctx.strokeStyle = COL.rope;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(CLAW.pivotX, CLAW.pivotY);
    for (let i = 1; i <= segs; i += 1) {
      const k = i / segs;
      const x = CLAW.pivotX + (tip.x - CLAW.pivotX) * k;
      const y = CLAW.pivotY + (tip.y - CLAW.pivotY) * k + Math.sin(k * Math.PI + t * 3) * sag * 40 * k * (1 - k) * 4;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  function drawClaw(tip, held, t) {
    const open = !held ? 0.55 : 0.15;
    ctx.strokeStyle = COL.claw;
    ctx.lineWidth = 3;
    glow(COL.claw, 10);
    // 三爪
    for (let i = -1; i <= 1; i += 1) {
      const a = (Math.PI / 2) + i * open * 1.1;
      ctx.beginPath();
      ctx.moveTo(tip.x, tip.y);
      ctx.lineTo(tip.x + Math.cos(a) * 22, tip.y + Math.sin(a) * 22);
      ctx.stroke();
    }
    ctx.fillStyle = COL.claw;
    ctx.beginPath();
    ctx.arc(tip.x, tip.y, 5, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
    if (held) drawItemShape(held, tip.x, tip.y + 8, 0.9, t);
  }

  function drawItemShape(it, x, y, s, t) {
    const col = COL[it.kind] || COL.gold1;
    const core = COL[it.kind + 'Core'] || '#fff';
    const r = it.r * s;
    glow(col, 14);
    ctx.fillStyle = col;
    if (it.kind === 'diamond') {
      poly([[-r, 0], [0, -r], [r, 0], [0, r]], x, y);
      ctx.fill();
      ctx.fillStyle = core;
      poly([[-r * 0.4, 0], [0, -r * 0.4], [r * 0.4, 0], [0, r * 0.4]], x, y);
      ctx.fill();
    } else if (it.kind === 'carrot') {
      poly([[-r * 0.6, -r], [r * 0.6, -r], [0, r]], x, y);
      ctx.fill();
      ctx.fillStyle = COL.carrotTip;
      ctx.beginPath(); ctx.arc(x, y + r * 0.5, r * 0.25, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = '#1f7a3f';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.9); ctx.lineTo(x - r * 0.5, y - r * 1.4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + r * 0.3, y - r * 0.9); ctx.lineTo(x + r * 0.5, y - r * 1.4); ctx.stroke();
    } else if (it.kind === 'rock') {
      poly([[-r, r * 0.4], [-r * 0.7, -r], [r * 0.2, -r], [r, -r * 0.2], [r * 0.6, r], [-r * 0.3, r * 0.8]], x, y);
      ctx.fill();
      ctx.strokeStyle = '#4a5578';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - r * 0.3, y - r * 0.2); ctx.lineTo(x + r * 0.1, y + r * 0.1); ctx.lineTo(x + r * 0.3, y - r * 0.3); ctx.stroke();
    } else {
      // 金块：多边 + 高光
      poly([[-r, r * 0.5], [-r * 0.7, -r * 0.6], [r * 0.2, -r], [r, -r * 0.3], [r * 0.5, r], [-r * 0.4, r * 0.8]], x, y);
      ctx.fill();
      ctx.fillStyle = core;
      ctx.beginPath(); ctx.ellipse(x - r * 0.1, y - r * 0.2, r * 0.3, r * 0.18, -0.4, 0, Math.PI * 2); ctx.fill();
      // 价值刻度点
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      const dots = it.kind === 'gold1' ? 1 : it.kind === 'gold2' ? 2 : 3;
      for (let i = 0; i < dots; i += 1) {
        ctx.beginPath(); ctx.arc(x - r * 0.5 + i * r * 0.5, y + r * 0.6, 2.4, 0, Math.PI * 2); ctx.fill();
      }
    }
    noGlow();
  }

  function drawItems(state, t) {
    for (const it of state.items) {
      if (!it.alive) continue;
      const bob = Math.sin(t * 2 + it.id) * 2;
      drawItemShape(it, it.x, it.y + bob, 1, t);
    }
  }

  function drawFever(state) {
    if (!state.fever.active) return;
    const pulse = 0.5 + Math.sin(state.fever.tLeft * 8) * 0.5;
    ctx.fillStyle = `${COL.fever}${0.10 + pulse * 0.12})`;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = `${COL.fever}0.6)`;
    ctx.fillRect(0, 0, W, 3);
    ctx.fillRect(0, H - 3, W, 3);
  }

  function drawSparks(sparks, dt) {
    for (const sp of sparks) {
      const a = 1 - sp.age / sp.life;
      ctx.fillStyle = `rgba(255,230,120,${a})`;
      ctx.beginPath();
      ctx.arc(sp.x, sp.y, 2 + a * 2, 0, Math.PI * 2);
      ctx.fill();
      sp.x += sp.vx * dt;
      sp.y += sp.vy * dt;
      sp.age += dt;
    }
  }

  return {
    debugLayout() {
      return {
        pivot: { x: CLAW.pivotX, y: CLAW.pivotY, w: 60, h: 90 },
        mine: { x: 40, y: CLAW.pivotY + 30, w: W - 80, h: CLAW.floorY - CLAW.pivotY - 30 },
      };
    },

    draw(state, dt, view = {}) {
      const t = (view.t ?? 0) + dt;
      ctx.save();
      if (view.shake > 0) {
        ctx.translate((Math.random() - 0.5) * view.shake, (Math.random() - 0.5) * view.shake);
      }
      drawBackground(t);
      if (state) {
        drawItems(state, t);
        drawRope(state.hook.tip, t);
        drawBunny(t);
        drawClaw(state.hook.tip, state.hook.held, t);
        drawFever(state);
      } else {
        // 标题屏：兔兔 + 抓钩 + 一些展示金块
        drawRope({ x: CLAW.pivotX, y: CLAW.pivotY + 300 }, t);
        drawBunny(t);
        drawClaw({ x: CLAW.pivotX, y: CLAW.pivotY + 300 }, { kind: 'gold3', r: 30 }, t);
        const demo = [
          { kind: 'gold1', x: 340, y: 430, r: 20, id: 1 },
          { kind: 'diamond', x: 500, y: 300, r: 18, id: 2 },
          { kind: 'gold3', x: 760, y: 320, r: 30, id: 3 },
          { kind: 'gold2', x: 930, y: 450, r: 24, id: 4 },
          { kind: 'carrot', x: 620, y: 520, r: 20, id: 5 },
        ];
        for (const it of demo) drawItemShape(it, it.x, it.y + Math.sin(t * 2 + it.id) * 2, 1, t);
      }
      if (view.sparks) drawSparks(view.sparks, dt);
      ctx.restore();
      if (view.flash > 0) {
        ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, view.flash)})`;
        ctx.fillRect(0, 0, W, H);
      }
    },
  };
}

export { createRenderer };
