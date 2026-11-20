// src/render/index.js — 程序化 Canvas 渲染：星象牌桌 / 牌面 / 星阵连线 / 三场景包。
// 纯绘制（读 view，不直接碰 sim/DOM）。牌面全部程序化绘制，无外部素材。
import { WORLD } from '../../config/game.config.js';
import { suitOf } from '../../config/rules.js';

const PALETTES = {
  observatory: { bg1: '#071326', bg2: '#0d2a4a', star: '#ffc94a', accent: '#54e7ff', honor: '#c084fc', table: '#0a1c33', text: '#eaf4ff', tileBack: '#1b3a5e' },
  teahouse: { bg1: '#2a160c', bg2: '#4a2c18', star: '#f2b25a', accent: '#e8c07a', honor: '#d98a5a', table: '#3a2212', text: '#f6e8d4', tileBack: '#5a3a22' },
  aurora: { bg1: '#12082a', bg2: '#24154a', star: '#7df2e0', accent: '#54e7ff', honor: '#c084fc', table: '#1a1033', text: '#eef2ff', tileBack: '#2a1a4a' },
};

export function theme(scene) {
  return PALETTES[scene] || PALETTES.observatory;
}

const TILE_W = 60;
const TILE_H = 78;

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function tileRank(t) {
  if (t >= 27) return null;
  return (t % 9) + 1;
}

function drawStar(ctx, x, y, r, points = 5) {
  ctx.beginPath();
  for (let i = 0; i < points * 2; i += 1) {
    const rad = i % 2 === 0 ? r : r * 0.45;
    const a = (i * Math.PI) / points - Math.PI / 2;
    const px = x + Math.cos(a) * rad;
    const py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawOrbitIcon(ctx, x, y, r) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.stroke();
  ctx.beginPath();
  ctx.ellipse(x, y, r * 1.6, r * 0.5, -0.6, 0, Math.PI * 2);
  ctx.stroke();
}

function drawHonorIcon(ctx, x, y, r, t) {
  if (t === 27) {
    // 日
    ctx.beginPath();
    ctx.arc(x, y, r * 0.6, 0, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(x + Math.cos(a) * r * 0.8, y + Math.sin(a) * r * 0.8);
      ctx.lineTo(x + Math.cos(a) * r * 1.2, y + Math.sin(a) * r * 1.2);
      ctx.stroke();
    }
  } else if (t === 28) {
    // 月
    ctx.beginPath();
    ctx.arc(x, y, r * 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0)';
    ctx.beginPath();
    ctx.arc(x - r * 0.28, y - r * 0.1, r * 0.62, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    // 斗（北极星：四芒星）
    drawStar(ctx, x, y, r * 0.95, 4);
    ctx.fill();
  }
}

/** 画一张牌面（id：0-8 星 / 9-17 轨 / 27-29 三元）。返回是否画了。 */
function drawTileFace(ctx, t, x, y, w, h, p) {
  rr(ctx, x, y, w, h, 7);
  ctx.fillStyle = '#f6f1e2';
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = 'rgba(0,0,0,0.25)';
  ctx.stroke();

  const cx = x + w / 2;
  const cy = y + h / 2;
  const suit = suitOf(t);
  const color = suit === 0 ? p.star : suit === 1 ? p.accent : p.honor;
  const r = rankOf(t);

  // 花色角标
  ctx.fillStyle = color;
  ctx.strokeStyle = color;
  ctx.lineWidth = 1.5;
  if (suit === 0) { drawStar(ctx, x + 12, y + 13, 6, 5); ctx.fill(); }
  else if (suit === 1) drawOrbitIcon(ctx, x + 12, y + 13, 5);
  else drawHonorIcon(ctx, x + 12, y + 13, 7, t);

  if (r != null) {
    // 卡五星：数字 5 加五角星衬底
    if (r === 5) {
      ctx.save();
      ctx.globalAlpha = 0.22;
      ctx.fillStyle = color;
      drawStar(ctx, cx, cy, h * 0.34, 5);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = '#1c1a2a';
    ctx.font = `bold ${Math.round(h * 0.42)}px system-ui, -apple-system, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(r), cx, cy + 2);
  } else {
    ctx.fillStyle = color;
    drawHonorIcon(ctx, cx, cy, h * 0.3, t);
    ctx.fill();
  }
}

/** 画牌背。 */
function drawTileBack(ctx, x, y, w, h, p) {
  rr(ctx, x, y, w, h, 7);
  ctx.fillStyle = p.tileBack;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.15)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  drawStar(ctx, x + w / 2, y + h / 2, Math.min(w, h) * 0.28, 5);
  ctx.fill();
}

function drawBackground(ctx, p, time) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, p.bg1);
  g.addColorStop(1, p.bg2);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  // 场景装饰：星点 / 木纹 / 极光条
  ctx.save();
  const seedBase = Math.floor(time * 0.1) % 1000;
  for (let i = 0; i < 60; i += 1) {
    const sx = ((i * 137 + seedBase) % WORLD.WIDTH);
    const sy = ((i * 89 + seedBase) % (WORLD.HEIGHT * 0.6));
    const a = 0.1 + ((i * 31) % 40) / 100;
    ctx.globalAlpha = a;
    ctx.fillStyle = p.star;
    ctx.beginPath();
    ctx.arc(sx, sy, 1.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  // 桌面
  ctx.fillStyle = p.table;
  ctx.globalAlpha = 0.55;
  ctx.fillRect(60, 80, WORLD.WIDTH - 120, WORLD.HEIGHT - 160);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.lineWidth = 1;
  ctx.strokeRect(60, 80, WORLD.WIDTH - 120, WORLD.HEIGHT - 160);
}

/** 牌墙（剩余牌堆）：一叠牌背 + 张数。 */
function drawWall(ctx, p, remaining) {
  const x = WORLD.WIDTH / 2 - 52;
  const y = 196;
  // 牌背堆叠
  for (let i = 3; i >= 0; i -= 1) {
    drawTileBack(ctx, x + i * 3, y + i * 3, 52, 66, p);
  }
  // 标签
  ctx.fillStyle = p.text;
  ctx.font = '600 13px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('WALL', x + 34, y - 10);
  ctx.fillStyle = p.star;
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(String(remaining), x + 34, y + 40);
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');

  function playerTiles(hand, selected, pendingDiscard) {
    const n = hand.length;
    const gap = 6;
    const w = Math.min(TILE_W, (WORLD.WIDTH - 120 - gap * (n - 1)) / n);
    const h = TILE_H * (w / TILE_W);
    const totalW = n * w + (n - 1) * gap;
    const x0 = (WORLD.WIDTH - totalW) / 2;
    const y0 = WORLD.HEIGHT - h - 46;
    return hand.map((t, i) => ({
      t,
      x: x0 + i * (w + gap),
      y: y0,
      w,
      h,
      selected: selected === t || (pendingDiscard && i === hand.length - 1),
    }));
  }

  function draw(view) {
    if (!view || !view.hud) return;
    const p = theme(view.scene);
    const hud = view.hud;
    const time = view.time || 0;
    drawBackground(ctx, p, time);

    // 对手（左右上方）
    const oppPos = [
      { x: 80, y: 96, label: 'Left' },
      { x: WORLD.WIDTH - 340, y: 96, label: 'Right' },
    ];
    hud.opponents.forEach((op, i) => {
      const pos = oppPos[i];
      ctx.fillStyle = p.text;
      ctx.font = '600 15px system-ui, sans-serif';
      ctx.textAlign = 'left';
      ctx.fillText(op.name === 'ai-1' ? 'Astronomer' : 'Navigator', pos.x, pos.y - 10);
      // 手牌数（牌背）
      const backs = Math.max(0, op.holdsCount);
      for (let k = 0; k < Math.min(backs, 14); k += 1) {
        drawTileBack(ctx, pos.x + k * 26, pos.y, 24, 32, p);
      }
      // 副露
      let mx = pos.x;
      for (const m of [...op.pengs, ...op.gangs]) {
        drawTileFace(ctx, m, mx, pos.y + 40, 30, 40, p);
        mx += 34;
      }
      // 弃牌
      let fx = pos.x;
      op.folds.slice(-9).forEach((f) => {
        drawTileFace(ctx, f, fx, pos.y + 88, 26, 34, p);
        fx += 28;
      });
      ctx.fillStyle = p.text;
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.fillText(`${op.score > 0 ? '+' : ''}${op.score}`, pos.x + 220, pos.y + 20);
    });

    drawWall(ctx, p, hud.wallRemaining);

    // 玩家副露 + 弃牌
    const px = 90;
    let mx = px;
    for (const m of [...hud.player.pengs, ...hud.player.gangs]) {
      drawTileFace(ctx, m, mx, WORLD.HEIGHT - 150, TILE_W, TILE_H, p);
      mx += TILE_W + 6;
    }
    let fx = px;
    hud.player.folds.slice(-14).forEach((f) => {
      drawTileFace(ctx, f, fx, WORLD.HEIGHT - 74, 30, 40, p);
      fx += 32;
    });

    // 观星揭示（牌堆顶 3 张）
    if (hud.peeks.length) {
      ctx.fillStyle = p.text;
      ctx.font = '600 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('✦', WORLD.WIDTH / 2, 290);
      const pw = 40;
      hud.peeks.forEach((t, i) => {
        drawTileFace(ctx, t, WORLD.WIDTH / 2 - pw * 1.5 + i * (pw + 6) - pw / 2, 298, pw, 52, p);
      });
    }

    // 玩家手牌
    const tiles = playerTiles(hud.player.holds, view.selected, view.pendingDiscard);
    tiles.forEach((tile) => {
      drawTileFace(ctx, tile.t, tile.x, tile.y, tile.w, tile.h, p);
      if (tile.selected) {
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 3;
        rr(ctx, tile.x, tile.y, tile.w, tile.h, 7);
        ctx.stroke();
        ctx.strokeStyle = p.star;
        ctx.lineWidth = 1.5;
        rr(ctx, tile.x + 3, tile.y + 3, tile.w - 6, tile.h - 6, 5);
        ctx.stroke();
      }
    });

    // 星阵连线（胡牌瞬间）
    if (view.constellation && view.constellation.length) {
      ctx.save();
      ctx.strokeStyle = p.star;
      ctx.lineWidth = 2;
      ctx.shadowColor = p.star;
      ctx.shadowBlur = 12;
      const centers = view.constellation.map((t) => [t.x + t.w / 2, t.y + t.h / 2]);
      ctx.beginPath();
      for (let i = 0; i < centers.length; i += 1) {
        const j = (i + 1) % centers.length;
        ctx.moveTo(centers[i][0], centers[i][1]);
        ctx.lineTo(centers[j][0], centers[j][1]);
      }
      ctx.stroke();
      ctx.restore();
    }
  }

  function tileRects(view) {
    const hud = view.hud;
    return playerTiles(hud.player.holds, view.selected, view.pendingDiscard);
  }

  function hitTest(mx, my, view) {
    for (const r of tileRects(view)) {
      if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return { type: 'tile', tile: r.t };
    }
    return null;
  }

  return { draw, tileRects, hitTest, theme };
}

function rankOf(t) {
  return t >= 27 ? null : (t % 9) + 1;
}
