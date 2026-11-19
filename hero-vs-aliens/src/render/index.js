// Canvas 2D 渲染：霓虹街机。程序化绘制背景星空、外星人、地雷、弹簧、列车、母舰与英雄。
import { WORLD, HERO, AIM, MAP } from '../../config/game.config.js';
import { LEVELS } from '../../config/levels.js';
import { computeLanding } from '../game/sim.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;
const HERO_SCREEN_Y = H * 0.66;

function lerp(a, b, k) { return a + (b - a) * k; }

// 世界 y → 屏幕 y（英雄固定在中下部，向上爬 = 元素下移）
function wy(elemY, heroY) {
  return HERO_SCREEN_Y - (elemY - heroY);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  // 程序化星空（确定性）
  const stars = [];
  for (let i = 0; i < 120; i += 1) {
    stars.push({
      x: (i * 197) % W,
      y: (i * 89) % (H * 3),
      r: (i % 3) * 0.6 + 0.5,
      a: 0.35 + ((i * 7) % 10) / 25,
      layer: i % 3,
    });
  }

  function drawBackground(heroY) {
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#05040f');
    g.addColorStop(0.55, '#0d0b26');
    g.addColorStop(1, '#1b1240');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);

    // 星星（两层视差）
    for (const s of stars) {
      const par = s.layer === 0 ? 0.25 : s.layer === 1 ? 0.5 : 0.8;
      const y = ((s.y - heroY * par) % (H * 3) + H * 3) % (H * 3) - H;
      if (y < -4 || y > H + 4) continue;
      ctx.globalAlpha = s.a;
      ctx.fillStyle = s.layer === 2 ? '#8fd8ff' : '#e8e6ff';
      ctx.beginPath();
      ctx.arc(s.x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;

    // 底部发射台
    ctx.fillStyle = '#0a1830';
    ctx.fillRect(0, H - 46, W, 46);
    ctx.fillStyle = '#23e0ff';
    ctx.fillRect(0, H - 48, W, 3);
    for (let x = 0; x < W; x += 96) {
      ctx.fillStyle = 'rgba(35,224,255,0.25)';
      ctx.fillRect(x + 40, H - 44, 24, 30);
    }
  }

  function drawAimArrow(theta, heroX) {
    const cx = heroX;
    const cy = HERO_SCREEN_Y;
    const len = 120;
    const rad = (-theta * Math.PI) / 180;
    ctx.save();
    ctx.translate(cx, cy - 14);
    ctx.rotate(rad);
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(0, -len);
    ctx.stroke();
    // 箭头尖
    ctx.fillStyle = '#ffe14d';
    ctx.beginPath();
    ctx.moveTo(0, -len - 12);
    ctx.lineTo(-7, -len);
    ctx.lineTo(7, -len);
    ctx.closePath();
    ctx.fill();
    // 中心瞄点
    ctx.fillStyle = '#23e0ff';
    ctx.beginPath();
    ctx.arc(0, 0, 10, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawHero(hero, hop, dt, view) {
    // 飞行中的插值位置
    let x = hero.x;
    let y = hero.y;
    let z = 0;
    if (hop) {
      const p = clamp01(hop.t / hop.T);
      const { nx } = computeLanding(hero, hop);
      x = lerp(hop.x0, nx, p);
      y = lerp(hop.y0, hero.y, p);
      const t = hop.t;
      z = HERO.LAUNCH_SPEED * t - 0.5 * HERO.GRAVITY * t * t;
    }
    const sx = x;
    const sy = wy(y, hero.y) - z;
    const scale = 1 + Math.max(0, z) / 900;

    // 拖尾
    if (hop && z > 4) {
      ctx.globalAlpha = 0.35;
      const grad = ctx.createLinearGradient(sx, sy, sx, sy + 70);
      grad.addColorStop(0, 'rgba(35,224,255,0)');
      grad.addColorStop(1, 'rgba(35,224,255,0.7)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.ellipse(sx, sy + 40, 14 * scale, 40, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 英雄：霓虹胶囊（最亮）+ 外圈光环，保证剪影主导
    ctx.save();
    ctx.translate(sx, sy);
    ctx.scale(scale, scale);
    ctx.shadowColor = '#23e0ff';
    ctx.shadowBlur = 24;
    ctx.strokeStyle = '#c9fbff';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.arc(0, 0, 30, 0, Math.PI * 2);
    ctx.stroke();
    const hg = ctx.createLinearGradient(0, -22, 0, 22);
    hg.addColorStop(0, '#ffffff');
    hg.addColorStop(0.5, '#23e0ff');
    hg.addColorStop(1, '#0a7bd6');
    ctx.fillStyle = hg;
    ctx.beginPath();
    ctx.fillRect(-17, -24, 34, 48);
    ctx.fill();
    ctx.shadowBlur = 0;
    // 面罩
    ctx.fillStyle = '#06121f';
    ctx.beginPath();
    ctx.fillRect(-11, -14, 22, 18);
    ctx.fill();
    ctx.fillStyle = '#b9f6ff';
    ctx.beginPath();
    ctx.arc(0, -5, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 攻击半径预览（下砸时）
    if (hop && hop.dropQueued) {
      ctx.strokeStyle = 'rgba(255,80,120,0.8)';
      ctx.lineWidth = 2;
      ctx.setLineDash([8, 6]);
      const r = HERO.DROP_RADIUS + hero.E * HERO.DROP_RADIUS_E;
      ctx.beginPath();
      ctx.ellipse(sx, wy(y, hero.y), r, r * 0.35, 0, 0, Math.PI * 2);
      ctx.stroke();
      ctx.setLineDash([]);
    }
  }

  function drawAlien(e, heroY) {
    const sx = e.x;
    const sy = wy(e.y, heroY);
    const r = e.r;
    const colors = e.size >= 3 ? ['#ff9d3c', '#ff5c33'] : e.size >= 2 ? ['#ff4fd8', '#c233ff'] : ['#23e0ff', '#3aa0ff'];
    ctx.save();
    ctx.translate(sx, sy);
    ctx.shadowColor = colors[0];
    ctx.shadowBlur = 12;
    // 底座
    ctx.fillStyle = colors[1];
    ctx.beginPath();
    ctx.ellipse(0, r * 0.35, r, r * 0.34, 0, 0, Math.PI * 2);
    ctx.fill();
    // 穹顶
    const g = ctx.createLinearGradient(0, -r, 0, r * 0.35);
    g.addColorStop(0, colors[0]);
    g.addColorStop(1, colors[1]);
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(0, -r * 0.1, r * 0.62, Math.PI, 0);
    ctx.fill();
    // 眼睛
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#06121f';
    ctx.beginPath();
    ctx.arc(-r * 0.22, -r * 0.08, r * 0.14, 0, Math.PI * 2);
    ctx.arc(r * 0.22, -r * 0.08, r * 0.14, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawCrystal(e, heroY) {
    const sx = e.x;
    const sy = wy(e.y, heroY);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.shadowColor = '#b9f6ff';
    ctx.shadowBlur = 12;
    ctx.fillStyle = '#b9f6ff';
    ctx.beginPath();
    ctx.moveTo(0, -14);
    ctx.lineTo(12, 0);
    ctx.lineTo(0, 14);
    ctx.lineTo(-12, 0);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#4de3ff';
    ctx.beginPath();
    ctx.moveTo(0, -6);
    ctx.lineTo(5, 0);
    ctx.lineTo(0, 6);
    ctx.lineTo(-5, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawSpring(e, heroY) {
    const sx = e.x;
    const sy = wy(e.y, heroY);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.shadowColor = '#5dff9a';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = '#5dff9a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(-16, 8);
    ctx.lineTo(16, 8);
    for (let i = 0; i < 4; i += 1) {
      ctx.lineTo(-16 + (i % 2 ? 0 : 32), 8 - i * 8 - 8);
      ctx.lineTo(-16 + (i % 2 ? 32 : 0), 8 - i * 8 - 16);
    }
    ctx.stroke();
    ctx.restore();
  }

  function drawTrain(e, heroY) {
    const sx = e.x;
    const sy = wy(e.y, heroY);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.fillStyle = '#ffb13c';
    ctx.fillRect(-34, -12, 68, 24);
    ctx.fillStyle = '#fff1c9';
    for (let i = -2; i <= 2; i += 1) ctx.fillRect(i * 14 - 3, -8, 6, 6);
    ctx.restore();
  }

  function drawHazard(e, heroY) {
    const sx = e.x;
    const sy = wy(e.y, heroY);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.shadowColor = '#ff2f3f';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#ff2f3f';
    for (let i = -1; i <= 1; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * 14 - 7, 12);
      ctx.lineTo(i * 14, -10);
      ctx.lineTo(i * 14 + 7, 12);
      ctx.closePath();
      ctx.fill();
    }
    // 红色「!」标记
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 15px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('!', 0, 8);
    ctx.restore();
  }

  function drawBoss(e, heroY, level) {
    const sx = e.x;
    const sy = wy(e.y, heroY);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.shadowColor = '#ff4fd8';
    ctx.shadowBlur = 22;
    const g = ctx.createLinearGradient(0, -54, 0, 20);
    g.addColorStop(0, '#ff4fd8');
    g.addColorStop(1, '#7a1fa0');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.ellipse(0, 0, 70, 26, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(0, -10, 40, Math.PI, 0);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#b9f6ff';
    for (let i = -2; i <= 2; i += 1) {
      ctx.beginPath();
      ctx.arc(i * 22, 4, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawGoalBanner(state) {
    // 顶部目标横幅：始终显示母舰剩余距离（解决「目标不可见」）
    const boss = state.elements.find((e) => e.type === 'boss');
    if (!boss) return;
    const remain = Math.max(0, Math.round((boss.y - state.hero.y) / 10));
    const label = `MOTHERSHIP ${remain}m`;
    ctx.save();
    ctx.font = '900 18px sans-serif';
    const w = ctx.measureText(label).width + 64;
    const cx = W / 2;
    const cy = 68;
    ctx.fillStyle = 'rgba(6, 8, 22, 0.9)';
    ctx.fillRect(cx - w / 2, cy - 17, w, 32);
    ctx.strokeStyle = '#ff4fd8';
    ctx.lineWidth = 2;
    ctx.strokeRect(cx - w / 2, cy - 17, w, 32);
    // 上箭头
    ctx.fillStyle = '#ff4fd8';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 30);
    ctx.lineTo(cx - 10, cy - 17);
    ctx.lineTo(cx + 10, cy - 17);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffd0f0';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, cx, cy);
    ctx.restore();
  }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function draw(state, dt, view = {}) {
    ctx.clearRect(0, 0, W, H);
    const shake = view.shake > 0 ? view.shake * 2 : 0;
    const ox = shake ? (Math.random() - 0.5) * shake : 0;
    const oy = shake ? (Math.random() - 0.5) * shake : 0;
    ctx.save();
    ctx.translate(ox, oy);
    const heroY = state ? state.hero.y : 0;
    drawBackground(heroY);

    if (!state) {
      // 标题屏：待机英雄 + 一组外星人/母舰/水晶/地雷，给标题屏足够可辨的剪影
      const sy = (screenY) => HERO_SCREEN_Y - screenY;
      drawBoss({ x: MAP.CENTER, y: sy(96), r: 78 }, 0, 1);
      drawCrystal({ x: 200, y: sy(180), r: 24 }, 0);
      drawAlien({ x: 300, y: sy(300), r: 26, size: 2 }, 0);
      drawAlien({ x: 520, y: sy(370), r: 20, size: 1 }, 0);
      drawAlien({ x: 800, y: sy(320), r: 26, size: 2 }, 0);
      drawAlien({ x: 1030, y: sy(250), r: 30, size: 3 }, 0);
      drawHazard({ x: 90, y: sy(200), r: 44 }, 0);
      drawHazard({ x: 1190, y: sy(360), r: 44 }, 0);
      drawHero({ x: HERO.START_X, y: 0, E: HERO.E0 }, null, dt, view);
      return;
    }

    // 母舰目标（飞行中始终显示顶部横幅；进入视野则画本体）
    const boss = state.elements.find((e) => e.type === 'boss');
    if (boss && state.phase !== 'won') {
      const sy = wy(boss.y, heroY);
      if (sy >= -90 && sy <= H + 90) {
        drawBoss(boss, heroY, state.level);
      }
      if (state.phase === 'aim' || state.phase === 'flying') {
        drawGoalBanner(state);
      }
    }

    // 元素（只画视野内）
    for (let i = 0; i < state.elements.length; i += 1) {
      const e = state.elements[i];
      if (state.destroyed.has(i)) continue;
      const sy = wy(e.y, heroY);
      if (sy < -90 || sy > H + 90) continue;
      if (e.type === 'boss') continue; // boss 单独画
      if (e.type === 'alien') drawAlien(e, heroY);
      else if (e.type === 'crystal') drawCrystal(e, heroY);
      else if (e.type === 'spring') drawSpring(e, heroY);
      else if (e.type === 'train') drawTrain(e, heroY);
      else if (e.type === 'hazard') drawHazard(e, heroY);
    }

    // 英雄
    drawHero(state.hero, state.hop, dt, view);

    // 瞄准箭头（aim 阶段）
    if (state.phase === 'aim') {
      drawAimArrow(state.aimTheta, state.hero.x);
    }

    ctx.restore();
  }

  return {
    draw,
    debugLayout() {
      // 教程聚光灯用（返回粗略区域）
      return {
        hero: { x: HERO.START_X - 30, y: HERO_SCREEN_Y - 30, w: 60, h: 60 },
        launch: { x: W / 2 - 90, y: HERO_SCREEN_Y - 150, w: 180, h: 120 },
      };
    },
  };
}
