import * as THREE from 'three';
import Game from '../../Game.class';
import { makeGridTexture, makeGlowSprite } from './Visuals';

export const ARENA_HALF = 21;

/**
 * Arena — the neon void arena: procedural grid floor, glowing boundary
 * walls, corner pillars, center rings and a drifting starfield.
 */
export default class Arena {
  constructor() {
    this.game = Game.getInstance();
    this.scene = this.game.scene;
    this.group = new THREE.Group();
    this.scene.add(this.group);

    this.scene.background = new THREE.Color(0x030412);
    this.scene.fog = new THREE.FogExp2(0x030412, 0.014);

    this._buildFloor();
    this._buildWalls();
    this._buildCenter();
    this._buildStars();
    this._buildLights();
  }

  _buildFloor() {
    const tex = makeGridTexture();
    const size = ARENA_HALF * 2 + 2;
    const mat = new THREE.MeshStandardMaterial({
      map: tex,
      emissive: 0x00f0ff,
      emissiveMap: tex,
      emissiveIntensity: 0.32,
      roughness: 0.82,
      metalness: 0.25,
    });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    floor.rotation.x = -Math.PI / 2;
    this.group.add(floor);

    // outer void plane (dark, catches fog)
    const outer = new THREE.Mesh(
      new THREE.PlaneGeometry(300, 300),
      new THREE.MeshBasicMaterial({ color: 0x02030a }),
    );
    outer.rotation.x = -Math.PI / 2;
    outer.position.y = -0.06;
    this.group.add(outer);
  }

  _buildWalls() {
    const H = ARENA_HALF;
    const wallMat = new THREE.MeshStandardMaterial({
      color: 0x0a1030,
      emissive: 0x00f0ff,
      emissiveIntensity: 0.55,
      roughness: 0.4,
      metalness: 0.6,
      transparent: true,
      opacity: 0.92,
    });
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x7ff3ff });
    const len = H * 2 + 0.6;
    const specs = [
      { p: [0, 0.7, -H - 0.3], s: [len, 1.4, 0.3] },
      { p: [0, 0.7, H + 0.3], s: [len, 1.4, 0.3] },
      { p: [-H - 0.3, 0.7, 0], s: [0.3, 1.4, len] },
      { p: [H + 0.3, 0.7, 0], s: [0.3, 1.4, len] },
    ];
    for (const { p, s } of specs) {
      const wall = new THREE.Mesh(new THREE.BoxGeometry(...s), wallMat);
      wall.position.set(...p);
      this.group.add(wall);
      const edge = new THREE.Mesh(
        new THREE.BoxGeometry(s[0] === 0.3 ? 0.34 : s[0], 0.06, s[2] === 0.3 ? 0.34 : s[2]),
        edgeMat,
      );
      edge.position.set(p[0], 1.42, p[2]);
      this.group.add(edge);
    }

    // corner pillars
    const pillarMat = new THREE.MeshStandardMaterial({
      color: 0x20061a,
      emissive: 0xff2d95,
      emissiveIntensity: 1.1,
      roughness: 0.35,
      metalness: 0.5,
    });
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.46, 3.4, 6), pillarMat);
        pillar.position.set(sx * H, 1.7, sz * H);
        this.group.add(pillar);
        const glow = makeGlowSprite(0xff2d95, 3.4, 0.5);
        glow.position.set(sx * H, 3.4, sz * H);
        this.group.add(glow);
      }
    }
  }

  _buildCenter() {
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f0ff, transparent: true, opacity: 0.8 });
    const ring = new THREE.Mesh(new THREE.TorusGeometry(4, 0.06, 8, 72), ringMat);
    ring.rotation.x = -Math.PI / 2;
    ring.position.y = 0.03;
    this.group.add(ring);

    const ring2 = new THREE.Mesh(
      new THREE.TorusGeometry(1.3, 0.05, 8, 48),
      new THREE.MeshBasicMaterial({ color: 0xff2d95, transparent: true, opacity: 0.85 }),
    );
    ring2.rotation.x = -Math.PI / 2;
    ring2.position.y = 0.03;
    this.group.add(ring2);
    this.centerRing = ring2;
  }

  _buildStars() {
    const N = 420;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const r = 60 + Math.random() * 50;
      const theta = Math.random() * Math.PI * 2;
      const y = 4 + Math.random() * 55;
      pos[i * 3] = Math.cos(theta) * r;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = Math.sin(theta) * r;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x9fd8ff,
      size: 0.55,
      transparent: true,
      opacity: 0.75,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      sizeAttenuation: true,
    });
    this.stars = new THREE.Points(geo, mat);
    this.group.add(this.stars);
  }

  _buildLights() {
    this.scene.add(new THREE.HemisphereLight(0x2a4a8a, 0x05060f, 0.85));
    const dir = new THREE.DirectionalLight(0xbfe8ff, 1.1);
    dir.position.set(12, 24, 10);
    this.scene.add(dir);
    const p1 = new THREE.PointLight(0xff2d95, 60, 70, 1.8);
    p1.position.set(-17, 7, -17);
    this.scene.add(p1);
    const p2 = new THREE.PointLight(0x00f0ff, 60, 70, 1.8);
    p2.position.set(17, 7, 17);
    this.scene.add(p2);
  }

  update(elapsed) {
    this.stars.rotation.y = elapsed * 0.008;
    this.centerRing.rotation.z = elapsed * 0.4;
    const s = 1 + Math.sin(elapsed * 1.6) * 0.06;
    this.centerRing.scale.setScalar(s);
  }
}