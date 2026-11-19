// Canvas 2D 渲染：霓虹街机风，程序化绘制背景 / 平台 / 锚点 / 绳 / 积木 / 落点线。
// sim 只给状态，像素全在这里算。DPR ≤2；prefers-reduced-motion 由 main 传入 reducedMotion。
import { WORLD } from '../../config/game.config.js';
import { GAME } from '../../config/game.config.js';
import { worldVertices } from '../game/physics.js';

const SCENES = {
  cyan:   { bgTop: '#06121f', bgBot: '#0a2a3a', grid: 'rgba(0,229,255,0.10)', accent: '#00E5FF' },
  pink:   { bgTop: '#180a1a', bgBot: '#2a0f2e', grid: 'rgba(255,77,190,0.10)', accent: '#FF4DBE' },
  blue:   { bgTop: '#060f24', bgBot: '#0c1f44', grid: 'rgba(90,150,255,0.10)', accent: '#5A96FF' },
  green:  { bgTop: '#07160f', bgBot: '#0c2a1c', grid: 'rgba(0,255,150,0.10)', accent: '#00FF96' },
  purple: { bgTop: '#140a24', bgBot: '#241044', grid: 'rgba(170,90,255,0.10)', accent: '#AA5AFF' },
  gold:   { bgTop: '#1a1206', bgBot: '#2a1e08', grid: 'rgba(255,190,60,0.10)', accent: '#FFBE3C' },
};

const TYPE_COLORS = {
  normal:   { fill: '#EAFBFF', glow: '#8AE8FF' },
  slippery: { fill: '#9FE8FF', glow: '#5AC8FF' },
  bouncy:   { fill: '#FFE14D', glow: '#FFC42D' },
  rock:     { fill: '#FF9A5A', glow: '#FF7A3C' },
};

function hexToRgba(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = WORLD.WIDTH * dpr;
  canvas.height = WORLD.HEIGHT * dpr;
  ctx.scale(dpr, dpr);

  let time = 0;

  function bg(scene) {
    const s = SCENES[scene] || SCENES.cyan;
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, s.bgTop);
    g.addColorStop(1, s.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    // 网格
    ctx.strokeStyle = s.grid;
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x <= WORLD.WIDTH; x += step) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD.HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y <= WORLD.HEIGHT; y += step) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    // 底部辉光带
    const band = ctx.createLinearGradient(0, WORLD.HEIGHT - 160, 0, WORLD.HEIGHT);
    band.addColorStop(0, 'rgba(0,0,0,0)');
    band.addColorStop(1, hexToRgba(s.accent, 0.16));
    ctx.fillStyle = band;
    ctx.fillRect(0, WORLD.HEIGHT - 160, WORLD.WIDTH, 160);
    return s;
  }

  function drawPlatform(p, s) {
    ctx.save();
    if (p.dot) {
      ctx.fillStyle = s.accent;
      ctx.shadowColor = s.accent;
      ctx.shadowBlur = 14;
      ctx.beginPath();
      ctx.arc(p.body.x, p.body.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const w = p.spec.w;
      const h = p.spec.h;
      const x = p.body.x;
      const y = p.body.y;
      ctx.translate(x, y);
      ctx.rotate(p.body.angle);
      ctx.fillStyle = hexToRgba(s.accent, 0.12);
      ctx.strokeStyle = s.accent;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = s.accent;
      ctx.shadowBlur = 16;
      ctx.beginPath();
      ctx.rect(-w / 2, -h / 2, w, h);
      ctx.fill();
      ctx.stroke();
      // 顶面高亮线
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.moveTo(-w / 2 + 2, -h / 2);
      ctx.lineTo(w / 2 - 2, -h / 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawRope(anchor, block) {
    ctx.save();
    ctx.strokeStyle = 'rgba(180,220,255,0.85)';
    ctx.lineWidth = 2;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(block.body.x, block.body.y);
    ctx.stroke();
    ctx.setLineDash([]);
    // 锚点
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(anchor.x, anchor.y, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawBlock(rec, s) {
    const b = rec.body;
    const tc = TYPE_COLORS[rec.spec.type] || TYPE_COLORS.normal;
    ctx.save();
    ctx.translate(b.x, b.y);
    ctx.rotate(b.angle);
    ctx.fillStyle = tc.fill;
    ctx.shadowColor = tc.glow;
    ctx.shadowBlur = 18;
    ctx.strokeStyle = tc.glow;
    ctx.lineWidth = 2;

    if (b.shape.type === 'circle') {
      ctx.beginPath();
      ctx.arc(0, 0, b.shape.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 内圈高光
      ctx.shadowBlur = 0;
      ctx.strokeStyle = 'rgba(255,255,255,0.5)';
      ctx.beginPath();
      ctx.arc(0, 0, b.shape.radius * 0.55, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      const verts = worldVertices(b).verts;
      ctx.beginPath();
      ctx.moveTo(verts[0].x - b.x, verts[0].y - b.y);
      for (let i = 1; i < verts.length; i += 1) ctx.lineTo(verts[i].x - b.x, verts[i].y - b.y);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      // 面高光
      ctx.shadowBlur = 0;
      ctx.fillStyle = 'rgba(255,255,255,0.10)';
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGuide(anchor, sceneAccent, perfect, rodLength) {
    if (!anchor) return;
    const targetY = 566;
    const color = perfect ? '#FFE14D' : '#FFFFFF';
    ctx.save();
    // 摆锤路径弧（弱提示运动范围）
    if (rodLength > 0) {
      ctx.strokeStyle = 'rgba(255,255,255,0.14)';
      ctx.lineWidth = 2;
      ctx.setLineDash([2, 6]);
      ctx.beginPath();
      ctx.arc(anchor.x, anchor.y, rodLength, Math.PI * 0.15, Math.PI * 0.85);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    // 落地目标区（平台顶的发光靶心 = 目标）
    const pulse = 1 + 0.08 * Math.sin(time * 6);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.shadowColor = perfect ? '#FFE14D' : sceneAccent;
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(anchor.x, targetY, 34 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(anchor.x, targetY, 20 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = perfect ? '#FFE14D' : sceneAccent;
    ctx.shadowBlur = 16;
    ctx.beginPath();
    ctx.arc(anchor.x, targetY, 7, 0, Math.PI * 2);
    ctx.fill();
    // 垂直落点线 + 箭头
    ctx.strokeStyle = color;
    ctx.lineWidth = perfect ? 3 : 2;
    ctx.setLineDash([6, 6]);
    ctx.globalAlpha = perfect ? 1 : 0.75;
    ctx.beginPath();
    ctx.moveTo(anchor.x, anchor.y);
    ctx.lineTo(anchor.x, targetY - 34);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
    // 箭头
    ctx.fillStyle = color;
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.moveTo(anchor.x, targetY - 30);
    ctx.lineTo(anchor.x - 8, targetY - 46);
    ctx.lineTo(anchor.x + 8, targetY - 46);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawFx(fx) {
    for (const f of fx) {
      ctx.save();
      ctx.globalAlpha = Math.max(0, f.ttl / f.max);
      ctx.fillStyle = f.color;
      ctx.shadowColor = f.color;
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r * (1 + (f.max - f.ttl) * 3), 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function draw(state, dt, view) {
    const scene = state ? (state.sceneKey || 'cyan') : 'cyan';
    const s = bg(scene);
    time += dt;

    if (state) {
      for (const p of state.platforms) drawPlatform(p, s);

      // 落点引导线（先画在积木之下）
      if (state.ropeActive && state.anchor) {
        const perfect = Math.abs(state.ropeAngle) < GAME.PERFECT_RAD;
        const rodLength = state.currentBlock ? state.currentBlock.spec.rodLength : 0;
        drawGuide(state.anchor, s.accent, perfect, rodLength);
      }

      for (const rec of state.blocks) {
        if (rec.dead) continue;
        if (state.currentBlock === rec && state.ropeActive) {
          drawRope(state.anchor, rec);
        }
        drawBlock(rec, s);
      }

      if (view && view.fx) drawFx(view.fx);
    }

    // 轻微扫描线（reduced-motion 时跳过，仅静态轻微，不影响可读性）
    if (!view?.reducedMotion) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.04)';
      for (let y = 0; y < WORLD.HEIGHT; y += 4) ctx.fillRect(0, y, WORLD.WIDTH, 1);
      ctx.restore();
    }
  }

  return {
    draw,
    debugLayout() {
      return { anchorY: GAME.ANCHOR_Y, platformY: 585, world: { ...WORLD } };
    },
  };
}
