import * as THREE from 'three';
import Game from '../Game.class';

/**
 * RenderSystem — syncs ECS transforms to scene objects, drives the follow
 * camera + trauma-based screen shake, keeps the spatial-audio listener on
 * the camera, and pushes HUD state.
 */
export default class RenderSystem {
  constructor(ecs) {
    this.ecs = ecs;
    this.game = Game.getInstance();
    this._camTarget = new THREE.Vector3();
    this._look = new THREE.Vector3();
    this._shake = new THREE.Vector3();
    this._titleAngle = 0;
  }

  update(dt) {
    const game = this.game;
    const director = game.world.director;

    // sync views
    for (const id of this.ecs.query('transform', 'view')) {
      const tr = this.ecs.get(id, 'transform');
      const view = this.ecs.get(id, 'view');
      if (!tr || !view) continue;
      view.obj.position.copy(tr.pos);
      if (!this.ecs.has(id, 'particle')) {
        view.obj.rotation.y = tr.rotY;
      }
    }

    const camera = game.camera.cameraInstance;

    if (director.state === 'title') {
      // slow orbit over the arena on the title screen
      this._titleAngle += dt * 0.12;
      const r = 26;
      camera.position.set(Math.sin(this._titleAngle) * r, 20, Math.cos(this._titleAngle) * r);
      camera.lookAt(0, 0, 0);
    } else {
      const pid = this.ecs.query('player', 'transform')[0];
      const pp = pid != null ? this.ecs.get(pid, 'transform').pos : this._camTarget.set(0, 0, 0);
      this._camTarget.set(pp.x, 0, pp.z);
      const desired = this._camTarget.clone().add(game.camera.offset);
      // smooth follow
      const k = 1 - Math.pow(0.0015, dt);
      camera.position.lerp(desired, k);

      // trauma shake
      const trauma = director.trauma;
      if (trauma > 0) {
        const s = trauma * trauma * 0.85;
        this._shake.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s * 0.6, (Math.random() - 0.5) * s);
        camera.position.add(this._shake);
      }
      this._look.set(pp.x, 0.4, pp.z);
      camera.lookAt(this._look);
    }

    // spatial audio listener follows the camera
    game.audioManager.updateListener(camera);

    // HUD
    const pid = this.ecs.query('player')[0];
    const p = pid != null ? this.ecs.get(pid, 'player') : null;
    const enemiesAlive = this.ecs.query('enemy').length + director.spawnQueue.length;
    game.ui.updateHUD({
      hp: p ? p.hp : 0,
      maxHp: p ? p.maxHp : 100,
      wave: director.wave,
      kills: director.stats.kills,
      score: director.stats.score,
      best: Math.max(director.best, director.stats.score),
      dashFrac: p ? 1 - p.dashCd / 2.4 : 1,
      enemiesLeft: enemiesAlive,
      state: director.state,
    });
  }
}