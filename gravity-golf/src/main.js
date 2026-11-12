// 主入口：60Hz 固定步长 + 标题/游戏/暂停状态机 + 拖拽/空格瞄准 + 顿帧震屏 + SDK 接线 + __ll 调试契约
import { STEP, WORLD, GOLF, PLANETS, FX } from '../config/game.config.js';
import { createRun, settle as simSettle } from './game/sim.js';
import { createRenderer } from './render/index.js';
import { ui } from './ui/ui.js';
import { audio } from './ui/audio.js';
import { t } from './core/i18n.js';
import Sdk from './core/sdk.js';

const canvas = document.getElementById('canvas');
const renderer = createRenderer(canvas);

const SAVE_SEED = 20261112; // 地形固定，同力度同星球 = 同轨迹，练手感

let savedBest = Sdk.load('best', 0);
if (typeof savedBest !== 'number' || !Number.isFinite(savedBest) || savedBest < 0) savedBest = 0;

let sim = createRun({ seed: SAVE_SEED, best: savedBest });
let phase = 'title'; // title | playing | paused
const llState = { phase: 'title', lang: 'en' };

let lastTime = performance.now();
let renderNow = lastTime;
let accumulator = 0;
let hitstopUntil = 0;

let charging = false;
let chargeT = 0;
let aimAngle = 45;
let dragAnchor = null;
const keys = { up: false, down: false };

// ---------- 状态机 ----------

function startGame() {
  if (phase === 'playing') return;
  sim = createRun({ seed: SAVE_SEED, best: savedBest });
  Sdk.newRun({ mode: 'endless' });
  phase = 'playing';
  llState.phase = phase;
  accumulator = 0;
  hitstopUntil = 0;
  charging = false;
  dragAnchor = null;
  renderNow = performance.now();
  lastTime = renderNow;
  ui.showGame();
  audio.click();
}

function pauseGame() {
  if (phase !== 'playing') return;
  phase = 'paused';
  llState.phase = phase;
  charging = false;
  sim.aim.active = false;
  ui.updateHud(sim.getHud(), false, 0);
  ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  phase = 'playing';
  llState.phase = phase;
  ui.hidePause();
  lastTime = performance.now();
}

function restartGame() {
  phase = 'title';
  llState.phase = phase;
  sim = createRun({ seed: SAVE_SEED, best: savedBest });
  ui.showTitle(savedBest);
}

function ensurePlaying() {
  if (phase === 'title') startGame();
  else if (phase === 'paused') resumeGame();
}

// ---------- 击球 ----------

function doShoot(power, angleDeg) {
  if (phase !== 'playing' || ui.upgradeOpen) return false;
  if (sim.phase !== 'ready') return false;
  charging = false;
  aimAngle = angleDeg;
  return sim.shoot({ power, angleDeg }).ok;
}

function updateCharge(dt) {
  chargeT += dt;
  const cyc = (chargeT * GOLF.POWER_OSC_HZ) % 2;
  const p = cyc < 1 ? cyc : 2 - cyc;
  sim.aim.active = true;
  sim.aim.power = p;
  sim.aim.angleDeg = aimAngle;
}

function cancelAim() {
  charging = false;
  dragAnchor = null;
  if (sim.aim.active) {
    sim.aim.active = false;
    sim.aim.power = 0;
  }
}

// ---------- 事件（逻辑层 → 表现层）----------

function dustColors() {
  const pal = PLANETS[sim.planetIndex].palette;
  return [pal.ground, pal.groundDark, pal.accent];
}

function openUpgradePanel() {
  if (phase !== 'playing') return;
  ui.showUpgrade();
  ui.refreshUpgrades(sim.upgrades, sim.coins);
}

function handleStop(ev) {
  const b = sim.ball;
  renderer.floatText(b.x, b.y - 16, `${ev.distance} ${t('unit_m')}`, '#ffffff');
  if (ev.coins > 0) {
    renderer.floatText(b.x, b.y - 38, `+${ev.coins}`, '#ffd23f');
    audio.coin();
  }
  audio.hit(Math.min(1, ev.distance / 250));
  if (ev.newBest) {
    audio.best();
    ui.showToast(t('toast_new_best'));
    savedBest = sim.best;
    Sdk.save('best', sim.best);
  }
  Sdk.track('shot_landed', {
    distance: ev.distance, coins: ev.coins, burned: ev.burned, shot: sim.shotIndex,
  });
  if (sim.pendingPanel) {
    setTimeout(() => {
      if (phase === 'playing' && sim.pendingPanel) {
        sim.pendingPanel = false;
        openUpgradePanel();
      }
    }, 900);
  }
}

function handlePlanet(ev) {
  const p = PLANETS[ev.index];
  ui.showBanner(t(`planet_${p.id}`));
  audio.banner();
  Sdk.track('planet_switch', { planet: p.id, shot: sim.shotIndex });
}

function drainEvents(now) {
  const evs = sim.events.splice(0);
  for (const ev of evs) {
    switch (ev.type) {
      case 'shot':
        audio.swing(ev.power);
        Sdk.track('shot_fired', {
          power: +ev.power.toFixed(2), angle: Math.round(ev.angle),
          planet: PLANETS[ev.planet].id, shot: sim.shotIndex,
        });
        break;
      case 'bounce': {
        audio.bounce(ev.impact);
        const n = Math.min(10, Math.round(ev.impact / 120));
        if (n > 0) renderer.burst(ev.x, ev.y, n, dustColors(), 130, 70);
        renderer.ring(ev.x, ev.y, Math.min(46, 10 + ev.impact / 12), dustColors()[2]);
        renderer.shake(Math.min(FX.SHAKE_SCALE, ev.impact / 90));
        if (ev.impact > 400) {
          hitstopUntil = now + Math.min(FX.HITSTOP_MAX,
            Math.max(FX.HITSTOP_MIN, ev.impact * 0.06));
        }
        break;
      }
      case 'burn':
        audio.fire();
        ui.showToast(t('toast_burn'));
        break;
      case 'burnout':
        audio.burnout();
        ui.showToast(t('toast_burnout'));
        renderer.shake(FX.SHAKE_SCALE);
        renderer.fireBurst(ev.x, ev.y);
        hitstopUntil = now + FX.HITSTOP_MAX;
        break;
      case 'stop':
        handleStop(ev);
        break;
      case 'planet':
        handlePlanet(ev);
        break;
      case 'upgrade':
        audio.upgrade();
        Sdk.track('upgrade', { type: ev.upgrade, level: ev.level, cost: ev.cost });
        break;
      default:
        break;
    }
  }
}

// ---------- 输入 ----------

function toWorld(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (WORLD.WIDTH / r.width),
    y: (e.clientY - r.top) * (WORLD.HEIGHT / r.height),
  };
}

function canAim() {
  return phase === 'playing' && !ui.upgradeOpen && sim.phase === 'ready';
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!canAim()) return;
  e.preventDefault();
  canvas.setPointerCapture(e.pointerId);
  sim.aim.active = true;
  sim.aim.power = 0;
  sim.aim.angleDeg = aimAngle;
  dragAnchor = toWorld(e);
});

canvas.addEventListener('pointermove', (e) => {
  if (!sim.aim.active || charging) return;
  const w = toWorld(e);
  const a = dragAnchor || { x: sim.ball.x, y: sim.ball.y };
  const dx = a.x - w.x; // 弹弓式：向后下方拖，球飞向前上方
  const dy = a.y - w.y;
  const len = Math.hypot(dx, dy);
  sim.aim.power = Math.min(1, len / GOLF.POWER_DRAG_LEN);
  let deg = Math.atan2(-dy, dx) * (180 / Math.PI);
  deg = Math.max(GOLF.ANGLE_MIN, Math.min(GOLF.ANGLE_MAX, deg));
  sim.aim.angleDeg = deg;
});

function onPointerUp() {
  if (!sim.aim.active || charging) return;
  const p = sim.aim.power;
  const ang = sim.aim.angleDeg;
  sim.aim.active = false;
  sim.aim.power = 0;
  dragAnchor = null;
  if (p > 0.04) doShoot(p, ang);
}
canvas.addEventListener('pointerup', onPointerUp);
canvas.addEventListener('pointercancel', cancelAim);

window.addEventListener('keydown', (e) => {
  audio.unlock();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (ui.upgradeOpen) { ui.hideUpgrade(); audio.click(); return; }
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
    e.preventDefault();
    return;
  }
  if (e.code === 'KeyU') {
    if (phase === 'playing') {
      if (ui.upgradeOpen) { ui.hideUpgrade(); audio.click(); }
      else { openUpgradePanel(); audio.click(); }
    }
    return;
  }
  if (phase !== 'playing') return;
  if (e.code === 'ArrowUp' || e.code === 'KeyW') { keys.up = true; e.preventDefault(); }
  if (e.code === 'ArrowDown' || e.code === 'KeyS') { keys.down = true; e.preventDefault(); }
  if (e.code === 'Space' && !e.repeat) {
    e.preventDefault();
    if (canAim() && !charging) {
      charging = true;
      chargeT = 0;
      sim.aim.active = true;
      sim.aim.power = 0;
      sim.aim.angleDeg = aimAngle;
    }
  }
});

window.addEventListener('keyup', (e) => {
  if (e.code === 'ArrowUp' || e.code === 'KeyW') keys.up = false;
  if (e.code === 'ArrowDown' || e.code === 'KeyS') keys.down = false;
  if (e.code === 'Space') {
    e.preventDefault();
    if (charging) {
      const p = sim.aim.power;
      sim.aim.active = false;
      charging = false;
      dragAnchor = null;
      if (p > 0.04 && canAim()) doShoot(p, sim.aim.angleDeg);
    }
  }
});

window.addEventListener('blur', () => {
  if (phase === 'playing') pauseGame();
});

// ---------- UI 接线 ----------

ui.btnStart.addEventListener('click', () => { audio.unlock(); startGame(); });
ui.btnResume.addEventListener('click', () => { audio.click(); resumeGame(); });
ui.btnRestart.addEventListener('click', () => { audio.click(); restartGame(); });
ui.btnCloseUpgrade.addEventListener('click', () => { audio.click(); ui.hideUpgrade(); });
ui.btnMute.addEventListener('click', () => {
  audio.setMuted(!audio.muted);
  ui.updateMute(audio.muted);
});
ui.onUpgradeBuy = (type) => {
  const res = sim.upgrade(type);
  if (res.ok) ui.refreshUpgrades(sim.upgrades, sim.coins);
};
for (const sel of ui.langSelects) {
  if (sel) sel.addEventListener('change', (e) => { audio.click(); ui.setLang(e.target.value); });
}

// ---------- 主循环 ----------

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000));
  lastTime = now;
  llState.phase = phase;
  llState.lang = ui.lang;

  if (phase === 'playing') {
    renderNow = now;
    if (sim.phase === 'ready' && !ui.upgradeOpen) {
      if (keys.up) aimAngle = Math.min(GOLF.ANGLE_MAX, aimAngle + GOLF.AIM_KEY_STEP * dt);
      if (keys.down) aimAngle = Math.max(GOLF.ANGLE_MIN, aimAngle - GOLF.AIM_KEY_STEP * dt);
    }
    if (charging) updateCharge(dt);

    if (now < hitstopUntil) {
      accumulator = 0; // 顿帧：逻辑冻结 30-80ms，画面照常渲染
    } else {
      accumulator += dt;
      let n = 0;
      while (accumulator >= STEP && n < 6) {
        sim.step(STEP);
        accumulator -= STEP;
        n += 1;
      }
      if (n === 6) accumulator = 0;
    }
    drainEvents(now);
  }

  const hud = sim.getHud();
  const showPower = phase === 'playing' && sim.phase === 'ready' && (sim.aim.active || charging);
  ui.updateHud(hud, showPower, sim.aim.power);

  // 暂停/标题时传冻结时钟：世界静止，不推进任何动画
  renderer.render(sim, renderNow, {});
}

// ---------- 启动 ----------

Sdk.ready(); // 注入 vendored SDK，不 await、不阻塞首屏
audio.init();
ui.updateMute(audio.muted);
ui.showTitle(savedBest);
renderer.render(sim, renderNow);
requestAnimationFrame(loop);

// ---------- 调试契约 ----------

window.__ll = {
  state: llState,
  start: startGame,
  pause: pauseGame,
  resume: resumeGame,
  restart: restartGame,
  get sim() { return sim; },
  save: (k, v) => Sdk.save(k, v),
  setLang: (lang) => ui.setLang(lang),
  debug: {
    shoot(power = 0.85, angleDeg = 42) {
      ensurePlaying();
      simSettle(sim);
      const r = sim.shoot({ power, angleDeg });
      if (!r.ok) {
        return { ok: false, distance: sim.lastDistance, coins: sim.lastCoins, burned: sim.lastBurned };
      }
      simSettle(sim);
      drainEvents(performance.now());
      return { ok: true, distance: sim.lastDistance, coins: sim.lastCoins, burned: sim.lastBurned };
    },
    setPlanet(i) {
      ensurePlaying();
      simSettle(sim);
      sim.pendingPanel = false;
      return sim.setPlanet(i);
    },
    addCoins(n) {
      return sim.addCoins(n);
    },
  },
};
