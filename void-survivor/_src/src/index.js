import Game from './Game/Game.class';
import ResourceLoader from './Game/Utils/ResourceLoader.class';
import ASSETS from './Config/assets.js';
import { generateAllAudio } from './Game/Audio/Synth.js';

/**
 * VOID SURVIVOR boot — template ResourceLoader pipeline + procedural audio
 * synthesis, then the Game singleton (ECS world, spatial audio, UI).
 */

const resources = new ResourceLoader(ASSETS);
let loadedFired = false;
let audioDone = false;
let started = false;

function tryStart() {
  if (!loadedFired || !audioDone || started) return;
  started = true;
  init();
}

resources.on('loaded', () => {
  loadedFired = true;
  tryStart();
});

generateAllAudio()
  .then((items) => {
    for (const [id, buffer] of Object.entries(items)) resources.addBuffer(id, buffer);
  })
  .catch((err) => {
    console.warn('Audio synthesis unavailable, continuing silently:', err);
  })
  .finally(() => {
    audioDone = true;
    tryStart();
  });

function init() {
  const game = new Game(document.getElementById('three'), resources);
  const director = game.world.director;
  const ui = game.ui;

  ui.el.titleBest.textContent = String(director.best);

  // global keys: start / restart
  window.addEventListener('keydown', (e) => {
    const state = director.state;
    if (state === 'title' && (e.code === 'Enter' || e.code === 'Space')) {
      ui._startGame();
    } else if (state === 'gameover' && (e.code === 'KeyR' || e.code === 'Enter' || e.code === 'Space')) {
      ui._restart();
    } else if (state === 'playing' && e.code === 'KeyR') {
      ui._restart();
    }
  });

  // click anywhere on the title panel (except credits links) to start
  ui.el.title.addEventListener('click', (e) => {
    if (e.target.closest('a')) return;
    if (director.state === 'title') ui._startGame();
  });

  // smoke / debug bridge (harmless in production)
  window.__VOID__ = {
    game,
    ecs: game.world.ecs,
    director,
    ui,
    state: () => director.state,
    stats: () => ({ ...director.stats, wave: director.wave, best: director.best }),
    player: () => {
      const id = game.world.ecs.query('player')[0];
      if (id == null) return null;
      const p = game.world.ecs.get(id, 'player');
      const t = game.world.ecs.get(id, 'transform');
      return { hp: p.hp, maxHp: p.maxHp, x: t.pos.x, z: t.pos.z, damage: p.damage, fireInterval: p.fireInterval, speed: p.speed };
    },
    enemies: () =>
      game.world.ecs.query('enemy').map((id) => {
        const e = game.world.ecs.get(id, 'enemy');
        const t = game.world.ecs.get(id, 'transform');
        return { kind: e.kind, hp: e.hp, x: t.pos.x, z: t.pos.z, spawnT: e.spawnT };
      }),
    /** Screen position of the nearest active enemy (for real-input aiming). */
    nearestEnemyScreen: () => {
      const pid = game.world.ecs.query('player', 'transform')[0];
      if (pid == null) return null;
      const pp = game.world.ecs.get(pid, 'transform').pos;
      let best = null;
      let bd = 1e9;
      for (const id of game.world.ecs.query('enemy', 'transform')) {
        const e = game.world.ecs.get(id, 'enemy');
        const t = game.world.ecs.get(id, 'transform');
        if (e.spawnT < 1) continue;
        const d = (t.pos.x - pp.x) ** 2 + (t.pos.z - pp.z) ** 2;
        if (d < bd) {
          bd = d;
          best = t.pos;
        }
      }
      if (!best) return null;
      const v = best.clone().project(game.camera.cameraInstance);
      return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight,
        dist: Math.sqrt(bd),
      };
    },
  };
}