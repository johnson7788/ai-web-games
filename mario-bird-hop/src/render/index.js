// Canvas 2D 渲染：霓虹街机风（程序化，零素材零外链）。
// 世界坐标 y=0 是关卡顶；屏幕坐标 = 世界坐标 + HUD_H，再减去相机 camX。
import { WORLD, LAYOUT } from '../../config/game.config.js';

const TILE = LAYOUT.TILE;
const VIEW_W = LAYOUT.VIEW_W;
const VIEW_H = LAYOUT.VIEW_H;
const HUD_H = LAYOUT.HUD_H;

const PALETTE = {
  bgTop: '#070a18',
  bgBot: '#0d1230',
  grid: 'rgba(0,229,255,0.07)',
  groundFill: '#121a38',
  groundEdge: '#00e5ff',
  platformFill: '#1a1240',
  platformEdge: '#ff3df0',
  boxFill: '#3a2c00',
  boxEdge: '#ffb300',
  spike: '#ff2e63',
  rock: '#b465ff',
  coin: '#ffd54a',
  star: '#ffe14d',
  magnet: '#4dd0ff',
  shield: '#64ffda',
  player: '#ff3df0',
  playerWing: '#00e5ff',
  monster: '#ff5a3c',
  flag: '#37ff7e',
  white: '#ffffff',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;
  let camX = 0;
  let bgPhase = 0;
  const particles = [];
  const popups = [];
  const reduced = typeof window !== 'undefined'
    && window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function resize() {
    dpr = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
    canvas.width = WORLD.WIDTH * dpr;
    canvas.height = WORLD.HEIGHT * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
  resize();
  if (typeof window !== 'undefined') window.addEventListener('resize', resize);

  function glow(color, blur = 12) {
    ctx.shadowColor = color;
    ctx.shadowBlur = blur;
  }
  function noGlow() {
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
  }

  function worldX(x) { return x - camX; }
  function worldY(y) { return y + HUD_H; }

  function drawBackground() {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, PALETTE.bgTop);
    g.addColorStop(1, PALETTE.bgBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 视差星空
    if (!reduced) {
      ctx.fillStyle = 'rgba(255,255,255,0.6)';
      for (let i = 0; i < 40; i += 1) {
        const sx = ((i * 173) % WORLD.WIDTH) - camX * 0.15 % WORLD.WIDTH;
        const sy = (i * 97) % (WORLD.HEIGHT - HUD_H) + HUD_H;
        const tw = 0.4 + (i % 3) * 0.3;
        ctx.globalAlpha = 0.3 + (i % 4) * 0.18;
        ctx.fillRect(((sx % WORLD.WIDTH) + WORLD.WIDTH) % WORLD.WIDTH, sy, tw * 2, tw * 2);
      }
      ctx.globalAlpha = 1;
    }

    // 地平网格（霓虹透视感）
    ctx.strokeStyle = PALETTE.grid;
    ctx.lineWidth = 1;
    for (let r = 0; r <= 14; r += 1) {
      const y = HUD_H + r * (VIEW_H / 14);
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD.WIDTH, y);
      ctx.stroke();
    }
    for (let c = 0; c < 40; c += 1) {
      const x = ((c * 60) - camX * 0.3 % 60 + WORLD.WIDTH) % WORLD.WIDTH;
      ctx.beginPath();
      ctx.moveTo(x, HUD_H);
      ctx.lineTo(x, WORLD.HEIGHT);
      ctx.stroke();
    }
  }

  function drawTile(x, y, fill, edge) {
    ctx.fillStyle = fill;
    ctx.fillRect(worldX(x), worldY(y), TILE, TILE);
    ctx.fillStyle = edge;
    ctx.fillRect(worldX(x), worldY(y), TILE, 3);
  }

  function drawBox(x, y, t) {
    const bx = worldX(x);
    const by = worldY(y);
    glow(PALETTE.boxEdge, 10);
    ctx.fillStyle = PALETTE.boxFill;
    ctx.fillRect(bx + 3, by + 3, TILE - 6, TILE - 6);
    ctx.strokeStyle = PALETTE.boxEdge;
    ctx.lineWidth = 2;
    ctx.strokeRect(bx + 4, by + 4, TILE - 8, TILE - 8);
    noGlow();
    // 「?」铭牌
    ctx.fillStyle = PALETTE.boxEdge;
    ctx.font = 'bold 22px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('?', bx + TILE / 2, by + TILE / 2 + 1);
  }

  function drawSpike(x, y) {
    const bx = worldX(x);
    const by = worldY(y);
    glow(PALETTE.spike, 10);
    ctx.fillStyle = PALETTE.spike;
    ctx.beginPath();
    ctx.moveTo(bx + 3, by + TILE);
    ctx.lineTo(bx + TILE / 2, by + 3);
    ctx.lineTo(bx + TILE - 3, by + TILE);
    ctx.closePath();
    ctx.fill();
    noGlow();
  }

  function drawRock(x, y, top) {
    const bx = worldX(x);
    const by = worldY(y);
    const h = top ? TILE : TILE;
    glow(PALETTE.rock, 8);
    ctx.fillStyle = '#2a1650';
    ctx.beginPath();
    ctx.arc(bx + TILE / 2, by + (top ? TILE : TILE / 2), TILE * 0.62, Math.PI, 0);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = PALETTE.rock;
    ctx.lineWidth = 2;
    ctx.stroke();
    noGlow();
    // 裂纹
    ctx.strokeStyle = PALETTE.rock;
    ctx.beginPath();
    ctx.moveTo(bx + TILE * 0.3, by + h * 0.6);
    ctx.lineTo(bx + TILE * 0.5, by + h * 0.8);
    ctx.lineTo(bx + TILE * 0.7, by + h * 0.62);
    ctx.stroke();
  }

  function drawFlag(x, y, h) {
    const fx = worldX(x);
    const fy = worldY(y);
    // 杆
    ctx.fillStyle = '#c9d1ff';
    ctx.fillRect(fx + TILE / 2 - 2, fy, 4, h);
    // 旗
    glow(PALETTE.flag, 14);
    ctx.fillStyle = PALETTE.flag;
    ctx.beginPath();
    ctx.moveTo(fx + TILE / 2, fy + 4);
    ctx.lineTo(fx + TILE / 2 + 22, fy + 12);
    ctx.lineTo(fx + TILE / 2, fy + 22);
    ctx.closePath();
    ctx.fill();
    noGlow();
  }

  function drawCoin(x, y, t) {
    const cx = worldX(x);
    const cy = worldY(y);
    const pulse = 1 + Math.sin(t * 5) * 0.08;
    glow(PALETTE.coin, 12);
    ctx.fillStyle = PALETTE.coin;
    ctx.beginPath();
    ctx.arc(cx, cy, 9 * pulse, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8a6d00';
    ctx.beginPath();
    ctx.arc(cx, cy, 4 * pulse, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
  }

  function drawStar(x, y, t) {
    const sx = worldX(x);
    const sy = worldY(y);
    const rot = t * 1.2;
    glow(PALETTE.star, 14);
    ctx.fillStyle = PALETTE.star;
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(rot);
    ctx.beginPath();
    for (let i = 0; i < 10; i += 1) {
      const rr = i % 2 === 0 ? 13 : 6;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
    }
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    noGlow();
  }

  function drawPowerup(x, y, kind, t) {
    const px = worldX(x);
    const py = worldY(y);
    if (kind === 'magnet') {
      glow(PALETTE.magnet, 12);
      ctx.strokeStyle = PALETTE.magnet;
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(px - 4, py, 8, Math.PI / 2, Math.PI * 1.5);
      ctx.arc(px + 4, py, 8, Math.PI * 1.5, Math.PI / 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.white;
      ctx.fillRect(px - 7, py - 3, 4, 6);
      ctx.fillRect(px + 3, py - 3, 4, 6);
    } else {
      glow(PALETTE.shield, 12);
      ctx.strokeStyle = PALETTE.shield;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(px, py, 11, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = PALETTE.shield;
      ctx.font = 'bold 13px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('S', px, py + 1);
    }
    noGlow();
  }

  function drawPlayer(p, t) {
    const cx = worldX(p.x + p.w / 2);
    const cy = worldY(p.y + p.h / 2);
    const flap = p.onGround ? 0 : Math.sin(t * 22) * 0.5;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(p.facing || 1, 1);
    glow(PALETTE.player, 16);
    // 身体
    ctx.fillStyle = PALETTE.player;
    ctx.beginPath();
    ctx.ellipse(0, 0, 16, 15, 0, 0, Math.PI * 2);
    ctx.fill();
    // 翅膀
    ctx.fillStyle = PALETTE.playerWing;
    ctx.save();
    ctx.rotate(flap);
    ctx.beginPath();
    ctx.ellipse(-6, -6, 9, 5, -0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    // 喙
    ctx.fillStyle = '#ffb300';
    ctx.beginPath();
    ctx.moveTo(12, -2);
    ctx.lineTo(22, 2);
    ctx.lineTo(12, 6);
    ctx.closePath();
    ctx.fill();
    // 眼睛
    ctx.fillStyle = PALETTE.white;
    ctx.beginPath();
    ctx.arc(5, -5, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(7, -5, 2.2, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
    ctx.restore();
    // 护盾光环
    if (p.shield) {
      glow(PALETTE.shield, 14);
      ctx.strokeStyle = PALETTE.shield;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(worldX(p.x + p.w / 2), worldY(p.y + p.h / 2), 24 + Math.sin(t * 6) * 2, 0, Math.PI * 2);
      ctx.stroke();
      noGlow();
    }
  }

  function drawMonster(m, t) {
    const cx = worldX(m.x + m.w / 2);
    const cy = worldY(m.y + m.h / 2);
    const wob = Math.sin(t * 8 + m.x) * 1.5;
    glow(PALETTE.monster, 14);
    ctx.fillStyle = PALETTE.monster;
    ctx.beginPath();
    ctx.ellipse(cx, cy + wob, 17, 14, 0, 0, Math.PI * 2);
    ctx.fill();
    // 眼睛
    ctx.fillStyle = '#fff';
    ctx.beginPath();
    ctx.arc(cx - 6, cy - 3 + wob, 4, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - 3 + wob, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath();
    ctx.arc(cx - 6 + m.dir * 1.5, cy - 3 + wob, 2, 0, Math.PI * 2);
    ctx.arc(cx + 6 + m.dir * 1.5, cy - 3 + wob, 2, 0, Math.PI * 2);
    ctx.fill();
    noGlow();
  }

  function drawParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 300 * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      glow(p.color, 8);
      ctx.fillStyle = p.color;
      ctx.fillRect(worldX(p.x), worldY(p.y), p.size, p.size);
      noGlow();
      ctx.globalAlpha = 1;
    }
  }

  function drawPopups(dt) {
    for (let i = popups.length - 1; i >= 0; i -= 1) {
      const p = popups[i];
      p.life -= dt;
      if (p.life <= 0) { popups.splice(i, 1); continue; }
      p.y -= 40 * dt;
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.font = 'bold 16px monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      glow(p.color, 8);
      ctx.fillText(p.text, worldX(p.x), worldY(p.y));
      noGlow();
      ctx.globalAlpha = 1;
    }
  }

  function spawnBurst(x, y, color, n = 8) {
    for (let i = 0; i < n; i += 1) {
      const a = (Math.PI * 2 * i) / n;
      particles.push({
        x, y, vx: Math.cos(a) * 90, vy: Math.sin(a) * 90 - 40,
        size: 3, life: 0.5, maxLife: 0.5, color,
      });
    }
  }

  function fx(ev, st) {
    if (reduced) return;
    const p = st && st.player;
    if (!p) return;
    const px = p.x + p.w / 2;
    const py = p.y + p.h;
    switch (ev.type) {
      case 'jump':
        for (let i = 0; i < 5; i += 1) {
          particles.push({ x: px, y: py, vx: -40 + Math.random() * 80, vy: -20 + Math.random() * 40, size: 3, life: 0.3, maxLife: 0.3, color: PALETTE.grid });
        }
        break;
      case 'land':
        for (let i = 0; i < 4; i += 1) {
          particles.push({ x: px + (Math.random() - 0.5) * 20, y: py, vx: -50 + Math.random() * 100, vy: -30 - Math.random() * 40, size: 3, life: 0.35, maxLife: 0.35, color: PALETTE.white });
        }
        break;
      case 'coin':
        spawnBurst(px, p.y, PALETTE.coin, 6);
        addPopup('+' + (10 * (st.combo || 1)), px, p.y, PALETTE.coin);
        break;
      case 'star':
        spawnBurst(px, p.y, PALETTE.star, 12);
        addPopup('+100', px, p.y, PALETTE.star);
        break;
      case 'box':
        spawnBurst(px, p.y, PALETTE.boxEdge, 14);
        break;
      case 'stomp':
        spawnBurst(px, p.y, PALETTE.monster, 12);
        addPopup('+50', px, p.y, PALETTE.monster);
        break;
      case 'shield':
        addPopup('SHIELD', px, p.y - 20, PALETTE.shield);
        break;
      case 'magnet':
        addPopup('MAGNET', px, p.y - 20, PALETTE.magnet);
        break;
      case 'combo':
        if (ev.combo >= 2) addPopup('COMBO ×' + ev.combo, px, p.y - 30, PALETTE.playerWing);
        break;
      case 'hurt':
        addPopup('SHIELD DOWN', px, p.y - 20, PALETTE.monster);
        break;
      default:
        break;
    }
  }

  function addPopup(text, x, y, color) {
    popups.push({ text, x, y, color, life: 0.8, maxLife: 0.8 });
  }

  function draw(state, dt, view = {}) {
    bgPhase += dt;
    const levelW = state ? state.levelWidth : WORLD.WIDTH;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const shakeX = view.shake ? (Math.random() - 0.5) * view.shake : 0;
    const shakeY = view.shake ? (Math.random() - 0.5) * view.shake : 0;
    ctx.save();
    ctx.translate(shakeX, shakeY);

    drawBackground();

    if (state && state.player) {
      camX = Math.max(0, Math.min(levelW - VIEW_W, state.player.x + state.player.w / 2 - VIEW_W / 2));
    }

    // 目标方向指示（旗在屏外时提示）
    if (state && state.flagRect && state.phase === 'playing') {
      const flagCenterX = state.flagRect.x + state.flagRect.w / 2;
      if (flagCenterX > camX + VIEW_W) {
        drawGoalArrow();
      }
    }

    // 世界
    ctx.save();
    ctx.translate(0, HUD_H);
    drawWorld(state, dt);
    ctx.restore();

    drawParticles(dt);
    drawPopups(dt);

    ctx.restore();
  }

  function drawGoalArrow() {
    const x = WORLD.WIDTH - 30;
    const y = HUD_H + 40;
    glow(PALETTE.flag, 10);
    ctx.fillStyle = PALETTE.flag;
    ctx.beginPath();
    ctx.moveTo(x + 12, y);
    ctx.lineTo(x - 4, y - 9);
    ctx.lineTo(x - 4, y + 9);
    ctx.closePath();
    ctx.fill();
    noGlow();
  }

  function drawWorld(state, dt) {
    if (!state) return;
    const t = state.time;

    // 地面与平台
    for (const key of state.levelSolidKeys || []) {
      const [r, c] = key.split(',').map(Number);
      drawTile(c * TILE, r * TILE, r >= 13 ? PALETTE.groundFill : PALETTE.platformFill,
        r >= 13 ? PALETTE.groundEdge : PALETTE.platformEdge);
    }

    // 箱子
    for (const b of state.boxes) if (b.alive) drawBox(b.c * TILE, b.r * TILE, t);

    // 尖刺 / 落岩
    for (const key of state.levelSpikeKeys || []) {
      const [r, c] = key.split(',').map(Number);
      drawSpike(c * TILE, r * TILE);
    }
    for (const key of state.levelRockKeys || []) {
      const [r, c] = key.split(',').map(Number);
      drawRock(c * TILE, r * TILE, r < 13);
    }

    // 终点旗
    if (state.flagRect) drawFlag(state.flagRect.x, state.flagRect.y, state.flagRect.h);

    // 金币 / 星星 / 道具
    for (const c of state.coins) if (!c.taken) drawCoin(c.x, c.y, t);
    for (const s of state.stars) if (!s.taken) drawStar(s.x, s.y, t);
    for (const p of state.powerups) if (!p.taken) drawPowerup(p.x, p.y, p.kind, t);

    // 怪物
    for (const m of state.monsters) if (m.alive) drawMonster(m, t);

    // 玩家
    if (state.player && state.phase !== 'won') drawPlayer(state.player, t);
  }

  return { draw, fx, addPopup, resize, getCamera: () => camX };
}
