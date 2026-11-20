// Marble Dash — original 3D marble roller. Main game orchestration.
import * as THREE from 'three';
import { Engine } from './game/engine.js';
import { Physics, P } from './game/physics.js';
import { LEVELS } from './game/levels.js';
import { Audio } from './game/audio.js';
import { loadSave, persistSave } from './game/storage.js';

const $ = (id) => document.getElementById(id);
const t = (s) => (window.I18N ? window.I18N.t(s) : s);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

// ---------------------------------------------------------------- save
const save = Object.assign({ unlocked: 1, stars: {}, best: {}, bestScore: 0, muted: false }, loadSave() || {});
save.unlocked = clamp(save.unlocked | 0 || 1, 1, LEVELS.length);
function persist() { persistSave(save); }

// ---------------------------------------------------------------- core
const audio = new Audio();
audio.setMuted(!!save.muted);
let engine = null;
const phys = new Physics();
const ballQuat = new THREE.Quaternion();
const _spinQ = new THREE.Quaternion();

let phase = 'title';
let levelIdx = 0;
let lives = 3;
let score = 0;
let levelStartScore = 0;
let time = 0;
let gemsGot = 0;
let respawn = { x: 0, z: 0 };
let fallT = 0, sinkT = 0;
let lastClear = null;
let hintTimer = null, toastTimer = null;
const starTimers = [];

// ---------------------------------------------------------------- input
const keys = Object.create(null);
let touchIX = 0, touchIZ = 0, touchId = null, touchOX = 0, touchOY = 0;
const isTouch = 'ontouchstart' in window;

function inputVec() {
  let ix = 0, iz = 0;
  if (keys.KeyA || keys.ArrowLeft) ix -= 1;
  if (keys.KeyD || keys.ArrowRight) ix += 1;
  if (keys.KeyW || keys.ArrowUp) iz += 1;
  if (keys.KeyS || keys.ArrowDown) iz -= 1;
  ix = clamp(ix + touchIX, -1, 1);
  iz = clamp(iz + touchIZ, -1, 1);
  return [ix, iz];
}

window.addEventListener('keydown', (e) => {
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(e.code)) e.preventDefault();
  keys[e.code] = true;
  if (e.repeat) return;
  audio.unlock();
  if (e.code === 'KeyM') toggleMute();
  if (e.code === 'Space') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'Escape') {
    if (phase === 'playing') pauseGame();
    else if (phase === 'paused') resumeGame();
  }
  if (e.code === 'KeyR' && (phase === 'playing' || phase === 'paused' || phase === 'gameover')) restartLevel();
  if (e.code === 'Enter') {
    if (phase === 'title') startRun(save.unlocked - 1);
    else if (phase === 'clear') nextLevel();
    else if (phase === 'gameover') retryRun();
    else if (phase === 'complete') startRun(0);
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; if (phase === 'playing') pauseGame(); });
document.addEventListener('visibilitychange', () => { if (document.hidden && phase === 'playing') pauseGame(); });

const canvas = $('canvas');
canvas.addEventListener('pointerdown', (e) => {
  audio.unlock();
  if (phase !== 'playing' || !isTouch) return;
  touchId = e.pointerId; touchOX = e.clientX; touchOY = e.clientY;
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', (e) => {
  if (touchId !== e.pointerId) return;
  touchIX = clamp((e.clientX - touchOX) / 55, -1, 1);
  touchIZ = clamp(-(e.clientY - touchOY) / 55, -1, 1);
});
const endTouch = (e) => { if (touchId === e.pointerId) { touchId = null; touchIX = touchIZ = 0; } };
canvas.addEventListener('pointerup', endTouch);
canvas.addEventListener('pointercancel', endTouch);

// ---------------------------------------------------------------- UI helpers
const screens = ['screen-title', 'screen-levels', 'screen-howto', 'screen-pause', 'screen-clear', 'screen-gameover', 'screen-complete'];
function showScreen(id) {
  for (const s of screens) $(s).classList.toggle('is-active', s === id);
}
function hudVisible(v) { $('hud').classList.toggle('hidden', !v); }

function toast(msg, color = '#ffd75e', ms = 1100) {
  const el = $('toast');
  el.textContent = msg;
  el.style.color = color;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), ms);
}

function fmtTime(s) {
  const m = (s / 60) | 0;
  const sec = s - m * 60;
  return `${m}:${sec < 10 ? '0' : ''}${sec.toFixed(1)}`;
}

function updateHUD() {
  $('hud-level').textContent = `${levelIdx + 1}/${LEVELS.length}`;
  $('hud-lvlname').textContent = t(LEVELS[levelIdx].name);
  const ts = fmtTime(time);
  if ($('hud-time').textContent !== ts) $('hud-time').textContent = ts;
  $('hud-score').textContent = score;
  $('hud-best').textContent = save.bestScore;
  $('hud-gems').textContent = `${gemsGot}/${LEVELS[levelIdx].gems.length}`;
  if (updateHUD._lives !== lives) {
    updateHUD._lives = lives;
    let h = '';
    for (let i = 0; i < 3; i++) h += i < lives ? '♥' : '<span class="lost">♡</span>';
    $('hud-lives').innerHTML = h;
  }
}

function updateParLine() {
  const L = LEVELS[levelIdx];
  $('hud-par').innerHTML = `<span class="g">★★★ ≤${L.gold}s</span> · <span class="s">★★ ≤${L.silver}s</span>`;
}

function showHint() {
  const el = $('hint');
  el.textContent = isTouch ? t('hint_touch') : t('hint');
  el.classList.remove('fade');
  clearTimeout(hintTimer);
  hintTimer = setTimeout(() => el.classList.add('fade'), 6000);
}

function toggleMute() {
  save.muted = !save.muted;
  audio.setMuted(save.muted);
  persist();
  const b = $('btn-mute');
  b.classList.toggle('off', save.muted);
  b.textContent = save.muted ? '✕' : '♪';
  b.title = save.muted ? t('Unmute') : t('Mute');
}

function track(ev, data) { try { if (window.PipySDK) window.PipySDK.track(ev, data); } catch (e) { /* noop */ } }

// ---------------------------------------------------------------- flow
function loadLevel(idx) {
  levelIdx = idx;
  const rt = engine.loadLevel(LEVELS[idx]);
  phys.load(rt, rt.start);
  respawn = { x: rt.start.x, z: rt.start.z };
  ballQuat.identity();
  time = 0; gemsGot = 0;
  levelStartScore = score;
  updateParLine();
  updateHUD();
}

function startRun(idx) {
  audio.unlock();
  audio.click();
  lives = 3; score = 0;
  loadLevel(clamp(idx, 0, LEVELS.length - 1));
  phase = 'playing';
  engine.attract = false;
  showScreen(null);
  hudVisible(true);
  showHint();
  toast(t('GO!'), '#5eead4', 800);
  track('start', { level: levelIdx + 1 });
}

function restartLevel() {
  audio.click();
  lives = 3;
  score = levelStartScore;
  loadLevel(levelIdx);
  phase = 'playing';
  engine.attract = false;
  showScreen(null);
  hudVisible(true);
  showHint();
  toast(t('GO!'), '#5eead4', 800);
  track('restart', { level: levelIdx + 1 });
}

function pauseGame() {
  if (phase !== 'playing') return;
  phase = 'paused';
  audio.click();
  audio.roll(0, false);
  showScreen('screen-pause');
}
function resumeGame() {
  if (phase !== 'paused') return;
  phase = 'playing';
  audio.click();
  showScreen(null);
}

function toMenu() {
  phase = 'title';
  engine.attract = true;
  hudVisible(false);
  audio.roll(0, false);
  $('title-best').textContent = save.bestScore;
  showScreen('screen-title');
}

function starsFor(tm, L) { return tm <= L.gold ? 3 : tm <= L.silver ? 2 : 1; }

function levelCleared() {
  const L = LEVELS[levelIdx];
  const stars = starsFor(time, L);
  const bonus = 500 + Math.max(0, Math.round((L.silver * 2 - time) * 20));
  score += bonus;
  updateHUD();
  const prevBest = save.best[levelIdx];
  const newRecord = prevBest == null || time < prevBest;
  if (newRecord) save.best[levelIdx] = Math.round(time * 10) / 10;
  save.stars[levelIdx] = Math.max(save.stars[levelIdx] || 0, stars);
  save.unlocked = Math.max(save.unlocked, Math.min(LEVELS.length, levelIdx + 2));
  if (score > save.bestScore) save.bestScore = score;
  persist();
  lastClear = { stars, bonus, time, gems: gemsGot, total: LEVELS[levelIdx].gems.length, newRecord };
  try { if (window.PipySDK) window.PipySDK.levelCleared({ level: levelIdx + 1, score, stars, time: Math.round(time) }); } catch (e) { /* noop */ }
  track('win', { level: levelIdx + 1, stars, time: Math.round(time) });

  if (levelIdx >= LEVELS.length - 1) {
    phase = 'complete';
    audio.complete();
    const totalStars = Object.values(save.stars).reduce((a, b) => a + b, 0);
    $('complete-stars-n').textContent = `${totalStars}/${LEVELS.length * 3}`;
    $('complete-score').textContent = score;
    $('complete-record').classList.toggle('hidden', score < save.bestScore || score === 0);
    const cs = $('complete-stars');
    cs.innerHTML = '';
    for (let i = 0; i < 3; i++) {
      const sp = document.createElement('span');
      sp.className = 'st' + (i < Math.min(3, Math.round(totalStars / LEVELS.length)) ? ' on' : '');
      sp.textContent = '★';
      cs.appendChild(sp);
    }
    hudVisible(false);
    showScreen('screen-complete');
    confetti();
    return;
  }

  phase = 'clear';
  hudVisible(false);
  $('clear-time').textContent = fmtTime(time);
  $('clear-gems').textContent = `${gemsGot}/${L.gems.length}`;
  $('clear-bonus').textContent = `+${bonus}`;
  $('clear-score').textContent = score;
  $('clear-record').classList.toggle('hidden', !newRecord);
  renderClearStars(stars);
  showScreen('screen-clear');
  confetti();
}

function renderClearStars(stars) {
  const el = $('clear-stars');
  el.innerHTML = '';
  for (let i = 0; i < 3; i++) {
    const sp = document.createElement('span');
    sp.className = 'st';
    sp.textContent = '★';
    el.appendChild(sp);
  }
  const rating = $('clear-rating');
  rating.className = 'rating ' + (stars === 3 ? 'gold' : stars === 2 ? 'silver' : 'bronze');
  rating.textContent = t(stars === 3 ? 'GOLD' : stars === 2 ? 'SILVER' : 'BRONZE');
  for (const tm of starTimers) clearTimeout(tm);
  starTimers.length = 0;
  for (let i = 0; i < stars; i++) {
    starTimers.push(setTimeout(() => {
      el.children[i].classList.add('on');
      audio.star(i);
    }, 350 + i * 380));
  }
}

function confetti() {
  const g = engine.rt.goal;
  for (let k = 0; k < 3; k++) {
    setTimeout(() => {
      if (!engine.rt) return;
      engine.burst(g.x + (Math.random() - 0.5) * 2, g.y + 1.5, g.z + (Math.random() - 0.5) * 2,
        [0xffd75e, 0x5eead4, 0xf472b6, 0x7dd3fc, 0xa3e635, 0xfb923c], 46, 8, { grav: 7, life: 2.0, up: 1.4, upBias: 3 });
    }, k * 260);
  }
}

function nextLevel() {
  audio.click();
  lives = 3;
  loadLevel(levelIdx + 1);
  phase = 'playing';
  showScreen(null);
  hudVisible(true);
  showHint();
  toast(t('GO!'), '#5eead4', 800);
}

function retryRun() {
  audio.click();
  lives = 3;
  score = levelStartScore;
  loadLevel(levelIdx);
  phase = 'playing';
  showScreen(null);
  hudVisible(true);
  showHint();
  track('restart', { level: levelIdx + 1, after: 'gameover' });
}

function gameOver() {
  phase = 'gameover';
  audio.gameover();
  audio.roll(0, false);
  if (score > save.bestScore) { save.bestScore = score; persist(); }
  $('over-level').textContent = `${t('LEVEL')} ${levelIdx + 1}`;
  $('over-score').textContent = score;
  hudVisible(false);
  showScreen('screen-gameover');
  try { if (window.PipySDK) window.PipySDK.gameOver({ score, level: levelIdx + 1 }); } catch (e) { /* noop */ }
  track('fail', { level: levelIdx + 1, score });
}

// ---------------------------------------------------------------- physics events
function drainEvents() {
  const rt = engine.rt;
  for (const ev of phys.events) {
    switch (ev.type) {
      case 'gem':
        score += 100; gemsGot++;
        audio.gem();
        engine.burst(ev.x, ev.y, ev.z, [0x5eead4, 0xa7f3d0, 0xffffff], 22, 5, { grav: 6, life: 0.7 });
        toast('+100', '#5eead4', 650);
        updateHUD();
        break;
      case 'bounce':
        audio.bounce(ev.speed);
        engine.addShake(Math.min(0.18, ev.speed * 0.015));
        engine.burst(ev.x, phys.pos.y - 0.2, ev.z, [0x9db4ff, 0xffffff], 6, 3, { grav: 10, life: 0.4 });
        break;
      case 'land':
        audio.land(ev.speed);
        engine.addShake(Math.min(0.3, ev.speed * 0.02));
        engine.burst(phys.pos.x, phys.pos.y - 0.45, phys.pos.z, [0x8f9dff, 0x5b6bb8], 12, 3.5, { grav: 12, life: 0.5, up: 0.5 });
        break;
      case 'boost':
        audio.boost();
        engine.burst(phys.pos.x, phys.pos.y - 0.3, phys.pos.z + 0.4, [0xffd75e, 0xfb923c], 16, 4, { grav: 4, life: 0.6 });
        break;
      case 'bumper': {
        audio.bumper();
        const b = rt.bumpers[ev.idx];
        if (b) b.flash = 1;
        engine.addShake(0.16);
        engine.burst(ev.x, (b ? b.y : 0) + 0.7, ev.z, [0xf472b6, 0xfbcfe8], 14, 5, { grav: 8, life: 0.6 });
        break;
      }
      case 'hit':
        audio.hit();
        engine.addShake(0.32);
        engine.burst(ev.x, phys.pos.y, ev.z, [0xff9f43, 0xffd75e], 16, 5, { grav: 9, life: 0.6 });
        break;
      case 'checkpoint':
        audio.checkpoint();
        respawn = { x: ev.x, z: ev.z, y: ev.y || 0 };
        rt.checkpoints[ev.idx].mat.color.set(0x4ade80);
        engine.burst(ev.x, 0.4, ev.z, [0x4ade80, 0x5eead4], 20, 4, { grav: 5, life: 0.8, up: 1.2 });
        toast(t('CHECKPOINT'), '#4ade80', 1000);
        break;
      case 'fall':
        if (phase !== 'playing') break;
        lives--;
        updateHUD();
        audio.fall();
        audio.roll(0, false);
        engine.addShake(0.7);
        const fl = $('flash');
        fl.classList.add('on');
        setTimeout(() => fl.classList.remove('on'), 90);
        phase = 'falling';
        fallT = 1.05;
        break;
      case 'goal':
        if (phase !== 'playing') break;
        phase = 'sinking';
        sinkT = 0;
        audio.win();
        audio.roll(0, false);
        break;
    }
  }
  phys.events.length = 0;
}

// ---------------------------------------------------------------- level select
function buildLevelGrid() {
  const grid = $('level-grid');
  grid.innerHTML = '';
  LEVELS.forEach((L, i) => {
    const unlocked = i < save.unlocked;
    const b = document.createElement('button');
    b.className = 'lvl-card' + (unlocked ? '' : ' locked');
    const st = save.stars[i] || 0;
    const stars = '★'.repeat(st) + `<span class="off">${'★'.repeat(3 - st)}</span>`;
    const bt = save.best[i] != null ? fmtTime(save.best[i]) : '—';
    b.innerHTML = `<div class="n">${unlocked ? i + 1 : '🔒'}</div><div class="nm">${t(L.name)}</div><div class="st">${stars}</div><div class="bt">${bt}</div>`;
    if (unlocked) b.addEventListener('click', () => { startRun(i); });
    grid.appendChild(b);
  });
}

// ---------------------------------------------------------------- wiring
function wire() {
  $('btn-play').addEventListener('click', () => startRun(save.unlocked - 1));
  $('btn-levels').addEventListener('click', () => { audio.unlock(); audio.click(); buildLevelGrid(); phase = 'levels'; showScreen('screen-levels'); });
  $('btn-levels-back').addEventListener('click', () => { audio.click(); toMenu(); });
  $('btn-howto').addEventListener('click', () => { audio.unlock(); audio.click(); phase = 'howto'; showScreen('screen-howto'); });
  $('btn-howto-back').addEventListener('click', () => { audio.click(); toMenu(); });
  $('btn-pause').addEventListener('click', () => { if (phase === 'playing') pauseGame(); });
  $('btn-resume').addEventListener('click', resumeGame);
  $('btn-restart-pause').addEventListener('click', restartLevel);
  $('btn-menu-pause').addEventListener('click', () => { audio.click(); toMenu(); });
  $('btn-mute').addEventListener('click', () => { audio.unlock(); toggleMute(); });
  $('btn-next').addEventListener('click', nextLevel);
  $('btn-replay').addEventListener('click', () => { score = levelStartScore; restartLevel(); });
  $('btn-retry').addEventListener('click', retryRun);
  $('btn-menu-over').addEventListener('click', () => { audio.click(); toMenu(); });
  $('btn-again').addEventListener('click', () => startRun(0));
  $('btn-menu-complete').addEventListener('click', () => { audio.click(); toMenu(); });
  window.addEventListener('resize', () => engine && engine.resize());
  window.addEventListener('langchange', () => {
    updateHUD(); updateParLine();
    if (lastClear && phase === 'clear') renderClearStars(lastClear.stars);
    if (phase === 'levels') buildLevelGrid();
    $('title-best').textContent = save.bestScore;
  });
}

// ---------------------------------------------------------------- boot
function boot() {
  try {
    engine = new Engine(canvas);
  } catch (e) {
    $('loading').innerHTML = '<div style="max-width:420px;text-align:center;line-height:1.6">' + t('WebGL is not available in this browser.') + '</div>';
    return;
  }
  wire();
  loadLevel(0);
  engine.attract = true;
  $('title-best').textContent = save.bestScore;
  const mb = $('btn-mute');
  mb.classList.toggle('off', !!save.muted);
  mb.textContent = save.muted ? '✕' : '♪';
  if (isTouch) $('hint').textContent = t('hint_touch');
  else $('hint').textContent = t('hint');
  $('loading').style.display = 'none';
  track('load', {});

  let last = performance.now();
  function frame(now) {
    requestAnimationFrame(frame);
    let dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    if (dt <= 0) dt = 0.001;

    if (phase === 'playing') {
      time += dt;
      const [ix, iz] = inputVec();
      phys.setTiltFromInput(ix, iz);
      phys.update(dt);
      drainEvents();
      // rolling rotation
      if (phys.spinSpeed > 0.01) {
        _spinQ.setFromAxisAngle(phys.spinAxis, phys.spinSpeed * dt);
        ballQuat.premultiply(_spinQ);
      }
      engine.setBall(phys.pos, ballQuat);
      audio.roll(Math.hypot(phys.vel.x, phys.vel.z), phys.grounded);
      // tilt meter
      const dot = $('tilt-dot');
      dot.style.transform = `translate(${(-phys.roll / P.MAX_TILT) * 22}px, ${(phys.pitch / P.MAX_TILT) * 22}px)`;
      updateHUD();
    } else if (phase === 'falling') {
      phys.setTiltFromInput(0, 0);
      phys.update(dt);
      phys.events.length = 0;
      engine.setBall(phys.pos, ballQuat);
      fallT -= dt;
      if (fallT <= 0) {
        if (lives <= 0) { gameOver(); }
        else {
          phys.respawn(respawn);
          ballQuat.identity();
          phase = 'playing';
          toast(t('Careful!'), '#ff5d8f', 900);
        }
      }
    } else if (phase === 'sinking') {
      sinkT += dt;
      const g = engine.rt.goal;
      const k = Math.min(1, sinkT / 0.8);
      phys.pos.x += (g.x - phys.pos.x) * Math.min(1, 10 * dt);
      phys.pos.z += (g.z - phys.pos.z) * Math.min(1, 10 * dt);
      phys.pos.y = g.y + P.R - k * k * 1.6;
      const s = 1 - k * 0.85;
      engine.ballGroup.scale.set(s, s, s);
      engine.setBall(phys.pos, ballQuat);
      if (sinkT >= 0.95) {
        engine.ballGroup.scale.set(1, 1, 1);
        levelCleared();
      }
    } else {
      // idle ball on title / menus
      if (engine.attract && engine.rt) {
        phys.pos.set(engine.rt.start.x, P.R + 0.02 + Math.sin(now * 0.002) * 0.03, engine.rt.start.z);
        ballQuat.multiply(_spinQ.setFromAxisAngle(_v3.set(0.3, 1, 0.2).normalize(), dt * 0.5));
        engine.setBall(phys.pos, ballQuat);
      }
    }

    engine.update(dt, phys, phase);
  }
  const _v3 = new THREE.Vector3();
  requestAnimationFrame(frame);
}

// ---------------------------------------------------------------- debug / test API
window.__marble = {
  state: () => ({
    phase, level: levelIdx, lives, score, time: Math.round(time * 100) / 100,
    gems: gemsGot, gemsTotal: LEVELS[levelIdx].gems.length,
    unlocked: save.unlocked,
    ball: { x: phys.pos.x, y: phys.pos.y, z: phys.pos.z, vx: phys.vel.x, vy: phys.vel.y, vz: phys.vel.z },
    grounded: phys.grounded,
    tilt: { pitch: phys.pitch, roll: phys.roll },
    movers: engine.rt ? engine.rt.movers.map((m) => ({ x: m.px, z: m.pz, w: m.w, d: m.d, axis: m.axis })) : [],
    spinners: engine.rt ? engine.rt.spinners.map((s) => ({ x: s.x, z: s.z, angle: s.angle, len: s.len })) : [],
    goal: engine.rt ? { x: engine.rt.goal.x, y: engine.rt.goal.y, z: engine.rt.goal.z } : null,
  }),
  waypoints: () => LEVELS[levelIdx].guide.map((p) => [p[0], p[1]]),
  start: (idx) => startRun(clamp(idx | 0, 0, LEVELS.length - 1)),
  press: (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })),
  release: (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })),
};

boot();