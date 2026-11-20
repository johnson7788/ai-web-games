// src/render/scene.js — 三场景包程序化背景（绿野青 / 雪原白蓝 / 灰烬暗红）
// 换章必换：色板 + 构图 + 装饰（不是换色）。
const SCENES = {
  meadow: {
    sky: ['#9fe0c0', '#dff6e6'],
    ground: ['#3f8f68', '#6fbf8f'],
    accent: '#2f6f4f',
    hill: '#5aa87c',
  },
  snow: {
    sky: ['#7fb4d0', '#e6f2f8'],
    ground: ['#b7cfe0', '#eef4f8'],
    accent: '#7fa8c0',
    hill: '#cfe0ec',
  },
  ash: {
    sky: ['#2a1c20', '#4a2f33'],
    ground: ['#3a2226', '#6b3a3f'],
    accent: '#c96a4a',
    hill: '#4d2c30',
  },
};

export function sceneOf(chapter) {
  return chapter === 1 ? 'meadow' : chapter === 2 ? 'snow' : 'ash';
}

function hills(ctx, w, h, colors, time) {
  for (let i = 0; i < 3; i += 1) {
    const base = h * 0.62 + i * 42;
    ctx.fillStyle = colors[i % colors.length];
    ctx.beginPath();
    ctx.moveTo(0, h);
    for (let x = 0; x <= w; x += 40) {
      const y = base - Math.sin(x * 0.008 + i * 2 + time * 0.0006) * (26 - i * 7);
      ctx.lineTo(x, y);
    }
    ctx.lineTo(w, h);
    ctx.closePath();
    ctx.fill();
  }
}

export function drawScene(ctx, scene, time) {
  const S = SCENES[scene] || SCENES.meadow;
  const w = ctx.canvas.width;
  const h = ctx.canvas.height;

  // 天空
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, S.sky[0]);
  sky.addColorStop(1, S.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // 远景山丘
  hills(ctx, w, h, [S.hill, S.ground[0], S.ground[1]], time);

  // 地面
  ctx.fillStyle = S.ground[1];
  ctx.fillRect(0, h * 0.78, w, h * 0.22);

  // 装饰（构图差异：绿野=树+草，雪原=雪堆+冰晶，灰烬=岩+余烬）
  if (scene === 'meadow') {
    for (let i = 0; i < 9; i += 1) {
      const x = (i * 173 + 40) % w;
      const y = h * 0.72 + (i % 3) * 14;
      ctx.fillStyle = '#2f6f4f';
      ctx.fillRect(x - 4, y - 26, 8, 26);
      ctx.fillStyle = '#3f9f68';
      ctx.beginPath();
      ctx.arc(x, y - 32, 16, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#2f6f4f';
    for (let i = 0; i < 60; i += 1) {
      const x = (i * 37) % w;
      const y = h * 0.86 + ((i * 13) % 40);
      ctx.fillRect(x, y, 3, 8);
    }
  } else if (scene === 'snow') {
    for (let i = 0; i < 7; i += 1) {
      const x = (i * 197 + 70) % w;
      const y = h * 0.74 + (i % 3) * 16;
      ctx.fillStyle = '#eaf4fa';
      ctx.beginPath();
      ctx.ellipse(x, y, 42, 16, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.ellipse(x - 20, y - 14, 18, 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = '#dcecf4';
    ctx.lineWidth = 2;
    for (let i = 0; i < 12; i += 1) {
      const x = (i * 151) % w;
      const y = h * 0.6 + ((i * 23) % 90);
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + 14, y);
      ctx.moveTo(x + 7, y - 10);
      ctx.lineTo(x + 7, y + 10);
      ctx.stroke();
    }
  } else {
    for (let i = 0; i < 8; i += 1) {
      const x = (i * 167 + 55) % w;
      const y = h * 0.72 + (i % 3) * 16;
      ctx.fillStyle = '#3a2226';
      ctx.beginPath();
      ctx.moveTo(x - 24, y + 18);
      ctx.lineTo(x - 12, y - 18);
      ctx.lineTo(x, y - 4);
      ctx.lineTo(x + 12, y - 20);
      ctx.lineTo(x + 24, y + 18);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = S.accent;
    for (let i = 0; i < 26; i += 1) {
      const x = (i * 97 + 20) % w;
      const y = h * 0.8 + ((i * 17) % 60);
      const flick = Math.sin(time * 0.004 + i) * 0.4 + 0.6;
      ctx.globalAlpha = flick;
      ctx.beginPath();
      ctx.arc(x, y, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }
}
