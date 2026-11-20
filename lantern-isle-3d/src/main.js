// 主入口：装配舞台/世界/角色/sim/UI/音频/SDK + 60Hz 固定步长 + 观察契约（window.__ll 与 window.__game3d）。
// 分工：sim 判玩法，controller 判运动，render 只读状态，ui 只读 snapshot，main 只做接线。
import { THREE, createStage, FixedLoop, Input, mulberry32 } from './core/base3d.js';
import { STEP, CONFIG } from '../config/game.config.js';
import { createSim } from './game/sim.js';
import { createWorld } from './render/island.js';
import { createActors } from './render/actors.js';
import { createUI } from './ui/hud.js';
import { createGameAudio } from './core/game-audio.js';
import { i18n, t, syncDocumentLang } from './core/i18n.js';
import { save } from './core/save.js';
import { Sdk } from './core/sdk.js';
import { NPC_PROFILES } from '../config/npc.js';
import { installBridge } from './core/debug-bridge.js';
let bible = null;
const canvas = document.getElementById('canvas');
// 舞台在 boot() 里创建（要先拿到 Art Bible 的光照/雾色）
let stage, renderer, scene, camera;

const registry = new Map();
// 世界物体登记表（probe objects 的数据源）；Map 上加个 register 方便 render 侧调用
registry.register = function (name, obj, tags = []) { obj.userData = obj.userData || {}; obj.userData.tags = tags; obj.name = name; this.set(name, obj); return this.size; };
const fallbackReports = [];
const audio = createGameAudio();
const sim = createSim(CONFIG, NPC_PROFILES, CONFIG.upgrades);

let phase = 'boot';
let bootReady = false;
let worldReady = false;
let pendingStart = null;
let world = null;
let actors = null;
let orbit = null;
let paused = false;
let runId = null;
let lastFrameEvents = [];

// ---------------- 输入 ----------------
const input = new Input(canvas);
const keys = { run: false, lookDX: 0, lookDY: 0 };
let pointerLocked = false;
const KEYS = {
  fwd: ['KeyW', 'ArrowUp'], back: ['KeyS', 'ArrowDown'], left: ['KeyA', 'ArrowLeft'], right: ['KeyD', 'ArrowRight'],
};
const anyHeld = (list) => list.some((k) => input.down(k));
function touchVector() {
  if (!input.touchMove) return { x: 0, y: 0 };
  return { x: input.touchMove.x, y: input.touchMove.y };
}
window.addEventListener('keydown', (e) => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.run = true;
  if (e.code === 'Escape') togglePause();
  if (phase !== 'playing' && phase !== 'tutorial') return;
  if (e.code === 'KeyE') act('grab');
  if (e.code === 'KeyR') act('light');
  if (e.code === 'KeyF') act('drop');
  if (e.code === 'KeyT') act('talk');
  if (e.code === 'KeyQ') ui.showScreen('shop');
  if (e.code === 'Space') { if (actors) actors.controller.jumpEdge = true; sim.jump(); }
});
window.addEventListener('keyup', (e) => {
  if (e.code === 'ShiftLeft' || e.code === 'ShiftRight') keys.run = false;
});
canvas.addEventListener('mousedown', () => {
  if (phase === 'playing' && !pointerLocked) { input.requestLock(); audio.unlock(); }
});
document.addEventListener('pointerlockchange', () => { pointerLocked = document.pointerLockElement === canvas; });
canvas.addEventListener('mousemove', (e) => {
  if (pointerLocked && orbit) { orbit.look(e.movementX || 0, e.movementY || 0); }
});
// 触屏（虚拟摇杆 + 视角拖拽 + 按钮）
function bindTouch() {
  const pad = document.getElementById('touch-pad');
  if (!pad) return;
  let id = null, cx = 0, cy = 0;
  const knob = pad.querySelector('i');
  const start = (e) => { const r = pad.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; const t0 = e.changedTouches[0]; id = t0.identifier; };
  const move = (e) => {
    if (id == null) return;
    for (const tc of e.changedTouches) {
      if (tc.identifier !== id) continue;
      const dx = Math.max(-60, Math.min(60, tc.clientX - cx)), dy = Math.max(-60, Math.min(60, tc.clientY - cy));
      input.touchMove.x = dx / 60; input.touchMove.y = dy / 60;
      if (knob) knob.style.transform = `translate(${dx}px,${dy}px)`;
    }
  };
  const end = () => { id = null; input.touchMove.x = 0; input.touchMove.y = 0; if (knob) knob.style.transform = ''; };
  pad.addEventListener('touchstart', start, { passive: true });
  pad.addEventListener('touchmove', move, { passive: true });
  pad.addEventListener('touchend', end);
  pad.addEventListener('touchcancel', end);
  const view = document.getElementById('canvas');
  let vid = null, vx = 0;
  view.addEventListener('touchstart', (e) => { const t0 = e.changedTouches[0]; if (t0.clientX > window.innerWidth * 0.45) { vid = t0.identifier; vx = t0.clientX; } }, { passive: true });
  view.addEventListener('touchmove', (e) => { for (const tc of e.changedTouches) if (tc.identifier === vid && orbit) { orbit.look((tc.clientX - vx) * 1.6, 0); vx = tc.clientX; } }, { passive: true });
  view.addEventListener('touchend', () => { vid = null; });
  const map = { 'tbtn-use': 'grab', 'tbtn-jump': 'jump', 'tbtn-run': 'run' };
  for (const [bid, kind] of Object.entries(map)) {
    const el = document.getElementById(bid);
    if (!el) continue;
    el.addEventListener('touchstart', (e) => { e.preventDefault(); onButton(kind); }, { passive: false });
  }
}
function onButton(kind) {
  if (kind === 'jump') { if (actors) actors.controller.jumpEdge = true; sim.jump(); }
  else if (kind === 'run') keys.run = !keys.run;
  else act('grab');
}

// ---------------- UI ----------------
const ui = createUI({
  t, lang: () => i18n.lang, isTouch: () => ('ontouchstart' in window) || navigator.maxTouchPoints > 0,
  getBest: () => save.get('best', 0), getUpgrades: () => save.get('upgrades', []),
  onStart: () => startRun(), onResume: () => setPaused(false), onRestart: () => startRun(),
  onNext: () => nextNight(), onAgain: () => startRun(1),
  onLang: (v) => { i18n.setLang(v); ui.fillLang(); ui.renderHelp(); sim.api.setLang(v); save.set('lang', v); },
  onSkipTutorial: () => finishTutorial(true),
  onTutorialDone: () => { finishTutorial(false); ui.toast('tut_done', 'good'); },
  onReplayTutorial: () => { if (phase === 'title' || phase === 'paused') { startRun(sim.state.night || 1); } startTutorial(); },
  onToggleMute: () => { audio.setMuted(!audio.muted()); return audio.muted(); },
  onChoice: (npcId, choice) => doTalk(npcId, { choice }),
  onSend: (text) => { const id = sim.snapshot().targets.nearNpc; if (id) doTalk(id, { text }); },
  onDialogClose: () => { ui.closeDialog(); setPhase('playing'); },
  afterHelp: () => (phase === 'title' ? 'title' : 'playing'),
  onBuy: (id) => buyUpgrade(id),
});

// ---------------- 流程 ----------------
function setPhase(p) {
  phase = p;
  // 引导是覆盖层，不是暂停：sim 必须仍在 'playing'，否则引导第一步「真的走一步」永远完不成
  const simPhase = p === 'dialog' ? 'dialog' : (p === 'playing' || p === 'tutorial') ? 'playing' : p === 'title' ? 'title' : p === 'nightEnd' ? 'nightEnd' : 'playing';
  sim.api.setPhase(simPhase);
  if (p === 'playing' || p === 'tutorial') ui.showScreen(p === 'tutorial' ? 'playing' : p === 'dialog' ? 'dialog' : 'playing');
}
function setPaused(v) {
  paused = v;
  ui.showScreen(v ? 'pause' : phase === 'title' ? 'title' : 'playing');
  if (!v) audio.resume();
}
function togglePause() {
  if (phase === 'playing' || phase === 'tutorial') { paused ? setPaused(false) : setPaused(true); }
  else if (paused) setPaused(false);
}

async function boot() {
  // 第一段：拿 Art Bible + 建舞台 + 亮标题屏（毫秒级）。玩家/门禁点 Start 不用等 3D 资产。
  try {
    bible = await (await fetch('config/art-bible.json')).json();
    stage = createStage({ canvas, clearColor: parseInt(bible.lighting.fogColor.slice(1), 16), fov: 58, near: 0.2, far: 620 });
    renderer = stage.renderer;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = (bible.lighting.exposure || 1.1) + 0.06;   // 二轮精修：整体提一点曝光，黄昏别糊成黑块
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    scene = stage.scene;
    camera = stage.camera;
    CONFIG.camera3d = camera;
    installObservability();
    syncDocumentLang();
    bindTouch();
    restoreProgress();
    ui.showScreen('title');
    phase = 'title';
    sim.api.setPhase('title');
    document.getElementById('loading').classList.add('hidden');
    Sdk.track('load', { night: 1 });
    bootReady = true;
    if (pendingStart != null) { const n = pendingStart; pendingStart = null; startRun(n); }
    else if (window.__pendingStart) { window.__pendingStart = false; startRun(1); }
  } catch (e) {
    console.error('boot stage failed', e);
    document.getElementById('loading').querySelector('span').textContent = '加载失败：' + e.message;
    return;
  }
  // 第二段：世界与角色（几十个 data-URI GLB，秒级）。装好前主循环只渲染空场景，判定不受影响。
  try {
    world = await createWorld(scene, bible, registry, (msg) => fallbackReports.push(msg), { renderer });
    actors = await createActors(scene, registry, (msg) => fallbackReports.push(msg));
    orbit = actors.orbit;
    orbit.yaw = -Math.PI / 2;   // 相机看向 +X（村内），W 就是往岛内走
    orbit.pitch = 0.3;
    actors.controller.groundAt = world.groundAt;
    actors.controller.colliders = world.colliders;
    world.setTime(phase === 'title' ? 0.06 : 0.18);
    if (phase === 'playing' || phase === 'tutorial') syncLamps();
    worldReady = true;
  } catch (e) {
    console.error('boot world failed', e);
    fallbackReports.push('world: ' + e.message);
  }
}
function restoreProgress() {
  sim.state.best = save.get('best', 0);
  for (const id of save.get('upgrades', [])) sim.api.buyUpgrade(id);
  if (!save.get('tutorialSeen', false)) return;
}
function startRun(night = 1) {
  if (!bootReady) { pendingStart = night; return; }   // 资产没加载完就点 Start：记下来，boot 完成后自动开
  audio.unlock();
  runId = 'r' + Date.now().toString(36);
  sim.state.totalScore = 0;
  sim.state.quests = { active: [], done: [] };
  sim.startNight(night, seedOfDay());
  if (world) syncLamps();
  if (orbit) { orbit.yaw = -Math.PI / 2; orbit.pitch = 0.3; orbit.target.set(sim.state.player.x, sim.state.player.y + 1, sim.state.player.z); }
  setPhase('playing');
  paused = false;
  ui.showScreen('playing');
  Sdk.track('start', { night, run: runId });
  if (!save.get('tutorialSeen', false)) startTutorial();
}
function nextNight() {
  const r = sim.nextNight();
  if (r.done) { startRun(1); return; }
  syncLamps();
  if (orbit) { orbit.yaw = -Math.PI / 2; orbit.pitch = 0.3; orbit.target.set(sim.state.player.x, sim.state.player.y + 1, sim.state.player.z); }
  setPhase('playing');
  ui.showScreen('playing');
  Sdk.track('start', { night: sim.state.night, run: runId });
}
function seedOfDay() {
  const d = new Date();
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate();
}
function startTutorial() {
  ui.tutorial.start();
  setPhase('tutorial');
}
function finishTutorial(skipped) {
  save.set('tutorialSeen', true);
  ui.tutorial.hide();   // 跳过/完成都必须真的把覆盖层收起来，否则门禁看到「跳过了还在」
  if (phase === 'tutorial') setPhase('playing');
  if (skipped) ui.toast('tut_done', '');
}

// ---------------- 动作 ----------------
function act(kind) {
  if (phase !== 'playing' && phase !== 'tutorial') return;
  const s = sim.snapshot();
  if (kind === 'grab') {
    const r = sim.grab();
    if (r.ok) { audio.event('pickup'); ui.toast('toast_oil', 'good'); }
    else if (r.why === 'full') ui.toast('prompt_grab_full', 'bad');
    else if (r.why === 'nothing') { /* 没东西可拿，不打扰 */ }
    return r;
  }
  if (kind === 'light') {
    const r = sim.light();
    if (r.ok) audio.event('charge');
    else if (r.why === 'need_big') ui.toast('prompt_light_big', 'bad');
    else if (r.why === 'no_oil') ui.toast('prompt_light_no_oil', 'bad');
    else if (r.why === 'too_windy') ui.toast('prompt_light_windy', 'bad');
    else if (r.why === 'no_lantern') ui.toast('prompt_grab', '');
    return r;
  }
  if (kind === 'drop') { const r = sim.drop(); if (r.ok) { audio.event('thud'); ui.toast('toast_dropped', 'bad'); } return r; }
  if (kind === 'talk') {
    const id = s.targets.nearNpc;
    if (!id) return { ok: false, why: 'nobody' };
    return doTalk(id, {});
  }
  return { ok: false, why: 'unknown' };
}
function doTalk(npcId, opts) {
  const res = sim.talk(npcId, opts);
  if (!res.ok) { if (res.why === 'too_far') ui.toast('prompt_talk', ''); return res; }
  const prof = NPC_PROFILES[npcId];
  setPhase('dialog');
  ui.dialog(prof, res.reply);
  audio.voice(npcId);
  audio.event('talk');
  if (res.reply.quest_id) ui.toast('toast_quest_offer', 'good');
  if (res.reply.downgraded) console.info('[npc]', npcId, res.reply.downgraded);
  return res;
}
function buyUpgrade(id) {
  const r = sim.api.buyUpgrade(id);
  if (r.ok) { save.set('upgrades', sim.state.upgradeIds); ui.toast('toast_upgrade', 'good'); audio.event('reward'); }
  return r;
}
function syncLamps() {
  for (const s of sim.state.lanterns) world.setLamp(s.id, s.lit, 1 + s.resonance * 0.2);
}

// ---------------- 事件 → 表现 ----------------
function handleEvents() {
  const evs = sim.drainEvents();
  lastFrameEvents = evs;
  for (const e of evs) {
    switch (e.type) {
      case 'lantern_lit':
        audio.event('success');
        ui.toast('toast_lit', 'good');
        if (e.resonance > 0) ui.toast('toast_lit_res', 'good');
        syncLamps();
        break;
      case 'lantern_out':
        audio.event('fail');
        ui.toast('toast_lost', 'bad');
        syncLamps();
        break;
      case 'lantern_lost':
        audio.event('break');
        ui.toast('toast_lost', 'bad');
        break;
      case 'oil_taken':
        ui.toast('toast_oil', 'good');
        break;
      case 'gust':
        audio.event('wind');
        if (sim.state.unlocked.warden_warning) ui.toast('toast_gust_warning', '');
        break;
      case 'fall':
        audio.event('thud');
        ui.toast('toast_fall', 'bad');
        syncLamps();
        break;
      case 'quest_done':
        audio.event('reward');
        ui.toast('toast_quest_done', 'good');
        if (e.reward && e.reward.unlock) ui.toast('up_' + e.reward.unlock, 'good');
        break;
      case 'reward':
        if (e.time) ui.toast('toast_reward_time', 'good');
        if (e.oil) ui.toast('toast_reward_oil', 'good');
        break;
      case 'ambient_waves': case 'ambient_wind': case 'ambient_gull':
      case 'ambient_wood': case 'ambient_horn':
        audio.event(e.type.replace('ambient_', 'amb_'));
        break;
      case 'night_win':
        audio.event('win');
        onRunEnd(true);
        break;
      case 'night_fail':
        audio.event('lose');
        onRunEnd(false);
        break;
      case 'game_win':
        onRunEnd(true, true);
        break;
      default:
        break;
    }
  }
}
function onRunEnd(win, done) {
  const s = sim.snapshot();
  if (s.totalScore > save.get('best', 0)) save.set('best', s.totalScore);
  save.set('upgrades', sim.state.upgradeIds);
  if (win) Sdk.track('win', { night: s.night, score: s.totalScore, run: runId });
  else Sdk.track('fail', { night: s.night, lit: s.lit, of: s.stations, run: runId });
  setPhase('nightEnd');
  ui.result(s);
  if (done) ui.showScreen('result');
}
async function maybeRevive() {
  if (!Sdk.canShowAd || !(await Sdk.canShowAd('revive'))) return false;
  const ok = await Sdk.showRewarded('revive');
  if (ok) { sim.api.addTime(20); ui.toast('toast_reward_time', 'good'); }
  return ok;
}

// ---------------- 主循环 ----------------
const loop = new FixedLoop(() => {
  if ((phase !== 'playing' && phase !== 'tutorial') || paused || !actors || !world) return;
  const P = CONFIG.player;
  const f = (anyHeld(KEYS.fwd) ? 1 : 0) - (anyHeld(KEYS.back) ? 1 : 0) - touchVector().y;
  const s = (anyHeld(KEYS.right) ? 1 : 0) - (anyHeld(KEYS.left) ? 1 : 0) + touchVector().x;
  const moving = Math.hypot(f, s) > 0.02;
  // 相机相对输入 → 世界分量（第三人称的标准做法；yaw 来自 OrbitChaseCamera）
  const yaw = orbit ? orbit.yaw : 0;
  const fwdX = -Math.sin(yaw), fwdZ = -Math.cos(yaw);
  const rgtX = -Math.cos(yaw), rgtZ = Math.sin(yaw);
  let wx = fwdX * f + rgtX * s;
  let wz = fwdZ * f + rgtZ * s;
  const wlen = Math.hypot(wx, wz);
  if (wlen > 1) { wx /= wlen; wz /= wlen; }
  const ctrl = actors.controller;
  ctrl.groundAt = world.groundAt;
  ctrl.colliders = world.colliders;
  const before = { x: ctrl.pos.x, z: ctrl.pos.z };
  const snapBefore = sim.snapshot();
  ctrl.carrying = snapBefore.weight > 0;
  ctrl.weightFactor = Math.min(1, snapBefore.weight / Math.max(1, snapBefore.capacity));
  const snapC = ctrl.update(STEP, { axisF: -wz, axisS: wx, jump: !!ctrl.jumpEdge, run: keys.run, move: { x: 0, y: 0 } });
  ctrl.jumpEdge = false;
  // 踩进海里 / 越界：摔回上一个点亮的灯位，掉一盏灯（有代价的失败）
  if (world.blockedAt(ctrl.pos.x, ctrl.pos.z)) {
    sim.fall();
    ctrl.pos.set(sim.state.player.x, world.groundAt(sim.state.player.x, sim.state.player.z), sim.state.player.z);
    ctrl.vel.set(0, 0, 0);
    syncLamps();
  } else {
    const dx = ctrl.pos.x - before.x, dz = ctrl.pos.z - before.z;
    if (Math.hypot(dx, dz) > 1e-4) {
      const okMove = sim.move(dx, dz, { inGust: true, braced: !moving });
      // sim 是判定权威：它拒绝（撞墙/滑倒/相位不对）就把控制器拽回去，杜绝「画面在动、判定没动」
      if (!okMove) { ctrl.pos.x = sim.state.player.x; ctrl.pos.z = sim.state.player.z; ctrl.vel.x = 0; ctrl.vel.z = 0; }
    }
  }
  sim.state.player.x = ctrl.pos.x;
  sim.state.player.z = ctrl.pos.z;
  sim.state.player.y = ctrl.pos.y;
  sim.state.player.speed = ctrl.speed;
  sim.state.player.grounded = ctrl.grounded;
  sim.state.player.facing = ctrl.facing;
  sim.state.player.path = ctrl.pos.x.toFixed(1) + ',' + ctrl.pos.z.toFixed(1);
  if (ctrl.landImpact && ctrl.landImpact > 0.4) { ctrl.landImpact = 0; audio.event('thud'); }
  sim.step(STEP, { moved: moving });
  // 昼夜随剩余时间推进
  const L = CONFIG.levels[sim.state.night - 1];
  const prog = 1 - Math.max(0, Math.min(1, sim.state.timeLeft / L.durationSec));
  world.setTime(0.18 + prog * 0.8);
  world.wind(sim.state.windDir, sim.state.gust);
  world.tick(sim.state.time);
  handleEvents();
  const after = sim.snapshot();
  actors.setCarried(after.carried, world);
  actors.update(STEP, after, { run: keys.run });
  ui.setHud(after);
  // 交互提示（常驻可见，不塞进菜单）
  const tg = after.targets;
  if (tg.nearStation) ui.setPrompt('light', 'R', after.oil > 0 ? t('prompt_light') : t('prompt_light_no_oil'));
  else if (tg.nearPickup) ui.setPrompt('grab', 'E', t('prompt_grab'));
  else if (tg.nearNpc) ui.setPrompt('talk', 'T', t('prompt_talk'));
  else ui.setPrompt(null);
  // 引导推进
  if (ui.tutorial.active) {
    ui.tutorial.render();
    if (ui.tutorial.check(after)) ui.tutorial.advance();
  }
}, (dt) => {
  if (!camera || !world) return;
  if (orbit && actors) orbit.update(dt, actors.controller.pos, {});
  if (phase === 'title' && orbit) {
    orbit.yaw += dt * 0.06;
    orbit.update(dt, new THREE.Vector3(-22, 2, -2), { zoom: 2.1 });
  }
  renderer.render(scene, camera);
});

// ---------------- 观察契约 ----------------
window.__ll = {
  get state() { return { phase: paused ? 'paused' : phase, simPhase: sim.state.phase, lang: i18n.lang, dir: i18n.dir, night: sim.state.night, score: sim.state.totalScore }; },
  lang: () => i18n.lang,
  setLang: (v) => ui.showScreen && i18n.setLang(v),
  get run() { return sim; },
  start: () => startRun(1),
  startNight: (n) => startRun(n),
  startAct: (n) => startRun((Number(n) || 0) + 1),
  pause: () => setPaused(true),
  resume: () => setPaused(false),
  restart: () => startRun(sim.state.night || 1),
  save: () => save,
  ui: () => ui,
  // 必须是「活」的对象：门禁会反复读 active/step，快照会让它永远看到 false
  tutorial: {
    get active() { return ui.tutorial.active; },
    get step() { return ui.tutorial.step; },
    get steps() { return ['move', 'grab', 'light', 'talk']; },
    get current() { return ['move', 'grab', 'light', 'talk'][Math.min(ui.tutorial.step, 3)]; },
    skip() { ui.tutorial.skip(); },
  },
  startTutorial: () => startTutorial(),
  skipTutorial: () => finishTutorial(true),
  getHud: () => sim.snapshot(),
  drainEvents: () => sim.drainEvents(),
  step: (dt = 1 / 60) => { sim.step(dt, {}); return sim.snapshot(); },
  debug: {
    layout: () => ({
      hud: rect('hud'), prompt: rect('prompt'), toast: rect('toast'),
      safeTop: 78, safeBottom: 96, canvas: rect('canvas'),
      buttons: ['btn-start', 'btn-resume', 'btn-next', 'btn-mute', 'btn-help'].map((id) => ({ id, r: rect(id) })).filter((b) => b.r),
    }),
    events: () => lastFrameEvents,
    fallbacks: () => fallbackReports,
    fps: () => (window.__game3d ? window.__game3d.stats().fps : 0),
  },
  demoWin: () => { const o = sim.api.demoWin(); if (world) syncLamps(); return o; },
  demoLose: () => { const o = sim.api.demoLose(); if (world) syncLamps(); return o; },
  grantOil: (n = 2) => { sim.state.oil += n; },
  revive: () => maybeRevive(),
};
function rect(id) {
  const el = document.getElementById(id);
  if (!el || el.classList.contains('hidden')) return null;
  const r = el.getBoundingClientRect();
  const b = document.getElementById('game-container').getBoundingClientRect();
  return { x: Math.round(r.left - b.left), y: Math.round(r.top - b.top), w: Math.round(r.width), h: Math.round(r.height) };
}

function installObservability() {
installBridge({
  renderer, scene, camera, sim, audio, registry, bible,
  phase: () => (paused ? 'paused' : phase),
  simState: () => Object.assign(sim.snapshot(), { camYaw: orbit ? orbit.yaw : 0 }, { anim: actors && actors.anims && actors.anims.player ? actors.anims.player.current : null, clips: actors && actors.reportedClips ? actors.reportedClips.player : [] }),
  errors: () => ({ boot: fallbackReports.slice(0, 8) }),
  orbit: { get yaw() { return orbit ? orbit.yaw : 0; }, get pitch() { return orbit ? orbit.pitch : 0; } },
  timeOfDay: () => +((sim.state.time / Math.max(1, CONFIG.levels[sim.state.night - 1].durationSec))).toFixed(2),
  zones: () => world && world.zones ? world.zones.update(actors ? actors.controller.pos : { x: 0, z: 0 }) : [],
  artBible: () => bible,
  layout: () => window.__ll.debug.layout(),
  meta: { slug: CONFIG.slug, version: CONFIG.version, game: 'lantern-isle-3d' },
  actions: {
    teleport: ({ x, z, to }) => {
      let tx = x, tz = z;
      if (to) {
        const st = CONFIG.stations.find((s) => s.id === to) || CONFIG.npcs[to] || (sim.state.pickups || []).find((p) => p.id === to);
        if (!st) return { ok: false, why: 'unknown_target' };
        tx = st.x; tz = st.z;
      }
      actors.controller.pos.set(tx, world.groundAt(tx, tz), tz);
      sim.state.player.x = tx; sim.state.player.z = tz;
      return { ok: true, x: tx, z: tz };
    },
    playAnim: ({ name, who = 'player' }) => {
      const anim = actors.anims[who];
      if (!anim) return { ok: false, why: 'unknown_actor' };
      const ok = anim.play(name, { force: true });
      actors.talking = name === 'talk';
      return { ok, current: anim.current, available: Object.keys(anim.actions) };
    },
    setTimeOfDay: ({ t }) => ({ ok: true, night: world.setTime(Number(t) || 0) }),
    setTransform: ({ name, pos, rotY, scale }) => {
      const obj = registry.get(name);
      if (!obj) return { ok: false, why: 'unknown_object', samples: [...registry.keys()].slice(0, 12) };
      if (pos) obj.position.set(pos[0], pos[1], pos[2]);
      if (rotY != null) obj.rotation.y = rotY;
      if (scale) obj.scale.setScalar(scale);
      return { ok: true, name, pos: obj.position.toArray().map((v) => +v.toFixed(2)) };
    },
    setMaterial: ({ name, color, emissive }) => {
      const obj = registry.get(name);
      if (!obj) return { ok: false, why: 'unknown_object' };
      let n = 0;
      obj.traverse((m) => { if (m.isMesh && m.material) { if (color) m.material.color.setHex(color); if (emissive) { m.material.emissive && m.material.emissive.setHex(emissive); } n++; } });
      return { ok: true, changed: n };
    },
    spawn: ({ model, x = 0, z = 0, name }) => {
      (async () => {
        try {
          const { MODELS } = await import('../lib/models/all.js');
          const { loadModel } = await import('./core/glb.js');
          if (!MODELS[model]) return;
          const o = await loadModel(MODELS[model], { targetLen: 1.2, forward: '+z', key: model });
          o.position.set(x, world.groundAt(x, z), z);
          scene.add(o);
          registry.register(name || `${model}_spawn`, o, ['spawn']);
        } catch (e) { console.warn('spawn failed', e.message); }
      })();
      return { ok: true, queued: true, model, x, z };
    },
    loadLevel: ({ night = 1 }) => { startRun(Number(night) || 1); return { ok: true, night: sim.state.night }; },
    grant: ({ oil, time, unlock }) => {
      if (oil) sim.state.oil += oil;
      if (time) sim.api.addTime(time);
      if (unlock) sim.api.buyUpgrade(unlock);
      return { ok: true, oil: sim.state.oil };
    },
    setShadows: ({ on }) => { renderer.shadowMap.enabled = !!on; scene.traverse((o) => { if (o.isMesh && o.material) o.material.needsUpdate = true; }); return { ok: true, on: renderer.shadowMap.enabled }; },
    light: () => act('light'),
    grab: () => act('grab'),
    talk: ({ npc, choice, text }) => doTalk(npc || sim.snapshot().targets.nearNpc, { choice, text }),
    listAssets: () => ({ ok: true, assets: Object.keys(NPC_PROFILES), lamps: sim.state.lanterns.length }),
  },
});


}
window.__THREE = THREE;   // 观察/排障用：probe 与诊断脚本可以直接量世界坐标
loop.start();
boot();
// 用 visibilitychange 而不是 blur：headless/自动化里 blur 会误触发暂停，导致「按了键但状态不动」
// headless/自动化里 document.hidden 常常是 true，会把主循环冻住（表现为「按键有反应但角色不动」）。
// 所以自动化会话（navigator.webdriver）不自动暂停；真人切后台仍然暂停。
document.addEventListener('visibilitychange', () => {
  if (navigator.webdriver) return;
  if (document.hidden && (phase === 'playing' || phase === 'tutorial')) setPaused(true);
});
window.addEventListener('beforeunload', () => Sdk.track('session_end', { total: sim.state.totalScore }));
