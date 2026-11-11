import * as THREE from 'three';
import { CONFIG } from '../../config/game.config.js';
import { CHARACTER_MAP } from '../../config/characters.js';
import { ARENA_MAP, CLOUD_RING } from '../../config/arenas.js';
import { TEAM_COLORS, TEAM_NAMES } from '../../config/modes.js';
import { resolveServerUrl } from '../../config/net.config.js';
import { applyI18n, getLang, setLang, t } from '../core/i18n.js';
import { autoFrame } from '../game/camera.js';
import { createStage, buildEnvironment, disposeObject, resize, applyCamera, applyQualityToObject } from '../render/scene.js';
import { createAnimal } from '../render/animal.js';
import { createFx } from '../render/fx.js';
import { createItemRenderer } from '../render/items.js';
import { createAudio } from '../audio.js';
import { createNet } from './net.js';
import { createOnlineView, toViewFighter } from './view.js';
import { createLobby } from './lobby.js';
import { createHUD } from './hud.js';
import { createOnlineInput } from './input.js';

const query = new URLSearchParams(location.search);
setLang(query.get('lang') || CONFIG.lang);
applyI18n();
document.querySelectorAll('[data-i18n-placeholder]').forEach((element) => {
  element.placeholder = t(element.dataset.i18nPlaceholder);
});

const canvas = document.getElementById('game');
const stage = createStage(canvas, 'auto');
if (!stage) {
  canvas.hidden = true;
  document.getElementById('online-lobby').hidden = true;
  document.getElementById('webgl-fallback').hidden = false;
} else {
  boot(stage);
}

function boot(stage) {
  const environment = buildEnvironment(stage.scene, CLOUD_RING);
  const fx = createFx(stage.scene);
  const itemRenderer = createItemRenderer(stage.scene);
  const audio = createAudio();
  const input = createOnlineInput();
  const net = createNet({ url: resolveServerUrl(location.search, location) });
  const actors = new Map();
  const projected = new THREE.Vector3();
  const portraitQuery = matchMedia('(orientation: portrait) and (max-width: 900px)');
  const touchCapable = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 0;
  const playerRing = new THREE.Mesh(
    new THREE.TorusGeometry(CONFIG.fx.playerRingRadius, 0.025, 8, 48),
    new THREE.MeshBasicMaterial({ color: '#FF7A59', transparent: true, opacity: 0.65, depthWrite: false, toneMapped: false }),
  );
  playerRing.rotation.x = Math.PI / 2;
  playerRing.visible = false;
  playerRing.renderOrder = 3;
  stage.scene.add(playerRing);

  let lobby;
  let hud;
  let view = null;
  let viewState = null;
  let roster = new Map();
  let mode = 'lobby';
  let arena = CLOUD_RING;
  let cameraView = null;
  let previewRoot = null;
  let previewActor = null;
  let previewChar = 'shiba';
  let portraitBlocked = portraitQuery.matches;
  let elapsed = 0;
  let last = performance.now();
  let rafId = 0;
  let hudT = 0;
  let shakeAmp = 0;
  let lastEvent = null;
  let eventCount = 0;
  let pageHidden = document.hidden;

  function clearPreview() {
    if (!previewRoot) return;
    stage.scene.remove(previewRoot);
    previewActor?.dispose();
    disposeObject(previewRoot);
    previewRoot = null;
    previewActor = null;
  }

  function buildPreview(charId) {
    clearPreview();
    previewChar = CHARACTER_MAP[charId] ? charId : 'shiba';
    const character = CHARACTER_MAP[previewChar];
    previewRoot = new THREE.Group();
    previewRoot.position.set(3.2, 0, 0);
    const platform = new THREE.Mesh(
      new THREE.CylinderGeometry(1.35, 1.5, 0.18, 40),
      new THREE.MeshToonMaterial({ color: '#FFE9C7' }),
    );
    platform.position.y = 0.09;
    platform.receiveShadow = true;
    previewRoot.add(platform);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(1.37, 0.045, 8, 48),
      new THREE.MeshBasicMaterial({ color: character.colors.fur, toneMapped: false }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.185;
    previewRoot.add(ring);
    previewActor = createAnimal(character, 1.75);
    previewActor.group.position.y = 0.18;
    previewRoot.add(previewActor.group);
    stage.scene.add(previewRoot);
    applyQualityToObject(previewRoot, stage.quality);
  }

  function clearActors() {
    itemRenderer.clear();
    for (const actor of actors.values()) {
      stage.scene.remove(actor.group);
      actor.dispose();
    }
    actors.clear();
    fx.clearShadows();
    fx.clearEffects();
    playerRing.visible = false;
  }

  function buildActors(start) {
    clearActors();
    clearPreview();
    roster = new Map((start.fighters ?? []).map((fighter) => [fighter.id, fighter]));
    for (const fighter of start.fighters ?? []) {
      const character = CHARACTER_MAP[fighter.charId] ?? CHARACTER_MAP.shiba;
      const actor = createAnimal(character, CONFIG.animation.gameplayScale, lobby.mode === 'team' ? TEAM_COLORS[fighter.team] : null);
      stage.scene.add(actor.group);
      actors.set(fighter.id, actor);
      fx.addShadow(fighter.id);
    }
    applyQualityToObject(stage.scene, stage.quality);
  }

  function syncTouch() {
    const active = mode === 'playing' && net.latestSnapshot?.phase === 'fight' && !portraitBlocked && net.connected && !hud.resultsVisible;
    document.getElementById('touch').hidden = !(active && touchCapable);
    input.setEnabled(active);
  }

  function showLobby() {
    mode = 'lobby';
    view = null;
    viewState = null;
    net.setInputProvider(null);
    input.clear();
    clearActors();
    hud.hideAll();
    lobby.showSetup();
    cameraView = null;
    environment.setArenaBounds({ radius: CLOUD_RING.radius, width: CLOUD_RING.radius * 2, depth: CLOUD_RING.radius * 2 });
    buildPreview(lobby.profile.char);
    syncTouch();
  }

  function startMatch(start) {
    mode = 'playing';
    arena = ARENA_MAP[start.arena] ?? CLOUD_RING;
    document.body.dataset.arena = arena.id;
    view = createOnlineView(net.playerId);
    net.buffer.clear();
    viewState = null;
    cameraView = null;
    shakeAmp = 0;
    buildActors(start);
    lobby.hide();
    hud.showGameplay(start, net.playerId);
    net.setInputProvider(() => input.packet());
    environment.setArenaBounds({ radius: arena.radius, width: arena.width ?? arena.radius * 2, depth: arena.depth ?? arena.radius * 2 });
    audio.setPaused(false);
    syncTouch();
  }

  function finishMatch(result) {
    if (mode === 'results') return;
    mode = 'results';
    input.clear();
    net.setInputProvider(null);
    hud.showMatchEnd(result, lobby.isHost);
    fx.spawnConfetti();
    audio.play('cheer');
    syncTouch();
  }

  function eventWinner(event) {
    if (event.teamWinner !== undefined) return TEAM_NAMES[event.teamWinner]?.[getLang()] ?? '';
    return roster.get(event.winner)?.name ?? event.winner ?? '';
  }

  function handleEvent(event) {
    if (!event) return;
    lastEvent = event.type;
    eventCount += 1;
    if (event.type === 'roundStart') {
      net.buffer.clear();
      view?.reset();
      viewState = null;
      itemRenderer.clear();
      fx.clearEffects();
      cameraView = null;
      hud.beginRound();
      hud.announce(t('round', { round: event.round }), 550);
    } else if (event.type === 'countdown') {
      hud.announce(event.value === 'GO' ? t('go') : String(event.value), 560);
      audio.play('countdown', event.value);
    } else if (event.type === 'attack') {
      audio.play(event.sfx || 'whoosh');
    } else if (event.type === 'hit') {
      fx.spawnHit(event.x, event.y, event.z, event.heavy, { x: event.dx ?? 0, z: event.dz ?? 1 });
      audio.play(event.heavy ? 'hitHeavy' : 'hitLight');
      shakeAmp = Math.max(shakeAmp, event.heavy ? 0.42 : 0.2);
    } else if (event.type === 'land') {
      fx.spawnDust(event.x, event.y, event.z);
      audio.play('land');
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
      fx.spawnKO(event.x, event.y, event.z);
      audio.play('ko');
      hud.addKillFeed(event);
      if (event.victim !== net.fighterId) hud.announce(t('ko'));
      shakeAmp = Math.max(shakeAmp, event.victim === net.fighterId ? 0.7 : 0.2);
    } else if (event.type === 'finalTwo') {
      hud.announce(t('finalTwo'), 1300);
    } else if (event.type === 'roundEnd') {
      input.clear();
      hud.announce(t('wins', { name: eventWinner(event) }), 1300);
      hud.showRoundEnd(event);
      audio.play('cheer');
    } else if (event.type === 'matchEnd') {
      finishMatch(event);
    }
    hudT = 0;
    syncTouch();
  }

  lobby = createLobby({ net, onCharacter: buildPreview });
  hud = createHUD({
    onReplay: () => {
      showLobby();
      net.createFresh(lobby.mode, lobby.profile.char);
    },
    onLeave: () => net.leave(),
    onRetry: () => net.retry(),
    onMute: () => audio.toggleMute(),
  });
  document.getElementById('mute-button').textContent = audio.muted ? '×' : '♪';

  net.on('start', startMatch);
  net.on('snapshot', (snapshot) => {
    view?.reconcile(snapshot);
  });
  net.on('event', (message) => handleEvent(message.event));
  net.on('matchEnd', finishMatch);
  net.on('pong', () => hud.setPing(net.ping));
  net.on('status', (status) => {
    hud.setConnection(status);
    if (status.state === 'online') hud.setConnection(status);
    syncTouch();
  });
  net.on('welcome', (message) => {
    if (!message.room && mode !== 'lobby') showLobby();
  });

  function updateMarkers(fighters, localPlayer) {
    const nearest = new Set();
    if (localPlayer && lobby.mode !== 'team') {
      fighters
        .filter((fighter) => !fighter.isPlayer && !fighter.eliminated && fighter.state !== 'falling')
        .map((fighter) => ({ id: fighter.id, distance: Math.hypot(fighter.pos.x - localPlayer.pos.x, fighter.pos.z - localPlayer.pos.z) }))
        .filter((entry) => entry.distance <= 6)
        .sort((a, b) => a.distance - b.distance)
        .slice(0, 2)
        .forEach((entry) => nearest.add(entry.id));
    }
    for (const fighter of fighters) {
      const actor = actors.get(fighter.id);
      if (!actor) continue;
      projected.set(fighter.pos.x, fighter.pos.y + actor.labelY + 0.12, fighter.pos.z).project(stage.camera);
      const onScreen = projected.z > -1 && projected.z < 1 && Math.abs(projected.x) < 1.1 && Math.abs(projected.y) < 1.1;
      const marked = fighter.isPlayer || lobby.mode === 'team' || nearest.has(fighter.id);
      hud.updateMarker(fighter.id, {
        x: (projected.x * 0.5 + 0.5) * innerWidth,
        y: (-projected.y * 0.5 + 0.5) * innerHeight,
        visible: mode === 'playing' && !portraitBlocked && !fighter.eliminated && fighter.state !== 'falling' && onScreen && marked,
        detailed: fighter.isPlayer || lobby.mode === 'team' || nearest.has(fighter.id),
      });
    }
  }

  function updatePreview(dt) {
    if (!previewActor) buildPreview(lobby.profile.char);
    const fighter = toViewFighter({ id: 'preview', charId: previewChar, state: 'idle', onGround: true }, null, elapsed);
    previewActor.update(dt, {
      ...fighter,
      facing: Math.sin(elapsed * 0.55) * 0.16,
      anim: { ...fighter.anim, breathe: elapsed, blink: elapsed % 3.4 < 0.12 ? 1 : 0 },
    });
    applyCamera(stage, {
      target: { x: 3.2, y: 1.25, z: 0 },
      distance: 9.2,
      azimuth: 0.18,
      elevation: 19 * Math.PI / 180,
      time: elapsed,
    });
  }

  function updateMatch(dt) {
    if (!view) return;
    const snapshot = net.latestSnapshot;
    const intent = input.sample({ azimuth: cameraView?.azimuth ?? CONFIG.camera.azimuthBase, gamepads: navigator.getGamepads?.() ?? [] });
    viewState = view.sample({
      buffer: net.buffer,
      now: performance.now(),
      dt,
      intent,
      arena,
      phase: snapshot?.phase,
      elapsed,
      roster,
    });
    if (!viewState) return;
    const bounds = viewState.arena ?? arena;
    environment.setArenaBounds({
      radius: bounds.radius ?? arena.radius,
      width: bounds.width ?? arena.width ?? arena.radius * 2,
      depth: bounds.depth ?? arena.depth ?? arena.radius * 2,
    });
    const cameraArena = { ...arena, radius: bounds.radius ?? arena.radius, width: bounds.width ?? arena.width, depth: bounds.depth ?? arena.depth };
    let focus = null;
    if (snapshot?.phase === 'roundEnd' || snapshot?.phase === 'matchEnd') {
      focus = viewState.fighters.find((fighter) => fighter.rank === 1 && !fighter.eliminated) ?? null;
    }
    cameraView = autoFrame({
      fighters: viewState.fighters,
      arena: cameraArena,
      time: elapsed,
      aspect: stage.camera.aspect,
      view: cameraView ? { ...cameraView, dt } : null,
      focus,
      distanceScale: viewState.fighters.filter((fighter) => !fighter.eliminated).length === 2 ? 0.85 : 1,
    });
    shakeAmp *= Math.exp(-CONFIG.camera.shakeDecay * dt);
    applyCamera(stage, { ...cameraView, shake: shakeAmp, time: elapsed });

    for (const fighter of viewState.fighters) {
      const actor = actors.get(fighter.id);
      if (!actor) continue;
      actor.group.position.set(fighter.pos.x, fighter.pos.y, fighter.pos.z);
      actor.update(dt, fighter);
      const overArena = (cameraArena.shape === 'rect'
        ? Math.abs(fighter.pos.x) < cameraArena.width * 0.5 && Math.abs(fighter.pos.z) < cameraArena.depth * 0.5
        : Math.hypot(fighter.pos.x, fighter.pos.z) < cameraArena.radius) && fighter.pos.y >= 0 && !fighter.eliminated && fighter.state !== 'falling';
      fx.updateShadow(fighter.id, fighter.pos.x, fighter.pos.y, fighter.pos.z, overArena);
      if (fighter.isPlayer) {
        const pulse = Math.sin(elapsed * Math.PI * 2 / CONFIG.fx.playerRingPeriod);
        playerRing.visible = mode === 'playing' && !fighter.eliminated && fighter.state !== 'falling';
        playerRing.position.set(fighter.pos.x, fighter.pos.y + 0.035, fighter.pos.z);
        playerRing.scale.setScalar(1 + pulse * 0.1);
        playerRing.material.opacity = 0.55 + pulse * 0.2;
      }
    }
    updateMarkers(viewState.fighters, viewState.fighters.find((fighter) => fighter.isPlayer));
    itemRenderer.sync(viewState, actors, dt, elapsed);
    hudT -= dt;
    if (hudT <= 0) {
      hud.update(viewState, viewState.fighters, net.ping);
      hudT = 0.1;
    }
  }

  function frame(now) {
    const dt = Math.min(Math.max(0, now - last) / 1000, CONFIG.maxFrameTime);
    last = now;
    elapsed += dt;
    environment.update(dt, elapsed, (net.latestSnapshot?.tick ?? 0) / CONFIG.logicFps);
    if (mode === 'lobby') updatePreview(dt);
    else updateMatch(dt);
    syncTouch();
    fx.update(dt);
    stage.renderer.render(stage.scene, stage.camera);
    if (!pageHidden) rafId = requestAnimationFrame(frame);
  }

  function syncPortraitBlock() {
    portraitBlocked = portraitQuery.matches;
    document.body.classList.toggle('portrait-blocked', portraitBlocked);
    input.clear();
    audio.setPaused(portraitBlocked);
    syncTouch();
  }

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
  window.addEventListener('pagehide', () => net.close());

  window.__online = {
    get mode() { return mode; },
    get phase() { return net.latestSnapshot?.phase ?? null; },
    get playerId() { return net.playerId; },
    get fighterId() { return net.fighterId; },
    get room() { return net.room; },
    get ping() { return net.ping; },
    get sequence() { return net.sequence; },
    get tick() { return net.latestSnapshot?.tick ?? 0; },
    get round() { return net.latestSnapshot?.round ?? 0; },
    get connected() { return net.connected; },
    get actorCount() { return actors.size; },
    get positions() { return Object.fromEntries((viewState?.fighters ?? []).map((fighter) => [fighter.id, { ...fighter.pos }])); },
    get fighters() { return viewState?.fighters ?? []; },
    get lastEvent() { return lastEvent; },
    get eventCount() { return eventCount; },
    get camera() { return stage.camera; },
  };

  resize(stage);
  syncPortraitBlock();
  buildPreview(lobby.profile.char);
  net.connect(lobby.profile);
  rafId = requestAnimationFrame(frame);
}
