// 道具：弹簧发条（变大）。纯逻辑。
import { makeBody, stepBody } from './physics.js';

export class Mushroom {
  constructor(x, y) {
    this.kind = 'mushroom';
    this.alive = true;
    this.dir = 1;
    this.speed = 2.2;
    this.body = makeBody({ x, y, w: 0.6, h: 0.6, vx: this.speed });
    this.born = 0;               // 出生后先上升一小段，再开始走
  }

  update(level, dt) {
    if (!this.alive) return;
    const b = this.body;
    this.born += dt;
    if (this.born < 0.35) { b.vy = 3.2; stepBody(b, level, dt); return; }

    b.vx = this.dir * this.speed;
    stepBody(b, level, dt);
    if (b.vx === 0) this.dir *= -1;
    else if (b.grounded) {
      const footX = b.x + this.dir * (b.hw + 0.1);
      if (!level.isSolid(Math.floor(footX), Math.floor(b.y - b.hh - 0.05))) this.dir *= -1;
    }
    if (b.y < -4) this.alive = false;
  }
}


/** 火油灯：顶出来之后落地待着，吃到变成火焰形态 */
export class Flower {
  constructor(x, y) {
    this.kind = 'flower';
    this.alive = true;
    this.born = 0;
    this.body = makeBody({ x, y, w: 0.6, h: 0.6 });
  }

  update(level, dt) {
    if (!this.alive) return;
    this.born += dt;
    if (this.born < 0.4) this.body.vy = 3.4;
    stepBody(this.body, level, dt);
    if (this.body.grounded) this.body.vy = 0;
    if (this.body.y < -4) this.alive = false;
  }
}

/** 火球：贴地弹跳，撞墙反向，命中敌人或到时消失 */
export class Fireball {
  constructor(x, y, dir) {
    this.kind = 'fireball';
    this.dir = dir;
    this.alive = true;
    this.life = 2.6;
    this.speed = 8.5;
    this.body = makeBody({ x, y, w: 0.3, h: 0.3, vx: dir * this.speed });
  }

  update(level, dt) {
    if (!this.alive) return;
    this.life -= dt;
    if (this.life <= 0) { this.alive = false; return; }
    const b = this.body;
    b.vx = this.dir * this.speed;
    stepBody(b, level, dt);
    if (b.vx === 0) { this.dir *= -1; b.vx = this.dir * this.speed; }
    if (b.grounded) { b.vy = 7.4; b.grounded = false; }
    if (b.y < -4) this.alive = false;
  }
}
