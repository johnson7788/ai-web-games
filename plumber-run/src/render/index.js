// PLUMBER RUN · Canvas2D 渲染（纯程序化，零外链素材）
// 契约：createRender(canvas) → { draw(run, alpha), burst(x,y,kind), setShake(n) }
import { WORLD } from '../../config/game.config.js';
import { FORM } from '../../config/gameplay.js';
import { themeFor } from './theme.js';

const TILE = WORLD.TILE;
const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;
  let shakeT = 0;
  let t = 0;

  function themeOf(run) {
    return themeFor(run ? run.level : 1);
  }

  // ---------- 背景 ----------
  function drawBackground(run, th) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, th.skyTop);
    g.addColorStop(1, th.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 太阳 / 月亮
    ctx.save();
    ctx.fillStyle = th.sun;
    ctx.globalAlpha = 0.9;
    const sunX = W * 0.78, sunY = H * 0.26;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 52, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 0.25;
    ctx.beginPath();
    ctx.arc(sunX, sunY, 82, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 远景装饰（随主题构图不同：屋顶 / 管道 / 吊臂）
    ctx.save();
    ctx.fillStyle = th.farDecor;
    ctx.globalAlpha = 0.55;
    if (th.id === 'morning') {
      for (let i = 0; i < 6; i += 1) {
        const bx = ((i * 240 - run.cameraX * 0.2) % (W + 240) + W + 240) % (W + 240) - 120;
        ctx.fillRect(bx, H * 0.62, 150, H);
        ctx.beginPath();
        ctx.moveTo(bx - 20, H * 0.62);
        ctx.lineTo(bx + 75, H * 0.42);
        ctx.lineTo(bx + 170, H * 0.62);
        ctx.fill();
      }
    } else if (th.id === 'sewer') {
      for (let i = 0; i < 7; i += 1) {
        const px = ((i * 200 - run.cameraX * 0.3) % (W + 200) + W + 200) % (W + 200) - 100;
        ctx.fillRect(px, 0, 90, H);
        ctx.fillStyle = th.nearDecor;
        ctx.fillRect(px + 14, 0, 20, H);
        ctx.fillStyle = th.farDecor;
      }
    } else {
      for (let i = 0; i < 6; i += 1) {
        const bx = ((i * 260 - run.cameraX * 0.25) % (W + 260) + W + 260) % (W + 260) - 130;
        ctx.fillRect(bx, H * 0.5, 40, H);
        ctx.fillRect(bx + 46, H * 0.5, 8, H * 0.5);
        ctx.fillRect(bx - 30, H * 0.44, 110, 14);
      }
    }
    ctx.restore();
  }

  // ---------- 瓦片 ----------
  function drawTiles(run, th) {
    const c0 = Math.max(0, Math.floor(run.cameraX / TILE) - 1);
    const c1 = Math.min(run.width - 1, c0 + Math.ceil(W / TILE) + 2);
    for (let r = 0; r < run.height; r += 1) {
      for (let c = c0; c <= c1; c += 1) {
        const ch = run.grid[r][c];
        if (ch === '.') continue;
        const x = c * TILE, y = r * TILE;
        if (ch === '#') {
          drawGround(x, y, th);
        } else if (ch === '=') {
          drawGround(x, y, th);
        } else if (ch === 'B') {
          drawBrick(x, y, th);
        } else if (ch === '?') {
          drawBrick(x, y, th);
          ctx.fillStyle = th.question;
          ctx.font = 'bold 24px system-ui';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('?', x + TILE / 2, y + TILE / 2 + 1);
        } else if (ch === 'C') {
          drawBrick(x, y, th);
          ctx.fillStyle = '#ffd166';
          ctx.beginPath();
          ctx.arc(x + TILE / 2, y + TILE / 2, 9, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  function drawGround(x, y, th) {
    ctx.fillStyle = th.ground;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.fillStyle = th.groundDark;
    ctx.fillRect(x, y + TILE - 8, TILE, 8);
    ctx.strokeStyle = th.groundLine;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
  }

  function drawBrick(x, y, th) {
    ctx.fillStyle = th.brick;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = th.brickLine;
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 1, y + 1, TILE - 2, TILE - 2);
    ctx.beginPath();
    ctx.moveTo(x, y + TILE / 2);
    ctx.lineTo(x + TILE, y + TILE / 2);
    ctx.moveTo(x + TILE / 2, y);
    ctx.lineTo(x + TILE / 2, y + TILE / 2);
    ctx.moveTo(x + TILE / 2, y + TILE / 2);
    ctx.lineTo(x + TILE, y + TILE / 2);
    ctx.stroke();
  }

  // ---------- 金币 ----------
  function drawCoins(run) {
    const phase = Math.sin(t * 6) > 0 ? 1 : 0.35;
    for (const c of run.coinsList) {
      if (c.taken) continue;
      const x = c.x, y = c.y;
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(1, phase);
      ctx.fillStyle = '#ffd166';
      ctx.beginPath();
      ctx.arc(0, 0, 11, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#c98a1e';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.restore();
    }
  }

  // ---------- 尖刺 ----------
  function drawSpikes(run) {
    ctx.fillStyle = '#cfd2d6';
    ctx.strokeStyle = '#5b636b';
    for (const s of run.spikes) {
      const x = s.c * TILE, y = s.r * TILE;
      for (let i = 0; i < 3; i += 1) {
        const tx = x + i * (TILE / 3);
        ctx.beginPath();
        ctx.moveTo(tx, y + TILE);
        ctx.lineTo(tx + TILE / 6, y + TILE - 22);
        ctx.lineTo(tx + TILE / 3, y + TILE);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      }
    }
  }

  // ---------- 旗杆 ----------
  function drawFlag(run) {
    if (!run.flag) return;
    const x = run.flag.c * TILE, y = run.flag.r * TILE;
    ctx.fillStyle = '#e8e4da';
    ctx.fillRect(x + TILE / 2 - 4, y - 3 * TILE, 8, 4 * TILE);
    ctx.fillStyle = '#ff6b57';
    const wave = Math.sin(t * 4) * 4;
    ctx.beginPath();
    ctx.moveTo(x + TILE / 2 + 4, y - 3 * TILE);
    ctx.lineTo(x + TILE / 2 + 44, y - 3 * TILE + 18 + wave);
    ctx.lineTo(x + TILE / 2 + 4, y - 3 * TILE + 36);
    ctx.closePath();
    ctx.fill();
  }

  // ---------- 拾取道具 ----------
  function drawPickups(run) {
    for (const pk of run.pickups) {
      const x = pk.x, y = pk.y;
      ctx.save();
      ctx.translate(x, y);
      if (pk.kind === 'M') {
        // 扳手包（橙盒 + 扳手图标）
        ctx.fillStyle = '#ffb347';
        ctx.fillRect(-13, -10, 26, 20);
        ctx.strokeStyle = '#7a4a12';
        ctx.lineWidth = 2;
        ctx.strokeRect(-13, -10, 26, 20);
        ctx.strokeStyle = '#7a4a12';
        ctx.beginPath();
        ctx.moveTo(-6, 0); ctx.lineTo(6, -4); ctx.lineTo(6, 4); ctx.closePath();
        ctx.stroke();
      } else if (pk.kind === 'F') {
        // 蒸汽齿轮（青绿齿轮）
        ctx.fillStyle = '#43e0b0';
        ctx.beginPath();
        ctx.arc(0, 0, 12, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#0a4c42';
        for (let i = 0; i < 6; i += 1) {
          const a = (i / 6) * Math.PI * 2 + t;
          ctx.fillRect(Math.cos(a) * 12 - 2, Math.sin(a) * 12 - 2, 4, 4);
        }
      } else if (pk.kind === 'S') {
        // 蒸汽罐（青蓝罐 + 冒汽）
        ctx.fillStyle = '#5ad0e0';
        ctx.fillRect(-10, -12, 20, 24);
        ctx.fillStyle = '#2a90a0';
        ctx.fillRect(-10, -12, 20, 6);
        ctx.strokeStyle = '#134a54';
        ctx.lineWidth = 2;
        ctx.strokeRect(-10, -12, 20, 24);
        ctx.fillStyle = 'rgba(200,255,255,0.7)';
        ctx.beginPath();
        ctx.arc(0, -16, 3 + Math.sin(t * 6) * 1.5, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  // ---------- 敌人（管道怪兽） ----------
  function drawEnemies(run) {
    for (const e of run.enemies) {
      if (!e.alive && e.squash <= 0) continue;
      const x = e.x, y = e.y;
      ctx.save();
      ctx.translate(x, y);
      if (!e.alive) {
        ctx.scale(1, 0.35);
        ctx.translate(0, e.h * 0.9);
      }
      // 身体（管道段 + 眼睛）
      ctx.fillStyle = '#5aa03c';
      ctx.fillRect(-e.w / 2, -e.h, e.w, e.h);
      ctx.fillStyle = '#3f7c2c';
      ctx.fillRect(-e.w / 2, -e.h, e.w, 8);
      ctx.fillStyle = '#d97742';
      ctx.fillRect(-e.w / 2 + 5, -e.h + 12, e.w - 10, 6);
      // 眼睛
      ctx.fillStyle = '#fff';
      const ex = e.dir > 0 ? 6 : -6;
      ctx.beginPath();
      ctx.arc(ex, -e.h * 0.6, 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#222';
      ctx.beginPath();
      ctx.arc(ex + e.dir * 2, -e.h * 0.6, 2.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  // ---------- 玩家（扳手师傅阿扳） ----------
  function drawPlayer(run) {
    const p = run.player;
    if (run.phase !== 'playing') return;
    const x = p.x, y = p.y;
    if (p.invuln > 0 && Math.floor(t * 12) % 2 === 0) ctx.globalAlpha = 0.4;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(p.dir, 1);

    const big = p.form !== FORM.SMALL;
    const h = p.h;
    const w = p.w;
    const bodyColor = p.form === FORM.FIRE ? '#ffb347' : '#2e86ab'; // 青蓝工装，与暖色背景高对比
    const capColor = p.form === FORM.FIRE ? '#e0503a' : '#ff8a3d';
    const outline = '#12263a';

    // 亮色轮廓底（提高剪影对比，眯眼也能从背景里认出玩家）
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.beginPath();
    ctx.arc(0, -h / 2, w / 2 + 7, 0, Math.PI * 2);
    ctx.fill();

    // 腿
    ctx.fillStyle = '#24344a';
    ctx.fillRect(-w / 2 + 2, -h + 12, 8, h - 12);
    ctx.fillRect(w / 2 - 10, -h + 12, 8, h - 12);
    // 身体（背带工装）
    ctx.fillStyle = bodyColor;
    ctx.fillRect(-w / 2, -h, w, h - 12);
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    ctx.strokeRect(-w / 2, -h, w, h - 12);
    // 背带
    ctx.fillStyle = '#ff8a3d';
    ctx.fillRect(-w / 2 + 4, -h + 2, 4, h - 16);
    ctx.fillRect(w / 2 - 8, -h + 2, 4, h - 16);
    // 头（安全帽 + 脸）
    ctx.fillStyle = '#f6d3a8';
    const headR = big ? 13 : 11;
    ctx.beginPath();
    ctx.arc(0, -h - headR + 6, headR, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = outline;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = capColor;
    ctx.beginPath();
    ctx.arc(0, -h - headR + 3, headR + 2, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(-headR - 2, -h - headR + 1, headR * 2 + 4, 4);
    // 护目镜
    ctx.fillStyle = '#dff4ff';
    ctx.fillRect(2, -h - headR + 4, 9, 5);

    // 火力态：蒸汽喷射
    if (p.form === FORM.FIRE && !p.onGround && p.vy > 0) {
      ctx.fillStyle = 'rgba(200,255,255,0.7)';
      for (let i = 0; i < 3; i += 1) {
        ctx.beginPath();
        ctx.arc(-6, 4 + i * 6 + Math.sin(t * 20 + i) * 2, 5 - i, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  // ---------- 扳手 ----------
  function drawWrench(run) {
    const w = run.wrench;
    if (!w) return;
    ctx.save();
    ctx.translate(w.x, w.y);
    ctx.rotate(t * 18 * (w.returning ? -1 : 1));
    ctx.strokeStyle = '#e8e4da';
    ctx.lineWidth = 5;
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.lineTo(9, 0);
    ctx.stroke();
    ctx.strokeStyle = '#b9b2a4';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(-10, 0, 5, Math.PI * 0.5, Math.PI * 1.5);
    ctx.arc(10, 0, 5, -Math.PI * 0.5, Math.PI * 0.5);
    ctx.stroke();
    ctx.restore();
  }

  // ---------- 粒子 ----------
  function drawParticles(run, dt) {
    for (const pt of run.particles) {
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
      pt.vy += 500 * dt;
      pt.life -= dt;
      ctx.globalAlpha = Math.max(0, pt.life / 0.5);
      ctx.fillStyle = pt.color;
      ctx.fillRect(pt.x - pt.size / 2, pt.y - pt.size / 2, pt.size, pt.size);
    }
    run.particles = run.particles.filter((pt) => pt.life > 0);
    ctx.globalAlpha = 1;
  }

  // ---------- 暗关聚光 ----------
  function drawDarkness(run) {
    const p = run.player;
    ctx.save();
    ctx.fillStyle = 'rgba(3,8,12,0.74)';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'destination-out';
    const sx = p.x - run.cameraX;
    const sy = p.y - p.h / 2;
    let g = ctx.createRadialGradient(sx, sy, 14, sx, sy, 210);
    g.addColorStop(0, 'rgba(0,0,0,1)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(sx, sy, 210, 0, Math.PI * 2);
    ctx.fill();
    if (run.wrench) {
      const wx = run.wrench.x - run.cameraX;
      const wy = run.wrench.y;
      g = ctx.createRadialGradient(wx, wy, 4, wx, wy, 70);
      g.addColorStop(0, 'rgba(0,0,0,1)');
      g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(wx, wy, 70, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  return {
    burst() {},
    setShake(n) { shakeT = Math.max(shakeT, n || 0); },

    draw(run, alpha) {
      t += 1 / 60;
      const th = themeOf(run);
      const dt = 1 / 60;
      ctx.clearRect(0, 0, W, H);

      if (!run) {
        drawBackground({ cameraX: 0 }, th);
        return;
      }

      // 震屏
      ctx.save();
      if (shakeT > 0) {
        ctx.translate((Math.random() - 0.5) * shakeT, (Math.random() - 0.5) * shakeT);
        shakeT = Math.max(0, shakeT - 1.5);
      }

      drawBackground(run, th);

      ctx.save();
      ctx.translate(-Math.round(run.cameraX), 0);
      drawTiles(run, th);
      drawFlag(run);
      drawSpikes(run);
      drawCoins(run);
      drawPickups(run);
      drawEnemies(run);
      drawWrench(run);
      drawPlayer(run);
      drawParticles(run, dt);
      ctx.restore();

      if (run.level === 7) drawDarkness(run);

      ctx.restore();
    },
  };
}
