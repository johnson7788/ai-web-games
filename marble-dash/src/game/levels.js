// Marble Dash — 6 handcrafted floating tracks (original level design)
// Board space: +X right, -Z forward, Y up. Track tops at y=0 unless noted.
import * as THREE from 'three';

export const LEVELS = [
  // ---------------------------------------------------------------- 1
  {
    name: 'First Roll', gold: 11, silver: 18,
    theme: { edge: 0x22d3ee, accent: 0x7dd3fc },
    start: [0, 2], goal: [0, -29.5],
    guide: [[0, -8], [0, -16], [0, -24], [0, -29.5]],
    slabs: [
      { x: 0, z: 2, w: 7, d: 7 },
      { x: 0, z: -13.5, w: 4.5, d: 24 },
      { x: 0, z: -29, w: 8, d: 8 },
    ],
    gems: [[0, 0.85, -8], [0, 0.85, -14], [0, 0.85, -20]],
  },
  // ---------------------------------------------------------------- 2
  {
    name: 'The Narrows', gold: 16, silver: 26,
    theme: { edge: 0x5eead4, accent: 0x34d399 },
    start: [0, 2], goal: [0, -41],
    guide: [[0, -6], [0, -13.5], [0, -22.5], [0, -31], [0, -41]],
    slabs: [
      { x: 0, z: 2, w: 7, d: 7 },
      { x: 0, z: -4.5, w: 4, d: 6 },
      { x: 0, z: -13.5, w: 1.7, d: 12 },
      { x: 0, z: -22.5, w: 6, d: 6 },
      { x: 0, z: -31.5, w: 1.4, d: 12 },
      { x: 0, z: -41, w: 7, d: 7 },
    ],
    checkpoints: [[0, -22.5]],
    gems: [[0, 0.85, -13.5], [-1.7, 0.85, -22.5], [1.7, 0.85, -22.5], [0, 0.85, -29], [0, 0.85, -34]],
  },
  // ---------------------------------------------------------------- 3
  {
    name: 'Switchback', gold: 24, silver: 38,
    theme: { edge: 0xa78bfa, accent: 0xf472b6 },
    start: [0, 2], goal: [0, -45],
    guide: [[0, -6], [0, -13.5], [6, -13.5], [13, -13.5], [13, -21], [13, -29], [7, -29], [0, -29], [0, -37], [0, -45]],
    slabs: [
      { x: 0, z: 2, w: 7, d: 7 },
      { x: 0, z: -5, w: 2.8, d: 13 },
      { x: 0, z: -13.5, w: 5, d: 5 },
      { x: 6, z: -13.5, w: 13, d: 2.8 },
      { x: 13, z: -13.5, w: 5, d: 5 },
      { x: 13, z: -21, w: 2.8, d: 12 },
      { x: 13, z: -29, w: 5, d: 5 },
      { x: 7.5, z: -29, w: 12, d: 2.8 },
      { x: 0, z: -29, w: 6, d: 6 },
      { x: 0, z: -37, w: 2.8, d: 10 },
      { x: 0, z: -45, w: 7, d: 7 },
    ],
    walls: [
      { x: -1.75, z: -6, w: 0.4, d: 10, h: 0.85 },
      { x: 0, z: -16.2, w: 5.4, d: 0.4, h: 0.85 },
      { x: 15.7, z: -13.5, w: 0.4, d: 5.4, h: 0.85 },
      { x: 13, z: -31.7, w: 5.4, d: 0.4, h: 0.85 },
      { x: 7.5, z: -30.6, w: 8, d: 0.4, h: 0.85 },
    ],
    checkpoints: [[0, -29]],
    gems: [[0, 0.85, -13.5], [13, 0.85, -13.5], [13, 0.85, -21], [13, 0.85, -29], [-1.6, 0.85, -29], [1.6, 0.85, -29], [0, 0.85, -37]],
  },
  // ---------------------------------------------------------------- 4
  {
    name: 'Sky Jump', gold: 20, silver: 32,
    theme: { edge: 0xfbbf24, accent: 0xfb923c },
    start: [0, 2], goal: [0, -46.5],
    guide: [[0, -7], [0, -14.5], [0, -24.4], [0, -31], [0, -36], [0, -46.5]],
    slabs: [
      { x: 0, z: 2, w: 7, d: 7 },
      { x: 0, z: -7.25, w: 4, d: 11.5 },
      { x: 0, z: -24.4, w: 6, d: 8, y: -0.4 },
      { x: 0, z: -31.4, w: 3.4, d: 6, y: -0.4 },
      { x: 0, z: -45.8, w: 8, d: 8, y: -0.6 },
    ],
    ramps: [
      { x: 0, z: -14.6, w: 4, len: 3.2, rise: 1.5, dir: '-z' },
      { x: 0, z: -35.9, w: 3.4, len: 3, rise: 1.5, dir: '-z', y: -0.4 },
    ],
    boosts: [
      { x: 0, z: -10.5, w: 3.6, d: 2.2, dir: [0, -1], power: 3.2 },
      { x: 0, z: -32.6, w: 3, d: 2, dir: [0, -1], power: 3.2, y: -0.4 },
    ],
    bumpers: [{ x: -1.9, z: -24.5, r: 0.55, y: -0.4 }, { x: 1.9, z: -26.2, r: 0.55, y: -0.4 }],
    checkpoints: [[0, -22.6]],
    gems: [[0, 2.0, -18.3], [0, -0.4 + 0.85, -23], [0, 1.8, -39.6], [0, -0.6 + 0.85, -44]],
  },
  // ---------------------------------------------------------------- 5
  {
    name: 'Drift Works', gold: 32, silver: 50,
    theme: { edge: 0x38bdf8, accent: 0xa3e635 },
    start: [0, 2], goal: [0, -45.5],
    guide: [[0, -5], [0, -11.5], [0, -17.5], [0, -24], [0, -30.5], [0, -38], [0, -45.5]],
    slabs: [
      { x: 0, z: 2, w: 7, d: 7 },
      { x: 0, z: -5.25, w: 3.6, d: 7.5 },
      { x: 0, z: -17.5, w: 6, d: 7 },
      { x: 0, z: -30.5, w: 6, d: 7 },
      { x: 0, z: -38, w: 2.6, d: 8 },
      { x: 0, z: -45.5, w: 7, d: 7 },
    ],
    movers: [
      { x: 0, z: -11.5, w: 3.4, d: 4.2, axis: 'x', range: 3, speed: 0.7, phase: 0 },
      { x: 0, z: -24, w: 3.2, d: 3.2, axis: 'z', range: 2.6, speed: 0.55, phase: 1 },
    ],
    spinners: [{ x: 0, z: -30.5, len: 5.2, speed: 1.1 }],
    walls: [
      { x: -1.55, z: -38, w: 0.35, d: 7, h: 0.7 },
      { x: 1.55, z: -38, w: 0.35, d: 7, h: 0.7 },
    ],
    checkpoints: [[0, -16.2]],
    gems: [[0, 0.85, -5], [-1.8, 0.85, -18.5], [1.8, 0.85, -18.5], [-2, 0.85, -32.5], [2, 0.85, -28.5], [0, 0.85, -38]],
  },
  // ---------------------------------------------------------------- 6
  {
    name: 'Neon Gauntlet', gold: 45, silver: 70,
    theme: { edge: 0xf472b6, accent: 0xfb7185 },
    start: [0, 2], goal: [0, -57],
    guide: [[0, -6.5], [0, -14.5], [0, -20], [0, -31.2], [0, -36.8], [0, -42.4], [0, -49.4], [0, -57]],
    slabs: [
      { x: 0, z: 2, w: 7, d: 7 },
      { x: 0, z: -6.5, w: 1.6, d: 10 },
      { x: 0, z: -14.5, w: 6, d: 6 },
      { x: 0, z: -19.25, w: 3, d: 3.5 },
      { x: 0, z: -31.2, w: 6, d: 6, y: -0.5 },
      { x: 0, z: -42.4, w: 6, d: 6 },
      { x: 0, z: -46.2, w: 2.6, d: 1.6 },
      { x: 0, z: -49.4, w: 1.6, d: 8 },
      { x: 0, z: -57, w: 7, d: 7 },
    ],
    ramps: [{ x: 0, z: -22.4, w: 3, len: 2.8, rise: 1.4, dir: '-z' }],
    boosts: [{ x: 0, z: -19.2, w: 2.6, d: 2, dir: [0, -1], power: 3.4 }],
    movers: [{ x: 0, z: -36.8, w: 3.2, d: 4, axis: 'x', range: 2.3, speed: 0.8, phase: 2 }],
    spinners: [
      { x: 0, z: -14.5, len: 4.6, speed: 1.2 },
      { x: 0, z: -42.4, len: 4.6, speed: -1.2 },
    ],
    bumpers: [{ x: -1.8, z: -30, r: 0.55, y: -0.5 }, { x: 1.8, z: -32.6, r: 0.55, y: -0.5 }],
    checkpoints: [[0, -12.6], [0, -29.4], [0, -40.6]],
    gems: [[0, 0.85, -6.5], [0, 1.9, -26], [0, -0.5 + 0.85, -31.2], [-2, 0.85, -44], [2, 0.85, -40.8], [0, 0.85, -47.5], [0, 0.85, -51]],
  },
];

const DIRS = { '-z': [0, -1], '+z': [0, 1], '-x': [-1, 0], '+x': [1, 0] };
const THICK = 0.7;

// ---------------------------------------------------------------- builder
export function buildLevel(def, tex) {
  const group = new THREE.Group();
  const rt = {
    def, group,
    supports: [], walls: [], ramps: [], movers: [], spinners: [],
    bumpers: [], gems: [], checkpoints: [], boosts: [],
    goal: { x: def.goal[0], z: def.goal[1], y: 0 },
    start: { x: def.start[0], z: def.start[1] },
    anim: [], // meshes with per-frame visual updates
  };
  const edgeMat = new THREE.MeshBasicMaterial({ color: def.theme.edge });
  const accentMat = new THREE.MeshBasicMaterial({ color: def.theme.accent });
  const rockMat = new THREE.MeshStandardMaterial({ color: 0x241b45, roughness: 0.95, flatShading: true });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2a2350, roughness: 0.7, flatShading: true });
  const disposables = [edgeMat, accentMat, rockMat, wallMat];

  const topMatFor = (w, d) => {
    const t = tex.trackTop.clone();
    t.needsUpdate = true;
    t.repeat.set(Math.max(1, Math.round(w / 4)), Math.max(1, Math.round(d / 4)));
    const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.82, metalness: 0.15 });
    disposables.push(t, m);
    return m;
  };
  const sideMat = new THREE.MeshStandardMaterial({ color: 0x141126, roughness: 0.9, flatShading: true });
  disposables.push(sideMat);

  function neonEdges(parent, w, d, y, mat, h = 0.12) {
    const g = new THREE.BoxGeometry(1, 1, 1);
    const mk = (sx, sy, sz, px, py, pz) => {
      const m = new THREE.Mesh(g, mat);
      m.scale.set(sx, sy, sz); m.position.set(px, py, pz);
      parent.add(m);
    };
    mk(w + 0.14, h, 0.14, 0, y, d / 2);
    mk(w + 0.14, h, 0.14, 0, y, -d / 2);
    mk(0.14, h, d + 0.14, w / 2, y, 0);
    mk(0.14, h, d + 0.14, -w / 2, y, 0);
    disposables.push(g);
  }

  function rockUnder(x, y, z, w, d) {
    const r = Math.min(w, d) * 0.42;
    const h = 2 + Math.min(w, d) * 0.45;
    const g = new THREE.ConeGeometry(r, h, 5 + ((w * 7 + d * 13) | 0) % 3);
    const m = new THREE.Mesh(g, rockMat);
    m.rotation.x = Math.PI;
    m.rotation.y = (x * 1.3 + z * 0.7) % Math.PI;
    m.position.set(x, y - THICK - h / 2 + 0.3, z);
    group.add(m);
    disposables.push(g);
  }

  function slabMesh(x, y, z, w, d, mover = false) {
    const g = new THREE.BoxGeometry(w, THICK, d);
    const top = mover ? tex.chevAmber.clone() : topMatFor(w, d);
    if (mover) { top.needsUpdate = true; top.repeat.set(Math.max(1, w / 2.4), Math.max(1, d / 2.4)); }
    const mesh = new THREE.Mesh(g, [sideMat, sideMat, top, sideMat, sideMat, sideMat]);
    mesh.position.set(x, y - THICK / 2, z);
    mesh.receiveShadow = true;
    group.add(mesh);
    disposables.push(g);
    const eg = new THREE.Group();
    eg.position.set(x, y, z);
    neonEdges(eg, w, d, 0.02, mover ? accentMat : edgeMat);
    group.add(eg);
    return { mesh, edges: eg };
  }

  // ---- static slabs
  for (const s of def.slabs || []) {
    const y = s.y || 0;
    const { mesh, edges } = slabMesh(s.x, y, s.z, s.w, s.d);
    rt.supports.push({ x0: s.x - s.w / 2, x1: s.x + s.w / 2, z0: s.z - s.d / 2, z1: s.z + s.d / 2, y });
    if (s.w >= 5 && s.d >= 5) rockUnder(s.x, y, s.z, s.w, s.d);
    else if (s.d >= 8) { rockUnder(s.x, y, s.z - s.d * 0.28, s.w, 3); rockUnder(s.x, y, s.z + s.d * 0.28, s.w, 3); }
    rt.anim.push({ type: 'slab', mesh, edges });
  }

  // ---- walls
  for (const w of def.walls || []) {
    const y = w.y || 0;
    const h = w.h || 0.85;
    const g = new THREE.BoxGeometry(w.w, h, w.d);
    const m = new THREE.Mesh(g, wallMat);
    m.position.set(w.x, y + h / 2, w.z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    const eg = new THREE.Group(); eg.position.set(w.x, y + h, w.z);
    neonEdges(eg, w.w, w.d, 0, edgeMat, 0.08);
    group.add(eg);
    rt.walls.push({ x0: w.x - w.w / 2, x1: w.x + w.w / 2, z0: w.z - w.d / 2, z1: w.z + w.d / 2, y0: y, y1: y + h });
    disposables.push(g);
  }

  // ---- ramps (wedge prisms)
  for (const r of def.ramps || []) {
    const [dx, dz] = DIRS[r.dir];
    const base = r.y || 0;
    const hx = dz !== 0 ? r.w / 2 : r.len / 2;
    const hz = dz !== 0 ? r.len / 2 : r.w / 2;
    // geometry built ascending toward -Z, then rotated
    const w = r.w, len = r.len, rise = r.rise;
    const x0 = -w / 2, x1 = w / 2, zLow = len / 2, zHigh = -len / 2;
    const A = [x0, 0, zLow], B = [x1, 0, zLow], C = [x1, 0, zHigh], D = [x0, 0, zHigh];
    const E = [x0, rise, zHigh], F = [x1, rise, zHigh];
    const tris = [A, B, F, A, F, E, D, E, F, D, F, C, A, D, C, A, C, B, A, E, D, B, C, F];
    const pos = new Float32Array(tris.flat());
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.computeVertexNormals();
    const slopeTex = tex.chev.clone(); slopeTex.needsUpdate = true; slopeTex.repeat.set(w / 2.6, len / 2.6);
    const slopeMat = new THREE.MeshStandardMaterial({ map: slopeTex, roughness: 0.7, flatShading: true });
    const m = new THREE.Mesh(g, [slopeMat, sideMat]);
    // assign slope faces to material 0, rest to 1 via groups
    g.clearGroups();
    g.addGroup(0, 6, 0); g.addGroup(6, tris.length - 6, 1);
    m.rotation.y = r.dir === '-z' ? 0 : r.dir === '+z' ? Math.PI : r.dir === '-x' ? Math.PI / 2 : -Math.PI / 2;
    m.position.set(r.x, base, r.z);
    m.castShadow = true; m.receiveShadow = true;
    group.add(m);
    // glowing lip on the high edge
    const lip = new THREE.Mesh(new THREE.BoxGeometry(r.dir === '-z' || r.dir === '+z' ? w : 0.14, 0.12, r.dir === '-z' || r.dir === '+z' ? 0.14 : w), accentMat);
    lip.position.set(r.x + dx * r.len / 2, base + rise + 0.05, r.z + dz * r.len / 2);
    group.add(lip);
    rt.ramps.push({ cx: r.x, cz: r.z, hx, hz, base, rise, dx, dz, len: r.len });
    rt.supports.push({ ramp: rt.ramps[rt.ramps.length - 1] });
    disposables.push(g, slopeTex, slopeMat, lip.geometry);
  }

  // ---- boost strips
  for (const b of def.boosts || []) {
    const y = (b.y || 0) + 0.03;
    const t = tex.chev.clone(); t.needsUpdate = true; t.repeat.set(b.w / 2.2, b.d / 2.2);
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.95 });
    const g = new THREE.PlaneGeometry(b.w, b.d);
    const m = new THREE.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2;
    // chevrons point "up" in texture = -Z after rotation; flip for other dirs
    if (b.dir[1] > 0) m.rotation.z = Math.PI;
    if (b.dir[0] !== 0) m.rotation.z = b.dir[0] > 0 ? -Math.PI / 2 : Math.PI / 2;
    m.position.set(b.x, y, b.z);
    group.add(m);
    rt.boosts.push({ x0: b.x - b.w / 2, x1: b.x + b.w / 2, z0: b.z - b.d / 2, z1: b.z + b.d / 2, y: b.y || 0, dir: b.dir, power: b.power, cd: 0, mesh: m });
    rt.anim.push({ type: 'boost', mesh: m, mat });
    disposables.push(t, mat, g);
  }

  // ---- moving platforms
  for (const mv of def.movers || []) {
    const { mesh, edges } = slabMesh(mv.x, 0, mv.z, mv.w, mv.d, true);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: def.theme.accent, transparent: true, opacity: 0.4, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(mv.w * 1.7, mv.d * 1.7, 1);
    glow.position.set(mv.x, -0.9, mv.z);
    group.add(glow);
    const sup = { x0: 0, x1: 0, z0: 0, z1: 0, y: 0, mover: null };
    const mover = { ...mv, px: mv.x, pz: mv.z, dx: 0, dz: 0, mesh, edges, glow, sup };
    sup.mover = mover;
    rt.movers.push(mover);
    rt.supports.push(sup);
    disposables.push(glow.material);
  }

  // ---- spinners (rotating sweeper arms)
  for (const sp of def.spinners || []) {
    const y = sp.y || 0;
    const g = new THREE.Group();
    g.position.set(sp.x, y, sp.z);
    const postG = new THREE.CylinderGeometry(0.28, 0.34, 1, 8);
    const post = new THREE.Mesh(postG, wallMat);
    post.position.y = 0.5; post.castShadow = true;
    g.add(post);
    const armG = new THREE.BoxGeometry(sp.len, 0.5, 0.55);
    const armTex = tex.hazard.clone(); armTex.needsUpdate = true; armTex.repeat.set(sp.len / 1.6, 1);
    const armMat = new THREE.MeshStandardMaterial({ map: armTex, roughness: 0.6, emissive: 0x772f00, emissiveIntensity: 0.55 });
    const arm = new THREE.Mesh(armG, armMat);
    arm.position.y = 0.55; arm.castShadow = true;
    g.add(arm);
    const tipG = new THREE.BoxGeometry(0.2, 0.62, 0.66);
    for (const s of [-1, 1]) {
      const tip = new THREE.Mesh(tipG, accentMat);
      tip.position.set(s * sp.len / 2, 0.55, 0);
      g.add(tip);
    }
    group.add(g);
    // floor warning ring
    const ringG = new THREE.RingGeometry(sp.len / 2 - 0.12, sp.len / 2 + 0.06, 40);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff9f43, transparent: true, opacity: 0.28, side: THREE.DoubleSide });
    const ring = new THREE.Mesh(ringG, ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(sp.x, y + 0.02, sp.z);
    group.add(ring);
    rt.spinners.push({ x: sp.x, z: sp.z, y, len: sp.len, speed: sp.speed, angle: 0, group: g, cd: 0 });
    disposables.push(postG, armG, armTex, armMat, tipG, ringG, ringMat);
  }

  // ---- bumpers
  for (const b of def.bumpers || []) {
    const y = b.y || 0;
    const g = new THREE.CylinderGeometry(b.r, b.r * 1.15, 0.95, 12);
    const mat = new THREE.MeshStandardMaterial({ color: 0xf472b6, emissive: 0xbe185d, emissiveIntensity: 0.9, roughness: 0.35, flatShading: true });
    const m = new THREE.Mesh(g, mat);
    m.position.set(b.x, y + 0.47, b.z);
    m.castShadow = true;
    group.add(m);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0xf472b6, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(2.4, 2.4, 1); glow.position.set(b.x, y + 0.6, b.z);
    group.add(glow);
    rt.bumpers.push({ x: b.x, z: b.z, r: b.r, y, mesh: m, mat, glow, flash: 0 });
    disposables.push(g, mat, glow.material);
  }

  // ---- gems
  for (const [gx, gy, gz] of def.gems || []) {
    const g = new THREE.OctahedronGeometry(0.34);
    const mat = new THREE.MeshStandardMaterial({ color: 0x5eead4, emissive: 0x14b8a6, emissiveIntensity: 1.25, roughness: 0.2, metalness: 0.3, flatShading: true });
    const m = new THREE.Mesh(g, mat);
    m.position.set(gx, gy, gz);
    group.add(m);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0x5eead4, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(1.5, 1.5, 1); glow.position.set(gx, gy, gz);
    group.add(glow);
    rt.gems.push({ x: gx, y: gy, z: gz, mesh: m, glow, taken: false, phase: gx * 2.1 + gz * 1.3 });
    disposables.push(g, mat, glow.material);
  }

  // ---- checkpoints
  for (const [cx, cz] of def.checkpoints || []) {
    let cy = -Infinity;
    for (const s of def.slabs || []) {
      if (cx >= s.x - s.w / 2 && cx <= s.x + s.w / 2 && cz >= s.z - s.d / 2 && cz <= s.z + s.d / 2) cy = Math.max(cy, s.y || 0);
    }
    if (!isFinite(cy)) cy = 0;
    const t = tex.ring.clone(); t.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.9, depthWrite: false });
    const g = new THREE.PlaneGeometry(2.7, 2.7);
    const m = new THREE.Mesh(g, mat);
    m.rotation.x = -Math.PI / 2; m.position.set(cx, cy + 0.04, cz);
    group.add(m);
    rt.checkpoints.push({ x: cx, z: cz, y: cy, mesh: m, mat, active: false });
    disposables.push(t, mat, g);
  }

  // ---- start marker
  {
    const t = tex.ringCyan.clone(); t.needsUpdate = true;
    const mat = new THREE.MeshBasicMaterial({ map: t, transparent: true, opacity: 0.75, depthWrite: false });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 2.4), mat);
    m.rotation.x = -Math.PI / 2; m.position.set(rt.start.x, 0.04, rt.start.z);
    group.add(m);
    disposables.push(t, mat, m.geometry);
  }

  // ---- goal: hole + ring + beacon
  {
    const gx = rt.goal.x, gz = rt.goal.z;
    // find goal surface height
    let gy = -Infinity;
    for (const s of def.slabs || []) {
      if (gx >= s.x - s.w / 2 && gx <= s.x + s.w / 2 && gz >= s.z - s.d / 2 && gz <= s.z + s.d / 2) gy = Math.max(gy, s.y || 0);
    }
    if (!isFinite(gy)) gy = 0;
    rt.goal.y = gy;
    const holeG = new THREE.CylinderGeometry(0.78, 0.78, 0.5, 24);
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x030208 });
    const hole = new THREE.Mesh(holeG, holeMat);
    hole.position.set(gx, gy - 0.24, gz);
    group.add(hole);
    const ringG = new THREE.TorusGeometry(0.86, 0.09, 10, 36);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x4ade80, emissive: 0x22c55e, emissiveIntensity: 1.6, roughness: 0.3 });
    const ring = new THREE.Mesh(ringG, ringMat);
    ring.rotation.x = -Math.PI / 2; ring.position.set(gx, gy + 0.06, gz);
    group.add(ring);
    const beaconG = new THREE.CylinderGeometry(0.5, 0.72, 7, 16, 1, true);
    const beaconMat = new THREE.MeshBasicMaterial({ color: 0x4ade80, transparent: true, opacity: 0.13, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, depthWrite: false });
    const beacon = new THREE.Mesh(beaconG, beaconMat);
    beacon.position.set(gx, gy + 3.5, gz);
    group.add(beacon);
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex.glow, color: 0x4ade80, transparent: true, opacity: 0.75, blending: THREE.AdditiveBlending, depthWrite: false }));
    glow.scale.set(3.4, 3.4, 1); glow.position.set(gx, gy + 0.3, gz);
    group.add(glow);
    const light = new THREE.PointLight(0x4ade80, 6, 9, 2);
    light.position.set(gx, gy + 1.4, gz);
    group.add(light);
    rt.goalVisual = { ring, beacon, glow, beaconMat, ringMat };
    disposables.push(holeG, holeMat, ringG, ringMat, beaconG, beaconMat, glow.material);
  }

  rt.dispose = () => {
    group.traverse((o) => { if (o.geometry) o.geometry.dispose(); });
    for (const d of disposables) if (d && d.dispose) d.dispose();
  };
  return rt;
}

// ramp surface height at a point (returns null if outside)
export function rampHeight(r, x, z) {
  if (x < r.cx - r.hx || x > r.cx + r.hx || z < r.cz - r.hz || z > r.cz + r.hz) return null;
  const t = Math.min(1, Math.max(0, ((x - r.cx) * r.dx + (z - r.cz) * r.dz) / r.len + 0.5));
  return r.base + r.rise * t;
}