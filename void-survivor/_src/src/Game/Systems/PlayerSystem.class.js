import * as THREE from 'three';
import Game from '../Game.class';
import { spawnBullet, dashGhost, clampToArena } from '../ECS/factories';

const DASH_SPEED = 26;
const DASH_TIME = 0.18;
const DASH_CD = 2.4;

/**
 * PlayerSystem — WASD/stick movement, canvas-relative aim, hold-to-fire,
 * dash with cooldown + i-frames. Runs only while the director is 'playing'.
 */
export default class PlayerSystem {
  constructor(ecs) {
    this.ecs = ecs;
    this.game = Game.getInstance();
    this._dir = new THREE.Vector3();
    this._muzzle = new THREE.Vector3();
  }

  update(dt) {
    const game = this.game;
    if (game.world.director.state !== 'playing') return;
    const ids = this.ecs.query('player', 'transform');
    if (!ids.length) return;
    const id = ids[0];
    const p = this.ecs.get(id, 'player');
    const tr = this.ecs.get(id, 'transform');
    const kb = game.keyboard;
    const ptr = game.pointer;

    // --- movement ---
    let mx = 0;
    let mz = 0;
    if (kb.isDown('KeyW') || kb.isDown('ArrowUp')) mz -= 1;
    if (kb.isDown('KeyS') || kb.isDown('ArrowDown')) mz += 1;
    if (kb.isDown('KeyA') || kb.isDown('ArrowLeft')) mx -= 1;
    if (kb.isDown('KeyD') || kb.isDown('ArrowRight')) mx += 1;
    mx += ptr.stickVec.x;
    mz += ptr.stickVec.y;
    const mlen = Math.hypot(mx, mz);
    if (mlen > 1) {
      mx /= mlen;
      mz /= mlen;
    }
    p.moveX = mx;
    p.moveZ = mz;

    // --- dash ---
    p.dashCd = Math.max(0, p.dashCd - dt);
    p.dashT = Math.max(0, p.dashT - dt);
    if ((kb.consumePress('Space') || ptr.consumeTouchDash()) && p.dashCd <= 0 && mlen > 0.01) {
      p.dashT = DASH_TIME;
      p.dashCd = DASH_CD;
      p.invuln = Math.max(p.invuln, DASH_TIME + 0.08);
      game.audioManager.playPositional('dash', tr.pos, { volume: 0.8 });
      game.world.director.addTrauma(0.12);
    }
    if (p.dashT > 0) {
      dashGhost(this.ecs, game.scene, tr.pos, tr.rotY);
    }
    const speed = p.dashT > 0 ? DASH_SPEED : p.speed;
    tr.pos.x += mx * speed * dt;
    tr.pos.z += mz * speed * dt;
    clampToArena(tr.pos, 0.9);

    // --- aim (canvas-relative raycast, no pointer lock) ---
    const aim = ptr.updateAim();
    p.aim.copy(aim);
    this._dir.set(aim.x - tr.pos.x, 0, aim.z - tr.pos.z);
    let aimLen = this._dir.length();
    // auto-aim assist: pointer on top of the ship → lock nearest enemy
    if (aimLen < 1.4) {
      const nearest = this._nearestEnemy(tr.pos);
      if (nearest) {
        this._dir.set(nearest.x - tr.pos.x, 0, nearest.z - tr.pos.z);
        aimLen = this._dir.length();
      }
    }
    if (aimLen > 0.001) {
      this._dir.divideScalar(aimLen);
      tr.rotY = Math.atan2(this._dir.x, this._dir.z);
    }

    // --- fire ---
    p.fireCd -= dt;
    p.invuln = Math.max(0, p.invuln - dt);
    if (ptr.firing && p.fireCd <= 0) {
      p.fireCd = p.fireInterval;
      this._muzzle.copy(tr.pos).addScaledVector(this._dir, 0.9);
      spawnBullet(this.ecs, game.scene, this._muzzle, this._dir, p.damage);
      game.audioManager.playPositional('shoot', tr.pos, { volume: 0.5, refDistance: 9 });
      game.world.director.stats.shots++;
    }

    // visual bank + invuln blink
    const view = this.ecs.get(id, 'view');
    if (view) {
      view.obj.rotation.z = -mx * 0.16;
      view.obj.rotation.x = mz * 0.1;
      const blink = p.invuln > 0 && Math.floor(p.invuln * 14) % 2 === 0;
      view.obj.visible = !blink;
    }
  }

  _nearestEnemy(pos) {
    let best = null;
    let bd = 1e9;
    for (const eid of this.ecs.query('enemy', 'transform')) {
      const e = this.ecs.get(eid, 'enemy');
      if (e.spawnT < 1) continue;
      const t = this.ecs.get(eid, 'transform');
      const d = (t.pos.x - pos.x) ** 2 + (t.pos.z - pos.z) ** 2;
      if (d < bd) {
        bd = d;
        best = t.pos;
      }
    }
    return best;
  }
}