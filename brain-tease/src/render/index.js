// src/render/index.js — Canvas 2D 程序化渲染：4 套场景包 + 机关道具 + 博士角色。
// 全矢量绘制，零外部素材。draw(run, opts)：run=null 时只画背景（标题屏氛围）。
// opts = { lang, expression, drag: {id, x, y} }（expression: neutral | annoyed | laugh）
import { WORLD } from '../../config/game.config.js';
import { sceneOf } from './theme.js';

const FONT = "'PingFang SC', 'Hiragino Sans', 'Segoe UI', 'Microsoft YaHei', 'Courier New', monospace";

const GLYPH_COLOR = {
  bottle: '#3fc1c9', bulb: '#ffd166', person: '#f4978e', plant: '#8fe36a',
  bird: '#6a8fe3', star: '#ffd166', cloud: '#cfd8ff', sun: '#ffb347',
  moon: '#e8d7a0', key: '#d9b36a', gear: '#c0c0dc', card: '#9d8cff',
  cup: '#f28c8c', rect: '#7fb2d9', circle: '#f2b36a', arrow: '#ff6b6b',
};

function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  if (typeof r !== 'number') r = Math.min(12, w / 4, h / 4);
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function star(ctx, x, y, r, points = 5) {
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

function drawGlyph(ctx, glyph, x, y, s, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(2, s * 0.06);
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  const cx = x;
  const cy = y;
  const u = s / 2;

  if (glyph === 'circle') {
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.62, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (glyph === 'rect') {
    rr(ctx, cx - u * 0.6, cy - u * 0.4, u * 1.2, u * 0.8, 4); ctx.fill(); ctx.stroke();
  } else if (glyph === 'star') {
    star(ctx, cx, cy, u * 0.75); ctx.fill(); ctx.stroke();
  } else if (glyph === 'cloud') {
    ctx.beginPath();
    ctx.arc(cx - u * 0.5, cy + u * 0.1, u * 0.4, 0, Math.PI * 2);
    ctx.arc(cx, cy - u * 0.15, u * 0.5, 0, Math.PI * 2);
    ctx.arc(cx + u * 0.5, cy + u * 0.1, u * 0.42, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
  } else if (glyph === 'sun') {
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    for (let i = 0; i < 8; i += 1) {
      const a = (i * Math.PI) / 4;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * u * 0.65, cy + Math.sin(a) * u * 0.65);
      ctx.lineTo(cx + Math.cos(a) * u * 0.95, cy + Math.sin(a) * u * 0.95);
      ctx.stroke();
    }
  } else if (glyph === 'moon') {
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.6, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath(); ctx.arc(cx + u * 0.4, cy - u * 0.15, u * 0.5, 0, Math.PI * 2); ctx.fill();
    ctx.globalCompositeOperation = 'source-over';
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.6, 0, Math.PI * 2); ctx.stroke();
  } else if (glyph === 'bottle') {
    rr(ctx, cx - u * 0.28, cy - u * 0.35, u * 0.56, u * 0.75, 3); ctx.fill(); ctx.stroke();
    rr(ctx, cx - u * 0.12, cy - u * 0.62, u * 0.24, u * 0.3, 2); ctx.fill(); ctx.stroke();
  } else if (glyph === 'person') {
    ctx.beginPath(); ctx.arc(cx, cy - u * 0.3, u * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy + u * 0.3, u * 0.45, Math.PI, 0); ctx.fill(); ctx.stroke();
  } else if (glyph === 'plant') {
    ctx.beginPath(); ctx.moveTo(cx, cy + u * 0.5); ctx.quadraticCurveTo(cx - u * 0.2, cy, cx - u * 0.55, cy - u * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy + u * 0.5); ctx.quadraticCurveTo(cx + u * 0.2, cy, cx + u * 0.55, cy - u * 0.4); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy - u * 0.35, u * 0.3, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  } else if (glyph === 'bird') {
    ctx.beginPath(); ctx.ellipse(cx, cy, u * 0.55, u * 0.4, 0, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + u * 0.4, cy - u * 0.05); ctx.lineTo(cx + u * 0.7, cy - u * 0.25); ctx.lineTo(cx + u * 0.5, cy + u * 0.1); ctx.closePath(); ctx.fill();
  } else if (glyph === 'key') {
    ctx.beginPath(); ctx.arc(cx - u * 0.3, cy, u * 0.3, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + u * 0.7, cy); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + u * 0.4, cy); ctx.lineTo(cx + u * 0.4, cy - u * 0.25); ctx.stroke();
  } else if (glyph === 'gear') {
    star(ctx, cx, cy, u * 0.7, 8); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff'; ctx.fill();
  } else if (glyph === 'card') {
    rr(ctx, cx - u * 0.6, cy - u * 0.4, u * 1.2, u * 0.8, 3); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx - u * 0.6, cy - u * 0.1); ctx.lineTo(cx + u * 0.6, cy - u * 0.1); ctx.stroke();
  } else if (glyph === 'cup') {
    ctx.beginPath();
    ctx.moveTo(cx - u * 0.5, cy - u * 0.4); ctx.lineTo(cx + u * 0.5, cy - u * 0.4);
    ctx.lineTo(cx + u * 0.3, cy + u * 0.45); ctx.lineTo(cx - u * 0.3, cy + u * 0.45);
    ctx.closePath(); ctx.fill(); ctx.stroke();
  } else if (glyph === 'bulb') {
    ctx.beginPath(); ctx.arc(cx, cy - u * 0.1, u * 0.45, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
    rr(ctx, cx - u * 0.18, cy + u * 0.28, u * 0.36, u * 0.3, 2); ctx.fill(); ctx.stroke();
  } else if (glyph === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(cx, cy - u * 0.6); ctx.lineTo(cx + u * 0.55, cy + u * 0.2);
    ctx.lineTo(cx + u * 0.15, cy + u * 0.1); ctx.lineTo(cx + u * 0.15, cy + u * 0.6);
    ctx.lineTo(cx - u * 0.15, cy + u * 0.6); ctx.lineTo(cx - u * 0.15, cy + u * 0.1);
    ctx.lineTo(cx - u * 0.55, cy + u * 0.2); ctx.closePath(); ctx.fill(); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.arc(cx, cy, u * 0.55, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }
  ctx.restore();
}

function wrapText(ctx, text, maxWidth) {
  const words = String(text).split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const test = cur ? cur + ' ' + w : w;
    if (ctx.measureText(test).width > maxWidth && cur) {
      lines.push(cur);
      cur = w;
    } else {
      cur = test;
    }
  }
  if (cur) lines.push(cur);
  return lines.slice(0, 2);
}

function drawObject(ctx, o, scene, lang, time, highlight) {
  const color = GLYPH_COLOR[o.glyph] || GLYPH_COLOR.rect;
  const x = o.x;
  const y = o.y;

  // 卡牌底
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.35)';
  ctx.shadowBlur = 12;
  ctx.shadowOffsetY = 6;
  rr(ctx, x - o.w / 2, y - o.h / 2, o.w, o.h, 14);
  ctx.fillStyle = 'rgba(12, 18, 26, 0.72)';
  ctx.fill();
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;
  ctx.strokeStyle = highlight ? scene.accent : 'rgba(255,255,255,0.28)';
  ctx.lineWidth = highlight ? 3 : 2;
  rr(ctx, x - o.w / 2, y - o.h / 2, o.w, o.h, 14);
  ctx.stroke();
  if (highlight) {
    const pulse = 0.6 + 0.4 * Math.sin(time * 4);
    ctx.strokeStyle = `rgba(255, 209, 102, ${0.55 + 0.4 * pulse})`;
    ctx.lineWidth = 5;
    rr(ctx, x - o.w / 2 - 5, y - o.h / 2 - 5, o.w + 10, o.h + 10, 18);
    ctx.stroke();
  }

  // 图标
  drawGlyph(ctx, o.glyph, x, y - o.h * 0.16, Math.min(o.w, o.h) * 0.62, color);

  // 标签
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  const label = o.label[lang] || o.label.en;
  ctx.font = `bold ${Math.max(14, Math.min(22, o.w / 8))}px ${FONT}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  const lines = wrapText(ctx, label, o.w * 0.86);
  const lh = Math.max(16, o.w / 8) * 1.1;
  lines.forEach((ln, i) => {
    const ly = y + o.h * 0.28 + i * lh;
    ctx.strokeText(ln, x, ly);
    ctx.fillText(ln, x, ly);
  });

  // 拖拽提示（可拖物）
  if (o.draggable) {
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = `12px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('↕', x + o.w / 2 - 14, y - o.h / 2 + 12);
  }
  ctx.restore();
}

function drawScene(ctx, scene, time, chapter) {
  const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
  g.addColorStop(0, scene.bgTop);
  g.addColorStop(1, scene.bgBottom);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

  ctx.save();
  if (scene.deco === 'lab') {
    // 台面
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 540, WORLD.WIDTH, 8);
    // 架子上几个烧杯
    const cols = [200, 380, 560, 900, 1080];
    cols.forEach((x, i) => {
      const bob = Math.sin(time * 2 + i) * 4;
      ctx.fillStyle = i % 2 ? 'rgba(73,224,192,0.20)' : 'rgba(255,209,102,0.16)';
      ctx.beginPath();
      ctx.moveTo(x, 540);
      ctx.lineTo(x + 14, 470 + bob);
      ctx.lineTo(x + 46, 470 + bob);
      ctx.lineTo(x + 60, 540);
      ctx.closePath();
      ctx.fill();
    });
  } else if (scene.deco === 'kitchen') {
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 560, WORLD.WIDTH, 14);
    // 窗户
    ctx.fillStyle = 'rgba(120,180,255,0.14)';
    rr(ctx, 130, 180, 260, 200, 10);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.2)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(260, 180); ctx.lineTo(260, 380); ctx.moveTo(130, 280); ctx.lineTo(390, 280); ctx.stroke();
    // 蒸汽
    for (let i = 0; i < 4; i += 1) {
      const sx = 640 + i * 60;
      const sy = 460 - ((time * 20 + i * 30) % 120);
      ctx.fillStyle = 'rgba(255,255,255,0.08)';
      ctx.beginPath(); ctx.arc(sx, sy, 16 + i * 3, 0, Math.PI * 2); ctx.fill();
    }
  } else if (scene.deco === 'garden') {
    ctx.fillStyle = 'rgba(143,227,106,0.14)';
    ctx.fillRect(0, 580, WORLD.WIDTH, 140);
    // 树
    [180, 1120].forEach((x) => {
      ctx.fillStyle = 'rgba(80,50,30,0.8)';
      ctx.fillRect(x - 12, 400, 24, 180);
      ctx.fillStyle = 'rgba(80,180,80,0.35)';
      ctx.beginPath(); ctx.arc(x, 360, 90, 0, Math.PI * 2); ctx.fill();
    });
    // 花点
    for (let i = 0; i < 10; i += 1) {
      const fx = 200 + i * 96;
      const fy = 600 + ((i * 37) % 40);
      ctx.fillStyle = i % 2 ? 'rgba(255,209,102,0.7)' : 'rgba(242,140,140,0.7)';
      ctx.beginPath(); ctx.arc(fx, fy, 7, 0, Math.PI * 2); ctx.fill();
    }
  } else if (scene.deco === 'space') {
    // 星星
    for (let i = 0; i < 60; i += 1) {
      const sx = (i * 197) % WORLD.WIDTH;
      const sy = (i * 89) % (WORLD.HEIGHT - 120);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(time * 1.5 + i));
      ctx.fillStyle = `rgba(255,255,255,${0.25 * tw})`;
      ctx.beginPath(); ctx.arc(sx, sy, 1.4 + (i % 3), 0, Math.PI * 2); ctx.fill();
    }
    // 行星
    ctx.fillStyle = 'rgba(157,140,255,0.28)';
    ctx.beginPath(); ctx.arc(180, 200, 70, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(157,140,255,0.4)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.ellipse(180, 200, 110, 30, -0.3, 0, Math.PI * 2); ctx.stroke();
    // 控制台
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(0, 560, WORLD.WIDTH, 14);
  }
  ctx.restore();

  // 章节水印
  ctx.fillStyle = 'rgba(255,255,255,0.12)';
  ctx.font = `800 ${52}px ${FONT}`;
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(String(chapter).padStart(2, '0'), WORLD.WIDTH - 24, 16);
}

function drawDoctor(ctx, x, y, s, expression, time) {
  ctx.save();
  ctx.translate(x, y);
  const bob = expression === 'laugh' ? Math.sin(time * 18) * 3 : 0;
  ctx.translate(0, bob);

  // 白大褂身体
  ctx.fillStyle = '#eef4ff';
  rr(ctx, -s * 0.45, s * 0.1, s * 0.9, s * 0.85, 10);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 2;
  ctx.stroke();
  // 领带
  ctx.fillStyle = '#ff6b6b';
  ctx.beginPath();
  ctx.moveTo(0, s * 0.1); ctx.lineTo(s * 0.14, s * 0.3); ctx.lineTo(0, s * 0.5); ctx.lineTo(-s * 0.14, s * 0.3);
  ctx.closePath(); ctx.fill();

  // 头
  ctx.fillStyle = '#f7c9a8';
  ctx.beginPath(); ctx.arc(0, -s * 0.22, s * 0.34, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.12)';
  ctx.lineWidth = 2;
  ctx.stroke();

  // 头发（几撮尖刺）
  ctx.fillStyle = '#8a8a9a';
  ctx.beginPath();
  ctx.moveTo(-s * 0.32, -s * 0.4);
  ctx.lineTo(-s * 0.18, -s * 0.62);
  ctx.lineTo(-s * 0.05, -s * 0.4);
  ctx.lineTo(s * 0.1, -s * 0.58);
  ctx.lineTo(s * 0.28, -s * 0.38);
  ctx.lineTo(s * 0.2, -s * 0.42);
  ctx.lineTo(s * 0.05, -s * 0.44);
  ctx.lineTo(-s * 0.06, -s * 0.4);
  ctx.closePath();
  ctx.fill();

  // 护目镜
  ctx.fillStyle = '#9fd8ff';
  ctx.beginPath(); ctx.arc(-s * 0.14, -s * 0.22, s * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.22, s * 0.15, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#1c2b3a';
  ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(-s * 0.14, -s * 0.22, s * 0.15, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.22, s * 0.15, 0, Math.PI * 2); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -s * 0.22); ctx.lineTo(0, -s * 0.22); ctx.stroke();
  ctx.fillStyle = '#123';
  ctx.beginPath(); ctx.arc(-s * 0.14, -s * 0.2, s * 0.05, 0, Math.PI * 2); ctx.fill();
  ctx.beginPath(); ctx.arc(s * 0.14, -s * 0.2, s * 0.05, 0, Math.PI * 2); ctx.fill();

  // 嘴：neutral 平线 / annoyed 下弯 / laugh 大张坏笑
  ctx.strokeStyle = '#5b3a2a';
  ctx.lineWidth = 3;
  ctx.lineCap = 'round';
  const my = -s * 0.02;
  if (expression === 'laugh') {
    ctx.fillStyle = '#5b3a2a';
    ctx.beginPath(); ctx.arc(0, my, s * 0.2, 0, Math.PI); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ff8a8a';
    ctx.beginPath(); ctx.arc(0, my + s * 0.04, s * 0.12, 0, Math.PI); ctx.fill();
    // 眯眼
    ctx.fillStyle = '#f7c9a8';
    ctx.fillRect(-s * 0.28, -s * 0.3, s * 0.24, s * 0.08);
    ctx.fillRect(s * 0.04, -s * 0.3, s * 0.24, s * 0.08);
  } else if (expression === 'annoyed') {
    ctx.beginPath(); ctx.arc(0, my + s * 0.22, s * 0.2, Math.PI, Math.PI * 2); ctx.stroke();
    // 皱眉
    ctx.beginPath(); ctx.moveTo(-s * 0.24, -s * 0.38); ctx.lineTo(-s * 0.06, -s * 0.32); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(s * 0.24, -s * 0.38); ctx.lineTo(s * 0.06, -s * 0.32); ctx.stroke();
  } else {
    ctx.beginPath(); ctx.moveTo(-s * 0.14, my); ctx.lineTo(s * 0.14, my); ctx.stroke();
  }
  ctx.restore();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function draw(run, opts = {}) {
    const lang = opts.lang || 'en';
    const expression = opts.expression || 'neutral';
    const drag = opts.drag || null;
    const chapter = run ? run.level.chapter : 1;
    const scene = sceneOf(chapter);
    const time = run ? run.time : 0;

    drawScene(ctx, scene, time, chapter);

    if (!run) {
      drawDoctor(ctx, 110, 660, 120, expression, time);
      return;
    }

    ctx.save();
    if (run.ls.sceneRotated) {
      ctx.translate(WORLD.WIDTH / 2, WORLD.HEIGHT / 2);
      ctx.rotate(Math.PI);
      ctx.translate(-WORLD.WIDTH / 2, -WORLD.HEIGHT / 2);
    }

    // 高亮：当前解法涉及的交互物（goal 可读性）
    const targets = new Set();
    for (let i = 0; i < run.level.solution.length; i += 1) {
      if (run.ls.done[i]) continue;
      const req = run.level.solution[i];
      if (req.kind === 'dragTo') targets.add(req.targetId);
      else if (req.kind === 'invert') targets.add('handle');
      else targets.add(req.id);
    }

    for (const o of run.objects) {
      if (run.ls.moved.has(o.id)) continue; // 拖走的盖子消失
      if (run._isCovered(o)) continue; // 被盖住的物体不画，否则会从半透明盖子里透出
      if (run.ls.placed.has(o.id)) continue; // 已放进目标，改画在目标内
      if (drag && drag.id === o.id) continue; // 拖拽中，改画在手指处
      drawObject(ctx, o, scene, lang, time, targets.has(o.id));
    }

    // 已放置的物体：吸附到目标中心
    for (const [id, targetId] of run.ls.placed) {
      const o = run._objectById(id);
      const t = run._objectById(targetId);
      if (o && t) {
        const placed = { ...o, x: t.x, y: t.y - (t.h / 2 - o.h / 2), draggable: false };
        drawObject(ctx, placed, scene, lang, time, false);
      }
    }

    // 拖拽中的物体画在手指处
    if (drag) {
      const o = run._objectById(drag.id);
      if (o && !run.ls.placed.has(o.id)) {
        drawObject(ctx, { ...o, x: drag.x, y: drag.y }, scene, lang, time, true);
      }
    }

    ctx.restore();

    // 博士（不受场景翻转影响，始终正立；放左下角避免遮挡可交互物）
    drawDoctor(ctx, 110, 660, 120, expression, time);
  }

  return { draw };
}

export default createRender;
