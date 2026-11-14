// Canvas 2D 渲染：AI 场景整幅铺底，缺失回退程序化火柴人场景（按 scene key）。
import { WORLD, SCENE, COLORS } from '../../config/game.config.js';
import { ART } from './art.js';

const FONT = '"PingFang SC","Hiragino Sans GB","Microsoft YaHei","Segoe UI",sans-serif';

function stickman(ctx, x, y, s, pose = 'stand', color = COLORS.stick) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = s * 0.12;
  ctx.lineCap = 'round';
  const headR = s * 0.22;
  const headY = y - s * 0.78;
  ctx.beginPath();
  ctx.arc(x, headY, headR, 0, Math.PI * 2);
  ctx.stroke();
  const neckY = headY + headR;
  const hipY = y - s * 0.32;
  ctx.beginPath();
  ctx.moveTo(x, neckY);
  ctx.lineTo(x, hipY);
  ctx.stroke();
  // 手臂
  ctx.beginPath();
  if (pose === 'arms-up') {
    ctx.moveTo(x, neckY + s * 0.08); ctx.lineTo(x - s * 0.3, neckY - s * 0.2);
    ctx.moveTo(x, neckY + s * 0.08); ctx.lineTo(x + s * 0.3, neckY - s * 0.2);
  } else if (pose === 'run') {
    ctx.moveTo(x, neckY + s * 0.1); ctx.lineTo(x - s * 0.3, neckY + s * 0.3);
    ctx.moveTo(x, neckY + s * 0.1); ctx.lineTo(x + s * 0.32, neckY);
  } else if (pose === 'crawl') {
    ctx.moveTo(x, neckY + s * 0.1); ctx.lineTo(x + s * 0.35, y);
    ctx.moveTo(x, neckY + s * 0.1); ctx.lineTo(x - s * 0.2, y);
  } else {
    ctx.moveTo(x, neckY + s * 0.1); ctx.lineTo(x - s * 0.26, hipY);
    ctx.moveTo(x, neckY + s * 0.1); ctx.lineTo(x + s * 0.26, hipY);
  }
  ctx.stroke();
  // 腿
  ctx.beginPath();
  if (pose === 'sit') {
    ctx.moveTo(x, hipY); ctx.lineTo(x + s * 0.3, hipY); ctx.lineTo(x + s * 0.3, y);
    ctx.moveTo(x, hipY); ctx.lineTo(x - s * 0.2, y);
  } else if (pose === 'run') {
    ctx.moveTo(x, hipY); ctx.lineTo(x - s * 0.3, y);
    ctx.moveTo(x, hipY); ctx.lineTo(x + s * 0.32, y - s * 0.1);
  } else if (pose === 'fallen') {
    ctx.moveTo(x, hipY); ctx.lineTo(x - s * 0.35, y - s * 0.05);
    ctx.moveTo(x, hipY); ctx.lineTo(x + s * 0.3, y);
  } else {
    ctx.moveTo(x, hipY); ctx.lineTo(x - s * 0.2, y);
    ctx.moveTo(x, hipY); ctx.lineTo(x + s * 0.2, y);
  }
  ctx.stroke();
  if (pose === 'fallen') {
    ctx.font = `${s * 0.2}px ${FONT}`;
    ctx.textAlign = 'center';
    ctx.fillText('✕ ✕', x, headY + s * 0.06);
  }
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let textures = {};
  let progress = { done: 0, total: 0 };

  function setTextures(tex) { textures = tex || {}; }
  function setProgress(done, total) { progress = { done, total }; }

  // 整幅铺底：cover 裁剪到 1280×720，按 manifest pivot 对齐（top/bottom/center）。
  function drawCover(img, pivot) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    if (!iw || !ih) return;
    const scale = Math.max(WORLD.WIDTH / iw, WORLD.HEIGHT / ih);
    const dw = iw * scale;
    const dh = ih * scale;
    let dx = (WORLD.WIDTH - dw) / 2;
    let dy = (WORLD.HEIGHT - dh) / 2;
    if (pivot === 'top') dy = 0;
    else if (pivot === 'bottom') dy = WORLD.HEIGHT - dh;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  function sky(groundY = 280) {
    const g = ctx.createLinearGradient(0, 0, 0, SCENE.H);
    g.addColorStop(0, COLORS.sky);
    g.addColorStop(1, COLORS.bgGlow);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, SCENE.W, SCENE.H);
    ctx.fillStyle = COLORS.ground;
    ctx.fillRect(0, groundY, SCENE.W, SCENE.H - groundY);
  }

  function bars(x, y, w, h) {
    ctx.strokeStyle = '#4a5560';
    ctx.lineWidth = 8;
    for (let i = 0; i <= 5; i += 1) {
      const bx = x + (i / 5) * w;
      ctx.beginPath(); ctx.moveTo(bx, y); ctx.lineTo(bx, y + h); ctx.stroke();
    }
  }

  function drawScene(scene) {
    switch (scene) {
      case 'cell':
        sky();
        bars(820, 60, 300, 220);
        stickman(ctx, 420, 280, 150, 'sit');
        ctx.fillStyle = COLORS.accent;
        ctx.beginPath(); ctx.arc(620, 272, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(620, 268, 26, 5);
        break;
      case 'corridor':
        sky();
        ctx.fillStyle = '#222c38';
        ctx.fillRect(0, 40, SCENE.W, 30);
        for (let i = 0; i < 6; i += 1) { ctx.fillStyle = '#3a4654'; ctx.fillRect(120 + i * 200, 70, 14, 210); }
        stickman(ctx, 640, 280, 150, 'run');
        break;
      case 'sewer':
        sky(300);
        ctx.fillStyle = '#3a4654';
        ctx.beginPath(); ctx.arc(640, 200, 120, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#101418';
        ctx.beginPath(); ctx.arc(640, 200, 92, 0, Math.PI * 2); ctx.fill();
        stickman(ctx, 640, 280, 110, 'crawl');
        break;
      case 'guard':
        sky();
        stickman(ctx, 760, 280, 210, 'stand', '#fb7185');
        stickman(ctx, 460, 280, 140, 'stand');
        break;
      case 'yard':
        sky();
        ctx.strokeStyle = '#4a5560'; ctx.lineWidth = 5;
        for (let i = 0; i < 14; i += 1) { ctx.beginPath(); ctx.moveTo(60 + i * 40, 80); ctx.lineTo(60 + i * 40, 280); ctx.stroke(); }
        ctx.beginPath(); ctx.moveTo(60, 90); ctx.lineTo(580, 90); ctx.stroke();
        ctx.fillStyle = '#3a4654'; ctx.fillRect(820, 160, 300, 120);
        ctx.fillStyle = '#222c38'; ctx.fillRect(1080, 120, 90, 80);
        ctx.fillStyle = '#101418';
        ctx.beginPath(); ctx.arc(880, 285, 22, 0, Math.PI * 2); ctx.arc(1060, 285, 22, 0, Math.PI * 2); ctx.fill();
        stickman(ctx, 700, 280, 130, 'sneak');
        break;
      case 'roof':
        sky(300);
        ctx.fillStyle = '#222c38'; ctx.fillRect(0, 280, 600, 60);
        ctx.strokeStyle = COLORS.accent; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.moveTo(560, 120); ctx.lineTo(1240, 200); ctx.stroke();
        stickman(ctx, 400, 280, 140, 'stand');
        // 狗
        ctx.fillStyle = '#fb7185';
        ctx.fillRect(820, 240, 90, 40);
        ctx.beginPath(); ctx.arc(910, 235, 22, 0, Math.PI * 2); ctx.fill();
        ctx.fillRect(824, 280, 10, 24); ctx.fillRect(896, 280, 10, 24);
        break;
      case 'truck':
        sky();
        ctx.fillStyle = '#3a4654'; ctx.fillRect(380, 120, 480, 160);
        ctx.fillStyle = '#222c38'; ctx.fillRect(860, 150, 120, 130);
        ctx.fillStyle = '#101418';
        ctx.beginPath(); ctx.arc(460, 285, 26, 0, Math.PI * 2); ctx.arc(800, 285, 26, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = COLORS.accent;
        ctx.fillRect(430, 160, 60, 60); ctx.fillRect(510, 180, 50, 40);
        stickman(ctx, 640, 250, 90, 'sit', COLORS.accent);
        break;
      case 'tunnel':
        sky(300);
        ctx.fillStyle = '#3a4654';
        ctx.beginPath(); ctx.arc(420, 200, 120, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#101418';
        ctx.beginPath(); ctx.arc(420, 200, 92, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e3a5f';
        ctx.fillRect(700, 240, 580, 60);
        stickman(ctx, 600, 280, 120, 'crawl');
        break;
      case 'win':
        sky();
        ctx.fillStyle = COLORS.accent;
        ctx.beginPath(); ctx.arc(1080, 90, 50, 0, Math.PI * 2); ctx.fill();
        stickman(ctx, 640, 280, 160, 'arms-up', COLORS.good);
        break;
      case 'fail':
        sky();
        stickman(ctx, 640, 280, 160, 'fallen', COLORS.danger);
        break;
      default:
        sky();
        stickman(ctx, 640, 280, 150, 'stand');
    }
  }

  function render(view) {
    ctx.fillStyle = COLORS.bg;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const scene = view.scene || 'cell';
    const img = textures[scene];
    if (img) drawCover(img, ART[scene]?.pivot || 'top');
    else drawScene(scene);
    // 场景下缘分隔
    ctx.fillStyle = 'rgba(0,0,0,0.3)';
    ctx.fillRect(0, SCENE.H - 6, SCENE.W, 6);
    // 预载进度条
    if (progress.total > 0 && progress.done < progress.total) {
      const w = 160;
      const h = 6;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(WORLD.WIDTH - w - 12, 12, w, h);
      ctx.fillStyle = COLORS.accent;
      ctx.fillRect(WORLD.WIDTH - w - 12, 12, w * (progress.done / progress.total), h);
    }
  }

  return { render, setTextures, setProgress };
}
