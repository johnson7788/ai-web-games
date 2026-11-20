// STAR SLAYER · 渲染装配：纯消费 sim 状态，不持有游戏逻辑。
// 导出 createRender(canvas) → { draw, resize, burst, flash, setSceneFx, setOverloadReady }。
import { WORLD, ARENA_TOP, DPR_CAP, SCENE_FADE_SEC, SCENES, GLOW, PARTICLE, SHAKE, FONT, scenePalette, rgbCss, clamp } from './theme.js';

function makeGlowSprite(radius, core, edge) {
  const size = Math.max(2, Math.ceil(radius * 2));
  const s = document.createElement('canvas');
  s.width = size;
  s.height = size;
  const c = s.getContext('2d');
  const g = c.createRadialGradient(radius, radius, 0, radius, radius, radius);
  g.addColorStop(0, core);
  g.addColorStop(0.42, core);
  g.addColorStop(1, edge);
  c.fillStyle = g;
  c.fillRect(0, 0, size, size);
  return s;
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  const reduceMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

  const glowWhite = makeGlowSprite(22, 'rgba(240,255,255,1)', 'rgba(125,249,255,0)');
  const glowGold = makeGlowSprite(18, 'rgba(255,246,220,1)', 'rgba(255,209,102,0)');
  const glowCyan = makeGlowSprite(12, 'rgba(200,250,255,1)', 'rgba(84,231,255,0)');
  const glowRed = makeGlowSprite(12, 'rgba(255,200,200,1)', 'rgba(255,93,115,0)');

  const particles = [];
  let flashAlpha = 0;
  let flashColor = '255,255,255';
  let shakeMag = 0;
  let lastShakeAt = -1e9;
  let lastNow = 0;
  let sceneFrom = 0;
  let sceneTo = 0;
  let sceneFadeT = 1;
  let fxScene = 0;
  let overloadReady = false;
  let prevPlayer = null;

  function clampScene(n) { return clamp(Math.round(n) || 0, 0, SCENES.length - 1); }

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

  function setSceneFx(idx) {
    const z = clampScene(idx);
    if (z === fxScene) return;
    sceneFrom = sceneTo;
    sceneTo = z;
    sceneFadeT = 0;
    fxScene = z;
  }

  function setOverloadReady(v) { overloadReady = !!v; }

  function requestShake(mag) {
    if (reduceMotion) return;
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - lastShakeAt < 10000) return;
    lastShakeAt = now;
    shakeMag = Math.max(shakeMag, mag);
  }

  function burst(x, y, kind) {
    const color = kind === 'kill' || kind === 'boss' ? '#ffd166'
      : kind === 'hit' ? '#ff8fa3'
      : kind === 'coreCopy' ? '#c9f7ff'
      : kind === 'sync' ? '#8ff4ff'
      : kind === 'overload' ? '#ffffff'
      : '#7df9ff';
    const n = kind === 'boss' || kind === 'overload' ? 26 : kind === 'kill' ? 12 : 6;
    for (let i = 0; i < n; i += 1) {
      const a = Math.random() * Math.PI * 2;
      const sp = (kind === 'overload' || kind === 'boss') ? 120 + Math.random() * 320 : 60 + Math.random() * 220;
      particles.push({
        x, y,
        vx: Math.cos(a) * sp,
        vy: Math.sin(a) * sp,
        life: PARTICLE.life * (0.6 + Math.random() * 0.6),
        maxLife: PARTICLE.life,
        color,
        r: kind === 'hit' ? 2 : 3,
      });
    }
    if (kind === 'boss') requestShake(SHAKE.boss);
    if (kind === 'overload') requestShake(SHAKE.overload);
  }

  function flash(kind, color = '255,255,255') {
    if (reduceMotion && kind !== 'overload') return;
    flashAlpha = kind === 'overload' ? 0.85 : kind === 'bossBreak' ? 0.5 : 0.25;
    flashColor = color;
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
    }
    if (particles.length > PARTICLE.cap) particles.splice(0, particles.length - PARTICLE.cap);
  }

  function currentScene(run) {
    const hud = run && typeof run.getHud === 'function' ? run.getHud() : null;
    if (hud && typeof hud.scene === 'number') return clampScene(hud.scene);
    if (run && typeof run.scene === 'number') return clampScene(run.scene);
    return 0;
  }

  // ---------- 背景 ----------
  function drawBackground(pal, now) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, pal.top);
    g.addColorStop(0.55, pal.mid);
    g.addColorStop(1, pal.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 地格线
    ctx.strokeStyle = pal.grid;
    ctx.lineWidth = 1;
    const gap = 96;
    for (let x = gap; x < WORLD.WIDTH; x += gap) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.HEIGHT); ctx.stroke();
    }
    for (let y = gap; y < WORLD.HEIGHT; y += gap) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
    }

    // 装饰：按场景类型
    const t = now * 0.001;
    if (pal.decor === 'pilot') {
      for (let i = 0; i < 14; i += 1) {
        const x = (i * 97 + 40) % WORLD.WIDTH;
        const y = (i * 61 + 80) % WORLD.HEIGHT;
        ctx.fillStyle = pal.glow;
        ctx.globalAlpha = 0.25 + 0.15 * Math.sin(t * 2 + i);
        ctx.fillRect(x, y, 3, 3);
      }
    } else if (pal.decor === 'panel') {
      for (let i = 0; i < 12; i += 1) {
        const x = 60 + (i * 113) % (WORLD.WIDTH - 120);
        const y = 50 + (i * 73) % (WORLD.HEIGHT - 100);
        ctx.strokeStyle = pal.grid;
        ctx.globalAlpha = 0.6;
        ctx.strokeRect(x, y, 46, 30);
      }
    } else {
      for (let i = 0; i < 10; i += 1) {
        const x = 80 + (i * 131) % (WORLD.WIDTH - 160);
        const y = 60 + (i * 89) % (WORLD.HEIGHT - 120);
        ctx.fillStyle = pal.glow;
        ctx.globalAlpha = 0.5 + 0.4 * Math.sin(t * 3 + i * 1.7);
        ctx.beginPath(); ctx.arc(x, y, 2 + Math.sin(t + i), 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 目标横幅：明确「要做什么」 ----------
  function drawObjective(pal) {
    const y = ARENA_TOP + 24;
    const text = 'ELIMINATE ALL HOSTILES';
    ctx.font = `700 20px ${FONT}`;
    const tw = ctx.measureText(text).width;
    const w = tw + 56;
    const h = 38;
    const x = (WORLD.WIDTH - w) / 2;
    ctx.fillStyle = 'rgba(6, 12, 22, 0.78)';
    ctx.fillRect(x, y - h / 2, w, h);
    ctx.strokeStyle = 'rgba(255, 93, 115, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y - h / 2, w, h);
    // 左侧准星图标
    ctx.strokeStyle = '#ffd166';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(x + 22, y, 8, 0, Math.PI * 2);
    ctx.moveTo(x + 22 - 13, y); ctx.lineTo(x + 22 - 4, y);
    ctx.moveTo(x + 22 + 4, y); ctx.lineTo(x + 22 + 13, y);
    ctx.moveTo(x + 22, y - 13); ctx.lineTo(x + 22, y - 4);
    ctx.moveTo(x + 22, y + 4); ctx.lineTo(x + 22, y + 13);
    ctx.stroke();
    ctx.fillStyle = '#ffd9e0';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, x + 40, y + 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }

  // ---------- 实体 ----------
  function outlinedPath(fillColor, lineWidth = 2) {
    ctx.fillStyle = fillColor;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.95)';
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }

  let runPlayerX = WORLD.WIDTH / 2;
  let runPlayerY = WORLD.HEIGHT / 2;

  function drawEnemy(e, now) {
    const t = now * 0.001;
    const s = 2.4; // 视觉放大：敌人在深空背景里清晰可辨
    const R = e.r * s;
    const ang = Math.atan2(runPlayerY - e.y, runPlayerX - e.x);
    ctx.save();
    ctx.translate(e.x, e.y);
    // 统一红色光晕底，让目标一眼可读
    ctx.globalAlpha = 0.85;
    ctx.drawImage(glowRed, -R * 1.5, -R * 1.5, R * 3, R * 3);
    ctx.globalAlpha = 1;

    switch (e.type) {
      case 'raider': {
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(R, 0); ctx.lineTo(-R * 0.7, R * 0.65); ctx.lineTo(-R * 0.35, 0); ctx.lineTo(-R * 0.7, -R * 0.65);
        ctx.closePath();
        outlinedPath(e.color);
        break;
      }
      case 'striker': {
        ctx.rotate(ang + t * 3);
        ctx.beginPath();
        ctx.moveTo(R, 0); ctx.lineTo(0, R * 0.82); ctx.lineTo(-R * 0.82, 0); ctx.lineTo(0, -R * 0.82);
        ctx.closePath();
        outlinedPath(e.color);
        break;
      }
      case 'weaver': {
        ctx.beginPath(); ctx.arc(0, 0, R * 0.82, 0, Math.PI * 2);
        outlinedPath(e.color);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth = 1.6;
        for (let k = 0; k < 6; k += 1) {
          const a = (Math.PI * 2 * k) / 6 + t;
          ctx.beginPath();
          ctx.moveTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55);
          ctx.lineTo(Math.cos(a) * R * 1.05, Math.sin(a) * R * 1.05);
          ctx.stroke();
        }
        break;
      }
      case 'shuttle': {
        ctx.rotate(ang);
        ctx.beginPath();
        ctx.moveTo(R, 0); ctx.lineTo(-R * 0.6, R * 0.55); ctx.lineTo(-R * 0.6, -R * 0.55);
        ctx.closePath();
        outlinedPath(e.color);
        break;
      }
      case 'turret': {
        ctx.beginPath(); ctx.arc(0, 0, R * 0.8, 0, Math.PI * 2);
        outlinedPath(e.color);
        ctx.fillStyle = '#04141c';
        ctx.beginPath(); ctx.arc(0, 0, R * 0.4, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'boss': {
        ctx.rotate(ang);
        ctx.beginPath();
        for (let k = 0; k < 8; k += 1) {
          const a = (Math.PI * 2 * k) / 8;
          const rr = k % 2 === 0 ? R : R * 0.72;
          const px = Math.cos(a) * rr;
          const py = Math.sin(a) * rr;
          if (k === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
        }
        ctx.closePath();
        outlinedPath(e.color, 3.5);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, R * 0.22, 0, Math.PI * 2); ctx.fill();
        break;
      }
      default:
        break;
    }
    ctx.restore();
  }

  // 敌人血条：明确「这是可摧毁的目标」
  function drawEnemyHpBar(e) {
    if (e.maxHp <= 0 || e.type === 'boss') return;
    const w = e.r * 3;
    const h = 6;
    const x = e.x - w / 2;
    const y = e.y - e.r * 2.4 - 18;
    const ratio = Math.max(0, Math.min(1, e.hp / e.maxHp));
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(x - 2, y - 2, w + 4, h + 4);
    ctx.fillStyle = ratio > 0.4 ? '#ff5d73' : '#ffd166';
    ctx.fillRect(x, y, w * ratio, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.lineWidth = 1.2;
    ctx.strokeRect(x, y, w, h);
  }

  function drawBullet(b, fromCore) {
    const sprite = fromCore ? glowGold : glowCyan;
    ctx.drawImage(sprite, b.x - sprite.width / 2, b.y - sprite.height / 2);
    ctx.fillStyle = fromCore ? '#ffe9a8' : '#eaffff';
    ctx.strokeStyle = 'rgba(84,231,255,0.6)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  function drawEnemyBullet(b) {
    ctx.drawImage(glowRed, b.x - glowRed.width / 2, b.y - glowRed.height / 2);
    ctx.fillStyle = '#ff5d73';
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
  }

  function drawPlayer(p, now) {
    const t = now * 0.001;
    const ringPulse = overloadReady ? (1 + 0.14 * Math.sin(t * 8)) : 1;
    const R = p.r + 7;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.drawImage(glowWhite, -glowWhite.width * 1.3 / 2, -glowWhite.height * 1.3 / 2, glowWhite.width * 1.3, glowWhite.height * 1.3);
    // 底座光环（超载就绪时转红）
    ctx.strokeStyle = overloadReady ? 'rgba(255,93,115,0.95)' : 'rgba(84,231,255,0.75)';
    ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(0, 0, R + 9 * ringPulse, 0, Math.PI * 2); ctx.stroke();
    ctx.rotate(p.aim);
    ctx.beginPath();
    ctx.moveTo(R, 0); ctx.lineTo(-R * 0.7, R * 0.62); ctx.lineTo(-R * 0.4, 0); ctx.lineTo(-R * 0.7, -R * 0.62);
    ctx.closePath();
    ctx.fillStyle = '#eaffff';
    ctx.fill();
    ctx.strokeStyle = 'rgba(84,231,255,0.95)';
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = '#54e7ff';
    ctx.beginPath(); ctx.arc(R * 0.15, 0, R * 0.2, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function drawCore(c, now, p) {
    const t = now * 0.001;
    // 伙伴连接线（一眼看出「这是你的伙伴」）
    ctx.strokeStyle = 'rgba(84,231,255,0.4)';
    ctx.lineWidth = 1.4;
    ctx.setLineDash([5, 7]);
    ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(c.x, c.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.translate(c.x, c.y);
    const cr = c.r * 0.62;
    ctx.globalAlpha = 0.32;
    ctx.drawImage(glowCyan, -glowCyan.width * 0.7 / 2, -glowCyan.height * 0.7 / 2, glowCyan.width * 0.7, glowCyan.height * 0.7);
    ctx.globalAlpha = 0.8;
    ctx.fillStyle = c.online ? '#9fe8ff' : '#3a4550';
    ctx.beginPath(); ctx.arc(0, 0, cr, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = c.online ? 'rgba(190,239,255,0.7)' : 'rgba(120,130,140,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(0, 0, cr + 4 + Math.sin(t * 4) * 1.5, 0, Math.PI * 2); ctx.stroke();
    ctx.restore();
  }

  function drawParticles() {
    for (const p of particles) {
      const a = clamp(p.life / p.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ---------- 主 draw ----------
  function draw(run, interp) {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!lastNow) lastNow = now;
    const dt = clamp((now - lastNow) / 1000, 0, 0.05);
    lastNow = now;
    updateParticles(dt);

    if (!run) {
      // 标题：氛围背景
      drawBackground(scenePalette(0), now);
      drawScreenFlash();
      return;
    }

    const sceneIdx = currentScene(run);
    if (sceneIdx !== fxScene) setSceneFx(sceneIdx);
    sceneFadeT = Math.min(1, sceneFadeT + dt / SCENE_FADE_SEC);
    if (sceneFadeT >= 1) { sceneFadeT = 1; sceneFrom = sceneTo; }

    const hud = typeof run.getHud === 'function' ? run.getHud() : null;
    const palA = scenePalette(sceneFrom);
    const palB = scenePalette(sceneTo);
    // 用目标色板画背景（淡入由场景切换时渐变逼近即可，避免复杂混合）
    const pal = sceneFadeT >= 1 ? palB : palA;

    ctx.save();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.bottom;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.restore();

    shakeMag *= Math.max(0, 1 - SHAKE.decay * dt);
    if (shakeMag < 0.2) shakeMag = 0;
    const shx = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;
    const shy = shakeMag ? (Math.random() - 0.5) * 2 * shakeMag : 0;

    ctx.save();
    ctx.translate(shx, shy);
    drawBackground(pal, now);
    drawObjective(pal);

    const p = run.player;
    runPlayerX = p.x; runPlayerY = p.y;
    for (const e of run.enemies) { drawEnemy(e, now); drawEnemyHpBar(e); }
    for (const b of run.enemyBullets) drawEnemyBullet(b);
    for (const b of run.bullets) drawBullet(b, b.fromCore);
    drawCore(run.core, now, p);
    drawPlayer(p, now);
    drawParticles();
    ctx.restore();

    drawScreenFlash();
  }

  function drawScreenFlash() {
    if (flashAlpha > 0.005) {
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = `rgba(${flashColor},${flashAlpha})`;
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.restore();
      flashAlpha *= 0.86;
    } else {
      flashAlpha = 0;
    }
  }

  resize();

  return { draw, resize, burst, flash, setSceneFx, setOverloadReady };
}
