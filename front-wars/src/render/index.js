// Canvas 2D：俯视角工业战场、士兵、弹道、过载点、训练靶、命中特效。
import { WORLD, ARENA, WALLS, LOADOUTS, RULES, COLORS } from '../../config/game.config.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  let time = 0;
  let shake = 0;
  let hitMarker = 0;
  const sparks = [];
  const texts = [];
  const flashes = [];

  function clearEffects() { sparks.length = 0; texts.length = 0; flashes.length = 0; shake = 0; hitMarker = 0; }
  function flash(amount = 0.18) { shake = Math.max(shake, amount); }
  function addSpark(x, y, color, count = 8) {
    for (let i = 0; i < count; i += 1) {
      sparks.push({
        x, y,
        vx: (Math.random() - 0.5) * 280,
        vy: (Math.random() - 0.5) * 280,
        life: 0.25 + Math.random() * 0.25,
        max: 0.5,
        color,
        size: 2 + Math.random() * 3,
      });
    }
  }
  function addText(x, y, text, color = '#fff') {
    texts.push({ x, y, text, color, life: 0.7, max: 0.7 });
  }
  function muzzle(x, y, angle, color = '#fde68a') {
    flashes.push({ x, y, angle, life: 0.07, max: 0.07, color });
  }
  function markHit() { hitMarker = 0.18; }

  function update(dt) {
    time += dt;
    shake = Math.max(0, shake - dt);
    hitMarker = Math.max(0, hitMarker - dt);
    for (let i = sparks.length - 1; i >= 0; i -= 1) {
      const s = sparks[i];
      s.life -= dt; s.x += s.vx * dt; s.y += s.vy * dt; s.vx *= 0.94; s.vy *= 0.94;
      if (s.life <= 0) sparks.splice(i, 1);
    }
    for (let i = texts.length - 1; i >= 0; i -= 1) {
      texts[i].life -= dt; texts[i].y -= 34 * dt;
      if (texts[i].life <= 0) texts.splice(i, 1);
    }
    for (let i = flashes.length - 1; i >= 0; i -= 1) {
      flashes[i].life -= dt;
      if (flashes[i].life <= 0) flashes.splice(i, 1);
    }
  }

  function drawFloor(run) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, '#0b1114');
    g.addColorStop(0.55, '#101a1d');
    g.addColorStop(1, '#070d10');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 战场地面
    const fg = ctx.createLinearGradient(ARENA.x0, ARENA.y0, ARENA.x0, ARENA.y1);
    fg.addColorStop(0, '#33413f');
    fg.addColorStop(1, '#202c2c');
    ctx.fillStyle = fg;
    ctx.fillRect(ARENA.x0, ARENA.y0, ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0);

    // 沥青格子 + 车道
    ctx.strokeStyle = 'rgba(255,255,255,0.045)';
    ctx.lineWidth = 1;
    for (let x = ARENA.x0; x <= ARENA.x1; x += 64) {
      ctx.beginPath(); ctx.moveTo(x, ARENA.y0); ctx.lineTo(x, ARENA.y1); ctx.stroke();
    }
    for (let y = ARENA.y0; y <= ARENA.y1; y += 64) {
      ctx.beginPath(); ctx.moveTo(ARENA.x0, y); ctx.lineTo(ARENA.x1, y); ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(251,191,36,0.18)';
    ctx.lineWidth = 3;
    ctx.setLineDash([18, 18]);
    ctx.beginPath(); ctx.moveTo(640, ARENA.y0 + 10); ctx.lineTo(640, ARENA.y1 - 10); ctx.stroke();
    ctx.setLineDash([]);

    // 出生区
    ctx.fillStyle = 'rgba(56,189,248,0.10)';
    ctx.fillRect(ARENA.x0, ARENA.y0, 110, ARENA.y1 - ARENA.y0);
    ctx.fillStyle = 'rgba(251,113,133,0.10)';
    ctx.fillRect(ARENA.x1 - 110, ARENA.y0, 110, ARENA.y1 - ARENA.y0);
    ctx.strokeStyle = 'rgba(56,189,248,0.45)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(ARENA.x0 + 110, ARENA.y0); ctx.lineTo(ARENA.x0 + 110, ARENA.y1); ctx.stroke();
    ctx.strokeStyle = 'rgba(251,113,133,0.45)';
    ctx.beginPath(); ctx.moveTo(ARENA.x1 - 110, ARENA.y0); ctx.lineTo(ARENA.x1 - 110, ARENA.y1); ctx.stroke();

    // 中央过载点底座
    ctx.strokeStyle = 'rgba(251,191,36,0.22)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(640, 390, 52, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([6, 10]);
    ctx.beginPath(); ctx.arc(640, 390, 70, 0, Math.PI * 2); ctx.stroke();
    ctx.setLineDash([]);

    // 边界
    ctx.strokeStyle = '#5f7476';
    ctx.lineWidth = 5;
    ctx.strokeRect(ARENA.x0, ARENA.y0, ARENA.x1 - ARENA.x0, ARENA.y1 - ARENA.y0);

    // 危险条纹
    for (let i = 0; i < 9; i += 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(ARENA.x0 + 10 + i * 24, ARENA.y0 - 8, 14, 8);
      ctx.clip();
      ctx.strokeStyle = i % 2 ? '#fbbf24' : '#1b272a';
      ctx.lineWidth = 8;
      ctx.beginPath(); ctx.moveTo(ARENA.x0, ARENA.y0 - 12); ctx.lineTo(ARENA.x0 + 60, ARENA.y0 + 6); ctx.stroke();
      ctx.restore();
    }
  }

  function drawWalls() {
    for (const w of WALLS) {
      ctx.fillStyle = 'rgba(0,0,0,0.30)';
      roundRect(ctx, w.x + 5, w.y + 7, w.w, w.h, 5); ctx.fill();
      const g = ctx.createLinearGradient(w.x, w.y, w.x, w.y + w.h);
      g.addColorStop(0, COLORS.wallTop);
      g.addColorStop(0.18, COLORS.wall);
      g.addColorStop(1, '#2d3b3d');
      ctx.fillStyle = g;
      roundRect(ctx, w.x, w.y, w.w, w.h, 4); ctx.fill();
      ctx.strokeStyle = COLORS.wallEdge;
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // 铆钉/磨损
      ctx.fillStyle = 'rgba(255,255,255,0.22)';
      for (let x = w.x + 8; x < w.x + w.w - 4; x += 18) {
        ctx.fillRect(x, w.y + 5, 3, 3);
        ctx.fillRect(x, w.y + w.h - 8, 3, 3);
      }
      ctx.fillStyle = 'rgba(0,0,0,0.18)';
      ctx.fillRect(w.x + 4, w.y + w.h - 5, w.w - 8, 3);
    }
  }

  function drawPickup(run) {
    const pk = run.pickup;
    if (!pk?.active) return;
    const pulse = 1 + Math.sin(time * 6) * 0.08;
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.shadowColor = '#fbbf24';
    ctx.shadowBlur = 22;
    ctx.fillStyle = 'rgba(251,191,36,0.18)';
    ctx.beginPath(); ctx.arc(0, 0, 28 * pulse, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.rotate(time * 0.6);
    ctx.fillStyle = '#1e293b';
    roundRect(ctx, -14, -14, 28, 28, 6); ctx.fill();
    ctx.strokeStyle = '#fbbf24'; ctx.lineWidth = 2; ctx.stroke();
    ctx.restore();
    ctx.save();
    ctx.translate(pk.x, pk.y);
    ctx.fillStyle = '#fde68a';
    ctx.font = `900 18px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('⚡', 0, 1);
    ctx.restore();
  }

  function drawSoldier(p, isMe) {
    const load = LOADOUTS[p.loadout] || LOADOUTS.rifleman;
    const teamColor = p.team === 0 ? COLORS.blue : COLORS.red;
    const dark = p.team === 0 ? COLORS.blueDark : COLORS.redDark;
    const r = p.radius;
    ctx.save();
    ctx.translate(p.x, p.y);
    // 影子
    ctx.fillStyle = 'rgba(0,0,0,0.38)';
    ctx.beginPath(); ctx.ellipse(3, r * 0.75, r * 1.05, r * 0.44, 0, 0, Math.PI * 2); ctx.fill();
    // 冲刺残影
    if (p.dashT > 0) {
      ctx.globalAlpha = 0.35;
      ctx.fillStyle = teamColor;
      ctx.beginPath(); ctx.arc(-Math.cos(p.aim) * 14, -Math.sin(p.aim) * 14, r * 0.9, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // 过载光环
    if (p.overdriveT > 0) {
      ctx.strokeStyle = `rgba(251,191,36,${0.5 + Math.sin(time * 14) * 0.2})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, r + 6, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.rotate(p.aim);
    // 枪
    ctx.fillStyle = '#cbd5e1';
    roundRect(ctx, r - 2, -3.5, r + 14, 7, 2); ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.fillRect(r + 5, -2, 6, 4);
    // 身体
    ctx.fillStyle = teamColor;
    ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = dark; ctx.lineWidth = 3; ctx.stroke();
    // 头盔
    ctx.fillStyle = load.color;
    ctx.beginPath(); ctx.arc(-2, 0, r * 0.58, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = dark;
    ctx.beginPath(); ctx.arc(3, 0, r * 0.26, 0, Math.PI * 2); ctx.fill();
    // 队伍箭头
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.moveTo(r * 0.95, 0); ctx.lineTo(r * 0.55, -5); ctx.lineTo(r * 0.55, 5); ctx.closePath(); ctx.fill();
    ctx.restore();

    // 外圈/名字/血条
    if (isMe) {
      ctx.strokeStyle = 'rgba(255,255,255,0.9)';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(p.x, p.y, r + 5, 0, Math.PI * 2); ctx.stroke();
    }
    const bw = isMe ? 44 : 34;
    const frac = Math.max(0, p.hp / p.maxHp);
    ctx.fillStyle = 'rgba(0,0,0,0.62)';
    ctx.fillRect(p.x - bw / 2, p.y - r - 13, bw, 5);
    ctx.fillStyle = frac > 0.4 ? '#4ade80' : '#f87171';
    ctx.fillRect(p.x - bw / 2, p.y - r - 13, bw * frac, 5);
    ctx.font = `800 ${isMe ? 10 : 9}px ${FONT}`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillStyle = isMe ? '#fff' : 'rgba(255,255,255,0.7)';
    ctx.fillText(isMe ? 'YOU' : p.name, p.x, p.y - r - 17);
  }

  function drawDummy(p, step) {
    ctx.save();
    ctx.translate(p.x, p.y);
    if (step >= 1 && step <= 2) {
      ctx.strokeStyle = `rgba(251,191,36,${0.55 + Math.sin(time * 5) * 0.25})`;
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(0, 0, p.radius + 12, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.beginPath(); ctx.ellipse(2, 14, 22, 8, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = '#f43f5e'; ctx.lineWidth = 4; ctx.stroke();
    for (const rr of [13, 7, 2]) {
      ctx.strokeStyle = rr === 2 ? '#f43f5e' : '#64748b';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, rr, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.fillStyle = '#f43f5e';
    ctx.font = `900 12px ${FONT}`; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
    ctx.fillText('TARGET', 0, -p.radius - 8);
    ctx.restore();
  }

  function drawBullets(run) {
    for (const b of run.bullets) {
      const col = b.team === 0 ? 'rgba(125,211,252,0.55)' : 'rgba(253,164,175,0.55)';
      ctx.strokeStyle = col;
      ctx.lineWidth = 2.2;
      ctx.beginPath(); ctx.moveTo(b.x - b.vx * 0.018, b.y - b.vy * 0.018); ctx.lineTo(b.x, b.y); ctx.stroke();
      ctx.fillStyle = '#fef3c7';
      ctx.beginPath(); ctx.arc(b.x, b.y, 3, 0, Math.PI * 2); ctx.fill();
    }
    for (const f of flashes) {
      ctx.save();
      ctx.globalAlpha = f.life / f.max;
      ctx.translate(f.x, f.y);
      ctx.rotate(f.angle);
      ctx.fillStyle = f.color;
      ctx.beginPath(); ctx.moveTo(0, -4); ctx.lineTo(18, 0); ctx.lineTo(0, 4); ctx.closePath(); ctx.fill();
      ctx.restore();
    }
    for (const s of sparks) {
      ctx.globalAlpha = Math.max(0, s.life / s.max);
      ctx.fillStyle = s.color;
      ctx.fillRect(s.x - s.size / 2, s.y - s.size / 2, s.size, s.size);
      ctx.globalAlpha = 1;
    }
    for (const t of texts) {
      ctx.globalAlpha = Math.max(0, t.life / t.max);
      ctx.font = `900 14px ${FONT}`;
      ctx.textAlign = 'center';
      ctx.fillStyle = t.color;
      ctx.fillText(t.text, t.x, t.y);
      ctx.globalAlpha = 1;
    }
  }

  function drawCrosshair(mouse, run) {
    if (!mouse || run?.tutorial) return;
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(mouse.x, mouse.y, 9, 0, Math.PI * 2); ctx.stroke();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      ctx.beginPath();
      ctx.moveTo(mouse.x + dx * 13, mouse.y + dy * 13);
      ctx.lineTo(mouse.x + dx * 19, mouse.y + dy * 19);
      ctx.stroke();
    }
    if (hitMarker > 0) {
      ctx.strokeStyle = `rgba(251,191,36,${hitMarker / 0.18})`;
      ctx.lineWidth = 3;
      for (const [dx, dy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]]) {
        ctx.beginPath();
        ctx.moveTo(mouse.x + dx * 7, mouse.y + dy * 7);
        ctx.lineTo(mouse.x + dx * 14, mouse.y + dy * 14);
        ctx.stroke();
      }
    }
  }

  function drawTutorial(run, step) {
    if (!run?.tutorial || step >= 4) return;
    const me = run.players[0];
    const dummy = run.players[1];
    if (step === 0) {
      ctx.strokeStyle = 'rgba(251,191,36,0.9)';
      ctx.lineWidth = 3;
      ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.arc(me.x + 110, me.y, 34, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fbbf24';
      ctx.font = `900 12px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('MOVE', me.x + 110, me.y + 4);
    } else if (step === 1 || step === 2) {
      if (dummy?.alive) {
        ctx.strokeStyle = 'rgba(251,191,36,0.95)';
        ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(dummy.x, dummy.y, 38, 0, Math.PI * 2); ctx.stroke();
        ctx.fillStyle = 'rgba(251,191,36,0.10)';
        ctx.beginPath(); ctx.arc(dummy.x, dummy.y, 38, 0, Math.PI * 2); ctx.fill();
        if (step === 2) {
          ctx.fillStyle = '#fbbf24';
          ctx.font = `900 13px ${FONT}`;
          ctx.fillText('FIRE', dummy.x, dummy.y - 52);
        }
      }
    } else if (step === 3) {
      ctx.strokeStyle = 'rgba(251,191,36,0.9)';
      ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(me.x, me.y, 42, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#fbbf24';
      ctx.font = `900 12px ${FONT}`; ctx.textAlign = 'center';
      ctx.fillText('DASH', me.x, me.y - 54);
    }
  }

  function render({ run, hud, mouse, tutorialStep = 0 }) {
    ctx.save();
    if (shake > 0) ctx.translate((Math.random() - 0.5) * shake * 26, (Math.random() - 0.5) * shake * 26);
    drawFloor(run);
    if (!run?.tutorial) drawWalls();
    drawPickup(run);
    if (run) {
      for (const p of run.players) {
        if (!p.alive) continue;
        if (p.isDummy) drawDummy(p, tutorialStep);
        else drawSoldier(p, p.id === 0);
      }
      drawBullets(run);
      drawTutorial(run, tutorialStep);
      drawCrosshair(mouse, run);
    }
    // 暗角
    const v = ctx.createRadialGradient(640, 360, 250, 640, 360, 760);
    v.addColorStop(0, 'rgba(0,0,0,0)');
    v.addColorStop(1, 'rgba(0,0,0,0.45)');
    ctx.fillStyle = v;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.restore();
  }

  return { render, update, clearEffects, flash, addSpark, addText, muzzle, markHit };
}
