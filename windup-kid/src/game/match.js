// 关卡进程：玩家 + 敌人 + 拾取 + 检查点 + 结算。纯逻辑，事件驱动。
import { Player } from './player.js';
import { Enemy } from './enemies.js';
import { Mushroom, Flower, Fireball } from './items.js';
import { T } from './level.js';
import { CONFIG, P } from '../../config/game.config.js';

const overlap = (a, b) =>
  Math.abs(a.x - b.x) < a.hw + b.hw && Math.abs(a.y - b.y) < a.hh + b.hh;

export class Match {
  constructor(level) {
    this.level = level;
    this.player = new Player(level.spawn);
    this.enemies = level.enemies.map((e) => new Enemy(e));
    this.items = [];
    this.fireballs = [];
    this.timeLeft = level.timeLimit;
    this.gears = 0;
    this.deaths = 0;
    this.ended = false;
    this.handlers = Object.create(null);
    this.cause = 'hit';
    this.respawn = { x: level.spawn.x, y: level.spawn.y + CONFIG.player.h / 2 };
  }

  on(name, fn) { (this.handlers[name] ||= []).push(fn); return this; }
  emit(name, data) { (this.handlers[name] || []).forEach((fn) => fn(data)); }

  restart() {
    this.level.pickups.forEach((p) => { p.taken = false; });
    this.level.checkpoints.forEach((c) => { c.on = false; });
    this.player = new Player(this.level.spawn);
    this.enemies = this.level.enemies.map((e) => new Enemy(e));
    this.items = [];
    this.fireballs = [];
    this.timeLeft = this.level.timeLimit;
    this.gears = 0;
    this.deaths = 0;
    this.ended = false;
    this.respawn = { x: this.level.spawn.x, y: this.level.spawn.y + CONFIG.player.h / 2 };
  }

  update(input, dt) {
    if (this.ended) return;
    const p = this.player;

    const wasGrounded = p.body.grounded;
    p.update(input, this.level, dt);
    if (!wasGrounded && p.body.grounded) this.emit('land');
    for (const ev of p.events.splice(0)) this.emit(ev);

    if (p.body.hitCeil && p.body.hitTile) this.bump(p.body.hitTile);
    this.updateItems(dt);
    this.collectItems();
    this.shoot(input);
    this.updateFireballs(dt);
    this.checkSpring();
    this.updateEnemies(dt);
    this.collectPickups();
    this.touchEnemies(input);
    this.checkpoints();
    this.checkGoal();

    if (p.body.y < -4) this.cause = 'pit';
    if (p.dead) this.kill();
    this.timeLeft = Math.max(0, this.timeLeft - dt);
    if (this.timeLeft === 0) this.kill();

    for (const ev of p.events.splice(0)) this.emit(ev);
  }

  bump({ tx, ty }) {
    const t = this.level.tileAt(tx, ty);
    if (t === T.QUESTION) {
      this.level.setTile(tx, ty, T.HARD);
      const kind = this.player.state === 'small' ? 'mushroom' : 'flower';
      this.items.push(kind === 'flower' ? new Flower(tx + 0.5, ty + 1.15) : new Mushroom(tx + 0.5, ty + 1.05));
      this.emit('bump', { tx, ty, question: true });
      return;
    }
    if (t === T.BRICK && this.player.state !== 'small') {
      this.level.setTile(tx, ty, T.EMPTY);
      this.emit('break', { tx, ty });
      return;
    }
    this.emit('bump', { tx, ty, question: false });
  }

  updateItems(dt) {
    for (const it of this.items) {
      if (!it.alive) continue;
      if (Math.abs(it.body.x - this.player.body.x) > 40) continue;
      it.update(this.level, dt);
    }
  }

  collectItems() {
    const p = this.player.body;
    for (const it of this.items) {
      if (!it.alive) continue;
      if (Math.abs(it.body.x - p.x) < it.body.hw + p.hw && Math.abs(it.body.y - p.y) < it.body.hh + p.hh) {
        it.alive = false;
        if (this.player.powerUp(it.kind === 'flower' ? 'fire' : 'mushroom')) {
          this.emit('powerup', { kind: it.kind });
        }
      }
    }
  }

  shoot(input) {
    const p = this.player;
    if (!input.firePressed || p.state !== 'fire' || p.fireCooldown > 0) return;
    p.fireCooldown = 0.3;
    this.fireballs.push(new Fireball(p.body.x + p.facing * 0.5, p.body.y + 0.1, p.facing));
    this.emit('fire');
  }

  updateFireballs(dt) {
    for (const f of this.fireballs) {
      if (!f.alive) continue;
      f.update(this.level, dt);
      for (const e of this.enemies) {
        if (!e.alive) continue;
        if (Math.abs(e.body.x - f.body.x) < e.body.hw + f.body.hw &&
            Math.abs(e.body.y - f.body.y) < e.body.hh + f.body.hh) {
          e.alive = false;
          f.alive = false;
          this.emit('stomp', { kind: e.kind, byFire: true, x: e.body.x, y: e.body.y });
          break;
        }
      }
    }
    this.fireballs = this.fireballs.filter((f) => f.alive);
  }

  checkSpring() {
    const b = this.player.body;
    if (b.vy > 0) return;
    const ty = Math.floor(b.y - b.hh + 0.02);
    const xs = [Math.floor(b.x - b.hw + 0.02), Math.floor(b.x + b.hw - 0.02)];
    for (const tx of xs) {
      if (this.level.tileAt(tx, ty) === T.SPRING) {
        b.vy = 26;
        b.grounded = false;
        this.emit('spring');
        return;
      }
    }
  }

  updateEnemies(dt) {
    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (Math.abs(e.body.x - this.player.body.x) > 36) continue; // 屏幕外不更新
      e.update(this.level, dt);
    }

    // 被踢出的壳撞击其它敌人
    for (const e of this.enemies) {
      if (!e.alive || e.state !== 'kicked') continue;
      for (const o of this.enemies) {
        if (o === e || !o.alive) continue;
        if (overlap(e.body, o.body)) { o.alive = false; this.emit('stomp'); }
      }
    }
  }

  collectPickups() {
    const p = this.player.body;
    for (const g of this.level.pickups) {
      if (g.taken) continue;
      if (Math.abs(g.x - p.x) < 0.6 && Math.abs(g.y - p.y) < 0.8) {
        g.taken = true;
        this.gears++;
        this.emit('coin', { gears: this.gears });
      }
    }
  }

  touchEnemies(input) {
    const p = this.player;
    if (p.invuln > 0 || p.dead) return;
    const prevBottom = p.prev.y - p.body.hh;

    for (const e of this.enemies) {
      if (!e.alive) continue;
      if (!overlap(p.body, e.body)) continue;

      // 踩踏判定：正在下落，且上一帧脚底还在敌人重心之上
      const stomp = p.body.vy < 0 && prevBottom >= e.body.y - 0.05;
      if (stomp && e.canStomp) {
        const res = e.stomp(p.body.x);
        p.body.vy = input.jumpHeld ? P.stompBounceHeld : P.stompBounce;
        p.jumping = false;
        if (res === 'kill') this.emit('stomp', { kind: e.kind, x: e.body.x, y: e.body.y });
        else if (res === 'kick') this.emit('kick');
        else if (res === 'stop') this.emit('shell', { kind: e.kind });
        else this.emit('shell', { kind: e.kind });
        continue;
      }

      if (e.state === 'shell') {
        e.kick(p.body.x < e.body.x ? 1 : -1);
        this.emit('kick');
        continue;
      }

      this.hurt();
      if (p.dead) return;
    }
  }

  hurt() {
    const p = this.player;
    if (p.invuln > 0 || p.dead) return;
    this.cause = 'hit';
    this.emit('hurt');
    p.hurt();
    if (p.dead) this.kill();
  }

  kill() {
    const p = this.player;
    this.deaths++;
    this.emit('death', {
      deaths: this.deaths,
      cause: this.cause,
      x: p.prev.x,
      y: p.prev.y,
    });
    p.respawn(this.respawn.x, this.respawn.y);
    this.timeLeft = Math.max(this.timeLeft, 15);
  }

  checkpoints() {
    const p = this.player.body;
    for (const c of this.level.checkpoints) {
      if (c.on) continue;
      if (Math.abs(c.x - p.x) < 0.7 && Math.abs(c.y - p.y) < 1.6) {
        c.on = true;
        this.respawn = { x: c.x, y: c.y + 0.55 };
        this.emit('checkpoint');
      }
    }
  }

  checkGoal() {
    if (this.player.body.x > this.level.goal.x - 0.5) {
      this.ended = true;
      this.emit('clear', {
        gears: this.gears, total: this.level.pickups.length,
        deaths: this.deaths, time: Math.ceil(this.timeLeft),
      });
    }
  }
}
