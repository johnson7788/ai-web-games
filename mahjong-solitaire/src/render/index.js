// Canvas 2D 渲染：深绿绒布桌 + 木质边框 + 暗角 + 麻将牌（无外部图片，牌面全部程序化绘制）
import { WORLD, TILE, COLORS } from '../../config/game.config.js';
import { layoutOffset } from '../../config/layout.js';

const OFFSET = layoutOffset();
const LIFT = 3; // 上层牌整体上移 3px，层次一眼可辨
const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Noto Sans CJK SC",sans-serif';

const GLYPH = {
  c1: '一', c2: '二', c3: '三', c4: '四', c5: '五', c6: '六', c7: '七', c8: '八', c9: '九',
  wE: '東', wS: '南', wW: '西', wN: '北',
  gC: '中', gG: '發', gW: '白',
  f1: '春', f2: '夏', f3: '秋', f4: '冬', f5: '梅', f6: '蘭', f7: '竹', f8: '菊',
};

const DOT_POS = [-1, 0, 1].flatMap((_, r) => [0, 1, 2].map((c) => ({ x: (c - 1) * 15, y: (r - 1) * 18 })));
const DOT_MASK = {
  1: [4], 2: [2, 6], 3: [2, 4, 6], 4: [0, 2, 6, 8], 5: [0, 2, 4, 6, 8],
  6: [0, 3, 6, 2, 5, 8], 7: [0, 3, 6, 2, 5, 8, 4], 8: [0, 1, 2, 3, 5, 6, 7, 8], 9: [0, 1, 2, 3, 4, 5, 6, 7, 8],
};

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function tileRect(tile) {
  return {
    x: tile.x * TILE.STEP_X + OFFSET.x,
    y: tile.y * TILE.STEP_Y + OFFSET.y - tile.layer * LIFT,
    w: TILE.W,
    h: TILE.H,
  };
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];

  function drawTable() {
    // 深绿绒布
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const felt = ctx.createRadialGradient(640, 360, 60, 640, 360, 720);
    felt.addColorStop(0, COLORS.feltInner);
    felt.addColorStop(1, COLORS.felt);
    ctx.fillStyle = felt;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 木边
    ctx.strokeStyle = COLORS.wood;
    ctx.lineWidth = 18;
    roundRect(ctx, 9, 9, WORLD.WIDTH - 18, WORLD.HEIGHT - 18, 22);
    ctx.stroke();
    ctx.strokeStyle = COLORS.woodLight;
    ctx.lineWidth = 6;
    roundRect(ctx, 18, 18, WORLD.WIDTH - 36, WORLD.HEIGHT - 36, 16);
    ctx.stroke();
    // 暗角
    const vg = ctx.createRadialGradient(640, 360, 260, 640, 360, 760);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, COLORS.vignette);
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawTileBase(r, layer) {
    const sh = 3 + layer * 1.6;
    ctx.fillStyle = COLORS.tileShadow;
    roundRect(ctx, r.x + sh, r.y + sh, r.w, r.h, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.tileEdge;
    roundRect(ctx, r.x, r.y, r.w, r.h, 6);
    ctx.fill();
    ctx.fillStyle = COLORS.tileSide;
    roundRect(ctx, r.x + 2, r.y + 2, r.w - 2, r.h - 2, 5);
    ctx.fill();
    ctx.fillStyle = COLORS.tileFace;
    roundRect(ctx, r.x + 2, r.y + 2, r.w - 4, r.h - 4, 5);
    ctx.fill();
    // 顶面高光
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    roundRect(ctx, r.x + 3, r.y + 3, r.w - 6, 9, 4);
    ctx.fill();
  }

  function drawSymbol(kind, cx, cy) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (kind[0] === 'd') {
      ctx.fillStyle = COLORS.dot;
      for (const i of DOT_MASK[Number(kind[1])]) {
        ctx.beginPath();
        ctx.arc(cx + DOT_POS[i].x, cy + DOT_POS[i].y, 5.2, 0, Math.PI * 2);
        ctx.fill();
      }
    } else if (kind[0] === 'b') {
      ctx.fillStyle = COLORS.bamboo;
      for (const i of DOT_MASK[Number(kind[1])]) {
        const x = cx + DOT_POS[i].x;
        const y = cy + DOT_POS[i].y;
        ctx.fillRect(x - 3.4, y - 12, 6.8, 24);
        ctx.strokeStyle = 'rgba(255,255,255,0.75)';
        ctx.lineWidth = 1.4;
        ctx.beginPath();
        ctx.moveTo(x - 3.4, y - 4);
        ctx.lineTo(x + 3.4, y - 7);
        ctx.moveTo(x - 3.4, y + 6);
        ctx.lineTo(x + 3.4, y + 3);
        ctx.stroke();
      }
    } else if (kind[0] === 'c') {
      ctx.fillStyle = COLORS.char;
      ctx.font = `30px ${FONT}`;
      ctx.fillText(GLYPH[kind], cx, cy - 11);
      ctx.font = `16px ${FONT}`;
      ctx.fillText('萬', cx, cy + 17);
    } else if (kind[0] === 'w') {
      ctx.fillStyle = COLORS.wind;
      ctx.font = `32px ${FONT}`;
      ctx.fillText(GLYPH[kind], cx, cy);
    } else if (kind[0] === 'g') {
      if (kind === 'gW') {
        ctx.strokeStyle = COLORS.ink;
        ctx.lineWidth = 2.4;
        roundRect(ctx, cx - 16, cy - 18, 32, 36, 5);
        ctx.stroke();
      } else {
        ctx.fillStyle = kind === 'gC' ? COLORS.dragonRed : COLORS.dragonGreen;
        ctx.font = `30px ${FONT}`;
        ctx.fillText(GLYPH[kind], cx, cy);
      }
    } else if (kind[0] === 'f') {
      ctx.fillStyle = COLORS.flower;
      ctx.font = `24px ${FONT}`;
      ctx.fillText(GLYPH[kind], cx, cy + 8);
      ctx.beginPath();
      ctx.arc(cx, cy - 16, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawTile(tile) {
    const r = tileRect(tile);
    drawTileBase(r, tile.layer);
    drawSymbol(tile.kind, r.x + TILE.W / 2, r.y + TILE.H / 2);
    return r;
  }

  function orderedTiles(board) {
    return board.tiles
      .map((t, i) => ({ t, i }))
      .filter((o) => o.t.alive)
      .sort((a, b) => a.t.layer - b.t.layer || a.t.y - b.t.y || a.t.x - b.t.x);
  }

  function drawHighlight(r, color, width) {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    roundRect(ctx, r.x - 3, r.y - 3, r.w + 6, r.h + 6, 8);
    ctx.stroke();
  }

  return {
    hitTest(mx, my, board) {
      for (let L = 4; L >= 0; L -= 1) {
        for (let i = board.tiles.length - 1; i >= 0; i -= 1) {
          const t = board.tiles[i];
          if (!t.alive || t.layer !== L) continue;
          const r = tileRect(t);
          if (mx >= r.x && mx <= r.x + r.w && my >= r.y && my <= r.y + r.h) return i;
        }
      }
      return -1;
    },

    burst(x, y, color) {
      for (let i = 0; i < 16; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 60 + Math.random() * 160;
        particles.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60,
          life: 0.5 + Math.random() * 0.3, age: 0, color,
        });
      }
    },

    update(dt) {
      for (let i = particles.length - 1; i >= 0; i -= 1) {
        const p = particles[i];
        p.age += dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vy += 320 * dt;
        if (p.age >= p.life) particles.splice(i, 1);
      }
    },

    render(view) {
      drawTable();
      const { board, effects, now } = view;

      // 已消除动画中的牌（缩小消失）
      const removed = effects.removals.filter((e) => now < e.t0 + e.dur);

      // 普通活牌
      for (const { t } of orderedTiles(board)) {
        const r = drawTile(t);
        if (effects.hint && (effects.hint[0] === board.tiles.indexOf(t) || effects.hint[1] === board.tiles.indexOf(t))) {
          const pulse = 0.5 + 0.5 * Math.sin(now / 130);
          drawHighlight(r, `rgba(255,207,92,${0.55 + 0.45 * pulse})`, 4);
        }
      }

      // 选中高亮
      for (const i of board.picks) {
        const t = board.tiles[i];
        if (t && t.alive) drawHighlight(tileRect(t), COLORS.accent, 5);
      }

      // 消错闪红
      for (const f of effects.flashes) {
        if (now < f.until) {
          const t = board.tiles[f.i];
          if (t && t.alive) {
            const r = tileRect(t);
            ctx.fillStyle = 'rgba(200,40,40,0.35)';
            roundRect(ctx, r.x, r.y, r.w, r.h, 6);
            ctx.fill();
          }
        }
      }

      // 缩小消失
      for (const e of removed) {
        const k = (now - e.t0) / e.dur;
        const s = 1 - k;
        const w = TILE.W * s;
        const h = TILE.H * s;
        const x = e.rect.x + (TILE.W - w) / 2;
        const y = e.rect.y + (TILE.H - h) / 2;
        ctx.save();
        ctx.globalAlpha = 1 - k;
        const tmp = { x, y, w, h, layer: 0 };
        drawTileBase({ x, y, w, h }, e.layer);
        drawSymbol(e.kind, x + w / 2, y + h / 2);
        ctx.restore();
      }

      // 粒子
      for (const p of particles) {
        ctx.globalAlpha = Math.max(0, 1 - p.age / p.life);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 2.6, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },
  };
}
