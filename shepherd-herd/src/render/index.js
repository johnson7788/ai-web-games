// Canvas 2D 渲染：霓虹街机风。羊群 / 岩石 / 光种 / 喂食槽 / 倒计时 / 粒子。
// 全部程序化绘制，无任何素材文件。
import { WORLD, PLAY } from '../../config/game.config.js';

const F = WORLD.FIELD;

const PALETTE = ['#00e5ff', '#ff3df0', '#b6ff00', '#ff9e00', '#7c6bff', '#ff5d8f', '#3df0c8', '#ffd34d', '#5dff8f', '#ff7a3d'];
const GOLD = '#ffd34d';
const FED = '#3a3a58';

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  // 预生成静态背景（合成波网格 + 地平线），避免每帧重画网格
  const bg = document.createElement('canvas');
  bg.width = WORLD.WIDTH;
  bg.height = WORLD.HEIGHT;
  const bctx = bg.getContext('2d');
  paintBackground(bctx);

  function paintBackground(c) {
    const grad = c.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    grad.addColorStop(0, '#0a0a18');
    grad.addColorStop(0.55, '#150b2c');
    grad.addColorStop(1, '#0b0b1e');
    c.fillStyle = grad;
    c.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 地平线光带
    const hg = c.createLinearGradient(0, F.bottom, 0, F.bottom + 90);
    hg.addColorStop(0, 'rgba(255, 61, 240, 0.10)');
    hg.addColorStop(1, 'rgba(255, 61, 240, 0)');
    c.fillStyle = hg;
    c.fillRect(0, F.bottom, WORLD.WIDTH, 90);

    // 透视网格
    c.strokeStyle = 'rgba(90, 60, 160, 0.28)';
    c.lineWidth = 1;
    const horizonY = F.bottom - 60;
    for (let i = 0; i <= 12; i += 1) {
      const x = (i / 12) * WORLD.WIDTH;
      c.beginPath();
      c.moveTo(WORLD.WIDTH / 2 + (x - WORLD.WIDTH / 2) * 0.15, horizonY);
      c.lineTo(x, WORLD.HEIGHT);
      c.stroke();
    }
    for (let i = 0; i <= 6; i += 1) {
      const y = F.top + ((F.bottom - F.top) * i) / 6;
      c.beginPath();
      c.moveTo(0, y);
      c.lineTo(WORLD.WIDTH, y);
      c.stroke();
    }
  }

  function glow(color, blur) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }

  function clearGlow() {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  function drawRock(rock, t) {
    ctx.save();
    ctx.translate(rock.x, rock.y);
    glow('#7c6bff', 10);
    ctx.fillStyle = '#1d1d33';
    ctx.strokeStyle = '#7c6bff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    // 低多边形岩石
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2 + rock.wobble;
      const rr = rock.r * (0.86 + 0.14 * Math.sin(t * 0.6 + rock.wobble * 3 + i));
      const px = Math.cos(a) * rr;
      const py = Math.sin(a) * rr;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
    clearGlow();
  }

  function drawSheep(sh, t) {
    ctx.save();
    ctx.translate(sh.x, sh.y);

    const color = sh.golden ? GOLD : PALETTE[sh.id % PALETTE.length];
    const main = sh.fed ? FED : color;
    const pulse = 1 + 0.06 * Math.sin(t * 3 + sh.wobble);

    // 光晕
    if (!sh.fed) {
      glow(main, sh.golden ? 26 : 18);
    }

    // 身体（羊毛团）
    const bodyR = sh.r * pulse;
    ctx.fillStyle = main;
    ctx.beginPath();
    ctx.arc(0, 0, bodyR, 0, Math.PI * 2);
    ctx.fill();
    clearGlow();

    // 羊毛圈
    ctx.strokeStyle = sh.fed ? '#2c2c44' : 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 6; i += 1) {
      const a = (i / 6) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(Math.cos(a) * bodyR * 0.55, Math.sin(a) * bodyR * 0.55, bodyR * 0.30, 0, Math.PI * 2);
      ctx.stroke();
    }

    // 未喂的羊：虚线目标环（可点按提示）
    if (!sh.fed) {
      ctx.save();
      ctx.setLineDash([5, 6]);
      ctx.strokeStyle = sh.golden ? 'rgba(255,211,77,0.75)' : 'rgba(255,255,255,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(0, 0, bodyR + 9 + Math.sin(t * 4 + sh.wobble) * 2, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 朝向的眼睛
    const ang = Math.atan2(sh.vy, sh.vx);
    const ex = Math.cos(ang) * bodyR * 0.34;
    const ey = Math.sin(ang) * bodyR * 0.34;
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(ex - ey * 0.22, ey + ex * 0.22, bodyR * 0.16, 0, Math.PI * 2);
    ctx.arc(ex + ey * 0.22, ey - ex * 0.22, bodyR * 0.16, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#0a0a18';
    ctx.beginPath();
    ctx.arc(ex - ey * 0.22 + Math.cos(ang) * bodyR * 0.06, ey + ex * 0.22 + Math.sin(ang) * bodyR * 0.06, bodyR * 0.07, 0, Math.PI * 2);
    ctx.arc(ex + ey * 0.22 + Math.cos(ang) * bodyR * 0.06, ey - ex * 0.22 + Math.sin(ang) * bodyR * 0.06, bodyR * 0.07, 0, Math.PI * 2);
    ctx.fill();

    // 金色羊：星标
    if (sh.golden && !sh.fed) {
      ctx.fillStyle = '#fff3c4';
      ctx.font = 'bold 20px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('★', 0, -bodyR - 8);
    }

    // 已喂：对勾
    if (sh.fed) {
      ctx.strokeStyle = '#7dff9a';
      ctx.lineWidth = 4;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-bodyR * 0.4, 0);
      ctx.lineTo(-bodyR * 0.1, bodyR * 0.34);
      ctx.lineTo(bodyR * 0.5, -bodyR * 0.3);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawTray(run, t) {
    const tx = WORLD.TRAY.x;
    const ty = WORLD.TRAY.y;
    // 槽底
    ctx.fillStyle = 'rgba(20,20,40,0.9)';
    ctx.strokeStyle = '#5a3ca0';
    ctx.lineWidth = 2;
    roundRect(ctx, tx - 130, ty - 18, 260, 36, 18);
    ctx.fill();
    ctx.stroke();

    // 剩余光种点
    const total = run.lv.sheep;
    const left = run.foodRemaining;
    const gap = Math.min(40, 240 / Math.max(1, total));
    const startX = tx - ((total - 1) * gap) / 2;
    for (let i = 0; i < total; i += 1) {
      const lit = i < left;
      const x = startX + i * gap;
      ctx.beginPath();
      ctx.arc(x, ty, 8, 0, Math.PI * 2);
      if (lit) { glow('#00e5ff', 10); ctx.fillStyle = '#00e5ff'; }
      else { ctx.fillStyle = '#2c2c44'; }
      ctx.fill();
      clearGlow();
    }
  }

  function drawFlight(f, run) {
    const sh = run.sheep.find((x) => x.id === f.targetId);
    if (!sh) return;
    const k = Math.min(1, f.t / f.dur);
    // 缓出
    const e = 1 - Math.pow(1 - k, 3);
    const x = f.fromX + (sh.x - f.fromX) * e;
    const y = f.fromY + (sh.y - f.fromY) * e;
    glow('#b6ff00', 16);
    ctx.fillStyle = '#f0ff9a';
    ctx.beginPath();
    ctx.arc(x, y, 7 + 3 * Math.sin(f.t * 40), 0, Math.PI * 2);
    ctx.fill();
    clearGlow();
    // 拖尾
    ctx.strokeStyle = 'rgba(182,255,0,0.35)';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(f.fromX, f.fromY);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  return {
    draw(run, dt, view) {
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      ctx.drawImage(bg, 0, 0);

      const t = (run ? run.t : 0) + (view ? view.clock || 0 : 0);
      const shake = view && view.shake ? view.shake : 0;
      ctx.save();
      if (shake > 0) {
        ctx.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
      }

      if (run) {
        for (const rock of run.rocks) drawRock(rock, t);
        // 已喂的羊画在下层
        for (const sh of run.sheep) if (sh.fed) drawSheep(sh, t);
        for (const f of run.flights) drawFlight(f, run);
        for (const sh of run.sheep) if (!sh.fed) drawSheep(sh, t);
        drawTray(run, t);

        // 连击提示（画布中上方）
        if (run.combo >= 2) {
          ctx.fillStyle = '#ffd34d';
          ctx.font = 'bold 30px system-ui, sans-serif';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText(`COMBO ×${run.combo}`, WORLD.WIDTH / 2, F.top - 26);
        }
      }

      // 粒子
      if (view && view.particles) {
        for (const p of view.particles) {
          ctx.globalAlpha = Math.max(0, Math.min(1, p.ttl / p.max));
          glow(p.color, 12);
          ctx.fillStyle = p.color;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r * (p.ttl / p.max), 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.globalAlpha = 1;
        clearGlow();
      }

      // 开局倒计时：小字放在喂食槽上方空白区，不遮羊群
      if (run && run.phase === 'countdown') {
        const n = Math.max(1, Math.ceil(run.countdown));
        ctx.fillStyle = '#00e5ff';
        ctx.font = 'bold 26px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(`READY ${n}`, WORLD.WIDTH / 2, WORLD.TRAY.y - 26);
      }

      ctx.restore();
    },
    debugLayout() {
      return {
        field: { x: F.left, y: F.top, w: F.right - F.left, h: F.bottom - F.top },
        tray: { x: WORLD.TRAY.x - 130, y: WORLD.TRAY.y - 18, w: 260, h: 36 },
      };
    },
  };
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
