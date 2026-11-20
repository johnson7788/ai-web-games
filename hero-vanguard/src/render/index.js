// src/render/index.js — Canvas 2D 渲染：三场景包 / 基地 / 双子英雄 / 敌人 / 特效
import { WORLD, BASE, HERO as HEROCFG } from '../../config/gameplay.js';
import { themeFor } from './theme.js';
import { createParticles } from './particles.js';

const BASE_Y = 520;

function seeded(n) {
  let x = (n * 2654435761) >>> 0;
  return () => {
    x = (x + 0x6D2B79F5) | 0;
    let t = Math.imul(x ^ (x >>> 15), 1 | x);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = createParticles();
  let fx = [];
  let shakeT = 0;
  let shakeMag = 0;
  let starCache = null;
  let starKey = '';

  function stars(key) {
    if (starKey === key && starCache) return starCache;
    starKey = key;
    const rng = seeded(key.split('').reduce((s, c) => s + c.charCodeAt(0), 7));
    starCache = [];
    for (let i = 0; i < 70; i += 1) {
      starCache.push({ x: rng() * WORLD.WIDTH, y: rng() * WORLD.HEIGHT * 0.7, r: 0.6 + rng() * 1.6, tw: rng() * 6.28 });
    }
    return starCache;
  }

  function drawBackground(key, t) {
    const th = themeFor(key);
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, th.bgTop);
    g.addColorStop(1, th.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 星星
    const list = stars(key);
    ctx.fillStyle = th.star;
    for (const s of list) {
      const tw = 0.5 + 0.5 * Math.sin(t * 2 + s.tw);
      ctx.globalAlpha = 0.3 + tw * 0.6;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 装饰：近轨=环形轨道线 / 小行星=碎石带 / 深空=星云斑块
    if (key === 'orbit') {
      ctx.strokeStyle = th.grid;
      ctx.lineWidth = 1.5;
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.ellipse(WORLD.WIDTH - 140, 120, 220 + i * 60, 60 + i * 20, -0.35, 0, Math.PI * 2);
        ctx.stroke();
      }
    } else if (key === 'asteroid') {
      ctx.fillStyle = th.decor[0];
      for (let i = 0; i < 9; i += 1) {
        const rng = seeded(100 + i);
        const x = 180 + i * 130 + rng() * 40;
        const y = 80 + rng() * 220;
        const r = 8 + rng() * 22;
        ctx.globalAlpha = 0.5;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    } else {
      ctx.fillStyle = th.decor[0];
      for (let i = 0; i < 6; i += 1) {
        const rng = seeded(200 + i);
        const x = rng() * WORLD.WIDTH;
        const y = rng() * 300;
        const r = 40 + rng() * 90;
        const rg = ctx.createRadialGradient(x, y, 0, x, y, r);
        rg.addColorStop(0, th.decor[2] + '33');
        rg.addColorStop(1, 'transparent');
        ctx.fillStyle = rg;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 底部防线网格（玩家活动区）
    ctx.strokeStyle = th.grid;
    ctx.lineWidth = 1;
    for (let gx = WORLD.PLAY_ZONE_LEFT; gx <= WORLD.WIDTH; gx += 80) {
      ctx.beginPath();
      ctx.moveTo(gx, WORLD.PLAY_ZONE_TOP);
      ctx.lineTo(gx, WORLD.PLAY_ZONE_BOTTOM);
      ctx.stroke();
    }
    for (let gy = WORLD.PLAY_ZONE_TOP; gy <= WORLD.PLAY_ZONE_BOTTOM; gy += 80) {
      ctx.beginPath();
      ctx.moveTo(WORLD.PLAY_ZONE_LEFT, gy);
      ctx.lineTo(WORLD.WIDTH, gy);
      ctx.stroke();
    }
  }

  function drawBase(base, t) {
    const x = WORLD.BASE_X;
    const y = BASE_Y;
    ctx.save();
    ctx.translate(x, y);
    // 护盾圈
    if (base.shield > 0) {
      ctx.strokeStyle = 'rgba(127, 242, 255, 0.85)';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, 0, WORLD.BASE_R + 14 + Math.sin(t * 4) * 3, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 轨道站主体
    ctx.fillStyle = '#0a1a28';
    ctx.strokeStyle = '#7ff2ff';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(0, -WORLD.BASE_R);
    ctx.lineTo(WORLD.BASE_R * 0.6, 0);
    ctx.lineTo(0, WORLD.BASE_R);
    ctx.lineTo(-WORLD.BASE_R * 0.6, 0);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // 核心发光
    ctx.fillStyle = '#7ff2ff';
    ctx.beginPath();
    ctx.arc(0, 0, 12, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHero(h, t) {
    ctx.save();
    ctx.translate(h.x, h.y);
    if (h.charging) {
      ctx.strokeStyle = 'rgba(127, 242, 255, 0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(0, 0, HEROCFG.RADIUS + 12, 0, Math.PI * 2);
      ctx.stroke();
    }
    if (h.isControlled) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.arc(0, 0, HEROCFG.RADIUS + 9, 0, Math.PI * 2);
      ctx.stroke();
    }
    // 身体
    ctx.fillStyle = h.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 2;
    if (h.kind === 'blade') {
      // 近战刃：粗壮方块 + 刃
      ctx.fillRect(-HEROCFG.RADIUS * 0.7, -HEROCFG.RADIUS * 0.7, HEROCFG.RADIUS * 1.4, HEROCFG.RADIUS * 1.4);
      ctx.strokeRect(-HEROCFG.RADIUS * 0.7, -HEROCFG.RADIUS * 0.7, HEROCFG.RADIUS * 1.4, HEROCFG.RADIUS * 1.4);
      // 剑刃（朝敌人方向）
      const fx = h.facing * 30;
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(h.facing * 10, -4);
      ctx.lineTo(h.facing * 34, -4);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(h.facing * 10, 4);
      ctx.lineTo(h.facing * 34, 4);
      ctx.stroke();
    } else {
      // 远程弓：细身 + 弓弧
      ctx.beginPath();
      ctx.arc(0, 0, HEROCFG.RADIUS * 0.75, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#eaffff';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(h.facing * 8, 0, 22, -1.1, 1.1);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(h.facing * -12, -16);
      ctx.lineTo(h.facing * 8, 0);
      ctx.lineTo(h.facing * -12, 16);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawEnemy(e, t) {
    ctx.save();
    ctx.translate(e.x, e.y);
    ctx.fillStyle = e.color;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    const r = e.radius;
    if (e.kind === 'swarm') {
      // 蜂群：小三角
      ctx.beginPath();
      ctx.moveTo(-r, r * 0.7);
      ctx.lineTo(r, 0);
      ctx.lineTo(-r, -r * 0.7);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    } else if (e.kind === 'armored') {
      // 重甲：大方块
      ctx.fillRect(-r, -r, r * 2, r * 2);
      ctx.strokeRect(-r, -r, r * 2, r * 2);
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-r * 0.4, -r * 0.4, r * 0.8, r * 0.8);
    } else if (e.kind === 'kamikaze') {
      // 自爆：闪烁圆
      const blink = 0.6 + 0.4 * Math.sin(t * 16);
      ctx.globalAlpha = blink;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
      ctx.stroke();
    } else if (e.kind === 'shield') {
      // 护盾兵：六边形 + 前盾
      ctx.beginPath();
      for (let i = 0; i < 6; i += 1) {
        const a = (i / 6) * Math.PI * 2;
        const px = Math.cos(a) * r;
        const py = Math.sin(a) * r;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      if (e.shield > 0) {
        ctx.strokeStyle = '#c39bff';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 0, r + 7, -0.9, 0.9);
        ctx.stroke();
      }
    } else {
      // Boss：大菱形 + 核心
      ctx.beginPath();
      ctx.moveTo(0, -r);
      ctx.lineTo(r, 0);
      ctx.lineTo(0, r);
      ctx.lineTo(-r, 0);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
      ctx.fill();
    }
    // 血条
    if (e.maxHp > 0 && e.hp < e.maxHp) {
      const w = r * 2;
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(-w / 2, -r - 14, w, 5);
      ctx.fillStyle = '#7ff2ff';
      ctx.fillRect(-w / 2, -r - 14, w * Math.max(0, e.hp / e.maxHp), 5);
    }
    ctx.restore();
  }

  function drawFx(f, t, dt) {
    if (f.type === 'resonance') {
      const k = f.age / f.life;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = f.near ? '#7ff2ff' : '#ffd166';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.radius * (0.4 + k * 0.8), 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    } else if (f.type === 'swap') {
      const k = f.age / f.life;
      ctx.save();
      ctx.globalAlpha = 1 - k;
      ctx.strokeStyle = '#7ff2ff';
      ctx.lineWidth = 8;
      ctx.beginPath();
      ctx.moveTo(f.fromX, f.fromY);
      ctx.lineTo(f.toX, f.toY);
      ctx.stroke();
      ctx.restore();
    }
  }

  function draw(run, alpha, dt, t) {
    const sceneKey = run && run.phase !== 'title' ? (run.getHud ? run.getHud().sceneKey : 'orbit') : 'orbit';
    drawBackground(sceneKey, t);

    if (!run) {
      // 标题屏：画基地与两位英雄的静态站位（可读性）
      drawBase({ hp: BASE.MAX_HP, maxHp: BASE.MAX_HP, shield: 20 }, t);
      drawHero({ kind: 'blade', x: 340, y: 620, color: '#7ff2ff', facing: 1, isControlled: false, charging: false }, t);
      drawHero({ kind: 'bow', x: 520, y: 470, color: '#ffd166', facing: -1, isControlled: false, charging: false }, t);
      particles.draw(ctx);
      return;
    }

    const hud = run.getHud ? run.getHud() : {};
    drawBase(run.base, t);

    for (const h of run.heroes) drawHero(h, t);
    for (const e of run.enemies) drawEnemy(e, t);

    // 特效
    for (const f of fx) {
      drawFx(f, t, dt);
      f.age += dt;
    }
    fx = fx.filter((f) => f.age < f.life);

    particles.update(dt);
    particles.draw(ctx);
  }

  function spawnFx(type, payload = {}) {
    if (type === 'resonance') {
      fx.push({ type, x: payload.x, y: payload.y, radius: payload.radius, near: payload.near, age: 0, life: 0.45 });
      particles.burst(payload.x, payload.y, payload.near ? '#7ff2ff' : '#ffd166', 18, 320);
    } else if (type === 'swap') {
      fx.push({ type, fromX: payload.fromX, fromY: payload.fromY, toX: payload.toX, toY: payload.toY, age: 0, life: 0.35 });
      particles.burst(payload.toX, payload.toY, '#7ff2ff', 12, 260);
    } else if (type === 'kill') {
      particles.burst(payload.x, payload.y, '#ffd166', 10, 240);
    } else if (type === 'hit') {
      particles.burst(payload.x, payload.y, '#ffffff', 3, 140);
    } else if (type === 'shot') {
      particles.burst(payload.x, payload.y, '#bfefff', 2, 90);
    }
  }

  function burst(x, y, kind) {
    const colors = { pop: '#ffd166', gold: '#ffd166', cut: '#7ff2ff', boss: '#ff5470' };
    particles.burst(x, y, colors[kind] || '#ffffff', kind === 'boss' ? 20 : 8, 240);
  }

  function shake(mag) {
    shakeMag = Math.max(shakeMag, mag);
    shakeT = 0.2;
  }

  return { draw, spawnFx, burst, shake, particles };
}
