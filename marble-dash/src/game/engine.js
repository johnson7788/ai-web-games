// Marble Dash — original three.js scene: neon dusk sky, glass marble, particles.
import * as THREE from 'three';
import { buildLevel } from './levels.js';
import { glowTexture, skyTexture, trackTopTexture, chevronTexture, hazardTexture, ringTexture } from './textures.js';

const MAX_PARTICLES = 900;
const _v = new THREE.Vector3();
const _v2 = new THREE.Vector3();
const _q = new THREE.Quaternion();

export class Engine {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;

    this.scene = new THREE.Scene();
    this.scene.background = skyTexture();
    this.scene.fog = new THREE.Fog(0x241243, 34, 105);

    this.camera = new THREE.PerspectiveCamera(58, 1, 0.1, 260);
    this.camera.position.set(0, 12, 22);

    this.board = new THREE.Group();
    this.scene.add(this.board);

    this.tex = {
      glow: glowTexture(),
      trackTop: trackTopTexture(),
      chev: chevronTexture('#ffd75e'),
      chevAmber: chevronTexture('#ffb347', 'rgba(28,20,48,0.95)'),
      hazard: hazardTexture(),
      ring: ringTexture('#5eead4'),
      ringCyan: ringTexture('#7dd3fc'),
    };

    this._lights();
    this._environment();
    this._sky();
    this._ball();
    this._particles();
    this._trail();

    this.rt = null;
    this.shake = 0;
    this.attract = true;
    this.attractAngle = 0.6;
    this.camPos = new THREE.Vector3(0, 12, 22);
    this.camLook = new THREE.Vector3(0, 0, -10);
    this.clockT = 0;
    this.resize();
  }

  _lights() {
    this.hemi = new THREE.HemisphereLight(0x8f7bd8, 0x2a1548, 0.85);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffe9d2, 2.1);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    this.sun.shadow.camera.left = -16; this.sun.shadow.camera.right = 16;
    this.sun.shadow.camera.top = 16; this.sun.shadow.camera.bottom = -16;
    this.sun.shadow.camera.near = 1; this.sun.shadow.camera.far = 60;
    this.sun.shadow.bias = -0.002;
    this.scene.add(this.sun);
    this.scene.add(this.sun.target);
    const rim = new THREE.DirectionalLight(0x6d8cff, 0.55);
    rim.position.set(-10, 6, -14);
    this.scene.add(rim);
  }

  // procedural environment map for the glass marble reflections
  _environment() {
    const envScene = new THREE.Scene();
    const skyG = new THREE.SphereGeometry(50, 16, 12);
    const skyM = new THREE.MeshBasicMaterial({ map: skyTexture(), side: THREE.BackSide });
    envScene.add(new THREE.Mesh(skyG, skyM));
    const panelG = new THREE.PlaneGeometry(18, 10);
    const panels = [
      { c: 0xffffff, p: [0, 22, -18], r: [0.5, 0, 0] },
      { c: 0x9fd8ff, p: [-24, 8, 10], r: [0, 1.2, 0] },
      { c: 0xffb3d9, p: [24, 4, 12], r: [0, -1.2, 0] },
    ];
    for (const d of panels) {
      const m = new THREE.Mesh(panelG, new THREE.MeshBasicMaterial({ color: d.c, side: THREE.DoubleSide }));
      m.position.set(...d.p); m.rotation.set(...d.r);
      envScene.add(m);
    }
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    this.envMap = pmrem.fromScene(envScene, 0.06).texture;
    pmrem.dispose();
    skyG.dispose(); skyM.dispose(); panelG.dispose();
    envScene.traverse((o) => { if (o.material) o.material.dispose(); });
  }

  _sky() {
    // stars
    const n = 650;
    const pos = new Float32Array(n * 3);
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) {
      const r = 100 + Math.random() * 60;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 0.85 + 0.05);
      pos[i * 3] = r * Math.sin(ph) * Math.cos(th);
      pos[i * 3 + 1] = r * Math.cos(ph) * 0.7 + 8;
      pos[i * 3 + 2] = r * Math.sin(ph) * Math.sin(th);
      const b = 0.4 + Math.random() * 0.6;
      const tint = Math.random();
      col[i * 3] = b * (tint > 0.7 ? 1 : 0.8);
      col[i * 3 + 1] = b * 0.85;
      col[i * 3 + 2] = b;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const m = new THREE.PointsMaterial({ size: 0.7, vertexColors: true, transparent: true, opacity: 0.9, fog: false, sizeAttenuation: true, depthWrite: false });
    this.stars = new THREE.Points(g, m);
    this.scene.add(this.stars);

    // distant floating islands
    this.islands = [];
    const rockMat = new THREE.MeshStandardMaterial({ color: 0x2c2154, roughness: 1, flatShading: true });
    const neonColors = [0x22d3ee, 0xf472b6, 0xa78bfa, 0x5eead4, 0xfbbf24];
    for (let i = 0; i < 10; i++) {
      const grp = new THREE.Group();
      const a = (i / 10) * Math.PI * 2 + Math.random() * 0.5;
      const r = 42 + Math.random() * 38;
      const s = 2 + Math.random() * 4;
      const topG = new THREE.BoxGeometry(s, 0.8, s * (0.6 + Math.random() * 0.6));
      const top = new THREE.Mesh(topG, rockMat);
      grp.add(top);
      const coneG = new THREE.ConeGeometry(s * 0.42, s * 1.4, 5);
      const cone = new THREE.Mesh(coneG, rockMat);
      cone.rotation.x = Math.PI; cone.position.y = -s * 0.7;
      grp.add(cone);
      const edgeG = new THREE.BoxGeometry(s + 0.1, 0.1, s * 0.6 + 0.1);
      const edge = new THREE.Mesh(edgeG, new THREE.MeshBasicMaterial({ color: neonColors[i % neonColors.length] }));
      edge.position.y = 0.42;
      grp.add(edge);
      grp.position.set(Math.cos(a) * r, -10 + Math.random() * 18, Math.sin(a) * r - 20);
      grp.rotation.y = Math.random() * Math.PI;
      this.scene.add(grp);
      this.islands.push({ grp, baseY: grp.position.y, ph: Math.random() * 6 });
    }

    // faint void grid far below
    const grid = new THREE.GridHelper(240, 48, 0x5b3f9e, 0x33245e);
    grid.position.y = -27;
    grid.material.transparent = true;
    grid.material.opacity = 0.3;
    this.scene.add(grid);
  }

  _ball() {
    this.ballGroup = new THREE.Group();
    const glassG = new THREE.SphereGeometry(0.5, 36, 26);
    const glassM = new THREE.MeshPhysicalMaterial({
      color: 0xd6ecff, metalness: 0, roughness: 0.06,
      transparent: true, opacity: 0.52,
      clearcoat: 1, clearcoatRoughness: 0.08,
      envMap: this.envMap, envMapIntensity: 2.2,
      ior: 1.45, reflectivity: 0.9,
    });
    this.glass = new THREE.Mesh(glassG, glassM);
    this.glass.castShadow = true;
    this.ballGroup.add(this.glass);
    // swirl core so rotation is readable
    const coreG = new THREE.TorusKnotGeometry(0.17, 0.055, 60, 8);
    const coreM = new THREE.MeshStandardMaterial({ color: 0x67e8f9, emissive: 0x0ea5e9, emissiveIntensity: 1.4, roughness: 0.3 });
    this.core = new THREE.Mesh(coreG, coreM);
    this.ballGroup.add(this.core);
    const core2G = new THREE.IcosahedronGeometry(0.1, 0);
    const core2M = new THREE.MeshStandardMaterial({ color: 0xf9a8d4, emissive: 0xec4899, emissiveIntensity: 1.2 });
    const core2 = new THREE.Mesh(core2G, core2M);
    core2.position.set(0.14, 0.1, -0.08);
    this.ballGroup.add(core2);
    // specular highlight billboard
    this.ballHighlight = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0xffffff, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ballHighlight.scale.set(0.34, 0.34, 1);
    this.ballHighlight.position.set(-0.16, 0.2, 0.3);
    this.ballGroup.add(this.ballHighlight);
    // soft under-glow
    this.ballGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0x7dd3fc, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    this.ballGlow.scale.set(1.9, 1.9, 1);
    this.ballGroup.add(this.ballGlow);
    this.board.add(this.ballGroup);
    this.ballQuat = new THREE.Quaternion();
  }

  _particles() {
    this.pPos = new Float32Array(MAX_PARTICLES * 3);
    this.pCol = new Float32Array(MAX_PARTICLES * 3);
    this.pVel = new Float32Array(MAX_PARTICLES * 3);
    this.pLife = new Float32Array(MAX_PARTICLES);
    this.pMax = new Float32Array(MAX_PARTICLES);
    this.pGrav = new Float32Array(MAX_PARTICLES);
    this.pBase = new Float32Array(MAX_PARTICLES * 3);
    for (let i = 0; i < MAX_PARTICLES; i++) this.pPos[i * 3 + 1] = -9999;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pPos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.pCol, 3));
    const m = new THREE.PointsMaterial({ size: 0.34, map: this.tex.glow, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true });
    this.points = new THREE.Points(g, m);
    this.points.frustumCulled = false;
    this.board.add(this.points);
    this.pCursor = 0;
  }

  burst(x, y, z, colors, count, speed, opts = {}) {
    const grav = opts.grav ?? 12, life = opts.life ?? 0.75;
    const cs = Array.isArray(colors) ? colors : [colors];
    const c = new THREE.Color();
    for (let k = 0; k < count; k++) {
      const i = this.pCursor; this.pCursor = (this.pCursor + 1) % MAX_PARTICLES;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(Math.random() * 2 - 1);
      const sp = speed * (0.35 + Math.random() * 0.65);
      this.pPos[i * 3] = x; this.pPos[i * 3 + 1] = y; this.pPos[i * 3 + 2] = z;
      this.pVel[i * 3] = Math.sin(ph) * Math.cos(th) * sp;
      this.pVel[i * 3 + 1] = Math.abs(Math.cos(ph)) * sp * (opts.up ?? 0.9) + (opts.upBias ?? 0);
      this.pVel[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * sp;
      c.set(cs[(Math.random() * cs.length) | 0]);
      this.pBase[i * 3] = c.r; this.pBase[i * 3 + 1] = c.g; this.pBase[i * 3 + 2] = c.b;
      this.pCol[i * 3] = c.r; this.pCol[i * 3 + 1] = c.g; this.pCol[i * 3 + 2] = c.b;
      this.pLife[i] = this.pMax[i] = life * (0.6 + Math.random() * 0.6);
      this.pGrav[i] = grav;
    }
  }

  _trail() {
    this.trail = [];
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.tex.glow, color: 0x7dd3fc, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false }));
      s.scale.set(0.8, 0.8, 1);
      s.visible = false;
      this.board.add(s);
      this.trail.push({ s, life: 0 });
    }
    this.trailCursor = 0;
    this.trailTimer = 0;
  }

  loadLevel(def) {
    if (this.rt) { this.board.remove(this.rt.group); this.rt.dispose(); }
    this.rt = buildLevel(def, this.tex);
    this.board.add(this.rt.group);
    // reset particles
    for (let i = 0; i < MAX_PARTICLES; i++) { this.pLife[i] = 0; this.pPos[i * 3 + 1] = -9999; }
    return this.rt;
  }

  setBall(pos, quat) {
    this.ballGroup.position.copy(pos);
    if (quat) this.ballGroup.quaternion.copy(quat);
  }

  update(dt, phys, phase) {
    this.clockT += dt;
    const t = this.clockT;
    const rt = this.rt;

    // board tilt
    if (phys) {
      this.board.rotation.set(phys.pitch, 0, phys.roll, 'XYZ');
    }

    // level animations
    if (rt) {
      for (const m of rt.movers) {
        m.mesh.position.set(m.px, -0.35, m.pz);
        m.edges.position.set(m.px, 0, m.pz);
        m.glow.position.set(m.px, -0.9, m.pz);
      }
      for (const s of rt.spinners) s.group.rotation.y = s.angle;
      for (const g of rt.gems) {
        if (g.taken) { g.mesh.visible = false; g.glow.visible = false; continue; }
        g.mesh.rotation.y = t * 1.8 + g.phase;
        g.mesh.rotation.x = Math.sin(t * 1.2 + g.phase) * 0.3;
        const by = g.y + Math.sin(t * 2.2 + g.phase) * 0.12;
        g.mesh.position.y = by;
        g.glow.position.y = by;
        g.glow.material.opacity = 0.45 + Math.sin(t * 3 + g.phase) * 0.18;
      }
      for (const b of rt.bumpers) {
        b.flash = Math.max(0, b.flash - dt * 3);
        const s = 1 + b.flash * 0.3;
        b.mesh.scale.set(s, 1 + b.flash * 0.2, s);
        b.mat.emissiveIntensity = 0.9 + b.flash * 2.4;
      }
      for (const a of rt.anim) {
        if (a.type === 'boost') a.mat.opacity = 0.7 + Math.sin(t * 5) * 0.25;
      }
      if (rt.goalVisual) {
        const gv = rt.goalVisual;
        gv.beaconMat.opacity = 0.1 + Math.sin(t * 2.4) * 0.045;
        gv.glow.material.opacity = 0.6 + Math.sin(t * 2.4) * 0.2;
        gv.ring.rotation.z = t * 0.8;
        const s = 1 + Math.sin(t * 2.4) * 0.05;
        gv.ring.scale.set(s, s, 1);
      }
    }

    // particles
    let any = false;
    for (let i = 0; i < MAX_PARTICLES; i++) {
      if (this.pLife[i] <= 0) continue;
      any = true;
      this.pLife[i] -= dt;
      if (this.pLife[i] <= 0) { this.pPos[i * 3 + 1] = -9999; this.pCol[i * 3] = this.pCol[i * 3 + 1] = this.pCol[i * 3 + 2] = 0; continue; }
      this.pVel[i * 3 + 1] -= this.pGrav[i] * dt;
      this.pPos[i * 3] += this.pVel[i * 3] * dt;
      this.pPos[i * 3 + 1] += this.pVel[i * 3 + 1] * dt;
      this.pPos[i * 3 + 2] += this.pVel[i * 3 + 2] * dt;
      const f = this.pLife[i] / this.pMax[i];
      this.pCol[i * 3] = this.pBase[i * 3] * f;
      this.pCol[i * 3 + 1] = this.pBase[i * 3 + 1] * f;
      this.pCol[i * 3 + 2] = this.pBase[i * 3 + 2] * f;
    }
    if (any) {
      this.points.geometry.attributes.position.needsUpdate = true;
      this.points.geometry.attributes.color.needsUpdate = true;
    }

    // trail
    this.trailTimer -= dt;
    if (phys && phase === 'playing') {
      const sp = Math.hypot(phys.vel.x, phys.vel.z);
      if (sp > 6.5 && this.trailTimer <= 0) {
        this.trailTimer = 0.03;
        const tr = this.trail[this.trailCursor]; this.trailCursor = (this.trailCursor + 1) % this.trail.length;
        tr.s.position.copy(phys.pos);
        tr.s.visible = true;
        tr.life = 0.38;
      }
    }
    for (const tr of this.trail) {
      if (tr.life <= 0) continue;
      tr.life -= dt;
      if (tr.life <= 0) { tr.s.visible = false; tr.s.material.opacity = 0; continue; }
      const f = tr.life / 0.38;
      tr.s.material.opacity = f * 0.4;
      const s = 0.5 + f * 0.5;
      tr.s.scale.set(s, s, 1);
    }

    // islands bob
    for (const isl of this.islands) isl.grp.position.y = isl.baseY + Math.sin(t * 0.4 + isl.ph) * 0.8;
    this.stars.rotation.y = t * 0.004;

    // camera
    this.ballGroup.getWorldPosition(_v);
    if (this.attract) {
      this.attractAngle += dt * 0.1;
      const r = 25, cz = -14;
      _v2.set(Math.sin(this.attractAngle) * r, 13 + Math.sin(t * 0.3) * 1.5, cz + Math.cos(this.attractAngle) * r);
      this.camPos.lerp(_v2, Math.min(1, 2.2 * dt));
      _v2.set(0, 0, cz);
      this.camLook.lerp(_v2, Math.min(1, 2.2 * dt));
    } else {
      _v2.copy(_v).add(new THREE.Vector3(0, 6.9, 9.4));
      this.camPos.lerp(_v2, Math.min(1, 4.8 * dt));
      _v2.copy(_v).add(new THREE.Vector3(0, 0.4, -2.6));
      this.camLook.lerp(_v2, Math.min(1, 6 * dt));
    }
    this.shake = Math.max(0, this.shake - dt * 2.2);
    const sh = this.shake * this.shake;
    this.camera.position.set(
      this.camPos.x + (Math.random() - 0.5) * sh,
      this.camPos.y + (Math.random() - 0.5) * sh,
      this.camPos.z + (Math.random() - 0.5) * sh
    );
    this.camera.lookAt(this.camLook);

    // shadow frustum follows the ball
    this.sun.position.set(_v.x + 9, _v.y + 16, _v.z + 7);
    this.sun.target.position.copy(_v);
    this.sun.target.updateMatrixWorld();

    this.renderer.render(this.scene, this.camera);
  }

  addShake(a) { this.shake = Math.min(1.2, this.shake + a); }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
}