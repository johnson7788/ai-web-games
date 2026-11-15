import * as THREE from 'three';
import { ZONES, BOUNDS } from '../world/House.js';

function inZone(pos, z) {
  return pos.x >= z.minX && pos.x <= z.maxX && pos.z >= z.minZ && pos.z <= z.maxZ;
}

/**
 * Orchestrates dread: one-shot scripted scares per room, plus a randomized
 * ambient event scheduler that keeps the air heavy between the big hits.
 */
export class ScareDirector {
  constructor(game) {
    this.game = game;
    this.fired = new Set();
    this.ambientTimer = 9 + Math.random() * 8; // first ambient event comes early
    this.lightningTimer = 14 + Math.random() * 14;
    this.stalkTimer = 10 + Math.random() * 8; // grace period after the 2nd key
    this.chairAnim = null;

    this.triggers = [
      { id: 'living', zone: ZONES.living, run: () => this._livingRoom() },
      { id: 'hallway', zone: ZONES.hallway, run: () => this._hallway() },
      { id: 'kitchen', zone: ZONES.kitchen, run: () => this._kitchen() },
      { id: 'bedroom', zone: ZONES.bedroom, run: () => this._bedroomSlam() },
    ];
  }

  /* ---------------- scripted one-shots ---------------- */

  _livingRoom() {
    const { audio } = this.game;
    setTimeout(() => audio.thump(0.5), 700);
    setTimeout(() => audio.whisper(-0.7), 1800);
  }

  _hallway() {
    const { audio, house, player, hud } = this.game;
    house.flickerAll(1.4);
    player.flashlightFlicker(1.0);
    setTimeout(() => {
      audio.slam();
      hud.shake();
    }, 900);
  }

  _kitchen() {
    const { audio, house, hud } = this.game;
    audio.stinger(0.8);
    hud.flash('#1a0000', 0.4, 160);
    hud.shake();
    // the chair drags itself away from the table
    const chair = house.props.kitchenChair;
    if (chair) {
      audio.chairScrape();
      this.chairAnim = { mesh: chair, t: 0, from: chair.position.clone(), to: chair.position.clone().add(new THREE.Vector3(-1.4, 0, 0.7)) };
    }
  }

  _bedroomSlam() {
    const { audio, house, hud } = this.game;
    const door = house.props.bedroomDoor;
    door.setOpen(false, 14); // slam shut
    setTimeout(() => {
      audio.slam();
      hud.shake();
      hud.flash('#000', 0.7, 200);
    }, 160);
  }

  /** Called by Game when the study key is picked up. */
  studyKeyScare() {
    if (this.fired.has('studyKey')) return;
    this.fired.add('studyKey');
    const { audio, ghost, player } = this.game;
    // he is standing in the study doorway, behind you
    audio.staticBurst(0.3);
    audio.stinger(1.0);
    ghost.appearAt(new THREE.Vector3(-7.2, 0, -0.5), 1.3);
    player.flashlightFlicker(1.3);
  }

  /* ---------------- ambient dread ---------------- */

  _ambientEvent() {
    const { audio, house, player } = this.game;
    const roll = Math.random();
    if (roll < 0.3) audio.whisper(Math.random() * 2 - 1);
    else if (roll < 0.55) audio.creak(0.5 + Math.random() * 0.4);
    else if (roll < 0.75) audio.thump(0.2 + Math.random() * 0.25);
    else if (roll < 0.9) house.flickerAll(0.5 + Math.random() * 0.6);
    else player.flashlightFlicker(0.6);
  }

  /* ---------------- the storm ---------------- */

  _lightning() {
    const { audio, house, hud } = this.game;
    const close = Math.random() < 0.3;
    house.lightningFlash();
    hud.flash('#9fb2e8', close ? 0.22 : 0.1, 320);
    audio.thunder(close ? 0.45 : 1.1 + Math.random() * 1.2, close);
  }

  /* ---------------- stalking phase (after 2nd key) ---------------- */

  _maybeStartStalk(dt, playerPos) {
    const { ghost, audio, hud } = this.game;
    if (this.game.keysFound < 2 || this.game.chaseActive || ghost.mode !== 'hidden') return;
    this.stalkTimer -= dt;
    if (this.stalkTimer > 0) return;
    this.stalkTimer = 24 + Math.random() * 20;
    // he manifests ~8m away and drifts toward you
    const a = Math.random() * Math.PI * 2;
    const x = THREE.MathUtils.clamp(playerPos.x + Math.cos(a) * 8, BOUNDS.minX + 1, BOUNDS.maxX - 1);
    const z = THREE.MathUtils.clamp(playerPos.z + Math.sin(a) * 8, BOUNDS.minZ + 1, BOUNDS.maxZ - 1);
    ghost.startStalk(new THREE.Vector3(x, 0, z), 18);
    audio.growl();
    audio.staticBurst(0.25);
    hud.toast('He is here. Burn him with the light.', 2800);
  }

  /* ---------------- update ---------------- */

  update(dt, playerPos) {
    for (const t of this.triggers) {
      if (!this.fired.has(t.id) && inZone(playerPos, t.zone)) {
        this.fired.add(t.id);
        t.run();
      }
    }

    // rolling storm outside, all game long
    this.lightningTimer -= dt;
    if (this.lightningTimer <= 0) {
      this._lightning();
      this.lightningTimer = 16 + Math.random() * 26;
    }

    this._maybeStartStalk(dt, playerPos);

    if (!this.game.chaseActive) {
      this.ambientTimer -= dt;
      if (this.ambientTimer <= 0) {
        this._ambientEvent();
        this.ambientTimer = 16 + Math.random() * 18;
      }
    }

    if (this.chairAnim) {
      const a = this.chairAnim;
      a.t = Math.min(1, a.t + dt / 0.9);
      const ease = 1 - Math.pow(1 - a.t, 3);
      a.mesh.position.lerpVectors(a.from, a.to, ease);
      a.mesh.rotation.y = ease * 0.9;
      if (a.t >= 1) this.chairAnim = null;
    }
  }
}
