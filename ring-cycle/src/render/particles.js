// src/render/particles.js — 粒子：吃环迸溅 / 彩虹糖雨 / 死亡碎裂（Canvas 2D，无外部素材）
import { WORLD } from '../../config/game.config.js';
import { BALL } from '../../config/gameplay.js';
import { DYE_COLORS } from './theme.js';

const RAIN = 90;

export function createParticles() {
  const items = []; // { x, y, vx, vy, life, maxLife, r, color, gravity }

  return {
    burst(x, y, kind, dye = 0) {
      const palette = kind === 'rainbow'
        ? DYE_COLORS.map((c) => c.hex)
        : kind === 'death'
          ? ['#ffffff', '#ff5d8f', '#c22a5f']
          : [DYE_COLORS[dye].hex, '#ffffff', DYE_COLORS[dye].deep];
      const count = kind === 'rainbow' ? 26 : kind === 'death' ? 20 : 12;
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = (kind === 'rainbow' ? 220 : kind === 'death' ? 300 : 180) * (0.4 + Math.random());
        items.push({
          x,
          y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp - (kind === 'death' ? 120 : 60),
          life: 0,
          maxLife: 0.5 + Math.random() * 0.5,
          r: 2 + Math.random() * 3.4,
          color: palette[Math.floor(Math.random() * palette.length)],
          gravity: kind === 'rainbow' ? 420 : 260,
        });
      }
    },

    rain(dye) {
      // 彩虹糖雨：整屏彩色糖粒下落（signature 时刻）
      for (let i = 0; i < RAIN; i += 1) {
        items.push({
          x: Math.random() * WORLD.WIDTH,
          y: -Math.random() * WORLD.HEIGHT * 0.5,
          vx: (Math.random() - 0.5) * 40,
          vy: 180 + Math.random() * 240,
          life: 0,
          maxLife: 2.4,
          r: 3 + Math.random() * 4,
          color: DYE_COLORS[Math.floor(Math.random() * DYE_COLORS.length)].hex,
          gravity: 60,
        });
      }
    },

    update(dt) {
      for (const p of items) {
        p.life += dt;
        p.vy += p.gravity * dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
      }
      for (let i = items.length - 1; i >= 0; i -= 1) {
        if (items[i].life >= items[i].maxLife || items[i].y > WORLD.HEIGHT + 30) items.splice(i, 1);
      }
    },

    draw(ctx) {
      for (const p of items) {
        const t = p.life / p.maxLife;
        ctx.globalAlpha = Math.max(0, 1 - t);
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * (1 - t * 0.5), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.globalAlpha = 1;
    },

    get size() { return items.length; },
  };
}
