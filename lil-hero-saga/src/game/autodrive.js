// LIL HERO SAGA · 贪心自动玩策略（Node selfplay 与浏览器 debug.fastForward 共用）。
// 只读 run.state 做决策：向右推进、跳坑、破彩色晶岩、清杂兵、远程磨 Boss。
import { LEVEL } from '../../config/levels.js';
import { GAME } from '../../config/game.config.js';

const GROUND_Y = LEVEL.groundY;

function groundAt(x) {
  for (const seg of LEVEL.groundSegments) {
    if (x >= seg.x && x <= seg.x + seg.w) return true;
  }
  return false;
}

// 颜色 → 需要混的颜色组合（晶岩弱点）
const ROCK_SPELL = {
  red: ['red'], yellow: ['yellow'], blue: ['blue'],
  orange: ['red', 'yellow'], purple: ['red', 'blue'], green: ['blue', 'yellow'],
  white: ['red', 'yellow', 'blue'],
};

function canAfford(p, colors) {
  for (const c of colors) if (p.mp[c] < GAME.MP_COST) return false;
  return true;
}

// 贪心策略的持续性状态（按住跳跃让跳跃高度不打折）
let jumpHold = 0;

export function policy(run) {
  const s = run.state;
  if (s.phase !== 'playing') return;
  const p = s.player;
  const input = { left: false, right: true, jump: false };
  let cast = null;

  if (jumpHold > 0) jumpHold -= 1;

  const boss = s.enemies.find((e) => e.type === 'boss');

  if (boss) {
    const dist = boss.x - (p.x + p.w);
    if (dist > 560) input.right = true;
    else if (dist < 470) { input.left = true; input.right = false; }
    else input.right = false;
    // 用橙电（红+黄，2 伤）远程磨 Boss；蓝不够就单红火球
    if (Math.abs(dist) < 680) {
      if (p.mp.red >= GAME.MP_COST && p.mp.yellow >= GAME.MP_COST) cast = ['red', 'yellow'];
      else if (p.mp.red >= GAME.MP_COST) cast = ['red'];
    }
  } else {
    // 破挡路晶岩（优先，边前进边打）
    const rockAhead = s.rocks
      .filter((r) => r.x > p.x + p.w - 6 && r.x - (p.x + p.w) < 260)
      .sort((a, b) => a.x - b.x)[0];
    if (rockAhead) {
      const colors = ROCK_SPELL[rockAhead.color] || ['red'];
      if (canAfford(p, colors)) cast = colors;
    }

    // 边前进边清前方地面敌人；近距停下打，避免撞进近战怪（只在与敌人同地面高度时打）
    if (!cast) {
      const onGroundLevel = Math.abs((p.y + p.h) - GROUND_Y) < 8;
      if (onGroundLevel) {
        const enemy = s.enemies
          .filter((e) => e.type !== 'bat' && e.type !== 'wizard' && e.type !== 'boss')
          .filter((e) => e.x > p.x + p.w - 20 && e.x - (p.x + p.w) < 440 && Math.abs((e.y + e.h) - (p.y + p.h)) < 150)
          .sort((a, b) => a.x - b.x)[0];
        if (enemy) {
          if (enemy.x - (p.x + p.w) < 260) input.right = false;
          if (p.mp.red >= GAME.MP_COST) cast = ['red'];
        }
      }
    }

    // 跳坑：触边即起跳，并按住跳跃直到越过
    if (!cast && p.onGround) {
      const footX = p.x + p.w + 34;
      if (!groundAt(footX) && footX < LEVEL.width - 60 && jumpHold === 0) {
        input.jump = true;
        jumpHold = 30;
      }
    }
  }

  if (jumpHold > 0) input.jump = true;
  run.setInput(input);
  if (cast) run.cast(cast);
}

// 用贪心策略推进到终局；返回 run。
export function autodrive(run, maxSeconds = 180) {
  const maxSteps = Math.ceil(maxSeconds * 60);
  for (let i = 0; i < maxSteps; i += 1) {
    if (run.state.phase !== 'playing') break;
    policy(run);
    run.step(1 / 60);
  }
  return run;
}
