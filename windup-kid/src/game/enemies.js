// 敌人逻辑：甲虫 / 壳怪（含缩壳、踢壳）。纯数据，不碰渲染。
import { makeBody, stepBody } from './physics.js';

export const SPEC = {
  E: { kind: 'beetle', w: 0.72, h: 0.62, speed: 1.9, canStomp: true },
  K: { kind: 'shell', w: 0.72, h: 0.78, speed: 1.4, canStomp: true },
  M: { kind: 'moth', w: 0.6, h: 0.5, speed: 1.2, canStomp: false },
  T: { kind: 'turret', w: 0.8, h: 0.8, speed: 0, canStomp: false },
};

export class Enemy {
  constructor(def) {
    const s = SPEC[def.type] ?? SPEC.E;
    this.kind = s.kind;
    this.canStomp = s.canStomp;
    this.type = def.type;
    this.baseY = def.y;
    this.phase = (def.x * 1.7) % (Math.PI * 2);
    this.dir = -1;
    this.speed = s.speed;
    this.alive = true;
    this.state = 'walk';           // walk | shell | kicked | squashed
    this.body = makeBody({
      x: def.x, y: def.y, w: s.w, h: s.h, vx: -s.speed,
    });
  }

  get top() { return this.body.y + this.body.hh; }
  get left() { return this.body.x - this.body.hw; }

  update(level, dt) {
    if (!this.alive) return;
    const b = this.body;

    if (this.kind === 'moth') {
      this.phase += dt * 2.4;
      b.y = this.baseY + Math.sin(this.phase) * 1.1;
      b.x += this.dir * this.speed * dt;
      if (level.isSolid(Math.floor(b.x + this.dir * b.hw), Math.floor(b.y))) this.dir *= -1;
      return;
    }

    if (this.state === 'shell') { b.vx = 0; return; }

    const vx = this.state === 'kicked' ? this.kickedSpeed * this.dir : this.speed * this.dir;
    b.vx = vx;
    stepBody(b, level, dt);

    if (this.state === 'kicked') {
      if (b.vx === 0) { this.dir *= -1; this.kickedSpeed = Math.abs(this.kickedSpeed); } // 撞墙反弹
      // 踢出的壳会掉下去
      if (b.y < -5) this.alive = false;
      return;
    }

    // 撞墙 / 走到悬崖边 → 转身
    if (b.vx === 0) this.dir *= -1;
    else if (b.grounded) {
      const footX = b.x + this.dir * (b.hw + 0.12);
      if (!level.isSolid(Math.floor(footX), Math.floor(b.y - b.hh - 0.05))) this.dir *= -1;
    }
  }

  stomp(fromX) {
    // 踢出的壳：踩住 = 停下
    if (this.state === 'kicked') {
      this.state = 'shell';
      this.body.vx = 0;
      return 'stop';
    }
    // 第一次踩壳怪：缩壳
    if (this.kind === 'shell' && this.state === 'walk') {
      this.state = 'shell';
      this.body.hh = 0.25;
      this.body.y = this.body.y - 0.78 / 2 + 0.25; // 缩壳：贴地
      return 'shell';
    }
    // 再踩静止的壳：按马里奥的手感踢出去
    if (this.state === 'shell') {
      this.kick(fromX < this.body.x ? 1 : -1);
      return 'kick';
    }
    this.alive = false;
    return 'kill';
  }

  kick(dir) {
    this.state = 'kicked';
    this.dir = dir;
    this.kickedSpeed = 9;
  }
}
