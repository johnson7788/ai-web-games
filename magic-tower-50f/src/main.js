// 主入口：60Hz 固定步长 + 标题/游戏/暂停/结算 + 教程引导 + 战斗提示 + 商店/任务 + SDK 统一出口。
import { STEP, WORLD, GAME } from '../config/game.config.js';
import { createRun, predictBattle } from './game/sim.js';
import { ITEMS, SHOP, itemName, enhancePrice } from './game/data.js';
import { createRenderer } from './render/index.js';
import { createAudio } from './core/audio.js';
import { ui } from './ui/ui.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import Sdk from './core/sdk.js';

const $ = (id) => document.getElementById(id);
const canvas = $('canvas');
const renderer = createRenderer(canvas);
const audio = createAudio();

let run = null;
let phase = 'title';        // title | playing | paused | result
let lastTime = performance.now();
let accumulator = 0;
let moveCooldown = 0;
let fpsSamples = [];
let tutorialStep = -1;      // -1 = 未激活
let pendingFight = null;    // {r, c}
let lastMonsterCell = null;

const view = {
  fxQueue: [],
  shake: 0,
  time: 0,
};

// ---------- 存档（统一走 Sdk） ----------
let muted = !!Sdk.load('muted', false);
let tutorialDone = !!Sdk.load('tutorialDone', false);
let starsByFloor = Sdk.load('stars', {}) || {};
let bestFloor = Sdk.load('bestFloor', 0) | 0;

Sdk.ready(); // 不 await，不阻塞首屏
Sdk.onAdStart(() => { if (phase === 'playing') pauseGame(true); });
Sdk.onAdEnd(() => { if (phase === 'paused') resumeGame(); });
audio.setMuted(muted);
ui.setMuted(muted);

function persist() {
  Sdk.save('muted', muted);
  Sdk.save('tutorialDone', tutorialDone);
  Sdk.save('stars', starsByFloor);
  Sdk.save('bestFloor', bestFloor);
  if (run) Sdk.save('run', run.dump());
}

function totalStars() {
  return Object.values(starsByFloor).reduce((a, b) => a + (b | 0), 0);
}

function nm(name) {
  return name ? (name[i18n.lang] || name.en) : '';
}

// ---------- 阶段状态机 ----------
function setPhase(p) { phase = p; }

function startGame() {
  run = createRun({ seed: (Date.now() % 2147483647) || 1 });
  pendingFight = null;
  view.fxQueue = [];
  setPhase('playing');
  ui.showGame();
  ui.hideResult();
  updateHud();
  audio.startBgm();
  Sdk.track('start', {});
  Sdk.newRun({});
  if (!tutorialDone) startTutorial();
}

function pauseGame(silent) {
  if (phase !== 'playing') return;
  setPhase('paused');
  audio.stopBgm();
  if (!silent) ui.showPause();
}

function resumeGame() {
  if (phase !== 'paused') return;
  setPhase('playing');
  ui.hidePause();
  audio.startBgm();
  lastTime = performance.now();
}

function restartGame() {
  Sdk.track('restart', {});
  startGame();
}

function goHome() {
  run = null;
  setPhase('title');
  ui.hideResult();
  ui.showTitle();
  buildTitle();
}

// ---------- 标题 ----------
function buildTitle() {
  $('stars-total').textContent = `★ ${totalStars()} / ${GAME.FLOORS * 3}`;
}

// ---------- HUD ----------
function updateHud() {
  if (!run) return;
  const h = run.getHud();
  $('hud-floor').textContent = `${t('floor')} ${h.floor}`;
  $('hud-lv').textContent = `${t('level')} ${h.level}`;
  $('hud-hp').textContent = `${t('hp')} ${h.hp}/${h.maxHp}`;
  $('hud-atk').textContent = `${t('attack')} ${h.attack}`;
  $('hud-def').textContent = `${t('defence')} ${h.defence}`;
  $('hud-exp').textContent = `${t('exp')} ${h.exp}/${h.nextExp}`;
  $('hud-coins').textContent = `$ ${h.coins}`;
  $('hud-combo').textContent = `${t('combo')} ×${h.combo}`;
  $('hud-combo').style.display = h.combo > 0 ? '' : 'none';
  $('hud-stars').textContent = `★ ${h.starsTotal}`;
  $('hud-keys').innerHTML =
    `<span style="color:#ffd84e">●${h.keys.yellow}</span> ` +
    `<span style="color:#5aa2ff">●${h.keys.blue}</span> ` +
    `<span style="color:#ff5a5a">●${h.keys.red}</span>`;
  const items = [];
  if (h.potionSmall) items.push(`${t('potionSmall')}x${h.potionSmall}`);
  if (h.potionLarge) items.push(`${t('potionLarge')}x${h.potionLarge}`);
  if (h.scroll) items.push(`TPx${h.scroll}`);
  if (h.cross) items.push(`+x${h.cross}`);
  $('hud-items').textContent = items.join('  ');
  $('hp-bar').style.width = `${Math.max(0, Math.min(100, (h.hp / h.maxHp) * 100))}%`;
  $('exp-bar').style.width = `${Math.max(0, Math.min(100, (h.exp / h.nextExp) * 100))}%`;
}

// ---------- 输入 ----------
function canvasPos(e) {
  const rect = canvas.getBoundingClientRect();
  return { x: (e.clientX - rect.left) * (WORLD.WIDTH / rect.width), y: (e.clientY - rect.top) * (WORLD.HEIGHT / rect.height) };
}

function pickCell(p) {
  const lay = renderer.layout(run ? run.state : null);
  if (!lay || !run || lay.cols === 0) return null;
  const c = Math.floor((p.x - lay.x) / lay.tile);
  const r = Math.floor((p.y - lay.y) / lay.tile);
  if (r < 0 || r >= lay.rows || c < 0 || c >= lay.cols) return null;
  return { r, c };
}

function handleTap(r, c) {
  if (!run || phase !== 'playing') return;
  const res = run.tapCell(r, c);
  if (!res.ok) { return; }
  if (res.action === 'fight') {
    pendingFight = { r, c };
    lastMonsterCell = { r, c };
    showBattleCard(res.ent);
    return;
  }
  if (res.action === 'door') {
    run.openDoor(r, c);
    handleEvents(run.drainEvents());
    updateHud();
    return;
  }
  if (res.action === 'rock') {
    run.pushRock(r, c);
    handleEvents(run.drainEvents());
    updateHud();
    return;
  }
  if (res.action === 'npc') {
    handleNpc(res.ent.role);
    return;
  }
  // move：路径已在 state.path 里，主循环逐格走
}

canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (!run || phase !== 'playing') return;
  const cell = pickCell(canvasPos(e));
  if (cell) handleTap(cell.r, cell.c);
});

function stepToward(dr, dc) {
  if (!run || phase !== 'playing') return;
  const r = run.state.pos.r + dr;
  const c = run.state.pos.c + dc;
  const res = run.tapCell(r, c);
  if (!res.ok) return;
  if (res.action === 'fight') { handleTap(r, c); return; }
  if (res.action === 'door') { run.openDoor(r, c); handleEvents(run.drainEvents()); updateHud(); return; }
  if (res.action === 'rock') { run.pushRock(r, c); handleEvents(run.drainEvents()); updateHud(); return; }
  if (res.action === 'npc') { handleNpc(res.ent.role); return; }
  run.stepPath();
  handleEvents(run.drainEvents());
  updateHud();
}

window.addEventListener('keydown', (e) => {
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
    return;
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'result')) { restartGame(); return; }
  if (e.code === 'KeyM') { toggleMute(); return; }
  if (phase !== 'playing') return;
  const map = {
    ArrowUp: [-1, 0], KeyW: [-1, 0],
    ArrowDown: [1, 0], KeyS: [1, 0],
    ArrowLeft: [0, -1], KeyA: [0, -1],
    ArrowRight: [0, 1], KeyD: [0, 1],
  };
  if (map[e.code]) { e.preventDefault(); stepToward(map[e.code][0], map[e.code][1]); }
});

// ---------- 战斗 ----------
function showBattleCard(ent) {
  const h = run.getHud();
  $('battle-name').textContent = nm(ent.name);
  $('battle-hp').textContent = `${t('hp')} ${ent.maxHp}`;
  $('battle-atk').textContent = `${t('attack')} ${ent.atk}`;
  $('battle-def').textContent = `${t('defence')} ${ent.def}`;
  const pred = predictBattle(run.state.player, run.state.combo, ent);
  const p = $('battle-predict');
  if (!pred.safe) {
    p.textContent = `⚠ ${t('hpLow')}`;
  } else {
    p.textContent = `${t('fight')}: ~${pred.hpLoss} ${t('hp')}`;
  }
  $('battle-card').classList.remove('hidden');
}

function hideBattleCard() {
  $('battle-card').classList.add('hidden');
}

function doFight() {
  if (!pendingFight || !run) return;
  const { r, c } = pendingFight;
  pendingFight = null;
  hideBattleCard();
  const before = run.state.player.hp;
  const res = run.fightMonster(r, c);
  lastMonsterCell = { r, c };
  const events = run.drainEvents();
  handleEvents(events);
  // 战斗结果浮层
  if (res.won) {
    const took = before - run.state.player.hp;
    flashBattle(took === 0 ? t('perfectKill') : '✓');
    view.shake = 4;
  } else if (run.state.phase === 'lost') {
    flashBattle(t('loseTitle'));
  } else {
    flashBattle('+');
  }
  updateHud();
}

function flashBattle(text) {
  const el = $('battle-log');
  el.textContent = text;
  $('battle-overlay').classList.remove('hidden');
  clearTimeout(flashBattle._t);
  flashBattle._t = setTimeout(() => $('battle-overlay').classList.add('hidden'), 650);
}

// ---------- NPC / 商店 / 任务 ----------
function handleNpc(role) {
  if (role === 'shop') { showShop(); return; }
  const res = run.interactNpc(role);
  if (res.action === 'shop') { showShop(); return; }
  $('talk-title').textContent = t('questTitle');
  $('talk-text').textContent = t(res.text || 'questGive');
  $('talk-card').classList.remove('hidden');
  handleEvents(run.drainEvents());
}

function showShop() {
  const h = run.getHud();
  $('shop-title').textContent = t('shopTitle');
  $('shop-coins').textContent = `${t('coins')}: ${h.coins}`;
  const itemsEl = $('shop-items');
  itemsEl.innerHTML = '';
  SHOP.forEach((s, i) => {
    const d = document.createElement('div');
    d.className = 'shop-item';
    const name = document.createElement('span');
    name.textContent = nm(ITEMS[s.id].name);
    const btn = document.createElement('button');
    btn.textContent = `${s.basePrice}`;
    btn.addEventListener('click', () => {
      run.buy(i);
      handleEvents(run.drainEvents());
      showShop();
      updateHud();
    });
    d.appendChild(name);
    d.appendChild(btn);
    itemsEl.appendChild(d);
  });
  const enhEl = $('shop-enhance');
  enhEl.innerHTML = '';
  for (const kind of ['sword', 'shield']) {
    const btn = document.createElement('button');
    const slot = run.state.player[kind];
    const maxed = slot.enhance >= GAME.ENHANCE_MAX;
    btn.textContent = `${t(kind)} +${slot.enhance}${maxed ? ' MAX' : ` (${enhancePrice(slot.enhance)})`}`;
    btn.disabled = maxed;
    btn.addEventListener('click', () => {
      run.enhance(kind);
      handleEvents(run.drainEvents());
      showShop();
      updateHud();
    });
    enhEl.appendChild(btn);
  }
  $('shop-card').classList.remove('hidden');
}

// ---------- 事件消费 ----------
function handleEvents(events) {
  for (const ev of events) {
    audio.event(ev.type, ev);
    switch (ev.type) {
      case 'step':
        break;
      case 'hit':
      case 'crit':
        if (lastMonsterCell) pushFx(lastMonsterCell.r, lastMonsterCell.c, `${ev.type === 'crit' ? t('crit') : ''}${ev.dmg}`, '#ffd84e');
        view.shake = 2;
        break;
      case 'monsterHit':
        pushFx(run.state.pos.r, run.state.pos.c, `-${ev.dmg}`, '#ff4f5e');
        view.shake = 3;
        break;
      case 'kill':
        pushFx(lastMonsterCell ? lastMonsterCell.r : run.state.pos.r, lastMonsterCell ? lastMonsterCell.c : run.state.pos.c, `+${ev.exp}`, '#54ff9f');
        break;
      case 'gem':
        pushFx(run.state.pos.r, run.state.pos.c, ev.atk ? `+${ev.atk}` : `+${ev.def}`, ev.atk ? '#ff5a5a' : '#5aa2ff');
        break;
      case 'levelup':
        flashBattle(`LV ${ev.level}!`);
        break;
      case 'floorUp':
        flashBattle(`${t('floor')} ${ev.floor}`);
        break;
      case 'rating':
        starsByFloor[ev.floor] = Math.max(starsByFloor[ev.floor] | 0, ev.stars);
        break;
      case 'win':
      case 'lose':
        finishRun(ev);
        return;
      default:
        break;
    }
  }
}

function pushFx(r, c, text, color) {
  view.fxQueue.push({ type: 'text', r, c, text, color, ttl: 0.9 });
}

// ---------- 结算 ----------
function finishRun(ev) {
  setPhase('result');
  audio.stopBgm();
  if (tutorialStep >= 0) endTutorial();
  const won = ev.type === 'win';
  if (won) {
    Sdk.levelCleared({ floor: run.state.floor });
    bestFloor = Math.max(bestFloor, run.state.floor);
  } else {
    Sdk.gameOver({ floor: run.state.floor });
    bestFloor = Math.max(bestFloor, run.state.maxFloorReached);
  }
  persist();
  const meta = won
    ? `${t('winText')} · ${t('floorReached')} ${run.state.floor} · ★ ${totalStars()}`
    : `${t('loseText')} · ${t('floorReached')} ${run.state.maxFloorReached}`;
  const starsHtml = won
    ? `<span class="stars">${'★'.repeat(Math.min(3, totalStars() % 10))}</span>`
    : '';
  ui.showResult(won ? t('winTitle') : t('loseTitle'), meta, starsHtml);
  audio.event(won ? 'win' : 'lose');
}

// ---------- 教程 ----------
const TUT_STEPS = () => [t('tutStep1'), t('tutStep2'), t('tutStep3')];

function startTutorial() {
  tutorialStep = 0;
  renderTutorialStep();
}

function renderTutorialStep() {
  const el = $('tutorial');
  if (tutorialStep < 0) { el.classList.add('hidden'); return; }
  el.classList.remove('hidden');
  $('tut-title').textContent = t('tutTitle');
  $('tut-text').textContent = TUT_STEPS()[tutorialStep] || '';
  $('tut-skip').textContent = t('skip');
  $('tut-next').textContent = t('gotIt');
}

function tutorialNext() {
  tutorialStep += 1;
  if (tutorialStep >= TUT_STEPS().length) endTutorial();
  else renderTutorialStep();
}

function endTutorial() {
  tutorialStep = -1;
  tutorialDone = true;
  persist();
  renderTutorialStep();
}

// ---------- 主循环 ----------
function frame(now) {
  const dt = Math.min(0.1, (now - lastTime) / 1000);
  lastTime = now;
  view.time += dt;

  if (phase === 'playing' && run) {
    // 逐格移动动画
    if (run.state.path.length) {
      moveCooldown -= dt;
      if (moveCooldown <= 0) {
        run.stepPath();
        handleEvents(run.drainEvents());
        moveCooldown = 0.12;
      }
    } else {
      moveCooldown = 0;
    }
    updateHud();
  }

  if (view.shake > 0) view.shake = Math.max(0, view.shake - dt * 16);
  for (const fx of view.fxQueue) if (fx.ttl > 0) fx.ttl -= dt;

  try {
    renderer.draw(run ? run.state : null, dt, view, view.time);
  } catch (err) {
    console.warn('render error', err);
  }
  view.fxQueue = view.fxQueue.filter((fx) => fx.ttl > 0);

  if (fpsSamples.length < 600 && dt > 0) fpsSamples.push(1 / dt);
  requestAnimationFrame(frame);
}

// ---------- UI 绑定 ----------
function toggleMute() {
  muted = !muted;
  audio.setMuted(muted);
  ui.setMuted(muted);
  persist();
}

function bind() {
  const on = (id, fn) => {
    const el = $(id);
    if (el) el.addEventListener('click', () => { audio.unlock(); fn(); });
  };
  on('btn-start', startGame);
  on('btn-resume', resumeGame);
  on('btn-restart', restartGame);
  on('btn-restart2', restartGame);
  on('btn-retry', restartGame);
  on('btn-home', goHome);
  on('btn-home2', goHome);
  on('btn-home3', goHome);
  on('btn-mute', toggleMute);
  on('btn-fight', doFight);
  on('btn-cancel', hideBattleCard);
  on('btn-shop-close', () => $('shop-card').classList.add('hidden'));
  on('btn-talk-ok', () => $('talk-card').classList.add('hidden'));
  on('btn-tut-replay', () => { if (phase === 'paused') resumeGame(); if (phase === 'playing') startTutorial(); });
  on('btn-howto', () => { if (phase === 'playing' || phase === 'result') startTutorial(); });
  on('tut-next', tutorialNext);
  on('tut-skip', endTutorial);
  on('btn-bag', () => { usePotionSmart(); });
  on('btn-rotate-skip', () => { const rs = $('rotate-screen'); if (rs) rs.style.display = 'none'; });

  for (const id of ['lang-select', 'lang-select-pause']) {
    const sel = $(id);
    if (!sel) continue;
    sel.addEventListener('change', () => {
      ui.setLang(sel.value);
      buildTitle();
      renderTutorialStep();
      if (run) updateHud();
    });
  }
}

function usePotionSmart() {
  if (!run || phase !== 'playing') return;
  if (run.state.bag.items.potion_large > 0) run.usePotion('potion_large');
  else if (run.state.bag.items.potion_small > 0) run.usePotion('potion_small');
  handleEvents(run.drainEvents());
  updateHud();
}

// ---------- 调试契约 ----------
window.__ll = {
  state: {
    get phase() { return phase; },
    get lang() { return i18n.lang; },
  },
  run: () => run,
  sim: () => (run ? run.state : null),
  start: () => startGame(),
  startAct: () => startGame(),
  pause: () => pauseGame(),
  resume: () => resumeGame(),
  restart: () => restartGame(),
  home: () => goHome(),
  save: (key, value) => Sdk.save(key, value),
  ui: () => ui,
  tutorial: {
    get active() { return tutorialStep >= 0; },
    get step() { return tutorialStep; },
    get steps() { return ['move', 'fight', 'floor']; },
    get current() { return tutorialStep >= 0 ? TUT_STEPS()[tutorialStep] : null; },
  },
  startTutorial: () => startTutorial(),
  fps: () => (fpsSamples.length ? fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length : 0),
  debug: {
    state: () => {
      if (!run) return null;
      const st = run.state;
      return {
        phase: st.phase, floor: st.floor, hp: st.player.hp, maxHp: st.player.maxHp,
        attack: st.player.attack, defence: st.player.defence, level: st.player.level,
        coins: st.bag.coins, combo: st.combo, kills: st.kills,
        gridRows: st.grid.length, gridCols: st.grid[0] ? st.grid[0].length : 0,
        monsters: Object.values(st.entities).filter((e) => e.kind === 'monster').length,
        items: Object.values(st.entities).filter((e) => e.kind === 'item').length,
        pos: st.pos,
      };
    },
    layout: () => { try { return renderer.debugLayout(run ? run.state : null); } catch { return null; } },
    tap: (r, c) => { handleTap(r, c); return true; },
    loadFloor: (n) => {
      if (!run) { startGame(); }
      run.loadFloor(Math.max(0, Math.min(GAME.FLOORS, n | 0)), null);
      updateHud();
      return true;
    },
    step: (dir) => {
      const m = { up: [-1, 0], down: [1, 0], left: [0, -1], right: [0, 1] };
      const d = m[dir] || [0, 0];
      stepToward(d[0], d[1]);
      return true;
    },
    fight: (r, c) => { pendingFight = { r, c }; doFight(); return true; },
    setTutorialDone: (b) => { tutorialDone = !!b; persist(); },
    // 自走一小段（供验收/截图快速推进）：向可达的上楼梯贪婪走一步
    fastForward: () => {
      if (!run) { startGame(); }
      let guard = 0;
      while (guard++ < 400 && run.state.phase === 'playing') {
        const st = run.state;
        // 找上楼梯
        let target = null;
        for (let r = 0; r < st.grid.length && !target; r += 1) {
          for (let c = 0; c < st.grid[0].length; c += 1) {
            const e = st.entities[`${r},${c}`];
            if (e && e.kind === 'stairs' && e.dir === 'up') { target = { r, c }; break; }
          }
        }
        if (!target) break;
        if (run.state.floor >= 3) break;
        const res = run.tapCell(target.r, target.c);
        if (res.action === 'move') {
          while (run.state.path.length && run.state.phase === 'playing') run.stepPath();
          handleEvents(run.drainEvents());
        } else break;
      }
      updateHud();
      return true;
    },
  },
};

// ---------- 启动 ----------
bind();
syncDocumentLang();
ui.applyLang();
buildTitle();
$('btn-mute').classList.toggle('is-muted', muted);
Sdk.track('load', {});
requestAnimationFrame(frame);
