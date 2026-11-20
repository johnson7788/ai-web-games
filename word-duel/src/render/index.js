// WORD DUEL · Canvas 2D 渲染：letterbox、三个场景包、双方法师、血条/护盾、字母盘、词云特效。
// 纯程序化，不引外部素材。布局常量由 debugLayout() 暴露给教程/验收。
import { WORLD } from '../../config/game.config.js';
import { SCENES } from '../../config/levels.js';

// 布局（1280×720 逻辑世界）
const LAY = {
  HUD_H: 44,
  player: { x: 250, y: 340 },
  enemy: { x: 1030, y: 340 },
  hpY: 210,
  hpW: 300,
  hpH: 22,
  wordY: 528,
  trayY: 566,
  tile: 74,
  tileGap: 6,
};

const TILE_COUNT = 9;

function trayX() {
  const w = TILE_COUNT * LAY.tile + (TILE_COUNT - 1) * LAY.tileGap;
  return Math.round((WORLD.WIDTH - w) / 2);
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  canvas.width = WORLD.WIDTH;
  canvas.height = WORLD.HEIGHT;

  // 元素配色（对手主题色）
  const ELEMENT_COLOR = {
    none: '#c9a06a',
    fire: '#ff7a3c',
    ice: '#7fd4ff',
    thunder: '#ffe14d',
    time: '#b39ddb',
    rune: '#8fa7ff',
    shield: '#8ad2c4',
    life: '#8ce68c',
    thief: '#c89bff',
    twin: '#ff8a5c',
    void: '#9a86ff',
    archmage: '#ffd166',
  };

  function drawBackground(state, view) {
    const scene = SCENES[state ? state.scene : 0] || SCENES[0];
    const p = scene.palette;
    const g = ctx.createLinearGradient(0, 0, 0, WORLD.HEIGHT);
    g.addColorStop(0, p.bgTop);
    g.addColorStop(1, p.bgBottom);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);

    // 场景专属装饰（法环 / 观众席 / 塔柱），一眼可辨
    const t = (view && view.t) || 0;
    if (scene.key === 'mist') {
      drawRuneCircle(640, 340, 250, p.accent, t);
      drawMistPuffs(p.deco, t);
    } else if (scene.key === 'midnight') {
      drawAudience(p.deco, t);
      drawRuneCircle(640, 340, 220, p.accent, t);
    } else {
      drawTower(p.deco, t);
      drawStars(p.accent, t);
    }
  }

  function drawRuneCircle(cx, cy, r, color, t) {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.22;
    ctx.lineWidth = 2;
    for (let i = 0; i < 3; i += 1) {
      ctx.beginPath();
      ctx.arc(cx, cy, r - i * 40, (t * 0.1) % (Math.PI * 2), (t * 0.1) % (Math.PI * 2) + Math.PI * 1.5);
      ctx.stroke();
    }
    // 符文刻点
    ctx.globalAlpha = 0.35;
    for (let i = 0; i < 24; i += 1) {
      const a = (i / 24) * Math.PI * 2 + t * 0.05;
      const px = cx + Math.cos(a) * (r - 60);
      const py = cy + Math.sin(a) * (r - 60);
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(px, py, 2.4, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawMistPuffs(color, t) {
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < 8; i += 1) {
      const x = ((i * 173 + t * 14) % (WORLD.WIDTH + 200)) - 100;
      const y = 90 + ((i * 97) % 160);
      ctx.globalAlpha = 0.08 + (i % 3) * 0.04;
      ctx.beginPath();
      ctx.ellipse(x, y, 90 + (i % 4) * 30, 26, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function drawAudience(color, t) {
    ctx.save();
    ctx.fillStyle = color;
    for (let r = 0; r < 3; r += 1) {
      for (let i = 0; i < 14; i += 1) {
        const x = 60 + i * 88 + (r % 2) * 40;
        const y = 120 + r * 42;
        ctx.globalAlpha = 0.25 + (i % 3) * 0.08;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
  }

  function drawTower(color, t) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.globalAlpha = 0.25;
    ctx.fillRect(0, 0, 70, WORLD.HEIGHT);
    ctx.fillRect(WORLD.WIDTH - 70, 0, 70, WORLD.HEIGHT);
    ctx.globalAlpha = 0.15;
    for (let i = 0; i < 6; i += 1) {
      ctx.fillRect(0, i * 130 + 20, 70, 6);
      ctx.fillRect(WORLD.WIDTH - 70, i * 130 + 20, 70, 6);
    }
    ctx.restore();
  }

  function drawStars(color, t) {
    ctx.save();
    ctx.fillStyle = color;
    for (let i = 0; i < 40; i += 1) {
      const x = (i * 211) % WORLD.WIDTH;
      const y = (i * 137) % (WORLD.HEIGHT - 200);
      const tw = 0.4 + 0.6 * Math.abs(Math.sin(t * 0.8 + i));
      ctx.globalAlpha = 0.3 * tw;
      ctx.fillRect(x, y, 2, 2);
    }
    ctx.restore();
  }

  // 程序化法师（袍 + 头 + 杖 + 元素光晕）
  function drawMage(x, y, opts) {
    const { color, facing, hp, maxHp, shield, shieldMax, element, glow } = opts;
    const dir = facing === 'left' ? -1 : 1;
    ctx.save();
    ctx.translate(x, y);

    // 光晕
    if (glow) {
      ctx.fillStyle = color;
      ctx.globalAlpha = 0.16;
      ctx.beginPath();
      ctx.arc(0, -40, 90, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // 袍（梯形）
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(-46 * dir, 8);
    ctx.lineTo(-34 * dir, 86);
    ctx.lineTo(34 * dir, 86);
    ctx.lineTo(46 * dir, 8);
    ctx.closePath();
    ctx.fill();

    // 袍饰边
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, -40);
    ctx.lineTo(0, 86);
    ctx.stroke();

    // 头
    ctx.fillStyle = '#f2e3c4';
    ctx.beginPath();
    ctx.arc(0, -64, 24, 0, Math.PI * 2);
    ctx.fill();
    // 兜帽
    ctx.fillStyle = shade(color, -25);
    ctx.beginPath();
    ctx.arc(0, -66, 26, Math.PI, 0);
    ctx.fill();

    // 杖
    ctx.strokeStyle = '#8a6a3c';
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(60 * dir, 40);
    ctx.lineTo(78 * dir, -60);
    ctx.stroke();
    // 杖顶宝石（元素色）
    ctx.fillStyle = elementColor(element);
    ctx.beginPath();
    ctx.arc(78 * dir, -66, 9, 0, Math.PI * 2);
    ctx.fill();

    ctx.restore();
    return { x, y };
  }

  function elementColor(el) {
    return ELEMENT_COLOR[el] || ELEMENT_COLOR.none;
  }

  // 目标标记：敌人头顶的脉冲金色菱形，让「要击败的目标」一眼可辨
  function drawTarget(x, y, t) {
    ctx.save();
    const pulse = 0.5 + 0.5 * Math.sin(t * 4);
    ctx.translate(x, y);
    ctx.strokeStyle = '#ffd166';
    ctx.fillStyle = '#ffd166';
    ctx.globalAlpha = 0.85;
    // 菱形
    const s = 11 + pulse * 3;
    ctx.beginPath();
    ctx.moveTo(0, -s);
    ctx.lineTo(s, 0);
    ctx.lineTo(0, s);
    ctx.lineTo(-s, 0);
    ctx.closePath();
    ctx.fill();
    ctx.globalAlpha = 0.5 + pulse * 0.3;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, 0, 20 + pulse * 4, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.max(0, Math.min(255, (n >> 16) + amt));
    const g = Math.max(0, Math.min(255, ((n >> 8) & 0xff) + amt));
    const b = Math.max(0, Math.min(255, (n & 0xff) + amt));
    return `rgb(${r},${g},${b})`;
  }

  function drawHpBar(x, y, w, h, ratio, color, label, shieldRatio) {
    ctx.save();
    // 底色
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(x, y, w, h);
    // 血量
    const cw = Math.max(0, w * ratio);
    ctx.fillStyle = color;
    ctx.fillRect(x, y, cw, h);
    // 护盾
    if (shieldRatio > 0) {
      ctx.fillStyle = 'rgba(140,210,196,0.9)';
      ctx.fillRect(x, y - 8, w * shieldRatio, 6);
    }
    // 边框
    ctx.strokeStyle = 'rgba(255,255,255,0.6)';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x, y, w, h);
    // 标签
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + w / 2, y + h + 16);
    ctx.restore();
  }

  function drawTiles(state) {
    const x0 = trayX();
    const y0 = LAY.trayY;
    for (let i = 0; i < TILE_COUNT; i += 1) {
      const x = x0 + i * (LAY.tile + LAY.tileGap);
      const tile = state.hand[i];
      if (!tile) continue;
      const selected = tile.selected;
      // 底
      ctx.fillStyle = selected ? '#ffd166' : 'rgba(20,16,32,0.85)';
      ctx.fillRect(x, y0, LAY.tile, LAY.tile);
      // 边框
      ctx.strokeStyle = selected ? '#fff' : 'rgba(255,255,255,0.25)';
      ctx.lineWidth = selected ? 3 : 1.5;
      ctx.strokeRect(x, y0, LAY.tile, LAY.tile);
      // 字母
      ctx.fillStyle = selected ? '#1a1030' : '#f4ead8';
      ctx.font = 'bold 40px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(tile.ch.toUpperCase(), x + LAY.tile / 2, y0 + LAY.tile / 2 + 2);
    }
  }

  function drawWord(state) {
    const word = state.word || '';
    ctx.save();
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 34px system-ui, sans-serif';
    const text = word.toUpperCase() || '· · ·';
    // 阴影
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillText(text, WORLD.WIDTH / 2 + 2, LAY.wordY + 2);
    ctx.fillStyle = word ? '#ffd166' : 'rgba(255,255,255,0.45)';
    ctx.fillText(text, WORLD.WIDTH / 2, LAY.wordY);
    ctx.restore();
  }

  function drawFx(state, view) {
    if (!view) return;
    for (const fx of view.fx || []) {
      if (fx.type === 'wordCloud') {
        drawWordCloud(fx);
      } else if (fx.type === 'hitFlash') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, fx.ttl);
        ctx.fillStyle = 'rgba(255,209,102,0.5)';
        ctx.beginPath();
        ctx.arc(LAY.enemy.x, LAY.enemy.y - 40, 70 + (1 - fx.ttl) * 40, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (fx.type === 'healGlow') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, fx.ttl) * 0.5;
        ctx.fillStyle = '#8ce68c';
        ctx.beginPath();
        ctx.arc(LAY.player.x, LAY.player.y - 40, 60 + (1 - fx.ttl) * 30, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      } else if (fx.type === 'freeze') {
        ctx.save();
        ctx.globalAlpha = Math.max(0, fx.ttl) * 0.35;
        ctx.fillStyle = '#bfeaff';
        ctx.fillRect(LAY.player.x - 60, LAY.player.y - 110, 120, 200);
        ctx.restore();
      }
    }
  }

  function drawWordCloud(fx) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, fx.ttl);
    const letters = (fx.word || 'RUNES').toUpperCase().split('');
    const n = letters.length;
    for (let i = 0; i < n; i += 1) {
      const ang = (i / n) * Math.PI * 2 + fx.seed;
      const dist = 40 + (1 - fx.ttl) * 90;
      const x = LAY.enemy.x + Math.cos(ang) * dist;
      const y = LAY.enemy.y - 40 + Math.sin(ang) * dist * 0.6;
      ctx.fillStyle = i % 2 ? '#ffd166' : '#7fd8c2';
      ctx.font = `bold ${16 + (i % 3) * 4}px system-ui, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(letters[i], x, y);
    }
    ctx.restore();
  }

  // 标题屏的演示对局状态（让标题也有玩法剪影：拼出 SPELL）
  const DEMO_STATE = {
    playerHp: 100, playerMaxHp: 100,
    enemyHp: 100, enemyMaxHp: 100,
    enemyShield: 0, enemyShieldMax: 0,
    element: 'none',
    hand: ['s', 'p', 'e', 'l', 'l', 't', 'a', 'c', 'k'].map((ch, i) => ({ ch, selected: i < 5 })),
    selection: [0, 1, 2, 3, 4], word: 'spell',
  };

  function draw(state, dt, view) {
    ctx.clearRect(0, 0, WORLD.WIDTH, WORLD.HEIGHT);
    const s = state || DEMO_STATE;
    drawBackground(state, view);

    // 震屏
    ctx.save();
    if (view && view.shake > 0) {
      const a = view.shake * 4;
      ctx.translate((Math.random() - 0.5) * a, (Math.random() - 0.5) * a);
    }

    // 玩家（青=最亮主体）
    drawMage(LAY.player.x, LAY.player.y, {
      color: '#2fd6c4', facing: 'right', glow: true, element: 'none',
      hp: s.playerHp, maxHp: s.playerMaxHp,
    });
    // 对手（元素色）+ 目标标记
    drawMage(LAY.enemy.x, LAY.enemy.y, {
      color: ELEMENT_COLOR[s.element] || ELEMENT_COLOR.none, facing: 'left', glow: true, element: s.element,
      hp: s.enemyHp, maxHp: s.enemyMaxHp,
    });
    drawTarget(LAY.enemy.x, LAY.enemy.y - 96, view ? view.t : 0);

    // 血条
    const ph = s.playerMaxHp > 0 ? s.playerHp / s.playerMaxHp : 0;
    const eh = s.enemyMaxHp > 0 ? s.enemyHp / s.enemyMaxHp : 0;
    const shieldRatio = s.enemyShieldMax > 0 ? s.enemyShield / s.enemyShieldMax : 0;
    drawHpBar(LAY.player.x - LAY.hpW / 2, LAY.hpY, LAY.hpW, LAY.hpH, ph, '#2fd6c4', 'YOU', 0);
    drawHpBar(LAY.enemy.x - LAY.hpW / 2, LAY.hpY, LAY.hpW, LAY.hpH, eh, ELEMENT_COLOR[s.element] || '#c9a06a', 'ENEMY', shieldRatio);

    drawFx(s, view);
    drawWord(s);
    drawTiles(s);
    ctx.restore();
  }

  return {
    draw,
    debugLayout() {
      const x0 = trayX();
      return {
        tray: { x: x0, y: LAY.trayY, w: TILE_COUNT * LAY.tile + (TILE_COUNT - 1) * LAY.tileGap, h: LAY.tile },
        tile: LAY.tile,
        tileGap: LAY.tileGap,
        player: { x: LAY.player.x - 60, y: LAY.player.y - 110, w: 120, h: 200 },
        enemy: { x: LAY.enemy.x - 60, y: LAY.enemy.y - 110, w: 120, h: 200 },
        word: { x: WORLD.WIDTH / 2 - 200, y: LAY.wordY - 24, w: 400, h: 48 },
      };
    },
  };
}
