// Canvas 2D 场景：超市墙面 / 货架 / 收银台 / 顾客。交互面板为 DOM。
import { WORLD, COLORS } from '../../config/game.config.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let time = 0;

  function update(dt) { time += dt; }

  function roundRect(x, y, w, h, r) {
    const rr = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rr, y);
    ctx.arcTo(x + w, y, x + w, y + h, rr);
    ctx.arcTo(x + w, y + h, x, y + h, rr);
    ctx.arcTo(x, y + h, x, y, rr);
    ctx.arcTo(x, y, x + w, y, rr);
    ctx.closePath();
  }

  function wall() {
    const g = ctx.createLinearGradient(0, 0, 0, 560);
    g.addColorStop(0, '#0d3338');
    g.addColorStop(0.55, '#124247');
    g.addColorStop(1, '#0a2a2e');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, 560);

    // 顶部暖光
    const glow = ctx.createRadialGradient(640, 60, 20, 640, 60, 520);
    glow.addColorStop(0, 'rgba(251, 191, 36, 0.16)');
    glow.addColorStop(1, 'rgba(251, 191, 36, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, WORLD.WIDTH, 420);

    // 墙面竖条
    ctx.fillStyle = 'rgba(255,255,255,0.025)';
    for (let x = 0; x < WORLD.WIDTH; x += 64) ctx.fillRect(x, 0, 26, 520);

    // 吊灯
    for (const lx of [360, 640, 920]) {
      ctx.strokeStyle = 'rgba(0,0,0,0.28)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(lx, 0); ctx.lineTo(lx, 42); ctx.stroke();
      ctx.fillStyle = '#d6c7a1';
      ctx.beginPath(); ctx.ellipse(lx, 48, 26, 10, 0, 0, Math.PI * 2); ctx.fill();
      const lamp = ctx.createRadialGradient(lx, 56, 2, lx, 56, 90);
      lamp.addColorStop(0, 'rgba(255, 236, 179, 0.20)');
      lamp.addColorStop(1, 'rgba(255, 236, 179, 0)');
      ctx.fillStyle = lamp;
      ctx.fillRect(lx - 100, 40, 200, 180);
    }

    // 中央窗户（夕阳）
    const wx = 430;
    const wy = 96;
    const ww = 420;
    const wh = 190;
    ctx.save();
    roundRect(wx, wy, ww, wh, 10);
    ctx.clip();
    const sky = ctx.createLinearGradient(0, wy, 0, wy + wh);
    sky.addColorStop(0, '#f9a8d4');
    sky.addColorStop(0.35, '#fb923c');
    sky.addColorStop(0.7, '#fbbf24');
    sky.addColorStop(1, '#fde68a');
    ctx.fillStyle = sky;
    ctx.fillRect(wx, wy, ww, wh);
    ctx.fillStyle = 'rgba(255,255,255,0.55)';
    ctx.beginPath(); ctx.arc(wx + 300, wy + 74, 28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.beginPath(); ctx.arc(wx + 300, wy + 74, 46, 0, Math.PI * 2); ctx.fill();
    // 远景屋顶
    ctx.fillStyle = '#7c2d12';
    for (let i = 0; i < 6; i += 1) {
      const bw = 40 + (i % 3) * 12;
      ctx.fillRect(wx + 12 + i * 68, wy + wh - 40 - (i % 4) * 8, bw, 80);
    }
    ctx.restore();
    ctx.strokeStyle = '#e8dcc0';
    ctx.lineWidth = 7;
    roundRect(wx, wy, ww, wh, 10); ctx.stroke();
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(wx + ww / 2, wy); ctx.lineTo(wx + ww / 2, wy + wh);
    ctx.moveTo(wx, wy + wh / 2); ctx.lineTo(wx + ww, wy + wh / 2);
    ctx.stroke();

  }

  function shelf(x, yTop, w, shelves, seed) {
    ctx.fillStyle = '#3b2a1f';
    roundRect(x, yTop, w, 360, 8); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(x + 8, yTop + 8, w - 16, 344);
    const palette = ['#ef4444', '#f59e0b', '#84cc16', '#06b6d4', '#a855f7', '#f472b6', '#fde68a', '#60a5fa'];
    for (let s = 0; s < shelves; s += 1) {
      const sy = yTop + 36 + s * 82;
      ctx.fillStyle = '#5b4130';
      ctx.fillRect(x + 6, sy, w - 12, 8);
      for (let i = 0; i < 5; i += 1) {
        const bx = x + 16 + i * ((w - 30) / 5);
        const bh = 26 + ((seed + s * 7 + i * 3) % 16);
        ctx.fillStyle = palette[(seed + s * 3 + i) % palette.length];
        ctx.globalAlpha = 0.85;
        roundRect(bx, sy - bh, (w - 30) / 5 - 8, bh, 3); ctx.fill();
        ctx.globalAlpha = 0.35;
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(bx + 3, sy - bh + 5, ((w - 30) / 5 - 8) - 6, 4);
        ctx.globalAlpha = 1;
      }
    }
  }

  function floor() {
    ctx.fillStyle = COLORS.floor;
    ctx.fillRect(0, 520, WORLD.WIDTH, 200);
    const tile = 80;
    for (let y = 520; y < 720; y += tile / 2) {
      for (let x = 0; x < WORLD.WIDTH; x += tile) {
        const odd = (Math.floor((y - 520) / (tile / 2)) + Math.floor(x / tile)) % 2 === 0;
        ctx.fillStyle = odd ? 'rgba(255,255,255,0.035)' : 'rgba(0,0,0,0.10)';
        ctx.fillRect(x, y, tile, tile / 2);
      }
    }
    // 透视地脚线
    ctx.strokeStyle = 'rgba(0,0,0,0.30)';
    ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 520); ctx.lineTo(WORLD.WIDTH, 520); ctx.stroke();
  }

  function counter() {
    // 收银台主体
    const g = ctx.createLinearGradient(0, 560, 0, 720);
    g.addColorStop(0, '#a46d48');
    g.addColorStop(1, '#6b432a');
    ctx.fillStyle = g;
    roundRect(40, 574, 1200, 146, 18); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(56, 584, 1168, 10);
    // 传送带
    ctx.fillStyle = COLORS.belt;
    roundRect(80, 532, 660, 44, 12); ctx.fill();
    ctx.strokeStyle = COLORS.beltEdge;
    ctx.lineWidth = 3;
    roundRect(80, 532, 660, 44, 12); ctx.stroke();
    // 传送带纹路
    ctx.strokeStyle = 'rgba(255,255,255,0.06)';
    ctx.lineWidth = 2;
    for (let x = 96; x < 730; x += 26) {
      ctx.beginPath(); ctx.moveTo(x, 540); ctx.lineTo(x - 10, 568); ctx.stroke();
    }
    // 扫码台
    ctx.fillStyle = '#18262a';
    roundRect(700, 500, 96, 84, 10); ctx.fill();
    ctx.strokeStyle = 'rgba(94,234,212,0.55)';
    ctx.lineWidth = 2;
    roundRect(700, 500, 96, 84, 10); ctx.stroke();
    ctx.fillStyle = 'rgba(94,234,212,0.18)';
    ctx.fillRect(714, 540, 68, 6);
    // 收银机
    ctx.fillStyle = '#1f2d31';
    roundRect(1000, 462, 150, 120, 12); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 2;
    roundRect(1000, 462, 150, 120, 12); ctx.stroke();
    ctx.fillStyle = '#0b171a';
    roundRect(1016, 476, 118, 46, 6); ctx.fill();
    ctx.fillStyle = '#5eead4';
    ctx.font = `700 16px ${FONT}`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText('$ 0.00', 1124, 500);
    for (let r = 0; r < 3; r += 1) {
      for (let c = 0; c < 4; c += 1) {
        ctx.fillStyle = 'rgba(255,255,255,0.18)';
        roundRect(1020 + c * 28, 532 + r * 16, 22, 11, 3); ctx.fill();
      }
    }
    // 收银台前板
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(80, 664, 1120, 6);
  }

  function customerView(hud, lang) {
    if (!hud) return;
    const cx = 640;
    const cy = 108;
    const mood = hud.patience / hud.patienceMax;
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(cx, cy + 114, 54, 12, 0, 0, Math.PI * 2); ctx.fill();
    // 身体
    ctx.fillStyle = hud.shirt || '#5eead4';
    roundRect(cx - 40, cy + 34, 80, 82, 26); ctx.fill();
    ctx.fillStyle = 'rgba(0,0,0,0.14)';
    roundRect(cx - 40, cy + 82, 80, 34, 26); ctx.fill();
    // 脖子
    ctx.fillStyle = '#f6c89f';
    ctx.fillRect(cx - 12, cy + 22, 24, 22);
    // 头
    ctx.fillStyle = '#f6c89f';
    ctx.beginPath(); ctx.ellipse(cx, cy, 38, 40, 0, 0, Math.PI * 2); ctx.fill();
    // 头发
    ctx.fillStyle = hud.hair || '#3b2f2f';
    ctx.beginPath();
    ctx.ellipse(cx, cy - 10, 40, 30, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx - 34, cy + 2, 10, 20, -0.2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.ellipse(cx + 34, cy + 2, 10, 20, 0.2, 0, Math.PI * 2); ctx.fill();
    // 眼睛
    ctx.fillStyle = '#1f2937';
    ctx.beginPath(); ctx.arc(cx - 13, cy - 2, 3.4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(cx + 13, cy - 2, 3.4, 0, Math.PI * 2); ctx.fill();
    // 眉毛（耐心低时变凶）
    ctx.strokeStyle = '#1f2937';
    ctx.lineWidth = 2.4;
    const brow = mood < 0.35 ? 5 : 0;
    ctx.beginPath(); ctx.moveTo(cx - 20, cy - 14 + brow); ctx.lineTo(cx - 8, cy - 11); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(cx + 20, cy - 14 + brow); ctx.lineTo(cx + 8, cy - 11); ctx.stroke();
    // 嘴
    ctx.strokeStyle = '#9a3412';
    ctx.lineWidth = 2.4;
    ctx.beginPath();
    if (mood < 0.35) ctx.arc(cx, cy + 18, 9, Math.PI * 1.15, Math.PI * 1.85);
    else ctx.arc(cx, cy + 14, 8, 0.15 * Math.PI, 0.85 * Math.PI);
    ctx.stroke();
    // 手里拿篮子/钱
    ctx.fillStyle = '#e8dcc0';
    roundRect(cx + 46, cy + 54, 44, 30, 6); ctx.fill();
    ctx.fillStyle = '#b45309';
    ctx.fillRect(cx + 54, cy + 58, 28, 4);
    // 名牌
    const name = (hud.name && (hud.name[lang] || hud.name.en)) || 'Customer';
    const type = (hud.typeName && (hud.typeName[lang] || hud.typeName.en)) || '';
    const tx = cx + 54;
    const ty = cy - 22;
    roundRect(tx, ty, 168, 44, 9);
    ctx.fillStyle = 'rgba(6, 26, 30, 0.82)';
    ctx.fill();
    ctx.strokeStyle = 'rgba(94, 234, 212, 0.28)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#eaf7f5';
    ctx.font = `800 14px ${FONT}`;
    ctx.fillText(name, tx + 10, ty + 15);
    ctx.fillStyle = '#5eead4';
    ctx.font = `700 8px ${FONT}`;
    ctx.fillText(String(type).toUpperCase(), tx + 10, ty + 31);
  }

  function render(view) {
    const { hud } = view;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    wall();
    shelf(18, 168, 238, 4, 2);
    shelf(1024, 168, 238, 4, 5);
    floor();
    if (!view.compact) customerView(hud, view.lang || 'en');
    counter();
    // 暖色暗角
    const vig = ctx.createRadialGradient(640, 360, 260, 640, 360, 760);
    vig.addColorStop(0, 'rgba(0,0,0,0)');
    vig.addColorStop(1, 'rgba(0,0,0,0.42)');
    ctx.fillStyle = vig;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  return { render, update };
}
