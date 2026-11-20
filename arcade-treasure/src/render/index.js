// createRender 装配：渲染函数纯消费 sim 状态，不持有游戏逻辑。
// 导出 createRender(canvas) → { draw(run, interp), resize(), burst(x,y,kind) }。
// 三个机台各一套皮肤（机房守夜 / 雨中拾荒 / 像素蜂群）+ 大厅霓虹场景。
import { WORLD, STEP } from '../../config/game.config.js';
import { clamp, MOLE, RAIN, SWARM } from '../../config/gameplay.js';
import { t } from '../core/i18n.js';
import { HALL, PALETTES, DPR_CAP } from './theme.js';

function makeGlowSprite(radius, core, edge) {
  const size = Math.max(2, Math.ceil(radius * 2));
  const s = document.createElement('canvas');
  s.width = size; s.height = size;
  const c = s.getContext('2d');
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, core);
  g.addColorStop(1, edge);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return s;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const sprites = {
    coin: makeGlowSprite(26, 'rgba(255,230,150,1)', 'rgba(255,196,60,0)'),
    spark: makeGlowSprite(26, 'rgba(255,240,120,1)', 'rgba(255,150,40,0)'),
    bulb: makeGlowSprite(20, 'rgba(255,255,255,1)', 'rgba(180,240,255,0)'),
  };

  const particles = [];
  let lastNow = 0;
  let titleT = 0;

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

  function burst(x, y, kind) {
    const colors = kind === 'bad' ? ['#ff5d73', '#ff9f45'] : ['#ffe066', '#ffffff', '#59c2ff'];
    for (let i = 0; i < 10; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = 60 + Math.random() * 180;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.3, color: colors[i % colors.length], r: 2 + Math.random() * 3 });
    }
  }

  function updateParticles(dt) {
    for (const p of particles) {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 220 * dt;
    }
    for (let i = particles.length - 1; i >= 0; i -= 1) if (particles[i].life <= 0) particles.splice(i, 1);
  }

  function clear() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#05030a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // ---------- 大厅 ----------
  function drawHall(run) {
    const now = performance.now();
    const t = now / 1000;
    const lit = !!(run && run.signLit);

    // 背景墙
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, HALL.bg0);
    g.addColorStop(0.6, HALL.bg1);
    g.addColorStop(1, HALL.floor);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 墙砖网格
    ctx.strokeStyle = 'rgba(255,79,216,0.06)';
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD.WIDTH; x += 80) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, 420); ctx.stroke(); }
    for (let y = 0; y < 420; y += 60) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke(); }

    // GRAND PRIX 霓虹招牌
    const signGlow = lit ? HALL.gold : HALL.sign;
    ctx.save();
    ctx.font = '900 64px "Courier New", monospace';
    ctx.textAlign = 'center';
    ctx.shadowColor = lit ? HALL.gold : 'rgba(255,209,102,0.2)';
    ctx.shadowBlur = lit ? 40 : 8;
    ctx.fillStyle = signGlow;
    ctx.fillText('GRAND PRIX', WORLD.WIDTH / 2, 96);
    ctx.shadowBlur = 0;
    ctx.font = '700 20px "Courier New", monospace';
    ctx.fillStyle = lit ? '#fff3d6' : 'rgba(255,255,255,0.28)';
    ctx.fillText(lit ? t('grand.desc').split('.')[0] : '···', WORLD.WIDTH / 2, 130);
    ctx.restore();

    // 三台机台
    const cx = [270, 640, 1010];
    for (let i = 0; i < 3; i += 1) {
      const x = cx[i] - 150;
      const pal = PALETTES[i];
      // 机身
      ctx.fillStyle = '#120d1f';
      ctx.fillRect(x, 320, 300, 300);
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 4;
      ctx.strokeRect(x + 4, 320 + 4, 292, 292);
      // 屏幕
      const sg = ctx.createLinearGradient(x + 20, 340, x + 280, 520);
      sg.addColorStop(0, pal.bg0);
      sg.addColorStop(1, pal.bg1);
      ctx.fillStyle = sg;
      ctx.fillRect(x + 20, 340, 260, 180);
      // 屏幕内容（三台各自 motif）
      ctx.fillStyle = pal.accent;
      ctx.strokeStyle = pal.accent;
      ctx.lineWidth = 3;
      if (i === 0) {
        for (let k = 0; k < 3; k += 1) {
          const mx = x + 60 + k * 90;
          ctx.beginPath(); ctx.arc(mx, 420, 22, 0, Math.PI * 2); ctx.stroke();
          ctx.beginPath(); ctx.arc(mx - 8, 412, 5, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(mx + 8, 412, 5, 0, Math.PI * 2); ctx.fill();
        }
      } else if (i === 1) {
        ctx.beginPath(); ctx.arc(x + 150, 430, 26, 0, Math.PI * 2); ctx.stroke();
        ctx.font = '900 28px monospace'; ctx.textAlign = 'center';
        ctx.fillText('¢', x + 150, 440);
      } else {
        for (let k = 0; k < 4; k += 1) {
          const bx = x + 50 + k * 60;
          ctx.beginPath(); ctx.moveTo(bx, 470); ctx.lineTo(bx + 18, 470); ctx.stroke();
          ctx.beginPath(); ctx.arc(bx + 9, 452, 8, 0, Math.PI * 2); ctx.stroke();
        }
      }
      // 投币口
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 138, 578, 24, 30);
      ctx.strokeStyle = pal.accent2;
      ctx.strokeRect(x + 138, 578, 24, 30);
      // 热度指示灯
      const heatOn = run && run.heat > 0 && run.lastMachine === i;
      ctx.fillStyle = heatOn ? '#ff9f45' : 'rgba(255,255,255,0.12)';
      ctx.beginPath(); ctx.arc(x + 150, 620, 8, 0, Math.PI * 2); ctx.fill();
    }

    // 地板反射
    ctx.fillStyle = HALL.floor;
    ctx.fillRect(0, 640, WORLD.WIDTH, 80);
    ctx.strokeStyle = HALL.floorLine;
    ctx.lineWidth = 2;
    for (let x = 0; x < WORLD.WIDTH; x += 40) { ctx.beginPath(); ctx.moveTo(x, 640); ctx.lineTo(x + 24, 720); ctx.stroke(); }

    // 霓虹闪烁
    const blink = Math.sin(t * 6) > 0.2 ? 1 : 0.4;
    ctx.fillStyle = `rgba(255,79,216,${0.5 * blink})`;
    ctx.fillRect(0, 300, WORLD.WIDTH, 3);
  }

  // ---------- 机房守夜 ----------
  function drawMole(run) {
    const pal = PALETTES[0];
    const s = run.sub;
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.bg0); g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 服务器机架背景
    ctx.strokeStyle = 'rgba(57,255,158,0.14)';
    ctx.lineWidth = 2;
    for (let x = 40; x < WORLD.WIDTH; x += 130) {
      ctx.strokeRect(x, 60, 100, 500);
      for (let y = 90; y < 560; y += 46) {
        ctx.fillStyle = 'rgba(57,255,158,0.08)';
        ctx.fillRect(x + 8, y, 84, 30);
      }
    }

    if (!s) return;
    // 通风口网格
    const gw = MOLE.GRID_W / MOLE.HOLES_X;
    const gh = MOLE.GRID_H / MOLE.HOLES_Y;
    for (const h of s.holes) {
      ctx.fillStyle = '#03100c';
      ctx.strokeStyle = pal.accent2;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(h.x, h.y, MOLE.RADIUS, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (h.up) {
        if (h.hazard) {
          // 火花危险物：黄色三角警示
          ctx.fillStyle = pal.danger;
          ctx.beginPath();
          ctx.moveTo(h.x, h.y - 26); ctx.lineTo(h.x + 24, h.y + 14); ctx.lineTo(h.x - 24, h.y + 14);
          ctx.closePath(); ctx.fill();
          ctx.fillStyle = '#000'; ctx.font = '900 16px monospace'; ctx.textAlign = 'center';
          ctx.fillText('!', h.x, h.y + 10);
        } else {
          // 地鼠：发光圆眼 + 天线
          ctx.fillStyle = pal.accent;
          ctx.beginPath(); ctx.arc(h.x - 9, h.y - 10, 6, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(h.x + 9, h.y - 10, 6, 0, Math.PI * 2); ctx.fill();
          ctx.fillStyle = '#02100c';
          ctx.beginPath(); ctx.arc(h.x - 9, h.y - 12, 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.beginPath(); ctx.arc(h.x + 9, h.y - 12, 2.4, 0, Math.PI * 2); ctx.fill();
          ctx.strokeStyle = pal.accent;
          ctx.lineWidth = 2;
          ctx.beginPath(); ctx.moveTo(h.x - 6, h.y - 16); ctx.lineTo(h.x - 10, h.y - 30); ctx.stroke();
          ctx.beginPath(); ctx.moveTo(h.x + 6, h.y - 16); ctx.lineTo(h.x + 10, h.y - 30); ctx.stroke();
        }
      }
    }
  }

  // ---------- 雨中拾荒 ----------
  function drawRain(run) {
    const pal = PALETTES[1];
    const s = run.sub;
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.bg0); g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 雨丝
    ctx.strokeStyle = 'rgba(89,194,255,0.18)';
    ctx.lineWidth = 1;
    const t = performance.now() / 1000;
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 73 + t * 300) % WORLD.WIDTH;
      const y = (i * 137 + t * 500) % WORLD.HEIGHT;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - 6, y + 18); ctx.stroke();
    }

    if (!s) return;
    // 掉落物
    for (const it of s.items) {
      if (it.kind === 'coin') {
        ctx.drawImage(sprites.coin, it.x - 26, it.y - 26, 52, 52);
        ctx.fillStyle = '#7a4d00'; ctx.font = '900 20px monospace'; ctx.textAlign = 'center';
        ctx.fillText('¢', it.x, it.y + 7);
      } else {
        ctx.drawImage(sprites.spark, it.x - 26, it.y - 26, 52, 52);
        ctx.strokeStyle = pal.danger; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(it.x, it.y - 24); ctx.lineTo(it.x - 8, it.y); ctx.lineTo(it.x + 2, it.y); ctx.lineTo(it.x - 2, it.y + 12); ctx.lineTo(it.x + 8, it.y + 2); ctx.lineTo(it.x, it.y + 26); ctx.stroke();
      }
    }
    // 篮筐
    const bx = s.basketX;
    ctx.fillStyle = pal.accent;
    ctx.beginPath(); ctx.moveTo(bx - RAIN.BASKET_W / 2, RAIN.BASKET_Y); ctx.lineTo(bx + RAIN.BASKET_W / 2, RAIN.BASKET_Y); ctx.lineTo(bx + RAIN.BASKET_W / 2 - 16, RAIN.BASKET_Y + 34); ctx.lineTo(bx - RAIN.BASKET_W / 2 + 16, RAIN.BASKET_Y + 34); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#d7f4ff'; ctx.lineWidth = 3; ctx.stroke();
  }

  // ---------- 像素蜂群 ----------
  function drawSwarm(run) {
    const pal = PALETTES[2];
    const s = run.sub;
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.bg0); g.addColorStop(1, pal.bg1);
    ctx.fillStyle = g; ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星点
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 131) % WORLD.WIDTH; const y = (i * 97) % (WORLD.HEIGHT - 120);
      ctx.fillRect(x, y, 2, 2);
    }

    if (!s) return;
    // 蜜蜂
    for (const b of s.bees) {
      if (!b.alive) continue;
      ctx.fillStyle = pal.accent;
      ctx.fillRect(b.x - SWARM.BEE_W / 2, b.y - SWARM.BEE_H / 2, SWARM.BEE_W, SWARM.BEE_H);
      ctx.fillStyle = '#1d0b30';
      ctx.fillRect(b.x - 4, b.y - 4, 8, 8);
      ctx.fillStyle = pal.accent2;
      ctx.fillRect(b.x - SWARM.BEE_W / 2 - 8, b.y - 6, 10, 12);
      ctx.fillRect(b.x + SWARM.BEE_W / 2 - 2, b.y - 6, 10, 12);
    }
    // 蜂群子弹
    ctx.fillStyle = pal.danger;
    for (const b of s.beeBullets) ctx.fillRect(b.x - 3, b.y - 3, 6, 12);
    // 我方子弹
    ctx.fillStyle = '#ffffff';
    for (const b of s.bullets) ctx.fillRect(b.x - 3, b.y - 10, 6, 14);
    // 飞船
    ctx.fillStyle = pal.accent;
    ctx.beginPath();
    ctx.moveTo(s.shipX, SWARM.SHIP_Y - 24); ctx.lineTo(s.shipX - 20, SWARM.SHIP_Y + 12); ctx.lineTo(s.shipX, SWARM.SHIP_Y + 4); ctx.lineTo(s.shipX + 20, SWARM.SHIP_Y + 12);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(s.shipX, SWARM.SHIP_Y - 8, 5, 0, Math.PI * 2); ctx.fill();
  }

  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;
    titleT += dt;
    updateParticles(dt);

    clear();

    const isHall = !run || run.phase === 'hall' || run.phase === 'gameover' || run.phase === 'grandprix';
    if (isHall) {
      drawHall(run);
    } else if (run.machine === 0) {
      drawMole(run);
    } else if (run.machine === 1) {
      drawRain(run);
    } else if (run.machine === 2) {
      drawSwarm(run);
    } else {
      drawHall(run);
    }

    // 粒子
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life * 2, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  resize();

  return { draw, resize, burst };
}
