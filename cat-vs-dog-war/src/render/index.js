// CAT VS DOG WAR · Canvas 2D 程序化渲染（扁平手绘卡通风，零素材零外链）
import { WORLD, LAYOUT, MONSTER_TYPES, ROCK } from '../../config/game.config.js';

const TAU = Math.PI * 2;

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  const x = t - 1;
  return 1 + c3 * x * x * x + c1 * x * x;
}

// 卡通动物头（cat=尖耳猫，其余=垂耳狗）
function drawCritter(ctx, x, y, r, type, color, wobble, flash) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(Math.sin(wobble) * 0.06);
  const line = '#3a2a1a';

  // 耳朵
  ctx.fillStyle = color;
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  if (type === 'cat') {
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * r * 0.45, -r * 0.55);
      ctx.lineTo(sx * r * 0.95, -r * 1.25);
      ctx.lineTo(sx * r * 0.95, -r * 0.2);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    // 内耳
    ctx.fillStyle = '#ffd1dc';
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * r * 0.55, -r * 0.62);
      ctx.lineTo(sx * r * 0.82, -r * 1.05);
      ctx.lineTo(sx * r * 0.82, -r * 0.38);
      ctx.closePath();
      ctx.fill();
    }
  } else {
    for (const sx of [-1, 1]) {
      ctx.fillStyle = color;
      ctx.strokeStyle = line;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(sx * r * 0.72, -r * 0.72, r * 0.34, r * 0.6, sx * 0.5, 0, TAU);
      ctx.fill();
      ctx.stroke();
    }
  }

  // 身体
  ctx.fillStyle = color;
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(0, 0, r, 0, TAU);
  ctx.fill();
  ctx.stroke();

  // 眼睛
  const eyeY = -r * 0.12;
  ctx.fillStyle = '#ffffff';
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(sx * r * 0.4, eyeY, r * 0.2, r * 0.24, 0, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }
  ctx.fillStyle = '#1c1c1c';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.arc(sx * r * 0.4, eyeY + r * 0.03, r * 0.1, 0, TAU);
    ctx.fill();
  }

  // 鼻子 / 嘴
  ctx.fillStyle = type === 'cat' ? '#ff8fa3' : '#5a3d1e';
  ctx.beginPath();
  ctx.arc(0, r * 0.28, r * 0.12, 0, TAU);
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, r * 0.32, r * 0.3, 0.15 * Math.PI, 0.85 * Math.PI);
  ctx.stroke();

  // 猫咪胡须
  if (type === 'cat') {
    ctx.strokeStyle = line;
    ctx.lineWidth = 1.5;
    for (const sx of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(sx * r * 0.55, r * 0.22);
      ctx.lineTo(sx * r * 1.1, r * 0.12);
      ctx.moveTo(sx * r * 0.55, r * 0.32);
      ctx.lineTo(sx * r * 1.1, r * 0.36);
      ctx.stroke();
    }
  }

  // 高亮
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  ctx.beginPath();
  ctx.ellipse(-r * 0.35, -r * 0.5, r * 0.22, r * 0.14, -0.6, 0, TAU);
  ctx.fill();

  // 被点击闪白
  if (flash > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.85, flash)})`;
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.02, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

function drawRock(ctx, x, y, r, pop) {
  ctx.save();
  ctx.translate(x, y);
  const s = 0.5 + 0.5 * pop;
  ctx.scale(s, s);
  const line = '#3a2a1a';
  ctx.fillStyle = ROCK.color;
  ctx.strokeStyle = line;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-r, r * 0.55);
  ctx.lineTo(-r * 0.6, -r * 0.45);
  ctx.lineTo(r * 0.1, -r * 0.85);
  ctx.lineTo(r * 0.9, -r * 0.25);
  ctx.lineTo(r, r * 0.6);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  // 裂缝
  ctx.strokeStyle = 'rgba(58,42,26,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(-r * 0.3, -r * 0.2);
  ctx.lineTo(0, r * 0.1);
  ctx.lineTo(-r * 0.1, r * 0.5);
  ctx.stroke();
  ctx.restore();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function drawBackground() {
    const sky = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    sky.addColorStop(0, '#aee3ff');
    sky.addColorStop(0.55, '#d8f4ff');
    sky.addColorStop(0.55, '#7ed957');
    sky.addColorStop(1, '#5fc341');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 草地条纹
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    for (let i = 0; i < 6; i += 1) {
      ctx.beginPath();
      ctx.ellipse(120 + i * 230, 560 + (i % 2) * 40, 180, 60, 0, 0, TAU);
      ctx.fill();
    }
    // 阳光
    ctx.fillStyle = 'rgba(255,240,150,0.85)';
    ctx.beginPath();
    ctx.arc(1130, 90, 46, 0, TAU);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 2; i += 1) {
      ctx.beginPath();
      ctx.ellipse(1080 + i * 60, 230 + i * 50, 80, 20, 0, 0, TAU);
      ctx.fill();
    }
  }

  function drawHole(x, y) {
    const R = LAYOUT.HOLE_R;
    ctx.save();
    // 外圈草皮
    ctx.fillStyle = '#4fa834';
    ctx.beginPath();
    ctx.ellipse(x, y, R * 1.3, R * 0.62, 0, 0, TAU);
    ctx.fill();
    ctx.strokeStyle = '#3a7d24';
    ctx.lineWidth = 4;
    ctx.stroke();
    // 洞内
    ctx.fillStyle = '#241107';
    ctx.beginPath();
    ctx.ellipse(x, y, R, R * 0.45, 0, 0, TAU);
    ctx.fill();
    // 洞口高光
    ctx.strokeStyle = 'rgba(255,255,255,0.18)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.ellipse(x, y - R * 0.12, R * 0.8, R * 0.28, 0, Math.PI, TAU);
    ctx.stroke();
    ctx.restore();
  }

  function drawCritterAt(hole, cx, cy) {
    const m = hole.monster;
    const def = MONSTER_TYPES[m.type];
    const pop = Math.min(1, m.age / 0.18);
    const p = easeOutBack(pop);
    const r = LAYOUT.CRITTER_R;
    const y = cy - r * 0.9 + (1 - p) * r * 1.5;
    drawCritter(ctx, cx, y, r, m.type, def.color, m.age * 4, m.flash || 0);

    // 多击进度（剩余点击 pips）
    if (m.tapsNeeded > 1) {
      const total = m.tapsNeeded;
      const left = m.tapsLeft;
      const bw = 66;
      const bh = 9;
      const bx = cx - bw / 2;
      const by = cy - r * 2.4 - 6;
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(bx - 2, by - 2, bw + 4, bh + 4);
      ctx.fillStyle = '#2b1a0c';
      ctx.fillRect(bx, by, bw, bh);
      const w = (left / total) * bw;
      ctx.fillStyle = '#ffcf4d';
      ctx.fillRect(bx, by, w, bh);
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(bx, by, bw, bh);
    }
  }

  function drawFx(fx) {
    for (const f of fx) {
      if (f.type === 'ring') {
        const k = 1 - f.ttl / f.max;
        ctx.strokeStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(f.x, f.y, 8 + k * 40, 0, TAU);
        ctx.stroke();
      } else if (f.type === 'pop') {
        const k = 1 - f.ttl / f.max;
        ctx.fillStyle = f.color || '#fff';
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * TAU + f.seed;
          const d = k * 42;
          ctx.beginPath();
          ctx.arc(f.x + Math.cos(a) * d, f.y + Math.sin(a) * d - k * 24, 4 - k * 2, 0, TAU);
          ctx.fill();
        }
      } else if (f.type === 'scoreFloat') {
        const k = 1 - f.ttl / f.max;
        ctx.font = 'bold 26px "Courier New", monospace';
        ctx.textAlign = 'center';
        ctx.fillStyle = f.color || '#ffffff';
        ctx.strokeStyle = 'rgba(0,0,0,0.5)';
        ctx.lineWidth = 4;
        const y = f.y - k * 46;
        ctx.strokeText(f.text, f.x, y);
        ctx.fillText(f.text, f.x, y);
      }
    }
  }

  function draw(state, dt, view) {
    drawBackground();
    for (const h of LAYOUT.holes) drawHole(h.x, h.y);

    if (state && state.holes) {
      for (let i = 0; i < state.holes.length; i += 1) {
        const m = state.holes[i].monster;
        if (!m) continue;
        const h = LAYOUT.holes[i];
        if (m.type === 'rock') {
          const pop = Math.min(1, m.age / 0.18);
          const p = easeOutBack(pop);
          const y = h.y - LAYOUT.ROCK_R * 0.4 + (1 - p) * LAYOUT.ROCK_R * 1.4;
          drawRock(ctx, h.x, y, LAYOUT.ROCK_R, p);
        } else {
          drawCritterAt(state.holes[i], h.x, h.y);
        }
      }
    } else {
      // 标题屏演示：3 只装饰动物
      const demos = [
        { i: 0, type: 'cat', t: 0.4 },
        { i: 2, type: 'gold', t: 0.9 },
        { i: 4, type: 'pup', t: 0.6 },
      ];
      for (const d of demos) {
        const h = LAYOUT.holes[d.i];
        const def = MONSTER_TYPES[d.type];
        drawCritter(ctx, h.x, h.y - LAYOUT.CRITTER_R * 0.9, LAYOUT.CRITTER_R, d.type, def.color, d.t, 0);
      }
    }

    if (view && view.fxQueue) drawFx(view.fxQueue);
  }

  return { draw, ctx };
}
