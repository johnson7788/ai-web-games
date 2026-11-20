// Canvas 2D 渲染：山间学堂三场景（春日山舍 / 夏夜萤院 / 冬雪书馆）、科目卡、课时槽、小熊猫村童、放榜灯笼。
// 只消费 run.state + view（hoverSubject/hoverSlot/fxQueue/shake/sceneKey/clock）。
// 像素换算全部在此完成（sim 只给 subject 字符串与归一化数值）。
// 契约 API：createRenderer(canvas) → { draw(state, dt, view), debugLayout() }。

import { WORLD } from '../../config/game.config.js';
import { SUBJECTS, SUBJECT_ORDER, STUDENTS } from '../../config/game.config.js';
import { levelOf, LEVEL_COUNT } from '../../config/levels.js';

const HUD_H = 44;

const SCENE_PALETTES = {
  spring: {
    skyTop: '#BFE8D0', skyBot: '#EAF6D8', hillFar: '#9CCB8A', hillNear: '#7FB56B',
    ground: '#8FC46F', card: '#FFF6E0', cardBorder: '#C98A4B', ink: '#3A2A1A',
    accent: '#F2A6B8', glow: 'rgba(255,220,150,0.5)',
  },
  summer: {
    skyTop: '#0E2A45', skyBot: '#1B4A6A', hillFar: '#123A50', hillNear: '#0D2C3E',
    ground: '#1E4A5C', card: '#FFF2D6', cardBorder: '#D9A05B', ink: '#12212B',
    accent: '#FFD26A', glow: 'rgba(120,220,180,0.35)',
  },
  winter: {
    skyTop: '#C8DDF0', skyBot: '#EAF2FA', hillFar: '#A8C4DC', hillNear: '#8FB2CE',
    ground: '#EAF2FA', card: '#FFF8EC', cardBorder: '#7A93A8', ink: '#2B3A48',
    accent: '#FF8A6A', glow: 'rgba(255,200,120,0.5)',
  },
};

function seededRand(a, b, seed = 7) {
  let x = (a * 73856093) ^ (b * 19349663) ^ (seed * 83492791);
  x = (x ^ (x >>> 13)) >>> 0;
  x = (x * 1274126177) >>> 0;
  return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

// ---------------------------------------------------------------- 背景缓存
const bgCache = new Map();
function getBackground(sceneKey) {
  let c = bgCache.get(sceneKey);
  if (c) return c;
  c = document.createElement('canvas');
  c.width = WORLD.WIDTH;
  c.height = WORLD.HEIGHT;
  drawBackground(c.getContext('2d'), sceneKey);
  bgCache.set(sceneKey, c);
  return c;
}

function drawBackground(g, sceneKey) {
  const P = SCENE_PALETTES[sceneKey] || SCENE_PALETTES.spring;
  const W = WORLD.WIDTH, H = WORLD.HEIGHT;
  const sky = g.createLinearGradient(0, 0, 0, H);
  sky.addColorStop(0, P.skyTop);
  sky.addColorStop(1, P.skyBot);
  g.fillStyle = sky;
  g.fillRect(0, 0, W, H);

  // 远山两层
  drawHills(g, P.hillFar, H * 0.5, 60, 0, 0.5);
  drawHills(g, P.hillNear, H * 0.62, 46, 2, 0.7);

  if (sceneKey === 'spring') drawCottage(g, 100, 300, P);
  else if (sceneKey === 'summer') drawCourtyard(g, 90, 310, P);
  else drawStudyHall(g, 110, 300, P);

  // 地面
  g.fillStyle = P.ground;
  g.fillRect(0, H * 0.72, W, H * 0.28);
  if (sceneKey === 'winter') {
    g.fillStyle = 'rgba(255,255,255,0.55)';
    g.fillRect(0, H * 0.74, W, H * 0.26);
  }
}

function drawHills(g, color, baseY, amp, seed, alpha) {
  g.save();
  g.globalAlpha = alpha;
  g.fillStyle = color;
  g.beginPath();
  g.moveTo(0, WORLD.HEIGHT);
  for (let i = 0; i <= 8; i += 1) {
    const x = (WORLD.WIDTH / 8) * i;
    g.lineTo(x, baseY - Math.sin(i * 1.6 + seed) * amp - seededRand(i, seed, 5) * 30);
  }
  g.lineTo(WORLD.WIDTH, WORLD.HEIGHT);
  g.closePath();
  g.fill();
  g.restore();
}

function drawCottage(g, x, y, P) {
  g.fillStyle = '#C9864B';
  g.fillRect(x, y + 30, 190, 120);
  g.fillStyle = '#A9653B';
  g.beginPath(); g.moveTo(x - 14, y + 32); g.lineTo(x + 95, y - 20); g.lineTo(x + 204, y + 32); g.closePath(); g.fill();
  g.fillStyle = '#7A4A26';
  g.fillRect(x + 74, y + 86, 46, 64);
  g.fillStyle = '#FFE9A0';
  g.fillRect(x + 20, y + 52, 30, 30);
  // 樱花瓣
  for (let i = 0; i < 14; i += 1) {
    const px = 40 + seededRand(i, 1, 11) * 300;
    const py = 60 + seededRand(i, 2, 13) * 180;
    g.fillStyle = `rgba(242,166,184,${0.4 + seededRand(i, 3, 17) * 0.5})`;
    g.beginPath(); g.arc(px, py, 3 + seededRand(i, 4, 19) * 3, 0, Math.PI * 2); g.fill();
  }
}

function drawCourtyard(g, x, y, P) {
  g.fillStyle = '#3A5A6A';
  g.fillRect(x, y + 40, 200, 110);
  g.fillStyle = '#2E4856';
  g.beginPath(); g.moveTo(x - 12, y + 42); g.lineTo(x + 100, y - 6); g.lineTo(x + 212, y + 42); g.closePath(); g.fill();
  // 纸灯笼
  for (let i = 0; i < 4; i += 1) {
    const lx = x + 20 + i * 50, ly = y + 10;
    g.fillStyle = '#FF8A5C';
    g.beginPath(); g.ellipse(lx, ly, 14, 18, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FFE08A';
    g.beginPath(); g.ellipse(lx, ly, 8, 12, 0, 0, Math.PI * 2); g.fill();
  }
}

function drawStudyHall(g, x, y, P) {
  g.fillStyle = '#7A93A8';
  g.fillRect(x, y + 40, 200, 110);
  g.fillStyle = '#5F7A90';
  g.beginPath(); g.moveTo(x - 12, y + 42); g.lineTo(x + 100, y - 2); g.lineTo(x + 212, y + 42); g.closePath(); g.fill();
  g.fillStyle = '#FFE9A0';
  g.fillRect(x + 22, y + 60, 36, 36);
  g.fillRect(x + 84, y + 60, 36, 36);
  g.fillRect(x + 146, y + 60, 36, 36);
}

// ---------------------------------------------------------------- 小熊猫
function drawPanda(ctx, cx, cy, size, pose, clock, talent) {
  const s = size / 120;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(s, s);
  const bob = Math.sin(clock * 2.2) * 2;
  const jump = pose === 'cheer' ? Math.abs(Math.sin(clock * 6)) * -10 : 0;
  ctx.translate(0, bob + jump);

  // 身体
  ctx.fillStyle = '#F2EFE6';
  ctx.beginPath(); ctx.ellipse(0, 34, 30, 26, 0, 0, Math.PI * 2); ctx.fill();
  // 头
  ctx.fillStyle = '#FBF8F0';
  ctx.beginPath(); ctx.arc(0, -6, 30, 0, Math.PI * 2); ctx.fill();
  // 耳朵
  ctx.fillStyle = '#3A2A1A';
  ctx.beginPath(); ctx.arc(-20, -30, 11, 0, Math.PI * 2); ctx.arc(20, -30, 11, 0, Math.PI * 2); ctx.fill();
  // 黑眼圈
  ctx.fillStyle = '#3A2A1A';
  ctx.beginPath(); ctx.ellipse(-12, -10, 11, 13, 0.3, 0, Math.PI * 2); ctx.ellipse(12, -10, 11, 13, -0.3, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath(); ctx.arc(-10, -12, 3.4, 0, Math.PI * 2); ctx.arc(14, -12, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#2A1A0C';
  ctx.beginPath(); ctx.arc(-10, -11, 1.6, 0, Math.PI * 2); ctx.arc(14, -11, 1.6, 0, Math.PI * 2); ctx.fill();
  // 鼻子嘴巴
  ctx.fillStyle = '#2A1A0C';
  ctx.beginPath(); ctx.arc(2, 2, 3.4, 0, Math.PI * 2); ctx.fill();
  ctx.strokeStyle = '#2A1A0C'; ctx.lineWidth = 1.6;
  ctx.beginPath(); ctx.moveTo(2, 5); ctx.quadraticCurveTo(0, 9, -5, 8); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(2, 5); ctx.quadraticCurveTo(5, 9, 9, 8); ctx.stroke();
  // 黑臂
  ctx.fillStyle = '#3A2A1A';
  ctx.beginPath(); ctx.ellipse(-28, 30, 9, 14, 0.4, 0, Math.PI * 2); ctx.ellipse(28, 30, 9, 14, -0.4, 0, Math.PI * 2); ctx.fill();
  // 天赋徽记
  const colors = { study: '#4A7FD0', martial: '#D0554A', trip: '#3A9A62', rest: '#C98A4B' };
  ctx.fillStyle = colors[talent] || '#888';
  ctx.beginPath(); ctx.arc(0, -38, 7, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

// ---------------------------------------------------------------- 布局
function computeLayout() {
  const cardW = 268, cardX = 20, cardStartY = 74, cardH = 138, cardGap = 10;
  const cards = SUBJECT_ORDER.map((id, i) => ({ id, x: cardX, y: cardStartY + i * (cardH + cardGap), w: cardW, h: cardH }));
  const rx = 310, rw = WORLD.WIDTH - rx - 20;
  const goal = { x: rx, y: 74, w: rw, h: 46 };
  const feature = { x: rx, y: 126, w: rw, h: 22 };
  const slotY = 158, slotH = 118, slotW = 172, slotGap = 14;
  const slots = [];
  for (let i = 0; i < 5; i += 1) slots.push({ x: rx + i * (slotW + slotGap), y: slotY, w: slotW, h: slotH });
  const students = STUDENTS.map((s, i) => ({ ...s, x: rx + 15 + i * 184, y: 330, w: 150, h: 240 }));
  return { hudH: HUD_H, cards, goal, feature, slots, students, endWeekBtn: { x: cardX, y: 618, w: cardW, h: 64 } };
}

const SUBJECT_ICON = { study: '算', martial: '武', trip: '游', rest: '休' };
const SUBJECT_ICON_EN = { study: '123', martial: '⛰', trip: '✈', rest: '☾' };

function drawSubjectCard(ctx, rect, subject, state, view, clock) {
  const sub = SUBJECTS[subject];
  const hover = view.hoverSubject === subject;
  const disabled = state.energy < sub.energyCost || state.coins < sub.coinCost;
  ctx.fillStyle = disabled ? 'rgba(200,190,170,0.5)' : '#FFF6E0';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);
  ctx.fill();
  ctx.lineWidth = hover ? 4 : 2;
  ctx.strokeStyle = hover ? '#FFB13C' : '#C98A4B';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 16);
  ctx.stroke();

  // 图标
  ctx.fillStyle = '#3A2A1A';
  ctx.font = '800 40px sans-serif';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText(SUBJECT_ICON[subject], rect.x + 16, rect.y + 18);
  // 名称（英文用短词）
  ctx.font = '800 22px sans-serif';
  ctx.fillText(SUBJECT_ICON_EN[subject], rect.x + 66, rect.y + 20);

  // 效果行
  ctx.font = '700 15px sans-serif';
  ctx.fillStyle = '#6A4A2A';
  let line1 = '';
  if (subject === 'rest') line1 = `+${sub.energyRegen}⚡ +${sub.moodDelta}☺`;
  else line1 = `+${sub.attr === 'grades' ? 'G' : sub.attr === 'fitness' ? 'F' : 'R'}${gainLabel(state, subject)}`;
  ctx.fillText(line1, rect.x + 16, rect.y + 74);
  // 消耗
  const costs = [];
  if (sub.energyCost) costs.push(`${sub.energyCost}⚡`);
  if (sub.coinCost) costs.push(`${sub.coinCost}🪙`);
  if (sub.moodDelta < 0) costs.push(`${sub.moodDelta}☺`);
  ctx.fillStyle = '#B0562A';
  ctx.fillText(costs.join('  '), rect.x + 16, rect.y + 100);
}

function gainLabel(state, subject) {
  // 显示当前每周实际成长（含天赋）
  const sub = SUBJECTS[subject];
  let mult = 1;
  if (levelOf(state.week).feature === 'studyWindow' && subject === 'trip') mult = 2;
  const talentMult = state.week >= 4 ? 2 : 1;
  const cnt = STUDENTS.filter((s) => s.talent === subject).length;
  const g = Math.round((sub.base + sub.talentBonus * cnt * talentMult) * mult);
  return g;
}

function drawSlotChip(ctx, rect, subject, index, view) {
  const hover = view.hoverSlot === index;
  ctx.fillStyle = subject ? '#FFF2D0' : 'rgba(255,255,255,0.25)';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
  ctx.fill();
  ctx.lineWidth = hover ? 4 : 2;
  ctx.strokeStyle = hover ? '#FFB13C' : subject ? '#C98A4B' : 'rgba(255,255,255,0.5)';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 14);
  ctx.stroke();
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.font = '800 15px sans-serif';
  ctx.fillText(`#${index + 1}`, rect.x + rect.w / 2, rect.y + 10);
  if (subject) {
    ctx.fillStyle = '#3A2A1A';
    ctx.font = '800 34px sans-serif';
    ctx.fillText(SUBJECT_ICON[subject], rect.x + rect.w / 2, rect.y + 34);
  } else {
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.font = '700 16px sans-serif';
    ctx.fillText('+', rect.x + rect.w / 2, rect.y + 40);
  }
}

function drawGoalBanner(ctx, rect, state, t) {
  const lv = levelOf(state.week);
  const goal = lv.goal;
  ctx.fillStyle = 'rgba(20,16,8,0.82)';
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,216,78,0.6)';
  ctx.lineWidth = 1.5;
  roundRect(ctx, rect.x, rect.y, rect.w, rect.h, 12);
  ctx.stroke();
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = '#FFE08A';
  ctx.font = '800 20px sans-serif';
  const attrNames = { grades: 'G', fitness: 'F', mood: 'M', reputation: 'R' };
  ctx.fillText(`W${state.week} · ${attrNames[goal.attr]} ≥ ${goal.threshold}`, rect.x + 16, rect.y + rect.h / 2);
  // 特征
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '700 15px sans-serif';
  ctx.fillText(state.feature || '', rect.x + rect.w - 16, rect.y + rect.h / 2);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  let clock = 0;
  let lastState = null;

  function debugLayout() {
    return computeLayout();
  }

  function drawTitleScene() {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.drawImage(getBackground('spring'), 0, 0);
    // 标题屏放 3 只小熊猫
    drawPanda(ctx, WORLD.WIDTH / 2 - 160, 560, 110, 'idle', clock, 'study');
    drawPanda(ctx, WORLD.WIDTH / 2, 570, 120, 'idle', clock + 1, 'martial');
    drawPanda(ctx, WORLD.WIDTH / 2 + 160, 560, 110, 'idle', clock + 2, 'trip');
  }

  function draw(state, dt, view) {
    if (!state || !state.week) { drawTitleScene(); return; }
    const v = view || {};
    clock += dt || 0;
    lastState = state;

    const L = computeLayout();
    const sceneKey = state.scene || levelOf(state.week).scene;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.save();
    if (v.shake && v.shake > 0) {
      ctx.translate((Math.random() * 2 - 1) * v.shake, (Math.random() * 2 - 1) * v.shake);
    }
    ctx.drawImage(getBackground(sceneKey), 0, 0);

    // 场景动效
    if (sceneKey === 'summer') drawFireflies(ctx, clock);
    else if (sceneKey === 'winter') drawSnow(ctx, clock);
    else drawPetals(ctx, clock);

    // 科目卡
    for (const card of L.cards) drawSubjectCard(ctx, card, card.id, state, v, clock);
    // 课时槽
    for (let i = 0; i < state.slotsPerWeek; i += 1) {
      drawSlotChip(ctx, L.slots[i], state.slots[i] || null, i, v);
    }
    // 目标横幅
    drawGoalBanner(ctx, L.goal, state, clock);
    // 学生
    for (let i = 0; i < L.students.length; i += 1) {
      const stu = L.students[i];
      const pose = state.phase === 'won' ? 'cheer' : 'idle';
      drawPanda(ctx, stu.x + stu.w / 2, stu.y + 60, 120, pose, clock + i, stu.talent);
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.font = '700 14px sans-serif';
      ctx.fillText(stu.name, stu.x + stu.w / 2, stu.y + 150);
    }

    // 第 12 周放榜灯笼
    if (state.week === 12 || state.phase === 'won') drawLanterns(ctx, state, clock);

    ctx.restore();
  }

  function drawFireflies(ctx, clock) {
    for (let i = 0; i < 10; i += 1) {
      const fx = 320 + seededRand(i, 1, 13) * 920;
      const fy = 60 + Math.sin(clock * 1.2 + i * 2.1) * 40 + seededRand(i, 2, 17) * 60;
      const a = 0.3 + Math.sin(clock * 2.6 + i) * 0.25;
      ctx.fillStyle = `rgba(190,255,160,${Math.max(0, a)})`;
      ctx.beginPath(); ctx.arc(fx, fy, 2.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawSnow(ctx, clock) {
    for (let i = 0; i < 40; i += 1) {
      const fx = seededRand(i, 3, 23) * WORLD.WIDTH;
      const fy = (seededRand(i, 4, 29) * WORLD.HEIGHT + clock * 24) % WORLD.HEIGHT;
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath(); ctx.arc(fx, fy, 2 + seededRand(i, 5, 31) * 2, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawPetals(ctx, clock) {
    for (let i = 0; i < 14; i += 1) {
      const fx = seededRand(i, 6, 37) * WORLD.WIDTH;
      const fy = (seededRand(i, 7, 41) * 400 + clock * 30) % 400;
      ctx.fillStyle = 'rgba(242,166,184,0.6)';
      ctx.beginPath(); ctx.arc(fx, fy, 2.5, 0, Math.PI * 2); ctx.fill();
    }
  }

  function drawLanterns(ctx, state, clock) {
    const r = state.result?.ranking || [];
    for (let i = 0; i < STUDENTS.length; i += 1) {
      const stu = STUDENTS[i];
      const passed = r[i]?.passed ?? (state.attrs.grades >= 70);
      const lx = 330 + i * 184 + 75;
      const ly = 300;
      const pulse = 0.5 + 0.5 * Math.sin(clock * 3 + i);
      ctx.fillStyle = passed ? `rgba(255,120,70,${0.7 + 0.3 * pulse})` : 'rgba(120,120,120,0.35)';
      ctx.beginPath(); ctx.ellipse(lx, ly, 16, 20, 0, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = passed ? `rgba(255,224,138,${0.7 + 0.3 * pulse})` : 'rgba(160,160,160,0.3)';
      ctx.beginPath(); ctx.ellipse(lx, ly, 9, 13, 0, 0, Math.PI * 2); ctx.fill();
    }
  }

  if (typeof window !== 'undefined') {
    window.__drawTitle = () => drawTitleScene();
  }

  return { draw, debugLayout };
}
