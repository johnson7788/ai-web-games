// src/render/index.js — Canvas 2D 渲染：地图（瓦片）/ 战斗（双阵营 + 血条 + 速度条）/ 墨晕。
// 全程序化水墨风，三套场景色板来自 theme.js；不引任何外部素材。
import { WORLD } from '../../config/game.config.js';
import { MAP } from '../../config/gameplay.js';
import { sceneOf, ELEM_COLORS, ELEM_GLOW } from './theme.js';

const TILE = 51;
const OX = Math.floor((WORLD.WIDTH - MAP.cols * TILE) / 2);
const OY = Math.floor((WORLD.HEIGHT - MAP.rows * TILE) / 2);

const ELEM_LABEL = { metal: 'METAL', wood: 'WOOD', earth: 'EARTH', water: 'WATER', fire: 'FIRE' };

function clamp(v, lo, hi) { return v < lo ? lo : v > hi ? hi : v; }

function titleCase(s) {
  return s.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase()).trim();
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  let ink = null;            // { element, t } 全屏墨晕
  let time = 0;

  // ---------------- 基础绘制 ----------------

  function fillSky(scene) {
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, scene.skyTop);
    g.addColorStop(1, scene.skyBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
  }

  function glow(x, y, r, color, strength = 0.35) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = strength;
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  function drawInkOverlay() {
    if (!ink) return;
    const a = clamp(1 - ink.t / 1.2, 0, 1);
    if (a <= 0) { ink = null; return; }
    const color = ELEM_GLOW[ink.element] || ELEM_GLOW.metal;
    const g = ctx.createRadialGradient(WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 60, WORLD.WIDTH / 2, WORLD.HEIGHT / 2, 900);
    g.addColorStop(0, color);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.globalAlpha = a * 0.3;
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    ctx.globalAlpha = 1;
  }

  // ---------------- 地图 ----------------

  function tileAt(col, row, scene, t) {
    const x = OX + col * TILE;
    const y = OY + row * TILE;
    const seed = (col * 7 + row * 13) % 5;
    ctx.fillStyle = seed % 2 ? scene.groundA : scene.groundB;
    ctx.fillRect(x, y, TILE, TILE);
    ctx.strokeStyle = scene.groundLine;
    ctx.globalAlpha = 0.18;
    ctx.strokeRect(x + 0.5, y + 0.5, TILE, TILE);
    ctx.globalAlpha = 1;
    // 场景装饰（竹 / 雪 / 塔）
    if ((col * 3 + row) % 5 === 0) {
      ctx.fillStyle = scene.deco;
      ctx.globalAlpha = 0.5;
      if (scene.id === 'bamboo') {
        ctx.fillRect(x + TILE * 0.2, y + TILE * 0.1, 3, TILE * 0.8);
        ctx.fillStyle = scene.deco2;
        ctx.fillRect(x + TILE * 0.14, y + TILE * 0.12, 6, 4);
        ctx.fillRect(x + TILE * 0.22, y + TILE * 0.32, 6, 4);
      } else if (scene.id === 'snow') {
        ctx.fillRect(x + TILE * 0.25, y + TILE * 0.3, 8, 3);
        ctx.fillRect(x + TILE * 0.5, y + TILE * 0.5, 6, 3);
      } else {
        ctx.fillRect(x + TILE * 0.2, y + TILE * 0.2, 10, 10);
        ctx.fillStyle = scene.deco2;
        ctx.fillRect(x + TILE * 0.26, y + TILE * 0.26, 4, 4);
      }
      ctx.globalAlpha = 1;
    }
  }

  function drawPath(scene) {
    // 一条从出生点到门的石板/雪径，提供明确前进方向
    ctx.strokeStyle = scene.deco;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(OX + MAP.spawn.x * TILE, OY + MAP.spawn.y * TILE);
    ctx.lineTo(OX + MAP.npc.x * TILE, OY + MAP.npc.y * TILE);
    ctx.lineTo(OX + MAP.door.x * TILE, OY + MAP.door.y * TILE);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  function drawSwordsman(x, y, s, facing) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#eef2f7';
    ctx.strokeStyle = '#8aa0b8';
    ctx.lineWidth = 1.5;
    // 身体
    ctx.beginPath();
    ctx.ellipse(0, 4, 8, 13, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // 头
    ctx.fillStyle = '#f3d3b8';
    ctx.beginPath();
    ctx.arc(0, -10, 6, 0, Math.PI * 2);
    ctx.fill();
    // 发带
    ctx.fillStyle = '#3f8ab8';
    ctx.fillRect(-6, -16, 12, 4);
    // 剑（朝右）
    const fx = facing < 0 ? -1 : 1;
    ctx.strokeStyle = '#dfe8f2';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(fx * 4, -2);
    ctx.lineTo(fx * 22, -14);
    ctx.stroke();
    ctx.fillStyle = '#8f6b3f';
    ctx.fillRect(fx * 2, -5, 6, 6);
    ctx.restore();
  }

  function drawFox(x, y, s) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = '#e88a3a';
    ctx.beginPath();
    ctx.ellipse(0, 2, 11, 8, 0, 0, Math.PI * 2);
    ctx.fill();
    // 头
    ctx.beginPath();
    ctx.arc(-6, -6, 6, 0, Math.PI * 2);
    ctx.fill();
    // 耳
    ctx.beginPath();
    ctx.moveTo(-10, -10); ctx.lineTo(-9, -18); ctx.lineTo(-5, -11); ctx.closePath();
    ctx.fill();
    // 尾
    ctx.strokeStyle = '#e88a3a';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(9, 2);
    ctx.quadraticCurveTo(18, -2, 20, -12);
    ctx.stroke();
    ctx.fillStyle = '#fff';
    ctx.fillRect(-7, -3, 8, 6);
    ctx.restore();
  }

  function drawNpc(scene, t) {
    const x = OX + MAP.npc.x * TILE;
    const y = OY + MAP.npc.y * TILE;
    glow(x, y, 30, 'rgba(255,230,150,0.9)', 0.5 + 0.2 * Math.sin(t * 3));
    // 长老：斗篷人形
    ctx.save();
    ctx.translate(x, y);
    ctx.fillStyle = '#5b6b7e';
    ctx.beginPath();
    ctx.moveTo(0, 22); ctx.lineTo(-12, -8); ctx.lineTo(12, -8); ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#f3d3b8';
    ctx.beginPath();
    ctx.arc(0, -12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e8c66a';
    ctx.fillRect(-2, -26, 4, 10); // 头顶标记
    ctx.restore();
    // 互动提示（更大、带描边）
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.lineWidth = 4;
    ctx.strokeStyle = 'rgba(0,0,0,0.75)';
    ctx.strokeText('!', x, y - 34);
    ctx.fillStyle = '#fff2c0';
    ctx.fillText('!', x, y - 34);
  }

  function drawDoor(scene, t, openingDone) {
    const x = OX + MAP.door.x * TILE;
    const y = OY + MAP.door.y * TILE;
    const color = openingDone ? 'rgba(120,230,160,0.9)' : 'rgba(180,180,200,0.5)';
    glow(x, y, 34, color, 0.4 + 0.2 * Math.sin(t * 4));
    // 石门/传送门
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = openingDone ? '#9ef0b0' : '#8899aa';
    ctx.lineWidth = 3;
    ctx.strokeRect(-18, -30, 36, 60);
    ctx.fillStyle = openingDone ? 'rgba(158,240,176,0.25)' : 'rgba(136,153,170,0.15)';
    ctx.fillRect(-18, -30, 36, 60);
    ctx.restore();
    const label = openingDone ? 'BATTLE' : 'SEALED';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    const w = ctx.measureText(label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.fillRect(x - w / 2 - 8, y - 54, w + 16, 22);
    ctx.fillStyle = openingDone ? '#c9ffe0' : '#e6eef6';
    ctx.fillText(label, x, y - 38);
  }

  function drawMap(run) {
    const scene = sceneOf(run.scene);
    fillSky(scene);
    for (let r = 0; r < MAP.rows; r += 1) {
      for (let c = 0; c < MAP.cols; c += 1) tileAt(c, r, scene, run.time);
    }
    drawPath(scene);
    drawNpc(scene, run.time);
    drawDoor(scene, run.time, run.map.openingDone);

    // 玩家（剑客）+ 灵狐随行
    const px = OX + run.map.px * TILE;
    const py = OY + run.map.py * TILE;
    drawFox(px - 34, py + 24, 0.55);
    drawSwordsman(px, py, 1.15, 1);
  }

  // ---------------- 战斗 ----------------

  function bar(x, y, w, h, ratio, color, bg = 'rgba(0,0,0,0.5)') {
    ctx.fillStyle = bg;
    ctx.fillRect(x, y, w, h);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, Math.max(0, w * clamp(ratio, 0, 1)), h);
  }

  function drawUnit(u, x, y, scale, isPlayer, activeHero) {
    const color = ELEM_COLORS[u.element] || '#ccc';
    // 选中高亮
    if (u.id === activeHero) {
      glow(x, y, 60, ELEM_GLOW[u.element] || 'rgba(255,255,255,0.6)', 0.35);
    }
    if (!u.alive) { ctx.globalAlpha = 0.28; }

    // 角色
    if (u.id === 'fox') drawFox(x, y, scale);
    else if (u.side === 'player') drawSwordsman(x, y, scale, 1);
    else drawMonster(u, x, y, scale, color);

    ctx.globalAlpha = 1;

    // 元素徽章（纯色菱形标记）
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(x, y - 64); ctx.lineTo(x + 9, y - 54); ctx.lineTo(x, y - 44); ctx.lineTo(x - 9, y - 54); ctx.closePath();
    ctx.fill();

    // HP / MP
    bar(x - 34, y - 84, 68, 7, u.hp / u.maxHp, isPlayer ? '#7fe08a' : '#e05a5a');
    if (u.side === 'player') bar(x - 34, y - 74, 68, 5, u.mp / u.maxMp, '#5aa8e0');

    // 速度条（ATB）
    bar(x - 34, y - 34, 68, 5, u.atb / 100, '#f0c95a', 'rgba(0,0,0,0.4)');

    // 防御 / 蓄势标记
    if (u.defend) { ctx.fillStyle = '#9fd4ff'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillText('DEF', x, y - 120); }
    else if (u.swordIntent) { ctx.fillStyle = '#ffe08a'; ctx.font = 'bold 11px system-ui, sans-serif'; ctx.fillText('SWORD', x, y - 120); }

    // 名字 + 五行 + HP 数值（明确目标）
    const label = titleCase(u.nameKey.replace('enemy.', ''));
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${label}  ${Math.max(0, Math.round(u.hp))}/${u.maxHp}`, x, y - 104);
    ctx.fillStyle = ELEM_GLOW[u.element] || '#fff';
    ctx.font = 'bold 10px system-ui, sans-serif';
    ctx.fillText(ELEM_LABEL[u.element], x, y - 90);
  }

  function drawMonster(u, x, y, scale, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    ctx.fillStyle = color;
    ctx.strokeStyle = 'rgba(0,0,0,0.4)';
    ctx.lineWidth = 2;
    if (u.boss) {
      // 大 Boss：多角怪
      ctx.beginPath();
      for (let i = 0; i < 8; i += 1) {
        const a = (i / 8) * Math.PI * 2;
        const rr = i % 2 ? 26 : 34;
        const px = Math.cos(a) * rr;
        const py = Math.sin(a) * rr;
        if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-8, -6, 5, 0, Math.PI * 2);
      ctx.arc(8, -6, 5, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.beginPath();
      ctx.ellipse(0, 2, 15, 12, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
      // 眼睛
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.arc(-5, -4, 4, 0, Math.PI * 2);
      ctx.arc(5, -4, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#111';
      ctx.beginPath();
      ctx.arc(-5, -4, 2, 0, Math.PI * 2);
      ctx.arc(5, -4, 2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawBattle(run) {
    const scene = sceneOf(run.scene);
    fillSky(scene);
    // 地面
    ctx.fillStyle = scene.ink;
    ctx.fillRect(0, WORLD.HEIGHT * 0.55, WORLD.WIDTH, WORLD.HEIGHT * 0.45);
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(0, WORLD.HEIGHT * 0.55, WORLD.WIDTH, 2);

    const b = run.battle;
    if (!b) return;
    const playerUnits = b.units.filter((u) => u.side === 'player');
    const enemyUnits = b.units.filter((u) => u.side === 'enemy');

    // 目标计数（明确「要打谁」）
    ctx.fillStyle = '#ff7a6a';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`TARGETS: ${enemyUnits.length}`, WORLD.WIDTH / 2, 28);

    playerUnits.forEach((u) => {
      const x = 250;
      const y = u.id === 'hero' ? 310 : 480;
      drawUnit(u, x, y, 1.6, true, b.activeHero);
    });

    enemyUnits.forEach((u, i) => {
      const x = 1000 - i * 130;
      const y = u.boss ? 330 : 270 + i * 160;
      drawUnit(u, x, y, u.boss ? 2.6 : 1.5, false, null);
      // 红色「!」目标标记（明确敌人是可攻击目标）
      ctx.font = 'bold 22px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.lineWidth = 4;
      ctx.strokeStyle = 'rgba(0,0,0,0.7)';
      ctx.strokeText('!', x, y - 128);
      ctx.fillStyle = '#ff4d3d';
      ctx.fillText('!', x, y - 128);
    });

    // 待命提示（带背景衬底，明确当前操作单位）
    if (b.pending) {
      const px = 250;
      const py = b.activeHero === 'hero' ? 310 : 480;
      const msg = 'YOUR TURN';
      ctx.font = 'bold 18px system-ui, sans-serif';
      ctx.textAlign = 'center';
      const w = ctx.measureText(msg).width;
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(px - w / 2 - 12, py - 154, w + 24, 28);
      ctx.fillStyle = '#ffe08a';
      ctx.fillText(msg, px, py - 134);
    }
  }

  // ---------------- 主入口 ----------------

  function draw(run, alpha = 1) {
    time += 1 / 60;
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    if (!run) {
      // 标题背景：竹林 + 薄雾
      const scene = sceneOf(1);
      fillSky(scene);
      for (let r = 0; r < MAP.rows; r += 1) {
        for (let c = 0; c < MAP.cols; c += 1) tileAt(c, r, scene, time);
      }
      ctx.fillStyle = 'rgba(10,26,18,0.45)';
      ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    } else if (run.mode === 'battle') {
      drawBattle(run);
    } else {
      drawMap(run);
    }

    drawInkOverlay();
  }

  return {
    draw,
    ink(element) { ink = { element, t: 0 }; },
    get size() { return WORLD; },
  };
}

export default createRender;
