import Game from '../Game.class';
import { clampToArena } from '../ECS/factories';

/**
 * EnemySystem — spawn rise-in, chase the player, soft separation,
 * contact damage with per-enemy cooldown, hit-flash decay, hover/spin.
 */
export default class EnemySystem {
  constructor(ecs) {
    this.ecs = ecs;
    this.game = Game.getInstance();
  }

  update(dt) {
    const game = this.game;
    const director = game.world.director;
    const playing = director.state === 'playing';
    const t = game.time.elapsedTime;

    const playerIds = this.ecs.query('player', 'transform');
    const playerTr = playerIds.length ? this.ecs.get(playerIds[0], 'transform') : null;
    const player = playerIds.length ? this.ecs.get(playerIds[0], 'player') : null;

    const ids = this.ecs.query('enemy', 'transform').slice();
    for (const id of ids) {
      const e = this.ecs.get(id, 'enemy');
      const tr = this.ecs.get(id, 'transform');
      const view = this.ecs.get(id, 'view');
      if (!e || !tr) continue;

      // spawn rise-in
      if (e.spawnT < 1) {
        e.spawnT = Math.min(1, e.spawnT + dt / 0.45);
        const k = e.spawnT * e.spawnT * (3 - 2 * e.spawnT); // smoothstep
        tr.pos.y = e.baseY * k - 1.3 * (1 - k);
        if (view) view.obj.scale.setScalar(Math.max(0.05, k));
        continue;
      }

      // hover bob + tumble
      tr.pos.y = e.baseY + Math.sin(t * 3 + e.bobPhase) * 0.12;
      tr.rotY += e.spin * dt;
      if (view) {
        view.obj.rotation.x += e.spin * 0.6 * dt;
        // hit flash decay
        if (e.flash > 0) {
          e.flash = Math.max(0, e.flash - dt * 5);
          e.mat.emissiveIntensity = 1.35 + e.flash * 3.2;
        }
      }

      if (!playing || !playerTr) continue;

      // chase
      const dx = playerTr.pos.x - tr.pos.x;
      const dz = playerTr.pos.z - tr.pos.z;
      const dist = Math.hypot(dx, dz) || 0.001;
      let vx = (dx / dist) * e.speed;
      let vz = (dz / dist) * e.speed;

      // soft separation from other enemies
      for (const oid of ids) {
        if (oid === id) continue;
        const ot = this.ecs.get(oid, 'transform');
        const oe = this.ecs.get(oid, 'enemy');
        if (!ot || !oe || oe.spawnT < 1) continue;
        const sx = tr.pos.x - ot.pos.x;
        const sz = tr.pos.z - ot.pos.z;
        const sd = Math.hypot(sx, sz);
        const minD = e.radius + oe.radius + 0.25;
        if (sd > 0.001 && sd < minD) {
          const push = (minD - sd) * 3.2;
          vx += (sx / sd) * push;
          vz += (sz / sd) * push;
        }
      }

      tr.pos.x += vx * dt;
      tr.pos.z += vz * dt;
      clampToArena(tr.pos, e.radius + 0.3);

      // contact damage
      e.touchCd = Math.max(0, e.touchCd - dt);
      if (dist < e.radius + player.radius + 0.15 && e.touchCd <= 0) {
        e.touchCd = 0.85;
        director.damagePlayer(e.damage, tr.pos);
        // knock the enemy back a bit
        tr.pos.x -= (dx / dist) * 1.1;
        tr.pos.z -= (dz / dist) * 1.1;
      }
    }
  }
}