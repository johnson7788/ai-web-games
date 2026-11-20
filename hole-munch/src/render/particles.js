// HOLE MUNCH · 粒子 / 碎块 / 震感涟漪（程序化）
// 签名瞬间：吞楼时楼体碎块旋转吸入 + 全屏震感涟漪（shockwave ring）。

export function createParticles() {
  const parts = [];   // {x,y,vx,vy,life,maxLife,size,color,spin,kind}
  const rings = [];   // {x,y,r,maxR,life,maxLife,color,width}

  return {
    get parts() { return parts; },
    get rings() { return rings; },

    // 普通吞物粒子：小碎屑被吸向洞中心
    burstSwallow(x, y, color, n = 6) {
      for (let i = 0; i < n; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 40 + Math.random() * 120;
        parts.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.5 + Math.random() * 0.3,
          maxLife: 0.8,
          size: 2 + Math.random() * 3,
          color,
          kind: 'shard',
          spin: Math.random() * 6 - 3,
        });
      }
    },

    // 吞楼签名：楼体碎块旋转吸入（更多、更大、带自旋）
    burstBuilding(x, y, color) {
      for (let i = 0; i < 22; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 80 + Math.random() * 260;
        parts.push({
          x: x + (Math.random() - 0.5) * 40,
          y: y + (Math.random() - 0.5) * 40,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0.7 + Math.random() * 0.5,
          maxLife: 1.2,
          size: 4 + Math.random() * 7,
          color: Math.random() < 0.5 ? color : '#ffffff',
          kind: 'debris',
          spin: Math.random() * 12 - 6,
        });
      }
      // 全屏震感涟漪
      rings.push({ x, y, r: 20, maxR: 520, life: 0.6, maxLife: 0.6, color: '#ffffff', width: 10 });
    },

    // 吞洞 / 被吞：大冲击
    burstHole(x, y, color) {
      rings.push({ x, y, r: 30, maxR: 420, life: 0.5, maxLife: 0.5, color, width: 14 });
      for (let i = 0; i < 16; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = 100 + Math.random() * 300;
        parts.push({
          x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
          life: 0.6, maxLife: 0.6, size: 3 + Math.random() * 5, color, kind: 'debris', spin: Math.random() * 8 - 4,
        });
      }
    },

    update(dt) {
      for (const p of parts) {
        p.life -= dt;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.96;
        p.vy *= 0.96;
      }
      for (let i = parts.length - 1; i >= 0; i -= 1) {
        if (parts[i].life <= 0) parts.splice(i, 1);
      }
      for (const r of rings) {
        r.life -= dt;
        const t = 1 - r.life / r.maxLife;
        r.r = r.maxR * (1 - (1 - t) * (1 - t)); // ease-out
      }
      for (let i = rings.length - 1; i >= 0; i -= 1) {
        if (rings[i].life <= 0) rings.splice(i, 1);
      }
    },

    draw(ctx) {
      // 震感涟漪
      for (const r of rings) {
        const a = Math.max(0, r.life / r.maxLife);
        ctx.save();
        ctx.globalAlpha = a * 0.7;
        ctx.strokeStyle = r.color;
        ctx.lineWidth = r.width * a;
        ctx.beginPath();
        ctx.arc(r.x, r.y, r.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
      // 碎块
      for (const p of parts) {
        const a = Math.max(0, p.life / p.maxLife);
        ctx.save();
        ctx.globalAlpha = a;
        ctx.fillStyle = p.color;
        ctx.translate(p.x, p.y);
        if (p.kind === 'debris') ctx.rotate(p.spin * (1 - a) * 2);
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
        ctx.restore();
      }
    },
  };
}
