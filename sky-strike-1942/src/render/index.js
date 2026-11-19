// SKY STRIKE 1942 · Canvas 2D 霓虹街机渲染（程序化，无任何素材文件）
import { WORLD } from '../../config/game.config.js';
import { ENEMY_TYPES } from '../../config/levels.js';

const dprCap = (dpr) => Math.min(dpr || 1, 2);

function hash(n) {
  let x = n * 374761393 + 668265263;
  x = (x ^ (x >> 13)) * 1274126177;
  return ((x ^ (x >> 16)) >>> 0) / 4294967296;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = dprCap(window.devicePixelRatio);
  const stars = [];
  for (let i = 0; i < 70; i += 1) {
    stars.push({
      x: Math.random() * WORLD.WIDTH,
      y: Math.random() * WORLD.HEIGHT,
      z: 0.35 + Math.random() * 0.65,
      tw: Math.random() * Math.PI * 2,
    });
  }

  function resize() {
    dpr = dprCap(window.devicePixelRatio);
    canvas.width = WORLD.WIDTH * dpr;
    canvas.height = WORLD.HEIGHT * dpr;
    canvas.style.width = `${WORLD.WIDTH}px`;
    canvas.style.height = `${WORLD.HEIGHT}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  resize();
  window.addEventListener('resize', resize);

  function drawBackground(elapsed) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#060913');
    g.addColorStop(0.5, '#0b1024');
    g.addColorStop(1, '#121a38');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星野
    for (const s of stars) {
      const y = (s.y - elapsed * 40 * s.z) % WORLD.HEIGHT;
      const yy = y < 0 ? y + WORLD.HEIGHT : y;
      const a = 0.35 + 0.45 * (0.5 + 0.5 * Math.sin(elapsed * 2 + s.tw));
      ctx.fillStyle = `rgba(190, 230, 255, ${a * s.z})`;
      const r = s.z * 1.6;
      ctx.fillRect(s.x, yy, r, r + 1);
    }

    // 底部地平线光晕
    const glow = ctx.createLinearGradient(0, WORLD.HEIGHT - 160, 0, WORLD.HEIGHT);
    glow.addColorStop(0, 'rgba(56,225,255,0)');
    glow.addColorStop(1, 'rgba(56,225,255,0.10)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, WORLD.HEIGHT - 160, WORLD.WIDTH, 160);
  }

  function glowCircle(x, y, r, color, alpha = 0.25) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHero(h) {
    const x = h.x;
    const y = h.y;
    const blink = h.invuln > 0 && Math.floor(h.invuln * 12) % 2 === 0;

    // 尾焰
    const fl = 12 + Math.sin(h.y * 0.05) * 4;
    const fg = ctx.createLinearGradient(x, y + 24, x, y + 24 + fl + 14);
    fg.addColorStop(0, 'rgba(255,225,75,0.9)');
    fg.addColorStop(1, 'rgba(255,90,78,0)');
    ctx.fillStyle = fg;
    ctx.beginPath();
    ctx.moveTo(x - 7, y + 22);
    ctx.lineTo(x, y + 22 + fl + 12);
    ctx.lineTo(x + 7, y + 22);
    ctx.closePath();
    ctx.fill();

    ctx.save();
    if (blink) ctx.globalAlpha = 0.35;
    // 主体（三角机身）+ 强高光（玩家是画面最亮、唯一绿色元素）
    glowCircle(x, y - 4, 56, '#5dffa0', 0.55);
    glowCircle(x, y - 4, 26, '#ffffff', 0.6);
    ctx.fillStyle = '#123b2c';
    ctx.strokeStyle = '#d8ffe9';
    ctx.lineWidth = 3.4;
    ctx.beginPath();
    ctx.moveTo(x, y - 26);            // 机头
    ctx.lineTo(x + 14, y + 6);        // 右翼前
    ctx.lineTo(x + 26, y + 16);       // 右翼尖
    ctx.lineTo(x + 8, y + 18);
    ctx.lineTo(x + 6, y + 24);
    ctx.lineTo(x - 6, y + 24);
    ctx.lineTo(x - 8, y + 18);
    ctx.lineTo(x - 26, y + 16);       // 左翼尖
    ctx.lineTo(x - 14, y + 6);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 座舱
    ctx.fillStyle = '#ff4bd8';
    ctx.beginPath();
    ctx.ellipse(x, y - 6, 5, 9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 护盾环
    if (h.shield) {
      ctx.strokeStyle = 'rgba(125,255,184,0.85)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(x, y, 34, 0, Math.PI * 2);
      ctx.stroke();
      glowCircle(x, y, 34, '#7dffb8', 0.15);
    }
  }

  function drawEnemy(e) {
    const def = ENEMY_TYPES[e.type];
    const x = e.x;
    const y = e.y;
    // 敌机：统一「红色敌机、机头朝下」语言，一眼认出是敌人
    glowCircle(x, y, def.w * 1.15, def.color, 0.34);

    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#2a0f14';
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 3;
    const w = def.w;
    const h = def.h;

    // 机身（倒三角，机头朝下）
    ctx.beginPath();
    ctx.moveTo(0, h / 2);
    ctx.lineTo(w * 0.16, -h / 4);
    ctx.lineTo(0, -h / 2);
    ctx.lineTo(-w * 0.16, -h / 4);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // 机翼（按类型变化）
    if (e.type === 3) {
      // X 翼
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 2);
      ctx.lineTo(w / 2, -h / 2);
      ctx.lineTo(w / 2, -h / 6);
      ctx.lineTo(-w / 2, -h / 6);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.type === 4) {
      // 宽翼重型
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 3);
      ctx.lineTo(w / 2, -h / 3);
      ctx.lineTo(w * 0.34, h / 4);
      ctx.lineTo(-w * 0.34, h / 4);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.type === 5) {
      // 无翼飞镖
    } else {
      // 常规横翼
      ctx.beginPath();
      ctx.moveTo(-w / 2, -h / 5);
      ctx.lineTo(w / 2, -h / 5);
      ctx.lineTo(w * 0.3, -h / 10);
      ctx.lineTo(-w * 0.3, -h / 10);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }

    // 引擎光点（机头）
    ctx.fillStyle = def.color;
    ctx.beginPath();
    ctx.arc(0, h * 0.34, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 血条（所有敌机都显示，明确「可攻击目标」语义）
    {
      ctx.fillStyle = 'rgba(255,255,255,0.18)';
      ctx.fillRect(x - w / 2, y - h / 2 - 9, w, 4);
      ctx.fillStyle = '#ff5a4e';
      ctx.fillRect(x - w / 2, y - h / 2 - 9, w * (e.hp / e.maxHp), 4);
    }
    // 红色目标准星（四角框 = 「这是要击落的目标」）
    {
      const r = def.w * 0.85;
      const g = 6;
      ctx.strokeStyle = '#ff5a4e';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(x - r, y - r + g); ctx.lineTo(x - r, y - r); ctx.lineTo(x - r + g, y - r);
      ctx.moveTo(x + r - g, y - r); ctx.lineTo(x + r, y - r); ctx.lineTo(x + r, y - r + g);
      ctx.moveTo(x + r, y + r - g); ctx.lineTo(x + r, y + r); ctx.lineTo(x + r - g, y + r);
      ctx.moveTo(x - r + g, y + r); ctx.lineTo(x - r, y + r); ctx.lineTo(x - r, y + r - g);
      ctx.stroke();
    }
  }

  function drawRock(r) {
    ctx.save();
    ctx.translate(r.x, r.y);
    ctx.rotate(r.rot);
    const n = 8;
    ctx.fillStyle = '#241c14';
    ctx.strokeStyle = '#9a8a7a';
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (let i = 0; i < n; i += 1) {
      const a = (Math.PI * 2 * i) / n;
      const rr = r.w / 2 * (0.78 + hash(r.x + i * 7) * 0.24);
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 裂纹
    ctx.strokeStyle = 'rgba(185,246,255,0.4)';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(r.w * 0.3, -r.h * 0.25);
    ctx.stroke();
    ctx.restore();
  }

  function drawBullet(b) {
    // 玩家子弹：细长竖直激光（区别于星点/敌机）
    const g = ctx.createLinearGradient(0, b.y - b.h * 1.5, 0, b.y + b.h * 1.5);
    g.addColorStop(0, 'rgba(255,215,94,0)');
    g.addColorStop(0.5, '#fff7d0');
    g.addColorStop(1, 'rgba(255,215,94,0)');
    ctx.fillStyle = g;
    ctx.fillRect(b.x - 1.5, b.y - b.h * 1.5, 3, b.h * 3);
    glowCircle(b.x, b.y, 7, '#ffd75e', 0.3);
  }

  function drawEnemyBullet(b) {
    glowCircle(b.x, b.y, 8, '#ff6a4e', 0.3);
    ctx.fillStyle = '#ff8a6e';
    ctx.beginPath();
    ctx.arc(b.x, b.y, b.w / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  function starPath(x, y, outer, inner) {
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const r = i % 2 === 0 ? outer : inner;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      const px = x + Math.cos(a) * r;
      const py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
  }

  function drawPowerup(p) {
    const color = p.type === 'spread' ? '#38e1ff' : p.type === 'shield' ? '#7dffb8' : '#ffe14b';
    // 脉冲光环（收集物语义）
    const pulse = 0.5 + 0.5 * Math.sin(p.y * 0.04 + Date.now() * 0.004);
    glowCircle(p.x, p.y, 32 + pulse * 5, color, 0.3);
    // 星形收集物
    starPath(p.x, p.y, 23, 10);
    ctx.fillStyle = hexA(color, 0.95);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2.4;
    ctx.fill();
    ctx.stroke();
    // 中心字母
    ctx.fillStyle = '#0b0f1d';
    ctx.font = 'bold 14px ui-monospace, Menlo, Consolas, monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(p.type === 'spread' ? 'S' : p.type === 'shield' ? 'D' : 'B', p.x, p.y + 1);
  }

  function drawParticles(parts) {
    for (const p of parts) {
      const a = Math.max(0, p.life / p.maxLife);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
    }
    ctx.globalAlpha = 1;
  }

  function drawDemo() {
    drawHero({ x: 640, y: 600, invuln: 0, shield: false });
    drawEnemy({ type: 1, x: 320, y: 210, w: 40, h: 40, hp: 1, maxHp: 1 });
    drawEnemy({ type: 2, x: 640, y: 150, w: 46, h: 46, hp: 1, maxHp: 1 });
    drawEnemy({ type: 5, x: 960, y: 240, w: 38, h: 38, hp: 1, maxHp: 1 });
    drawPowerup({ type: 'spread', x: 480, y: 330, w: 34, h: 34 });
  }

  function draw(state) {
    const elapsed = state ? state.elapsed : 0;
    drawBackground(elapsed);

    if (!state) {
      drawDemo();
      return;
    }

    for (const r of state.rocks) drawRock(r);
    for (const p of state.powerups) drawPowerup(p);
    for (const b of state.enemyBullets) drawEnemyBullet(b);
    for (const b of state.bullets) drawBullet(b);
    for (const e of state.enemies) drawEnemy(e);
    drawHero(state.hero);
    drawParticles(state.particles);
  }

  return { draw, resize, debugLayout: () => null };
}
