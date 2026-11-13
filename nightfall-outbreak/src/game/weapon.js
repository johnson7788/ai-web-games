// src/game/weapon.js — 第一人称武器视图模型（原创 VK-7 卡宾枪，程序几何，不临摹原作枪模）
// 后坐力是弹簧衰减 + 枪口上跳；ADS 时移动到屏幕中心并收窄 FOV；走路有低频摆动。
import * as THREE from "three";

const mat = (color, rough = 0.55, metal = 0.45) =>
  new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal });

export class Weapon {
  constructor(camera) {
    this.camera = camera;
    this.group = new THREE.Group();
    this.group.rotation.order = "YXZ";
    camera.add(this.group);

    this.accent = mat(0x3d4a4e, 0.5, 0.6);
    this.body = mat(0x20282b, 0.62, 0.55);
    this.dark = mat(0x101719, 0.8, 0.3);
    this.metal = mat(0x8d9a9c, 0.34, 0.85);
    this.glove = mat(0xd9d7c8, 0.92, 0.02);
    this.skin = mat(0xc98d72, 0.9, 0.0);

    const box = (w, h, d, m, x, y, z, parent = this.group) => {
      const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m);
      o.position.set(x, y, z);
      o.castShadow = false;
      parent.add(o);
      return o;
    };
    const cyl = (r1, r2, len, m, x, y, z, rotZ = Math.PI / 2, parent = this.group) => {
      const o = new THREE.Mesh(new THREE.CylinderGeometry(r1, r2, len, 12), m);
      o.rotation.z = rotZ;
      o.position.set(x, y, z);
      parent.add(o);
      return o;
    };

    // 机匣 + 上导轨 + 光学瞄具
    box(0.105, 0.105, 0.42, this.body, 0, 0, -0.16);
    box(0.075, 0.028, 0.40, this.dark, 0, 0.064, -0.17);
    box(0.06, 0.045, 0.10, this.dark, 0, 0.095, -0.12);
    cyl(0.026, 0.026, 0.10, this.metal, 0, 0.095, -0.12, Math.PI / 2);
    // 枪管 / 消焰器 / 护木
    cyl(0.017, 0.017, 0.36, this.metal, 0, 0.005, -0.52);
    cyl(0.026, 0.022, 0.07, this.dark, 0, 0.005, -0.71);
    box(0.088, 0.078, 0.27, this.accent, 0, -0.012, -0.42);
    for (let i = 0; i < 5; i += 1) box(0.092, 0.008, 0.012, this.dark, 0, 0.028, -0.32 - i * 0.048);
    // 弹匣 / 握把 / 枪托
    const mag = box(0.068, 0.16, 0.075, this.accent, 0, -0.13, -0.13);
    mag.rotation.x = -0.16;
    const grip = box(0.062, 0.15, 0.075, this.dark, 0, -0.13, 0.02);
    grip.rotation.x = 0.28;
    box(0.085, 0.10, 0.22, this.body, 0, -0.02, 0.16);
    box(0.10, 0.13, 0.035, this.dark, 0, -0.02, 0.28);
    // 前握把 + 战术灯
    cyl(0.024, 0.024, 0.09, this.dark, 0.055, -0.075, -0.40, 0);
    cyl(0.018, 0.018, 0.05, this.metal, 0.06, -0.02, -0.56, Math.PI / 2);
    // 双手（白手套 + 前臂）
    const handL = new THREE.Mesh(new THREE.SphereGeometry(0.052, 12, 10), this.glove);
    handL.scale.set(1, 0.8, 1.25);
    handL.position.set(-0.045, -0.075, -0.40);
    this.group.add(handL);
    box(0.075, 0.075, 0.20, this.glove, -0.06, -0.105, -0.27);
    box(0.085, 0.085, 0.24, this.skin, -0.075, -0.135, -0.09);
    const handR = new THREE.Mesh(new THREE.SphereGeometry(0.055, 12, 10), this.glove);
    handR.scale.set(1, 0.85, 1.2);
    handR.position.set(0.012, -0.115, 0.02);
    this.group.add(handR);
    box(0.085, 0.085, 0.26, this.glove, 0.04, -0.155, 0.16);
    box(0.095, 0.095, 0.28, this.skin, 0.055, -0.19, 0.34);

    this.muzzle = new THREE.Object3D();
    this.muzzle.position.set(0, 0.005, -0.76);
    this.group.add(this.muzzle);

    this.base = new THREE.Vector3(0.30, -0.28, -0.60);
    this.adsPos = new THREE.Vector3(0.0, -0.135, -0.46);
    this.group.position.copy(this.base);
    this.recoil = 0;
    this.bob = 0;
    this.kick = 0;
    this.tint = null;
  }

  setTint(color) {
    this.tint = color;
    this.accent.color.set(color || 0x3d4a4e);
  }

  fire() {
    this.recoil = Math.min(1.4, this.recoil + 0.62);
    this.kick = 0.055;
  }

  update(dt, { ads = false, moving = 0, yawDelta = 0 } = {}) {
    this.bob += dt * (6 + moving * 5);
    const p = ads ? this.adsPos : this.base;
    const k = Math.min(1, dt * 13);
    this.group.position.x += (p.x - this.group.position.x) * k;
    this.group.position.y += (p.y - this.group.position.y) * k + Math.sin(this.bob) * 0.0022 * moving;
    this.group.position.z += (p.z - this.group.position.z) * k + this.recoil * 0.06;
    this.recoil = Math.max(0, this.recoil - dt * 6.4);
    this.kick = Math.max(0, this.kick - dt * 0.55);
    this.group.rotation.x = -this.recoil * 0.105 - this.kick;
    this.group.rotation.y = Math.max(-0.09, Math.min(0.09, -yawDelta * 2.2)) + Math.sin(this.bob * 0.5) * 0.006 * moving;
    this.group.rotation.z = (ads ? 0 : 0.035) + Math.sin(this.bob) * 0.008 * moving;
  }

  muzzleWorld() {
    const v = new THREE.Vector3();
    this.muzzle.getWorldPosition(v);
    return v;
  }
}
