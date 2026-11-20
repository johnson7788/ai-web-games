// src/render/index.js — IDIOM FORGE · 程序化 Canvas 场景渲染
// 三场景包（换章必换色板 + 构图 + 装饰）：
//   scene 0 铁匠铺（暖橙） / scene 1 书院（青竹） / scene 2 天工阁（金紫）
// 中央熔炉 + 神兵剪影喷发动画（signature：成语四字齐聚时熔炉喷出兵器剪影）。
// 不引任何外部素材；剪影折线来自 config/weapons.js。

import { WORLD } from '../../config/game.config.js';
import { WEAPONS } from '../../config/weapons.js';

const THEMES = [
  {
    name: 'forge',
    skyTop: '#1a0e06', skyBottom: '#3a1f0e',
    accent: '#ff8c3a', accent2: '#ffd08a',
    floor: '#241207', floorLine: '#5a2e14',
    deco: 'forge',
  },
  {
    name: 'academy',
    skyTop: '#0a1a12', skyBottom: '#1e3a26',
    accent: '#5fd08c', accent2: '#c8f0d4',
    floor: '#0e2016', floorLine: '#2e5c40',
    deco: 'academy',
  },
  {
    name: 'sky',
    skyTop: '#150d2a', skyBottom: '#382253',
    accent: '#c9a0ff', accent2: '#ffe6b0',
    floor: '#1b1130', floorLine: '#4a2f6e',
    deco: 'sky',
  },
];

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  const state = {
    forgeAnim: null,   // { weapon, t0 }
    particles: [],
    scene: 0,
    embers: [],
    seed: 1,
  };

  function rand() {
    state.seed = (state.seed * 1103515245 + 12345) & 0x7fffffff;
    return state.seed / 0x7fffffff;
  }

  function rr(x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.lineTo(x + w - rad, y);
    ctx.arcTo(x + w, y, x + w, y + rad, rad);
    ctx.lineTo(x + w, y + h - rad);
    ctx.arcTo(x + w, y + h, x + w - rad, y + h, rad);
    ctx.lineTo(x + rad, y + h);
    ctx.arcTo(x, y + h, x, y + h - rad, rad);
    ctx.lineTo(x, y + rad);
    ctx.arcTo(x, y, x + rad, y, rad);
    ctx.closePath();
  }

  function theme() {
    return THEMES[state.scene % THEMES.length];
  }

  function drawBackground(th) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.fillStyle = th.floor;
    ctx.fillRect(0, WORLD.HEIGHT - 150, WORLD.WIDTH, 150);
    ctx.fillStyle = th.floorLine;
    ctx.fillRect(0, WORLD.HEIGHT - 154, WORLD.WIDTH, 4);
  }

  function drawDecor(th) {
    ctx.save();
    ctx.globalAlpha = 0.5;
    if (th.deco === 'forge') {
      // 铁匠铺：悬挂的铁砧轮廓 + 火星
      for (let i = 0; i < 6; i += 1) {
        const x = 120 + i * 210;
        ctx.strokeStyle = th.accent;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(x, 90);
        ctx.lineTo(x, 210);
        ctx.moveTo(x - 46, 210);
        ctx.lineTo(x + 46, 210);
        ctx.moveTo(x - 40, 210);
        ctx.lineTo(x - 40, 240);
        ctx.moveTo(x + 40, 210);
        ctx.lineTo(x + 40, 240);
        ctx.stroke();
      }
    } else if (th.deco === 'academy') {
      // 书院：竹竿 + 竹节
      for (let i = 0; i < 7; i += 1) {
        const x = 100 + i * 180;
        ctx.strokeStyle = th.accent;
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(x, 80);
        ctx.lineTo(x, 560);
        ctx.stroke();
        ctx.lineWidth = 2;
        for (let y = 140; y < 560; y += 90) {
          ctx.beginPath();
          ctx.moveTo(x - 14, y);
          ctx.lineTo(x + 14, y);
          ctx.stroke();
          ctx.beginPath();
          ctx.moveTo(x + 8, y - 30);
          ctx.quadraticCurveTo(x + 40, y - 40, x + 46, y - 12);
          ctx.stroke();
        }
      }
    } else {
      // 天工阁：漂浮齿轮 + 星点
      for (let i = 0; i < 5; i += 1) {
        const x = 140 + i * 250;
        const y = 120 + (i % 2) * 120;
        ctx.strokeStyle = th.accent2;
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 30, 0, Math.PI * 2);
        ctx.stroke();
        ctx.beginPath();
        ctx.arc(x, y, 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      ctx.fillStyle = th.accent2;
      for (let i = 0; i < 40; i += 1) {
        ctx.globalAlpha = 0.3 + 0.5 * rand();
        ctx.fillRect(rand() * WORLD.WIDTH, rand() * 420, 2, 2);
      }
    }
    ctx.restore();
  }

  function drawForge(th, forgeProgress, forgeEvery) {
    const cx = WORLD.WIDTH / 2;
    const cy = WORLD.HEIGHT - 130;
    // 炉体
    const g = ctx.createLinearGradient(cx - 130, cy - 90, cx + 130, cy + 60);
    g.addColorStop(0, '#20130c');
    g.addColorStop(1, '#0e0805');
    ctx.fillStyle = g;
    rr(cx - 130, cy - 90, 260, 150, 24);
    ctx.fill();
    ctx.strokeStyle = th.accent;
    ctx.lineWidth = 3;
    ctx.stroke();
    // 炉口
    const glow = ctx.createRadialGradient(cx, cy + 20, 4, cx, cy + 20, 70);
    glow.addColorStop(0, th.accent2);
    glow.addColorStop(0.4, th.accent);
    glow.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = glow;
    rr(cx - 66, cy - 20, 132, 64, 16);
    ctx.fill();
    // 炉口黑芯
    ctx.fillStyle = '#0a0503';
    rr(cx - 50, cy - 8, 100, 40, 12);
    ctx.fill();
    // 熔铸进度：5 个余烬槽
    for (let i = 0; i < forgeEvery; i += 1) {
      const ex = cx - (forgeEvery - 1) * 22 + i * 44;
      const lit = i < forgeProgress;
      ctx.fillStyle = lit ? th.accent2 : 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.arc(ex, cy + 88, 9, 0, Math.PI * 2);
      ctx.fill();
      if (lit) {
        ctx.strokeStyle = th.accent;
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    }
  }

  function drawWeaponSilhouette(w, x, y, scale, alpha, color) {
    ctx.save();
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = color;
    ctx.lineWidth = 4;
    ctx.lineJoin = 'round';
    for (const poly of w.shapes) {
      ctx.beginPath();
      poly.forEach(([px, py], i) => {
        const X = x + (px - 0.5) * scale;
        const Y = y + (py - 0.5) * scale;
        if (i === 0) ctx.moveTo(X, Y);
        else ctx.lineTo(X, Y);
      });
      ctx.closePath();
      ctx.stroke();
    }
    ctx.restore();
  }

  function updateForgeAnim(now) {
    if (!state.forgeAnim) return;
    const t = (now - state.forgeAnim.t0) / 1000;
    if (t > 1.4) {
      state.forgeAnim = null;
      return;
    }
    // 喷发粒子
    if (t < 0.9) {
      for (let i = 0; i < 3; i += 1) {
        state.particles.push({
          x: WORLD.WIDTH / 2 + (rand() - 0.5) * 40,
          y: WORLD.HEIGHT - 150 - rand() * 20,
          vx: (rand() - 0.5) * 120,
          vy: -120 - rand() * 160,
          life: 0.5 + rand() * 0.4,
          t0: now,
        });
      }
    }
  }

  function drawParticles(now, th) {
    state.particles = state.particles.filter((p) => (now - p.t0) / 1000 < p.life);
    for (const p of state.particles) {
      const t = (now - p.t0) / 1000 / p.life;
      ctx.globalAlpha = 1 - t;
      ctx.fillStyle = th.accent2;
      ctx.beginPath();
      ctx.arc(p.x + p.vx * t, p.y + p.vy * t + 0.5 * 600 * t * t, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(run, alpha = 1) {
    const hud = run && run.getHud ? run.getHud() : null;
    state.scene = hud ? hud.scene : state.scene;
    const th = theme();
    const now = performance.now();

    drawBackground(th);
    drawDecor(th);

    const forgeProgress = hud ? hud.forgeProgress : 0;
    const forgeEvery = hud ? hud.forgeEvery : 5;
    drawForge(th, forgeProgress, forgeEvery);

    updateForgeAnim(now);
    drawParticles(now, th);

    // 铸成的神兵剪影悬浮在熔炉上方（最近一件高亮）
    if (hud && hud.weapons > 0) {
      const lastIdx = Math.min(hud.weapons - 1, WEAPONS.length - 1);
      const w = WEAPONS[lastIdx];
      drawWeaponSilhouette(w, WORLD.WIDTH / 2, WORLD.HEIGHT - 300, 220, 0.9, th.accent2);
    }

    // 喷发动画：神兵剪影从炉口升起
    if (state.forgeAnim) {
      const t = (now - state.forgeAnim.t0) / 1000;
      const y = WORLD.HEIGHT - 150 - t * 260;
      const alpha = t < 0.9 ? 1 : Math.max(0, 1 - (t - 0.9) / 0.5);
      drawWeaponSilhouette(state.forgeAnim.weapon, WORLD.WIDTH / 2, y, 200, alpha, th.accent2);
    }
  }

  function forge(weaponId) {
    const w = WEAPONS.find((x) => x.id === weaponId) || WEAPONS[0];
    state.forgeAnim = { weapon: w, t0: performance.now() };
  }

  function setScene(scene) {
    state.scene = scene % THEMES.length;
  }

  return { draw, forge, setScene };
}
