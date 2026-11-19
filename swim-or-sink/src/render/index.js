// Canvas 2D 渲染：霓虹街机风水下场景（程序化，零素材）。
// 只画背景场景与游泳者剪影；问题 / 选项 / HUD 均为 DOM 层，互不遮挡。
import { WORLD } from '../../config/game.config.js';
import { LEVELS } from '../../config/questions.js';

const SCENES = {
  shallow: { top: '#062a3a', mid: '#0b5a6b', bottom: '#02222b', ray: 'rgba(120,240,255,0.10)', accent: '#5ee0ff' },
  deep:    { top: '#041a30', mid: '#08375c', bottom: '#01121f', ray: 'rgba(90,180,255,0.10)', accent: '#4fd0ff' },
  open:    { top: '#150a30', mid: '#2a1050', bottom: '#0a0418', ray: 'rgba(200,140,255,0.10)', accent: '#b06cff' },
};

function sceneKey(state) {
  if (state && state.level) {
    const lv = LEVELS[state.level - 1];
    if (lv && lv.scene) return lv.scene;
  }
  return 'shallow';
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  // 预生成一组气泡 / 鱼 / 海草，供每帧按时间偏移绘制
  const bubbles = [];
  for (let i = 0; i < 26; i += 1) {
    bubbles.push({
      x: Math.random() * WORLD.WIDTH,
      r: 2 + Math.random() * 6,
      speed: 18 + Math.random() * 30,
      phase: Math.random() * Math.PI * 2,
    });
  }
  const fishes = [];
  for (let i = 0; i < 7; i += 1) {
    fishes.push({
      x: Math.random() * WORLD.WIDTH,
      y: 120 + Math.random() * 360,
      s: 0.6 + Math.random() * 0.9,
      speed: 26 + Math.random() * 40,
      dir: Math.random() < 0.5 ? 1 : -1,
    });
  }
  const kelps = [];
  for (let i = 0; i < 9; i += 1) {
    kelps.push({ x: 40 + i * 150 + Math.random() * 60, h: 90 + Math.random() * 130, phase: Math.random() * Math.PI * 2 });
  }

  function drawScene(state, view) {
    const t = view.time || 0;
    const sc = SCENES[sceneKey(state)];

    // 背景渐变
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, sc.top);
    g.addColorStop(0.55, sc.mid);
    g.addColorStop(1, sc.bottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 光线
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 5; i += 1) {
      const bx = WORLD.WIDTH * (0.12 + i * 0.2);
      const sway = Math.sin(t * 0.4 + i) * 26;
      ctx.fillStyle = sc.ray;
      ctx.beginPath();
      ctx.moveTo(bx + sway, -20);
      ctx.lineTo(bx + 120 + sway, -20);
      ctx.lineTo(bx + 210 + sway, WORLD.HEIGHT + 20);
      ctx.lineTo(bx + 90 + sway, WORLD.HEIGHT + 20);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();

    // 海草
    for (const k of kelps) {
      ctx.strokeStyle = 'rgba(40,180,150,0.35)';
      ctx.lineWidth = 7;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(k.x, WORLD.HEIGHT);
      const bend = Math.sin(t * 1.1 + k.phase) * 24;
      ctx.quadraticCurveTo(k.x + bend, WORLD.HEIGHT - k.h * 0.6, k.x + bend * 1.4, WORLD.HEIGHT - k.h);
      ctx.stroke();
    }

    // 岩石
    ctx.fillStyle = 'rgba(6,20,30,0.9)';
    ctx.beginPath();
    ctx.moveTo(0, WORLD.HEIGHT);
    ctx.lineTo(0, WORLD.HEIGHT - 60);
    ctx.quadraticCurveTo(150, WORLD.HEIGHT - 130, 330, WORLD.HEIGHT - 58);
    ctx.lineTo(360, WORLD.HEIGHT);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = 'rgba(10,26,40,0.95)';
    ctx.beginPath();
    ctx.moveTo(WORLD.WIDTH, WORLD.HEIGHT);
    ctx.lineTo(WORLD.WIDTH, WORLD.HEIGHT - 52);
    ctx.quadraticCurveTo(WORLD.WIDTH - 180, WORLD.HEIGHT - 120, WORLD.WIDTH - 360, WORLD.HEIGHT - 54);
    ctx.lineTo(WORLD.WIDTH - 330, WORLD.HEIGHT);
    ctx.closePath();
    ctx.fill();

    // 鱼
    ctx.fillStyle = 'rgba(140,220,255,0.5)';
    for (const f of fishes) {
      const fx = ((f.x + t * f.speed * f.dir) % (WORLD.WIDTH + 120)) - 60;
      ctx.save();
      ctx.translate(fx, f.y + Math.sin(t * 1.4 + f.x) * 8);
      ctx.scale(f.dir * f.s, f.s);
      ctx.beginPath();
      ctx.moveTo(10, 0);
      ctx.lineTo(-6, -5);
      ctx.lineTo(-6, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }

    // 气泡
    ctx.fillStyle = 'rgba(210,245,255,0.6)';
    for (const b of bubbles) {
      const by = WORLD.HEIGHT - ((t * b.speed + b.phase * 40) % (WORLD.HEIGHT + 60)) + 30;
      const bx = b.x + Math.sin(t * 0.8 + b.phase) * 14;
      ctx.beginPath();
      ctx.arc(bx, by, b.r, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawSwimmer(state, view) {
    // 游泳者剪影：居中偏左，亮度最高；空气越少越往下沉
    const air = state ? state.air : 3;
    const maxAir = state ? state.maxAir : 3;
    const sinkDepth = (maxAir - air) * 26;
    const baseY = 330 + sinkDepth;
    const bob = Math.sin((view.time || 0) * 1.6) * 6;
    const x = WORLD.WIDTH * 0.30;
    const y = baseY + bob;
    const t = view.time || 0;

    ctx.save();
    ctx.translate(x, y);

    // 光晕
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const glow = ctx.createRadialGradient(0, 0, 8, 0, 0, 70);
    glow.addColorStop(0, 'rgba(140,240,255,0.55)');
    glow.addColorStop(1, 'rgba(140,240,255,0)');
    ctx.fillStyle = glow;
    ctx.beginPath();
    ctx.arc(0, 0, 70, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // 身体（仰漂）
    ctx.fillStyle = '#eafcff';
    ctx.strokeStyle = '#9fe9ff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.ellipse(0, 0, 46, 16, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // 头
    ctx.fillStyle = '#eafcff';
    ctx.beginPath();
    ctx.arc(50, -6, 15, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#9fe9ff';
    ctx.stroke();

    // 手臂 / 腿（摆动）
    const limb = Math.sin(t * 2.0) * 12;
    ctx.strokeStyle = '#eafcff';
    ctx.lineWidth = 6;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(-20, -6);
    ctx.lineTo(-40, -6 - limb);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-20, 6);
    ctx.lineTo(-40, 6 + limb);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(38, 4);
    ctx.lineTo(58, 10 + limb);
    ctx.stroke();

    // 呼吸圈（连击越高越亮）
    if (state && state.streak > 0) {
      ctx.strokeStyle = 'rgba(255,220,90,0.9)';
      ctx.lineWidth = 2.5;
      for (let i = 0; i < Math.min(state.streak, 6); i += 1) {
        const rr = 20 + i * 9 + Math.sin(t * 3 + i) * 3;
        ctx.beginPath();
        ctx.arc(0, 0, rr, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  return {
    draw(state, dt, view) {
      view.time = (view.time || 0) + dt;
      ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
      drawScene(state, view);
      drawSwimmer(state, view);
      // 暗角
      const vg = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, WORLD.HEIGHT * 0.42, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, WORLD.HEIGHT * 0.85);
      vg.addColorStop(0, 'rgba(0,0,0,0)');
      vg.addColorStop(1, 'rgba(0,0,0,0.42)');
      ctx.fillStyle = vg;
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    },
  };
}
