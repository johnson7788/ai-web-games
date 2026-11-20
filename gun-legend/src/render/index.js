// GUN LEGEND · M2 渲染：程序化 Canvas 霓虹港片巷战（零外部素材）
// 三场景包（雨巷/天台/酒楼）换色板+构图+装饰；装饰只用抽象光条（无文字），避免与 HUD/准星混淆。
import { WORLD, PLAYER } from '../../config/gameplay.js';
import { SCENES, sceneForRound } from '../../config/levels.js';

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

const ENEMY_COLORS = {
  knife: { body: '#ff5d5d', glow: '#ff9a6a' },
  gunner: { body: '#8f6bff', glow: '#c3b1ff' },
  grenadier: { body: '#ffc94a', glow: '#ffe08a' },
  elite: { body: '#54e7ff', glow: '#b8f4ff' },
  boss: { body: '#ff3b6b', glow: '#ff8aa8' },
};

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const particles = [];
  let lastNow = performance.now();
  let shake = 0;
  const rainDrops = [];
  for (let i = 0; i < 90; i += 1) {
    rainDrops.push({ x: Math.random() * WORLD.WIDTH, y: Math.random() * WORLD.HEIGHT, s: 0.4 + Math.random() * 0.9 });
  }

  function burst(x, y, kind = 'hit') {
    const palette = {
      hit: ['#ffd76a', '#ffffff', '#ff9a6a'],
      kill: ['#ff5d5d', '#ffc94a', '#ffffff'],
      dove: ['#ffffff', '#dff4ff', '#ffffff'],
      muzzle: ['#ffe08a', '#ffffff'],
    }[kind] || ['#ffffff', '#54e7ff'];
    const n = kind === 'kill' ? 16 : kind === 'dove' ? 22 : 7;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = (kind === 'kill' ? 90 : 60) * (0.5 + Math.random());
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: 0.4 + Math.random() * 0.4,
        maxLife: 0.8,
        size: 1.5 + Math.random() * 2.5,
        color: palette[(Math.random() * palette.length) | 0],
      });
    }
  }

  function setShake(s) { shake = Math.max(shake, s); }

  function stepParticles(now) {
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    if (shake > 0) shake = Math.max(0, shake - dt * 22);
  }

  // 标题屏背后静态演示场景（保证标题截图也有玩家/敌人剪影）
  const attractRun = {
    time: 0,
    round: 1,
    scene: 1,
    weapon: { magSize: 6 },
    player: { x: 640, y: 560, radius: 22, rolling: false, invulnUntil: -Infinity },
    aim: { x: 640, y: 200 },
    guns: { left: 4, right: 6 },
    reloading: false,
    enemies: [
      { type: 'knife', x: 520, y: 220, radius: 16, hp: 40 },
      { type: 'gunner', x: 760, y: 300, radius: 16, hp: 60 },
    ],
    bullets: [],
    enemyBullets: [],
    grenades: [],
    doveUntil: -Infinity,
    getHud() { return { doveActive: false, reloadProgress: 0 }; },
  };

  function draw(run, alpha = 1) {
    const now = performance.now();
    stepParticles(now);

    const scene = run ? sceneForRound(run.round) : SCENES[0];
    const pal = scene.palette;
    const ox = (Math.random() - 0.5) * shake * 2;
    const oy = (Math.random() - 0.5) * shake * 2;

    ctx.save();
    ctx.translate(ox, oy);

    drawBackground(scene, pal, now);

    if (run) {
      drawGrenades(run);
      drawEnemies(run);
      drawBullets(run, 'enemy');
      drawBullets(run, 'player');
      drawPlayer(run, pal, now);
      drawDove(run);
      drawAim(run, pal);
    } else {
      drawEnemies(attractRun);
      drawPlayer(attractRun, pal, now);
      drawAim(attractRun, pal);
    }

    drawParticles();
    ctx.restore();
  }

  function drawBackground(scene, pal, now) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.bgTop);
    g.addColorStop(1, pal.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.fillRect(0, 560, WORLD.WIDTH, 160);

    if (scene.id === 'alley') {
      drawAlleyLights(ctx, pal);
      drawRain(ctx, now);
      drawFloorLines(ctx, pal, 1);
    } else if (scene.id === 'rooftop') {
      drawSun(ctx, pal);
      drawSkyline(ctx, pal);
      drawFloorLines(ctx, pal, 0);
    } else {
      drawLanterns(ctx, pal);
      drawFloorLines(ctx, pal, -1);
    }

    ctx.strokeStyle = pal.neon;
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 556);
    ctx.lineTo(WORLD.WIDTH, 556);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawRain(ctx, now) {
    ctx.strokeStyle = 'rgba(120,200,255,0.28)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (const d of rainDrops) {
      const y = (d.y + now * 0.22 * d.s * 60) % WORLD.HEIGHT;
      ctx.moveTo(d.x, y);
      ctx.lineTo(d.x - 8 * d.s, y + 22 * d.s);
    }
    ctx.stroke();
  }

  // 雨巷：抽象横光条（无文字、无竖条，避开 HUD 与准星）
  function drawAlleyLights(ctx, pal) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    for (let i = 0; i < 4; i += 1) {
      const x = 160 + i * 270;
      ctx.fillStyle = i % 2 ? pal.neon2 : pal.neon;
      ctx.shadowColor = ctx.fillStyle;
      ctx.shadowBlur = 10;
      ctx.fillRect(x, 350 + (i % 2) * 40, 130, 5);
    }
    ctx.restore();
  }

  function drawFloorLines(ctx, pal, dir) {
    ctx.save();
    ctx.globalAlpha = 0.22;
    ctx.strokeStyle = pal.neon;
    ctx.lineWidth = 2;
    for (let x = 0; x < WORLD.WIDTH; x += 130) {
      ctx.beginPath();
      ctx.moveTo(x, 560);
      ctx.lineTo(x + dir * 200, 720);
      ctx.stroke();
    }
    ctx.restore();
  }

  function drawSun(ctx, pal) {
    const g = ctx.createRadialGradient(980, 150, 20, 980, 150, 260);
    g.addColorStop(0, 'rgba(255,180,84,0.85)');
    g.addColorStop(1, 'rgba(255,122,60,0)');
    ctx.fillStyle = g;
    ctx.fillRect(700, 0, 580, 500);
    ctx.fillStyle = pal.neon;
    ctx.beginPath();
    ctx.arc(980, 150, 44, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawSkyline(ctx, pal) {
    ctx.fillStyle = 'rgba(10,8,16,0.62)';
    for (let i = 0; i < 8; i += 1) {
      const w = 90 + (i % 3) * 40;
      const h = 120 + (i % 4) * 55;
      const x = i * 165;
      ctx.fillRect(x, 430 - h, w, h);
      ctx.fillStyle = pal.neon;
      ctx.globalAlpha = 0.4;
      for (let wy = 430 - h + 18; wy < 430; wy += 34) {
        ctx.fillRect(x + 10, wy, 6, 8);
        ctx.fillRect(x + w - 16, wy, 6, 8);
      }
      ctx.globalAlpha = 1;
      ctx.fillStyle = 'rgba(10,8,16,0.62)';
    }
  }

  function drawLanterns(ctx, pal) {
    for (let i = 0; i < 5; i += 1) {
      const x = 120 + i * 260;
      const y = 200 + (i % 2) * 60;
      ctx.save();
      ctx.shadowColor = pal.neon;
      ctx.shadowBlur = 20;
      ctx.fillStyle = pal.neon;
      ctx.beginPath();
      ctx.ellipse(x, y, 22, 30, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = pal.neon2;
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 16, y + 30, 32, 3);
      ctx.restore();
    }
  }

  function drawPlayer(run, pal, now) {
    const p = run.player;
    const x = p.x;
    const y = p.y;
    const invuln = run.time < p.invulnUntil;

    ctx.save();
    ctx.translate(x, y);

    const sweep = p.rolling ? Math.sin((now / 1000) * 30) * 0.3 : 0;

    ctx.fillStyle = 'rgba(0,0,0,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 14, 26, 9, 0, 0, Math.PI * 2);
    ctx.fill();

    if (invuln) {
      ctx.save();
      ctx.globalAlpha = 0.5 + 0.3 * Math.sin(now / 30);
      ctx.strokeStyle = pal.neon;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(0, -6, 30, 0, Math.PI * 2);
      ctx.stroke();
      ctx.restore();
    }

    // 风衣剪影（最亮最粗）
    ctx.fillStyle = '#0c1420';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 3;
    ctx.shadowColor = pal.neon;
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(-17, 16);
    ctx.lineTo(-8 + sweep * 10, -16);
    ctx.lineTo(0, -30);
    ctx.lineTo(8 + sweep * 10, -16);
    ctx.lineTo(17, 16);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(0, -34, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = '#ffd76a';
    ctx.shadowBlur = 8;
    ctx.fillRect(-20, -12, 12, 5);
    ctx.fillRect(8, -12, 12, 5);
    ctx.shadowBlur = 0;

    ctx.restore();

    if (run.reloading) {
      ctx.save();
      ctx.strokeStyle = 'rgba(234,246,255,0.25)';
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.arc(x, y, 40, Math.PI * 0.75, Math.PI * 2.25);
      ctx.stroke();
      ctx.strokeStyle = pal.neon;
      ctx.beginPath();
      ctx.arc(x, y, 40, Math.PI * 0.75, Math.PI * 0.75 + Math.PI * 1.5 * run.getHud().reloadProgress);
      ctx.stroke();
      ctx.restore();
    }
  }

  function drawEnemies(run) {
    for (const e of run.enemies) {
      const c = ENEMY_COLORS[e.type] || ENEMY_COLORS.knife;
      ctx.save();
      ctx.translate(e.x, e.y);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      ctx.beginPath();
      ctx.ellipse(0, e.radius * 0.8, e.radius, e.radius * 0.4, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = c.body;
      ctx.strokeStyle = c.glow;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = c.glow;
      ctx.shadowBlur = 12;

      if (e.type === 'knife') {
        ctx.beginPath();
        ctx.moveTo(0, -e.radius);
        ctx.lineTo(e.radius, e.radius * 0.7);
        ctx.lineTo(-e.radius, e.radius * 0.7);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else if (e.type === 'grenadier') {
        ctx.beginPath();
        ctx.arc(0, 0, e.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = '#2a1508';
        ctx.beginPath();
        ctx.arc(0, -3, e.radius * 0.45, 0, Math.PI * 2);
        ctx.fill();
      } else if (e.type === 'boss') {
        ctx.beginPath();
        ctx.moveTo(0, -e.radius);
        ctx.lineTo(e.radius, 0);
        ctx.lineTo(0, e.radius);
        ctx.lineTo(-e.radius, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.roundRect(-e.radius, -e.radius, e.radius * 2, e.radius * 2, 4);
        ctx.fill();
        ctx.stroke();
        ctx.fillStyle = c.glow;
        ctx.fillRect(-e.radius * 0.8, -e.radius - 3, e.radius * 1.6, 4);
      }
      ctx.shadowBlur = 0;

      // 目标标记：头顶红色「!」警告徽章，明确这是需要击倒的敌人
      ctx.fillStyle = '#ff3b4d';
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ff3b4d';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(0, -e.radius - 14, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px "Courier New",monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('!', 0, -e.radius - 14);
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // 血条
      const specHp = { knife: 40, gunner: 60, grenadier: 70, elite: 130, boss: 700 }[e.type] || 60;
      ctx.fillStyle = 'rgba(0,0,0,0.55)';
      ctx.fillRect(-e.radius, -e.radius - 26, e.radius * 2, 4);
      ctx.fillStyle = e.hp / specHp > 0.35 ? '#ffd76a' : '#ff5d5d';
      ctx.fillRect(-e.radius, -e.radius - 26, e.radius * 2 * (e.hp / specHp), 4);

      ctx.restore();
    }
  }

  function drawBullets(run, owner) {
    const list = owner === 'player' ? run.bullets : run.enemyBullets;
    const color = owner === 'player' ? '#ffd76a' : '#ff5d5d';
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const b of list) {
      ctx.fillStyle = color;
      ctx.shadowColor = color;
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = color;
      ctx.globalAlpha = 0.5;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(b.x - b.vx * 0.03, b.y - b.vy * 0.03);
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  }

  function drawGrenades(run) {
    ctx.save();
    for (const g of run.grenades) {
      ctx.fillStyle = Math.sin(performance.now() / 60) > 0 ? '#ffc94a' : '#ff5d5d';
      ctx.shadowColor = '#ffc94a';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(g.x, g.y, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawDove(run) {
    if (!run.getHud().doveActive) return;
    const remain = run.doveUntil - run.time;
    const t = 1 - remain / 1.5;
    const x = -40 + t * (WORLD.WIDTH + 80);
    const y = 180 + Math.sin(t * Math.PI) * 40;
    ctx.save();
    ctx.globalAlpha = Math.min(1, t * 3, (1 - t) * 3);
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = '#ffffff';
    ctx.shadowBlur = 18;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x - 20, y - 22, x - 34, y - 6);
    ctx.quadraticCurveTo(x - 18, y + 2, x, y + 4);
    ctx.quadraticCurveTo(x + 18, y - 20, x + 34, y - 8);
    ctx.quadraticCurveTo(x + 18, y + 2, x, y);
    ctx.fill();
    ctx.restore();
  }

  function drawAim(run, pal) {
    const a = run.aim;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.shadowColor = pal.neon;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(a.x - 16, a.y); ctx.lineTo(a.x - 5, a.y);
    ctx.moveTo(a.x + 5, a.y); ctx.lineTo(a.x + 16, a.y);
    ctx.moveTo(a.x, a.y - 16); ctx.lineTo(a.x, a.y - 5);
    ctx.moveTo(a.x, a.y + 5); ctx.lineTo(a.x, a.y + 16);
    ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (const p of particles) {
      ctx.globalAlpha = clamp(p.life / p.maxLife, 0, 1);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.globalAlpha = 1;
  }

  return { draw, burst, setShake };
}
