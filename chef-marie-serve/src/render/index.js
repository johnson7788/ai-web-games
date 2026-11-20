// Canvas 2D 渲染：手绘卡通风格的厨房横版世界（程序化，零素材）。
// 角色/敌人/食材/上菜台全部矢量绘制，统一粗描边暖色调；视差背景两层；粒子预算封顶。
import { WORLD, PLAYER, SPICE } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';

const OUTLINE = '#4a2a18';
const CREAM = '#fff3dc';

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const DPR = Math.min(2, (typeof window !== 'undefined' && window.devicePixelRatio) || 1);
  canvas.width = WORLD.WIDTH * DPR;
  canvas.height = WORLD.HEIGHT * DPR;

  let particles = [];

  function burst(x, y, type) {
    const n = type === 'coin' ? 10 : type === 'stomp' ? 12 : 8;
    const colors = type === 'coin' ? ['#ffd24a', '#fff6c9', '#ff9f43']
      : type === 'spice' ? ['#ff5e3a', '#ffd24a', '#fff']
      : type === 'stomp' ? ['#8a6a4a', '#c9a06a', '#fff3dc']
      : ['#ffffff', '#ffd24a', '#ff9f43'];
    for (let i = 0; i < n; i += 1) {
      particles.push({
        x, y,
        vx: (Math.random() - 0.5) * (type === 'stomp' ? 260 : 180),
        vy: -Math.random() * 220 - 40,
        r: 2 + Math.random() * 3,
        color: colors[(Math.random() * colors.length) | 0],
        ttl: 0.5 + Math.random() * 0.4,
        max: 0.9,
        grav: 900,
      });
    }
    if (particles.length > 400) particles.splice(0, particles.length - 400);
  }

  function rr(x, y, w, h, r) {
    const rad = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + rad, y);
    ctx.arcTo(x + w, y, x + w, y + h, rad);
    ctx.arcTo(x + w, y + h, x, y + h, rad);
    ctx.arcTo(x, y + h, x, y, rad);
    ctx.arcTo(x, y, x + w, y, rad);
    ctx.closePath();
  }

  function circle(x, y, r) { ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.closePath(); }

  function fill(style) { ctx.fillStyle = style; ctx.fill(); }
  function stroke(style, w) { ctx.strokeStyle = style; ctx.lineWidth = w; ctx.stroke(); }

  function drawSky(sky) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, sky.top);
    g.addColorStop(1, sky.bottom);
    fill(g); ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function drawWallLayer(sky, camX) {
    const off = camX * 0.35;
    // 墙砖
    ctx.save();
    ctx.strokeStyle = 'rgba(74,42,24,0.10)';
    ctx.lineWidth = 2;
    const tile = 96;
    const shift = -(off % tile);
    for (let x = shift; x < WORLD.WIDTH + tile; x += tile) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, WORLD.GROUND_Y - 60); ctx.stroke();
    }
    for (let y = 40; y < WORLD.GROUND_Y - 40; y += tile) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(WORLD.WIDTH, y); ctx.stroke();
    }
    ctx.restore();
    // 挂着的锅/勺（中景视差）
    const off2 = camX * 0.6;
    const spacing = 260;
    const shift2 = -(off2 % spacing);
    for (let x = shift2; x < WORLD.WIDTH + spacing; x += spacing) {
      const y = 150 + ((x * 7) % 3) * 40;
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, y); ctx.stroke();
      ctx.fillStyle = '#c96b4a'; circle(x, y + 12, 14); fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; circle(x, y + 12, 14); stroke();
    }
  }

  function drawPlatform(p, camX, accent) {
    const x = p.x - camX, y = p.y;
    if (x + p.w < -40 || x > WORLD.WIDTH + 40) return;
    // 台面
    ctx.fillStyle = accent;
    rr(x, y, p.w, 22, 8); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; rr(x, y, p.w, 22, 8); stroke();
    // 台面高光
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    rr(x + 6, y + 3, p.w - 12, 6, 3); fill();
    // 主体
    if (p.h > 40) {
      ctx.fillStyle = '#e9c9a0';
      rr(x + 6, y + 22, p.w - 12, p.h - 22, 6); fill();
      ctx.strokeStyle = 'rgba(74,42,24,0.25)'; ctx.lineWidth = 2;
      for (let wx = x + 20; wx < x + p.w - 10; wx += 46) {
        ctx.beginPath(); ctx.moveTo(wx, y + 26); ctx.lineTo(wx, y + p.h - 4); ctx.stroke();
      }
    }
  }

  function drawIngredient(ing, camX) {
    if (ing.taken) return;
    const x = ing.x - camX, y = ing.y;
    const bob = Math.sin(performance.now() / 240 + ing.x) * 4;
    const cy = y + bob;
    ctx.save();
    ctx.translate(x, cy);
    // 光晕
    ctx.fillStyle = 'rgba(255,210,74,0.25)'; circle(0, 0, 20); fill();
    const kind = ing.x % 3;
    if (kind === 0) { // 番茄
      ctx.fillStyle = '#ff5e4a'; circle(0, 0, 14); fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; circle(0, 0, 14); stroke();
      ctx.fillStyle = '#5fae4a';
      ctx.beginPath(); ctx.ellipse(0, -13, 5, 3, 0, 0, Math.PI * 2); fill();
      ctx.fillStyle = '#7bc96a'; circle(-5, -11, 2); fill();
    } else if (kind === 1) { // 奶酪
      ctx.fillStyle = '#ffd24a';
      ctx.beginPath(); ctx.moveTo(0, -12); ctx.lineTo(13, 10); ctx.lineTo(-13, 10); ctx.closePath(); fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#fff3b0'; circle(-3, -1, 2); fill(); circle(3, 3, 2); fill();
    } else { // 鸡蛋
      ctx.fillStyle = '#fff8e8';
      ctx.beginPath(); ctx.ellipse(0, 0, 12, 15, 0, 0, Math.PI * 2); fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.stroke();
      ctx.fillStyle = '#ffb03a'; circle(0, 3, 5); fill();
    }
    ctx.restore();
  }

  function drawSpice(s, camX) {
    if (s.taken) return;
    const x = s.x - camX, y = s.y + Math.sin(performance.now() / 200 + s.x) * 4;
    ctx.fillStyle = 'rgba(255,94,58,0.30)'; circle(x, y, 24); fill();
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-0.6);
    ctx.fillStyle = '#ff5e3a';
    ctx.beginPath(); ctx.ellipse(0, 0, 16, 8, 0, 0, Math.PI * 2); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.stroke();
    ctx.fillStyle = '#5fae4a';
    ctx.beginPath(); ctx.ellipse(14, -2, 5, 3, 0.5, 0, Math.PI * 2); fill();
    ctx.restore();
  }

  function drawEnemy(e, camX) {
    if (!e.alive) return;
    const x = e.x - camX, y = e.y;
    const t = performance.now() / 160;
    ctx.save();
    ctx.translate(x + 20, y + 20);
    if (e.kind === 'fly') {
      ctx.fillStyle = 'rgba(90,70,60,0.18)';
      ctx.beginPath(); ctx.ellipse(-14, 0, 16, 7, 0, 0, Math.PI * 2); fill();
      ctx.beginPath(); ctx.ellipse(14, 0, 16, 7, 0, 0, Math.PI * 2); fill();
      ctx.fillStyle = '#6a4a3a'; circle(0, 0, 13); fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; circle(0, 0, 13); stroke();
      ctx.fillStyle = '#fff'; circle(-4, -3, 3); fill(); circle(4, -3, 3); fill();
      ctx.fillStyle = '#2a1a10'; circle(-4, -3, 1.5); fill(); circle(4, -3, 1.5); fill();
    } else { // 老鼠
      const walk = Math.sin(t * 8) * 2;
      ctx.fillStyle = '#8a6a52';
      ctx.beginPath(); ctx.ellipse(0, 2, 17, 13, 0, 0, Math.PI * 2); fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.stroke();
      // 耳朵
      circle(-12, -10, 6); fill(); stroke(OUTLINE, 2.5);
      circle(10, -10, 6); fill(); stroke(OUTLINE, 2.5);
      ctx.fillStyle = '#e9b9a0'; circle(-12, -10, 3); fill(); circle(10, -10, 3); fill();
      // 眼睛
      ctx.fillStyle = '#fff'; circle(-6, -2, 3.4); fill(); circle(6, -2, 3.4); fill();
      ctx.fillStyle = '#2a1a10'; circle(-6, -2, 1.7); fill(); circle(6, -2, 1.7); fill();
      // 尾巴
      ctx.strokeStyle = '#8a6a52'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(-16, 2); ctx.quadraticCurveTo(-28, 2 + walk, -24, -6); ctx.stroke();
    }
    ctx.restore();
  }

  function drawHazard(hz, camX) {
    const x = hz.x - camX, y = hz.y;
    ctx.save();
    ctx.translate(x + hz.w / 2, y + hz.h / 2);
    ctx.fillStyle = 'rgba(255,80,40,0.28)';
    circle(0, 0, 30 + Math.sin(performance.now() / 140) * 3); fill();
    ctx.fillStyle = '#3a2a22';
    rr(-30, -12, 60, 24, 10); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; rr(-30, -12, 60, 24, 10); stroke();
    ctx.fillStyle = '#ff8a3a'; rr(-22, -7, 44, 8, 4); fill();
    ctx.restore();
  }

  function drawSign(c, camX) {
    const x = c.x - camX, y = c.y;
    ctx.save();
    ctx.translate(x, y - 40);
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(0, 40); ctx.lineTo(0, 4); ctx.stroke();
    ctx.fillStyle = CREAM; rr(-26, -18, 52, 30, 6); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; rr(-26, -18, 52, 30, 6); stroke();
    ctx.fillStyle = OUTLINE;
    ctx.font = 'bold 13px system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('RECIPE', 0, 2);
    ctx.restore();
  }

  function drawEnd(end, camX) {
    const x = end.x - camX;
    const cx = x + end.w / 2;
    // 上菜台
    ctx.fillStyle = '#c96b4a'; rr(x, end.y, end.w, end.h, 10); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; rr(x, end.y, end.w, end.h, 10); stroke();
    ctx.fillStyle = '#fff'; circle(cx, end.y + 26, 20); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; circle(cx, end.y + 26, 20); stroke();
    // 发光箭头信标
    const pulse = 1 + Math.sin(performance.now() / 200) * 0.15;
    ctx.save();
    ctx.translate(cx, end.y - 46);
    ctx.scale(pulse, pulse);
    ctx.fillStyle = 'rgba(255,210,74,0.30)'; circle(0, 0, 26); fill();
    ctx.fillStyle = '#ffd24a';
    ctx.beginPath(); ctx.moveTo(0, -20); ctx.lineTo(12, 6); ctx.lineTo(4, 6); ctx.lineTo(4, 18);
    ctx.lineTo(-4, 18); ctx.lineTo(-4, 6); ctx.lineTo(-12, 6); ctx.closePath(); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; ctx.stroke();
    ctx.restore();
  }

  function drawChef(p, camX, spice) {
    const x = p.x - camX, y = p.y;
    const cx = x + p.w / 2;
    const feet = y + p.h;
    const t = performance.now() / 120;
    const running = Math.abs(p.vx) > 20 && p.onGround;
    const step = running ? Math.sin(t * 14) : 0;
    ctx.save();
    // 香料冲刺光晕
    if (spice) {
      ctx.fillStyle = 'rgba(255,150,60,0.30)';
      circle(cx, feet - p.h / 2, 46 + Math.sin(performance.now() / 120) * 4); fill();
    }
    ctx.translate(cx, feet);
    if (p.facing < 0) ctx.scale(-1, 1);
    // 腿
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-6, -10 + step * 3); ctx.lineTo(-7, 0); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -10 - step * 3); ctx.lineTo(7, 0); ctx.stroke();
    // 身体（围裙）
    ctx.fillStyle = '#ff5e4a'; rr(-16, -52, 32, 44, 10); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; rr(-16, -52, 32, 44, 10); stroke();
    ctx.fillStyle = '#fff8e8'; rr(-12, -46, 24, 26, 6); fill();
    // 手臂
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(-14, -40); ctx.lineTo(-20, -24 + step * 4); ctx.stroke();
    // 头
    ctx.fillStyle = '#ffd7b0'; circle(0, -66, 13); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; circle(0, -66, 13); stroke();
    ctx.fillStyle = '#2a1a10'; circle(4, -67, 2); fill();
    // 厨师帽
    ctx.fillStyle = '#fff'; rr(-14, -82, 28, 18, 6); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; rr(-14, -82, 28, 18, 6); stroke();
    ctx.fillStyle = '#fff'; circle(0, -88, 11); fill();
    ctx.strokeStyle = OUTLINE; ctx.lineWidth = 3; circle(0, -88, 11); stroke();
    ctx.restore();
  }

  function updateParticles(dt) {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const pt = particles[i];
      pt.ttl -= dt;
      if (pt.ttl <= 0) { particles.splice(i, 1); continue; }
      pt.vy += pt.grav * dt;
      pt.x += pt.vx * dt;
      pt.y += pt.vy * dt;
    }
  }

  function drawParticles(camX) {
    for (const pt of particles) {
      const a = clamp(pt.ttl / pt.max, 0, 1);
      ctx.globalAlpha = a;
      ctx.fillStyle = pt.color;
      circle(pt.x - camX, pt.y, pt.r); fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(state, dt, view = {}) {
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    const sky = (state && state.sky) || LEVELS[0].sky;
    const width = (state && state.width) || LEVELS[0].width;
    drawSky(sky);

    let camX = 0;
    if (state) {
      const p = state.player;
      const look = clamp(p.vx, -260, 260) * 0.12;
      camX = clamp(p.x + p.w / 2 + look - WORLD.WIDTH / 2, 0, Math.max(0, width - WORLD.WIDTH));
    }
    drawWallLayer(sky, camX);

    const platforms = (state && state.platforms) || LEVELS[0].platforms;
    const accent = sky.accent;
    for (const p of platforms) drawPlatform(p, camX, accent);

    const hazards = (state && state.hazards) || [];
    for (const h of hazards) drawHazard(h, camX);

    const end = (state && state.end) || LEVELS[0].end;
    drawEnd(end, camX);

    const cards = (state && state.cards) || [];
    for (const c of cards) if (!c.shown) drawSign(c, camX);

    const spices = (state && state.spices) || [];
    for (const s of spices) drawSpice(s, camX);

    const ingredients = (state && state.ingredients) || [];
    for (const ing of ingredients) drawIngredient(ing, camX);

    const enemies = (state && state.enemies) || [];
    for (const e of enemies) drawEnemy(e, camX);

    // 玩家
    if (state) {
      const p = state.player;
      drawChef(p, camX, p.spiceUntil > state.time);
    } else {
      // 标题屏：画一个静止的厨师站在出生点
      const spawn = LEVELS[0].spawn;
      drawChef({ x: spawn.x, y: spawn.y, w: PLAYER.WIDTH, h: PLAYER.HEIGHT, vx: 0, facing: 1 }, camX, false);
    }

    updateParticles(dt || 0);
    drawParticles(camX);

    // 顶部安全条（HUD 底色，避免 DOM 文字压角色时判遮挡——DOM HUD 用不透明条）
    if (view.hudBack) {
      ctx.fillStyle = 'rgba(30,18,10,0.55)';
      ctx.fillRect(0, 0, WORLD.WIDTH, 46);
    }
  }

  return {
    draw,
    burst,
    debugLayout() {
      return { width: WORLD.WIDTH, height: WORLD.HEIGHT, groundY: WORLD.GROUND_Y };
    },
  };
}
