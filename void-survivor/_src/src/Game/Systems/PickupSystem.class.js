import Game from '../Game.class';
import { disposeView } from '../World/Components/Visuals';

/**
 * PickupSystem — heal orbs & score gems: bob, magnet toward the player
 * within range, collect on contact, expire after 12s.
 */
export default class PickupSystem {
  constructor(ecs) {
    this.ecs = ecs;
    this.game = Game.getInstance();
  }

  update(dt) {
    const game = this.game;
    const director = game.world.director;
    if (director.state !== 'playing') return;

    const playerIds = this.ecs.query('player', 'transform');
    if (!playerIds.length) return;
    const ptr = this.ecs.get(playerIds[0], 'transform');
    const t = game.time.elapsedTime;

    for (const id of this.ecs.query('pickup', 'transform').slice()) {
      const pk = this.ecs.get(id, 'pickup');
      const tr = this.ecs.get(id, 'transform');
      if (!pk || !tr) continue;

      pk.life -= dt;
      tr.pos.y = 0.55 + Math.sin(t * 4 + pk.bobPhase) * 0.12;
      tr.rotY += dt * 2;
      if (pk.body) pk.body.rotation.x += dt * 1.5;

      const dx = ptr.pos.x - tr.pos.x;
      const dz = ptr.pos.z - tr.pos.z;
      const dist = Math.hypot(dx, dz) || 0.001;

      // magnet
      if (dist < 3.4) {
        const pull = (3.4 - dist) * 6 + 2;
        tr.pos.x += (dx / dist) * pull * dt;
        tr.pos.z += (dz / dist) * pull * dt;
      }

      let dead = pk.life <= 0;
      if (!dead && dist < pk.radius + 0.75) {
        dead = true;
        director.onPickup(pk, tr.pos);
      }
      // blink when about to expire
      const view = this.ecs.get(id, 'view');
      if (view && pk.life < 3) {
        view.obj.visible = Math.floor(pk.life * 6) % 2 === 0;
      }

      if (dead) {
        if (view) {
          game.scene.remove(view.obj);
          disposeView(view.obj);
        }
        this.ecs.destroy(id);
      }
    }
  }
}