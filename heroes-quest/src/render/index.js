// src/render/index.js — Canvas 渲染编排：场景 + 地图 / 布阵 / 战斗
// 1280×720 固定世界；HUD/面板/技能条走 HTML（styles.css），画布只画场景与实体。
import { WORLD } from '../../config/game.config.js';
import { NODES, nodeById } from '../../config/levels.js';
import { drawScene, sceneOf } from './scene.js';
import { drawFighter, drawHpBar } from './units.js';

const COL_X = (col) => 70 + col * ((WORLD.WIDTH - 140) / 11);
const NODE_Y = (idx, count) => 360 + (idx - (count - 1) / 2) * 96;

function nodesInCol(col) {
  return NODES.filter((n) => n.col === col).sort((a, b) => a.id.localeCompare(b.id));
}

export function nodeScreenPos(id) {
  const n = nodeById(id);
  if (!n) return null;
  const colNodes = nodesInCol(n.col);
  const idx = colNodes.findIndex((x) => x.id === id);
  return { x: COL_X(n.col), y: NODE_Y(idx, colNodes.length), node: n };
}

export function createRender(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  function nodeRects(run) {
    if (!run || run.mode !== 'map') return [];
    const rects = [];
    for (const id of run.choices) {
      const p = nodeScreenPos(id);
      if (p) rects.push({ id, x: p.x, y: p.y, r: 26 });
    }
    return rects;
  }

  function battlePositions(run) {
    // 前/中/后三列：越靠中间越靠前（承伤/接敌）。整体上移，给底部指令条留白。
    const heroSlots = { 0: { x: 350, y: 400 }, 1: { x: 240, y: 285 }, 2: { x: 130, y: 170 } };
    const enemySlots = { 0: { x: 930, y: 400 }, 1: { x: 1040, y: 285 }, 2: { x: 1150, y: 170 } };
    const pos = {};
    if (run.battle) {
      for (const u of run.battle.units) {
        const slot = u.side === 'hero' ? heroSlots[u.row] : enemySlots[u.row];
        pos[u.id] = slot || { x: 640, y: 285 };
      }
    }
    return pos;
  }

  function drawMap(run, t) {
    const scene = sceneOf(run.chapter);
    drawScene(ctx, scene, t);

    // 已完成路径
    ctx.strokeStyle = 'rgba(255, 224, 150, 0.55)';
    ctx.lineWidth = 4;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    let first = true;
    for (let col = 0; col <= run.col; col += 1) {
      const ns = nodesInCol(col);
      for (const n of ns) {
        const p = nodeScreenPos(n.id);
        if (first) { ctx.moveTo(p.x, p.y); first = false; }
        else ctx.lineTo(p.x, p.y);
      }
    }
    ctx.stroke();
    ctx.setLineDash([]);

    // 画所有节点
    for (const n of NODES) {
      const p = nodeScreenPos(n.id);
      const isCurrent = n.id === run.nodeId;
      const isChoice = run.choices.includes(n.id);
      const isPast = n.col < run.col;
      const isFuture = n.col > run.col && !isChoice;
      ctx.globalAlpha = isFuture ? 0.35 : isPast ? 0.6 : 1;
      drawNodeGlyph(ctx, p.x, p.y, n.type, isCurrent, isChoice, t);
      ctx.globalAlpha = 1;
    }

    // 目标：Boss 节点醒目标注 + 未来路径虚线
    const boss = NODES.find((n) => n.type === 'boss');
    if (boss) {
      const bp = nodeScreenPos(boss.id);
      ctx.strokeStyle = 'rgba(255, 210, 74, 0.4)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 8]);
      ctx.beginPath();
      const cp = nodeScreenPos(run.nodeId);
      ctx.moveTo(cp.x, cp.y);
      ctx.lineTo(bp.x, bp.y);
      ctx.stroke();
      ctx.setLineDash([]);

      const pulse = 0.5 + 0.5 * Math.sin(t * 0.006);
      ctx.strokeStyle = `rgba(255, 210, 74, ${0.6 + pulse * 0.4})`;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(bp.x, bp.y, 42 + pulse * 3, 0, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#ffd24a';
      ctx.font = 'bold 15px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText('GOAL', bp.x, bp.y - 48);
      ctx.fillStyle = '#fff7e0';
      ctx.fillText('BOSS', bp.x, bp.y + 50);
      ctx.textAlign = 'left';
    }
  }

  function drawNodeGlyph(ctx, x, y, type, isCurrent, isChoice, t) {
    const colors = {
      start: '#5fd0a0', battle: '#ef6b6b', rest: '#58d68d', event: '#f4c152', elite: '#b07bd8', boss: '#c0392b',
    };
    const color = colors[type] || '#888';
    const r = type === 'boss' ? 30 : 22;

    if (isChoice) {
      const pulse = 0.5 + 0.5 * Math.sin(t * 0.006);
      ctx.fillStyle = 'rgba(255, 224, 150, 0.25)';
      ctx.beginPath();
      ctx.arc(x, y, r + 9 + pulse * 4, 0, Math.PI * 2);
      ctx.fill();
    }
    if (isCurrent) {
      ctx.strokeStyle = '#ffd24a';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(x, y, r + 6, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.fillStyle = '#fff';
    ctx.font = `bold ${r}px system-ui`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const glyph = { start: '⚑', battle: '⚔', rest: '✚', event: '?', elite: '☠', boss: '♛' }[type] || '•';
    ctx.fillText(glyph, x, y + 1);
    ctx.textBaseline = 'alphabetic';
    ctx.textAlign = 'left';
  }

  function drawBattle(run, t) {
    const scene = sceneOf(run.chapter);
    drawScene(ctx, scene, t);
    const pos = battlePositions(run);

    for (const u of run.battle.units) {
      const p = pos[u.id];
      if (!p) continue;
      const kind = u.side === 'hero' ? u.cls : (u.heavy ? 'boss' : 'enemy');
      const color = u.color;
      drawFighter(ctx, p.x, p.y, {
        kind, color, alive: u.alive, hp: u.hp, maxHp: u.maxHp,
        shield: u.shield, tauntTurns: u.tauntTurns, buffAtk: u.buffAtk, markedTurns: u.markedTurns,
      }, t);
      drawHpBar(ctx, p.x, p.y - 56, u.hp, u.maxHp, null, color);
      // 敌方红色「!」目标标记（目标可见性）
      if (u.side === 'enemy' && u.alive) {
        ctx.fillStyle = '#ff5d73';
        ctx.font = 'bold 22px system-ui';
        ctx.textAlign = 'center';
        ctx.fillText('!', p.x, p.y - 70);
        ctx.textAlign = 'left';
      }
    }
  }

  function draw(run, alpha, t) {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    if (!run) {
      drawScene(ctx, 'meadow', t || 0);
      return;
    }
    if (run.mode === 'map') drawMap(run, t);
    else if (run.mode === 'battle') drawBattle(run, t);
    else drawScene(ctx, sceneOf(run.chapter), t);
  }

  function layout() {
    return { viewport: [canvas.clientWidth, canvas.clientHeight], world: [WORLD.WIDTH, WORLD.HEIGHT] };
  }

  return { draw, nodeRects, battlePositions, nodeScreenPos, layout };
}
