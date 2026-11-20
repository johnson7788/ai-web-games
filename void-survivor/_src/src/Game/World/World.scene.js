import Game from '../Game.class';
import ECS from '../ECS/ECS.class';
import Arena from './Components/Arena';
import { spawnPlayer } from '../ECS/factories';
import { disposeView } from './Components/Visuals';
import PlayerSystem from '../Systems/PlayerSystem.class';
import EnemySystem from '../Systems/EnemySystem.class';
import BulletSystem from '../Systems/BulletSystem.class';
import PickupSystem from '../Systems/PickupSystem.class';
import ParticleSystem from '../Systems/ParticleSystem.class';
import WaveSystem from '../Systems/WaveSystem.class';
import RenderSystem from '../Systems/RenderSystem.class';

/**
 * World — adapted from threejs-gamedev-template. Owns the arena and the
 * ECS: entities (player / enemies / bullets / pickups / particles) are
 * component bundles, updated by ordered systems each frame.
 */
export default class World {
  constructor() {
    this.game = Game.getInstance();
    this.scene = this.game.scene;

    this.arena = new Arena();
    this.ecs = new ECS();

    // systems in update order
    this.director = this.ecs.addSystem(new WaveSystem(this.ecs));
    this.ecs.addSystem(new PlayerSystem(this.ecs));
    this.ecs.addSystem(new EnemySystem(this.ecs));
    this.ecs.addSystem(new BulletSystem(this.ecs));
    this.ecs.addSystem(new PickupSystem(this.ecs));
    this.ecs.addSystem(new ParticleSystem(this.ecs));
    this.ecs.addSystem(new RenderSystem(this.ecs));

    this.playerId = spawnPlayer(this.ecs, this.scene);
  }

  /** Clear all entities and respawn a fresh player (new run). */
  resetEntities() {
    for (const id of this.ecs.query('view').slice()) {
      const view = this.ecs.get(id, 'view');
      if (view) {
        this.scene.remove(view.obj);
        disposeView(view.obj, !this.ecs.has(id, 'particle'));
      }
    }
    this.ecs.clear();
    this.playerId = spawnPlayer(this.ecs, this.scene);
  }

  update() {
    const dt = this.game.time.delta;
    this.arena.update(this.game.time.elapsedTime);
    this.ecs.update(dt);
  }
}