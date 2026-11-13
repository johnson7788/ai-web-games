// src/game/enemies.js — 僵尸实体与 AI：GLB 骨骼动画（Idle/Walk/Run）+ 追击/攻击/倒地
// 所有活体动作都由 GLB 自带 clip 驱动，主循环里 inst.update(dt) 推进 AnimationMixer。
import * as THREE from "three";
import { GAME } from "config/game.config.js";

// tint 提亮 + glow 自发光：夜色 + 雾里靠材质色差才能看清四肢，纯暗剪影会让「在走」看不出来。
// speed 单位 m/s；原先 1.15m/s 在 27m 外等于屏幕上每秒 1 像素，看起来像滑行的立牌。
const TYPES = {
  shambler: { model: "teen-zombie-b5bb27", tint: 0xb7d2bd, glow: 0x31554a, hp: 2, speed: 1.70, damage: 8, scale: 1.0, score: 100 },
  runner:   { model: "villager-40255c",     tint: 0xd18d74, glow: 0x5a3527, hp: 2, speed: 3.15, damage: 10, scale: 0.98, score: 150 },
  brute:    { model: "ashigaru-foot-soldier-806707", tint: 0x9db4ac, glow: 0x2c403c, hp: 6, speed: 1.35, damage: 16, scale: 1.22, score: 260 },
  bloater:  { model: "teen-zombie-b5bb27", tint: 0xdda156, glow: 0x5a3c16, hp: 3, speed: 1.85, damage: 12, scale: 1.12, score: 220 },
  boss:     { model: "ashigaru-foot-soldier-806707", tint: 0xb46762, glow: 0x5a2422, hp: 16, speed: 1.45, damage: 22, scale: 1.85, score: 900 }
};

const HEAD = new THREE.Vector3(0, 1.48, 0);
let ENEMY_SEQ = 0;

class Enemy {
  constructor(inst, type, pos, level) {
    const def = TYPES[type] || TYPES.shambler;
    this.id = ++ENEMY_SEQ;
    this.inst = inst;
    this.type = type;
    this.def = def;
    this.object = inst.object;
    this.object.position.copy(pos);
    this.object.scale.setScalar(def.scale);
    this.hp = def.hp;
    this.maxHp = def.hp;
    this.speed = def.speed * (level?.enemySpeed || 1);
    this.damage = def.damage;
    this.score = def.score;
    this.state = "chase";
    this.attackCd = 0.6;
    this.dead = false;
    this.deadT = 0;
    this.wobble = Math.random() * Math.PI * 2;
    this.gaitPhase = Math.random() * Math.PI * 2;   // 每只错开步频，尸群不会齐步走
    this.gaitAmp = 0;
    this.faceFlip = false;
    this.weakOnly = type === "boss";

    // 骨骼 clip 只有旋转通道，20m 外四肢摆动不足 1px。给材质一点冷色自发光，
    // 把轮廓从雾色背景里拉出来；tint() 已克隆材质，这里改不会影响其他实例。
    const glow = new THREE.Color(def.glow || 0x31554a);
    this.object.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (m && m.emissive) { m.emissive.copy(glow); m.emissiveIntensity = 0.42; }
      }
    });

    // 头顶弱点核心：原创设定（不是原作红光的临摹），带自发光材质
    const core = new THREE.Mesh(
      new THREE.SphereGeometry(type === "boss" ? 0.16 : 0.075, 10, 8),
      new THREE.MeshBasicMaterial({ color: type === "boss" ? 0xffd05a : 0xff5a3c, transparent: true, opacity: 0.9 })
    );
    core.position.copy(HEAD).multiplyScalar(def.scale > 1.4 ? 1.08 : 1);
    core.name = "weakCore";
    this.object.add(core);
    this.core = core;
    if (inst.clips.length > 1) inst.play("Idle", { fade: 0 });
    inst.update(0);                    // 初始化 mixer，避免第一帧僵在绑定姿势

    // 取一根四肢骨骼做「真的在变形」的探针：动画只挂在 mixer 上但骨骼不动时，
    // action.time 仍会推进，只有量骨骼四元数才能区分「播了」和「看得见」。
    this.probeBone = null;
    this.object.traverse((o) => {
      if (!this.probeBone && o.isBone && /Leg|UpLeg|Hips|Spine/i.test(o.name)) this.probeBone = o;
    });
    if (!this.probeBone) this.object.traverse((o) => { if (!this.probeBone && o.isBone) this.probeBone = o; });
  }

  /** debug 契约：当前 clip / 时间 / 权重 / 骨骼探针四元数（全部用 three 公开 API） */
  animState() {
    const a = this.inst.current;
    const q = this.probeBone ? this.probeBone.quaternion : null;
    return {
      id: this.id, type: this.type, state: this.state, dead: this.dead,
      clip: a ? a.getClip().name : null,
      time: a ? Number(a.time.toFixed(3)) : 0,
      running: a ? a.isRunning() : false,
      weight: a ? Number(a.getEffectiveWeight().toFixed(2)) : 0,
      bone: q ? [q.x, q.y, q.z, q.w].map((v) => Number(v.toFixed(4))) : null,
      x: Number(this.object.position.x.toFixed(2)),
      z: Number(this.object.position.z.toFixed(2))
    };
  }

  /** 3D 没有水平 flip：朝向用 rotation.y；这里保留同名接口表达左右侧身 */
  setFacing(flip) {
    this.faceFlip = !!flip;
    if (this.core) this.core.position.x = flip ? -0.06 : 0.06;
  }

  faceTo(px, pz) {
    const dx = px - this.object.position.x;
    const dz = pz - this.object.position.z;
    this.object.rotation.y = Math.atan2(dx, dz);
    this.setFacing(dx < 0);
  }

  tick(dt, player, onAttack, animDt = dt) {
    // AnimationMixer 用真实时间：低帧率下 dt 被夹紧会让动画慢 3~4 倍，看起来像定格。
    // 位移与输入仍走夹紧 dt，两条时间源互不污染。
    this.inst.update(animDt);
    if (this.dead) {
      this.deadT += dt;
      if (this.inst.mixer) this.inst.mixer.timeScale = 0;   // 倒地后定格，别在原地继续踏步
      this.object.rotation.x = Math.min(Math.PI / 2, this.object.rotation.x + dt * 3.2);
      this.object.position.y = Math.max(-0.5, this.object.position.y - dt * 0.45);
      if (this.core) this.core.material.opacity = Math.max(0, 0.9 - this.deadT * 2);
      return;
    }
    this.wobble += dt * 2.2;
    const dx = player.x - this.object.position.x;
    const dz = player.z - this.object.position.z;
    const dist = Math.hypot(dx, dz);
    this.faceTo(player.x, player.z);
    if (dist > 1.55) {
      const v = this.speed * (1 + 0.08 * Math.sin(this.wobble));
      this.object.position.x += (dx / dist) * v * dt;
      this.object.position.z += (dz / dist) * v * dt;
      // 阈值必须高于 shambler 的速度抖动上沿，否则会在 Walk/Run 间来回 reset，动作反而僵住
      const want = v > 2.35 ? "Run" : "Walk";
      if (this.state !== want) { this.inst.play(want, { fade: 0.18 }); this.state = want; }

      // 父级步态叠加：骨骼 clip 负责迈腿/摆臂，这里补上整体上下颠 + 左右晃 + 前倾，
      // 让十几米外也能一眼看出「它在走」，同时把动画播放速率挂到实际速度上。
      this.gaitPhase += animDt * (3.2 + v * 2.1);
      const target = Math.min(1, v / 2.0);
      this.gaitAmp += (target - this.gaitAmp) * Math.min(1, animDt * 8);
      const s = Math.sin(this.gaitPhase);
      this.object.position.y = Math.abs(s) * 0.085 * this.gaitAmp;
      this.object.rotation.z = s * 0.075 * this.gaitAmp;
      this.object.rotation.x = (-0.07 + Math.sin(this.gaitPhase * 2) * 0.012) * this.gaitAmp;
      if (this.inst.mixer) this.inst.mixer.timeScale = 0.9 + 0.32 * this.gaitAmp;
    } else {
      if (this.state !== "attack") { this.inst.play("Idle", { fade: 0.15 }); this.state = "attack"; }
      // 贴脸攻击时收掉步态，站稳了再挥
      this.gaitAmp += (0 - this.gaitAmp) * Math.min(1, dt * 8);
      this.object.position.y = 0;
      this.object.rotation.z = 0;
      this.object.rotation.x = 0;
      if (this.inst.mixer) this.inst.mixer.timeScale = 1;
      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.attackCd = 1.15;
        onAttack(this.damage, this);
      }
    }
  }

  hurt(dmg) {
    if (this.dead) return false;
    this.hp -= dmg;
    if (this.hp <= 0) { this.dead = true; this.inst.play("Idle", { fade: 0.1 }); return true; }
    return false;
  }

  headPos() {
    const v = new THREE.Vector3(0, 1.48 * this.def.scale, 0);
    this.object.localToWorld(v);
    return v;
  }

  bodyPos() {
    const v = new THREE.Vector3(0, 0.9 * this.def.scale, 0);
    this.object.localToWorld(v);
    return v;
  }

  dispose() {
    try { this.inst.dispose(); } catch (_) { /* 忽略 */ }
  }
}

export class EnemyManager {
  constructor(pool, scene) {
    this.pool = pool;
    this.scene = scene;
    this.list = [];
    this.pending = 0;
  }

  get count() { return this.list.filter((e) => !e.dead).length + this.pending; }

  async spawn(type, pos, level) {
    const pool = this.pool;
    const def = TYPES[type] || TYPES.shambler;
    this.pending += 1;
    try {
      const inst = await pool.spawn(def.model, { clip: "Idle", tint: def.tint });
      inst.update(0);
      const e = new Enemy(inst, type, pos, level);
      this.scene.add(e.object);
      this.list.push(e);
      return e;
    } catch (err) {
      console.warn("[enemies] model spawn failed", err?.message || err);
      return null;
    } finally {
      this.pending -= 1;
    }
  }

  update(dt, player, onAttack, animDt = dt) {
    for (let i = this.list.length - 1; i >= 0; i -= 1) {
      const e = this.list[i];
      e.tick(dt, player, onAttack, animDt);
      if (e.dead && e.deadT > 1.7) { e.dispose(); this.list.splice(i, 1); }
    }
  }

  /** 屏幕投影 + 命中候选（准星是屏幕中心，hitscan 用横向容差） */
  candidates(renderer, tolerance) {
    this.scene.updateMatrixWorld(true);   // 投影前刷新世界矩阵，别拿上一帧姿势做判定
    const out = [];
    for (const e of this.list) {
      if (e.dead) continue;
      const head = renderer.project(e.headPos());
      const body = renderer.project(e.bodyPos());
      if (!head.visible || !body.visible) continue;
      const dist = Math.hypot(e.object.position.x - renderer.camera.position.x,
                              e.object.position.z - renderer.camera.position.z);
      const off = Math.abs(body.x - GAME.design.width / 2);
      if (dist < 52 && off < tolerance) {
        // 爆头必须「横向压得足够准」；只看纵坐标会让每发都算爆头，首领弱点机制就白设计了
        const headshot = Math.abs(head.x - GAME.design.width / 2) < 34 &&
                         Math.abs(head.y - GAME.design.height / 2) < 120;
        out.push({ enemy: e, head, body, dist, off, headshot });
      }
    }
    out.sort((a, b) => a.off - b.off || a.dist - b.dist);
    return out;
  }

  /** 助攻：清掉半径内的敌人（直接解围，值一次广告） */
  clearAround(pos, radius = 7) {
    let n = 0;
    for (const e of this.list) {
      if (e.dead) continue;
      if (Math.hypot(e.object.position.x - pos.x, e.object.position.z - pos.z) <= radius) {
        e.hurt(999);
        n += 1;
      }
    }
    return n;
  }

  clear() {
    for (const e of this.list) e.dispose();
    this.list = [];
    this.pending = 0;
  }
}
