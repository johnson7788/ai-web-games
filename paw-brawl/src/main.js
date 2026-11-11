import * as THREE from 'three';
import { CONFIG, STEP } from '../config/game.config.js';
import { CHARACTERS, CHARACTER_MAP } from '../config/characters.js';
import { ARENAS, ARENA_MAP, CLOUD_RING } from '../config/arenas.js';
import { MODES, TEAM_COLORS, TEAM_NAMES } from '../config/modes.js';
import { setLang, t } from './core/i18n.js';
import { loadSave, writeSave, updateSettings, resetSave } from './core/save.js';
import { calculateCoins, calculateTeamCoins, canStart, CHARACTER_PRICES, unlockCharacter } from './core/economy.js';
import { shareResult } from './core/share.js';
import { createSim } from './game/sim.js';
import { createBrains } from './game/ai.js';
import { createMatch } from './game/match.js';
import { createInput } from './game/input.js';
import { autoFrame } from './game/camera.js';
import { createStage, buildEnvironment, disposeObject, resize, applyCamera, setQuality, applyQualityToObject } from './render/scene.js';
import { createAnimal } from './render/animal.js';
import { createFx } from './render/fx.js';
import { createItemRenderer } from './render/items.js';
import { createUI } from './ui/ui.js';
import { createAudio } from './audio.js';

const query = new URLSearchParams(location.search);
const showcase = query.get('showcase') === '1';
const poster = query.get('poster') === '1';
const debug = query.get('debug') === '1';
const difficulty = ['easy', 'normal', 'hard'].includes(query.get('ai')) ? query.get('ai') : 'normal';
setLang(query.get('lang') || CONFIG.lang);

const canvas = document.getElementById('game');
let save = loadSave();
const stage = createStage(canvas, save.settings.quality);
if (!stage) {
  canvas.hidden = true;
  document.querySelector('#webgl-fallback p').textContent = t('webgl');
  document.getElementById('webgl-fallback').hidden = false;
} else {
let selectedMode = MODES[query.get('mode')] ? query.get('mode') : 'ffa';
let selectedArena = poster ? CLOUD_RING : (ARENA_MAP[query.get('arena')] ?? CLOUD_RING);
let environment = buildEnvironment(stage.scene, selectedArena);
const fx = createFx(stage.scene);
const itemRenderer = createItemRenderer(stage.scene);
const input = createInput();
const audio = createAudio();
let selectedChar = CHARACTER_MAP[query.get('char')] ? query.get('char') : CHARACTER_MAP[save.lastChar] ? save.lastChar : 'shiba';
let sim;
let brains;
let match;
const actors = new Map();
const previous = new Map();
const projected = new THREE.Vector3();
const portraitQuery = matchMedia('(orientation: portrait) and (max-width: 900px)');
let portraitBlocked = portraitQuery.matches;
let mode = poster ? 'poster' : showcase ? 'showcase' : 'title';
let paused = false;
let helpOpen = false;
let helpOrigin = 'title';
let firstGameHints = false;
let firstKoHintSeen = false;
let firstKoHintT = 0;
let cameraView = null;
let shakeAmp = 0;
let fovKickT = 0;
let fovKickAmount = 0;
let cameraKickX = 0;
let cameraKickZ = 0;
const trailTimers = new Map();
let accumulator = 0;
let elapsed = 0;
let hitstopT = 0;
let koSlowT = 0;
let koFocusT = 0;
let koFocusId = null;
let lastKoFocus = null;
let playerDeathT = -1;
let deathOverlay = false;
let deathOverlayFade = false;
let deathKiller = '';
let hudT = 0;
let last = performance.now();
let presentationRoot = null;
let presentationActors = [];
let matchSettled = false;
let resultStandings = null;
let resultReward = null;
let previewFade = null;
const frameSamples = [];
let rafId = 0;
let pageHidden = document.hidden;
let posterConfettiT = 0;

const playerRing = new THREE.Mesh(
  new THREE.TorusGeometry(CONFIG.fx.playerRingRadius, 0.025, 8, 48),
  new THREE.MeshBasicMaterial({ color: '#FF7A59', transparent: true, opacity: 0.65, depthWrite: false, toneMapped: false }),
);
playerRing.rotation.x = Math.PI / 2;
playerRing.visible = false;
playerRing.renderOrder = 3;
stage.scene.add(playerRing);

const ui = createUI({
  input,
  initialMuted: audio.muted,
  onPlay: () => showMode(),
  onModeBack: () => returnTitle(),
  onModeSelect: (id) => selectMode(id),
  onModeNext: () => showSelect(),
  onSettings: () => showSettings(),
  onSettingsBack: () => returnTitle(),
  onSelectBack: () => showMode(),
  onSelect: (id) => selectCharacter(id),
  onStart: () => startGame(),
  onResume: () => { paused = false; audio.setPaused(portraitBlocked); ui.setPaused(false); },
  onPause: () => togglePause(),
  onHelp: () => toggleHelp(),
  onRestart: () => startGame(),
  onPauseHome: () => returnTitle(),
  onNext: () => match.skip(),
  onPlayAgain: () => { cycleArena(); startGame(); },
  onChangePaw: () => showSelect(),
  onChangeMode: () => showMode(),
  onHome: () => returnTitle(),
  onShare: () => shareMatch(),
  onMute: () => audio.toggleMute(),
  onSettingSfx: () => { audio.setSfx(!loadSave().settings.sfx); save = loadSave(); ui.updateSettings(save); },
  onSettingMusic: () => { audio.setMusic(!loadSave().settings.music); save = loadSave(); ui.updateSettings(save); },
  onQuality: (quality) => { save = updateSettings({ quality }); setQuality(stage, quality); fx.setQuality(stage.quality); ui.updateSettings(save); },
  onReset: () => resetProgress(),
});

function clearDeathSequence() {
  playerDeathT = -1;
  deathOverlay = false;
  deathOverlayFade = false;
  ui.hidePlayerDeath();
}

function clearPresentation() {
  for (const entry of presentationActors) {
    entry.actor.group.parent?.remove(entry.actor.group);
    entry.actor.dispose();
  }
  if (presentationRoot) {
    stage.scene.remove(presentationRoot);
    disposeObject(presentationRoot);
  }
  presentationRoot = null;
  presentationActors = [];
}

function setArena(arena) {
  selectedArena = arena;
  environment.dispose();
  environment = buildEnvironment(stage.scene, arena);
  document.body.dataset.arena = arena.id;
}

function cycleArena() {
  setArena(ARENAS[(ARENAS.indexOf(selectedArena) + 1) % ARENAS.length]);
}

function createRoster(charId, newMatch = true) {
  itemRenderer.clear();
  for (const actor of actors.values()) {
    stage.scene.remove(actor.group);
    actor.dispose();
  }
  actors.clear();
  previous.clear();
  fx.clearShadows();
  fx.clearEffects();
  trailTimers.clear();
  const teams = MODES[selectedMode].teams;
  sim = createSim({ arena: selectedArena, characters: CHARACTERS, playerCharId: charId, bots: 7, seed: 14, eliminateOnFall: true, teams, playerKnockScale: difficulty === 'normal' ? 0.65 : difficulty === 'easy' ? 0.5 : 1 });
  brains = createBrains({ fighters: sim.fighters, characters: CHARACTERS, arena: selectedArena, seed: 14, difficulty });
  if (newMatch) match = createMatch({ sim, brains, onResetRound: resetRound });
  for (const fighter of sim.fighters) {
    const character = CHARACTER_MAP[fighter.charId];
    const actor = createAnimal(character, showcase ? 1 : CONFIG.animation.gameplayScale, teams === 2 ? TEAM_COLORS[fighter.team] : null);
    actor.group.position.set(fighter.pos.x, fighter.pos.y, fighter.pos.z);
    stage.scene.add(actor.group);
    actors.set(fighter.id, actor);
    fx.addShadow(fighter.id);
    previous.set(fighter.id, { pos: { ...fighter.pos }, facing: fighter.facing });
  }
  applyQualityToObject(stage.scene, stage.quality);
  ui.createMarkers(sim.fighters);
}

function resetRound() {
  clearDeathSequence();
  koFocusT = 0;
  koFocusId = null;
  cycleArena();
  createRoster(selectedChar, false);
  environment.setArenaBounds({ radius: selectedArena.radius, width: selectedArena.width, depth: selectedArena.depth });
  resetPrevious();
  return { sim, brains };
}

function resetPrevious() {
  for (const fighter of sim.fighters) previous.set(fighter.id, { pos: { ...fighter.pos }, facing: fighter.facing });
}

function buildSelectPreview() {
  clearPresentation();
  for (const actor of actors.values()) actor.group.visible = false;
  playerRing.visible = false;
  presentationRoot = new THREE.Group();
  presentationRoot.position.y = 1.4;
  const character = CHARACTER_MAP[selectedChar];
  const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.35, 1.5, 0.18, 40), new THREE.MeshToonMaterial({ color: '#FFE9C7' }));
  platform.position.y = 0.09;
  platform.receiveShadow = true;
  presentationRoot.add(platform);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.37, 0.045, 8, 48), new THREE.MeshBasicMaterial({ color: character.colors.fur, toneMapped: false }));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 0.185;
  presentationRoot.add(ring);
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.72, 40), new THREE.MeshBasicMaterial({ color: '#2B2440', transparent: true, opacity: 0.16, depthWrite: false, toneMapped: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.scale.set(1.15, 0.68, 1);
  shadow.position.y = 0.19;
  presentationRoot.add(shadow);
  const actor = createAnimal(character, 1.75);
  actor.group.position.y = 0.18;
  presentationRoot.add(actor.group);
  presentationActors.push({ actor, fighter: sim.fighters.find((fighter) => fighter.charId === selectedChar) ?? sim.fighters[0] });
  stage.scene.add(presentationRoot);
  applyQualityToObject(presentationRoot, stage.quality);
  previewFade?.cancel();
  previewFade = canvas.animate([{ opacity: 0.45 }, { opacity: 1 }], { duration: 120, easing: 'ease-out' });
}

function showMode() {
  if (showcase) return;
  clearPresentation();
  for (const actor of actors.values()) actor.group.visible = true;
  mode = 'mode';
  paused = false;
  accumulator = 0;
  cameraView = null;
  ui.showMode(selectedMode, save);
}

function selectMode(id) {
  if (!MODES[id]) return;
  selectedMode = id;
  createRoster(selectedChar);
  ui.showMode(selectedMode, save);
}

function showSelect() {
  if (showcase) return;
  mode = 'select';
  paused = false;
  accumulator = 0;
  cameraView = null;
  environment.setArenaBounds({ radius: selectedArena.radius, width: selectedArena.width, depth: selectedArena.depth });
  itemRenderer.clear();
  buildSelectPreview();
  ui.showSelect(save, selectedChar, MODES[selectedMode], selectedArena);
}

function selectCharacter(id) {
  if (!CHARACTER_MAP[id]) return;
  selectedChar = id;
  const unlocked = canStart(save, id);
  if (!unlocked) {
    const price = CHARACTER_PRICES[id];
    if (save.coins >= price && window.confirm(t('select.unlockConfirm', { name: CHARACTER_MAP[id].name[document.documentElement.lang.startsWith('zh') ? 'zh' : 'en'], price }))) {
      save = writeSave({ ...unlockCharacter(save, id), lastChar: id });
    } else if (save.coins < price) {
      ui.showToast(t('select.insufficient', { price: price - save.coins }));
    }
  }
  buildSelectPreview();
  ui.renderSelect(save, selectedChar);
}

function hasSeenTutorial() {
  try { return Boolean(localStorage.getItem('pawbrawl_tutorial_v1')); } catch { return false; }
}

function openHelp(origin) {
  if (helpOpen) return;
  helpOpen = true;
  helpOrigin = origin;
  input.clear();
  audio.setPaused(true, true);
  ui.showHelp();
}

function closeHelp() {
  if (!helpOpen) return;
  const origin = helpOrigin;
  helpOpen = false;
  ui.hideHelp();
  audio.setPaused(paused || portraitBlocked);
  if (origin === 'first') {
    try { localStorage.setItem('pawbrawl_tutorial_v1', '1'); } catch {}
    handleEvents(match.drainEvents());
  }
}

function toggleHelp() {
  if (helpOpen) {
    closeHelp();
    return;
  }
  if (mode === 'playing') openHelp(paused ? 'pause' : 'game');
  else if (mode === 'title') openHelp('title');
}

function startGame() {
  if (showcase || !canStart(save, selectedChar)) return;
  helpOpen = false;
  audio.unlock();
  audio.setPaused(false);
  clearPresentation();
  firstGameHints = save.matches === 0 && !firstKoHintSeen;
  firstKoHintT = 0;
  save = writeSave({ lastChar: selectedChar });
  createRoster(selectedChar);
  mode = 'playing';
  paused = false;
  accumulator = 0;
  hitstopT = 0;
  fovKickT = 0;
  fovKickAmount = 0;
  cameraKickX = 0;
  cameraKickZ = 0;
  koSlowT = 0;
  koFocusT = 0;
  koFocusId = null;
  clearDeathSequence();
  cameraView = null;
  matchSettled = false;
  resultStandings = null;
  resultReward = null;
  environment.setArenaBounds({ radius: selectedArena.radius, width: selectedArena.width, depth: selectedArena.depth });
  ui.showGameplay(MODES[selectedMode]);
  ui.updateHUD(sim, match);
  if (!hasSeenTutorial()) openHelp('first');
  else handleEvents(match.drainEvents());
}

function returnTitle() {
  if (showcase) return;
  helpOpen = false;
  clearDeathSequence();
  audio.setPaused(false);
  clearPresentation();
  createRoster(selectedChar);
  mode = 'title';
  paused = false;
  accumulator = 0;
  cameraView = null;
  environment.setArenaBounds({ radius: selectedArena.radius, width: selectedArena.width, depth: selectedArena.depth });
  ui.showTitle();
}

function showSettings() {
  if (showcase) return;
  mode = 'settings';
  paused = false;
  input.clear();
  ui.showSettings(save);
}

function resetProgress() {
  if (!window.confirm(t('settings.confirmReset'))) return;
  save = resetSave();
  selectedChar = 'shiba';
  audio.setSfx(save.settings.sfx);
  audio.setMusic(save.settings.music);
  setQuality(stage, save.settings.quality);
  fx.setQuality(stage.quality);
  ui.showSettings(save);
}

function buildPodium(standings) {
  clearPresentation();
  for (const actor of actors.values()) actor.group.visible = false;
  playerRing.visible = false;
  presentationRoot = new THREE.Group();
  presentationRoot.position.x = -1.2;
  const layout = [
    { score: standings[1], x: -2.35, height: 0.75, color: '#D7E6FF' },
    { score: standings[0], x: 0, height: 1.15, color: '#FFD166' },
    { score: standings[2], x: 2.35, height: 0.5, color: '#F2B8D0' },
  ];
  for (const entry of layout) {
    const fighter = sim.fighterMap.get(entry.score.id);
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 1.05, entry.height, 32), new THREE.MeshToonMaterial({ color: entry.color }));
    platform.position.set(entry.x, entry.height / 2, 0);
    platform.receiveShadow = true;
    presentationRoot.add(platform);
    const actor = createAnimal(CHARACTER_MAP[fighter.charId], 1.35, sim.teams === 2 ? TEAM_COLORS[fighter.team] : null);
    actor.group.position.set(entry.x, entry.height, 0);
    presentationRoot.add(actor.group);
    presentationActors.push({ actor, fighter });
  }
  stage.scene.add(presentationRoot);
  applyQualityToObject(presentationRoot, stage.quality);
  fx.spawnConfetti(-1.2, 5, 0);
}

function settleMatch(standings) {
  if (matchSettled) return;
  matchSettled = true;
  const playerIndex = standings.findIndex((score) => score.id === 'f0');
  const player = standings[playerIndex];
  const rank = playerIndex + 1;
  const teamMode = sim.teams === 2;
  const won = teamMode ? match.winningTeam === sim.fighters[0].team : rank === 1;
  const reward = teamMode ? calculateTeamCoins({ won, kos: player.kos }) : calculateCoins({ rank, kos: player.kos, wins: save.wins });
  save = writeSave({
    coins: save.coins + reward.total,
    wins: save.wins + Number(won),
    matches: save.matches + 1,
    kos: save.kos + player.kos,
    bestRank: save.bestRank === 0 ? rank : Math.min(save.bestRank, rank),
    lastChar: selectedChar,
  });
  resultStandings = standings;
  resultReward = reward;
  mode = 'results';
  itemRenderer.clear();
  buildPodium(standings);
  if (teamMode) ui.showTeamResults(standings, sim, reward, save, match.winningTeam, match.teamScores);
  else ui.showResults(standings, sim, reward, save);
  audio.play('cheer');
}

async function shareMatch() {
  if (!resultStandings) return;
  const player = resultStandings.find((score) => score.id === 'f0');
  const rank = resultStandings.findIndex((score) => score.id === 'f0') + 1;
  try {
    const result = await shareResult({
      rank,
      coins: resultReward.total,
      kos: player.kos,
      character: CHARACTER_MAP[sim.fighterMap.get(resultStandings[0].id).charId],
      mode: selectedMode,
      modeName: MODES[selectedMode].name[document.documentElement.lang.startsWith('zh') ? 'zh' : 'en'],
    });
    if (result.ok) ui.showToast(t('results.shared'));
  } catch {
    ui.showToast(t('results.shareFailed'));
  }
}

function togglePause() {
  if (mode !== 'playing' || helpOpen || portraitBlocked || match.phase === 'matchEnd') return;
  paused = !paused;
  input.clear();
  audio.setPaused(paused || portraitBlocked);
  ui.setPaused(paused);
}

function syncPortraitBlock() {
  portraitBlocked = portraitQuery.matches;
  input.clear();
  document.body.classList.toggle('portrait-blocked', portraitBlocked);
  audio.setPaused(paused || helpOpen || portraitBlocked, helpOpen);
}

const controlledKeys = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ShiftRight', 'KeyJ', 'KeyK']);
window.addEventListener('keydown', (event) => {
  if (controlledKeys.has(event.code)) event.preventDefault();
  if (helpOpen) {
    if (!event.repeat && event.code === 'Escape') {
      event.preventDefault();
      closeHelp();
    }
    return;
  }
  if (!event.repeat && event.key === '?') {
    event.preventDefault();
    toggleHelp();
    return;
  }
  if (!event.repeat && (event.code === 'Escape' || event.code === 'KeyP')) {
    event.preventDefault();
    togglePause();
    return;
  }
  input.setKey(event.code, true);
});
window.addEventListener('keyup', (event) => input.setKey(event.code, false));
window.addEventListener('blur', () => {
  input.clear();
  if (mode === 'playing' && !paused && !helpOpen && !portraitBlocked) togglePause();
});
canvas.addEventListener('pointerdown', (event) => {
  if (mode !== 'playing' || paused || helpOpen || portraitBlocked || event.pointerType !== 'mouse') return;
  if (event.button === 0) input.setAction('punch');
  if (event.button === 2) input.setAction('grab');
});
window.addEventListener('pointerup', (event) => {
  if (event.pointerType !== 'mouse') return;
  if (event.button === 0) input.setAction('punch', false);
  if (event.button === 2) input.setAction('grab', false);
});
window.addEventListener('resize', () => resize(stage));
document.addEventListener('visibilitychange', () => {
  pageHidden = document.hidden;
  input.clear();
  audio.setBackground(pageHidden);
  if (pageHidden) cancelAnimationFrame(rafId);
  else {
    last = performance.now();
    rafId = requestAnimationFrame(frame);
  }
});
portraitQuery.addEventListener('change', syncPortraitBlock);
syncPortraitBlock();
setQuality(stage, save.settings.quality);
fx.setQuality(stage.quality);
resize(stage);

function savePrevious() {
  for (const fighter of sim.fighters) previous.set(fighter.id, { pos: { ...fighter.pos }, facing: fighter.facing });
}

function rumble(duration, strongMagnitude) {
  for (const gamepad of navigator.getGamepads?.() ?? []) {
    const effect = gamepad?.vibrationActuator?.playEffect?.('dual-rumble', {
      duration, strongMagnitude, weakMagnitude: strongMagnitude * 0.6, startDelay: 0,
    });
    effect?.catch?.(() => {});
  }
}

function handleEvents(events) {
  for (const event of events) {
    if (event.type === 'roundStart') {
      clearDeathSequence();
      koFocusT = 0;
      koFocusId = null;
      ui.beginRound();
      ui.announce(t('round', { round: event.round }), 550);
    } else if (event.type === 'countdown') {
      ui.announce(event.value === 'GO' ? t('go') : String(event.value), 560);
      audio.play('countdown', event.value);
    } else if (event.type === 'attack') {
      audio.play(event.sfx || 'whoosh');
    } else if (event.type === 'hit') {
      fx.spawnHit(event.x, event.y, event.z, event.heavy, { x: event.dx, z: event.dz });
      audio.play(event.heavy ? 'hitHeavy' : 'hitLight');
      shakeAmp = Math.max(shakeAmp, event.heavy ? 0.42 : 0.20);
      hitstopT = Math.max(hitstopT, event.hitstop);
      fovKickT = 0.10;
      fovKickAmount = event.heavy ? 1.5 : 0.7;
      const kick = event.heavy ? 0.32 : 0.18;
      cameraKickX += (event.dx ?? 0) * kick;
      cameraKickZ += (event.dz ?? 0) * kick;
      if (event.attacker === 'f0' || event.target === 'f0') rumble(event.heavy ? 120 : 60, event.heavy ? 0.7 : 0.4);
    } else if (event.type === 'land') {
      fx.spawnDust(event.x, event.y, event.z);
      audio.play('land');
      if (event.id === 'f0') shakeAmp = Math.max(shakeAmp, CONFIG.camera.landingShake);
    } else if (event.type === 'slam') {
      fx.spawnSlam(event.x, event.z, event.range);
      shakeAmp = Math.max(shakeAmp, 0.42);
    } else if (event.type === 'jump' || event.type === 'dizzy' || event.type === 'grab' || event.type === 'throw') {
      audio.play(event.type);
    } else if (event.type === 'itemPickup') {
      audio.play('pickup');
    } else if (event.type === 'itemUse') {
      audio.play(event.itemType === 'star' ? 'star' : event.itemType === 'bomb' ? 'bomb' : 'pickup');
    } else if (event.type === 'explosion') {
      fx.spawnSlam(event.x, event.z, 3);
      fx.spawnHit(event.x, 0.8, event.z, true);
      audio.play('explosion');
      shakeAmp = Math.max(shakeAmp, 0.55);
    } else if (event.type === 'ko') {
      const playerKO = event.victim === sim.fighters[0].id;
      if (firstGameHints && match.round === 1 && !firstKoHintSeen) {
        firstKoHintSeen = true;
        firstKoHintT = 4;
      }
      fx.spawnKO(event.x, event.y, event.z);
      audio.play('ko');
      ui.addKillFeed(event, sim);
      hitstopT = Math.max(hitstopT, 0.14);
      if (playerKO) {
        const killer = event.killer ? sim.fighterMap.get(event.killer) : null;
        deathKiller = killer ? CHARACTER_NAME(killer) : t('death.unknown');
        playerDeathT = 0;
        deathOverlay = false;
        deathOverlayFade = false;
        koSlowT = 0.45;
        koFocusT = 1.1;
        koFocusId = event.victim;
        lastKoFocus = event.victim;
        shakeAmp = Math.max(shakeAmp, 0.7);
        rumble(120, 0.7);
      } else {
        ui.announce(t('ko'));
        koSlowT = 0.08;
        koFocusT = 0;
        koFocusId = null;
        lastKoFocus = null;
        shakeAmp = Math.max(shakeAmp, 0.2);
      }
    } else if (event.type === 'finalTwo') {
      ui.announce(t('finalTwo'), 1300);
    } else if (event.type === 'roundEnd') {
      koSlowT = 0;
      koFocusT = 0;
      koFocusId = null;
      clearDeathSequence();
      const winner = sim.fighterMap.get(event.winner);
      const winnerName = event.teamWinner !== undefined ? TEAM_NAMES[event.teamWinner][document.documentElement.lang.startsWith('zh') ? 'zh' : 'en'] : winner ? CHARACTER_NAME(winner) : event.winner;
      ui.announce(t('wins', { name: winnerName }), 1300);
      ui.showRoundEnd(event, sim);
      audio.play('cheer');
    } else if (event.type === 'matchEnd') {
      settleMatch(event.standings);
    }
  }
  hudT = 0;
}

function CHARACTER_NAME(fighter) {
  return CHARACTER_MAP[fighter.charId].name[document.documentElement.lang.startsWith('zh') ? 'zh' : 'en'];
}

function updateMarkers(fighter, position) {
  const actor = actors.get(fighter.id);
  projected.set(position.x, position.y + actor.labelY + 0.12, position.z).project(stage.camera);
  const player = sim.fighters[0];
  const onScreen = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
  let detailed = fighter.isPlayer;
  let markerVisible = fighter.isPlayer;
  if (sim.teams === 2) {
    detailed = fighter.team === player.team;
    markerVisible = true;
  } else if (!fighter.isPlayer) {
    const nearest = sim.fighters
      .filter((other) => !other.isPlayer && !other.eliminated && other.state !== 'falling')
      .map((other) => ({ id: other.id, distance: Math.hypot(other.pos.x - player.pos.x, other.pos.z - player.pos.z) }))
      .filter((entry) => entry.distance <= 6)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 2);
    detailed = nearest.some((entry) => entry.id === fighter.id);
    markerVisible = detailed;
  }
  const visible = mode === 'playing' && !paused && !helpOpen && !portraitBlocked && !fighter.eliminated && fighter.state !== 'falling' && onScreen && markerVisible;
  ui.updateMarker(fighter.id, {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    visible,
    detailed,
  });
}

function updateShowcaseLabel(fighter, position) {
  const below = position.z > 0;
  projected.set(position.x, position.y + (below ? -0.22 : 2.05), position.z).project(stage.camera);
  ui.updateShowcaseLabel(fighter.id, {
    x: (projected.x * 0.5 + 0.5) * window.innerWidth,
    y: (-projected.y * 0.5 + 0.5) * window.innerHeight,
    visible: projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.05 && Math.abs(projected.y) < 1.05,
    below,
  });
}

const wrapAngle = (angle) => Math.atan2(Math.sin(angle), Math.cos(angle));

function updateHints(dt) {
  firstKoHintT = Math.max(0, firstKoHintT - dt);
  let message = '';
  if (firstGameHints && match.round === 1 && match.phase === 'fight') {
    if (firstKoHintSeen && firstKoHintT > 0) message = t('hint.ko');
    else if (!firstKoHintSeen && sim.time <= 6) message = t('hint.grab');
  }
  ui.setGameHint(message);
}

function updateGame(dt) {
  if (mode === 'playing' && !paused && !helpOpen && !portraitBlocked) {
    if (playerDeathT >= 0) {
      playerDeathT += dt;
      if (playerDeathT >= 0.55 && !deathOverlay) {
        deathOverlay = true;
        ui.showPlayerDeath(deathKiller);
      }
      if (playerDeathT >= 1.6 && !deathOverlayFade) {
        deathOverlayFade = true;
        ui.fadePlayerDeath();
      }
      if (playerDeathT >= 1.95) clearDeathSequence();
    }
    koSlowT = Math.max(0, koSlowT - dt);
    koFocusT = Math.max(0, koFocusT - dt);
    if (hitstopT > 0) hitstopT = Math.max(0, hitstopT - dt);
    else {
      const scale = koSlowT > 0 && match.phase === 'fight' ? 0.25 : 1;
      accumulator += dt * scale;
    }
    let steps = 0;
    while (accumulator >= STEP && steps < CONFIG.maxStepsPerFrame) {
      savePrevious();
      const gamepads = navigator.getGamepads?.() ?? [];
      const intent = input.poll({ azimuth: cameraView?.azimuth ?? CONFIG.camera.azimuthBase, gamepads });
      match.step(STEP, intent);
      handleEvents(match.drainEvents());
      accumulator -= STEP;
      steps += 1;
      if (hitstopT > 0) {
        accumulator = 0;
        break;
      }
      if (mode !== 'playing') break;
    }
    if (steps === CONFIG.maxStepsPerFrame) accumulator = 0;
  } else if (mode === 'title' && !helpOpen && !portraitBlocked) {
    accumulator += dt;
    let steps = 0;
    while (accumulator >= STEP && steps < CONFIG.maxStepsPerFrame) {
      savePrevious();
      sim.step(STEP, new Map());
      accumulator -= STEP;
      steps += 1;
    }
  }

  if (mode === 'results') {
    fx.update(dt);
    return;
  }

  if (mode === 'title' || mode === 'mode' || mode === 'settings') {
    const phase = elapsed % CONFIG.camera.titleCycleDuration / CONFIG.camera.titleCycleDuration;
    const push = 0.5 - Math.cos(phase * Math.PI * 2) * 0.5;
    cameraView = {
      target: { x: 0, y: CONFIG.camera.followTargetHeight, z: 0 },
      distance: CONFIG.camera.titleFarDistance + (CONFIG.camera.titleNearDistance - CONFIG.camera.titleFarDistance) * push,
      azimuth: CONFIG.camera.azimuthBase + Math.sin(elapsed * CONFIG.camera.azimuthSpeed) * CONFIG.camera.azimuthSwing,
      elevation: CONFIG.camera.followElevation,
    };
  } else if (mode === 'playing') {
    let focus = null;
    let distanceScale = sim.alive.length === 2 ? 0.85 : 1;
    let azimuthOffset = 0;
    if (koFocusT > 0 && koFocusId) {
      focus = sim.fighterMap.get(koFocusId);
      distanceScale = 0.85;
    }
    if (match.phase === 'roundEnd' || match.phase === 'matchEnd') {
      const winnerId = match.roundResults.at(-1)?.winner;
      focus = winnerId ? sim.fighterMap.get(winnerId) : focus;
      distanceScale = 0.9;
      azimuthOffset = Math.min(1, match.phaseT / CONFIG.match.roundEndTime) * 20 * Math.PI / 180;
    }
    cameraView = autoFrame({
      fighters: sim.fighters,
      arena: selectedArena,
      time: sim.time,
      aspect: stage.camera.aspect,
      view: cameraView ? { ...cameraView, dt } : null,
      focus,
      distanceScale,
      azimuthOffset,
    });
  }
  environment.setArenaBounds(mode === 'playing'
    ? { radius: sim.arenaRadius, width: sim.arenaWidth, depth: sim.arenaDepth }
    : { radius: selectedArena.radius, width: selectedArena.width, depth: selectedArena.depth });
  shakeAmp *= Math.exp(-CONFIG.camera.shakeDecay * dt);
  cameraKickX *= Math.exp(-25 * dt);
  cameraKickZ *= Math.exp(-25 * dt);
  if (cameraView) applyCamera(stage, {
    ...cameraView,
    target: { x: cameraView.target.x + cameraKickX, y: cameraView.target.y, z: cameraView.target.z + cameraKickZ },
    shake: save.settings.shake ? shakeAmp : 0,
    time: elapsed,
  });
  const alpha = paused || helpOpen || portraitBlocked ? 1 : accumulator / STEP;
  const animationDt = hitstopT > 0 ? 0 : dt * (match.phase === 'roundEnd' && match.phaseT < 1.4 ? CONFIG.match.slowMotionScale : 1);

  for (const fighter of sim.fighters) {
    const before = previous.get(fighter.id);
    const position = {
      x: before.pos.x + (fighter.pos.x - before.pos.x) * alpha,
      y: before.pos.y + (fighter.pos.y - before.pos.y) * alpha,
      z: before.pos.z + (fighter.pos.z - before.pos.z) * alpha,
    };
    const facing = before.facing + wrapAngle(fighter.facing - before.facing) * alpha;
    const actor = actors.get(fighter.id);
    actor.group.position.set(position.x, position.y, position.z);
    const speed = Math.hypot(fighter.vel.x, fighter.vel.z);
    let trailT = (trailTimers.get(fighter.id) ?? 0) - dt;
    if (mode === 'playing' && fighter.tumbleT > 0 && speed > 6 && trailT <= 0) {
      fx.spawnGhost(position, actor.character, CONFIG.animation.gameplayScale, facing);
      trailT = stage.quality === 'low' ? 0.10 : 0.05;
    } else if (fighter.tumbleT <= 0 || speed <= 6) trailT = 0;
    trailTimers.set(fighter.id, trailT);
    const anim = match.phase === 'intro' ? { ...fighter.anim, breathe: elapsed + Number(fighter.id.slice(1)) } : fighter.anim;
    actor.update(animationDt, { ...fighter, pos: position, facing, anim });
    const overArena = sim.distanceToEdge(position) > 0 && position.y >= 0 && !fighter.eliminated && fighter.state !== 'falling';
    fx.updateShadow(fighter.id, position.x, position.y, position.z, overArena);
    updateMarkers(fighter, position);
    if (fighter.isPlayer) {
      const pulse = Math.sin(elapsed * Math.PI * 2 / CONFIG.fx.playerRingPeriod);
      playerRing.visible = mode === 'playing' && !fighter.eliminated && fighter.state !== 'falling';
      playerRing.position.set(position.x, position.y + 0.035, position.z);
      playerRing.scale.setScalar(1 + pulse * 0.1);
      playerRing.material.opacity = 0.55 + pulse * 0.2;
    }
  }
  if (mode === 'playing') itemRenderer.sync(sim, actors, dt, elapsed);
  hudT -= dt;
  if (mode === 'playing' && hudT <= 0) {
    ui.updateHUD(sim, match);
    hudT = 0.1;
  }
  updateHints(dt);
  fx.update(dt);
}

function updatePresentation(dt) {
  if (mode === 'select') {
    applyCamera(stage, { target: { x: -5.5, y: 1.6, z: 0 }, distance: 14.5, azimuth: 0.25, elevation: 20 * Math.PI / 180, time: elapsed });
  } else {
    applyCamera(stage, { target: { x: -1.2, y: 1.25, z: 0 }, distance: 9.2, azimuth: 0.18, elevation: 19 * Math.PI / 180, time: elapsed });
  }
  for (let i = 0; i < presentationActors.length; i++) {
    const { actor, fighter } = presentationActors[i];
    const facing = mode === 'select' ? elapsed * 0.35 : Math.sin(elapsed * 0.8 + i) * 0.18;
    actor.update(dt, {
      ...fighter,
      eliminated: false,
      state: 'idle',
      onGround: true,
      facing,
      landT: 0,
      dizzyT: 0,
      staggerT: 0,
      tumbleT: 0,
      attack: null,
      heldItem: null,
      starT: 0,
      anim: { ...fighter.anim, walk: 0, walkPhase: 0, breathe: elapsed + i, blink: mode === 'select' && (elapsed + i * 0.7) % 3.4 < 0.12 ? 1 : 0, lean: 0, charge: 0 },
    });
  }
  fx.update(dt);
}

function setupPoster() {
  clearPresentation();
  for (const actor of actors.values()) actor.group.visible = false;
  playerRing.visible = false;
  itemRenderer.clear();
  presentationRoot = new THREE.Group();
  const layout = [
    { id: 'panda', x: -2.35, height: 0.55, color: '#D7E6FF' },
    { id: 'shiba', x: 0, height: 1.05, color: '#FFD166' },
    { id: 'rabbit', x: 2.35, height: 0.4, color: '#F2B8D0' },
  ];
  for (const entry of layout) {
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.15, 1.28, entry.height, 40), new THREE.MeshToonMaterial({ color: entry.color }));
    platform.position.set(entry.x, entry.height / 2, 0);
    platform.receiveShadow = true;
    presentationRoot.add(platform);
    const fighter = sim.fighters.find((item) => item.charId === entry.id);
    const actor = createAnimal(CHARACTER_MAP[entry.id], 1.7);
    actor.group.position.set(entry.x, entry.height, 0);
    presentationRoot.add(actor.group);
    presentationActors.push({ actor, fighter });
  }
  stage.scene.add(presentationRoot);
  applyQualityToObject(presentationRoot, stage.quality);
  document.body.classList.add('poster');
  ui.showTitle();
  fx.spawnConfetti();
  posterConfettiT = 2.8;
}

function updatePoster(dt) {
  applyCamera(stage, { target: { x: 0, y: 1.25, z: 0 }, distance: 9.3, azimuth: 0.32, elevation: 18 * Math.PI / 180, time: elapsed });
  presentationActors.forEach(({ actor, fighter }, index) => {
    actor.update(dt, {
      ...fighter,
      eliminated: false,
      state: 'idle',
      onGround: true,
      facing: Math.sin(elapsed * 0.55 + index) * 0.10,
      invulnT: 0,
      starT: 0,
      landT: 0,
      dizzyT: 0,
      staggerT: 0,
      tumbleT: 0,
      attack: null,
      heldItem: null,
      anim: { ...fighter.anim, walk: 0, walkPhase: 0, breathe: elapsed + index, blink: (elapsed + index) % 3.5 < 0.12 ? 1 : 0, lean: 0, charge: 0 },
    });
  });
  posterConfettiT -= dt;
  if (posterConfettiT <= 0) {
    fx.spawnConfetti();
    posterConfettiT = 2.8;
  }
  fx.update(dt);
}

const showcasePositions = [];
function setupShowcase() {
  const root = new THREE.Group();
  const S = CONFIG.showcase;
  sim.fighters.forEach((fighter, index) => {
    const slot = index === 2 ? 6 : index === 6 ? 2 : index;
    const position = { x: S.columns[slot % 4], y: S.podiumHeight, z: S.rows[Math.floor(slot / 4)] };
    showcasePositions.push(position);
    const character = CHARACTER_MAP[fighter.charId];
    const podium = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.74, S.podiumHeight, 32), new THREE.MeshToonMaterial({ color: '#FFE9C7' }));
    podium.position.set(position.x, S.podiumHeight * 0.5, position.z);
    podium.receiveShadow = true;
    root.add(podium);
    const rim = new THREE.Mesh(new THREE.TorusGeometry(0.69, 0.035, 8, 32), new THREE.MeshBasicMaterial({ color: character.colors.fur }));
    rim.rotation.x = Math.PI / 2;
    rim.position.set(position.x, S.podiumHeight + 0.01, position.z);
    root.add(rim);
  });
  stage.scene.add(root);
  document.body.classList.add('showcase');
  ui.createShowcaseLabels(sim.fighters);
}

function updateShowcase(dt) {
  const S = CONFIG.showcase;
  applyCamera(stage, { target: { x: 0, y: S.cameraTargetY, z: 0 }, distance: S.cameraDistance, azimuth: S.cameraAzimuth, elevation: S.cameraElevation, time: elapsed });
  sim.fighters.forEach((fighter, index) => {
    const base = showcasePositions[index];
    const phase = (elapsed - index * S.phaseOffset + S.cycleDuration * 8) % S.cycleDuration;
    const jumping = phase < S.actionDuration;
    const jumpT = jumping ? phase / S.actionDuration : 0;
    const height = jumping ? Math.sin(jumpT * Math.PI) * S.jumpHeight : 0;
    const actor = actors.get(fighter.id);
    const blinkCycle = CONFIG.physics.blinkMin + index % 3;
    const position = { x: base.x, y: base.y + height, z: base.z };
    const dummy = {
      ...fighter,
      pos: position,
      facing: Math.sin(elapsed * S.turnSpeed + index * S.turnPhase) * S.turnAmount,
      state: jumping ? (jumpT < 0.5 ? 'jump' : 'fall') : 'idle',
      onGround: !jumping,
      landT: jumping && jumpT > 0.85 ? (1 - jumpT) * 8 * CONFIG.physics.landingDuration : 0,
      anim: { ...fighter.anim, walk: 0, walkPhase: 0, breathe: elapsed + index, blink: (elapsed + index * 1.7) % blinkCycle < CONFIG.physics.blinkDuration ? 1 : 0, lean: 0, charge: 0 },
    };
    actor.group.position.set(position.x, position.y, position.z);
    actor.update(dt, dummy);
    fx.updateShadow(fighter.id, position.x, position.y, position.z, false);
    updateShowcaseLabel(fighter, base);
  });
  fx.update(dt);
}

function syncCameraFov(dt) {
  const kick = fovKickAmount * (fovKickT / 0.10);
  fovKickT = Math.max(0, fovKickT - dt);
  const baseFov = stage.camera.aspect < 1 ? CONFIG.camera.portraitFov : CONFIG.camera.fov;
  const nextFov = baseFov - kick;
  if (Math.abs(stage.camera.fov - nextFov) > 0.001) {
    stage.camera.fov = nextFov;
    stage.camera.updateProjectionMatrix();
  }
}

function frame(now) {
  const frameMs = now - last;
  if (frameMs > 0 && frameMs < 250) {
    frameSamples.push(frameMs);
    if (frameSamples.length > 600) frameSamples.shift();
  }
  const dt = Math.min(frameMs / 1000, CONFIG.maxFrameTime);
  last = now;
  elapsed += dt;
  environment.update(dt, elapsed, sim.time);
  if (poster) updatePoster(dt);
  else if (showcase) updateShowcase(dt);
  else if (mode === 'select' || mode === 'results') updatePresentation(dt);
  else updateGame(dt);
  stage.renderer.toneMappingExposure = mode === 'select' ? 0.82 : CONFIG.renderer.exposure;
  syncCameraFov(dt);
  stage.renderer.render(stage.scene, stage.camera);
  if (!pageHidden) rafId = requestAnimationFrame(frame);
}

function debugSelfplay(seconds = 60) {
  const testSim = createSim({ arena: CLOUD_RING, characters: CHARACTERS, bots: 7, seed: 1, eliminateOnFall: true });
  testSim.fighters[0].isPlayer = false;
  const testBrains = createBrains({ fighters: testSim.fighters, characters: CHARACTERS, arena: CLOUD_RING, seed: 1, difficulty, allBots: true });
  let hits = 0;
  let selfDeaths = 0;
  const attackers = new Set();
  for (let i = 0; i < Math.floor(seconds / STEP); i++) {
    testBrains.update(STEP, testSim);
    testSim.step(STEP, new Map(testSim.fighters.map((fighter) => [fighter.id, testBrains.intentOf(fighter.id)])));
    for (const event of testSim.events) {
      if (event.type === 'hit') {
        hits += 1;
        attackers.add(event.attacker);
      }
      if (event.type === 'ko' && !event.killer) selfDeaths += 1;
    }
  }
  return { hits, selfDeaths, attackers: [...attackers], alive: testSim.alive.length, maxPlayerTargets: testBrains.maxPlayerTargets };
}

createRoster(selectedChar);
if (poster) setupPoster();
else if (showcase) setupShowcase();
else ui.showTitle();

const G = window.G ?? {};
Object.assign(G, {
  config: { CONFIG, CHARACTERS, CLOUD_RING, ARENAS, MODES },
  Core: { t, loadSave },
  Game: {
    get sim() { return sim; }, input, get match() { return match; }, get camera() { return cameraView; },
    get mode() { return mode; }, get paused() { return paused || helpOpen || portraitBlocked; }, get save() { return save; },
    get gameMode() { return selectedMode; }, get arena() { return selectedArena; },
  },
});
window.G = G;
if (debug) {
  window.__pb = {
    get sim() { return sim; },
    get brains() { return brains; },
    get match() { return match; },
    get __lastKoFocus() { return lastKoFocus; },
    get deathOverlay() { return deathOverlay; },
    get playerDeathT() { return playerDeathT; },
    get helpOpen() { return helpOpen; },
    get hitstopT() { return hitstopT; },
    get fovKickT() { return fovKickT; },
    get shakeAmp() { return shakeAmp; },
    actors,
    camera: stage.camera,
    get podiumCount() { return mode === 'results' ? presentationActors.length : 0; },
    selfplay: debugSelfplay,
    confetti() { fx.spawnConfetti(); return fx.confettiCount; },
    get confettiCount() { return fx.confettiCount; },
    resetStats() { frameSamples.length = 0; },
    stats() {
      let objects = 0;
      const sceneGeometries = new Set();
      stage.scene.traverse((object) => {
        objects += 1;
        if (object.geometry) sceneGeometries.add(object.geometry.uuid);
      });
      const sorted = [...frameSamples].sort((a, b) => a - b);
      const frameMs = frameSamples.length ? frameSamples.reduce((sum, value) => sum + value, 0) / frameSamples.length : 0;
      const drawCalls = stage.renderer.info.render.calls;
      return {
        fps: frameMs ? 1000 / frameMs : 0,
        frameMs,
        p95FrameMs: sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95))] : 0,
        drawCalls,
        triangles: stage.renderer.info.render.triangles,
        geometries: stage.renderer.info.memory.geometries,
        textures: stage.renderer.info.memory.textures,
        dpr: stage.renderer.getPixelRatio(),
        shadows: stage.renderer.shadowMap.enabled,
        quality: stage.quality,
        requestedQuality: stage.requestedQuality,
        objects,
        sceneGeometries: sceneGeometries.size,
        calls: drawCalls,
        averageFrameMs: frameMs,
        samples: frameSamples.length,
        arena: selectedArena.id,
        gameMode: selectedMode,
      };
    },
    switchArena(id) {
      if (!ARENA_MAP[id]) return;
      setArena(ARENA_MAP[id]);
      createRoster(selectedChar);
      resetPrevious();
    },
    setMode(id) {
      if (!MODES[id]) return;
      selectedMode = id;
      createRoster(selectedChar);
    },
    setPlayer(x, z) {
      const player = sim.fighters[0];
      player.pos.x = x;
      player.pos.z = z;
      previous.set(player.id, { pos: { ...player.pos }, facing: player.facing });
    },
    shake(amp) { shakeAmp = Math.max(0, amp); },
    play: startGame,
    select: showSelect,
    spawnItem(type, x = sim.fighters[0].pos.x, z = sim.fighters[0].pos.z) { return sim.spawnItem(type, { x, z, y: 0 }); },
    giveItem(type) {
      const uses = { fish: 3, hammer: 2 }[type] ?? 1;
      sim.fighters[0].heldItem = { type, uses };
      ui.updateHUD(sim, match);
    },
    skip() {
      if (helpOpen) closeHelp();
      match.skip();
    },
    step(frames = 1, intent = { mx: 0, mz: 0, jump: false, dash: false, punch: false, grab: false, charge: false }) {
      for (let i = 0; i < frames; i++) {
        match.step(STEP, intent);
        handleEvents(match.drainEvents());
      }
      resetPrevious();
    },
    knockout(id = 'f1') {
      const victim = sim.fighterMap.get(id);
      if (!victim || victim.eliminated) return;
      const killer = sim.fighters.find((fighter) => fighter.id !== id && !fighter.eliminated);
      victim.lastHitBy = killer?.id ?? null;
      victim.onGround = false;
      victim.vel.y = Math.min(victim.vel.y, -2);
      victim.pos.y = CONFIG.physics.fallY - 0.1;
    },
    forceKO(id = 'f1') {
      if (match.phase === 'intro') {
        match.skip();
        this.step(1);
      }
      this.knockout(id);
      this.step(1);
      return lastKoFocus;
    },
    winRound() {
      for (const fighter of sim.fighters) {
        if (fighter.isPlayer || fighter.eliminated) continue;
        fighter.lastHitBy = 'f0';
        fighter.onGround = false;
        fighter.pos.y = CONFIG.physics.fallY - 0.1;
      }
    },
    finishMatch() {
      let guard = 0;
      while (match.phase !== 'matchEnd' && guard++ < 2000) {
        if (match.phase === 'intro') match.skip();
        if (match.phase === 'fight') this.winRound();
        if (match.phase === 'roundEnd') match.skip();
        this.step(1);
      }
    },
  };
}
rafId = requestAnimationFrame(frame);
}
