import Game from '../Game.class';

/**
 * ParticleSystem — integrates shards/sparks/rings/ghosts, fades & shrinks
 * them, disposes materials. Runs in every state so effects finish cleanly.
 */
export default class ParticleSystem {
  constructor(ecs) {
    this.ecs = ecs;
    this.game = Game.getInstance();
  }

  update(dt) {
    const scene = this.game.scene;
    for (const id of this.ecs.query('particle', 'transform').slice()) {
      const p = this.ecs.get(id, 'particle');
      const tr = this.ecs.get(id, 'transform');
      const view = this.ecs.get(id, 'view');
      if (!p || !tr) continue;

      p.life -= dt;
      if (p.life <= 0) {
        if (view) {
          scene.remove(view.obj);
          p.mat.dispose();
        }
        this.ecs.destroy(id);
        continue;
      }

      p.vel.y += p.gravity * dt;
      tr.pos.addScaledVector(p.vel, dt);
      if (tr.pos.y < 0.06 && p.kind === 'shard') {
        tr.pos.y = 0.06;
        p.vel.y = Math.abs(p.vel.y) * 0.35;
        p.vel.x *= 0.7;
        p.vel.z *= 0.7;
      }

      const k = p.life / p.maxLife;
      p.mat.opacity = k;
      if (view) {
        view.obj.position.copy(tr.pos);
        view.obj.rotation.x += p.angVel.x * dt;
        view.obj.rotation.y += p.angVel.y * dt;
        view.obj.rotation.z += p.angVel.z * dt;
        if (p.shrink) view.obj.scale.setScalar(Math.max(0.01, k));
        if (p.grow) {
          const s = 1 + (1 - k) * p.grow;
          view.obj.scale.setScalar(s);
        }
      }
    }
  }
}