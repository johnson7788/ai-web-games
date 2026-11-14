// 竞技场绘制：背景贴图（cover 裁切，缺失走程序化糖果场地）+ 围墙 + 传送带/岩浆动效 + 障碍物。
// 危险区域同时用颜色 + 形状编码（虚线圈 / 锯齿 / 箭头），不依赖纯红绿。
import { WORLD, PALETTE } from '../../config/game.config.js';
import { roundRect } from './fx.js';

export const ARENA_WALL = 28;
const FALLBACK_FLOOR = 'assets/bg/arena-floor.webp';
const CRATE_SPRITE = 'assets/sprites/pickup-crate.webp';
const MUSHROOM_SPRITE = 'assets/sprites/mushroom.webp';
const GUMDROP_SPRITE = 'assets/sprites/gumdrop.webp';

// 程序化兜底场地配色（贴图缺失时按 arena id 区分三张图的手感）
const FALLBACK_STYLE = {
  meadow: { a: '#b5e79c', b: '#a7df8e', wall: '#8fce77', edge: '#5e9c4e' },
  candy: { a: '#ffd9ec', b: '#ffcae3', wall: '#f7a8d3', edge: '#d777ab' },
  lava: { a: '#453257', b: '#3b2a4a', wall: '#2e2140', edge: '#1d1430' },
};

function hashStr(s) {
  let h = 7;
  for (let i = 0; i < s.length; i += 1) h = (h * 31 + s.charCodeAt(i)) | 0;
  return h >>> 0;
}
function lcg(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a * 1664525 + 1013904223) >>> 0;
    return a / 4294967296;
  };
}

export function createArenaPainter(assets) {
  const decoCache = new Map();
  const gradCache = new Map();
  let vignette = null;

  const get = (p) => (assets && typeof assets.get === 'function' ? assets.get(p) : null);

  function floorImage(arena) {
    return get(arena.bg) || (arena.id === 'lava' ? get(FALLBACK_FLOOR) : null);
  }

  // 背景推近 7.5%：AI 图里画的围栏/石框落在逻辑墙（28px）之外，车不会压在栏上。
  const BG_OVERSCAN = 1.075;
  function coverDraw(ctx, img) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const scale = Math.max(WORLD.WIDTH / iw, WORLD.HEIGHT / ih);
    const sw0 = WORLD.WIDTH / scale;
    const sh0 = WORLD.HEIGHT / scale;
    const sw = sw0 / BG_OVERSCAN;
    const sh = sh0 / BG_OVERSCAN;
    const sx = (iw - sw0) / 2 + (sw0 - sw) / 2;
    const sy = (ih - sh0) / 2 + (sh0 - sh) / 2;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function decoFor(arena) {
    let d = decoCache.get(arena.id);
    if (d) return d;
    const rng = lcg(hashStr(arena.id || 'x'));
    const dots = [];
    if (arena.id === 'candy') {
      for (let i = 0; i < 46; i += 1) {
        dots.push({
          x: ARENA_WALL + 14 + rng() * (WORLD.WIDTH - 2 * ARENA_WALL - 28),
          y: ARENA_WALL + 14 + rng() * (WORLD.HEIGHT - 2 * ARENA_WALL - 28),
          r: 2.5 + rng() * 2.5,
          rot: rng() * Math.PI,
          color: ['#ff5d8f', '#3ddc97', '#49b6ff', '#ffd23f'][(rng() * 4) | 0],
        });
      }
    } else if (arena.id === 'lava') {
      for (let i = 0; i < 22; i += 1) {
        dots.push({
          x: ARENA_WALL + 14 + rng() * (WORLD.WIDTH - 2 * ARENA_WALL - 28),
          y: ARENA_WALL + 14 + rng() * (WORLD.HEIGHT - 2 * ARENA_WALL - 28),
          r: 1.5 + rng() * 2,
          rot: 0,
          color: 'rgba(255,159,67,0.5)',
        });
      }
    } else {
      for (let i = 0; i < 30; i += 1) {
        dots.push({
          x: ARENA_WALL + 14 + rng() * (WORLD.WIDTH - 2 * ARENA_WALL - 28),
          y: ARENA_WALL + 14 + rng() * (WORLD.HEIGHT - 2 * ARENA_WALL - 28),
          r: 3 + rng() * 3.5,
          rot: 0,
          color: ['#ffffff', '#ffd23f', '#ff5d8f'][(rng() * 3) | 0],
        });
      }
    }
    d = dots;
    decoCache.set(arena.id, d);
    return d;
  }

  function drawWalls(ctx, style) {
    const w = ARENA_WALL;
    ctx.fillStyle = style.wall;
    ctx.fillRect(0, 0, WORLD.WIDTH, w);
    ctx.fillRect(0, WORLD.HEIGHT - w, WORLD.WIDTH, w);
    ctx.fillRect(0, 0, w, WORLD.HEIGHT);
    ctx.fillRect(WORLD.WIDTH - w, 0, w, WORLD.HEIGHT);
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 4;
    ctx.strokeRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.lineWidth = 3;
    ctx.strokeRect(w, w, WORLD.WIDTH - 2 * w, WORLD.HEIGHT - 2 * w);
    // 四角护角
    ctx.fillStyle = style.edge;
    const cs = [
      [0, 0, 0], [WORLD.WIDTH, 0, Math.PI / 2],
      [WORLD.WIDTH, WORLD.HEIGHT, Math.PI], [0, WORLD.HEIGHT, -Math.PI / 2],
    ];
    for (const [cx, cy, a0] of cs) {
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(a0);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(w + 6, 0);
      ctx.arc(0, 0, w + 6, 0, Math.PI / 2);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = PALETTE.ink;
      ctx.lineWidth = 3;
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawFloorProcedural(ctx, arena) {
    const st = FALLBACK_STYLE[arena.id] || FALLBACK_STYLE.meadow;
    ctx.fillStyle = st.a;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const tile = 80;
    ctx.fillStyle = st.b;
    for (let r = 0; r < WORLD.HEIGHT / tile; r += 1) {
      for (let c = 0; c < WORLD.WIDTH / tile; c += 1) {
        if ((r + c) % 2 === 0) ctx.fillRect(c * tile, r * tile, tile, tile);
      }
    }
    drawWalls(ctx, st);
    for (const d of decoFor(arena)) {
      if (arena.id === 'candy') {
        ctx.save();
        ctx.translate(d.x, d.y);
        ctx.rotate(d.rot);
        ctx.fillStyle = d.color;
        roundRect(ctx, -d.r * 1.6, -d.r * 0.55, d.r * 3.2, d.r * 1.1, d.r * 0.55);
        ctx.fill();
        ctx.restore();
      } else {
        ctx.fillStyle = d.color;
        ctx.beginPath();
        ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawHazardBelt(ctx, hz, t) {
    const ux = hz.dx || 0;
    const uy = hz.dy || 0;
    const len = Math.hypot(ux, uy) || 1;
    const dx = ux / len;
    const dy = uy / len;
    const px = -dy;
    const py = dx;
    const cx = hz.x + hz.w / 2;
    const cy = hz.y + hz.h / 2;
    ctx.fillStyle = 'rgba(59,42,74,0.30)';
    roundRect(ctx, hz.x, hz.y, hz.w, hz.h, 14);
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3.5;
    ctx.stroke();
    // 滚动箭头（速度/方向来自 sim 的 hazard 配置）
    const spacing = 46;
    const off = ((t * (hz.speed || 100)) % spacing) * (dx + dy >= 0 ? 1 : -1);
    const half = Math.ceil(hz.w / 2 / spacing) + 2;
    ctx.fillStyle = 'rgba(255,246,229,0.85)';
    for (let i = -half; i <= half; i += 1) {
      const bx = cx + dx * (i * spacing + off);
      const by = cy + dy * (i * spacing + off);
      if (bx < hz.x - 10 || bx > hz.x + hz.w + 10 || by < hz.y - 10 || by > hz.y + hz.h + 10) continue;
      ctx.beginPath();
      ctx.moveTo(bx + dx * 11, by + dy * 11);
      ctx.lineTo(bx - dx * 7 + px * 9, by - dy * 7 + py * 9);
      ctx.lineTo(bx - dx * 7 - px * 9, by - dy * 7 - py * 9);
      ctx.closePath();
      ctx.fill();
    }
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  function lavaGrad(ctx, hz, key) {
    const id = `${key}|${hz.x}|${hz.y}|${hz.r}`;
    let g = gradCache.get(id);
    if (!g) {
      g = ctx.createRadialGradient(hz.x, hz.y, hz.r * 0.1, hz.x, hz.y, hz.r * 1.15);
      g.addColorStop(0, '#ffd23f');
      g.addColorStop(0.55, '#ff7a3c');
      g.addColorStop(1, 'rgba(255,77,109,0.25)');
      gradCache.set(id, g);
    }
    return g;
  }

  function drawHazardLava(ctx, hz, t, idx) {
    // 呼吸发光
    ctx.globalAlpha = 0.5 + 0.18 * Math.sin(t * 2.2 + idx * 1.7);
    ctx.fillStyle = lavaGrad(ctx, hz, 'body');
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.r * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    // 岩浆本体（锯齿 blob，形状编码危险）
    ctx.beginPath();
    const seeds = [0.9, 1.05, 0.85, 1.1, 0.92, 1.02, 0.88, 1.08, 0.95, 1.0];
    for (let i = 0; i < 10; i += 1) {
      const a = (Math.PI * 2 * i) / 10;
      const rr = hz.r * seeds[i];
      const bx = hz.x + Math.cos(a) * rr;
      const by = hz.y + Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
    }
    ctx.closePath();
    ctx.fillStyle = '#ff5d3a';
    ctx.fill();
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = lavaGrad(ctx, hz, 'core');
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.r * 0.72, 0, Math.PI * 2);
    ctx.fill();
    // 冒泡
    for (let i = 0; i < 5; i += 1) {
      const ph = (t * 0.4 + i * 0.23 + idx * 0.11) % 1;
      const a = i * 2.4 + idx;
      const bx = hz.x + Math.cos(a) * hz.r * 0.42;
      const by = hz.y + Math.sin(a) * hz.r * 0.42;
      const s = Math.sin(ph * Math.PI);
      ctx.fillStyle = 'rgba(255,210,63,0.85)';
      ctx.beginPath();
      ctx.arc(bx, by, hz.r * 0.15 * s, 0, Math.PI * 2);
      ctx.fill();
      if (ph > 0.86) {
        ctx.strokeStyle = 'rgba(255,246,229,0.8)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(bx, by, hz.r * 0.2 + (ph - 0.86) * 60, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    // 旋转虚线圈（危险形状编码）
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3;
    ctx.setLineDash([10, 9]);
    ctx.lineDashOffset = -t * 22;
    ctx.beginPath();
    ctx.arc(hz.x, hz.y, hz.r * 1.32, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  function drawObstacle(ctx, o, t) {
    // AI 素材优先：蘑菇/糖球用出图贴图，缺图才退回程序化图形
    const artSrc = o.art === 'mushroom' ? MUSHROOM_SPRITE : (o.art === 'gumdrop' ? GUMDROP_SPRITE : null);
    const artSprite = artSrc ? get(artSrc) : null;
    if (artSprite && o.shape === 'circle') {
      const s = o.r * 2.5;
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + o.r * 0.3, o.r * 1.0, o.r * 0.42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.drawImage(artSprite, o.x - s / 2, o.y - s / 2, s, s);
      return;
    }
    const sprite = null; // 障碍物只用程序化图形；pickup-crate 贴图只给武器箱
    if (o.shape === 'circle') {
      ctx.fillStyle = PALETTE.shadow;
      ctx.beginPath();
      ctx.ellipse(o.x, o.y + o.r * 0.32, o.r * 1.06, o.r * 0.5, 0, 0, Math.PI * 2);
      ctx.fill();
      if (o.art === 'mushroom') {
        ctx.beginPath();
        ctx.arc(o.x, o.y + 3, o.r, 0, Math.PI * 2);
        ctx.fillStyle = '#d62f68';
        ctx.fill();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(o.x, o.y - 3, o.r * 0.92, 0, Math.PI * 2);
        ctx.fillStyle = '#ff5d8f';
        ctx.fill();
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.fillStyle = PALETTE.cream;
        for (let i = 0; i < 5; i += 1) {
          const a = i * 2.51 + 0.6;
          const rr = o.r * (0.22 + (i % 2) * 0.3);
          ctx.beginPath();
          ctx.arc(o.x + Math.cos(a) * rr * 1.6, o.y - 3 + Math.sin(a) * rr * 1.6, o.r * 0.14, 0, Math.PI * 2);
          ctx.fill();
        }
        return;
      }
      if (o.art === 'gumdrop') {
        ctx.beginPath();
        ctx.ellipse(o.x, o.y, o.r, o.r * 0.92, 0, 0, Math.PI * 2);
        ctx.fillStyle = '#b06bff';
        ctx.fill();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        for (let i = 0; i < 8; i += 1) {
          const a = i * 0.9 + 0.3;
          ctx.beginPath();
          ctx.arc(o.x + Math.cos(a) * o.r * 0.55, o.y + Math.sin(a) * o.r * 0.5, 2.2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(o.x - o.r * 0.1, o.y - o.r * 0.1, o.r * 0.6, Math.PI * 1.05, Math.PI * 1.55);
        ctx.stroke();
        return;
      }
      if (sprite) {
        const s = o.r * 2.15;
        ctx.drawImage(sprite, o.x - s / 2, o.y - s / 2, s, s);
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.arc(o.x, o.y, o.r + 1, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        const pts = 8;
        for (let i = 0; i < pts; i += 1) {
          const a = (Math.PI * 2 * i) / pts;
          const rr = o.r * (0.88 + (i % 3) * 0.08);
          const bx = o.x + Math.cos(a) * rr;
          const by = o.y + Math.sin(a) * rr;
          if (i === 0) ctx.moveTo(bx, by); else ctx.lineTo(bx, by);
        }
        ctx.closePath();
        ctx.fillStyle = '#8a93a6';
        ctx.fill();
        ctx.strokeStyle = PALETTE.ink;
        ctx.lineWidth = 3.5;
        ctx.stroke();
      }
      return;
    }
    // rect 障碍
    ctx.fillStyle = PALETTE.shadow;
    ctx.beginPath();
    ctx.ellipse(o.x + o.w / 2, o.y + o.h / 2 + 6, o.w * 0.56, o.h * 0.42, 0, 0, Math.PI * 2);
    ctx.fill();
    if (sprite) {
      ctx.drawImage(sprite, o.x, o.y, o.w, o.h);
    } else {
      ctx.fillStyle = '#e8d9b8';
      roundRect(ctx, o.x, o.y, o.w, o.h, 10);
      ctx.fill();
      ctx.fillStyle = PALETTE.sunny;
      ctx.fillRect(o.x + 4, o.y + o.h / 2 - 6, o.w - 8, 12);
    }
    ctx.strokeStyle = PALETTE.ink;
    ctx.lineWidth = 3.5;
    roundRect(ctx, o.x, o.y, o.w, o.h, 10);
    ctx.stroke();
  }

  function drawFloor(ctx, arena, t) {
    const img = floorImage(arena);
    if (img) {
      coverDraw(ctx, img);
      if (arena.id === 'lava' && !get(arena.bg)) {
        ctx.fillStyle = 'rgba(69,42,74,0.42)';
        ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      }
      drawWalls(ctx, FALLBACK_STYLE[arena.id] || FALLBACK_STYLE.meadow);
    } else {
      drawFloorProcedural(ctx, arena);
    }
    const hzs = arena.hazards || [];
    for (let i = 0; i < hzs.length; i += 1) {
      const hz = hzs[i];
      if (hz.type === 'belt') drawHazardBelt(ctx, hz, t);
      else if (hz.type === 'lava') drawHazardLava(ctx, hz, t, i);
    }
  }

  function drawObstacles(ctx, arena, t) {
    for (const o of arena.obstacles || []) drawObstacle(ctx, o, t);
  }

  function drawVignette(ctx) {
    if (!vignette) {
      vignette = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 330, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 790);
      vignette.addColorStop(0, 'rgba(59,42,74,0)');
      vignette.addColorStop(1, 'rgba(59,42,74,0.42)');
    }
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  return { drawFloor, drawObstacles, drawVignette };
}

export { roundRect };
