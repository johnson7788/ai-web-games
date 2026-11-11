// 玩家：输入意图 → 速度 / 跳跃；状态机（小 / 大 / 火）。纯逻辑。
import { P, CONFIG } from '../../config/game.config.js';
import { makeBody, stepBody } from './physics.js';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const toward = (v, target, step) => (v < target ? Math.min(v + step, target) : Math.max(v - step, target));

export class Player {
  constructor(spawn) {
    this.spawn = { x: spawn.x, y: spawn.y + CONFIG.player.h / 2 };
    this.body = makeBody({
      x: this.spawn.x, y: this.spawn.y,
      w: CONFIG.player.w, h: CONFIG.player.h,
    });
    this.prev = { x: this.body.x, y: this.body.y };
    this.state = 'small';
    this.facing = 1;
    this.coyote = 0;
    this.buffer = 0;
    this.jumping = false;
    this.invuln = 0;
    this.dead = false;
    this.events = [];
    this.fireCooldown = 0;
  }

  /** @param {{left?:boolean,right?:boolean,jumpPressed?:boolean,jumpHeld?:boolean,run?:boolean}} input */
  update(input, level, dt) {
    this.prev.x = this.body.x;
    this.prev.y = this.body.y;

    const b = this.body;
    if (this.invuln > 0) this.invuln = Math.max(0, this.invuln - dt);
    if (this.fireCooldown > 0) this.fireCooldown = Math.max(0, this.fireCooldown - dt);
    if (input.jumpPressed) this.buffer = P.buffer;
    else this.buffer = Math.max(0, this.buffer - dt);

    // ---- 水平
    const dir = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const max = input.run ? P.runMax : P.walkMax;
    if (dir !== 0) {
      const turning = Math.sign(b.vx) !== 0 && Math.sign(b.vx) !== dir;
      const rate = !b.grounded ? P.airAccel : turning ? P.skid : P.groundAccel;
      b.vx = toward(b.vx, dir * max, rate * dt);
      this.facing = dir;
    } else if (b.grounded) {
      b.vx = toward(b.vx, 0, P.friction * dt);
    }
    if (!b.grounded && dir === 0) b.vx = toward(b.vx, 0, P.airAccel * 0.15 * dt);

    // ---- 起跳（缓冲 + 土狼）
    if (this.buffer > 0 && (b.grounded || this.coyote > 0)) {
      b.vy = P.jumpVel;
      this.buffer = 0;
      this.coyote = 0;
      this.jumping = true;
      this.events.push('jump');
    }

    // ---- 可变跳跃高度：松手截断上升
    if (this.jumping && !input.jumpHeld && b.vy > 0) {
      b.vy *= P.jumpCut;
      this.jumping = false;
    }
    if (b.vy <= 0) this.jumping = false;

    // ---- 积分 + 碰撞
    stepBody(b, level, dt);

    // ---- 落地缓冲：落地当帧吃到之前的按键
    if (b.grounded && this.buffer > 0 && this.buffer < P.buffer) {
      b.vy = P.jumpVel;
      this.buffer = 0;
      this.jumping = true;
    }

    // ---- 土狼计时
    this.coyote = b.grounded ? P.coyote : Math.max(0, this.coyote - dt);

    if (b.y < -3) this.dead = true;
  }

  hurt() {
    if (this.invuln > 0 || this.dead) return;
    if (this.state === 'small') { this.dead = true; return; }
    this.state = this.state === 'fire' ? 'big' : 'small';
    this.setHeight(this.state === 'small' ? CONFIG.player.h : CONFIG.player.bigH);
    this.invuln = P.invuln;
  }

  /** 道具升级：蘑菇变大、火油灯进入火焰形态 */
  powerUp(kind) {
    if (kind === 'fire') {
      if (this.state === 'small') this.grow();
      this.state = 'fire';
      this.invuln = Math.max(this.invuln, 0.3);
      return true;
    }
    return this.grow();
  }

  /** 变大：脚底不动，向上长 */
  grow() {
    if (this.state !== 'small') return false;
    this.state = 'big';
    this.setHeight(CONFIG.player.bigH, true);
    this.invuln = 0.5;
    return true;
  }

  setHeight(h, keepFeet = false) {
    const bottom = this.body.y - this.body.hh;
    this.body.hh = h / 2;
    this.body.y = keepFeet ? bottom + this.body.hh : this.body.y;
  }

  respawn(x, y) {
    this.body.x = x;
    this.body.y = y;
    this.body.vx = 0;
    this.body.vy = 0;
    this.dead = false;
    this.invuln = 0.6;
  }

  get left() { return this.body.x - this.body.hw; }
  get bottom() { return this.body.y - this.body.hh; }
}
