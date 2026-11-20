// src/render/index.js — Canvas 2D 渲染：三场景背景 + 4 赛道 + 跑者 + 残影/冲刺粒子。
// 零外部素材，全部程序化绘制；逻辑坐标 1280×720（letterbox 由 CSS 处理）。
import { WORLD } from '../../config/game.config.js';
import { sceneFor, sceneName } from './theme.js';

const TRACK = { left: 44, right: 1224, top: 200, laneH: 56 };
const FINISH_X = 1188;

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;
  const particles = [];

  function levelOf(run) {
    return run && run.level ? run.level : 1;
  }

  function drawScene(scene, level) {
    const g = ctx.createLinearGradient(0, 0, 0, TRACK.top);
    g.addColorStop(0, scene.skyTop);
    g.addColorStop(1, scene.skyBot);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, TRACK.top);

    // 太阳 / 月亮
    ctx.fillStyle = scene.sun;
    ctx.beginPath();
    ctx.arc(150, 120, 46, 0, Math.PI * 2);
    ctx.fill();

    drawDeco(scene, level);

    // 地面
    ctx.fillStyle = scene.ground;
    ctx.fillRect(0, TRACK.top, WORLD.WIDTH, WORLD.HEIGHT - TRACK.top);
    ctx.fillStyle = scene.groundAlt;
    ctx.fillRect(0, TRACK.top + TRACK.laneH * 4, WORLD.WIDTH, WORLD.HEIGHT - TRACK.top - TRACK.laneH * 4);
  }

  function drawDeco(scene, level) {
    if (scene.deco === 'city') {
      // 城市剪影
      ctx.fillStyle = 'rgba(90,140,180,0.35)';
      for (let i = 0; i < 14; i += 1) {
        const w = 60 + ((i * 37) % 70);
        const h = 70 + ((i * 53) % 110);
        const x = i * 96;
        ctx.fillRect(x, TRACK.top - h, w, h);
      }
    } else if (scene.deco === 'mountain') {
      // 山峦
      ctx.fillStyle = 'rgba(60,120,70,0.45)';
      for (let i = 0; i < 5; i += 1) {
        const cx = 160 + i * 260;
        const r = 120 + (i * 40) % 80;
        ctx.beginPath();
        ctx.moveTo(cx - r, TRACK.top);
        ctx.lineTo(cx, TRACK.top - r - 40);
        ctx.lineTo(cx + r, TRACK.top);
        ctx.closePath();
        ctx.fill();
      }
    } else {
      // 夜城霓虹窗
      ctx.fillStyle = 'rgba(30,36,72,0.9)';
      for (let i = 0; i < 12; i += 1) {
        const w = 74;
        const h = 120 + ((i * 31) % 90);
        const x = i * 108;
        ctx.fillRect(x, TRACK.top - h, w, h);
      }
      const neon = ['#ff2e97', '#2ee6ff', '#ffd166', '#7cf7a0'];
      for (let i = 0; i < 12; i += 1) {
        ctx.fillStyle = neon[i % neon.length];
        for (let r = 0; r < 3; r += 1) {
          const x = i * 108 + 12 + (r % 2) * 26;
          const y = TRACK.top - 120 - ((i * 31) % 90) + 10 + r * 20;
          ctx.fillRect(x, y, 14, 10);
        }
      }
    }
  }

  function drawTrack(scene, run) {
    // 赛道底
    ctx.fillStyle = scene.track;
    ctx.fillRect(TRACK.left - 10, TRACK.top - 8, TRACK.right - TRACK.left + 20, TRACK.laneH * 4 + 16);

    // 分道线
    for (let i = 0; i <= 4; i += 1) {
      const y = TRACK.top + i * TRACK.laneH;
      ctx.strokeStyle = scene.laneEdge;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(TRACK.left, y);
      ctx.lineTo(TRACK.right, y);
      ctx.stroke();
    }

    // 终点线（棋盘格）
    for (let r = 0; r < 4; r += 1) {
      for (let c = 0; c < 3; c += 1) {
        ctx.fillStyle = (r + c) % 2 === 0 ? scene.finishA : scene.finishB;
        const y = TRACK.top + r * TRACK.laneH;
        ctx.fillRect(FINISH_X + c * 12, y, 12, TRACK.laneH);
      }
    }
    ctx.fillStyle = scene.accent;
    ctx.fillRect(FINISH_X - 3, TRACK.top - 8, 3, TRACK.laneH * 4 + 16);
  }

  function drawRunner(x, y, color, isPlayer, scholar, phase) {
    // 剪影跑者：头 + 躯干 + 摆动腿（简单但一眼可辨）
    const bob = Math.sin(phase * 10) * 3;
    ctx.save();
    ctx.translate(x, y + bob);

    // 影
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 18, 20, 5, 0, 0, Math.PI * 2);
    ctx.fill();

    // 残影光环（学霸冲刺 / 玩家强调）
    if (isPlayer) {
      ctx.fillStyle = scholar ? 'rgba(255,220,90,0.55)' : 'rgba(255,255,255,0.18)';
      ctx.beginPath();
      ctx.arc(0, -6, scholar ? 26 : 20, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.fillStyle = color;
    // 头
    ctx.beginPath();
    ctx.arc(0, -16, 8, 0, Math.PI * 2);
    ctx.fill();
    // 躯干
    ctx.beginPath();
    ctx.moveTo(-4, -9);
    ctx.lineTo(4, -9);
    ctx.lineTo(6, 8);
    ctx.lineTo(-6, 8);
    ctx.closePath();
    ctx.fill();
    // 腿（摆动）
    const legA = Math.sin(phase * 10) * 8;
    const legB = -legA;
    ctx.strokeStyle = color;
    ctx.lineWidth = 5;
    ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(-2, 8); ctx.lineTo(-2 + legA, 20); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(3, 8); ctx.lineTo(3 + legB, 20); ctx.stroke();
    // 臂
    ctx.beginPath(); ctx.moveTo(-6, -6); ctx.lineTo(-10 + legB, 2); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(6, -6); ctx.lineTo(10 + legA, 2); ctx.stroke();

    ctx.restore();
  }

  function drawParticles() {
    for (let i = particles.length - 1; i >= 0; i -= 1) {
      const p = particles[i];
      p.life -= 1;
      if (p.life <= 0) { particles.splice(i, 1); continue; }
      ctx.globalAlpha = Math.max(0, p.life / p.maxLife);
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function draw(run, alpha) {
    alpha = alpha == null ? 1 : alpha;
    const level = levelOf(run);
    const scene = sceneFor(level);

    drawScene(scene, level);

    if (!run) {
      // 标题屏：画一条空赛道 + 一名静立跑者示意
      drawTrack(scene, null);
      drawRunner(200, laneY(1), '#ffd166', true, false, 0);
      return;
    }

    drawTrack(scene, run);

    // 跑者位置：dist/raceDistance → x
    const raceDistance = Math.max(1, run.race ? run.race.distance : 1);
    const trackW = TRACK.right - TRACK.left - 40;
    const px = (d) => TRACK.left + (d / raceDistance) * trackW;

    // AI
    const aiColors = ['#c9d4e0', '#b7c4d4', '#a9b7c9'];
    run.ai.forEach((a, i) => {
      drawRunner(px(a.dist), laneY(i + 1), aiColors[i % aiColors.length], false, false, run.time + i * 1.7);
    });
    // 玩家（赛道 0，最亮）
    const playerColor = run.scholarActive ? '#ffd166' : '#4af0ff';
    drawRunner(px(run.playerDist), laneY(0), playerColor, true, run.scholarActive, run.time);

    // 学霸冲刺：每 2 帧吐一枚残影粒子
    if (run.scholarActive && Math.floor(run.time * 30) % 2 === 0) {
      const x = px(run.playerDist);
      particles.push({ x: x - 18, y: laneY(0), r: 14 + Math.random() * 6, color: 'rgba(255,209,102,0.5)', life: 18, maxLife: 18 });
    }

    drawParticles();
  }

  function laneY(lane) {
    return TRACK.top + lane * TRACK.laneH + TRACK.laneH / 2;
  }

  function playerPos(run) {
    if (!run) return { x: 200, y: laneY(0) };
    const raceDistance = Math.max(1, run.race ? run.race.distance : 1);
    const trackW = TRACK.right - TRACK.left - 40;
    return { x: TRACK.left + (run.playerDist / raceDistance) * trackW, y: laneY(0) };
  }

  return {
    draw,
    playerPos,
    burst(x, y, kind) {
      const colors = { correct: '#4af0ff', wrong: '#ff5d73', surge: '#ffd166', scholar: '#ffd166' };
      const color = colors[kind] || '#ffffff';
      for (let i = 0; i < 10; i += 1) {
        particles.push({
          x: x + (Math.random() - 0.5) * 40,
          y: y + (Math.random() - 0.5) * 30,
          r: 2 + Math.random() * 4,
          color,
          life: 20 + Math.random() * 12,
          maxLife: 32,
        });
      }
    },
    get sceneName() { return sceneName(levelOf(this._lastRun)); },
    setLastRun(run) { this._lastRun = run; },
  };
}
