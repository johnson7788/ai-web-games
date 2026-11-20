// Sky Collector — original 3D platformer. Inspired by three-player-controller (MIT, hh-hang).
import * as THREE from 'three';

// ============================ i18n / save ============================
const T = (s) => (window.I18N && window.I18N.t ? window.I18N.t(s) : s);
const SDK = window.PipySDK || null;
const save = {
  get(k, d) { try { if (SDK && SDK.load) { const v = SDK.load(k, d); return v == null ? d : v; } } catch (e) {} try { const v = localStorage.getItem('skycol:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { if (SDK && SDK.save) { SDK.save(k, v); return; } } catch (e) {} try { localStorage.setItem('skycol:' + k, JSON.stringify(v)); } catch (e) {} },
};

// ============================ audio ============================
const Audio = (() => {
  let ctx = null, muted = save.get('muted', false), master = null;
  function ensure() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); master = ctx.createGain(); master.gain.value = muted ? 0 : 0.5; master.connect(ctx.destination); } catch (e) {} } if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {}); }
  function blip(freq, dur, type = 'sine', vol = 0.3, slide = 0) { if (!ctx || muted) return; try { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.value = freq; if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), ctx.currentTime + dur); g.gain.setValueAtTime(vol, ctx.currentTime); g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur); o.connect(g); g.connect(master); o.start(); o.stop(ctx.currentTime + dur); } catch (e) {} }
  return {
    ensure,
    jump() { blip(420, 0.16, 'square', 0.18, 240); },
    double() { blip(560, 0.16, 'square', 0.18, 320); },
    land() { blip(150, 0.09, 'triangle', 0.16, -60); },
    orb() { blip(880, 0.12, 'sine', 0.24, 220); setTimeout(() => blip(1320, 0.14, 'sine', 0.2), 60); },
    portal() { blip(300, 0.5, 'sawtooth', 0.16, 600); },
    win() { [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => blip(f, 0.22, 'triangle', 0.22), i * 110)); },
    lose() { blip(300, 0.4, 'sawtooth', 0.2, -200); },
    bounce() { blip(240, 0.2, 'square', 0.2, 400); },
    toggleMute() { muted = !muted; save.set('muted', muted); if (master) master.gain.value = muted ? 0 : 0.5; return muted; },
    get muted() { return muted; },
  };
})();

// ============================ levels ============================
// platform: {x,y,z,w,h,d,type}  type: static|move|bounce|spin ; move:{axis,amp,speed,phase}
// orb: {x,y,z} ; portal/spawn/checkpoint: {x,y,z}
const LEVELS = [
  { name: 'First Steps', gold: 18, silver: 28, spawn: { x: 0, y: 1.2, z: 0 }, portal: { x: 0, y: 1.0, z: -34 },
    plats: [
      { x: 0, y: 0, z: 0, w: 8, h: 1, d: 8 },
      { x: 0, y: 0, z: -9, w: 5, h: 1, d: 5 },
      { x: 3, y: 0.5, z: -16, w: 5, h: 1, d: 5 },
      { x: -2, y: 1, z: -23, w: 5, h: 1, d: 5 },
      { x: 0, y: 0.5, z: -34, w: 7, h: 1, d: 7 },
    ],
    orbs: [{ x: 0, y: 1.4, z: -9 }, { x: 3, y: 1.9, z: -16 }, { x: -2, y: 2.4, z: -23 }, { x: 0, y: 1.9, z: -29 }],
    checks: [{ x: 0, y: 1.2, z: -16 }] },
  { name: 'Moving Isles', gold: 26, silver: 40, spawn: { x: 0, y: 1.2, z: 0 }, portal: { x: 0, y: 2.0, z: -40 },
    plats: [
      { x: 0, y: 0, z: 0, w: 7, h: 1, d: 7 },
      { x: 0, y: 0.5, z: -10, w: 4, h: 1, d: 4, type: 'move', move: { axis: 'x', amp: 3, speed: 1.1, phase: 0 } },
      { x: 0, y: 1, z: -18, w: 4, h: 1, d: 4 },
      { x: 0, y: 1.5, z: -26, w: 4, h: 1, d: 4, type: 'move', move: { axis: 'x', amp: 3.5, speed: 1.4, phase: 1.5 } },
      { x: 0, y: 1.5, z: -33, w: 4, h: 1, d: 4, type: 'bounce' },
      { x: 0, y: 1.5, z: -40, w: 7, h: 1, d: 7 },
    ],
    orbs: [{ x: 0, y: 2.0, z: -10 }, { x: 0, y: 2.5, z: -18 }, { x: 0, y: 3.0, z: -26 }, { x: 0, y: 4.5, z: -36 }],
    checks: [{ x: 0, y: 2.2, z: -18 }] },
  { name: 'Bounce & Spin', gold: 34, silver: 52, spawn: { x: 0, y: 1.2, z: 0 }, portal: { x: 0, y: 3.0, z: -44 },
    plats: [
      { x: 0, y: 0, z: 0, w: 7, h: 1, d: 7 },
      { x: 0, y: 0, z: -9, w: 4, h: 1, d: 4, type: 'bounce' },
      { x: 0, y: 2.5, z: -17, w: 5, h: 1, d: 5 },
      { x: 0, y: 2.5, z: -25, w: 6, h: 1, d: 3, type: 'spin', move: { speed: 1.2 } },
      { x: 0, y: 2.5, z: -33, w: 4, h: 1, d: 4, type: 'move', move: { axis: 'y', amp: 1.5, speed: 1.3, phase: 0 } },
      { x: 0, y: 2.5, z: -44, w: 7, h: 1, d: 7 },
    ],
    orbs: [{ x: 0, y: 3.5, z: -13 }, { x: 0, y: 4.0, z: -17 }, { x: 2, y: 4.0, z: -25 }, { x: 0, y: 5.5, z: -33 }, { x: 0, y: 4.0, z: -40 }],
    checks: [{ x: 0, y: 3.7, z: -17 }] },
  { name: 'Sky Master', gold: 46, silver: 70, spawn: { x: 0, y: 1.2, z: 0 }, portal: { x: 0, y: 4.0, z: -52 },
    plats: [
      { x: 0, y: 0, z: 0, w: 6, h: 1, d: 6 },
      { x: 2, y: 0.5, z: -8, w: 3, h: 1, d: 3 },
      { x: -2, y: 1, z: -15, w: 3, h: 1, d: 3, type: 'move', move: { axis: 'x', amp: 2.5, speed: 1.6, phase: 0 } },
      { x: 0, y: 1.5, z: -22, w: 3, h: 1, d: 3, type: 'bounce' },
      { x: 0, y: 3.5, z: -30, w: 5, h: 1, d: 2.5, type: 'spin', move: { speed: 1.5 } },
      { x: 2, y: 3.5, z: -38, w: 3, h: 1, d: 3, type: 'move', move: { axis: 'x', amp: 3, speed: 1.8, phase: 2 } },
      { x: -1, y: 3.5, z: -45, w: 3, h: 1, d: 3, type: 'move', move: { axis: 'y', amp: 1.2, speed: 1.5, phase: 1 } },
      { x: 0, y: 3.5, z: -52, w: 6, h: 1, d: 6 },
    ],
    orbs: [{ x: 2, y: 2.0, z: -8 }, { x: -2, y: 2.5, z: -15 }, { x: 0, y: 5.0, z: -26 }, { x: 0, y: 5.0, z: -30 }, { x: 2, y: 5.0, z: -38 }, { x: -1, y: 6.0, z: -45 }],
    checks: [{ x: 0, y: 4.7, z: -30 }] },
];

// ============================ three setup ============================
const canvas = document.getElementById('canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.fog = new THREE.Fog(0x1b2a5e, 40, 120);
const camera = new THREE.PerspectiveCamera(60, 1, 0.1, 300);

// sky gradient background
const skyGeo = new THREE.SphereGeometry(180, 24, 16);
const skyMat = new THREE.ShaderMaterial({
  side: THREE.BackSide, depthWrite: false,
  uniforms: { top: { value: new THREE.Color(0x0a1230) }, bot: { value: new THREE.Color(0x3a5bbf) } },
  vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'varying vec3 vP; uniform vec3 top; uniform vec3 bot; void main(){ float h = clamp(normalize(vP).y*0.5+0.5,0.0,1.0); gl_FragColor = vec4(mix(bot,top,pow(h,0.8)),1.0); }',
});
scene.add(new THREE.Mesh(skyGeo, skyMat));

const hemi = new THREE.HemisphereLight(0xbcd4ff, 0x2a3a6e, 0.9); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xfff2cc, 1.5); sun.position.set(20, 40, 10);
sun.castShadow = true; sun.shadow.mapSize.set(1024, 1024);
sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -60; sun.shadow.camera.far = 120;
scene.add(sun); scene.add(sun.target);

// clouds (drifting billboards)
const cloudGroup = new THREE.Group(); scene.add(cloudGroup);
const cloudMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.16, depthWrite: false });
for (let i = 0; i < 26; i++) {
  const s = 6 + Math.random() * 14;
  const c = new THREE.Mesh(new THREE.SphereGeometry(s, 8, 6), cloudMat);
  c.scale.y = 0.35;
  c.position.set((Math.random() - 0.5) * 120, -8 - Math.random() * 18, -Math.random() * 120 + 10);
  c.userData.sp = 0.2 + Math.random() * 0.5; cloudGroup.add(c);
}
// stars
const starGeo = new THREE.BufferGeometry(); const starPos = [];
for (let i = 0; i < 200; i++) { const r = 150, t = Math.random() * Math.PI * 2, p = Math.random() * Math.PI * 0.5; starPos.push(r * Math.cos(t) * Math.cos(p), r * Math.sin(p) + 20, r * Math.sin(t) * Math.cos(p)); }
starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
scene.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xffffff, size: 0.7, transparent: true, opacity: 0.7 })));

// ============================ character ============================
const char = new THREE.Group();
const bodyMat = new THREE.MeshStandardMaterial({ color: 0xff7a59, roughness: 0.5 });
const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.35, 0.5, 6, 12), bodyMat);
body.position.y = 0.6; body.castShadow = true; char.add(body);
const eyeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
const pupilMat = new THREE.MeshBasicMaterial({ color: 0x1a1a2e });
[-0.14, 0.14].forEach(x => { const e = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), eyeMat); e.position.set(x, 0.95, 0.3); char.add(e); const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 8, 6), pupilMat); p.position.set(x, 0.95, 0.37); char.add(p); });
scene.add(char);
const HALF = { x: 0.35, y: 0.6, z: 0.35 }; // capsule half-extents (feet at pos.y - 0.6)

// ============================ level build ============================
let levelGroup = new THREE.Group(); scene.add(levelGroup);
let plats = [], orbs = [], portal = null, portalActive = false, checkpoint = null;
const grassMat = new THREE.MeshStandardMaterial({ color: 0x6cc86a, roughness: 0.9 });
const stoneMat = new THREE.MeshStandardMaterial({ color: 0x5a6488, roughness: 0.95 });
const bounceMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, roughness: 0.6, emissive: 0x664400 });
const spinMat = new THREE.MeshStandardMaterial({ color: 0xff5d73, roughness: 0.6 });
const orbMat = new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xffaa00, emissiveIntensity: 1.4, roughness: 0.3 });

function buildLevel(idx) {
  scene.remove(levelGroup); levelGroup = new THREE.Group(); scene.add(levelGroup);
  plats = []; orbs = []; portalActive = false;
  const L = LEVELS[idx];
  for (const p of L.plats) {
    const mat = p.type === 'bounce' ? bounceMat : p.type === 'spin' ? spinMat : grassMat;
    const g = new THREE.Group();
    const top = new THREE.Mesh(new THREE.BoxGeometry(p.w, 0.3, p.d), mat); top.position.y = p.h / 2 - 0.15; top.castShadow = true; top.receiveShadow = true; g.add(top);
    const base = new THREE.Mesh(new THREE.BoxGeometry(p.w * 0.9, p.h, p.d * 0.9), stoneMat); base.position.y = -0.1; base.castShadow = true; g.add(base);
    g.position.set(p.x, p.y, p.z); levelGroup.add(g);
    plats.push({ def: p, mesh: g, base: { x: p.x, y: p.y, z: p.z }, prev: { x: p.x, y: p.y, z: p.z }, cur: { x: p.x, y: p.y, z: p.z }, angle: 0 });
  }
  for (const o of L.orbs) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 12), orbMat);
    m.position.set(o.x, o.y, o.z);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.5, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.18 }));
    m.add(glow); levelGroup.add(m);
    orbs.push({ mesh: m, pos: { x: o.x, y: o.y, z: o.z }, taken: false, phase: Math.random() * 6 });
  }
  // portal
  portal = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1.1, 0.16, 12, 32), new THREE.MeshStandardMaterial({ color: 0x38bdf8, emissive: 0x0ea5e9, emissiveIntensity: 0.4 }));
  portal.add(ring);
  const disc = new THREE.Mesh(new THREE.CircleGeometry(1.0, 24), new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.15, side: THREE.DoubleSide }));
  portal.add(disc); portal.userData = { ring, disc };
  portal.position.set(L.portal.x, L.portal.y + 1.1, L.portal.z); levelGroup.add(portal);
  checkpoint = { x: L.spawn.x, y: L.spawn.y, z: L.spawn.z };
}

// ============================ particles ============================
const particles = [];
function burst(pos, color, n = 14, speed = 4) {
  for (let i = 0; i < n; i++) {
    const m = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 4), new THREE.MeshBasicMaterial({ color, transparent: true }));
    m.position.copy(pos);
    const v = new THREE.Vector3((Math.random() - 0.5), Math.random() * 0.8 + 0.2, (Math.random() - 0.5)).normalize().multiplyScalar(speed * (0.5 + Math.random() * 0.5));
    scene.add(m); particles.push({ m, v, life: 0.7 });
  }
}
function updateParticles(dt) {
  for (let i = particles.length - 1; i >= 0; i--) { const p = particles[i]; p.life -= dt; p.v.y -= 9 * dt; p.m.position.addScaledVector(p.v, dt); p.m.material.opacity = Math.max(0, p.life / 0.7); if (p.life <= 0) { scene.remove(p.m); particles.splice(i, 1); } }
}

// ============================ physics state ============================
const P = { pos: new THREE.Vector3(), vel: new THREE.Vector3(), onGround: false, jumps: 0, coyote: 0, jumpBuf: 0, standPlat: null };
const GRAV = -26, MOVE = 7.5, SPRINT = 11, JUMP = 10.5, DOUBLE = 9.5, BOUNCE = 17;
let camYaw = 0, camPitch = 0.32, camDist = 8;

function respawn() { P.pos.set(checkpoint.x, checkpoint.y, checkpoint.z); P.vel.set(0, 0, 0); P.jumps = 0; P.onGround = false; }

function collideAxis(axis) {
  // resolve character AABB against platform AABBs along one axis
  for (const pl of plats) {
    const p = pl.def, c = pl.cur;
    let hw = p.w / 2, hd = p.d / 2;
    if (p.type === 'spin') { /* spinning bar: treat as rotating OBB approximated by its current angle */ }
    const minX = c.x - hw, maxX = c.x + hw, minZ = c.z - hd, maxZ = c.z + hd;
    const minY = c.y - p.h / 2, maxY = c.y + p.h / 2;
    const px = P.pos.x, py = P.pos.y, pz = P.pos.z;
    if (px + HALF.x > minX && px - HALF.x < maxX && pz + HALF.z > minZ && pz - HALF.z < maxZ && py + HALF.y > minY && py - HALF.y < maxY) {
      if (axis === 'y') {
        if (P.vel.y <= 0 && py > c.y) { P.pos.y = maxY + HALF.y; P.vel.y = 0; P.onGround = true; P.standPlat = pl; if (p.type === 'bounce') { P.vel.y = BOUNCE; P.onGround = false; P.jumps = 1; Audio.bounce(); burst(P.pos.clone(), 0xffd23f, 10, 3); } }
        else if (P.vel.y > 0) { P.pos.y = minY - HALF.y; P.vel.y = 0; }
      } else if (axis === 'x') {
        if (P.vel.x > 0) P.pos.x = minX - HALF.x; else if (P.vel.x < 0) P.pos.x = maxX + HALF.x; P.vel.x = 0;
      } else if (axis === 'z') {
        if (P.vel.z > 0) P.pos.z = minZ - HALF.z; else if (P.vel.z < 0) P.pos.z = maxZ + HALF.z; P.vel.z = 0;
      }
    }
  }
}

function updatePlatforms(t, dt) {
  for (const pl of plats) {
    pl.prev = { ...pl.cur };
    const p = pl.def;
    if (p.type === 'move' && p.move) { const m = p.move; const off = Math.sin(t * m.speed + (m.phase || 0)) * m.amp; pl.cur = { x: pl.base.x + (m.axis === 'x' ? off : 0), y: pl.base.y + (m.axis === 'y' ? off : 0), z: pl.base.z }; }
    else if (p.type === 'spin') { pl.angle += dt * (p.move ? p.move.speed : 1); pl.cur = { ...pl.base }; pl.mesh.rotation.y = pl.angle; }
    else pl.cur = { ...pl.base };
    pl.mesh.position.set(pl.cur.x, pl.cur.y, pl.cur.z);
  }
}

function physics(dt, input, t) {
  updatePlatforms(t, dt);
  // carry by moving platform
  if (P.standPlat && P.onGround) { const pl = P.standPlat; P.pos.x += pl.cur.x - pl.prev.x; P.pos.y += pl.cur.y - pl.prev.y; P.pos.z += pl.cur.z - pl.prev.z; }
  // horizontal input relative to camera yaw
  const sp = input.sprint ? SPRINT : MOVE;
  let ix = input.x, iz = input.y;
  const len = Math.hypot(ix, iz); if (len > 1) { ix /= len; iz /= len; }
  const sin = Math.sin(camYaw), cos = Math.cos(camYaw);
  const wx = ix * cos - iz * sin, wz = ix * sin + iz * cos;
  const accel = P.onGround ? 60 : 30;
  P.vel.x += (wx * sp - P.vel.x) * Math.min(1, accel * dt / sp);
  P.vel.z += (wz * sp - P.vel.z) * Math.min(1, accel * dt / sp);
  // gravity
  P.vel.y += GRAV * dt; if (P.vel.y < -40) P.vel.y = -40;
  // jump buffering + coyote
  P.coyote = P.onGround ? 0.12 : Math.max(0, P.coyote - dt);
  P.jumpBuf = Math.max(0, P.jumpBuf - dt);
  if (input.jumpPressed) P.jumpBuf = 0.14;
  if (P.jumpBuf > 0) {
    if (P.onGround || P.coyote > 0) { P.vel.y = JUMP; P.onGround = false; P.coyote = 0; P.jumpBuf = 0; P.jumps = 1; Audio.jump(); burst(P.pos.clone().setY(P.pos.y - 0.5), 0xffffff, 6, 2); }
    else if (P.jumps === 1) { P.vel.y = DOUBLE; P.jumps = 2; P.jumpBuf = 0; Audio.double(); burst(P.pos.clone(), 0x38bdf8, 10, 3); }
  }
  const wasGround = P.onGround; P.onGround = false; P.standPlat = null;
  P.pos.x += P.vel.x * dt; collideAxis('x');
  P.pos.z += P.vel.z * dt; collideAxis('z');
  P.pos.y += P.vel.y * dt; collideAxis('y');
  if (P.onGround && !wasGround && P.vel.y === 0) Audio.land();
  if (P.onGround) P.jumps = 0;
  // spin bar knockback
  for (const pl of plats) { if (pl.def.type === 'spin') { const dx = P.pos.x - pl.cur.x, dz = P.pos.z - pl.cur.z; const dist = Math.hypot(dx, dz); if (dist < pl.def.w / 2 + 0.3 && Math.abs(P.pos.y - pl.cur.y) < 1.4) { const a = pl.angle; const bx = Math.cos(a), bz = -Math.sin(a); const along = dx * bx + dz * bz; const perp = Math.abs(dx * (-bz) + dz * bx); if (Math.abs(along) < pl.def.w / 2 && perp < 0.5) { P.vel.x += (-bz) * 8 * Math.sign(dx * (-bz) + dz * bx || 1); P.vel.z += bx * 8 * Math.sign(dx * (-bz) + dz * bx || 1); P.vel.y = 6; } } } }
  // face movement
  if (Math.hypot(P.vel.x, P.vel.z) > 0.5) { const target = Math.atan2(P.vel.x, P.vel.z); let d = target - char.rotation.y; while (d > Math.PI) d -= Math.PI * 2; while (d < -Math.PI) d += Math.PI * 2; char.rotation.y += d * Math.min(1, 12 * dt); }
  char.position.copy(P.pos); char.position.y -= 0.6;
  // squash on land
  const sq = P.onGround ? 1 : 1.05; body.scale.set(1 / sq, sq, 1 / sq);
}

// ============================ input ============================
const keys = {}; const input = { x: 0, y: 0, sprint: false, jumpPressed: false };
let dragging = false, lastMX = 0, lastMY = 0;
window.addEventListener('keydown', e => {
  if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  if (e.repeat) return;
  keys[e.code] = true; Audio.ensure();
  if (e.code === 'Space' || e.code === 'KeyW' && false) input.jumpPressed = true;
  if (e.code === 'Escape' || e.code === 'KeyP') togglePause();
  if (e.code === 'KeyR' && state === 'playing') restartLevel();
});
window.addEventListener('keyup', e => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', e => { dragging = true; lastMX = e.clientX; lastMY = e.clientY; Audio.ensure(); canvas.setPointerCapture(e.pointerId); });
canvas.addEventListener('pointermove', e => { if (dragging) { camYaw -= (e.clientX - lastMX) * 0.005; camPitch = Math.max(0.05, Math.min(1.2, camPitch + (e.clientY - lastMY) * 0.004)); lastMX = e.clientX; lastMY = e.clientY; } });
canvas.addEventListener('pointerup', e => { dragging = false; });
canvas.addEventListener('wheel', e => { camDist = Math.max(5, Math.min(14, camDist + e.deltaY * 0.01)); }, { passive: true });

// touch joystick
const stick = document.getElementById('stick'), nub = document.getElementById('stick-nub');
let stickId = null, stickCX = 0, stickCY = 0;
const isTouch = matchMedia('(pointer: coarse)').matches;
if (isTouch) document.getElementById('touch').classList.remove('hidden');
stick.addEventListener('pointerdown', e => { stickId = e.pointerId; const r = stick.getBoundingClientRect(); stickCX = r.left + r.width / 2; stickCY = r.top + r.height / 2; stick.setPointerCapture(e.pointerId); Audio.ensure(); });
stick.addEventListener('pointermove', e => { if (e.pointerId !== stickId) return; let dx = e.clientX - stickCX, dy = e.clientY - stickCY; const m = Math.hypot(dx, dy), max = 48; if (m > max) { dx = dx / m * max; dy = dy / m * max; } nub.style.transform = `translate(${dx}px,${dy}px)`; input.x = dx / max; input.y = dy / max; });
const stickEnd = e => { if (e.pointerId !== stickId) return; stickId = null; nub.style.transform = ''; input.x = 0; input.y = 0; };
stick.addEventListener('pointerup', stickEnd); stick.addEventListener('pointercancel', stickEnd);
document.getElementById('btn-jump').addEventListener('pointerdown', e => { e.preventDefault(); input.jumpPressed = true; Audio.ensure(); });

function pollInput() {
  if (!isTouch || stickId === null) {
    input.x = (keys['KeyD'] || keys['ArrowRight'] ? 1 : 0) - (keys['KeyA'] || keys['ArrowLeft'] ? 1 : 0);
    input.y = (keys['KeyS'] || keys['ArrowDown'] ? 1 : 0) - (keys['KeyW'] || keys['ArrowUp'] ? 1 : 0);
  }
  input.sprint = !!(keys['ShiftLeft'] || keys['ShiftRight']);
}

// ============================ game state ============================
let state = 'title', levelIdx = 0, lives = 3, levelTime = 0, totalTime = 0, orbsGot = 0, hintTimer = 0;
const $ = id => document.getElementById(id);
const screens = ['title', 'how', 'complete', 'gameover', 'victory', 'pause'];
function showScreen(name) { screens.forEach(s => $(s).classList.toggle('hidden', s !== name)); $('hud').classList.toggle('hidden', name !== null && state !== 'playing'); $('btn-pause').classList.toggle('hidden', state !== 'playing'); }
function showHint(txt, dur = 3) { $('hint').textContent = T(txt); $('hint').classList.add('show'); hintTimer = dur; }
function updateLives() { $('lives').innerHTML = ''; for (let i = 0; i < 3; i++) { const h = document.createElement('span'); h.className = 'heart' + (i < lives ? '' : ' lost'); h.innerHTML = '<svg viewBox="0 0 24 24" width="24" height="24"><path fill="#ff5d73" d="M12 21s-8-5.3-8-11a4.5 4.5 0 0 1 8-2.8A4.5 4.5 0 0 1 20 10c0 5.7-8 11-8 11z"/></svg>'; $('lives').appendChild(h); } }
function updateHUD() { $('orb-count').textContent = orbsGot + '/' + orbs.length; $('level-num').textContent = (levelIdx + 1); $('timer').textContent = levelTime.toFixed(1); const best = save.get('best' + levelIdx, null); $('best-hud').textContent = best ? (T('Best') + ' ' + best.toFixed(1) + 's') : ''; }
function starsFor(time, L) { return time <= L.gold ? 3 : time <= L.silver ? 2 : 1; }
function renderStars(el, n) { el.innerHTML = ''; for (let i = 0; i < 3; i++) { const s = document.createElement('span'); s.className = i < n ? 'star-on' : 'star-off'; s.textContent = '★'; el.appendChild(s); } }

function startGame() { levelIdx = 0; lives = 3; totalTime = 0; startLevel(); }
function startLevel() {
  buildLevel(levelIdx); respawn(); orbsGot = 0; levelTime = 0; portalActive = false;
  state = 'playing'; showScreen(null); $('hud').classList.remove('hidden'); $('btn-pause').classList.remove('hidden');
  updateLives(); updateHUD(); camYaw = 0; camPitch = 0.32;
  showHint(levelIdx === 0 ? 'Collect all the orbs, then reach the portal!' : 'Level ' + (levelIdx + 1) + ': ' + LEVELS[levelIdx].name, 3.5);
  if (SDK) SDK.newRun({ level: levelIdx });
}
function restartLevel() { startLevel(); }
function togglePause() { if (state === 'playing') { state = 'paused'; showScreen('pause'); } else if (state === 'paused') { state = 'playing'; showScreen(null); $('hud').classList.remove('hidden'); } }

function collectOrbs() {
  for (const o of orbs) { if (o.taken) continue; const d = Math.hypot(P.pos.x - o.pos.x, (P.pos.y) - o.pos.y, P.pos.z - o.pos.z); if (d < 1.0) { o.taken = true; o.mesh.visible = false; orbsGot++; Audio.orb(); burst(o.mesh.position.clone(), 0xffd23f, 16, 4); updateHUD(); if (orbsGot === orbs.length) { portalActive = true; Audio.portal(); showHint('Portal opened! Head to the blue ring.', 3); } } }
}
function checkPortal() {
  if (!portalActive) return; const L = LEVELS[levelIdx];
  if (Math.hypot(P.pos.x - L.portal.x, P.pos.z - L.portal.z) < 1.3 && Math.abs(P.pos.y - (L.portal.y + 0.6)) < 2) {
    state = 'complete'; Audio.win(); burst(portal.position.clone(), 0x38bdf8, 30, 6);
    const stars = starsFor(levelTime, L); const best = save.get('best' + levelIdx, null);
    const isBest = best == null || levelTime < best; if (isBest) save.set('best' + levelIdx, Math.round(levelTime * 10) / 10);
    save.set('unlocked', Math.max(save.get('unlocked', 0), levelIdx + 1));
    totalTime += levelTime;
    $('complete-time').textContent = levelTime.toFixed(1) + 's'; renderStars($('stars'), stars);
    $('complete-best').textContent = isBest ? T('New best!') : (T('Best') + ': ' + best.toFixed(1) + 's');
    $('btn-next').textContent = levelIdx >= LEVELS.length - 1 ? T('Finish') : T('Next level');
    showScreen('complete'); if (SDK) SDK.levelCleared({ level: levelIdx, time: levelTime, stars });
  }
}
function checkFall() {
  if (P.pos.y < -16) {
    lives--; Audio.lose(); updateLives(); flash('#ff5d73');
    if (lives <= 0) { state = 'gameover'; $('go-level').textContent = (levelIdx + 1); showScreen('gameover'); if (SDK) SDK.gameOver({ level: levelIdx }); }
    else { respawn(); showHint('Careful! ' + lives + ' lives left.', 2); }
  }
}
function flash(color) { const f = $('flash'); f.style.background = color; f.style.opacity = '0.4'; setTimeout(() => f.style.opacity = '0', 120); }

$('btn-start').onclick = () => { Audio.ensure(); startGame(); };
$('btn-how').onclick = () => showScreen('how');
$('btn-how-back').onclick = () => showScreen('title');
$('btn-next').onclick = () => { if (levelIdx >= LEVELS.length - 1) { state = 'victory'; $('vic-time').textContent = totalTime.toFixed(1) + 's'; renderStars($('vic-stars'), 3); showScreen('victory'); Audio.win(); } else { levelIdx++; startLevel(); } };
$('btn-retry').onclick = () => startGame();
$('btn-again').onclick = () => startGame();
$('btn-resume').onclick = () => togglePause();
$('btn-restart').onclick = () => { state = 'playing'; restartLevel(); };
$('btn-quit').onclick = () => { state = 'title'; showScreen('title'); };
$('btn-pause').onclick = () => togglePause();
$('btn-mute').onclick = () => { const m = Audio.toggleMute(); $('btn-mute').classList.toggle('muted', m); };
$('btn-mute').classList.toggle('muted', Audio.muted);

// ============================ camera & loop ============================
const camTarget = new THREE.Vector3(), camPos = new THREE.Vector3();
function updateCamera(dt) {
  camTarget.copy(P.pos); camTarget.y += 0.8;
  const cp = Math.cos(camPitch), sp = Math.sin(camPitch);
  camPos.set(camTarget.x + Math.sin(camYaw) * cp * camDist, camTarget.y + sp * camDist, camTarget.z + Math.cos(camYaw) * cp * camDist);
  camera.position.lerp(camPos, Math.min(1, 10 * dt));
  camera.lookAt(camTarget);
  sun.target.position.copy(P.pos); sun.position.set(P.pos.x + 20, P.pos.y + 40, P.pos.z + 10);
}
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener('resize', resize); resize();

let last = performance.now(), acc = 0; const STEP = 1 / 60;
function frame(now) {
  requestAnimationFrame(frame);
  let dt = (now - last) / 1000; last = now; if (dt > 0.1) dt = 0.1;
  const t = now / 1000;
  // ambient anims always
  cloudGroup.children.forEach(c => { c.position.x += c.userData.sp * dt; if (c.position.x > 70) c.position.x = -70; });
  for (const o of orbs) { if (!o.taken) { o.mesh.position.y = o.pos.y + Math.sin(t * 2 + o.phase) * 0.15; o.mesh.rotation.y += dt * 1.5; } }
  if (portal) { portal.rotation.y += dt * (portalActive ? 1.5 : 0.3); const em = portalActive ? 1.6 : 0.3; portal.userData.ring.material.emissiveIntensity = em; portal.userData.disc.material.opacity = portalActive ? 0.4 + Math.sin(t * 4) * 0.1 : 0.1; portal.scale.setScalar(portalActive ? 1 + Math.sin(t * 3) * 0.04 : 1); }
  updateParticles(dt);
  if (state === 'playing') {
    if (autopilot) autopilotInput(); else pollInput();
    acc += dt; let n = 0;
    while (acc >= STEP && n < 5) { physics(STEP, input, t); input.jumpPressed = false; acc -= STEP; n++; }
    if (n === 5) acc = 0;
    levelTime += dt; collectOrbs(); checkPortal(); checkFall(); updateHUD();
    if (hintTimer > 0) { hintTimer -= dt; if (hintTimer <= 0) $('hint').classList.remove('show'); }
    updateCamera(dt);
  } else if (state === 'title' || state === 'complete' || state === 'gameover' || state === 'victory') {
    // idle orbit on title
    if (state === 'title') { camYaw += dt * 0.15; if (!plats.length) buildLevel(0); updateCamera(dt); char.position.set(0, 0.6, 0); }
    else updateCamera(dt);
  }
  renderer.render(scene, camera);
}
buildLevel(0); respawn(); showScreen('title'); updateCamera(0.016);
requestAnimationFrame(frame);
if (SDK) SDK.track('load', { game: 'sky-collector' });
// debug hook for automated verification
let autopilot = false, apIdx = 0;
function autopilotInput() {
  const L = LEVELS[levelIdx];
  const targets = L.orbs.map(o => ({ x: o.x, y: o.y, z: o.z })).concat([{ x: L.portal.x, y: L.portal.y, z: L.portal.z }]);
  if (apIdx >= targets.length) { input.x = 0; input.y = 0; return; }
  const tg = targets[apIdx];
  const dx = tg.x - P.pos.x, dz = tg.z - P.pos.z, dist = Math.hypot(dx, dz);
  if (dist < 1.0) { apIdx++; input.jumpPressed = false; return; }
  input.x = Math.max(-1, Math.min(1, dx * 2)); input.y = Math.max(-1, Math.min(1, dz * 2)); input.sprint = true;
  // bunny-hop forward to clear gaps reliably; double-jump toward higher targets
  if (P.onGround) input.jumpPressed = true;
  else if (P.jumps === 1 && P.vel.y < 1 && tg.y > P.pos.y + 0.3) input.jumpPressed = true;
  // rescue if fallen
  if (P.pos.y < -10) { const cp = apIdx > 0 ? targets[apIdx - 1] : L.spawn; P.pos.set(cp.x, cp.y + 1.2, cp.z); P.vel.set(0, 0, 0); }
}
window.__sky = {
  get state() { return state; }, get orbsGot() { return orbsGot; }, get orbsTotal() { return orbs.length; },
  get level() { return levelIdx; }, get lives() { return lives; }, get pos() { return { x: P.pos.x, y: P.pos.y, z: P.pos.z }; },
  get portalActive() { return portalActive; }, get time() { return levelTime; },
  start() { startGame(); }, teleport(x, y, z) { P.pos.set(x, y, z); P.vel.set(0, 0, 0); },
  autoplay(on) { autopilot = !!on; apIdx = 0; if (on) { lives = 99; } },
};