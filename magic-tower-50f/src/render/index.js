// Canvas 2D 渲染：霓虹扁平风魔塔。纯程序化绘制（零素材零外链）。
// 顶栏 HUD 是 DOM（不透明条）；canvas 只画 HUD 下方的地图区。

import { WORLD, LAYOUT } from '../../config/game.config.js';

const FONT = "'Courier New','PingFang SC','Hiragino Sans','Segoe UI','Microsoft YaHei',monospace";

const C = {
  bg0: '#070a14',
  bg1: '#0d1220',
  floor: '#1a2136',
  floorEdge: '#28324e',
  wall: '#0b0f1e',
  wallEdge: '#2b3a5e',
  pit: '#000000',
  pitEdge: '#5b2bd6',
  player: '#ffd84e',
  playerCore: '#ffffff',
  monster: '#ff4f5e',
  elite: '#b06bff',
  boss: '#ff2fa0',
  item: '#ffd84e',
  gemAtk: '#ff5a5a',
  gemDef: '#5aa2ff',
  potion: '#54ff9f',
  key: '#ffd84e',
  gear: '#d7e0ff',
  rock: '#8f9bb3',
  stairs: '#37f0ff',
  stairsDown: '#ffb13c',
  core: '#fff7d6',
};

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function diamond(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x, y - s);
  ctx.lineTo(x + s, y);
  ctx.lineTo(x, y + s);
  ctx.lineTo(x - s, y);
  ctx.closePath();
  ctx.fill();
}

function hex(ctx, x, y, s, color) {
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 6; i += 1) {
    const a = Math.PI / 3 * i - Math.PI / 6;
    const px = x + Math.cos(a) * s;
    const py = y + Math.sin(a) * s;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fill();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function layout(state) {
    if (!state || !state.grid || !state.grid.length) return { tile: 48, x: 0, y: 0, rows: 0, cols: 0 };
    const rows = state.grid.length;
    const cols = state.grid[0].length;
    const availW = WORLD.WIDTH - LAYOUT.MARGIN_X * 2;
    const availH = WORLD.HEIGHT - LAYOUT.HUD_H - LAYOUT.MARGIN_Y * 2;
    const tile = Math.max(20, Math.min(LAYOUT.CELL_MAX, Math.floor(availW / cols), Math.floor(availH / rows)));
    const mapW = tile * cols;
    const mapH = tile * rows;
    const x = Math.round((WORLD.WIDTH - mapW) / 2);
    const y = Math.round(LAYOUT.HUD_H + (WORLD.HEIGHT - LAYOUT.HUD_H - mapH) / 2);
    return { tile, x, y, rows, cols, mapW, mapH };
  }

  function cellXY(lay, r, c) {
    return { x: lay.x + c * lay.tile, y: lay.y + r * lay.tile };
  }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, C.bg0);
    g.addColorStop(1, C.bg1);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawMap(state, lay) {
    for (let r = 0; r < lay.rows; r += 1) {
      for (let c = 0; c < lay.cols; c += 1) {
        const { x, y } = cellXY(lay, r, c);
        const t = state.grid[r][c];
        if (t === 'wall') {
          ctx.fillStyle = C.wall;
          ctx.fillRect(x + 1, y + 1, lay.tile - 2, lay.tile - 2);
          ctx.strokeStyle = C.wallEdge;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1.5, y + 1.5, lay.tile - 3, lay.tile - 3);
        } else {
          ctx.fillStyle = C.floor;
          ctx.fillRect(x + 1, y + 1, lay.tile - 2, lay.tile - 2);
          ctx.strokeStyle = C.floorEdge;
          ctx.lineWidth = 1;
          ctx.strokeRect(x + 1.5, y + 1.5, lay.tile - 3, lay.tile - 3);
          if (t === 'pit') {
            ctx.fillStyle = C.pit;
            ctx.fillRect(x + 3, y + 3, lay.tile - 6, lay.tile - 6);
            ctx.strokeStyle = C.pitEdge;
            ctx.strokeRect(x + 3.5, y + 3.5, lay.tile - 7, lay.tile - 7);
          }
        }
      }
    }
  }

  function drawPath(state, lay) {
    if (!state.path || !state.path.length) return;
    ctx.strokeStyle = 'rgba(55,240,255,0.18)';
    ctx.lineWidth = Math.max(3, lay.tile * 0.3);
    ctx.beginPath();
    let started = false;
    const pts = [{ ...state.pos }, ...state.path];
    for (const p of pts) {
      const { x, y } = cellXY(lay, p.r, p.c);
      const cx = x + lay.tile / 2;
      const cy = y + lay.tile / 2;
      if (!started) { ctx.moveTo(cx, cy); started = true; }
      else ctx.lineTo(cx, cy);
    }
    ctx.stroke();
  }

  function drawEntity(state, lay, r, c, ent, time) {
    const { x, y } = cellXY(lay, r, c);
    const cx = x + lay.tile / 2;
    const cy = y + lay.tile / 2;
    const s = lay.tile * 0.34;
    switch (ent.kind) {
      case 'monster': {
        const col = ent.tier === 'boss' ? C.boss : ent.tier === 'elite' ? C.elite : C.monster;
        if (ent.tier === 'elite') hex(ctx, cx, cy, s * 1.1, col);
        else if (ent.tier === 'boss') { diamond(ctx, cx, cy, s * 1.3, col); diamond(ctx, cx, cy, s * 0.6, '#fff'); }
        else diamond(ctx, cx, cy, s, col);
        // 眼睛
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - s * 0.3, cy - s * 0.15, s * 0.18, s * 0.18);
        ctx.fillRect(cx + s * 0.12, cy - s * 0.15, s * 0.18, s * 0.18);
        break;
      }
      case 'item': {
        const id = ent.id;
        if (id === 'gem_atk' || id === 'gem_def') {
          const col = id === 'gem_atk' ? C.gemAtk : C.gemDef;
          ctx.fillStyle = col;
          ctx.beginPath();
          ctx.moveTo(cx, cy - s * 0.7);
          ctx.lineTo(cx + s * 0.55, cy + s * 0.45);
          ctx.lineTo(cx - s * 0.55, cy + s * 0.45);
          ctx.closePath();
          ctx.fill();
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          ctx.fillRect(cx - s * 0.18, cy - s * 0.35, s * 0.14, s * 0.3);
        } else if (id === 'potion_small' || id === 'potion_large') {
          ctx.fillStyle = C.potion;
          ctx.beginPath();
          ctx.arc(cx, cy, s * 0.55, 0, Math.PI * 2);
          ctx.fill();
          ctx.fillStyle = '#0b0f1e';
          ctx.fillRect(cx - s * 0.22, cy - s * 0.4, s * 0.44, s * 0.3);
        } else if (id.startsWith('key_')) {
          const col = id === 'key_yellow' ? '#ffd84e' : id === 'key_blue' ? '#5aa2ff' : '#ff5a5a';
          ctx.strokeStyle = col;
          ctx.lineWidth = Math.max(2, s * 0.3);
          ctx.beginPath();
          ctx.arc(cx - s * 0.2, cy - s * 0.2, s * 0.5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx + s * 0.1, cy + s * 0.2);
          ctx.lineTo(cx + s * 0.5, cy + s * 0.5);
          ctx.stroke();
        } else if (id.startsWith('sword_')) {
          ctx.strokeStyle = C.gear;
          ctx.lineWidth = Math.max(2, s * 0.2);
          ctx.beginPath();
          ctx.moveTo(cx - s * 0.45, cy + s * 0.55);
          ctx.lineTo(cx + s * 0.35, cy - s * 0.45);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx - s * 0.55, cy + s * 0.2);
          ctx.lineTo(cx + s * 0.55, cy + s * 0.2);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(cx - s * 0.2, cy + s * 0.55);
          ctx.lineTo(cx + s * 0.45, cy - s * 0.1);
          ctx.stroke();
        } else if (id.startsWith('shield_')) {
          ctx.fillStyle = C.gear;
          ctx.beginPath();
          ctx.moveTo(cx, cy - s * 0.6);
          ctx.lineTo(cx + s * 0.5, cy - s * 0.3);
          ctx.lineTo(cx + s * 0.5, cy + s * 0.2);
          ctx.quadraticCurveTo(cx + s * 0.5, cy + s * 0.6, cx, cy + s * 0.65);
          ctx.quadraticCurveTo(cx - s * 0.5, cy + s * 0.6, cx - s * 0.5, cy + s * 0.2);
          ctx.lineTo(cx - s * 0.5, cy - s * 0.3);
          ctx.closePath();
          ctx.fill();
        } else if (id.startsWith('stone_')) {
          ctx.fillStyle = '#c9d1e8';
          ctx.beginPath();
          ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
          ctx.fill();
        } else if (id === 'scroll_teleport') {
          ctx.fillStyle = '#d7a0ff';
          ctx.fillRect(cx - s * 0.5, cy - s * 0.55, s, s * 1.1);
          ctx.fillStyle = '#5c3f8a';
          ctx.fillRect(cx - s * 0.5, cy - s * 0.55, s * 0.25, s * 1.1);
          ctx.fillRect(cx + s * 0.25, cy - s * 0.55, s * 0.25, s * 1.1);
        } else if (id === 'cross') {
          ctx.strokeStyle = '#7cf7ff';
          ctx.lineWidth = Math.max(2, s * 0.3);
          ctx.beginPath();
          ctx.moveTo(cx - s * 0.4, cy - s * 0.6);
          ctx.lineTo(cx + s * 0.4, cy + s * 0.6);
          ctx.moveTo(cx + s * 0.4, cy - s * 0.6);
          ctx.lineTo(cx - s * 0.4, cy + s * 0.6);
          ctx.stroke();
        } else {
          ctx.fillStyle = C.item;
          ctx.beginPath();
          ctx.arc(cx, cy, s * 0.5, 0, Math.PI * 2);
          ctx.fill();
        }
        break;
      }
      case 'door': {
        const col = ent.color === 'yellow' ? '#ffd84e' : ent.color === 'blue' ? '#5aa2ff' : '#ff5a5a';
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.fillRect(x + 2, y + 2, lay.tile - 4, lay.tile - 4);
        ctx.fillStyle = col;
        ctx.fillRect(cx - s * 0.15, y + 4, s * 0.3, lay.tile - 8);
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - s * 0.15, cy - 2, s * 0.3, 4);
        break;
      }
      case 'rock': {
        ctx.fillStyle = C.rock;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.75, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#5c6a85';
        ctx.beginPath();
        ctx.arc(cx - s * 0.25, cy - s * 0.25, s * 0.22, 0, Math.PI * 2);
        ctx.fill();
        break;
      }
      case 'stairs': {
        const up = ent.dir === 'up';
        const col = up ? C.stairs : C.stairsDown;
        const pulse = 0.5 + 0.5 * Math.sin(time * 3);
        ctx.fillStyle = up ? `rgba(55,240,255,${0.25 * pulse + 0.1})` : `rgba(255,177,60,${0.25 * pulse + 0.1})`;
        ctx.fillRect(x + 2, y + 2, lay.tile - 4, lay.tile - 4);
        ctx.strokeStyle = col;
        ctx.lineWidth = 2;
        ctx.strokeRect(x + 2.5, y + 2.5, lay.tile - 5, lay.tile - 5);
        ctx.fillStyle = col;
        ctx.font = `bold ${Math.round(lay.tile * 0.5)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(up ? '▲' : '▼', cx, cy - 2);
        ctx.font = `bold ${Math.round(lay.tile * 0.22)}px ${FONT}`;
        ctx.fillText(up ? 'UP' : 'DOWN', cx, cy + lay.tile * 0.32);
        break;
      }
      case 'npc': {
        ctx.fillStyle = '#9ad7ff';
        ctx.beginPath();
        ctx.arc(cx, cy - s * 0.3, s * 0.42, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#9ad7ff';
        roundRect(ctx, cx - s * 0.55, cy, s * 1.1, s * 0.75, s * 0.2);
        ctx.fill();
        ctx.fillStyle = '#04222b';
        ctx.font = `bold ${Math.round(lay.tile * 0.2)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(ent.role === 'shop' ? 'SHOP' : 'QUEST', cx, cy + lay.tile * 0.36);
        break;
      }
      case 'core': {
        const pulse = 0.6 + 0.4 * Math.sin(time * 5);
        ctx.fillStyle = `rgba(255,247,214,${pulse * 0.5})`;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 1.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#ffd84e';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(cx, cy, s * 0.85, 0, Math.PI * 2);
        ctx.stroke();
        diamond(ctx, cx, cy, s * 0.6, C.core);
        ctx.fillStyle = '#7a5a00';
        ctx.font = `bold ${Math.round(lay.tile * 0.2)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('CORE', cx, cy + lay.tile * 0.38);
        break;
      }
      default:
        break;
    }
  }

  function drawPlayer(state, lay, time) {
    const { x, y } = cellXY(lay, state.pos.r, state.pos.c);
    const cx = x + lay.tile / 2;
    const cy = y + lay.tile / 2;
    const s = lay.tile * 0.36;
    const glow = 0.5 + 0.3 * Math.sin(time * 3);
    ctx.fillStyle = `rgba(255,216,78,${glow * 0.4})`;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 1.15, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = C.player;
    ctx.beginPath();
    ctx.arc(cx, cy, s, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = C.playerCore;
    ctx.beginPath();
    ctx.arc(cx, cy, s * 0.45, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#7a5a00';
    ctx.font = `bold ${Math.round(lay.tile * 0.18)}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('YOU', cx, cy + lay.tile * 0.4);
  }

  function drawFx(view, lay) {
    if (!view) return;
    for (const fx of view.fxQueue || []) {
      if (fx.ttl <= 0) continue;
      if (fx.type === 'text' && fx.r != null) {
        const { x, y } = cellXY(lay, fx.r, fx.c);
        ctx.globalAlpha = Math.min(1, fx.ttl * 2);
        ctx.fillStyle = fx.color || '#ffd84e';
        ctx.font = `bold ${Math.round(lay.tile * 0.45)}px ${FONT}`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(fx.text, x + lay.tile / 2, y + lay.tile * 0.2 - (1 - fx.ttl) * 12);
        ctx.globalAlpha = 1;
      }
    }
  }

  return {
    layout,
    debugLayout(state) {
      const lay = layout(state);
      return {
        map: { x: lay.x, y: lay.y, w: lay.mapW, h: lay.mapH },
        hud: { x: 0, y: 0, w: WORLD.WIDTH, h: LAYOUT.HUD_H },
      };
    },
    draw(state, dt, view, time) {
      drawBackground();
      if (!state || !state.grid) return;
      const lay = layout(state);
      drawMap(state, lay);
      drawPath(state, lay);
      for (let r = 0; r < lay.rows; r += 1) {
        for (let c = 0; c < lay.cols; c += 1) {
          const ent = state.entities[`${r},${c}`];
          if (ent) drawEntity(state, lay, r, c, ent, time);
        }
      }
      drawPlayer(state, lay, time);
      drawFx(view, lay);
    },
  };
}
