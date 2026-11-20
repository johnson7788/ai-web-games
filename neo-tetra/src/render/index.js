// createRender 装配：Canvas2D 渲染（背景场景 / 棋盘 / 晶块 / ghost / next / hold / 粒子 / 白热/暗井覆盖）。
// 纯消费 sim 状态，不持有游戏逻辑。导出 createRender(canvas) → { draw(run, interp), resize(), burst(x,y,kind), setScene(sceneId) }。
import {
  WORLD, DPR_CAP, BOARD, PANEL, PARTICLE, SCENE_PACKS, oreColor, SPECIAL, clamp,
} from './theme.js';
import { layerAt, sceneOf } from '../../config/levels.js';
import { cellsFor } from '../game/tetromino.js';
import { dropResult, CELL, COLS, ROWS } from '../game/board.js';

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

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function'
    && matchMedia('(prefers-reduced-motion: reduce)').matches;

  let currentScene = 'copper';
  let currentBaseHue = 30;
  let lastNow = 0;
  let flash = 0; // 全屏喷发闪光（tetra）
  const particles = createParticles();

  function resize() {
    const dpr = clamp(typeof devicePixelRatio === 'number' ? devicePixelRatio : 1, 1, DPR_CAP);
    const cssW = canvas.clientWidth || WORLD.WIDTH;
    const cssH = canvas.clientHeight || WORLD.HEIGHT;
    const scale = Math.min(cssW / WORLD.WIDTH, cssH / WORLD.HEIGHT);
    const ox = (cssW - WORLD.WIDTH * scale) / 2;
    const oy = (cssH - WORLD.HEIGHT * scale) / 2;
    canvas.width = Math.max(1, Math.round(cssW * dpr));
    canvas.height = Math.max(1, Math.round(cssH * dpr));
    ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
  }

  function setScene(sceneId) {
    currentScene = sceneId || 'copper';
  }

  function burst(x, y, kind) {
    particles.burst(x, y, kind, currentBaseHue, SCENE_PACKS[currentScene] || SCENE_PACKS.copper);
    if (kind === 'tetra') flash = 1;
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;
    particles.update(dt, reduceMotion);

    if (run) {
      currentScene = sceneOf(run.layer);
      currentBaseHue = layerAt(run.layer).baseHue;
    }
    const pal = SCENE_PACKS[currentScene] || SCENE_PACKS.copper;

    // 清屏（letterbox 黑边）
    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#030202';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    drawScene(ctx, pal, now, reduceMotion);

    if (!run) {
      drawAmbient(ctx, pal, now, reduceMotion);
      return;
    }

    drawBoard(ctx, run, pal);
    drawPanels(ctx, run, pal);
    particles.draw(ctx);

    // 白热态：暖色全屏呼吸覆盖
    if (run.whiteHot) {
      const a = 0.10 + 0.05 * (reduceMotion ? 0 : Math.sin(now / 90));
      const g = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 80, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 720);
      g.addColorStop(0, 'rgba(255,180,90,0)');
      g.addColorStop(1, `rgba(255,120,50,${a.toFixed(3)})`);
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    }

    // tetra 喷发闪光（衰减）
    if (flash > 0) {
      ctx.fillStyle = `rgba(255,240,200,${(flash * 0.35).toFixed(3)})`;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      flash = Math.max(0, flash - dt * 2.2);
    }
  }

  // ---------- 背景场景 ----------
  function drawScene(c, pal, now, reduceMotion) {
    const g = c.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.55, pal.mid);
    g.addColorStop(1, pal.bottom);
    c.fillStyle = g;
    c.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 装饰：矿脉 / 晶柱 / 熔缝（固定位置，轻微呼吸）
    const t = reduceMotion ? 0 : now / 1000;
    c.save();
    c.globalAlpha = 0.35;
    for (let i = 0; i < 9; i += 1) {
      const x = 70 + i * 145;
      const h = 60 + ((i * 37) % 140);
      const pulse = 0.7 + 0.3 * Math.sin(t * 1.4 + i * 1.7);
      c.strokeStyle = pal.glow;
      c.globalAlpha = 0.12 + 0.10 * pulse;
      c.lineWidth = 2;
      c.beginPath();
      if (pal.decor === 'vent') {
        c.moveTo(x, WORLD.HEIGHT);
        c.lineTo(x + (i % 3 - 1) * 18, WORLD.HEIGHT - h);
        c.lineTo(x + (i % 3 - 1) * 6, WORLD.HEIGHT - h * 2);
      } else {
        c.moveTo(x, WORLD.HEIGHT - 20);
        c.lineTo(x + ((i % 3) - 1) * 14, WORLD.HEIGHT - 20 - h);
      }
      c.stroke();
    }
    c.restore();

    // 远处光晕
    const halo = c.createRadialGradient(WORLD.WIDTH / 2, 40, 10, WORLD.WIDTH / 2, 40, 320);
    halo.addColorStop(0, pal.accent);
    halo.addColorStop(1, 'rgba(0,0,0,0)');
    c.globalAlpha = 0.10;
    c.fillStyle = halo;
    c.fillRect(0, 0, WORLD.WIDTH, 320);
    c.globalAlpha = 1;
  }

  function drawAmbient(c, pal, now, reduceMotion) {
    // 标题屏：几块缓慢下坠的晶块（纯装饰，确定性轨迹；大而亮，撑起剪影主体）
    const t = reduceMotion ? 0 : now / 1000;
    const types = ['I', 'O', 'T', 'S', 'J'];
    for (let i = 0; i < 6; i += 1) {
      const x = 120 + i * 210;
      const y = ((t * (24 + i * 7) + i * 130) % (WORLD.HEIGHT + 160)) - 80;
      drawMiniPiece(c, types[i % types.length], x, y, 34, currentBaseHue, 0.9);
      c.save();
      c.strokeStyle = 'rgba(255,255,255,0.55)';
      c.lineWidth = 2;
      c.stroke();
      c.restore();
    }
  }

  // ---------- 棋盘 ----------
  function drawBoard(c, run, pal) {
    const bx = BOARD.X;
    const by = BOARD.Y;
    const cell = BOARD.CELL;

    // 井底暗色
    c.fillStyle = 'rgba(0,0,0,0.45)';
    roundRect(c, bx - 6, by - 6, COLS * cell + 12, ROWS * cell + 12, 8);
    c.fill();
    c.strokeStyle = pal.frame;
    c.lineWidth = 3;
    c.stroke();

    // 网格
    c.strokeStyle = 'rgba(255,255,255,0.04)';
    c.lineWidth = 1;
    for (let x = 1; x < COLS; x += 1) {
      c.beginPath();
      c.moveTo(bx + x * cell, by);
      c.lineTo(bx + x * cell, by + ROWS * cell);
      c.stroke();
    }
    for (let y = 1; y < ROWS; y += 1) {
      c.beginPath();
      c.moveTo(bx, by + y * cell);
      c.lineTo(bx + COLS * cell, by + y * cell);
      c.stroke();
    }

    const darkDim = run.dark;

    // 已锁晶块
    for (let y = 0; y < ROWS; y += 1) {
      for (let x = 0; x < COLS; x += 1) {
        const v = run.board[y][x];
        if (v === CELL.EMPTY) continue;
        const px = bx + x * cell;
        const py = by + y * cell;
        if (v === CELL.STONE) {
          drawBlock(c, px, py, cell, SPECIAL.stone, SPECIAL.stoneEdge, darkDim ? 0.5 : 0.9);
        } else if (v === CELL.WALL) {
          drawBlock(c, px, py, cell, SPECIAL.wall, '#0d0904', 1);
        } else {
          const oc = oreColor(currentBaseHue, v);
          drawBlock(c, px, py, cell, oc.css, oc.glow, darkDim ? SPECIAL.darkAlpha : 1);
        }
      }
    }

    // ghost 投影（暗井中也是亮的）
    if (run.active) {
      const g = dropResult(run.board, run.active.type, run.active.rot, run.active.x);
      if (g.ok) {
        for (const [x, y] of g.cells) {
          if (y < 0) continue;
          const px = bx + x * cell;
          const py = by + y * cell;
          c.fillStyle = SPECIAL.ghost;
          roundRect(c, px + 2, py + 2, cell - 4, cell - 4, 4);
          c.fill();
          c.strokeStyle = SPECIAL.ghostEdge;
          c.lineWidth = 2;
          c.stroke();
        }
      }
    }

    // 活动块（含 stone/gift 标记）
    if (run.active) {
      const a = run.active;
      for (const [x, y] of a.cells) {
        if (y < 0) continue;
        const px = bx + x * cell;
        const py = by + y * cell;
        if (a.stone) drawBlock(c, px, py, cell, SPECIAL.stone, '#8a9098', 1);
        else drawBlock(c, px, py, cell, oreColor(currentBaseHue, typeColorId(a.type)).css, '#ffffff', 1, true);
        if (a.gift) {
          c.fillStyle = '#ffe27a';
          c.beginPath();
          c.arc(px + cell / 2, py + cell / 2, 4, 0, Math.PI * 2);
          c.fill();
        }
      }
    }
  }

  // ---------- 侧板（hold / next 预览） ----------
  function drawPanels(c, run, pal) {
    const label = (x, y, text) => {
      c.fillStyle = pal.accent;
      c.font = `600 14px ${'monospace'}`;
      c.textAlign = 'center';
      c.fillText(text, x, y);
    };
    label(PANEL.HOLD_X, PANEL.HOLD_Y - 34, 'HOLD');
    label(PANEL.NEXT_X, PANEL.NEXT_Y - 34, 'NEXT');

    if (run.hold) {
      drawMiniPiece(c, run.hold, PANEL.HOLD_X, PANEL.HOLD_Y, PANEL.CELL, currentBaseHue, run.holdUsed ? 0.35 : 0.95);
    }
    const count = Math.max(1, run.nextCount || 1);
    for (let i = 0; i < count; i += 1) {
      const type = run.next[i];
      if (!type) continue;
      drawMiniPiece(c, type, PANEL.NEXT_X, PANEL.NEXT_Y + i * 84, PANEL.CELL, currentBaseHue, 0.95);
    }
  }

  resize();

  return { draw, resize, setScene, burst };
}

// ---------- 工具 ----------
function typeColorId(type) {
  const map = { I: 1, O: 2, T: 3, S: 4, Z: 5, J: 6, L: 7 };
  return map[type] || 1;
}

function drawBlock(c, x, y, cell, fill, edge, alpha, glow = false) {
  c.save();
  c.globalAlpha = alpha;
  const inset = 2;
  // 深色井中的剪影保障：先铺一圈亮描边底，再填主体
  if (glow) {
    c.strokeStyle = 'rgba(255,255,255,0.9)';
    c.lineWidth = 3;
    roundRect(c, x + inset, y + inset, cell - inset * 2, cell - inset * 2, 4);
    c.stroke();
  }
  c.fillStyle = fill;
  roundRect(c, x + inset, y + inset, cell - inset * 2, cell - inset * 2, 4);
  c.fill();
  // 顶部高光
  c.fillStyle = 'rgba(255,255,255,0.22)';
  roundRect(c, x + inset + 2, y + inset + 2, cell - inset * 2 - 4, 4, 2);
  c.fill();
  c.strokeStyle = edge;
  c.lineWidth = glow ? 2.5 : 1.5;
  c.stroke();
  c.restore();
}

// 面板中的迷你块（按类型画 4 格，居中）。
function drawMiniPiece(c, type, cx, cy, cell, baseHue, alpha) {
  const cells = cellsFor(type, 0);
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of cells) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const w = (maxX - minX + 1) * cell;
  const h = (maxY - minY + 1) * cell;
  const ox = cx - w / 2;
  const oy = cy - h / 2;
  c.save();
  c.globalAlpha = alpha;
  const colorId = typeColorId(type);
  const oc = oreColor(baseHue, colorId);
  for (const [x, y] of cells) {
    const px = ox + (x - minX) * cell;
    const py = oy + (y - minY) * cell;
    drawBlock(c, px, py, cell, oc.css, oc.glow, 1);
  }
  c.restore();
}

function createParticles() {
  const list = [];
  return {
    burst(x, y, kind, baseHue, pal) {
      if (list.length > PARTICLE.cap) return;
      const n = kind === 'tetra' ? PARTICLE.tetraCount : PARTICLE.clearCount;
      for (let i = 0; i < n; i += 1) {
        const ang = Math.random() * Math.PI * 2;
        const spd = (kind === 'tetra' ? 180 : 90) * (0.4 + Math.random());
        const life = 0.5 + Math.random() * 0.5;
        const ingot = kind === 'tetra' && Math.random() < 0.4;
        list.push({
          x, y,
          vx: Math.cos(ang) * spd,
          vy: Math.sin(ang) * spd - (ingot ? 60 : 20),
          life,
          maxLife: life,
          size: ingot ? 5 : 2 + Math.random() * 3,
          color: ingot ? '#ffd166' : (pal.glow || '#ffb45f'),
          ingot,
        });
      }
    },
    update(dt, reduceMotion) {
      for (let i = list.length - 1; i >= 0; i -= 1) {
        const p = list[i];
        if (reduceMotion) { list.splice(i, 1); continue; }
        p.life -= dt;
        if (p.life <= 0) { list.splice(i, 1); continue; }
        p.vy += (p.ingot ? 900 : 300) * dt; // 金锭下坠
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
    },
    draw(c) {
      for (const p of list) {
        const a = clamp(p.life / p.maxLife, 0, 1);
        c.save();
        c.globalAlpha = a;
        c.fillStyle = p.color;
        if (p.ingot) {
          c.fillRect(p.x - p.size, p.y - p.size / 2, p.size * 2, p.size);
        } else {
          c.beginPath();
          c.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          c.fill();
        }
        c.restore();
      }
    },
  };
}
