import { CONFIG } from '../config/game.config.js';
import { LEVELS } from '../config/levels/index.js';
import { parseLevel } from './game/level.js';
import { Match } from './game/match.js';
import { makeCamera, updateCamera } from './game/camera.js';
import { createStage, resize, applyCamera } from './render/scene.js';
import { buildWorld, buildBackdrop, buildEntities } from './render/world.js';
import { createEnemyMesh, createItemMesh, createFireballMesh } from './render/actor.js';
import { createCharacter } from './render/character.js';
import { createFx } from './render/fx.js';
import { loadCharacterArt } from './render/art.js';
import { loadEnvArt } from './render/assets.js';
import { createUI } from './ui/ui.js';
import { GameAudio } from './audio.js';
import { loadSave, recordClear, updateSettings } from './core/save.js';
import { t, setLang, getLang, applyI18n } from './core/i18n.js';
import { guardDomain } from './core/domainlock.js';
import { Sdk, injectSdk } from './core/sdk.js';
import { makeCard, shareCard } from './core/share.js';
import { addGears } from './core/save.js';

const domainLocked = guardDomain();

const STEP = 1 / CONFIG.logicFps;
const canvas = document.getElementById('game');
const qs = new URLSearchParams(location.search);

setLang(qs.get('lang') || CONFIG.lang || 'en');

const stage = createStage(canvas);
const ui = createUI();
const audio = new GameAudio();
const fx = createFx(stage.scene);
let save = loadSave();

let state = 'loading';
let current = 0;
let level = null;
let match = null;
let world = null;
let backdrop = null;
let entities = null;
let actor = null;
let cam = null;
let charArt = null;
let envArt = null;
let shakeAmp = 0;
let hitstop = 0;
let enemyMeshes = new Map();
const itemMeshes = new Map();
const fireMeshes = new Map();

const input = { left: false, right: false, jumpHeld: false, jumpPressed: false, run: false, firePressed: false };

let lastDeath = null;
let lastClear = null;
let reviveTimer = null;

// ---------------------------------------------------------------- 关卡装载
function disposeScene() {
  for (const g of [world?.group, backdrop?.group, entities?.group, actor?.group]) {
    if (g) stage.scene.remove(g);
  }
  for (const m of enemyMeshes.values()) stage.scene.remove(m);
  for (const m of itemMeshes.values()) stage.scene.remove(m);
  for (const m of fireMeshes.values()) stage.scene.remove(m);
  enemyMeshes = new Map();
  itemMeshes.clear();
  fireMeshes.clear();
}

function wireMatch(m) {
  m.on('jump', () => audio.jump());
  m.on('land', () => audio.land());
  m.on('coin', (d) => { audio.coin(); ui.setGears(d.gears); });
  m.on('stomp', (d) => {
    audio.stomp();
    shake(0.18);
    hitstop = 0.06;
    const flash = document.getElementById('flash');
    if (flash) flash.animate([{ opacity: 0.85 }, { opacity: 0 }], { duration: 170, easing: 'ease-out' });
    const x = d?.x ?? match.player.body.x;
    const y = (d?.y ?? match.player.body.y) + 0.45;
    fx.spawn(x, y);
  });
  m.on('shell', () => audio.stomp());
  m.on('kick', () => { audio.kick(); shake(0.1); });
  m.on('hurt', () => { audio.hurt(); shake(0.2); });
  m.on('death', (d) => {
    ui.setDeaths(d.deaths);
    lastDeath = d;
    Sdk.track('death', { level: current + 1, x: Math.round(d.x), y: Math.round(d.y), cause: d.cause });
    if (Sdk.canShow('revive', { levelIndex: current, cause: d.cause })) showRevive();
    else ui.toast('TRY AGAIN', 900);
  });
  m.on('checkpoint', () => { audio.checkpoint(); ui.toast('CHECKPOINT'); });
  m.on('bump', (d) => { audio.bump(); if (d.question && world) world.setTile(d.tx, d.ty, 'used'); shake(0.06); });
  m.on('break', (d) => { audio.brick(); if (world) world.setTile(d.tx, d.ty, 'gone'); shake(0.12); });
  m.on('powerup', (d) => { audio.powerup(); ui.toast(d?.kind === 'flower' ? 'FIRE' : 'BIG', 900); });
  m.on('fire', () => audio.fire());
  m.on('spring', () => audio.spring());
  m.on('clear', (d) => onClear(d));
}

function syncEnemies() {
  for (const m of enemyMeshes.values()) stage.scene.remove(m);
  enemyMeshes = new Map();
  for (const e of match.enemies) {
    const tex = envArt ? (e.kind === 'shell' ? envArt.shell : envArt.beetle) : null;
    const mesh = createEnemyMesh(e.kind, tex);
    stage.scene.add(mesh);
    enemyMeshes.set(e, mesh);
  }
}

function startLevel(index, { silent = false } = {}) {
  current = index;
  Sdk.newRun(index);
  Sdk.track('level_start', { level: index + 1 });
  const def = LEVELS[index];
  level = parseLevel(def);
  match = new Match(level);
  wireMatch(match);

  disposeScene();
  world = buildWorld(level, envArt);
  stage.scene.add(world.group);
  backdrop = buildBackdrop(level, envArt);
  stage.scene.add(backdrop.group);
  entities = buildEntities(level, envArt);
  stage.scene.add(entities.group);
  actor = createCharacter(charArt);
  stage.scene.add(actor.group);
  syncEnemies();

  cam = makeCamera(level);
  ui.setLevel(def.id, def.name?.[getLang()] ?? def.name?.en ?? '');
  ui.setGearTotal(level.pickups.length);
  ui.setGears(0);
  ui.setDeaths(0);
  ui.setTime(level.timeLimit);
  state = silent ? 'title' : 'play';
  if (!silent) ui.show('play');
}

async function onClear(d) {
  const def = LEVELS[current];
  const res = recordClear(def.id, { time: d.time, gears: d.gears, total: d.total, deaths: d.deaths }, current + 2);
  save = loadSave();
  state = 'clear';
  audio.clear();
  Sdk.levelCleared({ level: current + 1, time: d.time, gears: d.gears, deaths: d.deaths, stars: res.stars });
  lastClear = { def, d, res };

  await Sdk.showInterstitial('stageClear', { levelIndex: current });

  const isLast = current + 1 >= LEVELS.length;
  ui.showClear({
    title: isLast ? t('allclear') : t('clear'),
    stars: res.stars,
    stats: `${t('gears')} ${d.gears}/${d.total} · ${t('deaths')} ${d.deaths} · ${t('time')} ${d.time}s`,
    hasNext: !isLast,
  });
  document.getElementById('btnDouble').classList.toggle('hidden', !Sdk.canShow('doubleCoins', { levelIndex: current }));
}

function showRevive() {
  state = 'revive';
  const box = document.getElementById('scr-revive');
  const label = document.getElementById('reviveTimer');
  box.classList.remove('hidden');
  let left = 6;
  label.textContent = `${left}s`;
  clearInterval(reviveTimer);
  reviveTimer = setInterval(() => {
    left -= 1;
    label.textContent = `${Math.max(0, left)}s`;
    if (left <= 0) declineRevive();
  }, 1000);
}

function closeRevive() {
  clearInterval(reviveTimer);
  document.getElementById('scr-revive').classList.add('hidden');
  state = 'play';
  ui.show('play');
}

function declineRevive() { closeRevive(); }

async function acceptRevive() {
  const btn = document.getElementById('btnRevive');
  btn.disabled = true;
  const ok = await Sdk.showRewarded('revive', { levelIndex: current, cause: lastDeath?.cause });
  btn.disabled = false;
  if (!ok) { declineRevive(); return; }
  if (lastDeath) {
    match.player.respawn(lastDeath.x, lastDeath.y);
    match.player.invuln = 1.5;
  }
  closeRevive();
}

// ---------------------------------------------------------------- 游戏循环
function step(dt) {
  if (state !== 'play') return;
  const wasEnded = match.ended;
  match.update(input, dt);
  input.jumpPressed = false;
  input.firePressed = false;
  ui.setTime(match.timeLeft);
  ui.setGears(match.gears);
  if (!wasEnded && !match.ended) {
    updateCamera(cam, { ...match.player.body, grounded: match.player.body.grounded }, level, dt);
  }
}

function groundBelow(x, y) {
  const tx = Math.floor(x);
  for (let ty = Math.floor(y); ty >= 0; ty--) if (level.isSolid(tx, ty)) return ty + 1;
  return null;
}

function syncItems() {
  for (const [it, mesh] of itemMeshes) {
    if (!it.alive) { stage.scene.remove(mesh); itemMeshes.delete(it); }
  }
  for (const it of match.items) {
    if (itemMeshes.has(it)) continue;
    const mesh = createItemMesh(it.kind);
    stage.scene.add(mesh);
    itemMeshes.set(it, mesh);
  }
}

function syncFireballs() {
  for (const [f, mesh] of fireMeshes) {
    if (!f.alive) { stage.scene.remove(mesh); fireMeshes.delete(f); }
  }
  for (const f of match.fireballs) {
    if (fireMeshes.has(f)) continue;
    const mesh = createFireballMesh();
    stage.scene.add(mesh);
    fireMeshes.set(f, mesh);
  }
  for (const [f, mesh] of fireMeshes) mesh.position.set(f.body.x, f.body.y, 0.2);
}

let acc = 0;
let last = performance.now();

function render(alpha) {
  if (!actor || !match) return;
  const p = match.player;
  const b = p.body;
  const x = p.prev.x + (b.x - p.prev.x) * alpha;
  const y = p.prev.y + (b.y - p.prev.y) * alpha;

  actor.update(1 / 60, {
    x,
    // body.y 是 AABB 中心，角色 root 在脚底，这里换算成脚底高度
    y: y - b.hh,
    facing: p.facing,
    vx: b.vx,
    vy: b.vy,
    grounded: b.grounded,
    big: p.state !== 'small',
    fire: p.state === 'fire',
    shadowY: groundBelow(x, y),
    onFootstep: (fx1, fy1) => fx.dust(fx1, fy1),
  });

  if (world && world.updateDecals) world.updateDecals(x);

  for (const [it, mesh] of itemMeshes) {
    mesh.visible = it.alive;
    mesh.position.set(it.body.x, it.body.y, 0);
  }
  for (const [e, mesh] of enemyMeshes) {
    const eb = e.body;
    mesh.visible = e.alive;
    mesh.position.set(eb.x, eb.y, 0);
    // 贴图默认头朝左；向右移动时才需要镜像
    mesh.scale.set(e.dir >= 0 ? -1 : 1, e.state === 'shell' ? 0.55 : 1, 1);
  }

  applyCamera(stage, cam);
  if (shakeAmp > 0.001) {
    stage.camera.position.x += (Math.random() - 0.5) * shakeAmp;
    stage.camera.position.y += (Math.random() - 0.5) * shakeAmp;
    shakeAmp *= 0.86;
  }
  if (backdrop) backdrop.update(cam.x, cam.y);
  if (entities) entities.update(1 / 60);
  syncItems();
  syncFireballs();
  stage.renderer.render(stage.scene, stage.camera);
}

function frame(now) {
  const dt = Math.min((now - last) / 1000, 0.25);
  last = now;
  fx.update(dt);
  if (hitstop > 0) {
    hitstop -= dt;
    acc = 0;
    render(0.5);
    requestAnimationFrame(frame);
    return;
  }
  acc += dt;
  let steps = 0;
  while (acc >= STEP && steps < 6) { step(STEP); acc -= STEP; steps++; }
  if (steps === 6) acc = 0;
  render(acc / STEP);
  requestAnimationFrame(frame);
}

function shake(a) {
  if (!save.settings.shake) return;
  shakeAmp = Math.max(shakeAmp, a);
}

// ---------------------------------------------------------------- 流程
function goTitle() {
  Sdk.track('quit', { level: current + 1 });
  state = 'title';
  ui.show('title');
}

function goSelect() {
  state = 'select';
  ui.buildLevels(LEVELS, loadSave(), (i) => startLevel(i));
  ui.show('select');
}

function pause() {
  if (state !== 'play') return;
  state = 'pause';
  ui.show('pause');
}

function resume() {
  if (state !== 'pause') return;
  state = 'play';
  ui.show('play');
}

function openSettings(from) {
  settingsFrom = state;
  state = 'settings';
  ui.show('settings');
}

let settingsFrom = 'title';

function applyAudioSettings() {
  audio.setMusicVolume(save.settings.music);
  audio.setSfxVolume(save.settings.sfx);
}

function bindUI() {
  ui.el.play.addEventListener('click', () => {
    audio.ensure();
    audio.resume();
    applyAudioSettings();
    audio.startMusic();
    goSelect();
  });
  ui.el.settings.addEventListener('click', () => openSettings('title'));
  ui.el.back.addEventListener('click', goTitle);
  ui.el.resume.addEventListener('click', resume);
  ui.el.restart.addEventListener('click', () => startLevel(current));
  ui.el.pauseSettings.addEventListener('click', () => openSettings('pause'));
  ui.el.quit.addEventListener('click', goTitle);
  ui.el.settingsBack.addEventListener('click', () => {
    state = settingsFrom;
    ui.show(settingsFrom === 'pause' ? 'pause' : settingsFrom);
  });

  ui.el.musicRange.addEventListener('input', (e) => {
    save = updateSettings({ music: Number(e.target.value) / 100 });
    audio.setMusicVolume(save.settings.music);
  });
  ui.el.sfxRange.addEventListener('input', (e) => {
    save = updateSettings({ sfx: Number(e.target.value) / 100 });
    audio.setSfxVolume(save.settings.sfx);
    audio.coin();
  });
  ui.el.shake.addEventListener('click', () => {
    save = updateSettings({ shake: !save.settings.shake });
    ui.el.shake.textContent = save.settings.shake ? t('on') : t('off');
  });

  ui.el.next.addEventListener('click', () => startLevel(Math.min(current + 1, LEVELS.length - 1)));
  ui.el.retry.addEventListener('click', () => startLevel(current));
  ui.el.select.addEventListener('click', goSelect);

  document.getElementById('btnRevive').addEventListener('click', acceptRevive);
  document.getElementById('btnGiveUp').addEventListener('click', declineRevive);

  document.getElementById('btnDouble').addEventListener('click', async (e) => {
    const btn = e.currentTarget;
    if (!lastClear) return;
    const ok = await Sdk.showRewarded('doubleCoins', { levelIndex: current });
    if (ok) {
      addGears(lastClear.d.gears);
      btn.textContent = `+${lastClear.d.gears} GEARS`;
      btn.disabled = true;
    }
  });

  document.getElementById('btnShare').addEventListener('click', async () => {
    if (!lastClear) return;
    const card = await makeCard(stage.renderer.domElement, {
      levelId: lastClear.def.id,
      levelName: lastClear.def.name?.en ?? '',
      stars: lastClear.res.stars,
      gears: lastClear.d.gears,
      total: lastClear.d.total,
      deaths: lastClear.d.deaths,
      time: lastClear.d.time,
    });
    const how = await shareCard(card, 'WIND-UP KID — beat my run!');
    Sdk.track('share', { platform: how });
    ui.toast(how === 'shared' ? 'SHARED' : 'SAVED');
  });

  ui.applySettings(save.settings, {});
}

// ---------------------------------------------------------------- 输入
const keyMap = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  ShiftLeft: 'run', ShiftRight: 'run', KeyX: 'run',
  Space: 'jump', KeyZ: 'jump', ArrowUp: 'jump', KeyW: 'jump',
  KeyJ: 'fire', KeyF: 'fire',
};

function wakeAudio() { audio.ensure(); audio.resume(); }

window.addEventListener('keydown', (e) => {
  wakeAudio();
  if (e.code === 'Escape' || e.code === 'KeyP') {
    if (state === 'play') pause();
    else if (state === 'pause') resume();
    return;
  }
  if (e.code === 'KeyR' && state === 'play') { startLevel(current); return; }
  if (state !== 'play') return;
  const k = keyMap[e.code];
  if (!k) return;
  e.preventDefault();
  if (e.repeat) return;
  if (k === 'jump') { input.jumpHeld = true; input.jumpPressed = true; }
  else if (k === 'fire') input.firePressed = true;
  else input[k] = true;
});

window.addEventListener('keyup', (e) => {
  const k = keyMap[e.code];
  if (!k) return;
  if (k === 'jump') input.jumpHeld = false;
  else if (k === 'fire') { /* 一次性触发 */ }
  else input[k] = false;
});

document.querySelectorAll('[data-key]').forEach((el) => {
  const key = el.dataset.key;
  const down = (e) => {
    e.preventDefault();
    wakeAudio();
    if (state !== 'play') return;
    if (key === 'jump') { input.jumpHeld = true; input.jumpPressed = true; }
    else if (key === 'fire') input.firePressed = true;
    else input[key] = true;
    el.classList.add('active');
  };
  const up = () => {
    if (key === 'jump') input.jumpHeld = false;
    else if (key !== 'fire') input[key] = false;
    el.classList.remove('active');
  };
  el.addEventListener('pointerdown', down);
  el.addEventListener('pointerup', up);
  el.addEventListener('pointercancel', up);
  el.addEventListener('pointerleave', up);
});

window.addEventListener('resize', () => resize(stage));
window.addEventListener('blur', () => {
  input.left = input.right = input.jumpHeld = input.run = false;
  if (state === 'play') pause();
});

// ---------------------------------------------------------------- 启动
async function boot() {
  if (domainLocked) return;
  applyI18n();
  bindUI();
  resize(stage);
  ui.setLoading(0.1);
  Sdk.track('load', {});

  await injectSdk();
  await Sdk.ready();

  const [char, env] = await Promise.all([
    loadCharacterArt().catch(() => null),
    loadEnvArt().catch(() => null),
  ]);
  charArt = char;
  envArt = env;
  ui.setLoading(0.85);

  applyAudioSettings();
  startLevel(0, { silent: true });
  ui.setLoading(1);
  state = 'title';
  ui.show('title');

  requestAnimationFrame(frame);

  if (qs.has('debug')) {
    window.__wk = {
      get match() { return match; },
      get player() { return match.player; },
      get level() { return level; },
      get cam() { return cam; },
      get state() { return state; },
      stage, audio, fx, startLevel, goTitle, goSelect, ui, input,
      unpause() { if (state === 'pause') { state = 'play'; ui.show('play'); } },
      go(x, y) {
        const b = match.player.body;
        b.x = x; b.y = y ?? 2.475; b.vx = 0; b.vy = 0;
        match.player.prev.x = b.x;
        match.player.prev.y = b.y;
      },
    };
  }
}

boot();
