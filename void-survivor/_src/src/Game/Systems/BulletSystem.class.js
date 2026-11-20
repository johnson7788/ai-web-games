import Game from '../Game.class';
import { hitSparks } from '../ECS/factories';
import { disposeView } from '../World/Components/Visuals';
import { ARENA_HALF } from '../World/Components/Arena';

/**
 * BulletSystem — tracer integration + sphere collision against enemies.
 * Kills trigger the shatter burst, positional kill SFX, score popup,
 * screen shake and pickup drops (via the director).
 */
export default class BulletSystem {
  constructor(ecs) {
    this.ecs = ecs;
    this.game = Game.getInstance();
  }

  update(dt) {
    const game = this.game;
    const director = game.world.director;
    if (director.state !== 'playing') return;

    const enemies = this.ecs.query('enemy', 'transform');
    const bullets = this.ecs.query('bullet', 'transform').slice();

    for (const bid of bullets) {
      const b = this.ecs.get(bid, 'bullet');
      const tr = this.ecs.get(bid, 'transform');
      if (!b || !tr) continue;

      tr.pos.addScaledVector(b.vel, dt);
      b.life -= dt;

      let dead = b.life <= 0 || Math.abs(tr.pos.x) > ARENA_HALF || Math.abs(tr.pos.z) > ARENA_HALF;

      if (!dead) {
        for (const eid of enemies) {
          const e = this.ecs.get(eid, 'enemy');
          const et = this.ecs.get(eid, 'transform');
          if (!e || !et || e.spawnT < 0.6) continue;
          const dx = et.pos.x - tr.pos.x;
          const dz = et.pos.z - tr.pos.z;
          const dy = et.pos.y - tr.pos.y;
          const rr = e.radius + b.radius;
          if (dx * dx + dz * dz + dy * dy * 0.5 < rr * rr) {
            dead = true;
            e.hp -= b.damage;
            e.flash = 1;
            const hitPos = tr.pos.clone();
            if (e.hp <= 0) {
              director.onKill(eid, e, et.pos);
            } else {
              hitSparks(this.ecs, game.scene, hitPos, 0x9ff6ff);
              game.audioManager.playPositional('hit', hitPos, { volume: 0.55 });
            }
            break;
          }
        }
      }

      if (dead) {
        const view = this.ecs.get(bid, 'view');
        if (view) {
          game.scene.remove(view.obj);
          disposeView(view.obj);
        }
        this.ecs.destroy(bid);
      }
    }
  }
}