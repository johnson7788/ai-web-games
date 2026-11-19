// 渲染层：霓虹天际线 + 玩家总部塔 + 对手公司卡（canvas 程序化，零素材）。
// draw(state, dt, view)：state 为 sim.state；view 由 main.js 提供光标/震屏/飘字/闪白。
// debugLayout()：返回对手卡片与玩家塔的矩形，供 main 做点击命中与教程聚光。
import { WORLD, LAYOUT } from '../../config/game.config.js';
import { DISTRICTS, GRADES, SLOTS } from '../game/data.js';

const W = WORLD.WIDTH;
const H = WORLD.HEIGHT;

// 顶部 HUD（DOM）与底部动作条（DOM）占位，canvas 内容避开
const TOP = 52;
const BOTTOM_BAR = 74;

const PAL = {
  bg0: '#0a0a18',
  bg1: '#1a1030',
  bg2: '#251a3d',
  cyan: '#22d3ee',
  magenta: '#e879f9',
  gold: '#fbbf24',
  green: '#4ade80',
  red: '#f87171',
  grid: 'rgba(34,211,238,0.14)',
};

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  let dpr = 1;

  function resize() {
    dpr = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    canvas.style.width = '100%';
    canvas.style.height = '100%';
  }
  resize();
  window.addEventListener('resize', resize);

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function skyline(seedShift) {
    // 远处楼群剪影（固定 pseudo-random，不闪烁）
    const g = ctx.createLinearGradient(0, TOP, 0, H - BOTTOM_BAR);
    g.addColorStop(0, PAL.bg0);
    g.addColorStop(0.6, PAL.bg1);
    g.addColorStop(1, PAL.bg2);
    ctx.fillStyle = g;
    ctx.fillRect(0, TOP, W, H - TOP - BOTTOM_BAR);

    // 网格地平线
    ctx.strokeStyle = PAL.grid;
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 48) {
      ctx.beginPath();
      ctx.moveTo(x, TOP);
      ctx.lineTo(x, H - BOTTOM_BAR);
      ctx.stroke();
    }
    for (let y = TOP + 24; y < H - BOTTOM_BAR; y += 48) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(W, y);
      ctx.stroke();
    }
    // 楼群
    let x = 0;
    let i = 0;
    while (x < W) {
      const w = 40 + ((i * 53 + seedShift * 7) % 60);
      const h = 60 + ((i * 37 + seedShift * 13) % 150);
      const y = H - BOTTOM_BAR - h;
      ctx.fillStyle = i % 3 === 0 ? 'rgba(232,121,249,0.08)' : 'rgba(34,211,238,0.06)';
      ctx.fillRect(x, y, w, h);
      // 窗点
      ctx.fillStyle = 'rgba(251,191,36,0.18)';
      for (let wy = y + 8; wy < H - BOTTOM_BAR - 8; wy += 16) {
        for (let wx = x + 6; wx < x + w - 6; wx += 12) {
          if ((wx + wy + i) % 3 === 0) ctx.fillRect(wx, wy, 4, 5);
        }
      }
      x += w + 10;
      i += 1;
    }
  }

  function drawHq(player, rect, t) {
    const { x, y, w, h } = rect;
    // 底座光晕（玩家 = 最亮主体）
    const glow = ctx.createRadialGradient(x + w / 2, y + h / 2, 10, x + w / 2, y + h / 2, w * 0.7);
    glow.addColorStop(0, 'rgba(34,211,238,0.35)');
    glow.addColorStop(1, 'rgba(34,211,238,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(x - w * 0.3, y - h * 0.3, w * 1.6, h * 1.6);

    // 总部塔（层叠方块）
    const floors = Math.min(10, 2 + player.hq.lv);
    const floorH = h / floors;
    for (let f = 0; f < floors; f += 1) {
      const fw = w * (0.6 + 0.4 * (f / floors));
      const fx = x + (w - fw) / 2;
      const fy = y + h - floorH * (f + 1);
      const blink = 0.6 + 0.4 * Math.sin(t * 3 + f);
      ctx.fillStyle = `rgba(34,211,238,${0.5 + 0.3 * (f / floors) * blink})`;
      roundRect(fx, fy, fw, floorH - 2, 4);
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    // 天线
    ctx.strokeStyle = PAL.gold;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w / 2, y - 18);
    ctx.stroke();
    ctx.fillStyle = PAL.gold;
    ctx.beginPath();
    ctx.arc(x + w / 2, y - 20, 3, 0, Math.PI * 2);
    ctx.fill();
  }

  function drawRivalCard(r, rect, state, t, selected) {
    const { x, y, w, h } = rect;
    const alive = r.hp > 0;
    const boss = r.boss;
    const color = boss ? PAL.red : PAL.magenta;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = selected ? 22 : 8;
    ctx.strokeStyle = alive ? color : 'rgba(255,255,255,0.15)';
    ctx.lineWidth = boss ? 3 : 2;
    roundRect(x, y, w, h, 10);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = alive ? 'rgba(10,10,24,0.85)' : 'rgba(10,10,24,0.5)';
    roundRect(x, y, w, h, 10);
    ctx.fill();

    // 名称 + 等级
    const name = r.name.length > 15 ? `${r.name.slice(0, 14)}…` : r.name;
    ctx.fillStyle = alive ? '#e2e8f0' : '#475569';
    ctx.font = `bold 13px 'Segoe UI', system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(name, x + w / 2, y + 16);

    ctx.fillStyle = color;
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.fillText(`Lv${r.lv}${boss ? ' · BOSS' : ''}`, x + w / 2, y + 34);

    // HP 条
    const hpW = w - 24;
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(x + 12, y + h - 24, hpW, 8, 4);
    ctx.fill();
    const ratio = alive ? r.hp / r.maxHp : 0;
    ctx.fillStyle = boss ? PAL.red : PAL.green;
    roundRect(x + 12, y + h - 24, hpW * ratio, 8, 4);
    ctx.fill();

    // 目标标记：红色圆点 + "!"（可并购目标统一标识）
    if (alive) {
      const mx = x + w - 16;
      const my = y + 14;
      ctx.fillStyle = boss ? PAL.red : PAL.magenta;
      ctx.beginPath();
      ctx.arc(mx, my, 10, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 12px system-ui, sans-serif';
      ctx.fillText('!', mx, my + 1);
    }
  }

  function drawBattle(state, t) {
    // 玩家塔 vs 对手塔对峙
    const pRect = { x: 90, y: 150, w: 150, h: 320 };
    const eRect = { x: W - 240, y: 150, w: 150, h: 320 };
    drawHq(state.player, pRect, t);
    // 对手塔（品红）
    const r = state.rivals[state.currentRivalIdx];
    const eGlow = ctx.createRadialGradient(eRect.x + eRect.w / 2, eRect.y + eRect.h / 2, 10, eRect.x + eRect.w / 2, eRect.y + eRect.h / 2, eRect.w * 0.7);
    eGlow.addColorStop(0, 'rgba(232,121,249,0.3)');
    eGlow.addColorStop(1, 'rgba(232,121,249,0)');
    ctx.fillStyle = eGlow;
    ctx.fillRect(eRect.x - eRect.w * 0.3, eRect.y - eRect.h * 0.3, eRect.w * 1.6, eRect.h * 1.6);
    ctx.fillStyle = 'rgba(232,121,249,0.5)';
    roundRect(eRect.x, eRect.y, eRect.w, eRect.h, 8);
    ctx.fill();
    ctx.strokeStyle = r.boss ? PAL.red : PAL.magenta;
    ctx.lineWidth = 3;
    roundRect(eRect.x, eRect.y, eRect.w, eRect.h, 8);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(r.name, eRect.x + eRect.w / 2, eRect.y - 14);

    // 双方血条（顶部）
    drawHpBar(30, TOP + 8, (W - 60) / 2 - 10, 14, state.player.hp, state.player.maxHp, PAL.cyan, 'YOU');
    drawHpBar(W / 2 + 5, TOP + 8, (W - 60) / 2 - 10, 14, state.battle.enemyHp, state.battle.enemyMaxHp, PAL.magenta, r.name);

    // 对决火花
    const mx = (pRect.x + pRect.w + eRect.x) / 2;
    const my = 300;
    const pulse = 1 + 0.3 * Math.sin(t * 8);
    ctx.strokeStyle = `rgba(251,191,36,${0.5 * pulse})`;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(mx, my, 26 * pulse, 0, Math.PI * 2);
    ctx.stroke();
    ctx.fillStyle = PAL.gold;
    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('⚔', mx, my + 7);
  }

  function drawHpBar(x, y, w, h, val, max, color, label) {
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    roundRect(x, y, w, h, 7);
    ctx.fill();
    const ratio = Math.max(0, Math.min(1, max > 0 ? val / max : 0));
    ctx.fillStyle = color;
    roundRect(x, y, w * ratio, h, 7);
    ctx.fill();
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 11px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${label} ${Math.max(0, Math.round(val))}/${Math.round(max)}`, x + 8, y + h / 2);
    ctx.textBaseline = 'alphabetic';
  }

  function rivalRects(state) {
    const rows = 2;
    const cols = 5;
    const gap = 16;
    const area = { x: 340, y: 136, w: W - 340 - 20, h: H - BOTTOM_BAR - 136 - 20 };
    const cw = (area.w - gap * (cols - 1)) / cols;
    const ch = (area.h - gap * (rows - 1)) / rows;
    const n = state && state.rivals ? state.rivals.length : 0;
    const rects = [];
    for (let i = 0; i < n; i += 1) {
      const col = i % cols;
      const row = Math.floor(i / cols);
      rects.push({
        x: area.x + col * (cw + gap),
        y: area.y + row * (ch + gap),
        w: cw,
        h: ch,
        idx: i,
      });
    }
    return rects;
  }

  function drawIdle(state, t) {
    // 玩家塔（左侧），YOU 标识画在塔身上避免与顶部 HUD 邻近
    drawHq(state.player, { x: 60, y: 180, w: 150, h: 300 }, t);
    ctx.fillStyle = PAL.cyan;
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('YOU', 135, 260);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.fillText(`HQ Lv${state.player.lv}`, 135, 500);
    ctx.fillText(`⚡ ${state.player.power}`, 135, 518);

    // 街区标题
    const d = DISTRICTS[state.district];
    ctx.fillStyle = '#fde68a';
    ctx.font = 'bold 24px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(d ? d.en : '', W / 2, TOP + 24);

    // 对手卡片
    const rects = rivalRects(state);
    for (const rect of rects) {
      drawRivalCard(state.rivals[rect.idx], rect, state, t, state.currentRivalIdx === rect.idx);
    }
  }

  function draw(state, dt, view) {
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const t = performance.now() / 1000;

    if (view.shake > 0) {
      const s = view.shake;
      ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
    }

    skyline(state ? state.district : 0);

    if (!state) return;
    if (state.phase === 'battle' && state.battle) {
      drawBattle(state, t);
    } else {
      drawIdle(state, t);
    }

    // 闪白（连击/清街）
    if (view.flash > 0) {
      ctx.fillStyle = `rgba(255,255,255,${Math.min(0.5, view.flash)})`;
      ctx.fillRect(0, 0, W, H);
    }

    // 飘字
    for (const f of view.floaters) {
      ctx.fillStyle = f.color || '#fff';
      ctx.globalAlpha = Math.max(0, Math.min(1, f.ttl));
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(f.text, f.x, f.y);
      ctx.globalAlpha = 1;
    }
  }

  function debugLayout(state) {
    return { rivalRects: rivalRects(state || null), W, H, TOP, BOTTOM_BAR };
  }

  return { draw, debugLayout, resize };
}
