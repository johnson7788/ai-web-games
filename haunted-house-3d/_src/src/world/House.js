import * as THREE from 'three';
import * as TX from './Textures.js';

export const WALL_H = 3;
export const BOUNDS = { minX: -10, maxX: 10, minZ: -8, maxZ: 8 };

export const ZONES = {
  living:  { minX: -10, maxX: -3, minZ: 2, maxZ: 8 },
  foyer:   { minX: -3, maxX: 3, minZ: 2, maxZ: 8 },
  dining:  { minX: 3, maxX: 10, minZ: 2, maxZ: 8 },
  hallway: { minX: -10, maxX: 10, minZ: -1, maxZ: 2 },
  kitchen: { minX: 3, maxX: 10, minZ: -8, maxZ: -1 },
  bedroom: { minX: -4, maxX: 3, minZ: -8, maxZ: -1 },
  study:   { minX: -10, maxX: -4, minZ: -8, maxZ: -1 },
};

const WALL_T = 0.25;

/* Walls: dir 'x' runs along the x axis at z = at; dir 'z' runs along z at x = at. */
const WALL_DEFS = [
  { dir: 'x', at: -8, from: -10, to: 10 },
  { dir: 'x', at: 8, from: -10, to: 10, gaps: [[-0.9, 0.9]] },
  { dir: 'z', at: -10, from: -8, to: 8 },
  { dir: 'z', at: 10, from: -8, to: 8 },
  { dir: 'x', at: 2, from: -10, to: 10, gaps: [[-1.3, 1.3], [-7.6, -6.2], [5.2, 6.6]] },
  { dir: 'x', at: -1, from: -10, to: 10, gaps: [[-7.9, -6.5], [-1.3, 0.1], [5.9, 7.3]] },
  { dir: 'z', at: -3, from: 2, to: 8, gaps: [[4.1, 5.5]] },
  { dir: 'z', at: 3, from: 2, to: 8, gaps: [[4.1, 5.5]] },
  { dir: 'z', at: -4, from: -8, to: -1 },
  { dir: 'z', at: 3, from: -8, to: -1 },
];

class Door {
  /** A hinged door on an x-direction wall. Hinge at (hingeX, wallZ), extends +x. */
  constructor(parent, hingeX, wallZ, width, material, openAngle = 1.95) {
    this.hingeX = hingeX;
    this.wallZ = wallZ;
    this.width = width;
    this.openAngle = openAngle;
    this.angle = 0;
    this.target = 0;
    this.speed = 2.2; // rad/s default swing

    this.group = new THREE.Group();
    this.group.position.set(hingeX, 0, wallZ);
    const geo = new THREE.BoxGeometry(width - 0.04, 2.95, 0.07);
    this.mesh = new THREE.Mesh(geo, material);
    this.mesh.position.set(width / 2, 2.95 / 2, 0);
    this.group.add(this.mesh);
    // knob
    const knob = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 8, 8),
      new THREE.MeshStandardMaterial({ color: 0x6a5a30, metalness: 0.8, roughness: 0.4 })
    );
    knob.position.set(width - 0.12, 1.05, 0.06);
    this.group.add(knob);
    parent.add(this.group);
    this.mesh.userData.interact = { type: 'door', door: this };
  }

  get isClosed() { return this.angle < 0.12; }
  get isOpen() { return this.angle > this.openAngle - 0.2; }

  setOpen(open, speed = 2.2) {
    this.target = open ? this.openAngle : 0;
    this.speed = speed;
  }

  toggle() { this.setOpen(this.target < 0.5); }

  update(dt) {
    const d = this.target - this.angle;
    if (Math.abs(d) > 0.002) {
      this.angle += Math.sign(d) * Math.min(Math.abs(d), this.speed * dt);
      this.group.rotation.y = this.angle;
    }
  }

  aabb() {
    if (!this.isClosed) return null;
    return {
      minX: this.hingeX, maxX: this.hingeX + this.width,
      minZ: this.wallZ - 0.1, maxZ: this.wallZ + 0.1,
    };
  }
}

export class House {
  constructor(scene) {
    this.scene = scene;
    this.staticColliders = [];
    this.doors = [];
    this.interactables = [];
    this.keys = [];
    this.bulbs = [];
    this.windowLights = [];
    this.candles = [];
    this.props = {};
    this.flickerTime = 0;
    this.lightningTime = 0;
    this.blackout = false;

    this.mats = this._materials();
    this._buildShell();
    this._buildDoors();
    this._buildFurniture();
    this._buildLights();
    this._buildItems();
    this._buildDust();
  }

  /* ---------------- materials ---------------- */

  _materials() {
    const wallTex = TX.wallpaper();
    const floorTex = TX.woodFloor();
    floorTex.repeat.set(5, 4);
    const ceilTex = TX.plaster();
    ceilTex.repeat.set(6, 5);
    const woodTex = TX.darkWood();
    const fabricTex = TX.fabric();
    return {
      wallTexBase: wallTex,
      floor: new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 }),
      ceiling: new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.95 }),
      wood: new THREE.MeshStandardMaterial({ map: woodTex, roughness: 0.7, metalness: 0.05 }),
      fabric: new THREE.MeshStandardMaterial({ map: fabricTex, roughness: 0.95 }),
      brass: new THREE.MeshStandardMaterial({ color: 0xa07a22, metalness: 0.9, roughness: 0.3, emissive: 0x2a1d06 }),
      paper: new THREE.MeshStandardMaterial({ map: TX.paper(), roughness: 0.9, side: THREE.DoubleSide }),
    };
  }

  _wallMaterial(len) {
    const tex = this.mats.wallTexBase.clone();
    tex.needsUpdate = true;
    tex.repeat.set(Math.max(1, len / 2.6), 1.15);
    return new THREE.MeshStandardMaterial({ map: tex, roughness: 0.9 });
  }

  /* ---------------- structure ---------------- */

  _buildShell() {
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(20.6, 16.6), this.mats.floor);
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    this.scene.add(floor);

    const ceil = new THREE.Mesh(new THREE.PlaneGeometry(20.6, 16.6), this.mats.ceiling);
    ceil.rotation.x = Math.PI / 2;
    ceil.position.y = WALL_H;
    this.scene.add(ceil);

    for (const def of WALL_DEFS) this._buildWall(def);
  }

  _buildWall(def) {
    const gaps = (def.gaps || []).slice().sort((a, b) => a[0] - b[0]);
    let cursor = def.from;
    const segs = [];
    for (const [g0, g1] of gaps) {
      if (g0 > cursor) segs.push([cursor, g0]);
      // lintel above the opening
      this._wallBox(def, g0, g1, 2.45, WALL_H, false);
      cursor = g1;
    }
    if (cursor < def.to) segs.push([cursor, def.to]);
    for (const [a, b] of segs) this._wallBox(def, a, b, 0, WALL_H, true);
  }

  _wallBox(def, a, b, y0, y1, collide) {
    const len = b - a;
    if (len < 0.02) return;
    const h = y1 - y0;
    const geo = def.dir === 'x'
      ? new THREE.BoxGeometry(len, h, WALL_T)
      : new THREE.BoxGeometry(WALL_T, h, len);
    const mesh = new THREE.Mesh(geo, this._wallMaterial(len));
    if (def.dir === 'x') mesh.position.set((a + b) / 2, y0 + h / 2, def.at);
    else mesh.position.set(def.at, y0 + h / 2, (a + b) / 2);
    mesh.receiveShadow = true;
    mesh.castShadow = true;
    this.scene.add(mesh);
    if (collide) {
      const half = WALL_T / 2 + 0.02;
      this.staticColliders.push(def.dir === 'x'
        ? { minX: a, maxX: b, minZ: def.at - half, maxZ: def.at + half }
        : { minX: def.at - half, maxX: def.at + half, minZ: a, maxZ: b });
      this._baseboards(def, a, b);
    }
  }

  _baseboards(def, a, b) {
    const len = b - a;
    if (len < 0.4) return;
    for (const side of [-1, 1]) {
      const off = side * (WALL_T / 2 + 0.018);
      const geo = def.dir === 'x'
        ? new THREE.BoxGeometry(len, 0.13, 0.035)
        : new THREE.BoxGeometry(0.035, 0.13, len);
      const trim = new THREE.Mesh(geo, this.mats.wood);
      if (def.dir === 'x') trim.position.set((a + b) / 2, 0.065, def.at + off);
      else trim.position.set(def.at + off, 0.065, (a + b) / 2);
      trim.receiveShadow = true;
      this.scene.add(trim);
    }
  }

  _buildDoors() {
    this.props.studyDoor = new Door(this.scene, -7.9, -1, 1.4);
    this.props.studyDoor.mesh.material = this.mats.wood;
    this.props.bedroomDoor = new Door(this.scene, -1.3, -1, 1.4);
    this.props.bedroomDoor.mesh.material = this.mats.wood;
    this.props.bedroomDoor.angle = this.props.bedroomDoor.target = this.props.bedroomDoor.openAngle;
    this.props.bedroomDoor.group.rotation.y = this.props.bedroomDoor.angle;
    this.props.frontDoor = new Door(this.scene, -0.9, 8, 1.8);
    this.props.frontDoor.mesh.material = this.mats.wood;
    this.props.frontDoor.mesh.userData.interact = { type: 'frontdoor', door: this.props.frontDoor };
    this.doors.push(this.props.studyDoor, this.props.bedroomDoor, this.props.frontDoor);
    for (const d of this.doors) this.interactables.push(d.mesh);
  }

  /* ---------------- furniture ---------------- */

  _box(x, z, w, h, d, mat, collide = true, y = null) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    mesh.position.set(x, y === null ? h / 2 : y, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);
    if (collide) {
      this.staticColliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    }
    return mesh;
  }

  _buildFurniture() {
    const { wood, fabric } = this.mats;

    // Living room
    this._box(-8.9, 4.6, 1.1, 0.95, 3.0, fabric);              // sofa against west wall
    this._box(-8.35, 4.6, 0.25, 1.5, 3.0, fabric, false, 0.75); // sofa backrest
    this._box(-6.9, 4.6, 0.9, 0.45, 1.8, wood);                // coffee table
    this._box(-5.6, 6.9, 1.0, 1.0, 1.0, fabric);               // armchair
    this._box(-6.4, 2.55, 2.2, 2.3, 0.45, wood);               // bookshelf on hallway wall
    this._box(-9.55, 7.0, 0.6, 2.5, 1.4, wood);                // tall cabinet
    const rug = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 2.4),
      new THREE.MeshStandardMaterial({ map: TX.fabric(36, 24, 24), roughness: 1 }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(-6.7, 0.012, 4.6);
    rug.receiveShadow = true;
    this.scene.add(rug);

    // Dining room
    this._box(6.5, 5.0, 3.0, 0.78, 1.4, wood);                 // long table
    for (const [cx, cz] of [[5.4, 4.1], [6.5, 4.1], [7.6, 4.1], [5.4, 5.9], [6.5, 5.9], [7.6, 5.9]]) {
      this._box(cx, cz, 0.42, 0.9, 0.42, wood, false);
    }
    this._box(9.55, 3.4, 0.6, 1.5, 1.8, wood);                 // sideboard
    this._box(4.0, 7.3, 1.6, 2.4, 0.5, wood);                  // china cabinet

    // Kitchen
    this._box(6.6, -7.45, 6.4, 0.95, 0.75, wood);              // counter along north wall
    this._box(9.55, -6.0, 0.6, 0.95, 2.2, wood);               // counter along east wall
    this._box(9.5, -4.0, 0.85, 1.9, 0.85, wood);               // fridge
    this._box(5.6, -3.6, 1.6, 0.78, 1.6, wood);                // kitchen table
    this.props.kitchenChair = this._box(4.6, -3.6, 0.42, 0.9, 0.42, wood, false);
    this._box(6.6, -3.0, 0.42, 0.9, 0.42, wood, false);

    // Study
    this._box(-7.1, -6.1, 1.9, 0.78, 0.95, wood);              // desk
    this._box(-7.1, -5.2, 0.45, 0.95, 0.45, wood, false);      // desk chair
    this._box(-9.55, -4.6, 0.6, 2.5, 2.2, wood);               // bookshelf west
    this._box(-9.55, -7.0, 0.6, 2.5, 1.6, wood);               // bookshelf west 2
    this._box(-5.0, -7.5, 1.6, 2.3, 0.5, wood);                // shelf north

    // Bedroom
    this._box(-0.6, -6.6, 1.9, 0.55, 2.5, fabric);             // bed
    this._box(-0.6, -7.78, 1.9, 1.3, 0.18, wood, false, 0.65); // headboard
    this._box(-3.45, -7.3, 1.2, 1.1, 0.6, wood);               // dresser (key 3 here)
    this._box(0.9, -7.5, 0.5, 0.6, 0.5, wood);                 // nightstand
    this._box(2.45, -5.0, 0.9, 2.4, 0.6, wood);                // wardrobe

    // Foyer
    this._box(1.9, 7.35, 1.0, 0.85, 0.5, wood);                // side table (note here)
    this._box(-2.0, 7.4, 0.55, 2.6, 0.55, wood);               // grandfather clock body
    const clockFace = new THREE.Mesh(new THREE.CircleGeometry(0.16, 20),
      new THREE.MeshStandardMaterial({ color: 0xb8a888, roughness: 0.6 }));
    clockFace.position.set(-2.0, 2.1, 7.11);
    clockFace.rotation.y = Math.PI;
    this.scene.add(clockFace);

    // Hallway
    this._box(2.2, 1.62, 1.2, 0.85, 0.4, wood);                // hall table

    // Portraits
    this._portrait(-4.5, 1.7, -0.855, 0);
    this._portrait(3.6, 1.7, 1.855, Math.PI);
    this._portrait(-1.6, 1.8, 7.855, Math.PI);
    this._portrait(-9.855, 1.7, 0.5, Math.PI / 2);

    // Windows (frame + moonlit glass)
    this._window(-9.86, 4.5, Math.PI / 2);
    this._window(-9.86, -4.5, Math.PI / 2);
    this._window(9.86, 5.0, -Math.PI / 2, true);
    this._windowNorth(-6.5);
    this._windowNorth(8.0);

    // Dying candles — tiny warm islands in the dark
    this._candle(-7.5, 0.78, -6.35);  // study desk
    this._candle(7.4, 0.78, 4.7);     // dining table
    this._candle(0.9, 0.6, -7.45);    // bedroom nightstand

    // Cobwebs in the high corners
    this._cobweb(-9.6, 2.6, -7.6, Math.PI / 4);
    this._cobweb(9.6, 2.6, -7.6, -Math.PI / 4);
    this._cobweb(-9.6, 2.6, 7.6, 3 * Math.PI / 4);
    this._cobweb(2.7, 2.6, -1.4, -Math.PI / 4);
    this._cobweb(-3.7, 2.65, 2.4, 3 * Math.PI / 4);
  }

  _candle(x, y, z) {
    const g = new THREE.Group();
    const wax = new THREE.Mesh(
      new THREE.CylinderGeometry(0.022, 0.028, 0.13, 8),
      new THREE.MeshStandardMaterial({ color: 0xb8ad94, roughness: 0.7 })
    );
    wax.position.y = 0.065;
    const flame = new THREE.Mesh(
      new THREE.ConeGeometry(0.011, 0.045, 6),
      new THREE.MeshBasicMaterial({ color: 0xffb454 })
    );
    flame.position.y = 0.16;
    const holder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.06, 0.015, 10),
      new THREE.MeshStandardMaterial({ color: 0x44392a, metalness: 0.6, roughness: 0.5 })
    );
    holder.position.y = 0.008;
    g.add(wax, flame, holder);
    g.position.set(x, y, z);
    const light = new THREE.PointLight(0xff9c3f, 0.85, 4.5, 2);
    light.position.y = 0.2;
    g.add(light);
    light.userData.base = 0.85;
    light.userData.walk = Math.random() * 100;
    light.userData.flame = flame;
    this.scene.add(g);
    this.candles.push(light);
  }

  _cobweb(x, y, z, ry) {
    const web = new THREE.Mesh(
      new THREE.PlaneGeometry(0.95, 0.95),
      new THREE.MeshBasicMaterial({
        map: TX.cobweb(), transparent: true, opacity: 0.32,
        side: THREE.DoubleSide, depthWrite: false,
      })
    );
    web.position.set(x, y, z);
    web.rotation.y = ry;
    this.scene.add(web);
  }

  _portrait(x, y, z, ry) {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.02, 0.05), this.mats.wood);
    const art = new THREE.Mesh(new THREE.PlaneGeometry(0.68, 0.88),
      new THREE.MeshStandardMaterial({ map: TX.portrait(), roughness: 0.85 }));
    art.position.z = 0.03;
    g.add(frame, art);
    g.position.set(x, y, z);
    g.rotation.y = ry;
    this.scene.add(g);
  }

  _window(x, z, ry, eastWall = false) {
    this._windowAt(new THREE.Vector3(x, 1.7, z), ry, new THREE.Vector3(eastWall ? -0.6 : 0.6, 0.3, 0));
  }

  _windowNorth(x) {
    this._windowAt(new THREE.Vector3(x, 1.7, -7.86), 0, new THREE.Vector3(0, 0.3, 0.6));
  }

  _windowAt(pos, ry, lightOffset) {
    const g = new THREE.Group();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(1.2, 1.6, 0.06), this.mats.wood);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.4),
      new THREE.MeshStandardMaterial({ color: 0x070d18, emissive: 0x1a2c4d, emissiveIntensity: 0.85, roughness: 0.2 }));
    glass.position.z = 0.035;
    const mullV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.4, 0.02), this.mats.wood);
    mullV.position.z = 0.05;
    const mullH = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.05, 0.02), this.mats.wood);
    mullH.position.z = 0.05;
    g.add(frame, glass, mullV, mullH);
    g.position.copy(pos);
    g.rotation.y = ry;
    this.scene.add(g);

    const light = new THREE.PointLight(0x44587e, 2.2, 6.5, 1.8);
    light.position.copy(pos).add(lightOffset);
    light.userData.base = light.intensity;
    this.scene.add(light);
    this.windowLights.push(light);
  }

  /* ---------------- lights ---------------- */

  _buildLights() {
    const hemi = new THREE.HemisphereLight(0x1b2233, 0x050403, 0.22);
    this.scene.add(hemi);
    this.hemi = hemi;

    this._bulb(0, 2.62, 5.2, 0xffc788, 1.6);   // foyer
    this._bulb(0, 2.62, 0.5, 0xffc788, 1.3);   // hallway
  }

  _bulb(x, y, z, color, intensity) {
    const light = new THREE.PointLight(color, intensity, 7.5, 1.9);
    light.position.set(x, y, z);
    light.userData.base = intensity;
    light.userData.walk = Math.random() * 100;
    this.scene.add(light);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, WALL_H - y + 0.1),
      new THREE.MeshStandardMaterial({ color: 0x111111 }));
    cord.position.set(x, (WALL_H + y) / 2, z);
    this.scene.add(cord);
    const bulbMesh = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 10),
      new THREE.MeshStandardMaterial({ color: 0x332211, emissive: color, emissiveIntensity: 1.4 }));
    bulbMesh.position.set(x, y, z);
    this.scene.add(bulbMesh);
    light.userData.mesh = bulbMesh;
    this.bulbs.push(light);
  }

  /* ---------------- items ---------------- */

  _buildItems() {
    // key locations are randomized per room — no two runs match
    const pick = (spots) => spots[Math.floor(Math.random() * spots.length)];
    const kitchenSpot = pick([[8.9, 1.03, -7.3], [5.6, 0.86, -3.6], [9.5, 1.03, -5.6]]);
    const studySpot = pick([[-6.7, 0.86, -6.2], [-7.1, 1.03, -5.2], [-8.9, 0.1, -7.4]]);
    const bedroomSpot = pick([[-3.45, 1.18, -7.25], [0.9, 0.68, -7.5], [-0.6, 0.63, -6.2]]);
    this._key(...kitchenSpot, 'kitchen');
    this._key(...studySpot, 'study');
    this._key(...bedroomSpot, 'bedroom');

    // spare batteries — ammunition for the light
    this._battery(-6.9, 0.49, 4.2);   // living coffee table
    this._battery(6.0, 0.83, 5.1);    // dining table
    this._battery(2.0, 0.91, 1.62);   // hallway table
    this._battery(9.5, 1.0, -6.7);    // kitchen counter

    this._note(1.9, 0.785, 7.3,
      'They sealed every window from the outside.\n\nThe front door has three locks now. I hid the keys somewhere in the kitchen, the study, the bedroom — I keep moving them so HE cannot gather them.\n\nIf you are reading this — do not let him hear you run.');
    this._note(-7.4, 0.795, -6.3,
      'Night 41.\n\nHe cannot stand the light. Hold your beam on him — HOLD IT, do not blink — and he comes apart like smoke.\n\nBut the light eats batteries, and taking what is his only makes him angrier. The last key wakes him fully.\n\nGod forgive me, I am going to try tonight.');
  }

  _battery(x, y, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(
      new THREE.CylinderGeometry(0.032, 0.032, 0.11, 10),
      new THREE.MeshStandardMaterial({ color: 0x202428, roughness: 0.5, metalness: 0.4 })
    );
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(0.033, 0.033, 0.025, 10),
      new THREE.MeshStandardMaterial({ color: 0x8a2018, roughness: 0.4, metalness: 0.3, emissive: 0x220503 })
    );
    cap.position.y = 0.055;
    const tip = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.012, 8),
      new THREE.MeshStandardMaterial({ color: 0x999999, metalness: 0.9, roughness: 0.3 })
    );
    tip.position.y = 0.073;
    g.add(body, cap, tip);
    g.rotation.z = Math.PI / 2 - 0.12;
    g.rotation.y = Math.random() * Math.PI;
    g.position.set(x, y + 0.035, z);
    const glint = new THREE.PointLight(0x664433, 0.35, 1.1, 2);
    g.add(glint);
    for (const child of [body, cap, tip]) {
      child.userData.interact = { type: 'battery', group: g };
      this.interactables.push(child);
    }
    this.scene.add(g);
  }

  removeBattery(group) {
    this.scene.remove(group);
    this.interactables = this.interactables.filter(m => m.userData.interact?.group !== group);
  }

  _key(x, y, z, id) {
    const g = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 0.13, 8), this.mats.brass);
    shaft.rotation.z = Math.PI / 2;
    const bow = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.011, 8, 14), this.mats.brass);
    bow.position.x = -0.08;
    const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.018, 0.035, 0.012), this.mats.brass);
    tooth.position.set(0.05, -0.026, 0);
    g.add(shaft, bow, tooth);
    g.position.set(x, y, z);
    g.userData.baseY = y;
    g.userData.spin = Math.random() * Math.PI * 2;
    // a faint glint so keys are findable in the dark
    const glint = new THREE.PointLight(0xaa8833, 0.55, 1.6, 2);
    g.add(glint);
    for (const child of [shaft, bow, tooth]) {
      child.userData.interact = { type: 'key', id, group: g };
      this.interactables.push(child);
    }
    this.scene.add(g);
    this.keys.push(g);
  }

  _note(x, y, z, text) {
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(0.26, 0.36), this.mats.paper);
    mesh.rotation.x = -Math.PI / 2;
    mesh.rotation.z = (Math.random() - 0.5) * 0.8;
    mesh.position.set(x, y, z);
    mesh.userData.interact = { type: 'note', text };
    this.scene.add(mesh);
    this.interactables.push(mesh);
  }

  removeKey(group) {
    this.scene.remove(group);
    this.keys = this.keys.filter(k => k !== group);
    this.interactables = this.interactables.filter(m => m.userData.interact?.group !== group);
  }

  /* ---------------- dust ---------------- */

  _buildDust() {
    const N = 240;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = BOUNDS.minX + Math.random() * 20;
      pos[i * 3 + 1] = Math.random() * 2.8;
      pos[i * 3 + 2] = BOUNDS.minZ + Math.random() * 16;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const mat = new THREE.PointsMaterial({
      color: 0x9999aa, size: 0.018, transparent: true, opacity: 0.4,
      blending: THREE.AdditiveBlending, depthWrite: false,
    });
    this.dust = new THREE.Points(geo, mat);
    this.scene.add(this.dust);
  }

  /* ---------------- runtime ---------------- */

  getColliders() {
    const out = this.staticColliders.slice();
    for (const d of this.doors) {
      const box = d.aabb();
      if (box) out.push(box);
    }
    return out;
  }

  flickerAll(duration) { this.flickerTime = Math.max(this.flickerTime, duration); }

  /** Lightning outside the windows — works even during the blackout. */
  lightningFlash() { this.lightningTime = 0.55; }

  setBlackout(on) {
    this.blackout = on;
    const all = [...this.bulbs, ...this.windowLights];
    for (const l of all) l.intensity = on ? 0 : l.userData.base;
    this.hemi.intensity = on ? 0.05 : 0.22;
    for (const b of this.bulbs) if (b.userData.mesh) b.userData.mesh.material.emissiveIntensity = on ? 0 : 1.4;
  }

  update(dt, t) {
    for (const d of this.doors) d.update(dt);

    // key shimmer
    for (const k of this.keys) {
      k.rotation.y += dt * 1.2;
      k.position.y = k.userData.baseY + Math.sin(t * 2 + k.userData.spin) * 0.012;
    }

    // light behavior
    if (this.flickerTime > 0) {
      this.flickerTime -= dt;
      for (const l of [...this.bulbs, ...this.windowLights]) {
        l.intensity = Math.random() < 0.45 ? 0 : l.userData.base * (0.3 + Math.random());
        if (l.userData.mesh) l.userData.mesh.material.emissiveIntensity = l.intensity > 0 ? 1.4 : 0;
      }
      if (this.flickerTime <= 0 && !this.blackout) {
        for (const l of [...this.bulbs, ...this.windowLights]) {
          l.intensity = l.userData.base;
          if (l.userData.mesh) l.userData.mesh.material.emissiveIntensity = 1.4;
        }
      }
    } else if (!this.blackout) {
      // idle organic bulb wobble
      for (const b of this.bulbs) {
        b.userData.walk += dt;
        const n = Math.sin(b.userData.walk * 7.3) * Math.sin(b.userData.walk * 3.1 + 1.7);
        b.intensity = b.userData.base * (0.82 + 0.18 * n) * (Math.random() < 0.003 ? 0.15 : 1);
      }
    }

    // lightning overrides everything at the windows
    if (this.lightningTime > 0) {
      this.lightningTime -= dt;
      // double-strobe pattern
      const phase = 0.55 - this.lightningTime;
      const on = (phase < 0.12) || (phase > 0.22 && phase < 0.38);
      for (const l of this.windowLights) {
        l.intensity = on ? l.userData.base * 11 : (this.blackout ? 0 : l.userData.base);
        l.color.setHex(on ? 0xb8c8ee : 0x44587e);
      }
      if (this.lightningTime <= 0) {
        for (const l of this.windowLights) {
          l.intensity = this.blackout ? 0 : l.userData.base;
          l.color.setHex(0x44587e);
        }
      }
    }

    // candle flames never die — they gutter
    for (const c of this.candles) {
      c.userData.walk += dt;
      const n = Math.sin(c.userData.walk * 11.7) * Math.sin(c.userData.walk * 5.3 + 0.9);
      c.intensity = c.userData.base * (0.7 + 0.3 * n);
      const f = c.userData.flame;
      f.scale.set(1 + n * 0.25, 1 + Math.abs(n) * 0.4, 1 + n * 0.25);
      f.rotation.z = n * 0.18;
    }

    // dust drift
    const p = this.dust.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      let y = p.getY(i) - dt * 0.045;
      if (y < 0.05) y = 2.8;
      p.setY(i, y);
      p.setX(i, p.getX(i) + Math.sin(t * 0.6 + i) * dt * 0.012);
    }
    p.needsUpdate = true;
  }
}
