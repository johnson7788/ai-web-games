import * as THREE from 'three';
import Game from '../Game.class';
import {
  spawnEnemy, spawnPickup, shatterBurst, spawnPortal, playerExplosion, ENEMY_DEFS,
} from '../ECS/factories';
import { ARENA_HALF } from '../World/Components/Arena';

const BEST_KEY = 'void-survivor-best';

/**
 * WaveSystem — the director: state machine (title/playing/upgrade/gameover),
 * wave composition & scaling, spawn queue, upgrade offers, score/best,
 * screen-shake trauma. The game's progression rules live here.
 */
export default class WaveSystem {
  constructor(ecs) {
    this.ecs = ecs;
    this.game = Game.getInstance();
    this.state = 'title';
    this.wave = 0;
    this.spawnQueue = [];
    this.spawnTimer = 0;
    this.trauma = 0;
    this.stats = { score: 0, kills: 0, shots: 0 };
    this.best = this._loadBest();
    this._memBest = this.best;
    this.upgradeChoices = [];
    this._v = new THREE.Vector3();
  }

  /* ---------------- persistence (sandbox-safe) ---------------- */

  _loadBest() {
    try {
      const v = localStorage.getItem(BEST_KEY);
      if (v != null) return Number(v) || 0;
    } catch (e) { /* opaque origin / privacy mode */ }
    try {
      if (window.PipySDK && window.PipySDK.load) {
        const v = window.PipySDK.load('best');
        if (typeof v === 'number') return v;
      }
    } catch (e) { /* noop */ }
    return 0;
  }

  _saveBest(v) {
    this._memBest = v;
    try { localStorage.setItem(BEST_KEY, String(v)); } catch (e) { /* noop */ }
    try { if (window.PipySDK && window.PipySDK.save) window.PipySDK.save('best', v); } catch (e) { /* noop */ }
  }

  /* ---------------- run lifecycle ---------------- */

  startRun() {
    const game = this.game;
    game.world.resetEntities();
    this.state = 'playing';
    this.wave = 0;
    this.trauma = 0;
    this.stats = { score: 0, kills: 0, shots: 0 };
    game.ui.hideTitle();
    game.ui.hideGameOver();
    game.ui.hideUpgrade();
    game.ui.showHUD();
    this.startNextWave();
  }

  startNextWave() {
    this.wave++;
    const w = this.wave;
    const count = Math.min(4 + 3 * w, 34);
    this.spawnQueue = [];
    for (let i = 0; i < count; i++) {
      let kind = 'chaser';
      const r = Math.random();
      if (w >= 3 && r < 0.12 + w * 0.015) kind = 'tank';
      else if (w >= 2 && r < 0.45) kind = 'runner';
      this.spawnQueue.push(kind);
    }
    // tanks last for drama
    this.spawnQueue.sort((a, b) => (a === 'tank' ? 1 : 0) - (b === 'tank' ? 1 : 0));
    this.spawnTimer = 1.1;
    this.state = 'playing';
    this.game.ui.banner(`${this.t('WAVE')} ${w}`, this.t('Survive!'));
    this.game.audioManager.play('wave', 'sfx', { volume: 0.8 });
  }

  t(s) {
    return window.I18N ? window.I18N.t(s) : s;
  }

  /* ---------------- per-frame ---------------- */

  update(dt) {
    this.trauma = Math.max(0, this.trauma - dt * 1.5);
    if (this.state !== 'playing') return;

    // spawn queue
    if (this.spawnQueue.length) {
      this.spawnTimer -= dt;
      if (this.spawnTimer <= 0) {
        const kind = this.spawnQueue.shift();
        this._spawnAtEdge(kind);
        this.spawnTimer = Math.max(0.32, 1.0 - this.wave * 0.05);
      }
    } else if (this.ecs.query('enemy').length === 0) {
      // wave cleared
      const bonus = 50 * this.wave;
      this.stats.score += bonus;
      this.state = 'upgrade';
      this.game.audioManager.play('upgrade', 'sfx', { volume: 0.7 });
      this.upgradeChoices = this._rollUpgrades();
      this.game.ui.showUpgrade(this.upgradeChoices, this.wave, bonus);
    }
  }

  _spawnAtEdge(kind) {
    const def = ENEMY_DEFS[kind];
    const m = ARENA_HALF - 2.2;
    let x;
    let z;
    // random edge point, away from the player
    const pid = this.ecs.query('player', 'transform')[0];
    const pp = pid != null ? this.ecs.get(pid, 'transform').pos : null;
    for (let tries = 0; tries < 8; tries++) {
      const side = Math.floor(Math.random() * 4);
      const t = (Math.random() * 2 - 1) * m;
      if (side === 0) { x = t; z = -m; }
      else if (side === 1) { x = t; z = m; }
      else if (side === 2) { x = -m; z = t; }
      else { x = m; z = t; }
      if (!pp || Math.hypot(x - pp.x, z - pp.z) > 8) break;
    }
    spawnEnemy(this.ecs, this.game.scene, kind, x, z, this.wave);
    spawnPortal(this.ecs, this.game.scene, x, z, def.color);
    this.game.audioManager.playPositional('spawn', this._v.set(x, 0.5, z), { volume: 0.5 });
  }

  /* ---------------- combat events ---------------- */

  onKill(eid, enemy, pos) {
    const game = this.game;
    this.stats.kills++;
    this.stats.score += enemy.score;
    shatterBurst(this.ecs, game.scene, pos, enemy.kind === 'tank' ? 0xff9f1c : enemy.kind === 'runner' ? 0xff2d95 : 0xff3355, enemy.kind === 'tank');
    game.audioManager.playPositional('kill', pos, { volume: enemy.kind === 'tank' ? 1 : 0.8 });
    this.addTrauma(enemy.kind === 'tank' ? 0.28 : 0.1);
    game.ui.popup(pos, `+${enemy.score}`, '#ffd166');

    // drops
    const r = Math.random();
    if (enemy.kind === 'tank') {
      spawnPickup(this.ecs, game.scene, 'gem', pos.x, pos.z);
      if (r < 0.35) spawnPickup(this.ecs, game.scene, 'heal', pos.x + 0.8, pos.z + 0.4);
    } else if (r < 0.15) {
      spawnPickup(this.ecs, game.scene, 'heal', pos.x, pos.z);
    } else if (r < 0.38) {
      spawnPickup(this.ecs, game.scene, 'gem', pos.x, pos.z);
    }

    const view = this.ecs.get(eid, 'view');
    if (view) {
      game.scene.remove(view.obj);
      view.obj.traverse((c) => {
        if (c.isMesh && c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    }
    this.ecs.destroy(eid);
  }

  onPickup(pk, pos) {
    const game = this.game;
    const pid = this.ecs.query('player')[0];
    if (pk.kind === 'heal') {
      if (pid != null) {
        const p = this.ecs.get(pid, 'player');
        const healed = Math.min(p.maxHp - p.hp, 45);
        p.hp += healed;
        game.ui.popup(pos, `+${Math.round(healed)} HP`, '#37ffb4');
        game.ui.flash('heal');
      }
      game.audioManager.playPositional('heal', pos, { volume: 0.8 });
    } else {
      this.stats.score += 25;
      game.ui.popup(pos, '+25', '#ffd166');
      game.audioManager.playPositional('pickup', pos, { volume: 0.7 });
    }
  }

  damagePlayer(dmg, fromPos) {
    if (this.state !== 'playing') return;
    const pid = this.ecs.query('player', 'transform')[0];
    if (pid == null) return;
    const p = this.ecs.get(pid, 'player');
    const tr = this.ecs.get(pid, 'transform');
    if (p.invuln > 0) return;
    p.hp -= dmg;
    p.invuln = 0.6;
    this.addTrauma(0.5);
    this.game.ui.flash('hurt');
    this.game.audioManager.playPositional('hurt', tr.pos, { volume: 0.9 });
    if (p.hp <= 0) {
      p.hp = 0;
      this.gameOver(tr.pos);
    }
  }

  gameOver(pos) {
    this.state = 'gameover';
    const game = this.game;
    playerExplosion(this.ecs, game.scene, pos);
    const view = this.ecs.get(this.ecs.query('player', 'view')[0], 'view');
    if (view) view.obj.visible = false;
    this.addTrauma(0.9);
    game.audioManager.play('gameover', 'sfx', { volume: 0.9 });

    const wavesSurvived = this.wave - 1;
    const isNewBest = this.stats.score > this.best;
    if (isNewBest) {
      this.best = this.stats.score;
      this._saveBest(this.best);
    }
    try {
      if (window.PipySDK) {
        window.PipySDK.gameOver({ score: this.stats.score, wave: this.wave, kills: this.stats.kills });
      }
    } catch (e) { /* noop */ }
    game.ui.showGameOver({
      waves: wavesSurvived,
      kills: this.stats.kills,
      score: this.stats.score,
      best: this.best,
      isNewBest,
    });
  }

  /* ---------------- upgrades ---------------- */

  _rollUpgrades() {
    const pid = this.ecs.query('player')[0];
    const p = pid != null ? this.ecs.get(pid, 'player') : null;
    const pool = [
      { id: 'rapid', icon: '⚡', name: 'FIRE RATE', desc: '+28% fire rate' },
      { id: 'power', icon: '✹', name: 'DAMAGE', desc: '+30% damage' },
      { id: 'swift', icon: '➤', name: 'MOVE SPEED', desc: '+15% move speed' },
      { id: 'repair', icon: '✚', name: 'REPAIR', desc: '+45 HP, +10 max HP' },
    ];
    // shuffle, take 3
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    return pool.slice(0, 3).map((u) => ({ ...u }));
  }

  chooseUpgrade(index) {
    if (this.state !== 'upgrade') return;
    const choice = this.upgradeChoices[index];
    if (!choice) return;
    const pid = this.ecs.query('player')[0];
    if (pid != null) {
      const p = this.ecs.get(pid, 'player');
      if (choice.id === 'rapid') p.fireInterval = Math.max(0.07, p.fireInterval * 0.72);
      else if (choice.id === 'power') p.damage *= 1.3;
      else if (choice.id === 'swift') p.speed = Math.min(13.5, p.speed * 1.15);
      else if (choice.id === 'repair') {
        p.maxHp += 10;
        p.hp = Math.min(p.maxHp, p.hp + 45);
      }
    }
    this.game.audioManager.play('click', 'sfx', { volume: 0.7 });
    this.game.ui.hideUpgrade();
    this.startNextWave();
  }

  addTrauma(amount) {
    this.trauma = Math.min(1, this.trauma + amount);
  }
}